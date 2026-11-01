/** Loads the real Pyodide runtime in Node, from the same local assets the browser uses. */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadPyodide } from 'pyodide';

import { HarnessHost, type PyodideLike } from '../../src/runner/worker/handler.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const harnessSource = () =>
  readFileSync(path.join(root, 'harness', 'elite_harness.py'), 'utf8');

/** public/pyodide (with package wheels) when present, else the npm package (core only). */
export function pyodideIndexURL(): string {
  const local = path.join(root, 'public', 'pyodide');
  const dir = existsSync(path.join(local, 'pyodide.asm.wasm'))
    ? local
    : path.join(root, 'node_modules', 'pyodide');
  return `${dir}${path.sep}`;
}

export async function loadNodePyodide(): Promise<PyodideLike> {
  return (await loadPyodide({
    indexURL: pyodideIndexURL(),
    env: { PYTHONHASHSEED: '0' },
  })) as unknown as PyodideLike;
}

export async function createNodeHarnessHost(): Promise<HarnessHost> {
  return new HarnessHost(await loadNodePyodide(), harnessSource());
}
