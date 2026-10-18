import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { authenticate } from './auth';
import type { AppContext } from './types';
import { now } from './services/data';
import { registerCatalogRoutes } from './routes/catalog';
import { registerStudyRoutes } from './routes/study';
import { registerRevisionRoutes } from './routes/revision';
import { registerWorkspaceRoutes } from './routes/workspace';
import { registerReportRoutes } from './routes/reports';
import { registerAuthRoutes } from './routes/auth';
export const app = new Hono<AppContext>();
app.onError((err, c) => {
  if (err instanceof SyntaxError) return c.json({ error: 'Invalid JSON' }, 400);
  if (err instanceof z.ZodError)
    return c.json({ error: 'Invalid input', details: err.issues }, 400);
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: 'The request could not be completed.' }, 500);
});
app.notFound((c) => c.json({ error: 'Not found' }, 404));
app.use('*', async (c, next) => {
  const origin = c.req.header('Origin');
  if (origin && origin !== c.env.ALLOWED_ORIGIN)
    return c.json({ error: 'Origin not allowed' }, 403);
  if (origin) {
    c.header('Access-Control-Allow-Origin', origin);
    c.header('Access-Control-Allow-Credentials', 'true');
    c.header('Vary', 'Origin');
  }
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Cache-Control', 'no-store');
  c.header('Referrer-Policy', 'same-origin');
  if (c.req.method === 'OPTIONS') {
    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type');
    return c.body(null, 204);
  }
  if (
    !['GET', 'HEAD'].includes(c.req.method) &&
    c.req.header('Content-Type')?.split(';')[0] !== 'application/json'
  )
    return c.json({ error: 'Use application/json' }, 415);
  if (!['GET', 'HEAD'].includes(c.req.method)) {
    if (c.req.header('Sec-Fetch-Site') === 'cross-site' && !origin)
      return c.json({ error: 'Origin required' }, 403);
    const raw = await c.req.text();
    if (new TextEncoder().encode(raw).length > 1_000_000)
      return c.json({ error: 'Request too large' }, 413);
  }
  await next();
});
app.get('/api/v1/health', (c) => c.json({ ok: true }));
registerAuthRoutes(app);
app.use('/api/v1/*', async (c, next) => {
  const email = await authenticate(c.req.raw, c.env);
  if (!email) return c.json({ error: 'Sign in to continue.' }, 401);
  await c.env.DB.prepare(
    'INSERT INTO users(id,email,created_at) VALUES(?,?,?) ON CONFLICT(email) DO NOTHING',
  )
    .bind(email, email, now())
    .run();
  const user = await c.env.DB.prepare('SELECT id FROM users WHERE email=?')
    .bind(email)
    .first<{ id: string }>();
  if (!user) return c.json({ error: 'Account unavailable' }, 500);
  const id = user.id;
  c.set('user', id);
  c.set('email', email);
  if (!['GET', 'HEAD'].includes(c.req.method)) {
    const window = Math.floor(Date.now() / 60000);
    const limit = await c.env.DB.prepare(
      'INSERT INTO api_rate_limits(user_id,window,count) VALUES(?,?,1) ON CONFLICT(user_id) DO UPDATE SET window=excluded.window,count=CASE WHEN api_rate_limits.window=excluded.window THEN api_rate_limits.count+1 ELSE 1 END RETURNING count',
    )
      .bind(id, window)
      .first<{ count: number }>();
    if ((limit?.count ?? 61) > 60) {
      c.header('Retry-After', '60');
      return c.json({ error: 'Too many writes. Try again in a minute.' }, 429);
    }
  }
  await next();
});
registerCatalogRoutes(app);
registerStudyRoutes(app);
registerRevisionRoutes(app);
registerWorkspaceRoutes(app);
registerReportRoutes(app);
export default app;
