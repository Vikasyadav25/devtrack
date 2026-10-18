import { writeFileSync } from 'node:fs';
import { z } from 'zod';
import { patterns, problems, lessons, cases } from './content';
import prepData from '../content/prep-hub.json';
import type { PrepCatalog } from '../packages/shared/src/prep';
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const errors: string[] = [];
const check = (condition: boolean, message: string) => {
  if (!condition) errors.push(message);
};
const words = (value: string) => value.trim().split(/\s+/).length;
const duplicates = (values: string[]) => values.length !== new Set(values).size;
const prep = prepData as PrepCatalog;
const validPaths = new Set([
  ...problems.map((p) => '/problems/' + p.slug),
  ...patterns.map((p) => '/dsa/' + p.slug),
  ...lessons.map((l) => '/' + l.domain + '/' + l.slug),
  ...cases.map((c) => '/' + c.kind.toLowerCase() + '/' + c.slug),
]);
check(!duplicates(prep.courses.map((c) => c.slug)), 'Duplicate Prep Hub course slugs');
const moduleIds = prep.courses.flatMap((c) => c.modules.map((m) => m.id));
check(!duplicates(moduleIds), 'Duplicate Prep Hub module IDs');
for (const course of prep.courses) {
  check(
    ['dsa', 'core-cs', 'system-design', 'data-engineering'].includes(course.track),
    `${course.slug}: invalid prep track`,
  );
  check(
    course.sourceUrl.startsWith('https://takeuforward.org/prep-hub/'),
    `${course.slug}: invalid source`,
  );
  for (const module of course.modules) {
    check(module.title.length > 0 && module.topicIds.length > 0, `${module.id}: empty prep module`);
    check(!duplicates(module.topicIds), `${module.id}: duplicate prep topic`);
    check(
      module.topicIds.every((id) => !!prep.topics[id]),
      `${module.id}: missing prep topic`,
    );
  }
}
for (const [id, topic] of Object.entries(prep.topics)) {
  check(topic.title.length > 0 && topic.resourceIds.length > 0, `${id}: empty prep topic`);
  check(
    topic.resourceIds.every((r) => !!prep.resources[r]),
    `${id}: unknown prep resource`,
  );
  check(!topic.internalPath || validPaths.has(topic.internalPath), `${id}: unknown local lesson`);
}
const resourceSchema = z
  .object({
    label: z.string().min(1),
    url: z.string().url().startsWith('https://'),
    kind: z.enum(['reading', 'practice', 'exercise', 'code']),
    access: z.enum(['free', 'account', 'premium', 'unknown']),
    verification: z.enum(['catalog', 'http', 'unchecked']),
  })
  .strict();
for (const [id, resource] of Object.entries(prep.resources)) {
  check(resourceSchema.safeParse(resource).success, `${id}: invalid prep resource`);
}
check(
  !duplicates(problems.map((p) => p.id)) && !duplicates(problems.map((p) => p.slug)),
  'Duplicate problem identities',
);
check(
  !duplicates(patterns.map((p) => p.slug)) &&
    !duplicates(lessons.map((p) => p.slug)) &&
    !duplicates(cases.map((p) => p.slug)),
  'Duplicate content slugs',
);
for (const item of [...patterns, ...problems, ...lessons, ...cases]) {
  check(slug.safeParse(item.slug).success, `Invalid slug ${item.slug}`);
  check(['published', 'draft'].includes(item.status), `Invalid status ${item.slug}`);
  check(/^\d{4}-\d{2}-\d{2}$/.test(item.updatedAt), `Invalid updatedAt ${item.slug}`);
}
for (const p of patterns.filter((x) => x.status === 'published')) {
  check(
    words(p.explanationMd) >= 400,
    `${p.slug}: pattern explanation under 400 words (${words(p.explanationMd)})`,
  );
  check(p.javaTemplate.length > 100, `${p.slug}: missing code`);
  check(p.practiceProblemIds.length >= 8, `${p.slug}: fewer than 8 problems`);
  check(
    p.practiceProblemIds.every((id) => problems.some((x) => x.id === id)),
    `${p.slug}: unknown problem reference`,
  );
  check(
    p.prerequisiteSlugs.every((id) => patterns.some((x) => x.slug === id)),
    `${p.slug}: unknown prerequisite`,
  );
}
for (const p of problems) {
  check(/^lc-\d+$/.test(p.id), `${p.slug}: invalid LeetCode ID`);
  check(
    p.externalUrl === `https://leetcode.com/problems/${p.slug}/`,
    `${p.slug}: URL does not match canonical slug`,
  );
}
for (const l of lessons.filter((x) => x.status === 'published')) {
  check(
    words(l.explanationMd) >= 500,
    `${l.slug}: explanation under 500 words (${words(l.explanationMd)})`,
  );
  check(
    l.javaExamples.length > 0 && l.javaExamples.every((e) => e.code.includes('public class Main')),
    `${l.slug}: missing standalone Java example`,
  );
  check(
    l.interviewQA.length >= 3 && l.practiceTasks.length > 0 && l.quiz.length > 0,
    `${l.slug}: missing interview or exercise content`,
  );
}
for (const c of cases.filter((x) => x.status === 'published')) {
  check(
    c.functionalRequirements.length >= 3 &&
      c.tradeoffs.length >= 3 &&
      c.followupQuestions.length >= 5 &&
      c.mermaidDiagrams.length > 0 &&
      c.baselineDesign.length > 500,
    `${c.slug}: incomplete case`,
  );
  if (c.kind === 'LLD')
    check(c.javaSkeleton.includes('static void test()'), `${c.slug}: missing runnable tests`);
}
const report = {
  generatedAt: new Date().toISOString(),
  published: {
    patterns: patterns.filter((x) => x.status === 'published').length,
    problems: problems.filter((x) => x.status === 'published').length,
    javaLessons: lessons.filter((x) => x.domain === 'java' && x.status === 'published').length,
    backendLessons: lessons.filter((x) => x.domain === 'backend' && x.status === 'published')
      .length,
    csLessons: lessons.filter((x) => x.domain === 'cs' && x.status === 'published').length,
    lld: cases.filter((x) => x.kind === 'LLD' && x.status === 'published').length,
    hld: cases.filter((x) => x.kind === 'HLD' && x.status === 'published').length,
  },
  unverifiedProblemLinks: problems.filter((x) => x.needsVerification).length,
  prepHub: {
    courses: prep.courses.length,
    modules: moduleIds.length,
    uniqueEntries: Object.keys(prep.topics).length,
    practiceLinks: Object.values(prep.resources).filter((r) => r.kind === 'practice').length,
    unverifiedResources: Object.values(prep.resources).filter((r) => r.verification === 'unchecked')
      .length,
  },
  errors,
};
writeFileSync('docs/CONTENT_REPORT.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exitCode = 1;
