import type { Asset, AssetType, Project } from './types';

export interface SceneSearchHit {
  sceneId: string;
  chapterId: string;
  match: 'name' | 'chapter' | 'tag' | 'dialogue';
  snippet?: string;
  actionId?: string;
}

/** Search scenes by scene name, chapter name, tags and dialogue text. */
export function searchScenes(p: Project, query: string): SceneSearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: SceneSearchHit[] = [];
  const sceneMap = new Map(p.scenes.map((s) => [s.id, s]));
  for (const ch of p.chapters) {
    const chapterMatch = ch.name.toLowerCase().includes(q);
    for (const sid of ch.sceneIds) {
      const s = sceneMap.get(sid);
      if (!s) continue;
      if (s.name.toLowerCase().includes(q)) {
        hits.push({ sceneId: s.id, chapterId: ch.id, match: 'name' });
        continue;
      }
      if (s.tags.some((t) => t.toLowerCase().includes(q))) {
        hits.push({ sceneId: s.id, chapterId: ch.id, match: 'tag', snippet: s.tags.join(', ') });
        continue;
      }
      const a = s.actions.find((x) => {
        const texts = [x.params?.text, x.params?.question, ...(x.params?.options ?? []).map((o: any) => o.text)];
        return texts.some((t) => typeof t === 'string' && t.toLowerCase().includes(q));
      });
      if (a) {
        const text = [a.params.text, a.params.question, ...(a.params.options ?? []).map((o: any) => o.text)].find(
          (t) => typeof t === 'string' && t.toLowerCase().includes(q),
        ) as string;
        const i = text.toLowerCase().indexOf(q);
        const snippet = `${i > 20 ? '…' : ''}${text.slice(Math.max(0, i - 20), i + q.length + 30)}`;
        hits.push({ sceneId: s.id, chapterId: ch.id, match: 'dialogue', snippet, actionId: a.id });
        continue;
      }
      if (chapterMatch) hits.push({ sceneId: s.id, chapterId: ch.id, match: 'chapter' });
    }
  }
  return hits;
}

export type AssetSort = 'name' | 'type' | 'size' | 'date' | 'folder';

export interface AssetFilter {
  query?: string;
  types?: AssetType[];
  folder?: string | null;
  tag?: string | null;
  collectionIds?: string[] | null;
  includeSubfolders?: boolean;
}

export function folderOf(path: string): string {
  const i = path.lastIndexOf('/');
  return i >= 0 ? path.slice(0, i) : '';
}

export function filterAssets(assets: Asset[], f: AssetFilter, sort: AssetSort = 'name', dir: 'asc' | 'desc' = 'asc'): Asset[] {
  const q = f.query?.trim().toLowerCase() ?? '';
  const ids = f.collectionIds ? new Set(f.collectionIds) : null;
  const out = assets.filter((a) => {
    if (f.types && f.types.length && !f.types.includes(a.type)) return false;
    if (f.folder) {
      const folder = folderOf(a.path);
      if (f.includeSubfolders === false ? folder !== f.folder : !(folder === f.folder || folder.startsWith(`${f.folder}/`))) return false;
    }
    if (f.tag && !a.tags.includes(f.tag)) return false;
    if (ids && !ids.has(a.id)) return false;
    if (q && !(a.name.toLowerCase().includes(q) || a.path.toLowerCase().includes(q) || a.tags.some((t) => t.toLowerCase().includes(q)))) return false;
    return true;
  });
  const m = dir === 'asc' ? 1 : -1;
  out.sort((a, b) => {
    switch (sort) {
      case 'type':
        return m * (a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
      case 'size':
        return m * (a.size - b.size);
      case 'date':
        return m * (a.importedAt - b.importedAt);
      case 'folder':
        return m * (a.path.localeCompare(b.path));
      default:
        return m * a.name.localeCompare(b.name, undefined, { numeric: true });
    }
  });
  return out;
}
