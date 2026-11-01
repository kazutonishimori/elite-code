import { CheckCircle2Icon, CircleDashedIcon, CircleIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ProblemStatus } from '@/storage/types';
import type { Problem } from '@/types/problem.generated';

const DIFFICULTY_VARIANT = { easy: 'success', medium: 'warning', hard: 'destructive' } as const;

export function DifficultyBadge({ difficulty }: { difficulty: Problem['difficulty'] }) {
  return (
    <Badge variant={DIFFICULTY_VARIANT[difficulty]} className="capitalize">
      {difficulty}
    </Badge>
  );
}

export function TypeBadge({ problem }: { problem: Pick<Problem, 'type' | 'stages'> }) {
  return problem.type === 'simulation' ? (
    <Badge variant="default">Simulation · {problem.stages.length} stages</Badge>
  ) : (
    <Badge variant="secondary">Standard</Badge>
  );
}

const STATUS_LABEL: Record<ProblemStatus, string> = {
  solved: 'Solved',
  attempted: 'Attempted',
  unsolved: 'Unsolved',
};

export function StatusIcon({ status, className }: { status: ProblemStatus; className?: string }) {
  const Icon =
    status === 'solved' ? CheckCircle2Icon : status === 'attempted' ? CircleDashedIcon : CircleIcon;
  return (
    <Icon
      aria-label={STATUS_LABEL[status]}
      role="img"
      className={cn(
        'size-4',
        status === 'solved'
          ? 'text-success'
          : status === 'attempted'
            ? 'text-warning'
            : 'text-muted-foreground/50',
        className,
      )}
    />
  );
}
