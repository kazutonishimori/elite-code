/**
 * CodeRunner backed by Pyodide in a Web Worker.
 *
 * - Runs are queued and executed one at a time.
 * - The time limit starts when the worker reports `started` (after packages load), and is
 *   enforced by terminating the worker: Python can't be interrupted otherwise.
 * - A warm spare worker is kept ready so recovery after a timeout or crash is instant.
 */
import type { WorkerFactory, WorkerLike, WorkerResponse } from './protocol';
import type { CodeRunner, RunnerState, RunOutcome, RunRequest } from './types';

export interface PyodideRunnerOptions {
  createWorker: WorkerFactory;
  indexURL: string;
  harnessSource: string;
  /** Keep a second, initialized worker for instant recovery. Default true. */
  keepSpare?: boolean;
  /** Upper bound for loading packages before a run. Default 120 s. */
  packageLoadTimeoutMs?: number;
  now?: () => number;
}

type RunMessage = Exclude<WorkerResponse, { type: 'ready' } | { type: 'init-error' }>;

class WorkerSlot {
  readonly worker: WorkerLike;
  readonly ready: Promise<string>;
  /** Receives run messages and crashes while a run is in flight. */
  onRunMessage: ((message: RunMessage) => void) | null = null;
  onCrash: ((message: string) => void) | null = null;
  dead = false;
  private initialized = false;

  constructor(createWorker: WorkerFactory, indexURL: string, harnessSource: string) {
    this.worker = createWorker();
    let resolveReady!: (version: string) => void;
    let rejectReady!: (error: Error) => void;
    this.ready = new Promise<string>((resolve, reject) => {
      resolveReady = resolve;
      rejectReady = reject;
    });
    // Avoid unhandled-rejection noise for spares that fail before anyone awaits them.
    this.ready.catch(() => undefined);

    this.worker.onmessage = ({ data }) => {
      if (data.type === 'ready') {
        this.initialized = true;
        resolveReady(data.pythonVersion);
      } else if (data.type === 'init-error') {
        this.dead = true;
        rejectReady(new Error(data.message));
      } else {
        this.onRunMessage?.(data);
      }
    };
    this.worker.onerror = (event) => {
      const message = event.message ?? 'The Python worker crashed';
      this.dead = true;
      if (!this.initialized) rejectReady(new Error(message));
      this.onCrash?.(message);
    };
    this.worker.postMessage({ type: 'init', indexURL, harnessSource });
  }

  terminate(): void {
    this.dead = true;
    this.onRunMessage = null;
    this.onCrash = null;
    this.worker.terminate();
  }
}

export class PyodideRunner implements CodeRunner {
  private state: RunnerState = { status: 'idle', detail: null, error: null, pythonVersion: null };
  private readonly listeners = new Set<(state: RunnerState) => void>();
  private active: WorkerSlot | null = null;
  private spare: WorkerSlot | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private nextId = 0;
  private disposed = false;
  private readonly keepSpare: boolean;
  private readonly packageLoadTimeoutMs: number;
  private readonly now: () => number;
  private readonly options: PyodideRunnerOptions;

  constructor(options: PyodideRunnerOptions) {
    this.options = options;
    this.keepSpare = options.keepSpare ?? true;
    this.packageLoadTimeoutMs = options.packageLoadTimeoutMs ?? 120_000;
    this.now = options.now ?? (() => performance.now());
  }

  getState(): RunnerState {
    return this.state;
  }

  subscribe(listener: (state: RunnerState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setState(patch: Partial<RunnerState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l(this.state));
  }

  private spawn(): WorkerSlot {
    return new WorkerSlot(
      this.options.createWorker,
      this.options.indexURL,
      this.options.harnessSource,
    );
  }

  private ensureSpare(slot: WorkerSlot): void {
    if (!this.keepSpare) return;
    slot.ready.then(
      () => {
        if (!this.disposed && this.active === slot && !this.spare) this.spare = this.spawn();
      },
      () => undefined,
    );
  }

  /** Returns the active worker, waiting for it to initialize. */
  private async readySlot(): Promise<WorkerSlot> {
    if (this.active?.dead) this.replaceActive();
    const slot = (this.active ??= this.spawn());
    if (this.state.status === 'idle' || this.state.status === 'error') {
      this.setState({ status: 'loading', detail: 'Starting Python…', error: null });
    }
    try {
      const version = await slot.ready;
      if (this.state.status === 'loading') {
        this.setState({ status: 'ready', detail: null, pythonVersion: version });
      }
      this.ensureSpare(slot);
      return slot;
    } catch (err) {
      if (this.active === slot) this.active = null;
      slot.terminate();
      this.setState({ status: 'error', detail: null, error: (err as Error).message });
      throw err;
    }
  }

  /** Throws away the active worker and promotes the spare (or starts a fresh one). */
  private replaceActive(): void {
    this.active?.terminate();
    const promoted = this.spare && !this.spare.dead ? this.spare : null;
    if (!promoted) this.spare?.terminate();
    this.spare = null;
    this.active = promoted ?? this.spawn();
    this.ensureSpare(this.active);
  }

  async warmUp(): Promise<void> {
    if (this.disposed) return;
    await this.readySlot().catch(() => undefined);
  }

  run(request: RunRequest): Promise<RunOutcome> {
    const next = this.queue.then(() => this.execute(request));
    this.queue = next.catch(() => undefined);
    return next;
  }

  private async execute(request: RunRequest): Promise<RunOutcome> {
    if (this.disposed) return { kind: 'crashed', message: 'The runner has been disposed' };
    let slot: WorkerSlot;
    try {
      slot = await this.readySlot();
    } catch (err) {
      return { kind: 'crashed', message: `Python failed to load: ${(err as Error).message}` };
    }
    this.setState({ status: 'running', detail: 'Running…' });

    const outcome = await new Promise<{ outcome: RunOutcome; replace: boolean }>((resolve) => {
      const id = ++this.nextId;
      let startedAt = 0;
      let timer = setTimeout(
        () =>
          resolve({
            outcome: { kind: 'crashed', message: 'Timed out loading packages' },
            replace: true,
          }),
        this.packageLoadTimeoutMs,
      );
      const done = (result: { outcome: RunOutcome; replace: boolean }) => {
        clearTimeout(timer);
        resolve(result);
      };

      slot.onCrash = (message) => done({ outcome: { kind: 'crashed', message }, replace: true });
      slot.onRunMessage = (message) => {
        if (message.id !== id) return;
        switch (message.type) {
          case 'loading-packages':
            this.setState({ detail: `Loading ${message.packages.join(', ')}…` });
            break;
          case 'started':
            clearTimeout(timer);
            startedAt = this.now();
            this.setState({ detail: 'Running…' });
            timer = setTimeout(
              () =>
                resolve({
                  outcome: { kind: 'timeout', timeoutMs: request.timeoutMs },
                  replace: true,
                }),
              request.timeoutMs,
            );
            break;
          case 'result':
            done({
              outcome: {
                kind: 'completed',
                result: message.result,
                wallTimeMs: this.now() - startedAt,
              },
              replace: false,
            });
            break;
          case 'run-error':
            done({
              outcome: { kind: 'crashed', message: message.message },
              replace: message.fatal,
            });
            break;
        }
      };
      slot.worker.postMessage({
        type: 'run',
        id,
        payload: request.payload,
        packages: request.packages,
      });
    });

    slot.onRunMessage = null;
    slot.onCrash = null;
    if (outcome.replace && !this.disposed) {
      this.replaceActive();
      const fresh = this.active;
      this.setState({ status: 'loading', detail: 'Restarting Python…' });
      fresh?.ready.then(
        () => {
          if (this.active === fresh && this.state.status === 'loading') {
            this.setState({ status: 'ready', detail: null });
          }
        },
        (err: Error) => this.setState({ status: 'error', detail: null, error: err.message }),
      );
    } else if (!this.disposed) {
      this.setState({ status: 'ready', detail: null });
    }
    return outcome.outcome;
  }

  dispose(): void {
    this.disposed = true;
    this.active?.terminate();
    this.spare?.terminate();
    this.active = null;
    this.spare = null;
    this.setState({ status: 'idle', detail: null });
  }
}
