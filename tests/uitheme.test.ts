// Game UI / Theme editor: theme model, migration, responsive layout, editing helpers,
// scene themes, .tsttheme import/export and runtime behaviour.
import { beforeAll, describe, expect, it } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { pngBuffer } from '../scripts/media.mjs';
import { renameFontFamily } from '../scripts/font-tools.mjs';
import type { Theme } from '../src/shared/types';
import { THEME_PRESETS, getPresetTheme, normalizeTheme, textContrast, themeAssetIds } from '../src/shared/themes';
import { choiceRegion, fontPx, layoutDialog, lengthPx, makeContext, placeBox, themeVars, uiScale } from '../src/shared/uilayout';
import {
  DEVICES,
  alignElement,
  checkAllDevices,
  checkLayout,
  checkReadability,
  deleteMenuButton,
  duplicateMenuButton,
  estimateRects,
  moveElement,
  moveMenuButton,
  resizeElement,
} from '../src/shared/uicheck';
import { buildGameData } from '../src/shared/gamedata';
import { createEmptyProject, normalizeProject } from '../src/shared/project';
import { createAction } from '../src/shared/actions';
import { collectUsedAssetIds, findAssetUsages, removeAssetReferences, replaceAssetReferences, validateProject } from '../src/shared/validate';
import { exportThemeFile, importThemeFile } from '../src/main/themeIO';
import { createProject } from '../src/main/projectStore';
import { executeImport, scanImport } from '../src/main/importer';
import { playThrough, tempDir, testThumbnailer } from './helpers';

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const custom = (id = 'th1'): Theme => ({ ...getPresetTheme('modern')!, id, name: 'Mine', preset: undefined });

/** A version-1 theme exactly as older TSTVN versions saved it. */
const V1_DARK = {
  id: 'th_old',
  name: 'Old Dark',
  font: '"Segoe UI", sans-serif',
  fontSize: 26,
  textColor: '#e8e8f0',
  dialog: { background: '#050507', opacity: 0.9, borderColor: '#9b1c31', borderWidth: 1, radius: 4, shadow: true, position: 'top', width: 80, padding: 26 },
  nameBox: { background: '#9b1c31', color: '#ffffff', radius: 2 },
  choice: { background: '#050507', color: '#e8e8f0', hoverBackground: '#9b1c31', borderColor: '#9b1c31', radius: 4, opacity: 0.92 },
  menu: { background: '#050507', color: '#e8e8f0', accent: '#d13a52', opacity: 0.96 },
  animation: 'slide',
};

describe('presets & theme model', () => {
  it('ships the eight requested presets (plus Fantasy) as complete version-2 themes', () => {
    for (const id of ['modern', 'minimal', 'classic', 'dark', 'soft', 'rpg', 'romance', 'horror', 'fantasy']) {
      const t = getPresetTheme(id)!;
      expect(t.version).toBe(2);
      expect(normalizeTheme(t)).toEqual(t);
      expect(t.menuBar.buttons.length).toBeGreaterThan(0);
    }
    // Presets are distinct designs.
    const looks = new Set(THEME_PRESETS.map((t) => JSON.stringify([t.dialog.surface, t.choice.states, t.font])));
    expect(looks.size).toBe(THEME_PRESETS.length);
  });

  it('every preset is readable and fits every device without overlaps', () => {
    for (const t of THEME_PRESETS) {
      expect(checkReadability(t), t.id).toEqual([]);
      const warnings = checkAllDevices(t).filter((i) => i.severity === 'warning');
      expect(warnings, t.id).toEqual([]);
    }
  });

  it('migrates version-1 themes (sizes ×1.5 to the 1920×1080 canvas, colors kept)', () => {
    const t = normalizeTheme(V1_DARK);
    expect(t.version).toBe(2);
    expect(t.id).toBe('th_old');
    expect(t.dialog.anchor).toBe('top');
    expect(t.dialog.text.size).toBe(39);
    expect(t.dialog.text.color).toBe('#e8e8f0');
    expect(t.dialog.width).toEqual({ value: 1500, unit: 'px' });
    expect(t.dialog.padding).toEqual({ x: 39, y: 39 });
    expect(t.nameBox.surface.background).toBe('#9b1c31');
    expect(t.choice.states.normal).toEqual({ background: '#050507', color: '#e8e8f0', borderColor: '#9b1c31', opacity: 0.92, image: null });
    expect(t.choice.states.hover.background).toBe('#9b1c31');
    expect(t.animation).toBe('slide');
  });

  it('repairs damaged or partial theme data instead of crashing the game', () => {
    const t = normalizeTheme({ version: 2, id: 'x', name: 'X', dialog: { width: 'huge', surface: { opacity: 'nope' }, anchor: 'nowhere' }, menuBar: { buttons: [{ action: 'explode' }, { action: 'save' }] } });
    expect(t.dialog.width).toEqual(getPresetTheme('modern')!.dialog.width);
    expect(t.dialog.surface.opacity).toBe(getPresetTheme('modern')!.dialog.surface.opacity);
    expect(t.dialog.anchor).toBe('bottom');
    expect(t.menuBar.buttons.map((b) => b.action)).toEqual(['save']);
    expect(normalizeTheme(null).id).toBe('modern');
  });

  it('projects from older versions are migrated on load and keep their theme', () => {
    const old = { ...createEmptyProject('Old'), themes: [V1_DARK], settings: { ...createEmptyProject('Old').settings, themeId: 'th_old', dialogueFontSize: 30, uiVersion: undefined } };
    const p = normalizeProject(JSON.parse(JSON.stringify(old)));
    expect(p.settings.uiVersion).toBe(2);
    expect(p.settings.dialogueFontSize).toBe(45);
    expect(p.themes[0].version).toBe(2);
    // Already migrated projects are not migrated twice.
    expect(normalizeProject(JSON.parse(JSON.stringify(p))).settings.dialogueFontSize).toBe(45);
  });

  it('WCAG contrast assumes the worst scene behind see-through boxes', () => {
    expect(textContrast('#ffffff', '#000000', 1)).toBeCloseTo(21, 0);
    expect(textContrast('#ffffff', '#000000', 0)).toBeCloseTo(1, 0);
    const bad = custom();
    bad.dialog.text.color = '#777777';
    bad.dialog.surface.background = '#666666';
    expect(checkReadability(bad).some((i) => i.element === 'dialog')).toBe(true);
    bad.dialog.text.shadow = true;
    expect(checkReadability(bad).some((i) => i.element === 'dialog')).toBe(false);
  });
});

describe('responsive layout', () => {
  it('scales design pixels with the screen (canvas rotates in portrait)', () => {
    expect(uiScale(1920, 1080)).toBe(1);
    expect(uiScale(3840, 2160)).toBe(2);
    expect(uiScale(1080, 1920)).toBe(1);
    expect(uiScale(390, 844)).toBeCloseTo(0.361, 2);
  });

  it('supports px, %, vw and vh', () => {
    const t = custom();
    const c = makeContext(t, 1000, 500, { top: 0, right: 100, bottom: 0, left: 100 });
    expect(lengthPx({ value: 100, unit: 'px' }, 'x', c)).toBeCloseTo(100 * c.s);
    expect(lengthPx({ value: 50, unit: '%' }, 'x', c)).toBe(400); // of the safe area
    expect(lengthPx({ value: 50, unit: 'vw' }, 'x', c)).toBe(500); // of the viewport
    expect(lengthPx({ value: 10, unit: 'vh' }, 'y', c)).toBe(50);
  });

  it('keeps boxes inside the safe area and shrinks them to fit', () => {
    expect(placeBox('bottom', 0, 24, 1600, 280, 1000, 600)).toEqual({ left: 0, top: 296, width: 1000, height: 280 });
    expect(placeBox('top-left', -500, -500, 100, 100, 800, 600)).toEqual({ left: 0, top: 0, width: 100, height: 100 });
    expect(placeBox('bottom-right', 5000, 0, 100, 100, 800, 600)).toEqual({ left: 0, top: 500, width: 100, height: 100 });
    expect(placeBox('center', 30, 0, 200, 100, 800, 600)).toEqual({ left: 330, top: 250, width: 200, height: 100 });
  });

  it('never makes text unreadably small and applies the player text size', () => {
    const t = custom();
    const phone = makeContext(t, 390, 844);
    expect(fontPx(38, phone)).toBe(14 * 1); // 38 × 0.36 < 14 → raised to the minimum
    expect(fontPx(38, { ...phone, textScale: 1.5 })).toBe(21);
    expect(fontPx(38, makeContext(t, 1920, 1080))).toBe(38);
  });

  it('places the dialogue box on every device without leaving the screen', () => {
    for (const preset of THEME_PRESETS) {
      for (const d of DEVICES) {
        const c = makeContext(preset, d.width, d.height, d.safe);
        const l = layoutDialog(preset, c);
        expect(l.left).toBeGreaterThanOrEqual(0);
        expect(l.left + l.width).toBeLessThanOrEqual(c.areaW + 0.01);
        const top = l.top ?? c.areaH - l.bottom! - l.minHeight;
        expect(top).toBeGreaterThanOrEqual(l.reserveTop - 0.01);
        expect(top + l.minHeight).toBeLessThanOrEqual(c.areaH + 0.01);
        expect(l.maxHeight).toBeGreaterThanOrEqual(l.minHeight - 0.01);
      }
    }
  });

  it('gives choices the free space next to the dialogue box', () => {
    const c = makeContext(custom(), 1920, 1080);
    const region = choiceRegion(c, { left: 0, top: 800, width: 1920, height: 280 }, 20);
    expect(region).toEqual({ left: 0, top: 0, width: 1920, height: 780 });
    const below = choiceRegion(c, { left: 0, top: 50, width: 1920, height: 200 }, 20);
    expect(below.top).toBe(270);
  });

  it('CSS variables come from the theme (nothing hard-coded)', () => {
    const t = custom();
    t.choice.states.hover.background = '#123456';
    t.dialog.surface.radius = 10;
    const v = themeVars(t, makeContext(t, 960, 540), (id) => `asset:${id}`);
    expect(v['--tvn-c-hover-bg']).toBe('rgba(18, 52, 86, 1)');
    expect(v['--tvn-d-radius']).toBe('5px');
    expect(v['--tvn-d-img']).toBe('none');
    t.dialog.surface.image = 'img1';
    expect(themeVars(t, makeContext(t, 960, 540), (id) => `asset:${id}`)['--tvn-d-img']).toBe('url("asset:img1")');
  });

  it('the layout check reports overflow, overlap and small screens', () => {
    const t = custom();
    t.dialog.height = { value: 900, unit: 'px' };
    t.menuBar.anchor = 'bottom';
    t.menuBar.y = { value: 60, unit: 'px' };
    const desktop = checkLayout(t, DEVICES[0]);
    expect(desktop.some((i) => i.element === 'dialog' && i.severity === 'warning')).toBe(true);
    expect(desktop.some((i) => i.element === 'menubar' && i.severity === 'warning')).toBe(true);
    const phone = checkLayout(custom(), DEVICES.find((d) => d.id === 'phone-portrait')!);
    expect(phone.some((i) => i.message.includes('shrunk to fit'))).toBe(true);
    expect(phone.some((i) => i.message.includes('easy to tap'))).toBe(true);
  });

  it('menu buttons marked "hide on mobile" are left out on phones', () => {
    const t = custom();
    const c = makeContext(t, 844, 390);
    const all = estimateRects(t, makeContext(t, 1920, 1080)).menubar!;
    const phone = estimateRects(t, c).menubar!;
    expect(phone.width / c.s).toBeLessThan(all.width);
  });
});

describe('visual editing helpers', () => {
  const c = makeContext(custom(), 960, 540); // s = 0.5

  it('moves elements by on-screen distance, respecting the anchor and unit', () => {
    const t = custom();
    moveElement(t, 'dialog', 50, -20, c);
    expect(t.dialog.x.value).toBe(100); // 50 css px = 100 design px
    expect(t.dialog.y.value).toBe(24 + 40); // bottom anchor: moving up increases the distance from the bottom
    t.menuBar.anchor = 'top-right';
    moveElement(t, 'button:mb-save', 10, 10, c);
    expect(t.menuBar.x.value).toBe(16 - 20);
    expect(t.menuBar.y.value).toBe(16 + 20);
    t.choice.x = { value: 0, unit: '%' };
    moveElement(t, 'choices', 48, 0, c);
    expect(t.choice.x.value).toBe(5);
    moveElement(t, 'name', 10, -5, c);
    expect([t.nameBox.x, t.nameBox.y]).toEqual([20, -10]);
  });

  it('resizes from an edge and keeps the opposite edge in place', () => {
    const t = custom();
    const before = layoutDialog(t, c);
    resizeElement(t, 'dialog', 'w', -40, 0, c); // drag left edge 40px to the left
    const after = layoutDialog(t, c);
    expect(after.width).toBeCloseTo(before.width + 40);
    expect(after.left + after.width).toBeCloseTo(before.left + before.width);
    const h0 = layoutDialog(t, c);
    resizeElement(t, 'dialog', 'n', 0, -30, c); // top edge up, bottom stays (bottom anchor)
    const h1 = layoutDialog(t, c);
    expect(h1.minHeight).toBeCloseTo(h0.minHeight + 30);
    expect(h1.bottom).toBeCloseTo(h0.bottom!);
    resizeElement(t, 'dialog', 'e', -10000, 0, c);
    expect(t.dialog.width.value).toBeGreaterThanOrEqual(80);
  });

  it('aligns to screen edges', () => {
    const t = custom();
    t.dialog.x = { value: 300, unit: 'px' };
    alignElement(t, 'dialog', 'left');
    expect(t.dialog.anchor).toBe('bottom-left');
    expect(t.dialog.x.value).toBe(0);
    alignElement(t, 'dialog', 'top');
    expect(t.dialog.anchor).toBe('top-left');
    alignElement(t, 'dialog', 'vcenter');
    expect(t.dialog.anchor).toBe('left');
    alignElement(t, 'name', 'right');
    expect(t.nameBox.align).toBe('right');
  });

  it('duplicates, reorders and deletes menu buttons', () => {
    const t = custom();
    const id = duplicateMenuButton(t, 'mb-save')!;
    expect(t.menuBar.buttons.map((b) => b.action)).toEqual(['auto', 'save', 'save', 'load', 'hide', 'menu']);
    moveMenuButton(t, id, 1);
    expect(t.menuBar.buttons[3].id).toBe(id);
    expect(deleteMenuButton(t, id)).toBe(true);
    expect(t.menuBar.buttons.length).toBe(5);
  });
});

describe('project theme and scene overrides', () => {
  it('builds game data with scene themes, theme images and fonts', () => {
    const p = createEmptyProject('T');
    const horror = clone(getPresetTheme('horror')!);
    const mine: Theme = { ...custom('th_mine'), fontFace: { family: 'My Font', file: 'fonts/my.ttf' } };
    mine.dialog.surface.image = 'img_frame';
    p.assets.push({ id: 'img_frame', path: 'assets/UI/frame.png', name: 'frame.png', ext: 'png', kind: 'image', type: 'ui', size: 1, hash: 'h', tags: [], hasThumb: false, rev: 0, importedAt: 0 });
    p.themes.push(mine);
    p.settings.themeId = 'dark';
    const s2 = { id: 's2', name: 'Scene 05', tags: [], actions: [createAction('narration', { text: 'boo' })], themeId: 'horror' };
    const s3 = { id: 's3', name: 'Scene 06', tags: [], actions: [createAction('narration', { text: 'mine' })], themeId: 'th_mine' };
    p.scenes.push(s2, s3);
    p.chapters[0].sceneIds.push('s2', 's3');
    const g = buildGameData(p);
    expect(g.theme.id).toBe('dark');
    expect(g.scenes.find((s) => s.id === 's2')!.themeId).toBe('horror');
    expect(g.themes!.horror.dialog.surface.background).toBe(horror.dialog.surface.background);
    expect(g.scenes[0].themeId).toBeUndefined();
    expect(g.assets.img_frame).toBeDefined();
    expect(g.fonts).toEqual([{ family: 'My Font', path: 'fonts/my.ttf' }]);
    // Missing theme font file blocks export; a missing scene theme is a warning.
    expect(validateProject(p, (rel) => rel !== 'fonts/my.ttf').some((i) => i.message.includes('fonts/my.ttf'))).toBe(true);
    p.scenes[1].themeId = 'gone';
    expect(validateProject(p).some((i) => i.severity === 'warning' && i.sceneId === 's2')).toBe(true);
    expect(buildGameData(p).scenes.find((s) => s.id === 's2')!.themeId).toBeUndefined();
  });

  it('theme images take part in asset usage, replace and remove', () => {
    const p = createEmptyProject('T');
    const mine = custom();
    mine.choice.surface.image = 'a1';
    p.themes.push(mine);
    p.settings.themeId = mine.id;
    expect(collectUsedAssetIds(p).has('a1')).toBe(true);
    expect(findAssetUsages(p, 'a1').map((u) => u.where)).toEqual(['theme']);
    replaceAssetReferences(p, 'a1', 'a2');
    expect(themeAssetIds(p.themes[0])).toEqual(['a2']);
    removeAssetReferences(p, 'a2');
    expect(themeAssetIds(p.themes[0])).toEqual([]);
  });

  it('the runtime switches theme when a scene with its own theme starts', async () => {
    const p = createEmptyProject('T');
    p.scenes[0].actions = [createAction('narration', { text: 'one' }), createAction('jumpScene', { sceneId: 's2' })];
    p.scenes.push({ id: 's2', name: 'Scene 05', tags: [], actions: [createAction('narration', { text: 'two' })], themeId: 'horror' });
    p.chapters[0].sceneIds.push('s2');
    const game = buildGameData(p);
    const { scriptedHost } = await import('./helpers');
    const { host, done } = scriptedHost();
    const seen: string[] = [];
    host.sceneChanged = (id) => seen.push(id);
    const { Engine } = await import('../src/runtime/core/engine');
    await new Engine(game, host).start();
    await done;
    expect(seen).toEqual([p.scenes[0].id, 's2']);
  });

  it('choice options can be shown disabled when their condition fails', async () => {
    const p = createEmptyProject('T');
    p.variables.push({ id: 'v', name: 'Key', type: 'boolean', initial: false });
    p.scenes[0].actions = [
      createAction('choice', {
        question: 'Door',
        options: [
          { id: 'a', text: 'Open with key', target: { kind: 'next' }, condition: { variableId: 'v', op: '==', value: true }, showLocked: true },
          { id: 'b', text: 'Hidden', target: { kind: 'next' }, condition: { variableId: 'v', op: '==', value: true } },
          { id: 'c', text: 'Leave', target: { kind: 'next' }, condition: null },
        ],
      }),
      createAction('endGame', { message: 'end' }),
    ];
    const { rec } = await playThrough(buildGameData(p), [0]);
    const c = rec.calls.find((x) => x.method === 'choice')!.arg as { options: { text: string; disabled?: boolean }[] };
    expect(c.options).toEqual([{ text: 'Open with key', disabled: true }, { text: 'Leave' }]);
    expect(rec.ended).toBe('end'); // picking a disabled option falls back to an enabled one
  });
});

describe('.tsttheme files', () => {
  let root: string;
  beforeAll(async () => {
    root = await tempDir('tstvn-theme-');
  });

  it('exports a theme with its images and fonts and imports it into another project', async () => {
    const src = await createProject(path.join(root, 'a'), 'Source', 'blank');
    const imgDir = path.join(root, 'in', 'Frames');
    await fs.mkdir(imgDir, { recursive: true });
    await fs.writeFile(path.join(imgDir, 'frame.png'), pngBuffer(32, 16, (x) => [x * 8, 40, 90, 255]));
    const plan = await scanImport(src.dir, [imgDir], []);
    const imported = await executeImport(src.dir, plan, {}, [], testThumbnailer);
    const frame = imported.added[0];
    const theme = custom('th_share');
    theme.name = 'Shared Look';
    theme.dialog.surface.image = frame.id;
    theme.nameBox.surface.image = frame.id;
    const arial = path.join(process.env.WINDIR ?? 'C:\\Windows', 'Fonts', 'arial.ttf');
    if (existsSync(arial)) {
      await fs.mkdir(path.join(src.dir, 'fonts'), { recursive: true });
      await fs.writeFile(path.join(src.dir, 'fonts', 'share.ttf'), renameFontFamily(await fs.readFile(arial), 'TSTVN Share Font'));
      theme.dialog.text.font = { family: 'TSTVN Share Font', file: 'fonts/share.ttf' };
    }
    const file = path.join(root, 'Shared Look.tsttheme');
    const r = await exportThemeFile(src.dir, theme, imported.added, file);
    expect(r.files).toBe(existsSync(arial) ? 3 : 2);

    const dst = await createProject(path.join(root, 'b'), 'Target', 'blank');
    const got = await importThemeFile(dst.dir, file, [], testThumbnailer);
    expect(got.theme.name).toBe('Shared Look');
    expect(got.theme.id).not.toBe('th_share');
    expect(got.added).toHaveLength(1);
    expect(got.added[0].path).toBe('assets/UI/Themes/Shared Look/frame.png');
    expect(got.theme.dialog.surface.image).toBe(got.added[0].id);
    expect(got.theme.nameBox.surface.image).toBe(got.added[0].id);
    expect(existsSync(path.join(dst.dir, got.added[0].path))).toBe(true);
    if (existsSync(arial)) {
      expect(got.theme.dialog.text.font).toEqual({ family: 'TSTVN Share Font', file: 'fonts/share.ttf' });
      expect(existsSync(path.join(dst.dir, 'fonts', 'share.ttf'))).toBe(true);
    }
    // The imported theme works end-to-end in the target project.
    const p = { ...dst.project, assets: got.added, themes: [got.theme], settings: { ...dst.project.settings, themeId: got.theme.id } };
    expect(validateProject(p, (rel) => existsSync(path.join(dst.dir, rel))).filter((i) => i.severity === 'error')).toEqual([]);

    // Importing again reuses the identical image instead of copying it twice.
    const again = await importThemeFile(dst.dir, file, got.added, testThumbnailer);
    expect(again.added).toEqual([]);
    expect(again.theme.dialog.surface.image).toBe(got.added[0].id);
  });

  it('rejects files that are not themes', async () => {
    const dst = await createProject(path.join(root, 'c'), 'Other', 'blank');
    const bad = path.join(root, 'bad.tsttheme');
    await fs.writeFile(bad, 'not a zip');
    await expect(importThemeFile(dst.dir, bad, [], testThumbnailer)).rejects.toThrow(/not a TSTVN theme/);
  });
});
