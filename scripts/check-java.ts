import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { lessons, cases } from './content';
const work = mkdtempSync(join(tmpdir(), 'devtrack-java-'));
let count = 0;
const javaBin = (tool: string) =>
  process.env.DEVTRACK_JAVA_HOME ? join(process.env.DEVTRACK_JAVA_HOME, 'bin', tool) : tool;
try {
  for (const sample of [
    ...lessons.flatMap((l) =>
      l.javaExamples.map((e) => ({ slug: l.slug, code: e.code, output: e.expectedOutput })),
    ),
    ...cases
      .filter((c) => c.kind === 'LLD')
      .map((c) => ({ slug: c.slug, code: c.javaSkeleton, output: 'PASS' })),
  ]) {
    writeFileSync(join(work, 'Main.java'), sample.code);
    execFileSync(javaBin('javac'), ['--release', '21', 'Main.java'], { cwd: work, stdio: 'pipe' });
    const actual = execFileSync(javaBin('java'), ['-ea', 'Main'], { cwd: work, encoding: 'utf8' })
      .trim()
      .replaceAll('\r', '');
    if (actual !== sample.output.trim())
      throw new Error(`${sample.slug}: unexpected output ${actual}`);
    count++;
  }
  console.log(`Compiled and ran ${count} Java examples and LLD tests.`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
