// Game UI editing helpers (move / resize / align elements) and the multi-device layout check.
// Pure functions on a Theme so the editor, tests and the runtime agree on every number.
import type { Theme, UiLength } from './types';
import { t } from './i18n';
import { newId } from './ids';
import { textContrast } from './themes';
import {
  anchorOf,
  choiceButtonHeight,
  choiceRegion,
  fontPx,
  hAnchor,
  layoutDialog,
  lengthPx,
  makeContext,
  menuButtonSize,
  nameBoxHeight,
  placeBox,
  pxToUnit,
  vAnchor,
  type Rect,
  type SafeArea,
  type UiContext,
} from './uilayout';

export type UiElementId = 'dialog' | 'name' | 'choices' | 'menubar' | `button:${string}`;

export interface DevicePreset {
  id: string;
  label: string;
  width: number;
  height: number;
  safe: SafeArea;
  touch: boolean;
}

const NO_SAFE: SafeArea = { top: 0, right: 0, bottom: 0, left: 0 };

export const DEVICES: DevicePreset[] = [
  { id: 'desktop', label: 'Desktop', width: 1920, height: 1080, safe: NO_SAFE, touch: false },
  { id: 'laptop', label: 'Laptop', width: 1366, height: 768, safe: NO_SAFE, touch: false },
  { id: 'tablet', label: 'Tablet', width: 1024, height: 768, safe: NO_SAFE, touch: true },
  { id: 'tablet-portrait', label: 'Tablet (portrait)', width: 768, height: 1024, safe: { top: 20, right: 0, bottom: 20, left: 0 }, touch: true },
  { id: 'phone', label: 'Phone (landscape)', width: 844, height: 390, safe: { top: 0, right: 47, bottom: 21, left: 47 }, touch: true },
  { id: 'phone-portrait', label: 'Phone (portrait)', width: 390, height: 844, safe: { top: 47, right: 0, bottom: 34, left: 0 }, touch: true },
];

const round = (v: number) => Math.round(v * 100) / 100;

function shift(len: UiLength, deltaCss: number, axis: 'x' | 'y', sign: number, c: UiContext) {
  len.value = round(len.value + sign * pxToUnit(deltaCss, len.unit, axis, c));
}

/** The element whose position a selection controls (menu buttons move with their bar). */
export function positioned(el: UiElementId): 'dialog' | 'name' | 'choices' | 'menubar' {
  return el.startsWith('button:') ? 'menubar' : (el as 'dialog' | 'name' | 'choices' | 'menubar');
}

/** Moves an element by a distance in CSS px measured on screen (mutates the theme). */
export function moveElement(th: Theme, el: UiElementId, dx: number, dy: number, c: UiContext) {
  const target = positioned(el);
  if (target === 'name') {
    th.nameBox.x = round(th.nameBox.x + dx / c.s);
    th.nameBox.y = round(th.nameBox.y + dy / c.s);
    return;
  }
  const box = target === 'dialog' ? th.dialog : target === 'choices' ? th.choice : th.menuBar;
  shift(box.x, dx, 'x', hAnchor(box.anchor) === 'right' ? -1 : 1, c);
  shift(box.y, dy, 'y', vAnchor(box.anchor) === 'bottom' ? -1 : 1, c);
}

export type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/** Which handles an element offers. */
export function resizeEdges(el: UiElementId): ResizeEdge[] {
  if (el === 'dialog') return ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
  if (el === 'choices') return ['e', 'w'];
  if (el === 'name') return ['e', 's', 'se'];
  return [];
}

/** Resizes from an edge by an on-screen distance, keeping the opposite edge in place (mutates). */
export function resizeElement(th: Theme, el: UiElementId, edge: ResizeEdge, dx: number, dy: number, c: UiContext) {
  if (el === 'name') {
    const n = th.nameBox;
    const cur = { w: n.width || 0, h: n.height || 0 };
    if (edge.includes('e')) n.width = Math.max(0, round(cur.w + dx / c.s));
    if (edge.includes('s')) n.height = Math.max(0, round(cur.h + dy / c.s));
    return;
  }
  if (el !== 'dialog' && el !== 'choices') return;
  const box = el === 'dialog' ? th.dialog : th.choice;
  const ha = hAnchor(box.anchor);
  const va = vAnchor(box.anchor);
  const grow = (len: UiLength, d: number, axis: 'x' | 'y') => {
    const min = len.unit === 'px' ? 80 : 4;
    len.value = Math.max(min, round(len.value + pxToUnit(d, len.unit, axis, c)));
  };
  if (edge.includes('e')) {
    grow(box.width, dx, 'x');
    if (ha === 'right') shift(box.x, dx, 'x', -1, c);
    else if (ha === 'center') shift(box.x, dx / 2, 'x', 1, c);
  }
  if (edge.includes('w')) {
    grow(box.width, -dx, 'x');
    if (ha === 'left') shift(box.x, dx, 'x', 1, c);
    else if (ha === 'center') shift(box.x, dx / 2, 'x', 1, c);
  }
  if (el !== 'dialog') return;
  const d = th.dialog;
  if (edge.includes('s')) {
    grow(d.height, dy, 'y');
    if (va === 'bottom') shift(d.y, dy, 'y', -1, c);
    else if (va === 'middle') shift(d.y, dy / 2, 'y', 1, c);
  }
  if (edge.startsWith('n')) {
    grow(d.height, -dy, 'y');
    if (va === 'top') shift(d.y, dy, 'y', 1, c);
    else if (va === 'middle') shift(d.y, dy / 2, 'y', 1, c);
  }
}

export type AlignEdge = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom';

export function canAlign(el: UiElementId, edge: AlignEdge): boolean {
  return positioned(el) !== 'name' || ['left', 'hcenter', 'right'].includes(edge);
}

/** Snaps an element to a screen edge or centre (sets its anchor, resets that offset). */
export function alignElement(th: Theme, el: UiElementId, edge: AlignEdge) {
  const target = positioned(el);
  if (target === 'name') {
    if (edge === 'left' || edge === 'hcenter' || edge === 'right') {
      th.nameBox.align = edge === 'hcenter' ? 'center' : edge;
      th.nameBox.x = 0;
    }
    return;
  }
  const box = target === 'dialog' ? th.dialog : target === 'choices' ? th.choice : th.menuBar;
  let h = hAnchor(box.anchor);
  let v = vAnchor(box.anchor);
  if (edge === 'left' || edge === 'right') h = edge;
  if (edge === 'hcenter') h = 'center';
  if (edge === 'top' || edge === 'bottom') v = edge;
  if (edge === 'vcenter') v = 'middle';
  box.anchor = anchorOf(h, v);
  if (edge === 'left' || edge === 'hcenter' || edge === 'right') box.x = { ...box.x, value: 0 };
  else box.y = { ...box.y, value: 0 };
}

// ---------------- menu buttons ----------------

export function duplicateMenuButton(th: Theme, id: string): string | null {
  const i = th.menuBar.buttons.findIndex((b) => b.id === id);
  if (i < 0) return null;
  const copy = { ...th.menuBar.buttons[i], id: newId('mb') };
  th.menuBar.buttons.splice(i + 1, 0, copy);
  return copy.id;
}

export function deleteMenuButton(th: Theme, id: string): boolean {
  const before = th.menuBar.buttons.length;
  th.menuBar.buttons = th.menuBar.buttons.filter((b) => b.id !== id);
  return th.menuBar.buttons.length < before;
}

export function moveMenuButton(th: Theme, id: string, delta: number) {
  const list = th.menuBar.buttons;
  const i = list.findIndex((b) => b.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
}

// ---------------- layout check ----------------

export interface LayoutIssue {
  device: string;
  element: UiElementId | 'theme';
  severity: 'warning' | 'info';
  message: string;
}

const intersects = (a: Rect, b: Rect) => a.left < b.left + b.width - 1 && b.left < a.left + a.width - 1 && a.top < b.top + b.height - 1 && b.top < a.top + a.height - 1;

/** Estimated on-screen rectangles of the main elements (content sizes are estimated). */
export function estimateRects(th: Theme, c: UiContext, labels: Record<string, string> = {}) {
  const d = layoutDialog(th, c);
  const dTop = d.top ?? c.areaH - (d.bottom ?? 0) - d.minHeight;
  const dialog: Rect = { left: d.left, top: dTop - d.reserveTop, width: d.width, height: d.minHeight + d.reserveTop };
  const bar = th.menuBar;
  const sizes = bar.buttons.filter((b) => !(b.hideOnMobile && Math.min(c.vw, c.vh) < 520)).map((b) => menuButtonSize(th, c, b.label || labels[b.action] || b.action));
  const gap = bar.spacing * c.s;
  let bw: number;
  let bh: number;
  if (bar.direction === 'row') {
    bw = sizes.reduce((s, x) => s + x.width, 0) + gap * Math.max(0, sizes.length - 1);
    bh = Math.max(0, ...sizes.map((x) => x.height));
    if (bw > c.areaW) {
      // wraps onto more rows
      const rows = Math.ceil(bw / c.areaW);
      bw = c.areaW;
      bh = rows * bh + (rows - 1) * gap;
    }
  } else {
    bw = Math.max(0, ...sizes.map((x) => x.width));
    bh = sizes.reduce((s, x) => s + x.height, 0) + gap * Math.max(0, sizes.length - 1);
  }
  const menubar = bar.enabled && sizes.length ? placeBox(bar.anchor, lengthPx(bar.x, 'x', c), lengthPx(bar.y, 'y', c), bw, bh, c.areaW, c.areaH) : null;
  return { dialog, dialogLayout: d, menubar };
}

/** Checks a theme on one device: overflow, overlap, readability and touch sizes. */
export function checkLayout(th: Theme, device: DevicePreset, labels: Record<string, string> = {}): LayoutIssue[] {
  const c = makeContext(th, device.width, device.height, device.safe);
  const out: LayoutIssue[] = [];
  const add = (element: LayoutIssue['element'], severity: LayoutIssue['severity'], message: string) => out.push({ device: device.id, element, severity, message });
  const { dialog, dialogLayout, menubar } = estimateRects(th, c, labels);

  const wantW = lengthPx(th.dialog.width, 'x', c);
  if (wantW > c.areaW + 0.5) add('dialog', 'info', t('Dialogue box is wider than the screen — shrunk to fit ({0}px).', { 0: Math.round(c.areaW) }));
  if (dialog.height > c.areaH * 0.6) add('dialog', 'warning', t('Dialogue box covers {0}% of the screen height.', { 0: Math.round((dialog.height / c.areaH) * 100) }));
  const dSize = fontPx(th.dialog.text.size, c);
  if (th.dialog.text.size * c.s < c.minFont) add('dialog', 'info', t('Dialogue text raised to the minimum readable size ({0}px).', { 0: Math.round(dSize) }));
  const nameH = th.nameBox.enabled && th.nameBox.attach === 'inside' ? nameBoxHeight(th, c) : 0;
  const lines = Math.floor((dialogLayout.maxHeight - 2 * th.dialog.padding.y * c.s - nameH) / (dSize * th.dialog.text.lineHeight));
  if (lines < 2) add('dialog', 'warning', t('Only {0} line(s) of dialogue fit on screen — long text will scroll.', { 0: Math.max(0, lines) }));

  if (th.choice.height * c.s < c.touch) add('choices', 'info', t('Choice buttons enlarged to {0}px so they are easy to tap.', { 0: c.touch }));
  const region = choiceRegion(c, dialog, th.choice.spacing * c.s);
  const listH = 3 * choiceButtonHeight(th, c) + 2 * th.choice.spacing * c.s;
  if (listH > region.height) add('choices', 'warning', t('Not enough free space for 3 choices next to the dialogue box — the list will scroll.'));

  if (menubar) {
    if (th.menuBar.height * c.s < c.touch) add('menubar', 'info', t('Menu buttons enlarged to {0}px so they are easy to tap.', { 0: c.touch }));
    if (intersects(menubar, dialog)) add('menubar', 'warning', t('The menu bar overlaps the dialogue box.'));
  }
  return out;
}

/** Device-independent checks (text contrast). */
export function checkReadability(th: Theme): LayoutIssue[] {
  const out: LayoutIssue[] = [];
  const low = (fg: string, bg: string, op: number, shadow: boolean) => !shadow && textContrast(fg, bg, op) < 4.5;
  const add = (element: LayoutIssue['element'], what: string, ratio: number) =>
    out.push({ device: 'all', element, severity: 'warning', message: t('Low contrast: {0} ({1}:1, aim for 4.5:1). Make the background more opaque, change a color or turn on text shadow.', { 0: what, 1: ratio.toFixed(1) }) });
  const d = th.dialog;
  if (low(d.text.color, d.surface.background, d.surface.opacity, d.text.shadow)) add('dialog', t('dialogue text'), textContrast(d.text.color, d.surface.background, d.surface.opacity));
  const n = th.nameBox;
  if (n.enabled && low(n.text.color, n.surface.background, n.surface.opacity, n.text.shadow)) add('name', t('name text'), textContrast(n.text.color, n.surface.background, n.surface.opacity));
  const states = { normal: () => t('Normal'), hover: () => t('Hover'), pressed: () => t('Pressed') };
  for (const [state, name] of Object.entries(states)) {
    const s = th.choice.states[state as keyof typeof states];
    if (low(s.color, s.background, s.opacity, th.choice.text.shadow)) add('choices', t('choice text ({0})', { 0: name() }), textContrast(s.color, s.background, s.opacity));
  }
  const m = th.menuBar;
  if (m.enabled && low(m.text.color, m.surface.background, m.surface.opacity, m.text.shadow)) add('menubar', t('menu button text'), textContrast(m.text.color, m.surface.background, m.surface.opacity));
  return out;
}

export function checkAllDevices(th: Theme, labels: Record<string, string> = {}): LayoutIssue[] {
  return [...checkReadability(th), ...DEVICES.flatMap((d) => checkLayout(th, d, labels))];
}
