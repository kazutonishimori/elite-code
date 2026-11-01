import { createContext, useContext } from 'react';
import type { StoreApi } from 'zustand';

import type { CodeRunner } from '@/runner/types';
import type { Storage } from '@/storage/types';
import type { AppState } from '@/store/appStore';

/** Everything with side effects, injected so tests can swap in fakes. */
export interface AppServices {
  storage: Storage;
  runner: CodeRunner;
  now: () => number;
  store: StoreApi<AppState>;
}

export const ServicesContext = createContext<AppServices | null>(null);

export function useServices(): AppServices {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('useServices must be used inside <ServicesContext.Provider>');
  return services;
}
