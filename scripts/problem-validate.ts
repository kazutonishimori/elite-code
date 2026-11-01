/**
 * npm run problem:validate -- <file|dir>...
 * Schema + semantic validation, then executes every reference solution with CPython.
 */
import path from 'node:path';

import { CPythonRunner } from './lib/cpythonRunner.ts';
import { collectJsonFiles, mapPool } from './lib/files.ts';
import { checkProblemFile } from './lib/problemCheck.ts';
import { duplicateIdErrors, formatReport } from './lib/report.ts';

const inputs = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (inputs.length === 0) {
  console.error('Usage: npm run problem:validate -- <file|dir> [...]');
  process.exit(2);
}

const files = collectJsonFiles(inputs);
const runner = new CPythonRunner();
const reports = await mapPool(files, 4, (file) =>
  checkProblemFile(file, runner, {
    requireMatchingFileName: path.basename(path.dirname(path.resolve(file))) === 'problems',
  }),
);
reports.forEach((r) => console.log(formatReport(r)));

const duplicates = duplicateIdErrors(reports);
duplicates.forEach((d) => console.log(`✗ ${d}`));
const failed = reports.filter((r) => r.errors.length > 0).length;
console.log(`\n${files.length} file(s): ${files.length - failed} valid, ${failed} invalid`);
process.exit(failed > 0 || duplicates.length > 0 || files.length === 0 ? 1 : 0);
