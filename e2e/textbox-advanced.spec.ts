// Basic / Advanced settings in the Game UI editor and the advanced textbox look: gradient, glow, texture,
// own frame image (9-slice), text outline — seen live in the editor and in the running game; reset, undo,
// and the Basic/Advanced choice being remembered.
import { test, expect, type Page, type FrameLocator } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
import { pngBuffer } from '../scripts/media.mjs';
import { TMP, launchEditor, queueDialog } from './helpers';

const DIR = path.join(TMP, 'textbox-advanced');
const USER_DATA = path.join(DIR, 'userdata');

async function setRange(page: Page, testId: string, value: number) {
  await page.getByTestId(testId).evaluate((el, v) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    setter.call(el, String(v));
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

/** Computed style of the dialogue box (or its ::before layer) inside the design canvas. */
const dialogStyle = (f: FrameLocator, prop: string, pseudo: string | null = null) =>
  f.getByTestId('tvn-dialog').evaluate((el, [p, ps]) => getComputedStyle(el, ps).getPropertyValue(p as string), [prop, pseudo] as const);

test('advanced textbox: basic/advanced, gradient, glow, texture, frame image, outline, reset, game', async () => {
  await fs.rm(DIR, { recursive: true, force: true });
  const art = path.join(DIR, 'Art');
  await fs.mkdir(art, { recursive: true });
  // A 4×4 checker texture and a 48×48 frame picture (gold border, dark centre).
  await fs.writeFile(path.join(art, 'paper.png'), pngBuffer(4, 4, (x, y) => ((x + y) % 2 ? [255, 255, 255, 60] : [0, 0, 0, 60])));
  await fs.writeFile(
    path.join(art, 'my_dialogue_frame.png'),
    pngBuffer(48, 48, (x, y) => (x < 8 || y < 8 || x > 39 || y > 39 ? [212, 175, 55, 255] : [20, 10, 40, 230])),
  );
  await fs.mkdir(USER_DATA, { recursive: true });
  await fs.writeFile(path.join(USER_DATA, 'settings.json'), JSON.stringify({ onboardingDone: true, language: 'en' }));

  let { app, page, errors } = await launchEditor({ userData: USER_DATA });
  await page.getByTestId('new-project-name').fill('Advanced Box');
  await page.getByTestId('new-project-location').fill(path.join(DIR, 'projects'));
  await page.getByTestId('create-project').click();
  await page.getByTestId('nav-assets').click();
  await queueDialog(app, art);
  await page.getByTestId('import-folder').click();
  await expect(page.getByTestId('import-report')).toBeVisible({ timeout: 60000 });
  await page.getByTestId('import-report-done').click();

  await page.getByTestId('nav-themes').click();
  await page.getByTestId('create-theme').click();
  await page.getByTestId('ui-element-select').selectOption('dialog');
  const design = page.frameLocator('[data-testid="ui-design-frame"]');
  await expect(design.getByTestId('tvn-dialog')).toBeVisible();

  // Basic (default for a new user): only the essentials.
  await expect(page.getByTestId('ui-mode-basic')).toHaveAttribute('aria-checked', 'true');
  for (const id of ['dialog-width', 'dialog-bg', 'dialog-opacity', 'dialog-text-font', 'dialog-text-size', 'dialog-text-color']) await expect(page.getByTestId(id)).toBeVisible();
  for (const id of ['dialog-x', 'dialog-border', 'dialog-radius', 'dialog-glow', 'dialog-gradient', 'dialog-texture', 'dialog-frame-image', 'dialog-text-outline', 'dialog-frame'])
    await expect(page.getByTestId(id)).toHaveCount(0);
  await page.locator('.ui-props').screenshot({ path: path.join(TMP, 'shots', 'p3-basic.png') });

  // Advanced: everything.
  await page.getByTestId('ui-mode-advanced').click();
  await expect(page.getByTestId('dialog-border')).toBeVisible();

  // Gradient
  await page.getByTestId('dialog-gradient').check();
  await expect.poll(() => dialogStyle(design, 'background-image')).toContain('linear-gradient');
  // Glow (default glow colour #8090ff)
  await setRange(page, 'dialog-glow', 30);
  await expect.poll(() => dialogStyle(design, 'box-shadow')).toContain('rgba(128, 144, 255');
  // Text outline
  await setRange(page, 'dialog-text-outline', 3);
  await expect.poll(() => design.getByTestId('tvn-text').evaluate((el) => getComputedStyle(el).getPropertyValue('-webkit-text-stroke-width'))).toBe('3px');
  // Undo the outline, redo it.
  await page.getByTestId('theme-title').click();
  await page.keyboard.press('Control+z');
  await expect.poll(() => design.getByTestId('tvn-text').evaluate((el) => getComputedStyle(el).getPropertyValue('-webkit-text-stroke-width'))).toBe('0px');
  await page.keyboard.press('Control+y');
  await expect.poll(() => design.getByTestId('tvn-text').evaluate((el) => getComputedStyle(el).getPropertyValue('-webkit-text-stroke-width'))).toBe('3px');
  // Texture (tiled image layer)
  await page.getByTestId('dialog-texture').click();
  await page.getByTestId('asset-picker').getByTestId('pick-paper.png').click();
  await expect.poll(() => dialogStyle(design, 'background-image', '::before')).toContain('paper.png');
  // Own frame image (9-slice)
  await page.getByTestId('dialog-frame-image').click();
  await page.getByTestId('asset-picker').getByTestId('pick-my_dialogue_frame.png').click();
  await expect.poll(() => dialogStyle(design, 'border-image-source')).toContain('my_dialogue_frame.png');
  await setRange(page, 'dialog-frame-width', 40);
  await expect.poll(() => dialogStyle(design, 'border-image-width')).toBe('40px');
  await page.getByTestId('ui-design-frame').screenshot({ path: path.join(TMP, 'shots', 'p3-advanced-canvas.png') });
  await page.locator('.ui-props').screenshot({ path: path.join(TMP, 'shots', 'p3-advanced-panel.png') });

  // Help marks explain unfamiliar settings.
  await expect(page.locator('.field-tip').first()).toHaveAttribute('title', /.+/);

  // In the running game.
  await page.getByTestId('play').click();
  const game = page.frameLocator('[data-testid="preview-frame"]');
  await game.getByTestId('tvn-start').click();
  await expect(game.getByTestId('tvn-dialog')).toBeVisible();
  await expect.poll(() => game.getByTestId('tvn-dialog').evaluate((el) => getComputedStyle(el).getPropertyValue('border-image-source'))).toContain('my_dialogue_frame.png');
  // Scaled with the game window like every other size (3 design px on a smaller window).
  await expect.poll(async () => parseFloat(await game.getByTestId('tvn-text').evaluate((el) => getComputedStyle(el).getPropertyValue('-webkit-text-stroke-width')))).toBeGreaterThan(1);
  await page.getByTestId('preview-frame').screenshot({ path: path.join(TMP, 'shots', 'p3-game.png') });
  await page.getByTestId('close-preview').click();

  // Reset to the textbox preset undoes hand changes to the dialogue box.
  await page.getByTestId('textbox-preset-rpg').click();
  await expect.poll(() => dialogStyle(design, 'border-image-source')).toBe('none');
  await setRange(page, 'dialog-radius', 60);
  await expect.poll(() => dialogStyle(design, 'border-top-left-radius')).toBe('60px');
  await page.getByTestId('textbox-reset').click();
  await expect.poll(() => dialogStyle(design, 'border-top-left-radius')).toBe('12px');

  await page.getByTestId('save').click();
  expect(errors).toEqual([]);
  await app.close();

  // Advanced stays chosen after a restart.
  ({ app, page, errors } = await launchEditor({ userData: USER_DATA }));
  await page.getByTestId('recent-item').filter({ hasText: 'Advanced Box' }).first().click();
  await page.getByTestId('nav-themes').click();
  await expect(page.getByTestId('ui-mode-advanced')).toHaveAttribute('aria-checked', 'true');
  expect(errors).toEqual([]);
  await app.close();
});
