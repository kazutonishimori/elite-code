/** Export / import of all personal data (drafts, submissions, progress, timers, notes, settings). */
import { validateProblem } from '@/core/problemValidation';

import { DEFAULT_SETTINGS, type BackupData, type BackupFile, type Storage } from './types';

export async function createBackup(storage: Storage, now: Date = new Date()): Promise<BackupFile> {
  return {
    app: 'elite-code',
    backupVersion: 1,
    exportedAt: now.toISOString(),
    data: await storage.exportData(),
  };
}

export function backupFileName(now: Date = new Date()): string {
  return `elite-code-backup-${now.toISOString().slice(0, 10)}.json`;
}

export type BackupParseResult = { ok: true; backup: BackupFile } | { ok: false; errors: string[] };

const ARRAY_FIELDS = [
  'drafts',
  'submissions',
  'progress',
  'timers',
  'notes',
  'importedProblems',
] as const;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Validates an uploaded backup before anything is written. */
export function parseBackup(text: string): BackupParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    return { ok: false, errors: [`Not valid JSON: ${(err as Error).message}`] };
  }
  if (!isObject(raw) || raw.app !== 'elite-code')
    return { ok: false, errors: ['Not an Elite Code backup file'] };
  if (raw.backupVersion !== 1)
    return { ok: false, errors: [`Unsupported backup version: ${String(raw.backupVersion)}`] };
  const data = raw.data;
  if (!isObject(data)) return { ok: false, errors: ['Backup has no data section'] };

  const errors: string[] = [];
  for (const field of ARRAY_FIELDS) {
    if (!Array.isArray(data[field])) errors.push(`data.${field} must be an array`);
    else if (!data[field].every(isObject)) errors.push(`data.${field} must only contain objects`);
  }
  if (Array.isArray(data.importedProblems)) {
    data.importedProblems.forEach((record, i) => {
      const result = validateProblem(isObject(record) ? record.problem : undefined);
      if (!result.ok) errors.push(`data.importedProblems[${i}] is not a valid problem`);
    });
  }
  if (errors.length > 0) return { ok: false, errors };

  const settings = isObject(data.settings) ? data.settings : {};
  const backupData: BackupData = {
    ...(data as unknown as BackupData),
    settings: { ...DEFAULT_SETTINGS, ...settings },
  };
  return { ok: true, backup: { ...(raw as unknown as BackupFile), data: backupData } };
}

export async function restoreBackup(storage: Storage, backup: BackupFile): Promise<void> {
  await storage.replaceAll(backup.data);
}
