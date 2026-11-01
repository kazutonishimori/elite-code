import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MemoryStorage } from '@/storage/memoryStorage';
import type { SubmissionRecord } from '@/storage/types';
import { renderApp, T0 } from '@/test/renderApp';

const DAY = 86_400_000;

describe('DashboardPage', () => {
  it('shows an empty state before any practice', async () => {
    renderApp('/dashboard');
    expect(await screen.findByText('No practice recorded yet')).toBeInTheDocument();
  });

  it('summarizes solved counts, streak, practice time, weak tags and recent activity', async () => {
    const storage = new MemoryStorage();
    const submit = (problemId: string, createdAt: number, verdict: SubmissionRecord['verdict']) =>
      storage.submissions.add({
        problemId,
        stageId: 's',
        stageIndex: 0,
        createdAt,
        code: '',
        verdict,
        passed: 0,
        failed: 0,
        total: 0,
        regressions: 0,
        runtimeMs: 1,
        tests: [],
      });
    await submit('merge-meeting-ranges', T0 - 2 * DAY, 'failed');
    await submit('merge-meeting-ranges', T0 - DAY, 'accepted');
    await submit('inventory-reservations', T0, 'failed');
    await storage.progress.put({
      problemId: 'merge-meeting-ranges',
      status: 'solved',
      currentStageIndex: 0,
      stages: {},
      startedAt: 1,
      solvedAt: 2,
      updatedAt: 2,
    });
    await storage.progress.put({
      problemId: 'inventory-reservations',
      status: 'attempted',
      currentStageIndex: 0,
      stages: {
        'basic-stock': {
          attempts: 1,
          hintsRevealed: 2,
          regressions: 0,
          passedAt: null,
          snapshotCode: null,
          solutionRevealed: false,
        },
      },
      startedAt: 1,
      solvedAt: null,
      updatedAt: 2,
    });
    await storage.timers.put({
      problemId: 'merge-meeting-ranges',
      stageId: 'merge-ranges',
      accumulatedMs: 25 * 60_000,
      running: false,
      updatedAt: 1,
    });

    renderApp('/dashboard', { storage, now: () => T0 });
    const summary = await screen.findByRole('region', { name: 'Summary' });
    expect(within(summary).getByText('1/2')).toBeInTheDocument();
    expect(within(summary).getByText('3 days')).toBeInTheDocument();
    expect(within(summary).getByText('25m')).toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: 'Weakest tags' })).getAllByRole('listitem')[0],
    ).toHaveTextContent('design');
    const recent = within(screen.getByRole('list', { name: 'Recent activity' })).getAllByRole(
      'listitem',
    );
    expect(recent[0]).toHaveTextContent('Inventory Reservations');
    expect(screen.getByLabelText('Daily activity').children).toHaveLength(28);
  });
});
