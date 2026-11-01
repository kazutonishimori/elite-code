import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HEARTBEAT_MS } from '@/core/timer';
import { MemoryStorage } from '@/storage/memoryStorage';
import { failWhere, FakeRunner, passAll } from '@/test/fakeRunner';
import { fakeResult } from '@/test/fakeWorker';
import { loadExample } from '@/test/fixtures';
import { renderApp, T0 } from '@/test/renderApp';

import { DRAFT_SAVE_DELAY_MS } from './sessionStore';

const sim = loadExample('inventory-reservations');

let clock = T0;
const now = () => clock;

beforeEach(() => {
  clock = T0;
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => {
  vi.useRealTimers();
});

async function openProblem(id: string, options: Parameters<typeof renderApp>[1] = {}) {
  const ctx = renderApp(`/problems/${id}`, { now, ...options });
  await screen.findByRole('heading', { level: 1 });
  await screen.findByRole('textbox', { name: 'Code editor' });
  return ctx;
}

const editor = () => screen.getByRole('textbox', { name: 'Code editor' });
const results = () => screen.getByRole('tabpanel', { name: 'Test results' });

describe('statement panel', () => {
  it('shows the requirement, visible tests and the hidden test count', async () => {
    await openProblem('merge-meeting-ranges');
    expect(
      screen.getByRole('heading', { name: 'Merge Meeting Ranges', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText(/minimal list of busy blocks/)).toBeInTheDocument();
    expect(screen.getByText('The worked example from the prompt.')).toBeInTheDocument();
    expect(screen.getByText(/6 hidden tests run on Submit/)).toBeInTheDocument();
    expect(editor()).toHaveValue(loadExample('merge-meeting-ranges').starterCode);
  });

  it('shows only the current stage of a simulation and locks future stages', async () => {
    await openProblem(sim.id);
    expect(screen.getByText('Stage 1 of 4: Basic stock')).toBeInTheDocument();
    expect(screen.queryByText(/Checkout needs to hold stock/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stage 2: locked' })).toBeDisabled();
  });

  it('reports unknown problems', async () => {
    renderApp('/problems/does-not-exist');
    expect(await screen.findByText('Problem not found')).toBeInTheDocument();
  });
});

describe('running code', () => {
  it('Run executes the visible tests of the current stage and shows results', async () => {
    const { user, runner } = await openProblem('merge-meeting-ranges');
    await user.click(screen.getByRole('button', { name: /^Run$/ }));
    expect(await within(results()).findByText('All tests passed')).toBeInTheDocument();
    expect(within(results()).getByTestId('pass-count')).toHaveTextContent('3/3 passed');
    expect(runner.requests[0]!.payload.mode).toBe('run');
    expect(runner.requests[0]!.payload.tests.map((t) => t.visibility)).toEqual([
      'visible',
      'visible',
      'visible',
    ]);
  });

  it('Submit shows failures with expected and actual values and records the submission', async () => {
    const runner = new FakeRunner(failWhere((name) => name === 'test_example'));
    const { user, storage } = await openProblem('merge-meeting-ranges', { runner });
    await user.click(screen.getByRole('button', { name: /^Submit$/ }));
    expect(await within(results()).findByText('Some tests failed')).toBeInTheDocument();
    const failing = within(results()).getByTestId('test-test_example');
    expect(within(failing).getByText('assert f() == 2')).toBeInTheDocument();
    expect(within(failing).getByText('2')).toBeInTheDocument();
    expect(within(failing).getByText('3')).toBeInTheDocument();
    expect(within(failing).getByText('The worked example from the prompt.')).toBeInTheDocument();
    expect(runner.requests[0]!.payload.tests).toHaveLength(9);

    const [record] = await storage.submissions.list();
    expect(record).toMatchObject({ verdict: 'failed', passed: 8, total: 9, stageIndex: 0 });
    expect((await storage.progress.get('merge-meeting-ranges'))?.status).toBe('attempted');
  });

  it('collapses passing tests and expands them on demand', async () => {
    const { user } = await openProblem('merge-meeting-ranges');
    await user.click(screen.getByRole('button', { name: /^Run$/ }));
    const card = await within(results()).findByTestId('test-test_example');
    const toggle = within(card).getByRole('button');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(within(card).getByText(/Passed in/)).toBeInTheDocument();
  });

  it.each([
    ['timeout', { kind: 'timeout', timeoutMs: 5000 } as const, 'Time limit exceeded'],
    ['crash', { kind: 'crashed', message: 'Worker died' } as const, 'The Python runtime crashed'],
  ])('explains a %s', async (_name, outcome, title) => {
    const { user } = await openProblem('merge-meeting-ranges', {
      runner: new FakeRunner(() => outcome),
    });
    await user.click(screen.getByRole('button', { name: /^Run$/ }));
    expect(await within(results()).findByText(title)).toBeInTheDocument();
  });

  it('shows syntax errors with the traceback and skipped tests', async () => {
    const runner = new FakeRunner(() => ({
      kind: 'completed',
      wallTimeMs: 3,
      result: fakeResult({
        status: 'compile_error',
        error: {
          type: 'SyntaxError',
          message: 'invalid syntax',
          line: 1,
          traceback: '  File "<solution>", line 1\nSyntaxError: invalid syntax',
        },
        tests: [],
      }),
    }));
    const { user } = await openProblem('merge-meeting-ranges', { runner });
    await user.click(screen.getByRole('button', { name: /^Run$/ }));
    expect(await within(results()).findByText('Syntax error')).toBeInTheDocument();
    expect(within(results()).getByText(/SyntaxError: invalid syntax/)).toBeInTheDocument();
  });

  it('shows printed output in the console', async () => {
    const runner = new FakeRunner((req) => {
      const outcome = passAll(req);
      if (outcome.kind === 'completed') {
        outcome.result.stdout = 'hello from top level\n';
        outcome.result.tests[0]!.stdout = 'debug line\n';
      }
      return outcome;
    });
    const { user } = await openProblem('merge-meeting-ranges', { runner });
    await user.click(screen.getByRole('tab', { name: 'Console' }));
    expect(screen.getByText('Console is empty')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Run$/ }));
    await user.click(screen.getByRole('tab', { name: 'Console' }));
    const console = await screen.findByTestId('console');
    expect(console).toHaveTextContent('hello from top level');
    expect(console).toHaveTextContent('# test_example');
    expect(console).toHaveTextContent('debug line');
  });

  it('runs custom input and shows the value of the last expression', async () => {
    const runner = new FakeRunner(() => ({
      kind: 'completed',
      wallTimeMs: 2,
      result: fakeResult({
        custom: { stdout: 'printed\n', stderr: '', value: '[(1, 4)]', error: null },
      }),
    }));
    const { user } = await openProblem('merge-meeting-ranges', { runner });
    await user.click(screen.getByRole('tab', { name: 'Custom input' }));
    const run = screen.getByRole('button', { name: 'Run with custom input' });
    expect(run).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', { name: /Python to run after your code/ }), {
      target: { value: 'merge_ranges([(1, 3), (2, 4)])' },
    });
    await user.click(run);
    const output = await screen.findByTestId('custom-output');
    expect(output).toHaveTextContent('printed');
    expect(output).toHaveTextContent('=> [(1, 4)]');
    expect(runner.requests[0]!.payload).toMatchObject({
      mode: 'custom',
      customInput: 'merge_ranges([(1, 3), (2, 4)])',
      tests: [],
    });
  });

  it('shows custom input errors', async () => {
    const error = {
      type: 'NameError',
      message: "name 'x' is not defined",
      line: null,
      traceback: "NameError: name 'x' is not defined",
    };
    const runner = new FakeRunner(() => ({
      kind: 'completed',
      wallTimeMs: 2,
      result: fakeResult({ custom: { stdout: '', stderr: '', value: null, error } }),
    }));
    const { user } = await openProblem('merge-meeting-ranges', { runner });
    await user.click(screen.getByRole('tab', { name: 'Custom input' }));
    await user.type(screen.getByRole('textbox', { name: /Python to run after your code/ }), 'x');
    await user.click(screen.getByRole('button', { name: 'Run with custom input' }));
    expect(await screen.findByText(/NameError: name 'x' is not defined/)).toBeInTheDocument();
  });

  it('supports Run and Submit keyboard shortcuts', async () => {
    const { runner } = await openProblem('merge-meeting-ranges');
    fireEvent.keyDown(editor(), { key: 'Enter', ctrlKey: true });
    await waitFor(() => expect(runner.requests).toHaveLength(1));
    expect(runner.requests[0]!.payload.mode).toBe('run');
    await within(results()).findByText('All tests passed');
    fireEvent.keyDown(editor(), { key: 'Enter', metaKey: true, shiftKey: true });
    await waitFor(() => expect(runner.requests).toHaveLength(2));
    expect(runner.requests[1]!.payload.mode).toBe('submit');
  });
});

describe('simulation stages', () => {
  it('advances on a passing submit, carries code over and snapshots it', async () => {
    const { user, storage } = await openProblem(sim.id);
    fireEvent.change(editor(), { target: { value: 'class Inventory: ...  # v1' } });
    await user.click(screen.getByRole('button', { name: /^Submit$/ }));

    const dialog = await screen.findByRole('dialog', { name: 'Stage 1 complete' });
    expect(within(dialog).getByText(/Your code carries over unchanged/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Continue to stage 2' }));

    expect(await screen.findByText('Stage 2 of 4: Reservations')).toBeInTheDocument();
    expect(screen.getByText(/Checkout needs to hold stock/)).toBeInTheDocument();
    expect(editor()).toHaveValue('class Inventory: ...  # v1');
    expect((await storage.progress.get(sim.id))?.stages['basic-stock']?.snapshotCode).toBe(
      'class Inventory: ...  # v1',
    );

    // Look back at stage 1 and its read-only snapshot.
    await user.click(screen.getByRole('button', { name: 'Stage 1: Basic stock' }));
    expect(screen.getByText('Stage 1 of 4: Basic stock')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Your code at the end of this stage/ }));
    const snapshot = await screen.findByRole('dialog', { name: /Your code at the end of stage 1/ });
    expect(within(snapshot).getByRole('textbox', { name: 'Stage snapshot' })).toHaveValue(
      'class Inventory: ...  # v1',
    );
  });

  it('labels failures from earlier stages as regressions', async () => {
    const runner = new FakeRunner();
    const { user } = await openProblem(sim.id, { runner });
    await user.click(screen.getByRole('button', { name: /^Submit$/ }));
    await user.click(await screen.findByRole('button', { name: 'Continue to stage 2' }));

    runner.handler = failWhere(
      (name, stageIndex) => stageIndex === 0 && name === 'test_invalid_qty_raises',
    );
    await user.click(screen.getByRole('button', { name: /^Submit$/ }));
    const regressions = await within(results()).findByRole('region', { name: 'Regressions' });
    expect(within(regressions).getByText(/1 regression: earlier stages broke/)).toBeInTheDocument();
    expect(within(regressions).getByText(/Regression · Stage 1 test broke/)).toBeInTheDocument();
    expect(runner.requests[1]!.payload.tests.some((t) => t.stageIndex === 0)).toBe(true);
  });

  it('completes the interview and links to the debrief', async () => {
    const storage = new MemoryStorage();
    await storage.progress.put({
      problemId: sim.id,
      status: 'attempted',
      currentStageIndex: 3,
      stages: {},
      startedAt: 1,
      solvedAt: null,
      updatedAt: 1,
    });
    const { user } = await openProblem(sim.id, { storage });
    await user.click(screen.getByRole('button', { name: /^Submit$/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Interview complete!' });
    await user.click(within(dialog).getByRole('button', { name: 'View debrief' }));
    expect(
      await screen.findByRole('heading', { name: 'Debrief: Inventory Reservations' }),
    ).toBeInTheDocument();
  });
});

describe('hints and solutions', () => {
  it('reveals hints one at a time and records usage', async () => {
    const { user, storage } = await openProblem('merge-meeting-ranges');
    await user.click(screen.getByRole('tab', { name: 'Hints 0/3' }));
    await user.click(screen.getByRole('button', { name: 'Reveal hint 1 of 3' }));
    expect(screen.getByText('Hint 1')).toBeInTheDocument();
    expect(screen.queryByText('Hint 2')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reveal hint 2 of 3' }));
    await user.click(screen.getByRole('button', { name: 'Reveal hint 3 of 3' }));
    expect(screen.getByText('All hints revealed.')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Hints 3/3' })).toBeInTheDocument();
    expect(
      (await storage.progress.get('merge-meeting-ranges'))?.stages['merge-ranges']?.hintsRevealed,
    ).toBe(3);
  });

  it('locks the solution until revealed explicitly (recorded) or solved', async () => {
    const { user, storage } = await openProblem('merge-meeting-ranges');
    await user.click(screen.getByRole('tab', { name: 'Solution' }));
    expect(screen.getByText('Reference solution is locked')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reveal solution' }));
    const confirm = await screen.findByRole('alertdialog');
    await user.click(within(confirm).getByRole('button', { name: 'Keep trying' }));
    expect(screen.getByText('Reference solution is locked')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reveal solution' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Reveal' }),
    );
    expect(await screen.findByText(/O\(n log n\) for n ranges/)).toBeInTheDocument();
    expect(
      (await storage.progress.get('merge-meeting-ranges'))?.stages['merge-ranges']
        ?.solutionRevealed,
    ).toBe(true);
  });

  it('unlocks the solution after solving', async () => {
    const { user } = await openProblem('merge-meeting-ranges');
    await user.click(screen.getByRole('button', { name: /^Submit$/ }));
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Solved!' })).getByRole('button', {
        name: 'Close',
      }),
    );
    await user.click(screen.getByRole('tab', { name: 'Solution' }));
    expect(screen.getByText('Reference solution')).toBeInTheDocument();
  });
});

describe('history, notes and drafts', () => {
  it('lists submissions and diffs against the previous one', async () => {
    const runner = new FakeRunner(failWhere(() => true));
    const { user } = await openProblem('merge-meeting-ranges', { runner });
    await user.click(screen.getByRole('tab', { name: 'Submissions' }));
    expect(screen.getByText('No submissions yet')).toBeInTheDocument();

    fireEvent.change(editor(), { target: { value: 'v1\n' } });
    await user.click(screen.getByRole('button', { name: /^Submit$/ }));
    await within(results()).findByText('Some tests failed');
    clock += 60_000;
    fireEvent.change(editor(), { target: { value: 'v1\nv2\n' } });
    await user.click(screen.getByRole('button', { name: /^Submit$/ }));
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'Submissions (2)' })).toBeInTheDocument(),
    );

    await user.click(screen.getByRole('tab', { name: 'Submissions (2)' }));
    const items = within(screen.getByRole('list', { name: 'Submission history' })).getAllByRole(
      'listitem',
    );
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('+1');
    await user.click(within(items[0]!).getByRole('button', { name: 'Diff' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Changes since the previous submission',
    });
    expect(within(dialog).getByTestId('diff-original')).toHaveTextContent('v1');
    expect(within(dialog).getByTestId('diff-modified')).toHaveTextContent('v1 v2');
    await user.keyboard('{Escape}');
    await user.click(within(items[1]!).getByRole('button', { name: 'View' }));
    expect(await screen.findByRole('dialog', { name: 'Submitted code' })).toBeInTheDocument();
  });

  it('autosaves notes as Markdown and previews them', async () => {
    const { user, storage } = await openProblem('merge-meeting-ranges');
    await user.click(screen.getByRole('tab', { name: 'Notes' }));
    await user.type(await screen.findByRole('textbox', { name: 'Notes' }), '# Remember the max()');
    expect(screen.getByText('Saving…')).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(600));
    await waitFor(() => expect(screen.getByText('Saved')).toBeInTheDocument());
    expect((await storage.notes.get('merge-meeting-ranges'))?.markdown).toBe(
      '# Remember the max()',
    );
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    expect(screen.getByRole('heading', { name: 'Remember the max()' })).toBeInTheDocument();
  });

  it('autosaves the draft, restores it, and resets to starter code after confirmation', async () => {
    const storage = new MemoryStorage();
    const first = await openProblem('merge-meeting-ranges', { storage });
    fireEvent.change(editor(), { target: { value: 'my draft' } });
    await act(() => vi.advanceTimersByTimeAsync(DRAFT_SAVE_DELAY_MS));
    await waitFor(async () =>
      expect((await storage.drafts.get('merge-meeting-ranges'))?.code).toBe('my draft'),
    );
    first.unmount();

    const { user } = await openProblem('merge-meeting-ranges', { storage });
    expect(editor()).toHaveValue('my draft');
    await user.click(screen.getByRole('button', { name: 'Reset to starter code' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Reset' }),
    );
    expect(editor()).toHaveValue(loadExample('merge-meeting-ranges').starterCode);
    expect((await storage.drafts.get('merge-meeting-ranges'))?.code).toBe(
      loadExample('merge-meeting-ranges').starterCode,
    );
  });
});

describe('timer', () => {
  const timerValue = () => screen.getByTestId('timer-value');
  const tick = async (ms: number) => {
    clock += ms;
    await act(() => vi.advanceTimersByTimeAsync(ms));
  };

  it('starts, pauses and resumes, counting only active time', async () => {
    const { user } = await openProblem('merge-meeting-ranges');
    expect(timerValue()).toHaveTextContent('00:00');
    await user.click(screen.getByRole('button', { name: 'Start timer' }));
    await tick(65_000);
    expect(timerValue()).toHaveTextContent('01:05');
    await user.click(screen.getByRole('button', { name: 'Pause timer' }));
    await tick(30_000);
    expect(timerValue()).toHaveTextContent('01:05');
    await user.click(screen.getByRole('button', { name: 'Resume timer' }));
    await tick(5_000);
    expect(timerValue()).toHaveTextContent('01:10');
  });

  it('starts automatically on the first edit', async () => {
    await openProblem('merge-meeting-ranges');
    fireEvent.change(editor(), { target: { value: 'x = 1' } });
    await tick(3_000);
    expect(timerValue()).toHaveTextContent('00:03');
    expect(screen.getByRole('button', { name: 'Pause timer' })).toBeInTheDocument();
  });

  it('auto-pauses while the tab is hidden and resumes when visible', async () => {
    let hidden = false;
    const spy = vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
    const { user } = await openProblem('merge-meeting-ranges');
    await user.click(screen.getByRole('button', { name: 'Start timer' }));
    await tick(10_000);
    hidden = true;
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(screen.getByText('auto-paused')).toBeInTheDocument();
    await tick(120_000);
    expect(timerValue()).toHaveTextContent('00:10');
    hidden = false;
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await tick(2_000);
    expect(timerValue()).toHaveTextContent('00:12');
    spy.mockRestore();
  });

  it('keeps running in a hidden tab when auto-pause is off', async () => {
    const storage = new MemoryStorage();
    await storage.saveSettings({ theme: 'dark', autoPauseOnHidden: false });
    const spy = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    const { user } = await openProblem('merge-meeting-ranges', { storage });
    await user.click(screen.getByRole('button', { name: 'Start timer' }));
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await tick(4_000);
    expect(timerValue()).toHaveTextContent('00:04');
    spy.mockRestore();
  });

  it('persists on a heartbeat and restores after a reload without counting the gap', async () => {
    const storage = new MemoryStorage();
    const first = await openProblem('merge-meeting-ranges', { storage });
    await first.user.click(screen.getByRole('button', { name: 'Start timer' }));
    await tick(HEARTBEAT_MS * 2);
    await waitFor(async () =>
      expect(
        (await storage.timers.get(['merge-meeting-ranges', 'merge-ranges']))?.accumulatedMs,
      ).toBe(HEARTBEAT_MS * 2),
    );
    await tick(3_000); // not yet flushed by a heartbeat...
    // An unloading page drops async IndexedDB writes: simulate that, so only the journal survives.
    const put = storage.timers.put.bind(storage.timers);
    storage.timers.put = () => Promise.resolve();
    window.dispatchEvent(new Event('pagehide')); // ...but journaled synchronously on unload
    first.unmount();
    storage.timers.put = put;

    clock += 3_600_000; // the tab was closed for an hour
    await openProblem('merge-meeting-ranges', { storage });
    expect(timerValue()).toHaveTextContent('00:13');
    await waitFor(async () =>
      expect(
        (await storage.timers.get(['merge-meeting-ranges', 'merge-ranges']))?.accumulatedMs,
      ).toBe(13_000),
    );
    expect(localStorage.length).toBe(0);
    expect(screen.getByRole('button', { name: 'Pause timer' })).toBeInTheDocument();
    await tick(1_000);
    expect(timerValue()).toHaveTextContent('00:14');
  });

  it('stops a stage timer when the stage passes and starts the next stage', async () => {
    const { user, storage } = await openProblem(sim.id);
    await user.click(screen.getByRole('button', { name: 'Start timer' }));
    await tick(42_000);
    await user.click(screen.getByRole('button', { name: /^Submit$/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Stage 1 complete' });
    expect(within(dialog).getByText(/00:42/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Continue to stage 2' }));
    await tick(5_000);
    expect(timerValue()).toHaveTextContent('00:05');
    expect(screen.getByRole('timer', { name: 'Stage 2 timer' })).toBeInTheDocument();
    expect(await storage.timers.get([sim.id, 'basic-stock'])).toMatchObject({
      accumulatedMs: 42_000,
      running: false,
    });
  });
});
