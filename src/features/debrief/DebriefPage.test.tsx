import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MemoryStorage } from '@/storage/memoryStorage';
import { renderApp } from '@/test/renderApp';

describe('DebriefPage', () => {
  it('stays locked until every stage is passed', async () => {
    renderApp('/problems/inventory-reservations/debrief');
    expect(
      await screen.findByText('The debrief unlocks when you finish every stage'),
    ).toBeInTheDocument();
  });

  it('reports unknown problems', async () => {
    renderApp('/problems/nope/debrief');
    expect(await screen.findByText('Problem not found')).toBeInTheDocument();
  });

  it('shows totals, per-stage time, attempts, hints, regressions and reference solutions', async () => {
    const storage = new MemoryStorage();
    const sp = (attempts: number, hints: number, regressions: number, revealed = false) => ({
      attempts,
      hintsRevealed: hints,
      regressions,
      passedAt: 1,
      snapshotCode: 'x',
      solutionRevealed: revealed,
    });
    await storage.progress.put({
      problemId: 'inventory-reservations',
      status: 'solved',
      currentStageIndex: 3,
      stages: {
        'basic-stock': sp(1, 0, 0),
        reservations: sp(3, 1, 1),
        'expiring-holds': sp(2, 2, 0, true),
        'atomic-batches': sp(1, 0, 2),
      },
      startedAt: 1,
      solvedAt: 2,
      updatedAt: 2,
    });
    await storage.timers.put({
      problemId: 'inventory-reservations',
      stageId: 'reservations',
      accumulatedMs: 754_000,
      running: false,
      updatedAt: 1,
    });

    renderApp('/problems/inventory-reservations/debrief', { storage });
    const totals = await screen.findByRole('region', { name: 'Totals' });
    expect(totals).toHaveTextContent('Total time12:34');
    expect(totals).toHaveTextContent('Submissions7');
    expect(totals).toHaveTextContent('Hints used3');
    expect(totals).toHaveTextContent('Regressions hit3');
    const rows = within(screen.getByRole('region', { name: 'Per-stage breakdown' }))
      .getAllByRole('row')
      .slice(1);
    expect(rows[1]).toHaveTextContent('2. Reservations12:3431/31');
    expect(rows[2]).toHaveTextContent('solution revealed');
    expect(screen.getAllByText(/Stage \d: /)).toHaveLength(4);
  });
});
