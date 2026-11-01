import { describe, expect, it } from 'vitest';

import { loadExample } from '@/test/fixtures';

import { backupFileName, createBackup, parseBackup, restoreBackup } from './backup';
import { DexieStorage, EliteCodeDB } from './dexieStorage';
import { MemoryStorage } from './memoryStorage';
import {
  DEFAULT_SETTINGS,
  type ProgressRecord,
  type Storage,
  type SubmissionRecord,
} from './types';

let dbCounter = 0;
const implementations: [string, () => Storage][] = [
  ['MemoryStorage', () => new MemoryStorage()],
  ['DexieStorage', () => new DexieStorage(new EliteCodeDB(`test-${++dbCounter}`))],
];

const submission = (overrides: Partial<SubmissionRecord> = {}): SubmissionRecord => ({
  problemId: 'p1',
  stageId: 's1',
  stageIndex: 0,
  createdAt: 1000,
  code: 'pass',
  verdict: 'failed',
  passed: 1,
  failed: 1,
  total: 2,
  regressions: 0,
  runtimeMs: 12,
  tests: [{ name: 'test_a', stageIndex: 0, status: 'failed', regression: false, message: 'nope' }],
  ...overrides,
});

const progress = (problemId: string): ProgressRecord => ({
  problemId,
  status: 'attempted',
  currentStageIndex: 1,
  stages: {
    s1: {
      attempts: 2,
      hintsRevealed: 1,
      regressions: 0,
      passedAt: 5,
      snapshotCode: 'x',
      solutionRevealed: false,
    },
  },
  startedAt: 1,
  solvedAt: null,
  updatedAt: 5,
});

describe.each(implementations)('%s (repository contract)', (_name, create) => {
  it('stores, updates and deletes keyed records', async () => {
    const storage = create();
    expect(await storage.drafts.get('p1')).toBeUndefined();
    await storage.drafts.put({ problemId: 'p1', code: 'a', updatedAt: 1 });
    await storage.drafts.put({ problemId: 'p1', code: 'b', updatedAt: 2 });
    expect(await storage.drafts.get('p1')).toEqual({ problemId: 'p1', code: 'b', updatedAt: 2 });
    await storage.drafts.delete('p1');
    expect(await storage.drafts.list()).toEqual([]);
  });

  it('keys timers by problem and stage', async () => {
    const storage = create();
    await storage.timers.put({
      problemId: 'p1',
      stageId: 'a',
      accumulatedMs: 10,
      running: false,
      updatedAt: 1,
    });
    await storage.timers.put({
      problemId: 'p1',
      stageId: 'b',
      accumulatedMs: 20,
      running: true,
      updatedAt: 1,
    });
    expect((await storage.timers.get(['p1', 'b']))?.accumulatedMs).toBe(20);
    expect(await storage.timers.list()).toHaveLength(2);
  });

  it('returns copies, not live references', async () => {
    const storage = create();
    await storage.progress.put(progress('p1'));
    const read = await storage.progress.get('p1');
    read!.stages.s1!.attempts = 99;
    expect((await storage.progress.get('p1'))?.stages.s1?.attempts).toBe(2);
  });

  it('appends submissions with ids and lists them chronologically per problem', async () => {
    const storage = create();
    const second = await storage.submissions.add(submission({ createdAt: 2000 }));
    const first = await storage.submissions.add(submission({ createdAt: 1000 }));
    await storage.submissions.add(submission({ problemId: 'p2', createdAt: 1500 }));
    expect(second).not.toBe(first);
    const list = await storage.submissions.listByProblem('p1');
    expect(list.map((s) => s.createdAt)).toEqual([1000, 2000]);
    expect(list[0]!.id).toBe(first);
    expect((await storage.submissions.list()).map((s) => s.problemId)).toEqual(['p1', 'p2', 'p1']);
  });

  it('defaults and persists settings', async () => {
    const storage = create();
    expect(await storage.getSettings()).toEqual(DEFAULT_SETTINGS);
    await storage.saveSettings({ theme: 'light', autoPauseOnHidden: false });
    expect(await storage.getSettings()).toEqual({ theme: 'light', autoPauseOnHidden: false });
  });

  it('round-trips a full backup into a fresh store', async () => {
    const source = create();
    const problem = loadExample('merge-meeting-ranges');
    await source.drafts.put({ problemId: 'p1', code: 'draft', updatedAt: 1 });
    await source.progress.put(progress('p1'));
    await source.notes.put({ problemId: 'p1', markdown: '# notes', updatedAt: 1 });
    await source.timers.put({
      problemId: 'p1',
      stageId: 's1',
      accumulatedMs: 1234,
      running: false,
      updatedAt: 1,
    });
    await source.importedProblems.put({ id: problem.id, problem, importedAt: 3 });
    await source.submissions.add(submission());
    await source.saveSettings({ theme: 'light', autoPauseOnHidden: true });

    const backup = await createBackup(source, new Date('2026-10-31T12:00:00Z'));
    expect(backup).toMatchObject({
      app: 'elite-code',
      backupVersion: 1,
      exportedAt: '2026-10-31T12:00:00.000Z',
    });

    const parsed = parseBackup(JSON.stringify(backup));
    if (!parsed.ok) throw new Error(parsed.errors.join('; '));
    const target = create();
    await target.drafts.put({ problemId: 'stale', code: 'gone', updatedAt: 0 });
    await restoreBackup(target, parsed.backup);
    expect(await target.exportData()).toEqual(backup.data);

    // New submissions after a restore get fresh ids.
    const nextId = await target.submissions.add(submission({ createdAt: 9999 }));
    expect((await target.submissions.list()).map((s) => s.id)).toContain(nextId);
    expect(new Set((await target.submissions.list()).map((s) => s.id)).size).toBe(2);
  });
});

describe('parseBackup', () => {
  it('rejects invalid files with explanations', () => {
    expect(parseBackup('nope')).toMatchObject({
      ok: false,
      errors: [expect.stringMatching(/^Not valid JSON/)],
    });
    expect(parseBackup('{"app":"other"}')).toEqual({
      ok: false,
      errors: ['Not an Elite Code backup file'],
    });
    expect(parseBackup('{"app":"elite-code","backupVersion":9}')).toEqual({
      ok: false,
      errors: ['Unsupported backup version: 9'],
    });
    expect(parseBackup('{"app":"elite-code","backupVersion":1}')).toEqual({
      ok: false,
      errors: ['Backup has no data section'],
    });
    const result = parseBackup(
      JSON.stringify({
        app: 'elite-code',
        backupVersion: 1,
        data: {
          drafts: {},
          submissions: [1],
          progress: [],
          timers: [],
          notes: [],
          importedProblems: [{ problem: {} }],
        },
      }),
    );
    expect(result).toEqual({
      ok: false,
      errors: [
        'data.drafts must be an array',
        'data.submissions must only contain objects',
        'data.importedProblems[0] is not a valid problem',
      ],
    });
  });

  it('fills in missing settings with defaults', () => {
    const result = parseBackup(
      JSON.stringify({
        app: 'elite-code',
        backupVersion: 1,
        exportedAt: 'x',
        data: {
          drafts: [],
          submissions: [],
          progress: [],
          timers: [],
          notes: [],
          importedProblems: [],
        },
      }),
    );
    expect(result.ok && result.backup.data.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('names backup files by date', () => {
    expect(backupFileName(new Date('2026-01-02T03:04:05Z'))).toBe(
      'elite-code-backup-2026-01-02.json',
    );
  });
});
