import { afterEach, describe, expect, it } from 'vitest';
import { collectKeys } from '../scripts/i18n-keys.mjs';
import { TH } from '../src/shared/i18n-th';
import { setLanguage, t } from '../src/shared/i18n';
import { RUNTIME_STRINGS_TH } from '../src/runtime/player/strings';
import { createProjectFromTemplate } from '../src/shared/project';
import { validateProject } from '../src/shared/validate';
import { createEmptyProject } from '../src/shared/project';
import { createAction } from '../src/shared/actions';
import { buildGameData } from '../src/shared/gamedata';
import { playThrough } from './helpers';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

afterEach(() => setLanguage('en'));

describe('i18n', () => {
  it('every editor string has a Thai translation', () => {
    const missing = collectKeys().filter((k) => !(k in TH));
    expect(missing).toEqual([]);
  });

  it('translations keep the same {placeholders}', () => {
    for (const [en, th] of [...Object.entries(TH), ...Object.entries(RUNTIME_STRINGS_TH)]) {
      // {VariableName} in a hint is shown literally and may be translated.
      if (en.includes('{VariableName}')) continue;
      expect(placeholders(th), en).toEqual(placeholders(en));
    }
  });

  it('switches language and fills placeholders', () => {
    expect(t('Scene {n}', { n: 1 })).toBe('Scene 1');
    setLanguage('th');
    expect(t('Scene {n}', { n: 1 })).toBe('ฉาก 1');
    expect(t('Not a known key')).toBe('Not a known key');
  });

  it('templates and validation follow the language; games stay playable', async () => {
    setLanguage('th');
    const p = createProjectFromTemplate('ทดสอบ', 'romance');
    expect(p.settings.language).toBe('th');
    expect(p.scenes[0].name).toBe('พบกันครั้งแรก');
    expect(validateProject(p).filter((i) => i.severity === 'error')).toEqual([]);
    const { rec } = await playThrough(buildGameData(p), [0]);
    expect(rec.ended).toBe('ฉากจบดี');

    const broken = createEmptyProject('x');
    broken.scenes[0].actions = [createAction('jumpScene', { sceneId: 'nope' })];
    expect(validateProject(broken).map((i) => i.message).join()).toContain('เลือกฉาก');
  });
});
