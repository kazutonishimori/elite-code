/**
 * Per-stage timer math. Only active (unpaused) time counts. Pure and clock-injected:
 * every function takes `now` (ms) so tests never need real time.
 */
import type { TimerRecord } from '@/storage/types';

export interface TimerState {
  accumulatedMs: number;
  /** Timestamp the current running segment started at; null while paused / not started. */
  runningSince: number | null;
  /** True when paused automatically because the tab was hidden. */
  autoPaused: boolean;
}

export const IDLE_TIMER: TimerState = { accumulatedMs: 0, runningSince: null, autoPaused: false };

/** Interval at which a running timer is flushed to storage. */
export const HEARTBEAT_MS = 5000;

export function isRunning(state: TimerState): boolean {
  return state.runningSince !== null;
}

export function elapsedMs(state: TimerState, now: number): number {
  return (
    state.accumulatedMs + (state.runningSince === null ? 0 : Math.max(0, now - state.runningSince))
  );
}

export function startTimer(state: TimerState, now: number): TimerState {
  if (isRunning(state)) return state;
  return { ...state, runningSince: now, autoPaused: false };
}

export function pauseTimer(state: TimerState, now: number, auto = false): TimerState {
  if (!isRunning(state)) return state;
  return { accumulatedMs: elapsedMs(state, now), runningSince: null, autoPaused: auto };
}

/** Tab visibility changes: auto-pause when hidden, auto-resume only what was auto-paused. */
export function onVisibilityChange(
  state: TimerState,
  hidden: boolean,
  now: number,
  autoPause: boolean,
): TimerState {
  if (!autoPause) return state;
  if (hidden) return isRunning(state) ? pauseTimer(state, now, true) : state;
  return state.autoPaused ? startTimer(state, now) : state;
}

export function hasStarted(state: TimerState): boolean {
  return isRunning(state) || state.accumulatedMs > 0;
}

export function toTimerRecord(
  state: TimerState,
  problemId: string,
  stageId: string,
  now: number,
): TimerRecord {
  return {
    problemId,
    stageId,
    accumulatedMs: Math.round(elapsedMs(state, now)),
    // An auto-paused timer was running from the solver's point of view.
    running: isRunning(state) || state.autoPaused,
    updatedAt: now,
  };
}

/**
 * Restores a persisted timer. Time between the last flush and now is NOT counted (the tab may
 * have been closed). A timer that was running resumes, unless the page is hidden.
 */
export function fromTimerRecord(
  record: TimerRecord | undefined,
  now: number,
  hidden = false,
): TimerState {
  if (!record) return IDLE_TIMER;
  if (!record.running)
    return { accumulatedMs: record.accumulatedMs, runningSince: null, autoPaused: false };
  return hidden
    ? { accumulatedMs: record.accumulatedMs, runningSince: null, autoPaused: true }
    : { accumulatedMs: record.accumulatedMs, runningSince: now, autoPaused: false };
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

/** Compact human duration for stats: "45s", "12m", "3h 05m". */
export function humanizeDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  if (totalMinutes < 1) return `${Math.floor(ms / 1000)}s`;
  if (totalMinutes < 60) return `${totalMinutes}m`;
  return `${Math.floor(totalMinutes / 60)}h ${String(totalMinutes % 60).padStart(2, '0')}m`;
}
