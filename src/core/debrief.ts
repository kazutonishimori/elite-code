/** End-of-simulation debrief: where the time went and how each stage went. */

import type { ProgressRecord, SubmissionRecord, TimerRecord } from '@/storage/types';
import type { Problem, Solution } from '@/types/problem.generated';

import { stageProgress } from './progress';

export interface StageDebrief {
  stageId: string;
  title: string;
  timeMs: number;
  attempts: number;
  hintsUsed: number;
  hintsAvailable: number;
  regressions: number;
  solutionRevealed: boolean;
  passedAt: number | null;
  solution: Solution;
}

export interface Debrief {
  totalTimeMs: number;
  totalAttempts: number;
  totalHints: number;
  totalRegressions: number;
  stages: StageDebrief[];
}

export function buildDebrief(
  problem: Problem,
  progress: ProgressRecord,
  timers: TimerRecord[],
  submissions: SubmissionRecord[],
): Debrief {
  const stages = problem.stages.map((stage): StageDebrief => {
    const sp = stageProgress(progress, stage.id);
    const timer = timers.find((t) => t.problemId === problem.id && t.stageId === stage.id);
    const attempts = submissions.filter(
      (s) => s.problemId === problem.id && s.stageId === stage.id,
    ).length;
    return {
      stageId: stage.id,
      title: stage.title,
      timeMs: timer?.accumulatedMs ?? 0,
      attempts: Math.max(attempts, sp.attempts),
      hintsUsed: sp.hintsRevealed,
      hintsAvailable: stage.hints.length,
      regressions: sp.regressions,
      solutionRevealed: sp.solutionRevealed,
      passedAt: sp.passedAt,
      solution: stage.solution,
    };
  });
  const sum = (pick: (s: StageDebrief) => number) => stages.reduce((n, s) => n + pick(s), 0);
  return {
    totalTimeMs: sum((s) => s.timeMs),
    totalAttempts: sum((s) => s.attempts),
    totalHints: sum((s) => s.hintsUsed),
    totalRegressions: sum((s) => s.regressions),
    stages,
  };
}
