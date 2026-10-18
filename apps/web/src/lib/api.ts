import { useQuery } from '@tanstack/react-query';
import type { Pattern, Problem, Lesson, DesignCase } from '../../../../packages/shared/src/content';
import type { DueItem, Goals, Progress } from '../../../../packages/shared/src/schemas';
const base = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
export async function api<T>(path: string, body?: unknown, method?: string): Promise<T> {
  const response = await fetch(`${base}/api/v1${path}`, {
    credentials: 'include',
    method: method ?? (body ? 'POST' : 'GET'),
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.headers.get('content-type')?.includes('application/json'))
    throw new Error(
      'The API returned a sign-in page or an unexpected response. Sign in at your API URL, then retry.',
    );
  const data = (await response.json()) as { error?: string };
  if (!response.ok) throw new ApiError(data.error ?? 'Request failed', response.status);
  return data as T;
}
export interface Catalog {
  patterns: Pattern[];
  problems: Problem[];
  lessons: Lesson[];
  cases: DesignCase[];
}
export interface PlanItem {
  item_type: string;
  item_id: string;
  title: string;
  domain: string;
  estimatedMinutes: number;
}
export interface Dashboard {
  today: string;
  goals: Goals;
  reviews: DueItem[];
  progress: Progress[];
  plan: { items: PlanItem[]; minutes: number; overflow: number };
  weekly: { day: string; minutes: number }[];
  streak: number;
  spent: number;
  budget: number;
  attempted: number;
  independentlySolved: number;
  mastered: number;
  weak: Progress[];
  recommendations: { item: DueItem; prerequisites: string[]; practice: Problem[] }[];
  totalProblems: number;
}
export function useCatalog() {
  return useQuery({
    queryKey: ['catalog'],
    queryFn: () => api<Catalog>('/catalog'),
    staleTime: 300000,
  });
}
export function useDashboard() {
  return useQuery({ queryKey: ['dashboard'], queryFn: () => api<Dashboard>('/dashboard') });
}
export function itemUrl(type: string, id: string, cat?: Catalog): string {
  if (type === 'problem') return `/problems/${cat?.problems.find((x) => x.id === id)?.slug ?? id}`;
  if (type === 'pattern') return `/dsa/${id}`;
  if (type === 'case')
    return `/${cat?.cases.find((x) => x.slug === id)?.kind.toLowerCase() ?? 'hld'}/${id}`;
  return `/${cat?.lessons.find((x) => x.slug === id)?.domain ?? 'java'}/${id}`;
}
export function catalogItems(cat: Catalog) {
  return [
    ...cat.patterns.map((x) => ({ id: x.id, title: x.title, type: 'pattern', domain: 'dsa' })),
    ...cat.problems.map((x) => ({ id: x.id, title: x.title, type: 'problem', domain: 'dsa' })),
    ...cat.lessons.map((x) => ({ id: x.slug, title: x.title, type: 'lesson', domain: x.domain })),
    ...cat.cases.map((x) => ({
      id: x.slug,
      title: x.title,
      type: 'case',
      domain: x.kind.toLowerCase(),
    })),
  ];
}
