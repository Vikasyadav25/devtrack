import type { Hono } from 'hono';
import type { AppContext } from '../types';
import { reviewInput } from '../../../../packages/shared/src/schemas';
import { calendarDate, isMastered, scheduleReview } from '../../../../packages/shared/src/domain';
import { goals, due, requireItem, fail, now } from '../services/data';
export function registerRevisionRoutes(app: Hono<AppContext>) {
  app.get('/api/v1/revision/due', async (c) => {
    const g = await goals(c.env.DB, c.get('user'));
    return c.json(await due(c.env.DB, c.get('user'), calendarDate(new Date(), g.timezone)));
  });
  app.post('/api/v1/revision/:type/:id/review', async (c) => {
    const b = reviewInput.parse(await c.req.json());
    const { type, id } = c.req.param();
    await requireItem(c.env.DB, type, id);
    const user = c.get('user');
    const existing = await c.env.DB.prepare(
      'SELECT item_type,item_id FROM review_events WHERE id=? AND user_id=?',
    )
      .bind(b.eventId, user)
      .first<{ item_type: string; item_id: string }>();
    if (existing) {
      if (existing.item_type !== type || existing.item_id !== id)
        fail(409, 'Event ID belongs to a different review');
      return c.json({ ok: true, replayed: true });
    }
    const state = await c.env.DB.prepare(
      'SELECT * FROM review_state WHERE user_id=? AND item_type=? AND item_id=?',
    )
      .bind(user, type, id)
      .first<{
        interval_days: number;
        successful_reviews: number;
        lapse_count: number;
        version: number;
        due_at: string;
      }>();
    if (!state) fail(404, 'Study this item before reviewing it');
    const g = await goals(c.env.DB, user);
    const today = calendarDate(new Date(), g.timezone);
    if (state!.due_at > today) fail(409, 'This item is not due yet');
    const next = scheduleReview(
      {
        intervalDays: state!.interval_days,
        successfulReviews: state!.successful_reviews,
        lapseCount: state!.lapse_count,
        version: state!.version,
        dueAt: state!.due_at,
      },
      b.rating,
      today,
    );
    const progress = await c.env.DB.prepare(
      'SELECT last_solved_without_hint_at FROM progress WHERE user_id=? AND item_type=? AND item_id=?',
    )
      .bind(user, type, id)
      .first<{ last_solved_without_hint_at: string | null }>();
    const status =
      (b.rating === 'Good' || b.rating === 'Easy') &&
      (type !== 'problem' ||
        isMastered(
          progress?.last_solved_without_hint_at ?? null,
          next.successfulReviews,
          today,
          g.timezone,
        ))
        ? 'mastered'
        : b.rating === 'Again'
          ? 'learning'
          : 'completed';
    // The event insert is conditional on the current version. Both subsequent updates
    // require that event, so a concurrent stale request cannot overwrite scheduling.
    const at = now();
    await c.env.DB.batch([
      c.env.DB.prepare(
        'INSERT INTO review_events SELECT ?,?,?,?,?,?,?,?,? FROM review_state WHERE user_id=? AND item_type=? AND item_id=? AND version=?',
      ).bind(
        b.eventId,
        user,
        type,
        id,
        at,
        b.rating,
        state!.interval_days,
        next.intervalDays,
        next.dueAt,
        user,
        type,
        id,
        state!.version,
      ),
      c.env.DB.prepare(
        'UPDATE review_state SET due_at=?,interval_days=?,successful_reviews=?,lapse_count=?,version=version+1 WHERE user_id=? AND item_type=? AND item_id=? AND version=? AND EXISTS(SELECT 1 FROM review_events WHERE id=?)',
      ).bind(
        next.dueAt,
        next.intervalDays,
        next.successfulReviews,
        next.lapseCount,
        user,
        type,
        id,
        state!.version,
        b.eventId,
      ),
      c.env.DB.prepare(
        'UPDATE progress SET status=?,updated_at=? WHERE user_id=? AND item_type=? AND item_id=? AND EXISTS(SELECT 1 FROM review_events WHERE id=? AND rating=? AND user_id=? AND item_type=? AND item_id=?)',
      ).bind(status, at, user, type, id, b.eventId, b.rating, user, type, id),
    ]);
    const inserted = await c.env.DB.prepare(
      'SELECT rating,next_review_at FROM review_events WHERE id=? AND user_id=? AND item_type=? AND item_id=?',
    )
      .bind(b.eventId, user, type, id)
      .first<{ rating: string; next_review_at: string }>();
    if (!inserted) fail(409, 'Review changed in another tab. Refresh and try again');
    if (inserted!.rating !== b.rating)
      fail(409, 'Event ID was already used with a different rating');
    return c.json({ ok: true, nextReviewAt: inserted!.next_review_at });
  });
}
