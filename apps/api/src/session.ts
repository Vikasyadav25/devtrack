import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { Env } from './auth';

const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
export const sessionLifetime = 7 * 24 * 60 * 60;
export const challengeLifetime = 10 * 60;
export const seconds = () => Math.floor(Date.now() / 1000);
export const randomToken = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
export async function hashToken(value: string) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
}
export function cookieName(kind: 'session' | 'challenge', env: Env) {
  return `${env.ENVIRONMENT === 'production' ? '__Host-' : ''}devtrack_${kind}`;
}
export function readCookie(request: Request, name: string): string | null {
  const value = request.headers
    .get('Cookie')
    ?.split(';')
    .map((v) => v.trim())
    .find((v) => v.startsWith(`${name}=`))
    ?.slice(name.length + 1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}
export function authConfigured(env: Env) {
  return (
    (env.AUTH_PROVIDER === 'google' || env.AUTH_PROVIDER === 'email') &&
    !!env.GOOGLE_CLIENT_ID?.endsWith('.apps.googleusercontent.com') &&
    (env.AUTH_PROVIDER === 'email' ||
      (!!env.OWNER_EMAIL?.includes('@') && env.OWNER_EMAIL !== 'local@devtrack.test'))
  );
}
export function cookieOptions(env: Env, maxAge: number) {
  return {
    httpOnly: true,
    secure: env.ENVIRONMENT === 'production',
    sameSite: 'Lax' as const,
    path: '/',
    maxAge,
  };
}
export async function verifyGoogleCredential(credential: string, nonce: string, env: Env) {
  const { payload } = await jwtVerify(credential, googleKeys, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: env.GOOGLE_CLIENT_ID,
    algorithms: ['RS256'],
    requiredClaims: ['exp', 'iat', 'sub', 'email', 'email_verified', 'nonce'],
    maxTokenAge: '10m',
  });
  if (
    payload.nonce !== nonce ||
    payload.email_verified !== true ||
    typeof payload.email !== 'string' ||
    (env.AUTH_PROVIDER !== 'email' && payload.email.toLowerCase() !== env.OWNER_EMAIL.toLowerCase())
  )
    return null;
  // Google is authoritative for Gmail and verified Workspace domains.
  if (!payload.email.toLowerCase().endsWith('@gmail.com') && typeof payload.hd !== 'string')
    return null;
  return { subject: payload.sub!, email: payload.email.toLowerCase() };
}
export async function readSession(request: Request, env: Env): Promise<string | null> {
  if (env.AUTH_PROVIDER !== 'email' && !authConfigured(env)) return null;
  const token = readCookie(request, cookieName('session', env));
  if (!token) return null;
  if (
    env.ENVIRONMENT !== 'production' &&
    !['localhost', '127.0.0.1', '[::1]'].includes(new URL(request.url).hostname)
  )
    return null;
  if (env.ENVIRONMENT === 'production' && new URL(request.url).protocol !== 'https:') return null;
  const row = await env.DB.prepare(
    env.AUTH_PROVIDER === 'email'
      ? 'SELECT users.email FROM auth_sessions JOIN users ON users.id=auth_sessions.user_id WHERE token_hash=? AND expires_at>? AND owner_email=users.email'
      : 'SELECT users.email FROM auth_sessions JOIN users ON users.id=auth_sessions.user_id WHERE token_hash=? AND expires_at>? AND owner_email=?',
  )
    .bind(
      ...(env.AUTH_PROVIDER === 'email'
        ? [await hashToken(token), seconds()]
        : [await hashToken(token), seconds(), env.OWNER_EMAIL.toLowerCase()]),
    )
    .first<{ email: string }>();
  return row?.email ?? null;
}
