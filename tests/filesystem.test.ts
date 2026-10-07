import { beforeAll, describe, expect, it } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { makeSampleAssets } from '../scripts/media.mjs';
import { scanImport, executeImport } from '../src/main/importer';
import { createProject, openProject, saveProject, writeRecovery, UserStore } from '../src/main/projectStore';
import { listTree, createFolder, renamePath, movePaths, copyPaths, removePaths } from '../src/main/fileops';
import { createBackup, listBackups, restoreBackup, deleteBackup } from '../src/main/backups';
import { exportPackage, importPackage } from '../src/main/packageIO';
import { exportGame, parseGameJs, verifyWebGame, type ExportEnv } from '../src/main/gameExport';
import { readImageSize } from '../src/main/imageSize';
import { resolveInside, safeName } from '../src/main/paths';
import { detectCharacters, mergeDetectedCharacters } from '../src/shared/characters';
import { createAction } from '../src/shared/actions';
import type { Project } from '../src/shared/types';
import type { DuplicateDecision } from '../src/shared/api';
import { tempDir, testThumbnailer } from './helpers';

let root: string;
let sampleDir: string;

beforeAll(async () => {
  root = await tempDir();
  sampleDir = await makeSampleAssets(path.join(root, 'Assets'));
});

async function newProjectWithImport(name: string) {
  const { dir, project } = await createProject(path.join(root, 'projects'), name, 'blank');
  const plan = await scanImport(dir, [sampleDir], project.assets);
  const result = await executeImport(dir, plan, {}, project.assets, testThumbnailer);
  project.assets.push(...result.added);
  return { dir, project, plan, result };
}

describe('paths', () => {
  it('blocks traversal and sanitizes names', () => {
    expect(() => resolveInside('C:/proj', '../evil.txt')).toThrow();
    expect(resolveInside('C:/proj', 'assets/a.png')).toContain('assets');
    expect(safeName('a<b>:c?')).toBe('abc');
    expect(safeName('CON')).toBe('Untitled');
  });
  it('reads image sizes from headers', async () => {
    expect(await readImageSize(path.join(sampleDir, 'Backgrounds/park.png'))).toEqual({ width: 1280, height: 720 });
  });
});

describe('folder import', () => {
  it('imports a whole folder recursively with classification and a report', async () => {
    const { dir, plan, result } = await newProjectWithImport('Import Test');
    expect(plan.scanned).toBe(17);
    expect(plan.unsupported.map((p) => path.basename(p))).toEqual(['notes.txt']);
    expect(result.report.imported).toBe(16);
    expect(result.report.images).toBe(11);
    expect(result.report.audio).toBe(5);
    expect(result.report.unsupported).toBe(1);
    expect(result.report.errors).toEqual([]);
    const byName = (n: string) => result.added.find((a) => a.path.endsWith(n))!;
    // Dropped folder named "Assets" merges into assets/ and keeps the structure.
    expect(byName('Alice/happy.png').path).toBe('assets/Characters/Alice/happy.png');
    expect(byName('Alice/happy.png').type).toBe('character');
    expect(byName('park.png').type).toBe('background');
    expect(byName('confession.png').type).toBe('cg');
    expect(byName('title theme.wav').type).toBe('music');
    expect(byName('door.wav').type).toBe('sfx');
    expect(byName('alice_hello.wav').type).toBe('voice');
    expect(byName('mystery.png').type).toBe('unknown');
    expect(byName('park.png').width).toBe(1280);
    expect(existsSync(path.join(dir, 'assets/Characters/Bob/angry.png'))).toBe(true);
    expect(existsSync(path.join(dir, '.tstvn/thumbs', `${byName('park.png').id}.png`))).toBe(true);

    const chars = mergeDetectedCharacters([], detectCharacters(result.added));
    expect(chars.characters.map((c) => c.name)).toEqual(['Alice', 'Bob']);
    expect(chars.characters[0].expressions.map((e) => e.name)).toEqual(['Normal', 'Angry', 'Happy', 'Sad']);
  });

  it('detects duplicates by path and hash with skip / replace / keep', async () => {
    const { dir, project } = await newProjectWithImport('Dup Test');
    const plan2 = await scanImport(dir, [sampleDir], project.assets);
    expect(plan2.items.every((i) => i.duplicate?.reason === 'path')).toBe(true);
    const park = plan2.items.find((i) => i.dest.endsWith('park.png'))!;
    const door = plan2.items.find((i) => i.dest.endsWith('door.wav'))!;
    const decisions: Record<string, DuplicateDecision> = Object.fromEntries(plan2.items.map((i) => [i.id, 'skip' as const]));
    decisions[park.id] = 'replace';
    decisions[door.id] = 'keep';
    const r = await executeImport(dir, plan2, decisions, project.assets, testThumbnailer);
    expect(r.report.duplicates).toBe(14);
    expect(r.replaced.map((x) => x.assetId)).toEqual([project.assets.find((a) => a.path.endsWith('park.png'))!.id]);
    expect(r.added.map((a) => a.path)).toEqual(['assets/SFX/door (2).wav']);

    // Hash duplicate from a different folder
    const other = path.join(root, 'Other');
    await fs.mkdir(other, { recursive: true });
    await fs.copyFile(path.join(sampleDir, 'SFX/bell.wav'), path.join(other, 'ding.wav'));
    const plan3 = await scanImport(dir, [other], project.assets);
    expect(plan3.items[0].duplicate?.reason).toBe('hash');
  });
});

describe('file manager operations', () => {
  it('creates, renames, moves, copies and deletes with backup', async () => {
    const { dir, project } = await newProjectWithImport('FM Test');
    const folder = await createFolder(dir, 'assets/Props');
    expect(folder).toBe('assets/Props');
    const renamed = await renamePath(dir, 'assets/Props', 'Items');
    expect(renamed.to).toBe('assets/Items');
    const moved = await movePaths(dir, ['assets/Misc/mystery.png'], 'assets/Items');
    expect(moved[0].to).toBe('assets/Items/mystery.png');
    const copied = await copyPaths(dir, ['assets/Items/mystery.png'], 'assets/Items');
    expect(copied[0].to).toBe('assets/Items/mystery copy.png');
    const tree = await listTree(dir);
    expect(tree.folders).toContain('assets/Items');
    expect(tree.files.some((f) => f.path === 'assets/Items/mystery copy.png')).toBe(true);
    await expect(renamePath(dir, 'assets', 'x')).rejects.toThrow();
    await expect(movePaths(dir, ['../outside'], 'assets')).rejects.toThrow();

    const backupId = await createBackup(dir, project, 'Delete test');
    const removed = await removePaths(dir, ['assets/Items'], backupId);
    expect(removed.sort()).toEqual(['assets/Items/mystery copy.png', 'assets/Items/mystery.png']);
    expect(existsSync(path.join(dir, 'assets/Items'))).toBe(false);
    const backups = await listBackups(dir);
    expect(backups[0].hasFiles).toBe(true);
    const restored = await restoreBackup(dir, backupId, project);
    expect(restored.assets.length).toBe(project.assets.length);
    expect(existsSync(path.join(dir, 'assets/Items/mystery.png'))).toBe(true);
    await deleteBackup(dir, backupId);
    expect((await listBackups(dir)).some((b) => b.id === backupId)).toBe(false);
  });
});

describe('project store, recovery and templates', () => {
  it('creates, saves, reopens and offers recovery', async () => {
    const { dir, project } = await createProject(path.join(root, 'projects'), 'Store Test', 'romance');
    expect(project.scenes.length).toBe(4);
    project.name = 'Renamed';
    await saveProject(dir, project);
    const reopened = await openProject(dir);
    expect(reopened.project.name).toBe('Renamed');
    expect(reopened.recovery).toBeUndefined();
    await new Promise((r) => setTimeout(r, 30));
    await writeRecovery(dir, { ...project, name: 'Unsaved work' });
    const again = await openProject(path.join(dir, 'project.json'));
    expect(again.recovery?.project.name).toBe('Unsaved work');
    await expect(openProject(path.join(root, 'nothing-here'))).rejects.toThrow(/No TSTVN project/);
  });
  it('stores recent projects and user templates', async () => {
    const userDir = await tempDir('tstvn-user-');
    const store = new UserStore(userDir);
    const { dir, project } = await createProject(path.join(root, 'projects'), 'Template Source', 'horror');
    await store.addRecent(dir, project.name);
    expect((await store.recent())[0].path).toBe(dir);
    const info = await store.saveTemplate('My Horror', project);
    expect((await store.listTemplates())[0].name).toBe('My Horror');
    const tpl = await store.loadTemplate(info.id);
    const created = await createProject(path.join(root, 'projects'), 'From Template', `user:${info.id}`, tpl);
    expect(created.project.scenes.length).toBe(project.scenes.length);
    expect(created.project.id).not.toBe(project.id);
    await store.removeTemplate(info.id);
    expect(await store.listTemplates()).toEqual([]);
  });
});

describe('.tstvn package', () => {
  it('round-trips project data and assets', async () => {
    const { dir, project } = await newProjectWithImport('Package Test');
    await saveProject(dir, project);
    const file = path.join(root, 'package-test.tstvn');
    const r = await exportPackage(dir, project, file);
    expect(r.files).toBe(18);
    const imported = await importPackage(file, path.join(root, 'imported'));
    const opened = await openProject(imported);
    expect(opened.project.assets.length).toBe(project.assets.length);
    expect(existsSync(path.join(imported, 'assets/Characters/Alice/happy.png'))).toBe(true);
    const bad = path.join(root, 'bad.tstvn');
    await fs.writeFile(bad, 'not a zip');
    await expect(importPackage(bad, path.join(root, 'imported'))).rejects.toThrow();
  });
});

function sceneUsingAssets(project: Project) {
  const find = (n: string) => project.assets.find((a) => a.path.endsWith(n))!.id;
  const chars = mergeDetectedCharacters([], detectCharacters(project.assets));
  project.characters = chars.characters;
  const alice = project.characters[0];
  project.scenes[0].actions = [
    createAction('changeBackground', { assetId: find('classroom.png') }),
    createAction('playBGM', { assetId: find('daily life.wav') }),
    createAction('addCharacter', { characterId: alice.id }),
    createAction('dialogue', { speaker: alice.id, text: 'Hello!' }),
  ];
}

describe('game export', () => {
  const env = (): ExportEnv => ({
    runtimeDir: path.join(root, 'fake-runtime'),
    shellDir: path.resolve('src/game-shell'),
    electronDir: path.join(root, 'fake-electron'),
    electronExe: 'electron.exe',
    excludeResources: ['default_app.asar', 'app'],
  });

  beforeAll(async () => {
    await fs.mkdir(path.join(root, 'fake-runtime'), { recursive: true });
    await fs.writeFile(path.join(root, 'fake-runtime/runtime.js'), 'window.TSTVN_GAME && console.log("runtime")');
    await fs.writeFile(path.join(root, 'fake-runtime/runtime.css'), '.tvn-root{}');
    await fs.mkdir(path.join(root, 'fake-electron/resources'), { recursive: true });
    await fs.writeFile(path.join(root, 'fake-electron/electron.exe'), 'MZ');
    await fs.writeFile(path.join(root, 'fake-electron/resources/default_app.asar'), 'x');
  });

  it('exports a verified web game with only used assets', async () => {
    const { dir, project } = await newProjectWithImport('Web Export');
    sceneUsingAssets(project);
    const out = path.join(root, 'out-web');
    const r = await exportGame({ dir, project, platform: 'web', outDir: out, env: env() });
    expect(r.ok, JSON.stringify(r)).toBe(true);
    if (!r.ok) return;
    const data = parseGameJs(await fs.readFile(path.join(r.outputPath, 'game.js'), 'utf8'));
    expect(data.scenes[0].actions).toHaveLength(4);
    // background + bgm + 4 Alice expressions
    expect(Object.keys(data.assets)).toHaveLength(6);
    expect(existsSync(path.join(r.outputPath, 'assets/Backgrounds/classroom.png'))).toBe(true);
    expect(existsSync(path.join(r.outputPath, 'assets/Backgrounds/park.png'))).toBe(false);
    expect((await verifyWebGame(r.outputPath)).errors).toEqual([]);
    expect(r.checks.length).toBeGreaterThan(2);
  });

  it('exports a Windows build layout without editor files', async () => {
    const { dir, project } = await newProjectWithImport('Win Export');
    sceneUsingAssets(project);
    project.settings.title = 'My Game';
    const r = await exportGame({ dir, project, platform: 'windows', outDir: path.join(root, 'out-win'), env: env() });
    expect(r.ok, JSON.stringify(r)).toBe(true);
    if (!r.ok) return;
    expect(path.basename(r.launchPath)).toBe('My Game.exe');
    expect(existsSync(path.join(r.outputPath, 'resources/default_app.asar'))).toBe(false);
    expect(existsSync(path.join(r.outputPath, 'resources/app/www/game.js'))).toBe(true);
    const pkg = JSON.parse(await fs.readFile(path.join(r.outputPath, 'resources/app/package.json'), 'utf8'));
    expect(pkg.main).toBe('main.cjs');
  });

  it('refuses to export when assets are missing and leaves no broken package', async () => {
    const { dir, project } = await newProjectWithImport('Broken Export');
    sceneUsingAssets(project);
    await fs.rm(path.join(dir, 'assets/Backgrounds/classroom.png'));
    const out = path.join(root, 'out-broken');
    const r = await exportGame({ dir, project, platform: 'web', outDir: out, env: env() });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.join('\n')).toMatch(/Missing asset file: assets\/Backgrounds\/classroom.png/);
    expect(existsSync(out) ? await fs.readdir(out) : []).toEqual([]);
  });
});
