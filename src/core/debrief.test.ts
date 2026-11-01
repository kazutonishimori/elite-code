import { describe, expect, it } from 'vitest';

import type { SubmissionRecord, TimerRecord } from '@/storage/types';
import { loadExample } from '@/test/fixtures';

import { buildDebrief } from './debrief';
import { applySubmission, initialProgress, revealHint, revealSolution } from './progress';
import type { RunSummary } from './testSelection';

const sim = loadExample('inventory-reservations');
const ok = { verdict: 'accepted', regressions: 0 } as RunSummary;

describe('buildDebrief', () => {
  it('summarizes time, attempts, hints and regressions per stage', () => {
    let progress = initialProgress(sim.id);
    progress = applySubmission(progress, sim, 0, ok, 'v1', 1).progress;
    progress = applySubmission(
      progress,
      sim,
      1,
      { verdict: 'failed', regressions: 1 } as RunSummary,
      'v2',
      2,
    ).progress;
    progress = applySubmission(progress, sim, 1, ok, 'v3', 3).progress;
    progress = revealHint(progress, sim, 'reservations', 4);
    progress = revealSolution(progress, 'expiring-holds', 5);

    const timers: TimerRecord[] = [
      {
        problemId: sim.id,
        stageId: 'basic-stock',
        accumulatedMs: 60_000,
        running: false,
        updatedAt: 0,
      },
      {
        problemId: sim.id,
        stageId: 'reservations',
        accumulatedMs: 120_000,
        running: false,
        updatedAt: 0,
      },
      {
        problemId: 'other',
        stageId: 'basic-stock',
        accumulatedMs: 999,
        running: false,
        updatedAt: 0,
      },
    ];
    const submissions = [
      { problemId: sim.id, stageId: 'basic-stock' },
      { problemId: sim.id, stageId: 'reservations' },
      { problemId: sim.id, stageId: 'reservations' },
    ] as SubmissionRecord[];

    const debrief = buildDebrief(sim, progress, timers, submissions);
    expect(debrief).toMatchObject({
      totalTimeMs: 180_000,
      totalAttempts: 3,
      totalHints: 1,
      totalRegressions: 1,
    });
    expect(
      debrief.stages.map((s) => [s.title, s.timeMs, s.attempts, s.hintsUsed, s.regressions]),
    ).toEqual([
      ['Basic stock', 60_000, 1, 0, 0],
      ['Reservations', 120_000, 2, 1, 1],
      ['Expiring holds', 0, 0, 0, 0],
      ['Atomic batches', 0, 0, 0, 0],
    ]);
    expect(debrief.stages[2]).toMatchObject({ solutionRevealed: true, hintsAvailable: 3 });
    expect(debrief.stages[0]!.solution.code).toBe(sim.stages[0]!.solution.code);
  });
});
