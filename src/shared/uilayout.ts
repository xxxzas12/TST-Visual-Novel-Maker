// Game UI layout: turns a Theme into pixel positions and CSS variables for a given screen.
// Pure functions — used by the runtime to place the UI and by the editor to check layouts
// on many devices without rendering them.
import type { FontRef, Theme, UiAnchor, UiLength, UiSurface, UiText, UiUnit } from './types';
import { cssFamily, withAlpha } from './themes';

/** The design canvas UI sizes are expressed in (rotated in portrait). */
export const UI_CANVAS = { width: 1920, height: 1080 };

export interface SafeArea {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface UiContext {
  /** Design px → CSS px. */
  s: number;
  /** Safe area (CSS px) the UI is laid out in. */
  areaW: number;
  areaH: number;
  /** Viewport (CSS px) for vw/vh. */
  vw: number;
  vh: number;
  minFont: number;
  textScale: number;
  touch: number;
}

export function uiScale(width: number, height: number): number {
  return height > width ? Math.min(width / UI_CANVAS.height, height / UI_CANVAS.width) : Math.min(width / UI_CANVAS.width, height / UI_CANVAS.height);
}

export function makeContext(theme: Theme, width: number, height: number, safe: SafeArea = { top: 0, right: 0, bottom: 0, left: 0 }, textScale = 1): UiContext {
  return {
    s: uiScale(width, height),
    areaW: Math.max(0, width - safe.left - safe.right),
    areaH: Math.max(0, height - safe.top - safe.bottom),
    vw: width,
    vh: height,
    minFont: theme.accessibility.minFontSize,
    textScale,
    touch: theme.accessibility.minTouchTarget,
  };
}

export function lengthPx(l: UiLength, axis: 'x' | 'y', c: UiContext): number {
  switch (l.unit) {
    case '%':
      return (l.value / 100) * (axis === 'x' ? c.areaW : c.areaH);
    case 'vw':
      return (l.value / 100) * c.vw;
    case 'vh':
      return (l.value / 100) * c.vh;
    default:
      return l.value * c.s;
  }
}

/** Inverse of lengthPx for a distance (used when dragging in the editor). */
export function pxToUnit(cssPx: number, unit: UiUnit, axis: 'x' | 'y', c: UiContext): number {
  switch (unit) {
    case '%':
      return (cssPx / Math.max(1, axis === 'x' ? c.areaW : c.areaH)) * 100;
    case 'vw':
      return (cssPx / Math.max(1, c.vw)) * 100;
    case 'vh':
      return (cssPx / Math.max(1, c.vh)) * 100;
    default:
      return cssPx / Math.max(0.0001, c.s);
  }
}

/** Font size in CSS px: scaled, never below the readable minimum, times the player's text size setting. */
export function fontPx(size: number, c: UiContext): number {
  return Math.max(c.minFont, size * c.s) * c.textScale;
}

export const hAnchor = (a: UiAnchor): 'left' | 'center' | 'right' => (a.endsWith('left') ? 'left' : a.endsWith('right') ? 'right' : 'center');
export const vAnchor = (a: UiAnchor): 'top' | 'middle' | 'bottom' => (a.startsWith('top') ? 'top' : a.startsWith('bottom') ? 'bottom' : 'middle');

export function anchorOf(h: 'left' | 'center' | 'right', v: 'top' | 'middle' | 'bottom'): UiAnchor {
  if (v === 'middle') return h === 'center' ? 'center' : h;
  return h === 'center' ? v : (`${v}-${h}` as UiAnchor);
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Places a box of (w × h) at an anchor with offsets inside an area.
 * x/y are distances from the anchored edge (or shifts from the center).
 * The box is shrunk to fit and kept fully inside the area.
 */
export function placeBox(anchor: UiAnchor, x: number, y: number, w: number, h: number, areaW: number, areaH: number, reserveTop = 0): Rect {
  const W = Math.min(w, areaW);
  const H = Math.min(h, Math.max(0, areaH - reserveTop));
  const ha = hAnchor(anchor);
  const va = vAnchor(anchor);
  const left = ha === 'left' ? x : ha === 'right' ? areaW - W - x : (areaW - W) / 2 + x;
  const top = va === 'top' ? y : va === 'bottom' ? areaH - H - y : (areaH - H) / 2 + y;
  return { left: clamp(left, 0, areaW - W), top: clamp(top, reserveTop, Math.max(reserveTop, areaH - H)), width: W, height: H };
}

export function nameBoxHeight(t: Theme, c: UiContext): number {
  const n = t.nameBox;
  const content = fontPx(n.text.size, c) * n.text.lineHeight + 2 * n.padding.y * c.s + 2 * borderPx(n.surface, c);
  return Math.max(n.height * c.s, content);
}

export interface DialogLayout {
  left: number;
  width: number;
  /** One of top/bottom is set: bottom-anchored boxes grow upwards. */
  top: number | null;
  bottom: number | null;
  minHeight: number;
  maxHeight: number;
  /** Space kept free above the box for a name box sitting on its edge. */
  reserveTop: number;
}

export function layoutDialog(t: Theme, c: UiContext): DialogLayout {
  const d = t.dialog;
  let reserveTop = 0;
  if (t.nameBox.enabled && t.nameBox.attach === 'outside') reserveTop = clamp(nameBoxHeight(t, c) - t.nameBox.y * c.s, 0, c.areaH / 3);
  const box = placeBox(d.anchor, lengthPx(d.x, 'x', c), lengthPx(d.y, 'y', c), lengthPx(d.width, 'x', c), lengthPx(d.height, 'y', c), c.areaW, c.areaH, reserveTop);
  if (vAnchor(d.anchor) === 'bottom') {
    const bottom = c.areaH - box.top - box.height;
    return { left: box.left, width: box.width, top: null, bottom, minHeight: box.height, maxHeight: c.areaH - bottom - reserveTop, reserveTop };
  }
  return { left: box.left, width: box.width, top: box.top, bottom: null, minHeight: box.height, maxHeight: c.areaH - box.top, reserveTop };
}

/** The part of the area choices may use: the larger free band above or below a visible dialogue box. */
export function choiceRegion(c: UiContext, dialog: Rect | null, gap: number): Rect {
  if (!dialog) return { left: 0, top: 0, width: c.areaW, height: c.areaH };
  const above = dialog.top - gap;
  const below = c.areaH - (dialog.top + dialog.height) - gap;
  if (above >= below) return { left: 0, top: 0, width: c.areaW, height: Math.max(0, above) };
  const top = dialog.top + dialog.height + gap;
  return { left: 0, top, width: c.areaW, height: Math.max(0, c.areaH - top) };
}

export function choiceButtonHeight(t: Theme, c: UiContext): number {
  const ch = t.choice;
  return Math.max(c.touch, ch.height * c.s, fontPx(ch.text.size, c) * ch.text.lineHeight + 2 * ch.padding.y * c.s);
}

export function choiceWidth(t: Theme, c: UiContext, regionW: number): number {
  return Math.min(Math.max(t.choice.minWidth * c.s, lengthPx(t.choice.width, 'x', c)), regionW);
}

/** Places the list of choice buttons (natural height listH) inside a region. */
export function placeChoices(t: Theme, c: UiContext, region: Rect, listH: number): Rect {
  const w = choiceWidth(t, c, region.width);
  const box = placeBox(t.choice.anchor, lengthPx(t.choice.x, 'x', c), lengthPx(t.choice.y, 'y', c), w, listH, region.width, region.height);
  return { ...box, left: box.left + region.left, top: box.top + region.top };
}

export function menuButtonSize(t: Theme, c: UiContext, label: string): { width: number; height: number } {
  const m = t.menuBar;
  const height = Math.max(c.touch, m.height * c.s);
  const width = Math.max(height, m.minWidth * c.s, [...label].length * fontPx(m.text.size, c) * 0.62 + 2 * m.padding.x * c.s);
  return { width, height };
}

// ---------------- CSS variables ----------------

const n = (v: number) => `${Math.round(v * 100) / 100}px`;

export function borderPx(s: UiSurface, c: UiContext): number {
  return s.borderWidth > 0 ? Math.max(1, s.borderWidth * c.s) : 0;
}

/** Font stack for an element: element font → theme font → fallback stack. */
export function fontStackFor(t: Theme, ref: FontRef | null): string {
  const base = t.fontFace?.family ? `${cssFamily(t.fontFace.family)}, ${t.font}` : t.font;
  return ref?.family ? `${cssFamily(ref.family)}, ${base}` : base;
}

const TEXT_SHADOW = '0 1px 2px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.65)';

function surfaceVars(p: string, s: UiSurface, c: UiContext, img: (id: string) => string | null): Record<string, string> {
  const url = s.image ? img(s.image) : null;
  return {
    [`--tvn-${p}-bg`]: withAlpha(s.background, s.opacity),
    [`--tvn-${p}-img`]: url ? `url(${JSON.stringify(url)})` : 'none',
    [`--tvn-${p}-img-op`]: String(s.opacity),
    [`--tvn-${p}-img-size`]: s.imageFit === 'stretch' ? '100% 100%' : s.imageFit === 'tile' ? 'auto' : s.imageFit,
    [`--tvn-${p}-img-repeat`]: s.imageFit === 'tile' ? 'repeat' : 'no-repeat',
    [`--tvn-${p}-bw`]: n(borderPx(s, c)),
    [`--tvn-${p}-bc`]: s.borderColor,
    [`--tvn-${p}-radius`]: n(s.radius * c.s),
    [`--tvn-${p}-shadow`]: s.shadow.size > 0 ? `0 ${n(s.shadow.y * c.s)} ${n(s.shadow.size * c.s)} ${withAlpha(s.shadow.color, s.shadow.opacity)}` : 'none',
    [`--tvn-${p}-blur`]: s.blur > 0 ? `blur(${n(s.blur * c.s)})` : 'none',
  };
}

function textVars(p: string, t: Theme, x: UiText, c: UiContext): Record<string, string> {
  return {
    [`--tvn-${p}-font`]: fontStackFor(t, x.font),
    [`--tvn-${p}-size`]: n(fontPx(x.size, c)),
    [`--tvn-${p}-color`]: x.color,
    [`--tvn-${p}-lh`]: String(x.lineHeight),
    [`--tvn-${p}-ls`]: n(x.letterSpacing * c.s),
    [`--tvn-${p}-align`]: x.align,
    [`--tvn-${p}-weight`]: x.bold ? '700' : '400',
    [`--tvn-${p}-tshadow`]: x.shadow ? TEXT_SHADOW : 'none',
  };
}

const pad = (p: { x: number; y: number }, c: UiContext) => `${n(p.y * c.s)} ${n(p.x * c.s)}`;

/** All theme-driven CSS variables for runtime.css at the given screen context. */
export function themeVars(t: Theme, c: UiContext, img: (assetId: string) => string | null = () => null): Record<string, string> {
  const ch = t.choice;
  const hoverTransform = { none: 'none', grow: 'scale(1.04)', lift: `translateY(${n(-5 * c.s)})`, slide: `translateX(${n(14 * c.s)})`, glow: 'none' }[ch.hoverAnimation];
  const pressTransform = { none: 'none', shrink: 'scale(0.96)', sink: `translateY(${n(4 * c.s)})` }[ch.pressAnimation];
  const vars: Record<string, string> = {
    '--tvn-font': fontStackFor(t, null),
    '--tvn-text': t.dialog.text.color,
    '--tvn-touch': n(c.touch),
    // dialogue box
    ...surfaceVars('d', t.dialog.surface, c, img),
    ...textVars('d', t, t.dialog.text, c),
    '--tvn-d-pad': pad(t.dialog.padding, c),
    // name box
    ...surfaceVars('n', t.nameBox.surface, c, img),
    ...textVars('n', t, t.nameBox.text, c),
    '--tvn-n-pad': pad(t.nameBox.padding, c),
    '--tvn-n-padx': n(t.nameBox.padding.x * c.s),
    '--tvn-n-minw': n(t.nameBox.width * c.s),
    '--tvn-n-minh': n(t.nameBox.height * c.s),
    '--tvn-n-x': n(t.nameBox.x * c.s),
    '--tvn-n-y': n(t.nameBox.y * c.s),
    // choices
    ...surfaceVars('c', ch.surface, c, img),
    ...textVars('c', t, ch.text, c),
    '--tvn-c-pad': pad(ch.padding, c),
    '--tvn-c-minh': n(Math.max(c.touch, ch.height * c.s)),
    '--tvn-c-gap': n(ch.spacing * c.s),
    '--tvn-c-speed': `${Math.max(0, ch.animationSpeed)}s`,
    '--tvn-c-hover-transform': hoverTransform,
    '--tvn-c-press-transform': pressTransform,
    '--tvn-c-hover-shadow': ch.hoverAnimation === 'glow' ? `0 0 ${n(26 * c.s)} ${withAlpha(ch.states.hover.borderColor, 0.85)}` : 'var(--tvn-c-shadow)',
    // menu bar
    ...surfaceVars('m', t.menuBar.surface, c, img),
    ...textVars('m', t, t.menuBar.text, c),
    '--tvn-m-pad': pad(t.menuBar.padding, c),
    '--tvn-m-minh': n(Math.max(c.touch, t.menuBar.height * c.s)),
    '--tvn-m-minw': n(Math.max(c.touch, t.menuBar.minWidth * c.s)),
    '--tvn-m-gap': n(t.menuBar.spacing * c.s),
    '--tvn-m-hover-bg': t.menuBar.hover.background,
    '--tvn-m-hover-color': t.menuBar.hover.color,
    // screens & menus
    '--tvn-menu-bg': withAlpha(t.menu.background, t.menu.opacity),
    '--tvn-menu-color': t.menu.color,
    '--tvn-accent': t.menu.accent,
  };
  for (const [state, s] of Object.entries(ch.states)) {
    vars[`--tvn-c-${state}-bg`] = withAlpha(s.background, s.opacity);
    vars[`--tvn-c-${state}-color`] = s.color;
    vars[`--tvn-c-${state}-bc`] = s.borderColor;
  }
  return vars;
}
