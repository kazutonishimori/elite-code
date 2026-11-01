/**
 * Generates src/types/problem.generated.ts from schema/problem.schema.json.
 * `--check` fails if the committed file is out of date.
 */
import { readFile, writeFile } from 'node:fs/promises';

import { generateTypes, typesPath } from './lib/types.ts';

const generated = await generateTypes();
if (process.argv.includes('--check')) {
  const current = await readFile(typesPath, 'utf8').catch(() => '');
  if (current !== generated) {
    console.error('src/types/problem.generated.ts is out of date. Run `npm run schema:types`.');
    process.exit(1);
  }
  console.log('Generated types are up to date.');
} else {
  await writeFile(typesPath, generated);
  console.log('Wrote src/types/problem.generated.ts');
}
