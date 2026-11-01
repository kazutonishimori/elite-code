import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fakeResult, fakeWorkerFactory, flush } from '@/test/fakeWorker';

import { PyodideRunner } from './pyodideRunner';
import type { RunRequest } from './types';

const request: RunRequest = {
  payload: { code: 'x = 1', tests: [], mode: 'run' },
  packages: [],
  timeoutMs: 5000,
};

function setup(options: { keepSpare?: boolean; autoReady?: boolean | 'fail' } = {}) {
  const fake = fakeWorkerFactory(options.autoReady ?? true);
  let clock = 0;
  const runner = new PyodideRunner({
    createWorker: fake.factory,
    indexURL: '/pyodide/',
    harnessSource: '# harness',
    keepSpare: options.keepSpare ?? true,
    packageLoadTimeoutMs: 30_000,
    now: () => clock,
  });
  return { runner, fake, tick: (ms: number) => (clock += ms) };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('PyodideRunner', () => {
  it('warms up, reports the Python version and starts a spare worker', async () => {
    const { runner, fake } = setup();
    const states: string[] = [];
    runner.subscribe((s) => states.push(s.status));
    await runner.warmUp();
    await flush();
    expect(runner.getState()).toMatchObject({ status: 'ready', pythonVersion: '3.14.2' });
    expect(states).toEqual(['loading', 'ready']);
    expect(fake.workers).toHaveLength(2);
    expect(fake.workers[0]!.received[0]).toEqual({
      type: 'init',
      indexURL: '/pyodide/',
      harnessSource: '# harness',
    });
  });

  it('completes a run and measures wall time from the started message', async () => {
    const { runner, fake, tick } = setup();
    const pending = runner.run(request);
    await flush();
    const worker = fake.workers[0]!;
    const id = worker.lastRunId();
    expect(runner.getState().status).toBe('running');
    tick(400); // package loading does not count
    worker.emit({ type: 'started', id });
    tick(120);
    worker.emit({ type: 'result', id, result: fakeResult() });
    await expect(pending).resolves.toEqual({
      kind: 'completed',
      result: fakeResult(),
      wallTimeMs: 120,
    });
    expect(runner.getState().status).toBe('ready');
  });

  it('terminates the worker on timeout and promotes the warm spare', async () => {
    const { runner, fake } = setup();
    await runner.warmUp();
    await flush();
    const [first, spare] = fake.workers;
    const pending = runner.run(request);
    await flush();
    first!.emit({ type: 'started', id: first!.lastRunId() });
    vi.advanceTimersByTime(4999);
    await flush();
    expect(first!.terminated).toBe(false);
    vi.advanceTimersByTime(1);
    await expect(pending).resolves.toEqual({ kind: 'timeout', timeoutMs: 5000 });
    expect(first!.terminated).toBe(true);
    await flush();
    expect(runner.getState().status).toBe('ready');
    expect(fake.workers).toHaveLength(3); // a new spare replaces the promoted one

    const second = runner.run(request);
    await flush();
    expect(spare!.runs).toHaveLength(1);
    spare!.emit({ type: 'started', id: spare!.lastRunId() });
    spare!.emit({ type: 'result', id: spare!.lastRunId(), result: fakeResult() });
    await expect(second).resolves.toMatchObject({ kind: 'completed' });
  });

  it('starts a fresh worker after a timeout when no spare is kept', async () => {
    const { runner, fake } = setup({ keepSpare: false });
    const details: (string | null)[] = [];
    runner.subscribe((s) => details.push(s.detail));
    const pending = runner.run(request);
    await flush();
    const first = fake.workers[0]!;
    first.emit({ type: 'started', id: first.lastRunId() });
    vi.advanceTimersByTime(5000);
    await expect(pending).resolves.toMatchObject({ kind: 'timeout' });
    expect(details).toContain('Restarting Python…');
    await flush();
    expect(fake.workers).toHaveLength(2);
    expect(runner.getState().status).toBe('ready');
  });

  it('reports package loading progress and bounds package load time', async () => {
    const { runner, fake } = setup();
    const pending = runner.run({ ...request, packages: ['pandas'] });
    await flush();
    const worker = fake.workers[0]!;
    expect(worker.runs[0]!.packages).toEqual(['pandas']);
    worker.emit({ type: 'loading-packages', id: worker.lastRunId(), packages: ['pandas'] });
    expect(runner.getState().detail).toBe('Loading pandas…');
    vi.advanceTimersByTime(30_000);
    await expect(pending).resolves.toEqual({
      kind: 'crashed',
      message: 'Timed out loading packages',
    });
    expect(worker.terminated).toBe(true);
  });

  it('executes back-to-back runs one at a time, in order', async () => {
    const { runner, fake } = setup({ keepSpare: false });
    const a = runner.run({ ...request, payload: { ...request.payload, code: 'a' } });
    const b = runner.run({ ...request, payload: { ...request.payload, code: 'b' } });
    await flush();
    const worker = fake.workers[0]!;
    expect(worker.runs.map((r) => r.payload.code)).toEqual(['a']);
    worker.emit({ type: 'started', id: worker.lastRunId() });
    worker.emit({ type: 'result', id: worker.lastRunId(), result: fakeResult({ stdout: 'A' }) });
    await expect(a).resolves.toMatchObject({ result: { stdout: 'A' } });
    await flush();
    expect(worker.runs.map((r) => r.payload.code)).toEqual(['a', 'b']);
    worker.emit({ type: 'started', id: worker.lastRunId() });
    worker.emit({ type: 'result', id: worker.lastRunId(), result: fakeResult({ stdout: 'B' }) });
    await expect(b).resolves.toMatchObject({ result: { stdout: 'B' } });
  });

  it('ignores messages for other run ids', async () => {
    const { runner, fake } = setup();
    const pending = runner.run(request);
    await flush();
    const worker = fake.workers[0]!;
    const id = worker.lastRunId();
    worker.emit({ type: 'result', id: id + 99, result: fakeResult({ stdout: 'stale' }) });
    worker.emit({ type: 'started', id });
    worker.emit({ type: 'result', id, result: fakeResult({ stdout: 'fresh' }) });
    await expect(pending).resolves.toMatchObject({ result: { stdout: 'fresh' } });
  });

  it('keeps the worker after a non-fatal error and replaces it after a fatal one', async () => {
    const { runner, fake } = setup({ keepSpare: false });
    const first = runner.run(request);
    await flush();
    const worker = fake.workers[0]!;
    worker.emit({
      type: 'run-error',
      id: worker.lastRunId(),
      message: 'bad package',
      fatal: false,
    });
    await expect(first).resolves.toEqual({ kind: 'crashed', message: 'bad package' });
    expect(worker.terminated).toBe(false);

    const second = runner.run(request);
    await flush();
    worker.emit({ type: 'run-error', id: worker.lastRunId(), message: 'fatal error', fatal: true });
    await expect(second).resolves.toMatchObject({ kind: 'crashed' });
    expect(worker.terminated).toBe(true);
    expect(fake.workers).toHaveLength(2);
  });

  it('treats a worker crash during a run as a crash and recovers', async () => {
    const { runner, fake } = setup({ keepSpare: false });
    const pending = runner.run(request);
    await flush();
    fake.workers[0]!.crash('RangeError: Maximum call stack size exceeded');
    await expect(pending).resolves.toEqual({
      kind: 'crashed',
      message: 'RangeError: Maximum call stack size exceeded',
    });
    expect(fake.workers).toHaveLength(2);
  });

  it('replaces a worker that died while idle before the next run', async () => {
    const { runner, fake } = setup({ keepSpare: false });
    await runner.warmUp();
    fake.workers[0]!.crash();
    const pending = runner.run(request);
    await flush();
    expect(fake.workers[0]!.terminated).toBe(true);
    const fresh = fake.workers[1]!;
    fresh.emit({ type: 'started', id: fresh.lastRunId() });
    fresh.emit({ type: 'result', id: fresh.lastRunId(), result: fakeResult() });
    await expect(pending).resolves.toMatchObject({ kind: 'completed' });
  });

  it('surfaces initialization failures and retries on the next run', async () => {
    const { runner, fake } = setup({ autoReady: 'fail', keepSpare: false });
    await expect(runner.run(request)).resolves.toEqual({
      kind: 'crashed',
      message: 'Python failed to load: wasm failed',
    });
    expect(runner.getState()).toMatchObject({ status: 'error', error: 'wasm failed' });
    fake.queueBehavior(true);
    const retry = runner.run(request);
    await flush();
    const worker = fake.workers[1]!;
    expect(runner.getState().status).toBe('running');
    worker.emit({ type: 'started', id: worker.lastRunId() });
    worker.emit({ type: 'result', id: worker.lastRunId(), result: fakeResult() });
    await expect(retry).resolves.toMatchObject({ kind: 'completed' });
  });

  it('rejects a crash before initialization', async () => {
    const { runner, fake } = setup({ autoReady: false, keepSpare: false });
    const pending = runner.run(request);
    await flush();
    fake.workers[0]!.crash();
    await expect(pending).resolves.toEqual({
      kind: 'crashed',
      message: 'Python failed to load: The Python worker crashed',
    });
  });

  it('reports a restart failure after a timeout', async () => {
    const { runner, fake } = setup({ keepSpare: false });
    const pending = runner.run(request);
    await flush();
    fake.queueBehavior('fail');
    fake.workers[0]!.emit({ type: 'started', id: fake.workers[0]!.lastRunId() });
    vi.advanceTimersByTime(5000);
    await pending;
    await flush();
    expect(runner.getState()).toMatchObject({ status: 'error', error: 'wasm failed' });
  });

  it('disposes every worker and refuses further runs', async () => {
    const { runner, fake } = setup();
    await runner.warmUp();
    await flush();
    runner.dispose();
    expect(fake.workers.every((w) => w.terminated)).toBe(true);
    await expect(runner.run(request)).resolves.toEqual({
      kind: 'crashed',
      message: 'The runner has been disposed',
    });
    await runner.warmUp();
    expect(fake.workers).toHaveLength(2);
  });

  it('stops notifying unsubscribed listeners', async () => {
    const { runner } = setup();
    const listener = vi.fn();
    const unsubscribe = runner.subscribe(listener);
    unsubscribe();
    await runner.warmUp();
    expect(listener).not.toHaveBeenCalled();
  });

  it('uses performance.now by default and tolerates a spare that fails to start', async () => {
    const fake = fakeWorkerFactory();
    fake.queueBehavior(true);
    fake.queueBehavior('fail');
    const runner = new PyodideRunner({
      createWorker: fake.factory,
      indexURL: '/',
      harnessSource: '',
    });
    const pending = runner.run(request);
    await flush();
    const worker = fake.workers[0]!;
    worker.emit({ type: 'started', id: worker.lastRunId() });
    worker.emit({ type: 'result', id: worker.lastRunId(), result: fakeResult() });
    const outcome = await pending;
    expect(outcome.kind === 'completed' && typeof outcome.wallTimeMs).toBe('number');
    await flush();
    expect(runner.getState().status).toBe('ready');
  });

  it('resolves warmUp even when Python cannot start', async () => {
    const { runner } = setup({ autoReady: 'fail' });
    await expect(runner.warmUp()).resolves.toBeUndefined();
    expect(runner.getState().status).toBe('error');
  });
});
