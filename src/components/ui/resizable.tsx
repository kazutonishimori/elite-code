import * as React from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';

import { cn } from '@/lib/utils';

export function ResizablePanelGroup({ className, ...props }: React.ComponentProps<typeof Group>) {
  return <Group className={cn('flex h-full w-full', className)} {...props} />;
}

export const ResizablePanel = Panel;

export function ResizableHandle({ className, ...props }: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      className={cn(
        'relative shrink-0 bg-border transition-colors hover:bg-primary/60 data-[separator=active]:bg-primary aria-[orientation=horizontal]:h-1 aria-[orientation=vertical]:w-1',
        className,
      )}
      {...props}
    />
  );
}
