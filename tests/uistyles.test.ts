// Style Library: reusable textbox/choice styles linked to themes — resolving, editing the global style,
// local override ("edit only here"), deleting without visible change, assets, old projects.
import { describe, expect, it } from 'vitest';
import { createEmptyProject, normalizeProject } from '../src/shared/project';
import { buildGameData, gameTheme } from '../src/shared/gamedata';
import { getPresetTheme } from '../src/shared/themes';
import { applyTextboxPreset } from '../src/shared/textbox';
import { applyChoicePreset } from '../src/shared/choicestyle';
import { applyStyles, deleteStyle, detachStyle, normalizeStyles, storeEditedTheme, styleFromTheme, styleUsers } from '../src/shared/uistyles';
import { collectUsedAssetIds, findAssetUsages, removeAssetReferences } from '../src/shared/validate';
import type { Project, Theme } from '../src/shared/types';

function project(): { p: Project; a: Theme; b: Theme } {
  const p = createEmptyProject('Lib');
  const a = { ...getPresetTheme('modern')!, id: 'a', name: 'A' };
  const b = { ...getPresetTheme('classic')!, id: 'b', name: 'B' };
  const fantasy = getPresetTheme('modern')!;
  applyTextboxPreset(fantasy, 'fantasy');
  applyChoicePreset(fantasy, 'rpg');
  p.uiStyles = [styleFromTheme(fantasy, 'textbox', 'Fantasy Dialogue'), styleFromTheme(fantasy, 'choice', 'RPG Menu')];
  a.textboxStyleId = p.uiStyles[0].id;
  b.textboxStyleId = p.uiStyles[0].id;
  b.choiceStyleId = p.uiStyles[1].id;
  p.themes = [a, b];
  p.settings.themeId = 'a';
  p.scenes.push({ id: 's2', name: 'Scene 02', tags: [], actions: [], themeId: 'b' });
  p.chapters[0].sceneIds.push('s2');
  return { p, a, b };
}

describe('style library', () => {
  it('linked styles replace the theme’s own parts in the game (project theme and scene themes)', () => {
    const { p } = project();
    const game = buildGameData(p);
    expect(game.theme.dialog.frame).toBe('ornate');
    expect(game.themes?.b.dialog.frame).toBe('ornate');
    expect(game.themes?.b.choice.icon).toBe('▶');
    expect(game.theme.choice.icon).toBe(''); // A has no choice style
    expect(gameTheme(p, 'b').menuBar).toEqual(getPresetTheme('classic')!.menuBar); // the rest stays the theme’s
  });

  it('editing the style through one theme updates every theme using it; the text speed stays per theme', () => {
    const { p } = project();
    const a = p.themes[0];
    a.dialog.textSpeed = 33;
    const edited = applyStyles(JSON.parse(JSON.stringify(a)), p.uiStyles);
    expect(edited.dialog.textSpeed).toBe(33);
    edited.dialog.surface.borderColor = '#00ff00';
    edited.menuBar.enabled = false;
    storeEditedTheme(a, edited, p.uiStyles);
    expect(p.uiStyles![0].dialog!.surface.borderColor).toBe('#00ff00');
    expect(gameTheme(p, 'b').dialog.surface.borderColor).toBe('#00ff00'); // the other theme follows
    expect(a.menuBar.enabled).toBe(false); // not part of the style: stored in the theme
    expect(p.themes[1].menuBar.enabled).toBe(true);
    expect(a.dialog.textSpeed).toBe(33);
    expect(p.uiStyles![0].dialog!.textSpeed).toBeNull();
  });

  it('“edit only here” keeps the look and unlinks; later style edits no longer reach that theme', () => {
    const { p } = project();
    const b = p.themes[1];
    detachStyle(b, 'textbox', p.uiStyles);
    expect(b.textboxStyleId).toBeNull();
    expect(b.dialog.frame).toBe('ornate');
    p.uiStyles![0].dialog!.frame = 'pixel';
    expect(gameTheme(p, 'b').dialog.frame).toBe('ornate');
    expect(gameTheme(p, 'a').dialog.frame).toBe('pixel');
    expect(styleUsers(p, p.uiStyles![0]).map((t) => t.id)).toEqual(['a']);
  });

  it('deleting a style changes nothing on screen', () => {
    const { p } = project();
    // The look (everything but the links themselves).
    const look = () => JSON.stringify([gameTheme(p, 'a'), gameTheme(p, 'b')].map(({ textboxStyleId: _a, choiceStyleId: _b, ...rest }) => rest));
    const before = look();
    deleteStyle(p, p.uiStyles![0].id);
    deleteStyle(p, p.uiStyles![0].id);
    expect(p.uiStyles).toEqual([]);
    expect(p.themes.map((t) => [t.textboxStyleId, t.choiceStyleId])).toEqual([
      [null, null],
      [null, null],
    ]);
    expect(look()).toBe(before);
  });

  it('style pictures are shipped, listed as usages and cleared when the asset is deleted', () => {
    const { p } = project();
    p.uiStyles![0].dialog!.surface.frameImage = 'frame';
    p.uiStyles![1].choice!.states.hover.image = 'btn';
    expect(collectUsedAssetIds(p).has('frame')).toBe(true);
    expect(collectUsedAssetIds(p).has('btn')).toBe(true);
    expect(findAssetUsages(p, 'frame').map((u) => u.label).join()).toContain('Fantasy Dialogue');
    expect(removeAssetReferences(p, 'btn')).toBeGreaterThan(0);
    expect(p.uiStyles![1].choice!.states.hover.image).toBeNull();
  });

  it('loads old projects (no library) and repairs damaged styles', () => {
    const raw = JSON.parse(JSON.stringify(createEmptyProject('Old')));
    delete raw.uiStyles;
    expect(normalizeProject(raw).uiStyles).toEqual([]);
    const fixed = normalizeStyles([{ id: 'x', kind: 'textbox', name: '', dialog: { frame: 'star' } }, { id: 'y', kind: 'weird' }, null, { kind: 'choice' }]);
    expect(fixed).toHaveLength(1);
    expect(fixed[0]).toMatchObject({ id: 'x', name: 'Style', kind: 'textbox' });
    expect(fixed[0].dialog!.frame).toBe('box');
    expect(fixed[0].nameBox!.shape).toBe('box');
    // A link to a style that no longer exists is ignored (the theme's own look is used).
    const t = { ...getPresetTheme('classic')!, textboxStyleId: 'gone' };
    expect(applyStyles(JSON.parse(JSON.stringify(t)), []).dialog).toEqual(t.dialog);
  });
});
