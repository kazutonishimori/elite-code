/**
 * Global app state (Zustand): the problem library, progress, timers, submissions and settings.
 * Every mutation writes through to Storage first, then updates the in-memory state.
 */
import { createStore, type StoreApi } from 'zustand/vanilla';

import { buildLibrary, type ProblemSource } from '@/problems/library';
import type {
  BackupFile,
  ProgressRecord,
  Settings,
  Storage,
  SubmissionRecord,
  TimerRecord,
} from '@/storage/types';
import { DEFAULT_SETTINGS } from '@/storage/types';
import type { Problem } from '@/types/problem.generated';

export interface AppState {
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  problems: Problem[];
  sources: Record<string, ProblemSource>;
  progress: Record<string, ProgressRecord>;
  timers: Record<string, TimerRecord>;
  submissions: SubmissionRecord[];
  settings: Settings;
  init(): Promise<void>;
  saveProgress(record: ProgressRecord): Promise<void>;
  saveTimer(record: TimerRecord): Promise<void>;
  addSubmission(record: SubmissionRecord): Promise<SubmissionRecord>;
  importProblem(problem: Problem, now: number): Promise<void>;
  removeImportedProblem(id: string): Promise<void>;
  updateSettings(patch: Partial<Settings>): Promise<void>;
  restore(backup: BackupFile): Promise<void>;
}

export const timerKey = (problemId: string, stageId: string) => `${problemId}::${stageId}`;

export function createAppStore(storage: Storage, bundled: Problem[]): StoreApi<AppState> {
  return createStore<AppState>()((set, get) => {
    const load = async () => {
      const [imported, progress, timers, submissions, settings] = await Promise.all([
        storage.importedProblems.list(),
        storage.progress.list(),
        storage.timers.list(),
        storage.submissions.list(),
        storage.getSettings(),
      ]);
      set({
        ...buildLibrary(bundled, imported),
        progress: Object.fromEntries(progress.map((p) => [p.problemId, p])),
        timers: Object.fromEntries(timers.map((t) => [timerKey(t.problemId, t.stageId), t])),
        submissions,
        settings,
        status: 'ready',
        error: null,
      });
    };

    return {
      status: 'loading',
      error: null,
      ...buildLibrary(bundled, []),
      progress: {},
      timers: {},
      submissions: [],
      settings: DEFAULT_SETTINGS,

      async init() {
        try {
          await load();
        } catch (err) {
          set({ status: 'error', error: err instanceof Error ? err.message : String(err) });
        }
      },

      async saveProgress(record) {
        await storage.progress.put(record);
        set({ progress: { ...get().progress, [record.problemId]: record } });
      },

      async saveTimer(record) {
        await storage.timers.put(record);
        set({ timers: { ...get().timers, [timerKey(record.problemId, record.stageId)]: record } });
      },

      async addSubmission(record) {
        const id = await storage.submissions.add(record);
        const saved = { ...record, id };
        set({ submissions: [...get().submissions, saved] });
        return saved;
      },

      async importProblem(problem, now) {
        if (get().sources[problem.id] === 'bundled') {
          throw new Error(
            `"${problem.id}" is a built-in problem; give the imported problem a different id`,
          );
        }
        await storage.importedProblems.put({ id: problem.id, problem, importedAt: now });
        set(buildLibrary(bundled, await storage.importedProblems.list()));
      },

      async removeImportedProblem(id) {
        await storage.importedProblems.delete(id);
        set(buildLibrary(bundled, await storage.importedProblems.list()));
      },

      async updateSettings(patch) {
        const settings = { ...get().settings, ...patch };
        await storage.saveSettings(settings);
        set({ settings });
      },

      async restore(backup) {
        await storage.replaceAll(backup.data);
        await load();
      },
    };
  });
}
