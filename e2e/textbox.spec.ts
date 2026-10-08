// Textbox style presets in the Game UI editor: hover previews without changing anything, click applies
// (a preset theme is copied first), every preset renders its own shape, undo, persistence, and the
// speech bubble's tail points at the speaking character in the running game.
import { test, expect, type FrameLocator } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
import { TMP, launchEditor } from './helpers';

const DIR = path.join(TMP, 'textbox');
const PRESETS = ['classic', 'modern', 'bubble', 'minimal', 'fantasy', 'scifi', 'horror', 'rpg', 'retro'];
const FRAMES: Record<string, string> = { classic: 'box', modern: 'box', bubble: 'bubble', minimal: 'band', fantasy: 'ornate', scifi: 'tech', horror: 'torn', rpg: 'window', retro: 'pixel' };

const frameOf = (f: FrameLocator) => f.locator('.tvn-root').getAttribute('data-d-frame');

test('textbox presets: preview, apply, every shape, undo, saved, bubble tail in game', async () => {
  await fs.rm(DIR, { recursive: true, force: true });
  let { app, page, errors } = await launchEditor();
  await page.getByTestId('new-project-name').fill('Textbox');
  await page.getByTestId('new-project-location').fill(path.join(DIR, 'projects'));
  await page.getByTestId('template-romance').click();
  await page.getByTestId('create-project').click();
  await expect(page.getByTestId('project-name')).toHaveText('Textbox');

  await page.getByTestId('nav-themes').click();
  const design = page.frameLocator('[data-testid="ui-design-frame"]');
  await expect(design.getByTestId('tvn-dialog')).toBeVisible();
  await page.getByTestId('ui-element-select').selectOption('dialog');
  await expect(page.getByTestId('textbox-presets')).toBeVisible();
  const themesBefore = await page.locator('.theme-card').count();

  // Hover = preview only: the canvas changes, the project does not.
  await page.getByTestId('textbox-preset-bubble').hover();
  await expect.poll(() => frameOf(design)).toBe('bubble');
  await expect(page.getByTestId('textbox-style')).toContainText('Previewing');
  await expect(page.getByTestId('save-status')).not.toContainText('Unsaved');
  await page.getByTestId('theme-title').hover();
  await expect.poll(() => frameOf(design)).toBe('box');

  // Click on a preset theme: a custom copy is made, used by the project, with the bubble.
  await page.getByTestId('textbox-preset-bubble').click();
  await expect(page.locator('.theme-card')).toHaveCount(themesBefore + 1);
  await expect(page.getByTestId('theme-editor')).toBeVisible();
  await expect(page.getByTestId('textbox-preset-bubble')).toHaveAttribute('aria-selected', 'true');
  await page.getByTestId('theme-title').hover();
  await expect.poll(() => frameOf(design)).toBe('bubble');
  await expect(design.getByTestId('tvn-dialog')).toHaveAttribute('data-tail', 'top');
  await page.getByTestId('ui-mode-advanced').click();
  await expect(page.getByTestId('dialog-frame')).toHaveValue('bubble');

  // Every preset gives its own shape (screenshots for review).
  for (const id of PRESETS) {
    await page.getByTestId(`textbox-preset-${id}`).click();
    await page.getByTestId('theme-title').hover();
    await expect.poll(() => frameOf(design)).toBe(FRAMES[id]);
    await page.waitForTimeout(150);
    await page.getByTestId('ui-design-frame').screenshot({ path: path.join(TMP, 'shots', `p2-textbox-${id}.png`) });
  }
  await expect(page.locator('.theme-card')).toHaveCount(themesBefore + 1); // edits the same custom theme
  await page.getByTestId('textbox-presets').screenshot({ path: path.join(TMP, 'shots', 'p2-textbox-cards.png') });

  // Undo goes back to the previous preset; the shape can also be changed by hand.
  await page.keyboard.press('Control+z');
  await expect.poll(() => frameOf(design)).toBe('window');
  await page.keyboard.press('Control+y');
  await expect.poll(() => frameOf(design)).toBe('pixel');
  await page.getByTestId('textbox-preset-bubble').click();
  await page.getByTestId('ui-element-select').selectOption('name');
  await page.getByTestId('name-shape').selectOption('ribbon');
  await expect(design.locator('.tvn-root')).toHaveAttribute('data-n-shape', 'ribbon');

  await page.getByTestId('save').click();
  await expect(page.getByTestId('save-status')).toHaveText(/Saved/);
  const saved = JSON.parse(await fs.readFile(path.join(DIR, 'projects', 'Textbox', 'project.json'), 'utf8'));
  const used = saved.themes.find((t: { id: string }) => t.id === saved.settings.themeId);
  expect(used.dialog.frame).toBe('bubble');
  expect(used.nameBox.shape).toBe('ribbon');

  // In the game: a character on the left speaks; the bubble's tail points at her.
  await page.getByTestId('nav-characters').click();
  await page.getByTestId('new-character').click();
  await page.getByTestId('prompt-input').fill('Mia');
  await page.getByTestId('prompt-ok').click();
  await page.getByTestId('nav-scenes').click();
  await page.getByTestId('quick-character').click();
  await page.getByTestId('align-left').click();
  await page.getByTestId('quick-dialogue').click();
  await page.getByTestId('field-text').fill('The tail points at me!');
  await page.getByTestId('play-from-here').click();
  const game = page.frameLocator('[data-testid="preview-frame"]');
  await expect(game.getByTestId('tvn-text')).toContainText('The tail points at me!');
  await page.waitForTimeout(600); // the character's entrance animation
  const ok = await game.locator('.tvn-root').evaluate((root) => {
    const dlg = root.querySelector<HTMLElement>('.tvn-dialog')!;
    const char = root.querySelector<HTMLElement>('.tvn-char')!;
    const d = dlg.getBoundingClientRect();
    const r = char.getBoundingClientRect();
    const tail = d.left + parseFloat(dlg.style.getPropertyValue('--tvn-tail-x'));
    return dlg.dataset.tail === 'top' && r.left + r.width / 2 < d.left + d.width / 2 && Math.abs(r.left + r.width / 2 - tail) < 30;
  });
  expect(ok).toBe(true);
  await page.getByTestId('preview-frame').screenshot({ path: path.join(TMP, 'shots', 'p2-bubble-game.png') });
  await page.getByTestId('close-preview').click();
  expect(errors).toEqual([]);
  await app.close();

  // Reopen: still there.
  ({ app, page, errors } = await launchEditor());
  await page.getByTestId('recent-item').filter({ hasText: 'Textbox' }).first().click();
  await page.getByTestId('nav-themes').click();
  await expect.poll(() => frameOf(page.frameLocator('[data-testid="ui-design-frame"]'))).toBe('bubble');
  expect(errors).toEqual([]);
  await app.close();
});
