import { PartyPopperIcon, TrophyIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDuration } from '@/core/timer';
import type { Problem } from '@/types/problem.generated';

import type { StageCelebration } from './sessionStore';

export function StageCompleteDialog({
  problem,
  celebration,
  stageTimeMs,
  attempts,
  onContinue,
  onDebrief,
}: {
  problem: Problem;
  celebration: StageCelebration | null;
  stageTimeMs: number;
  attempts: number;
  onContinue: () => void;
  onDebrief: () => void;
}) {
  const solved = celebration?.event === 'problem-solved';
  const stage = celebration ? problem.stages[celebration.stageIndex] : undefined;
  const isSimulation = problem.type === 'simulation';
  const Icon = solved ? TrophyIcon : PartyPopperIcon;
  return (
    <Dialog open={celebration !== null} onOpenChange={(open) => !open && onContinue()}>
      <DialogContent className="max-w-md text-center" showClose={false}>
        <DialogHeader className="items-center">
          <div className="mb-2 rounded-full bg-success/15 p-3 animate-in zoom-in-50">
            <Icon className="size-8 text-success" aria-hidden />
          </div>
          <DialogTitle>
            {solved
              ? isSimulation
                ? 'Interview complete!'
                : 'Solved!'
              : `Stage ${(celebration?.stageIndex ?? 0) + 1} complete`}
          </DialogTitle>
          <DialogDescription>
            {stage?.title} · {formatDuration(stageTimeMs)} · {attempts} submission
            {attempts === 1 ? '' : 's'}
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {solved
            ? isSimulation
              ? 'Every stage passed. The debrief breaks down your time, attempts and the reference solutions.'
              : 'All tests passed. The reference solution is now unlocked.'
            : 'Your code carries over unchanged. The interviewer has a new requirement for you.'}
        </p>
        <DialogFooter className="sm:justify-center">
          {solved && isSimulation ? (
            <>
              <Button variant="outline" onClick={onContinue}>
                Stay here
              </Button>
              <Button onClick={onDebrief}>View debrief</Button>
            </>
          ) : (
            <Button onClick={onContinue} autoFocus>
              {solved ? 'Close' : `Continue to stage ${(celebration?.stageIndex ?? 0) + 2}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
