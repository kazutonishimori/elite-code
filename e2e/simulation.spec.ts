import { expect, test } from '@playwright/test';

import { loadProblem, openProblem, setCode, submit, verdict } from './helpers';

const sim = loadProblem('inventory-reservations');

test('complete a full simulation, including a regression', async ({ page }) => {
  await openProblem(page, sim.id);
  await expect(page.getByText('Stage 1 of 4: Basic stock')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Stage 2: locked' })).toBeDisabled();

  // Stage 1
  await setCode(page, sim.stages[0]!.solution.code);
  await submit(page);
  await expect(page.getByRole('dialog', { name: 'Stage 1 complete' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue to stage 2' }).click();
  await expect(page.getByText('Stage 2 of 4: Reservations')).toBeVisible();

  // Stage 2, first attempt: reservations work, but stage 1's validation was dropped.
  const regressed = sim.stages[1]!.solution.code.replace(
    '    def add(self, sku: str, qty: int) -> None:\n        if qty <= 0:\n            raise ValueError("qty must be positive")\n',
    '    def add(self, sku: str, qty: int) -> None:\n',
  );
  expect(regressed).not.toBe(sim.stages[1]!.solution.code);
  await setCode(page, regressed);
  await submit(page);
  await expect(verdict(page)).toHaveText('Some tests failed');
  const regressions = page.getByRole('region', { name: 'Regressions' });
  await expect(regressions).toContainText('Regression · Stage 1 test broke');
  await expect(regressions.getByTestId('test-test_invalid_qty_raises')).toBeVisible();

  // Stages 2-4 with the reference solutions.
  for (const k of [1, 2]) {
    await setCode(page, sim.stages[k]!.solution.code);
    await submit(page);
    await expect(page.getByRole('dialog', { name: `Stage ${k + 1} complete` })).toBeVisible();
    await page.getByRole('button', { name: `Continue to stage ${k + 2}` }).click();
  }
  await setCode(page, sim.stages[3]!.solution.code);
  await submit(page);
  await expect(page.getByRole('dialog', { name: 'Interview complete!' })).toBeVisible();
  await page.getByRole('button', { name: 'View debrief' }).click();

  await expect(
    page.getByRole('heading', { name: 'Debrief: Inventory Reservations' }),
  ).toBeVisible();
  const totals = page.getByRole('region', { name: 'Totals' });
  await expect(totals).toContainText('Submissions5');
  await expect(totals).toContainText('Regressions hit1');
  await expect(page.getByText('Stage 4: Atomic batches')).toBeVisible();

  // Earlier stages stay readable, with a snapshot of the code at the time.
  await page.getByRole('link', { name: 'Back to the problem' }).click();
  await page.getByRole('button', { name: 'Stage 1: Basic stock' }).click();
  await page.getByRole('button', { name: /Your code at the end of this stage/ }).click();
  await expect(page.getByRole('dialog', { name: /Your code at the end of stage 1/ })).toBeVisible();
});
