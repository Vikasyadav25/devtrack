import type { Hono } from 'hono';
import { setCookie } from 'hono/cookie';
import { z } from 'zod';
import type { AppContext } from '../types';
import { registerEmailAuthRoutes } from './email-auth';
import { localMailPreview } from '../mail';
import {
  authConfigured,
  challengeLifetime,
  cookieName,
  cookieOptions,
  hashToken,
  randomToken,
  readCookie,
  seconds,
  sessionLifetime,
  verifyGoogleCredential,
} from '../session';

export function registerAuthRoutes(app: Hono<AppContext>) {
  app.get('/api/v1/auth/config', (c) =>
    c.json({
      provider: c.env.AUTH_PROVIDER ?? 'access',
      configured: authConfigured(c.env),
      clientId: authConfigured(c.env) ? c.env.GOOGLE_CLIENT_ID : null,
      origin: c.env.ALLOWED_ORIGIN,
      emailEnabled: c.env.AUTH_PROVIDER === 'email',
      localEmailPreview: localMailPreview(c.env, c.req.url),
    }),
  );
  app.use('/api/v1/auth/*', async (c, next) => {
    if (c.req.method === 'GET') return next();
    if (c.req.header('Origin') !== c.env.ALLOWED_ORIGIN)
      return c.json({ error: 'Sign-in request origin is invalid.' }, 403);
    const window = Math.floor(seconds() / 60),
      key = await hashToken(c.req.header('CF-Connecting-IP') ?? 'local');
    const count = await c.env.DB.prepare(
      'INSERT INTO auth_request_limits VALUES(?,?,1) ON CONFLICT(key_hash) DO UPDATE SET window=excluded.window,count=CASE WHEN auth_request_limits.window=excluded.window THEN auth_request_limits.count+1 ELSE 1 END RETURNING count',
    )
      .bind(key, window)
      .first<{ count: number }>();
    if ((count?.count ?? 31) > 30) {
      c.header('Retry-After', '60');
      return c.json({ error: 'Too many sign-in attempts. Please try again in a minute.' }, 429);
    }
    await next();
  });
  registerEmailAuthRoutes(app);
  app.post('/api/v1/auth/challenge', async (c) => {
    if (!authConfigured(c.env))
      return c.json({ error: 'Google sign-in needs an OAuth Client ID and owner email.' }, 503);
    const token = randomToken(),
      nonce = randomToken(),
      at = seconds(),
      prior = readCookie(c.req.raw, cookieName('challenge', c.env));
    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM auth_challenges WHERE expires_at<=? OR token_hash=?').bind(
        at,
        prior ? await hashToken(prior) : '',
      ),
      c.env.DB.prepare('DELETE FROM auth_sessions WHERE expires_at<=?').bind(at),
      c.env.DB.prepare('DELETE FROM auth_request_limits WHERE window<?').bind(
        Math.floor(at / 60) - 60,
      ),
      c.env.DB.prepare('INSERT INTO auth_challenges VALUES(?,?,?)').bind(
        await hashToken(token),
        nonce,
        at + challengeLifetime,
      ),
    ]);
    setCookie(c, cookieName('challenge', c.env), token, cookieOptions(c.env, challengeLifetime));
    return c.json({ nonce });
  });
  app.post('/api/v1/auth/google', async (c) => {
    if (!authConfigured(c.env)) return c.json({ error: 'Google sign-in is not configured.' }, 503);
    const { credential } = z
      .object({ credential: z.string().min(20).max(12000) })
      .strict()
      .parse(await c.req.json());
    const challenge = readCookie(c.req.raw, cookieName('challenge', c.env));
    if (!challenge) return c.json({ error: 'Sign-in expired. Please try again.' }, 401);
    const challengeHash = await hashToken(challenge),
      at = seconds();
    const row = await c.env.DB.prepare(
      'SELECT nonce FROM auth_challenges WHERE token_hash=? AND expires_at>?',
    )
      .bind(challengeHash, at)
      .first<{ nonce: string }>();
    if (!row) return c.json({ error: 'Sign-in expired. Please try again.' }, 401);
    let identity;
    try {
      identity = await verifyGoogleCredential(credential, row.nonce, c.env);
    } catch {
      return c.json({ error: 'Google identity could not be verified.' }, 401);
    }
    if (!identity)
      return c.json({ error: 'This Google account is not allowed to access this workspace.' }, 403);
    const known = await c.env.DB.prepare(
      "SELECT user_id FROM auth_identities WHERE provider='google' AND subject=?",
    )
      .bind(identity.subject)
      .first<{ user_id: string }>();
    const existing = known
      ? null
      : await c.env.DB.prepare('SELECT id FROM users WHERE email=?')
          .bind(identity.email)
          .first<{ id: string }>();
    const userId = known?.user_id ?? existing?.id ?? `google:${identity.subject}`;
    const token = randomToken(),
      tokenHash = await hashToken(token);
    await c.env.DB.batch([
      c.env.DB.prepare(
        'INSERT INTO users VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email',
      ).bind(userId, identity.email, new Date().toISOString()),
      c.env.DB.prepare(
        "INSERT INTO auth_identities VALUES('google',?,?) ON CONFLICT DO NOTHING",
      ).bind(identity.subject, userId),
      c.env.DB.prepare(
        'INSERT INTO auth_sessions SELECT ?,?,?,? FROM auth_challenges WHERE token_hash=? AND expires_at>?',
      ).bind(tokenHash, userId, identity.email, at + sessionLifetime, challengeHash, at),
      c.env.DB.prepare('DELETE FROM auth_challenges WHERE token_hash=?').bind(challengeHash),
    ]);
    const created = await c.env.DB.prepare('SELECT 1 FROM auth_sessions WHERE token_hash=?')
      .bind(tokenHash)
      .first();
    if (!created) return c.json({ error: 'This sign-in was already used. Please try again.' }, 409);
    const previous = readCookie(c.req.raw, cookieName('session', c.env));
    if (previous)
      await c.env.DB.prepare('DELETE FROM auth_sessions WHERE token_hash=?')
        .bind(await hashToken(previous))
        .run();
    setCookie(c, cookieName('challenge', c.env), '', cookieOptions(c.env, 0));
    setCookie(c, cookieName('session', c.env), token, cookieOptions(c.env, sessionLifetime));
    return c.json({ ok: true });
  });
  app.post('/api/v1/auth/logout', async (c) => {
    const token = readCookie(c.req.raw, cookieName('session', c.env));
    if (token)
      await c.env.DB.prepare('DELETE FROM auth_sessions WHERE token_hash=?')
        .bind(await hashToken(token))
        .run();
    setCookie(c, cookieName('session', c.env), '', cookieOptions(c.env, 0));
    return c.json({ ok: true });
  });
}
