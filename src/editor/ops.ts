import { t as tr } from '../shared/i18n';
// Editor operations: orchestrate the main-process API and the project store.
// Components call these instead of talking to the API directly.
import type { Asset, AssetType, Project } from '../shared/types';
import type { DuplicateDecision, PathMove } from '../shared/api';
import { api, errorMessage } from './api';
import { getDir, getProject, useProject } from './store/project';
import { confirmDialog, promptDialog, toast, useUi } from './store/ui';
import { detectCharacters, mergeDetectedCharacters, charactersFromFolder } from '../shared/characters';
import { findAssetUsages, removeAssetReferences, replaceAssetReferences } from '../shared/validate';
import { newId } from '../shared/ids';
import { IMAGE_EXT, AUDIO_EXT, VIDEO_EXT } from '../shared/classify';

export async function run<T>(fn: () => Promise<T>, failMsg?: string): Promise<T | undefined> {
  try {
    return await fn();
  } catch (e) {
    toast(`${failMsg ? `${failMsg}: ` : ''}${errorMessage(e)}`, 'error');
    return undefined;
  }
}

// ---------------- project lifecycle ----------------

export async function loadProjectResult(r: { dir: string; project: Project; recovery?: { savedAt: number; project: Project } }) {
  let project = r.project;
  let dirty = false;
  if (r.recovery) {
    const recover = await confirmDialog({
      title: tr("Recovered Project"),
      message: tr("TSTVN found unsaved work from {0} (the editor may have closed unexpectedly). Do you want to recover it?", { 0: new Date(r.recovery.savedAt).toLocaleString() }),
      confirmLabel: tr("Recover"),
      cancelLabel: tr("Discard"),
    });
    if (recover) {
      await api.backups.create(r.dir, r.project, tr('Before recovering unsaved work'));
      project = r.recovery.project;
      dirty = true;
      toast(tr("Unsaved work recovered. Save to keep it."), 'success');
    } else {
      await api.project.discardRecovery(r.dir);
    }
  }
  useProject.getState().load(r.dir, project, dirty);
  const firstScene = project.chapters[0]?.sceneIds[0] ?? project.scenes[0]?.id ?? null;
  useUi.setState({ view: 'scenes', sceneId: firstScene, actionIds: [], gallery: { ...useUi.getState().gallery, selected: [], folder: null } });
  void api.app.setTitle(`${project.name} — TSTVN`);
  void refreshMissing();
}

/**
 * Duplicate Project: asks for a name, saves the open project first if it is the one being copied, then
 * copies it next to the original and opens the copy.
 */
export async function duplicateProjectFlow(dir: string, currentName: string): Promise<boolean> {
  const name = await promptDialog({ title: tr("Duplicate project"), label: tr("Name of the copy"), value: tr("{0} copy", { 0: currentName }), confirmLabel: tr("Duplicate") });
  if (!name?.trim()) return false;
  const open = useProject.getState();
  if (open.dir === dir && open.dirty && !(await saveNow(true))) return false;
  const r = await run(() => api.project.duplicate(dir, name.trim()), tr("Could not duplicate the project"));
  if (!r) return false;
  await loadProjectResult(r);
  toast(tr("Now editing the copy “{0}”", { 0: r.project.name }), 'success');
  return true;
}

export async function openProjectDir(dir: string) {
  const r = await run(() => api.project.open(dir), tr("Could not open project"));
  if (r) await loadProjectResult(r);
}

/** Saves the project. `auto` = an autosave (silent, shown as "Autosaved" in the status bar). */
export async function saveNow(silent = false, auto = false): Promise<boolean> {
  const { dir, project } = useProject.getState();
  if (!dir || !project) return false;
  try {
    const at = await api.project.save(dir, project);
    // Only clear "dirty" if nothing changed while saving.
    if (useProject.getState().project === project) useProject.getState().markSaved(at, auto);
    if (!silent) toast(tr("Project saved"), 'success');
    return true;
  } catch (e) {
    toast(tr("Save failed: {0}", { 0: errorMessage(e) }), 'error');
    return false;
  }
}

export async function closeProject() {
  if (useProject.getState().dirty) {
    const save = await confirmDialog({ title: tr("Unsaved changes"), message: tr("Save your changes before closing the project?"), confirmLabel: tr("Save and close"), cancelLabel: tr("Close without saving") });
    if (save && !(await saveNow(true))) return;
    if (!save) await api.project.discardRecovery(getDir()).catch(() => undefined);
  }
  useProject.getState().close();
  void api.app.setTitle('TSTVN');
}

export async function refreshMissing() {
  const { dir, project } = useProject.getState();
  if (!dir || !project) return;
  const exists = await api.project.fileExists(dir, project.assets.map((a) => a.path)).catch(() => null);
  if (!exists) return;
  useProject.getState().setMissing(project.assets.filter((_, i) => !exists[i]).map((a) => a.id));
}

export async function backup(reason: string) {
  await api.backups.create(getDir(), getProject(), reason);
}

// ---------------- import ----------------

export const importFilters = () => [
  { name: tr('Media files'), extensions: [...IMAGE_EXT, ...AUDIO_EXT, ...VIDEO_EXT] },
  { name: tr('All files'), extensions: ['*'] },
];

export async function importSources(sources: string[]) {
  if (!sources.length) return;
  const ui = useUi.getState();
  ui.setImport({ stage: 'scanning', sources });
  try {
    const plan = await api.assets.scan(getDir(), sources, getProject().assets);
    if (plan.items.some((i) => i.duplicate)) {
      ui.setImport({ stage: 'review', sources, plan });
      return;
    }
    await executeImport({});
  } catch (e) {
    ui.setImport(null);
    toast(tr("Import failed: {0}", { 0: errorMessage(e) }), 'error');
  }
}

export async function executeImport(decisions: Record<string, DuplicateDecision>) {
  const ui = useUi.getState();
  const st = ui.importState;
  const plan = st?.plan ?? (await api.assets.scan(getDir(), st?.sources ?? [], getProject().assets));
  ui.setImport({ stage: 'importing', sources: st?.sources ?? [], plan });
  try {
    await backup(tr('Before import'));
    const existing = getProject().assets;
    const result = await api.assets.execute(getDir(), plan, decisions, existing);
    let chars = { created: 0, expressions: 0 };
    useProject.getState().update((p) => {
      p.assets.push(...result.added);
      for (const r of result.replaced) {
        const a = p.assets.find((x) => x.id === r.assetId);
        if (a) {
          a.hash = r.hash;
          a.size = r.size;
          a.width = r.width;
          a.height = r.height;
          a.hasThumb = r.hasThumb;
          a.rev += 1;
        }
      }
      const merged = mergeDetectedCharacters(p.characters, detectCharacters(result.added));
      p.characters = merged.characters;
      chars = { created: merged.createdCharacters, expressions: merged.addedExpressions };
    });
    ui.setImport({ stage: 'report', sources: st?.sources ?? [], plan, report: result.report, newAssetIds: result.added.map((a) => a.id), characters: chars });
    await saveNow(true);
    void refreshMissing();
  } catch (e) {
    ui.setImport(null);
    toast(tr("Import failed: {0}", { 0: errorMessage(e) }), 'error');
  }
}

export async function pickAndImportFolder() {
  const dir = await api.dialog.pickFolder(tr('Import a folder of assets'));
  if (dir) await importSources([dir]);
}

export async function pickAndImportFiles() {
  const files = await api.dialog.pickFiles(tr('Import files'), importFilters(), true);
  if (files.length) await importSources(files);
}

// ---------------- file manager ----------------

function remapPaths(p: Project, moves: PathMove[]) {
  for (const m of moves) {
    for (const a of p.assets) {
      if (a.path === m.from) {
        a.path = m.to;
        a.name = m.to.split('/').pop() ?? a.name;
      } else if (a.path.startsWith(`${m.from}/`)) {
        a.path = m.to + a.path.slice(m.from.length);
      }
    }
    for (const c of p.characters) {
      if (c.sourceFolder === m.from) c.sourceFolder = m.to;
    }
  }
}

function assetsUnder(rels: string[]): Asset[] {
  return getProject().assets.filter((a) => rels.some((r) => a.path === r || a.path.startsWith(`${r}/`)));
}

export async function deletePaths(rels: string[]): Promise<boolean> {
  if (!rels.length) return false;
  const affected = assetsUnder(rels);
  const usages = affected.flatMap((a) => findAssetUsages(getProject(), a.id).map((u) => `${a.name}: ${u.label}`));
  const ok = await confirmDialog({
    title: rels.length === 1 ? tr("Delete “{0}”?", { 0: rels[0].split('/').pop() }) : tr("Delete {0} items?", { 0: rels.length }),
    message:
      `${affected.length} asset file(s) will be removed from the project. A backup is created first, so you can restore them from Backups.` +
      (usages.length ? ` These assets are used ${usages.length} time(s) — those references will be cleared.` : ''),
    details: usages.slice(0, 12),
    confirmLabel: tr("Delete"),
    danger: true,
  });
  if (!ok) return false;
  return (
    (await run(async () => {
      const dir = getDir();
      const backupId = await api.backups.create(dir, getProject(), tr('Delete {0} item(s)', { 0: rels.length }));
      await api.assets.remove(dir, rels, backupId);
      const ids = new Set(affected.map((a) => a.id));
      useProject.getState().update((p) => {
        for (const id of ids) removeAssetReferences(p, id);
        p.assets = p.assets.filter((a) => !ids.has(a.id));
        p.collections.forEach((c) => (c.assetIds = c.assetIds.filter((x) => !ids.has(x))));
        p.characters = p.characters.filter((c) => c.expressions.length > 0 || !c.sourceFolder || !rels.some((r) => c.sourceFolder === r || c.sourceFolder!.startsWith(`${r}/`)));
      });
      useUi.getState().setGallery({ selected: [] });
      await saveNow(true);
      toast(tr("Deleted {0} asset(s). Restore from Backups if needed.", { 0: affected.length }), 'success');
      return true;
    }, tr("Delete failed"))) ?? false
  );
}

export async function deleteAssets(ids: string[]) {
  const paths = getProject().assets.filter((a) => ids.includes(a.id)).map((a) => a.path);
  return deletePaths(paths);
}

export async function movePaths(rels: string[], destFolder: string) {
  const moves = await run(() => api.assets.move(getDir(), rels, destFolder), tr("Move failed"));
  if (!moves?.length) return;
  useProject.getState().update((p) => remapPaths(p, moves));
  await saveNow(true);
  toast(tr("Moved {0} item(s)", { 0: moves.length }), 'success');
}

export async function renamePath(rel: string, newName: string) {
  const move = await run(() => api.assets.rename(getDir(), rel, newName), tr("Rename failed"));
  if (!move) return null;
  useProject.getState().update((p) => remapPaths(p, [move]));
  await saveNow(true);
  return move;
}

export async function copyPaths(rels: string[], destFolder: string) {
  const dir = getDir();
  const copies = await run(() => api.assets.copy(dir, rels, destFolder), tr("Copy failed"));
  if (!copies?.length) return;
  const added = await run(() => api.assets.register(dir, copies.map((c) => c.to)), tr("Copy failed"));
  if (!added) return;
  const src = getProject().assets;
  useProject.getState().update((p) => {
    for (const a of added) {
      // Keep the category and tags of the original file.
      const move = copies.find((c) => a.path === c.to || a.path.startsWith(`${c.to}/`));
      const origPath = move ? move.from + a.path.slice(move.to.length) : '';
      const orig = src.find((x) => x.path === origPath);
      if (orig) {
        a.type = orig.type;
        a.tags = [...orig.tags];
      }
      p.assets.push(a);
    }
  });
  await saveNow(true);
  toast(tr("Copied {0} file(s)", { 0: added.length }), 'success');
  return added;
}

export async function duplicateAssets(ids: string[]) {
  const assets = getProject().assets.filter((a) => ids.includes(a.id));
  for (const a of assets) {
    const folder = a.path.slice(0, a.path.lastIndexOf('/'));
    await copyPaths([a.path], folder);
  }
}

export async function createFolder(parent: string, name: string) {
  return run(() => api.assets.createFolder(getDir(), `${parent}/${name}`), tr("Could not create folder"));
}

/** Replace the file behind an asset; references keep working because the asset id is unchanged. */
export async function replaceAssetFile(assetId: string, title = tr('Choose a replacement file')) {
  const asset = getProject().assets.find((a) => a.id === assetId);
  if (!asset) return;
  const exts = asset.kind === 'image' ? IMAGE_EXT : asset.kind === 'audio' ? AUDIO_EXT : VIDEO_EXT;
  const files = await api.dialog.pickFiles(title, [{ name: asset.kind, extensions: exts }], false);
  if (!files[0]) return;
  const r = await run(async () => {
    await backup(tr('Replace {0}', { 0: asset.name }));
    return api.assets.replace(getDir(), asset.path, files[0], asset.id);
  }, tr("Replace failed"));
  if (!r) return;
  useProject.getState().update((p) => {
    const a = p.assets.find((x) => x.id === assetId);
    if (!a) return;
    a.path = r.path;
    a.name = r.path.split('/').pop() ?? a.name;
    a.ext = a.name.split('.').pop()?.toLowerCase() ?? a.ext;
    a.hash = r.replaced.hash;
    a.size = r.replaced.size;
    a.width = r.replaced.width;
    a.height = r.replaced.height;
    a.hasThumb = r.replaced.hasThumb;
    a.rev += 1;
  });
  await saveNow(true);
  void refreshMissing();
  toast(tr("“{0}” replaced", { 0: asset.name }), 'success');
}

/** Point every use of one asset at another asset (mass replace), with a backup first. */
export async function replaceReferences(fromId: string, toId: string) {
  await backup(tr('Mass replace asset references'));
  let n = 0;
  useProject.getState().update((p) => {
    n = replaceAssetReferences(p, fromId, toId);
  });
  toast(tr("Updated {0} reference(s)", { 0: n }), 'success');
}

export async function removeMissingAsset(assetId: string) {
  const p = getProject();
  const a = p.assets.find((x) => x.id === assetId);
  if (!a) return;
  const ok = await confirmDialog({
    title: tr("Remove “{0}”?", { 0: a.name }),
    message: tr("The file is missing. Removing it clears {0} reference(s) to it.", { 0: findAssetUsages(p, assetId).length }),
    confirmLabel: tr("Remove"),
    danger: true,
  });
  if (!ok) return;
  await backup(tr('Remove missing asset {0}', { 0: a.name }));
  useProject.getState().update((d) => {
    removeAssetReferences(d, assetId);
    d.assets = d.assets.filter((x) => x.id !== assetId);
  });
  void refreshMissing();
}

export function setAssetType(ids: string[], type: AssetType) {
  useProject.getState().update((p) => {
    for (const a of p.assets) if (ids.includes(a.id)) a.type = type;
  });
}

export function addTag(ids: string[], tag: string) {
  const t = tag.trim();
  if (!t) return;
  useProject.getState().update((p) => {
    for (const a of p.assets) if (ids.includes(a.id) && !a.tags.includes(t)) a.tags.push(t);
  });
}

export function removeTag(ids: string[], tag: string) {
  useProject.getState().update((p) => {
    for (const a of p.assets) if (ids.includes(a.id)) a.tags = a.tags.filter((x) => x !== tag);
  });
}

export function addToCollection(ids: string[], name: string) {
  const n = name.trim();
  if (!n) return;
  useProject.getState().update((p) => {
    let c = p.collections.find((x) => x.name.toLowerCase() === n.toLowerCase());
    if (!c) {
      c = { id: newId('col'), name: n, assetIds: [] };
      p.collections.push(c);
    }
    for (const id of ids) if (!c.assetIds.includes(id)) c.assetIds.push(id);
  });
  toast(tr("Added {0} asset(s) to “{1}”", { 0: ids.length, 1: n }), 'success');
}

export async function exportAssetFiles(ids: string[]) {
  const dest = await api.dialog.pickFolder(tr('Export files to folder'));
  if (!dest) return;
  const paths = getProject().assets.filter((a) => ids.includes(a.id)).map((a) => a.path);
  const n = await run(() => api.assets.exportFiles(getDir(), paths, dest), tr("Export failed"));
  if (n !== undefined) toast(tr("Exported {0} file(s)", { 0: n }), 'success');
}

export function createCharactersFromFolder(folder: string): number {
  const detected = charactersFromFolder(getProject().assets, folder);
  if (!detected.length) {
    toast(tr("No images found in that folder."), 'warning');
    return 0;
  }
  let created = 0;
  useProject.getState().update((p) => {
    const merged = mergeDetectedCharacters(p.characters, detected);
    p.characters = merged.characters;
    created = merged.createdCharacters;
    const ids = new Set(detected.flatMap((d) => d.expressions.map((e) => e.assetId)));
    for (const a of p.assets) if (ids.has(a.id) && (a.type === 'unknown' || a.type === 'background')) a.type = 'character';
  });
  toast(tr("Created {0} character(s) from “{1}”", { 0: created, 1: folder.split('/').pop() }), 'success');
  return created;
}
