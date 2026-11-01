/**
 * IndexedDB writes started during `pagehide` may not finish before the page unloads, so the
 * last timer state is also journaled synchronously to localStorage. On restore, the newer of
 * the IndexedDB record and the journal entry wins; the entry is then written back to IndexedDB
 * and cleared.
 */
import type { TimerRecord } from './types';

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const PREFIX = 'elite-code:timer-journal:';

const keyOf = (problemId: string, stageId: string) => `${PREFIX}${problemId}::${stageId}`;

export function writeTimerJournal(
  record: TimerRecord,
  storage: Pick<KeyValueStore, 'setItem'> = window.localStorage,
): void {
  try {
    storage.setItem(keyOf(record.problemId, record.stageId), JSON.stringify(record));
  } catch {
    // Storage may be unavailable (private mode, quota): IndexedDB remains the source of truth.
  }
}

/** Returns the journaled record, if any, without removing it (safe to call during render). */
export function peekTimerJournal(
  problemId: string,
  stageId: string,
  storage: Pick<KeyValueStore, 'getItem'> = window.localStorage,
): TimerRecord | undefined {
  try {
    const raw = storage.getItem(keyOf(problemId, stageId));
    if (raw === null) return undefined;
    const record = JSON.parse(raw) as TimerRecord;
    return typeof record.accumulatedMs === 'number' && typeof record.updatedAt === 'number'
      ? record
      : undefined;
  } catch {
    return undefined;
  }
}

export function clearTimerJournal(
  problemId: string,
  stageId: string,
  storage: Pick<KeyValueStore, 'removeItem'> = window.localStorage,
): void {
  try {
    storage.removeItem(keyOf(problemId, stageId));
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
}

export function newerTimerRecord(
  a: TimerRecord | undefined,
  b: TimerRecord | undefined,
): TimerRecord | undefined {
  if (!a) return b;
  if (!b) return a;
  return b.updatedAt > a.updatedAt ? b : a;
}
