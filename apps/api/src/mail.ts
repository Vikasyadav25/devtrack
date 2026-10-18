import type { Env } from './auth';
import { randomToken, seconds } from './session';
export function localMailPreview(env: Env, url: string) {
  return (
    env.ENVIRONMENT === 'local' &&
    env.LOCAL_EMAIL_PREVIEW === 'true' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)
  );
}
export function mailConfigured(env: Env, url: string) {
  return localMailPreview(env, url) || !!(env.RESEND_API_KEY && env.MAIL_FROM);
}
export async function deliverAccountEmail(
  env: Env,
  requestUrl: string,
  email: string,
  purpose: 'verify' | 'reset',
  token: string,
) {
  const url = new URL(env.APP_URL || env.ALLOWED_ORIGIN);
  url.hash = `/${purpose === 'verify' ? 'verify-email' : 'reset-password'}?token=${token}`;
  const lifetime = purpose === 'verify' ? 86400 : 1800;
  if (localMailPreview(env, requestUrl)) {
    await env.DB.batch([
      env.DB.prepare(
        'DELETE FROM auth_dev_mail WHERE expires_at<=? OR recipient=? AND purpose=?',
      ).bind(seconds(), email, purpose),
      env.DB.prepare('INSERT INTO auth_dev_mail VALUES(?,?,?,?,?)').bind(
        randomToken(),
        email,
        purpose,
        url.toString(),
        seconds() + lifetime,
      ),
    ]);
    return;
  }
  if (!env.RESEND_API_KEY || !env.MAIL_FROM) throw new Error('Email delivery is not configured.');
  const subject =
    purpose === 'verify' ? 'Verify your DevTrack email' : 'Reset your DevTrack password';
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to: [email],
      subject,
      text: `${subject}\n\nOpen this link in your browser:\n${url.toString()}\n\nThis link expires in ${purpose === 'verify' ? '24 hours' : '30 minutes'} and works once. If you did not request this, ignore this email. Never share the link.`,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('Email could not be sent. Please try again later.');
}
