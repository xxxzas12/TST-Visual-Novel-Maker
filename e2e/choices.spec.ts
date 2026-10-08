// Choice buttons: style presets with hover preview, shapes, icon, Image Button pictures per state
// (editor canvas and game) — and "when chosen" actions that change a variable and shake the screen.
import { test, expect, type FrameLocator, type Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
import { pngBuffer } from '../scripts/media.mjs';
import { TMP, launchEditor, queueDialog } from './helpers';

const DIR = path.join(TMP, 'choices');
const SHAPES: Record<string, string> = { classic: 'box', modern: 'box', minimal: 'underline', rpg: 'box', fantasy: 'banner', bubble: 'bubble', image: 'box' };

const shapeOf = (f: FrameLocator) => f.locator('.tvn-root').getAttribute('data-c-shape');
const iconOf = (f: FrameLocator) => f.locator('.tvn-choice-label').first().evaluate((el) => getComputedStyle(el, '::before').content);
const pictureOf = (f: FrameLocator, i: number) => f.getByTestId(`tvn-choice-${i}`).evaluate((el) => getComputedStyle(el, '::before').backgroundImage);

async function away(page: Page) {
  await page.getByTestId('theme-title').hover();
}

test('choice styles, button pictures and "when chosen" actions', async () => {
  await fs.rm(DIR, { recursive: true, force: true });
  const art = path.join(DIR, 'Buttons');
  await fs.mkdir(art, { recursive: true });
  await fs.writeFile(path.join(art, 'btn_normal.png'), pngBuffer(60, 20, () => [40, 120, 200, 255]));
  await fs.writeFile(path.join(art, 'btn_hover.png'), pngBuffer(60, 20, () => [240, 160, 40, 255]));

  const { app, page, errors } = await launchEditor();
  await page.getByTestId('new-project-name').fill('Choices');
  await page.getByTestId('new-project-location').fill(path.join(DIR, 'projects'));
  await page.getByTestId('template-blank').click();
  await page.getByTestId('create-project').click();
  await page.getByTestId('nav-assets').click();
  await queueDialog(app, art);
  await page.getByTestId('import-folder').click();
  await expect(page.getByTestId('import-report')).toBeVisible({ timeout: 60000 });
  await page.getByTestId('import-report-done').click();

  // ---- styles
  await page.getByTestId('nav-themes').click();
  await page.getByTestId('ui-mode-basic').click();
  await page.getByTestId('ui-element-select').selectOption('choices');
  const design = page.frameLocator('[data-testid="ui-design-frame"]');
  await expect(design.getByTestId('tvn-choice-0')).toBeVisible();
  const themesBefore = await page.locator('.theme-card').count();

  // Hover previews without changing the project.
  await page.getByTestId('choice-preset-rpg').hover();
  await expect.poll(() => iconOf(design)).toBe('"▶"');
  await away(page);
  await expect.poll(() => iconOf(design)).toBe('none');
  await expect(page.locator('.theme-card')).toHaveCount(themesBefore);

  // Every preset applies its own look (a preset theme is copied once).
  for (const id of Object.keys(SHAPES)) {
    await page.getByTestId(`choice-preset-${id}`).click();
    await away(page);
    await expect.poll(() => shapeOf(design)).toBe(SHAPES[id]);
    await page.waitForTimeout(120);
    await page.getByTestId('ui-design-frame').screenshot({ path: path.join(TMP, 'shots', `p4-choice-${id}.png`) });
  }
  await expect(page.locator('.theme-card')).toHaveCount(themesBefore + 1);
  await page.getByTestId('choice-presets').screenshot({ path: path.join(TMP, 'shots', 'p4-choice-cards.png') });

  // Image Button: the picture field shows even in Basic; one picture per state.
  await expect(page.getByTestId('choice-preset-image')).toHaveAttribute('aria-selected', 'true');
  await page.getByTestId('choice-state-image').click();
  await page.getByTestId('asset-picker').getByTestId('pick-btn_normal.png').click();
  await expect.poll(() => pictureOf(design, 0)).toContain('btn_normal.png');
  await page.getByTestId('choice-state-hover').click();
  await page.getByTestId('choice-state-image').click();
  await page.getByTestId('asset-picker').getByTestId('pick-btn_hover.png').click();
  await expect.poll(() => pictureOf(design, 1)).toContain('btn_hover.png'); // the sample's second button shows "hover"
  await expect.poll(() => pictureOf(design, 0)).not.toContain('btn_hover.png');

  // Advanced: shape and icon by hand; undo.
  await page.getByTestId('ui-mode-advanced').click();
  await page.getByTestId('choice-shape').selectOption('pill');
  await expect.poll(() => shapeOf(design)).toBe('pill');
  await page.getByTestId('choice-icon-♥').click();
  await expect.poll(() => iconOf(design)).toBe('"♥"');
  await away(page);
  await page.keyboard.press('Control+z');
  await expect.poll(() => iconOf(design)).toBe('none');
  await page.keyboard.press('Control+y');
  await expect.poll(() => iconOf(design)).toBe('"♥"');

  // ---- behaviour: "Take the key" adds 5 to a variable and shakes the screen.
  await page.getByTestId('nav-variables').click();
  await page.getByTestId('add-variable').click();
  await page.getByTestId('nav-scenes').click();
  await page.getByTestId('quick-choice').click();
  await page.getByTestId('choice-text-0').fill('Take the key');
  await page.getByTestId('choice-add-effect-0').selectOption('addVariable');
  await page.getByTestId('choice-effect-0-0').locator('input[type=number]').fill('5');
  await page.getByTestId('choice-add-effect-0').selectOption('screenEffect');
  await expect(page.getByTestId('choice-effects-0')).toContainText('When chosen');
  const choiceRow = page.locator('[data-type="choice"]');
  await page.getByTestId('quick-dialogue').click();
  await page.getByTestId('field-text').fill('Score {Variable1}');
  await expect(page.getByTestId('issue-count')).toContainText('No problems');

  await choiceRow.click();
  await page.getByTestId('play-from-here').click();
  const game = page.frameLocator('[data-testid="preview-frame"]');
  await expect(game.getByTestId('tvn-choice-0')).toHaveText('Take the key');
  // The picture and icon from the theme are used in the game too.
  await expect.poll(() => pictureOf(game, 0)).toContain('btn_normal.png');
  await expect.poll(() => iconOf(game)).toBe('"♥"');
  await page.getByTestId('preview-frame').screenshot({ path: path.join(TMP, 'shots', 'p4-game-choices.png') });
  await game.getByTestId('tvn-choice-0').click();
  await expect(game.getByTestId('tvn-text')).toContainText('Score 5');
  await page.getByTestId('close-preview').click();

  await page.getByTestId('save').click();
  await expect(page.getByTestId('save-status')).toHaveText(/Saved/);
  const saved = JSON.parse(await fs.readFile(path.join(DIR, 'projects', 'Choices', 'project.json'), 'utf8'));
  const choice = saved.scenes[0].actions.find((a: { type: string }) => a.type === 'choice');
  expect(choice.params.options[0].effects).toEqual([
    { kind: 'addVariable', variableId: saved.variables[0].id, amount: 5 },
    { kind: 'screenEffect', effect: 'shake' },
  ]);
  expect(errors).toEqual([]);
  await app.close();
});
