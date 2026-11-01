import { CheckIcon, LockIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { StageProgress } from '@/storage/types';
import type { Stage } from '@/types/problem.generated';

export function StageStepper({
  stages,
  progress,
  revealedCount,
  currentIndex,
  viewIndex,
  onSelect,
}: {
  stages: Stage[];
  progress: (stageId: string) => StageProgress;
  revealedCount: number;
  currentIndex: number;
  viewIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <ol className="flex items-center gap-1" aria-label="Interview stages">
      {stages.map((stage, i) => {
        const revealed = i < revealedCount;
        const passed = progress(stage.id).passedAt !== null;
        const label = revealed ? `Stage ${i + 1}: ${stage.title}` : `Stage ${i + 1}: locked`;
        return (
          <li key={stage.id} className="flex items-center gap-1">
            {i > 0 && (
              <span
                className={cn('h-px w-3', revealed ? 'bg-primary/60' : 'bg-border')}
                aria-hidden
              />
            )}
            <button
              type="button"
              disabled={!revealed}
              aria-label={label}
              aria-current={i === viewIndex ? 'step' : undefined}
              title={label}
              onClick={() => onSelect(i)}
              className={cn(
                'flex size-7 items-center justify-center rounded-full border text-xs font-medium transition-colors',
                passed && 'border-success bg-success/15 text-success',
                !passed && i === currentIndex && 'border-primary text-primary',
                !revealed && 'cursor-not-allowed text-muted-foreground/50',
                i === viewIndex && 'ring-2 ring-ring/50',
              )}
            >
              {passed ? (
                <CheckIcon className="size-3.5" />
              ) : revealed ? (
                i + 1
              ) : (
                <LockIcon className="size-3" />
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
