import { AlertCircleIcon, CheckCircle2Icon, FileJsonIcon, UploadIcon } from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

import { useServices } from '@/app/services';
import { DifficultyBadge, TypeBadge } from '@/components/ProblemBadges';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { parseAndValidateProblem, type ValidationResult } from '@/core/problemValidation';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';

export function ImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { now } = useServices();
  const navigate = useNavigate();
  const sources = useAppStore((s) => s.sources);
  const importProblem = useAppStore((s) => s.importProblem);
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const reset = () => {
    setText('');
    setFileName(null);
    setResult(null);
  };

  const check = (content: string, name: string | null) => {
    setText(content);
    setFileName(name);
    setResult(content.trim() ? parseAndValidateProblem(content) : null);
  };

  const readFile = async (file: File | undefined) => {
    if (file) check(await file.text(), file.name);
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    void readFile(event.dataTransfer.files[0]);
  };

  const problem = result?.ok ? result.problem : null;
  const clash = problem ? sources[problem.id] : undefined;

  const add = async () => {
    if (!problem) return;
    setSaving(true);
    try {
      await importProblem(problem, now());
      toast.success(`Added “${problem.title}” to your library`);
      onOpenChange(false);
      reset();
      void navigate(`/problems/${problem.id}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import a problem</DialogTitle>
          <DialogDescription>
            Drop a problem JSON file (see schema/PROBLEM_AUTHORING.md). It's checked against the
            schema here. Run <code className="font-mono text-xs">npm run problem:validate</code> to
            also execute the reference solutions.
          </DialogDescription>
        </DialogHeader>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'flex flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-center text-sm transition-colors',
            dragging ? 'border-primary bg-primary/5' : 'border-border',
          )}
          data-testid="dropzone"
        >
          <FileJsonIcon className="size-8 text-muted-foreground" aria-hidden />
          <p>
            {fileName ? <span className="font-medium">{fileName}</span> : 'Drag a .json file here'}
          </p>
          <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
            <UploadIcon /> Choose file
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            aria-label="Problem file"
            onChange={(e) => void readFile(e.target.files?.[0])}
          />
        </div>

        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">…or paste JSON</summary>
          <Textarea
            aria-label="Problem JSON"
            className="mt-2 h-40 font-mono text-xs"
            value={text}
            onChange={(e) => check(e.target.value, null)}
          />
        </details>

        {result && !result.ok && (
          <div
            role="alert"
            className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-3"
          >
            <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
              <AlertCircleIcon className="size-4" /> {result.issues.length} validation error
              {result.issues.length > 1 ? 's' : ''}
            </p>
            <ul
              className="max-h-48 space-y-1 overflow-y-auto font-mono text-xs"
              aria-label="Validation errors"
            >
              {result.issues.map((issue) => (
                <li key={`${issue.path}-${issue.message}`}>
                  <span className="text-muted-foreground">{issue.path || '(root)'}</span>{' '}
                  {issue.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {problem && (
          <div className="space-y-2 rounded-md border border-success/40 bg-success/5 p-3 text-sm">
            <p className="flex items-center gap-1.5 font-medium text-success">
              <CheckCircle2Icon className="size-4" /> Valid problem
            </p>
            <p className="font-medium">{problem.title}</p>
            <div className="flex gap-1.5">
              <DifficultyBadge difficulty={problem.difficulty} />
              <TypeBadge problem={problem} />
            </div>
            <p className="text-muted-foreground">{problem.summary}</p>
            {clash === 'bundled' && (
              <p className="text-destructive">
                The id “{problem.id}” belongs to a built-in problem. Change the id to import it.
              </p>
            )}
            {clash === 'imported' && (
              <p className="text-warning">This replaces your previously imported version.</p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!problem || clash === 'bundled' || saving} onClick={() => void add()}>
            {clash === 'imported' ? 'Replace in library' : 'Add to library'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
