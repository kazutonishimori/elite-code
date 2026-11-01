/**
 * npm run problem:add -- <file> [--force]
 * Fully validates a problem file and copies it into problems/<id>.json.
 */
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CPythonRunner } from './lib/cpythonRunner.ts';
import { checkProblemFile } from './lib/problemCheck.ts';
import { formatReport } from './lib/report.ts';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const force = args.includes('--force');
if (!file) {
  console.error('Usage: npm run problem:add -- <file> [--force]');
  process.exit(2);
}

const report = await checkProblemFile(file, new CPythonRunner());
console.log(formatReport(report));
if (report.errors.length > 0 || !report.id) {
  console.error('\nNot added: fix the errors above first.');
  process.exit(1);
}

const problemsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'problems');
const target = path.join(problemsDir, `${report.id}.json`);
if (existsSync(target) && path.resolve(file) !== target && !force) {
  console.error(
    `\n${path.relative(process.cwd(), target)} already exists. Use --force to overwrite.`,
  );
  process.exit(1);
}
const problem = JSON.parse(await readFile(file, 'utf8')) as unknown;
await writeFile(target, `${JSON.stringify(problem, null, 2)}\n`);
console.log(`\nAdded ${path.relative(process.cwd(), target)}`);
