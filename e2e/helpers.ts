import { readFileSync } from 'node:fs';
import path from 'node:path';

import { expect, type Page } from '@playwright/test';

import type { Problem } from '../src/types/problem.generated';

export function loadProblem(id: string): Problem {
  return JSON.parse(
    readFileSync(path.resolve(import.meta.dirname, '..', 'problems', `${id}.json`), 'utf8'),
  ) as Problem;
}

/** Opens a problem and waits until both the editor and Python are ready. */
export async function openProblem(page: Page, id: string): Promise<void> {
  await page.goto(`/problems/${id}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.waitForFunction(() => window.__eliteEditor !== undefined);
  await expect(page.getByText(/Python 3\.14\.\d+ · ready/)).toBeVisible();
}

export async function setCode(page: Page, code: string): Promise<void> {
  await page.evaluate((value) => window.__eliteEditor?.setValue(value), code);
}

export async function submit(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
}

export const verdict = (page: Page) => page.getByTestId('verdict');
