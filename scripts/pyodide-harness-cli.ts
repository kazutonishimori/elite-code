/**
 * Runs harness payloads in real Pyodide under Node, printing output in the same format as
 * `python harness/elite_harness.py`. Used by the CPython/Pyodide parity tests (pytest).
 * stdin:  {"payloads": HarnessPayload[], "packages"?: string[]}
 * stdout: RESULT_MARKER, then a JSON array of results (one per payload).
 */
import { readFileSync } from 'node:fs';

import { RESULT_MARKER } from './lib/cpythonRunner.ts';
import { createNodeHarnessHost } from './lib/nodePyodide.ts';
import type { HarnessPayload } from '../src/runner/types.ts';

const input = JSON.parse(readFileSync(0, 'utf8')) as {
  payloads: HarnessPayload[];
  packages?: string[];
};
const host = await createNodeHarnessHost();
await host.ensurePackages(input.packages ?? []);
const results = input.payloads.map((payload) => host.run(payload));
process.stdout.write(`\n${RESULT_MARKER}\n${JSON.stringify(results)}\n`);
