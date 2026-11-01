/**
 * Contract between the app and the Python harness (harness/elite_harness.py), plus the
 * runner abstraction the UI depends on. Nothing here knows about Pyodide or workers.
 */

export type TestVisibility = 'visible' | 'hidden';
export type RunMode = 'run' | 'submit' | 'custom';

export interface HarnessTest {
  name: string;
  code: string;
  stageId: string;
  stageIndex: number;
  visibility: TestVisibility;
}

export interface HarnessPayload {
  code: string;
  tests: HarnessTest[];
  mode: RunMode;
  customInput?: string;
}

export interface HarnessError {
  type: string;
  message: string;
  line: number | null;
  traceback: string;
}

export type TestStatus = 'passed' | 'failed' | 'error' | 'skipped';

export interface HarnessTestResult {
  name: string;
  stageId: string | null;
  stageIndex: number;
  visibility: TestVisibility;
  status: TestStatus;
  durationMs: number;
  stdout: string;
  stderr: string;
  message: string | null;
  errorType: string | null;
  expression: string | null;
  expected: string | null;
  actual: string | null;
  comparison: string | null;
  difference: string | null;
  traceback: string | null;
}

export interface HarnessCustomResult {
  stdout: string;
  stderr: string;
  value: string | null;
  error: HarnessError | null;
}

export interface HarnessSummary {
  total: number;
  passed: number;
  failed: number;
  errors: number;
  skipped: number;
}

export interface HarnessResult {
  harnessVersion: number;
  status: 'ok' | 'compile_error' | 'load_error';
  error: HarnessError | null;
  stdout: string;
  stderr: string;
  tests: HarnessTestResult[];
  custom: HarnessCustomResult | null;
  summary: HarnessSummary;
  durationMs: number;
}

export interface RunRequest {
  payload: HarnessPayload;
  packages: readonly string[];
  timeoutMs: number;
}

export type RunOutcome =
  | { kind: 'completed'; result: HarnessResult; wallTimeMs: number }
  | { kind: 'timeout'; timeoutMs: number }
  | { kind: 'crashed'; message: string };

export type RunnerStatus = 'idle' | 'loading' | 'ready' | 'running' | 'error';

export interface RunnerState {
  status: RunnerStatus;
  /** Set while loading or running, e.g. "Loading pandas…". */
  detail: string | null;
  error: string | null;
  pythonVersion: string | null;
}

/** Executes solver code against tests. Implementations: Pyodide in a worker, CPython in Node. */
export interface CodeRunner {
  getState(): RunnerState;
  subscribe(listener: (state: RunnerState) => void): () => void;
  /** Starts loading the runtime in the background. Safe to call repeatedly. */
  warmUp(): Promise<void>;
  /** Runs are queued and executed one at a time. */
  run(request: RunRequest): Promise<RunOutcome>;
  dispose(): void;
}
