import type { Action, GameData } from '../../shared/types';
import { POSITION_X } from '../../shared/stage';

export interface CharState {
  id: string;
  expressionId: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
  flip: boolean;
  layer: number;
}

export interface ImageState {
  slot: string;
  assetId: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
  flip: boolean;
  layer: number;
}

export interface VisualState {
  background: { assetId?: string; color?: string } | null;
  cg: string | null;
  characters: CharState[];
  images: ImageState[];
  bgm: { assetId: string; volume: number; loop: boolean } | null;
}

/** How an element should change when the state is rendered. */
export interface ChangeHint {
  target: string; // 'background' | 'cg' | 'bgm' | `char:${id}` | `image:${slot}`
  transition?: string;
  duration?: number;
  enter?: string;
  exit?: string;
  move?: { duration: number; easing: string };
  fade?: number;
}

export function emptyVisualState(): VisualState {
  return { background: null, cg: null, characters: [], images: [], bgm: null };
}

const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);

function defaultExpression(game: Pick<GameData, 'characters'>, characterId: string): string {
  const c = game.characters.find((x) => x.id === characterId);
  return c?.defaultExpressionId ?? c?.expressions[0]?.id ?? '';
}

/** Actions that change the visual/audio state. */
export const STATE_ACTION_TYPES = new Set([
  'changeBackground',
  'showCG',
  'hideCG',
  'showImage',
  'hideImage',
  'addCharacter',
  'removeCharacter',
  'moveCharacter',
  'changeExpression',
  'playBGM',
  'changeBGM',
  'stopBGM',
  'dialogue',
]);

/**
 * Pure reducer: applies a state-changing action and returns the new state plus
 * hints describing how the change should be animated. Unknown/non-visual actions
 * return the same state and no hints.
 */
export function applyStateAction(
  prev: VisualState,
  a: Action,
  game: Pick<GameData, 'characters'>,
): { state: VisualState; hints: ChangeHint[] } {
  const p = a.params ?? {};
  const s: VisualState = {
    background: prev.background,
    cg: prev.cg,
    characters: prev.characters,
    images: prev.images,
    bgm: prev.bgm,
  };
  const hints: ChangeHint[] = [];
  switch (a.type) {
    case 'changeBackground':
      s.background = p.assetId ? { assetId: p.assetId } : { color: p.color || '#000000' };
      hints.push({ target: 'background', transition: p.transition, duration: num(p.duration, 0.5) });
      break;
    case 'showCG':
      if (p.assetId) {
        s.cg = p.assetId;
        hints.push({ target: 'cg', transition: p.transition, duration: num(p.duration, 0.5) });
      }
      break;
    case 'hideCG':
      s.cg = null;
      hints.push({ target: 'cg', transition: p.transition, duration: num(p.duration, 0.5) });
      break;
    case 'showImage': {
      const slot = String(p.slot || 'image1');
      const img: ImageState = {
        slot,
        assetId: p.assetId || '',
        x: num(p.x, 50),
        y: num(p.y, 70),
        scale: num(p.scale, 1),
        rotation: num(p.rotation, 0),
        opacity: num(p.opacity, 1),
        flip: !!p.flip,
        layer: num(p.layer, 5),
      };
      s.images = [...prev.images.filter((i) => i.slot !== slot), img];
      hints.push({ target: `image:${slot}`, transition: p.transition, duration: num(p.duration, 0.4) });
      break;
    }
    case 'hideImage': {
      const slot = String(p.slot || 'image1');
      s.images = prev.images.filter((i) => i.slot !== slot);
      hints.push({ target: `image:${slot}`, transition: p.transition, duration: num(p.duration, 0.4) });
      break;
    }
    case 'addCharacter': {
      if (!p.characterId) break;
      const ch: CharState = {
        id: p.characterId,
        expressionId: p.expressionId || defaultExpression(game, p.characterId),
        x: num(p.x, 50),
        y: num(p.y, 100),
        scale: num(p.scale, 1),
        rotation: num(p.rotation, 0),
        opacity: num(p.opacity, 1),
        flip: !!p.flip,
        layer: num(p.layer, 1),
      };
      const existed = prev.characters.some((c) => c.id === ch.id);
      s.characters = existed ? prev.characters.map((c) => (c.id === ch.id ? ch : c)) : [...prev.characters, ch];
      hints.push(existed ? { target: `char:${ch.id}`, move: { duration: num(p.duration, 0.4), easing: 'ease' } } : { target: `char:${ch.id}`, enter: p.enter, duration: num(p.duration, 0.4) });
      break;
    }
    case 'removeCharacter': {
      const removed = p.characterId ? prev.characters.filter((c) => c.id === p.characterId) : prev.characters;
      s.characters = p.characterId ? prev.characters.filter((c) => c.id !== p.characterId) : [];
      for (const c of removed) hints.push({ target: `char:${c.id}`, exit: p.exit, duration: num(p.duration, 0.4) });
      break;
    }
    case 'moveCharacter':
      s.characters = prev.characters.map((c) => (c.id === p.characterId ? { ...c, x: num(p.x, c.x), y: num(p.y, c.y), scale: num(p.scale, c.scale) } : c));
      hints.push({ target: `char:${p.characterId}`, move: { duration: num(p.duration, 0.6), easing: p.easing || 'ease' } });
      break;
    case 'changeExpression':
      s.characters = prev.characters.map((c) => (c.id === p.characterId && p.expressionId ? { ...c, expressionId: p.expressionId } : c));
      hints.push({ target: `char:${p.characterId}` });
      break;
    case 'dialogue': {
      if (!p.speaker) break;
      const onStage = prev.characters.find((c) => c.id === p.speaker);
      const pos = p.position && p.position !== 'keep' ? POSITION_X[p.position] : undefined;
      if (onStage) {
        if (p.expressionId || pos !== undefined) {
          s.characters = prev.characters.map((c) =>
            c.id === p.speaker ? { ...c, expressionId: p.expressionId || c.expressionId, x: pos ?? c.x } : c,
          );
          hints.push({ target: `char:${p.speaker}`, move: { duration: 0.35, easing: 'ease' } });
        }
      } else if (p.expressionId || pos !== undefined) {
        s.characters = [
          ...prev.characters,
          {
            id: p.speaker,
            expressionId: p.expressionId || defaultExpression(game, p.speaker),
            x: pos ?? 50,
            y: 100,
            scale: 1,
            rotation: 0,
            opacity: 1,
            flip: false,
            layer: 1,
          },
        ];
        hints.push({ target: `char:${p.speaker}`, enter: 'fade', duration: 0.3 });
      }
      break;
    }
    case 'playBGM':
    case 'changeBGM':
      if (p.assetId) {
        s.bgm = { assetId: p.assetId, volume: num(p.volume, 80), loop: a.type === 'changeBGM' ? true : p.loop !== false };
        hints.push({ target: 'bgm', fade: num(p.fade, 1) });
      }
      break;
    case 'stopBGM':
      s.bgm = null;
      hints.push({ target: 'bgm', fade: num(p.fade, 1) });
      break;
  }
  return { state: s, hints };
}

export type VarValues = Record<string, number | string | boolean>;

export function initialVars(game: Pick<GameData, 'variables'>): VarValues {
  const v: VarValues = {};
  for (const x of game.variables) v[x.id] = x.initial;
  return v;
}

export function coerceValue(type: string | undefined, value: unknown): number | string | boolean {
  if (type === 'number') {
    const n = typeof value === 'number' ? value : parseFloat(String(value));
    return Number.isFinite(n) ? n : 0;
  }
  if (type === 'boolean') return value === true || value === 'true' || value === 1 || value === '1';
  return value === undefined || value === null ? '' : String(value);
}

/** Pure reducer for variable actions. Returns the same object when nothing changes. */
export function applyVarAction(vars: VarValues, a: Action, game: Pick<GameData, 'variables'>): VarValues {
  const p = a.params ?? {};
  const def = game.variables.find((v) => v.id === p.variableId);
  if (!def) return vars;
  switch (a.type) {
    case 'setVariable':
      return { ...vars, [def.id]: coerceValue(def.type, p.value) };
    case 'addVariable':
    case 'subtractVariable': {
      const cur = coerceValue('number', vars[def.id]) as number;
      const amt = coerceValue('number', p.amount) as number;
      return { ...vars, [def.id]: a.type === 'addVariable' ? cur + amt : cur - amt };
    }
    default:
      return vars;
  }
}

/**
 * Computes the stage/variables at a given action index of a scene by replaying
 * all earlier state actions (used by Play From Here and the editor stage view).
 */
export function stateBeforeAction(
  game: Pick<GameData, 'characters' | 'variables'>,
  actions: Action[],
  index: number,
  start: VisualState = emptyVisualState(),
): { state: VisualState; vars: VarValues; sources: Record<string, string> } {
  let state = start;
  let vars = initialVars(game);
  const sources: Record<string, string> = {};
  for (let i = 0; i < Math.min(index, actions.length); i++) {
    const a = actions[i];
    if (a.disabled) continue;
    const r = applyStateAction(state, a, game);
    state = r.state;
    for (const h of r.hints) sources[h.target] = a.id;
    vars = applyVarAction(vars, a, game);
  }
  return { state, vars, sources };
}
