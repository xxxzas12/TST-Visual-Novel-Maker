import type { Action, ActionType, AssetType, JumpTarget } from './types';
import { newId } from './ids';
import { t } from './i18n';
import { EMPHASIS_ANIMATIONS, ENTER_ANIMATIONS, EXIT_ANIMATIONS, SCREEN_EFFECTS, TRANSITIONS, EASINGS, type PresetOption } from './animations';

export type ActionCategory = 'story' | 'visual' | 'character' | 'audio' | 'flow' | 'variable' | 'game';

export const CATEGORIES: { id: ActionCategory; label: string; icon: string }[] = [
  { id: 'story', label: 'Story', icon: '💬' },
  { id: 'visual', label: 'Visual', icon: '🖼️' },
  { id: 'character', label: 'Character', icon: '🧍' },
  { id: 'audio', label: 'Audio', icon: '🎵' },
  { id: 'flow', label: 'Flow', icon: '🔀' },
  { id: 'variable', label: 'Variable', icon: '🔢' },
  { id: 'game', label: 'Game', icon: '🎮' },
];

export type FieldSpec =
  | { key: string; label: string; kind: 'text'; placeholder?: string }
  | { key: string; label: string; kind: 'textarea'; placeholder?: string }
  | { key: string; label: string; kind: 'number'; min?: number; max?: number; step?: number; unit?: string }
  | { key: string; label: string; kind: 'slider'; min: number; max: number; step?: number; unit?: string }
  | { key: string; label: string; kind: 'boolean' }
  | { key: string; label: string; kind: 'select'; options: PresetOption[] }
  | { key: string; label: string; kind: 'asset'; assetTypes: AssetType[]; media: 'image' | 'audio' | 'video' }
  | { key: string; label: string; kind: 'character' }
  | { key: string; label: string; kind: 'expression'; characterKey: string }
  | { key: string; label: string; kind: 'scene' }
  | { key: string; label: string; kind: 'variable' }
  | { key: string; label: string; kind: 'varValue'; variableKey: string }
  | { key: string; label: string; kind: 'color' }
  | { key: string; label: string; kind: 'target'; allowNext?: boolean }
  | { key: string; label: string; kind: 'choiceOptions' }
  | { key: string; label: string; kind: 'conditions' }
  | { key: string; label: string; kind: 'textStyle' }
  | { key: string; label: string; kind: 'customAnimation' }
  | { key: string; label: string; kind: 'compareOp' };

export interface SummaryContext {
  assetName(id: string | undefined): string;
  characterName(id: string | undefined): string;
  expressionName(characterId: string | undefined, expressionId: string | undefined): string;
  sceneName(id: string | undefined): string;
  variableName(id: string | undefined): string;
}

export interface ActionDef {
  type: ActionType;
  label: string;
  category: ActionCategory;
  alsoIn?: ActionCategory[];
  icon: string;
  description: string;
  keywords: string[];
  fields: FieldSpec[];
  defaults(): Record<string, any>;
  summary(p: Record<string, any>, ctx: SummaryContext): string;
  /** When shown in "Show when" field rules: field key -> predicate over params. */
  visibleWhen?: Record<string, (p: Record<string, any>) => boolean>;
}

const IMAGE_BG: AssetType[] = ['background', 'cg', 'unknown'];
const POSITION_OPTIONS: PresetOption[] = [
  { value: 'keep', label: 'Keep current' },
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
];


function cut(text: string, n = 60): string {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

export function describeTarget(target: JumpTarget | undefined, ctx: SummaryContext): string {
  if (!target) return '—';
  switch (target.kind) {
    case 'next':
      return t('Continue');
    case 'scene':
      return t('Scene “{name}”', { name: ctx.sceneName(target.sceneId) });
    case 'label':
      return t('Label “{name}”', { name: target.label ?? '' });
    case 'action':
      return t('Action in scene');
  }
}

const transitionFields = (withDuration = true): FieldSpec[] => {
  const f: FieldSpec[] = [{ key: 'transition', label: 'Transition', kind: 'select', options: TRANSITIONS }];
  if (withDuration) f.push({ key: 'duration', label: 'Duration', kind: 'number', min: 0, max: 10, step: 0.1, unit: 's' });
  return f;
};

const placementFields: FieldSpec[] = [
  { key: 'x', label: 'X position', kind: 'slider', min: -20, max: 120, step: 1, unit: '%' },
  { key: 'y', label: 'Y position (bottom)', kind: 'slider', min: 0, max: 150, step: 1, unit: '%' },
  { key: 'scale', label: 'Scale', kind: 'slider', min: 0.1, max: 3, step: 0.05, unit: '×' },
  { key: 'rotation', label: 'Rotation', kind: 'slider', min: -180, max: 180, step: 1, unit: '°' },
  { key: 'opacity', label: 'Opacity', kind: 'slider', min: 0, max: 1, step: 0.05 },
  { key: 'flip', label: 'Flip horizontally', kind: 'boolean' },
  { key: 'layer', label: 'Layer', kind: 'number', min: -10, max: 100, step: 1 },
];

export const ACTION_DEFS: ActionDef[] = [
  // ---------------- STORY ----------------
  {
    type: 'dialogue',
    label: 'Dialogue',
    category: 'story',
    icon: '💬',
    description: 'A character says a line.',
    keywords: ['say', 'talk', 'text', 'line', 'speak'],
    fields: [
      { key: 'speaker', label: 'Speaker', kind: 'character' },
      { key: 'expressionId', label: 'Expression', kind: 'expression', characterKey: 'speaker' },
      { key: 'position', label: 'Position', kind: 'select', options: POSITION_OPTIONS },
      { key: 'text', label: 'Text', kind: 'textarea', placeholder: 'What does the character say? Use {VariableName} to insert values.' },
      { key: 'style', label: 'Text style', kind: 'textStyle' },
      { key: 'voice', label: 'Voice', kind: 'asset', assetTypes: ['voice', 'sfx', 'unknown'], media: 'audio' },
      { key: 'sfx', label: 'Sound effect', kind: 'asset', assetTypes: ['sfx', 'voice', 'unknown'], media: 'audio' },
      { key: 'textSpeed', label: 'Text speed (0 = default)', kind: 'number', min: 0, max: 500, step: 5, unit: 'chars/s' },
    ],
    defaults: () => ({ speaker: '', expressionId: '', position: 'keep', text: '', style: {}, voice: '', sfx: '', textSpeed: 0 }),
    summary: (p, ctx) => `${p.speaker ? ctx.characterName(p.speaker) : t('Narrator')}: “${cut(p.text)}”`,
  },
  {
    type: 'narration',
    label: 'Narration',
    category: 'story',
    icon: '📜',
    description: 'Narrator text without a speaker name.',
    keywords: ['narrator', 'text', 'description'],
    fields: [
      { key: 'text', label: 'Text', kind: 'textarea', placeholder: 'Narration text…' },
      { key: 'style', label: 'Text style', kind: 'textStyle' },
      { key: 'voice', label: 'Voice', kind: 'asset', assetTypes: ['voice', 'unknown'], media: 'audio' },
      { key: 'textSpeed', label: 'Text speed (0 = default)', kind: 'number', min: 0, max: 500, step: 5, unit: 'chars/s' },
    ],
    defaults: () => ({ text: '', style: { italic: true }, voice: '', textSpeed: 0 }),
    summary: (p) => `“${cut(p.text)}”`,
  },
  {
    type: 'choice',
    label: 'Choice',
    category: 'story',
    icon: '🔀',
    description: 'Let the player pick between options.',
    keywords: ['option', 'branch', 'decision', 'menu', 'select'],
    fields: [
      { key: 'question', label: 'Question (optional)', kind: 'text', placeholder: 'What will you do?' },
      { key: 'options', label: 'Options', kind: 'choiceOptions' },
    ],
    defaults: () => ({
      question: '',
      options: [
        { id: newId('o'), text: 'Option A', target: { kind: 'next' }, condition: null },
        { id: newId('o'), text: 'Option B', target: { kind: 'next' }, condition: null },
      ],
    }),
    summary: (p, ctx) =>
      `${p.question ? `${cut(p.question, 30)} ` : ''}[${(p.options ?? [])
        .map((o: any) => `${cut(o.text, 18)} → ${describeTarget(o.target, ctx)}`)
        .join(' | ')}]`,
  },
  {
    type: 'jumpScene',
    label: 'Jump to Scene',
    category: 'story',
    icon: '➡️',
    description: 'Continue the story in another scene.',
    keywords: ['goto', 'go to', 'next scene', 'jump'],
    fields: [{ key: 'sceneId', label: 'Scene', kind: 'scene' }],
    defaults: () => ({ sceneId: '' }),
    summary: (p, ctx) => `→ ${ctx.sceneName(p.sceneId)}`,
  },
  {
    type: 'endGame',
    label: 'End Game',
    category: 'story',
    alsoIn: ['game'],
    icon: '🏁',
    description: 'Show an ending screen and finish the game.',
    keywords: ['finish', 'ending', 'the end', 'credits'],
    fields: [{ key: 'message', label: 'Ending message', kind: 'text', placeholder: 'The End' }],
    defaults: () => ({ message: 'The End' }),
    summary: (p) => cut(p.message || t('The End')),
  },
  // ---------------- VISUAL ----------------
  {
    type: 'changeBackground',
    label: 'Change Background',
    category: 'visual',
    icon: '🏞️',
    description: 'Switch the background image or color.',
    keywords: ['background', 'bg', 'location', 'place', 'scene image', 'backdrop'],
    fields: [
      { key: 'assetId', label: 'Background', kind: 'asset', assetTypes: IMAGE_BG, media: 'image' },
      { key: 'color', label: 'Color (when no image)', kind: 'color' },
      ...transitionFields(),
    ],
    defaults: () => ({ assetId: '', color: '#1b1f2e', transition: 'fade', duration: 0.5 }),
    summary: (p, ctx) => `${p.assetId ? ctx.assetName(p.assetId) : p.color} · ${p.transition}`,
  },
  {
    type: 'showCG',
    label: 'Show CG',
    category: 'visual',
    icon: '🌄',
    description: 'Show a full-screen event illustration.',
    keywords: ['cg', 'event', 'illustration', 'artwork'],
    fields: [{ key: 'assetId', label: 'CG image', kind: 'asset', assetTypes: ['cg', 'background', 'unknown'], media: 'image' }, ...transitionFields()],
    defaults: () => ({ assetId: '', transition: 'fade', duration: 0.6 }),
    summary: (p, ctx) => ctx.assetName(p.assetId),
  },
  {
    type: 'hideCG',
    label: 'Hide CG',
    category: 'visual',
    icon: '🙈',
    description: 'Hide the current CG.',
    keywords: ['cg', 'hide', 'remove'],
    fields: transitionFields(),
    defaults: () => ({ transition: 'fade', duration: 0.5 }),
    summary: (p) => p.transition,
  },
  {
    type: 'showImage',
    label: 'Show Image',
    category: 'visual',
    icon: '🖼️',
    description: 'Place an image (item, effect, UI art) on screen.',
    keywords: ['image', 'picture', 'item', 'sprite', 'overlay'],
    fields: [
      { key: 'slot', label: 'Image name (to hide it later)', kind: 'text', placeholder: 'e.g. letter' },
      { key: 'assetId', label: 'Image', kind: 'asset', assetTypes: ['ui', 'cg', 'character', 'portrait', 'background', 'unknown'], media: 'image' },
      ...placementFields,
      ...transitionFields(),
    ],
    defaults: () => ({ slot: 'image1', assetId: '', x: 50, y: 70, scale: 1, rotation: 0, opacity: 1, flip: false, layer: 5, transition: 'fade', duration: 0.4 }),
    summary: (p, ctx) => `${p.slot}: ${ctx.assetName(p.assetId)}`,
  },
  {
    type: 'hideImage',
    label: 'Hide Image',
    category: 'visual',
    icon: '🚫',
    description: 'Remove an image shown with Show Image.',
    keywords: ['image', 'hide', 'remove'],
    fields: [{ key: 'slot', label: 'Image name', kind: 'text' }, ...transitionFields()],
    defaults: () => ({ slot: 'image1', transition: 'fade', duration: 0.4 }),
    summary: (p) => p.slot,
  },
  {
    type: 'screenEffect',
    label: 'Screen Effect',
    category: 'visual',
    icon: '✨',
    description: 'Shake or flash the screen.',
    keywords: ['shake', 'flash', 'effect', 'earthquake', 'animation'],
    fields: [
      { key: 'effect', label: 'Effect', kind: 'select', options: SCREEN_EFFECTS },
      { key: 'duration', label: 'Duration', kind: 'number', min: 0.1, max: 10, step: 0.1, unit: 's' },
    ],
    defaults: () => ({ effect: 'shake', duration: 0.6 }),
    summary: (p) => `${p.effect} (${p.duration}s)`,
  },
  {
    type: 'playVideo',
    label: 'Play Video',
    category: 'visual',
    icon: '🎬',
    description: 'Play a full-screen video (opening, cutscene).',
    keywords: ['video', 'movie', 'cutscene', 'opening'],
    fields: [
      { key: 'assetId', label: 'Video', kind: 'asset', assetTypes: ['video', 'unknown'], media: 'video' },
      { key: 'skippable', label: 'Player can skip', kind: 'boolean' },
    ],
    defaults: () => ({ assetId: '', skippable: true }),
    summary: (p, ctx) => ctx.assetName(p.assetId),
  },
  // ---------------- CHARACTER ----------------
  {
    type: 'addCharacter',
    label: 'Add Character',
    category: 'character',
    icon: '🧍',
    description: 'Bring a character on stage.',
    keywords: ['character', 'show', 'enter', 'sprite', 'appear'],
    fields: [
      { key: 'characterId', label: 'Character', kind: 'character' },
      { key: 'expressionId', label: 'Expression', kind: 'expression', characterKey: 'characterId' },
      ...placementFields,
      { key: 'enter', label: 'Enter animation', kind: 'select', options: ENTER_ANIMATIONS },
      { key: 'duration', label: 'Duration', kind: 'number', min: 0, max: 10, step: 0.1, unit: 's' },
    ],
    defaults: () => ({ characterId: '', expressionId: '', x: 50, y: 100, scale: 1, rotation: 0, opacity: 1, flip: false, layer: 1, enter: 'fade', duration: 0.4 }),
    summary: (p, ctx) => `${ctx.characterName(p.characterId)} (${ctx.expressionName(p.characterId, p.expressionId)}) ${t('at')} ${Math.round(p.x)}%`,
  },
  {
    type: 'removeCharacter',
    label: 'Remove Character',
    category: 'character',
    icon: '👋',
    description: 'Take a character off stage.',
    keywords: ['character', 'hide', 'exit', 'leave'],
    fields: [
      { key: 'characterId', label: 'Character', kind: 'character' },
      { key: 'exit', label: 'Exit animation', kind: 'select', options: EXIT_ANIMATIONS },
      { key: 'duration', label: 'Duration', kind: 'number', min: 0, max: 10, step: 0.1, unit: 's' },
    ],
    defaults: () => ({ characterId: '', exit: 'fade', duration: 0.4 }),
    summary: (p, ctx) => `${p.characterId ? ctx.characterName(p.characterId) : t('All characters')} · ${p.exit}`,
  },
  {
    type: 'moveCharacter',
    label: 'Move Character',
    category: 'character',
    icon: '↔️',
    description: 'Move a character to a new position.',
    keywords: ['character', 'move', 'walk', 'position', 'animation'],
    fields: [
      { key: 'characterId', label: 'Character', kind: 'character' },
      { key: 'x', label: 'X position', kind: 'slider', min: -20, max: 120, step: 1, unit: '%' },
      { key: 'y', label: 'Y position (bottom)', kind: 'slider', min: 0, max: 150, step: 1, unit: '%' },
      { key: 'scale', label: 'Scale', kind: 'slider', min: 0.1, max: 3, step: 0.05, unit: '×' },
      { key: 'duration', label: 'Duration', kind: 'number', min: 0, max: 10, step: 0.1, unit: 's' },
      { key: 'easing', label: 'Easing', kind: 'select', options: EASINGS },
    ],
    defaults: () => ({ characterId: '', x: 50, y: 100, scale: 1, duration: 0.6, easing: 'ease' }),
    summary: (p, ctx) => `${ctx.characterName(p.characterId)} → ${Math.round(p.x)}%`,
  },
  {
    type: 'changeExpression',
    label: 'Change Expression',
    category: 'character',
    icon: '😊',
    description: "Change a character's face/pose.",
    keywords: ['expression', 'emotion', 'face', 'pose', 'character'],
    fields: [
      { key: 'characterId', label: 'Character', kind: 'character' },
      { key: 'expressionId', label: 'Expression', kind: 'expression', characterKey: 'characterId' },
    ],
    defaults: () => ({ characterId: '', expressionId: '' }),
    summary: (p, ctx) => `${ctx.characterName(p.characterId)} → ${ctx.expressionName(p.characterId, p.expressionId)}`,
  },
  {
    type: 'animateCharacter',
    label: 'Animate Character',
    category: 'character',
    icon: '💫',
    description: 'Shake, bounce, spin… a character.',
    keywords: ['animation', 'shake', 'bounce', 'jump', 'character', 'effect'],
    fields: [
      { key: 'characterId', label: 'Character', kind: 'character' },
      { key: 'animation', label: 'Animation', kind: 'select', options: EMPHASIS_ANIMATIONS },
      { key: 'duration', label: 'Duration', kind: 'number', min: 0.1, max: 10, step: 0.1, unit: 's' },
      { key: 'custom', label: 'Custom animation', kind: 'customAnimation' },
      { key: 'wait', label: 'Wait until finished', kind: 'boolean' },
    ],
    defaults: () => ({
      characterId: '',
      animation: 'shake',
      duration: 0.5,
      custom: { from: { x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 }, to: { x: 0, y: -40, scale: 1.1, rotate: 0, opacity: 1 } },
      wait: false,
    }),
    visibleWhen: { custom: (p) => p.animation === 'custom' },
    summary: (p, ctx) => `${ctx.characterName(p.characterId)} · ${p.animation}`,
  },
  // ---------------- AUDIO ----------------
  {
    type: 'playBGM',
    label: 'Play BGM',
    category: 'audio',
    icon: '🎵',
    description: 'Start background music.',
    keywords: ['music', 'bgm', 'song', 'audio', 'play'],
    fields: [
      { key: 'assetId', label: 'Music', kind: 'asset', assetTypes: ['music', 'unknown'], media: 'audio' },
      { key: 'volume', label: 'Volume', kind: 'slider', min: 0, max: 100, step: 1, unit: '%' },
      { key: 'loop', label: 'Loop', kind: 'boolean' },
      { key: 'fade', label: 'Fade in', kind: 'number', min: 0, max: 10, step: 0.1, unit: 's' },
    ],
    defaults: () => ({ assetId: '', volume: 80, loop: true, fade: 1 }),
    summary: (p, ctx) => `${ctx.assetName(p.assetId)} · ${p.volume}%`,
  },
  {
    type: 'stopBGM',
    label: 'Stop BGM',
    category: 'audio',
    icon: '⏹️',
    description: 'Stop the background music.',
    keywords: ['music', 'bgm', 'stop', 'silence'],
    fields: [{ key: 'fade', label: 'Fade out', kind: 'number', min: 0, max: 10, step: 0.1, unit: 's' }],
    defaults: () => ({ fade: 1 }),
    summary: (p) => t('fade {s}s', { s: p.fade }),
  },
  {
    type: 'changeBGM',
    label: 'Change BGM',
    category: 'audio',
    icon: '🔁',
    description: 'Crossfade to different music.',
    keywords: ['music', 'bgm', 'change', 'switch', 'crossfade'],
    fields: [
      { key: 'assetId', label: 'Music', kind: 'asset', assetTypes: ['music', 'unknown'], media: 'audio' },
      { key: 'volume', label: 'Volume', kind: 'slider', min: 0, max: 100, step: 1, unit: '%' },
      { key: 'fade', label: 'Crossfade', kind: 'number', min: 0, max: 10, step: 0.1, unit: 's' },
    ],
    defaults: () => ({ assetId: '', volume: 80, fade: 1.5 }),
    summary: (p, ctx) => ctx.assetName(p.assetId),
  },
  {
    type: 'playSFX',
    label: 'Play SFX',
    category: 'audio',
    icon: '🔔',
    description: 'Play a sound effect.',
    keywords: ['sound', 'sfx', 'effect', 'se', 'audio'],
    fields: [
      { key: 'assetId', label: 'Sound', kind: 'asset', assetTypes: ['sfx', 'unknown'], media: 'audio' },
      { key: 'volume', label: 'Volume', kind: 'slider', min: 0, max: 100, step: 1, unit: '%' },
      { key: 'loop', label: 'Loop', kind: 'boolean' },
    ],
    defaults: () => ({ assetId: '', volume: 100, loop: false }),
    summary: (p, ctx) => ctx.assetName(p.assetId),
  },
  {
    type: 'stopSFX',
    label: 'Stop SFX',
    category: 'audio',
    icon: '🔕',
    description: 'Stop all sound effects.',
    keywords: ['sound', 'sfx', 'stop'],
    fields: [],
    defaults: () => ({}),
    summary: () => t('all sound effects'),
  },
  {
    type: 'playVoice',
    label: 'Play Voice',
    category: 'audio',
    icon: '🎙️',
    description: 'Play a voice clip.',
    keywords: ['voice', 'vo', 'speech', 'audio'],
    fields: [
      { key: 'assetId', label: 'Voice', kind: 'asset', assetTypes: ['voice', 'unknown'], media: 'audio' },
      { key: 'volume', label: 'Volume', kind: 'slider', min: 0, max: 100, step: 1, unit: '%' },
    ],
    defaults: () => ({ assetId: '', volume: 100 }),
    summary: (p, ctx) => ctx.assetName(p.assetId),
  },
  // ---------------- FLOW ----------------
  {
    type: 'wait',
    label: 'Wait for Click',
    category: 'flow',
    icon: '👆',
    description: 'Pause until the player clicks or taps.',
    keywords: ['wait', 'pause', 'click', 'tap'],
    fields: [],
    defaults: () => ({}),
    summary: () => t('until click / tap'),
  },
  {
    type: 'delay',
    label: 'Delay',
    category: 'flow',
    icon: '⏱️',
    description: 'Pause for a number of seconds.',
    keywords: ['wait', 'delay', 'time', 'seconds', 'pause', 'sleep'],
    fields: [{ key: 'seconds', label: 'Seconds', kind: 'number', min: 0, max: 60, step: 0.1, unit: 's' }],
    defaults: () => ({ seconds: 1 }),
    summary: (p) => `${p.seconds}s`,
  },
  {
    type: 'label',
    label: 'Label',
    category: 'flow',
    icon: '🏷️',
    description: 'A named point you can jump to.',
    keywords: ['label', 'marker', 'anchor', 'bookmark'],
    fields: [{ key: 'name', label: 'Label name', kind: 'text', placeholder: 'e.g. after_fight' }],
    defaults: () => ({ name: 'label' }),
    summary: (p) => p.name,
  },
  {
    type: 'jump',
    label: 'Jump',
    category: 'flow',
    icon: '↪️',
    description: 'Jump to a label, scene or action.',
    keywords: ['jump', 'goto', 'go to', 'label'],
    fields: [{ key: 'target', label: 'Jump to', kind: 'target' }],
    defaults: () => ({ target: { kind: 'label', label: '' } }),
    summary: (p, ctx) => describeTarget(p.target, ctx),
  },
  {
    type: 'conditional',
    label: 'Conditional Branch',
    category: 'flow',
    icon: '❓',
    description: 'Go different ways depending on variables.',
    keywords: ['if', 'condition', 'branch', 'check', 'else', 'ending'],
    fields: [
      { key: 'logic', label: 'Match', kind: 'select', options: [{ value: 'all', label: 'All conditions (AND)' }, { value: 'any', label: 'Any condition (OR)' }] },
      { key: 'conditions', label: 'Conditions', kind: 'conditions' },
      { key: 'then', label: 'If true, go to', kind: 'target', allowNext: true },
      { key: 'else', label: 'Otherwise, go to', kind: 'target', allowNext: true },
    ],
    defaults: () => ({ logic: 'all', conditions: [], then: { kind: 'next' }, else: { kind: 'next' } }),
    summary: (p, ctx) =>
      `${t('if')} ${(p.conditions ?? []).map((c: any) => `${ctx.variableName(c.variableId)} ${c.op} ${String(c.value)}`).join(` ${p.logic === 'any' ? t('or') : t('and')} `) || t('(no conditions)')} → ${describeTarget(p.then, ctx)} ${t('else')} ${describeTarget(p.else, ctx)}`,
  },
  // ---------------- VARIABLE ----------------
  {
    type: 'setVariable',
    label: 'Set Variable',
    category: 'variable',
    icon: '📝',
    description: 'Set a variable to a value.',
    keywords: ['variable', 'set', 'value', 'flag'],
    fields: [
      { key: 'variableId', label: 'Variable', kind: 'variable' },
      { key: 'value', label: 'Value', kind: 'varValue', variableKey: 'variableId' },
    ],
    defaults: () => ({ variableId: '', value: 0 }),
    summary: (p, ctx) => `${ctx.variableName(p.variableId)} = ${String(p.value)}`,
  },
  {
    type: 'addVariable',
    label: 'Add Value',
    category: 'variable',
    icon: '➕',
    description: 'Increase a number variable.',
    keywords: ['variable', 'add', 'increase', 'plus', 'points', 'love'],
    fields: [
      { key: 'variableId', label: 'Variable', kind: 'variable' },
      { key: 'amount', label: 'Amount', kind: 'number', step: 1 },
    ],
    defaults: () => ({ variableId: '', amount: 1 }),
    summary: (p, ctx) => `${ctx.variableName(p.variableId)} + ${p.amount}`,
  },
  {
    type: 'subtractVariable',
    label: 'Subtract Value',
    category: 'variable',
    icon: '➖',
    description: 'Decrease a number variable.',
    keywords: ['variable', 'subtract', 'decrease', 'minus'],
    fields: [
      { key: 'variableId', label: 'Variable', kind: 'variable' },
      { key: 'amount', label: 'Amount', kind: 'number', step: 1 },
    ],
    defaults: () => ({ variableId: '', amount: 1 }),
    summary: (p, ctx) => `${ctx.variableName(p.variableId)} − ${p.amount}`,
  },
  {
    type: 'checkVariable',
    label: 'Check Variable',
    category: 'variable',
    icon: '🔍',
    description: 'If a variable matches, jump somewhere.',
    keywords: ['variable', 'check', 'if', 'compare', 'condition'],
    fields: [
      { key: 'variableId', label: 'Variable', kind: 'variable' },
      { key: 'op', label: 'Comparison', kind: 'compareOp' },
      { key: 'value', label: 'Value', kind: 'varValue', variableKey: 'variableId' },
      { key: 'target', label: 'If true, go to', kind: 'target' },
    ],
    defaults: () => ({ variableId: '', op: '>=', value: 0, target: { kind: 'label', label: '' } }),
    summary: (p, ctx) => `${t('if')} ${ctx.variableName(p.variableId)} ${p.op} ${String(p.value)} → ${describeTarget(p.target, ctx)}`,
  },
  // ---------------- GAME ----------------
  {
    type: 'saveGame',
    label: 'Save',
    category: 'game',
    icon: '💾',
    description: 'Open the save screen or quick-save.',
    keywords: ['save', 'checkpoint'],
    fields: [{ key: 'mode', label: 'Mode', kind: 'select', options: [{ value: 'menu', label: 'Open save screen' }, { value: 'auto', label: 'Auto-save silently' }] }],
    defaults: () => ({ mode: 'auto' }),
    summary: (p) => (p.mode === 'menu' ? t('open save screen') : t('auto-save')),
  },
  {
    type: 'loadGame',
    label: 'Load',
    category: 'game',
    icon: '📂',
    description: 'Open the load screen.',
    keywords: ['load', 'restore'],
    fields: [],
    defaults: () => ({}),
    summary: () => t('open load screen'),
  },
  {
    type: 'changeScene',
    label: 'Change Scene',
    category: 'game',
    icon: '🎞️',
    description: 'Fade out and continue in another scene (resets the stage).',
    keywords: ['scene', 'change', 'transition', 'goto'],
    fields: [
      { key: 'sceneId', label: 'Scene', kind: 'scene' },
      { key: 'clearStage', label: 'Clear characters and images', kind: 'boolean' },
    ],
    defaults: () => ({ sceneId: '', clearStage: true }),
    summary: (p, ctx) => `→ ${ctx.sceneName(p.sceneId)}`,
  },
  {
    type: 'returnToTitle',
    label: 'Return to Title',
    category: 'game',
    icon: '🏠',
    description: 'Go back to the title screen.',
    keywords: ['title', 'menu', 'home', 'quit'],
    fields: [],
    defaults: () => ({}),
    summary: () => t('title screen'),
  },
];

const DEF_MAP = new Map<ActionType, ActionDef>(ACTION_DEFS.map((d) => [d.type, d]));

export function getActionDef(type: ActionType): ActionDef {
  const d = DEF_MAP.get(type);
  if (!d) throw new Error(`Unknown action type: ${type}`);
  return d;
}

export function isKnownActionType(type: string): type is ActionType {
  return DEF_MAP.has(type as ActionType);
}

export function createAction(type: ActionType, params: Record<string, any> = {}): Action {
  const def = getActionDef(type);
  return { id: newId('a'), type, params: { ...def.defaults(), ...params } };
}

/** Duplicates actions with fresh ids (also for nested choice option ids). */
export function cloneActions(actions: Action[]): Action[] {
  return actions.map((a) => {
    const copy: Action = JSON.parse(JSON.stringify(a));
    copy.id = newId('a');
    if (copy.type === 'choice' && Array.isArray(copy.params.options)) {
      copy.params.options = copy.params.options.map((o: any) => ({ ...o, id: newId('o') }));
    }
    return copy;
  });
}

export function actionsInCategory(cat: ActionCategory): ActionDef[] {
  return ACTION_DEFS.filter((d) => d.category === cat || d.alsoIn?.includes(cat));
}

/** Search action definitions by label, description and keywords. */
export function searchActions(query: string): ActionDef[] {
  const q = query.trim().toLowerCase();
  if (!q) return ACTION_DEFS;
  const scored: { d: ActionDef; s: number }[] = [];
  for (const d of ACTION_DEFS) {
    // Match the English text and the current UI language.
    const labels = [d.label.toLowerCase(), t(d.label).toLowerCase()];
    const descs = [d.description.toLowerCase(), t(d.description).toLowerCase()];
    let s = 0;
    if (labels.some((l) => l === q)) s = 100;
    else if (labels.some((l) => l.startsWith(q))) s = 80;
    else if (labels.some((l) => l.includes(q))) s = 60;
    else if (d.keywords.some((k) => k.startsWith(q))) s = 40;
    else if (d.keywords.some((k) => k.includes(q))) s = 30;
    else if (descs.some((x) => x.includes(q))) s = 10;
    if (s > 0) scored.push({ d, s });
  }
  return scored.sort((a, b) => b.s - a.s).map((x) => x.d);
}
