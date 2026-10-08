// Style Library: reusable Textbox styles (dialogue box + name box) and Choice styles saved in the project.
// A theme can be linked to a style: the style then replaces the theme's own dialogue/name box (or choice
// buttons) wherever the theme is used, and editing the style updates every linked theme. "Edit only here"
// copies the style into the theme and unlinks it (a local override).
import type { Project, Theme, ThemeChoices, ThemeDialogBox, ThemeNameBox } from './types';
import { getPresetTheme, normalizeTheme } from './themes';
import { newId } from './ids';

export type UiStyleKind = 'textbox' | 'choice';

export interface UiStyle {
  id: string;
  name: string;
  kind: UiStyleKind;
  /** Textbox styles. */
  dialog?: ThemeDialogBox;
  nameBox?: ThemeNameBox;
  /** Choice styles. */
  choice?: ThemeChoices;
}

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** Accepts anything read from a project file and returns valid styles (damaged entries are dropped). */
export function normalizeStyles(raw: unknown): UiStyle[] {
  if (!Array.isArray(raw)) return [];
  const out: UiStyle[] = [];
  for (const s of raw) {
    if (!s || typeof s !== 'object' || typeof s.id !== 'string' || (s.kind !== 'textbox' && s.kind !== 'choice')) continue;
    // Reuse the theme repair: put the parts in a theme, normalize, take them out again.
    const t = normalizeTheme({ ...getPresetTheme('modern')!, ...(s.kind === 'textbox' ? { dialog: s.dialog, nameBox: s.nameBox } : { choice: s.choice }) });
    const name = typeof s.name === 'string' && s.name.trim() ? s.name : 'Style';
    out.push(s.kind === 'textbox' ? { id: s.id, name, kind: 'textbox', dialog: t.dialog, nameBox: t.nameBox } : { id: s.id, name, kind: 'choice', choice: t.choice });
  }
  return out;
}

export function findStyle(styles: UiStyle[] | undefined, id: string | null | undefined, kind: UiStyleKind): UiStyle | undefined {
  return id ? styles?.find((s) => s.id === id && s.kind === kind) : undefined;
}

/** The theme as players see it: linked styles replace the theme's own parts (in place; returns the theme). */
export function applyStyles(t: Theme, styles: UiStyle[] | undefined): Theme {
  const tb = findStyle(styles, t.textboxStyleId, 'textbox');
  if (tb?.dialog && tb.nameBox) {
    t.dialog = { ...clone(tb.dialog), textSpeed: t.dialog.textSpeed };
    t.nameBox = clone(tb.nameBox);
  }
  const ch = findStyle(styles, t.choiceStyleId, 'choice');
  if (ch?.choice) t.choice = clone(ch.choice);
  return t;
}

/** A new style made from a theme's current dialogue/name box or choice buttons. */
export function styleFromTheme(t: Theme, kind: UiStyleKind, name: string): UiStyle {
  return kind === 'textbox'
    ? { id: newId('st'), name, kind, dialog: clone(t.dialog), nameBox: clone(t.nameBox) }
    : { id: newId('st'), name, kind, choice: clone(t.choice) };
}

/**
 * Stores an edited (resolved) theme: parts that come from a linked style go to the style — so every theme
 * using it updates — and everything else to the theme itself. `target` and `styles` may be drafts.
 */
export function storeEditedTheme(target: Theme, edited: Theme, styles: UiStyle[] | undefined) {
  const tb = findStyle(styles, target.textboxStyleId, 'textbox');
  const ch = findStyle(styles, target.choiceStyleId, 'choice');
  for (const k of Object.keys(edited) as (keyof Theme)[]) {
    if (k === 'id') continue;
    if ((k === 'dialog' || k === 'nameBox') && tb) continue;
    if (k === 'choice' && ch) continue;
    (target as unknown as Record<string, unknown>)[k] = clone(edited[k]);
  }
  if (tb) {
    // The text speed belongs to the theme (it is about pacing, not looks).
    tb.dialog = { ...clone(edited.dialog), textSpeed: null };
    tb.nameBox = clone(edited.nameBox);
    target.dialog.textSpeed = edited.dialog.textSpeed;
  }
  if (ch) ch.choice = clone(edited.choice);
}

/** Themes (of the project) linked to a style. */
export function styleUsers(p: Pick<Project, 'themes'>, style: UiStyle): Theme[] {
  return p.themes.filter((t) => (style.kind === 'textbox' ? t.textboxStyleId : t.choiceStyleId) === style.id);
}

/** "Edit only here": the theme gets its own copy of the style and is unlinked (local override). */
export function detachStyle(t: Theme, kind: UiStyleKind, styles: UiStyle[] | undefined) {
  const s = findStyle(styles, kind === 'textbox' ? t.textboxStyleId : t.choiceStyleId, kind);
  if (s) applyStyles(t, [s]);
  if (kind === 'textbox') t.textboxStyleId = null;
  else t.choiceStyleId = null;
}

/** Deletes a style; themes using it keep its look as their own (nothing changes on screen). */
export function deleteStyle(p: Pick<Project, 'themes' | 'uiStyles'>, id: string) {
  const s = p.uiStyles?.find((x) => x.id === id);
  if (!s) return;
  for (const t of styleUsers(p, s)) detachStyle(t, s.kind, p.uiStyles);
  p.uiStyles = p.uiStyles!.filter((x) => x.id !== id);
}

/** Image assets a style uses. */
export function styleAssetIds(s: UiStyle): string[] {
  const surfaces = [s.dialog?.surface, s.nameBox?.surface, s.choice?.surface].filter((x) => !!x);
  return [...surfaces.flatMap((x) => [x!.image, x!.texture, x!.frameImage]), ...Object.values(s.choice?.states ?? {}).map((x) => x.image)].filter((x): x is string => !!x);
}

/** Replaces (or clears, with null) an asset in every style; returns how many slots changed. */
export function mapStyleImages(styles: UiStyle[] | undefined, fn: (id: string) => string | null): number {
  let n = 0;
  const swap = <K extends string>(o: Record<K, string | null>, k: K) => {
    const id = o[k];
    if (!id) return;
    const next = fn(id);
    if (next !== id) {
      o[k] = next;
      n++;
    }
  };
  for (const s of styles ?? []) {
    for (const x of [s.dialog?.surface, s.nameBox?.surface, s.choice?.surface]) if (x) for (const k of ['image', 'texture', 'frameImage'] as const) swap(x, k);
    for (const st of Object.values(s.choice?.states ?? {})) swap(st, 'image');
  }
  return n;
}
