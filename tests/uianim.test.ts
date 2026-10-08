// Game UI animation presets: sensible defaults, keyframes (direction, exits, scaling), migration of the
// older single "dialogue box animation" setting, repair of damaged values.
import { describe, expect, it } from 'vitest';
import { ENTRANCE_PRESETS, EXIT_PRESETS, animFrames, animPreset, animationsFromLegacy, easingCss, legacyAnimation, normalizeAnimations, presetValue } from '../src/shared/uianim';
import { THEME_PRESETS, getPresetTheme, normalizeTheme } from '../src/shared/themes';

describe('animation presets', () => {
  it('offer the requested presets with sensible values', () => {
    const values = ENTRANCE_PRESETS.map((p) => p.value);
    for (const v of ['none', 'fade', 'slide-up', 'slide-down', 'pop', 'scale', 'bounce', 'shake', 'pulse']) expect(values).toContain(v);
    for (const v of ['fade', 'slide-down', 'scale']) expect(EXIT_PRESETS.map((p) => p.value)).toContain(v);
    for (const p of ENTRANCE_PRESETS.filter((x) => x.kind !== 'none')) {
      const s = animPreset(p.value);
      expect(s.duration, p.value).toBeGreaterThan(0.1);
      expect(s.duration, p.value).toBeLessThan(1);
      expect(presetValue(s), p.value).toBe(p.value);
    }
    expect(animPreset('pop').easing).toBe('back');
    expect(easingCss('back')).toMatch(/^cubic-bezier/);
  });

  it('builds keyframes: slide up enters from below, slide down exits downwards, distances scale', () => {
    const up = animFrames(animPreset('slide-up'), 'in', 1)!;
    expect(up[0]).toMatchObject({ transform: 'translateY(40px)', opacity: 0 });
    expect(up.at(-1)).toMatchObject({ transform: 'none', opacity: 1 });
    const out = animFrames(animPreset('slide-down', EXIT_PRESETS), 'out', 1)!;
    expect(out[0]).toMatchObject({ transform: 'none', opacity: 1 });
    expect(out.at(-1)).toMatchObject({ transform: 'translateY(40px)', opacity: 0 });
    expect(animFrames(animPreset('slide-up'), 'in', 0.5)![0].transform).toBe('translateY(20px)');
    expect(animFrames(animPreset('slide-left'), 'in', 1)![0].transform).toBe('translateX(40px)'); // comes from the right
    expect(animFrames(animPreset('pop'), 'in')![0].transform).toBe('scale(0.6)');
    expect(animFrames(animPreset('none'), 'in')).toBeNull();
    expect(animFrames({ ...animPreset('fade'), duration: 0 }, 'in')).toBeNull();
    // Offsets of an exit are mirrored so the keyframes stay in order.
    const popOut = animFrames(animPreset('pop'), 'out')!;
    expect(popOut.map((f) => f.offset).filter((o) => o !== undefined)).toEqual([expect.closeTo(0.3, 5)]);
  });

  it('keeps the older setting working: fade / slide / none, and every theme preset keeps its look', () => {
    expect(animationsFromLegacy('fade').dialogIn.kind).toBe('fade');
    expect(animationsFromLegacy('slide').dialogIn).toMatchObject({ kind: 'slide', direction: 'up', distance: 30, duration: 0.25 });
    expect(animationsFromLegacy('none').dialogIn.kind).toBe('none');
    for (const p of THEME_PRESETS) expect(legacyAnimation(p.anim.dialogIn), p.id).toBe(p.animation);
    // An old theme file without the new field.
    const old = JSON.parse(JSON.stringify(getPresetTheme('classic')!));
    delete old.anim;
    expect(normalizeTheme(old).anim.dialogIn.kind).toBe('slide');
    // Existing default behaviour: choices just appear, typewriter text, bouncing mark.
    const a = normalizeTheme(old).anim;
    expect([a.choicesIn.kind, a.text, a.indicator, a.dialogOut.kind]).toEqual(['none', 'typewriter', 'bounce', 'none']);
  });

  it('repairs damaged values', () => {
    const a = normalizeAnimations({ dialogIn: { kind: 'explode', duration: 99, easing: 'wobbly' }, text: 'letters', choiceStagger: -1, indicator: 'spin' }, 'fade');
    expect(a.dialogIn.kind).toBe('fade');
    expect(a.dialogIn.duration).toBe(5);
    expect(a.dialogIn.easing).toBe('ease');
    expect(a.text).toBe('typewriter');
    expect(a.choiceStagger).toBe(0);
    expect(a.indicator).toBe('bounce');
    expect(normalizeAnimations({ choicesIn: { kind: 'pop' } }, 'fade').choicesIn).toMatchObject({ kind: 'pop', scale: 0.6, easing: 'back' });
  });
});
