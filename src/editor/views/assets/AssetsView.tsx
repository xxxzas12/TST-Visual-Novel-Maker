import { t as tr } from '../../../shared/i18n';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Asset, AssetType } from '../../../shared/types';
import type { TreeListing } from '../../../shared/api';
import { ASSET_TYPES, extOf, mediaKindOf } from '../../../shared/classify';
import { filterAssets, type AssetSort } from '../../../shared/search';
import { useProject, getDir } from '../../store/project';
import { useUi, promptDialog, toast } from '../../store/ui';
import { api } from '../../api';
import {
  addTag,
  addToCollection,
  copyPaths,
  createCharactersFromFolder,
  createFolder,
  deleteAssets,
  deletePaths,
  duplicateAssets,
  exportAssetFiles,
  importSources,
  movePaths,
  pickAndImportFiles,
  pickAndImportFolder,
  renamePath,
  replaceAssetFile,
  run,
  setAssetType,
} from '../../ops';
import { hasOsFiles } from '../../dnd';
import { buildFolderTree, FolderTree } from './FolderTree';
import { FolderChooser } from './FolderChooser';
import { Gallery } from './Gallery';
import { AssetInspector } from './AssetInspector';

export function AssetsView() {
  const project = useProject((s) => s.project)!;
  const missing = useProject((s) => s.missing);
  const g = useUi((s) => s.gallery);
  const setGallery = useUi((s) => s.setGallery);
  const [listing, setListing] = useState<TreeListing>({ folders: ['assets'], files: [] });
  const [osDrag, setOsDrag] = useState(false);
  const [chooser, setChooser] = useState<null | 'move' | 'copy' | 'move-folder' | 'copy-folder'>(null);
  const assets = project.assets;

  const refreshListing = useCallback(() => {
    void api.assets
      .list(getDir())
      .then(setListing)
      .catch(() => undefined);
  }, []);
  useEffect(refreshListing, [assets, refreshListing]);

  const tree = useMemo(() => buildFolderTree(listing.folders, assets), [listing.folders, assets]);
  const collection = project.collections.find((c) => c.id === g.collectionId);
  const filtered = useMemo(
    () => filterAssets(assets, { query: g.query, types: g.types, folder: g.folder, tag: g.tag, collectionIds: collection ? collection.assetIds : null }, g.sort, g.sortDir),
    [assets, g.query, g.types, g.folder, g.tag, g.sort, g.sortDir, collection],
  );
  const selected = useMemo(() => new Set(g.selected), [g.selected]);
  const selectedAssets = useMemo(() => assets.filter((a) => selected.has(a.id)), [assets, selected]);
  const missingSet = useMemo(() => new Set(missing), [missing]);
  const allTags = useMemo(() => [...new Set(assets.flatMap((a) => a.tags))].sort(), [assets]);
  const untracked = useMemo(() => {
    const known = new Set(assets.map((a) => a.path.toLowerCase()));
    return listing.files.filter((f) => !known.has(f.path.toLowerCase()) && mediaKindOf(extOf(f.path)));
  }, [listing.files, assets]);

  const onClickAsset = (a: Asset, index: number, e: React.MouseEvent) => {
    if (e.shiftKey && g.anchor) {
      const from = filtered.findIndex((x) => x.id === g.anchor);
      const [lo, hi] = from < index ? [from, index] : [index, from];
      const range = filtered.slice(lo, hi + 1).map((x) => x.id);
      setGallery({ selected: e.ctrlKey ? [...new Set([...g.selected, ...range])] : range });
    } else if (e.ctrlKey || e.metaKey) {
      setGallery({ selected: selected.has(a.id) ? g.selected.filter((x) => x !== a.id) : [...g.selected, a.id], anchor: a.id });
    } else {
      setGallery({ selected: [a.id], anchor: a.id });
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      setGallery({ selected: filtered.map((a) => a.id) });
    } else if (e.key === 'Delete' && g.selected.length) {
      e.preventDefault();
      void deleteAssets(g.selected);
    } else if (e.key === 'Escape') {
      setGallery({ selected: [] });
    } else if (e.key === 'F2' && selectedAssets.length === 1) {
      e.preventDefault();
      void renameSelected();
    }
  };

  const renameSelected = async () => {
    if (selectedAssets.length === 1) {
      const a = selectedAssets[0];
      const name = await promptDialog({ title: tr("Rename file"), label: tr("New file name"), value: a.name, confirmLabel: tr("Rename") });
      if (name && name !== a.name) await renamePath(a.path, name);
      return;
    }
    const base = await promptDialog({ title: tr("Rename {0} files", { 0: selectedAssets.length }), label: tr("Base name (files become “name 1”, “name 2”, …)"), value: tr("asset"), confirmLabel: tr("Rename all") });
    if (!base) return;
    let n = 1;
    for (const a of [...selectedAssets].sort((x, y) => x.name.localeCompare(y.name, undefined, { numeric: true }))) {
      await renamePath(a.path, `${base} ${n++}.${a.ext}`);
    }
    toast(tr("Renamed {0} files", { 0: selectedAssets.length }), 'success');
  };

  const onDrop = (e: React.DragEvent) => {
    setOsDrag(false);
    if (!hasOsFiles(e)) return;
    e.preventDefault();
    const paths = Array.from(e.dataTransfer.files)
      .map((f) => api.getPathForFile(f))
      .filter(Boolean);
    void importSources(paths);
  };

  const folderOps = g.folder;

  const toggleType = (t: AssetType) => setGallery({ types: g.types.includes(t) ? g.types.filter((x) => x !== t) : [...g.types, t] });

  return (
    <div className="assets-layout">
      <aside className="folder-pane">
        <div className="row" style={{ marginBottom: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn sm primary" onClick={() => void pickAndImportFolder()} data-testid="import-folder">
            {tr("⬆ Import Folder")}
          </button>
          <button className="btn sm" onClick={() => void pickAndImportFiles()}>
            {tr("Files…")}
          </button>
        </div>
        <div className="row" style={{ marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.25rem' }}>
          <button
            className="btn sm"
            title={tr("New folder")}
            data-testid="new-folder"
            onClick={async () => {
              const name = await promptDialog({ title: tr("New folder"), label: tr("Folder name"), value: tr("New Folder"), confirmLabel: tr("Create") });
              if (!name) return;
              const created = await createFolder(g.folder ?? 'assets', name);
              if (created) {
                refreshListing();
                setGallery({ folder: created });
              }
            }}
          >
            ＋📁
          </button>
          <button
            className="btn sm"
            disabled={!folderOps}
            title={tr("Rename folder")}
            onClick={async () => {
              if (!folderOps) return;
              const name = await promptDialog({ title: tr("Rename folder"), label: tr("Folder name"), value: folderOps.split('/').pop() ?? '', confirmLabel: tr("Rename") });
              if (!name) return;
              const m = await renamePath(folderOps, name);
              if (m) setGallery({ folder: m.to });
              refreshListing();
            }}
          >
            ✏️
          </button>
          <button className="btn sm" disabled={!folderOps} title={tr("Move folder to…")} onClick={() => setChooser('move-folder')}>
            ➜
          </button>
          <button className="btn sm" disabled={!folderOps} title={tr("Copy folder to…")} onClick={() => setChooser('copy-folder')}>
            ⧉
          </button>
          <button
            className="btn sm"
            title={tr("Open in Explorer")}
            onClick={() => void api.assets.reveal(getDir(), `${g.folder ?? 'assets'}/`)}
          >
            📂
          </button>
          <button
            className="btn sm danger"
            disabled={!folderOps}
            title={tr("Delete folder")}
            onClick={async () => {
              if (folderOps && (await deletePaths([folderOps]))) {
                setGallery({ folder: null });
                refreshListing();
              }
            }}
          >
            🗑
          </button>
        </div>
        {folderOps && (
          <button className="btn sm" style={{ width: '100%', marginBottom: '0.5rem' }} onClick={() => createCharactersFromFolder(folderOps)} title={tr("Each image becomes an expression; subfolders become separate characters")}>
            {tr("🧍 Create character from folder")}
          </button>
        )}
        <FolderTree root={tree} selected={g.folder} onSelect={(f) => setGallery({ folder: f, collectionId: null })} />
        {project.collections.length > 0 && (
          <>
            <div className="section-title" style={{ marginTop: '0.8rem' }}>
              {tr("Collections")}
            </div>
            {project.collections.map((c) => (
              <div key={c.id} className={`tree-item ${g.collectionId === c.id ? 'selected' : ''}`} onClick={() => setGallery({ collectionId: g.collectionId === c.id ? null : c.id })}>
                <span>⭐</span>
                <span className="ellipsis">{c.name}</span>
                <span className="count">{c.assetIds.length}</span>
              </div>
            ))}
          </>
        )}
        {allTags.length > 0 && (
          <>
            <div className="section-title" style={{ marginTop: '0.8rem' }}>
              {tr("Tags")}
            </div>
            <div className="tags">
              {allTags.map((t) => (
                <button key={t} className={`chip ${g.tag === t ? 'on' : ''}`} onClick={() => setGallery({ tag: g.tag === t ? null : t })}>
                  #{t}
                </button>
              ))}
            </div>
          </>
        )}
        {untracked.length > 0 && (
          <div className="issue-box warn" style={{ marginTop: '0.8rem' }}>
            <div className="small">{tr("{0} file(s) on disk are not in the project yet.", { 0: untracked.length })}</div>
            <button
              className="btn sm"
              style={{ marginTop: '0.4rem' }}
              onClick={async () => {
                const added = await run(() => api.assets.register(getDir(), untracked.map((f) => f.path)), tr("Could not add files"));
                if (added) {
                  useProject.getState().update((p) => void p.assets.push(...added));
                  toast(tr("Added {0} file(s)", { 0: added.length }), 'success');
                }
              }}
            >
              {tr("Add them")}
            </button>
          </div>
        )}
      </aside>

      <section
        className="gallery-pane"
        onDragOver={(e) => {
          if (hasOsFiles(e)) {
            e.preventDefault();
            setOsDrag(true);
          }
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setOsDrag(false);
        }}
        onDrop={onDrop}
      >
        <div className="gallery-toolbar">
          <input className="input" style={{ maxWidth: '18rem' }} placeholder={tr("🔍 Search name, path or tag…")} value={g.query} onChange={(e) => setGallery({ query: e.target.value })} data-testid="gallery-search" />
          <select className="select" style={{ width: 'auto' }} value={g.sort} onChange={(e) => setGallery({ sort: e.target.value as AssetSort })} aria-label={tr("Sort by")}>
            <option value="name">{tr("Name")}</option>
            <option value="type">{tr("Type")}</option>
            <option value="date">{tr("Date added")}</option>
            <option value="size">{tr("Size")}</option>
            <option value="folder">{tr("Folder")}</option>
          </select>
          <button className="btn sm" onClick={() => setGallery({ sortDir: g.sortDir === 'asc' ? 'desc' : 'asc' })} title={tr("Sort direction")}>
            {g.sortDir === 'asc' ? '↑' : '↓'}
          </button>
          <span className="grow" />
          <span className="small muted">
            {tr("{0} of {1}", { 0: filtered.length, 1: assets.length })}
          </span>
          <button className={`btn sm ${g.mode === 'grid' ? 'active' : ''}`} onClick={() => setGallery({ mode: 'grid' })} title={tr("Grid view")} data-testid="grid-view">
            ▦
          </button>
          <button className={`btn sm ${g.mode === 'list' ? 'active' : ''}`} onClick={() => setGallery({ mode: 'list' })} title={tr("List view")} data-testid="list-view">
            ☰
          </button>
        </div>
        <div className="type-chips">
          {ASSET_TYPES.map((t) => (
            <button key={t.value} className={`chip ${g.types.includes(t.value) ? 'on' : ''}`} onClick={() => toggleType(t.value)} data-testid={`filter-${t.value}`}>
              {tr(t.label)} <span className="faint">{assets.filter((a) => a.type === t.value).length}</span>
            </button>
          ))}
          {(g.types.length > 0 || g.query || g.tag || g.folder || g.collectionId) && (
            <button className="chip" onClick={() => setGallery({ types: [], query: '', tag: null, folder: null, collectionId: null })}>
              {tr("✕ Clear filters")}
            </button>
          )}
        </div>
        {g.selected.length > 0 && (
          <div className="bulkbar" data-testid="bulkbar">
            <b>{tr("{0} selected", { 0: g.selected.length })}</b>
            <button className="btn sm" onClick={() => setChooser('move')}>
              {tr("➜ Move")}
            </button>
            <button className="btn sm" onClick={() => setChooser('copy')}>
              {tr("⧉ Copy")}
            </button>
            <button className="btn sm" onClick={() => void duplicateAssets(g.selected)}>
              {tr("Duplicate")}
            </button>
            <button className="btn sm" onClick={() => void renameSelected()}>
              {tr("✏️ Rename")}
            </button>
            <select
              className="select"
              style={{ width: 'auto', minHeight: '1.75rem' }}
              value=""
              onChange={(e) => {
                if (e.target.value) setAssetType(g.selected, e.target.value as AssetType);
              }}
              aria-label={tr("Change category")}
              data-testid="bulk-type"
            >
              <option value="">{tr("Category…")}</option>
              {ASSET_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {tr(t.label)}
                </option>
              ))}
            </select>
            <button
              className="btn sm"
              onClick={async () => {
                const t = await promptDialog({ title: tr("Add tag"), label: tr("Tag"), value: '', confirmLabel: tr("Add") });
                if (t) addTag(g.selected, t);
              }}
            >
              {tr("#Tag")}
            </button>
            <button
              className="btn sm"
              onClick={async () => {
                const n = await promptDialog({ title: tr("Add to collection"), label: tr("Collection name (new or existing)"), value: project.collections[0]?.name ?? tr("Favorites"), confirmLabel: tr("Add") });
                if (n) addToCollection(g.selected, n);
              }}
            >
              {tr("⭐ Collection")}
            </button>
            {g.selected.length === 1 && (
              <button className="btn sm" onClick={() => void replaceAssetFile(g.selected[0])}>
                {tr("🔁 Replace")}
              </button>
            )}
            <button className="btn sm" onClick={() => void exportAssetFiles(g.selected)}>
              {tr("⤓ Export")}
            </button>
            <button className="btn sm danger" onClick={() => void deleteAssets(g.selected)} data-testid="bulk-delete">
              {tr("🗑 Delete")}
            </button>
            <span className="grow" />
            <button className="btn sm ghost" onClick={() => setGallery({ selected: [] })}>
              {tr("Clear")}
            </button>
          </div>
        )}
        {assets.length === 0 ? (
          <div className="empty" style={{ flex: 1 }}>
            <div className="big">📥</div>
            <h3>{tr("Drop a folder here")}</h3>
            <div>{tr("Drag your Characters, Backgrounds, CG, Music and SFX folders into this window — everything is detected automatically.")}</div>
            <button className="btn primary" onClick={() => void pickAndImportFolder()}>
              {tr("⬆ Import Folder…")}
            </button>
          </div>
        ) : (
          <Gallery
            assets={filtered}
            selected={selected}
            missing={missingSet}
            mode={g.mode}
            onClickAsset={onClickAsset}
            onDoubleClick={(a) => setGallery({ selected: [a.id], anchor: a.id })}
            onKeyDown={onKeyDown}
          />
        )}
        {osDrag && (
          <div className="dropzone-overlay">
            <div style={{ fontSize: '3rem' }}>📥</div>
            {tr("Drop folders or files to import")}
          </div>
        )}
      </section>

      <aside className="inspector">
        <AssetInspector assets={selectedAssets} />
      </aside>

      {chooser && (
        <FolderChooser
          root={tree}
          title={chooser.startsWith('move') ? tr("Move to folder") : tr("Copy to folder")}
          confirmLabel={chooser.startsWith('move') ? tr("Move here") : tr("Copy here")}
          onClose={() => setChooser(null)}
          onPick={(dest) => {
            const items = chooser.endsWith('folder') ? (g.folder ? [g.folder] : []) : selectedAssets.map((a) => a.path);
            setChooser(null);
            if (chooser.startsWith('move')) void movePaths(items, dest).then(refreshListing);
            else void copyPaths(items, dest).then(refreshListing);
          }}
        />
      )}
    </div>
  );
}
