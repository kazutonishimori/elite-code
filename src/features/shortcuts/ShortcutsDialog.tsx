import { Fragment } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Kbd } from '@/components/ui/kbd';

import { shortcutList } from './shortcuts';

export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Run and Submit shortcuts work everywhere, including inside the editor.
          </DialogDescription>
        </DialogHeader>
        <ul className="divide-y">
          {shortcutList().map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-4 py-2.5 text-sm">
              <span>{s.description}</span>
              <span className="flex items-center gap-1">
                {s.keys.map((k, i) => (
                  <Fragment key={k}>
                    {i > 0 && <span className="text-muted-foreground">+</span>}
                    <Kbd>{k}</Kbd>
                  </Fragment>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
