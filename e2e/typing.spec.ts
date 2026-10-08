// Text inputs behave like normal text fields: continuous typing, arrow keys, editing in the middle,
// Backspace, select + delete, paste and Thai input (IME commit) — with real keystrokes, not fill().
// Regression test for "only one character can be typed, then the field must be clicked again".
import { test, expect, type Locator, type Page, type ElectronApplication } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
import { TMP, launchEditor } from './helpers';

async function editLikeAUser(app: ElectronApplication, page: Page, field: Locator) {
  await field.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('Hello World', { delay: 25 });
  await expect(field).toBeFocused();
  await expect(field).toHaveValue('Hello World');
  // Move left past "World" and insert in the middle.
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowLeft');
  await page.keyboard.type('Big ', { delay: 25 });
  await expect(field).toHaveValue('Hello Big World');
  // Backspace removes the character before the caret.
  await page.keyboard.press('Backspace');
  await page.keyboard.type(' ');
  await expect(field).toHaveValue('Hello Big World');
  // Select the last word with Shift+Ctrl+Left and replace it.
  await page.keyboard.press('End');
  await page.keyboard.press('Control+Shift+ArrowLeft');
  await page.keyboard.type('Story', { delay: 25 });
  await expect(field).toHaveValue('Hello Big Story');
  // Paste from the clipboard.
  await app.evaluate(({ clipboard }) => clipboard.writeText(' — pasted'));
  await page.keyboard.press('Control+V');
  await expect(field).toHaveValue('Hello Big Story — pasted');
  // Thai text as an input method commits it (one insertText per composed word).
  await page.keyboard.insertText(' สวัสดี');
  await page.keyboard.type('ครับ', { delay: 25 });
  await expect(field).toHaveValue('Hello Big Story — pasted สวัสดีครับ');
  await expect(field).toBeFocused();
}

test('text inputs accept continuous typing, editing, paste and Thai', async () => {
  await fs.mkdir(path.join(TMP, 'userdata'), { recursive: true });
  const { app, page, errors } = await launchEditor();

  await editLikeAUser(app, page, page.getByTestId('new-project-name'));
  await page.getByTestId('new-project-name').fill('Typing Test');
  await page.getByTestId('new-project-location').fill(path.join(TMP, 'typing-projects'));
  await fs.rm(path.join(TMP, 'typing-projects'), { recursive: true, force: true });
  await page.getByTestId('create-project').click();
  await expect(page.getByTestId('project-name')).toHaveText('Typing Test');

  // Project Settings (the page with the live game-font preview where focus used to be stolen).
  await page.getByTestId('nav-settings').click();
  await expect(page.getByTestId('font-game-preview')).toBeVisible();
  for (const id of ['settings-project-name', 'settings-title', 'settings-author']) await editLikeAUser(app, page, page.getByTestId(id));
  await expect(page.getByTestId('project-name')).toHaveText('Hello Big Story — pasted สวัสดีครับ');

  // Scene editor text area.
  await page.getByTestId('nav-scenes').click();
  await page.getByTestId('quick-dialogue').click();
  await editLikeAUser(app, page, page.getByTestId('field-text'));

  // A text field next to a live game preview (Themes: theme name).
  await page.getByTestId('nav-themes').click();
  await page.getByTestId('edit-copy').click();
  await page.getByTestId('ui-element-select').selectOption('');
  await editLikeAUser(app, page, page.getByTestId('theme-name'));

  await page.getByTestId('save').click();
  await expect(page.getByTestId('save-status')).toContainText('Saved');
  const saved = JSON.parse(await fs.readFile(path.join(TMP, 'typing-projects', 'Typing Test', 'project.json'), 'utf8'));
  expect(saved.settings.title).toBe('Hello Big Story — pasted สวัสดีครับ');
  expect(saved.settings.author).toBe('Hello Big Story — pasted สวัสดีครับ');
  expect(errors).toEqual([]);
  await app.close();
});
