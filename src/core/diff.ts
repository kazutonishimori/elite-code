import { diffLines } from 'diff';

import type { SubmissionRecord } from '@/storage/types';

export interface DiffStats {
  added: number;
  removed: number;
}

/** Line-level change counts between two versions of code. */
export function diffStats(before: string, after: string): DiffStats {
  let added = 0;
  let removed = 0;
  for (const part of diffLines(before, after)) {
    if (part.added) added += part.count;
    else if (part.removed) removed += part.count;
  }
  return { added, removed };
}

/** The submission immediately before `submission` for the same problem (any stage). */
export function previousSubmission(
  history: SubmissionRecord[],
  submission: SubmissionRecord,
): SubmissionRecord | null {
  const sorted = [...history].sort(
    (a, b) => a.createdAt - b.createdAt || (a.id ?? 0) - (b.id ?? 0),
  );
  const index = sorted.findIndex(
    (s) => s === submission || (s.id !== undefined && s.id === submission.id),
  );
  return index > 0 ? (sorted[index - 1] ?? null) : null;
}
