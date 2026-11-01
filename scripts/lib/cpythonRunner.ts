/**
 * CodeRunner that executes the shared harness with native CPython in a subprocess.
 * Used by `problem:validate`; the time limit is enforced by killing the process.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  CodeRunner,
  HarnessResult,
  RunnerState,
  RunOutcome,
  RunRequest,
} from '../../src/runner/types.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const HARNESS_PATH = path.join(root, 'harness', 'elite_harness.py');
export const RESULT_MARKER = '@@ELITE_CODE_RESULT@@';

/** ELITE_CODE_PYTHON, else the uv-managed .venv, else python3 on PATH. */
export function resolvePython(env: NodeJS.ProcessEnv = process.env, cwd = root): string {
  if (env.ELITE_CODE_PYTHON) return env.ELITE_CODE_PYTHON;
  const venv = path.join(cwd, '.venv', 'bin', 'python');
  return existsSync(venv) ? venv : 'python3';
}

export function parseHarnessOutput(stdout: string): HarnessResult | null {
  const index = stdout.lastIndexOf(`\n${RESULT_MARKER}\n`);
  if (index === -1) return null;
  return JSON.parse(stdout.slice(index + RESULT_MARKER.length + 2)) as HarnessResult;
}

export class CPythonRunner implements CodeRunner {
  private readonly python: string;
  private readonly state: RunnerState = {
    status: 'ready',
    detail: null,
    error: null,
    pythonVersion: null,
  };

  constructor(options: { python?: string; harnessPath?: string } = {}) {
    this.python = options.python ?? resolvePython();
    this.harnessPath = options.harnessPath ?? HARNESS_PATH;
  }

  private readonly harnessPath: string;

  getState(): RunnerState {
    return this.state;
  }

  subscribe(): () => void {
    return () => undefined;
  }

  warmUp(): Promise<void> {
    return Promise.resolve();
  }

  dispose(): void {}

  run(request: RunRequest): Promise<RunOutcome> {
    return new Promise((resolve) => {
      const started = performance.now();
      const child = spawn(this.python, [this.harnessPath], {
        env: {
          ...process.env,
          PYTHONHASHSEED: '0',
          PYTHONIOENCODING: 'utf-8',
          PYTHONDONTWRITEBYTECODE: '1',
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, request.timeoutMs);

      child.stdout.setEncoding('utf8').on('data', (chunk: string) => (stdout += chunk));
      child.stderr.setEncoding('utf8').on('data', (chunk: string) => (stderr += chunk));
      child.on('error', (err) => {
        clearTimeout(timer);
        resolve({ kind: 'crashed', message: `Could not start ${this.python}: ${err.message}` });
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (timedOut) return resolve({ kind: 'timeout', timeoutMs: request.timeoutMs });
        const result = parseHarnessOutput(stdout);
        if (!result) {
          return resolve({
            kind: 'crashed',
            message:
              `Python exited with code ${String(code)} without a result. ${stderr.trim().slice(-2000)}`.trim(),
          });
        }
        resolve({ kind: 'completed', result, wallTimeMs: performance.now() - started });
      });
      child.stdin.on('error', () => undefined);
      child.stdin.end(JSON.stringify(request.payload));
    });
  }
}
