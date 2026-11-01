import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

import { loadProblem, openProblem, setCode, submit } from './helpers';

test('import a problem file, with inline validation errors first', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Import' }).click();
  const dialog = page.getByRole('dialog', { name: 'Import a problem' });

  await dialog.getByLabel('Problem file').setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ schemaVersion: 1, id: 'Bad Id' })),
  });
  await expect(dialog.getByRole('alert')).toContainText('validation error');
  await expect(dialog.getByRole('list', { name: 'Validation errors' })).toContainText(
    'missing required property',
  );

  const custom = {
    ...loadProblem('merge-meeting-ranges'),
    id: 'my-merge-variant',
    title: 'My Merge Variant',
  };
  await dialog.getByLabel('Problem file').setInputFiles({
    name: 'my-merge-variant.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(custom)),
  });
  await expect(dialog.getByText('Valid problem')).toBeVisible();
  await dialog.getByRole('button', { name: 'Add to library' }).click();

  await expect(page.getByRole('heading', { name: 'My Merge Variant', level: 1 })).toBeVisible();
  await page.getByRole('link', { name: 'Problems' }).first().click();
  await expect(page.getByRole('row', { name: /My Merge Variant/ })).toContainText('imported');
});

test('export all data and re-import it into a fresh browser profile', async ({ page, browser }) => {
  const problem = loadProblem('matching-refunds');
  await openProblem(page, problem.id);
  await setCode(page, problem.stages[0]!.solution.code);
  await submit(page);
  await page
    .getByRole('dialog', { name: 'Solved!' })
    .getByRole('button', { name: 'Close' })
    .click();

  await page.getByRole('button', { name: 'Settings' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export data' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^elite-code-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const backupPath = await download.path();
  const backup = JSON.parse(readFileSync(backupPath, 'utf8')) as {
    data: { submissions: unknown[] };
  };
  expect(backup.data.submissions).toHaveLength(1);

  // A brand-new profile has no progress until the backup is restored.
  const fresh = await browser.newContext();
  const page2 = await fresh.newPage();
  await page2.goto('/');
  const row = page2.getByRole('row', { name: /Matching Refunds/ });
  await expect(row.getByRole('img', { name: 'Unsolved' })).toBeVisible();

  await page2.getByRole('button', { name: 'Settings' }).click();
  await page2.getByLabel('Backup file').setInputFiles(backupPath);
  await page2.getByRole('alertdialog').getByRole('button', { name: 'Replace data' }).click();
  await expect(page2.getByText('Data restored from backup')).toBeVisible();
  await page2.keyboard.press('Escape');
  await expect(row.getByRole('img', { name: 'Solved' })).toBeVisible();

  await page2.getByRole('link', { name: 'Dashboard' }).click();
  await expect(page2.getByRole('region', { name: 'Summary' })).toContainText('1/27');
  await fresh.close();
});
