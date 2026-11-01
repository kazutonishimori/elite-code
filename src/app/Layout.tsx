import {
  CodeXmlIcon,
  KeyboardIcon,
  MoonIcon,
  SettingsIcon,
  SunIcon,
  UploadIcon,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { NavLink } from 'react-router';

import { Spinner } from '@/components/States';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { ImportDialog } from '@/features/import/ImportDialog';
import { SettingsDialog } from '@/features/settings/SettingsDialog';
import { isTypingTarget, matchShortcut } from '@/features/shortcuts/shortcuts';
import { ShortcutsDialog } from '@/features/shortcuts/ShortcutsDialog';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';
import { useRunnerState } from '@/store/useRunnerState';

function RunnerIndicator() {
  const state = useRunnerState();
  if (state.status === 'loading')
    return <Spinner className="text-xs" label={state.detail ?? 'Loading Python…'} />;
  if (state.status === 'error') {
    return (
      <span role="status" className="text-xs text-destructive">
        Python failed to load
      </span>
    );
  }
  if (state.status === 'idle') return null;
  return (
    <span role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className={cn(
          'size-2 rounded-full',
          state.status === 'running' ? 'animate-pulse bg-warning' : 'bg-success',
        )}
      />
      Python {state.pythonVersion ?? ''} {state.status === 'running' ? '· running' : '· ready'}
    </span>
  );
}

const navClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'rounded-md px-3 py-1.5 text-sm transition-colors hover:text-foreground',
    isActive ? 'bg-accent text-foreground' : 'text-muted-foreground',
  );

export function Layout({ children }: { children: ReactNode }) {
  const theme = useAppStore((s) => s.settings.theme);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const [dialog, setDialog] = useState<'import' | 'settings' | 'shortcuts' | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (matchShortcut(event) === 'help' && !isTypingTarget(event.target)) {
        event.preventDefault();
        setDialog('shortcuts');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <NavLink to="/" className="mr-2 flex items-center gap-2 font-semibold">
          <CodeXmlIcon className="size-5 text-primary" aria-hidden />
          Elite Code
        </NavLink>
        <nav className="flex items-center gap-1" aria-label="Main">
          <NavLink to="/" end className={navClass}>
            Problems
          </NavLink>
          <NavLink to="/dashboard" className={navClass}>
            Dashboard
          </NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <RunnerIndicator />
          <div className="mx-2 h-5 w-px bg-border" />
          <Button variant="ghost" size="sm" onClick={() => setDialog('import')}>
            <UploadIcon /> Import
          </Button>
          <Tooltip content="Keyboard shortcuts (?)">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Keyboard shortcuts"
              onClick={() => setDialog('shortcuts')}
            >
              <KeyboardIcon />
            </Button>
          </Tooltip>
          <Tooltip content={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              onClick={() => void updateSettings({ theme: theme === 'dark' ? 'light' : 'dark' })}
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </Button>
          </Tooltip>
          <Tooltip content="Settings & data">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Settings"
              onClick={() => setDialog('settings')}
            >
              <SettingsIcon />
            </Button>
          </Tooltip>
        </div>
      </header>
      <main className="min-h-0 flex-1">{children}</main>
      <ImportDialog
        open={dialog === 'import'}
        onOpenChange={(o) => setDialog(o ? 'import' : null)}
      />
      <SettingsDialog
        open={dialog === 'settings'}
        onOpenChange={(o) => setDialog(o ? 'settings' : null)}
      />
      <ShortcutsDialog
        open={dialog === 'shortcuts'}
        onOpenChange={(o) => setDialog(o ? 'shortcuts' : null)}
      />
    </div>
  );
}
