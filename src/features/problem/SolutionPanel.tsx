import { LockIcon } from 'lucide-react';

import { Markdown } from '@/components/Markdown';
import { EmptyState } from '@/components/States';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import type { Stage } from '@/types/problem.generated';

export function SolutionView({ stage }: { stage: Stage }) {
  const { solution } = stage;
  return (
    <div className="space-y-3">
      <Markdown>{`\`\`\`python\n${solution.code}\`\`\``}</Markdown>
      <div className="flex flex-wrap gap-4 text-xs">
        <span>
          <span className="text-muted-foreground">Time:</span> {solution.timeComplexity}
        </span>
        <span>
          <span className="text-muted-foreground">Space:</span> {solution.spaceComplexity}
        </span>
      </div>
      <Markdown>{solution.explanation}</Markdown>
    </div>
  );
}

export function SolutionPanel({
  stage,
  stageNumber,
  unlocked,
  onReveal,
}: {
  stage: Stage;
  stageNumber: number;
  unlocked: boolean;
  onReveal: () => void;
}) {
  if (!unlocked) {
    return (
      <EmptyState
        icon={LockIcon}
        title="Reference solution is locked"
        action={
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                Reveal solution
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reveal the reference solution?</AlertDialogTitle>
                <AlertDialogDescription>
                  It unlocks automatically once you pass this stage. Revealing it now is recorded as
                  "revealed" in your progress and debrief.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep trying</AlertDialogCancel>
                <AlertDialogAction onClick={onReveal}>Reveal</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        }
      >
        Pass stage {stageNumber} to unlock the reference solution and explanation.
      </EmptyState>
    );
  }
  return (
    <div className="p-4">
      <h3 className="mb-3 text-sm font-semibold">
        Reference solution{stageNumber > 0 ? ` · stage ${stageNumber}` : ''}
      </h3>
      <SolutionView stage={stage} />
    </div>
  );
}
