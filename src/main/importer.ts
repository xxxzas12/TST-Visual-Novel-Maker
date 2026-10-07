import path from 'node:path';
import fs from 'node:fs/promises';
import type { Asset } from '../shared/types';
import type { DuplicateDecision, ImportItem, ImportPlan, ImportResult, ReplacedAsset } from '../shared/api';
import { classifyAsset, extOf, mediaKindOf } from '../shared/classify';
import { newId } from '../shared/ids';
import { ASSETS_DIR, META_DIR } from '../shared/project';
import { hashFile } from './hash';
import { readImageSize } from './imageSize';
import { exists, isInside, mapLimit, resolveInside, toPosix, uniquePath, walkFiles } from './paths';

/** Creates a thumbnail for an image; returns pixel size, or null if the format is not supported. */
export type Thumbnailer = (source: string, dest: string) => Promise<{ width: number; height: number } | null>;

export function thumbPath(projectDir: string, assetId: string): string {
  return path.join(projectDir, META_DIR, 'thumbs', `${assetId}.png`);
}

const IGNORED = new Set(['thumbs.db', 'desktop.ini', '.ds_store']);

/**
 * Where an imported file goes inside the project.
 * A dropped folder "Assets" (or "assets") is merged into the project's assets/
 * folder; any other folder keeps its own name: assets/<Folder>/...
 */
function destFor(sourceRoot: string, file: string, isDir: boolean): { dest: string; relInImport: string } {
  if (!isDir) {
    const name = path.basename(file);
    return { dest: `${ASSETS_DIR}/${name}`, relInImport: name };
  }
  const relInRoot = toPosix(path.relative(sourceRoot, file));
  const rootName = path.basename(sourceRoot);
  const prefix = rootName.toLowerCase() === 'assets' ? ASSETS_DIR : `${ASSETS_DIR}/${rootName}`;
  return { dest: `${prefix}/${relInRoot}`, relInImport: `${rootName}/${relInRoot}` };
}

/**
 * Step 1 of import: scan files/folders recursively, detect type, hash, size and
 * duplicates. Nothing is copied yet so the user can decide about duplicates.
 */
export async function scanImport(projectDir: string, sources: string[], existing: Asset[]): Promise<ImportPlan> {
  const plan: ImportPlan = { items: [], unsupported: [], errors: [], scanned: 0 };
  const assetsRoot = path.join(projectDir, ASSETS_DIR);
  const candidates: { file: string; dest: string; relInImport: string; inPlace: boolean }[] = [];

  for (const src of sources) {
    let stat;
    try {
      stat = await fs.stat(src);
    } catch (e) {
      plan.errors.push({ path: src, message: `Cannot read: ${(e as Error).message}` });
      continue;
    }
    const files = stat.isDirectory() ? await walkFiles(src) : [src];
    for (const f of files) {
      if (IGNORED.has(path.basename(f).toLowerCase())) continue;
      plan.scanned++;
      if (isInside(assetsRoot, f)) {
        // File already lives in the project (registering untracked files).
        const rel = toPosix(path.relative(projectDir, f));
        candidates.push({ file: f, dest: rel, relInImport: toPosix(path.relative(assetsRoot, f)), inPlace: true });
      } else {
        const d = destFor(src, f, stat.isDirectory());
        candidates.push({ file: f, ...d, inPlace: false });
      }
    }
  }

  const byHash = new Map(existing.map((a) => [a.hash, a]));
  const byPath = new Map(existing.map((a) => [a.path.toLowerCase(), a]));
  const seenHashes = new Map<string, string>();

  const items = await mapLimit(candidates, 8, async (c): Promise<ImportItem | null> => {
    const ext = extOf(c.file);
    const kind = mediaKindOf(ext);
    if (!kind) {
      plan.unsupported.push(c.file);
      return null;
    }
    try {
      const st = await fs.stat(c.file);
      const hash = await hashFile(c.file);
      const dims = kind === 'image' ? await readImageSize(c.file) : null;
      const cls = classifyAsset(c.relInImport, kind, dims ?? undefined);
      return {
        id: newId('i'),
        source: c.file,
        dest: c.dest,
        kind,
        ext,
        type: cls.type,
        confidence: cls.confidence,
        reason: cls.reason,
        size: st.size,
        hash,
        width: dims?.width,
        height: dims?.height,
        inPlace: c.inPlace,
      };
    } catch (e) {
      plan.errors.push({ path: c.file, message: (e as Error).message });
      return null;
    }
  });

  for (const it of items) {
    if (!it) continue;
    const samePath = byPath.get(it.dest.toLowerCase());
    const sameHash = byHash.get(it.hash);
    if (it.inPlace && samePath) continue; // already registered
    if (samePath && !it.inPlace) {
      it.duplicate = { reason: 'path', existingPath: samePath.path, existingAssetId: samePath.id };
    } else if (sameHash) {
      it.duplicate = { reason: 'hash', existingPath: sameHash.path, existingAssetId: sameHash.id };
    } else if (seenHashes.has(it.hash)) {
      it.duplicate = { reason: 'batch', existingPath: seenHashes.get(it.hash)! };
    }
    if (!seenHashes.has(it.hash)) seenHashes.set(it.hash, it.dest);
    plan.items.push(it);
  }
  plan.items.sort((a, b) => a.dest.localeCompare(b.dest));
  plan.unsupported.sort();
  return plan;
}

/** Default decision for a duplicate when the user did not choose. */
export function defaultDecision(it: ImportItem): DuplicateDecision {
  return it.duplicate ? 'skip' : 'keep';
}

/**
 * Step 2 of import: copy files into the project, create thumbnails and build Asset records.
 * - skip:    do not import
 * - replace: overwrite the existing asset's file (keeps its id, so references stay valid)
 * - keep:    import as a new asset (renamed "name (2).ext" when the path is taken)
 */
export async function executeImport(
  projectDir: string,
  plan: ImportPlan,
  decisions: Record<string, DuplicateDecision>,
  existing: Asset[],
  thumbnailer: Thumbnailer,
): Promise<ImportResult> {
  const result: ImportResult = {
    added: [],
    replaced: [],
    report: {
      imported: 0,
      images: 0,
      audio: 0,
      video: 0,
      unsupported: plan.unsupported.length,
      duplicates: 0,
      replaced: 0,
      errors: [...plan.errors],
      unsupportedFiles: plan.unsupported,
    },
  };
  await fs.mkdir(path.join(projectDir, META_DIR, 'thumbs'), { recursive: true });
  const existingById = new Map(existing.map((a) => [a.id, a]));

  await mapLimit(plan.items, 6, async (it) => {
    const decision = decisions[it.id] ?? defaultDecision(it);
    try {
      if (it.duplicate && decision === 'skip') {
        result.report.duplicates++;
        return;
      }
      if (it.duplicate && decision === 'replace') {
        const target = it.duplicate.existingAssetId ? existingById.get(it.duplicate.existingAssetId) : undefined;
        if (!target || it.duplicate.reason !== 'path') {
          // Identical content already in the project: nothing to replace.
          result.report.duplicates++;
          return;
        }
        const abs = resolveInside(projectDir, target.path);
        await fs.mkdir(path.dirname(abs), { recursive: true });
        await fs.copyFile(it.source, abs);
        const dims = it.kind === 'image' ? await thumbnailer(abs, thumbPath(projectDir, target.id)).catch(() => null) : null;
        const replaced: ReplacedAsset = {
          assetId: target.id,
          hash: it.hash,
          size: it.size,
          width: dims?.width ?? it.width,
          height: dims?.height ?? it.height,
          hasThumb: !!dims,
        };
        result.replaced.push(replaced);
        result.report.replaced++;
        countKind(result, it);
        return;
      }
      let destAbs = resolveInside(projectDir, it.dest);
      if (!it.inPlace) {
        if (await exists(destAbs)) destAbs = await uniquePath(destAbs);
        await fs.mkdir(path.dirname(destAbs), { recursive: true });
        await fs.copyFile(it.source, destAbs);
      }
      const id = newId('as');
      const dims = it.kind === 'image' ? await thumbnailer(destAbs, thumbPath(projectDir, id)).catch(() => null) : null;
      const rel = toPosix(path.relative(projectDir, destAbs));
      const asset: Asset = {
        id,
        path: rel,
        name: path.basename(destAbs),
        ext: it.ext,
        kind: it.kind,
        type: it.type,
        size: it.size,
        hash: it.hash,
        width: dims?.width ?? it.width,
        height: dims?.height ?? it.height,
        tags: [],
        hasThumb: !!dims,
        rev: 0,
        importedAt: Date.now(),
      };
      result.added.push(asset);
      countKind(result, it);
    } catch (e) {
      result.report.errors.push({ path: it.source, message: (e as Error).message });
    }
  });
  result.added.sort((a, b) => a.path.localeCompare(b.path));
  result.report.imported = result.added.length;
  return result;
}

function countKind(result: ImportResult, it: ImportItem) {
  if (it.kind === 'image') result.report.images++;
  else if (it.kind === 'audio') result.report.audio++;
  else result.report.video++;
}
