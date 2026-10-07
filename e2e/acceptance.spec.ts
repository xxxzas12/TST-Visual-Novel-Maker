// Full acceptance test (spec section 59): real Electron app, real files, real export.
import { test, expect, _electron as electron, type Page, type FrameLocator } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { makeSampleAssets } from '../scripts/media.mjs';
import { TMP, dragAndDrop, electronEnv, freshTmp, launchEditor, queueDialog } from './helpers';

const shots = path.join(TMP, 'screenshots');
async function shot(page: Page, name: string) {
  await fs.mkdir(shots, { recursive: true });
  await page.screenshot({ path: path.join(shots, `${name}.png`) });
}

async function prompt(page: Page, value: string) {
  const input = page.getByTestId('prompt-input');
  await expect(input).toBeVisible();
  await input.fill(value);
  await page.getByTestId('prompt-ok').click();
}

async function addActionFromMenu(page: Page, search: string, type: string) {
  await page.getByTestId('add-action').click();
  await page.getByTestId('action-search').fill(search);
  await page.getByTestId(`menu-${type}`).click();
}

async function advanceUntil(frame: FrameLocator, predicate: () => Promise<boolean>, max = 30) {
  for (let i = 0; i < max; i++) {
    if (await predicate()) return;
    await frame.getByTestId('tvn-root').click({ position: { x: 200, y: 120 } });
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('condition not reached while advancing the game');
}

test('TSTVN acceptance: create → import → build → preview → save → reopen → export → run', async () => {
  await freshTmp();
  const assetsDir = await makeSampleAssets(path.join(TMP, 'Assets'));
  const projectsDir = path.join(TMP, 'projects');
  const exportDir = path.join(TMP, 'exports');

  let { app, page, errors } = await launchEditor();

  await test.step('create project', async () => {
    await expect(page.getByTestId('welcome')).toBeVisible();
    await page.getByTestId('new-project-name').fill('E2E Novel');
    await page.getByTestId('new-project-location').fill(projectsDir);
    await page.getByTestId('template-blank').click();
    await page.getByTestId('create-project').click();
    await expect(page.getByTestId('project-name')).toHaveText('E2E Novel');
    expect(existsSync(path.join(projectsDir, 'E2E Novel', 'project.json'))).toBe(true);
    await page.getByTestId('onboarding-skip').click();
  });

  await test.step('import folder (recursive) + report + unknown assets', async () => {
    await page.getByTestId('nav-assets').click();
    await queueDialog(app, assetsDir);
    await page.getByTestId('import-folder').click();
    const report = page.getByTestId('import-report');
    await expect(report).toBeVisible();
    await expect(page.getByTestId('stat-imported')).toContainText('16');
    await expect(page.getByTestId('stat-images')).toContainText('11');
    await expect(page.getByTestId('stat-audio')).toContainText('5');
    await expect(page.getByTestId('stat-unsupported')).toContainText('1');
    await expect(report).toContainText('Created 2 character(s)');
    const unknown = page.getByTestId('unknown-assets');
    await expect(unknown).toContainText('mystery.png');
    await unknown.getByRole('button', { name: 'Select all' }).click();
    await page.getByTestId('unknown-bulk-type').selectOption('ui');
    await page.getByTestId('unknown-apply').click();
    await expect(unknown).toHaveCount(0);
    await shot(page, '01-import-report');
    await page.getByTestId('import-report-done').click();
  });

  await test.step('gallery: grid, filter, search, multi-select, list view', async () => {
    await expect(page.getByTestId('asset-park.png')).toBeVisible();
    await page.getByTestId('filter-background').click();
    await expect(page.locator('[data-testid^="asset-"]')).toHaveCount(3);
    await page.getByTestId('filter-background').click();
    await page.getByTestId('gallery-search').fill('happy');
    await expect(page.locator('[data-testid^="asset-"]')).toHaveCount(1);
    await page.getByTestId('gallery-search').fill('');
    await page.getByTestId('asset-park.png').click();
    await page.getByTestId('asset-classroom.png').click({ modifiers: ['Control'] });
    await expect(page.getByTestId('bulkbar')).toContainText('2 selected');
    await page.getByTestId('gallery').press('Control+a');
    await expect(page.getByTestId('bulkbar')).toContainText('16 selected');
    await page.getByTestId('gallery').press('Escape');
    await page.getByTestId('list-view').click();
    await expect(page.getByTestId('asset-door.wav')).toBeVisible();
    await page.getByTestId('grid-view').click();
    await shot(page, '02-gallery');
  });

  await test.step('file manager: new folder, move file, duplicate', async () => {
    await page.getByTestId('new-folder').click();
    await prompt(page, 'Props');
    await page.getByTestId('folder-assets').click();
    await page.getByTestId('gallery-search').fill('mystery');
    await page.getByTestId('asset-mystery.png').click();
    await page.getByTestId('bulkbar').getByRole('button', { name: /Move/ }).click();
    await page.getByTestId('choose-assets/Props').click();
    await page.getByTestId('folder-chooser-ok').click();
    await expect.poll(() => existsSync(path.join(projectsDir, 'E2E Novel', 'assets', 'Props', 'mystery.png'))).toBe(true);
    await page.getByTestId('bulkbar').getByRole('button', { name: 'Duplicate' }).click();
    await expect(page.getByTestId('asset-mystery copy.png')).toBeVisible();
    await page.getByTestId('gallery-search').fill('');
  });

  await test.step('characters created from folders', async () => {
    await page.getByTestId('nav-characters').click();
    await expect(page.getByTestId('character-Alice')).toContainText('4 expression(s)');
    await expect(page.getByTestId('character-Bob')).toContainText('2 expression(s)');
  });

  await test.step('variable', async () => {
    await page.getByTestId('nav-variables').click();
    await page.getByTestId('add-variable').click();
    await page.getByTestId('var-name-Variable1').fill('Love');
    await expect(page.getByTestId('variables-table')).toContainText('Number');
  });

  await test.step('chapters and scenes', async () => {
    await page.getByTestId('nav-scenes').click();
    await page.getByTestId('add-chapter').click();
    await prompt(page, 'Endings');
    await page.getByTestId('add-scene-Endings').click();
    await page.getByTestId('scene-name').fill('Good End');
    await page.getByTestId('quick-background').click();
    await addActionFromMenu(page, 'narration', 'narration');
    await page.getByTestId('field-text').fill('GOOD ENDING REACHED');
    await addActionFromMenu(page, 'end', 'endGame');
    await page.getByTestId('field-message').fill('Good Ending');
    await page.getByTestId('add-scene-Endings').click();
    await page.getByTestId('scene-name').fill('Normal End');
    await addActionFromMenu(page, 'end', 'endGame');
    await page.getByTestId('field-message').fill('Normal Ending');
    await expect(page.getByTestId('scene-Good End')).toBeVisible();
  });

  await test.step('build Scene 01: drag background + character, dialogue, choice, conditional, animation', async () => {
    await page.getByTestId('scene-Scene 01').click();
    await expect(page.getByTestId('current-scene')).toHaveText('Scene 01');
    // Select the last action so new ones go to the end.
    await page.getByTestId('action-1').click();

    await page.getByTestId('left-tab-assets').click();
    await dragAndDrop(page, page.getByTestId('drawer-classroom.png'), page.getByTestId('stage'));
    await expect(page.locator('[data-type="changeBackground"]').nth(1)).toContainText('classroom.png');

    await page.getByTestId('left-tab-characters').click();
    await dragAndDrop(page, page.getByTestId('drawer-char-Alice-Happy'), page.getByTestId('stage'), { x: 0.3, y: 0.6 });
    await expect(page.locator('[data-type="addCharacter"]')).toContainText('Alice (Happy)');
    await expect(page.getByTestId('stage-char-Alice')).toBeVisible();

    await page.getByTestId('align-right').click();
    await expect(page.locator('[data-type="addCharacter"]')).toContainText('at 78%');

    await page.getByTestId('left-tab-assets').click();
    await dragAndDrop(page, page.getByTestId('drawer-daily life.wav'), page.getByTestId('action-list'));
    await expect(page.locator('[data-type="playBGM"]')).toContainText('daily life.wav');

    await page.getByTestId('quick-dialogue').click();
    await page.getByTestId('field-text').fill("Hello, I'm Alice!");
    await expect(page.locator('[data-type="dialogue"]').first()).toContainText("Alice: “Hello, I'm Alice!”");

    await addActionFromMenu(page, 'shake', 'animateCharacter');
    await page.getByTestId('character-select').selectOption({ label: 'Alice' });

    await page.getByTestId('quick-choice').click();
    await page.getByTestId('choice-text-0').fill('Be kind');
    await page.getByTestId('choice-text-1').fill('Be rude');
    await page.getByTestId('choice-option-1').getByTestId('target-kind').selectOption('label');
    await page.getByTestId('choice-option-1').getByTestId('target-label').selectOption({ index: 0 }).catch(() => undefined);

    await addActionFromMenu(page, 'add value', 'addVariable');
    await page.getByTestId('variable-select').selectOption({ label: 'Love (number)' });

    await addActionFromMenu(page, 'label', 'label');
    await page.getByTestId('field-name').fill('decide');
    // Option B jumps to the label, skipping the +Love.
    await page.locator('[data-type="choice"]').click();
    await page.getByTestId('choice-option-1').getByTestId('target-kind').selectOption('label');
    await page.getByTestId('choice-option-1').getByTestId('target-label').selectOption('decide');

    await page.locator('[data-type="label"]').click();
    await addActionFromMenu(page, 'condition', 'conditional');
    await page.getByTestId('add-condition').click();
    await page.getByTestId('props-action').getByTestId('variable-select').selectOption({ label: 'Love (number)' });
    await page.getByTestId('condition-op').selectOption('>=');
    const kinds = page.getByTestId('props-action').getByTestId('target-kind');
    await kinds.nth(0).selectOption('scene');
    await kinds.nth(1).selectOption('scene');
    const scenes = page.getByTestId('props-action').getByTestId('scene-select');
    await scenes.nth(0).selectOption({ label: 'Good End' });
    await scenes.nth(1).selectOption({ label: 'Normal End' });
    await page.getByTestId('props-action').locator('input[type=number]').first().fill('1');
    await expect(page.locator('[data-type="conditional"]')).toContainText('Love >= 1');
    await shot(page, '03-scene-editor');
  });

  await test.step('theme', async () => {
    await page.getByTestId('nav-themes').click();
    await page.getByTestId('theme-Dark').click();
    await page.getByTestId('use-theme').click();
    await expect(page.getByTestId('theme-Dark')).toContainText('in use');
    await page.getByTestId('create-theme').click();
    await expect(page.getByTestId('theme-editor')).toBeVisible();
    await shot(page, '04-themes');
  });

  await test.step('story flow shows the branches', async () => {
    await page.getByTestId('nav-flow').click();
    await expect(page.getByTestId('flow-node-Good End')).toBeVisible();
    await expect(page.locator('.react-flow__edge')).not.toHaveCount(0);
    await page.getByTestId('list-mode').click();
    await expect(page.getByText('if true → Good End')).toBeVisible();
    await shot(page, '05-flow');
  });

  await test.step('project check is clean', async () => {
    await page.getByTestId('nav-export').click();
    await expect(page.getByTestId('project-check')).toContainText('No problems found');
  });

  await test.step('preview full game: choice → conditional → good ending', async () => {
    await page.getByTestId('play').click();
    const frame = page.frameLocator('[data-testid="preview-frame"]');
    await frame.getByTestId('tvn-start').click();
    await expect(frame.getByTestId('tvn-text')).toContainText('Welcome to your first visual novel');
    await advanceUntil(frame, async () => (await frame.getByTestId('tvn-choice-0').count()) > 0);
    await frame.getByTestId('tvn-choice-0').click();
    await advanceUntil(frame, async () => (await frame.getByTestId('tvn-end').count()) > 0);
    await expect(frame.getByTestId('tvn-end')).toHaveText('Good Ending');
    await shot(page, '06-preview-end');
    await page.getByTestId('close-preview').click();
  });

  await test.step('play from here + save/load inside the game', async () => {
    await page.getByTestId('nav-scenes').click();
    await page.getByTestId('scene-Scene 01').click();
    await page.locator('[data-type="dialogue"]').first().click();
    await page.getByTestId('play-from-here').click();
    const frame = page.frameLocator('[data-testid="preview-frame"]');
    await expect(frame.getByTestId('tvn-text')).toContainText("Hello, I'm Alice!");
    await expect(frame.getByTestId('tvn-name')).toHaveText('Alice');
    // The custom Dark theme is really applied (name box color from the theme).
    await expect(frame.getByTestId('tvn-name')).toHaveCSS('background-color', 'rgb(155, 28, 49)');
    await frame.getByTestId('tvn-q-save').click();
    await frame.getByTestId('tvn-slot-1').click();
    await expect(frame.getByTestId('tvn-slot-1')).toContainText('Scene 01');
    await expect(frame.getByTestId('tvn-slot-1').locator('img.tvn-slot-shot')).toHaveCount(1);
    await frame.getByTestId('tvn-menu-close').click();
    await advanceUntil(frame, async () => (await frame.getByTestId('tvn-choice-0').count()) > 0);
    await frame.getByTestId('tvn-q-load').click();
    await frame.getByTestId('tvn-slot-1').click();
    await expect(frame.getByTestId('tvn-text')).toContainText("Hello, I'm Alice!");
    await shot(page, '07-play-from-here');
    await page.getByTestId('close-preview').click();
  });

  await test.step('undo / redo', async () => {
    const before = await page.locator('.action-row').count();
    await page.getByTestId('quick-dialogue').click();
    await expect(page.locator('.action-row')).toHaveCount(before + 1);
    await page.getByTestId('undo').click();
    await expect(page.locator('.action-row')).toHaveCount(before);
    await page.getByTestId('redo').click();
    await expect(page.locator('.action-row')).toHaveCount(before + 1);
    await page.getByTestId('undo').click();
  });

  await test.step('save, close, reopen', async () => {
    await page.getByTestId('save').click();
    await expect(page.getByTestId('save-status')).toContainText('Saved');
    await page.getByTestId('close-project').click();
    await expect(page.getByTestId('welcome')).toBeVisible();
    await page.getByTestId('recent-item').first().click();
    await expect(page.getByTestId('project-name')).toHaveText('E2E Novel');
    await page.getByTestId('scene-Scene 01').click();
    await expect(page.locator('[data-type="conditional"]')).toContainText('Love >= 1');
    await expect(page.locator('[data-type="addCharacter"]')).toContainText('Alice');
  });

  await test.step('export web + windows (validated)', async () => {
    await page.getByTestId('nav-export').click();
    await page.getByTestId('export-outdir').fill(exportDir);
    await page.getByTestId('platform-web').click();
    await page.getByTestId('export-build').click();
    await expect(page.getByTestId('export-success')).toBeVisible({ timeout: 60000 });
    expect(existsSync(path.join(exportDir, 'E2E Novel-Web', 'index.html'))).toBe(true);
    await page.getByTestId('platform-windows').click();
    await page.getByTestId('export-build').click();
    await expect(page.getByTestId('export-success')).toBeVisible({ timeout: 240000 });
    await expect(page.getByTestId('export-success')).toContainText('Windows executable and game shell present');
    expect(existsSync(path.join(exportDir, 'E2E Novel-Windows', 'E2E Novel.exe'))).toBe(true);
    await shot(page, '08-export');
  });

  await test.step('package export (.tstvn)', async () => {
    const pkg = path.join(TMP, 'e2e-novel.tstvn');
    await queueDialog(app, pkg);
    await page.getByTestId('export-package').click();
    await expect.poll(() => existsSync(pkg), { timeout: 30000 }).toBe(true);
  });

  await test.step('web export renders on a phone-sized window', async () => {
    const indexHtml = path.join(exportDir, 'E2E Novel-Web', 'index.html');
    const [win] = await Promise.all([
      app.waitForEvent('window'),
      app.evaluate(({ BrowserWindow }, file) => {
        const w = new BrowserWindow({ width: 390, height: 844, show: true });
        void w.loadFile(file);
      }, indexHtml),
    ]);
    await win.waitForLoadState('domcontentloaded');
    await expect(win.getByTestId('tvn-title')).toHaveText('E2E Novel');
    await win.getByTestId('tvn-start').click();
    await expect(win.getByTestId('tvn-dialog')).toBeVisible();
    const fits = await win.evaluate(() => {
      const d = document.querySelector('[data-testid="tvn-dialog"]')!.getBoundingClientRect();
      return d.left >= 0 && d.right <= window.innerWidth + 1 && d.bottom <= window.innerHeight + 1 && document.documentElement.scrollWidth <= window.innerWidth;
    });
    expect(fits).toBe(true);
    await win.screenshot({ path: path.join(shots, '09-web-mobile-portrait.png') });
    await win.close();
  });

  expect(errors, errors.join('\n')).toEqual([]);
  await app.close();

  await test.step('run exported Windows game (PC + mobile layout)', async () => {
    const exe = path.join(exportDir, 'E2E Novel-Windows', 'E2E Novel.exe');
    const game = await electron.launch({ executablePath: exe, args: [], env: electronEnv() });
    const win = await game.firstWindow();
    const gameErrors: string[] = [];
    win.on('pageerror', (e) => gameErrors.push(e.message));
    await expect(win.getByTestId('tvn-title')).toHaveText('E2E Novel');
    // No editor UI in the game.
    await expect(win.locator('.nav, .gallery-pane, .action-list')).toHaveCount(0);
    await win.getByTestId('tvn-start').click();
    await expect(win.getByTestId('tvn-text')).toContainText('Welcome to your first visual novel');
    await win.screenshot({ path: path.join(shots, '10-exported-pc.png') });
    // Save slot with a screenshot in the real exported game.
    await win.keyboard.press('Control+s');
    await win.getByTestId('tvn-slot-1').click();
    await expect(win.getByTestId('tvn-slot-1').locator('img.tvn-slot-shot')).toHaveCount(1);
    await win.getByTestId('tvn-menu-close').click();
    for (const [w, h, name] of [
      [844, 390, 'phone-landscape'],
      [390, 844, 'phone-portrait'],
      [1024, 768, 'tablet-4x3'],
    ] as const) {
      await game.evaluate(({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setContentSize(size[0], size[1]), [w, h]);
      await win.waitForTimeout(400);
      const ok = await win.evaluate(() => {
        const d = document.querySelector('[data-testid="tvn-dialog"]')!.getBoundingClientRect();
        return d.left >= 0 && d.right <= window.innerWidth + 1 && d.bottom <= window.innerHeight + 1;
      });
      expect(ok, `dialog fits at ${name}`).toBe(true);
      await win.screenshot({ path: path.join(shots, `11-exported-${name}.png`) });
    }
    expect(gameErrors).toEqual([]);
    await game.close();
  });

  // Reopen the editor once more to confirm nothing was left in a broken state.
  ({ app, page, errors } = await launchEditor());
  await expect(page.getByTestId('recent-item').first()).toContainText('E2E Novel');
  expect(errors).toEqual([]);
  await app.close();
});
