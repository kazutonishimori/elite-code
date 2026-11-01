import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { loadExample } from '@/test/fixtures';
import { renderApp } from '@/test/renderApp';

const sim = loadExample('inventory-reservations');
const custom = { ...loadExample('merge-meeting-ranges'), id: 'my-merge', title: 'My Merge' };

async function openImport() {
  const ctx = renderApp('/', { problems: [sim] });
  await screen.findByRole('heading', { name: 'Problems' });
  await ctx.user.click(screen.getByRole('button', { name: 'Import' }));
  return { ...ctx, dialog: await screen.findByRole('dialog', { name: 'Import a problem' }) };
}

const jsonFile = (name: string, content: string) =>
  new File([content], name, { type: 'application/json' });

describe('ImportDialog', () => {
  it('shows schema errors inline for an invalid file', async () => {
    const { user, dialog } = await openImport();
    await user.upload(
      within(dialog).getByLabelText('Problem file'),
      jsonFile('bad.json', JSON.stringify({ ...custom, id: 'Bad_Id', difficulty: 'insane' })),
    );
    const alert = await within(dialog).findByRole('alert');
    expect(within(alert).getByText('2 validation errors')).toBeInTheDocument();
    const errors = within(alert).getByRole('list', { name: 'Validation errors' });
    expect(errors).toHaveTextContent('/id must match pattern');
    expect(errors).toHaveTextContent('/difficulty must be one of: "easy", "medium", "hard"');
    expect(within(dialog).getByRole('button', { name: 'Add to library' })).toBeDisabled();
  });

  it('reports JSON syntax errors from a dropped file', async () => {
    const { dialog } = await openImport();
    fireEvent.drop(within(dialog).getByTestId('dropzone'), {
      dataTransfer: { files: [jsonFile('broken.json', '{ nope')] },
    });
    expect(await within(dialog).findByText(/invalid JSON/)).toBeInTheDocument();
    expect(within(dialog).getByText('broken.json')).toBeInTheDocument();
  });

  it('previews a valid problem, adds it to the library and opens it', async () => {
    const { user, dialog, storage } = await openImport();
    fireEvent.dragOver(within(dialog).getByTestId('dropzone'));
    fireEvent.dragLeave(within(dialog).getByTestId('dropzone'));
    await user.upload(
      within(dialog).getByLabelText('Problem file'),
      jsonFile('my-merge.json', JSON.stringify(custom)),
    );
    expect(await within(dialog).findByText('Valid problem')).toBeInTheDocument();
    expect(within(dialog).getByText('My Merge')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Add to library' }));
    expect(await screen.findByRole('heading', { name: 'My Merge', level: 1 })).toBeInTheDocument();
    expect((await storage.importedProblems.get('my-merge'))?.problem.title).toBe('My Merge');
  });

  it('accepts pasted JSON and offers to replace a previous import', async () => {
    const { user, dialog, services } = await openImport();
    await services.store.getState().importProblem(custom, 1);
    await user.click(within(dialog).getByText('…or paste JSON'));
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Problem JSON' }), {
      target: { value: JSON.stringify({ ...custom, title: 'My Merge v2' }) },
    });
    expect(
      await within(dialog).findByText('This replaces your previously imported version.'),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Replace in library' }));
    await waitFor(() =>
      expect(services.store.getState().problems.find((p) => p.id === 'my-merge')?.title).toBe(
        'My Merge v2',
      ),
    );
  });

  it('refuses to shadow a built-in problem', async () => {
    const { dialog } = await openImport();
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Problem JSON', hidden: true }), {
      target: { value: JSON.stringify(sim) },
    });
    expect(await within(dialog).findByText(/belongs to a built-in problem/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Add to library' })).toBeDisabled();
  });

  it('surfaces storage failures and clears state when closed', async () => {
    const { user, dialog, storage } = await openImport();
    storage.importedProblems.put = () => Promise.reject(new Error('Quota exceeded'));
    await user.upload(
      within(dialog).getByLabelText('Problem file'),
      jsonFile('my-merge.json', JSON.stringify(custom)),
    );
    await user.click(await within(dialog).findByRole('button', { name: 'Add to library' }));
    expect(await screen.findByText('Quota exceeded')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
