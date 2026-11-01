import type { CodeDiffProps, CodeEditorProps } from '@/components/editor/CodeEditor';

/** jsdom can't run Monaco; tests get a plain textarea with the same props. */
export function CodeEditor({
  value,
  onChange,
  readOnly,
  ariaLabel = 'Code editor',
}: CodeEditorProps) {
  return (
    <textarea
      aria-label={ariaLabel}
      value={value}
      readOnly={readOnly}
      onChange={(e) => onChange?.(e.target.value)}
    />
  );
}

export function CodeDiff({ original, modified }: CodeDiffProps) {
  return (
    <div data-testid="code-diff">
      <pre data-testid="diff-original">{original}</pre>
      <pre data-testid="diff-modified">{modified}</pre>
    </div>
  );
}
