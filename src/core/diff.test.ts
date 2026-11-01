import { describe, expect, it } from 'vitest';

import type { SubmissionRecord } from '@/storage/types';

import { diffStats, previousSubmission } from './diff';

const sub = (id: number, createdAt: number) =>
  ({ id, createdAt, code: `v${id}` }) as SubmissionRecord;

describe('diffStats', () => {
  it('counts added and removed lines', () => {
    expect(diffStats('a\nb\nc\n', 'a\nB\nc\nd\n')).toEqual({ added: 2, removed: 1 });
    expect(diffStats('same\n', 'same\n')).toEqual({ added: 0, removed: 0 });
  });
});

describe('previousSubmission', () => {
  const history = [sub(3, 300), sub(1, 100), sub(2, 200), sub(4, 200)];

  it('finds the chronologically previous submission', () => {
    expect(previousSubmission(history, history[0]!)?.id).toBe(4);
    expect(previousSubmission(history, history[3]!)?.id).toBe(2);
    expect(previousSubmission(history, history[2]!)?.id).toBe(1);
  });

  it('returns null for the first or an unknown submission', () => {
    expect(previousSubmission(history, history[1]!)).toBeNull();
    expect(previousSubmission(history, sub(99, 1))).toBeNull();
    const noIds = [{ createdAt: 1 }, { createdAt: 2 }] as SubmissionRecord[];
    expect(previousSubmission(noIds, noIds[1]!)).toBe(noIds[0]);
  });
});
