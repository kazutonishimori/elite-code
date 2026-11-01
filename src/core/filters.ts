import type { ProblemStatus, ProgressRecord } from '@/storage/types';
import type { Problem } from '@/types/problem.generated';

export interface ProblemFilters {
  search: string;
  type: Problem['type'] | 'all';
  difficulty: Problem['difficulty'] | 'all';
  tag: string | 'all';
  status: ProblemStatus | 'all';
}

export const DEFAULT_FILTERS: ProblemFilters = {
  search: '',
  type: 'all',
  difficulty: 'all',
  tag: 'all',
  status: 'all',
};

export function problemStatus(progress: Record<string, ProgressRecord>, id: string): ProblemStatus {
  return progress[id]?.status ?? 'unsolved';
}

/** Case-insensitive search over title, summary, tags, topics and companies. */
export function filterProblems(
  problems: Problem[],
  progress: Record<string, ProgressRecord>,
  filters: ProblemFilters,
): Problem[] {
  const terms = filters.search.toLowerCase().split(/\s+/).filter(Boolean);
  return problems.filter((p) => {
    if (filters.type !== 'all' && p.type !== filters.type) return false;
    if (filters.difficulty !== 'all' && p.difficulty !== filters.difficulty) return false;
    if (filters.tag !== 'all' && !p.tags.includes(filters.tag as never)) return false;
    if (filters.status !== 'all' && problemStatus(progress, p.id) !== filters.status) return false;
    if (terms.length === 0) return true;
    const haystack = [p.title, p.summary, ...p.tags, ...(p.topics ?? []), ...(p.companies ?? [])]
      .join(' ')
      .toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}

export function isFiltered(filters: ProblemFilters): boolean {
  return (Object.keys(DEFAULT_FILTERS) as (keyof ProblemFilters)[]).some(
    (k) => filters[k] !== DEFAULT_FILTERS[k],
  );
}

export function availableTags(problems: Problem[]): string[] {
  return [...new Set(problems.flatMap((p) => p.tags))].sort();
}
