/** Serve Monaco from the local bundle (no CDN) with its editor worker. */
import { loader } from '@monaco-editor/react';
// eslint-disable-next-line import-x/default -- Vite's ?worker suffix provides the default export.
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker';

import * as monaco from './monacoSlim';

self.MonacoEnvironment = { getWorker: () => new EditorWorker() };
loader.config({ monaco });

export { monaco };
