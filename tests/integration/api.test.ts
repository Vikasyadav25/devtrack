import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { app } from '../../apps/api/src/index';
import type { Env } from '../../apps/api/src/auth';
import { testDatabase } from './sqlite';
import { seedSQL } from '../../scripts/seed-d1';
let fixture: ReturnType<typeof testDatabase>, env: Env;
beforeEach(() => {
  fixture = testDatabase();
  env = {
    DB: fixture.db,
    ENVIRONMENT: 'local',
    LOCAL_AUTH: 'true',
    ALLOWED_ORIGIN: 'http://127.0.0.1:5173',
    OWNER_EMAIL: 'local@devtrack.test',
  };
});
afterEach(() => fixture.sqlite.close());
const request = (
  path: string,
  body?: unknown,
  method?: string,
  headers: Record<string, string> = {},
) =>
  app.request(
    `http://127.0.0.1/api/v1${path}`,
    {
      method: method ?? (body ? 'POST' : 'GET'),
      headers: body ? { 'Content-Type': 'application/json', ...headers } : headers,
      body: body ? JSON.stringify(body) : undefined,
    },
    env,
  );
describe('authenticated D1 flows', () => {
  it('imports a large validated note batch without duplicate records', async () => {
    const backup = (await (await request('/export')).json()) as { data: Record<string, unknown[]> };
    const at = new Date().toISOString();
    backup.data.notes = Array.from({ length: 1000 }, (_, i) => ({
      id: `bulk-${i}`,
      item_type: 'pattern',
      item_id: 'arrays-hashing',
      title: `Note ${i}`,
      body_md: 'Processed prefix invariant',
      tags_json: '["arrays"]',
      created_at: at,
      updated_at: at,
    }));
    expect((await request('/import', backup)).status).toBe(200);
    expect((await request('/import', backup)).status).toBe(200);
    expect(fixture.sqlite.prepare('SELECT COUNT(*) AS n FROM notes').get()).toMatchObject({
      n: 1000,
    });
  });
  it('rejects excessive writes with a persisted per-owner limit', async () => {
    await request('/me');
    fixture.sqlite
      .prepare('INSERT INTO api_rate_limits VALUES(?,?,?)')
      .run('local@devtrack.test', Math.floor(Date.now() / 60000), 60);
    const r = await request('/notes', {
      itemType: 'pattern',
      itemId: 'arrays-hashing',
      title: 'Limited',
      body: 'Test',
    });
    expect(r.status).toBe(429);
    expect(r.headers.get('Retry-After')).toBe('60');
    expect(fixture.sqlite.prepare('SELECT COUNT(*) AS n FROM notes').get()).toMatchObject({ n: 0 });
  });
  it('commits only one of two concurrent ratings for the same review version', async () => {
    await request('/problems/lc-1/attempts', { result: 'solved', hintUsed: false, minutes: 20 });
    fixture.sqlite.exec("UPDATE review_state SET due_at='2020-01-01'");
    const responses = await Promise.all([
      request('/revision/problem/lc-1/review', { rating: 'Good', eventId: crypto.randomUUID() }),
      request('/revision/problem/lc-1/review', { rating: 'Again', eventId: crypto.randomUUID() }),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(fixture.sqlite.prepare('SELECT COUNT(*) AS n FROM review_events').get()).toMatchObject({
      n: 1,
    });
    expect(fixture.sqlite.prepare('SELECT version FROM review_state').get()).toMatchObject({
      version: 1,
    });
  });
  it('fails closed in production and rejects hostile origins', async () => {
    env.ENVIRONMENT = 'production';
    expect((await request('/progress')).status).toBe(401);
    expect((await request('/health')).status).toBe(200);
    env.ENVIRONMENT = 'local';
    expect((await request('/notes', {}, 'POST', { Origin: 'https://evil.test' })).status).toBe(403);
    expect((await app.request('https://public.test/api/v1/me', {}, env)).status).toBe(401);
  });
  it('seeds idempotently and provides paginated canonical records', async () => {
    fixture.sqlite.exec(seedSQL());
    const r = await request('/problems?page=2&limit=7');
    const data = (await r.json()) as { items: unknown[]; total: number };
    expect(data.items).toHaveLength(7);
    expect(data.total).toBe(110);
  });
  it('records an attempt and preserves it across requests', async () => {
    const r = await request('/problems/lc-1/attempts', {
      result: 'solved',
      hintUsed: false,
      minutes: 25,
      confidence: 4,
      notes: 'Complement lookup',
      codeUrl: '',
    });
    expect(r.status).toBe(201);
    expect(await (await request('/problems/lc-1/attempts')).json()).toHaveLength(1);
    const p = (await (await request('/progress')).json()) as {
      status: string;
      last_solved_without_hint_at: string;
    }[];
    expect(p[0].status).toBe('completed');
    expect(p[0].last_solved_without_hint_at).toBeTruthy();
    expect(fixture.sqlite.prepare('SELECT COUNT(*) AS n FROM study_sessions').get()).toMatchObject({
      n: 1,
    });
    expect(fixture.sqlite.prepare('SELECT interval_days FROM review_state').get()).toMatchObject({
      interval_days: 1,
    });
  });
  it('rejects invalid attempts and nonexistent content', async () => {
    expect(
      (await request('/problems/lc-1/attempts', { result: 'solved', hintUsed: false, minutes: -1 }))
        .status,
    ).toBe(400);
    expect((await request('/progress/lesson/missing', { status: 'completed' }, 'PUT')).status).toBe(
      404,
    );
  });
  it('stores reviews once, prevents early ratings and masters only separate-day independent solves', async () => {
    await request('/problems/lc-1/attempts', { result: 'solved', hintUsed: false, minutes: 20 });
    const id = crypto.randomUUID();
    expect(
      (await request('/revision/problem/lc-1/review', { rating: 'Good', eventId: id })).status,
    ).toBe(409);
    fixture.sqlite.exec(
      "UPDATE review_state SET due_at='2020-01-01'; UPDATE progress SET last_solved_without_hint_at='2020-01-01T00:00:00.000Z'",
    );
    expect(
      (await request('/revision/problem/lc-1/review', { rating: 'Good', eventId: id })).status,
    ).toBe(200);
    expect(
      (await request('/revision/problem/lc-1/review', { rating: 'Good', eventId: id })).status,
    ).toBe(200);
    expect(fixture.sqlite.prepare('SELECT COUNT(*) AS n FROM review_events').get()).toMatchObject({
      n: 1,
    });
    expect(
      fixture.sqlite.prepare('SELECT interval_days,version FROM review_state').get(),
    ).toMatchObject({ interval_days: 3, version: 1 });
    expect(fixture.sqlite.prepare('SELECT status FROM progress').get()).toMatchObject({
      status: 'mastered',
    });
  });
  it('does not master a problem solved with help', async () => {
    await request('/problems/lc-1/attempts', { result: 'solved', hintUsed: true, minutes: 20 });
    fixture.sqlite.exec("UPDATE review_state SET due_at='2020-01-01'");
    await request('/revision/problem/lc-1/review', {
      rating: 'Good',
      eventId: crypto.randomUUID(),
    });
    expect(fixture.sqlite.prepare('SELECT status FROM progress').get()).toMatchObject({
      status: 'completed',
    });
  });
  it('enforces notes ownership, validates backups and restores missing records', async () => {
    const note = {
      itemType: 'pattern',
      itemId: 'arrays-hashing',
      title: 'My invariant',
      body: 'Processed prefix',
      tags: ['arrays'],
    };
    const r = await request('/notes', note);
    expect(r.status).toBe(201);
    const { id } = (await r.json()) as { id: string };
    fixture.sqlite.exec(
      "INSERT INTO users VALUES('other','other@example.test','2026-01-01T00:00:00.000Z')",
    );
    fixture.sqlite.prepare('UPDATE notes SET user_id=? WHERE id=?').run('other', id);
    expect((await request(`/notes/${id}`, note, 'PATCH')).status).toBe(404);
    expect((await request(`/notes/${id}`, {}, 'DELETE')).status).toBe(404);
    await request('/notes', { ...note, title: 'Mine' });
    const backup = (await (await request('/export')).json()) as {
      owner: string;
      data: Record<string, unknown[]>;
    };
    expect(backup.data.notes).toHaveLength(1);
    expect((await request('/import', { ...backup, owner: 'other@example.test' })).status).toBe(400);
    expect(
      (await request('/import', { ...backup, data: { ...backup.data, arbitrary_table: [] } }))
        .status,
    ).toBe(400);
    fixture.sqlite.exec("DELETE FROM notes WHERE user_id='local@devtrack.test'");
    expect((await request('/import', backup)).status).toBe(200);
    expect(await (await request('/notes')).json()).toHaveLength(1);
  });
  it('persists goals and excludes rest days from the plan', async () => {
    expect(
      (
        await request(
          '/goals',
          {
            dailyMinutes: 30,
            targetTrack: 'SDE-3',
            timezone: 'Asia/Kolkata',
            restDays: [0, 1, 2, 3, 4, 5, 6],
          },
          'PUT',
        )
      ).status,
    ).toBe(200);
    const d = (await (await request('/dashboard')).json()) as {
      budget: number;
      plan: { minutes: number };
      goals: { targetTrack: string };
    };
    expect(d.budget).toBe(0);
    expect(d.plan.minutes).toBe(0);
    expect(d.goals.targetTrack).toBe('SDE-3');
  });
});
