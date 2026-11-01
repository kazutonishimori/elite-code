import { SearchIcon, SearchXIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';

import { DifficultyBadge, StatusIcon, TypeBadge } from '@/components/ProblemBadges';
import { EmptyState } from '@/components/States';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import {
  availableTags,
  DEFAULT_FILTERS,
  filterProblems,
  isFiltered,
  problemStatus,
  type ProblemFilters,
} from '@/core/filters';
import { useAppStore } from '@/store/useAppStore';

export function ProblemListPage() {
  const problems = useAppStore((s) => s.problems);
  const progress = useAppStore((s) => s.progress);
  const sources = useAppStore((s) => s.sources);
  const [filters, setFilters] = useState<ProblemFilters>(DEFAULT_FILTERS);
  const visible = useMemo(
    () => filterProblems(problems, progress, filters),
    [problems, progress, filters],
  );
  const tags = useMemo(() => availableTags(problems), [problems]);
  const solved = problems.filter((p) => problemStatus(progress, p.id) === 'solved').length;

  const set =
    <K extends keyof ProblemFilters>(key: K) =>
    (value: ProblemFilters[K]) =>
      setFilters((f) => ({ ...f, [key]: value }));

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col gap-4 overflow-y-auto p-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Problems</h1>
          <p className="text-sm text-muted-foreground">
            {solved} of {problems.length} solved · standard problems and multi-stage interview
            simulations
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="search">
        <div className="relative min-w-60 flex-1">
          <SearchIcon
            className="absolute top-2.5 left-2.5 size-4 text-muted-foreground"
            aria-hidden
          />
          <Input
            aria-label="Search problems"
            placeholder="Search titles, topics, companies…"
            className="pl-8"
            value={filters.search}
            onChange={(e) => set('search')(e.target.value)}
          />
        </div>
        <NativeSelect
          aria-label="Type"
          value={filters.type}
          onChange={(e) => set('type')(e.target.value as ProblemFilters['type'])}
        >
          <option value="all">All types</option>
          <option value="standard">Standard</option>
          <option value="simulation">Simulation</option>
        </NativeSelect>
        <NativeSelect
          aria-label="Difficulty"
          value={filters.difficulty}
          onChange={(e) => set('difficulty')(e.target.value as ProblemFilters['difficulty'])}
        >
          <option value="all">All difficulties</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </NativeSelect>
        <NativeSelect
          aria-label="Tag"
          value={filters.tag}
          onChange={(e) => set('tag')(e.target.value)}
        >
          <option value="all">All tags</option>
          {tags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Status"
          value={filters.status}
          onChange={(e) => set('status')(e.target.value as ProblemFilters['status'])}
        >
          <option value="all">Any status</option>
          <option value="unsolved">Unsolved</option>
          <option value="attempted">Attempted</option>
          <option value="solved">Solved</option>
        </NativeSelect>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={SearchXIcon}
          title={problems.length === 0 ? 'No problems yet' : 'No problems match these filters'}
          action={
            isFiltered(filters) && (
              <Button variant="outline" size="sm" onClick={() => setFilters(DEFAULT_FILTERS)}>
                Clear filters
              </Button>
            )
          }
        >
          {problems.length === 0
            ? 'Import a problem JSON file to get started.'
            : 'Try a broader search or clear the filters.'}
        </EmptyState>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="w-10 px-3 py-2 font-medium">
                  <span className="sr-only">Status</span>
                </th>
                <th className="px-3 py-2 font-medium">Title</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Difficulty</th>
                <th className="hidden px-3 py-2 font-medium md:table-cell">Tags</th>
                <th className="px-3 py-2 text-right font-medium">Est.</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => (
                <tr key={p.id} className="border-t transition-colors hover:bg-muted/30">
                  <td className="px-3 py-2.5">
                    <StatusIcon status={problemStatus(progress, p.id)} />
                  </td>
                  <td className="px-3 py-2.5">
                    <Link to={`/problems/${p.id}`} className="font-medium hover:text-primary">
                      {p.title}
                    </Link>
                    {sources[p.id] === 'imported' && (
                      <Badge variant="outline" className="ml-2">
                        imported
                      </Badge>
                    )}
                    <p className="line-clamp-1 text-xs text-muted-foreground">{p.summary}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    <TypeBadge problem={p} />
                  </td>
                  <td className="px-3 py-2.5">
                    <DifficultyBadge difficulty={p.difficulty} />
                  </td>
                  <td className="hidden px-3 py-2.5 md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {p.tags.map((t) => (
                        <Badge key={t} variant="outline" className="font-normal">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs whitespace-nowrap text-muted-foreground">
                    {p.estimatedMinutes} min
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
