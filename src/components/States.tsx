import { Loader2Icon, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span
      role="status"
      className={cn('inline-flex items-center gap-2 text-muted-foreground', className)}
    >
      <Loader2Icon className="size-4 animate-spin" aria-hidden />
      {label && <span>{label}</span>}
    </span>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
        className,
      )}
    >
      <div className="rounded-full bg-muted p-3">
        <Icon className="size-6 text-muted-foreground" aria-hidden />
      </div>
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {children && <div className="max-w-sm text-sm text-muted-foreground">{children}</div>}
      </div>
      {action}
    </div>
  );
}
