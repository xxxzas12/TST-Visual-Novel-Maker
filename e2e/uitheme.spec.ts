// Game UI / Theme editor end-to-end: visual editing (select, drag, resize, align, duplicate,
// delete), numeric sizes, choice states, menu buttons, devices, .tsttheme export/import,
// scene overrides, save/reopen, and the same theme in the preview and an exported game.
import { test, expect, type Page, type FrameLocator } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { makeSampleAssets } from '../scripts/media.mjs';
import { TMP, launchEditor, queueDialog } from './helpers';

const DIR = path.join(TMP, 'uitheme');

async function createProject(page: Page, name: string, template = 'blank') {
  await expect(page.getByTestId('welcome')).toBeVisible();
  await page.getByTestId('new-project-name').fill(name);
  await page.getByTestId('new-project-location').fill(path.join(DIR, 'projects'));
  await page.getByTestId(`template-${template}`).click();
  await page.getByTestId('create-project').click();
  await expect(page.getByTestId('project-name')).toHaveText(name);
}

/** Drag with the real mouse from the centre of an element (or a point) by dx/dy screen pixels. */
async function mouseDrag(page: Page, testId: string, dx: number, dy: number) {
  const box = (await page.getByTestId(testId).boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(x + (dx * i) / 6, y + (dy * i) / 6);
  await page.mouse.up();
}

async function setRange(page: Page, testId: string, value: number) {
  await page.getByTestId(testId).evaluate((el, v) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    setter.call(el, String(v));
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

const rectOf = (frame: FrameLocator, testId: string) => frame.getByTestId(testId).evaluate((el) => el.getBoundingClientRect().toJSON() as DOMRect);

async function advanceUntil(frame: FrameLocator, predicate: () => Promise<boolean>, max = 30) {
  for (let i = 0; i < max; i++) {
    if (await predicate()) return;
    await frame.getByTestId('tvn-root').click({ position: { x: 200, y: 120 } });
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('condition not reached while advancing the game');
}

test.beforeAll(async () => {
  await fs.rm(DIR, { recursive: true, force: true });
  await fs.mkdir(path.join(TMP, 'userdata'), { recursive: true });
  await fs.writeFile(path.join(TMP, 'userdata', 'settings.json'), JSON.stringify({ onboardingDone: true, autosaveMinutes: 2, language: 'en' }));
  await makeSampleAssets(path.join(DIR, 'Assets'));
});

test('game UI editor: design, responsive check, export/import, scene override, persistence, runtime', async () => {
  let { app, page, errors } = await launchEditor();
  await createProject(page, 'UI Test', 'romance');
  await page.getByTestId('nav-assets').click();
  await queueDialog(app, path.join(DIR, 'Assets'));
  await page.getByTestId('import-folder').click();
  await expect(page.getByTestId('import-report')).toBeVisible({ timeout: 120000 });
  await page.getByTestId('import-report-done').click();

  // ---- presets: 8 requested looks are there; editing a preset makes a copy
  await page.getByTestId('nav-themes').click();
  for (const name of ['Modern', 'Minimal', 'Classic', 'Dark', 'Soft', 'RPG', 'Romance', 'Horror']) await expect(page.getByTestId(`theme-${name}`)).toBeVisible();
  await page.getByTestId('theme-Horror').click();
  await expect(page.getByTestId('theme-props-readonly')).toBeVisible();
  await page.getByTestId('edit-copy').click();
  await expect(page.getByTestId('theme-editor')).toBeVisible();
  await expect(page.getByTestId('theme-title')).toHaveText('Horror (custom)');
  await page.getByTestId('use-theme').click();
  await page.getByTestId('ui-mode-advanced').click(); // every setting (Basic shows only the essentials)

  const design = page.frameLocator('[data-testid="ui-design-frame"]');
  await expect(design.getByTestId('tvn-dialog')).toBeVisible();
  await expect(design.getByTestId('tvn-choice-3')).toBeDisabled(); // every choice state is shown

  // ---- dialogue box: numeric size (design px on the 1920×1080 canvas → desktop preview is 1:1)
  await page.getByTestId('ui-el-dialog').click();
  await page.getByTestId('dialog-width').fill('1600');
  await page.getByTestId('dialog-height').fill('280');
  await expect.poll(async () => Math.round((await rectOf(design, 'tvn-dialog')).width)).toBe(1600);
  await expect.poll(async () => Math.round((await rectOf(design, 'tvn-dialog')).height)).toBeGreaterThanOrEqual(280);
  // % unit
  await page.getByTestId('dialog-width-unit').selectOption('%');
  await page.getByTestId('dialog-width').fill('50');
  await expect.poll(async () => Math.round((await rectOf(design, 'tvn-dialog')).width)).toBe(960);
  await page.getByTestId('dialog-width-unit').selectOption('px');
  await page.getByTestId('dialog-width').fill('1600');
  // Wait until the selection box on the canvas shows the new size: under load it is re-measured a moment
  // later, and a drag started on the old box landed on the choice buttons instead.
  await expect
    .poll(async () => {
      const box = (await page.getByTestId('ui-el-dialog').boundingBox())!;
      const frame = (await page.getByTestId('ui-design-frame').boundingBox())!;
      return Math.round((box.width / frame.width) * 1920);
    })
    .toBe(1600);

  // drag to move, handle to resize, align
  const before = await rectOf(design, 'tvn-dialog');
  await mouseDrag(page, 'ui-el-dialog', -60, -30);
  await expect(page.getByTestId('dialog-x')).not.toHaveValue('0');
  await expect.poll(async () => (await rectOf(design, 'tvn-dialog')).left).toBeLessThan(before.left - 20);
  await mouseDrag(page, 'ui-handle-e', 40, 0);
  await expect.poll(async () => Number(await page.getByTestId('dialog-width').inputValue())).toBeGreaterThan(1600);
  await page.getByTestId('align-left').click();
  await expect(page.getByTestId('dialog-anchor-bottom-left')).toHaveAttribute('aria-checked', 'true');
  await expect.poll(async () => Math.round((await rectOf(design, 'tvn-dialog')).left)).toBe(0);
  await page.getByTestId('align-hcenter').click();
  await page.getByTestId('dialog-width').fill('1600');
  // undo works for visual edits
  await page.getByTestId('dialog-padding-x').fill('60');
  await page.getByTestId('undo').click();
  await expect(page.getByTestId('dialog-padding-x')).not.toHaveValue('60');

  // ---- name box
  await page.getByTestId('ui-element-select').selectOption('name');
  await page.getByTestId('name-attach').selectOption('outside');
  await page.getByTestId('name-bg').locator('input.input').fill('#2255aa');
  await setRange(page, 'name-opacity', 1); // Horror's name box is see-through
  await expect(design.getByTestId('tvn-name')).toHaveCSS('background-color', 'rgb(34, 85, 170)');
  const nameR = await rectOf(design, 'tvn-name');
  const dlgR = await rectOf(design, 'tvn-dialog');
  expect(nameR.bottom).toBeLessThanOrEqual(dlgR.top + 2); // sits on the box's top edge

  // ---- choice buttons: states + hover animation
  await page.getByTestId('ui-element-select').selectOption('choices');
  await page.getByTestId('choice-state-hover').click();
  await page.getByTestId('choice-state-bg').locator('input.input').fill('#00aa44');
  await expect(design.getByTestId('tvn-choice-1')).toHaveCSS('background-color', 'rgb(0, 170, 68)');
  await page.getByTestId('choice-hover-anim').selectOption('glow');
  await page.getByTestId('choice-width').fill('900');
  await expect.poll(async () => Math.round((await rectOf(design, 'tvn-choice-0')).width)).toBeGreaterThan(800);
  // choices never overlap the dialogue box
  const c3 = await rectOf(design, 'tvn-choice-3');
  expect(c3.bottom).toBeLessThanOrEqual((await rectOf(design, 'tvn-name')).top + 1);

  // ---- menu buttons: select, duplicate, delete, add
  await page.getByTestId('ui-el-button:mb-save').click();
  await expect(page.getByTestId('props-menu-button')).toBeVisible();
  await expect(page.getByTestId('props-menubar')).toBeVisible();
  await expect(page.getByTestId('ui-delete')).toBeEnabled();
  await page.getByTestId('ui-duplicate').click();
  await expect(design.locator('[data-testid="tvn-q-save"]')).toHaveCount(2);
  await page.getByTestId('ui-delete').click();
  await expect(design.locator('[data-testid="tvn-q-save"]')).toHaveCount(1);
  await page.getByTestId('new-button-action').selectOption('skip');
  await page.getByTestId('add-menu-button').click();
  await expect(design.getByTestId('tvn-q-skip')).toBeVisible();
  await page.getByTestId('ui-element-select').selectOption('dialog');
  await expect(page.getByTestId('ui-delete')).toBeDisabled(); // core elements can only be hidden

  // ---- responsive: phone portrait with a notch
  await page.getByTestId('device-phone-portrait').click();
  await expect(page.locator('.ui-device')).toHaveAttribute('data-device', 'phone-portrait');
  await expect.poll(async () => (await rectOf(design, 'tvn-dialog')).width).toBeLessThan(400);
  const vp = await design.locator('body').evaluate(() => ({ w: innerWidth, h: innerHeight }));
  expect(vp).toEqual({ w: 390, h: 844 });
  for (const id of ['tvn-dialog', 'tvn-name', 'tvn-choice-0', 'tvn-menubar']) {
    const r = await rectOf(design, id);
    expect(r.left, id).toBeGreaterThanOrEqual(0);
    expect(r.right, id).toBeLessThanOrEqual(390 + 0.5);
    expect(r.top, id).toBeGreaterThanOrEqual(0);
    expect(r.bottom, id).toBeLessThanOrEqual(844 + 0.5);
  }
  expect((await rectOf(design, 'tvn-menubar')).top).toBeGreaterThanOrEqual(47); // below the simulated notch
  const pSize = await design.getByTestId('tvn-text').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(pSize).toBeGreaterThanOrEqual(14); // readable minimum
  const btnH = (await rectOf(design, 'tvn-choice-0')).height;
  expect(btnH).toBeGreaterThanOrEqual(44); // touch target
  expect((await rectOf(design, 'tvn-choice-3')).bottom).toBeLessThanOrEqual((await rectOf(design, 'tvn-name')).top + 1);
  await expect(page.getByTestId('layout-check')).toBeVisible();
  await page.screenshot({ path: path.join(TMP, 'screenshots', 'ui-editor-phone.png') });
  await page.getByTestId('device-desktop').click();
  await page.screenshot({ path: path.join(TMP, 'screenshots', 'ui-editor-desktop.png') });

  // ---- try it (interactive) uses the same theme
  await page.getByTestId('ui-mode-play').click();
  const play = page.frameLocator('[data-testid="theme-preview"]');
  await expect(play.getByTestId('tvn-name')).toHaveCSS('background-color', 'rgb(34, 85, 170)');
  await page.getByTestId('ui-mode-design').click();

  // ---- export .tsttheme, import it back
  const themeFile = path.join(DIR, 'My Horror.tsttheme');
  await queueDialog(app, themeFile);
  await page.getByTestId('export-theme').click();
  await expect.poll(() => existsSync(themeFile)).toBe(true);
  await queueDialog(app, [themeFile]);
  await page.getByTestId('import-theme').click();
  await expect(page.locator('[data-testid="theme-Horror (custom)"]')).toHaveCount(2);

  // ---- scene override: the 2nd scene uses the Dark preset
  await page.getByTestId('theme-Dark').click();
  await page.getByTestId('theme-scenes').click();
  await page.getByTestId('scene-theme-The Date').check();
  await page.getByTestId('scene-themes').getByRole('button', { name: 'Done' }).click();
  await expect(page.getByTestId('theme-Dark')).toContainText('1 scene(s)');

  await page.getByTestId('save').click();
  await expect(page.getByTestId('save-status')).toContainText('Saved');
  expect(errors).toEqual([]);
  await app.close();

  // ---- reopen: everything is restored from the project
  ({ app, page, errors } = await launchEditor());
  await page.getByTestId('recent-item').filter({ hasText: 'UI Test' }).first().click();
  await page.getByTestId('nav-themes').click();
  await expect(page.getByTestId('theme-Horror (custom)').first()).toContainText('in use');
  await page.getByTestId('theme-Horror (custom)').first().click();
  await page.getByTestId('ui-el-dialog').click();
  await expect(page.getByTestId('dialog-width')).toHaveValue('1600');
  await expect(page.getByTestId('theme-Dark')).toContainText('1 scene(s)');

  // ---- preview: scene 1 uses the project theme, scene 2 its override
  await page.getByTestId('nav-scenes').click();
  await page.getByTestId('play').click();
  const frame = page.frameLocator('[data-testid="preview-frame"]');
  await frame.getByTestId('tvn-start').click();
  // Scene 1 (project theme = the edited Horror copy) …
  await expect(frame.getByTestId('tvn-dialog')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0.88)');
  // … then the story jumps into "The Date", which overrides it with Dark.
  const dialogBg = () => frame.getByTestId('tvn-dialog').evaluate((el) => getComputedStyle(el).backgroundColor);
  await advanceUntil(frame, async () => (await dialogBg()) === 'rgba(5, 5, 7, 0.9)');
  await expect(frame.getByTestId('tvn-text')).toContainText('You came!');
  await page.getByTestId('close-preview').click();
  await page.getByTestId('scene-The Date').click();
  await expect(page.getByTestId('scene-theme')).toHaveValue('dark');
  await page.locator('[data-type="dialogue"]').first().click();
  await page.getByTestId('play-from-here').click();
  await expect(frame.getByTestId('tvn-dialog')).toHaveCSS('background-color', 'rgba(5, 5, 7, 0.9)'); // Dark preset
  await page.getByTestId('close-preview').click();
  expect(errors).toEqual([]);
  await app.close();
});

test('exported game: theme, scene theme, phone layout, accessibility settings', async () => {
  const { app, page, errors } = await launchEditor();
  await page.getByTestId('recent-item').filter({ hasText: 'UI Test' }).first().click();
  await page.getByTestId('nav-export').click();
  await page.getByTestId('export-outdir').fill(path.join(DIR, 'exports'));
  await page.getByTestId('platform-web').click();
  await page.getByTestId('export-build').click();
  await expect(page.getByTestId('export-success')).toBeVisible({ timeout: 60000 });
  const web = path.join(DIR, 'exports', 'UI Test-Web');
  const game = await fs.readFile(path.join(web, 'game.js'), 'utf8');
  expect(game).toContain('"themes":{"dark"');

  const [win] = await Promise.all([
    app.waitForEvent('window'),
    app.evaluate(({ BrowserWindow }, file) => void new BrowserWindow({ width: 390, height: 844, useContentSize: true }).loadFile(file), path.join(web, 'index.html')),
  ]);
  await win.getByTestId('tvn-start').click();
  await expect(win.getByTestId('tvn-text')).toContainText('Spring');
  await expect(win.getByTestId('tvn-dialog')).toBeVisible();
  await expect(win.getByTestId('tvn-dialog')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0.88)'); // project theme
  const vw = await win.evaluate(() => innerWidth);
  const d = await win.getByTestId('tvn-dialog').evaluate((el) => el.getBoundingClientRect().toJSON() as DOMRect);
  expect(d.left).toBeGreaterThanOrEqual(0);
  expect(d.right).toBeLessThanOrEqual(vw + 0.5);
  expect(await win.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const fs1 = await win.getByTestId('tvn-text').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(fs1).toBeGreaterThanOrEqual(14);

  // Accessibility settings: text size and high contrast.
  await win.getByTestId('tvn-q-menu').click();
  await win.getByTestId('tvn-menu-settings').click();
  await win.getByLabel('Text size').evaluate((el) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, '1.5');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await win.getByTestId('tvn-contrast').check();
  await win.getByTestId('tvn-menu-close').click();
  const fs2 = await win.getByTestId('tvn-text').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(fs2).toBeCloseTo(fs1 * 1.5, 0);
  await expect(win.getByTestId('tvn-dialog')).toBeVisible();
  await expect(win.getByTestId('tvn-dialog')).toHaveCSS('background-color', 'rgb(0, 0, 0)');
  await win.screenshot({ path: path.join(TMP, 'screenshots', 'ui-export-phone.png') });
  await win.close();
  expect(errors).toEqual([]);
  await app.close();
});
