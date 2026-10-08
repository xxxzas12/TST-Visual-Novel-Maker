// Application logo (Application Settings) vs. game icon (Project Settings): both through the real UI.
import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
import { pngBuffer } from '../scripts/media.mjs';
import { TMP, launchEditor, queueDialog } from './helpers';

const DIR = path.join(TMP, 'branding');

test('application logo: choose, preview, persist, reset — and a separate game icon', async () => {
  await fs.rm(DIR, { recursive: true, force: true });
  const logo = path.join(DIR, 'logo.png');
  const iconDir = path.join(DIR, 'Icons');
  await fs.mkdir(iconDir, { recursive: true });
  await fs.writeFile(logo, pngBuffer(96, 96, (x, y) => [255, x * 2, y * 2, 255]));
  await fs.writeFile(path.join(iconDir, 'game-icon.png'), pngBuffer(64, 64, (x) => [20, 200, x * 4, 255]));

  let { app, page, errors } = await launchEditor();
  // Application Settings → Application logo, before any project exists.
  await page.getByTestId('app-settings').click();
  await page.getByTestId('app-settings-logo').click();
  await expect(page.getByTestId('logo-reset')).toBeDisabled();
  await queueDialog(app, [logo]);
  await page.getByTestId('logo-choose').click();
  await expect(page.getByTestId('logo-preview-img')).toBeVisible();
  await expect(page.getByTestId('logo-preview-img')).toHaveAttribute('src', /^data:image\/png;base64,/);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('welcome-brand').getByTestId('app-logo-img')).toBeVisible();
  expect(errors).toEqual([]);
  await app.close();

  // Persists after a restart, and shows inside a project too.
  ({ app, page, errors } = await launchEditor());
  await expect(page.getByTestId('welcome-brand').getByTestId('app-logo-img')).toBeVisible();
  await page.getByTestId('new-project-name').fill('Icon Game');
  await page.getByTestId('new-project-location').fill(path.join(DIR, 'projects'));
  await page.getByTestId('create-project').click();
  await expect(page.locator('.topbar').getByTestId('app-logo-img')).toBeVisible();

  // Game icon is a project setting, chosen from the project's own assets.
  await page.getByTestId('nav-assets').click();
  await queueDialog(app, iconDir);
  await page.getByTestId('import-folder').click();
  await expect(page.getByTestId('import-report')).toBeVisible({ timeout: 60000 });
  await page.getByTestId('import-report-done').click();
  await page.getByTestId('nav-settings').click();
  await expect(page.getByTestId('game-icon-name')).toHaveText('None (default)');
  await page.getByTestId('choose-game-icon').click();
  await page.getByTestId('asset-picker').getByTestId('pick-game-icon.png').click();
  await expect(page.getByTestId('game-icon-name')).toHaveText('game-icon.png');
  await page.getByTestId('save').click();

  await page.getByTestId('nav-export').click();
  await page.getByTestId('export-outdir').fill(path.join(DIR, 'exports'));
  await page.getByTestId('platform-web').click();
  await page.getByTestId('export-build').click();
  await expect(page.getByTestId('export-success')).toBeVisible({ timeout: 60000 });
  const html = await fs.readFile(path.join(DIR, 'exports', 'Icon Game-Web', 'index.html'), 'utf8');
  expect(html).toMatch(/<link rel="icon" href="assets\/Icons\/game-icon\.png">/);
  // The TSTVN logo never ends up in a game.
  const files = await fs.readdir(path.join(DIR, 'exports', 'Icon Game-Web'), { recursive: true });
  expect(files.some((f) => String(f).includes('logo'))).toBe(false);

  // Reset the application logo.
  await page.getByTestId('app-settings').click();
  await page.getByTestId('app-settings-logo').click();
  await page.getByTestId('logo-reset').click();
  await expect(page.getByTestId('logo-preview-img')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('.topbar').getByTestId('app-logo-img')).toHaveCount(0);
  expect(errors).toEqual([]);
  await app.close();
});
