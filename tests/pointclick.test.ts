// Point & Click (optional interactive scenes): engine, variables, conditions, validation, flow, assets.
import { describe, expect, it } from 'vitest';
import type { Asset, Hotspot, Project } from '../src/shared/types';
import { cloneActions, createAction } from '../src/shared/actions';
import { buildGameData } from '../src/shared/gamedata';
import { createEmptyProject } from '../src/shared/project';
import { deriveFlowEdges } from '../src/shared/flow';
import { collectUsedAssetIds, removeAssetReferences, validateProject } from '../src/shared/validate';
import { Engine, type HotspotView } from '../src/runtime/core/engine';
import { playThrough, scriptedHost } from './helpers';

function room(): { p: Project; door: Hotspot; key: Hotspot } {
  const p = createEmptyProject('Room');
  p.variables.push({ id: 'k', name: 'has_key', type: 'boolean', initial: false });
  p.assets.push({ id: 'img', path: 'assets/key.png', name: 'key.png', ext: 'png', kind: 'image', type: 'ui', size: 1, hash: 'h', tags: [], hasThumb: false, rev: 0, importedAt: 0 } as Asset);
  const outside = { id: 'out', name: 'Outside', tags: [], actions: [createAction('endGame', { message: 'Escaped' })] };
  p.scenes.push(outside);
  p.chapters[0].sceneIds.push(outside.id);
  const key: Hotspot = { id: 'h1', label: 'Key', x: 70, y: 60, w: 8, h: 8, assetId: 'img', target: { kind: 'label', label: 'look' }, condition: { variableId: 'k', op: '==', value: false }, variableId: 'k', value: true };
  const door: Hotspot = { id: 'h2', label: 'Door', x: 10, y: 20, w: 20, h: 60, target: { kind: 'scene', sceneId: 'out' }, condition: { variableId: 'k', op: '==', value: true } };
  p.scenes[0].actions = [
    createAction('label', { name: 'look' }),
    createAction('pointAndClick', { prompt: 'Find a way out', hotspots: [key, door] }),
  ];
  return { p, door, key };
}

describe('point & click', () => {
  it('shows clickable objects, sets a variable on click and branches', async () => {
    const { p } = room();
    const views: HotspotView[] = [];
    const { host, done, rec } = scriptedHost();
    host.hotspots = async (v) => {
      views.push(v);
      return 0; // the only visible object each time
    };
    await new Engine(buildGameData(p), host).start();
    await done;
    // First the key is clickable (door locked), after taking it only the door is.
    expect(views.map((v) => v.hotspots.map((h) => h.label))).toEqual([['Key'], ['Door']]);
    expect(views[0]).toMatchObject({ prompt: 'Find a way out', hotspots: [{ label: 'Key', x: 70, y: 60, w: 8, h: 8, assetId: 'img' }] });
    expect(rec.ended).toBe('Escaped');
  });

  it('falls back to a normal choice for hosts without point & click', async () => {
    const { p } = room();
    const { rec } = await playThrough(buildGameData(p), [0, 0]);
    expect(rec.calls.filter((c) => c.method === 'choice').map((c) => (c.arg as { options: { text: string }[] }).options.map((o) => o.text))).toEqual([['Key'], ['Door']]);
    expect(rec.ended).toBe('Escaped');
  });

  it('is validated, shown in the story flow and counted for assets', () => {
    const { p, door } = room();
    expect(validateProject(p).filter((i) => i.severity === 'error')).toEqual([]);
    expect(deriveFlowEdges(p).filter((e) => e.kind === 'choice').map((e) => [e.label, e.to])).toEqual([['Door', 'out']]);
    expect(collectUsedAssetIds(p).has('img')).toBe(true);

    const action = p.scenes[0].actions[1];
    const hs = action.params.hotspots as Hotspot[];
    hs.push({ id: 'h3', label: '', x: 0, y: 0, w: 0, h: 10, target: { kind: 'scene', sceneId: 'gone' }, variableId: 'nope', value: 1 });
    const msgs = validateProject(p).map((i) => `${i.severity}: ${i.message}`);
    expect(msgs).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/warning: .*Point & Click object 3 has no name/),
        expect.stringMatching(/error: .*Object 3: the clickable area has no size/),
        expect.stringMatching(/error: .*Object 3: Jump target scene does not exist/),
        expect.stringMatching(/error: .*Object 3: the variable to set is missing/),
      ]),
    );
    action.params.hotspots = [];
    expect(validateProject(p).some((i) => /no clickable objects/.test(i.message))).toBe(true);
    action.params.hotspots = [door];

    const copy = cloneActions([action])[0];
    expect(copy.params.hotspots[0].id).not.toBe(door.id);
    action.params.hotspots = [{ ...door, assetId: 'img' }];
    removeAssetReferences(p, 'img');
    expect(action.params.hotspots[0].assetId).toBeUndefined();
  });
});
