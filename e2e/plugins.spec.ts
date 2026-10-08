// Plugin Manager (Settings → Plugins): install from folder and from a .tstplugin file, use the content
// (theme, action template) in a project, disable, remove — with the real sample plugin.
import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { ROOT, TMP, launchEditor, queueDialog } from './helpers';

const DIR = path.join(TMP, 'plugins-e2e');
const SAMPLE = path.join(ROOT, 'plugins', 'tstvn-sample-pack');

test('plugin manager: install, use, disable, remove', async () => {
  await fs.rm(DIR, { recursive: true, force: true });
  await fs.mkdir(DIR, { recursive: true });
  await fs.rm(path.join(TMP, 'userdata', 'plugins'), { recursive: true, force: true });
  const packed = execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'pack-plugin.mjs'), SAMPLE, DIR], { encoding: 'utf8' }).trim();

  const { app, page, errors } = await launchEditor();
  await page.getByTestId('app-settings').click();
  await page.getByTestId('app-settings-plugins').click();
  await expect(page.getByTestId('plugin-manager')).toContainText('No plugins installed yet');

  // Install from a folder.
  await queueDialog(app, SAMPLE);
  await page.getByTestId('plugin-install-folder').click();
  const card = page.getByTestId('plugin-tstvn.sample-pack');
  await expect(card).toContainText('TSTVN Sample Pack');
  await expect(card).toContainText('enabled');
  await expect(card).toContainText('1 theme(s) · 1 action template(s)');
  // Install the same plugin from a .tstplugin file (update): still one entry.
  await queueDialog(app, [packed]);
  await page.getByTestId('plugin-install-file').click();
  await expect(page.locator('[data-testid^="plugin-tstvn."]')).toHaveCount(1);
  await page.keyboard.press('Escape');

  // The plugin's content appears in the editor.
  await page.getByTestId('new-project-name').fill('Plugin Game');
  await page.getByTestId('new-project-location').fill(path.join(DIR, 'projects'));
  await page.getByTestId('create-project').click();
  await page.getByTestId('nav-themes').click();
  await page.getByTestId('theme-Sunset Glow').click();
  await expect(page.getByTestId('theme-props-readonly')).toBeVisible();
  await page.getByTestId('use-theme').click();
  await expect(page.getByTestId('theme-title')).toHaveText('Sunset Glow');
  await expect(page.getByTestId('theme-editor')).toBeVisible(); // now a project theme (editable copy)

  await page.getByTestId('nav-scenes').click();
  const rows = page.locator('.action-row');
  const before = await rows.count();
  await page.getByTestId('add-action').click();
  await page.getByTestId('cat-templates').click();
  await page.getByTestId('template-item-Dramatic Entrance').click();
  await expect(rows).toHaveCount(before + 3);
  await expect(page.locator('[data-type="narration"]').last()).toContainText('Suddenly, everything changed.');

  // Disable: the plugin's content is hidden, what the project already copied stays.
  await page.getByTestId('app-settings').click();
  await page.getByTestId('app-settings-plugins').click();
  await page.getByTestId('plugin-toggle-tstvn.sample-pack').uncheck();
  await expect(page.getByTestId('plugin-tstvn.sample-pack')).toContainText('disabled');
  await page.keyboard.press('Escape');
  await page.getByTestId('add-action').click();
  await page.getByTestId('cat-templates').click();
  await expect(page.getByTestId('template-item-Dramatic Entrance')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByTestId('nav-themes').click();
  await expect(page.getByTestId('theme-Sunset Glow')).toHaveCount(1); // only the project's copy
  await page.getByTestId('nav-export').click();
  await expect(page.getByTestId('project-check')).toContainText('No problems found');

  // Remove.
  await page.getByTestId('app-settings').click();
  await page.getByTestId('app-settings-plugins').click();
  await page.getByTestId('plugin-remove-tstvn.sample-pack').click();
  await page.getByTestId('confirm-ok').click();
  await expect(page.getByTestId('plugin-manager')).toContainText('No plugins installed yet');
  expect(errors).toEqual([]);
  await app.close();
});
