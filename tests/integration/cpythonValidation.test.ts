/** The CPython runner and `problem:validate` checks against real Python. */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { CPythonRunner, parseHarnessOutput, resolvePython } from '../../scripts/lib/cpythonRunner';
import { checkProblem, checkProblemFile } from '../../scripts/lib/problemCheck';
import { loadExample } from '../../src/test/fixtures';
import type { Problem } from '../../src/types/problem.generated';

const runner = new CPythonRunner();
const sim = loadExample('inventory-reservations');
const standard = loadExample('merge-meeting-ranges');

describe('CPythonRunner', () => {
  it('runs the harness and returns structured results', async () => {
    const outcome = await runner.run({
      payload: { code: 'print("héllo")\n', tests: [], mode: 'run' },
      packages: [],
      timeoutMs: 10_000,
    });
    expect(outcome.kind).toBe('completed');
    if (outcome.kind === 'completed') expect(outcome.result.stdout).toBe('héllo\n');
  });

  it('kills runaway code at the time limit', async () => {
    const outcome = await runner.run({
      payload: {
        code: '',
        mode: 'run',
        tests: [
          {
            name: 'test_loop',
            code: 'def test_loop():\n    while True:\n        pass\n',
            stageId: 's',
            stageIndex: 0,
            visibility: 'visible',
          },
        ],
      },
      packages: [],
      timeoutMs: 1000,
    });
    expect(outcome).toEqual({ kind: 'timeout', timeoutMs: 1000 });
  });

  it('reports a missing interpreter and a crashed process', async () => {
    const missing = await new CPythonRunner({ python: '/nonexistent/python' }).run({
      payload: { code: '', tests: [], mode: 'run' },
      packages: [],
      timeoutMs: 5000,
    });
    expect(missing).toMatchObject({
      kind: 'crashed',
      message: expect.stringContaining('Could not start'),
    });

    const dir = mkdtempSync(path.join(tmpdir(), 'elite-harness-'));
    const broken = path.join(dir, 'broken.py');
    writeFileSync(broken, 'import sys\nsys.stderr.write("kaput")\nsys.exit(4)\n');
    const crashed = await new CPythonRunner({ harnessPath: broken }).run({
      payload: { code: '', tests: [], mode: 'run' },
      packages: [],
      timeoutMs: 5000,
    });
    expect(crashed).toEqual({
      kind: 'crashed',
      message: 'Python exited with code 4 without a result. kaput',
    });
  });

  it('implements the CodeRunner surface trivially', async () => {
    expect(runner.getState().status).toBe('ready');
    runner.subscribe()();
    await runner.warmUp();
    runner.dispose();
  });

  it('resolves the interpreter from the environment, the venv, or PATH', () => {
    expect(resolvePython({ ELITE_CODE_PYTHON: '/opt/py' })).toBe('/opt/py');
    expect(resolvePython({}, '/nowhere')).toBe('python3');
    expect(parseHarnessOutput('no marker')).toBeNull();
  });
});

describe('problem checks with real Python', () => {
  it('accepts both guide examples', async () => {
    for (const problem of [standard, sim]) {
      const report = await checkProblem(problem, runner);
      expect(report.errors).toEqual([]);
    }
  });

  it('catches a non-cumulative solution (regression in an earlier stage)', async () => {
    const stages = structuredClone(sim.stages);
    // Stage 2's solution forgets stage 1's validation of qty.
    stages[1]!.solution.code = stages[1]!.solution.code.replace(
      'def add(self, sku: str, qty: int) -> None:\n        if qty <= 0:\n            raise ValueError("qty must be positive")\n',
      'def add(self, sku: str, qty: int) -> None:\n',
    );
    const report = await checkProblem({ ...sim, stages } as Problem, runner);
    expect(report.errors).toContainEqual(
      expect.stringMatching(/^stage 2 solution fails stage 1 test test_invalid_qty_raises/),
    );
  });

  it('catches a stage that adds nothing new', async () => {
    const stages = structuredClone(sim.stages);
    stages[1] = {
      ...stages[1]!,
      visibleTests: stages[0]!.visibleTests.map((t) => ({
        ...t,
        name: `${t.name}_again`,
        code: t.code.replace(t.name, `${t.name}_again`),
      })),
      hiddenTests: [stages[0]!.hiddenTests[0]!].map((t) => ({
        ...t,
        name: `${t.name}_again`,
        code: t.code.replace(t.name, `${t.name}_again`),
      })),
    } as never;
    const report = await checkProblem({ ...sim, stages } as Problem, runner);
    expect(report.errors).toContain(
      'stage 2 adds no failing test against the stage 1 solution; the stage must add a requirement',
    );
  });

  it('validates a file end to end', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'elite-file-'));
    const file = path.join(dir, 'merge-meeting-ranges.json');
    writeFileSync(file, JSON.stringify(standard));
    const report = await checkProblemFile(file, runner, { requireMatchingFileName: true });
    expect(report).toMatchObject({ id: 'merge-meeting-ranges', errors: [], warnings: [] });
  });
});
