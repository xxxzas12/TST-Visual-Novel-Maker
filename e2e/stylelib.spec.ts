// Style Library: save a textbox style, reuse it in another theme, edit it once and see every theme follow,
// "edit only here", rename / duplicate / delete in the library, the game uses it, and it is saved.
import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
import { TMP, launchEditor } from './helpers';

const DIR = path.join(TMP, 'stylelib');
const frameOf = (page: Page) => page.frameLocator('[data-testid="ui-design-frame"]').locator('.tvn-root').getAttribute('data-d-frame');

test('style library: save, reuse, edit once everywhere, edit only here, manage, game', async () => {
  await fs.rm(DIR, { recursive: true, force: true });
  let { app, page, errors } = await launchEditor();
  await page.getByTestId('new-project-name').fill('Library');
  await page.getByTestId('new-project-location').fill(path.join(DIR, 'projects'));
  await page.getByTestId('template-blank').click();
  await page.getByTestId('create-project').click();

  // Theme A: Fantasy textbox, saved as a style.
  await page.getByTestId('nav-themes').click();
  await page.getByTestId('create-theme').click();
  await expect(page.getByTestId('theme-title')).toHaveText('Modern (custom)');
  await page.getByTestId('ui-element-select').selectOption('dialog');
  await page.getByTestId('textbox-preset-fantasy').click();
  await page.getByTestId('style-save-textbox').click();
  await page.getByTestId('prompt-input').fill('Fantasy Dialogue');
  await page.getByTestId('prompt-ok').click();
  await expect(page.getByTestId('style-linked-textbox')).toContainText('Fantasy Dialogue');

  // Theme B (from the Classic preset) uses the same style.
  await page.getByTestId('theme-Classic').click();
  await page.getByTestId('ui-element-select').selectOption('dialog');
  await page.getByTestId('my-style-Fantasy Dialogue').click();
  await expect(page.getByTestId('theme-title')).toHaveText('Classic (custom)');
  await expect.poll(() => frameOf(page)).toBe('ornate');
  await expect(page.getByTestId('style-linked-textbox')).toContainText('(2)');

  // Editing the style through B updates A as well.
  await page.getByTestId('ui-mode-advanced').click();
  await page.getByTestId('dialog-frame').selectOption('pixel');
  await page.getByTestId('theme-Modern (custom)').click();
  await expect.poll(() => frameOf(page)).toBe('pixel');
  await page.locator('.ui-props').screenshot({ path: path.join(TMP, 'shots', 'p7-linked.png') });

  // "Edit only here" on A: A changes alone.
  await page.getByTestId('style-detach-textbox').click();
  await expect(page.getByTestId('style-linked-textbox')).toHaveCount(0);
  await expect.poll(() => frameOf(page)).toBe('pixel'); // same look, now its own
  await page.getByTestId('dialog-frame').selectOption('bubble');
  await page.getByTestId('theme-Classic (custom)').click();
  await expect.poll(() => frameOf(page)).toBe('pixel');
  // Undo brings the link back on A.
  await page.getByTestId('theme-Modern (custom)').click();
  await page.getByTestId('theme-title').click();
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  await expect(page.getByTestId('style-linked-textbox')).toBeVisible();

  // Choices can be saved as a style too.
  await page.getByTestId('ui-element-select').selectOption('choices');
  await page.getByTestId('choice-preset-rpg').click();
  await page.getByTestId('style-save-choice').click();
  await page.getByTestId('prompt-input').fill('RPG Menu');
  await page.getByTestId('prompt-ok').click();
  await expect(page.getByTestId('style-linked-choice')).toContainText('RPG Menu');

  // Library window: rename, duplicate, delete (themes keep their look).
  await page.getByTestId('open-style-library').click();
  const lib = page.getByTestId('style-library');
  await expect(lib.getByTestId('library-style-Fantasy Dialogue')).toContainText('Used by 2 theme(s)');
  await lib.getByTestId('library-style-Fantasy Dialogue').getByTestId('library-rename').click();
  await page.getByTestId('prompt-input').fill('Fantasy UI');
  await page.getByTestId('prompt-ok').click();
  await lib.getByTestId('library-style-Fantasy UI').getByTestId('library-duplicate').click();
  await expect(lib.getByTestId('library-style-Fantasy UI copy')).toContainText('Used by 0 theme(s)');
  await page.screenshot({ path: path.join(TMP, 'shots', 'p7-library.png') });
  await lib.getByTestId('library-style-Fantasy UI copy').getByTestId('library-delete').click();
  await page.getByTestId('confirm-ok').click();
  await expect(lib.getByTestId('library-style-Fantasy UI copy')).toHaveCount(0);
  await page.getByRole('button', { name: 'Done' }).click();

  // The game uses the style.
  await page.getByTestId('play').click();
  const game = page.frameLocator('[data-testid="preview-frame"]');
  await game.getByTestId('tvn-start').click();
  await expect(game.locator('.tvn-root')).toHaveAttribute('data-d-frame', 'pixel');
  await page.getByTestId('close-preview').click();

  await page.getByTestId('save').click();
  await expect(page.getByTestId('save-status')).toHaveText(/Saved/);
  const saved = JSON.parse(await fs.readFile(path.join(DIR, 'projects', 'Library', 'project.json'), 'utf8'));
  expect(saved.uiStyles.map((s: { name: string; kind: string }) => `${s.kind}:${s.name}`)).toEqual(['textbox:Fantasy UI', 'choice:RPG Menu']);
  expect(saved.themes.filter((t: { textboxStyleId: string }) => t.textboxStyleId === saved.uiStyles[0].id)).toHaveLength(2);
  expect(errors).toEqual([]);
  await app.close();

  // Reopen: still linked.
  ({ app, page, errors } = await launchEditor());
  await page.getByTestId('recent-item').filter({ hasText: 'Library' }).first().click();
  await page.getByTestId('nav-themes').click();
  await page.getByTestId('ui-element-select').selectOption('dialog');
  await expect(page.getByTestId('style-linked-textbox')).toContainText('Fantasy UI');
  expect(errors).toEqual([]);
  await app.close();
});
