import * as React from 'react';

import { cn } from '@/lib/utils';

/** A styled native <select>: accessible, keyboard friendly, and trivial to test. */
export function NativeSelect({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      data-slot="select"
      className={cn(
        'h-9 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        className,
      )}
      {...props}
    />
  );
}
