// Validation before export: variables/conditions of the right type, {Name} in text, and the
// requested examples (affection >= 20, has_key == true) used by Dialogue, Choice and Scene Transition.
import { describe, expect, it } from 'vitest';
import { createAction } from '../src/shared/actions';
import { createEmptyProject } from '../src/shared/project';
import { validateProject } from '../src/shared/validate';
import { buildGameData } from '../src/shared/gamedata';
import { playThrough } from './helpers';

function story() {
  const p = createEmptyProject('Flags');
  p.variables.push({ id: 'aff', name: 'affection', type: 'number', initial: 0 }, { id: 'key', name: 'has_key', type: 'boolean', initial: false }, { id: 'nm', name: 'hero', type: 'string', initial: 'Sam' });
  const good = { id: 'good', name: 'Good Ending', tags: [], actions: [createAction('endGame', { message: 'Good' })] };
  const bad = { id: 'bad', name: 'Bad Ending', tags: [], actions: [createAction('endGame', { message: 'Bad' })] };
  p.scenes.push(good, bad);
  p.chapters[0].sceneIds.push('good', 'bad');
  p.scenes[0].actions = [
    createAction('addVariable', { variableId: 'aff', amount: 25 }),
    createAction('setVariable', { variableId: 'key', value: true }),
    createAction('narration', { text: '{hero} has {affection} affection.' }),
    createAction('choice', {
      question: 'Open the door?',
      options: [{ id: 'o1', text: 'Use the key', target: { kind: 'next' }, condition: { variableId: 'key', op: '==', value: true } }],
    }),
    createAction('conditional', { logic: 'all', conditions: [{ variableId: 'aff', op: '>=', value: 20 }], then: { kind: 'scene', sceneId: 'good' }, else: { kind: 'scene', sceneId: 'bad' } }),
  ];
  return p;
}

describe('validation of variables and conditions', () => {
  it('accepts the example flags and the game follows them', async () => {
    const p = story();
    expect(validateProject(p)).toEqual([]);
    const { rec } = await playThrough(buildGameData(p), [0]);
    expect(rec.dialogues).toContain('Sam has 25 affection.');
    expect(rec.ended).toBe('Good');
  });

  it('reports values and comparisons of the wrong type', () => {
    const p = story();
    const a = p.scenes[0].actions;
    a[0].params.variableId = 'key'; // Add Variable on a True/False
    a[1].params.value = 'maybe'; // Set has_key = "maybe"
    a[3].params.options[0].condition = { variableId: 'key', op: '>', value: 5 }; // has_key > 5
    a[4].params.conditions[0].value = 'lots'; // affection >= "lots"
    a.push(createAction('checkVariable', { variableId: 'aff', op: '==', value: 'x', target: { kind: 'scene', sceneId: 'good' } }));
    a[2].params.text = 'Hi {heroo}';
    const msgs = validateProject(p).map((i) => `${i.severity}: ${i.message}`);
    expect(msgs).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/error: .*Add Value: “has_key” is a True \/ False variable — only Number variables/),
        expect.stringMatching(/error: .*Set Variable: “has_key” is a True \/ False variable but would be set to “maybe”/),
        expect.stringMatching(/error: .*Choice option 1: “has_key” is True \/ False — compare it with “equals” or “is not”/),
        expect.stringMatching(/error: .*Conditional Branch: “affection” is a Number variable but is compared with “lots”/),
        expect.stringMatching(/error: .*Check Variable: “affection” is a Number variable but is compared with “x”/),
        expect.stringMatching(/warning: .*“\{heroo\}” in the text is not a variable name/),
      ]),
    );
  });

  it('keeps accepting values typed as text that clearly fit', () => {
    const p = story();
    p.scenes[0].actions[1].params.value = 'true';
    p.scenes[0].actions[4].params.conditions[0].value = '20';
    expect(validateProject(p)).toEqual([]);
  });
});
