import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';

import './index.css';
import { App } from './App';
import { bundledProblems } from './problems/bundled';
import { createBrowserRunner } from './runner/browserRunner';
import { DexieStorage } from './storage/dexieStorage';
import { createAppStore } from './store/appStore';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

const storage = new DexieStorage();
const services = {
  storage,
  runner: createBrowserRunner(),
  now: () => Date.now(),
  store: createAppStore(storage, bundledProblems),
};

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <App services={services} />
    </BrowserRouter>
  </StrictMode>,
);
