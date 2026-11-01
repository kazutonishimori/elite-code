import { describe, expect, it } from 'vitest';

import type { ProgressRecord } from '@/storage/types';
import { loadExample } from '@/test/fixtures';

import {
  availableTags,
  DEFAULT_FILTERS,
  filterProblems,
  isFiltered,
  problemStatus,
} from './filters';

const standard = loadExample('merge-meeting-ranges');
const sim = loadExample('inventory-reservations');
const problems = [standard, sim];
const progress = { [sim.id]: { status: 'attempted' } as ProgressRecord };

const ids = (filters: Partial<typeof DEFAULT_FILTERS>) =>
  filterProblems(problems, progress, { ...DEFAULT_FILTERS, ...filters }).map((p) => p.id);

describe('filterProblems', () => {
  it('returns everything without filters', () => {
    expect(ids({})).toEqual([standard.id, sim.id]);
  });

  it('filters by type, difficulty, tag and status', () => {
    expect(ids({ type: 'simulation' })).toEqual([sim.id]);
    expect(ids({ difficulty: 'hard' })).toEqual([]);
    expect(ids({ tag: 'intervals' })).toEqual([standard.id]);
    expect(ids({ status: 'attempted' })).toEqual([sim.id]);
    expect(ids({ status: 'unsolved' })).toEqual([standard.id]);
  });

  it('searches title, summary, tags, topics and companies with every term', () => {
    expect(ids({ search: 'MEETING' })).toEqual([standard.id]);
    expect(ids({ search: 'shopify' })).toEqual([sim.id]);
    expect(ids({ search: 'e-commerce design' })).toEqual([sim.id]);
    expect(ids({ search: 'calendars nothing' })).toEqual([]);
  });
});

describe('helpers', () => {
  it('detects active filters', () => {
    expect(isFiltered(DEFAULT_FILTERS)).toBe(false);
    expect(isFiltered({ ...DEFAULT_FILTERS, search: 'x' })).toBe(true);
  });

  it('lists tags and defaults status to unsolved', () => {
    expect(availableTags(problems)).toEqual([
      'design',
      'hash-map',
      'intervals',
      'simulation',
      'sorting',
    ]);
    expect(problemStatus({}, 'x')).toBe('unsolved');
  });
});
