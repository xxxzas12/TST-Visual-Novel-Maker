// Animation presets in the Game UI editor: a preset fills in duration and easing, ▶ Preview plays it in
// the canvas, choices can appear one after another, text can appear word by word in the game; saved
// together with the older setting for older versions.
import { test, expect, type FrameLocator } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
import { TMP, launchEditor } from './helpers';

const DIR = path.join(TMP, 'animation');

/** Running animations in a canvas: target class and delay. */
const runningAnims = (f: FrameLocator) =>
  f.locator('.tvn-root').evaluate((root) =>
    root.ownerDocument.getAnimations().map((a) => {
      const t = (a.effect as KeyframeEffect).target as HTMLElement;
      return { cls: t.className, delay: Number((a.effect as KeyframeEffect).getTiming().delay) };
    }),
  );

test('animation presets: preview, stagger, word by word, saved', async () => {
  await fs.rm(DIR, { recursive: true, force: true });
  const { app, page, errors } = await launchEditor();
  await page.getByTestId('new-project-name').fill('Animated');
  await page.getByTestId('new-project-location').fill(path.join(DIR, 'projects'));
  await page.getByTestId('template-blank').click();
  await page.getByTestId('create-project').click();

  await page.getByTestId('nav-themes').click();
  await page.getByTestId('create-theme').click();
  await page.getByTestId('ui-mode-basic').click();
  await page.getByTestId('ui-element-select').selectOption('dialog');
  const design = page.frameLocator('[data-testid="ui-design-frame"]');
  await expect(design.getByTestId('tvn-dialog')).toBeVisible();

  // A preset brings sensible values (Pop: 0.35 s, overshoot).
  await page.getByTestId('anim-dialog-in-preset').selectOption('pop');
  await expect(page.getByTestId('anim-dialog-in-duration')).toHaveValue('0.35');
  await expect(page.getByTestId('anim-dialog-in-easing')).toHaveValue('back');
  await page.getByTestId('anim-dialog-in-duration').evaluate((el) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, '1.5');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  // ▶ Preview plays it in the canvas.
  await page.getByTestId('anim-dialog-in-preview').click();
  await expect.poll(async () => (await runningAnims(design)).some((a) => a.cls.includes('tvn-dialog'))).toBe(true);
  await page.getByTestId('anim-dialog-out-preset').selectOption('fade');
  await page.getByTestId('anim-text').selectOption('word');
  await page.getByTestId('anim-indicator').selectOption('pulse');
  await expect(design.locator('.tvn-root')).toHaveAttribute('data-indicator', 'pulse');
  await page.locator('.ui-props').screenshot({ path: path.join(TMP, 'shots', 'p5-dialog-anim.png') });

  // Choices: slide up, one after another.
  await page.getByTestId('ui-element-select').selectOption('choices');
  await page.getByTestId('anim-choices-in-preset').selectOption('slide-up');
  await expect(page.getByTestId('anim-choices-stagger')).toBeChecked(); // on by default once an animation is chosen
  await page.getByTestId('anim-choices-in-preview').click();
  await expect
    .poll(async () => new Set((await runningAnims(design)).filter((a) => a.cls.includes('tvn-choice')).map((a) => a.delay)).size)
    .toBeGreaterThanOrEqual(3);

  // In the game: the box pops in and the narration appears word by word (never cut inside a word).
  await page.getByTestId('play').click();
  const game = page.frameLocator('[data-testid="preview-frame"]');
  await game.getByTestId('tvn-start').click();
  const seen: string[] = [];
  for (let i = 0; i < 80; i++) {
    seen.push((await game.getByTestId('tvn-text').textContent()) ?? '');
    if (seen.length > 3 && seen.at(-1) === seen.at(-4) && seen.at(-1)!.length > 20) break;
    await page.waitForTimeout(40);
  }
  const full = seen.at(-1)!;
  const partial = seen.filter((t) => t && t !== full);
  expect(partial.length).toBeGreaterThan(1);
  for (const t of partial) expect(full.startsWith(t) && /\s$/.test(t), JSON.stringify(t)).toBe(true);
  await page.getByTestId('close-preview').click();

  // Saved, with the older setting kept in step (Pop → "fade" for older versions).
  await page.getByTestId('save').click();
  await expect(page.getByTestId('save-status')).toHaveText(/Saved/);
  const saved = JSON.parse(await fs.readFile(path.join(DIR, 'projects', 'Animated', 'project.json'), 'utf8'));
  const theme = saved.themes.find((t: { id: string }) => t.id === saved.settings.themeId);
  expect(theme.anim.dialogIn).toMatchObject({ kind: 'pop', duration: 1.5, easing: 'back' });
  expect(theme.anim).toMatchObject({ text: 'word', indicator: 'pulse', choiceStagger: 0.06 });
  expect(theme.anim.choicesIn).toMatchObject({ kind: 'slide', direction: 'up' });
  expect(theme.animation).toBe('fade');
  expect(errors).toEqual([]);
  await app.close();
});
