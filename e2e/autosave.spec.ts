// Autosave: status bar indicator, interval changes apply while a project is open, the save really
// happens on disk, "Autosaved" vs "Saved", and turning it off.
import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
import { TMP, launchEditor } from './helpers';

const DIR = path.join(TMP, 'autosave');

test('autosave: live interval, really saves, indicator, off', async () => {
  test.setTimeout(240_000);
  await fs.rm(DIR, { recursive: true, force: true });
  const { app, page, errors } = await launchEditor();
  // Default settings (2 minutes) while the project opens.
  await page.getByTestId('app-settings').click();
  await page.getByTestId('app-settings-autosave').click();
  await page.getByTestId('autosave-enabled').check();
  await page.getByTestId('app-settings-dialog').locator('input[type=number]').fill('2');
  await page.keyboard.press('Escape');
  await page.getByTestId('new-project-name').fill('Autosave Test');
  await page.getByTestId('new-project-location').fill(path.join(DIR, 'projects'));
  await page.getByTestId('create-project').click();
  await expect(page.getByTestId('autosave-status')).toHaveText('Autosave every 2 min');

  await page.getByTestId('quick-dialogue').click();
  await page.getByTestId('field-text').fill('AUTOSAVED LINE');
  await expect(page.getByTestId('save-status')).toContainText('Unsaved');
  await expect(page.getByTestId('autosave-status')).toContainText(/Autosave in [12]:\d\d/);

  // Changing the interval while the project is open applies at once (it used to need a reopen).
  await page.getByTestId('autosave-status').click();
  await page.getByTestId('app-settings-dialog').locator('input[type=number]').fill('1');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('autosave-status')).toContainText(/Autosave in (0:\d\d|\d+s)/);
  await expect(page.getByTestId('save-status')).toContainText('Autosaved', { timeout: 75_000 });
  const saved = await fs.readFile(path.join(DIR, 'projects', 'Autosave Test', 'project.json'), 'utf8');
  expect(saved).toContain('AUTOSAVED LINE');
  await expect(page.getByTestId('autosave-status')).toHaveText('Autosave every 1 min');

  // A manual save is shown as "Saved", not "Autosaved".
  await page.getByTestId('field-text').fill('MANUAL LINE');
  await page.getByTestId('save').click();
  await expect(page.getByTestId('save-status')).toHaveText(/^✓ Saved /);

  // Off: no countdown, the change stays unsaved.
  await page.getByTestId('autosave-status').click();
  await page.getByTestId('autosave-enabled').uncheck();
  await page.keyboard.press('Escape');
  await page.getByTestId('field-text').fill('NOT AUTOSAVED');
  await expect(page.getByTestId('autosave-status')).toHaveText('Autosave off');
  await page.waitForTimeout(3000);
  await expect(page.getByTestId('save-status')).toContainText('Unsaved');

  // Back to the default for the other tests.
  await page.getByTestId('autosave-status').click();
  await page.getByTestId('autosave-enabled').check();
  await page.getByTestId('app-settings-dialog').locator('input[type=number]').fill('2');
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
  await app.close();
});
