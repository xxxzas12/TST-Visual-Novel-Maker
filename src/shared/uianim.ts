// Game UI animations: how the dialogue box, its text and the choice buttons appear and disappear.
// Beginners pick a preset (Fade, Slide Up, Pop…) and get a sensible duration, easing and distance;
// every value can still be changed in Advanced. The same keyframes are used by the editor preview and the game.

export type AnimKind = 'none' | 'fade' | 'slide' | 'pop' | 'scale' | 'bounce' | 'shake' | 'pulse';
export type AnimDirection = 'up' | 'down' | 'left' | 'right';
export type AnimEasing = 'ease' | 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'back' | 'elastic';

export interface AnimSpec {
  kind: AnimKind;
  /** Where a slide or bounce comes from (entrance) or goes to (exit). */
  direction: AnimDirection;
  /** Seconds. */
  duration: number;
  /** Seconds before it starts. */
  delay: number;
  easing: AnimEasing;
  /** How far it travels, design px (slide, bounce, shake). */
  distance: number;
  /** Size at the start of an entrance (pop, scale; 1 = normal). */
  scale: number;
  /** Rotation at the start of an entrance, degrees. */
  rotate: number;
  /** Opacity at the start of an entrance (0 = invisible). */
  opacity: number;
}

export type TextReveal = 'typewriter' | 'word' | 'fade' | 'instant';
export type IndicatorAnim = 'bounce' | 'pulse' | 'blink' | 'none';

export interface ThemeAnimations {
  /** Dialogue box appearing. */
  dialogIn: AnimSpec;
  /** Dialogue box disappearing (before choices without a question, point & click). */
  dialogOut: AnimSpec;
  /** How the words appear inside the box (speed = the text speed). */
  text: TextReveal;
  /** Each choice button appearing. */
  choicesIn: AnimSpec;
  /** Seconds between one button and the next (0 = all together). */
  choiceStagger: number;
  /** The "click to continue" mark. */
  indicator: IndicatorAnim;
}

/** Sensible values for each kind; picking a preset applies these. */
const DEFAULTS: Record<AnimKind, Omit<AnimSpec, 'kind' | 'direction' | 'delay'>> = {
  none: { duration: 0, easing: 'ease', distance: 0, scale: 1, rotate: 0, opacity: 1 },
  fade: { duration: 0.3, easing: 'ease-out', distance: 0, scale: 1, rotate: 0, opacity: 0 },
  slide: { duration: 0.35, easing: 'ease-out', distance: 40, scale: 1, rotate: 0, opacity: 0 },
  pop: { duration: 0.35, easing: 'back', distance: 0, scale: 0.6, rotate: 0, opacity: 0 },
  scale: { duration: 0.3, easing: 'ease-out', distance: 0, scale: 0.85, rotate: 0, opacity: 0 },
  bounce: { duration: 0.6, easing: 'ease-out', distance: 50, scale: 1, rotate: 0, opacity: 0 },
  shake: { duration: 0.45, easing: 'linear', distance: 16, scale: 1, rotate: 0, opacity: 1 },
  pulse: { duration: 0.45, easing: 'ease-in-out', distance: 0, scale: 0.92, rotate: 0, opacity: 1 },
};

/** A preset as offered in the simple dropdown: a kind plus (for slides) a direction. */
export interface AnimPresetOption {
  value: string;
  label: string;
  kind: AnimKind;
  direction: AnimDirection;
}

const opt = (value: string, label: string, kind: AnimKind, direction: AnimDirection = 'up'): AnimPresetOption => ({ value, label, kind, direction });

export const ENTRANCE_PRESETS: AnimPresetOption[] = [
  opt('none', 'None', 'none'),
  opt('fade', 'Fade In', 'fade'),
  opt('slide-up', 'Slide Up', 'slide', 'up'),
  opt('slide-down', 'Slide Down', 'slide', 'down'),
  opt('slide-left', 'Slide from Right', 'slide', 'left'),
  opt('slide-right', 'Slide from Left', 'slide', 'right'),
  opt('pop', 'Pop', 'pop'),
  opt('scale', 'Scale', 'scale'),
  opt('bounce', 'Bounce', 'bounce'),
  opt('shake', 'Shake', 'shake'),
  opt('pulse', 'Pulse', 'pulse'),
];

export const EXIT_PRESETS: AnimPresetOption[] = [
  opt('none', 'None', 'none'),
  opt('fade', 'Fade Out', 'fade'),
  opt('slide-down', 'Slide Down', 'slide', 'down'),
  opt('slide-up', 'Slide Up', 'slide', 'up'),
  opt('slide-left', 'Slide Left', 'slide', 'left'),
  opt('slide-right', 'Slide Right', 'slide', 'right'),
  opt('scale', 'Shrink', 'scale'),
];

export const EASING_OPTIONS: { value: AnimEasing; label: string }[] = [
  { value: 'ease-out', label: 'Ease Out (smooth stop)' },
  { value: 'ease', label: 'Smooth' },
  { value: 'ease-in', label: 'Ease In (smooth start)' },
  { value: 'ease-in-out', label: 'Ease In-Out' },
  { value: 'linear', label: 'Linear' },
  { value: 'back', label: 'Overshoot' },
  { value: 'elastic', label: 'Springy' },
];

export const TEXT_REVEALS: { value: TextReveal; label: string }[] = [
  { value: 'typewriter', label: 'Typewriter (letter by letter)' },
  { value: 'word', label: 'Word by word' },
  { value: 'fade', label: 'Fade in' },
  { value: 'instant', label: 'Instant' },
];

export const INDICATOR_ANIMS: { value: IndicatorAnim; label: string }[] = [
  { value: 'bounce', label: 'Bounce' },
  { value: 'pulse', label: 'Pulse' },
  { value: 'blink', label: 'Blink' },
  { value: 'none', label: 'Still' },
];

/** A spec with the preset's sensible values. */
export function animPreset(value: string, list: AnimPresetOption[] = ENTRANCE_PRESETS): AnimSpec {
  const o = list.find((x) => x.value === value) ?? list[0];
  return { kind: o.kind, direction: o.direction, delay: 0, ...DEFAULTS[o.kind] };
}

/** Which dropdown entry a spec belongs to ('custom' when changed by hand is still shown as its preset). */
export function presetValue(s: AnimSpec, list: AnimPresetOption[] = ENTRANCE_PRESETS): string {
  return (list.find((o) => o.kind === s.kind && (s.kind !== 'slide' || o.direction === s.direction)) ?? list.find((o) => o.kind === s.kind) ?? list[0]).value;
}

export function defaultAnimations(): ThemeAnimations {
  return {
    dialogIn: { ...animPreset('fade'), duration: 0.25, easing: 'ease' },
    dialogOut: animPreset('none', EXIT_PRESETS),
    text: 'typewriter',
    choicesIn: animPreset('none'),
    choiceStagger: 0.06,
    indicator: 'bounce',
  };
}

/** The animation set equivalent to the old single "dialogue box animation" setting (fade / slide / none). */
export function animationsFromLegacy(animation: string | undefined): ThemeAnimations {
  const a = defaultAnimations();
  if (animation === 'none') a.dialogIn = animPreset('none');
  else if (animation === 'slide') a.dialogIn = { ...animPreset('slide-up'), duration: 0.25, easing: 'ease', distance: 30 };
  return a;
}

/** The old setting closest to an entrance (kept up to date for older TSTVN versions). */
export function legacyAnimation(s: AnimSpec): 'fade' | 'slide' | 'none' {
  return s.kind === 'none' ? 'none' : s.kind === 'slide' || s.kind === 'bounce' ? 'slide' : 'fade';
}

const KINDS: AnimKind[] = ['none', 'fade', 'slide', 'pop', 'scale', 'bounce', 'shake', 'pulse'];
const DIRS: AnimDirection[] = ['up', 'down', 'left', 'right'];
const EASINGS = EASING_OPTIONS.map((e) => e.value);
const num = (v: unknown, min: number, max: number, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
};

/** Repairs a spec read from a file. */
export function normalizeSpec(raw: unknown, fallback: AnimSpec): AnimSpec {
  if (!raw || typeof raw !== 'object') return { ...fallback };
  const o = raw as Partial<AnimSpec>;
  const kind = KINDS.includes(o.kind as AnimKind) ? (o.kind as AnimKind) : fallback.kind;
  const d = { ...fallback, ...(kind !== fallback.kind ? DEFAULTS[kind] : {}) };
  return {
    kind,
    direction: DIRS.includes(o.direction as AnimDirection) ? (o.direction as AnimDirection) : d.direction,
    duration: num(o.duration, 0, 5, d.duration),
    delay: num(o.delay, 0, 5, d.delay),
    easing: EASINGS.includes(o.easing as AnimEasing) ? (o.easing as AnimEasing) : d.easing,
    distance: num(o.distance, 0, 1000, d.distance),
    scale: num(o.scale, 0, 3, d.scale),
    rotate: num(o.rotate, -360, 360, d.rotate),
    opacity: num(o.opacity, 0, 1, d.opacity),
  };
}

export function normalizeAnimations(raw: unknown, legacy: string | undefined): ThemeAnimations {
  const base = animationsFromLegacy(legacy);
  if (!raw || typeof raw !== 'object') return base;
  const o = raw as Partial<ThemeAnimations>;
  return {
    dialogIn: normalizeSpec(o.dialogIn, base.dialogIn),
    dialogOut: normalizeSpec(o.dialogOut, base.dialogOut),
    text: TEXT_REVEALS.some((t) => t.value === o.text) ? (o.text as TextReveal) : base.text,
    choicesIn: normalizeSpec(o.choicesIn, base.choicesIn),
    choiceStagger: num(o.choiceStagger, 0, 1, base.choiceStagger),
    indicator: INDICATOR_ANIMS.some((t) => t.value === o.indicator) ? (o.indicator as IndicatorAnim) : base.indicator,
  };
}

export interface AnimKeyframe {
  transform?: string;
  opacity?: number;
  offset?: number;
}

/**
 * Keyframes for an entrance ('in') or exit ('out'). `px` converts design px to screen px (the UI scale).
 * Exits are entrances played backwards, so "Slide Down" leaves downwards.
 */
export function animFrames(s: AnimSpec, phase: 'in' | 'out', px = 1): AnimKeyframe[] | null {
  if (s.kind === 'none' || s.duration <= 0) return null;
  const d = s.distance * px;
  const rot = s.rotate ? ` rotate(${s.rotate}deg)` : '';
  // An entrance "slides up" from below; an exit "slides down" towards below.
  const sign = phase === 'in' ? -1 : 1;
  const away = { up: `translateY(${-sign * d}px)`, down: `translateY(${sign * d}px)`, left: `translateX(${-sign * d}px)`, right: `translateX(${sign * d}px)` }[s.direction];
  const t = (x: string) => (x + rot).trim() || 'none';
  let frames: AnimKeyframe[];
  switch (s.kind) {
    case 'fade':
      frames = [{ opacity: s.opacity, transform: t('') }, { opacity: 1, transform: 'none' }];
      break;
    case 'slide':
      frames = [{ transform: t(away), opacity: s.opacity }, { transform: 'none', opacity: 1 }];
      break;
    case 'pop':
      frames = [{ transform: t(`scale(${s.scale})`), opacity: s.opacity }, { transform: `scale(${1 + (1 - s.scale) * 0.15})`, opacity: 1, offset: 0.7 }, { transform: 'none', opacity: 1 }];
      break;
    case 'scale':
      frames = [{ transform: t(`scale(${s.scale})`), opacity: s.opacity }, { transform: 'none', opacity: 1 }];
      break;
    case 'bounce': {
      const from = phase === 'in' ? away : `translateY(${d}px)`;
      frames = [
        { transform: t(from), opacity: s.opacity },
        { transform: 'none', opacity: 1, offset: 0.55 },
        { transform: `translateY(${-d * 0.25}px)`, opacity: 1, offset: 0.75 },
        { transform: 'none', opacity: 1 },
      ];
      break;
    }
    case 'shake':
      frames = [0, -1, 0.9, -0.7, 0.5, -0.3, 0.15, 0].map((k) => ({ transform: k ? `translateX(${k * d}px)` : 'none', opacity: k === 0 ? undefined : 1 }));
      frames[0] = { transform: t(''), opacity: s.opacity };
      break;
    case 'pulse':
      frames = [{ transform: t(`scale(${s.scale})`), opacity: s.opacity }, { transform: `scale(${2 - s.scale})`, opacity: 1, offset: 0.5 }, { transform: 'none', opacity: 1 }];
      break;
    default:
      return null;
  }
  frames = frames.map((f) => Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined)) as AnimKeyframe);
  return phase === 'in' ? frames : [...frames].reverse().map((f) => (f.offset !== undefined ? { ...f, offset: 1 - f.offset } : f));
}

/** CSS easing for an easing name. */
export function easingCss(e: AnimEasing | string | undefined): string {
  switch (e) {
    case 'linear':
    case 'ease-in':
    case 'ease-out':
    case 'ease-in-out':
      return e;
    case 'back':
      return 'cubic-bezier(0.34, 1.56, 0.64, 1)';
    case 'elastic':
      return 'cubic-bezier(0.5, 1.8, 0.4, 0.8)';
    default:
      return 'ease';
  }
}
