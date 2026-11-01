/// <reference lib="webworker" />
/**
 * Browser worker entry. Loads Pyodide from the app's own /pyodide/ folder (no CDN) and
 * delegates everything to the environment-independent handler.
 */
import type { WorkerRequest, WorkerResponse } from '../protocol';
import { createWorkerHandler, type LoadPyodide } from './handler';

declare const self: DedicatedWorkerGlobalScope;

const loadPyodide: LoadPyodide = async (options) => {
  const url = `${options.indexURL}pyodide.mjs`;
  const mod = (await import(/* @vite-ignore */ url)) as { loadPyodide: LoadPyodide };
  return mod.loadPyodide(options);
};

const handle = createWorkerHandler(loadPyodide, (message: WorkerResponse) =>
  self.postMessage(message),
);

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  void handle(event.data);
};
