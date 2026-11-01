/**
 * Persistence contracts. The UI only talks to these interfaces, so IndexedDB (Dexie) could be
 * swapped for a server-backed implementation without touching components.
 */
import type { Verdict } from '@/core/testSelection';
import type { Problem } from '@/types/problem.generated';

export type ProblemStatus = 'unsolved' | 'attempted' | 'solved';
export type Theme = 'dark' | 'light';

export interface DraftRecord {
  problemId: string;
  code: string;
  updatedAt: number;
}

export interface SubmissionTestSummary {
  name: string;
  stageIndex: number;
  status: 'passed' | 'failed' | 'error' | 'skipped';
  regression: boolean;
  message: string | null;
}

export interface SubmissionRecord {
  id?: number;
  problemId: string;
  stageId: string;
  stageIndex: number;
  createdAt: number;
  code: string;
  verdict: Verdict;
  passed: number;
  failed: number;
  total: number;
  regressions: number;
  runtimeMs: number | null;
  tests: SubmissionTestSummary[];
}

export interface StageProgress {
  attempts: number;
  hintsRevealed: number;
  /** Submissions on this stage that broke a test from an earlier stage. */
  regressions: number;
  passedAt: number | null;
  /** The solver's code at the moment the stage was passed (read-only history). */
  snapshotCode: string | null;
  solutionRevealed: boolean;
}

export interface ProgressRecord {
  problemId: string;
  status: ProblemStatus;
  currentStageIndex: number;
  stages: Record<string, StageProgress>;
  startedAt: number | null;
  solvedAt: number | null;
  updatedAt: number;
}

export interface TimerRecord {
  problemId: string;
  stageId: string;
  accumulatedMs: number;
  running: boolean;
  updatedAt: number;
}

export interface NoteRecord {
  problemId: string;
  markdown: string;
  updatedAt: number;
}

export interface ImportedProblemRecord {
  id: string;
  problem: Problem;
  importedAt: number;
}

export interface Settings {
  theme: Theme;
  autoPauseOnHidden: boolean;
}

export const DEFAULT_SETTINGS: Settings = { theme: 'dark', autoPauseOnHidden: true };

export interface BackupData {
  drafts: DraftRecord[];
  submissions: SubmissionRecord[];
  progress: ProgressRecord[];
  timers: TimerRecord[];
  notes: NoteRecord[];
  importedProblems: ImportedProblemRecord[];
  settings: Settings;
}

export interface BackupFile {
  app: 'elite-code';
  backupVersion: 1;
  exportedAt: string;
  data: BackupData;
}

export interface KeyedRepository<T, K> {
  get(key: K): Promise<T | undefined>;
  put(record: T): Promise<void>;
  delete(key: K): Promise<void>;
  list(): Promise<T[]>;
}

export interface SubmissionRepository {
  add(record: SubmissionRecord): Promise<number>;
  listByProblem(problemId: string): Promise<SubmissionRecord[]>;
  list(): Promise<SubmissionRecord[]>;
}

export interface Storage {
  drafts: KeyedRepository<DraftRecord, string>;
  progress: KeyedRepository<ProgressRecord, string>;
  timers: KeyedRepository<TimerRecord, [problemId: string, stageId: string]>;
  notes: KeyedRepository<NoteRecord, string>;
  importedProblems: KeyedRepository<ImportedProblemRecord, string>;
  submissions: SubmissionRepository;
  getSettings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<void>;
  /** Snapshot of everything, for backups. */
  exportData(): Promise<BackupData>;
  /** Replaces all data with the backup's contents, atomically where supported. */
  replaceAll(data: BackupData): Promise<void>;
}
