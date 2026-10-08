// Editor workspace: resize panels by dragging, fold and reopen them, swap sides, presets,
// a saved workspace, and the layout being remembered after a restart.
import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
import { TMP, launchEditor } from './helpers';

const DIR = path.join(TMP, 'workspace');
const USER_DATA = path.join(DIR, 'userdata');

const box = async (page: Page, id: string) => (await page.getByTestId(id).boundingBox())!;

async function drag(page: Page, id: string, dx: number, dy: number) {
  const b = await box(page, id);
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + dx / 2, b.y + b.height / 2 + dy / 2, { steps: 4 });
  await page.mouse.move(b.x + b.width / 2 + dx, b.y + b.height / 2 + dy, { steps: 4 });
  await page.mouse.up();
}

test('workspace: resize, fold, swap, presets, saved workspace, remembered', async () => {
  await fs.rm(DIR, { recursive: true, force: true });
  let { app, page, errors } = await launchEditor({ userData: USER_DATA });
  await page.setViewportSize({ width: 1500, height: 900 }).catch(() => undefined);
  await page.getByTestId('new-project-name').fill('Layout');
  await page.getByTestId('new-project-location').fill(path.join(DIR, 'projects'));
  await page.getByTestId('create-project').click();
  await expect(page.getByTestId('project-name')).toHaveText('Layout');

  // Default layout.
  await expect(page.getByTestId('workspace-menu')).toContainText('Default');
  expect(Math.round((await box(page, 'panel-left')).width)).toBe(272);
  const inspectorW = (await box(page, 'panel-inspector')).width;

  // Drag the dividers: wider scene list, narrower properties, taller stage.
  await drag(page, 'split-left', 100, 0);
  expect(Math.round((await box(page, 'panel-left')).width)).toBeGreaterThanOrEqual(365);
  await drag(page, 'split-inspector', 60, 0);
  expect((await box(page, 'panel-inspector')).width).toBeLessThan(inspectorW - 40);
  const stageH = (await box(page, 'stage')).height;
  await drag(page, 'split-stage', 0, 90);
  expect((await box(page, 'stage')).height).toBeGreaterThan(stageH + 40);
  await expect(page.getByTestId('workspace-menu')).toContainText('*'); // modified

  // Keyboard resize on a focused divider.
  const before = (await box(page, 'panel-left')).width;
  await page.getByTestId('split-left').focus();
  await page.keyboard.press('ArrowLeft');
  expect(Math.round((await box(page, 'panel-left')).width)).toBe(Math.round(before - 10));

  // Fold and reopen panels.
  await page.getByTestId('fold-inspector').click();
  await expect(page.getByTestId('panel-inspector')).toHaveCount(0);
  await page.getByTestId('rail-inspector').click();
  await expect(page.getByTestId('panel-inspector')).toBeVisible();
  await page.getByTestId('fold-stage').click();
  await expect(page.getByTestId('stage')).toHaveCount(0);
  await page.getByTestId('rail-stage').click();
  await expect(page.getByTestId('stage')).toBeVisible();

  // Hide a panel from the menu, swap sides.
  await page.getByTestId('workspace-menu').click();
  await page.getByTestId('panel-toggle-left').click();
  await expect(page.getByTestId('panel-left')).toHaveCount(0);
  await expect(page.getByTestId('rail-left')).toHaveCount(0);
  await page.getByTestId('panel-toggle-left').click();
  await page.getByTestId('workspace-swap').click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('workspace-pop')).toHaveCount(0);
  expect((await box(page, 'panel-inspector')).x).toBeLessThan((await box(page, 'panel-left')).x);

  // Presets.
  await page.getByTestId('workspace-menu').click();
  await page.getByTestId('workspace-writing').click();
  await expect(page.getByTestId('rail-stage')).toBeVisible();
  expect((await box(page, 'nav-scenes')).width).toBeLessThan(60); // compact sidebar
  await expect(page.getByTestId('workspace-menu')).toContainText('Writing');
  await expect(page.getByTestId('workspace-menu')).not.toContainText('*');
  // Writing still lets you write (typing works with the folded stage).
  await page.getByTestId('quick-dialogue').click();
  await page.getByTestId('field-text').click();
  await page.keyboard.type('Typed in Writing', { delay: 5 });
  await expect(page.getByTestId('field-text')).toHaveValue('Typed in Writing');

  await page.getByTestId('workspace-menu').click();
  await page.getByTestId('workspace-art').click();
  await expect(page.getByTestId('left-tab-assets')).toHaveAttribute('aria-selected', 'true');
  expect(Math.round((await box(page, 'panel-left')).width)).toBe(440);

  // Save the current layout as a workspace.
  await drag(page, 'split-left', -100, 0);
  await page.getByTestId('workspace-menu').click();
  await page.getByTestId('workspace-save').click();
  await page.getByTestId('prompt-input').fill('My Art');
  await page.getByTestId('prompt-ok').click();
  await expect(page.getByTestId('workspace-menu')).toContainText('My Art');
  const savedW = Math.round((await box(page, 'panel-left')).width);
  await page.screenshot({ path: path.join(TMP, 'shots', 'p1-workspace.png') });

  // Switch away, then back to the saved workspace.
  await page.getByTestId('workspace-menu').click();
  await page.getByTestId('workspace-default').click();
  expect(Math.round((await box(page, 'panel-left')).width)).toBe(272);
  await page.getByTestId('workspace-menu').click();
  await page.getByTestId('workspace-custom-My Art').click();
  expect(Math.round((await box(page, 'panel-left')).width)).toBe(savedW);
  await page.getByTestId('save').click();
  await page.waitForTimeout(600); // the layout is saved shortly after the last change
  expect(errors).toEqual([]);
  await app.close();

  // Restart: the layout and the saved workspace are remembered.
  ({ app, page, errors } = await launchEditor({ userData: USER_DATA }));
  await page.getByTestId('recent-item').filter({ hasText: 'Layout' }).first().click();
  await expect(page.getByTestId('workspace-menu')).toContainText('My Art');
  expect(Math.round((await box(page, 'panel-left')).width)).toBe(savedW);
  await expect(page.getByTestId('left-tab-assets')).toHaveAttribute('aria-selected', 'true');
  await page.getByTestId('workspace-menu').click();
  await page.getByTestId('workspace-delete-My Art').click();
  await expect(page.getByTestId('workspace-custom-My Art')).toHaveCount(0);
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
  await app.close();
});
