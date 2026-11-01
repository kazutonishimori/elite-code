import type { Problem } from '@/types/problem.generated';

// Validated against the schema at build time by build/vite-plugin-problems.ts.
const modules = import.meta.glob<Problem>('../../problems/*.json', {
  eager: true,
  import: 'default',
});

export const bundledProblems: Problem[] = Object.values(modules);
