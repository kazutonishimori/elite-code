/**
 * PyodideRunner with real Pyodide running in real worker threads: timeouts terminate the
 * worker and the runner recovers; packages load; back-to-back runs stay isolated.
 */
import type { Worker } from 'node:worker_threads';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { bundleWorker, nodeWorkerFactory } from './nodeWorker';
import { harnessSource, pyodideIndexURL } from '../../scripts/lib/nodePyodide';
import { buildRunRequest } from '../../src/core/testSelection';
import { PyodideRunner } from '../../src/runner/pyodideRunner';
import type { RunOutcome, RunRequest } from '../../src/runner/types';
import { loadExample } from '../../src/test/fixtures';

let runner: PyodideRunner;
const workers: Worker[] = [];

beforeAll(async () => {
  const file = await bundleWorker();
  runner = new PyodideRunner({
    createWorker: nodeWorkerFactory(file, workers),
    indexURL: pyodideIndexURL(),
    harnessSource: harnessSource(),
  });
  await runner.warmUp();
});

afterAll(() => runner.dispose());

const simple = (code: string, testBody: string, timeoutMs = 5000): RunRequest => ({
  payload: {
    code,
    mode: 'run',
    tests: [
      {
        name: 'test_it',
        code: `def test_it():\n    ${testBody}\n`,
        stageId: 's',
        stageIndex: 0,
        visibility: 'visible',
      },
    ],
  },
  packages: [],
  timeoutMs,
});

function completed(outcome: RunOutcome) {
  if (outcome.kind !== 'completed')
    throw new Error(`expected completed, got ${JSON.stringify(outcome)}`);
  return outcome.result;
}

describe('PyodideRunner (real Pyodide, real workers)', () => {
  it('is ready after warm-up and reports Python 3.14', () => {
    expect(runner.getState().status).toBe('ready');
    expect(runner.getState().pythonVersion).toMatch(/^3\.14\./);
  });

  it('runs every stage of the example simulation', async () => {
    const problem = loadExample('inventory-reservations');
    for (let k = 0; k < problem.stages.length; k++) {
      const result = completed(
        await runner.run(buildRunRequest(problem, k, 'submit', problem.stages[k]!.solution.code)),
      );
      expect(result.summary.failed + result.summary.errors).toBe(0);
    }
  });

  it('stops an infinite loop at the time limit and recovers on the next run', async () => {
    const before = workers.length;
    const outcome = await runner.run(
      simple('def spin():\n    while True:\n        pass\n', 'spin()', 1500),
    );
    expect(outcome).toEqual({ kind: 'timeout', timeoutMs: 1500 });
    // The timed-out worker is replaced (the spare is promoted and a new spare starts).
    await vi.waitFor(() => expect(workers.length).toBeGreaterThan(before), { timeout: 30_000 });

    const next = completed(await runner.run(simple('def f():\n    return 7\n', 'assert f() == 7')));
    expect(next.summary.passed).toBe(1);
  });

  it('runs back-to-back requests in order without leaking state', async () => {
    const outcomes = await Promise.all([
      runner.run(simple('state = [1]\n', 'assert state == [1]')),
      runner.run(simple('', "assert 'state' not in globals()")),
      runner.run(simple('print("third")\n', 'assert True')),
    ]);
    const results = outcomes.map(completed);
    expect(results.map((r) => r.summary.passed)).toEqual([1, 1, 1]);
    expect(results[2]!.stdout).toBe('third\n');
  });

  it('loads declared packages before running', async () => {
    const result = completed(
      await runner.run({
        ...simple(
          'import pandas as pd\nimport numpy as np\n',
          'assert int(pd.Series(np.arange(5)).sum()) == 10',
        ),
        packages: ['numpy', 'pandas'],
      }),
    );
    expect(result.tests[0]!.status).toBe('passed');
  });

  it('reports a missing package as an error result', async () => {
    const result = completed(await runner.run(simple('import sortedcontainers\n', 'assert True')));
    expect(result.status).toBe('load_error');
    expect(result.error?.type).toBe('ModuleNotFoundError');
  });
});
