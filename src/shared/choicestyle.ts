// Choice button presets: complete looks for the choice buttons (shape, colours per state, icon, hover and
// press feedback). Applying one replaces the theme's choice buttons; the dialogue box and menus stay.
import type { ChoiceStateStyle, FontRef, Theme, ThemeChoices, UiShadow } from './types';
import { getPresetTheme, merge, px, type DeepPartial } from './themes';

export { CHOICE_SHAPES } from './themes';

export interface ChoicePreset {
  id: string;
  name: string;
  description: string;
  choice: DeepPartial<ThemeChoices>;
}

const st = (background: string, color: string, borderColor: string, opacity = 1): ChoiceStateStyle => ({ background, color, borderColor, opacity, image: null });
const shadow = (size: number, y: number, opacity: number, color = '#000000'): UiShadow => ({ size, y, color, opacity });
const NONE = shadow(0, 0, 0);
const font = (family: string): FontRef => ({ family });

export const CHOICE_PRESETS: readonly ChoicePreset[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Parchment buttons with a brown frame',
    choice: {
      shape: 'box',
      surface: { borderWidth: 3, radius: 6, shadow: shadow(14, 4, 0.3) },
      text: { color: '#2b1d0e', font: font('Georgia') },
      states: {
        normal: st('#f3e7cf', '#2b1d0e', '#8a6a3b', 0.96),
        hover: st('#e2c992', '#2b1d0e', '#5e4423'),
        pressed: st('#d4b16a', '#2b1d0e', '#5e4423'),
        disabled: st('#e8e1d2', '#7d7266', '#b3a68e', 0.7),
      },
      hoverAnimation: 'lift',
      pressAnimation: 'sink',
    },
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Rounded dark glass that lights up blue',
    choice: {
      shape: 'box',
      surface: { borderWidth: 2, radius: 18, shadow: shadow(24, 8, 0.35), blur: 8 },
      states: {
        normal: st('#101420', '#ffffff', '#8090ff', 0.85),
        hover: st('#3d55e0', '#ffffff', '#ffffff'),
        pressed: st('#2f45c2', '#ffffff', '#ffffff'),
        disabled: st('#101420', '#9aa0b4', '#454b60', 0.6),
      },
      hoverAnimation: 'grow',
      pressAnimation: 'shrink',
    },
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Just text with a line underneath',
    choice: {
      shape: 'underline',
      width: px(820),
      height: 64,
      spacing: 10,
      surface: { borderWidth: 2, radius: 0, shadow: NONE, blur: 0 },
      text: { shadow: true, align: 'left' },
      states: {
        normal: st('#000000', '#ffffff', '#ffffff', 0),
        hover: st('#000000', '#ffe08a', '#ffe08a', 0.25),
        pressed: st('#000000', '#ffe08a', '#ffe08a', 0.4),
        disabled: st('#000000', '#8c8c8c', '#8c8c8c', 0),
      },
      hoverAnimation: 'slide',
      pressAnimation: 'none',
    },
  },
  {
    id: 'rpg',
    name: 'RPG',
    description: 'A game menu on the right with a ▶ cursor',
    choice: {
      shape: 'box',
      icon: '▶',
      anchor: 'right',
      x: px(70),
      width: px(720),
      minWidth: 300,
      height: 70,
      spacing: 12,
      surface: { borderWidth: 3, radius: 8, shadow: NONE },
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
  },
  {
    id: 'fantasy',
    name: 'Fantasy',
    description: 'Purple and gold banners with a glow',
    choice: {
      shape: 'banner',
      icon: '✦',
      surface: { borderWidth: 0, radius: 0, shadow: NONE, glow: { size: 0, color: '#f0d060', opacity: 0.8 } },
      text: { color: '#fdf6e3', font: font('Palatino Linotype') },
      states: {
        normal: st('#3a1f66', '#fdf6e3', '#d4af37', 0.94),
        hover: st('#6b3fa0', '#ffffff', '#f0d060'),
        pressed: st('#4e2c78', '#ffffff', '#f0d060'),
        disabled: st('#2a1a4a', '#9d93b0', '#6b5a2a', 0.6),
      },
      hoverAnimation: 'glow',
      pressAnimation: 'shrink',
    },
  },
  {
    id: 'bubble',
    name: 'Bubble',
    description: 'White speech bubbles, like answering in a chat',
    choice: {
      shape: 'bubble',
      width: px(900),
      surface: { borderWidth: 3, radius: 40, shadow: shadow(0, 6, 0.25) },
      text: { color: '#1a1a1a', font: font('Trebuchet MS') },
      states: {
        normal: st('#ffffff', '#1a1a1a', '#1a1a1a', 0.97),
        hover: st('#ffe3ef', '#1a1a1a', '#d6336c'),
        pressed: st('#ffc9de', '#1a1a1a', '#d6336c'),
        disabled: st('#eeeeee', '#8a8a8a', '#bbbbbb', 0.8),
      },
      hoverAnimation: 'lift',
      pressAnimation: 'sink',
    },
  },
  {
    id: 'image',
    name: 'Image Button',
    description: 'Use your own button pictures for normal, hover, pressed and disabled',
    choice: {
      shape: 'box',
      surface: { borderWidth: 0, radius: 0, shadow: NONE, imageFit: 'stretch' },
      text: { shadow: true },
      // Colours are only a fallback until the pictures are chosen.
      states: {
        normal: st('#30364d', '#ffffff', '#30364d', 0.9),
        hover: st('#4b5578', '#ffffff', '#4b5578'),
        pressed: st('#242a3d', '#ffffff', '#242a3d'),
        disabled: st('#30364d', '#9aa0b4', '#30364d', 0.5),
      },
      hoverAnimation: 'grow',
      pressAnimation: 'shrink',
    },
  },
];

export function getChoicePreset(id: string | null | undefined): ChoicePreset | undefined {
  return CHOICE_PRESETS.find((p) => p.id === id);
}

/** The choice buttons a preset gives (built on the default theme, so every field is set). */
export function choiceParts(p: ChoicePreset): ThemeChoices {
  const choice = merge(getPresetTheme('modern')!.choice, p.choice);
  choice.preset = p.id;
  return choice;
}

/**
 * Applies a choice preset to a theme (in place). Button pictures already chosen for the states are kept
 * when switching to Image Button, so a user can try the preset after importing their pictures.
 */
export function applyChoicePreset(theme: Theme, id: string): boolean {
  const p = getChoicePreset(id);
  if (!p) return false;
  const next = choiceParts(p);
  if (id === 'image') for (const k of Object.keys(next.states) as (keyof ThemeChoices['states'])[]) next.states[k].image = theme.choice.states[k].image;
  theme.choice = next;
  return true;
}
