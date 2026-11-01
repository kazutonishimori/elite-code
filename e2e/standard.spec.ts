import { expect, test } from '@playwright/test';

import { loadProblem, openProblem, setCode, submit, verdict } from './helpers';

const problem = loadProblem('merge-meeting-ranges');

test('solve a standard problem end to end', async ({ page }) => {
  await openProblem(page, problem.id);
  await expect(page.getByText('6 hidden tests run on Submit.')).toBeVisible();

  // Run the starter code: visible tests fail with real Python output.
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(verdict(page)).toHaveText(/Some tests failed/);
  await expect(page.getByTestId('test-test_example')).toContainText('NotImplementedError');

  // Custom input runs against the user's code.
  await setCode(page, problem.stages[0]!.solution.code);
  await page.getByRole('tab', { name: 'Custom input' }).click();
  await page.getByLabel(/Python to run after your code/).fill('merge_ranges([(1, 3), (2, 4)])');
  await page.getByRole('button', { name: 'Run with custom input' }).click();
  await expect(page.getByTestId('custom-output')).toContainText('=> [(1, 4)]');

  // Submit the reference solution: accepted, solved, solution unlocked.
  await submit(page);
  await expect(page.getByRole('dialog', { name: 'Solved!' })).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(verdict(page)).toHaveText('Accepted');
  await expect(page.getByTestId('pass-count')).toHaveText('9/9 passed');

  await page.getByRole('tab', { name: 'Solution' }).click();
  await expect(page.getByText('Reference solution')).toBeVisible();

  await page.getByRole('link', { name: 'Problems' }).first().click();
  const row = page.getByRole('row', { name: /Merge Meeting Ranges/ });
  await expect(row.getByRole('img', { name: 'Solved' })).toBeVisible();
});

test('an infinite loop hits the time limit and Python recovers', async ({ page }) => {
  await openProblem(page, problem.id);
  await setCode(page, 'def merge_ranges(ranges):\n    while True:\n        pass\n');
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(verdict(page)).toHaveText('Time limit exceeded', { timeout: 20_000 });

  await setCode(page, problem.stages[0]!.solution.code);
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(verdict(page)).toHaveText('All tests passed', { timeout: 30_000 });
});
