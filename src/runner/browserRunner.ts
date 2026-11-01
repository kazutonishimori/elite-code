/** Wires PyodideRunner to the real browser worker and the bundled harness source. */
import type { WorkerLike } from './protocol';
import { PyodideRunner } from './pyodideRunner';
import harnessSource from '../../harness/elite_harness.py?raw';

export function createBrowserRunner(): PyodideRunner {
  return new PyodideRunner({
    createWorker: () =>
      new Worker(new URL('./worker/pyodide.worker.ts', import.meta.url), {
        type: 'module',
      }) as unknown as WorkerLike,
    indexURL: new URL(`${import.meta.env.BASE_URL}pyodide/`, window.location.origin).href,
    harnessSource,
  });
}
