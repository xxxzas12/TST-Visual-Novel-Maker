// Advanced animation controls: hidden in Basic; delay, direction, distance, start rotation and opacity
// reach the animation in the canvas and in the game; stagger time between buttons; back to the preset.
import { test, expect, type FrameLocator, type Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
import { TMP, launchEditor } from './helpers';

const DIR = path.join(TMP, 'animation-advanced');

async function setRange(page: Page, testId: string, value: number) {
  await page.getByTestId(testId).evaluate((el, v) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, String(v));
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

/** The first keyframe and timing of the animations running on elements of a class. */
const animsOn = (f: FrameLocator, cls: string) =>
  f.locator('.tvn-root').evaluate(
    (root, c) =>
      root.ownerDocument
        .getAnimations()
        .filter((a) => ((a.effect as KeyframeEffect).target as HTMLElement).classList.contains(c))
        .map((a) => {
          const e = a.effect as KeyframeEffect;
          const k = e.getKeyframes()[0];
          return { delay: Number(e.getTiming().delay), duration: Number(e.getTiming().duration), transform: String(k.transform ?? ''), opacity: Number(k.opacity ?? 1) };
        }),
    cls,
  );

test('advanced animation: delay, direction, distance, rotation, opacity, stagger time, reset', async () => {
  await fs.rm(DIR, { recursive: true, force: true });
  const { app, page, errors } = await launchEditor();
  await page.getByTestId('new-project-name').fill('Advanced Anim');
  await page.getByTestId('new-project-location').fill(path.join(DIR, 'projects'));
  await page.getByTestId('template-blank').click();
  await page.getByTestId('create-project').click();
  await page.getByTestId('nav-themes').click();
  await page.getByTestId('create-theme').click();
  await page.getByTestId('ui-element-select').selectOption('dialog');
  const design = page.frameLocator('[data-testid="ui-design-frame"]');
  await expect(design.getByTestId('tvn-dialog')).toBeVisible();

  await page.getByTestId('ui-mode-basic').click();
  await page.getByTestId('anim-dialog-in-preset').selectOption('slide-up');
  await expect(page.getByTestId('anim-dialog-in-advanced')).toHaveCount(0); // Basic: no fine controls

  await page.getByTestId('ui-mode-advanced').click();
  await expect(page.getByTestId('anim-dialog-in-advanced')).toBeVisible();
  await page.getByTestId('anim-dialog-in-direction').selectOption('right');
  await expect(page.getByTestId('anim-dialog-in-preset')).toHaveValue('slide-right');
  await setRange(page, 'anim-dialog-in-distance', 200);
  await setRange(page, 'anim-dialog-in-delay', 0.5);
  await setRange(page, 'anim-dialog-in-rotate', 15);
  await setRange(page, 'anim-dialog-in-opacity', 0.5);
  await setRange(page, 'anim-dialog-in-duration', 1);
  await page.getByTestId('anim-dialog-in-preview').click();
  await expect
    .poll(async () => (await animsOn(design, 'tvn-dialog'))[0])
    .toMatchObject({ delay: 500, duration: 1000, opacity: 0.5, transform: expect.stringMatching(/^translateX\(-200(\.\d+)?px\) rotate\(15deg\)$/) });
  await page.locator('.ui-props').screenshot({ path: path.join(TMP, 'shots', 'p6-advanced-anim.png') });

  // Choices: pop in, 0.2 s apart.
  await page.getByTestId('ui-element-select').selectOption('choices');
  await page.getByTestId('anim-choices-in-preset').selectOption('pop');
  await setRange(page, 'anim-choices-stagger-time', 0.2);
  await page.getByTestId('anim-choices-in-preview').click();
  await expect.poll(async () => (await animsOn(design, 'tvn-choice')).map((a) => Math.round(a.delay)).sort((a, b) => a - b)).toEqual([0, 200, 400, 600]);

  // Back to the preset's values.
  await setRange(page, 'anim-choices-in-scale', 1.5);
  await page.getByTestId('anim-choices-in-reset').click();
  await expect(page.getByTestId('anim-choices-in-scale')).toHaveValue('0.6');
  await expect(page.getByTestId('anim-choices-in-reset')).toHaveCount(0);

  // In the game the dialogue box waits 0.5 s, then slides in from the left (turned 15°, half visible).
  await page.getByTestId('play').click();
  const game = page.frameLocator('[data-testid="preview-frame"]');
  await game.getByTestId('tvn-start').click();
  await expect.poll(async () => (await animsOn(game, 'tvn-dialog'))[0]).toMatchObject({ delay: 500, duration: 1000, opacity: 0.5 });
  await page.getByTestId('close-preview').click();

  await page.getByTestId('save').click();
  await expect(page.getByTestId('save-status')).toHaveText(/Saved/);
  const saved = JSON.parse(await fs.readFile(path.join(DIR, 'projects', 'Advanced Anim', 'project.json'), 'utf8'));
  const theme = saved.themes.find((t: { id: string }) => t.id === saved.settings.themeId);
  expect(theme.anim.dialogIn).toMatchObject({ kind: 'slide', direction: 'right', distance: 200, delay: 0.5, rotate: 15, opacity: 0.5, duration: 1 });
  expect(theme.anim.choiceStagger).toBe(0.2);
  expect(errors).toEqual([]);
  await app.close();
});
