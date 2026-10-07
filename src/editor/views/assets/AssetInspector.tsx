import { t as tr } from '../../../shared/i18n';
import { useState } from 'react';
import type { Asset, AssetType } from '../../../shared/types';
import { ASSET_TYPES, typesForKind } from '../../../shared/classify';
import { findAssetUsages } from '../../../shared/validate';
import { useProject, getDir } from '../../store/project';
import { useUi, promptDialog } from '../../store/ui';
import { assetUrl } from '../../assetUrl';
import { api, formatBytes } from '../../api';
import { addTag, deleteAssets, duplicateAssets, removeMissingAsset, removeTag, renamePath, replaceAssetFile, replaceReferences, setAssetType } from '../../ops';
import { AssetPicker } from '../../components/AssetPicker';
import { AssetThumb } from '../../components/AssetThumb';

export function AssetInspector({ assets }: { assets: Asset[] }) {
  const project = useProject((s) => s.project)!;
  const missing = useProject((s) => s.missing);
  const [tag, setTag] = useState('');
  const [picking, setPicking] = useState(false);

  if (assets.length === 0) {
    return (
      <div className="empty">
        <div className="big">🖼️</div>
        <div>{tr("Select an asset to see details.")}</div>
        <div className="small faint">
          {tr("Tip: Ctrl+click and Shift+click to select many, Ctrl+A for all.")}
        </div>
      </div>
    );
  }

  if (assets.length > 1) {
    const ids = assets.map((a) => a.id);
    const kinds = new Set(assets.map((a) => a.kind));
    return (
      <div className="col" data-testid="inspector-multi">
        <h3>{tr("{0} assets selected", { 0: assets.length })}</h3>
        <div className="small muted">{tr("{0} total", { 0: formatBytes(assets.reduce((s, a) => s + a.size, 0)) })}</div>
        <div className="field">
          <label>{tr("Set category")}</label>
          <select className="select" value="" onChange={(e) => e.target.value && setAssetType(ids, e.target.value as AssetType)} data-testid="bulk-type-inspector">
            <option value="">{tr("Choose…")}</option>
            {ASSET_TYPES.filter((t) => t.kind === 'any' || kinds.has(t.kind as Asset['kind'])).map((t) => (
              <option key={t.value} value={t.value}>
                {tr(t.label)}
              </option>
            ))}
          </select>
        </div>
        <TagEditor tag={tag} setTag={setTag} onAdd={(t) => addTag(ids, t)} tags={[...new Set(assets.flatMap((a) => a.tags))]} onRemove={(t) => removeTag(ids, t)} />
      </div>
    );
  }

  const a = assets[0];
  const isMissing = missing.includes(a.id);
  const usages = findAssetUsages(project, a.id);
  const folder = a.path.slice(0, a.path.lastIndexOf('/'));

  const rename = async () => {
    const name = await promptDialog({ title: tr("Rename file"), label: tr("New file name"), value: a.name, confirmLabel: tr("Rename") });
    if (name && name !== a.name) await renamePath(a.path, name);
  };

  return (
    <div className="col" data-testid="inspector">
      {isMissing && (
        <div className="issue-box" data-testid="missing-asset-box">
          <b>{tr("Missing Asset")}</b>
          <div className="small" style={{ margin: '0.3rem 0 0.5rem' }}>
            {tr("The file {0} is not on disk anymore.", { 0: a.path })}
          </div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button className="btn sm" onClick={() => void replaceAssetFile(a.id, 'Locate the missing file')}>
              {tr("🔎 Locate…")}
            </button>
            <button className="btn sm" onClick={() => setPicking(true)}>
              {tr("🔁 Replace…")}
            </button>
            <button className="btn sm danger" onClick={() => void removeMissingAsset(a.id)}>
              {tr("Remove")}
            </button>
          </div>
        </div>
      )}
      <div className="preview-box">
        {isMissing ? (
          <span style={{ fontSize: '3rem' }}>⚠️</span>
        ) : a.kind === 'image' ? (
          <img src={assetUrl(a)} alt={a.name} />
        ) : a.kind === 'audio' ? (
          <div className="col" style={{ alignItems: 'center', width: '100%', padding: '1rem' }}>
            <span style={{ fontSize: '2.5rem' }}>
              <AssetThumb asset={a} />
            </span>
            <audio controls src={assetUrl(a)} style={{ width: '100%' }} />
          </div>
        ) : (
          <video controls src={assetUrl(a)} />
        )}
      </div>
      <div className="row">
        <b className="grow ellipsis" title={a.name}>
          {a.name}
        </b>
        <button className="btn sm" onClick={() => void rename()} title={tr("Rename (F2)")}>
          ✏️
        </button>
      </div>
      <div className="field">
        <label>{tr("Category")}</label>
        <select className="select" value={a.type} onChange={(e) => setAssetType([a.id], e.target.value as AssetType)} data-testid="inspector-type">
          {typesForKind(a.kind).map((t) => (
            <option key={t} value={t}>
              {tr(ASSET_TYPES.find((x) => x.value === t)?.label ?? t)}
            </option>
          ))}
        </select>
      </div>
      <div className="kv">
        <span>{tr("Folder")}</span>
        <span className="ellipsis" title={folder}>
          {folder}
        </span>
        <span>{tr("Size")}</span>
        <span>{formatBytes(a.size)}</span>
        {a.width && (
          <>
            <span>{tr("Pixels")}</span>
            <span>
              {a.width} × {a.height}
            </span>
          </>
        )}
        <span>{tr("Format")}</span>
        <span>{a.ext.toUpperCase()}</span>
      </div>
      <TagEditor tag={tag} setTag={setTag} onAdd={(t) => addTag([a.id], t)} tags={a.tags} onRemove={(t) => removeTag([a.id], t)} />
      <div className="field">
        <label>{tr("Used in ({0})", { 0: usages.length })}</label>
        {usages.length === 0 ? (
          <span className="small faint">{tr("Not used yet. Drag it into a scene.")}</span>
        ) : (
          <div className="col" style={{ gap: '0.2rem' }}>
            {usages.slice(0, 12).map((u, i) => (
              <button
                key={i}
                className="btn ghost sm"
                style={{ justifyContent: 'flex-start' }}
                onClick={() => {
                  if (u.sceneId) {
                    useUi.getState().selectScene(u.sceneId);
                    if (u.actionId) useUi.getState().selectActions([u.actionId]);
                    useUi.getState().setView('scenes');
                  } else if (u.characterId) useUi.getState().setView('characters');
                }}
              >
                <span className="ellipsis">{u.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <button className="btn sm" onClick={() => void replaceAssetFile(a.id)} title={tr("Replace the file but keep every reference")}>
          {tr("🔁 Replace file…")}
        </button>
        <button className="btn sm" onClick={() => setPicking(true)} title={tr("Make everything that uses this asset use another asset")}>
          {tr("⇄ Swap uses…")}
        </button>
        <button className="btn sm" onClick={() => void duplicateAssets([a.id])}>
          {tr("⧉ Duplicate")}
        </button>
        <button className="btn sm" onClick={() => void api.assets.reveal(getDir(), a.path)}>
          {tr("📂 Show in Explorer")}
        </button>
        <button className="btn sm danger" onClick={() => void deleteAssets([a.id])} data-testid="inspector-delete">
          {tr("🗑 Delete")}
        </button>
      </div>
      {picking && (
        <AssetPicker
          media={a.kind}
          types={typesForKind(a.kind)}
          title={tr("Use another asset instead of “{0}”", { 0: a.name })}
          onClose={() => setPicking(false)}
          onPick={(b) => {
            setPicking(false);
            if (b.id !== a.id) void replaceReferences(a.id, b.id);
          }}
        />
      )}
    </div>
  );
}

function TagEditor(props: { tag: string; setTag: (t: string) => void; tags: string[]; onAdd: (t: string) => void; onRemove: (t: string) => void }) {
  return (
    <div className="field">
      <label>{tr("Tags")}</label>
      <div className="tags">
        {props.tags.map((t) => (
          <span key={t} className="badge accent">
            #{t}
            <button className="btn ghost sm" style={{ minHeight: 0, padding: 0 }} onClick={() => props.onRemove(t)} aria-label={tr("Remove tag {0}", { 0: t })}>
              ✕
            </button>
          </span>
        ))}
      </div>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          props.onAdd(props.tag);
          props.setTag('');
        }}
      >
        <input className="input" placeholder={tr("Add tag…")} value={props.tag} onChange={(e) => props.setTag(e.target.value)} />
        <button className="btn sm" disabled={!props.tag.trim()}>
          {tr("Add")}
        </button>
      </form>
    </div>
  );
}
