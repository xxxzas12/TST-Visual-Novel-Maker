// Choice styles (presets, shapes, icon, button pictures per state) and choice behaviour
// ("when chosen": set/add a variable, play a sound, animate a character, screen effect).
import { describe, expect, it } from 'vitest';
import { createAction } from '../src/shared/actions';
import { createEmptyProject } from '../src/shared/project';
import { buildGameData } from '../src/shared/gamedata';
import { CHOICE_PRESETS, applyChoicePreset, choiceParts } from '../src/shared/choicestyle';
import { CHOICE_SHAPES, THEME_PRESETS, getPresetTheme, mapThemeImages, normalizeTheme, themeAssetIds } from '../src/shared/themes';
import { makeContext, themeVars } from '../src/shared/uilayout';
import { collectUsedAssetIds, removeAssetReferences, validateProject } from '../src/shared/validate';
import { playThrough } from './helpers';
import type { Asset, ChoiceEffect } from '../src/shared/types';

describe('choice styles', () => {
  it('has the requested presets, each with its own look', () => {
    expect(CHOICE_PRESETS.map((p) => p.id)).toEqual(['classic', 'modern', 'minimal', 'rpg', 'fantasy', 'bubble', 'image']);
    const looks = CHOICE_PRESETS.map((p) => {
      const c = choiceParts(p);
      return JSON.stringify([c.shape, c.icon, c.states.normal.background, c.anchor]);
    });
    expect(new Set(looks).size).toBe(CHOICE_PRESETS.length);
    for (const p of CHOICE_PRESETS) expect(CHOICE_SHAPES).toContain(choiceParts(p).shape);
  });

  it('applies to the choice buttons only; Image Button keeps pictures already chosen', () => {
    const t = getPresetTheme('classic')!;
    const dialog = JSON.stringify([t.dialog, t.nameBox, t.menuBar]);
    t.choice.states.hover.image = 'pic-hover';
    expect(applyChoicePreset(t, 'fantasy')).toBe(true);
    expect(t.choice.shape).toBe('banner');
    expect(t.choice.icon).toBe('✦');
    expect(t.choice.preset).toBe('fantasy');
    expect(t.choice.states.hover.image).toBeNull();
    expect(JSON.stringify([t.dialog, t.nameBox, t.menuBar])).toBe(dialog);
    t.choice.states.hover.image = 'pic-hover';
    applyChoicePreset(t, 'image');
    expect(t.choice.states.hover.image).toBe('pic-hover');
    expect(applyChoicePreset(t, 'nope')).toBe(false);
  });

  it('turns into CSS: per-state pictures and the icon', () => {
    const t = getPresetTheme('modern')!;
    applyChoicePreset(t, 'rpg');
    t.choice.states.normal.image = 'n';
    const v = themeVars(t, makeContext(t, 1920, 1080), (id) => `a/${id}.png`);
    expect(v['--tvn-c-normal-img']).toBe('url("a/n.png")');
    expect(v['--tvn-c-hover-img']).toBe('none');
    expect(v['--tvn-c-icon']).toBe('"▶"');
    t.choice.icon = '';
    expect(themeVars(t, makeContext(t, 1920, 1080))['--tvn-c-icon']).toBe('none');
  });

  it('button pictures are used assets and are cleared when the asset is deleted', () => {
    const p = createEmptyProject('C');
    const t = { ...getPresetTheme('modern')!, id: 'mine', name: 'Mine' };
    t.choice.states.pressed.image = 'btn';
    p.themes.push(t);
    p.settings.themeId = 'mine';
    expect(themeAssetIds(t)).toContain('btn');
    expect(collectUsedAssetIds(p).has('btn')).toBe(true);
    expect(removeAssetReferences(p, 'btn')).toBeGreaterThan(0);
    expect(p.themes[0].choice.states.pressed.image).toBeNull();
    mapThemeImages(p.themes[0], (id) => id); // no-op never throws
  });

  it('older themes load with plain boxes and no icon; theme presets are unchanged', () => {
    const old = JSON.parse(JSON.stringify(getPresetTheme('rpg')!));
    delete old.choice.shape;
    delete old.choice.icon;
    delete old.choice.preset;
    for (const s of Object.values(old.choice.states) as Record<string, unknown>[]) delete s.image;
    const t = normalizeTheme(old);
    expect([t.choice.shape, t.choice.icon, t.choice.preset, t.choice.states.normal.image]).toEqual(['box', '', null, null]);
    expect(normalizeTheme({ ...old, choice: { ...old.choice, shape: 'star', icon: 'abcdefgh' } }).choice).toMatchObject({ shape: 'box', icon: 'abcd' });
    for (const p of THEME_PRESETS) expect([p.choice.shape, p.choice.icon]).toEqual(['box', '']);
  });
});

describe('choice behaviour (when chosen)', () => {
  function game(effects: ChoiceEffect[]) {
    const p = createEmptyProject('E');
    p.variables = [
      { id: 'love', name: 'Love', type: 'number', initial: 5 },
      { id: 'key', name: 'HasKey', type: 'boolean', initial: false },
    ];
    p.characters = [{ id: 'mia', name: 'Mia', displayName: 'Mia', color: '#fff', expressions: [] }];
    p.assets = [{ id: 'ding', path: 'assets/ding.wav', name: 'ding.wav', ext: 'wav', kind: 'audio', type: 'sfx', size: 1, hash: 'h', tags: [], hasThumb: false, rev: 0, importedAt: 0 } as Asset];
    p.scenes[0].actions = [
      createAction('choice', {
        question: 'Take the key?',
        options: [
          { id: 'a', text: 'Take it', target: { kind: 'next' }, effects },
          { id: 'b', text: 'Leave it', target: { kind: 'next' } },
        ],
      }),
      createAction('narration', { text: 'Love {Love}, key {HasKey}' }),
    ];
    return p;
  }

  it('sets and adds variables, plays the sound, animates and shakes — in order, before going on', async () => {
    const p = game([
      { kind: 'setVariable', variableId: 'key', value: true },
      { kind: 'addVariable', variableId: 'love', amount: 10 },
      { kind: 'addVariable', variableId: 'love', amount: -3 },
      { kind: 'playSound', assetId: 'ding' },
      { kind: 'animateCharacter', characterId: 'mia', animation: 'jump' },
      { kind: 'screenEffect', effect: 'flash' },
    ]);
    expect(validateProject(p).filter((i) => i.severity === 'error')).toEqual([]);
    const { rec } = await playThrough(buildGameData(p), [0]);
    expect(rec.errors).toEqual([]);
    expect(rec.dialogues).toContain('Love 12, key true');
    const after = rec.calls.slice(rec.calls.findIndex((c) => c.method === 'choice'));
    const order = after.map((c) => c.method).filter((m) => ['audio', 'animate', 'screenEffect', 'dialogue'].includes(m));
    expect(order).toEqual(['audio', 'animate', 'screenEffect', 'dialogue']);
    expect((after.find((c) => c.method === 'audio')!.arg as { assetId: string }).assetId).toBe('ding');
    expect((after.find((c) => c.method === 'animate')!.arg as { target: string; animation: string })).toMatchObject({ target: 'char:mia', animation: 'jump' });
    // The sound is shipped with the exported game.
    expect(collectUsedAssetIds(p).has('ding')).toBe(true);
  });

  it('the other option does nothing extra', async () => {
    const { rec } = await playThrough(buildGameData(game([{ kind: 'setVariable', variableId: 'key', value: true }])), [1]);
    expect(rec.dialogues).toContain('Love 5, key false');
  });

  it('validation catches broken "when chosen" settings', () => {
    const msgs = (effects: ChoiceEffect[]) => validateProject(game(effects)).map((i) => i.message);
    expect(msgs([{ kind: 'setVariable', variableId: 'gone', value: 1 }]).join()).toContain('the variable to change is missing');
    expect(msgs([{ kind: 'addVariable', variableId: 'key', amount: 1 }]).join()).toContain('only Number variables can be added to');
    expect(msgs([{ kind: 'setVariable', variableId: 'key', value: 'yes' }]).join()).toContain('is a True / False variable but would be set to');
    expect(msgs([{ kind: 'playSound', assetId: 'missing' }]).join()).toContain('the sound file is missing');
    expect(msgs([{ kind: 'animateCharacter', characterId: '', animation: 'jump' }]).join()).toContain('choose a character to animate');
  });
});
