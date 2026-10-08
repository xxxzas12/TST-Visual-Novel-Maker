// Feature tests: recovery, backups, missing assets, action templates, packages, flow, large galleries.
import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { makeSampleAssets, pngBuffer } from '../scripts/media.mjs';
import { renameFontFamily } from '../scripts/font-tools.mjs';
import { TMP, freshTmp, launchEditor, queueDialog } from './helpers';

async function createProject(page: Page, name: string, template = 'blank') {
  await expect(page.getByTestId('welcome')).toBeVisible();
  await page.getByTestId('new-project-name').fill(name);
  await page.getByTestId('new-project-location').fill(path.join(TMP, 'projects'));
  await page.getByTestId(`template-${template}`).click();
  await page.getByTestId('create-project').click();
  await expect(page.getByTestId('project-name')).toHaveText(name);
}

async function importFolder(page: Page, app: Parameters<typeof queueDialog>[0], dir: string) {
  await page.getByTestId('nav-assets').click();
  await queueDialog(app, dir);
  await page.getByTestId('import-folder').click();
  await expect(page.getByTestId('import-report')).toBeVisible({ timeout: 120000 });
  await page.getByTestId('import-report-done').click();
}

test.beforeAll(async () => {
  await freshTmp();
  // These tests don't cover onboarding (the acceptance test does); start with it dismissed
  // so the checklist panel never overlaps what a test is clicking.
  await fs.mkdir(path.join(TMP, 'userdata'), { recursive: true });
  await fs.writeFile(path.join(TMP, 'userdata', 'settings.json'), JSON.stringify({ onboardingDone: true, autosaveMinutes: 2 }));
  await makeSampleAssets(path.join(TMP, 'Assets'));
});

test('crash recovery offers Recover / Discard', async () => {
  let { app, page } = await launchEditor();
  await createProject(page, 'Recovery Test');
  await page.getByTestId('quick-dialogue').click();
  await page.getByTestId('field-text').fill('UNSAVED LINE');
  await expect(page.getByTestId('save-status')).toContainText('Unsaved');
  // Wait for the 10 s recovery snapshot, then simulate a crash.
  const rec = path.join(TMP, 'projects', 'Recovery Test', '.tstvn', 'recovery.json');
  await expect.poll(() => existsSync(rec), { timeout: 20000 }).toBe(true);
  app.process().kill();

  ({ app, page } = await launchEditor());
  await page.getByTestId('recent-item').first().click();
  await expect(page.getByTestId('confirm-dialog')).toContainText('Recovered Project');
  await page.getByTestId('confirm-ok').click();
  await expect(page.locator('[data-type="dialogue"]')).toContainText('UNSAVED LINE');
  await page.getByTestId('save').click();
  await expect(page.getByTestId('save-status')).toContainText('Saved');
  expect(existsSync(rec)).toBe(false);
  await app.close();
});

test('delete with backup, restore, missing asset → export blocked → locate → export ok', async () => {
  const { app, page, errors } = await launchEditor();
  await createProject(page, 'Backup Test');
  await importFolder(page, app, path.join(TMP, 'Assets'));
  const dir = path.join(TMP, 'projects', 'Backup Test');

  // Delete an asset (confirmation + automatic backup), then restore it.
  await page.getByTestId('asset-park.png').click();
  await page.getByTestId('inspector-delete').click();
  await expect(page.getByTestId('confirm-dialog')).toContainText('backup');
  await page.getByTestId('confirm-ok').click();
  await expect(page.getByTestId('asset-park.png')).toHaveCount(0);
  expect(existsSync(path.join(dir, 'assets/Backgrounds/park.png'))).toBe(false);
  await page.getByTestId('nav-backups').click();
  await expect(page.getByTestId('backup-table')).toContainText('Delete 1 item(s)');
  await page.getByTestId('restore-backup').first().click();
  await page.getByTestId('confirm-ok').click();
  await expect.poll(() => existsSync(path.join(dir, 'assets/Backgrounds/park.png'))).toBe(true);
  await page.getByTestId('nav-assets').click();
  await expect(page.getByTestId('asset-park.png')).toBeVisible();

  // Use classroom.png in the scene, then remove the file behind TSTVN's back.
  await page.getByTestId('nav-scenes').click();
  await page.getByTestId('left-tab-assets').click();
  await page.getByTestId('drawer-classroom.png').dblclick();
  await expect(page.locator('[data-type="changeBackground"]').last()).toContainText('classroom.png');
  await page.getByTestId('save').click();
  await fs.rm(path.join(dir, 'assets/Backgrounds/classroom.png'));

  await page.getByTestId('nav-export').click();
  await expect(page.getByTestId('missing-assets')).toContainText('classroom.png');
  await page.getByTestId('export-outdir').fill(path.join(TMP, 'exports-backup'));
  await page.getByTestId('platform-web').click();
  await page.getByTestId('export-build').click();
  await expect(page.getByTestId('export-failed')).toContainText('Missing asset file: assets/Backgrounds/classroom.png');
  expect(existsSync(path.join(TMP, 'exports-backup', 'Backup Test-Web'))).toBe(false);

  // Locate the file again.
  await queueDialog(app, [path.join(TMP, 'Assets', 'Backgrounds', 'classroom.png')]);
  await page.getByTestId('missing-assets').getByRole('button', { name: 'Locate…' }).click();
  await expect(page.getByTestId('missing-assets')).toHaveCount(0);
  await page.getByTestId('export-build').click();
  await expect(page.getByTestId('export-success')).toBeVisible({ timeout: 60000 });
  expect(errors.filter((e) => !e.includes('classroom.png'))).toEqual([]);
  await app.close();
});

test('action templates, story-flow connection, .tstvn package import', async () => {
  const { app, page } = await launchEditor();
  await createProject(page, 'Template Test', 'romance');

  // Save two actions as a reusable template, insert into another scene.
  await page.getByTestId('scene-First Meeting').click();
  await page.getByTestId('action-1').click();
  await page.getByTestId('action-2').click({ modifiers: ['Shift'] });
  await page.getByTestId('save-template').click();
  await page.getByTestId('prompt-input').fill('Intro Pair');
  await page.getByTestId('prompt-ok').click();
  await page.getByTestId('scene-Good Ending').click();
  const before = await page.locator('.action-row').count();
  await page.getByTestId('add-action').click();
  await page.getByTestId('cat-templates').click();
  await page.getByTestId('template-item-Intro Pair').click();
  await expect(page.locator('.action-row')).toHaveCount(before + 2);

  // Connect two scenes in Story Flow by dragging between handles.
  await page.getByTestId('nav-flow').click();
  const src = page.getByTestId('flow-node-Normal Ending').locator('.react-flow__handle.source');
  const dst = page.getByTestId('flow-node-Good Ending').locator('.react-flow__handle.target');
  // Wait until fitView has finished moving the nodes before measuring.
  const box = async () => JSON.stringify([await src.boundingBox(), await dst.boundingBox()]);
  await expect.poll(async () => {
    const first = await box();
    await page.waitForTimeout(200);
    return first === (await box());
  }).toBe(true);
  const a = (await src.boundingBox())!;
  const b = (await dst.boundingBox())!;
  // Both handles must be the topmost element at the drag points (no toast/panel covering them).
  const topmost = () =>
    page.evaluate(
      (pts) => pts.map(([x, y]) => {
        const el = document.elementFromPoint(x, y) as HTMLElement | null;
        return el?.classList.contains('react-flow__handle') ? 'handle' : `${el?.tagName}.${el?.className}`;
      }),
      [[a.x + a.width / 2, a.y + a.height / 2], [b.x + b.width / 2, b.y + b.height / 2]],
    );
  await expect.poll(topmost, { timeout: 15000 }).toEqual(['handle', 'handle']);
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 20, a.y + a.height / 2, { steps: 4 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
  await page.mouse.up();
  await page.getByTestId('list-mode').click();
  const normalRow = page.locator('tr').filter({ has: page.locator('td:first-child', { hasText: /^Normal Ending$/ }) });
  await expect(normalRow).toContainText('→ Good Ending');

  // Export a package and import it back from the start screen.
  await page.getByTestId('save').click();
  const pkg = path.join(TMP, 'template-test.tstvn');
  await page.getByTestId('nav-export').click();
  await queueDialog(app, pkg);
  await page.getByTestId('export-package').click();
  await expect.poll(() => existsSync(pkg), { timeout: 30000 }).toBe(true);
  await page.getByTestId('close-project').click();
  await queueDialog(app, [pkg], path.join(TMP, 'imported'));
  await page.getByTestId('import-package').click();
  await expect(page.getByTestId('project-name')).toHaveText('Template Test');
  await page.getByTestId('scene-Good Ending').click();
  await expect(page.locator('.action-row')).toHaveCount(before + 2);
  await app.close();
});

test('Thai language: editor UI, Thai template, Thai game menus in the export', async () => {
  const { app, page, errors } = await launchEditor();
  await page.getByTestId('language-select').selectOption('th');
  await expect(page.getByTestId('create-project')).toHaveText('✨ สร้างโปรเจกต์');
  await page.getByTestId('new-project-name').fill('นิยายของฉัน');
  await page.getByTestId('new-project-location').fill(path.join(TMP, 'projects'));
  await page.getByTestId('template-romance').click();
  await page.getByTestId('create-project').click();
  await expect(page.getByTestId('project-name')).toHaveText('นิยายของฉัน');
  await expect(page.getByTestId('nav-scenes')).toContainText('ฉาก');
  await expect(page.getByTestId('scene-พบกันครั้งแรก')).toBeVisible();
  await expect(page.getByTestId('quick-dialogue')).toContainText('บทพูด');
  await page.getByTestId('scene-เดต').click();
  await page.locator('[data-type="choice"]').click();
  await fs.mkdir(path.join(TMP, 'screenshots'), { recursive: true });
  await page.screenshot({ path: path.join(TMP, 'screenshots', 'thai-editor.png') });
  await page.getByTestId('nav-settings').click();
  await expect(page.getByTestId('game-language')).toHaveValue('th');

  await page.getByTestId('nav-export').click();
  await expect(page.getByTestId('project-check')).toContainText('ไม่พบปัญหา');
  await page.getByTestId('export-outdir').fill(path.join(TMP, 'exports-th'));
  await page.getByTestId('platform-web').click();
  await page.getByTestId('export-build').click();
  await expect(page.getByTestId('export-success')).toBeVisible({ timeout: 60000 });
  const indexHtml = path.join(TMP, 'exports-th', 'นิยายของฉัน-Web', 'index.html');
  const [win] = await Promise.all([
    app.waitForEvent('window'),
    app.evaluate(({ BrowserWindow }, file) => void new BrowserWindow({ width: 1000, height: 600 }).loadFile(file), indexHtml),
  ]);
  await expect(win.getByTestId('tvn-start')).toHaveText('เริ่มเกม');
  await win.getByTestId('tvn-start').click();
  await expect(win.getByTestId('tvn-text')).toContainText('ฤดูใบไม้ผลิ');
  await expect(win.getByTestId('tvn-q-save')).toHaveText('บันทึก');
  await win.close();

  // Switch back to English from Application settings.
  await page.getByTestId('app-settings').click();
  await page.getByTestId('language-select').selectOption('en');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('nav-scenes')).toContainText('Scenes');
  expect(errors).toEqual([]);
  await app.close();
});

async function setRange(page: Page, testId: string, value: number) {
  await page.getByTestId(testId).evaluate((el, v) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    setter.call(el, String(v));
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

test('fonts: system UI font, imported dialogue font, sizes, preview, light mode, persistence, reset', async () => {
  const arial = path.join(process.env.WINDIR ?? 'C:\\Windows', 'Fonts', 'arial.ttf');
  test.skip(!existsSync(arial), 'needs a Windows font to build the test font');
  const fontFile = path.join(TMP, 'MyE2EFont.ttf');
  await fs.writeFile(fontFile, renameFontFamily(await fs.readFile(arial), 'TSTVN E2E Font'));
  const bodyFont = (p: Page) => p.evaluate(() => getComputedStyle(document.body).fontFamily);

  let { app, page, errors } = await launchEditor();
  // Application settings are reachable before any project exists.
  await page.getByTestId('app-settings').click();
  await page.getByTestId('app-settings-interface').click();

  // Program font from the installed fonts, with search and preview.
  await page.getByTestId('change-ui-font').click();
  await page.getByTestId('font-search').fill('Arial');
  await page.getByTestId('font-Arial').click();
  await expect(page.getByTestId('font-picker-preview')).toHaveCSS('font-family', /^"?Arial"?,/);
  await page.getByTestId('font-picker-ok').click();
  await setRange(page, 'ui-font-size', 16);
  await expect(page.getByTestId('font-preview-light')).toHaveCSS('font-size', '16px');
  await expect(page.getByTestId('font-preview-dark')).toHaveCSS('font-family', /^"?Arial"?,/);
  expect(await bodyFont(page)).not.toContain('Arial'); // preview only — not applied yet
  await page.getByTestId('fonts-apply').click();
  await expect.poll(() => bodyFont(page)).toMatch(/^"?Arial/);
  await expect(page.locator('html')).toHaveCSS('font-size', '16px');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('app-settings-dialog')).toHaveCount(0);

  // The game font is a project setting.
  await createProject(page, 'Font Test', 'romance');
  await page.getByTestId('nav-settings').click();
  await expect(page.getByTestId('change-ui-font')).toHaveCount(0); // no application settings here

  // Dialogue font imported from a .ttf (not installed in Windows) + size.
  await page.getByTestId('change-dialogue-font').click();
  await queueDialog(app, [fontFile]);
  await page.getByTestId('import-font').click();
  await expect(page.getByTestId('font-TSTVN E2E Font')).toBeVisible();
  await fs.mkdir(path.join(TMP, 'screenshots'), { recursive: true });
  await page.screenshot({ path: path.join(TMP, 'screenshots', 'font-picker.png') });
  await page.getByTestId('font-picker-ok').click();
  await expect(page.getByTestId('dialogue-font-name')).toHaveText('TSTVN E2E Font');
  await page.getByTestId('dialogue-size-theme').uncheck();
  await setRange(page, 'dialogue-font-size', 34);
  const preview = page.frameLocator('[data-testid="font-game-preview"]');
  await expect(preview.getByTestId('tvn-text')).toHaveCSS('font-family', /^"TSTVN E2E Font"/);
  const frame = page.frames().find((f) => f.url().includes('preview.html'))!;
  await expect.poll(() => frame.evaluate(() => document.fonts.check('20px "TSTVN E2E Font"'))).toBe(true);

  await page.getByTestId('game-fonts-apply').click();

  // Light mode keeps the chosen font (Application settings from inside a project).
  await page.getByTestId('app-settings').click();
  await page.getByTestId('appearance').selectOption('light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(243, 244, 248)');
  expect(await bodyFont(page)).toMatch(/^"?Arial/);
  await page.screenshot({ path: path.join(TMP, 'screenshots', 'fonts-light.png') });
  await page.keyboard.press('Escape');
  await page.getByTestId('save').click();

  // The exported game ships the font file and uses it.
  await page.getByTestId('nav-export').click();
  await expect(page.getByTestId('project-check')).toContainText('No problems found');
  await page.getByTestId('export-outdir').fill(path.join(TMP, 'exports-font'));
  await page.getByTestId('platform-web').click();
  await page.getByTestId('export-build').click();
  await expect(page.getByTestId('export-success')).toBeVisible({ timeout: 60000 });
  const web = path.join(TMP, 'exports-font', 'Font Test-Web');
  expect((await fs.readdir(path.join(web, 'fonts'))).length).toBe(1);
  const [win] = await Promise.all([
    app.waitForEvent('window'),
    app.evaluate(({ BrowserWindow }, file) => void new BrowserWindow({ width: 1000, height: 600 }).loadFile(file), path.join(web, 'index.html')),
  ]);
  await win.getByTestId('tvn-start').click();
  await expect(win.getByTestId('tvn-text')).toHaveCSS('font-family', /^"TSTVN E2E Font"/);
  await expect.poll(() => win.evaluate(() => document.fonts.check('20px "TSTVN E2E Font"'))).toBe(true);
  await win.close();
  expect(errors).toEqual([]);
  await app.close();

  // Persistence after restarting TSTVN.
  ({ app, page, errors } = await launchEditor());
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('html')).toHaveCSS('font-size', '16px');
  await expect.poll(() => bodyFont(page)).toMatch(/^"?Arial/);
  await page.getByTestId('recent-item').first().click();
  await page.getByTestId('nav-settings').click();
  await expect(page.getByTestId('dialogue-font-name')).toHaveText('TSTVN E2E Font');

  // Reset to Default (previewed first, then applied).
  await page.getByTestId('game-fonts-reset').click();
  await page.getByTestId('game-fonts-apply').click();
  await expect(page.getByTestId('dialogue-font-name')).toContainText('Theme default');
  await page.getByTestId('app-settings').click();
  await page.getByTestId('app-settings-interface').click();
  await page.getByTestId('fonts-reset').click();
  await expect(page.getByTestId('ui-font-name')).toHaveText('Default (Segoe UI)');
  await page.getByTestId('fonts-apply').click();
  await expect(page.locator('html')).toHaveCSS('font-size', '14px');
  await expect.poll(() => bodyFont(page)).toMatch(/Segoe UI/);
  await page.getByTestId('app-settings-general').click();
  await page.getByTestId('appearance').selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(errors).toEqual([]);
  await app.close();
});

test('large gallery: 2000 assets import, virtualized rendering stays fast', async () => {
  const big = path.join(TMP, 'BigAssets');
  const png = pngBuffer(48, 48, (x, y) => [x * 5, y * 5, 128, 255]);
  for (let f = 0; f < 20; f++) {
    const d = path.join(big, 'Props', `Set ${f}`);
    await fs.mkdir(d, { recursive: true });
    // Different content per file so they are not duplicates.
    await Promise.all(Array.from({ length: 100 }, (_, i) => fs.writeFile(path.join(d, `item_${i}.png`), Buffer.concat([png, Buffer.from(`${f}-${i}`)]))));
  }
  const { app, page, errors } = await launchEditor();
  await createProject(page, 'Big Test');
  const t0 = Date.now();
  await importFolder(page, app, big);
  const importMs = Date.now() - t0;
  await expect(page.getByTestId('gallery')).toBeVisible();
  const rendered = await page.locator('[data-testid^="asset-item_"]').count();
  expect(rendered).toBeGreaterThan(5);
  expect(rendered).toBeLessThan(300); // only visible rows are in the DOM
  const t1 = Date.now();
  await page.getByTestId('gallery-search').fill('item_99');
  await expect(page.locator('[data-testid^="asset-item_99"]')).toHaveCount(20);
  const searchMs = Date.now() - t1;
  await page.getByTestId('gallery-search').fill('');
  await page.getByTestId('gallery').evaluate((el) => (el.scrollTop = el.scrollHeight));
  await expect(page.locator('[data-testid^="asset-item_"]').first()).toBeVisible();
  console.log(`2000 assets: import ${importMs} ms, search ${searchMs} ms, DOM tiles ${rendered}`);
  expect(searchMs).toBeLessThan(3000);
  expect(errors).toEqual([]);
  await app.close();
});
