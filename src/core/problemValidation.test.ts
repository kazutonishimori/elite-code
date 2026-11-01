import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { Problem } from '@/types/problem.generated';

import {
  ALLOWED_PACKAGES,
  formatIssue,
  parseAndValidateProblem,
  semanticIssues,
  TAGS,
  timeLimitMs,
  validateProblem,
} from './problemValidation';

const schemaDir = path.resolve(import.meta.dirname, '../../schema');
const read = (...parts: string[]) => readFileSync(path.join(schemaDir, ...parts), 'utf8');
const example = (name: string) => JSON.parse(read('examples', `${name}.json`)) as Problem;

describe('validateProblem', () => {
  it.each(readdirSync(path.join(schemaDir, 'examples')))('accepts example %s', (file) => {
    const result = parseAndValidateProblem(read('examples', file));
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
  });

  const expected = JSON.parse(read('fixtures', 'invalid', 'expected.json')) as Record<
    string,
    { path: string; rule: string }[]
  >;

  it('has an expectation for every invalid fixture', () => {
    const files = readdirSync(path.join(schemaDir, 'fixtures', 'invalid'))
      .filter((f) => f !== 'expected.json')
      .map((f) => f.replace(/\.json$/, ''));
    expect(files.sort()).toEqual(Object.keys(expected).sort());
  });

  it.each(Object.entries(expected))(
    'rejects fixture %s with the expected issue',
    (name, issues) => {
      const result = parseAndValidateProblem(read('fixtures', 'invalid', `${name}.json`));
      expect(result.ok).toBe(false);
      for (const want of issues) {
        expect(result.issues).toContainEqual(expect.objectContaining(want));
      }
    },
  );

  it('explains common failures in author-friendly language', () => {
    const doc = { ...example('merge-meeting-ranges'), author: 'x', difficulty: 'insane' };
    const messages = parseAndValidateProblem(JSON.stringify(doc)).issues.map(formatIssue);
    expect(messages).toContain(
      '(root): unknown property "author" (not allowed by the schema) [additionalProperties]',
    );
    expect(messages).toContain('/difficulty: must be one of: "easy", "medium", "hard" [enum]');
  });

  it('reports missing properties, const and type mismatches', () => {
    const { summary: _omit, ...rest } = example('merge-meeting-ranges');
    const issues = validateProblem({ ...rest, schemaVersion: 2, estimatedMinutes: 'ten' }).issues;
    expect(issues.map((i) => i.message)).toEqual(
      expect.arrayContaining([
        'missing required property "summary"',
        'must be exactly 1',
        'must be of type integer',
      ]),
    );
  });

  it('does not report the noisy "if" wrapper error for stage count rules', () => {
    const doc = example('inventory-reservations');
    const issues = validateProblem({ ...doc, stages: doc.stages.slice(0, 2) }).issues;
    expect(issues.map((i) => i.rule)).toEqual(['minItems']);
  });

  it('rejects non-object input', () => {
    expect(validateProblem(null).ok).toBe(false);
    expect(validateProblem([]).issues[0]?.rule).toBe('type');
  });
});

describe('semanticIssues', () => {
  it('flags duplicate hints', () => {
    const doc = example('merge-meeting-ranges');
    const stage = doc.stages[0]!;
    const issues = semanticIssues({
      ...doc,
      stages: [{ ...stage, hints: ['same hint', 'same hint'] }],
    });
    expect(issues).toEqual([
      { path: '/stages/0/hints', message: 'hints must all be different', rule: 'unique-hints' },
    ]);
  });

  it('accepts tests with imports before the function definition', () => {
    const doc = example('merge-meeting-ranges');
    const stage = doc.stages[0]!;
    const code = 'import math\n\ndef test_example():\n    assert math.pi > 3\n';
    const issues = semanticIssues({
      ...doc,
      stages: [{ ...stage, visibleTests: [{ name: 'test_example', code }] }],
    });
    expect(issues).toEqual([]);
  });

  it('requires the function to take no arguments', () => {
    const doc = example('merge-meeting-ranges');
    const stage = doc.stages[0]!;
    const code = 'def test_example(x):\n    assert x\n';
    const issues = semanticIssues({
      ...doc,
      stages: [{ ...stage, visibleTests: [{ name: 'test_example', code }] }],
    });
    expect(issues.map((i) => i.rule)).toEqual(['test-defines-function']);
  });
});

describe('schema metadata', () => {
  it('exposes the allowed packages and tags from the schema', () => {
    expect(ALLOWED_PACKAGES).toEqual(['numpy', 'pandas', 'sortedcontainers']);
    expect(TAGS).toContain('intervals');
  });

  it('defaults the time limit to 5 seconds', () => {
    expect(timeLimitMs({})).toBe(5000);
    expect(timeLimitMs({ timeLimitSeconds: 2.5 })).toBe(2500);
  });
});
