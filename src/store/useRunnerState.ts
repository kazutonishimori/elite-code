import { useSyncExternalStore } from 'react';

import { useServices } from '@/app/services';
import type { RunnerState } from '@/runner/types';

export function useRunnerState(): RunnerState {
  const { runner } = useServices();
  return useSyncExternalStore(
    (listener) => runner.subscribe(listener),
    () => runner.getState(),
  );
}
