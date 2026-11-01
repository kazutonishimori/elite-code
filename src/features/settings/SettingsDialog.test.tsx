import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBackup } from '@/storage/backup';
import { MemoryStorage } from '@/storage/memoryStorage';
import { loadExample } from '@/test/fixtures';
import { renderApp } from '@/test/renderApp';

async function openSettings(storage = new MemoryStorage()) {
  const ctx = renderApp('/', { storage });
  await screen.findByRole('heading', { name: 'Problems' });
  await ctx.user.click(screen.getByRole('button', { name: 'Settings' }));
  return { ...ctx, dialog: await screen.findByRole('dialog', { name: 'Settings & data' }) };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SettingsDialog', () => {
  it('toggles auto-pause and dark mode', async () => {
    const { user, dialog, storage } = await openSettings();
    await user.click(
      within(dialog).getByRole('switch', { name: 'Auto-pause timers when the tab is hidden' }),
    );
    await user.click(within(dialog).getByRole('switch', { name: 'Dark mode' }));
    expect(await storage.getSettings()).toEqual({ theme: 'light', autoPauseOnHidden: false });
  });

  it('exports all data as a JSON download', async () => {
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:backup');
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = vi.fn();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const storage = new MemoryStorage();
    await storage.notes.put({ problemId: 'x', markdown: 'note', updatedAt: 1 });
    const { user, dialog } = await openSettings(storage);
    await user.click(within(dialog).getByRole('button', { name: 'Export data' }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    const blob = createObjectURL.mock.calls[0]![0];
    const backup = JSON.parse(await blob.text()) as { app: string; data: { notes: unknown[] } };
    expect(backup.app).toBe('elite-code');
    expect(backup.data.notes).toHaveLength(1);
    expect(await screen.findByText('Backup downloaded')).toBeInTheDocument();
  });

  it('rejects an invalid backup with explanations', async () => {
    const { user, dialog } = await openSettings();
    await user.upload(
      within(dialog).getByLabelText('Backup file'),
      new File(['{"app":"other"}'], 'x.json', { type: 'application/json' }),
    );
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Not an Elite Code backup file',
    );
  });

  it('restores a backup after confirmation', async () => {
    const source = new MemoryStorage();
    await source.progress.put({
      problemId: 'merge-meeting-ranges',
      status: 'solved',
      currentStageIndex: 0,
      stages: {},
      startedAt: 1,
      solvedAt: 2,
      updatedAt: 2,
    });
    const backup = await createBackup(source, new Date('2026-10-01T00:00:00Z'));

    const { user, dialog, services } = await openSettings();
    await user.upload(
      within(dialog).getByLabelText('Backup file'),
      new File([JSON.stringify(backup)], 'b.json', { type: 'application/json' }),
    );
    const confirm = await screen.findByRole('alertdialog', { name: 'Replace all local data?' });
    expect(confirm).toHaveTextContent('2026-10-01');
    await user.click(within(confirm).getByRole('button', { name: 'Replace data' }));
    await waitFor(() =>
      expect(services.store.getState().progress['merge-meeting-ranges']?.status).toBe('solved'),
    );
    expect(await screen.findByText('Data restored from backup')).toBeInTheDocument();
  });

  it('lists imported problems and removes them', async () => {
    const storage = new MemoryStorage();
    const problem = { ...loadExample('merge-meeting-ranges'), id: 'mine', title: 'Mine' };
    await storage.importedProblems.put({ id: 'mine', problem, importedAt: 1 });
    const { user, dialog, services } = await openSettings(storage);
    await user.click(within(dialog).getByRole('button', { name: 'Remove Mine' }));
    await waitFor(() => expect(services.store.getState().sources.mine).toBeUndefined());
  });
});
