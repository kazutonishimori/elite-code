import Dexie, { type EntityTable, type Table } from 'dexie';

import {
  DEFAULT_SETTINGS,
  type BackupData,
  type DraftRecord,
  type ImportedProblemRecord,
  type KeyedRepository,
  type NoteRecord,
  type ProgressRecord,
  type Settings,
  type Storage,
  type SubmissionRecord,
  type TimerRecord,
} from './types';

interface SettingsRow extends Settings {
  key: 'settings';
}

export class EliteCodeDB extends Dexie {
  drafts!: Table<DraftRecord, string>;
  submissions!: EntityTable<SubmissionRecord, 'id'>;
  progress!: Table<ProgressRecord, string>;
  timers!: Table<TimerRecord, [string, string]>;
  notes!: Table<NoteRecord, string>;
  importedProblems!: Table<ImportedProblemRecord, string>;
  settings!: Table<SettingsRow, string>;

  constructor(name = 'elite-code') {
    super(name);
    this.version(1).stores({
      drafts: 'problemId',
      submissions: '++id, problemId, createdAt',
      progress: 'problemId',
      timers: '[problemId+stageId], problemId',
      notes: 'problemId',
      importedProblems: 'id',
      settings: 'key',
    });
  }
}

function repository<T, K>(table: Table<T, K>): KeyedRepository<T, K> {
  return {
    get: (key) => table.get(key as never),
    put: async (record) => {
      await table.put(record);
    },
    delete: (key) => table.delete(key),
    list: () => table.toArray(),
  };
}

/** IndexedDB-backed Storage: everything stays on this machine. */
export class DexieStorage implements Storage {
  readonly db: EliteCodeDB;
  readonly drafts: KeyedRepository<DraftRecord, string>;
  readonly progress: KeyedRepository<ProgressRecord, string>;
  readonly timers: KeyedRepository<TimerRecord, [string, string]>;
  readonly notes: KeyedRepository<NoteRecord, string>;
  readonly importedProblems: KeyedRepository<ImportedProblemRecord, string>;
  readonly submissions;

  constructor(db = new EliteCodeDB()) {
    this.db = db;
    this.drafts = repository(db.drafts);
    this.progress = repository(db.progress);
    this.timers = repository(db.timers);
    this.notes = repository(db.notes);
    this.importedProblems = repository(db.importedProblems);
    this.submissions = {
      add: async (record: SubmissionRecord) => db.submissions.add(record) as Promise<number>,
      listByProblem: (problemId: string) =>
        db.submissions.where('problemId').equals(problemId).sortBy('createdAt'),
      list: () => db.submissions.orderBy('createdAt').toArray(),
    };
  }

  async getSettings(): Promise<Settings> {
    const row = await this.db.settings.get('settings');
    if (!row) return { ...DEFAULT_SETTINGS };
    const { key: _key, ...settings } = row;
    return { ...DEFAULT_SETTINGS, ...settings };
  }

  async saveSettings(settings: Settings): Promise<void> {
    await this.db.settings.put({ ...settings, key: 'settings' });
  }

  async exportData(): Promise<BackupData> {
    return this.db.transaction('r', this.db.tables, async () => ({
      drafts: await this.db.drafts.toArray(),
      submissions: await this.db.submissions.orderBy('createdAt').toArray(),
      progress: await this.db.progress.toArray(),
      timers: await this.db.timers.toArray(),
      notes: await this.db.notes.toArray(),
      importedProblems: await this.db.importedProblems.toArray(),
      settings: await this.getSettings(),
    }));
  }

  async replaceAll(data: BackupData): Promise<void> {
    await this.db.transaction('rw', this.db.tables, async () => {
      await Promise.all(this.db.tables.map((t) => t.clear()));
      await this.db.drafts.bulkPut(data.drafts);
      await this.db.submissions.bulkPut(data.submissions);
      await this.db.progress.bulkPut(data.progress);
      await this.db.timers.bulkPut(data.timers);
      await this.db.notes.bulkPut(data.notes);
      await this.db.importedProblems.bulkPut(data.importedProblems);
      await this.saveSettings(data.settings);
    });
  }
}
