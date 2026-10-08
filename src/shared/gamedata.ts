import type { GameAsset, GameData, Project, Theme } from './types';
import { collectUsedAssetIds } from './validate';
import { orderedSceneIds } from './project';
import { normalizeTheme, resolveTheme, themeExists, themeFontRefs } from './themes';

export { cssFamily } from './themes';

/**
 * The theme as the game uses it: a copy of the project/scene theme with the project's
 * game font and dialogue size (Settings → Fonts) applied.
 */
export function gameTheme(p: Project, themeId: string | null | undefined): Theme {
  // Copy: custom themes are (frozen) project state.
  const theme = normalizeTheme(JSON.parse(JSON.stringify(resolveTheme(themeId, p.themes))));
  const df = p.settings.dialogueFont;
  if (df?.family) theme.fontFace = df.file ? { family: df.family, file: df.file } : { family: df.family };
  const size = p.settings.dialogueFontSize;
  if (size && size > 0) {
    const k = size / theme.dialog.text.size;
    theme.dialog.text.size = size;
    theme.nameBox.text.size = Math.round(theme.nameBox.text.size * k);
    theme.choice.text.size = Math.round(theme.choice.text.size * k);
  }
  return theme;
}

/** Theme ids that scenes override the project theme with (only existing themes). */
export function sceneThemeIds(p: Project): string[] {
  const ids = new Set<string>();
  for (const s of p.scenes) if (s.themeId && s.themeId !== p.settings.themeId && themeExists(s.themeId, p.themes)) ids.add(s.themeId);
  return [...ids];
}

/**
 * Builds the runtime GameData from an editor Project.
 * - disabled actions are removed
 * - only assets the game actually uses are included
 * The same function powers editor preview and game export, so what you
 * preview is exactly what gets exported.
 */
export function buildGameData(p: Project): GameData {
  const order = orderedSceneIds(p);
  const sceneMap = new Map(p.scenes.map((s) => [s.id, s]));
  const used = collectUsedAssetIds(p);
  const assets: Record<string, GameAsset> = {};
  for (const a of p.assets) {
    if (!used.has(a.id)) continue;
    assets[a.id] = { path: a.path, type: a.type, kind: a.kind, width: a.width, height: a.height };
  }
  const theme = gameTheme(p, p.settings.themeId);
  const themes: Record<string, Theme> = {};
  for (const id of sceneThemeIds(p)) themes[id] = gameTheme(p, id);
  const fonts = new Map<string, { family: string; path: string }>();
  for (const t of [theme, ...Object.values(themes)]) {
    for (const f of themeFontRefs(t)) if (f.file && !fonts.has(f.file)) fonts.set(f.file, { family: f.family, path: f.file });
  }
  const startSceneId = p.settings.startSceneId && sceneMap.has(p.settings.startSceneId) ? p.settings.startSceneId : (order[0] ?? null);
  return {
    format: 'tstvn-game',
    version: 1,
    id: p.id,
    title: p.settings.title || p.name,
    author: p.settings.author,
    resolution: p.settings.resolution,
    startSceneId,
    sceneOrder: order,
    scenes: order
      .map((id) => sceneMap.get(id))
      .filter((s): s is NonNullable<typeof s> => !!s)
      .map((s) => ({
        id: s.id,
        name: s.name,
        actions: s.actions.filter((a) => !a.disabled),
        ...(s.themeId && themes[s.themeId] ? { themeId: s.themeId } : {}),
      })),
    characters: p.characters,
    variables: p.variables,
    theme,
    themes,
    fonts: [...fonts.values()],
    assets,
    textSpeed: p.settings.textSpeed,
    titleBackgroundAssetId: p.settings.titleBackgroundAssetId,
    titleMusicAssetId: p.settings.titleMusicAssetId,
    iconAssetId: p.settings.gameIconAssetId,
    displayMode: p.settings.displayMode,
    language: p.settings.language,
  };
}
