import type { WorkerLike, WorkerRequest, WorkerResponse } from '@/runner/protocol';
import type { HarnessResult } from '@/runner/types';

/** A scriptable stand-in for the Pyodide worker. */
export class FakeWorker implements WorkerLike {
  onmessage: ((event: { data: WorkerResponse }) => void) | null = null;
  onerror: ((event: { message?: string }) => void) | null = null;
  readonly received: WorkerRequest[] = [];
  terminated = false;

  private readonly autoReady: boolean | 'fail';

  constructor(autoReady: boolean | 'fail') {
    this.autoReady = autoReady;
  }

  postMessage(message: WorkerRequest): void {
    this.received.push(message);
    if (message.type === 'init' && this.autoReady) {
      queueMicrotask(() =>
        this.emit(
          this.autoReady === 'fail'
            ? { type: 'init-error', message: 'wasm failed' }
            : { type: 'ready', pythonVersion: '3.14.2' },
        ),
      );
    }
  }

  terminate(): void {
    this.terminated = true;
  }

  emit(data: WorkerResponse): void {
    if (!this.terminated) this.onmessage?.({ data });
  }

  crash(message?: string): void {
    this.onerror?.(message === undefined ? {} : { message });
  }

  get runs(): Extract<WorkerRequest, { type: 'run' }>[] {
    return this.received.filter(
      (m): m is Extract<WorkerRequest, { type: 'run' }> => m.type === 'run',
    );
  }

  lastRunId(): number {
    const run = this.runs.at(-1);
    if (!run) throw new Error('no run received');
    return run.id;
  }
}

export function fakeResult(overrides: Partial<HarnessResult> = {}): HarnessResult {
  return {
    harnessVersion: 1,
    status: 'ok',
    error: null,
    stdout: '',
    stderr: '',
    tests: [],
    custom: null,
    summary: { total: 0, passed: 0, failed: 0, errors: 0, skipped: 0 },
    durationMs: 1,
    ...overrides,
  };
}

export function fakeWorkerFactory(autoReady: boolean | 'fail' = true) {
  const workers: FakeWorker[] = [];
  const behaviors: (boolean | 'fail')[] = [];
  const factory = () => {
    const worker = new FakeWorker(behaviors.shift() ?? autoReady);
    workers.push(worker);
    return worker;
  };
  return { factory, workers, queueBehavior: (b: boolean | 'fail') => behaviors.push(b) };
}

/** Flush pending microtasks (promise callbacks) without advancing fake timers. */
export async function flush(times = 5): Promise<void> {
  for (let i = 0; i < times; i++) await Promise.resolve();
}
