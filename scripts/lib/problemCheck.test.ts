import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { collectJsonFiles, mapPool } from './files';
import { checkProblem, checkProblemFile, undeclaredPackages } from './problemCheck';
import { duplicateIdErrors, formatReport } from './report';
import type { CodeRunner, HarnessTestResult, RunOutcome, RunRequest } from '../../src/runner/types';
import { fakeResult } from '../../src/test/fakeWorker';
import { loadExample } from '../../src/test/fixtures';
import type { Problem } from '../../src/types/problem.generated';

type Script = (req: RunRequest) => RunOutcome;

/** A runner whose outcome is decided by a script, so every branch can be exercised. */
function scriptedRunner(script: Script): CodeRunner {
  return {
    getState: () => ({ status: 'ready', detail: null, error: null, pythonVersion: null }),
    subscribe: () => () => undefined,
    warmUp: () => Promise.resolve(),
    dispose: () => undefined,
    run: (req) => Promise.resolve(script(req)),
  };
}

const testResult = (name: string, stageIndex: number, status: HarnessTestResult['status']) =>
  ({
    name,
    stageIndex,
    status,
    message: status === 'passed' ? null : 'assert 1 == 2',
  }) as HarnessTestResult;

/** Behaves like real Python: a stage-k solution passes tests of stages <= k; starter fails all. */
function idealRunner(problem: Problem, wallTimeMs = 10): CodeRunner {
  return scriptedRunner((req) => {
    const k = problem.stages.findIndex((s) => s.solution.code === req.payload.code);
    const tests = req.payload.tests.map((t) =>
      testResult(t.name, t.stageIndex, k >= t.stageIndex ? 'passed' : 'failed'),
    );
    return { kind: 'completed', wallTimeMs, result: fakeResult({ tests }) };
  });
}

const sim = loadExample('inventory-reservations');
const standard = loadExample('merge-meeting-ranges');

describe('checkProblem', () => {
  it('passes a well-formed simulation and records notes', async () => {
    const report = await checkProblem(sim, idealRunner(sim));
    expect(report.errors).toEqual([]);
    expect(report.notes).toContain('stage 2: 6 new test(s) fail against the stage 1 solution');
  });

  it('rejects starter code that already passes', async () => {
    const problem = { ...standard, starterCode: standard.stages[0]!.solution.code };
    const report = await checkProblem(problem, idealRunner(problem));
    expect(report.errors).toContain(
      'starter code passes every stage 1 test; it must only contain signatures',
    );
  });

  it('rejects a solution that breaks an earlier stage', async () => {
    const runner = scriptedRunner((req) => ({
      kind: 'completed',
      wallTimeMs: 1,
      result: fakeResult({
        tests: req.payload.tests.map((t) =>
          testResult(
            t.name,
            t.stageIndex,
            req.payload.code === sim.stages[1]!.solution.code && t.stageIndex === 0
              ? 'failed'
              : 'passed',
          ),
        ),
      }),
    }));
    const report = await checkProblem(sim, runner);
    expect(report.errors).toContain(
      'stage 2 solution fails stage 1 test test_add_and_count (failed): assert 1 == 2',
    );
  });

  it('rejects a stage whose new tests all pass against the previous solution', async () => {
    const runner = scriptedRunner((req) => ({
      kind: 'completed',
      wallTimeMs: 1,
      result: fakeResult({
        tests: req.payload.tests.map((t) =>
          testResult(
            t.name,
            t.stageIndex,
            req.payload.code === sim.starterCode ? 'failed' : 'passed',
          ),
        ),
      }),
    }));
    const report = await checkProblem(sim, runner);
    expect(report.errors).toContain(
      'stage 2 adds no failing test against the stage 1 solution; the stage must add a requirement',
    );
  });

  it('reports timeouts, crashes, load errors and slow solutions', async () => {
    const solutions = sim.stages.map((s) => s.solution.code);
    const runner = scriptedRunner((req) => {
      const k = solutions.indexOf(req.payload.code);
      if (k === 0) return { kind: 'timeout', timeoutMs: 5000 };
      if (k === 1) return { kind: 'crashed', message: 'boom' };
      if (k === 2) {
        return {
          kind: 'completed',
          wallTimeMs: 1,
          result: fakeResult({
            status: 'load_error',
            error: {
              type: 'NameError',
              message: "name 'x' is not defined",
              line: 1,
              traceback: '',
            },
          }),
        };
      }
      const tests = req.payload.tests.map((t) =>
        testResult(t.name, t.stageIndex, k === 3 ? 'passed' : 'failed'),
      );
      return { kind: 'completed', wallTimeMs: 4000, result: fakeResult({ tests }) };
    });
    const report = await checkProblem(sim, runner);
    expect(report.errors).toEqual(
      expect.arrayContaining([
        'stage 1 solution: time limit exceeded (5s)',
        'stage 2 solution: runner crashed: boom',
        "stage 3 solution: load error: NameError: name 'x' is not defined",
      ]),
    );
    expect(report.warnings[0]).toMatch(/^stage 4 solution used 4000 ms of the 5000 ms limit/);
  });

  it('requires starter code to run', async () => {
    const runner = scriptedRunner((req) => {
      if (req.payload.code === standard.starterCode)
        return { kind: 'crashed', message: 'segfault' };
      const tests = req.payload.tests.map((t) => testResult(t.name, 0, 'passed'));
      return { kind: 'completed', wallTimeMs: 1, result: fakeResult({ tests }) };
    });
    const report = await checkProblem(standard, runner);
    expect(report.errors).toEqual([
      'starter code must run without errors: runner crashed: segfault',
    ]);
  });
});

describe('undeclaredPackages', () => {
  it('finds package imports that are not declared', () => {
    const stage = standard.stages[0]!;
    const problem: Problem = {
      ...standard,
      stages: [
        {
          ...stage,
          solution: {
            ...stage.solution,
            code: 'import pandas as pd\nfrom numpy import array\nimport json\n',
          },
        },
      ],
    };
    expect(undeclaredPackages(problem)).toEqual(['numpy', 'pandas']);
    expect(undeclaredPackages({ ...problem, packages: ['numpy', 'pandas'] })).toEqual([]);
  });
});

describe('checkProblemFile', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'elite-check-'));

  it('reports schema errors without executing anything', async () => {
    const file = path.join(dir, 'bad.json');
    writeFileSync(file, '{"schemaVersion": 1}');
    const report = await checkProblemFile(
      file,
      scriptedRunner(() => {
        throw new Error('must not run');
      }),
    );
    expect(report.id).toBeNull();
    expect(report.errors[0]).toMatch(/missing required property/);
  });

  it('warns or errors on a file name that does not match the id', async () => {
    const file = path.join(dir, 'renamed.json');
    writeFileSync(file, JSON.stringify(standard));
    const runner = idealRunner(standard);
    expect((await checkProblemFile(file, runner)).warnings).toContain(
      'file name should be "merge-meeting-ranges.json"',
    );
    expect(
      (await checkProblemFile(file, runner, { requireMatchingFileName: true })).errors,
    ).toContain('file name should be "merge-meeting-ranges.json"');
  });
});

describe('files and reports', () => {
  it('collects JSON files recursively, skipping fixtures', () => {
    const files = collectJsonFiles([path.resolve(import.meta.dirname, '../../schema')]);
    expect(files.map((f) => path.basename(f)).sort()).toEqual([
      'inventory-reservations.json',
      'merge-meeting-ranges.json',
      'problem.schema.json',
    ]);
  });

  it('maps with bounded concurrency and keeps order', async () => {
    let inFlight = 0;
    let peak = 0;
    const out = await mapPool([3, 1, 2, 5], 2, async (n) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      for (let i = 0; i < n; i++) await Promise.resolve();
      inFlight--;
      return n * 10;
    });
    expect(out).toEqual([30, 10, 20, 50]);
    expect(peak).toBe(2);
  });

  it('formats a report and finds duplicate ids', () => {
    const report = {
      file: '/x/a.json',
      id: 'a',
      errors: ['bad'],
      warnings: ['slow'],
      notes: ['note'],
    };
    expect(formatReport(report, '/x')).toBe(
      '✗ a a.json\n    error   bad\n    warning slow\n    note',
    );
    expect(formatReport({ ...report, id: null, errors: [], warnings: [], notes: [] }, '/x')).toBe(
      '✓ (invalid) a.json',
    );
    expect(
      duplicateIdErrors([report, { ...report, file: '/x/b.json' }, { ...report, id: null }]),
    ).toEqual(['id "a" is used by both /x/a.json and /x/b.json']);
  });
});
