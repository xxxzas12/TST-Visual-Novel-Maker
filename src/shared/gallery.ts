// In-game Gallery (for games made with TSTVN): CG, Characters, Music and Endings with locked/unlocked
// state. Items are derived from what the story uses; each item has an unlock rule.
import type { GalleryUnlock, GameGallery, Project, ProjectGallery } from './types';
import { orderedSceneIds } from './project';

export const GALLERY_SECTIONS = ['cg', 'characters', 'music', 'endings'] as const;
export type GallerySection = (typeof GALLERY_SECTIONS)[number];

export interface GalleryItem {
  /** Stable key: cg:<assetId>, char:<characterId>, music:<assetId>, ending:<actionId>. */
  key: string;
  section: GallerySection;
  label: string;
  assetId?: string;
  characterId?: string;
  sceneName?: string;
}

export function defaultGallery(): ProjectGallery {
  return { enabled: false, sections: { cg: true, characters: true, music: true, endings: true }, unlock: {} };
}

/** Everything the gallery can show, in story order, from the project's (enabled) actions. */
export function galleryItems(p: Project): GalleryItem[] {
  const sceneMap = new Map(p.scenes.map((s) => [s.id, s]));
  const assetName = (id: string) => p.assets.find((a) => a.id === id)?.name ?? id;
  const out: GalleryItem[] = [];
  const seen = new Set<string>();
  const add = (it: GalleryItem) => {
    if (seen.has(it.key)) return;
    seen.add(it.key);
    out.push(it);
  };
  for (const sid of orderedSceneIds(p)) {
    const s = sceneMap.get(sid);
    if (!s) continue;
    for (const a of s.actions) {
      if (a.disabled) continue;
      const pr = a.params ?? {};
      if (a.type === 'showCG' && pr.assetId) add({ key: `cg:${pr.assetId}`, section: 'cg', label: assetName(pr.assetId), assetId: pr.assetId });
      if ((a.type === 'playBGM' || a.type === 'changeBGM') && pr.assetId) add({ key: `music:${pr.assetId}`, section: 'music', label: assetName(pr.assetId).replace(/\.[^.]+$/, ''), assetId: pr.assetId });
      if (a.type === 'addCharacter' && pr.characterId) {
        const c = p.characters.find((x) => x.id === pr.characterId);
        if (c) add({ key: `char:${c.id}`, section: 'characters', label: c.displayName || c.name, characterId: c.id });
      }
      if (a.type === 'endGame') add({ key: `ending:${a.id}`, section: 'endings', label: String(pr.message || 'The End'), sceneName: s.name });
    }
  }
  if (p.settings.titleMusicAssetId) add({ key: `music:${p.settings.titleMusicAssetId}`, section: 'music', label: assetName(p.settings.titleMusicAssetId).replace(/\.[^.]+$/, '') });
  return out;
}

export function unlockRule(g: ProjectGallery | undefined, key: string): GalleryUnlock {
  return g?.unlock[key] ?? { mode: 'seen' };
}

/** Gallery data for the runtime (undefined when the project has no gallery). */
export function buildGallery(p: Project): GameGallery | undefined {
  const g = p.settings.gallery;
  if (!g?.enabled) return undefined;
  const items = galleryItems(p).filter((i) => g.sections[i.section]);
  return {
    sections: GALLERY_SECTIONS.filter((s) => g.sections[s]),
    items: items.map(({ key, section, label, assetId, characterId, sceneName }) => ({ key, section, label, assetId, characterId, sceneName })),
    alwaysUnlocked: items.filter((i) => unlockRule(g, i.key).mode === 'always').map((i) => i.key),
  };
}
