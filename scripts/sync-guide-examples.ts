/** Injects schema/examples/*.json into the guide. `--check` fails when they are out of sync. */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { format, resolveConfig } from 'prettier';

import { injectExamples } from './lib/guide.ts';

const schemaDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'schema');
const guidePath = path.join(schemaDir, 'PROBLEM_AUTHORING.md');
const examples = Object.fromEntries(
  readdirSync(path.join(schemaDir, 'examples')).map((f) => [
    f.replace(/\.json$/, ''),
    readFileSync(path.join(schemaDir, 'examples', f), 'utf8'),
  ]),
);
const current = readFileSync(guidePath, 'utf8');
// Format like the pre-commit hook does, so the check is stable.
const next = await format(injectExamples(current, examples), {
  ...(await resolveConfig(guidePath)),
  filepath: guidePath,
});

if (process.argv.includes('--check')) {
  if (current !== next) {
    console.error('PROBLEM_AUTHORING.md examples are out of date. Run `npm run schema:guide`.');
    process.exit(1);
  }
  console.log('Guide examples are in sync.');
} else {
  writeFileSync(guidePath, next);
  console.log('Updated PROBLEM_AUTHORING.md examples.');
}
