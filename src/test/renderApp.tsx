import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';

import { App } from '@/App';
import type { AppServices } from '@/app/services';
import { MemoryStorage } from '@/storage/memoryStorage';
import { createAppStore } from '@/store/appStore';
import type { Problem } from '@/types/problem.generated';

import { FakeRunner } from './fakeRunner';
import { loadExample } from './fixtures';

export const T0 = Date.parse('2026-10-31T12:00:00Z');

export function createServices(
  options: {
    problems?: Problem[];
    runner?: FakeRunner;
    storage?: MemoryStorage;
    now?: () => number;
  } = {},
) {
  const storage = options.storage ?? new MemoryStorage();
  const runner = options.runner ?? new FakeRunner();
  const problems = options.problems ?? [
    loadExample('merge-meeting-ranges'),
    loadExample('inventory-reservations'),
  ];
  const services: AppServices = {
    storage,
    runner: runner,
    now: options.now ?? (() => Date.now()),
    store: createAppStore(storage, problems),
  };
  return { services, storage, runner };
}

export function renderApp(route = '/', options: Parameters<typeof createServices>[0] = {}) {
  const ctx = createServices(options);
  const user = userEvent.setup({
    advanceTimers: (ms) => {
      if (vi.isFakeTimers()) vi.advanceTimersByTime(ms);
    },
  });
  const utils = render(
    <MemoryRouter initialEntries={[route]}>
      <App services={ctx.services} />
    </MemoryRouter>,
  );
  return { ...utils, ...ctx, user };
}
