import path from 'node:path';
import fs from 'node:fs/promises';
import type { PathMove, TreeListing } from '../shared/api';
import { ASSETS_DIR, META_DIR } from '../shared/project';
import { exists, resolveInside, safeName, toPosix, uniquePath, walkFiles } from './paths';

/** All file-manager paths must be inside the project's assets/ folder. */
function assetPath(projectDir: string, rel: string): string {
  const abs = resolveInside(projectDir, rel);
  const assetsRoot = path.join(projectDir, ASSETS_DIR);
  const r = path.relative(assetsRoot, abs);
  if (r.startsWith('..') || path.isAbsolute(r)) throw new Error(`Only files inside “${ASSETS_DIR}” can be managed: ${rel}`);
  return abs;
}

export async function listTree(projectDir: string): Promise<TreeListing> {
  const root = path.join(projectDir, ASSETS_DIR);
  await fs.mkdir(root, { recursive: true });
  const folders: string[] = [ASSETS_DIR];
  const files: TreeListing['files'] = [];
  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const abs = path.join(dir, e.name);
      const rel = toPosix(path.relative(projectDir, abs));
      if (e.isDirectory()) {
        folders.push(rel);
        await walk(abs);
      } else if (e.isFile()) {
        const st = await fs.stat(abs);
        files.push({ path: rel, size: st.size, mtime: st.mtimeMs });
      }
    }
  }
  await walk(root);
  folders.sort((a, b) => a.localeCompare(b));
  return { folders, files };
}

export async function createFolder(projectDir: string, rel: string): Promise<string> {
  const parent = path.posix.dirname(rel);
  const name = safeName(path.posix.basename(rel), 'New Folder');
  let abs = assetPath(projectDir, `${parent}/${name}`);
  abs = await uniquePath(abs);
  await fs.mkdir(abs, { recursive: true });
  return toPosix(path.relative(projectDir, abs));
}

export async function renamePath(projectDir: string, rel: string, newName: string): Promise<PathMove> {
  if (rel === ASSETS_DIR) throw new Error('The root assets folder cannot be renamed.');
  const abs = assetPath(projectDir, rel);
  const name = safeName(newName, '');
  if (!name) throw new Error('Please enter a valid name.');
  const target = path.join(path.dirname(abs), name);
  if (target.toLowerCase() !== abs.toLowerCase() && (await exists(target))) {
    throw new Error(`“${name}” already exists in this folder.`);
  }
  // Two-step rename handles case-only renames on case-insensitive file systems.
  const tmp = `${abs}.__renaming__${Date.now()}`;
  await fs.rename(abs, tmp);
  await fs.rename(tmp, target);
  return { from: rel, to: toPosix(path.relative(projectDir, target)) };
}

export async function movePaths(projectDir: string, rels: string[], destFolder: string): Promise<PathMove[]> {
  const destAbs = assetPath(projectDir, destFolder);
  await fs.mkdir(destAbs, { recursive: true });
  const out: PathMove[] = [];
  for (const rel of rels) {
    const abs = assetPath(projectDir, rel);
    if (path.dirname(abs) === destAbs) continue;
    if (destAbs === abs || destAbs.startsWith(abs + path.sep)) throw new Error('A folder cannot be moved into itself.');
    const target = await uniquePath(path.join(destAbs, path.basename(abs)));
    await fs.rename(abs, target);
    out.push({ from: rel, to: toPosix(path.relative(projectDir, target)) });
  }
  return out;
}

export async function copyPaths(projectDir: string, rels: string[], destFolder: string): Promise<PathMove[]> {
  const destAbs = assetPath(projectDir, destFolder);
  await fs.mkdir(destAbs, { recursive: true });
  const out: PathMove[] = [];
  for (const rel of rels) {
    const abs = assetPath(projectDir, rel);
    if (destAbs === abs || destAbs.startsWith(abs + path.sep)) throw new Error('A folder cannot be copied into itself.');
    const sameFolder = path.dirname(abs) === destAbs;
    let target = path.join(destAbs, path.basename(abs));
    if (sameFolder) {
      const ext = path.extname(abs);
      target = path.join(destAbs, `${path.basename(abs, ext)} copy${ext}`);
    }
    target = await uniquePath(target);
    await fs.cp(abs, target, { recursive: true, errorOnExist: true });
    out.push({ from: rel, to: toPosix(path.relative(projectDir, target)) });
  }
  return out;
}

/**
 * Deletes files/folders by moving them into the backup's files/ folder, so a
 * backup restore can bring them back. Returns the relative paths of every
 * removed file (folders expanded).
 */
export async function removePaths(projectDir: string, rels: string[], backupId: string): Promise<string[]> {
  if (rels.includes(ASSETS_DIR)) throw new Error('The root assets folder cannot be deleted.');
  const trash = path.join(projectDir, META_DIR, 'backups', backupId, 'files');
  const removed: string[] = [];
  for (const rel of rels) {
    const abs = assetPath(projectDir, rel);
    if (!(await exists(abs))) continue;
    const st = await fs.stat(abs);
    const files = st.isDirectory() ? await walkFiles(abs) : [abs];
    files.forEach((f) => removed.push(toPosix(path.relative(projectDir, f))));
    const dest = path.join(trash, path.relative(projectDir, abs));
    await fs.mkdir(path.dirname(dest), { recursive: true });
    try {
      await fs.rename(abs, dest);
    } catch {
      await fs.cp(abs, dest, { recursive: true });
      await fs.rm(abs, { recursive: true, force: true });
    }
  }
  return removed;
}

export async function exportFiles(projectDir: string, rels: string[], destDir: string): Promise<number> {
  let n = 0;
  for (const rel of rels) {
    const abs = assetPath(projectDir, rel);
    const target = await uniquePath(path.join(destDir, path.basename(abs)));
    await fs.cp(abs, target, { recursive: true });
    n++;
  }
  return n;
}

/** Files (relative paths) under the given relative paths, folders expanded. */
export async function expandFiles(projectDir: string, rels: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const rel of rels) {
    const abs = assetPath(projectDir, rel);
    const st = await fs.stat(abs);
    if (st.isDirectory()) (await walkFiles(abs)).forEach((f) => out.push(toPosix(path.relative(projectDir, f))));
    else out.push(rel);
  }
  return out;
}

export { assetPath };
