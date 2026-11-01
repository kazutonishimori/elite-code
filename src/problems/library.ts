/** The problem library: problems bundled from /problems plus problems imported in the app. */
import type { ImportedProblemRecord } from '@/storage/types';
import type { Problem } from '@/types/problem.generated';

export type ProblemSource = 'bundled' | 'imported';

const DIFFICULTY_ORDER: Record<Problem['difficulty'], number> = { easy: 0, medium: 1, hard: 2 };

export function sortProblems(problems: Problem[]): Problem[] {
  return [...problems].sort(
    (a, b) =>
      Number(a.type === 'simulation') - Number(b.type === 'simulation') ||
      DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty] ||
      a.title.localeCompare(b.title),
  );
}

export interface Library {
  problems: Problem[];
  sources: Record<string, ProblemSource>;
}

/** Bundled problems win on id clashes (imports with a bundled id are rejected up front). */
export function buildLibrary(bundled: Problem[], imported: ImportedProblemRecord[]): Library {
  const sources: Record<string, ProblemSource> = {};
  const byId = new Map<string, Problem>();
  for (const record of imported) {
    byId.set(record.id, record.problem);
    sources[record.id] = 'imported';
  }
  for (const problem of bundled) {
    byId.set(problem.id, problem);
    sources[problem.id] = 'bundled';
  }
  return { problems: sortProblems([...byId.values()]), sources };
}
