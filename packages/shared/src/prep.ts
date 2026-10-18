export type PrepTrack = 'dsa' | 'core-cs' | 'system-design' | 'data-engineering';
export interface PrepResource {
  label: string;
  url: string;
  kind: 'reading' | 'practice' | 'exercise' | 'code';
  access: 'free' | 'account' | 'premium' | 'unknown';
  verification: 'catalog' | 'http' | 'unchecked';
}
export interface PrepTopic {
  title: string;
  kind: 'topic' | 'practice' | 'quiz';
  resourceIds: string[];
  internalPath?: string;
}
export interface PrepCourse {
  slug: string;
  title: string;
  track: PrepTrack;
  sourceUrl: string;
  modules: { id: string; title: string; topicIds: string[] }[];
}
export interface PrepCatalog {
  version: number;
  checkedAt: string;
  sourceUrl: string;
  scope: string;
  linkSources: string[];
  courses: PrepCourse[];
  topics: Record<string, PrepTopic>;
  resources: Record<string, PrepResource>;
}
