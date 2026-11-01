import type { ComponentProps } from 'react';

/**
 * jsdom has no layout, so react-resizable-panels sees every pointer as hovering a separator and
 * suppresses mousedown (which Radix Tabs rely on). Tests use plain containers instead.
 */
export function ResizablePanelGroup({ children }: ComponentProps<'div'>) {
  return <div>{children}</div>;
}

export function ResizablePanel({ children }: { children?: React.ReactNode }) {
  return <div>{children}</div>;
}

export function ResizableHandle() {
  return <div role="separator" />;
}
