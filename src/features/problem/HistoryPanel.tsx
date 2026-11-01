import { HistoryIcon } from 'lucide-react';
import { useMemo, useState } from 'react';

import { CodeDiff } from '@/components/editor/CodeEditor';
import { EmptyState } from '@/components/States';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { diffStats, previousSubmission } from '@/core/diff';
import { formatTimestamp } from '@/lib/format';
import type { SubmissionRecord, Theme } from '@/storage/types';

const VERDICT_LABEL: Record<SubmissionRecord['verdict'], string> = {
  accepted: 'Accepted',
  failed: 'Failed',
  compile_error: 'Syntax error',
  load_error: 'Load error',
  timeout: 'Timeout',
  crashed: 'Crashed',
};

export function HistoryPanel({
  submissions,
  theme,
}: {
  submissions: SubmissionRecord[];
  theme: Theme;
}) {
  const [selected, setSelected] = useState<SubmissionRecord | null>(null);
  const newestFirst = useMemo(() => [...submissions].reverse(), [submissions]);
  const previous = selected ? previousSubmission(submissions, selected) : null;

  if (submissions.length === 0) {
    return (
      <EmptyState icon={HistoryIcon} title="No submissions yet">
        Each Submit is saved here with its code, so you can compare attempts.
      </EmptyState>
    );
  }
  return (
    <div className="p-3">
      <ul className="divide-y rounded-md border" aria-label="Submission history">
        {newestFirst.map((s) => {
          const prev = previousSubmission(submissions, s);
          const stats = prev ? diffStats(prev.code, s.code) : null;
          return (
            <li key={s.id ?? s.createdAt} className="flex items-center gap-3 px-3 py-2 text-sm">
              <Badge
                variant={
                  s.verdict === 'accepted'
                    ? 'success'
                    : s.verdict === 'timeout'
                      ? 'warning'
                      : 'destructive'
                }
              >
                {VERDICT_LABEL[s.verdict]}
              </Badge>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span>
                    {s.passed}/{s.total} tests
                  </span>
                  <span className="text-xs text-muted-foreground">Stage {s.stageIndex + 1}</span>
                  {s.regressions > 0 && (
                    <Badge variant="warning">
                      {s.regressions} regression{s.regressions > 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatTimestamp(s.createdAt)}
                  {s.runtimeMs !== null && ` · ${Math.round(s.runtimeMs)} ms`}
                  {stats && (
                    <>
                      {' · '}
                      <span className="text-success">+{stats.added}</span>{' '}
                      <span className="text-destructive">−{stats.removed}</span>
                    </>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelected(s)}>
                {prev ? 'Diff' : 'View'}
              </Button>
            </li>
          );
        })}
      </ul>
      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              {previous ? 'Changes since the previous submission' : 'Submitted code'}
            </DialogTitle>
            <DialogDescription>
              {selected &&
                `${VERDICT_LABEL[selected.verdict]} · ${formatTimestamp(selected.createdAt)}`}
              {previous && ` · compared with ${formatTimestamp(previous.createdAt)}`}
            </DialogDescription>
          </DialogHeader>
          <div className="h-[60vh] overflow-hidden rounded-md border">
            {selected && (
              <CodeDiff original={previous?.code ?? ''} modified={selected.code} theme={theme} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
