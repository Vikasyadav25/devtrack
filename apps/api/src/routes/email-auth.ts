import type { Context, Hono } from 'hono';
import { setCookie } from 'hono/cookie';
import { z } from 'zod';
import type { AppContext } from '../types';
import {
  cookieName,
  cookieOptions,
  hashToken,
  randomToken,
  readCookie,
  seconds,
  sessionLifetime,
} from '../session';
import {
  dummyPasswordHash,
  hashPassword,
  verifyPassword,
  verifyPrivatePassword,
} from '../password';
import { deliverAccountEmail, localMailPreview, mailConfigured } from '../mail';

const emailInput = z.string().trim().toLowerCase().email().max(254);
const passwordInput = z.string().min(12, 'Use at least 12 characters.').max(128);
const credentials = z.object({ email: emailInput, password: passwordInput }).strict();
const emailOnly = z.object({ email: emailInput }).strict();
const tokenInput = z.string().regex(/^[a-f0-9]{64}$/);
const sent = {
  ok: true,
  message: 'If this email is eligible, check your inbox and spam folder for the next step.',
};
async function emailBudget(
  db: D1Database,
  email: string,
  purpose: string,
  period: number,
  max: number,
) {
  const row = await db
    .prepare(
      'INSERT INTO auth_email_limits VALUES(?,?,?,1) ON CONFLICT(email_hash,purpose) DO UPDATE SET window=excluded.window,count=CASE WHEN auth_email_limits.window=excluded.window THEN auth_email_limits.count+1 ELSE 1 END RETURNING count',
    )
    .bind(await hashToken(email), purpose, Math.floor(seconds() / period))
    .first<{ count: number }>();
  return (row?.count ?? max + 1) <= max;
}
async function sendEmail(
  c: Context<AppContext>,
  email: string,
  purpose: 'verify' | 'reset',
  token: string,
) {
  if (localMailPreview(c.env, c.req.url)) {
    await deliverAccountEmail(c.env, c.req.url, email, purpose, token);
    return;
  }
  // Provider latency must not reveal whether a recovery address is registered.
  c.executionCtx.waitUntil(
    deliverAccountEmail(c.env, c.req.url, email, purpose, token).catch(() =>
      console.error('Account email delivery failed. Check the mail provider dashboard.'),
    ),
  );
}
export function registerEmailAuthRoutes(app: Hono<AppContext>) {
  app.use('/api/v1/auth/*', async (c, next) => {
    if (
      ![
        '/api/v1/auth/register',
        '/api/v1/auth/login',
        '/api/v1/auth/forgot-password',
        '/api/v1/auth/verify-email',
        '/api/v1/auth/reset-password',
        '/api/v1/auth/dev-mail',
      ].includes(c.req.path)
    )
      return next();
    if (c.env.AUTH_PROVIDER !== 'email')
      return c.json({ error: 'Email sign-in is not enabled.' }, 404);
    if (c.env.SINGLE_USER_NAME && c.req.path !== '/api/v1/auth/login')
      return c.json({ error: 'This workspace uses a private account.' }, 404);
    await next();
  });
  app.post('/api/v1/auth/register', async (c) => {
    const b = credentials.parse(await c.req.json());
    if (!mailConfigured(c.env, c.req.url))
      return c.json({ error: 'Email delivery is not configured yet.' }, 503);
    const passwordHash = await hashPassword(b.password);
    const canSend = await emailBudget(c.env.DB, b.email, 'verify', 3600, 5);
    const prior = await c.env.DB.prepare(
      'SELECT users.id,password_accounts.user_id AS password_user_id,password_accounts.email_verified_at FROM users LEFT JOIN password_accounts ON password_accounts.user_id=users.id WHERE users.email=?',
    )
      .bind(b.email)
      .first<{ id: string; password_user_id: string | null; email_verified_at: number | null }>();
    if (prior) {
      if (canSend && prior.password_user_id && prior.email_verified_at === null) {
        const token = randomToken();
        await c.env.DB.prepare(
          "INSERT INTO auth_email_tokens VALUES(?,?,'verify',?,NULL) ON CONFLICT(user_id,purpose) DO UPDATE SET token_hash=excluded.token_hash,expires_at=excluded.expires_at,used_at=NULL",
        )
          .bind(await hashToken(token), prior.id, seconds() + 86400)
          .run();
        await sendEmail(c, b.email, 'verify', token);
      }
      return c.json(sent);
    }
    if (!canSend) return c.json(sent);
    const userId = crypto.randomUUID(),
      at = seconds(),
      token = randomToken(),
      tokenHash = await hashToken(token);
    await c.env.DB.batch([
      c.env.DB.prepare('INSERT INTO users VALUES(?,?,?) ON CONFLICT(email) DO NOTHING').bind(
        userId,
        b.email,
        new Date().toISOString(),
      ),
      c.env.DB.prepare(
        'INSERT INTO password_accounts SELECT id,?,NULL,? FROM users WHERE id=?',
      ).bind(passwordHash, at, userId),
      c.env.DB.prepare(
        "INSERT INTO auth_email_tokens SELECT ?,id,'verify',?,NULL FROM users WHERE id=?",
      ).bind(tokenHash, at + 86400, userId),
    ]);
    const created = await c.env.DB.prepare('SELECT id FROM users WHERE id=?').bind(userId).first();
    if (created) await sendEmail(c, b.email, 'verify', token);
    return c.json(sent);
  });
  app.post('/api/v1/auth/login', async (c) => {
    const input = await c.req.json();
    const privateLogin = c.env.SINGLE_USER_NAME
      ? z
          .object({
            username: z.string().trim().min(1).max(254),
            password: z.string().min(1).max(128),
          })
          .strict()
          .parse(input)
      : null;
    const b = privateLogin
      ? { email: c.env.OWNER_EMAIL, password: privateLogin.password }
      : z
          .object({ email: emailInput, password: z.string().min(1).max(128) })
          .strict()
          .parse(input);
    const at = seconds(),
      emailHash = await hashToken(b.email);
    if (!(await emailBudget(c.env.DB, b.email, 'login', 900, 10)))
      return c.json({ error: 'Too many login attempts. Try again in 15 minutes.' }, 429);
    const account = await c.env.DB.prepare(
      'SELECT users.id,password_accounts.password_hash,password_accounts.email_verified_at FROM users JOIN password_accounts ON password_accounts.user_id=users.id WHERE users.email=?',
    )
      .bind(b.email)
      .first<{ id: string; password_hash: string; email_verified_at: number | null }>();
    const valid = privateLogin
      ? await verifyPrivatePassword(b.password, account?.password_hash)
      : await verifyPassword(b.password, account?.password_hash ?? dummyPasswordHash);
    if (!account || !valid || (privateLogin && privateLogin.username !== c.env.SINGLE_USER_NAME))
      return c.json(
        {
          error: c.env.SINGLE_USER_NAME
            ? 'Username or password is incorrect.'
            : 'Email or password is incorrect.',
        },
        401,
      );
    if (!account.email_verified_at)
      return c.json(
        {
          error:
            'Verify your email before signing in. Use Forgot password if you need a fresh email link.',
        },
        403,
      );
    const token = randomToken(),
      previous = readCookie(c.req.raw, cookieName('session', c.env));
    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM auth_sessions WHERE expires_at<=? OR token_hash=?').bind(
        at,
        previous ? await hashToken(previous) : '',
      ),
      c.env.DB.prepare('INSERT INTO auth_sessions VALUES(?,?,?,?)').bind(
        await hashToken(token),
        account.id,
        b.email,
        at + sessionLifetime,
      ),
      c.env.DB.prepare("DELETE FROM auth_email_limits WHERE email_hash=? AND purpose='login'").bind(
        emailHash,
      ),
    ]);
    setCookie(c, cookieName('session', c.env), token, cookieOptions(c.env, sessionLifetime));
    return c.json({ ok: true });
  });
  app.post('/api/v1/auth/forgot-password', async (c) => {
    const { email } = emailOnly.parse(await c.req.json());
    if (!mailConfigured(c.env, c.req.url))
      return c.json({ error: 'Email delivery is not configured yet.' }, 503);
    const at = seconds(),
      canSend = await emailBudget(c.env.DB, email, 'reset', 3600, 5);
    const account = await c.env.DB.prepare('SELECT id FROM users WHERE email=?')
      .bind(email)
      .first<{ id: string }>();
    if (account && canSend) {
      const token = randomToken();
      await c.env.DB.prepare(
        "INSERT INTO auth_email_tokens VALUES(?,?,'reset',?,NULL) ON CONFLICT(user_id,purpose) DO UPDATE SET token_hash=excluded.token_hash,expires_at=excluded.expires_at,used_at=NULL",
      )
        .bind(await hashToken(token), account.id, at + 1800)
        .run();
      await sendEmail(c, email, 'reset', token);
    }
    return c.json(sent);
  });
  app.post('/api/v1/auth/verify-email', async (c) => {
    const { token } = z
        .object({ token: tokenInput })
        .strict()
        .parse(await c.req.json()),
      tokenHash = await hashToken(token),
      at = seconds();
    const results = await c.env.DB.batch([
      c.env.DB.prepare(
        "UPDATE password_accounts SET email_verified_at=?,updated_at=? WHERE user_id=(SELECT user_id FROM auth_email_tokens WHERE token_hash=? AND purpose='verify' AND used_at IS NULL AND expires_at>?)",
      ).bind(at, at, tokenHash, at),
      c.env.DB.prepare(
        "UPDATE auth_email_tokens SET used_at=? WHERE token_hash=? AND purpose='verify' AND used_at IS NULL AND expires_at>?",
      ).bind(at, tokenHash, at),
    ]);
    return results[0].meta.changes
      ? c.json({ ok: true, message: 'Email verified. You can now sign in.' })
      : c.json(
          {
            error:
              'This verification link is invalid or expired. Use Forgot password to request another email.',
          },
          400,
        );
  });
  app.post('/api/v1/auth/reset-password', async (c) => {
    const { token, password } = z
      .object({ token: tokenInput, password: passwordInput })
      .strict()
      .parse(await c.req.json());
    const tokenHash = await hashToken(token),
      at = seconds();
    const row = await c.env.DB.prepare(
      "SELECT auth_email_tokens.user_id,users.email FROM auth_email_tokens JOIN users ON users.id=auth_email_tokens.user_id WHERE token_hash=? AND purpose='reset' AND used_at IS NULL AND expires_at>?",
    )
      .bind(tokenHash, at)
      .first<{ user_id: string; email: string }>();
    if (!row)
      return c.json({ error: 'This reset link is invalid or expired. Request a new one.' }, 400);
    const passwordHash = await hashPassword(password);
    const results = await c.env.DB.batch([
      c.env.DB.prepare(
        "INSERT INTO password_accounts SELECT user_id,?,?,? FROM auth_email_tokens WHERE token_hash=? AND purpose='reset' AND used_at IS NULL AND expires_at>? ON CONFLICT(user_id) DO UPDATE SET password_hash=excluded.password_hash,email_verified_at=excluded.email_verified_at,updated_at=excluded.updated_at",
      ).bind(passwordHash, at, at, tokenHash, at),
      c.env.DB.prepare(
        "DELETE FROM auth_sessions WHERE user_id=(SELECT user_id FROM auth_email_tokens WHERE token_hash=? AND purpose='reset' AND used_at IS NULL AND expires_at>?)",
      ).bind(tokenHash, at),
      c.env.DB.prepare(
        "UPDATE auth_email_tokens SET used_at=? WHERE user_id=(SELECT user_id FROM auth_email_tokens WHERE token_hash=? AND purpose='reset' AND used_at IS NULL AND expires_at>?)",
      ).bind(at, tokenHash, at),
      c.env.DB.prepare(
        "DELETE FROM auth_email_limits WHERE purpose='login' AND email_hash=? AND EXISTS(SELECT 1 FROM auth_email_tokens WHERE token_hash=? AND used_at=?)",
      ).bind(await hashToken(row.email), tokenHash, at),
    ]);
    if (!results[0].meta.changes)
      return c.json({ error: 'This reset link was already used. Request a new one.' }, 400);
    setCookie(c, cookieName('session', c.env), '', cookieOptions(c.env, 0));
    return c.json({ ok: true, message: 'Password updated. Sign in with your new password.' });
  });
  app.post('/api/v1/auth/dev-mail', async (c) => {
    if (!localMailPreview(c.env, c.req.url)) return c.json({ error: 'Not found' }, 404);
    const { email } = emailOnly.parse(await c.req.json());
    const messages = await c.env.DB.prepare(
      'SELECT purpose,link,expires_at FROM auth_dev_mail WHERE recipient=? AND expires_at>? ORDER BY expires_at DESC LIMIT 5',
    )
      .bind(email, seconds())
      .all();
    return c.json({ messages: messages.results });
  });
}
