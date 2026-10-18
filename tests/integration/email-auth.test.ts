import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { app } from '../../apps/api/src/index';
import type { Env } from '../../apps/api/src/auth';
import { testDatabase } from './sqlite';
import { seconds } from '../../apps/api/src/session';
let fixture: ReturnType<typeof testDatabase>, env: Env;
const password = 'A sufficiently long test passphrase';
beforeEach(() => {
  fixture = testDatabase();
  env = {
    DB: fixture.db,
    ENVIRONMENT: 'local',
    LOCAL_AUTH: 'false',
    AUTH_PROVIDER: 'email',
    ALLOWED_ORIGIN: 'http://localhost:5173',
    APP_URL: 'http://localhost:5173',
    OWNER_EMAIL: '',
    LOCAL_EMAIL_PREVIEW: 'true',
  };
});
afterEach(() => {
  fixture.sqlite.close();
  vi.unstubAllGlobals();
});
const request = (path: string, body?: unknown, cookie = '') =>
  app.request(
    `http://localhost:8787/api/v1${path}`,
    {
      method: body ? 'POST' : 'GET',
      headers: {
        ...(body ? { 'Content-Type': 'application/json', Origin: env.ALLOWED_ORIGIN } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    },
    env,
    { waitUntil: () => {}, passThroughOnException: () => {}, props: {} },
  );
async function mailToken(email: string, purpose: string) {
  const r = await request('/auth/dev-mail', { email });
  const data = (await r.json()) as { messages: { purpose: string; link: string }[] };
  const link = data.messages.find((m) => m.purpose === purpose)!.link;
  return new URLSearchParams(new URL(link).hash.split('?')[1]).get('token')!;
}
async function register(email = 'learner@gmail.com') {
  expect((await request('/auth/register', { email, password })).status).toBe(200);
  return email;
}
async function verified(email = 'learner@gmail.com') {
  await register(email);
  expect(
    (await request('/auth/verify-email', { token: await mailToken(email, 'verify') })).status,
  ).toBe(200);
  return email;
}
async function login(email: string, pass = password) {
  const r = await request('/auth/login', { email, password: pass });
  expect(r.status).toBe(200);
  return r.headers.get('set-cookie')!.split(';')[0];
}
describe('email registration, login and recovery', { timeout: 15000 }, () => {
  it('stores a salted password hash, requires verification, persists a session and signs out', async () => {
    const email = await register();
    const stored = fixture.sqlite
      .prepare('SELECT password_hash,email_verified_at FROM password_accounts')
      .get()!;
    expect(stored.password_hash).not.toContain(password);
    expect(String(stored.password_hash)).toMatch(/^pbkdf2-sha256\$600000\$/);
    expect(stored.email_verified_at).toBeNull();
    expect((await request('/auth/login', { email, password })).status).toBe(403);
    const token = await mailToken(email, 'verify');
    expect((await request('/auth/verify-email', { token })).status).toBe(200);
    expect((await request('/auth/verify-email', { token })).status).toBe(400);
    const cookie = await login(email);
    expect((await request('/me', undefined, cookie)).status).toBe(200);
    await request('/auth/logout', {}, cookie);
    expect((await request('/me', undefined, cookie)).status).toBe(401);
  });
  it('resets with a single-use token, rejects the old password and revokes every session', async () => {
    const email = await verified();
    const cookie = await login(email);
    await request('/auth/forgot-password', { email });
    const token = await mailToken(email, 'reset');
    const next = 'A changed and long passphrase';
    expect((await request('/auth/reset-password', { token, password: next })).status).toBe(200);
    expect((await request('/me', undefined, cookie)).status).toBe(401);
    expect((await request('/auth/login', { email, password })).status).toBe(401);
    await login(email, next);
    expect((await request('/auth/reset-password', { token, password })).status).toBe(400);
  });
  it('rejects expired links and uses the same recovery response for unknown addresses', async () => {
    const email = await register();
    const expected = await (
      await request('/auth/forgot-password', { email: 'unknown@gmail.com' })
    ).json();
    const actual = await (await request('/auth/forgot-password', { email })).json();
    expect(actual).toEqual(expected);
    const token = await mailToken(email, 'reset');
    fixture.sqlite.prepare('UPDATE auth_email_tokens SET expires_at=?').run(seconds() - 1);
    expect((await request('/auth/reset-password', { token, password })).status).toBe(400);
  });
  it('keeps accounts and notes isolated and never replaces a registered password', async () => {
    const a = await verified('a@gmail.com'),
      b = await verified('b@gmail.com');
    const ca = await login(a),
      cb = await login(b);
    await request(
      '/notes',
      {
        itemType: 'pattern',
        itemId: 'arrays-hashing',
        title: 'Private',
        body: 'Only A can read this.',
        tags: [],
      },
      ca,
    );
    expect(await (await request('/notes', undefined, cb)).json()).toEqual([]);
    await request('/auth/register', {
      email: a,
      password: 'Another password that must not replace it',
    });
    await login(a);
  });
  it('rate-limits password guessing and disables the local inbox in production', async () => {
    await verified();
    fixture.sqlite.exec(
      "INSERT INTO auth_email_limits SELECT email_hash,'login',CAST(strftime('%s','now')/900 AS INTEGER),10 FROM auth_email_limits LIMIT 1",
    );
    expect((await request('/auth/login', { email: 'learner@gmail.com', password })).status).toBe(
      429,
    );
    env.ENVIRONMENT = 'production';
    expect((await request('/auth/dev-mail', { email: 'learner@gmail.com' })).status).toBe(404);
  });
  it('requires configured production email delivery and rejects short passwords', async () => {
    env.LOCAL_EMAIL_PREVIEW = 'false';
    expect((await request('/auth/register', { email: 'a@gmail.com', password })).status).toBe(503);
    expect(
      (await request('/auth/register', { email: 'a@gmail.com', password: 'short' })).status,
    ).toBe(400);
  });
  it('sends account links through the email provider without exposing credentials', async () => {
    env.LOCAL_EMAIL_PREVIEW = 'false';
    env.RESEND_API_KEY = 'test-api-key';
    env.MAIL_FROM = 'DevTrack <hello@example.test>';
    const send = vi.fn().mockResolvedValue(new Response('{"id":"sent"}', { status: 200 }));
    vi.stubGlobal('fetch', send);
    await register();
    expect(send).toHaveBeenCalledOnce();
    const [url, options] = send.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    const body = JSON.parse(String(options.body));
    expect(body.to).toEqual(['learner@gmail.com']);
    expect(body.text).toContain('/verify-email?token=');
    expect(body.text).not.toContain(password);
  });
});
