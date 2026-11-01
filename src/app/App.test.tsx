import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MemoryStorage } from '@/storage/memoryStorage';
import { renderApp } from '@/test/renderApp';

describe('App shell', () => {
  it('shows a loading state, then the library, and warms up Python', async () => {
    const { runner } = renderApp('/');
    expect(screen.getByText('Loading your library…')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Problems' })).toBeInTheDocument();
    expect(screen.getByText(/Python 3\.14\.2/)).toBeInTheDocument();
    runner.setState({ status: 'loading', detail: 'Loading pandas…' });
    expect(await screen.findByText('Loading pandas…')).toBeInTheDocument();
    runner.setState({ status: 'running' });
    expect(await screen.findByText(/· running/)).toBeInTheDocument();
    runner.setState({ status: 'error', error: 'boom' });
    expect(await screen.findByText('Python failed to load')).toBeInTheDocument();
    runner.setState({ status: 'idle' });
    await waitFor(() => expect(screen.queryByText(/Python/)).not.toBeInTheDocument());
  });

  it('explains when the local database cannot be opened', async () => {
    const storage = new MemoryStorage();
    storage.getSettings = () => Promise.reject(new Error('IndexedDB is blocked'));
    renderApp('/', { storage });
    expect(
      await screen.findByText("Elite Code couldn't open its local database"),
    ).toBeInTheDocument();
    expect(screen.getByText(/IndexedDB is blocked/)).toBeInTheDocument();
  });

  it('renders not-found pages', async () => {
    renderApp('/nope');
    expect(await screen.findByText('Page not found')).toBeInTheDocument();
  });

  it('toggles the theme and persists it', async () => {
    const { user, storage } = renderApp('/');
    await screen.findByRole('heading', { name: 'Problems' });
    expect(document.documentElement).toHaveClass('dark');
    await user.click(screen.getByRole('button', { name: 'Switch to light mode' }));
    expect(document.documentElement).not.toHaveClass('dark');
    expect((await storage.getSettings()).theme).toBe('light');
    await user.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    expect(document.documentElement).toHaveClass('dark');
  });

  it('opens the shortcut cheat sheet with ? (but not while typing)', async () => {
    const { user } = renderApp('/');
    await screen.findByRole('heading', { name: 'Problems' });
    await user.type(screen.getByRole('textbox', { name: 'Search problems' }), '?');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(document.body);
    await user.keyboard('?');
    expect(await screen.findByRole('dialog', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
    expect(screen.getByText('Submit: all tests for this and earlier stages')).toBeInTheDocument();
  });

  it('navigates between pages', async () => {
    const { user } = renderApp('/');
    await screen.findByRole('heading', { name: 'Problems' });
    await user.click(screen.getByRole('link', { name: 'Dashboard' }));
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Problems' }));
    await user.click(await screen.findByRole('link', { name: 'Merge Meeting Ranges' }));
    expect(
      await screen.findByRole('heading', { name: 'Merge Meeting Ranges', level: 1 }),
    ).toBeInTheDocument();
  });
});
