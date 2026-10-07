import { describe, expect, it } from 'vitest';
import { createAction } from '../src/shared/actions';
import { createEmptyProject, createProjectFromTemplate } from '../src/shared/project';
import { buildGameData } from '../src/shared/gamedata';
import { applyStateAction, emptyVisualState, stateBeforeAction } from '../src/runtime/core/state';
import { evalCondition, interpolate } from '../src/runtime/core/conditions';
import { Engine } from '../src/runtime/core/engine';
import { playThrough, scriptedHost } from './helpers';
import type { Project } from '../src/shared/types';

function romance(): Project {
  return createProjectFromTemplate('Romance Test', 'romance');
}

describe('runtime engine', () => {
  it('plays the romance template to the good ending when choosing the sweet option', async () => {
    const { rec } = await playThrough(buildGameData(romance()), [0]);
    expect(rec.errors).toEqual([]);
    expect(rec.ended).toBe('Good Ending');
    expect(rec.dialogues.join('\n')).toContain('makes me happy');
  });

  it('conditional branch goes to the normal ending when love is low', async () => {
    const { rec } = await playThrough(buildGameData(romance()), [1]);
    expect(rec.ended).toBe('Normal Ending');
  });

  it('runs every template without errors', async () => {
    for (const t of ['blank', 'horror', 'mystery', 'comedy']) {
      const { rec } = await playThrough(buildGameData(createProjectFromTemplate(t, t)), [0, 0, 0]);
      expect(rec.errors, t).toEqual([]);
    }
  });

  it('interpolates variables in text', async () => {
    const { rec } = await playThrough(buildGameData(createProjectFromTemplate('m', 'mystery')), [0]);
    expect(rec.dialogues.some((d) => d.includes('Clues found: 2'))).toBe(true);
    expect(rec.ended).toBe('True Ending');
  });

  it('Play From Here starts at the given action with warmed-up state', async () => {
    const p = createEmptyProject('P');
    const v = { id: 'v1', name: 'Money', type: 'number' as const, initial: 10 };
    p.variables = [v];
    p.scenes[0].actions = [
      createAction('changeBackground', { color: '#123456' }),
      createAction('addVariable', { variableId: 'v1', amount: 5 }),
      createAction('narration', { text: 'first' }),
      createAction('narration', { text: 'second {Money}' }),
    ];
    const { rec } = await playThrough(buildGameData(p), [], p.scenes[0].id, 3);
    expect(rec.dialogues).toEqual(['second 15']);
    const firstRender = rec.calls.find((c) => c.method === 'render') as any;
    expect(firstRender.arg.state.background).toEqual({ color: '#123456' });
  });

  it('snapshot + restore resumes at the same dialogue with variables', async () => {
    const p = createEmptyProject('S');
    p.variables = [{ id: 'v', name: 'Score', type: 'number', initial: 0 }];
    p.scenes[0].actions = [createAction('addVariable', { variableId: 'v', amount: 7 }), createAction('narration', { text: 'Score {Score}' }), createAction('endGame', { message: 'bye' })];
    const game = buildGameData(p);
    // Host that pauses on the first dialogue so we can snapshot mid-game.
    const { host, rec } = scriptedHost();
    let release!: () => void;
    host.dialogue = (d) => {
      rec.dialogues.push(d.text);
      return new Promise<void>((r) => (release = r));
    };
    const engine = new Engine(game, host);
    await engine.start();
    await new Promise((r) => setTimeout(r, 10));
    const snap = engine.snapshot()!;
    expect(snap.ptr.index).toBe(1);
    expect(snap.vars.v).toBe(7);
    expect(snap.text).toBe('Score 7');
    release();
    await new Promise((r) => setTimeout(r, 10));
    expect(rec.ended).toBe('bye');

    const second = scriptedHost();
    const e2 = new Engine(game, second.host);
    await e2.restore(JSON.parse(JSON.stringify(snap)));
    await second.done;
    expect(second.rec.dialogues).toEqual(['Score 7']);
    expect(second.rec.ended).toBe('bye');
  });

  it('detects endless jump loops instead of freezing', async () => {
    const p = createEmptyProject('L');
    p.scenes[0].actions = [createAction('label', { name: 'top' }), createAction('jump', { target: { kind: 'label', label: 'top' } })];
    const { rec } = await playThrough(buildGameData(p));
    expect(rec.errors[0]).toMatch(/endless loop/);
  });

  it('broken jumps produce a friendly error, not a crash', async () => {
    const p = createEmptyProject('B');
    p.scenes[0].actions = [createAction('jumpScene', { sceneId: 'missing' })];
    const { rec } = await playThrough(buildGameData(p));
    expect(rec.errors[0]).toMatch(/no longer exists/);
  });

  it('continues to the next scene in chapter order and filters choice options by condition', async () => {
    const p = createEmptyProject('N');
    p.variables = [{ id: 'k', name: 'Key', type: 'boolean', initial: false }];
    const s2 = { id: 's2', name: 'Two', tags: [], actions: [createAction('narration', { text: 'in two' })] };
    p.scenes.push(s2);
    p.chapters[0].sceneIds.push('s2');
    p.scenes[0].actions = [
      createAction('choice', {
        question: 'q',
        options: [
          { id: 'o1', text: 'locked', target: { kind: 'next' }, condition: { variableId: 'k', op: '==', value: true } },
          { id: 'o2', text: 'open', target: { kind: 'next' }, condition: null },
        ],
      }),
    ];
    const { rec } = await playThrough(buildGameData(p), [0]);
    const choice = rec.calls.find((c) => c.method === 'choice') as any;
    expect(choice.arg.options.map((o: any) => o.text)).toEqual(['open']);
    expect(rec.dialogues).toEqual(['in two']);
    expect(rec.ended).toBe('The End');
  });
});

describe('state reducer', () => {
  it('handles characters, expressions, images, CG and BGM', () => {
    const game = { characters: [{ id: 'c', name: 'C', displayName: 'C', color: '#fff', expressions: [{ id: 'e1', name: 'N', assetId: 'x' }, { id: 'e2', name: 'H', assetId: 'y' }], defaultExpressionId: 'e1' }] };
    let s = emptyVisualState();
    s = applyStateAction(s, createAction('addCharacter', { characterId: 'c' }), game).state;
    expect(s.characters[0].expressionId).toBe('e1');
    s = applyStateAction(s, createAction('changeExpression', { characterId: 'c', expressionId: 'e2' }), game).state;
    expect(s.characters[0].expressionId).toBe('e2');
    s = applyStateAction(s, createAction('moveCharacter', { characterId: 'c', x: 20 }), game).state;
    expect(s.characters[0].x).toBe(20);
    s = applyStateAction(s, createAction('dialogue', { speaker: 'c', position: 'right' }), game).state;
    expect(s.characters[0].x).toBe(78);
    s = applyStateAction(s, createAction('showImage', { slot: 'note', assetId: 'n' }), game).state;
    s = applyStateAction(s, createAction('showCG', { assetId: 'cg' }), game).state;
    s = applyStateAction(s, createAction('playBGM', { assetId: 'm' }), game).state;
    expect(s.images).toHaveLength(1);
    expect(s.cg).toBe('cg');
    expect(s.bgm?.assetId).toBe('m');
    s = applyStateAction(s, createAction('hideImage', { slot: 'note' }), game).state;
    s = applyStateAction(s, createAction('hideCG'), game).state;
    s = applyStateAction(s, createAction('stopBGM'), game).state;
    s = applyStateAction(s, createAction('removeCharacter', { characterId: 'c' }), game).state;
    expect(s).toEqual({ ...emptyVisualState() });
  });
  it('stateBeforeAction tracks which action set each element', () => {
    const acts = [createAction('changeBackground', { color: '#000' }), createAction('narration', { text: 'x' })];
    const r = stateBeforeAction({ characters: [], variables: [] }, acts, 2);
    expect(r.sources.background).toBe(acts[0].id);
  });
  it('conditions and interpolation', () => {
    const vars = [{ id: 'a', name: 'Love_A', type: 'number' as const, initial: 0 }];
    expect(evalCondition({ variableId: 'a', op: '>=', value: 50 }, { a: 60 }, vars)).toBe(true);
    expect(evalCondition({ variableId: 'a', op: '<', value: '50' }, { a: 60 }, vars)).toBe(false);
    expect(interpolate('Love {Love_A} {Unknown}', { a: 3 }, vars)).toBe('Love 3 {Unknown}');
  });
});
