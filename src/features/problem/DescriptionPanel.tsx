import { EyeOffIcon, HistoryIcon } from 'lucide-react';
import { useState } from 'react';

import { CodeEditor } from '@/components/editor/CodeEditor';
import { Markdown } from '@/components/Markdown';
import { DifficultyBadge, TypeBadge } from '@/components/ProblemBadges';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { StageProgress, Theme } from '@/storage/types';
import type { Problem } from '@/types/problem.generated';

export function DescriptionPanel({
  problem,
  viewIndex,
  currentIndex,
  stageProgress,
  theme,
}: {
  problem: Problem;
  viewIndex: number;
  currentIndex: number;
  stageProgress: StageProgress;
  theme: Theme;
}) {
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const stage = problem.stages[viewIndex];
  if (!stage) return null;
  const isSimulation = problem.type === 'simulation';
  const hiddenCount = stage.hiddenTests.length;

  return (
    <article className="space-y-4 p-4">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold">{problem.title}</h1>
        <div className="flex flex-wrap items-center gap-1.5">
          <DifficultyBadge difficulty={problem.difficulty} />
          <TypeBadge problem={problem} />
          {problem.tags.map((t) => (
            <Badge key={t} variant="outline" className="font-normal">
              {t}
            </Badge>
          ))}
        </div>
      </header>

      {isSimulation && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <span className="font-medium">
            Stage {viewIndex + 1} of {problem.stages.length}: {stage.title}
          </span>
          {viewIndex < currentIndex && <Badge variant="success">passed</Badge>}
          {viewIndex === currentIndex && stageProgress.passedAt === null && <Badge>current</Badge>}
          {stageProgress.snapshotCode !== null && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => setSnapshotOpen(true)}
            >
              <HistoryIcon /> Your code at the end of this stage
            </Button>
          )}
        </div>
      )}

      <Markdown>{stage.requirement}</Markdown>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Visible tests</h2>
        {stage.visibleTests.map((t) => (
          <div key={t.name}>
            {t.description && <p className="mb-1 text-xs text-muted-foreground">{t.description}</p>}
            <Markdown>{`\`\`\`python\n${t.code}\`\`\``}</Markdown>
          </div>
        ))}
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <EyeOffIcon className="size-3.5" /> {hiddenCount} hidden test
          {hiddenCount === 1 ? '' : 's'} run on Submit
          {isSimulation && viewIndex > 0 && ', together with every earlier stage’s tests'}.
        </p>
      </section>

      <Dialog open={snapshotOpen} onOpenChange={setSnapshotOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Your code at the end of stage {viewIndex + 1} (read-only)</DialogTitle>
            <DialogDescription>{stage.title}</DialogDescription>
          </DialogHeader>
          <div className="h-[60vh] overflow-hidden rounded-md border">
            <CodeEditor
              value={stageProgress.snapshotCode ?? ''}
              theme={theme}
              readOnly
              ariaLabel="Stage snapshot"
            />
          </div>
        </DialogContent>
      </Dialog>
    </article>
  );
}
