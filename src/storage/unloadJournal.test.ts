import { beforeEach, describe, expect, it } from 'vitest';

import type { TimerRecord } from './types';
import {
  clearTimerJournal,
  newerTimerRecord,
  peekTimerJournal,
  writeTimerJournal,
} from './unloadJournal';

const record = (accumulatedMs: number, updatedAt: number): TimerRecord => ({
  problemId: 'p',
  stageId: 's',
  accumulatedMs,
  running: true,
  updatedAt,
});

beforeEach(() => {
  localStorage.clear();
});

describe('timer unload journal', () => {
  it('round-trips a record until cleared', () => {
    writeTimerJournal(record(1500, 10));
    expect(peekTimerJournal('p', 's')).toEqual(record(1500, 10));
    expect(peekTimerJournal('p', 's')).toEqual(record(1500, 10));
    clearTimerJournal('p', 's');
    expect(peekTimerJournal('p', 's')).toBeUndefined();
  });

  it('ignores malformed entries and unavailable storage', () => {
    localStorage.setItem('elite-code:timer-journal:p::s', '{"nope": true}');
    expect(peekTimerJournal('p', 's')).toBeUndefined();
    localStorage.setItem('elite-code:timer-journal:p::s', 'not json');
    expect(peekTimerJournal('p', 's')).toBeUndefined();
    const fail = () => {
      throw new Error('storage disabled');
    };
    expect(() => writeTimerJournal(record(1, 1), { setItem: fail })).not.toThrow();
    expect(() => clearTimerJournal('p', 's', { removeItem: fail })).not.toThrow();
  });

  it('picks the most recently updated record', () => {
    expect(newerTimerRecord(undefined, record(1, 1))).toEqual(record(1, 1));
    expect(newerTimerRecord(record(1, 1), undefined)).toEqual(record(1, 1));
    expect(newerTimerRecord(record(1, 5), record(2, 9))).toEqual(record(2, 9));
    expect(newerTimerRecord(record(1, 9), record(2, 5))).toEqual(record(1, 9));
  });
});
