import { z } from 'zod';
import { itemType } from '../../../packages/shared/src/schemas';
import { catalog } from './services/data';
const id = z.string().min(1).max(150),
  stamp = z.string().datetime(),
  day = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(
      (v) =>
        !Number.isNaN(Date.parse(v)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v,
    ),
  count = z.number().int().min(0).max(10000000);
const item = { item_type: itemType, item_id: id };
export const backupTables = {
  progress: z
    .object({
      ...item,
      status: z.enum(['learning', 'completed', 'mastered']),
      confidence: z.number().int().min(1).max(5),
      first_studied_at: stamp,
      last_studied_at: stamp,
      last_solved_without_hint_at: stamp.nullable(),
      time_spent_minutes: count,
      updated_at: stamp,
    })
    .strict(),
  problem_attempts: z
    .object({
      id,
      problem_id: id,
      attempted_at: stamp,
      result: z.enum(['solved', 'partial', 'failed']),
      hint_used: z.union([z.literal(0), z.literal(1)]),
      minutes: count,
      notes_md: z.string().max(20000),
      code_url: z.string().max(2000),
    })
    .strict(),
  review_events: z
    .object({
      id,
      ...item,
      reviewed_at: stamp,
      rating: z.enum(['Again', 'Hard', 'Good', 'Easy']),
      prior_interval_days: count,
      next_interval_days: count,
      next_review_at: day,
    })
    .strict(),
  review_state: z
    .object({
      ...item,
      due_at: day,
      interval_days: count,
      successful_reviews: count,
      lapse_count: count,
      version: count,
    })
    .strict(),
  notes: z
    .object({
      id,
      ...item,
      title: z.string().min(1).max(200),
      body_md: z.string().max(30000),
      tags_json: z
        .string()
        .max(1000)
        .refine((v) => {
          try {
            return z.array(z.string().max(40)).max(10).safeParse(JSON.parse(v)).success;
          } catch {
            return false;
          }
        }),
      created_at: stamp,
      updated_at: stamp,
    })
    .strict(),
  study_sessions: z
    .object({
      id,
      ...item,
      started_at: stamp,
      ended_at: stamp,
      domain: z.string().max(50),
      minutes: count,
    })
    .strict(),
  goals: z
    .object({
      id,
      daily_minutes: z.number().int().min(15).max(600),
      target_track: z.enum(['SDE-2', 'SDE-3']),
      weekly_rest_days_json: z.string().refine((v) => {
        try {
          return z.array(z.number().int().min(0).max(6)).max(7).safeParse(JSON.parse(v)).success;
        } catch {
          return false;
        }
      }),
      timezone: z.string().refine((v) => {
        try {
          new Intl.DateTimeFormat('en', { timeZone: v });
          return true;
        } catch {
          return false;
        }
      }),
      created_at: stamp,
    })
    .strict(),
  mock_sessions: z
    .object({
      id,
      type: z.enum(['DSA', 'LLD', 'HLD', 'Behavioral']),
      started_at: stamp,
      duration_minutes: count,
      score_json: z
        .string()
        .max(1000)
        .refine((v) => {
          try {
            return z
              .object({
                clarity: z.number().min(1).max(5),
                correctness: z.number().min(1).max(5),
                tradeoffs: z.number().min(1).max(5),
              })
              .strict()
              .safeParse(JSON.parse(v)).success;
          } catch {
            return false;
          }
        }),
      feedback_md: z.string().max(20000),
    })
    .strict(),
  bookmarks: z.object({ ...item, created_at: stamp }).strict(),
};
const arrays = Object.fromEntries(
  Object.entries(backupTables).map(([key, schema]) => [key, z.array(schema).max(1000)]),
);
export const backupInput = z
  .object({
    schemaVersion: z.literal(1),
    owner: z.string().email(),
    exportedAt: stamp,
    data: z.object(arrays).strict(),
  })
  .strict()
  .refine(
    (v) => Object.values(v.data).reduce((s, a) => s + a.length, 0) <= 2000,
    'Maximum 2000 records per import',
  );
export async function exportBackup(db: D1Database, user: string, email: string) {
  const names = Object.keys(backupTables);
  const rows = await db.batch<Record<string, unknown>>(
    names.map((t) => db.prepare(`SELECT * FROM ${t} WHERE user_id=?`).bind(user)),
  );
  return {
    schemaVersion: 1,
    owner: email,
    exportedAt: new Date().toISOString(),
    data: Object.fromEntries(
      names.map((name, i) => [
        name,
        rows[i].results.map((row) => {
          const { user_id: ownership, ...rest } = row;
          void ownership;
          return rest;
        }),
      ]),
    ),
  };
}
export async function importBackup(db: D1Database, user: string, email: string, raw: unknown) {
  const input = backupInput.parse(raw);
  if (input.owner.toLowerCase() !== email.toLowerCase())
    throw new Error('Backup owner does not match the signed-in account');
  const content = await catalog(db);
  const available: Record<string, Set<string>> = {
    pattern: new Set(content.patterns.filter((x) => x.status === 'published').map((x) => x.id)),
    problem: new Set(content.problems.filter((x) => x.status === 'published').map((x) => x.id)),
    lesson: new Set(content.lessons.filter((x) => x.status === 'published').map((x) => x.slug)),
    case: new Set(content.cases.filter((x) => x.status === 'published').map((x) => x.slug)),
  };
  const statements: D1PreparedStatement[] = [];
  let records = 0;
  for (const [table, rows] of Object.entries(input.data)) {
    for (const row of rows) {
      if (
        'item_type' in row &&
        'item_id' in row &&
        !available[String(row.item_type)]?.has(String(row.item_id))
      )
        throw new Error('Backup references unavailable curriculum');
      if ('problem_id' in row && !available.problem.has(String(row.problem_id)))
        throw new Error('Backup references an unavailable problem');
    }
    if (rows.length) {
      const fields = Object.keys(rows[0]);
      // One bound JSON array per allowlisted table avoids a query per imported row.
      statements.push(
        db
          .prepare(
            `INSERT INTO ${table}(user_id,${fields.join(',')}) SELECT ?,${fields.map((field) => `json_extract(value,'$.${field}')`).join(',')} FROM json_each(?) WHERE true ON CONFLICT DO NOTHING`,
          )
          .bind(user, JSON.stringify(rows)),
      );
      records += rows.length;
    }
  }
  if (statements.length) await db.batch(statements);
  return { ok: true, records, mode: 'merge; existing records preserved' };
}
