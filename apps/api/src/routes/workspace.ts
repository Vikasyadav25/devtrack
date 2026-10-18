import type { Hono } from 'hono';
import type { AppContext } from '../types';
import {
  identity,
  noteInput,
  goalsInput,
  sessionInput,
  mockInput,
} from '../../../../packages/shared/src/schemas';
import { dbRows, requireItem, now, uid, fail, goals, studyStatement } from '../services/data';
export function registerWorkspaceRoutes(app: Hono<AppContext>) {
  app.get('/api/v1/notes', async (c) =>
    c.json(
      await dbRows(
        c.env.DB,
        'SELECT * FROM notes WHERE user_id=? ORDER BY updated_at DESC',
        c.get('user'),
      ),
    ),
  );
  app.get('/api/v1/bookmarks', async (c) =>
    c.json(
      await dbRows(
        c.env.DB,
        'SELECT * FROM bookmarks WHERE user_id=? ORDER BY created_at DESC',
        c.get('user'),
      ),
    ),
  );
  app.put('/api/v1/bookmarks/:type/:id', async (c) => {
    const { type, id } = c.req.param();
    await requireItem(c.env.DB, type, id);
    await c.env.DB.prepare('INSERT INTO bookmarks VALUES(?,?,?,?) ON CONFLICT DO NOTHING')
      .bind(c.get('user'), type, id, now())
      .run();
    return c.json({ ok: true });
  });
  app.delete('/api/v1/bookmarks/:type/:id', async (c) => {
    const { type, id } = c.req.param();
    identity.parse({ itemType: type, itemId: id });
    await c.env.DB.prepare('DELETE FROM bookmarks WHERE user_id=? AND item_type=? AND item_id=?')
      .bind(c.get('user'), type, id)
      .run();
    return c.json({ ok: true });
  });
  app.post('/api/v1/notes', async (c) => {
    const b = noteInput.parse(await c.req.json());
    await requireItem(c.env.DB, b.itemType, b.itemId);
    const id = uid(),
      at = now();
    await c.env.DB.prepare('INSERT INTO notes VALUES(?,?,?,?,?,?,?,?,?)')
      .bind(
        id,
        c.get('user'),
        b.itemType,
        b.itemId,
        b.title,
        b.body,
        JSON.stringify(b.tags),
        at,
        at,
      )
      .run();
    return c.json({ id }, 201);
  });
  app.patch('/api/v1/notes/:id', async (c) => {
    const b = noteInput.parse(await c.req.json());
    await requireItem(c.env.DB, b.itemType, b.itemId);
    const result = await c.env.DB.prepare(
      'UPDATE notes SET item_type=?,item_id=?,title=?,body_md=?,tags_json=?,updated_at=? WHERE id=? AND user_id=?',
    )
      .bind(
        b.itemType,
        b.itemId,
        b.title,
        b.body,
        JSON.stringify(b.tags),
        now(),
        c.req.param('id'),
        c.get('user'),
      )
      .run();
    if (!result.meta.changes) fail(404, 'Note not found');
    return c.json({ ok: true });
  });
  app.delete('/api/v1/notes/:id', async (c) => {
    const result = await c.env.DB.prepare('DELETE FROM notes WHERE id=? AND user_id=?')
      .bind(c.req.param('id'), c.get('user'))
      .run();
    if (!result.meta.changes) fail(404, 'Note not found');
    return c.json({ ok: true });
  });
  app.put('/api/v1/goals', async (c) => {
    const b = goalsInput.parse(await c.req.json());
    const old = await goals(c.env.DB, c.get('user'));
    const hasReviews = await c.env.DB.prepare('SELECT 1 FROM review_state WHERE user_id=? LIMIT 1')
      .bind(c.get('user'))
      .first();
    if (old.timezone !== b.timezone && hasReviews)
      fail(
        409,
        'Timezone changes require exporting and resetting the review calendar. Keep the current timezone for existing reviews.',
      );
    await c.env.DB.prepare(
      'INSERT INTO goals VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET daily_minutes=excluded.daily_minutes,target_track=excluded.target_track,weekly_rest_days_json=excluded.weekly_rest_days_json,timezone=excluded.timezone',
    )
      .bind(
        uid(),
        c.get('user'),
        b.dailyMinutes,
        b.targetTrack,
        JSON.stringify(b.restDays),
        b.timezone,
        now(),
      )
      .run();
    return c.json({ ok: true });
  });
  app.post('/api/v1/study-sessions', async (c) => {
    const b = sessionInput.parse(await c.req.json());
    await requireItem(c.env.DB, b.itemType, b.itemId);
    await studyStatement(
      c.env.DB,
      c.get('user'),
      b.itemType,
      b.itemId,
      b.domain,
      b.minutes,
      now(),
    ).run();
    return c.json({ ok: true }, 201);
  });
  app.get('/api/v1/mocks', async (c) =>
    c.json(
      await dbRows(
        c.env.DB,
        'SELECT * FROM mock_sessions WHERE user_id=? ORDER BY started_at DESC',
        c.get('user'),
      ),
    ),
  );
  app.post('/api/v1/mocks', async (c) => {
    const b = mockInput.parse(await c.req.json());
    await c.env.DB.prepare('INSERT INTO mock_sessions VALUES(?,?,?,?,?,?,?)')
      .bind(
        uid(),
        c.get('user'),
        b.type,
        now(),
        b.durationMinutes,
        JSON.stringify(b.scores),
        b.feedback,
      )
      .run();
    return c.json({ ok: true }, 201);
  });
}
