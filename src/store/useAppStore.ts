import { useStore } from 'zustand';

import { useServices } from '@/app/services';
import type { AppState } from '@/store/appStore';

export function useAppStore<T>(selector: (state: AppState) => T): T {
  return useStore(useServices().store, selector);
}
