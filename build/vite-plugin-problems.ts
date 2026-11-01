/**
 * Validates every problems/*.json file against the schema (and the semantic rules) when Vite
 * starts or builds, so an invalid problem can never ship. Execution checks live in the CLI.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import type { Plugin } from 'vite';

import { formatIssue, parseAndValidateProblem } from '../src/core/problemValidation.ts';

export function collectProblemErrors(dir: string): string[] {
  const errors: string[] = [];
  const ids = new Map<string, string>();
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()) {
    const result = parseAndValidateProblem(readFileSync(path.join(dir, file), 'utf8'));
    if (!result.ok) {
      errors.push(...result.issues.map((i) => `${file} ${formatIssue(i)}`));
      continue;
    }
    const { id } = result.problem;
    if (`${id}.json` !== file) errors.push(`${file}: file name must be "${id}.json"`);
    const clash = ids.get(id);
    if (clash) errors.push(`${file}: id "${id}" is already used by ${clash}`);
    ids.set(id, file);
  }
  return errors;
}

export function validateProblemsPlugin(dir: string): Plugin {
  return {
    name: 'elite-code:validate-problems',
    buildStart() {
      const errors = collectProblemErrors(dir);
      if (errors.length > 0) {
        this.error(`Invalid problem files:\n  ${errors.join('\n  ')}`);
      }
    },
  };
}
