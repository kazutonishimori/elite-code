import { describe, expect, it } from 'vitest';

import { loadExample } from '@/test/fixtures';

import {
  applySubmission,
  initialProgress,
  isSolutionUnlocked,
  markStarted,
  revealedStageCount,
  revealHint,
  revealSolution,
  stageProgress,
  toSubmissionRecord,
} from './progress';
import type { RunSummary } from './testSelection';

const sim = loadExample('inventory-reservations');
const standard = loadExample('merge-meeting-ranges');

const summary = (overrides: Partial<RunSummary> = {}): RunSummary => ({
  verdict: 'accepted',
  total: 3,
  passed: 3,
  failed: 0,
  regressions: 0,
  runtimeMs: 10,
  tests: [],
  message: null,
  ...overrides,
});

describe('applySubmission', () => {
  it('counts a failed attempt and marks the problem attempted', () => {
    const { progress, event, nextStageIndex } = applySubmission(
      initialProgress(sim.id),
      sim,
      0,
      summary({ verdict: 'failed', passed: 1, failed: 2 }),
      'code',
      100,
    );
    expect(event).toBe('failed');
    expect(nextStageIndex).toBe(0);
    expect(progress).toMatchObject({
      status: 'attempted',
      currentStageIndex: 0,
      startedAt: 100,
      updatedAt: 100,
    });
    expect(stageProgress(progress, 'basic-stock')).toMatchObject({
      attempts: 1,
      passedAt: null,
      snapshotCode: null,
    });
  });

  it('snapshots the code and advances to the next stage when a stage passes', () => {
    const { progress, event, nextStageIndex } = applySubmission(
      initialProgress(sim.id),
      sim,
      0,
      summary(),
      'v1',
      200,
    );
    expect(event).toBe('stage-passed');
    expect(nextStageIndex).toBe(1);
    expect(progress.currentStageIndex).toBe(1);
    expect(stageProgress(progress, 'basic-stock')).toMatchObject({
      attempts: 1,
      passedAt: 200,
      snapshotCode: 'v1',
    });
    expect(revealedStageCount(progress, sim)).toBe(2);
  });

  it('counts submissions that hit regressions', () => {
    let progress = applySubmission(initialProgress(sim.id), sim, 0, summary(), 'v1', 1).progress;
    progress = applySubmission(
      progress,
      sim,
      1,
      summary({ verdict: 'failed', regressions: 2 }),
      'v2',
      2,
    ).progress;
    progress = applySubmission(
      progress,
      sim,
      1,
      summary({ verdict: 'failed', regressions: 0 }),
      'v3',
      3,
    ).progress;
    expect(stageProgress(progress, 'reservations')).toMatchObject({ attempts: 2, regressions: 1 });
  });

  it('solves the problem after the last stage, once', () => {
    let progress = initialProgress(sim.id);
    sim.stages.forEach((_, i) => {
      progress = applySubmission(progress, sim, i, summary(), `v${i}`, 10 + i).progress;
    });
    expect(progress).toMatchObject({ status: 'solved', solvedAt: 13, currentStageIndex: 3 });
    expect(revealedStageCount(progress, sim)).toBe(4);

    const again = applySubmission(progress, sim, 3, summary(), 'v9', 99);
    expect(again.event).toBe('resubmitted');
    expect(again.progress).toMatchObject({ status: 'solved', solvedAt: 13 });
    expect(stageProgress(again.progress, 'atomic-batches').snapshotCode).toBe('v3');

    const failedAfterSolve = applySubmission(
      progress,
      sim,
      3,
      summary({ verdict: 'failed' }),
      'bad',
      100,
    );
    expect(failedAfterSolve.progress.status).toBe('solved');
  });

  it('solves a standard problem in one accepted submission', () => {
    const { progress, event } = applySubmission(
      initialProgress(standard.id),
      standard,
      0,
      summary(),
      'x',
      5,
    );
    expect(event).toBe('problem-solved');
    expect(progress.status).toBe('solved');
  });

  it('rejects unknown stages', () => {
    expect(() => applySubmission(initialProgress(sim.id), sim, 9, summary(), 'x', 1)).toThrow(
      RangeError,
    );
  });
});

describe('hints, solutions and visibility', () => {
  it('reveals hints one at a time up to the number available', () => {
    let progress = initialProgress(standard.id);
    for (let i = 0; i < 5; i++) progress = revealHint(progress, standard, 'merge-ranges', i);
    expect(stageProgress(progress, 'merge-ranges').hintsRevealed).toBe(3);
    expect(revealHint(progress, standard, 'missing-stage', 9)).toBe(progress);
  });

  it('locks the solution until the stage is passed or explicitly revealed', () => {
    const progress = initialProgress(sim.id);
    expect(isSolutionUnlocked(progress, 'basic-stock')).toBe(false);
    expect(isSolutionUnlocked(revealSolution(progress, 'basic-stock', 1), 'basic-stock')).toBe(
      true,
    );
    const passed = applySubmission(progress, sim, 0, summary(), 'x', 1).progress;
    expect(isSolutionUnlocked(passed, 'basic-stock')).toBe(true);
    expect(isSolutionUnlocked(passed, 'reservations')).toBe(false);
  });

  it('records the start time only once', () => {
    const started = markStarted(initialProgress('p'), 5);
    expect(started.startedAt).toBe(5);
    expect(markStarted(started, 9)).toBe(started);
  });

  it('only reveals stages up to the current one', () => {
    expect(revealedStageCount(initialProgress(sim.id), sim)).toBe(1);
  });
});

describe('toSubmissionRecord', () => {
  it('keeps a compact per-test summary', () => {
    const record = toSubmissionRecord(
      'p',
      's',
      1,
      summary({
        verdict: 'failed',
        tests: [
          {
            name: 't',
            stageIndex: 0,
            status: 'failed',
            regression: true,
            message: 'm',
            stageNumber: 1,
          } as never,
        ],
      }),
      'code',
      7,
    );
    expect(record).toMatchObject({
      problemId: 'p',
      stageId: 's',
      stageIndex: 1,
      createdAt: 7,
      verdict: 'failed',
    });
    expect(record.tests).toEqual([
      { name: 't', stageIndex: 0, status: 'failed', regression: true, message: 'm' },
    ]);
  });
});
