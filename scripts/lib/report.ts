import path from 'node:path';

import type { CheckReport } from './problemCheck.ts';

const color = (code: number) => (text: string) =>
  process.stdout.isTTY ? `\x1b[${code}m${text}\x1b[0m` : text;
const red = color(31);
const green = color(32);
const yellow = color(33);
const dim = color(2);

export function formatReport(report: CheckReport, cwd = process.cwd()): string {
  const file = path.relative(cwd, report.file) || report.file;
  const ok = report.errors.length === 0;
  const lines = [`${ok ? green('✓') : red('✗')} ${report.id ?? '(invalid)'} ${dim(file)}`];
  report.errors.forEach((e) => lines.push(`    ${red('error')}   ${e}`));
  report.warnings.forEach((w) => lines.push(`    ${yellow('warning')} ${w}`));
  report.notes.forEach((n) => lines.push(`    ${dim(n)}`));
  return lines.join('\n');
}

/** Duplicate ids among files in the same directory (a directory is one problem library). */
export function duplicateIdErrors(reports: CheckReport[]): string[] {
  const seen = new Map<string, string>();
  const errors: string[] = [];
  for (const r of reports) {
    if (!r.id) continue;
    const key = `${path.dirname(path.resolve(r.file))}::${r.id}`;
    const first = seen.get(key);
    if (first) errors.push(`id "${r.id}" is used by both ${first} and ${r.file}`);
    else seen.set(key, r.file);
  }
  return errors;
}
