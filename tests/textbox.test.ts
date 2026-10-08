// Textbox style presets: really different shapes, applying keeps the rest of the theme, old themes still load.
import { describe, expect, it } from 'vitest';
import { TEXTBOX_PRESETS, applyTextboxPreset, textboxParts } from '../src/shared/textbox';
import { DIALOG_FRAMES, NAME_SHAPES, THEME_PRESETS, getPresetTheme, normalizeTheme } from '../src/shared/themes';

describe('textbox presets', () => {
  it('has the requested looks, and they differ in shape, not only in colour', () => {
    expect(TEXTBOX_PRESETS.map((p) => p.id)).toEqual(['classic', 'modern', 'bubble', 'minimal', 'fantasy', 'scifi', 'horror', 'rpg', 'retro']);
    const shapes = TEXTBOX_PRESETS.map((p) => {
      const { dialog, nameBox } = textboxParts(p);
      return `${dialog.frame}/${nameBox.shape}/${nameBox.attach}`;
    });
    expect(new Set(shapes).size).toBe(TEXTBOX_PRESETS.length);
    // Every dialogue box frame except the plain box is used by some preset.
    const frames = new Set(TEXTBOX_PRESETS.map((p) => textboxParts(p).dialog.frame));
    for (const f of DIALOG_FRAMES) expect(frames.has(f)).toBe(true);
    for (const p of TEXTBOX_PRESETS) {
      const { dialog, nameBox } = textboxParts(p);
      expect(DIALOG_FRAMES).toContain(dialog.frame);
      expect(NAME_SHAPES).toContain(nameBox.shape);
      expect(dialog.preset).toBe(p.id);
    }
  });

  it('applies to the dialogue and name box only, keeping the text speed and the rest of the theme', () => {
    const t = getPresetTheme('classic')!;
    t.dialog.textSpeed = 77;
    const choice = JSON.stringify(t.choice);
    const menu = JSON.stringify([t.menuBar, t.menu, t.font]);
    expect(applyTextboxPreset(t, 'bubble')).toBe(true);
    expect(t.dialog.frame).toBe('bubble');
    expect(t.dialog.preset).toBe('bubble');
    expect(t.dialog.textSpeed).toBe(77);
    expect(t.nameBox.shape).toBe('plain');
    expect(JSON.stringify(t.choice)).toBe(choice);
    expect(JSON.stringify([t.menuBar, t.menu, t.font])).toBe(menu);
    expect(applyTextboxPreset(t, 'no-such-preset')).toBe(false);
    expect(t.dialog.frame).toBe('bubble');
  });

  it('returns independent copies (applying twice never shares objects)', () => {
    const a = getPresetTheme('modern')!;
    const b = getPresetTheme('modern')!;
    applyTextboxPreset(a, 'fantasy');
    applyTextboxPreset(b, 'fantasy');
    a.dialog.surface.background = '#123456';
    expect(b.dialog.surface.background).not.toBe('#123456');
    expect(textboxParts(TEXTBOX_PRESETS[4]).dialog.surface.background).not.toBe('#123456');
  });

  it('older themes (no shape fields) load with the plain box; damaged values are repaired', () => {
    const old = JSON.parse(JSON.stringify(getPresetTheme('rpg')!));
    delete old.dialog.frame;
    delete old.dialog.preset;
    delete old.nameBox.shape;
    const t = normalizeTheme(old);
    expect(t.dialog.frame).toBe('box');
    expect(t.dialog.preset).toBeNull();
    expect(t.nameBox.shape).toBe('box');
    const bad = normalizeTheme({ ...old, dialog: { ...old.dialog, frame: 'star' }, nameBox: { ...old.nameBox, shape: 42 } });
    expect(bad.dialog.frame).toBe('box');
    expect(bad.nameBox.shape).toBe('box');
    // Existing theme presets look exactly as before (plain box).
    for (const p of THEME_PRESETS) expect([p.dialog.frame, p.nameBox.shape]).toEqual(['box', 'box']);
  });
});
