import type { Hono } from 'hono';
import { z } from 'zod';
import type { AppContext } from '../types';
import { catalog, goals, dbRows, fail } from '../services/data';
import { prerequisitesUnlocked } from '../../../../packages/shared/src/domain';
export function registerCatalogRoutes(app: Hono<AppContext>) {
  app.get('/api/v1/me', async (c) =>
    c.json({
      id: c.get('user'),
      email: c.get('email'),
      local: c.env.ENVIRONMENT === 'local',
      authProvider:
        c.env.LOCAL_AUTH === 'true' && c.env.ENVIRONMENT === 'local'
          ? 'local'
          : (c.env.AUTH_PROVIDER ?? 'access'),
      goals: await goals(c.env.DB, c.get('user')),
    }),
  );
  app.get('/api/v1/catalog', async (c) => c.json(await catalog(c.env.DB)));
  for (const name of ['patterns', 'problems', 'lessons', 'design-cases'] as const) {
    const key = name === 'design-cases' ? 'cases' : name;
    app.get(`/api/v1/${name}`, async (c) => {
      const data = (await catalog(c.env.DB))[key];
      const page = z.coerce
        .number()
        .int()
        .min(1)
        .max(100000)
        .parse(c.req.query('page') ?? 1);
      const limit = z.coerce
        .number()
        .int()
        .min(1)
        .max(100)
        .parse(c.req.query('limit') ?? 50);
      const search = z
        .string()
        .max(200)
        .parse(c.req.query('q') ?? '')
        .toLowerCase();
      const filtered = data.filter((x) => x.title.toLowerCase().includes(search));
      return c.json({
        items: filtered.slice((page - 1) * limit, page * limit),
        total: filtered.length,
        page,
        limit,
      });
    });
    app.get(`/api/v1/${name}/:slug`, async (c) => {
      const item = (await catalog(c.env.DB))[key].find((x) => x.slug === c.req.param('slug'));
      if (!item) fail(404, 'Item not found');
      return c.json(item);
    });
  }
  app.get('/api/v1/roadmap', async (c) => {
    const [cat, progress] = await Promise.all([
      catalog(c.env.DB),
      dbRows<{ item_id: string }>(
        c.env.DB,
        "SELECT item_id FROM progress WHERE user_id=? AND status IN ('completed','mastered')",
        c.get('user'),
      ),
    ]);
    const completed = new Set(progress.map((x) => x.item_id));
    return c.json(
      cat.patterns.map((x) => ({
        ...x,
        unlocked: prerequisitesUnlocked(x.prerequisiteSlugs, completed),
      })),
    );
  });
}
