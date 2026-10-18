import { writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { patterns, problems, lessons, cases } from './content';
export function seedSQL(): string {
  const quote = (v: string | number) =>
    typeof v === 'number' ? String(v) : `'${v.replaceAll("'", "''")}'`;
  const statements: string[] = [];
  const insert = (
    table: string,
    columns: string[],
    values: (string | number)[],
    conflict: string,
  ) => {
    statements.push(
      `INSERT INTO ${table}(${columns.join(',')}) VALUES(${values.map(quote).join(',')}) ON CONFLICT(${conflict}) DO UPDATE SET ${columns
        .filter((c) => c !== conflict)
        .map((c) => `${c}=excluded.${c}`)
        .join(',')};`,
    );
  };
  for (const [i, p] of patterns.entries())
    insert(
      'curriculum_nodes',
      ['id', 'slug', 'domain', 'title', 'level', 'sort_order', 'status', 'metadata_json'],
      [p.id, p.slug, 'dsa', p.title, p.level, i, p.status, JSON.stringify(p)],
      'id',
    );
  for (const p of problems) {
    insert(
      'problems',
      [
        'id',
        'slug',
        'platform',
        'external_id',
        'title',
        'url',
        'difficulty',
        'content_json',
        'status',
      ],
      [
        p.id,
        p.slug,
        p.platform,
        p.id.slice(3),
        p.title,
        p.externalUrl,
        p.difficulty,
        JSON.stringify(p),
        p.status,
      ],
      'id',
    );
    for (const slug of p.patternSlugs)
      if (patterns.some((x) => x.id === slug))
        statements.push(
          `INSERT OR IGNORE INTO problem_patterns VALUES(${quote(p.id)},${quote(slug)});`,
        );
  }
  for (const l of lessons)
    insert(
      'lessons',
      ['id', 'slug', 'body_md', 'metadata_json', 'status'],
      [l.slug, l.slug, l.explanationMd, JSON.stringify(l), l.status],
      'id',
    );
  for (const c of cases)
    insert(
      'design_cases',
      ['id', 'slug', 'kind', 'content_json', 'status'],
      [c.slug, c.slug, c.kind, JSON.stringify(c), c.status],
      'id',
    );
  return statements.join('\n');
}
if (process.argv[1]?.endsWith('seed-d1.ts')) {
  mkdirSync('.wrangler', { recursive: true });
  writeFileSync('.wrangler/seed.sql', seedSQL());
  if (process.argv.includes('--sql-only')) console.log('Wrote .wrangler/seed.sql');
  else {
    const remote = process.argv.includes('--remote');
    const testing = process.argv.includes('--test');
    if (remote && testing) throw new Error('Tests cannot seed a remote database.');
    const output = execFileSync(
      process.execPath,
      [
        'node_modules/wrangler/bin/wrangler.js',
        'd1',
        'execute',
        testing ? 'devtrack-test' : 'devtrack',
        '--config',
        'apps/api/wrangler.toml',
        ...(remote ? ['--remote'] : ['--local', '--env', testing ? 'test' : 'local']),
        '--file',
        '.wrangler/seed.sql',
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    console.log(
      output
        .split('\n')
        .filter((line) => line.includes('commands executed') || line.includes('Executing on'))
        .join('\n') || 'Content seeded successfully.',
    );
  }
}
