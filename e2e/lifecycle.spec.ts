// The requested end-to-end path, in order: New Project → Edit → Save → Close → Reopen → Preview → Export
// (and the exported game runs and shows the edit).
import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { TMP, launchEditor } from './helpers';

const DIR = path.join(TMP, 'lifecycle');

test('new project → edit → save → close → reopen → preview → export', async () => {
  await fs.rm(DIR, { recursive: true, force: true });
  let { app, page, errors } = await launchEditor();

  // New Project
  await page.getByTestId('new-project-name').fill('Lifecycle');
  await page.getByTestId('new-project-location').fill(path.join(DIR, 'projects'));
  await page.getByTestId('create-project').click();
  await expect(page.getByTestId('project-name')).toHaveText('Lifecycle');

  // Edit (typed with real keystrokes)
  await page.getByTestId('quick-dialogue').click();
  await page.getByTestId('field-text').click();
  await page.keyboard.type('Hello from the lifecycle test!', { delay: 10 });
  await page.getByTestId('nav-settings').click();
  await page.getByTestId('settings-title').fill('Lifecycle Game');
  await expect(page.getByTestId('save-status')).toContainText('Unsaved');

  // Save, Close
  await page.getByTestId('save').click();
  await expect(page.getByTestId('save-status')).toHaveText(/^✓ Saved /);
  await page.getByTestId('close-project').click();
  await expect(page.getByTestId('welcome')).toBeVisible();
  expect(errors).toEqual([]);
  await app.close();

  // Reopen (new app session)
  ({ app, page, errors } = await launchEditor());
  await page.getByTestId('recent-item').filter({ hasText: 'Lifecycle' }).first().click();
  await expect(page.getByTestId('project-name')).toHaveText('Lifecycle');
  await expect(page.locator('[data-type="dialogue"]')).toContainText('Hello from the lifecycle test!');

  // Preview
  await page.getByTestId('play').click();
  const frame = page.frameLocator('[data-testid="preview-frame"]');
  await expect(frame.getByTestId('tvn-title')).toHaveText('Lifecycle Game');
  await frame.getByTestId('tvn-start').click();
  for (let i = 0; i < 15 && !((await frame.getByTestId('tvn-text').textContent()) ?? '').includes('lifecycle'); i++) {
    await frame.getByTestId('tvn-root').click({ position: { x: 200, y: 150 } });
    await page.waitForTimeout(250);
  }
  await expect(frame.getByTestId('tvn-text')).toContainText('Hello from the lifecycle test!');
  await page.getByTestId('close-preview').click();

  // Export (Web + Windows) and run the exported game
  await page.getByTestId('nav-export').click();
  await expect(page.getByTestId('project-check')).toContainText('No problems found');
  await page.getByTestId('export-outdir').fill(path.join(DIR, 'exports'));
  for (const platform of ['web', 'windows'] as const) {
    await page.getByTestId(`platform-${platform}`).click();
    await page.getByTestId('export-build').click();
    await expect(page.getByTestId('export-success')).toBeVisible({ timeout: 120_000 });
  }
  expect(existsSync(path.join(DIR, 'exports', 'Lifecycle Game-Windows', 'Lifecycle Game.exe'))).toBe(true);
  const [win] = await Promise.all([
    app.waitForEvent('window'),
    app.evaluate(({ BrowserWindow }, f) => void new BrowserWindow({ width: 1000, height: 600 }).loadFile(f), path.join(DIR, 'exports', 'Lifecycle Game-Web', 'index.html')),
  ]);
  await expect(win.getByTestId('tvn-title')).toHaveText('Lifecycle Game');
  await win.getByTestId('tvn-start').click();
  for (let i = 0; i < 15 && !((await win.getByTestId('tvn-text').textContent()) ?? '').includes('lifecycle'); i++) {
    await win.getByTestId('tvn-root').click({ position: { x: 200, y: 150 } });
    await win.waitForTimeout(250);
  }
  await expect(win.getByTestId('tvn-text')).toContainText('Hello from the lifecycle test!');
  await win.close();
  expect(errors).toEqual([]);
  await app.close();
});
