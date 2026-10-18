import { goals, due, dbRows, catalog } from './data';
import {
  calendarDate,
  addDays,
  planWithinBudget,
  prerequisitesUnlocked,
} from '../../../../packages/shared/src/domain';
export async function dashboard(db: D1Database, user: string) {
  const g = await goals(db, user);
  const today = calendarDate(new Date(), g.timezone);
  const [reviews, progress, sessions, attempts, cat] = await Promise.all([
    due(db, user, today),
    dbRows<{ item_type: string; item_id: string; status: string; confidence: number }>(
      db,
      'SELECT * FROM progress WHERE user_id=?',
      user,
    ),
    dbRows<{ started_at: string; minutes: number; domain: string }>(
      db,
      'SELECT * FROM study_sessions WHERE user_id=? ORDER BY started_at DESC',
      user,
    ),
    dbRows<{ problem_id: string; result: string; hint_used: number }>(
      db,
      'SELECT problem_id,result,hint_used FROM problem_attempts WHERE user_id=?',
      user,
    ),
    catalog(db),
  ]);
  const studied = new Set(
    progress.filter((x) => ['completed', 'mastered'].includes(x.status)).map((x) => x.item_id),
  );
  const newItems = [
    ...cat.cases
      .filter(
        (x) =>
          x.status === 'published' &&
          !progress.some((p) => p.item_type === 'case' && p.item_id === x.slug),
      )
      .map((x) => ({
        item_type: 'case',
        item_id: x.slug,
        title: x.title,
        domain: x.kind.toLowerCase(),
        estimatedMinutes: 45,
      })),
    ...cat.patterns
      .filter(
        (x) =>
          x.status === 'published' &&
          !progress.some((p) => p.item_id === x.id) &&
          prerequisitesUnlocked(x.prerequisiteSlugs, studied),
      )
      .map((x) => ({
        item_type: 'pattern',
        item_id: x.id,
        title: x.title,
        domain: 'dsa',
        estimatedMinutes: x.estimatedMinutes,
      })),
    ...cat.lessons
      .filter(
        (x) =>
          x.status === 'published' &&
          !progress.some((p) => p.item_id === x.slug) &&
          prerequisitesUnlocked(x.prerequisites, studied),
      )
      .map((x) => ({
        item_type: 'lesson',
        item_id: x.slug,
        title: x.title,
        domain: x.domain,
        estimatedMinutes: x.readingMinutes,
      })),
  ];
  // Emphasize implementation foundations for SDE-2, design ambiguity for SDE-3.
  newItems.sort(
    (a, b) =>
      (a.item_type === 'case' ? (g.targetTrack === 'SDE-3' ? -1 : 1) : 0) -
      (b.item_type === 'case' ? (g.targetTrack === 'SDE-3' ? -1 : 1) : 0),
  );
  const dayOfWeek = new Date(`${today}T12:00:00Z`).getUTCDay();
  const budget = g.restDays.includes(dayOfWeek) ? 0 : g.dailyMinutes;
  const spent = sessions
    .filter((x) => calendarDate(new Date(x.started_at), g.timezone) === today)
    .reduce((s, x) => s + x.minutes, 0);
  const weakItems = progress
    .filter(
      (p) =>
        p.confidence <= 2 &&
        !reviews.some((r) => r.item_id === p.item_id && r.item_type === p.item_type),
    )
    .flatMap((p) => {
      const item =
        p.item_type === 'problem'
          ? cat.problems.find((x) => x.id === p.item_id)
          : p.item_type === 'pattern'
            ? cat.patterns.find((x) => x.id === p.item_id)
            : p.item_type === 'lesson'
              ? cat.lessons.find((x) => x.slug === p.item_id)
              : cat.cases.find((x) => x.slug === p.item_id);
      return item
        ? [
            {
              item_type: p.item_type,
              item_id: p.item_id,
              title: item.title,
              domain: p.item_type === 'problem' || p.item_type === 'pattern' ? 'dsa' : 'review',
              estimatedMinutes: 15,
            },
          ]
        : [];
    });
  const plan = planWithinBudget(
    [...reviews, ...weakItems, ...newItems],
    Math.max(0, budget - spent),
  );
  const weekly = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(today, i - 6);
    return {
      day,
      minutes: sessions
        .filter((x) => calendarDate(new Date(x.started_at), g.timezone) === day)
        .reduce((sum, x) => sum + x.minutes, 0),
    };
  });
  const days = new Set(sessions.map((x) => calendarDate(new Date(x.started_at), g.timezone)));
  let streak = 0,
    day = days.has(today) ? today : addDays(today, -1);
  while (days.has(day)) {
    streak++;
    day = addDays(day, -1);
  }
  const weak = progress.filter(
    (p) => p.confidence <= 2 || reviews.some((r) => r.item_id === p.item_id && r.lapse_count >= 2),
  );
  const recommendations = reviews
    .filter((r) => r.lapse_count >= 2)
    .map((r) => {
      const p =
        r.item_type === 'pattern'
          ? cat.patterns.find((x) => x.id === r.item_id)
          : r.item_type === 'problem'
            ? cat.patterns.find((x) => x.practiceProblemIds.includes(r.item_id))
            : undefined;
      return {
        item: r,
        prerequisites: p?.prerequisiteSlugs ?? [],
        practice: cat.problems
          .filter((q) => p?.practiceProblemIds.includes(q.id) && q.id !== r.item_id)
          .slice(0, 3),
      };
    });
  return {
    today,
    goals: g,
    reviews,
    progress,
    plan,
    weekly,
    streak,
    spent,
    budget,
    attempted: attempts.length,
    independentlySolved: new Set(
      attempts.filter((x) => x.result === 'solved' && !x.hint_used).map((x) => x.problem_id),
    ).size,
    mastered: progress.filter((x) => x.status === 'mastered').length,
    weak,
    recommendations,
    totalProblems: cat.problems.length,
  };
}
