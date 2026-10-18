import { beforeAll, describe, it, expect, vi } from 'vitest';
import { generateKeyPair, SignJWT, exportJWK, createLocalJWKSet } from 'jose';
let key: Awaited<ReturnType<typeof generateKeyPair>>;
let localKeys: ReturnType<typeof createLocalJWKSet>;
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
import { authenticate, type Env } from '../../apps/api/src/auth';
const issuer = 'https://devtrack-test.cloudflareaccess.com';
const env = {
  ENVIRONMENT: 'production',
  ACCESS_TEAM_DOMAIN: issuer,
  ACCESS_AUD: 'my-app',
  OWNER_EMAIL: 'owner@example.test',
} as Env;
beforeAll(async () => {
  key = await generateKeyPair('RS256');
  localKeys = createLocalJWKSet({
    keys: [{ ...(await exportJWK(key.publicKey)), kid: 'one', alg: 'RS256' }],
  });
});
async function token(
  options: { email?: string; aud?: string; iss?: string; expired?: boolean } = {},
) {
  return new SignJWT({ email: options.email ?? env.OWNER_EMAIL })
    .setProtectedHeader({ alg: 'RS256', kid: 'one' })
    .setSubject('identity')
    .setIssuer(options.iss ?? issuer)
    .setAudience(options.aud ?? 'my-app')
    .setIssuedAt()
    .setExpirationTime(options.expired ? 1 : '1h')
    .sign(key.privateKey);
}
const request = (jwt: string) =>
  new Request('https://api.example.test/api/v1/me', {
    headers: { 'Cf-Access-Jwt-Assertion': jwt },
  });
describe('verified Cloudflare Access identity', () => {
  it('accepts the signed owner identity', async () => {
    expect(await authenticate(request(await token()), env)).toBe(env.OWNER_EMAIL);
  });
  it('rejects wrong audience, issuer, identity, expiry and forged signatures', async () => {
    for (const options of [
      { aud: 'other' },
      { iss: 'https://other.cloudflareaccess.com' },
      { email: 'other@example.test' },
      { expired: true },
    ])
      expect(await authenticate(request(await token(options)), env)).toBeNull();
    const good = await token();
    const parts = good.split('.');
    parts[2] = 'forged';
    expect(await authenticate(request(parts.join('.')), env)).toBeNull();
  });
  it('never permits local bypass on a public host or in production', async () => {
    expect(
      await authenticate(new Request('https://public.example.test/api/v1/me'), {
        ...env,
        ENVIRONMENT: 'local',
        LOCAL_AUTH: 'true',
      }),
    ).toBeNull();
    expect(
      await authenticate(new Request('http://127.0.0.1/api/v1/me'), { ...env, LOCAL_AUTH: 'true' }),
    ).toBeNull();
  });
});
