import { useEffect, useRef, useState } from 'react';

import { useServices } from '@/app/services';
import { Markdown } from '@/components/Markdown';
import { Spinner } from '@/components/States';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export const NOTE_SAVE_DELAY_MS = 500;

export function NotesPanel({ problemId }: { problemId: string }) {
  const { storage, now } = useServices();
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [saved, setSaved] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void storage.notes.get(problemId).then((note) => {
      if (!cancelled) setMarkdown(note?.markdown ?? '');
    });
    return () => {
      cancelled = true;
    };
  }, [storage, problemId]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const change = (value: string) => {
    setMarkdown(value);
    setSaved(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void storage.notes
        .put({ problemId, markdown: value, updatedAt: now() })
        .then(() => setSaved(true));
    }, NOTE_SAVE_DELAY_MS);
  };

  if (markdown === null) return <Spinner className="p-4" label="Loading notes…" />;
  return (
    <div className="flex h-full flex-col gap-2 p-3">
      <div className="flex items-center gap-2">
        <Button
          variant={preview ? 'ghost' : 'secondary'}
          size="sm"
          onClick={() => setPreview(false)}
        >
          Write
        </Button>
        <Button
          variant={preview ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setPreview(true)}
        >
          Preview
        </Button>
        <span className="ml-auto text-xs text-muted-foreground" role="status">
          {saved ? 'Saved' : 'Saving…'}
        </span>
      </div>
      {preview ? (
        <div className="flex-1 overflow-y-auto rounded-md border p-3">
          {markdown.trim() ? (
            <Markdown>{markdown}</Markdown>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing to preview.</p>
          )}
        </div>
      ) : (
        <Textarea
          aria-label="Notes"
          className="flex-1 resize-none font-mono text-xs"
          placeholder="Personal notes in Markdown: insights, mistakes to avoid, follow-ups…"
          value={markdown}
          onChange={(e) => change(e.target.value)}
        />
      )}
    </div>
  );
}
