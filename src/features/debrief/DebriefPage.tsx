import {
  ArrowLeftIcon,
  ClockIcon,
  FileQuestionIcon,
  LightbulbIcon,
  RotateCcwIcon,
  SendIcon,
} from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';

import { DifficultyBadge, TypeBadge } from '@/components/ProblemBadges';
import { EmptyState } from '@/components/States';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buildDebrief } from '@/core/debrief';
import { initialProgress } from '@/core/progress';
import { formatDuration } from '@/core/timer';
import { SolutionView } from '@/features/problem/SolutionPanel';
import { useAppStore } from '@/store/useAppStore';

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export function DebriefPage() {
  const { problemId = '' } = useParams();
  const problem = useAppStore((s) => s.problems.find((p) => p.id === problemId));
  const progress = useAppStore((s) => s.progress[problemId]);
  const timers = useAppStore((s) => s.timers);
  const submissions = useAppStore((s) => s.submissions);
  const debrief = useMemo(
    () =>
      problem
        ? buildDebrief(
            problem,
            progress ?? initialProgress(problemId),
            Object.values(timers),
            submissions,
          )
        : null,
    [problem, progress, problemId, timers, submissions],
  );

  if (!problem || !debrief) {
    return <EmptyState icon={FileQuestionIcon} title="Problem not found" />;
  }
  if (progress?.status !== 'solved') {
    return (
      <EmptyState
        icon={FileQuestionIcon}
        title="The debrief unlocks when you finish every stage"
        action={
          <Button asChild size="sm">
            <Link to={`/problems/${problem.id}`}>Continue the interview</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="mx-auto h-full max-w-5xl space-y-6 overflow-y-auto p-6">
      <Button asChild variant="ghost" size="sm">
        <Link to={`/problems/${problem.id}`}>
          <ArrowLeftIcon /> Back to the problem
        </Link>
      </Button>
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Debrief: {problem.title}</h1>
        <div className="flex gap-1.5">
          <DifficultyBadge difficulty={problem.difficulty} />
          <TypeBadge problem={problem} />
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Totals">
        <Stat
          icon={<ClockIcon className="size-3.5" />}
          label="Total time"
          value={formatDuration(debrief.totalTimeMs)}
        />
        <Stat
          icon={<SendIcon className="size-3.5" />}
          label="Submissions"
          value={debrief.totalAttempts}
        />
        <Stat
          icon={<LightbulbIcon className="size-3.5" />}
          label="Hints used"
          value={debrief.totalHints}
        />
        <Stat
          icon={<RotateCcwIcon className="size-3.5" />}
          label="Regressions hit"
          value={debrief.totalRegressions}
        />
      </section>

      <section className="overflow-hidden rounded-lg border" aria-label="Per-stage breakdown">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Stage</th>
              <th className="px-3 py-2 text-right font-medium">Time</th>
              <th className="px-3 py-2 text-right font-medium">Submissions</th>
              <th className="px-3 py-2 text-right font-medium">Hints</th>
              <th className="px-3 py-2 text-right font-medium">Regressions</th>
            </tr>
          </thead>
          <tbody>
            {debrief.stages.map((s, i) => (
              <tr key={s.stageId} className="border-t">
                <td className="px-3 py-2">
                  {i + 1}. {s.title}
                  {s.solutionRevealed && (
                    <Badge variant="warning" className="ml-2">
                      solution revealed
                    </Badge>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">
                  {formatDuration(s.timeMs)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{s.attempts}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {s.hintsUsed}/{s.hintsAvailable}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{s.regressions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Reference solutions</h2>
        {problem.stages.map((stage, i) => (
          <Card key={stage.id}>
            <CardHeader>
              <CardTitle>
                Stage {i + 1}: {stage.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SolutionView stage={stage} />
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
