import { createRemoteJWKSet, jwtVerify } from 'jose';
import { readSession } from './session';
export interface Env {
  DB: D1Database;
  ENVIRONMENT: string;
  LOCAL_AUTH?: string;
  ALLOWED_ORIGIN: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  OWNER_EMAIL: string;
  AUTH_PROVIDER?: 'google' | 'access' | 'email';
  GOOGLE_CLIENT_ID?: string;
  LOCAL_EMAIL_PREVIEW?: string;
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
  APP_URL?: string;
}
const keys = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
export async function authenticate(request: Request, env: Env): Promise<string | null> {
  const url = new URL(request.url);
  if (
    env.ENVIRONMENT === 'local' &&
    env.LOCAL_AUTH === 'true' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  )
    return 'local@devtrack.test';
  if (env.AUTH_PROVIDER === 'google' || env.AUTH_PROVIDER === 'email')
    return readSession(request, env);
  if (
    env.ENVIRONMENT !== 'production' ||
    !env.ACCESS_TEAM_DOMAIN ||
    !env.ACCESS_AUD ||
    !env.OWNER_EMAIL
  )
    return null;
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return null;
  try {
    const issuer = env.ACCESS_TEAM_DOMAIN.replace(/\/$/, '');
    if (
      !issuer.startsWith('https://') ||
      !new URL(issuer).hostname.endsWith('.cloudflareaccess.com')
    )
      return null;
    let jwks = keys.get(issuer);
    if (!jwks) {
      jwks = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
      keys.set(issuer, jwks);
    }
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience: env.ACCESS_AUD,
      algorithms: ['RS256'],
      requiredClaims: ['exp', 'iat', 'sub', 'email'],
    });
    return typeof payload.email === 'string' &&
      payload.email.toLowerCase() === env.OWNER_EMAIL.toLowerCase()
      ? payload.email.toLowerCase()
      : null;
  } catch {
    return null;
  }
}
