// Textbox style presets: complete looks for the dialogue box and name box, each with its own shape
// (not just other colours). Applying one replaces the dialogue box and name box of a theme;
// choices, menu bar and menus are left alone.
import type { FontRef, Theme, ThemeDialogBox, ThemeNameBox, UiShadow } from './types';
import { getPresetTheme, merge, px, type DeepPartial } from './themes';

export { DIALOG_FRAMES, NAME_SHAPES } from './themes';

export interface TextboxPreset {
  id: string;
  name: string;
  description: string;
  dialog: DeepPartial<ThemeDialogBox>;
  nameBox: DeepPartial<ThemeNameBox>;
}

const font = (family: string): FontRef => ({ family });
const shadow = (size: number, y: number, opacity: number, color = '#000000'): UiShadow => ({ size, y, color, opacity });
const NONE = shadow(0, 0, 0);

export const TEXTBOX_PRESETS: readonly TextboxPreset[] = [
  {
    id: 'classic',
    name: 'Classic VN',
    description: 'A framed box with the name on a tab above it',
    dialog: {
      frame: 'box',
      width: px(1640),
      height: px(260),
      y: px(28),
      padding: { x: 56, y: 38 },
      surface: { background: '#1c1830', opacity: 0.86, borderColor: '#c8b88a', borderWidth: 2, radius: 6, shadow: shadow(30, 8, 0.4) },
      text: { color: '#f4efe2', font: font('Georgia') },
    },
    nameBox: {
      shape: 'tab',
      attach: 'outside',
      x: 48,
      y: 0,
      padding: { x: 34, y: 8 },
      surface: { background: '#1c1830', opacity: 0.92, borderColor: '#c8b88a', borderWidth: 2, radius: 10 },
      text: { color: '#f2d98d', font: font('Georgia') },
      speakerColor: false,
    },
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Rounded frosted glass with a coloured name pill',
    dialog: {
      frame: 'box',
      surface: { background: '#101420', opacity: 0.72, radius: 26, shadow: shadow(48, 12, 0.45), blur: 10 },
    },
    nameBox: { shape: 'box', surface: { background: '#3d55e0', radius: 999 }, padding: { x: 28, y: 6 } },
  },
  {
    id: 'bubble',
    name: 'Speech Bubble',
    description: 'A comic-style bubble whose tail points at the speaking character',
    dialog: {
      frame: 'bubble',
      width: px(1400),
      height: px(220),
      y: px(40),
      padding: { x: 56, y: 32 },
      surface: { background: '#ffffff', opacity: 0.97, borderColor: '#1a1a1a', borderWidth: 4, radius: 60, shadow: shadow(0, 8, 0.25) },
      text: { color: '#1a1a1a', size: 38, font: font('Trebuchet MS') },
    },
    nameBox: {
      shape: 'plain',
      attach: 'inside',
      padding: { x: 0, y: 0 },
      surface: { background: '#ffffff', opacity: 0, borderWidth: 0 },
      text: { color: '#d6336c', bold: true, font: font('Trebuchet MS') },
      speakerColor: false,
    },
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'No box — a soft shadow band across the bottom of the screen',
    dialog: {
      frame: 'band',
      width: px(1920),
      height: px(300),
      y: px(0),
      padding: { x: 200, y: 60 },
      surface: { background: '#000000', opacity: 0.78, borderWidth: 0, radius: 0, shadow: NONE },
      text: { shadow: true, size: 37 },
    },
    nameBox: { shape: 'plain', padding: { x: 0, y: 0 }, surface: { opacity: 0, borderWidth: 0 }, text: { color: '#ffe08a', shadow: true }, speakerColor: false },
  },
  {
    id: 'fantasy',
    name: 'Fantasy',
    description: 'Double gold border with corner gems and a ribbon name banner',
    dialog: {
      frame: 'ornate',
      width: px(1640),
      padding: { x: 64, y: 40 },
      surface: { background: '#24123f', opacity: 0.9, borderColor: '#d4af37', borderWidth: 6, radius: 14, shadow: shadow(40, 10, 0.5) },
      text: { color: '#fdf6e3', font: font('Palatino Linotype') },
    },
    nameBox: {
      shape: 'ribbon',
      attach: 'outside',
      align: 'center',
      y: 14,
      padding: { x: 64, y: 8 },
      surface: { background: '#b8892a', opacity: 1, borderWidth: 0, radius: 0 },
      text: { color: '#2a1606', bold: true, font: font('Palatino Linotype') },
      speakerColor: false,
    },
  },
  {
    id: 'scifi',
    name: 'Sci-Fi',
    description: 'Cut corners, glowing cyan lines and faint scan lines',
    dialog: {
      frame: 'tech',
      width: px(1700),
      padding: { x: 60, y: 36 },
      surface: { background: '#04121c', opacity: 0.84, borderColor: '#35e0ff', borderWidth: 2, radius: 0, shadow: shadow(28, 0, 0.6, '#35e0ff') },
      text: { color: '#d8f7ff', letterSpacing: 0.6, font: font('Bahnschrift') },
    },
    nameBox: {
      shape: 'slant',
      attach: 'outside',
      x: 40,
      y: 6,
      padding: { x: 40, y: 6 },
      surface: { background: '#35e0ff', opacity: 0.95, borderWidth: 0, radius: 0 },
      text: { color: '#03141d', bold: true, letterSpacing: 2, font: font('Bahnschrift') },
      speakerColor: false,
    },
  },
  {
    id: 'horror',
    name: 'Horror',
    description: 'Torn, ragged edges in black and blood red',
    dialog: {
      frame: 'torn',
      width: px(1720),
      padding: { x: 70, y: 44 },
      surface: { background: '#0a0000', opacity: 0.92, borderColor: '#7a0000', borderWidth: 0, radius: 0, shadow: NONE },
      text: { color: '#e6dcd2', letterSpacing: 1, shadow: true, font: font('Courier New') },
    },
    nameBox: { shape: 'plain', padding: { x: 0, y: 0 }, surface: { opacity: 0, borderWidth: 0 }, text: { color: '#e03030', letterSpacing: 3, shadow: true, font: font('Courier New') }, speakerColor: false },
  },
  {
    id: 'rpg',
    name: 'RPG',
    description: 'A classic game window with a white double frame and its own name window',
    dialog: {
      frame: 'window',
      width: px(1820),
      height: px(280),
      y: px(20),
      padding: { x: 48, y: 34 },
      surface: { background: '#10226a', opacity: 0.94, borderColor: '#f2f2ff', borderWidth: 5, radius: 12, shadow: NONE },
      text: { size: 37, letterSpacing: 0.5, shadow: true },
    },
    nameBox: {
      shape: 'box',
      attach: 'outside',
      x: 0,
      y: 8,
      padding: { x: 30, y: 8 },
      surface: { background: '#10226a', opacity: 0.96, borderColor: '#f2f2ff', borderWidth: 5, radius: 10 },
      text: { color: '#ffe066', shadow: true },
      speakerColor: false,
    },
  },
  {
    id: 'retro',
    name: 'Retro',
    description: 'Pixel-art box with stepped corners and a typewriter font',
    dialog: {
      frame: 'pixel',
      width: px(1640),
      padding: { x: 52, y: 36 },
      surface: { background: '#0f0f23', opacity: 1, borderColor: '#e8e8e8', borderWidth: 6, radius: 0, shadow: NONE },
      text: { color: '#e8e8e8', size: 34, lineHeight: 1.7, font: font('Consolas') },
    },
    nameBox: {
      shape: 'pixel',
      attach: 'outside',
      x: 18,
      y: 18,
      padding: { x: 24, y: 6 },
      surface: { background: '#e8e8e8', opacity: 1, borderColor: '#e8e8e8', borderWidth: 6, radius: 0 },
      text: { color: '#0f0f23', size: 30, bold: true, font: font('Consolas') },
      speakerColor: false,
    },
  },
];

export function getTextboxPreset(id: string | null | undefined): TextboxPreset | undefined {
  return TEXTBOX_PRESETS.find((p) => p.id === id);
}

/** The dialogue box and name box a textbox preset gives (built on the default theme, so every field is set). */
export function textboxParts(p: TextboxPreset): { dialog: ThemeDialogBox; nameBox: ThemeNameBox } {
  const base = getPresetTheme('modern')!;
  const dialog = merge(base.dialog, p.dialog);
  dialog.preset = p.id;
  return { dialog, nameBox: merge(base.nameBox, p.nameBox) };
}

/** Applies a textbox preset to a theme (in place). The text speed chosen for the theme is kept. */
export function applyTextboxPreset(theme: Theme, id: string): boolean {
  const p = getTextboxPreset(id);
  if (!p) return false;
  const { dialog, nameBox } = textboxParts(p);
  theme.dialog = { ...dialog, textSpeed: theme.dialog.textSpeed };
  theme.nameBox = nameBox;
  return true;
}
