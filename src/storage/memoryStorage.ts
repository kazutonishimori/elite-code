import {
  DEFAULT_SETTINGS,
  type BackupData,
  type KeyedRepository,
  type Settings,
  type Storage,
  type SubmissionRecord,
} from './types';

const clone = <T>(value: T): T => structuredClone(value);

class MemoryRepository<T, K> implements KeyedRepository<T, K> {
  readonly rows = new Map<string, T>();
  private readonly keyOf: (record: T) => K;

  constructor(keyOf: (record: T) => K) {
    this.keyOf = keyOf;
  }

  private static id(key: unknown): string {
    return JSON.stringify(key);
  }

  get(key: K) {
    const row = this.rows.get(MemoryRepository.id(key));
    return Promise.resolve(row === undefined ? undefined : clone(row));
  }

  put(record: T) {
    this.rows.set(MemoryRepository.id(this.keyOf(record)), clone(record));
    return Promise.resolve();
  }

  delete(key: K) {
    this.rows.delete(MemoryRepository.id(key));
    return Promise.resolve();
  }

  list() {
    return Promise.resolve([...this.rows.values()].map(clone));
  }

  replace(records: T[]) {
    this.rows.clear();
    records.forEach((r) => this.rows.set(MemoryRepository.id(this.keyOf(r)), clone(r)));
  }
}

/** In-memory Storage: used by component tests and as a reference implementation. */
export class MemoryStorage implements Storage {
  readonly drafts = new MemoryRepository((r: BackupData['drafts'][number]) => r.problemId);
  readonly progress = new MemoryRepository((r: BackupData['progress'][number]) => r.problemId);
  readonly timers = new MemoryRepository((r: BackupData['timers'][number]): [string, string] => [
    r.problemId,
    r.stageId,
  ]);
  readonly notes = new MemoryRepository((r: BackupData['notes'][number]) => r.problemId);
  readonly importedProblems = new MemoryRepository(
    (r: BackupData['importedProblems'][number]) => r.id,
  );
  private submissionRows: SubmissionRecord[] = [];
  private nextSubmissionId = 1;
  private settings: Settings = { ...DEFAULT_SETTINGS };

  readonly submissions = {
    add: (record: SubmissionRecord) => {
      const id = record.id ?? this.nextSubmissionId;
      this.nextSubmissionId = Math.max(this.nextSubmissionId, id) + 1;
      this.submissionRows.push(clone({ ...record, id }));
      return Promise.resolve(id);
    },
    listByProblem: (problemId: string) =>
      Promise.resolve(
        this.submissionRows
          .filter((s) => s.problemId === problemId)
          .sort((a, b) => a.createdAt - b.createdAt)
          .map(clone),
      ),
    list: () =>
      Promise.resolve(
        [...this.submissionRows].sort((a, b) => a.createdAt - b.createdAt).map(clone),
      ),
  };

  getSettings() {
    return Promise.resolve({ ...this.settings });
  }

  saveSettings(settings: Settings) {
    this.settings = { ...settings };
    return Promise.resolve();
  }

  async exportData(): Promise<BackupData> {
    return {
      drafts: await this.drafts.list(),
      submissions: await this.submissions.list(),
      progress: await this.progress.list(),
      timers: await this.timers.list(),
      notes: await this.notes.list(),
      importedProblems: await this.importedProblems.list(),
      settings: await this.getSettings(),
    };
  }

  replaceAll(data: BackupData) {
    this.drafts.replace(data.drafts);
    this.progress.replace(data.progress);
    this.timers.replace(data.timers);
    this.notes.replace(data.notes);
    this.importedProblems.replace(data.importedProblems);
    this.submissionRows = data.submissions.map(clone);
    this.nextSubmissionId = Math.max(0, ...data.submissions.map((s) => s.id ?? 0)) + 1;
    this.settings = { ...data.settings };
    return Promise.resolve();
  }
}
