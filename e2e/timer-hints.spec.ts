import { expect, test } from '@playwright/test';

import { openProblem } from './helpers';

const timerSeconds = async (text: string | null) => {
  const [m, s] = (text ?? '00:00').split(':').map(Number);
  return (m ?? 0) * 60 + (s ?? 0);
};

test('pause and resume the timer, and keep it across a reload', async ({ page }) => {
  await openProblem(page, 'lru-cache');
  const value = page.getByTestId('timer-value');
  await expect(value).toHaveText('00:00');

  await page.getByRole('button', { name: 'Start timer' }).click();
  await expect.poll(async () => timerSeconds(await value.textContent())).toBeGreaterThanOrEqual(2);
  await page.getByRole('button', { name: 'Pause timer' }).click();
  const paused = await timerSeconds(await value.textContent());
  await page.waitForTimeout(1500);
  expect(await timerSeconds(await value.textContent())).toBe(paused);

  await page.getByRole('button', { name: 'Resume timer' }).click();
  await expect.poll(async () => timerSeconds(await value.textContent())).toBeGreaterThan(paused);
  const beforeReload = await timerSeconds(await value.textContent());

  await page.reload();
  await expect(page.getByRole('button', { name: 'Pause timer' })).toBeVisible();
  expect(await timerSeconds(await value.textContent())).toBeGreaterThanOrEqual(beforeReload);
  await expect
    .poll(async () => timerSeconds(await value.textContent()))
    .toBeGreaterThan(beforeReload);
});

test('hints are progressive and the solution stays locked until revealed', async ({ page }) => {
  await openProblem(page, 'lru-cache');
  await page.getByRole('tab', { name: 'Hints 0/3' }).click();
  await page.getByRole('button', { name: 'Reveal hint 1 of 3' }).click();
  await expect(page.getByText('Hint 1')).toBeVisible();
  await expect(page.getByText('Hint 2')).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Hints 1/3' })).toBeVisible();

  await page.getByRole('tab', { name: 'Solution' }).click();
  await expect(page.getByText('Reference solution is locked')).toBeVisible();
  await page.getByRole('button', { name: 'Reveal solution' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Reveal' }).click();
  await expect(page.getByText('OrderedDict', { exact: false }).first()).toBeVisible();

  // Both survive a reload.
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Hints 1/3' })).toBeVisible();
  await page.getByRole('tab', { name: 'Solution' }).click();
  await expect(page.getByText('Reference solution is locked')).toHaveCount(0);
});
