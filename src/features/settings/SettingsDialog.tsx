import { DownloadIcon, Trash2Icon, UploadIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { useServices } from '@/app/services';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { downloadJson } from '@/lib/download';
import { backupFileName, createBackup, parseBackup } from '@/storage/backup';
import type { BackupFile } from '@/storage/types';
import { useAppStore } from '@/store/useAppStore';

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { storage, now } = useServices();
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const restore = useAppStore((s) => s.restore);
  const problems = useAppStore((s) => s.problems);
  const sources = useAppStore((s) => s.sources);
  const removeImported = useAppStore((s) => s.removeImportedProblem);
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const imported = problems.filter((p) => sources[p.id] === 'imported');

  const exportData = async () => {
    const at = new Date(now());
    downloadJson(backupFileName(at), await createBackup(storage, at));
    toast.success('Backup downloaded');
  };

  const chooseBackup = async (file: File | undefined) => {
    if (!file) return;
    const parsed = parseBackup(await file.text());
    if (fileInput.current) fileInput.current.value = '';
    if (parsed.ok) {
      setErrors([]);
      setPending(parsed.backup);
    } else {
      setErrors(parsed.errors);
    }
  };

  const confirmRestore = async () => {
    if (!pending) return;
    await restore(pending);
    setPending(null);
    toast.success('Data restored from backup');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings & data</DialogTitle>
          <DialogDescription>
            Everything is stored locally in this browser (IndexedDB).
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-3">
          <label className="flex items-center justify-between gap-4 text-sm">
            <span>
              Auto-pause timers when the tab is hidden
              <span className="block text-xs text-muted-foreground">
                Only active time counts toward your stage times.
              </span>
            </span>
            <Switch
              aria-label="Auto-pause timers when the tab is hidden"
              checked={settings.autoPauseOnHidden}
              onCheckedChange={(checked) => void updateSettings({ autoPauseOnHidden: checked })}
            />
          </label>
          <label className="flex items-center justify-between gap-4 text-sm">
            <span>Dark mode</span>
            <Switch
              aria-label="Dark mode"
              checked={settings.theme === 'dark'}
              onCheckedChange={(checked) =>
                void updateSettings({ theme: checked ? 'dark' : 'light' })
              }
            />
          </label>
        </section>

        <section className="space-y-2 border-t pt-4">
          <h3 className="text-sm font-semibold">Backup</h3>
          <p className="text-xs text-muted-foreground">
            Export submissions, notes, progress, timers, drafts and imported problems as JSON.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void exportData()}>
              <DownloadIcon /> Export data
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
              <UploadIcon /> Import data
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              aria-label="Backup file"
              onChange={(e) => void chooseBackup(e.target.files?.[0])}
            />
          </div>
          {errors.length > 0 && (
            <ul role="alert" className="space-y-0.5 text-xs text-destructive">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </section>

        {imported.length > 0 && (
          <section className="space-y-2 border-t pt-4">
            <h3 className="text-sm font-semibold">Imported problems</h3>
            <ul className="divide-y rounded-md border text-sm">
              {imported.map((p) => (
                <li key={p.id} className="flex items-center justify-between px-3 py-1.5">
                  {p.title}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${p.title}`}
                    onClick={() => void removeImported(p.id)}
                  >
                    <Trash2Icon />
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <AlertDialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Replace all local data?</AlertDialogTitle>
              <AlertDialogDescription>
                This backup from {pending?.exportedAt.slice(0, 10)} contains{' '}
                {pending?.data.submissions.length ?? 0} submissions and{' '}
                {pending?.data.progress.length ?? 0} problems with progress. Your current data will
                be replaced.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={() => void confirmRestore()}>
                Replace data
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
