/** Node worker_threads entry that mirrors the browser worker, for runner integration tests. */
import { parentPort } from 'node:worker_threads';

import { loadPyodide } from 'pyodide';

import type { WorkerRequest } from '../../src/runner/protocol';
import { createWorkerHandler, type LoadPyodide } from '../../src/runner/worker/handler';

const port = parentPort;
if (!port) throw new Error('must run inside a worker thread');
const handle = createWorkerHandler(loadPyodide as unknown as LoadPyodide, (message) =>
  port.postMessage(message),
);
port.on('message', (message: WorkerRequest) => void handle(message));
