/**
 * Worker-side logic, independent of the hosting environment: the browser worker entry
 * (pyodide.worker.ts), Node integration tests and the Pyodide CLI all drive this module.
 */
import type { WorkerRequest, WorkerResponse } from '../protocol';
import type { HarnessPayload, HarnessResult } from '../types';

/** The slice of the Pyodide API we use; keeps this module testable with a fake. */
export interface PyodideLike {
  loadPackage(
    names: string[],
    options?: { messageCallback?: (msg: string) => void },
  ): Promise<unknown>;
  runPython(code: string): unknown;
  globals: { set(name: string, value: unknown): void };
  FS: { mkdirTree(path: string): void; writeFile(path: string, data: string): void };
}

export type LoadPyodide = (options: {
  indexURL: string;
  env: Record<string, string>;
}) => Promise<PyodideLike>;

export const HARNESS_DIR = '/home/pyodide/elite';

/** Owns one Pyodide instance with the harness imported. */
export class HarnessHost {
  private readonly loaded = new Set<string>();
  private readonly py: PyodideLike;

  constructor(py: PyodideLike, harnessSource: string) {
    this.py = py;
    py.FS.mkdirTree(HARNESS_DIR);
    py.FS.writeFile(`${HARNESS_DIR}/elite_harness.py`, harnessSource);
    py.runPython(
      `import sys\nsys.path.insert(0, ${JSON.stringify(HARNESS_DIR)})\nimport elite_harness`,
    );
  }

  get pythonVersion(): string {
    return String(this.py.runPython('import platform; platform.python_version()'));
  }

  missingPackages(packages: readonly string[]): string[] {
    return packages.filter((p) => !this.loaded.has(p));
  }

  /** Loads the packages that aren't loaded yet. */
  async ensurePackages(packages: readonly string[]): Promise<void> {
    const missing = this.missingPackages(packages);
    if (missing.length === 0) return;
    await this.py.loadPackage(missing, { messageCallback: () => undefined });
    missing.forEach((p) => this.loaded.add(p));
  }

  run(payload: HarnessPayload): HarnessResult {
    this.py.globals.set('__elite_payload__', JSON.stringify(payload));
    const json = this.py.runPython('elite_harness.run_json(__elite_payload__)');
    return JSON.parse(String(json)) as HarnessResult;
  }
}

const FATAL_PATTERN = /fatal error|RuntimeError: memory access out of bounds|Maximum call stack/i;

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Builds the message handler for a worker. `post` sends a response to the main thread. */
export function createWorkerHandler(
  loadPyodide: LoadPyodide,
  post: (message: WorkerResponse) => void,
): (request: WorkerRequest) => Promise<void> {
  let host: HarnessHost | null = null;

  return async (request) => {
    if (request.type === 'init') {
      try {
        const py = await loadPyodide({ indexURL: request.indexURL, env: { PYTHONHASHSEED: '0' } });
        host = new HarnessHost(py, request.harnessSource);
        post({ type: 'ready', pythonVersion: host.pythonVersion });
      } catch (err) {
        post({ type: 'init-error', message: errorMessage(err) });
      }
      return;
    }

    const { id, payload, packages } = request;
    if (!host) {
      post({ type: 'run-error', id, message: 'Python runtime is not initialized', fatal: true });
      return;
    }
    try {
      const pending = host.missingPackages(packages);
      if (pending.length > 0) post({ type: 'loading-packages', id, packages: pending });
      await host.ensurePackages(packages);
    } catch (err) {
      post({
        type: 'run-error',
        id,
        message: `Failed to load packages: ${errorMessage(err)}`,
        fatal: false,
      });
      return;
    }
    post({ type: 'started', id });
    try {
      post({ type: 'result', id, result: host.run(payload) });
    } catch (err) {
      const message = errorMessage(err);
      post({ type: 'run-error', id, message, fatal: FATAL_PATTERN.test(message) });
    }
  };
}
