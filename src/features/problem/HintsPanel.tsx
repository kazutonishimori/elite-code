import { LightbulbIcon } from 'lucide-react';

import { Markdown } from '@/components/Markdown';
import { Button } from '@/components/ui/button';
import type { Stage } from '@/types/problem.generated';

export function HintsPanel({
  stage,
  revealed,
  onReveal,
}: {
  stage: Stage;
  revealed: number;
  onReveal: () => void;
}) {
  const remaining = stage.hints.length - revealed;
  return (
    <div className="space-y-3 p-4">
      <p className="text-sm text-muted-foreground">
        Hints for <span className="font-medium text-foreground">{stage.title}</span> are revealed
        one at a time, from a gentle nudge to nearly the full approach. Hint usage shows up in your
        stats.
      </p>
      <ol className="space-y-2">
        {stage.hints.slice(0, revealed).map((hint, i) => (
          <li key={hint} className="rounded-md border bg-muted/30 p-3 text-sm">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-warning">
              <LightbulbIcon className="size-3.5" /> Hint {i + 1}
            </div>
            <Markdown>{hint}</Markdown>
          </li>
        ))}
      </ol>
      {remaining > 0 ? (
        <Button variant="outline" size="sm" onClick={onReveal}>
          <LightbulbIcon /> Reveal hint {revealed + 1} of {stage.hints.length}
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">All hints revealed.</p>
      )}
    </div>
  );
}
