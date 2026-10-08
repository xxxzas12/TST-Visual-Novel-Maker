// In-game Gallery in an exported game: locked/unlocked states, unlocking by playing, "always unlocked",
// CG viewer, music player, persistence after reload — plus the Project Settings controls.
import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
import { makeSampleAssets, pngBuffer } from '../scripts/media.mjs';
import { TMP, launchEditor, queueDialog } from './helpers';

const DIR = path.join(TMP, 'gallery');
const id = () => Math.random().toString(36).slice(2, 10);

test('game gallery: CG, characters, music, endings — locked, unlocked by playing, persisted', async () => {
  await fs.rm(DIR, { recursive: true, force: true });
  await makeSampleAssets(path.join(DIR, 'Assets'));
  await fs.writeFile(path.join(DIR, 'Assets', 'CG', 'secret.png'), pngBuffer(320, 180, (x) => [20, x % 255, 90, 255]));

  let { app, page, errors } = await launchEditor();
  await page.getByTestId('new-project-name').fill('Gallery Game');
  await page.getByTestId('new-project-location').fill(path.join(DIR, 'projects'));
  await page.getByTestId('create-project').click();
  await page.getByTestId('nav-assets').click();
  await queueDialog(app, path.join(DIR, 'Assets'));
  await page.getByTestId('import-folder').click();
  await expect(page.getByTestId('import-report')).toBeVisible({ timeout: 60000 });
  await page.getByTestId('import-report-done').click();
  // Enable the gallery in Project Settings (the controls are what we test here).
  await page.getByTestId('nav-settings').click();
  await page.getByTestId('gallery-enabled').check();
  await expect(page.getByTestId('gallery-section-cg')).toBeChecked();
  await page.getByTestId('save').click();
  await expect(page.getByTestId('save-status')).toContainText('Saved');
  expect(errors).toEqual([]);
  await app.close();

  // The story: music, Alice, CG "confession", ending A. Ending B + CG "secret" are on a branch never taken.
  const file = path.join(DIR, 'projects', 'Gallery Game', 'project.json');
  const p = JSON.parse(await fs.readFile(file, 'utf8'));
  const asset = (name: string) => p.assets.find((a: { name: string }) => a.name === name).id;
  const alice = p.characters.find((c: { name: string }) => c.name === 'Alice');
  expect(alice).toBeTruthy();
  const act = (type: string, params: Record<string, unknown>) => ({ id: `a_${id()}`, type, params });
  const endA = act('endGame', { message: 'Ending A' });
  const endB = act('endGame', { message: 'Ending B' });
  const branch = { id: `s_${id()}`, name: 'Secret Branch', tags: [], actions: [act('showCG', { assetId: asset('secret.png') }), endB] };
  p.scenes[0].actions = [
    act('playBGM', { assetId: asset('daily life.wav') }),
    act('addCharacter', { characterId: alice.id }),
    act('showCG', { assetId: asset('confession.png') }),
    act('narration', { text: 'A memory to keep.' }),
    endA,
  ];
  p.scenes.push(branch);
  p.chapters[0].sceneIds.push(branch.id);
  await fs.writeFile(file, JSON.stringify(p));

  // Editor shows the items; mark ending B as always unlocked; export.
  ({ app, page, errors } = await launchEditor());
  await page.getByTestId('recent-item').filter({ hasText: 'Gallery Game' }).first().click();
  await page.getByTestId('nav-settings').click();
  await expect(page.getByTestId('gallery-settings')).toContainText('CG Gallery (2)');
  await page.getByTestId(`gallery-unlock-ending:${endB.id}`).selectOption('always');
  await page.getByTestId('nav-export').click();
  await page.getByTestId('export-outdir').fill(path.join(DIR, 'exports'));
  await page.getByTestId('platform-web').click();
  await page.getByTestId('export-build').click();
  await expect(page.getByTestId('export-success')).toBeVisible({ timeout: 60000 });

  const [win] = await Promise.all([
    app.waitForEvent('window'),
    app.evaluate(({ BrowserWindow }, f) => void new BrowserWindow({ width: 1100, height: 700 }).loadFile(f), path.join(DIR, 'exports', 'Gallery Game-Web', 'index.html')),
  ]);
  const item = (key: string) => win.getByTestId(`tvn-gallery-item-${key}`);
  const cgConfession = `cg:${asset('confession.png')}`;
  const cgSecret = `cg:${asset('secret.png')}`;

  // Before playing: everything locked except the "always" ending.
  await win.getByTestId('tvn-gallery').click();
  await expect(win.getByTestId('tvn-gallery-tab-cg')).toHaveText(/0\/2/);
  await expect(item(cgConfession)).toHaveAttribute('data-locked', 'true');
  await win.getByTestId('tvn-gallery-tab-endings').click();
  await expect(item(`ending:${endA.id}`)).toHaveAttribute('data-locked', 'true');
  await expect(item(`ending:${endB.id}`)).toHaveAttribute('data-locked', 'false');
  await win.getByTestId('tvn-menu-close').click();

  // Play to ending A.
  await win.getByTestId('tvn-start').click();
  for (let i = 0; i < 20 && !(await win.getByTestId('tvn-end').isVisible()); i++) {
    await win.getByTestId('tvn-root').click({ position: { x: 300, y: 200 } });
    await win.waitForTimeout(300);
  }
  await expect(win.getByTestId('tvn-end')).toHaveText('Ending A');
  await win.getByTestId('tvn-to-title').click();

  // After playing: what was seen is unlocked, the untaken branch stays locked.
  await win.getByTestId('tvn-gallery').click();
  await expect(win.getByTestId('tvn-gallery-tab-cg')).toHaveText(/1\/2/);
  await win.getByTestId('tvn-gallery-tab-cg').click(); // the gallery reopens on the last tab viewed
  await expect(item(cgConfession)).toHaveAttribute('data-locked', 'false');
  await expect(item(cgSecret)).toHaveAttribute('data-locked', 'true');
  await item(cgConfession).click();
  await expect(win.getByTestId('tvn-gallery-viewer')).toBeVisible();
  await win.getByTestId('tvn-gallery-viewer').click();
  await win.getByTestId('tvn-gallery-tab-characters').click();
  await expect(item(`char:${alice.id}`)).toHaveAttribute('data-locked', 'false');
  await win.getByTestId('tvn-gallery-tab-music').click();
  await expect(item(`music:${asset('daily life.wav')}`)).toHaveAttribute('data-locked', 'false');
  await item(`music:${asset('daily life.wav')}`).click();
  await expect(item(`music:${asset('daily life.wav')}`)).toContainText('⏸');
  await win.getByTestId('tvn-gallery-tab-endings').click();
  await expect(item(`ending:${endA.id}`)).toHaveAttribute('data-locked', 'false');
  await win.screenshot({ path: path.join(TMP, 'shots', 'f-gallery.png') });

  // Unlocks persist (new session of the game).
  await win.reload();
  await win.getByTestId('tvn-gallery').click();
  await expect(win.getByTestId('tvn-gallery-tab-cg')).toHaveText(/1\/2/);
  await win.close();
  expect(errors).toEqual([]);
  await app.close();
});
