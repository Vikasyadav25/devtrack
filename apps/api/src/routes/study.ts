import type { Hono } from 'hono';
import type { AppContext } from '../types';
import { progressInput, attemptInput } from '../../../../packages/shared/src/schemas';
import { calendarDate } from '../../../../packages/shared/src/domain';
import {
  dbRows,
  requireItem,
  goals,
  now,
  uid,
  progressStatement,
  initialReview,
  studyStatement,
} from '../services/data';
export function registerStudyRoutes(app: Hono<AppContext>) {
  app.get('/api/v1/progress', async (c) =>
    c.json(await dbRows(c.env.DB, 'SELECT * FROM progress WHERE user_id=?', c.get('user'))),
  );
  app.put('/api/v1/progress/:type/:id', async (c) => {
    const body = progressInput.parse(await c.req.json());
    const { type, id } = c.req.param();
    await requireItem(c.env.DB, type, id);
    const g = await goals(c.env.DB, c.get('user'));
    const at = now();
    const ops = [
      progressStatement(
        c.env.DB,
        c.get('user'),
        type,
        id,
        body.status,
        body.confidence,
        body.minutes,
        at,
        null,
      ),
    ];
    if (body.status === 'completed')
      ops.push(
        initialReview(c.env.DB, c.get('user'), type, id, calendarDate(new Date(at), g.timezone)),
      );
    if (body.minutes)
      ops.push(studyStatement(c.env.DB, c.get('user'), type, id, type, body.minutes, at));
    await c.env.DB.batch(ops);
    return c.json({ ok: true });
  });
  app.post('/api/v1/problems/:id/attempts', async (c) => {
    const b = attemptInput.parse(await c.req.json());
    const id = c.req.param('id');
    await requireItem(c.env.DB, 'problem', id);
    const at = now();
    const g = await goals(c.env.DB, c.get('user'));
    await c.env.DB.batch([
      c.env.DB.prepare('INSERT INTO problem_attempts VALUES(?,?,?,?,?,?,?,?,?)').bind(
        uid(),
        c.get('user'),
        id,
        at,
        b.result,
        b.hintUsed ? 1 : 0,
        b.minutes,
        b.notes,
        b.codeUrl,
      ),
      progressStatement(
        c.env.DB,
        c.get('user'),
        'problem',
        id,
        b.result === 'solved' ? 'completed' : 'learning',
        b.confidence,
        b.minutes,
        at,
        b.result === 'solved' && !b.hintUsed ? at : null,
      ),
      initialReview(c.env.DB, c.get('user'), 'problem', id, calendarDate(new Date(at), g.timezone)),
      studyStatement(c.env.DB, c.get('user'), 'problem', id, 'dsa', b.minutes, at),
    ]);
    return c.json({ ok: true }, 201);
  });
  app.get('/api/v1/problems/:id/attempts', async (c) =>
    c.json(
      await dbRows(
        c.env.DB,
        'SELECT * FROM problem_attempts WHERE user_id=? AND problem_id=? ORDER BY attempted_at DESC LIMIT 100',
        c.get('user'),
        c.req.param('id'),
      ),
    ),
  );
}
