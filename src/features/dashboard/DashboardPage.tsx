import { ActivityIcon, ClockIcon, FlameIcon, TargetIcon, TrophyIcon } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router';

import { useServices } from '@/app/services';
import { EmptyState } from '@/components/States';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  byDifficulty,
  byTag,
  computeStreak,
  dailyActivity,
  recentActivity,
  totalPracticeMs,
  weakestTags,
} from '@/core/stats';
import { humanizeDuration } from '@/core/timer';
import { formatTimestamp } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';

function Meter({
  value,
  total,
  tone = 'bg-primary',
}: {
  value: number;
  total: number;
  tone?: string;
}) {
  const pct = total === 0 ? 0 : Math.round((value / total) * 100);
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-muted"
      role="meter"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={total}
    >
      <div className={cn('h-full rounded-full', tone)} style={{ width: `${pct}%` }} />
    </div>
  );
}

function Tile({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-1 p-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {icon} {label}
        </div>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

const DIFFICULTY_TONE = {
  easy: 'bg-success',
  medium: 'bg-warning',
  hard: 'bg-destructive',
} as const;

export function DashboardPage() {
  const { now } = useServices();
  const problems = useAppStore((s) => s.problems);
  const progress = useAppStore((s) => s.progress);
  const timers = useAppStore((s) => s.timers);
  const submissions = useAppStore((s) => s.submissions);

  const stats = useMemo(() => {
    const at = now();
    return {
      difficulty: byDifficulty(problems, progress),
      tags: byTag(problems, progress),
      streak: computeStreak(
        submissions.map((s) => s.createdAt),
        at,
      ),
      practiceMs: totalPracticeMs(Object.values(timers)),
      recent: recentActivity(problems, submissions),
      weak: weakestTags(problems, progress, submissions),
      daily: dailyActivity(submissions, at),
    };
  }, [problems, progress, timers, submissions, now]);

  const solved = Object.values(stats.difficulty).reduce((n, t) => n + t.solved, 0);
  const hasActivity = submissions.length > 0 || stats.practiceMs > 0;
  const maxDaily = Math.max(1, ...stats.daily.map((d) => d.count));

  return (
    <div className="mx-auto h-full max-w-6xl space-y-6 overflow-y-auto p-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Your progress, streaks and where to focus next.
        </p>
      </div>

      {!hasActivity ? (
        <Card>
          <EmptyState
            icon={ActivityIcon}
            title="No practice recorded yet"
            action={
              <Button asChild size="sm">
                <Link to="/">Pick a problem</Link>
              </Button>
            }
          >
            Solve a problem or start a simulation, and your stats will show up here.
          </EmptyState>
        </Card>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Summary">
            <Tile
              icon={<TrophyIcon className="size-3.5" />}
              label="Solved"
              value={`${solved}/${problems.length}`}
            />
            <Tile
              icon={<FlameIcon className="size-3.5" />}
              label="Daily streak"
              value={`${stats.streak.current} day${stats.streak.current === 1 ? '' : 's'}`}
              hint={`Longest: ${stats.streak.longest}${stats.streak.activeToday ? ' · practiced today' : ''}`}
            />
            <Tile
              icon={<ClockIcon className="size-3.5" />}
              label="Practice time"
              value={humanizeDuration(stats.practiceMs)}
            />
            <Tile
              icon={<ActivityIcon className="size-3.5" />}
              label="Submissions"
              value={submissions.length}
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>By difficulty</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(['easy', 'medium', 'hard'] as const).map((d) => (
                  <div key={d} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="capitalize">{d}</span>
                      <span className="text-muted-foreground">
                        {stats.difficulty[d].solved}/{stats.difficulty[d].total}
                      </span>
                    </div>
                    <Meter
                      value={stats.difficulty[d].solved}
                      total={stats.difficulty[d].total}
                      tone={DIFFICULTY_TONE[d]}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5">
                  <TargetIcon className="size-4" /> Weakest tags
                </CardTitle>
                <CardDescription>Lowest solve rate among tags you have attempted</CardDescription>
              </CardHeader>
              <CardContent>
                {stats.weak.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Attempt a few problems to see this.
                  </p>
                ) : (
                  <ul className="space-y-2" aria-label="Weakest tags">
                    {stats.weak.map((w) => (
                      <li key={w.tag} className="flex items-center justify-between text-sm">
                        <Badge variant="outline">{w.tag}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {Math.round(w.solveRate * 100)}% solved · {w.failedSubmissions} failed ·{' '}
                          {w.hintsUsed} hints
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Last 4 weeks</CardTitle>
                <CardDescription>Submissions per day</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-1" aria-label="Daily activity">
                  {stats.daily.map((d) => (
                    <div
                      key={d.day}
                      title={`${d.day}: ${d.count} submission${d.count === 1 ? '' : 's'}`}
                      className="aspect-square rounded-sm bg-primary"
                      style={{ opacity: d.count === 0 ? 0.08 : 0.25 + 0.75 * (d.count / maxDaily) }}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>By tag</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-x-6 gap-y-2">
                {Object.entries(stats.tags).map(([tag, t]) => (
                  <div key={tag} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>{tag}</span>
                      <span className="text-muted-foreground">
                        {t.solved}/{t.total}
                      </span>
                    </div>
                    <Meter value={t.solved} total={t.total} />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent activity</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y" aria-label="Recent activity">
                  {stats.recent.map((a) => (
                    <li
                      key={`${a.problemId}-${a.createdAt}`}
                      className="flex items-center gap-2 py-2 text-sm"
                    >
                      <Link
                        to={`/problems/${a.problemId}`}
                        className="min-w-0 flex-1 truncate hover:text-primary"
                      >
                        {a.title}
                      </Link>
                      <span className="text-xs text-muted-foreground">Stage {a.stageNumber}</span>
                      <Badge variant={a.verdict === 'accepted' ? 'success' : 'destructive'}>
                        {a.verdict === 'accepted' ? 'Accepted' : 'Failed'}
                      </Badge>
                      <span className="w-28 text-right text-xs text-muted-foreground">
                        {formatTimestamp(a.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
