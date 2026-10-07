import type { Asset } from '../shared/types';

/** URL for a project-relative path, served by the main process (only the open project). */
export function assetUrlForPath(path: string, rev?: number): string {
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  return `tstvn-asset://project/${encoded}${rev ? `?v=${rev}` : ''}`;
}

export function assetUrl(a: Pick<Asset, 'path' | 'rev'>): string {
  return assetUrlForPath(a.path, a.rev);
}

export function thumbUrl(a: Pick<Asset, 'id' | 'path' | 'rev' | 'hasThumb' | 'kind'>): string | null {
  if (a.kind !== 'image') return null;
  return a.hasThumb ? assetUrlForPath(`.tstvn/thumbs/${a.id}.png`, a.rev + 1) : assetUrl(a);
}
