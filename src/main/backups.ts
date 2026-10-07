import path from 'node:path';
import fs from 'node:fs/promises';
import type { Project } from '../shared/types';
import type { BackupInfo } from '../shared/api';
import { META_DIR, normalizeProject } from '../shared/project';
import { newId } from '../shared/ids';
import { exists, walkFiles, writeFileAtomic } from './paths';
import { saveProject } from './projectStore';

const MAX_BACKUPS = 40;

function backupsDir(dir: string) {
  return path.join(dir, META_DIR, 'backups');
}

/** Snapshot the project data before a risky operation (delete, import, mass replace, restore). */
export async function createBackup(dir: string, project: Project, reason: string): Promise<string> {
  const id = `${new Date().toISOString().replace(/[:.]/g, '-')}_${newId('b').slice(-6)}`;
  const bdir = path.join(backupsDir(dir), id);
  await fs.mkdir(bdir, { recursive: true });
  await writeFileAtomic(path.join(bdir, 'project.json'), JSON.stringify(project));
  await writeFileAtomic(path.join(bdir, 'meta.json'), JSON.stringify({ id, reason, createdAt: Date.now() }));
  await pruneBackups(dir);
  return id;
}

export async function listBackups(dir: string): Promise<BackupInfo[]> {
  const root = backupsDir(dir);
  if (!(await exists(root))) return [];
  const ids = await fs.readdir(root);
  const out: BackupInfo[] = [];
  for (const id of ids) {
    try {
      const meta = JSON.parse(await fs.readFile(path.join(root, id, 'meta.json'), 'utf8'));
      out.push({ id, reason: meta.reason ?? '', createdAt: meta.createdAt ?? 0, hasFiles: await exists(path.join(root, id, 'files')) });
    } catch {
      /* incomplete backup folder: ignore */
    }
  }
  return out.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Restore a backup: project data is replaced and any files deleted after the
 * backup are moved back. The current state is backed up first so restore can be undone.
 */
export async function restoreBackup(dir: string, id: string, current: Project | null): Promise<Project> {
  const bdir = path.join(backupsDir(dir), path.basename(id));
  const project = normalizeProject(JSON.parse(await fs.readFile(path.join(bdir, 'project.json'), 'utf8')));
  if (current) await createBackup(dir, current, 'Before restoring a backup');
  const filesDir = path.join(bdir, 'files');
  if (await exists(filesDir)) {
    for (const f of await walkFiles(filesDir)) {
      const rel = path.relative(filesDir, f);
      const target = path.join(dir, rel);
      if (await exists(target)) continue;
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.copyFile(f, target);
    }
  }
  await saveProject(dir, project);
  return project;
}

export async function deleteBackup(dir: string, id: string): Promise<void> {
  await fs.rm(path.join(backupsDir(dir), path.basename(id)), { recursive: true, force: true });
}

async function pruneBackups(dir: string) {
  const all = await listBackups(dir);
  for (const b of all.slice(MAX_BACKUPS)) await deleteBackup(dir, b.id);
}
