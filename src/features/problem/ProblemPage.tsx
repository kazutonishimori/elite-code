import { ArrowLeftIcon, FileQuestionIcon, PlayIcon, RotateCcwIcon, SendIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useStore } from 'zustand';

import { useServices } from '@/app/services';
import { CodeEditor } from '@/components/editor/CodeEditor';
import { EmptyState, Spinner } from '@/components/States';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip } from '@/components/ui/tooltip';
import {
  initialProgress,
  isSolutionUnlocked,
  revealedStageCount,
  revealHint,
  revealSolution,
  stageProgress,
} from '@/core/progress';
import { matchShortcut, modKey } from '@/features/shortcuts/shortcuts';
import { useAppStore } from '@/store/useAppStore';
import { useRunnerState } from '@/store/useRunnerState';
import type { Problem } from '@/types/problem.generated';

import { DescriptionPanel } from './DescriptionPanel';
import { HintsPanel } from './HintsPanel';
import { HistoryPanel } from './HistoryPanel';
import { NotesPanel } from './NotesPanel';
import { ConsolePanel, CustomInputPanel, ResultsPanel } from './ResultsPanel';
import { createSessionStore, type RunKind } from './sessionStore';
import { SolutionPanel } from './SolutionPanel';
import { StageCompleteDialog } from './StageCompleteDialog';
import { StageStepper } from './StageStepper';
import { TimerControl } from './TimerControl';
import { useStageTimer } from './useStageTimer';

export function ProblemRoute() {
  const { problemId = '' } = useParams();
  const problem = useAppStore((s) => s.problems.find((p) => p.id === problemId));
  if (!problem) {
    return (
      <EmptyState
        icon={FileQuestionIcon}
        title="Problem not found"
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/">Back to problems</Link>
          </Button>
        }
      >
        There is no problem with the id “{problemId}”. It may have been removed from your library.
      </EmptyState>
    );
  }
  return <ProblemPage key={problem.id} problem={problem} />;
}

export function ProblemPage({ problem }: { problem: Problem }) {
  const services = useServices();
  const { runner, storage, store, now } = services;
  const navigate = useNavigate();
  const theme = useAppStore((s) => s.settings.theme);
  const progress = useAppStore((s) => s.progress[problem.id]) ?? initialProgress(problem.id);
  const allSubmissions = useAppStore((s) => s.submissions);
  const submissions = useMemo(
    () => allSubmissions.filter((s) => s.problemId === problem.id),
    [allSubmissions, problem.id],
  );
  const runnerState = useRunnerState();

  const currentIndex = Math.min(progress.currentStageIndex, problem.stages.length - 1);
  const currentStage = problem.stages[currentIndex] ?? problem.stages[0];
  const revealed = revealedStageCount(progress, problem);
  const [viewIndex, setViewIndex] = useState(currentIndex);
  const viewStage = problem.stages[Math.min(viewIndex, revealed - 1)] ?? currentStage;
  const [leftTab, setLeftTab] = useState('description');
  const [bottomTab, setBottomTab] = useState('results');

  const timer = useStageTimer(problem.id, currentStage.id);
  const [session] = useState(() =>
    createSessionStore({ problem, runner, storage, app: store, now }),
  );

  // The stage timer starts by itself on the first edit or run.
  const { ensureStarted } = timer;
  useEffect(
    () =>
      session.subscribe((state, previous) => {
        if (state.activity !== previous.activity) ensureStarted();
      }),
    [session, ensureStarted],
  );
  const code = useStore(session, (s) => s.code);
  const draftLoaded = useStore(session, (s) => s.draftLoaded);
  const running = useStore(session, (s) => s.running);
  const lastRun = useStore(session, (s) => s.lastRun);
  const customInput = useStore(session, (s) => s.customInput);
  const celebration = useStore(session, (s) => s.celebration);

  useEffect(() => {
    void session.getState().loadDraft();
  }, [session]);

  const descriptions = useMemo(
    () =>
      Object.fromEntries(
        problem.stages
          .flatMap((s) => [...s.visibleTests, ...s.hiddenTests])
          .map((t) => [t.name, t.description]),
      ),
    [problem],
  );

  const execute = (kind: RunKind) => {
    setBottomTab(kind === 'custom' ? 'custom' : 'results');
    void session.getState().execute(kind, currentIndex);
  };
  const executeRef = useRef(execute);
  useEffect(() => {
    executeRef.current = execute;
  });

  // Run / Submit shortcuts work everywhere, including inside Monaco (capture phase).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const id = matchShortcut(event);
      if (id !== 'run' && id !== 'submit') return;
      event.preventDefault();
      event.stopPropagation();
      executeRef.current(id);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const saveProgress = store.getState().saveProgress;
  const viewProgress = stageProgress(progress, viewStage.id);
  const celebrationStage = celebration ? problem.stages[celebration.stageIndex] : undefined;

  const continueAfterCelebration = () => {
    const event = celebration?.event;
    session.getState().dismissCelebration();
    setViewIndex(currentIndex);
    setLeftTab('description');
    if (event === 'stage-passed') timer.start();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-1.5">
        <Button asChild variant="ghost" size="sm">
          <Link to="/">
            <ArrowLeftIcon /> Problems
          </Link>
        </Button>
        <span className="truncate text-sm font-medium">{problem.title}</span>
        {problem.type === 'simulation' && (
          <StageStepper
            stages={problem.stages}
            progress={(id) => stageProgress(progress, id)}
            revealedCount={revealed}
            currentIndex={currentIndex}
            viewIndex={viewIndex}
            onSelect={(i) => {
              setViewIndex(i);
              setLeftTab('description');
            }}
          />
        )}
        <div className="ml-auto flex items-center gap-2">
          <TimerControl timer={timer} stageNumber={currentIndex + 1} />
          <AlertDialog>
            <Tooltip content="Reset to starter code">
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Reset to starter code">
                  <RotateCcwIcon />
                </Button>
              </AlertDialogTrigger>
            </Tooltip>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset to starter code?</AlertDialogTitle>
                <AlertDialogDescription>
                  Your current code will be replaced. Submitted versions stay in your history.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() => void session.getState().resetToStarter()}
                >
                  Reset
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Tooltip
            content={
              <span>
                Run visible tests · <Kbd>{modKey()}</Kbd> <Kbd>Enter</Kbd>
              </span>
            }
          >
            <Button
              variant="secondary"
              size="sm"
              disabled={running !== null}
              onClick={() => execute('run')}
            >
              <PlayIcon /> {running === 'run' ? 'Running…' : 'Run'}
            </Button>
          </Tooltip>
          <Tooltip
            content={
              <span>
                Submit all tests · <Kbd>{modKey()}</Kbd> <Kbd>Shift</Kbd> <Kbd>Enter</Kbd>
              </span>
            }
          >
            <Button size="sm" disabled={running !== null} onClick={() => execute('submit')}>
              <SendIcon /> {running === 'submit' ? 'Submitting…' : 'Submit'}
            </Button>
          </Tooltip>
        </div>
      </div>

      {runnerState.status === 'error' && (
        <div
          role="alert"
          className="flex items-center gap-3 border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-sm"
        >
          Python failed to load: {runnerState.error}
          <Button size="sm" variant="outline" onClick={() => void runner.warmUp()}>
            Retry
          </Button>
        </div>
      )}

      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
        <ResizablePanel defaultSize="42" minSize="25">
          <Tabs value={leftTab} onValueChange={setLeftTab} className="flex h-full flex-col">
            <TabsList className="m-2 mb-0 shrink-0 self-start">
              <TabsTrigger value="description">Description</TabsTrigger>
              <TabsTrigger value="hints">
                Hints {stageProgress(progress, viewStage.id).hintsRevealed}/{viewStage.hints.length}
              </TabsTrigger>
              <TabsTrigger value="solution">Solution</TabsTrigger>
              <TabsTrigger value="history">
                Submissions{submissions.length > 0 && ` (${submissions.length})`}
              </TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <TabsContent value="description">
                <DescriptionPanel
                  problem={problem}
                  viewIndex={problem.stages.indexOf(viewStage)}
                  currentIndex={currentIndex}
                  stageProgress={viewProgress}
                  theme={theme}
                />
              </TabsContent>
              <TabsContent value="hints">
                <HintsPanel
                  stage={viewStage}
                  revealed={viewProgress.hintsRevealed}
                  onReveal={() =>
                    void saveProgress(revealHint(progress, problem, viewStage.id, now()))
                  }
                />
              </TabsContent>
              <TabsContent value="solution">
                <SolutionPanel
                  stage={viewStage}
                  stageNumber={
                    problem.type === 'simulation' ? problem.stages.indexOf(viewStage) + 1 : 0
                  }
                  unlocked={isSolutionUnlocked(progress, viewStage.id)}
                  onReveal={() => void saveProgress(revealSolution(progress, viewStage.id, now()))}
                />
              </TabsContent>
              <TabsContent value="history">
                <HistoryPanel submissions={submissions} theme={theme} />
              </TabsContent>
              <TabsContent value="notes" className="h-full">
                <NotesPanel problemId={problem.id} />
              </TabsContent>
            </div>
          </Tabs>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel minSize="30">
          <ResizablePanelGroup orientation="vertical">
            <ResizablePanel defaultSize="60" minSize="20">
              {draftLoaded ? (
                <CodeEditor
                  value={code}
                  onChange={(v) => session.getState().setCode(v)}
                  theme={theme}
                  exposeForTests
                />
              ) : (
                <Spinner className="p-4" label="Loading your draft…" />
              )}
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize="40" minSize="15">
              <Tabs value={bottomTab} onValueChange={setBottomTab} className="flex h-full flex-col">
                <TabsList className="m-2 mb-0 shrink-0 self-start">
                  <TabsTrigger value="results">Test results</TabsTrigger>
                  <TabsTrigger value="console">Console</TabsTrigger>
                  <TabsTrigger value="custom">Custom input</TabsTrigger>
                </TabsList>
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <TabsContent value="results">
                    <ResultsPanel lastRun={lastRun} running={running} descriptions={descriptions} />
                  </TabsContent>
                  <TabsContent value="console">
                    <ConsolePanel lastRun={lastRun} />
                  </TabsContent>
                  <TabsContent value="custom" className="h-full">
                    <CustomInputPanel
                      value={customInput}
                      onChange={(v) => session.getState().setCustomInput(v)}
                      onRun={() => execute('custom')}
                      running={running === 'custom'}
                      lastRun={lastRun}
                      disabled={running !== null}
                    />
                  </TabsContent>
                </div>
              </Tabs>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>

      <StageCompleteDialog
        problem={problem}
        celebration={celebration}
        stageTimeMs={
          celebrationStage
            ? (store.getState().timers[`${problem.id}::${celebrationStage.id}`]?.accumulatedMs ?? 0)
            : 0
        }
        attempts={celebrationStage ? stageProgress(progress, celebrationStage.id).attempts : 0}
        onContinue={continueAfterCelebration}
        onDebrief={() => {
          session.getState().dismissCelebration();
          void navigate(`/problems/${problem.id}/debrief`);
        }}
      />
    </div>
  );
}
