// Verifies the packaged editor (npm run dist → release/win-unpacked/TSTVN.exe) can export a
// working Windows game — packaged builds resolve the runtime and Electron binaries differently.
import { test, expect, _electron as electron } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { ROOT, TMP, electronEnv } from './helpers';

// TSTVN_EXE lets the test run against an installed copy (e.g. %LOCALAPPDATA%\Programs\TSTVN\TSTVN.exe).
const EXE = process.env.TSTVN_EXE || path.join(ROOT, 'release', 'win-unpacked', 'TSTVN.exe');

test('packaged TSTVN.exe exports a game that runs', async () => {
  test.skip(!existsSync(EXE), 'Run `npm run dist` first to build release/win-unpacked/TSTVN.exe');
  const work = path.join(TMP, 'packaged');
  await fs.rm(work, { recursive: true, force: true });
  const app = await electron.launch({ executablePath: EXE, args: [], env: electronEnv({ TSTVN_E2E: '1', TSTVN_USER_DATA: path.join(work, 'userdata') }) });
  const page = await app.firstWindow();
  await page.getByTestId('new-project-name').fill('Packaged Romance');
  await page.getByTestId('new-project-location').fill(path.join(work, 'projects'));
  await page.getByTestId('template-romance').click();
  await page.getByTestId('create-project').click();
  await expect(page.getByTestId('project-name')).toHaveText('Packaged Romance');
  await page.getByTestId('nav-export').click();
  await page.getByTestId('export-outdir').fill(path.join(work, 'out'));
  await page.getByTestId('platform-windows').click();
  await page.getByTestId('export-build').click();
  await expect(page.getByTestId('export-success')).toBeVisible({ timeout: 240000 });
  const gameDir = path.join(work, 'out', 'Packaged Romance-Windows');
  // Editor files must not leak into the game.
  expect(existsSync(path.join(gameDir, 'resources', 'app.asar'))).toBe(false);
  expect(existsSync(path.join(gameDir, 'resources', 'runtime'))).toBe(false);
  expect((await fs.readdir(gameDir)).some((n) => /^uninstall/i.test(n))).toBe(false);
  await app.close();

  const game = await electron.launch({ executablePath: path.join(gameDir, 'Packaged Romance.exe'), args: [], env: electronEnv() });
  const win = await game.firstWindow();
  await expect(win.getByTestId('tvn-title')).toHaveText('Packaged Romance');
  await win.getByTestId('tvn-start').click();
  await expect(win.getByTestId('tvn-text')).toContainText('Spring');
  await game.close();
});
