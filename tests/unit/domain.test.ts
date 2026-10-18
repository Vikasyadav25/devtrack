import { describe, it, expect } from 'vitest';
import {
  addDays,
  calendarDate,
  isMastered,
  planWithinBudget,
  prerequisitesUnlocked,
  scheduleReview,
} from '../../packages/shared/src/domain';
const initial = {
  intervalDays: 1,
  successfulReviews: 0,
  lapseCount: 0,
  dueAt: '2026-10-16',
  version: 0,
};
describe('calendar review scheduling', () => {
  it('advances good reviews through the documented ladder', () => {
    let state = initial;
    for (const expected of [3, 7, 14, 30, 60, 120]) {
      state = scheduleReview(state, 'Good', '2026-10-16');
      expect(state.intervalDays).toBe(expected);
    }
    expect(state.successfulReviews).toBe(6);
  });
  it('resets after a lapse and keeps hard shorter', () => {
    const lapsed = scheduleReview(
      { ...initial, intervalDays: 30, successfulReviews: 4 },
      'Again',
      '2026-10-16',
    );
    expect(lapsed).toMatchObject({
      intervalDays: 1,
      successfulReviews: 0,
      lapseCount: 1,
      dueAt: '2026-10-17',
    });
    expect(scheduleReview({ ...initial, intervalDays: 7 }, 'Hard', '2026-10-16').intervalDays).toBe(
      2,
    );
    expect(scheduleReview(initial, 'Easy', '2026-10-16').intervalDays).toBe(7);
  });
  it('uses the user calendar across UTC midnight and DST', () => {
    expect(calendarDate(new Date('2026-10-16T20:00:00Z'), 'Asia/Kolkata')).toBe('2026-10-17');
    expect(calendarDate(new Date('2026-10-16T02:00:00Z'), 'America/Los_Angeles')).toBe(
      '2026-10-15',
    );
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
  it('requires an independent solve and recall on a later local date', () => {
    expect(isMastered(null, 3, '2026-10-17', 'Asia/Kolkata')).toBe(false);
    expect(isMastered('2026-10-16T20:00:00Z', 1, '2026-10-17', 'Asia/Kolkata')).toBe(false);
    expect(isMastered('2026-10-16T20:00:00Z', 1, '2026-10-18', 'Asia/Kolkata')).toBe(true);
  });
  it('respects prerequisites and never overbooks a plan', () => {
    expect(prerequisitesUnlocked(['arrays'], new Set())).toBe(false);
    expect(prerequisitesUnlocked(['arrays'], new Set(['arrays']))).toBe(true);
    const plan = planWithinBudget(
      [{ estimatedMinutes: 15 }, { estimatedMinutes: 35 }, { estimatedMinutes: 20 }],
      40,
    );
    expect(plan.minutes).toBe(35);
    expect(plan.items).toHaveLength(2);
    expect(plan.overflow).toBe(1);
    expect(planWithinBudget([{ estimatedMinutes: 5 }], 0).items).toHaveLength(0);
  });
});
