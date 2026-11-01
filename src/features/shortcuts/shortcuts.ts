export interface Shortcut {
  id: 'run' | 'submit' | 'help';
  keys: string[];
  description: string;
}

export const isMac = () =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export function modKey(): string {
  return isMac() ? '⌘' : 'Ctrl';
}

export function shortcutList(): Shortcut[] {
  const mod = modKey();
  return [
    { id: 'run', keys: [mod, 'Enter'], description: 'Run visible tests for the current stage' },
    {
      id: 'submit',
      keys: [mod, 'Shift', 'Enter'],
      description: 'Submit: all tests for this and earlier stages',
    },
    { id: 'help', keys: ['?'], description: 'Show keyboard shortcuts (outside the editor)' },
  ];
}

/** Maps a keydown to a shortcut id. */
export function matchShortcut(
  event: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'shiftKey'>,
): Shortcut['id'] | null {
  const mod = event.metaKey || event.ctrlKey;
  if (mod && event.key === 'Enter') return event.shiftKey ? 'submit' : 'run';
  if (!mod && event.key === '?') return 'help';
  return null;
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}
