import { t as tr } from '../../shared/i18n';
import { useMemo, useState } from 'react';
import type { Asset, AssetType, MediaKind } from '../../shared/types';
import { useProject } from '../store/project';
import { filterAssets } from '../../shared/search';
import { ASSET_TYPES } from '../../shared/classify';
import { Modal } from './Modal';
import { AssetThumb } from './AssetThumb';
import { pickAndImportFiles } from '../ops';

/** Modal asset chooser with search and type filters. */
export function AssetPicker(props: { media: MediaKind; types: AssetType[]; title: string; onPick: (a: Asset) => void; onClose: () => void }) {
  const assets = useProject((s) => s.project?.assets ?? []);
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const list = useMemo(() => {
    const ofKind = assets.filter((a) => a.kind === props.media);
    return filterAssets(ofKind, { query, types: showAll ? [] : props.types });
  }, [assets, props.media, props.types, query, showAll]);
  return (
    <Modal title={props.title} onClose={props.onClose} size="wide" testId="asset-picker">
      <div className="row" style={{ marginBottom: '0.7rem' }}>
        <input className="input grow" placeholder={tr("Search…")} value={query} onChange={(e) => setQuery(e.target.value)} autoFocus data-testid="asset-picker-search" />
        <label className="check small">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> {tr("Show all types")}
        </label>
        <button className="btn" onClick={() => void pickAndImportFiles()}>
          {tr("⬆ Import…")}
        </button>
      </div>
      {!showAll && (
        <div className="small muted" style={{ marginBottom: '0.5rem' }}>
          {tr("Showing:")} {props.types.map((t) => tr(ASSET_TYPES.find((x) => x.value === t)?.label ?? t)).join(', ')}
        </div>
      )}
      {list.length === 0 ? (
        <div className="empty">
          <div className="big">🗂️</div>
          <div>{tr("No matching assets. Import files or tick “Show all”.")}</div>
        </div>
      ) : (
        <div className="mini-gallery" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(7rem, 1fr))' }}>
          {list.slice(0, 600).map((a) => (
            <button key={a.id} className="mini-tile" style={{ cursor: 'pointer' }} onClick={() => props.onPick(a)} title={a.path} data-testid={`pick-${a.name}`}>
              <div className="t">
                <AssetThumb asset={a} />
              </div>
              <div className="n ellipsis">{a.name}</div>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
