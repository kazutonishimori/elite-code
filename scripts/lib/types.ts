import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { compile } from 'json-schema-to-typescript';
import { format } from 'prettier';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const schemaPath = path.join(root, 'schema', 'problem.schema.json');
export const typesPath = path.join(root, 'src', 'types', 'problem.generated.ts');

/** Compiles the problem JSON Schema to TypeScript, formatted like the rest of the codebase. */
export async function generateTypes(): Promise<string> {
  const schema = JSON.parse(await readFile(schemaPath, 'utf8')) as Record<string, unknown>;
  const ts = await compile(schema as never, 'Problem', {
    bannerComment:
      '/**\n * GENERATED FILE - DO NOT EDIT.\n * Source: schema/problem.schema.json. Regenerate with `npm run schema:types`.\n */',
    additionalProperties: false,
    unreachableDefinitions: true,
    strictIndexSignatures: true,
    maxItems: -1,
    cwd: path.dirname(schemaPath),
  });
  return format(ts, { parser: 'typescript', singleQuote: true, printWidth: 100 });
}
