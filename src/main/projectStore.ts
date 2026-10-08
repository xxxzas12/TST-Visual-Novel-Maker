import path from 'node:path';
import fs from 'node:fs/promises';
import type { Project } from '../shared/types';
import type { OpenProjectResult, RecentProject, UserTemplateInfo } from '../shared/api';
import { ASSETS_DIR, META_DIR, PROJECT_FILE, createProjectFromTemplate, normalizeProject } from '../shared/project';
import { newId } from '../shared/ids';
import { exists, safeName, uniquePath, writeFileAtomic } from './paths';

const RECOVERY_FILE = 'recovery.json';

export function projectFile(dir: string) {
  return path.join(dir, PROJECT_FILE);
}

function recoveryFile(dir: string) {
  return path.join(dir, META_DIR, RECOVERY_FILE);
}

export async function createProject(parentDir: string, name: string, template: string, userTemplate?: Project): Promise<OpenProjectResult> {
  const folderName = safeName(name, 'My Visual Novel');
  const dir = await uniquePath(path.join(parentDir, folderName));
  await fs.mkdir(path.join(dir, ASSETS_DIR), { recursive: true });
  await fs.mkdir(path.join(dir, META_DIR, 'thumbs'), { recursive: true });
  let project: Project;
  if (userTemplate) {
    project = normalizeProject({ ...userTemplate, id: newId('p'), name, createdAt: Date.now(), updatedAt: Date.now(), assets: [] });
    project.settings.title = name;
    // Templates are stored without assets; drop references to them.
    project.characters = project.characters.map((c) => ({ ...c, expressions: [] }));
  } else {
    project = createProjectFromTemplate(name, template);
  }
  await saveProject(dir, project);
  return { dir, project };
}

export async function openProject(dirOrFile: string): Promise<OpenProjectResult> {
  let dir = dirOrFile;
  if (path.basename(dirOrFile).toLowerCase() === PROJECT_FILE) dir = path.dirname(dirOrFile);
  const file = projectFile(dir);
  if (!(await exists(file))) throw new Error(`No TSTVN project found in “${dir}”.`);
  let project: Project;
  try {
    project = normalizeProject(JSON.parse(await fs.readFile(file, 'utf8')));
  } catch (e) {
    throw new Error(`The project file is damaged: ${(e as Error).message}. You can restore a backup from the “.tstvn/backups” folder.`, { cause: e });
  }
  await fs.mkdir(path.join(dir, ASSETS_DIR), { recursive: true });
  await fs.mkdir(path.join(dir, META_DIR, 'thumbs'), { recursive: true });
  const result: OpenProjectResult = { dir, project };
  const rec = recoveryFile(dir);
  if (await exists(rec)) {
    try {
      const [recStat, projStat] = await Promise.all([fs.stat(rec), fs.stat(file)]);
      if (recStat.mtimeMs > projStat.mtimeMs) {
        result.recovery = { savedAt: recStat.mtimeMs, project: normalizeProject(JSON.parse(await fs.readFile(rec, 'utf8'))) };
      } else {
        await fs.rm(rec, { force: true });
      }
    } catch {
      await fs.rm(rec, { force: true });
    }
  }
  return result;
}

export async function saveProject(dir: string, project: Project): Promise<number> {
  const savedAt = Date.now();
  const data = JSON.stringify({ ...project, updatedAt: savedAt }, null, 1);
  await writeFileAtomic(projectFile(dir), data);
  await fs.rm(recoveryFile(dir), { force: true });
  return savedAt;
}

export async function writeRecovery(dir: string, project: Project): Promise<void> {
  await writeFileAtomic(recoveryFile(dir), JSON.stringify(project));
}

export async function discardRecovery(dir: string): Promise<void> {
  await fs.rm(recoveryFile(dir), { force: true });
}

// ---------------- recent projects & user templates (stored in app userData) ----------------

export class UserStore {
  constructor(private readonly userDir: string) {}

  private file(name: string) {
    return path.join(this.userDir, name);
  }

  async readJson<T>(name: string, fallback: T): Promise<T> {
    try {
      return JSON.parse(await fs.readFile(this.file(name), 'utf8')) as T;
    } catch {
      return fallback;
    }
  }

  async writeJson(name: string, value: unknown) {
    await writeFileAtomic(this.file(name), JSON.stringify(value, null, 1));
  }

  async recent(): Promise<RecentProject[]> {
    const list = await this.readJson<RecentProject[]>('recent.json', []);
    const checked = await Promise.all(list.map(async (r) => ((await exists(projectFile(r.path))) ? r : null)));
    return checked.filter((r): r is RecentProject => !!r);
  }

  async addRecent(dir: string, name: string) {
    const list = (await this.readJson<RecentProject[]>('recent.json', [])).filter((r) => path.resolve(r.path) !== path.resolve(dir));
    list.unshift({ path: dir, name, openedAt: Date.now() });
    await this.writeJson('recent.json', list.slice(0, 15));
  }

  async removeRecent(dir: string) {
    const list = (await this.readJson<RecentProject[]>('recent.json', [])).filter((r) => path.resolve(r.path) !== path.resolve(dir));
    await this.writeJson('recent.json', list);
    return this.recent();
  }

  async listTemplates(): Promise<UserTemplateInfo[]> {
    return this.readJson<UserTemplateInfo[]>('templates/index.json', []);
  }

  async saveTemplate(name: string, project: Project): Promise<UserTemplateInfo> {
    const info: UserTemplateInfo = { id: newId('t'), name: name.trim() || project.name, createdAt: Date.now() };
    // Templates keep structure (scenes, variables, theme, action templates) but not media.
    const strip: Project = { ...project, assets: [], collections: [] };
    await this.writeJson(`templates/${info.id}.json`, strip);
    const list = await this.listTemplates();
    list.push(info);
    await this.writeJson('templates/index.json', list);
    return info;
  }

  async loadTemplate(id: string): Promise<Project | undefined> {
    return this.readJson<Project | undefined>(`templates/${path.basename(id)}.json`, undefined);
  }

  async removeTemplate(id: string) {
    const list = (await this.listTemplates()).filter((t) => t.id !== id);
    await this.writeJson('templates/index.json', list);
    await fs.rm(this.file(`templates/${path.basename(id)}.json`), { force: true });
  }
}

/**
 * Copies a project (saved files, assets, fonts, thumbnails) into a new folder next to it, with a new id
 * and name. The original's backups and unsaved-work recovery file stay with the original.
 */
export async function duplicateProject(dir: string, newName: string): Promise<OpenProjectResult> {
  const { project } = await openProject(dir);
  const name = newName.trim() || `${project.name} copy`;
  const target = await uniquePath(path.join(path.dirname(path.resolve(dir)), safeName(name, 'Project copy')));
  const skip = new Set([path.resolve(dir, META_DIR, 'backups'), recoveryFile(path.resolve(dir))]);
  await fs.cp(dir, target, { recursive: true, filter: (src) => !skip.has(path.resolve(src)) });
  const copy: Project = { ...project, id: newId('p'), name, createdAt: Date.now(), settings: { ...project.settings, title: project.settings.title === project.name ? name : project.settings.title } };
  await saveProject(target, copy);
  return { dir: target, project: copy };
}
