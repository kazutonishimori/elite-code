/** Problem / stage progression. Pure functions: callers persist the returned records. */

import type { ProgressRecord, StageProgress, SubmissionRecord } from '@/storage/types';
import type { Problem } from '@/types/problem.generated';

import type { RunSummary } from './testSelection';

export function emptyStageProgress(): StageProgress {
  return {
    attempts: 0,
    hintsRevealed: 0,
    regressions: 0,
    passedAt: null,
    snapshotCode: null,
    solutionRevealed: false,
  };
}

export function initialProgress(problemId: string, now = 0): ProgressRecord {
  return {
    problemId,
    status: 'unsolved',
    currentStageIndex: 0,
    stages: {},
    startedAt: null,
    solvedAt: null,
    updatedAt: now,
  };
}

export function stageProgress(progress: ProgressRecord, stageId: string): StageProgress {
  return progress.stages[stageId] ?? emptyStageProgress();
}

function withStage(
  progress: ProgressRecord,
  stageId: string,
  patch: Partial<StageProgress>,
  now: number,
): ProgressRecord {
  return {
    ...progress,
    updatedAt: now,
    stages: { ...progress.stages, [stageId]: { ...stageProgress(progress, stageId), ...patch } },
  };
}

export type SubmissionEvent = 'failed' | 'stage-passed' | 'problem-solved' | 'resubmitted';

export interface SubmissionUpdate {
  progress: ProgressRecord;
  event: SubmissionEvent;
  /** Stage index the solver should continue on. */
  nextStageIndex: number;
}

/**
 * Applies a Submit to progress: counts the attempt and regressions; on success snapshots the
 * code and advances to the next stage (or marks the problem solved after the last stage).
 */
export function applySubmission(
  progress: ProgressRecord,
  problem: Problem,
  stageIndex: number,
  summary: RunSummary,
  code: string,
  now: number,
): SubmissionUpdate {
  const stage = problem.stages[stageIndex];
  if (!stage) throw new RangeError(`Stage ${stageIndex} does not exist`);
  const current = stageProgress(progress, stage.id);
  const accepted = summary.verdict === 'accepted';
  const alreadyPassed = current.passedAt !== null;

  let next = withStage(
    progress,
    stage.id,
    {
      attempts: current.attempts + 1,
      regressions: current.regressions + (summary.regressions > 0 ? 1 : 0),
      ...(accepted && !alreadyPassed ? { passedAt: now, snapshotCode: code } : {}),
    },
    now,
  );
  next = {
    ...next,
    startedAt: next.startedAt ?? now,
    status: next.status === 'solved' ? 'solved' : 'attempted',
  };

  if (!accepted) return { progress: next, event: 'failed', nextStageIndex: stageIndex };
  if (alreadyPassed)
    return { progress: next, event: 'resubmitted', nextStageIndex: next.currentStageIndex };

  const isLast = stageIndex === problem.stages.length - 1;
  if (isLast) {
    next = { ...next, status: 'solved', solvedAt: next.solvedAt ?? now };
    return { progress: next, event: 'problem-solved', nextStageIndex: stageIndex };
  }
  next = { ...next, currentStageIndex: Math.max(next.currentStageIndex, stageIndex + 1) };
  return { progress: next, event: 'stage-passed', nextStageIndex: stageIndex + 1 };
}

export function revealHint(
  progress: ProgressRecord,
  problem: Problem,
  stageId: string,
  now: number,
): ProgressRecord {
  const stage = problem.stages.find((s) => s.id === stageId);
  const current = stageProgress(progress, stageId);
  const max = stage?.hints.length ?? 0;
  if (current.hintsRevealed >= max) return progress;
  return withStage(progress, stageId, { hintsRevealed: current.hintsRevealed + 1 }, now);
}

export function revealSolution(
  progress: ProgressRecord,
  stageId: string,
  now: number,
): ProgressRecord {
  return withStage(progress, stageId, { solutionRevealed: true }, now);
}

export function markStarted(progress: ProgressRecord, now: number): ProgressRecord {
  return progress.startedAt === null ? { ...progress, startedAt: now, updatedAt: now } : progress;
}

/** Stages the solver may read: everything up to the current stage (all, once solved). */
export function revealedStageCount(progress: ProgressRecord, problem: Problem): number {
  return progress.status === 'solved'
    ? problem.stages.length
    : Math.min(progress.currentStageIndex + 1, problem.stages.length);
}

/** A stage's reference solution unlocks once the stage is passed or explicitly revealed. */
export function isSolutionUnlocked(progress: ProgressRecord, stageId: string): boolean {
  const sp = stageProgress(progress, stageId);
  return sp.passedAt !== null || sp.solutionRevealed;
}

export function toSubmissionRecord(
  problemId: string,
  stageId: string,
  stageIndex: number,
  summary: RunSummary,
  code: string,
  now: number,
): SubmissionRecord {
  return {
    problemId,
    stageId,
    stageIndex,
    createdAt: now,
    code,
    verdict: summary.verdict,
    passed: summary.passed,
    failed: summary.failed,
    total: summary.total,
    regressions: summary.regressions,
    runtimeMs: summary.runtimeMs,
    tests: summary.tests.map((t) => ({
      name: t.name,
      stageIndex: t.stageIndex,
      status: t.status,
      regression: t.regression,
      message: t.message,
    })),
  };
}
