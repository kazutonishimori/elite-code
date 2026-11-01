import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ClockAlertIcon,
  EyeOffIcon,
  FlaskConicalIcon,
  OctagonXIcon,
  RotateCcwIcon,
  XCircleIcon,
} from 'lucide-react';
import { useState } from 'react';

import { EmptyState, Spinner } from '@/components/States';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { regressionLabel, type ClassifiedTest, type Verdict } from '@/core/testSelection';
import { cn } from '@/lib/utils';

import type { LastRun } from './sessionStore';

const VERDICT: Record<Verdict, { title: string; tone: string; icon: typeof CheckCircle2Icon }> = {
  accepted: { title: 'All tests passed', tone: 'text-success', icon: CheckCircle2Icon },
  failed: { title: 'Some tests failed', tone: 'text-destructive', icon: XCircleIcon },
  compile_error: { title: 'Syntax error', tone: 'text-destructive', icon: OctagonXIcon },
  load_error: {
    title: 'Your code raised an error while loading',
    tone: 'text-destructive',
    icon: OctagonXIcon,
  },
  timeout: { title: 'Time limit exceeded', tone: 'text-warning', icon: ClockAlertIcon },
  crashed: {
    title: 'The Python runtime crashed',
    tone: 'text-destructive',
    icon: AlertTriangleIcon,
  },
};

function Pre({ children, className }: { children: string; className?: string }) {
  return (
    <pre
      className={cn(
        'overflow-x-auto rounded-md bg-muted/60 p-2.5 font-mono text-xs whitespace-pre-wrap',
        className,
      )}
    >
      {children}
    </pre>
  );
}

function TestCard({ test, description }: { test: ClassifiedTest; description?: string }) {
  const passed = test.status === 'passed';
  const [open, setOpen] = useState(!passed);
  return (
    <li
      className={cn(
        'rounded-md border',
        test.regression
          ? 'border-warning/60 bg-warning/5'
          : !passed && test.status !== 'skipped' && 'border-destructive/40',
      )}
      data-testid={`test-${test.name}`}
      data-status={test.status}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {passed ? (
          <CheckCircle2Icon className="size-4 shrink-0 text-success" aria-label="passed" />
        ) : test.status === 'skipped' ? (
          <span
            className="size-4 shrink-0 rounded-full border border-dashed"
            aria-label="skipped"
          />
        ) : (
          <XCircleIcon className="size-4 shrink-0 text-destructive" aria-label={test.status} />
        )}
        <span className="font-mono text-xs">{test.name}</span>
        {test.regression && (
          <Badge variant="warning">
            <RotateCcwIcon /> Regression · {regressionLabel(test)}
          </Badge>
        )}
        {test.visibility === 'hidden' && (
          <Badge variant="outline" className="font-normal">
            <EyeOffIcon /> hidden
          </Badge>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {test.status === 'error' ? test.errorType : `Stage ${test.stageNumber}`}
        </span>
      </button>
      {open && (
        <div className="space-y-2 border-t px-3 py-2.5 text-xs">
          {description && <p className="text-muted-foreground">{description}</p>}
          {test.status === 'skipped' && <p className="text-muted-foreground">{test.message}</p>}
          {test.status === 'failed' && test.expression && (
            <div className="space-y-1.5">
              <div>
                <span className="text-muted-foreground">Assertion</span>
                <Pre>{`assert ${test.expression}`}</Pre>
              </div>
              {test.expected !== null && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <span className="text-muted-foreground">
                      Expected
                      {test.comparison && test.comparison !== '==' ? ` (${test.comparison})` : ''}
                    </span>
                    <Pre className="text-success">{test.expected}</Pre>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Actual</span>
                    <Pre className="text-destructive">{test.actual ?? ''}</Pre>
                  </div>
                </div>
              )}
              {test.expected === null && test.actual !== null && (
                <p>
                  Value was <code className="font-mono">{test.actual}</code>
                </p>
              )}
              {test.difference && <p className="text-warning">{test.difference}</p>}
              {test.message && test.message !== `assert ${test.expression}` && (
                <p>{test.message}</p>
              )}
            </div>
          )}
          {test.status === 'failed' && !test.expression && test.message && (
            <Pre>{test.message}</Pre>
          )}
          {test.status === 'error' && test.traceback && (
            <Pre className="text-destructive">{test.traceback}</Pre>
          )}
          {test.stdout && (
            <div>
              <span className="text-muted-foreground">Output</span>
              <Pre>{test.stdout}</Pre>
            </div>
          )}
          {test.stderr && <Pre className="text-warning">{test.stderr}</Pre>}
          {passed && !test.stdout && (
            <p className="text-muted-foreground">Passed in {test.durationMs.toFixed(1)} ms</p>
          )}
        </div>
      )}
    </li>
  );
}

export function ResultsPanel({
  lastRun,
  running,
  descriptions,
}: {
  lastRun: LastRun | null;
  running: string | null;
  descriptions: Record<string, string | undefined>;
}) {
  if (running && running !== 'custom') {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner
          label={running === 'submit' ? 'Submitting: running all tests…' : 'Running visible tests…'}
        />
      </div>
    );
  }
  if (!lastRun || lastRun.kind === 'custom') {
    return (
      <EmptyState icon={FlaskConicalIcon} title="No results yet">
        Run checks the visible tests for this stage. Submit runs every test for this stage and all
        earlier stages.
      </EmptyState>
    );
  }
  const { summary, result } = lastRun;
  const verdict = VERDICT[summary.verdict];
  const Icon = verdict.icon;
  const regressions = summary.tests.filter((t) => t.regression);
  const failures = summary.tests.filter((t) => !t.regression && t.status !== 'passed');
  const passes = summary.tests.filter((t) => t.status === 'passed');

  return (
    <div className="space-y-3 p-3" aria-live="polite">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3
          className={cn('flex items-center gap-2 font-semibold', verdict.tone)}
          data-testid="verdict"
        >
          <Icon className="size-5" aria-hidden />
          {lastRun.kind === 'submit' && summary.verdict === 'accepted' ? 'Accepted' : verdict.title}
        </h3>
        {summary.total > 0 && (
          <span className="text-sm text-muted-foreground" data-testid="pass-count">
            {summary.passed}/{summary.total} passed
          </span>
        )}
        {summary.runtimeMs !== null && summary.verdict !== 'timeout' && (
          <span className="text-xs text-muted-foreground">{Math.round(summary.runtimeMs)} ms</span>
        )}
        <Badge variant="outline" className="font-normal">
          {lastRun.kind === 'submit' ? 'Submit' : 'Run'} · Stage {lastRun.stageIndex + 1}
        </Badge>
      </div>

      {summary.verdict === 'timeout' && (
        <p className="rounded-md border border-warning/50 bg-warning/10 p-3 text-sm">
          {summary.message} Look for a loop that never ends, or an algorithm that is too slow for
          the largest input.
        </p>
      )}
      {summary.verdict === 'crashed' && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          {summary.message}. The runtime was restarted, so try again.
        </p>
      )}
      {result?.error && <Pre className="text-destructive">{result.error.traceback}</Pre>}

      {regressions.length > 0 && (
        <section aria-label="Regressions" className="space-y-2">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-warning uppercase">
            <RotateCcwIcon className="size-3.5" /> {regressions.length} regression
            {regressions.length > 1 ? 's' : ''}: earlier stages broke
          </h4>
          <ul className="space-y-2">
            {regressions.map((t) => (
              <TestCard key={t.name} test={t} description={descriptions[t.name]} />
            ))}
          </ul>
        </section>
      )}
      {failures.length > 0 && (
        <section aria-label="Failures" className="space-y-2">
          {regressions.length > 0 && (
            <h4 className="text-xs font-semibold tracking-wide text-destructive uppercase">
              Current stage
            </h4>
          )}
          <ul className="space-y-2">
            {failures.map((t) => (
              <TestCard key={t.name} test={t} description={descriptions[t.name]} />
            ))}
          </ul>
        </section>
      )}
      {passes.length > 0 && (
        <section aria-label="Passed" className="space-y-2">
          <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Passed ({passes.length})
          </h4>
          <ul className="space-y-1.5">
            {passes.map((t) => (
              <TestCard key={t.name} test={t} description={descriptions[t.name]} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function ConsolePanel({ lastRun }: { lastRun: LastRun | null }) {
  const result = lastRun?.result;
  const chunks: { label: string; text: string; tone?: string }[] = [];
  if (result?.stdout) chunks.push({ label: 'your code', text: result.stdout });
  if (result?.stderr)
    chunks.push({ label: 'your code (stderr)', text: result.stderr, tone: 'text-warning' });
  result?.tests.forEach((t) => {
    if (t.stdout) chunks.push({ label: t.name, text: t.stdout });
    if (t.stderr)
      chunks.push({ label: `${t.name} (stderr)`, text: t.stderr, tone: 'text-warning' });
  });
  if (lastRun?.custom?.stdout) chunks.push({ label: 'custom input', text: lastRun.custom.stdout });
  if (chunks.length === 0) {
    return (
      <EmptyState icon={FlaskConicalIcon} title="Console is empty">
        Anything your code or the tests print shows up here.
      </EmptyState>
    );
  }
  return (
    <div className="space-y-2 p-3 font-mono text-xs" data-testid="console">
      {chunks.map((c, i) => (
        <div key={`${c.label}-${i}`}>
          <div className="text-muted-foreground"># {c.label}</div>
          <pre className={cn('whitespace-pre-wrap', c.tone)}>{c.text}</pre>
        </div>
      ))}
    </div>
  );
}

export function CustomInputPanel({
  value,
  onChange,
  onRun,
  running,
  lastRun,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  running: boolean;
  lastRun: LastRun | null;
  disabled: boolean;
}) {
  const custom = lastRun?.kind === 'custom' ? lastRun : null;
  return (
    <div className="flex h-full flex-col gap-2 p-3">
      <label htmlFor="custom-input" className="text-xs text-muted-foreground">
        Python to run after your code. The value of the last expression is shown, like a REPL.
      </label>
      <textarea
        id="custom-input"
        className="min-h-20 flex-1 resize-none rounded-md border bg-muted/40 p-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        placeholder={'merge_ranges([(1, 3), (2, 4)])'}
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={onRun}
          disabled={disabled || running || !value.trim()}
        >
          {running ? 'Running…' : 'Run with custom input'}
        </Button>
      </div>
      {custom && (
        <div className="space-y-1 font-mono text-xs" data-testid="custom-output">
          {custom.summary.verdict === 'timeout' || custom.summary.verdict === 'crashed' ? (
            <p className="text-warning">{custom.summary.message}</p>
          ) : custom.result?.error ? (
            <Pre className="text-destructive">{custom.result.error.traceback}</Pre>
          ) : (
            <>
              {(custom.result?.stdout || custom.custom?.stdout) && (
                <Pre>{`${custom.result?.stdout ?? ''}${custom.custom?.stdout ?? ''}`}</Pre>
              )}
              {custom.custom?.error ? (
                <Pre className="text-destructive">{custom.custom.error.traceback}</Pre>
              ) : (
                custom.custom?.value !== null &&
                custom.custom?.value !== undefined && (
                  <Pre className="text-success">{`=> ${custom.custom.value}`}</Pre>
                )
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
