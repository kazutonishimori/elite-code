import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MemoryStorage } from '@/storage/memoryStorage';
import { renderApp } from '@/test/renderApp';

describe('ProblemListPage', () => {
  it('lists every problem with type, difficulty and status', async () => {
    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Problems' })).toBeInTheDocument();
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows.map((r) => within(r).getByRole('link').textContent)).toEqual([
      'Merge Meeting Ranges',
      'Inventory Reservations',
    ]);
    expect(within(rows[1]!).getByText('Simulation · 4 stages')).toBeInTheDocument();
    expect(within(rows[0]!).getByRole('img', { name: 'Unsolved' })).toBeInTheDocument();
  });

  it('shows saved progress as status icons', async () => {
    const storage = new MemoryStorage();
    await storage.progress.put({
      problemId: 'merge-meeting-ranges',
      status: 'solved',
      currentStageIndex: 0,
      stages: {},
      startedAt: 1,
      solvedAt: 2,
      updatedAt: 2,
    });
    renderApp('/', { storage });
    expect(await screen.findByRole('img', { name: 'Solved' })).toBeInTheDocument();
    expect(screen.getByText(/1 of 2 solved/)).toBeInTheDocument();
  });

  it('filters by search, type, difficulty, tag and status', async () => {
    const { user } = renderApp('/');
    await screen.findByRole('heading', { name: 'Problems' });
    const titles = () =>
      screen
        .queryAllByRole('row')
        .slice(1)
        .map((r) => within(r).getByRole('link').textContent);

    await user.type(screen.getByRole('textbox', { name: 'Search problems' }), 'shopify');
    expect(titles()).toEqual(['Inventory Reservations']);
    await user.clear(screen.getByRole('textbox', { name: 'Search problems' }));

    await user.selectOptions(screen.getByRole('combobox', { name: 'Type' }), 'standard');
    expect(titles()).toEqual(['Merge Meeting Ranges']);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Type' }), 'all');

    await user.selectOptions(screen.getByRole('combobox', { name: 'Tag' }), 'design');
    expect(titles()).toEqual(['Inventory Reservations']);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Tag' }), 'all');

    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'solved');
    expect(screen.getByText('No problems match these filters')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(titles()).toHaveLength(2);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Difficulty' }), 'hard');
    expect(titles()).toEqual([]);
  });

  it('shows an empty library state', async () => {
    renderApp('/', { problems: [] });
    expect(await screen.findByText('No problems yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });
});
