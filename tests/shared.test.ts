import { describe, expect, it } from 'vitest';
import { classifyAsset, mediaKindOf, extOf } from '../src/shared/classify';
import { detectCharacters, mergeDetectedCharacters } from '../src/shared/characters';
import { ACTION_DEFS, cloneActions, createAction, searchActions, actionsInCategory, CATEGORIES } from '../src/shared/actions';
import { BUILTIN_TEMPLATES, createProjectFromTemplate, normalizeProject, createEmptyProject } from '../src/shared/project';
import { THEME_PRESETS, resolveTheme, withAlpha } from '../src/shared/themes';
import { makeContext, themeVars } from '../src/shared/uilayout';
import { validateProject, findAssetUsages, replaceAssetReferences, removeAssetReferences, collectUsedAssetIds } from '../src/shared/validate';
import { buildGameData } from '../src/shared/gamedata';
import { deriveFlowEdges } from '../src/shared/flow';
import { searchScenes, filterAssets } from '../src/shared/search';
import type { Asset } from '../src/shared/types';

function asset(id: string, path: string, type: Asset['type'], kind: Asset['kind'] = 'image'): Asset {
  return { id, path, name: path.split('/').pop()!, ext: extOf(path), kind, type, size: 10, hash: id, tags: [], hasThumb: false, rev: 0, importedAt: 0 };
}

describe('asset classification', () => {
  it('detects media kind from extension', () => {
    expect(mediaKindOf('PNG')).toBe('image');
    expect(mediaKindOf('ogg')).toBe('audio');
    expect(mediaKindOf('webm')).toBe('video');
    expect(mediaKindOf('txt')).toBeNull();
  });
  it('uses folder names first', () => {
    expect(classifyAsset('Assets/Backgrounds/school.png', 'image').type).toBe('background');
    expect(classifyAsset('Characters/Alice/happy.png', 'image').type).toBe('character');
    expect(classifyAsset('CG/kiss.jpg', 'image').type).toBe('cg');
    expect(classifyAsset('Music/title.ogg', 'audio').type).toBe('music');
    expect(classifyAsset('SFX/door.wav', 'audio').type).toBe('sfx');
    expect(classifyAsset('Voice/a01.ogg', 'audio').type).toBe('voice');
    expect(classifyAsset('UI/button.png', 'image').type).toBe('ui');
  });
  it('falls back to file name and dimensions', () => {
    expect(classifyAsset('stuff/bg_room.png', 'image').type).toBe('background');
    expect(classifyAsset('stuff/bgm-battle.mp3', 'audio').type).toBe('music');
    expect(classifyAsset('stuff/pic.png', 'image', { width: 1920, height: 1080 }).type).toBe('background');
    const unknown = classifyAsset('stuff/pic.png', 'image', { width: 64, height: 64 });
    expect(unknown.type).toBe('unknown');
  });
});

describe('character folder detection', () => {
  it('creates characters with expressions from folders', () => {
    const assets = [
      asset('a1', 'assets/Characters/Alice/normal.png', 'character'),
      asset('a2', 'assets/Characters/Alice/happy.png', 'character'),
      asset('a3', 'assets/Characters/Alice/sad.png', 'character'),
      asset('b1', 'assets/Characters/Bob/angry.png', 'character'),
      asset('c1', 'assets/Characters/carol_smile.png', 'character'),
      asset('x', 'assets/Backgrounds/room.png', 'background'),
    ];
    const found = detectCharacters(assets);
    expect(found.map((c) => c.name)).toEqual(['Alice', 'Bob', 'Carol']);
    expect(found[0].expressions.map((e) => e.name)).toEqual(['Normal', 'Happy', 'Sad']);
    expect(found[2].expressions[0].name).toBe('Smile');
    const merged = mergeDetectedCharacters([], found);
    expect(merged.createdCharacters).toBe(3);
    expect(merged.addedExpressions).toBe(5);
    expect(merged.characters[0].defaultExpressionId).toBe(merged.characters[0].expressions[0].id);
    // Re-importing merges instead of duplicating
    const again = mergeDetectedCharacters(merged.characters, found);
    expect(again.createdCharacters).toBe(0);
    expect(again.addedExpressions).toBe(0);
  });
});

describe('action catalogue', () => {
  it('every action has defaults, fields and a summary', () => {
    const ctx = { assetName: () => 'a', characterName: () => 'c', expressionName: () => 'e', sceneName: () => 's', variableName: () => 'v' };
    for (const d of ACTION_DEFS) {
      const a = createAction(d.type);
      expect(typeof d.summary(a.params, ctx)).toBe('string');
      for (const f of d.fields) expect(f.key in a.params || ['customAnimation'].includes(f.kind)).toBe(true);
    }
  });
  it('covers every category and the required actions', () => {
    for (const c of CATEGORIES) expect(actionsInCategory(c.id).length).toBeGreaterThan(0);
    const types = ACTION_DEFS.map((d) => d.type);
    for (const t of ['dialogue', 'narration', 'choice', 'jumpScene', 'endGame', 'changeBackground', 'showCG', 'hideCG', 'showImage', 'hideImage', 'addCharacter', 'removeCharacter', 'moveCharacter', 'changeExpression', 'playBGM', 'stopBGM', 'changeBGM', 'playSFX', 'stopSFX', 'playVoice', 'wait', 'delay', 'label', 'jump', 'conditional', 'setVariable', 'addVariable', 'subtractVariable', 'checkVariable', 'saveGame', 'loadGame', 'changeScene', 'returnToTitle']) {
      expect(types).toContain(t);
    }
  });
  it('search finds Change Background for "background"', () => {
    expect(searchActions('background')[0].type).toBe('changeBackground');
    expect(searchActions('music').some((d) => d.type === 'playBGM')).toBe(true);
    expect(searchActions('zzzz')).toEqual([]);
  });
  it('clone gives fresh ids including choice options', () => {
    const c = createAction('choice');
    const [copy] = cloneActions([c]);
    expect(copy.id).not.toBe(c.id);
    expect(copy.params.options[0].id).not.toBe(c.params.options[0].id);
  });
});

describe('project templates and normalization', () => {
  it('every built-in template is valid and playable data', () => {
    for (const t of BUILTIN_TEMPLATES) {
      const p = createProjectFromTemplate(`T ${t.name}`, t.id);
      const errors = validateProject(p).filter((i) => i.severity === 'error');
      expect(errors, `${t.id}: ${JSON.stringify(errors)}`).toEqual([]);
      const g = buildGameData(p);
      expect(g.scenes.length).toBeGreaterThan(0);
      expect(g.startSceneId).toBeTruthy();
    }
  });
  it('normalize fills defaults and adopts orphan scenes', () => {
    const p = createEmptyProject('X');
    const raw = JSON.parse(JSON.stringify(p));
    delete raw.collections;
    raw.scenes.push({ id: 'orphan', name: 'Orphan' });
    const n = normalizeProject(raw);
    expect(n.collections).toEqual([]);
    expect(n.chapters.flatMap((c) => c.sceneIds)).toContain('orphan');
    expect(n.scenes.find((s) => s.id === 'orphan')!.actions).toEqual([]);
    expect(() => normalizeProject({ foo: 1 })).toThrow();
  });
});

describe('themes', () => {
  it('has the presets and produces css variables', () => {
    expect(THEME_PRESETS.map((t) => t.id)).toEqual(['modern', 'minimal', 'classic', 'dark', 'fantasy', 'soft', 'rpg', 'romance', 'horror']);
    const vars = themeVars(THEME_PRESETS[0], makeContext(THEME_PRESETS[0], 1920, 1080));
    expect(vars['--tvn-d-bg']).toMatch(/^rgba\(/);
    expect(withAlpha('transparent', 0.5)).toBe('transparent');
    expect(resolveTheme('nope', []).id).toBe('modern');
  });
});

describe('references and validation', () => {
  it('finds, replaces and removes asset references', () => {
    const p = createEmptyProject('R');
    p.assets = [asset('bg1', 'assets/bg/a.png', 'background'), asset('bg2', 'assets/bg/b.png', 'background')];
    p.scenes[0].actions = [createAction('changeBackground', { assetId: 'bg1' })];
    expect(findAssetUsages(p, 'bg1')).toHaveLength(1);
    expect(collectUsedAssetIds(p).has('bg1')).toBe(true);
    replaceAssetReferences(p, 'bg1', 'bg2');
    expect(p.scenes[0].actions[0].params.assetId).toBe('bg2');
    removeAssetReferences(p, 'bg2');
    expect(p.scenes[0].actions[0].params.assetId).toBe('');
  });
  it('reports missing assets, scenes and labels', () => {
    const p = createEmptyProject('V');
    p.scenes[0].actions = [
      createAction('changeBackground', { assetId: 'gone' }),
      createAction('jumpScene', { sceneId: 'nope' }),
      createAction('jump', { target: { kind: 'label', label: 'missing' } }),
    ];
    const msgs = validateProject(p).map((i) => i.message).join('\n');
    expect(msgs).toMatch(/asset/i);
    expect(msgs).toMatch(/choose a scene/);
    expect(msgs).toMatch(/Label “missing”/);
    p.assets = [asset('gone', 'assets/x.png', 'background')];
    const withDisk = validateProject(p, () => false).map((i) => i.message).join('\n');
    expect(withDisk).toMatch(/Missing asset file/);
  });
});

describe('game data, flow and search', () => {
  it('build strips disabled actions and unused assets', () => {
    const p = createEmptyProject('G');
    p.assets = [asset('used', 'assets/u.png', 'background'), asset('unused', 'assets/n.png', 'background')];
    const a1 = createAction('changeBackground', { assetId: 'used' });
    const a2 = createAction('narration', { text: 'hidden' });
    a2.disabled = true;
    p.scenes[0].actions = [a1, a2];
    const g = buildGameData(p);
    expect(Object.keys(g.assets)).toEqual(['used']);
    expect(g.scenes[0].actions).toHaveLength(1);
  });
  it('derives flow edges for jumps, choices, conditions and implicit next', () => {
    const p = createProjectFromTemplate('F', 'romance');
    const edges = deriveFlowEdges(p);
    expect(edges.some((e) => e.kind === 'jump')).toBe(true);
    expect(edges.some((e) => e.kind === 'condition')).toBe(true);
    expect(edges.length).toBeGreaterThanOrEqual(3);
  });
  it('searches scenes by name, chapter, tag and dialogue', () => {
    const p = createProjectFromTemplate('S', 'romance');
    expect(searchScenes(p, 'date')[0].match).toBe('name');
    expect(searchScenes(p, 'ending').length).toBeGreaterThan(0);
    expect(searchScenes(p, 'forget').some((h) => h.match === 'dialogue')).toBe(true);
    expect(searchScenes(p, 'spring').some((h) => h.match === 'chapter' || h.match === 'dialogue')).toBe(true);
  });
  it('filters and sorts assets', () => {
    const list = [asset('1', 'assets/Characters/A/b.png', 'character'), asset('2', 'assets/Backgrounds/a.png', 'background')];
    expect(filterAssets(list, { types: ['background'] }).map((a) => a.id)).toEqual(['2']);
    expect(filterAssets(list, { folder: 'assets/Characters' }).map((a) => a.id)).toEqual(['1']);
    expect(filterAssets(list, { query: 'b.png' }).map((a) => a.id)).toEqual(['1']);
    expect(filterAssets(list, {}, 'name').map((a) => a.id)).toEqual(['2', '1']);
  });
});
