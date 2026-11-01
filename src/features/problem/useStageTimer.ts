/**
 * Per-stage timer bound to persistence. It restores on mount (resuming a timer that was running
 * when the page was reloaded), flushes on every change, on a heartbeat and on page hide, and
 * auto-pauses while the tab is hidden when the setting is on. Leaving a stage (passing it, or
 * navigating away) pauses that stage's timer.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { useServices } from '@/app/services';
import {
  elapsedMs,
  fromTimerRecord,
  hasStarted,
  HEARTBEAT_MS,
  isRunning,
  onVisibilityChange,
  pauseTimer,
  startTimer,
  toTimerRecord,
  type TimerState,
} from '@/core/timer';
import { timerKey } from '@/store/appStore';
import { useAppStore } from '@/store/useAppStore';

export interface StageTimer {
  elapsedMs: number;
  running: boolean;
  started: boolean;
  autoPaused: boolean;
  start(): void;
  pause(): void;
  /** Starts the timer if it has never been started (first edit / run). */
  ensureStarted(): void;
}

interface Entry {
  key: string;
  timer: TimerState;
}

export function useStageTimer(problemId: string, stageId: string): StageTimer {
  const { store, now } = useServices();
  const autoPause = useAppStore((s) => s.settings.autoPauseOnHidden);
  const key = timerKey(problemId, stageId);
  const restore = (k: string) =>
    fromTimerRecord(store.getState().timers[k], now(), document.hidden);

  const [entry, setEntry] = useState<Entry>(() => ({ key, timer: restore(key) }));
  // Switching stage resets the state during render (React's pattern for state keyed by a prop).
  let current = entry;
  if (entry.key !== key) {
    current = { key, timer: restore(key) };
    setEntry(current);
  }
  const state = current.timer;

  const [, setTick] = useState(0);
  const latest = useRef<Entry>(current);
  /** Set on pagehide: the page is unloading (reload / tab closed), not navigating within the app. */
  const unloading = useRef(false);
  useEffect(() => {
    latest.current = current;
  });

  const persist = useCallback(
    (timer: TimerState, ids: { problemId: string; stageId: string }) => {
      void store.getState().saveTimer(toTimerRecord(timer, ids.problemId, ids.stageId, now()));
    },
    [store, now],
  );

  const update = useCallback(
    (fn: (s: TimerState) => TimerState) => {
      const { key: k, timer } = latest.current;
      const next = fn(timer);
      if (next === timer) return;
      latest.current = { key: k, timer: next };
      setEntry(latest.current);
      persist(next, { problemId, stageId });
    },
    [persist, problemId, stageId],
  );

  // Leaving this stage (stage passed or page left): stop its clock and flush.
  useEffect(() => {
    const ids = { problemId, stageId };
    return () => {
      const { timer } = latest.current;
      if (hasStarted(timer) && !unloading.current) persist(pauseTimer(timer, now()), ids);
    };
  }, [problemId, stageId, persist, now]);

  // Re-render every second while running, and flush on a heartbeat.
  const running = isRunning(state);
  useEffect(() => {
    if (!running) return;
    const tick = setInterval(() => setTick((t) => t + 1), 1000);
    const heartbeat = setInterval(
      () => persist(latest.current.timer, { problemId, stageId }),
      HEARTBEAT_MS,
    );
    return () => {
      clearInterval(tick);
      clearInterval(heartbeat);
    };
  }, [running, persist, problemId, stageId]);

  useEffect(() => {
    const onVisibility = () =>
      update((s) => onVisibilityChange(s, document.hidden, now(), autoPause));
    // A reload or closed tab: keep the running flag so the timer resumes on the next visit.
    const onPageHide = () => {
      unloading.current = true;
      if (hasStarted(latest.current.timer)) persist(latest.current.timer, { problemId, stageId });
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [update, persist, now, autoPause, problemId, stageId]);

  const start = useCallback(() => update((s) => startTimer(s, now())), [update, now]);
  const pause = useCallback(() => update((s) => pauseTimer(s, now())), [update, now]);
  const ensureStarted = useCallback(
    () => update((s) => (hasStarted(s) ? s : startTimer(s, now()))),
    [update, now],
  );

  return {
    elapsedMs: elapsedMs(state, now()),
    running,
    started: hasStarted(state),
    autoPaused: state.autoPaused,
    start,
    pause,
    ensureStarted,
  };
}
