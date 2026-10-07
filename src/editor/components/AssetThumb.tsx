import { t as tr } from '../../shared/i18n';
import { memo, useState } from 'react';
import type { Asset } from '../../shared/types';
import { thumbUrl } from '../assetUrl';

export const MEDIA_ICON: Record<string, string> = { image: '🖼️', audio: '🎵', video: '🎬' };
export const TYPE_ICON: Record<string, string> = {
  background: '🏞️',
  character: '🧍',
  portrait: '🙂',
  cg: '🌄',
  ui: '🔲',
  music: '🎵',
  voice: '🎙️',
  sfx: '🔔',
  video: '🎬',
  unknown: '❔',
};

/** Thumbnail with lazy loading; falls back to an icon for audio/video or broken files. */
export const AssetThumb = memo(function AssetThumb({ asset, missing }: { asset: Pick<Asset, 'id' | 'path' | 'rev' | 'hasThumb' | 'kind' | 'type' | 'name'>; missing?: boolean }) {
  const [failed, setFailed] = useState(false);
  const url = thumbUrl(asset);
  if (missing) return <span className="media-ico" title={tr("File missing")}>⚠️</span>;
  if (!url || failed) return <span className="media-ico">{TYPE_ICON[asset.type] ?? MEDIA_ICON[asset.kind]}</span>;
  return <img src={url} alt={asset.name} loading="lazy" decoding="async" draggable={false} onError={() => setFailed(true)} />;
});
