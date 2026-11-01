import type {
  CodeRunner,
  HarnessTestResult,
  RunnerState,
  RunOutcome,
  RunRequest,
} from '@/runner/types';

import { fakeResult } from './fakeWorker';

type Handler = (request: RunRequest) => RunOutcome | Promise<RunOutcome>;

/** A CodeRunner for component tests: outcomes come from a handler, requests are recorded. */
export class FakeRunner implements CodeRunner {
  readonly requests: RunRequest[] = [];
  private state: RunnerState = {
    status: 'ready',
    detail: null,
    error: null,
    pythonVersion: '3.14.2',
  };
  private readonly listeners = new Set<(state: RunnerState) => void>();
  handler: Handler;

  constructor(handler: Handler = passAll) {
    this.handler = handler;
  }

  getState() {
    return this.state;
  }

  setState(patch: Partial<RunnerState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l(this.state));
  }

  subscribe(listener: (state: RunnerState) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  warmUp = () => Promise.resolve();

  async run(request: RunRequest) {
    this.requests.push(request);
    return this.handler(request);
  }

  dispose() {}
}

export function testResult(
  overrides: Partial<HarnessTestResult> & { name: string },
): HarnessTestResult {
  return {
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

/** Every requested test passes. */
export function passAll(request: RunRequest): RunOutcome {
  return {
    kind: 'completed',
    wallTimeMs: 12,
    result: fakeResult({
      tests: request.payload.tests.map((t) =>
        testResult({
          name: t.name,
          stageId: t.stageId,
          stageIndex: t.stageIndex,
          visibility: t.visibility,
        }),
      ),
      summary: {
        total: request.payload.tests.length,
        passed: request.payload.tests.length,
        failed: 0,
        errors: 0,
        skipped: 0,
      },
    }),
  };
}

/** Tests matching `failing` fail with an assertion; others pass. */
export function failWhere(failing: (name: string, stageIndex: number) => boolean) {
  return (request: RunRequest): RunOutcome => ({
    kind: 'completed',
    wallTimeMs: 12,
    result: fakeResult({
      tests: request.payload.tests.map((t) =>
        failing(t.name, t.stageIndex)
          ? testResult({
              name: t.name,
              stageId: t.stageId,
              stageIndex: t.stageIndex,
              visibility: t.visibility,
              status: 'failed',
              message: 'assert f() == 2',
              errorType: 'AssertionError',
              expression: 'f() == 2',
              expected: '2',
              actual: '3',
              comparison: '==',
            })
          : testResult({
              name: t.name,
              stageId: t.stageId,
              stageIndex: t.stageIndex,
              visibility: t.visibility,
            }),
      ),
    }),
  });
}
