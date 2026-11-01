import type { HarnessPayload, HarnessResult } from './types';

/** Messages from the main thread to the Pyodide worker. */
export type WorkerRequest =
  | { type: 'init'; indexURL: string; harnessSource: string }
  | { type: 'run'; id: number; payload: HarnessPayload; packages: readonly string[] };

/** Messages from the Pyodide worker to the main thread. */
export type WorkerResponse =
  | { type: 'ready'; pythonVersion: string }
  | { type: 'init-error'; message: string }
  | { type: 'loading-packages'; id: number; packages: string[] }
  /** Packages are loaded and the harness is about to execute: the time limit starts now. */
  | { type: 'started'; id: number }
  | { type: 'result'; id: number; result: HarnessResult }
  | { type: 'run-error'; id: number; message: string; fatal: boolean };

/** The subset of the DOM Worker API the runner needs (also implemented by Node test adapters). */
export interface WorkerLike {
  postMessage(message: WorkerRequest): void;
  terminate(): void;
  onmessage: ((event: { data: WorkerResponse }) => void) | null;
  onerror: ((event: { message?: string }) => void) | null;
}

export type WorkerFactory = () => WorkerLike;
