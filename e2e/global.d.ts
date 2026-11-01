// Test hook exposed by the app's code editor (see src/components/editor/CodeEditor.tsx).
interface Window {
  __eliteEditor?: { getValue(): string; setValue(value: string): void };
}
