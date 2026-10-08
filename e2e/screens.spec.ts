// Screenshots of the main screens for manual review (.e2e-tmp/shots/); also checks they render.
import { test } from '@playwright/test';
import path from 'node:path';
import { TMP, launchEditor } from './helpers';
const OUT = path.join(TMP, 'shots');
test('screens render (screenshots for review)', async () => {
  const { app, page } = await launchEditor();
  await page.setViewportSize({ width: 1400, height: 860 }).catch(() => undefined);
  await page.screenshot({ path: path.join(OUT, 'a1-welcome.png') });
  await page.getByTestId('app-settings').click();
  await page.screenshot({ path: path.join(OUT, 'a2-app-general.png') });
  await page.getByTestId('app-settings-interface').click();
  await page.screenshot({ path: path.join(OUT, 'a3-app-interface.png') });
  await page.keyboard.press('Escape');
  await page.getByTestId('new-project-name').fill('Shots');
  await page.getByTestId('new-project-location').fill(path.join(TMP, 'shots-projects'));
  await page.getByTestId('create-project').click();
  await page.getByTestId('nav-settings').click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, 'a4-project-settings.png') });
  await app.close();
});
