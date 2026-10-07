import type { Action, ActionType, Chapter, Project, Scene, Variable } from './types';
import { createAction } from './actions';
import { newId } from './ids';
import { THEME_PRESETS, normalizeTheme } from './themes';
import { getLanguage, t } from './i18n';

export const PROJECT_FILE = 'project.json';
export const ASSETS_DIR = 'assets';
export const META_DIR = '.tstvn';
/** Current game-UI format (see ProjectSettings.uiVersion). */
export const UI_VERSION = 2;

export function createEmptyProject(name: string): Project {
  const now = Date.now();
  const scene: Scene = { id: newId('s'), name: t('Scene {n}', { n: '01' }), tags: [], actions: [], flowPos: { x: 260, y: 80 } };
  const chapter: Chapter = { id: newId('ch'), name: t('Chapter {n}', { n: 1 }), sceneIds: [scene.id] };
  return {
    format: 'tstvn-project',
    version: 1,
    id: newId('p'),
    name,
    createdAt: now,
    updatedAt: now,
    template: 'blank',
    settings: {
      title: name,
      author: '',
      resolution: { width: 1920, height: 1080 },
      startSceneId: scene.id,
      textSpeed: 40,
      themeId: 'modern',
      displayMode: 'windowed',
      language: getLanguage(),
      uiVersion: UI_VERSION,
    },
    assets: [],
    characters: [],
    chapters: [chapter],
    scenes: [scene],
    variables: [],
    themes: [],
    actionTemplates: [],
    collections: [],
  };
}

// ---------------- Templates ----------------

export interface ProjectTemplateInfo {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export const BUILTIN_TEMPLATES: ProjectTemplateInfo[] = [
  { id: 'blank', name: 'Blank', description: 'An empty project with one scene.', icon: '📄' },
  { id: 'romance', name: 'Romance', description: 'Affection points, a date choice and two endings.', icon: '💗' },
  { id: 'horror', name: 'Horror', description: 'Dark theme, sanity meter, screen shake.', icon: '🕯️' },
  { id: 'mystery', name: 'Mystery', description: 'Collect clues, then accuse the culprit.', icon: '🔎' },
  { id: 'comedy', name: 'Comedy', description: 'Bright theme, silly choices, bouncy characters.', icon: '🤡' },
];

function act(type: ActionType, params: Record<string, any> = {}): Action {
  return createAction(type, params);
}

function variable(name: string, type: Variable['type'], initial: Variable['initial']): Variable {
  return { id: newId('v'), name, type, initial };
}

function scene(name: string, actions: Action[], x: number, y: number, tags: string[] = []): Scene {
  return { id: newId('s'), name, tags, actions, flowPos: { x, y } };
}

/** Creates a new project from a built-in template. Templates use colors, so they work without any assets. */
export function createProjectFromTemplate(name: string, templateId: string): Project {
  const p = createEmptyProject(name);
  p.template = templateId;
  if (templateId === 'blank') {
    p.scenes[0].actions = [
      act('changeBackground', { color: '#2b3a67', transition: 'fade' }),
      act('narration', { text: t('Welcome to your first visual novel! Import assets and edit this scene to begin.') }),
    ];
    return p;
  }

  const build = TEMPLATE_BUILDERS[templateId];
  if (!build) return p;
  const { theme, variables, chapters } = build();
  p.settings.themeId = theme;
  p.variables = variables;
  p.scenes = chapters.flatMap((c) => c.scenes);
  p.chapters = chapters.map((c) => ({ id: newId('ch'), name: c.name, sceneIds: c.scenes.map((s) => s.id) }));
  p.settings.startSceneId = p.scenes[0]?.id;
  return p;
}

type Built = { theme: string; variables: Variable[]; chapters: { name: string; scenes: Scene[] }[] };

const TEMPLATE_BUILDERS: Record<string, () => Built> = {
  romance: () => {
    const love = variable('Love', 'number', 0);
    const good = scene(t('Good Ending'), [act('changeBackground', { color: '#ffb7c5' }), act('narration', { text: t('Under the cherry blossoms, a new story begins. ♥') }), act('endGame', { message: t('Good Ending') })], 700, 40, ['ending']);
    const normal = scene(t('Normal Ending'), [act('changeBackground', { color: '#8e9aaf' }), act('narration', { text: t('We stayed friends. Maybe that is enough.') }), act('endGame', { message: t('Normal Ending') })], 700, 240, ['ending']);
    const date = scene(t('The Date'), [
      act('changeBackground', { color: '#f6bd60', transition: 'fade' }),
      act('dialogue', { text: t('You came! I was worried you would forget.') }),
      act('choice', {
        question: t('What do you say?'),
        options: [
          { id: newId('o'), text: t('I could never forget you.'), target: { kind: 'label', label: 'sweet' }, condition: null },
          { id: newId('o'), text: t('I almost did, haha.'), target: { kind: 'label', label: 'tease' }, condition: null },
        ],
      }),
      act('label', { name: 'sweet' }),
      act('addVariable', { variableId: love.id, amount: 30 }),
      act('dialogue', { text: t('…Really? That makes me happy.') }),
      act('jump', { target: { kind: 'label', label: 'decide' } }),
      act('label', { name: 'tease' }),
      act('addVariable', { variableId: love.id, amount: 5 }),
      act('dialogue', { text: t('Hey! That is mean!') }),
      act('label', { name: 'decide' }),
      act('conditional', {
        logic: 'all',
        conditions: [{ variableId: love.id, op: '>=', value: 30 }],
        then: { kind: 'scene', sceneId: good.id },
        else: { kind: 'scene', sceneId: normal.id },
      }),
    ], 380, 120);
    const intro = scene(t('First Meeting'), [
      act('changeBackground', { color: '#84a59d', transition: 'fade' }),
      act('narration', { text: t('Spring. The first day of school.') }),
      act('dialogue', { text: t('Oh! Sorry, I was not looking where I was going…') }),
      act('addVariable', { variableId: love.id, amount: 10 }),
      act('jumpScene', { sceneId: date.id }),
    ], 60, 120);
    return { theme: 'modern', variables: [love], chapters: [{ name: t('Chapter 1 — Spring'), scenes: [intro, date] }, { name: t('Endings'), scenes: [good, normal] }] };
  },
  horror: () => {
    const sanity = variable('Sanity', 'number', 100);
    const hasKey = variable('HasKey', 'boolean', false);
    const escape = scene(t('Escape'), [act('changeBackground', { color: '#3a5a40' }), act('narration', { text: t('Cold night air. You made it out.') }), act('endGame', { message: t('You Survived') })], 700, 40, ['ending']);
    const lost = scene(t('Lost'), [act('changeBackground', { color: '#000000' }), act('screenEffect', { effect: 'shake', duration: 1 }), act('narration', { text: t('The darkness swallows you.') }), act('endGame', { message: t('Bad Ending') })], 700, 240, ['ending']);
    const hall = scene(t('The Hallway'), [
      act('changeBackground', { color: '#1b0f14', transition: 'fade', duration: 1.5 }),
      act('narration', { text: t('Something moves at the end of the hallway.') }),
      act('screenEffect', { effect: 'flash', duration: 0.3 }),
      act('subtractVariable', { variableId: sanity.id, amount: 40 }),
      act('choice', {
        question: '',
        options: [
          { id: newId('o'), text: t('Run to the door'), target: { kind: 'next' }, condition: null },
          { id: newId('o'), text: t('Hide under the stairs'), target: { kind: 'label', label: 'hide' }, condition: null },
        ],
      }),
      act('conditional', { logic: 'all', conditions: [{ variableId: hasKey.id, op: '==', value: true }], then: { kind: 'scene', sceneId: escape.id }, else: { kind: 'scene', sceneId: lost.id } }),
      act('label', { name: 'hide' }),
      act('subtractVariable', { variableId: sanity.id, amount: 70 }),
      act('jumpScene', { sceneId: lost.id }),
    ], 380, 120);
    const start = scene(t('Abandoned House'), [
      act('changeBackground', { color: '#2d2a32', transition: 'fade', duration: 2 }),
      act('narration', { text: t('The door slams shut behind you.') }),
      act('screenEffect', { effect: 'shake', duration: 0.6 }),
      act('choice', {
        question: t('There is a rusty key on the floor.'),
        options: [
          { id: newId('o'), text: t('Take the key'), target: { kind: 'label', label: 'take' }, condition: null },
          { id: newId('o'), text: t('Leave it'), target: { kind: 'label', label: 'go' }, condition: null },
        ],
      }),
      act('label', { name: 'take' }),
      act('setVariable', { variableId: hasKey.id, value: true }),
      act('label', { name: 'go' }),
      act('jumpScene', { sceneId: hall.id }),
    ], 60, 120);
    return { theme: 'dark', variables: [sanity, hasKey], chapters: [{ name: t('Night 1'), scenes: [start, hall] }, { name: t('Endings'), scenes: [escape, lost] }] };
  },
  mystery: () => {
    const clues = variable('Clues', 'number', 0);
    const solved = scene(t('Case Closed'), [act('changeBackground', { color: '#283618' }), act('narration', { text: t('The culprit confesses. Case closed.') }), act('endGame', { message: t('True Ending') })], 700, 40, ['ending']);
    const wrong = scene(t('Wrong Accusation'), [act('changeBackground', { color: '#432818' }), act('narration', { text: t('The real culprit slips away…') }), act('endGame', { message: t('Bad Ending') })], 700, 240, ['ending']);
    const accuse = scene(t('Accusation'), [
      act('changeBackground', { color: '#3d405b' }),
      act('narration', { text: t('Clues found: {Clues}. Time to name the culprit.') }),
      act('checkVariable', { variableId: clues.id, op: '>=', value: 2, target: { kind: 'scene', sceneId: solved.id } }),
      act('jumpScene', { sceneId: wrong.id }),
    ], 380, 120);
    const investigate = scene(t('Investigation'), [
      act('changeBackground', { color: '#22333b', transition: 'fade' }),
      act('narration', { text: t('The study is a mess. Where should I look?') }),
      act('choice', {
        question: '',
        options: [
          { id: newId('o'), text: t('Check the desk'), target: { kind: 'label', label: 'desk' }, condition: null },
          { id: newId('o'), text: t('Accuse someone now'), target: { kind: 'scene', sceneId: accuse.id }, condition: null },
        ],
      }),
      act('label', { name: 'desk' }),
      act('addVariable', { variableId: clues.id, amount: 1 }),
      act('narration', { text: t('A torn letter! (Clue found)') }),
      act('addVariable', { variableId: clues.id, amount: 1 }),
      act('narration', { text: t('And a muddy footprint. (Clue found)') }),
      act('jumpScene', { sceneId: accuse.id }),
    ], 60, 120);
    return { theme: 'classic', variables: [clues], chapters: [{ name: t('The Case'), scenes: [investigate, accuse] }, { name: t('Endings'), scenes: [solved, wrong] }] };
  },
  comedy: () => {
    const laughs = variable('Laughs', 'number', 0);
    const end = scene(t('Punchline'), [act('changeBackground', { color: '#ffd166' }), act('narration', { text: t('Laughs collected: {Laughs}. What a day!') }), act('endGame', { message: t('The End?') })], 540, 120, ['ending']);
    const start = scene(t('Breakfast Disaster'), [
      act('changeBackground', { color: '#06d6a0', transition: 'slide-left' }),
      act('narration', { text: t('The toaster is on fire. Again.') }),
      act('screenEffect', { effect: 'shake', duration: 0.4 }),
      act('choice', {
        question: t('Quick! Do something!'),
        options: [
          { id: newId('o'), text: t('Throw milk at it'), target: { kind: 'label', label: 'milk' }, condition: null },
          { id: newId('o'), text: t('Take a selfie first'), target: { kind: 'label', label: 'selfie' }, condition: null },
        ],
      }),
      act('label', { name: 'milk' }),
      act('addVariable', { variableId: laughs.id, amount: 1 }),
      act('narration', { text: t('Now there is milk on the ceiling. Somehow.') }),
      act('jumpScene', { sceneId: end.id }),
      act('label', { name: 'selfie' }),
      act('addVariable', { variableId: laughs.id, amount: 5 }),
      act('narration', { text: t('#BreakfastGoals') }),
      act('jumpScene', { sceneId: end.id }),
    ], 60, 120);
    return { theme: 'fantasy', variables: [laughs], chapters: [{ name: t('Episode 1'), scenes: [start, end] }] };
  },
};

// ---------------- Normalization ----------------

/** Fill in defaults for older/partial project files so the editor never crashes on load. */
export function normalizeProject(raw: any): Project {
  if (!raw || typeof raw !== 'object' || raw.format !== 'tstvn-project') {
    throw new Error('This file is not a TSTVN project.');
  }
  const base = createEmptyProject(raw.name ?? 'Untitled');
  const p: Project = {
    ...base,
    ...raw,
    settings: { ...base.settings, ...(raw.settings ?? {}) },
    assets: Array.isArray(raw.assets) ? raw.assets.map((a: any) => ({ tags: [], rev: 0, hasThumb: false, ...a })) : [],
    characters: Array.isArray(raw.characters) ? raw.characters : [],
    chapters: Array.isArray(raw.chapters) ? raw.chapters : base.chapters,
    scenes: Array.isArray(raw.scenes) ? raw.scenes.map((s: any) => ({ tags: [], actions: [], ...s })) : base.scenes,
    variables: Array.isArray(raw.variables) ? raw.variables : [],
    themes: Array.isArray(raw.themes) ? raw.themes.map(normalizeTheme) : [],
    actionTemplates: Array.isArray(raw.actionTemplates) ? raw.actionTemplates : [],
    collections: Array.isArray(raw.collections) ? raw.collections : [],
  };
  // Version-1 game UI used 1280×720 "UI points"; sizes are now design px on a 1920×1080 canvas.
  if ((raw.settings?.uiVersion ?? 1) < UI_VERSION) {
    if (p.settings.dialogueFontSize) p.settings.dialogueFontSize = Math.round(p.settings.dialogueFontSize * 1.5);
    p.settings.uiVersion = UI_VERSION;
  }
  // Every scene must belong to exactly one chapter.
  const inChapter = new Set(p.chapters.flatMap((c) => c.sceneIds));
  const sceneIds = new Set(p.scenes.map((s) => s.id));
  p.chapters = p.chapters.map((c) => ({ ...c, sceneIds: c.sceneIds.filter((id) => sceneIds.has(id)) }));
  const orphans = p.scenes.filter((s) => !inChapter.has(s.id)).map((s) => s.id);
  if (orphans.length) {
    if (p.chapters.length === 0) p.chapters.push({ id: newId('ch'), name: t('Chapter {n}', { n: 1 }), sceneIds: [] });
    p.chapters[p.chapters.length - 1].sceneIds.push(...orphans);
  }
  return p;
}

/** All scene ids in story order (chapter order, then scene order). */
export function orderedSceneIds(p: Pick<Project, 'chapters'>): string[] {
  return p.chapters.flatMap((c) => c.sceneIds);
}

export function themeIdsInUse(p: Project): string[] {
  return [...THEME_PRESETS.map((t) => t.id), ...p.themes.map((t) => t.id)];
}
