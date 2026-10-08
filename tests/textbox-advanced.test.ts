// Advanced textbox settings: glow, gradient, texture, frame image (9-slice), text outline and shadow colour —
// how they reach the runtime's CSS variables, asset bookkeeping, and old themes.
import { describe, expect, it } from 'vitest';
import { getPresetTheme, mapThemeImages, normalizeTheme, themeAssetIds } from '../src/shared/themes';
import { makeContext, themeVars } from '../src/shared/uilayout';
import { createEmptyProject } from '../src/shared/project';
import { removeAssetReferences, replaceAssetReferences } from '../src/shared/validate';

const ctx = (t = getPresetTheme('modern')!) => makeContext(t, 1920, 1080);
const img = (id: string) => `assets/${id}.png`;

describe('advanced textbox settings', () => {
  it('are off by default, so existing themes look the same', () => {
    const t = getPresetTheme('modern')!;
    const v = themeVars(t, ctx(t), img);
    expect(v['--tvn-d-grad']).toBe('none');
    expect(v['--tvn-d-tex']).toBe('none');
    expect(v['--tvn-d-fimg']).toBe('none');
    expect(v['--tvn-d-fw']).toBe('0px');
    expect(v['--tvn-d-stroke']).toBe('0 transparent');
    expect(v['--tvn-d-shadow'].split('), ').length).toBe(1); // only the box shadow, no glow
  });

  it('turn into CSS for the runtime', () => {
    const t = getPresetTheme('modern')!;
    const s = t.dialog.surface;
    s.glow = { size: 20, color: '#ff0000', opacity: 0.5 };
    s.gradient = { enabled: true, color: '#00ff00', angle: 90 };
    s.texture = 'paper';
    s.frameImage = 'frame';
    s.frameSlice = 25;
    s.frameWidth = 40;
    t.dialog.text.outline = 2;
    t.dialog.text.outlineColor = '#123456';
    t.dialog.text.shadow = true;
    t.dialog.text.shadowColor = '#0000ff';
    const v = themeVars(t, ctx(t), img);
    expect(v['--tvn-d-shadow']).toContain('rgba(255, 0, 0, 0.5)');
    expect(v['--tvn-d-grad']).toMatch(/^linear-gradient\(90deg, rgba\(16, 20, 32, [\d.]+\), rgba\(0, 255, 0, [\d.]+\)\)$/);
    expect(v['--tvn-d-tex']).toBe('url("assets/paper.png")');
    expect(v['--tvn-d-fimg']).toBe('url("assets/frame.png")');
    expect(v['--tvn-d-fslice']).toBe('25%');
    expect(v['--tvn-d-fw']).toBe('40px');
    expect(v['--tvn-d-stroke']).toBe('2px #123456');
    expect(v['--tvn-d-tshadow']).toContain('rgba(0, 0, 255, 0.9)');
    // Scaled with the screen like every other size.
    const small = themeVars(t, makeContext(t, 960, 540), img);
    expect(small['--tvn-d-fw']).toBe('20px');
    // A missing frame image draws no frame.
    expect(themeVars(t, ctx(t), () => null)['--tvn-d-fw']).toBe('0px');
  });

  it('count textures and frame images as used assets; replacing or deleting an asset updates them', () => {
    const p = createEmptyProject('Assets');
    const t = { ...getPresetTheme('modern')!, id: 'mine', name: 'Mine' };
    t.dialog.surface.texture = 'a1';
    t.nameBox.surface.frameImage = 'a2';
    t.choice.surface.image = 'a3';
    p.themes.push(t);
    expect(themeAssetIds(t).sort()).toEqual(['a1', 'a2', 'a3']);
    expect(replaceAssetReferences(p, 'a1', 'b1')).toBeGreaterThan(0);
    expect(p.themes[0].dialog.surface.texture).toBe('b1');
    expect(removeAssetReferences(p, 'a2')).toBeGreaterThan(0);
    expect(p.themes[0].nameBox.surface.frameImage).toBeNull();
    mapThemeImages(p.themes[0], () => null);
    expect(themeAssetIds(p.themes[0])).toEqual([]);
  });

  it('older themes get the new settings switched off; damaged values fall back', () => {
    const old = JSON.parse(JSON.stringify(getPresetTheme('classic')!));
    for (const s of [old.dialog.surface, old.nameBox.surface]) {
      delete s.glow;
      delete s.gradient;
      delete s.texture;
      delete s.frameImage;
    }
    delete old.dialog.text.outline;
    const t = normalizeTheme(old);
    expect(t.dialog.surface.glow.size).toBe(0);
    expect(t.dialog.surface.gradient.enabled).toBe(false);
    expect(t.dialog.surface.texture).toBeNull();
    expect(t.nameBox.surface.frameImage).toBeNull();
    expect(t.dialog.text.outline).toBe(0);
    const bad = normalizeTheme({ ...old, dialog: { ...old.dialog, surface: { ...old.dialog.surface, glow: 'big', frameSlice: 'x' } } });
    expect(bad.dialog.surface.glow.size).toBe(0);
    expect(bad.dialog.surface.frameSlice).toBe(30);
  });
});
