import { z } from 'zod';

export const itemType = z.enum(['problem', 'pattern', 'lesson', 'case']);
export type ItemType = z.infer<typeof itemType>;
export const identity = z.object({ itemType, itemId: z.string().min(1).max(150) });
export const progressInput = z.object({
  status: z.enum(['learning', 'completed']),
  confidence: z.number().int().min(1).max(5).default(3),
  minutes: z.number().int().min(0).max(600).default(0),
});
export const attemptInput = z.object({
  result: z.enum(['solved', 'partial', 'failed']),
  hintUsed: z.boolean(),
  minutes: z.number().int().min(1).max(600),
  notes: z.string().max(20000).default(''),
  codeUrl: z
    .union([
      z.literal(''),
      z
        .string()
        .url()
        .refine((v) => v.startsWith('https://'), 'Use HTTPS'),
    ])
    .default(''),
  confidence: z.number().int().min(1).max(5).default(3),
});
export const reviewInput = z.object({
  rating: z.enum(['Again', 'Hard', 'Good', 'Easy']),
  eventId: z.string().uuid(),
});
export type Rating = z.infer<typeof reviewInput>['rating'];
export const noteInput = identity.extend({
  title: z.string().trim().min(1).max(200),
  body: z.string().max(30000),
  tags: z.array(z.string().max(40)).max(10).default([]),
});
export const goalsInput = z.object({
  dailyMinutes: z.number().int().min(15).max(600),
  targetTrack: z.enum(['SDE-2', 'SDE-3']),
  timezone: z.string().refine((v) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: v });
      return true;
    } catch {
      return false;
    }
  }, 'Invalid IANA time zone'),
  restDays: z.array(z.number().int().min(0).max(6)).max(7),
});
export const sessionInput = identity.extend({
  minutes: z.number().int().min(1).max(600),
  domain: z.string().max(50),
});
export const mockInput = z.object({
  type: z.enum(['DSA', 'LLD', 'HLD', 'Behavioral']),
  durationMinutes: z.number().int().min(5).max(180),
  feedback: z.string().max(20000),
  scores: z.object({
    clarity: z.number().int().min(1).max(5),
    correctness: z.number().int().min(1).max(5),
    tradeoffs: z.number().int().min(1).max(5),
  }),
});
export interface ReviewState {
  intervalDays: number;
  successfulReviews: number;
  lapseCount: number;
  dueAt: string;
  version: number;
}
export interface Progress {
  item_type: ItemType;
  item_id: string;
  status: string;
  confidence: number;
  time_spent_minutes: number;
  first_studied_at: string;
  last_solved_without_hint_at: string | null;
}
export interface DueItem {
  item_type: ItemType;
  item_id: string;
  due_at: string;
  interval_days: number;
  lapse_count: number;
  title: string;
  domain: string;
  estimatedMinutes: number;
}
export interface Note {
  id: string;
  item_type: ItemType;
  item_id: string;
  title: string;
  body_md: string;
  tags_json: string;
  updated_at: string;
}
export interface Goals {
  dailyMinutes: number;
  targetTrack: 'SDE-2' | 'SDE-3';
  timezone: string;
  restDays: number[];
}
