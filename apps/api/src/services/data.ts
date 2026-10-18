import { HTTPException } from 'hono/http-exception';
import { identity, type Goals, type DueItem } from '../../../../packages/shared/src/schemas';
import { addDays } from '../../../../packages/shared/src/domain';
import type { Pattern, Problem, Lesson, DesignCase } from '../../../../packages/shared/src/content';
const defaultGoals: Goals = {
  dailyMinutes: 60,
  targetTrack: 'SDE-2',
  timezone: 'Asia/Kolkata',
  restDays: [0],
};
export const now = () => new Date().toISOString();
export const uid = () => crypto.randomUUID();
export const fail = (status: 400 | 401 | 403 | 404 | 409, message: string): never => {
  throw new HTTPException(status, { message });
};
export const dbRows = async <T>(db: D1Database, sql: string, ...args: (string | number | null)[]) =>
  (
    await db
      .prepare(sql)
      .bind(...args)
      .all<T>()
  ).results;
export async function goals(db: D1Database, user: string): Promise<Goals> {
  const row = await db.prepare('SELECT * FROM goals WHERE user_id=?').bind(user).first<{
    daily_minutes: number;
    target_track: 'SDE-2' | 'SDE-3';
    timezone: string;
    weekly_rest_days_json: string;
  }>();
  return row
    ? {
        dailyMinutes: row.daily_minutes,
        targetTrack: row.target_track,
        timezone: row.timezone,
        restDays: JSON.parse(row.weekly_rest_days_json),
      }
    : defaultGoals;
}
export async function catalog(db: D1Database) {
  const [p, q, l, d] = await Promise.all([
    dbRows<{ metadata_json: string }>(
      db,
      "SELECT metadata_json FROM curriculum_nodes WHERE domain='dsa' ORDER BY sort_order",
    ),
    dbRows<{ content_json: string }>(
      db,
      'SELECT content_json FROM problems ORDER BY CAST(external_id AS INTEGER)',
    ),
    dbRows<{ metadata_json: string }>(db, 'SELECT metadata_json FROM lessons'),
    dbRows<{ content_json: string }>(db, 'SELECT content_json FROM design_cases'),
  ]);
  return {
    patterns: p.map((x) => JSON.parse(x.metadata_json) as Pattern),
    problems: q.map((x) => JSON.parse(x.content_json) as Problem),
    lessons: l.map((x) => JSON.parse(x.metadata_json) as Lesson),
    cases: d.map((x) => JSON.parse(x.content_json) as DesignCase),
  };
}
export async function requireItem(db: D1Database, type: string, id: string) {
  identity.parse({ itemType: type, itemId: id });
  const tables = {
    problem: 'problems',
    pattern: 'curriculum_nodes',
    lesson: 'lessons',
    case: 'design_cases',
  } as const;
  const row = await db
    .prepare(`SELECT id,status FROM ${tables[type as keyof typeof tables]} WHERE id=?`)
    .bind(id)
    .first<{ id: string; status: string }>();
  if (!row || row.status !== 'published') fail(404, 'Published curriculum item not found');
}
export async function due(db: D1Database, user: string, today: string): Promise<DueItem[]> {
  const [rows, cat] = await Promise.all([
    dbRows<Omit<DueItem, 'title' | 'domain' | 'estimatedMinutes'>>(
      db,
      'SELECT * FROM review_state WHERE user_id=? AND due_at<=? ORDER BY due_at',
      user,
      today,
    ),
    catalog(db),
  ]);
  return rows.map((r) => {
    const item =
      r.item_type === 'problem'
        ? cat.problems.find((x) => x.id === r.item_id)
        : r.item_type === 'pattern'
          ? cat.patterns.find((x) => x.id === r.item_id)
          : r.item_type === 'lesson'
            ? cat.lessons.find((x) => x.slug === r.item_id)
            : cat.cases.find((x) => x.slug === r.item_id);
    return {
      ...r,
      title: item?.title ?? r.item_id,
      domain:
        r.item_type === 'problem' || r.item_type === 'pattern'
          ? 'dsa'
          : r.item_type === 'case'
            ? ((item as DesignCase)?.kind?.toLowerCase() ?? 'hld')
            : ((item as Lesson)?.domain ?? 'java'),
      estimatedMinutes: 15,
    };
  });
}
export function progressStatement(
  db: D1Database,
  user: string,
  type: string,
  id: string,
  status: string,
  confidence: number,
  minutes: number,
  at: string,
  solved: string | null,
) {
  return db
    .prepare(
      `INSERT INTO progress(user_id,item_type,item_id,status,confidence,first_studied_at,last_studied_at,last_solved_without_hint_at,time_spent_minutes,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,item_type,item_id) DO UPDATE SET status=excluded.status,confidence=excluded.confidence,last_studied_at=excluded.last_studied_at,last_solved_without_hint_at=COALESCE(excluded.last_solved_without_hint_at,progress.last_solved_without_hint_at),time_spent_minutes=progress.time_spent_minutes+excluded.time_spent_minutes,updated_at=excluded.updated_at`,
    )
    .bind(user, type, id, status, confidence, at, at, solved, minutes, at);
}
export function initialReview(db: D1Database, user: string, type: string, id: string, day: string) {
  return db
    .prepare(
      'INSERT INTO review_state(user_id,item_type,item_id,due_at,interval_days) VALUES(?,?,?,?,1) ON CONFLICT(user_id,item_type,item_id) DO NOTHING',
    )
    .bind(user, type, id, addDays(day, 1));
}
export function studyStatement(
  db: D1Database,
  user: string,
  type: string,
  id: string,
  domain: string,
  minutes: number,
  at: string,
) {
  return db
    .prepare('INSERT INTO study_sessions VALUES(?,?,?,?,?,?,?,?)')
    .bind(
      uid(),
      user,
      new Date(new Date(at).getTime() - minutes * 60000).toISOString(),
      at,
      domain,
      type,
      id,
      minutes,
    );
}
