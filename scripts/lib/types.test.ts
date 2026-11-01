import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { generateTypes, typesPath } from './types';

describe('generateTypes', () => {
  it('matches the committed src/types/problem.generated.ts (schema and types never drift)', async () => {
    expect(await generateTypes()).toBe(readFileSync(typesPath, 'utf8'));
  }, 20_000);
});
