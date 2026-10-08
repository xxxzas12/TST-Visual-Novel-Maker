// Editor look: UI font, UI font size, light/dark appearance, and loading of imported fonts.
import { customFontUrl, type CustomFont } from '../shared/api';
import { cssFamily } from '../shared/gamedata';

export const DEFAULT_UI_FONT_STACK = "'Segoe UI', 'Leelawadee UI', 'Noto Sans Thai', 'Noto Sans', system-ui, sans-serif";
export const DEFAULT_UI_FONT_SIZE = 14;
export const UI_FONT_SIZE_RANGE = { min: 11, max: 20 };
/** Design px on the 1920×1080 UI canvas (see shared/uilayout.ts). */
export const DIALOGUE_FONT_SIZE_RANGE = { min: 20, max: 72 };

export type Appearance = 'dark' | 'light' | 'system';

export function fontStack(family: string | undefined | null): string {
  return family ? `${cssFamily(family)}, ${DEFAULT_UI_FONT_STACK}` : DEFAULT_UI_FONT_STACK;
}

export function resolveAppearance(a: Appearance | undefined): 'dark' | 'light' {
  if (a === 'light' || a === 'dark') return a;
  if (a === 'system' && typeof matchMedia === 'function') return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  return 'dark';
}

export function applyLook(look: { uiFont?: string; uiFontSize?: number; appearance?: Appearance }) {
  const root = document.documentElement;
  root.style.setProperty('--ui-font', fontStack(look.uiFont));
  root.style.fontSize = `${look.uiFontSize ?? DEFAULT_UI_FONT_SIZE}px`;
  root.dataset.theme = resolveAppearance(look.appearance);
}

const loaded = new Set<string>();

/** Registers imported fonts with the document so they can be used without installing them in Windows. */
export async function registerCustomFonts(list: CustomFont[]): Promise<void> {
  await Promise.all(
    list.map(async (f) => {
      if (loaded.has(f.id)) return;
      try {
        const face = new FontFace(f.family, `url("${customFontUrl(f)}")`);
        document.fonts.add(await face.load());
        loaded.add(f.id);
      } catch (e) {
        console.warn('[TSTVN] could not load font', f.family, e);
      }
    }),
  );
}
