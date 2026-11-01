import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { extractProblemBlocks, injectExamples } from './guide';
import { parseAndValidateProblem } from '../../src/core/problemValidation';

const schemaDir = path.resolve(import.meta.dirname, '../../schema');
const guide = readFileSync(path.join(schemaDir, 'PROBLEM_AUTHORING.md'), 'utf8');

describe('PROBLEM_AUTHORING.md', () => {
  const blocks = extractProblemBlocks(guide);

  it('embeds one complete example per schema/examples file', () => {
    expect(blocks).toHaveLength(readdirSync(path.join(schemaDir, 'examples')).length);
  });

  it.each(blocks.map((b, i) => [i, b] as const))(
    'example %i validates against the schema',
    (_i, block) => {
      const result = parseAndValidateProblem(block);
      expect(result.issues).toEqual([]);
    },
  );

  it('includes a standard example and a 4-stage simulation', () => {
    const docs = blocks.map((b) => JSON.parse(b) as { type: string; stages: unknown[] });
    expect(docs.map((d) => [d.type, d.stages.length])).toEqual(
      expect.arrayContaining([
        ['standard', 1],
        ['simulation', 4],
      ]),
    );
  });

  it('documents every top-level schema property', () => {
    const schema = JSON.parse(
      readFileSync(path.join(schemaDir, 'problem.schema.json'), 'utf8'),
    ) as {
      properties: Record<string, unknown>;
    };
    for (const key of Object.keys(schema.properties)) {
      expect(guide).toContain(`\`${key}\``);
    }
  });
});

describe('injectExamples', () => {
  it('replaces the block between markers and is idempotent', () => {
    const text = 'a\n<!-- BEGIN EXAMPLE x -->\nold\n<!-- END EXAMPLE -->\nb';
    const once = injectExamples(text, { x: '{"schemaVersion": 1}\n' });
    expect(once).toContain('```json\n{"schemaVersion": 1}\n```');
    expect(injectExamples(once, { x: '{"schemaVersion": 1}\n' })).toBe(once);
  });

  it('fails loudly for an unknown example id', () => {
    expect(() => injectExamples('<!-- BEGIN EXAMPLE y -->\n<!-- END EXAMPLE -->', {})).toThrow(/y/);
  });
});
