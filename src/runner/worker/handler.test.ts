import { describe, expect, it, vi } from 'vitest';

import { fakeResult } from '@/test/fakeWorker';

import type { WorkerRequest, WorkerResponse } from '../protocol';
import { createWorkerHandler, HARNESS_DIR, HarnessHost, type PyodideLike } from './handler';

function fakePyodide(overrides: Partial<PyodideLike> = {}) {
  const files: Record<string, string> = {};
  const globals: Record<string, unknown> = {};
  const py: PyodideLike = {
    loadPackage: vi.fn(
      (_names: string[], options?: { messageCallback?: (msg: string) => void }) => {
        options?.messageCallback?.('Loading');
        return Promise.resolve();
      },
    ),
    runPython: vi.fn((code: string) => {
      if (code.includes('python_version')) return '3.14.2';
      if (code.includes('run_json'))
        return JSON.stringify(fakeResult({ stdout: String(globals.__elite_payload__) }));
      return undefined;
    }),
    globals: { set: (name, value) => (globals[name] = value) },
    FS: { mkdirTree: vi.fn(), writeFile: (path, data) => (files[path] = data) },
    ...overrides,
  };
  return { py, files };
}

const runRequest = (packages: string[] = []): WorkerRequest => ({
  type: 'run',
  id: 1,
  payload: { code: 'x', tests: [], mode: 'run' },
  packages,
});

describe('HarnessHost', () => {
  it('writes the harness into the virtual filesystem and imports it', () => {
    const { py, files } = fakePyodide();
    new HarnessHost(py, '# source');
    expect(files[`${HARNESS_DIR}/elite_harness.py`]).toBe('# source');
    expect(py.runPython).toHaveBeenCalledWith(expect.stringContaining('import elite_harness'));
  });

  it('loads each package only once', async () => {
    const { py } = fakePyodide();
    const host = new HarnessHost(py, '');
    await host.ensurePackages(['numpy']);
    await host.ensurePackages(['numpy']);
    await host.ensurePackages(['numpy', 'pandas']);
    expect(py.loadPackage).toHaveBeenCalledTimes(2);
    expect(vi.mocked(py.loadPackage).mock.calls[1]![0]).toEqual(['pandas']);
    expect(host.missingPackages(['numpy', 'pandas', 'sortedcontainers'])).toEqual([
      'sortedcontainers',
    ]);
  });

  it('passes the payload as JSON and parses the result', () => {
    const { py } = fakePyodide();
    const result = new HarnessHost(py, '').run({ code: 'x', tests: [], mode: 'run' });
    expect(JSON.parse(result.stdout)).toEqual({ code: 'x', tests: [], mode: 'run' });
  });
});

describe('createWorkerHandler', () => {
  async function init(py: PyodideLike) {
    const posted: WorkerResponse[] = [];
    const load = vi.fn(() => Promise.resolve(py));
    const handle = createWorkerHandler(load, (m) => posted.push(m));
    await handle({ type: 'init', indexURL: '/pyodide/', harnessSource: '' });
    return { handle, posted, load };
  }

  it('initializes Pyodide with a fixed hash seed and reports the version', async () => {
    const { py } = fakePyodide();
    const { posted, load } = await init(py);
    expect(load).toHaveBeenCalledWith({ indexURL: '/pyodide/', env: { PYTHONHASHSEED: '0' } });
    expect(posted).toEqual([{ type: 'ready', pythonVersion: '3.14.2' }]);
  });

  it('reports initialization failures', async () => {
    const posted: WorkerResponse[] = [];
    const handle = createWorkerHandler(
      () => Promise.reject(new Error('no wasm')),
      (m) => posted.push(m),
    );
    await handle({ type: 'init', indexURL: '/', harnessSource: '' });
    expect(posted).toEqual([{ type: 'init-error', message: 'no wasm' }]);
  });

  it('refuses to run before initialization', async () => {
    const posted: WorkerResponse[] = [];
    const handle = createWorkerHandler(
      () => Promise.reject(new Error('x')),
      (m) => posted.push(m),
    );
    await handle(runRequest());
    expect(posted).toEqual([
      { type: 'run-error', id: 1, message: 'Python runtime is not initialized', fatal: true },
    ]);
  });

  it('loads packages, announces the start, then posts the result', async () => {
    const { py } = fakePyodide();
    const { handle, posted } = await init(py);
    await handle(runRequest(['numpy']));
    expect(posted.slice(1).map((m) => m.type)).toEqual(['loading-packages', 'started', 'result']);
    await handle(runRequest(['numpy']));
    expect(posted.slice(4).map((m) => m.type)).toEqual(['started', 'result']);
  });

  it('reports package loading failures as non-fatal', async () => {
    const { py } = fakePyodide({ loadPackage: () => Promise.reject(new Error('404')) });
    const { handle, posted } = await init(py);
    await handle(runRequest(['pandas']));
    expect(posted.at(-1)).toEqual({
      type: 'run-error',
      id: 1,
      message: 'Failed to load packages: 404',
      fatal: false,
    });
  });

  it('classifies Pyodide fatal errors', async () => {
    const { py } = fakePyodide();
    const { handle, posted } = await init(py);
    vi.mocked(py.runPython).mockImplementation(() => {
      throw new Error('Pyodide has suffered a fatal error');
    });
    await handle(runRequest());
    expect(posted.at(-1)).toMatchObject({ type: 'run-error', fatal: true });
    vi.mocked(py.runPython).mockImplementation(() => {
      throw 'plain string failure';
    });
    await handle(runRequest());
    expect(posted.at(-1)).toEqual({
      type: 'run-error',
      id: 1,
      message: 'plain string failure',
      fatal: false,
    });
  });
});
