/** Dashboard statistics, computed from problems + persisted progress, timers and submissions. */
import type { ProgressRecord, SubmissionRecord, TimerRecord } from '@/storage/types';
import type { Problem } from '@/types/problem.generated';

export type Difficulty = Problem['difficulty'];

export interface Tally {
  solved: number;
  attempted: number;
  total: number;
}

/** Local calendar day as YYYY-MM-DD. */
export function dayKey(timestamp: number): string {
  const d = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function shiftDay(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return dayKey(new Date(y, m - 1, d + days, 12).getTime());
}

export interface Streak {
  current: number;
  longest: number;
  activeToday: boolean;
}

/** Consecutive active days. The current streak survives until the end of today. */
export function computeStreak(activityTimestamps: number[], now: number): Streak {
  const days = new Set(activityTimestamps.map(dayKey));
  const today = dayKey(now);
  const activeToday = days.has(today);
  let current = 0;
  let cursor = activeToday ? today : shiftDay(today, -1);
  while (days.has(cursor)) {
    current += 1;
    cursor = shiftDay(cursor, -1);
  }
  let longest = 0;
  for (const day of days) {
    if (days.has(shiftDay(day, -1))) continue;
    let length = 1;
    let next = shiftDay(day, 1);
    while (days.has(next)) {
      length += 1;
      next = shiftDay(next, 1);
    }
    longest = Math.max(longest, length);
  }
  return { current, longest, activeToday };
}

function tally(problems: Problem[], progress: Record<string, ProgressRecord>): Tally {
  return problems.reduce<Tally>(
    (acc, p) => {
      const status = progress[p.id]?.status ?? 'unsolved';
      return {
        solved: acc.solved + (status === 'solved' ? 1 : 0),
        attempted: acc.attempted + (status !== 'unsolved' ? 1 : 0),
        total: acc.total + 1,
      };
    },
    { solved: 0, attempted: 0, total: 0 },
  );
}

export function byDifficulty(
  problems: Problem[],
  progress: Record<string, ProgressRecord>,
): Record<Difficulty, Tally> {
  const pick = (d: Difficulty) =>
    tally(
      problems.filter((p) => p.difficulty === d),
      progress,
    );
  return { easy: pick('easy'), medium: pick('medium'), hard: pick('hard') };
}

export function byTag(
  problems: Problem[],
  progress: Record<string, ProgressRecord>,
): Record<string, Tally> {
  const tags = [...new Set(problems.flatMap((p) => p.tags))].sort();
  return Object.fromEntries(
    tags.map((tag) => [
      tag,
      tally(
        problems.filter((p) => (p.tags as string[]).includes(tag)),
        progress,
      ),
    ]),
  );
}

export interface WeakTag {
  tag: string;
  solveRate: number;
  attempted: number;
  failedSubmissions: number;
  hintsUsed: number;
}

/**
 * Tags where the solver struggles most: lowest solve rate among attempted problems, then most
 * failed submissions and hints per attempted problem. Tags never attempted are ignored.
 */
export function weakestTags(
  problems: Problem[],
  progress: Record<string, ProgressRecord>,
  submissions: SubmissionRecord[],
  limit = 3,
): WeakTag[] {
  const failedByProblem = new Map<string, number>();
  for (const s of submissions) {
    if (s.verdict !== 'accepted')
      failedByProblem.set(s.problemId, (failedByProblem.get(s.problemId) ?? 0) + 1);
  }
  const results: WeakTag[] = [];
  for (const [tag, t] of Object.entries(byTag(problems, progress))) {
    if (t.attempted === 0) continue;
    const tagged = problems.filter(
      (p) =>
        (p.tags as string[]).includes(tag) && (progress[p.id]?.status ?? 'unsolved') !== 'unsolved',
    );
    const failedSubmissions = tagged.reduce((n, p) => n + (failedByProblem.get(p.id) ?? 0), 0);
    const hintsUsed = tagged.reduce(
      (n, p) =>
        n + Object.values(progress[p.id]?.stages ?? {}).reduce((h, s) => h + s.hintsRevealed, 0),
      0,
    );
    results.push({
      tag,
      solveRate: t.solved / t.attempted,
      attempted: t.attempted,
      failedSubmissions,
      hintsUsed,
    });
  }
  const struggle = (w: WeakTag) => (w.failedSubmissions + w.hintsUsed) / w.attempted;
  return results
    .sort(
      (a, b) =>
        a.solveRate - b.solveRate || struggle(b) - struggle(a) || a.tag.localeCompare(b.tag),
    )
    .slice(0, limit);
}

export function totalPracticeMs(timers: TimerRecord[]): number {
  return timers.reduce((sum, t) => sum + t.accumulatedMs, 0);
}

export interface ActivityItem {
  problemId: string;
  title: string;
  stageNumber: number;
  verdict: SubmissionRecord['verdict'];
  createdAt: number;
}

export function recentActivity(
  problems: Problem[],
  submissions: SubmissionRecord[],
  limit = 8,
): ActivityItem[] {
  const titles = new Map(problems.map((p) => [p.id, p.title]));
  return [...submissions]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit)
    .map((s) => ({
      problemId: s.problemId,
      title: titles.get(s.problemId) ?? s.problemId,
      stageNumber: s.stageIndex + 1,
      verdict: s.verdict,
      createdAt: s.createdAt,
    }));
}

/** Submissions per day for the last `days` days (oldest first), for the activity strip. */
export function dailyActivity(
  submissions: SubmissionRecord[],
  now: number,
  days = 28,
): { day: string; count: number }[] {
  const counts = new Map<string, number>();
  submissions.forEach((s) =>
    counts.set(dayKey(s.createdAt), (counts.get(dayKey(s.createdAt)) ?? 0) + 1),
  );
  const today = dayKey(now);
  return Array.from({ length: days }, (_, i) => {
    const day = shiftDay(today, i - days + 1);
    return { day, count: counts.get(day) ?? 0 };
  });
}
