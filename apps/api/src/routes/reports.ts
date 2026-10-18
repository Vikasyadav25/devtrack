import type { Hono } from 'hono';
import type { AppContext } from '../types';
import { z } from 'zod';
import { dashboard } from '../services/dashboard';
import { exportBackup, importBackup } from '../backup';
export function registerReportRoutes(app: Hono<AppContext>) {
  app.get('/api/v1/dashboard', async (c) => c.json(await dashboard(c.env.DB, c.get('user'))));
  app.get('/api/v1/analytics', async (c) => c.json(await dashboard(c.env.DB, c.get('user'))));
  app.get('/api/v1/planner', async (c) => c.json(await dashboard(c.env.DB, c.get('user'))));
  app.get('/api/v1/export', async (c) =>
    c.json(await exportBackup(c.env.DB, c.get('user'), c.get('email'))),
  );
  app.post('/api/v1/import', async (c) => {
    try {
      return c.json(
        await importBackup(c.env.DB, c.get('user'), c.get('email'), await c.req.json()),
      );
    } catch (err) {
      if (err instanceof z.ZodError) throw err;
      return c.json({ error: err instanceof Error ? err.message : 'Import failed' }, 400);
    }
  });
}
