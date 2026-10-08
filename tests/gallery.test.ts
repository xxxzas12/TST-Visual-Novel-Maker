// In-game Gallery: items derived from the story, sections, unlock rules, ending ids from the engine.
import { describe, expect, it } from 'vitest';
import type { Asset } from '../src/shared/types';
import { buildGallery, galleryItems } from '../src/shared/gallery';
import { buildGameData } from '../src/shared/gamedata';
import { createEmptyProject, normalizeProject } from '../src/shared/project';
import { createAction } from '../src/shared/actions';
import { Engine } from '../src/runtime/core/engine';
import { scriptedHost } from './helpers';

const asset = (id: string, path: string, type: Asset['type'], kind: Asset['kind'] = 'image'): Asset => ({ id, path, name: path.split('/').pop()!, ext: 'png', kind, type, size: 1, hash: id, tags: [], hasThumb: false, rev: 0, importedAt: 0 });

function project() {
  const p = createEmptyProject('G');
  p.assets.push(asset('cg1', 'assets/cg1.png', 'cg'), asset('cg2', 'assets/cg2.png', 'cg'), asset('m1', 'assets/theme.ogg', 'music', 'audio'), asset('alice', 'assets/alice.png', 'character'));
  p.characters.push({ id: 'c1', name: 'Alice', displayName: 'Alice', color: '#f0a', expressions: [{ id: 'e1', name: 'Happy', assetId: 'alice' }] });
  const end = createAction('endGame', { message: 'Good End' });
  p.scenes[0].actions = [
    createAction('playBGM', { assetId: 'm1' }),
    createAction('addCharacter', { characterId: 'c1' }),
    createAction('showCG', { assetId: 'cg1' }),
    createAction('showCG', { assetId: 'cg1' }), // duplicate → listed once
    { ...createAction('showCG', { assetId: 'cg2' }), disabled: true }, // disabled → not listed
    end,
  ];
  return { p, endId: end.id };
}

describe('gallery', () => {
  it('lists CG, characters, music and endings the story uses, once each, in story order', () => {
    const { p, endId } = project();
    expect(galleryItems(p).map((i) => [i.section, i.key, i.label])).toEqual([
      ['music', 'music:m1', 'theme'],
      ['characters', 'char:c1', 'Alice'],
      ['cg', 'cg:cg1', 'cg1.png'],
      ['endings', `ending:${endId}`, 'Good End'],
    ]);
  });

  it('is only in the game when enabled, with the chosen sections and unlock rules', () => {
    const { p, endId } = project();
    expect(buildGallery(p)).toBeUndefined();
    expect(buildGameData(p).gallery).toBeUndefined();
    p.settings.gallery = { enabled: true, sections: { cg: true, characters: false, music: true, endings: true }, unlock: { [`ending:${endId}`]: { mode: 'always' } } };
    const g = buildGameData(p).gallery!;
    expect(g.sections).toEqual(['cg', 'music', 'endings']);
    expect(g.items.map((i) => i.key)).toEqual(['music:m1', 'cg:cg1', `ending:${endId}`]);
    expect(g.alwaysUnlocked).toEqual([`ending:${endId}`]);
    // Gallery settings survive saving and loading the project.
    expect(normalizeProject(JSON.parse(JSON.stringify(p))).settings.gallery).toEqual(p.settings.gallery);
  });

  it('tells the player which ending was reached', async () => {
    const { p, endId } = project();
    const { host } = scriptedHost();
    const ends: (string | undefined)[] = [];
    host.end = async (_m, id) => void ends.push(id);
    const engine = new Engine(buildGameData(p), host);
    await engine.start();
    await new Promise((r) => setTimeout(r, 50));
    expect(ends).toEqual([endId]);
  });
});
