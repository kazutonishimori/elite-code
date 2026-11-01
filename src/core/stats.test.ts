import { describe, expect, it } from 'vitest';

import type { ProgressRecord, SubmissionRecord } from '@/storage/types';
import type { Problem } from '@/types/problem.generated';

import {
  byDifficulty,
  byTag,
  computeStreak,
  dailyActivity,
  dayKey,
  recentActivity,
  totalPracticeMs,
  weakestTags,
} from './stats';

const at = (iso: string) => new Date(iso).getTime();

const problem = (id: string, difficulty: Problem['difficulty'], tags: string[]) =>
  ({ id, title: id.toUpperCase(), difficulty, tags }) as unknown as Problem;

const problems = [
  problem('a', 'easy', ['hash-map']),
  problem('b', 'medium', ['hash-map', 'heap']),
  problem('c', 'medium', ['graph']),
  problem('d', 'hard', ['heap']),
];

const progress = (status: ProgressRecord['status'], hints = 0) =>
  ({
    status,
    stages: {
      s: {
        attempts: 1,
        hintsRevealed: hints,
        regressions: 0,
        passedAt: null,
        snapshotCode: null,
        solutionRevealed: false,
      },
    },
  }) as unknown as ProgressRecord;

const progressMap: Record<string, ProgressRecord> = {
  a: progress('solved'),
  b: progress('attempted', 2),
  d: progress('attempted'),
};

const submission = (
  problemId: string,
  createdAt: number,
  verdict: SubmissionRecord['verdict'] = 'failed',
) => ({ problemId, createdAt, verdict, stageIndex: 0 }) as SubmissionRecord;

describe('streaks', () => {
  const now = at('2026-10-31T15:00:00Z');

  it('counts consecutive days ending today', () => {
    const days = [
      '2026-10-29T09:00:00Z',
      '2026-10-30T23:00:00Z',
      '2026-10-31T01:00:00Z',
      '2026-10-31T08:00:00Z',
    ];
    expect(computeStreak(days.map(at), now)).toEqual({ current: 3, longest: 3, activeToday: true });
  });

  it('keeps yesterday’s streak alive until today ends', () => {
    expect(computeStreak([at('2026-10-30T10:00:00Z')], now)).toEqual({
      current: 1,
      longest: 1,
      activeToday: false,
    });
  });

  it('breaks after a missed day and tracks the longest run', () => {
    const days = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-29'].map((d) =>
      at(`${d}T12:00:00Z`),
    );
    expect(computeStreak(days, now)).toEqual({ current: 0, longest: 4, activeToday: false });
    expect(computeStreak([], now)).toEqual({ current: 0, longest: 0, activeToday: false });
  });

  it('crosses month and year boundaries', () => {
    const days = ['2025-12-31T12:00:00Z', '2026-01-01T12:00:00Z'].map(at);
    expect(computeStreak(days, at('2026-01-01T20:00:00Z')).current).toBe(2);
    expect(dayKey(at('2026-03-05T00:00:00Z'))).toBe('2026-03-05');
  });
});

describe('tallies', () => {
  it('counts solved / attempted / total by difficulty', () => {
    expect(byDifficulty(problems, progressMap)).toEqual({
      easy: { solved: 1, attempted: 1, total: 1 },
      medium: { solved: 0, attempted: 1, total: 2 },
      hard: { solved: 0, attempted: 1, total: 1 },
    });
  });

  it('counts by tag', () => {
    expect(byTag(problems, progressMap)).toEqual({
      graph: { solved: 0, attempted: 0, total: 1 },
      'hash-map': { solved: 1, attempted: 2, total: 2 },
      heap: { solved: 0, attempted: 2, total: 2 },
    });
  });
});

describe('weakestTags', () => {
  it('ranks attempted tags by solve rate, then by struggle', () => {
    const subs = [
      submission('b', 1),
      submission('b', 2),
      submission('d', 3),
      submission('a', 4, 'accepted'),
    ];
    expect(weakestTags(problems, progressMap, subs)).toEqual([
      { tag: 'heap', solveRate: 0, attempted: 2, failedSubmissions: 3, hintsUsed: 2 },
      { tag: 'hash-map', solveRate: 0.5, attempted: 2, failedSubmissions: 2, hintsUsed: 2 },
    ]);
  });

  it('breaks ties alphabetically and respects the limit', () => {
    const map = { a: progress('attempted'), c: progress('attempted') };
    expect(weakestTags(problems, map, [], 1).map((w) => w.tag)).toEqual(['graph']);
    expect(weakestTags(problems, {}, [])).toEqual([]);
  });
});

describe('activity', () => {
  it('sums practice time', () => {
    expect(totalPracticeMs([{ accumulatedMs: 1000 }, { accumulatedMs: 2500 }] as never)).toBe(3500);
  });

  it('lists recent submissions newest first with titles', () => {
    const items = recentActivity(
      problems,
      [submission('a', 1), submission('zz', 3), submission('c', 2)],
      2,
    );
    expect(items).toEqual([
      { problemId: 'zz', title: 'zz', stageNumber: 1, verdict: 'failed', createdAt: 3 },
      { problemId: 'c', title: 'C', stageNumber: 1, verdict: 'failed', createdAt: 2 },
    ]);
  });

  it('counts submissions per day for the activity strip', () => {
    const now = at('2026-10-31T12:00:00Z');
    const strip = dailyActivity(
      [
        submission('a', at('2026-10-31T01:00:00Z')),
        submission('a', at('2026-10-30T01:00:00Z')),
        submission('a', at('2026-10-31T02:00:00Z')),
      ],
      now,
      3,
    );
    expect(strip).toEqual([
      { day: '2026-10-29', count: 0 },
      { day: '2026-10-30', count: 1 },
      { day: '2026-10-31', count: 2 },
    ]);
  });
});
