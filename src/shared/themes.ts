// Game UI themes: presets, migration of older theme files, and helpers shared by editor and runtime.
import type { ChoiceStateStyle, FontRef, MenuAction, MenuButtonDef, Theme, UiAnchor, UiLength, UiShadow, UiSurface, UiText } from './types';

export const SANS = '"Segoe UI", "Leelawadee UI", "Noto Sans Thai", "Noto Sans", system-ui, sans-serif';
const SERIF = 'Georgia, "Times New Roman", "Noto Serif Thai", serif';
const STORY = '"Palatino Linotype", "Book Antiqua", Palatino, "Noto Serif Thai", serif';
const ROUNDED = '"Trebuchet MS", "Segoe UI", "Leelawadee UI", "Noto Sans Thai", sans-serif';
const MONO = '"Courier New", Consolas, "Leelawadee UI", monospace';

export const MENU_ACTIONS: MenuAction[] = ['auto', 'skip', 'save', 'load', 'settings', 'hide', 'menu'];
export const UI_ANCHORS: UiAnchor[] = ['top-left', 'top', 'top-right', 'left', 'center', 'right', 'bottom-left', 'bottom', 'bottom-right'];

export const px = (value: number): UiLength => ({ value, unit: 'px' });

const NO_SHADOW: UiShadow = { size: 0, y: 0, color: '#000000', opacity: 0.4 };
const shadow = (size: number, y: number, opacity = 0.4, color = '#000000'): UiShadow => ({ size, y, color, opacity });

function surface(p: Partial<UiSurface>): UiSurface {
  return { background: '#101420', image: null, imageFit: 'stretch', opacity: 1, borderColor: '#ffffff', borderWidth: 0, radius: 0, shadow: NO_SHADOW, blur: 0, ...p };
}

function text(p: Partial<UiText>): UiText {
  return { font: null, size: 38, color: '#ffffff', lineHeight: 1.55, letterSpacing: 0, align: 'left', bold: false, shadow: false, ...p };
}

const st = (background: string, color: string, borderColor: string, opacity = 1): ChoiceStateStyle => ({ background, color, borderColor, opacity });

export function defaultMenuButtons(): MenuButtonDef[] {
  return [
    { id: 'mb-auto', action: 'auto', label: '', hideOnMobile: false },
    { id: 'mb-save', action: 'save', label: '', hideOnMobile: false },
    { id: 'mb-load', action: 'load', label: '', hideOnMobile: true },
    { id: 'mb-hide', action: 'hide', label: '', hideOnMobile: true },
    { id: 'mb-menu', action: 'menu', label: '☰', hideOnMobile: false },
  ];
}

/** The Modern preset — also the defaults every other theme is completed with. */
function modern(): Theme {
  return {
    id: 'modern',
    name: 'Modern',
    preset: 'modern',
    version: 2,
    font: SANS,
    fontFace: null,
    dialog: {
      anchor: 'bottom',
      x: px(0),
      y: px(24),
      width: px(1680),
      height: px(270),
      padding: { x: 48, y: 34 },
      surface: surface({ background: '#101420', opacity: 0.82, radius: 22, shadow: shadow(48, 12, 0.45) }),
      text: text({}),
      textSpeed: null,
    },
    nameBox: {
      enabled: true,
      attach: 'inside',
      align: 'left',
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      padding: { x: 26, y: 6 },
      surface: surface({ background: '#3d55e0', radius: 12 }),
      text: text({ size: 34, bold: true, lineHeight: 1.35 }),
      speakerColor: true,
    },
    choice: {
      anchor: 'center',
      x: px(0),
      y: px(0),
      width: px(1000),
      minWidth: 360,
      height: 78,
      padding: { x: 40, y: 18 },
      spacing: 20,
      surface: surface({ borderWidth: 2, radius: 18, shadow: shadow(24, 8, 0.35) }),
      text: text({ size: 35, align: 'center', lineHeight: 1.35 }),
      states: {
        normal: st('#101420', '#ffffff', '#8090ff', 0.88),
        hover: st('#3d55e0', '#ffffff', '#ffffff'),
        pressed: st('#2f45c2', '#ffffff', '#ffffff'),
        disabled: st('#101420', '#9aa0b4', '#454b60', 0.6),
      },
      hoverAnimation: 'grow',
      pressAnimation: 'shrink',
      animationSpeed: 0.15,
    },
    menuBar: {
      enabled: true,
      anchor: 'top-right',
      x: px(16),
      y: px(16),
      direction: 'row',
      spacing: 10,
      height: 52,
      minWidth: 52,
      padding: { x: 22, y: 0 },
      surface: surface({ background: '#000000', opacity: 0.62, borderColor: '#ffffff', borderWidth: 1.5, radius: 999 }),
      text: text({ size: 20, bold: true, align: 'center', lineHeight: 1.2 }),
      hover: { background: '#3d55e0', color: '#ffffff' },
      buttons: defaultMenuButtons(),
    },
    menu: { background: '#0b0e18', color: '#ffffff', accent: '#4f6bff', opacity: 0.94 },
    animation: 'fade',
    accessibility: { minFontSize: 14, minTouchTarget: 44, highContrast: false },
  };
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends (infer U)[] ? U[] : T[K] extends object ? DeepPartial<T[K]> : T[K] };

function isPlain(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Deep-merges `over` into `base`, keeping only values whose type matches the base
 * (protects the runtime from damaged or hand-edited theme files).
 */
function merge<T>(base: T, over: unknown): T {
  if (!isPlain(base) || !isPlain(over)) return base;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(over)) {
    const b = (base as Record<string, unknown>)[k];
    if (v === undefined) continue;
    if (b === undefined) out[k] = v;
    else if (b === null) out[k] = v === null || isPlain(v) || typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v)) ? v : b;
    else if (Array.isArray(b)) out[k] = Array.isArray(v) ? v : b;
    else if (isPlain(b)) out[k] = isPlain(v) ? merge(b, v) : b;
    else if (typeof v === typeof b) out[k] = typeof v === 'number' && !Number.isFinite(v) ? b : v;
    else if (v === null && (k === 'image' || k === 'font' || k === 'fontFace' || k === 'textSpeed')) out[k] = null;
  }
  return out as T;
}

function preset(id: string, name: string, patch: DeepPartial<Theme>): Theme {
  return { ...merge(modern(), patch), id, name, preset: id };
}

export const THEME_PRESETS: readonly Theme[] = Object.freeze([
  modern(),
  preset('minimal', 'Minimal', {
    dialog: {
      width: px(1920),
      y: px(0),
      height: px(250),
      padding: { x: 80, y: 30 },
      surface: { background: '#000000', opacity: 0.55, radius: 0, shadow: NO_SHADOW },
      text: { size: 36, shadow: true },
    },
    nameBox: { padding: { x: 0, y: 0 }, surface: { background: '#000000', opacity: 0, radius: 0 }, text: { color: '#ffe08a', size: 34, shadow: true }, speakerColor: false },
    choice: {
      surface: { borderWidth: 0, radius: 0, shadow: NO_SHADOW },
      states: {
        normal: st('#000000', '#ffffff', '#ffffff', 0.6),
        hover: st('#333333', '#ffe08a', '#ffffff', 0.9),
        pressed: st('#1a1a1a', '#ffe08a', '#ffffff', 0.95),
        disabled: st('#000000', '#8c8c8c', '#ffffff', 0.4),
      },
      hoverAnimation: 'slide',
      pressAnimation: 'none',
    },
    menuBar: { surface: { background: '#000000', opacity: 0, borderWidth: 0 }, hover: { background: '#000000', color: '#ffe08a' }, text: { shadow: true } },
    menu: { background: '#000000', color: '#ffffff', accent: '#ffe08a', opacity: 0.9 },
    animation: 'none',
  }),
  preset('classic', 'Classic', {
    font: SERIF,
    dialog: {
      surface: { background: '#f3e7cf', opacity: 0.95, borderColor: '#8a6a3b', borderWidth: 4, radius: 8, shadow: shadow(30, 8, 0.35) },
      text: { color: '#2b1d0e' },
    },
    nameBox: { attach: 'outside', x: 40, y: 8, padding: { x: 30, y: 8 }, surface: { background: '#8a6a3b', radius: 6 }, text: { color: '#fff8e8' }, speakerColor: false },
    choice: {
      surface: { borderWidth: 3, radius: 8 },
      text: { color: '#2b1d0e' },
      states: {
        normal: st('#f3e7cf', '#2b1d0e', '#8a6a3b', 0.96),
        hover: st('#e2c992', '#2b1d0e', '#5e4423'),
        pressed: st('#d4b16a', '#2b1d0e', '#5e4423'),
        disabled: st('#e8e1d2', '#7d7266', '#b3a68e', 0.7),
      },
      hoverAnimation: 'lift',
    },
    menuBar: { surface: { background: '#2b1d0e', opacity: 0.8, borderColor: '#e2c992', radius: 8 }, text: { color: '#f3e7cf' }, hover: { background: '#8a6a3b', color: '#fff8e8' } },
    menu: { background: '#2b1d0e', color: '#f3e7cf', accent: '#e2c992', opacity: 0.95 },
    animation: 'slide',
  }),
  preset('dark', 'Dark', {
    dialog: { surface: { background: '#050507', opacity: 0.9, borderColor: '#9b1c31', borderWidth: 1.5, radius: 6 }, text: { color: '#e8e8f0' } },
    nameBox: { surface: { background: '#9b1c31', radius: 3 } },
    choice: {
      surface: { radius: 6, borderWidth: 1.5 },
      text: { color: '#e8e8f0' },
      states: {
        normal: st('#050507', '#e8e8f0', '#9b1c31', 0.92),
        hover: st('#9b1c31', '#ffffff', '#d13a52'),
        pressed: st('#6e1222', '#ffffff', '#d13a52'),
        disabled: st('#050507', '#77778a', '#3a1018', 0.6),
      },
    },
    menuBar: { surface: { borderColor: '#9b1c31' }, hover: { background: '#9b1c31', color: '#ffffff' } },
    menu: { background: '#050507', color: '#e8e8f0', accent: '#d13a52', opacity: 0.96 },
  }),
  preset('fantasy', 'Fantasy', {
    font: STORY,
    dialog: { surface: { background: '#2a1a4a', opacity: 0.88, borderColor: '#d4af37', borderWidth: 3, radius: 26 }, text: { color: '#fdf6e3' } },
    nameBox: { surface: { background: '#d4af37', radius: 24 }, text: { color: '#2a1a4a' } },
    choice: {
      surface: { borderWidth: 2, radius: 26 },
      text: { color: '#fdf6e3' },
      states: {
        normal: st('#2a1a4a', '#fdf6e3', '#d4af37', 0.92),
        hover: st('#6b3fa0', '#ffffff', '#f0d060'),
        pressed: st('#4e2c78', '#ffffff', '#f0d060'),
        disabled: st('#2a1a4a', '#9d93b0', '#6b5a2a', 0.6),
      },
      hoverAnimation: 'glow',
    },
    menuBar: { surface: { background: '#1a0f30', opacity: 0.75, borderColor: '#d4af37' }, hover: { background: '#6b3fa0', color: '#ffffff' } },
    menu: { background: '#1a0f30', color: '#fdf6e3', accent: '#d4af37', opacity: 0.95 },
    animation: 'slide',
  }),
  preset('soft', 'Soft', {
    font: ROUNDED,
    dialog: {
      y: px(36),
      width: px(1560),
      surface: { background: '#fff6fb', opacity: 0.9, borderColor: '#f4b6d2', borderWidth: 3, radius: 40, shadow: shadow(40, 10, 0.25, '#b0306a'), blur: 8 },
      text: { color: '#5a4660' },
    },
    nameBox: { attach: 'outside', x: 50, y: 22, padding: { x: 34, y: 8 }, surface: { background: '#c2386f', radius: 999, shadow: shadow(16, 4, 0.25, '#b0306a') }, text: { color: '#ffffff' }, speakerColor: false },
    choice: {
      surface: { borderWidth: 3, radius: 999, shadow: shadow(20, 6, 0.2, '#b0306a') },
      text: { color: '#5a4660' },
      states: {
        normal: st('#ffffff', '#5a4660', '#f4b6d2', 0.92),
        hover: st('#ffd6e7', '#5a4660', '#f48fb1'),
        pressed: st('#ffbcd8', '#5a4660', '#e0679a'),
        disabled: st('#f4eef1', '#9c8fa0', '#e5d3dc', 0.75),
      },
      hoverAnimation: 'lift',
      pressAnimation: 'sink',
    },
    menuBar: { surface: { background: '#ffffff', opacity: 0.88, borderColor: '#f4b6d2', borderWidth: 2 }, text: { color: '#6b3a5a' }, hover: { background: '#c2386f', color: '#ffffff' } },
    menu: { background: '#fff0f6', color: '#5a4660', accent: '#e0679a', opacity: 0.96 },
  }),
  preset('rpg', 'RPG', {
    dialog: {
      width: px(1820),
      y: px(20),
      height: px(280),
      padding: { x: 44, y: 30 },
      surface: { background: '#0a1a4a', opacity: 0.92, borderColor: '#e8e8ff', borderWidth: 5, radius: 10, shadow: shadow(0, 0, 0) },
      text: { size: 37, letterSpacing: 0.5, shadow: true },
    },
    nameBox: { attach: 'outside', x: 0, y: 6, padding: { x: 28, y: 8 }, surface: { background: '#0a1a4a', opacity: 0.95, borderColor: '#e8e8ff', borderWidth: 4, radius: 8 }, text: { color: '#ffe066', shadow: true }, speakerColor: false },
    choice: {
      anchor: 'right',
      x: px(70),
      width: px(720),
      minWidth: 300,
      height: 70,
      spacing: 12,
      surface: { borderWidth: 3, radius: 8, shadow: shadow(0, 0, 0) },
      text: { align: 'left', shadow: true },
      states: {
        normal: st('#0a1a4a', '#ffffff', '#e8e8ff', 0.92),
        hover: st('#2e4ca8', '#ffe066', '#ffffff'),
        pressed: st('#1d3580', '#ffe066', '#ffffff'),
        disabled: st('#0a1a4a', '#7f88a8', '#5a6288', 0.65),
      },
      hoverAnimation: 'slide',
      pressAnimation: 'sink',
    },
    menuBar: { surface: { background: '#0a1a4a', opacity: 0.85, borderColor: '#e8e8ff', borderWidth: 3, radius: 8 }, hover: { background: '#2e4ca8', color: '#ffe066' } },
    menu: { background: '#0a1a4a', color: '#ffffff', accent: '#2e4ca8', opacity: 0.96 },
    animation: 'none',
  }),
  preset('romance', 'Romance', {
    font: SERIF,
    dialog: {
      surface: { background: '#3a0d24', opacity: 0.78, borderColor: '#ff9ec4', borderWidth: 2, radius: 32, shadow: shadow(44, 10, 0.4, '#5c0f33'), blur: 6 },
      text: { color: '#fff4f8' },
    },
    nameBox: { attach: 'outside', x: 44, y: 20, padding: { x: 34, y: 8 }, surface: { background: '#c93a72', radius: 999 }, text: { color: '#ffffff' }, speakerColor: false },
    choice: {
      surface: { borderWidth: 2, radius: 999 },
      text: { color: '#8a1d4a' },
      states: {
        normal: st('#ffffff', '#8a1d4a', '#ff9ec4', 0.88),
        hover: st('#c93a72', '#ffffff', '#ffffff'),
        pressed: st('#a82d5e', '#ffffff', '#ffffff'),
        disabled: st('#f6e8ee', '#a58a96', '#e8c3d3', 0.7),
      },
      hoverAnimation: 'glow',
    },
    menuBar: { surface: { background: '#3a0d24', opacity: 0.75, borderColor: '#ff9ec4' }, hover: { background: '#c93a72', color: '#ffffff' } },
    menu: { background: '#2a0818', color: '#fff4f8', accent: '#ff6fa5', opacity: 0.95 },
  }),
  preset('horror', 'Horror', {
    font: MONO,
    dialog: {
      surface: { background: '#000000', opacity: 0.88, borderColor: '#5c0000', borderWidth: 2, radius: 0, shadow: shadow(60, 0, 0.8, '#300000') },
      text: { color: '#d9d0c7', letterSpacing: 1, shadow: true, size: 36 },
    },
    nameBox: { padding: { x: 0, y: 0 }, surface: { background: '#000000', opacity: 0 }, text: { color: '#e03030', letterSpacing: 2, shadow: true }, speakerColor: false },
    choice: {
      surface: { borderWidth: 1.5, radius: 0, shadow: NO_SHADOW },
      text: { color: '#d9d0c7', letterSpacing: 1 },
      states: {
        normal: st('#0a0000', '#d9d0c7', '#5c0000', 0.9),
        hover: st('#4a0000', '#ffffff', '#c21a1a'),
        pressed: st('#2a0000', '#ffffff', '#c21a1a'),
        disabled: st('#0a0000', '#6e6560', '#2a0000', 0.6),
      },
      hoverAnimation: 'slide',
      pressAnimation: 'sink',
      animationSpeed: 0.3,
    },
    menuBar: { surface: { background: '#000000', opacity: 0.78, borderColor: '#5c0000', radius: 0 }, text: { color: '#d9d0c7' }, hover: { background: '#4a0000', color: '#ffffff' } },
    menu: { background: '#050000', color: '#d9d0c7', accent: '#8b0000', opacity: 0.97 },
  }),
]);

export function getPresetTheme(id: string): Theme | undefined {
  const t = THEME_PRESETS.find((p) => p.id === id);
  return t ? (JSON.parse(JSON.stringify(t)) as Theme) : undefined;
}

export function resolveTheme(themeId: string | null | undefined, custom: Theme[]): Theme {
  return (themeId ? (custom.find((t) => t.id === themeId) ?? getPresetTheme(themeId)) : undefined) ?? getPresetTheme('modern')!;
}

export function themeExists(themeId: string | null | undefined, custom: Theme[]): boolean {
  return !!themeId && (custom.some((t) => t.id === themeId) || THEME_PRESETS.some((t) => t.id === themeId));
}

// ---------------- migration / validation ----------------

const r = (n: number) => Math.round(n);

/** Converts a version-1 theme (sizes in 1280×720 "UI points", single colors per element) to version 2. */
function migrateV1(o: any): Theme {
  const t = modern();
  const f = Number(o.fontSize) || 26;
  const d = o.dialog ?? {};
  const pos = d.position === 'top' ? 'top' : d.position === 'middle' ? 'center' : 'bottom';
  t.font = typeof o.font === 'string' ? o.font : t.font;
  t.dialog.anchor = pos;
  t.dialog.y = px(pos === 'top' ? 96 : pos === 'center' ? 0 : 21);
  t.dialog.width = px(Math.min(1500, r(((Number(d.width) || 90) / 100) * 1920)));
  t.dialog.height = px(r(f * 5 * 1.5));
  const pad = r((Number(d.padding) || 24) * 1.5);
  t.dialog.padding = { x: pad, y: pad };
  t.dialog.surface = {
    ...t.dialog.surface,
    background: d.background ?? t.dialog.surface.background,
    opacity: Number.isFinite(d.opacity) ? d.opacity : t.dialog.surface.opacity,
    borderColor: d.borderColor ?? '#ffffff',
    borderWidth: Number(d.borderWidth) || 0,
    radius: Number.isFinite(d.radius) ? d.radius : 12,
    shadow: d.shadow === false ? NO_SHADOW : shadow(40, 10, 0.45),
  };
  t.dialog.text = { ...t.dialog.text, size: r(f * 1.5), color: o.textColor ?? '#ffffff' };
  const n = o.nameBox ?? {};
  t.nameBox.surface = { ...t.nameBox.surface, background: n.background ?? t.nameBox.surface.background, opacity: n.background === 'transparent' ? 0 : 1, radius: Number.isFinite(n.radius) ? n.radius : 6 };
  if (n.background === 'transparent') t.nameBox.surface.background = '#000000';
  t.nameBox.text = { ...t.nameBox.text, size: r(f * 0.92 * 1.5), color: n.color ?? '#ffffff' };
  t.nameBox.padding = { x: r(f * 0.92 * 0.7 * 1.5), y: r(f * 0.92 * 0.12 * 1.5) };
  const c = o.choice ?? {};
  const cs = f * 0.92 * 1.5;
  const cbg = c.background ?? '#101420';
  const ccol = c.color ?? '#ffffff';
  const cb = c.borderColor ?? '#ffffff';
  t.choice.width = px(960);
  t.choice.height = 72;
  t.choice.spacing = 18;
  t.choice.padding = { x: r(cs * 1.2), y: r(cs * 0.55) };
  t.choice.surface = { ...t.choice.surface, borderWidth: 1, radius: Number.isFinite(c.radius) ? c.radius : 12, shadow: NO_SHADOW };
  t.choice.text = { ...t.choice.text, size: r(cs), color: ccol };
  t.choice.states = {
    normal: st(cbg, ccol, cb, Number.isFinite(c.opacity) ? c.opacity : 0.88),
    hover: st(c.hoverBackground ?? '#4f6bff', ccol, cb),
    pressed: st(c.hoverBackground ?? '#4f6bff', ccol, cb),
    disabled: st(cbg, ccol, cb, 0.45),
  };
  const m = o.menu ?? {};
  t.menu = { background: m.background ?? t.menu.background, color: m.color ?? t.menu.color, accent: m.accent ?? t.menu.accent, opacity: Number.isFinite(m.opacity) ? m.opacity : t.menu.opacity };
  t.menuBar.hover.background = t.menu.accent;
  t.animation = o.animation === 'slide' || o.animation === 'none' ? o.animation : 'fade';
  return { ...t, id: String(o.id ?? 'theme'), name: String(o.name ?? 'Theme'), preset: o.preset };
}

/** Accepts any theme object (old format, partial, hand-edited) and returns a complete version-2 theme. */
export function normalizeTheme(raw: unknown): Theme {
  if (!isPlain(raw)) return modern();
  const src = raw.version === 2 ? raw : migrateV1(raw);
  const t = merge(modern(), src);
  t.version = 2;
  t.id = String(src.id ?? 'theme');
  t.name = String(src.name ?? 'Theme');
  t.preset = typeof src.preset === 'string' ? src.preset : undefined;
  t.menuBar.buttons = (Array.isArray(t.menuBar.buttons) ? t.menuBar.buttons : [])
    .filter((b) => isPlain(b) && MENU_ACTIONS.includes(b.action as MenuAction))
    .map((b, i) => ({ id: typeof b.id === 'string' && b.id ? b.id : `mb-${i}`, action: b.action, label: typeof b.label === 'string' ? b.label : '', hideOnMobile: !!b.hideOnMobile }));
  if (!UI_ANCHORS.includes(t.dialog.anchor)) t.dialog.anchor = 'bottom';
  if (!UI_ANCHORS.includes(t.choice.anchor)) t.choice.anchor = 'center';
  if (!UI_ANCHORS.includes(t.menuBar.anchor)) t.menuBar.anchor = 'top-right';
  return t;
}

// ---------------- references ----------------

const surfacesOf = (t: Theme): UiSurface[] => [t.dialog.surface, t.nameBox.surface, t.choice.surface, t.menuBar.surface];
const textsOf = (t: Theme): UiText[] => [t.dialog.text, t.nameBox.text, t.choice.text, t.menuBar.text];

/** Image assets a theme uses. */
export function themeAssetIds(t: Theme): string[] {
  return surfacesOf(t)
    .map((s) => s.image)
    .filter((x): x is string => !!x);
}

/** Every font a theme refers to (main font + per-element fonts). */
export function themeFontRefs(t: Theme): FontRef[] {
  return [t.fontFace, ...textsOf(t).map((x) => x.font)].filter((f): f is FontRef => !!f?.family);
}

/** Calls fn for every image slot of a theme (mutating helpers for asset replace/remove). */
export function forEachThemeImage(t: Theme, fn: (s: UiSurface) => void) {
  surfacesOf(t).forEach(fn);
}

/** Quote a font family for CSS. */
export function cssFamily(family: string): string {
  return `"${family.replace(/["\\]/g, '')}"`;
}

// ---------------- colors ----------------

export function hexToRgb(color: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return null;
  let hex = m[1];
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  const n = parseInt(hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Applies opacity to a hex color; non-hex colors (e.g. "transparent") pass through. */
export function withAlpha(color: string, alpha: number): string {
  const rgb = hexToRgb(color);
  if (!rgb) return color;
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`;
}

function luminance([r0, g0, b0]: [number, number, number]): number {
  const c = [r0, g0, b0].map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/**
 * WCAG contrast of text over a background with some opacity. The scene behind a
 * see-through box is unknown, so the worst case of a black and a white scene is used.
 */
export function textContrast(textColor: string, background: string, opacity: number): number {
  const fg = hexToRgb(textColor);
  const bg = hexToRgb(background);
  if (!fg) return 21;
  const a = bg ? Math.max(0, Math.min(1, opacity)) : 0;
  const over = (scene: number): [number, number, number] => (bg ? [0, 1, 2].map((i) => bg[i] * a + scene * (1 - a)) : [scene, scene, scene]) as [number, number, number];
  const ratio = (b: [number, number, number]) => {
    const [l1, l2] = [luminance(fg), luminance(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  };
  return Math.min(ratio(over(0)), ratio(over(255)));
}
