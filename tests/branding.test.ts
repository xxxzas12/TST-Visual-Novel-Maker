// Application logo (TSTVN itself) and game icon (each project) — kept separate.
import { beforeAll, describe, expect, it } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { pngBuffer } from '../scripts/media.mjs';
import { LogoStore } from '../src/main/branding';
import { exportGame, gameIndexHtml } from '../src/main/gameExport';
import { createProject } from '../src/main/projectStore';
import { executeImport, scanImport } from '../src/main/importer';
import { createAction } from '../src/shared/actions';
import { collectUsedAssetIds, findAssetUsages, removeAssetReferences } from '../src/shared/validate';
import { tempDir, testThumbnailer } from './helpers';

let root: string;
let png: string;
beforeAll(async () => {
  root = await tempDir('tstvn-brand-');
  png = path.join(root, 'in', 'Icons', 'my-logo.png');
  await fs.mkdir(path.dirname(png), { recursive: true });
  await fs.writeFile(png, pngBuffer(64, 64, (x, y) => [x * 4, y * 4, 200, 255]));
});

// The real app decodes with Electron's nativeImage; here a PNG signature check stands in for it.
const fakeLoader = async (file: string) => {
  const b = await fs.readFile(file);
  return b.subarray(1, 4).toString() === 'PNG' ? `data:image/png;base64,${b.toString('base64').slice(0, 16)}` : null;
};

describe('application logo', () => {
  it('stores, returns and resets a custom logo', async () => {
    const store = new LogoStore(path.join(root, 'userdata', 'branding'), fakeLoader);
    expect(await store.get()).toBeNull();
    const url = await store.set(png);
    expect(url).toMatch(/^data:image\/png/);
    expect(await store.get()).toBe(url);
    expect(existsSync(path.join(root, 'userdata', 'branding', 'logo.png'))).toBe(true);
    await store.reset();
    expect(await store.get()).toBeNull();
    expect(await store.file()).toBeNull();
  });

  it('rejects files that are not usable images', async () => {
    const store = new LogoStore(path.join(root, 'userdata2'), fakeLoader);
    const txt = path.join(root, 'notes.txt');
    await fs.writeFile(txt, 'x');
    await expect(store.set(txt)).rejects.toThrow(/PNG, JPG or ICO/);
    await expect(store.set(path.join(root, 'missing.png'))).rejects.toThrow(/not found/);
    const fake = path.join(root, 'fake.png');
    await fs.writeFile(fake, 'not really a png');
    await expect(store.set(fake)).rejects.toThrow(/not a readable image/);
    expect(await store.get()).toBeNull(); // a failed change keeps the previous state
  });
});

describe('game icon', () => {
  it('is a project asset used by the Web and Windows exports (not the TSTVN logo)', async () => {
    const { dir, project } = await createProject(path.join(root, 'projects'), 'Icon Game', 'blank');
    const plan = await scanImport(dir, [path.dirname(png)], []);
    const { added } = await executeImport(dir, plan, {}, [], testThumbnailer);
    const icon = added[0];
    project.assets.push(icon);
    project.settings.gameIconAssetId = icon.id;
    project.scenes[0].actions.push(createAction('narration', { text: 'hi' }));
    expect(collectUsedAssetIds(project).has(icon.id)).toBe(true);
    expect(findAssetUsages(project, icon.id).map((u) => u.label)).toEqual(['Game icon']);

    expect(gameIndexHtml('T', 'assets/Icons/my logo.png')).toContain('<link rel="icon" href="assets/Icons/my%20logo.png">');
    expect(gameIndexHtml('T')).not.toContain('rel="icon"');

    const runtimeDir = path.join(root, 'rt');
    const electronDir = path.join(root, 'electron');
    await fs.mkdir(runtimeDir, { recursive: true });
    await fs.mkdir(electronDir, { recursive: true });
    await fs.writeFile(path.join(runtimeDir, 'runtime.js'), 'window.TSTVN_GAME');
    await fs.writeFile(path.join(runtimeDir, 'runtime.css'), '.x{}');
    await fs.writeFile(path.join(electronDir, 'electron.exe'), 'exe');
    const env = { runtimeDir, shellDir: path.resolve('src/game-shell'), electronDir, electronExe: 'electron.exe', excludeResources: [] };

    const web = await exportGame({ dir, project, platform: 'web', outDir: path.join(root, 'out'), env });
    expect(web.ok, JSON.stringify(web)).toBe(true);
    if (web.ok) {
      const html = await fs.readFile(path.join(web.outputPath, 'index.html'), 'utf8');
      expect(html).toContain(`<link rel="icon" href="${icon.path}">`);
      expect(existsSync(path.join(web.outputPath, icon.path))).toBe(true);
    }
    const win = await exportGame({ dir, project, platform: 'windows', outDir: path.join(root, 'out'), env });
    expect(win.ok, JSON.stringify(win)).toBe(true);
    if (win.ok) {
      const cfg = JSON.parse(await fs.readFile(path.join(win.outputPath, 'resources', 'app', 'game-config.json'), 'utf8'));
      expect(cfg.icon).toBe(`www/${icon.path}`);
      expect(existsSync(path.join(win.outputPath, 'resources', 'app', cfg.icon))).toBe(true);
      expect(await fs.readFile(path.join(win.outputPath, 'resources', 'app', 'main.cjs'), 'utf8')).toContain('config.icon');
    }

    // Deleting the image clears the icon instead of breaking the export.
    removeAssetReferences(project, icon.id);
    expect(project.settings.gameIconAssetId).toBeUndefined();
  });
});
