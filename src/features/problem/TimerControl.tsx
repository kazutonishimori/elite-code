import { PauseIcon, PlayIcon, TimerIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { formatDuration } from '@/core/timer';
import { cn } from '@/lib/utils';

import type { StageTimer } from './useStageTimer';

export function TimerControl({ timer, stageNumber }: { timer: StageTimer; stageNumber: number }) {
  const label = timer.running ? 'Pause' : timer.started ? 'Resume' : 'Start';
  return (
    <div
      className="flex items-center gap-1 rounded-md border bg-muted/40 py-0.5 pr-0.5 pl-2.5"
      role="timer"
      aria-label={`Stage ${stageNumber} timer`}
    >
      <TimerIcon
        className={cn('size-4', timer.running ? 'text-primary' : 'text-muted-foreground')}
        aria-hidden
      />
      <span
        className={cn(
          'min-w-14 font-mono text-sm tabular-nums',
          !timer.running && 'text-muted-foreground',
        )}
        data-testid="timer-value"
      >
        {formatDuration(timer.elapsedMs)}
      </span>
      {timer.autoPaused && <span className="text-[10px] text-muted-foreground">auto-paused</span>}
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={`${label} timer`}
        onClick={timer.running ? timer.pause : timer.start}
      >
        {timer.running ? <PauseIcon /> : <PlayIcon />}
      </Button>
    </div>
  );
}
