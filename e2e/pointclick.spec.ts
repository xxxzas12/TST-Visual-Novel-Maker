// Point & Click in the real editor and runtime: add the action from the menu, edit an object, drag and
// resize it on the stage, set a variable when clicked, play it in the preview.
import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
import { TMP, launchEditor } from './helpers';

const DIR = path.join(TMP, 'pointclick');

test('point & click: build on the stage, click objects in the game, variables update', async () => {
  await fs.rm(DIR, { recursive: true, force: true });
  const { app, page, errors } = await launchEditor();
  await page.getByTestId('new-project-name').fill('Room Escape');
  await page.getByTestId('new-project-location').fill(path.join(DIR, 'projects'));
  await page.getByTestId('create-project').click();

  // A flag the objects will set.
  await page.getByTestId('nav-variables').click();
  await page.getByTestId('add-variable').click();
  await page.getByTestId('var-name-Variable1').fill('has_key');
  await page.getByLabel('Variable type').selectOption('boolean');

  // Point & Click action from the "+ Action" menu (search).
  await page.getByTestId('nav-scenes').click();
  await page.getByTestId('add-action').click();
  await page.getByTestId('action-search').fill('point');
  await page.getByTestId('menu-pointAndClick').click();
  const pc = page.locator('[data-type="pointAndClick"]');
  await expect(pc).toHaveCount(1);
  await pc.click();
  await page.getByTestId('hotspot-label-0').fill('Key');
  await page.getByTestId('hotspot-setvar-0').click();
  await page.getByTestId('field-prompt').fill('Search the room');

  // Drag the object on the stage, then resize it.
  const card = page.getByTestId('hotspot-0');
  const x0 = Number(await card.locator('input[type=number]').nth(0).inputValue());
  const w0 = Number(await card.locator('input[type=number]').nth(2).inputValue());
  const box = (await page.getByTestId('stage-hotspot-0').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 10, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => Number(await card.locator('input[type=number]').nth(0).inputValue())).toBeGreaterThan(x0);
  const handle = (await page.getByTestId('stage-hotspot-size-0').boundingBox())!;
  await page.mouse.move(handle.x + 5, handle.y + 5);
  await page.mouse.down();
  await page.mouse.move(handle.x + 45, handle.y + 25, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => Number(await card.locator('input[type=number]').nth(2).inputValue())).toBeGreaterThan(w0);

  await page.screenshot({ path: path.join(TMP, 'shots', 'g-editor-stage.png') });

  // What happens after the click.
  await page.getByTestId('add-action').click();
  await page.getByTestId('action-search').fill('narration');
  await page.getByTestId('menu-narration').click();
  await page.getByTestId('field-text').fill('Key taken: {has_key}');
  await page.getByTestId('nav-export').click();
  await expect(page.getByTestId('project-check')).toContainText('No problems found');

  // Play it.
  await page.getByTestId('play').click();
  const frame = page.frameLocator('[data-testid="preview-frame"]');
  await frame.getByTestId('tvn-start').click();
  // The Blank template opens with a few lines of narration before our objects.
  for (let i = 0; i < 20 && !(await frame.getByTestId('tvn-hotspots').isVisible()); i++) {
    await frame.getByTestId('tvn-root').click({ position: { x: 20, y: 300 } });
    await page.waitForTimeout(250);
  }
  await expect(frame.getByTestId('tvn-hotspots')).toBeVisible();
  // The in-game menu bar is fully on screen (it is placed after the title screen hides).
  const vw = await frame.locator('body').evaluate(() => innerWidth);
  const bar = await frame.getByTestId('tvn-menubar').evaluate((el) => el.getBoundingClientRect().toJSON() as DOMRect);
  expect(bar.width).toBeGreaterThan(100);
  expect(bar.right).toBeLessThanOrEqual(vw + 0.5);
  // Clicking outside the objects does not continue the story.
  await frame.getByTestId('tvn-root').click({ position: { x: 5, y: 5 } });
  await expect(frame.getByTestId('tvn-hotspots')).toBeVisible();
  await expect(frame.getByTestId('tvn-hotspot-prompt')).toHaveText('Search the room');
  await expect(frame.getByTestId('tvn-hotspot-0')).toHaveAttribute('aria-label', 'Key');
  await expect(frame.getByTestId('tvn-hotspot-1')).toHaveAttribute('aria-label', 'Window');
  await frame.getByTestId('tvn-hotspot-1').hover();
  await page.screenshot({ path: path.join(TMP, 'shots', 'g-game-hotspots.png') });
  await frame.getByTestId('tvn-hotspot-0').click();
  await expect(frame.getByTestId('tvn-hotspots')).toHaveCount(0);
  await expect(frame.getByTestId('tvn-text')).toContainText('Key taken: true');
  await page.getByTestId('close-preview').click();
  expect(errors).toEqual([]);
  await app.close();
});
