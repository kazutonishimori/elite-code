import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { Worker } from 'node:worker_threads';

import { build } from 'esbuild';

import type {
  WorkerFactory,
  WorkerLike,
  WorkerRequest,
  WorkerResponse,
} from '../../src/runner/protocol';

const root = path.resolve(import.meta.dirname, '../..');

/** Bundles the worker entry next to node_modules so `pyodide` resolves at runtime. */
export async function bundleWorker(): Promise<string> {
  const outdir = path.join(root, 'node_modules', '.cache', 'elite-code');
  mkdirSync(outdir, { recursive: true });
  const outfile = path.join(outdir, 'integration-worker.mjs');
  await build({
    entryPoints: [path.join(import.meta.dirname, 'workerEntry.ts')],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    external: ['pyodide'],
    logLevel: 'silent',
  });
  return outfile;
}

/** Adapts worker_threads to the WorkerLike interface the runner expects. */
export function nodeWorkerFactory(file: string, created: Worker[] = []): WorkerFactory {
  return () => {
    const worker = new Worker(file);
    created.push(worker);
    const like: WorkerLike = {
      postMessage: (message: WorkerRequest) => worker.postMessage(message),
      terminate: () => void worker.terminate(),
      onmessage: null,
      onerror: null,
    };
    worker.on('message', (data: WorkerResponse) => like.onmessage?.({ data }));
    worker.on('error', (err) => like.onerror?.({ message: err.message }));
    return like;
  };
}
