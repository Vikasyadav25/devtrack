import { readFileSync, writeFileSync } from 'node:fs';
import type { PrepCatalog } from '../packages/shared/src/prep';

// Public metadata only: never fetch solutions, send credentials or infer access from a 403.
const path = 'content/prep-hub.json';
const catalog = JSON.parse(readFileSync(path, 'utf8')) as PrepCatalog;
const canonical = new Map<string, boolean>();
for (const category of ['all', 'database']) {
  const response = await fetch(`https://leetcode.com/api/problems/${category}/`, {
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`LeetCode ${category} catalog: ${response.status}`);
  const data = (await response.json()) as {
    stat_status_pairs: { stat: { question__title_slug: string }; paid_only: boolean }[];
  };
  for (const item of data.stat_status_pairs)
    canonical.set(item.stat.question__title_slug, item.paid_only);
}
const entries = Object.entries(catalog.resources);
const results: { url: string; status: number | null; result: string }[] = [];
let cursor = 0;
async function worker() {
  while (cursor < entries.length) {
    const [, resource] = entries[cursor++];
    const url = new URL(resource.url);
    const slug = url.pathname.split('/')[2];
    if (
      url.hostname === 'leetcode.com' &&
      url.pathname.startsWith('/problems/') &&
      canonical.has(slug)
    ) {
      resource.verification = 'catalog';
      resource.access = canonical.get(slug) ? 'premium' : 'account';
      results.push({
        url: resource.url,
        status: 200,
        result: 'Canonical LeetCode catalog match; browser access not tested',
      });
      continue;
    }
    try {
      const response = await fetch(resource.url, {
        method: 'HEAD',
        redirect: 'follow',
        signal: AbortSignal.timeout(12000),
      });
      resource.verification = response.ok ? 'http' : 'unchecked';
      results.push({
        url: resource.url,
        status: response.status,
        result: response.ok
          ? 'HTTP reachable'
          : 'Unverified; a non-200 response does not prove a dead link',
      });
      await response.body?.cancel();
    } catch {
      resource.verification = 'unchecked';
      results.push({
        url: resource.url,
        status: null,
        result: 'Unverified: network failure or timeout',
      });
    }
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
results.sort((a, b) => a.url.localeCompare(b.url));
const report = {
  checkedAt: new Date().toISOString(),
  total: results.length,
  canonical: results.filter((r) => r.result.startsWith('Canonical')).length,
  httpReachable: results.filter((r) => r.result === 'HTTP reachable').length,
  unverified: results.filter((r) => r.result.startsWith('Unverified')).length,
  results,
};
writeFileSync(path, JSON.stringify(catalog, null, 2) + '\n');
writeFileSync('content/prep-link-report.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ...report, results: undefined }, null, 2));
