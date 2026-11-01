import { describe, expect, it } from 'vitest';

import type { HarnessTestResult } from '@/runner/types';
import { fakeResult } from '@/test/fakeWorker';
import { loadExample } from '@/test/fixtures';

import {
  buildRunRequest,
  classifyTests,
  newTestsOfStage,
  regressionLabel,
  selectTests,
  summarizeOutcome,
} from './testSelection';

const sim = loadExample('inventory-reservations');
const standard = loadExample('merge-meeting-ranges');

function testResult(overrides: Partial<HarnessTestResult>): HarnessTestResult {
  return {
    name: 'test_x',
    stageId: 's',
    stageIndex: 0,
    visibility: 'visible',
    status: 'passed',
    durationMs: 1,
    stdout: '',
    stderr: '',
    message: null,
    errorType: null,
    expression: null,
    expected: null,
    actual: null,
    comparison: null,
    difference: null,
    traceback: null,
    ...overrides,
  };
}

describe('selectTests', () => {
  it('Run selects only the current stage visible tests', () => {
    const tests = selectTests(sim, 2, 'run');
    expect(tests.map((t) => t.name)).toEqual(sim.stages[2]!.visibleTests.map((t) => t.name));
    expect(tests.every((t) => t.stageIndex === 2 && t.visibility === 'visible')).toBe(true);
  });

  it('Submit selects visible and hidden tests of every stage so far, earlier stages first', () => {
    const tests = selectTests(sim, 1, 'submit');
    const expected = sim.stages
      .slice(0, 2)
      .flatMap((s) => [...s.visibleTests, ...s.hiddenTests])
      .map((t) => t.name);
    expect(tests.map((t) => t.name)).toEqual(expected);
    expect(tests[0]).toEqual({
      name: 'test_add_and_count',
      code: sim.stages[0]!.visibleTests[0]!.code,
      stageId: 'basic-stock',
      stageIndex: 0,
      visibility: 'visible',
    });
    expect(tests.at(-1)!.visibility).toBe('hidden');
  });

  it('rejects stages that do not exist', () => {
    expect(() => selectTests(standard, 1, 'run')).toThrow(RangeError);
    expect(() => newTestsOfStage(standard, 3)).toThrow(RangeError);
  });

  it('lists only the tests a stage introduces', () => {
    expect(newTestsOfStage(sim, 3).every((t) => t.stageIndex === 3)).toBe(true);
  });
});

describe('buildRunRequest', () => {
  it('carries packages and the time limit', () => {
    const req = buildRunRequest(
      { ...standard, packages: ['numpy'], timeLimitSeconds: 2 },
      0,
      'submit',
      'code',
    );
    expect(req).toMatchObject({
      packages: ['numpy'],
      timeoutMs: 2000,
      payload: { code: 'code', mode: 'submit' },
    });
    expect(req.payload.tests).toHaveLength(9);
  });

  it('runs no tests in custom mode', () => {
    const req = buildRunRequest(standard, 0, 'custom', 'code', 'merge_ranges([])');
    expect(req.payload).toEqual({
      code: 'code',
      mode: 'custom',
      tests: [],
      customInput: 'merge_ranges([])',
    });
    expect(req.packages).toEqual([]);
    expect(req.timeoutMs).toBe(5000);
  });
});

describe('classifyTests', () => {
  it('flags failures from earlier stages as regressions', () => {
    const tests = classifyTests(
      [
        testResult({ stageIndex: 0, status: 'failed' }),
        testResult({ stageIndex: 0, status: 'passed' }),
        testResult({ stageIndex: 1, status: 'error' }),
        testResult({ stageIndex: 2, status: 'failed' }),
        testResult({ stageIndex: 0, status: 'skipped' }),
      ],
      2,
    );
    expect(tests.map((t) => t.regression)).toEqual([true, false, true, false, false]);
    expect(regressionLabel(tests[2]!)).toBe('Stage 2 test broke');
  });
});

describe('summarizeOutcome', () => {
  it('accepts when every test passes', () => {
    const summary = summarizeOutcome(
      {
        kind: 'completed',
        wallTimeMs: 42,
        result: fakeResult({ tests: [testResult({}), testResult({})] }),
      },
      0,
    );
    expect(summary).toMatchObject({
      verdict: 'accepted',
      passed: 2,
      failed: 0,
      total: 2,
      runtimeMs: 42,
    });
  });

  it('fails when a test fails, counting regressions', () => {
    const summary = summarizeOutcome(
      {
        kind: 'completed',
        wallTimeMs: 1,
        result: fakeResult({
          tests: [
            testResult({ status: 'failed' }),
            testResult({ stageIndex: 1, status: 'failed' }),
          ],
        }),
      },
      1,
    );
    expect(summary).toMatchObject({ verdict: 'failed', failed: 2, regressions: 1 });
  });

  it('does not accept a run with zero tests', () => {
    expect(
      summarizeOutcome({ kind: 'completed', wallTimeMs: 1, result: fakeResult() }, 0).verdict,
    ).toBe('failed');
  });

  it('reports compile and load errors with their message', () => {
    const summary = summarizeOutcome(
      {
        kind: 'completed',
        wallTimeMs: 1,
        result: fakeResult({
          status: 'compile_error',
          error: { type: 'SyntaxError', message: 'invalid syntax', line: 2, traceback: '' },
        }),
      },
      0,
    );
    expect(summary).toMatchObject({ verdict: 'compile_error', message: 'invalid syntax' });
  });

  it('explains timeouts and crashes', () => {
    expect(summarizeOutcome({ kind: 'timeout', timeoutMs: 5000 }, 0)).toMatchObject({
      verdict: 'timeout',
      message: 'Time limit exceeded (5s): possible infinite loop, or the solution is too slow.',
    });
    expect(summarizeOutcome({ kind: 'crashed', message: 'boom' }, 0)).toMatchObject({
      verdict: 'crashed',
      message: 'boom',
    });
  });
});
