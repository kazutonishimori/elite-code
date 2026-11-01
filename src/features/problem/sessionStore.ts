/**
 * State for one open problem: the editor code, the current stage, and the last run's results.
 * Run / Submit / custom runs go through the CodeRunner; Submit also records the submission and
 * advances simulation stages via the app store.
 */
import { createStore, type StoreApi } from 'zustand/vanilla';

import {
  applySubmission,
  initialProgress,
  markStarted,
  type SubmissionEvent,
  toSubmissionRecord,
} from '@/core/progress';
import { buildRunRequest, summarizeOutcome, type RunSummary } from '@/core/testSelection';
import type { CodeRunner, HarnessCustomResult, HarnessResult } from '@/runner/types';
import type { Storage } from '@/storage/types';
import type { AppState } from '@/store/appStore';
import type { Problem } from '@/types/problem.generated';

export type RunKind = 'run' | 'submit' | 'custom';

export interface StageCelebration {
  event: Extract<SubmissionEvent, 'stage-passed' | 'problem-solved'>;
  stageIndex: number;
}

export interface LastRun {
  kind: RunKind;
  stageIndex: number;
  summary: RunSummary;
  result: HarnessResult | null;
  custom: HarnessCustomResult | null;
  finishedAt: number;
}

export interface SessionState {
  code: string;
  draftLoaded: boolean;
  running: RunKind | null;
  lastRun: LastRun | null;
  customInput: string;
  celebration: StageCelebration | null;
  /** Increments whenever the solver edits or runs code (used to auto-start the stage timer). */
  activity: number;
  loadDraft(): Promise<void>;
  setCode(code: string): void;
  setCustomInput(input: string): void;
  resetToStarter(): Promise<void>;
  execute(kind: RunKind, stageIndex: number): Promise<LastRun | null>;
  dismissCelebration(): void;
}

export interface SessionDeps {
  problem: Problem;
  runner: CodeRunner;
  storage: Storage;
  app: StoreApi<AppState>;
  now: () => number;
}

export const DRAFT_SAVE_DELAY_MS = 600;

export function createSessionStore(deps: SessionDeps): StoreApi<SessionState> {
  const { problem, runner, storage, app, now } = deps;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  const progressOf = () =>
    app.getState().progress[problem.id] ?? initialProgress(problem.id, now());

  return createStore<SessionState>()((set, get) => {
    const saveDraft = (code: string) => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        saveTimer = null;
        void storage.drafts.put({ problemId: problem.id, code, updatedAt: now() });
      }, DRAFT_SAVE_DELAY_MS);
    };

    return {
      code: problem.starterCode,
      draftLoaded: false,
      running: null,
      lastRun: null,
      customInput: '',
      celebration: null,
      activity: 0,

      async loadDraft() {
        const draft = await storage.drafts.get(problem.id);
        set({ code: draft?.code ?? problem.starterCode, draftLoaded: true });
      },

      setCode(code) {
        if (code === get().code) return;
        set({ code, activity: get().activity + 1 });
        saveDraft(code);
      },

      setCustomInput(customInput) {
        set({ customInput });
      },

      async resetToStarter() {
        if (saveTimer) clearTimeout(saveTimer);
        set({ code: problem.starterCode });
        await storage.drafts.put({
          problemId: problem.id,
          code: problem.starterCode,
          updatedAt: now(),
        });
      },

      async execute(kind, stageIndex) {
        if (get().running) return null;
        set({ running: kind, activity: get().activity + 1 });
        const code = get().code;
        const outcome = await runner.run(
          buildRunRequest(problem, stageIndex, kind, code, get().customInput),
        );
        const summary = summarizeOutcome(outcome, stageIndex);
        const result = outcome.kind === 'completed' ? outcome.result : null;
        const lastRun: LastRun = {
          kind,
          stageIndex,
          summary,
          result,
          custom: result?.custom ?? null,
          finishedAt: now(),
        };

        const progress = progressOf();
        const stage = problem.stages[stageIndex];
        if (kind === 'submit' && stage) {
          const at = now();
          await app
            .getState()
            .addSubmission(toSubmissionRecord(problem.id, stage.id, stageIndex, summary, code, at));
          const update = applySubmission(progress, problem, stageIndex, summary, code, at);
          await app.getState().saveProgress(update.progress);
          if (update.event === 'stage-passed' || update.event === 'problem-solved') {
            set({ celebration: { event: update.event, stageIndex } });
          }
        } else {
          const started = markStarted(progress, now());
          const next =
            started.status === 'unsolved' ? { ...started, status: 'attempted' as const } : started;
          if (next !== progress) await app.getState().saveProgress(next);
        }

        set({ running: null, lastRun });
        return lastRun;
      },

      dismissCelebration() {
        set({ celebration: null });
      },
    };
  });
}
