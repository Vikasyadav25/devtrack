import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Pattern, Problem, Lesson, DesignCase } from '../packages/shared/src/content';
const load = <T>(path: string): T =>
  JSON.parse(readFileSync(resolve('content', path), 'utf8')) as T;
export const patterns = load<Pattern[]>('dsa/patterns.json');
export const problems = load<Problem[]>('dsa/problems.json');
export const lessons = load<Lesson[]>('lessons.json');
export const cases = load<DesignCase[]>('cases.json');
