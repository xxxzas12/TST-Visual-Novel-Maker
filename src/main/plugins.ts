// Installed plugins live in <userData>/plugins/<id>/; enabled/disabled state in state.json.
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { unzipSync } from 'fflate';
import {
  PLUGIN_MANIFEST,
  pluginActionTemplate,
  pluginTheme,
  validateManifest,
  type PluginContributions,
  type PluginInfo,
  type PluginManifest,
} from '../shared/plugins';
import { exists, resolveInside, writeFileAtomic } from './paths';

interface State {
  disabled: string[];
}

export class PluginStore {
  constructor(readonly dir: string) {}

  private async state(): Promise<State> {
    try {
      const s = JSON.parse(await fs.readFile(path.join(this.dir, 'state.json'), 'utf8')) as Partial<State>;
      return { disabled: Array.isArray(s.disabled) ? s.disabled.filter((x) => typeof x === 'string') : [] };
    } catch {
      return { disabled: [] };
    }
  }

  private async saveState(s: State) {
    await fs.mkdir(this.dir, { recursive: true });
    await writeFileAtomic(path.join(this.dir, 'state.json'), JSON.stringify(s, null, 1));
  }

  private async readManifest(folder: string): Promise<PluginManifest> {
    let raw: unknown;
    try {
      raw = JSON.parse(await fs.readFile(path.join(folder, PLUGIN_MANIFEST), 'utf8'));
    } catch {
      throw new Error('plugin.json is missing or is not valid JSON.');
    }
    return validateManifest(raw);
  }

  /** Loads a plugin's content; throws if any contributed file is missing or invalid. */
  private async load(folder: string, m: PluginManifest): Promise<PluginContributions> {
    const read = async (rel: string) => {
      try {
        return JSON.parse(await fs.readFile(resolveInside(folder, rel), 'utf8')) as unknown;
      } catch {
        throw new Error(`${rel} is missing or is not valid JSON.`);
      }
    };
    const themes: PluginContributions['themes'] = [];
    for (const [i, rel] of (m.contributes?.themes ?? []).entries()) {
      const raw = await read(rel);
      try {
        themes.push(pluginTheme(m.id, m.name, raw, i));
      } catch (e) {
        throw new Error(`${rel}: ${(e as Error).message}`, { cause: e });
      }
    }
    const actionTemplates: PluginContributions['actionTemplates'] = [];
    for (const [i, rel] of (m.contributes?.actionTemplates ?? []).entries()) {
      const raw = await read(rel);
      try {
        actionTemplates.push(pluginActionTemplate(m.id, m.name, raw, i));
      } catch (e) {
        throw new Error(`${rel}: ${(e as Error).message}`, { cause: e });
      }
    }
    return { themes, actionTemplates };
  }

  async list(): Promise<PluginInfo[]> {
    const { disabled } = await this.state();
    const entries = await fs.readdir(this.dir, { withFileTypes: true }).catch(() => []);
    const out: PluginInfo[] = [];
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const folder = path.join(this.dir, e.name);
      try {
        const m = await this.readManifest(folder);
        const info: PluginInfo = { id: m.id, name: m.name, version: m.version, author: m.author ?? '', description: m.description ?? '', enabled: !disabled.includes(m.id), themes: m.contributes?.themes?.length ?? 0, actionTemplates: m.contributes?.actionTemplates?.length ?? 0 };
        try {
          await this.load(folder, m);
        } catch (err) {
          info.error = (err as Error).message;
        }
        out.push(info);
      } catch (err) {
        out.push({ id: e.name, name: e.name, version: '?', author: '', description: '', enabled: false, themes: 0, actionTemplates: 0, error: (err as Error).message });
      }
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Installs (or updates) a plugin from a folder or a .tstplugin/.zip file. The plugin is fully
   * validated in a staging folder before anything replaces an installed version.
   */
  async install(source: string): Promise<PluginInfo> {
    const st = await fs.stat(source).catch(() => null);
    if (!st) throw new Error('The plugin was not found.');
    const staging = path.join(os.tmpdir(), `tstvn-plugin-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    try {
      if (st.isDirectory()) await fs.cp(source, staging, { recursive: true });
      else await this.unzip(source, staging);
      // A zip may contain the plugin folder itself instead of its contents.
      let root = staging;
      if (!(await exists(path.join(root, PLUGIN_MANIFEST)))) {
        const subs = (await fs.readdir(root, { withFileTypes: true })).filter((d) => d.isDirectory());
        if (subs.length === 1 && (await exists(path.join(root, subs[0].name, PLUGIN_MANIFEST)))) root = path.join(root, subs[0].name);
        else throw new Error('This is not a TSTVN plugin (plugin.json is missing).');
      }
      const m = await this.readManifest(root);
      await this.load(root, m);
      const dest = resolveInside(this.dir, m.id);
      await fs.mkdir(this.dir, { recursive: true });
      await fs.rm(dest, { recursive: true, force: true });
      await fs.cp(root, dest, { recursive: true });
      const s = await this.state();
      await this.saveState({ disabled: s.disabled.filter((x) => x !== m.id) });
      return (await this.list()).find((p) => p.id === m.id)!;
    } finally {
      await fs.rm(staging, { recursive: true, force: true });
    }
  }

  private async unzip(file: string, dest: string) {
    let files: Record<string, Uint8Array>;
    try {
      files = unzipSync(new Uint8Array(await fs.readFile(file)));
    } catch {
      throw new Error('This file is not a TSTVN plugin (.tstplugin or .zip).');
    }
    for (const [name, data] of Object.entries(files)) {
      if (name.endsWith('/')) continue;
      const out = resolveInside(dest, name.replace(/\\/g, '/'));
      await fs.mkdir(path.dirname(out), { recursive: true });
      await fs.writeFile(out, data);
    }
  }

  async remove(id: string): Promise<PluginInfo[]> {
    await fs.rm(resolveInside(this.dir, id), { recursive: true, force: true });
    const s = await this.state();
    await this.saveState({ disabled: s.disabled.filter((x) => x !== id) });
    return this.list();
  }

  async setEnabled(id: string, enabled: boolean): Promise<PluginInfo[]> {
    const s = await this.state();
    const disabled = s.disabled.filter((x) => x !== id);
    if (!enabled) disabled.push(id);
    await this.saveState({ disabled });
    return this.list();
  }

  /** Content of all enabled, valid plugins. */
  async contributions(): Promise<PluginContributions> {
    const out: PluginContributions = { themes: [], actionTemplates: [] };
    for (const p of await this.list()) {
      if (!p.enabled || p.error) continue;
      const folder = resolveInside(this.dir, p.id);
      const c = await this.load(folder, await this.readManifest(folder));
      out.themes.push(...c.themes);
      out.actionTemplates.push(...c.actionTemplates);
    }
    return out;
  }
}
