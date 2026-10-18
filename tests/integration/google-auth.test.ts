import { beforeAll, beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { generateKeyPair, exportJWK, createLocalJWKSet, SignJWT } from 'jose';
let keys: Awaited<ReturnType<typeof generateKeyPair>>,
  localKeys: ReturnType<typeof createLocalJWKSet>;
vi.mock('jose', async (original) => {
  const actual = await original<typeof import('jose')>();
  return {
    ...actual,
    createRemoteJWKSet:
      () =>
      (...args: Parameters<ReturnType<typeof createLocalJWKSet>>) =>
        localKeys(...args),
  };
});
import { app } from '../../apps/api/src/index';
import type { Env } from '../../apps/api/src/auth';
import { testDatabase } from './sqlite';
import { hashToken, seconds } from '../../apps/api/src/session';
let fixture: ReturnType<typeof testDatabase>, env: Env;
beforeAll(async () => {
  keys = await generateKeyPair('RS256');
  localKeys = createLocalJWKSet({
    keys: [{ ...(await exportJWK(keys.publicKey)), kid: 'google-test', alg: 'RS256' }],
  });
});
beforeEach(() => {
  fixture = testDatabase();
  env = {
    DB: fixture.db,
    ENVIRONMENT: 'local',
    LOCAL_AUTH: 'false',
    AUTH_PROVIDER: 'google',
    GOOGLE_CLIENT_ID: 'devtrack.apps.googleusercontent.com',
    ALLOWED_ORIGIN: 'http://localhost:5173',
    OWNER_EMAIL: 'owner@gmail.com',
  };
});
afterEach(() => fixture.sqlite.close());
const request = (path: string, body?: unknown, cookie = '', origin = 'http://localhost:5173') =>
  app.request(
    `http://localhost:8787/api/v1${path}`,
    {
      method: body ? 'POST' : 'GET',
      headers: {
        ...(body ? { 'Content-Type': 'application/json', Origin: origin } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    },
    env,
  );
async function challenge() {
  const response = await request('/auth/challenge', {});
  expect(response.status).toBe(200);
  return {
    nonce: ((await response.json()) as { nonce: string }).nonce,
    cookie: response.headers.get('set-cookie')!.split(';')[0],
  };
}
async function credential(
  nonce: string,
  overrides: Record<string, unknown> = {},
  aud = env.GOOGLE_CLIENT_ID!,
) {
  return new SignJWT({ email: env.OWNER_EMAIL, email_verified: true, nonce, ...overrides })
    .setSubject('stable-google-subject')
    .setIssuedAt()
    .setExpirationTime('5m')
    .setIssuer('https://accounts.google.com')
    .setAudience(aud)
    .setProtectedHeader({ alg: 'RS256', kid: 'google-test' })
    .sign(keys.privateKey);
}
describe('Google sign-in and opaque sessions', () => {
  it('protects private routes and exposes only public setup configuration', async () => {
    expect((await request('/me')).status).toBe(401);
    const config = (await (await request('/auth/config')).json()) as Record<string, unknown>;
    expect(config.configured).toBe(true);
    expect(config).not.toHaveProperty('ownerEmail');
  });
  it('verifies Google identity, creates a hashed session, rejects replay and revokes logout', async () => {
    const start = await challenge();
    const token = await credential(start.nonce);
    const response = await request('/auth/google', { credential: token }, start.cookie);
    expect(response.status).toBe(200);
    const cookie = response.headers.get('set-cookie')!.match(/devtrack_session=([a-f0-9]{64})/)![0];
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect(response.headers.get('set-cookie')).toContain('SameSite=Lax');
    expect(fixture.sqlite.prepare('SELECT token_hash FROM auth_sessions').get()).toMatchObject({
      token_hash: await hashToken(cookie.split('=')[1]),
    });
    const me = await request('/me', undefined, cookie);
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({
      email: env.OWNER_EMAIL,
      authProvider: 'google',
      id: 'google:stable-google-subject',
    });
    expect((await request('/auth/google', { credential: token }, start.cookie)).status).toBe(401);
    expect((await request('/auth/logout', {}, cookie)).status).toBe(200);
    expect((await request('/me', undefined, cookie)).status).toBe(401);
  });
  it('rejects forged, wrong audience, unverified, wrong nonce and non-owner credentials', async () => {
    const start = await challenge();
    for (const [claims, audience] of [
      [{ email: 'stranger@gmail.com' }, env.GOOGLE_CLIENT_ID],
      [{ email_verified: false }, env.GOOGLE_CLIENT_ID],
      [{ nonce: 'wrong' }, env.GOOGLE_CLIENT_ID],
      [{}, 'wrong.apps.googleusercontent.com'],
    ] as [Record<string, unknown>, string][]) {
      expect(
        (
          await request(
            '/auth/google',
            { credential: await credential(start.nonce, claims, audience) },
            start.cookie,
          )
        ).status,
      ).toBeGreaterThanOrEqual(400);
    }
    const signed = await credential(start.nonce);
    expect(
      (await request('/auth/google', { credential: signed.slice(0, -20) + 'forged' }, start.cookie))
        .status,
    ).toBe(401);
  });
  it('requires same-origin challenge cookies and rejects expired sessions', async () => {
    expect((await request('/auth/challenge', {}, '', 'https://evil.example')).status).toBe(403);
    const start = await challenge();
    expect(
      (await request('/auth/google', { credential: await credential(start.nonce) })).status,
    ).toBe(401);
    const response = await request(
      '/auth/google',
      { credential: await credential(start.nonce) },
      start.cookie,
    );
    const cookie = response.headers.get('set-cookie')!.match(/devtrack_session=([a-f0-9]{64})/)![0];
    fixture.sqlite.prepare('UPDATE auth_sessions SET expires_at=?').run(seconds() - 1);
    expect((await request('/me', undefined, cookie)).status).toBe(401);
  });
  it('fails closed when Google configuration is absent', async () => {
    env.GOOGLE_CLIENT_ID = '';
    expect((await request('/auth/challenge', {})).status).toBe(503);
    expect((await request('/me')).status).toBe(401);
  });
});
