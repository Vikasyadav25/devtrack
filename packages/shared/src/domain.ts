import type { Rating, ReviewState } from './schemas';

export function calendarDate(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function scheduleReview(state: ReviewState, rating: Rating, today: string): ReviewState {
  const ladder = [1, 3, 7, 14, 30, 60, 120];
  let interval = 1;
  if (rating === 'Hard') interval = Math.max(1, Math.min(2, state.intervalDays - 1));
  if (rating === 'Good') interval = ladder.find((d) => d > state.intervalDays) ?? 120;
  if (rating === 'Easy') interval = ladder.find((d) => d > Math.max(3, state.intervalDays)) ?? 120;
  return {
    intervalDays: interval,
    dueAt: addDays(today, interval),
    successfulReviews:
      rating === 'Again'
        ? 0
        : state.successfulReviews + (rating === 'Good' || rating === 'Easy' ? 1 : 0),
    lapseCount: state.lapseCount + (rating === 'Again' ? 1 : 0),
    version: state.version + 1,
  };
}
export function isMastered(
  independentSolvedAt: string | null,
  successfulReviews: number,
  reviewedDay: string,
  timeZone: string,
): boolean {
  return (
    !!independentSolvedAt &&
    successfulReviews >= 1 &&
    calendarDate(new Date(independentSolvedAt), timeZone) < reviewedDay
  );
}
export function planWithinBudget<T extends { estimatedMinutes: number }>(
  items: T[],
  budget: number,
): { items: T[]; minutes: number; overflow: number } {
  const selected: T[] = [];
  let minutes = 0;
  for (const item of items)
    if (minutes + item.estimatedMinutes <= budget) {
      selected.push(item);
      minutes += item.estimatedMinutes;
    }
  return { items: selected, minutes, overflow: items.length - selected.length };
}
export function prerequisitesUnlocked(required: string[], completed: Set<string>): boolean {
  return required.every((slug) => completed.has(slug));
}
