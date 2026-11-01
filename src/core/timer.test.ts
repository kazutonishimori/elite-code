import { describe, expect, it } from 'vitest';

import {
  elapsedMs,
  formatDuration,
  fromTimerRecord,
  hasStarted,
  humanizeDuration,
  IDLE_TIMER,
  isRunning,
  onVisibilityChange,
  pauseTimer,
  startTimer,
  toTimerRecord,
} from './timer';

describe('timer math', () => {
  it('accumulates only running time across pause and resume', () => {
    let t = startTimer(IDLE_TIMER, 1000);
    expect(elapsedMs(t, 4000)).toBe(3000);
    t = pauseTimer(t, 4000);
    expect(elapsedMs(t, 60_000)).toBe(3000);
    t = startTimer(t, 70_000);
    expect(elapsedMs(t, 72_500)).toBe(5500);
    expect(isRunning(t)).toBe(true);
  });

  it('ignores redundant start/pause and clock skew', () => {
    const running = startTimer(IDLE_TIMER, 10);
    expect(startTimer(running, 50)).toBe(running);
    expect(pauseTimer(IDLE_TIMER, 50)).toBe(IDLE_TIMER);
    expect(elapsedMs(running, 5)).toBe(0);
  });

  it('knows whether a timer has ever been started', () => {
    expect(hasStarted(IDLE_TIMER)).toBe(false);
    expect(hasStarted(startTimer(IDLE_TIMER, 0))).toBe(true);
    expect(hasStarted(pauseTimer(startTimer(IDLE_TIMER, 0), 10))).toBe(true);
  });
});

describe('tab visibility', () => {
  it('auto-pauses when hidden and auto-resumes when visible again', () => {
    let t = startTimer(IDLE_TIMER, 0);
    t = onVisibilityChange(t, true, 1000, true);
    expect(t).toEqual({ accumulatedMs: 1000, runningSince: null, autoPaused: true });
    t = onVisibilityChange(t, false, 50_000, true);
    expect(t).toEqual({ accumulatedMs: 1000, runningSince: 50_000, autoPaused: false });
    expect(elapsedMs(t, 51_000)).toBe(2000);
  });

  it('does not resume a timer the solver paused manually', () => {
    const paused = pauseTimer(startTimer(IDLE_TIMER, 0), 10);
    expect(onVisibilityChange(onVisibilityChange(paused, true, 20, true), false, 30, true)).toBe(
      paused,
    );
  });

  it('keeps running when auto-pause is disabled', () => {
    const t = startTimer(IDLE_TIMER, 0);
    expect(onVisibilityChange(t, true, 10, false)).toBe(t);
  });
});

describe('persistence across reloads', () => {
  it('flushes elapsed time and the running flag', () => {
    const t = startTimer({ ...IDLE_TIMER, accumulatedMs: 500 }, 1000);
    expect(toTimerRecord(t, 'p', 's', 3400.4)).toEqual({
      problemId: 'p',
      stageId: 's',
      accumulatedMs: 2900,
      running: true,
      updatedAt: 3400.4,
    });
    expect(
      toTimerRecord({ accumulatedMs: 7, runningSince: null, autoPaused: true }, 'p', 's', 9)
        .running,
    ).toBe(true);
  });

  it('resumes a running timer after reload without counting the time it was closed', () => {
    const record = {
      problemId: 'p',
      stageId: 's',
      accumulatedMs: 2900,
      running: true,
      updatedAt: 3400,
    };
    const restored = fromTimerRecord(record, 900_000);
    expect(restored).toEqual({ accumulatedMs: 2900, runningSince: 900_000, autoPaused: false });
    expect(elapsedMs(restored, 901_000)).toBe(3900);
  });

  it('restores a running timer as auto-paused when the page loads hidden', () => {
    const record = { problemId: 'p', stageId: 's', accumulatedMs: 10, running: true, updatedAt: 0 };
    expect(fromTimerRecord(record, 5, true)).toEqual({
      accumulatedMs: 10,
      runningSince: null,
      autoPaused: true,
    });
  });

  it('restores paused and missing timers', () => {
    expect(fromTimerRecord(undefined, 1)).toBe(IDLE_TIMER);
    const record = {
      problemId: 'p',
      stageId: 's',
      accumulatedMs: 10,
      running: false,
      updatedAt: 0,
    };
    expect(fromTimerRecord(record, 5)).toEqual({
      accumulatedMs: 10,
      runningSince: null,
      autoPaused: false,
    });
  });
});

describe('formatting', () => {
  it.each([
    [0, '00:00'],
    [999, '00:00'],
    [61_000, '01:01'],
    [3_723_000, '1:02:03'],
    [-5, '00:00'],
  ])('formatDuration(%i) = %s', (ms, text) => {
    expect(formatDuration(ms)).toBe(text);
  });

  it.each([
    [45_000, '45s'],
    [12 * 60_000, '12m'],
    [185 * 60_000, '3h 05m'],
  ])('humanizeDuration(%i) = %s', (ms, text) => {
    expect(humanizeDuration(ms)).toBe(text);
  });
});
