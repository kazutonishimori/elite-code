/** Monaco-backed editors. Loaded lazily (see CodeEditor.tsx) so Monaco gets its own chunk. */
import Editor, { DiffEditor, type OnMount } from '@monaco-editor/react';
import { useEffect, useRef } from 'react';

import { Spinner } from '@/components/States';
import '@/lib/monaco';
import type { Theme } from '@/storage/types';

import type { CodeDiffProps, CodeEditorProps } from './CodeEditor';

const OPTIONS = {
  minimap: { enabled: false },
  fontSize: 14,
  fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 4,
  insertSpaces: true,
  renderWhitespace: 'selection',
  padding: { top: 12 },
} as const;

const monacoTheme = (theme: Theme) => (theme === 'dark' ? 'vs-dark' : 'vs');

export default function MonacoCodeEditor({
  value,
  onChange,
  theme,
  readOnly = false,
  exposeForTests = false,
  ariaLabel = 'Code editor',
}: CodeEditorProps) {
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const handleMount: OnMount = (editor) => {
    if (!exposeForTests) return;
    window.__eliteEditor = {
      getValue: () => editor.getValue(),
      setValue: (next) => editor.setValue(next),
    };
  };

  useEffect(() => {
    if (!exposeForTests) return;
    return () => {
      delete window.__eliteEditor;
    };
  }, [exposeForTests]);

  return (
    <Editor
      language="python"
      value={value}
      theme={monacoTheme(theme)}
      onChange={(next) => onChangeRef.current?.(next ?? '')}
      onMount={handleMount}
      loading={<Spinner label="Loading editor…" />}
      options={{ ...OPTIONS, readOnly, ariaLabel }}
    />
  );
}

export function MonacoCodeDiff({ original, modified, theme }: CodeDiffProps) {
  return (
    <DiffEditor
      language="python"
      original={original}
      modified={modified}
      theme={monacoTheme(theme)}
      loading={<Spinner label="Loading diff…" />}
      options={{ ...OPTIONS, readOnly: true, renderSideBySide: true, originalEditable: false }}
    />
  );
}
