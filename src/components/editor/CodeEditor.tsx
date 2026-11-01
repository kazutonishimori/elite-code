import { lazy, Suspense } from 'react';

import { Spinner } from '@/components/States';
import type { Theme } from '@/storage/types';

/** Test hook so Playwright can set editor contents without fighting auto-indent. */
declare global {
  interface Window {
    __eliteEditor?: { getValue(): string; setValue(value: string): void };
  }
}

export interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  theme: Theme;
  readOnly?: boolean;
  /** Exposes window.__eliteEditor for end-to-end tests. */
  exposeForTests?: boolean;
  ariaLabel?: string;
}

export interface CodeDiffProps {
  original: string;
  modified: string;
  theme: Theme;
}

const LazyEditor = lazy(() => import('./MonacoEditors'));
const LazyDiff = lazy(() => import('./MonacoEditors').then((m) => ({ default: m.MonacoCodeDiff })));

const fallback = <Spinner className="p-4" label="Loading editor…" />;

export function CodeEditor(props: CodeEditorProps) {
  return (
    <Suspense fallback={fallback}>
      <LazyEditor {...props} />
    </Suspense>
  );
}

export function CodeDiff(props: CodeDiffProps) {
  return (
    <Suspense fallback={fallback}>
      <LazyDiff {...props} />
    </Suspense>
  );
}
