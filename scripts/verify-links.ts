import { writeFileSync } from 'node:fs';
import { problems } from './content';
const report: { id: string; url: string; status: number | null; needsVerification: boolean }[] = [];
// Low concurrency, no retries, no scraping; blocked responses remain unverified.
const pending = [...problems];
await Promise.all(
  Array.from({ length: 3 }, async () => {
    for (let p = pending.shift(); p; p = pending.shift()) {
      let status: number | null = null;
      try {
        status = (
          await fetch(p.externalUrl, {
            method: 'HEAD',
            redirect: 'follow',
            signal: AbortSignal.timeout(12000),
          })
        ).status;
      } catch {
        /* Retain explicit unverified state. */
      }
      p.needsVerification = status !== 200;
      report.push({ id: p.id, url: p.externalUrl, status, needsVerification: p.needsVerification });
    }
  }),
);
writeFileSync('content/dsa/problems.json', JSON.stringify(problems, null, 2) + '\n');
writeFileSync(
  'content/link-report.json',
  JSON.stringify({ checkedAt: new Date().toISOString(), report }, null, 2) + '\n',
);
console.log(
  `Checked ${report.length} URLs; ${report.filter((x) => x.needsVerification).length} need manual verification.`,
);
