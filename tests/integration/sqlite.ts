import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { seedSQL } from '../../scripts/seed-d1';
export function testDatabase() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync('migrations/0001_initial.sql', 'utf8'));
  sqlite.exec(readFileSync('migrations/0002_request_limits.sql', 'utf8'));
  sqlite.exec(readFileSync('migrations/0003_google_auth.sql', 'utf8'));
  sqlite.exec(readFileSync('migrations/0004_email_accounts.sql', 'utf8'));
  sqlite.exec(seedSQL());
  const prepare = (sql: string, args: unknown[] = []) => ({
    bind: (...values: unknown[]) => prepare(sql, values),
    first: async () => sqlite.prepare(sql).get(...(args as [])) ?? null,
    all: async () => ({
      results: sqlite.prepare(sql).all(...(args as [])),
      success: true,
      meta: {},
    }),
    run: async () => {
      const result = sqlite.prepare(sql).run(...(args as []));
      return { success: true, meta: { changes: Number(result.changes) } };
    },
    _sql: sql,
    _args: args,
  });
  const db = {
    prepare,
    batch: async (ops: ReturnType<typeof prepare>[]) => {
      sqlite.exec('BEGIN');
      try {
        const result = [];
        for (const op of ops) {
          if (/^SELECT/i.test(op._sql))
            result.push({
              success: true,
              results: sqlite.prepare(op._sql).all(...(op._args as [])),
            });
          else {
            const value = sqlite.prepare(op._sql).run(...(op._args as []));
            result.push({ success: true, meta: { changes: Number(value.changes) } });
          }
        }
        sqlite.exec('COMMIT');
        return result;
      } catch (e) {
        sqlite.exec('ROLLBACK');
        throw e;
      }
    },
  };
  return { sqlite, db: db as unknown as D1Database };
}
