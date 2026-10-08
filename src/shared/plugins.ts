// TSTVN plugins: declarative content packs (no code is executed).
// A plugin is a folder (or a .tstplugin zip of it) with a plugin.json manifest:
//   { "id": "com.example.pack", "name": "…", "version": "1.0.0", "author": "…", "description": "…",
//     "contributes": { "themes": ["themes/x.json"], "actionTemplates": ["templates/y.json"] } }
// Contributed themes show up in Themes (From plugins); action templates in "＋ Action" → Templates.
import type { Action, ActionTemplate, Theme } from './types';
import { isKnownActionType } from './actions';
import { normalizeTheme } from './themes';
import { newId } from './ids';

export const PLUGIN_MANIFEST = 'plugin.json';
export const PLUGIN_EXT = 'tstplugin';

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  author?: string;
  description?: string;
  contributes?: { themes?: string[]; actionTemplates?: string[] };
}

export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  enabled: boolean;
  themes: number;
  actionTemplates: number;
  /** Set when the plugin is installed but damaged (its content is not loaded). */
  error?: string;
}

/** A template contributed by a plugin (id is prefixed with "plugin:"). */
export interface PluginActionTemplate extends ActionTemplate {
  pluginName: string;
}

export interface PluginContributions {
  themes: (Theme & { pluginName: string })[];
  actionTemplates: PluginActionTemplate[];
}

const ID_RE = /^[a-z0-9][a-z0-9._-]{1,63}$/;
const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

/** Validates a parsed plugin.json. Throws an Error with a user-readable message. */
export function validateManifest(raw: unknown): PluginManifest {
  if (!raw || typeof raw !== 'object') throw new Error('plugin.json is not a JSON object.');
  const m = raw as Record<string, unknown>;
  if (!isStr(m.id) || !ID_RE.test(m.id)) throw new Error('plugin.json: "id" must be lowercase letters, digits, dots or dashes (e.g. "com.example.pack").');
  if (!isStr(m.name)) throw new Error('plugin.json: "name" is required.');
  if (!isStr(m.version)) throw new Error('plugin.json: "version" is required.');
  const c = (m.contributes ?? {}) as Record<string, unknown>;
  const files = (key: 'themes' | 'actionTemplates') => {
    const v = c[key];
    if (v === undefined) return [];
    if (!Array.isArray(v) || !v.every(isStr)) throw new Error(`plugin.json: "contributes.${key}" must be a list of file paths.`);
    for (const f of v) if (/^([a-z]:|[\\/])|\.\./i.test(f)) throw new Error(`plugin.json: "${f}" must be a path inside the plugin folder.`);
    return v;
  };
  const themes = files('themes');
  const actionTemplates = files('actionTemplates');
  if (!themes.length && !actionTemplates.length) throw new Error('plugin.json: the plugin contributes nothing ("contributes.themes" or "contributes.actionTemplates").');
  return {
    id: m.id,
    name: m.name.trim(),
    version: m.version.trim(),
    author: isStr(m.author) ? m.author.trim() : '',
    description: isStr(m.description) ? m.description.trim() : '',
    contributes: { themes, actionTemplates },
  };
}

/** A theme file of a plugin → a read-only theme with a plugin-scoped id. */
export function pluginTheme(pluginId: string, pluginName: string, raw: unknown, index: number): Theme & { pluginName: string } {
  if (!raw || typeof raw !== 'object') throw new Error('a theme file is not a JSON object');
  const t = normalizeTheme(raw);
  const local = typeof (raw as { id?: unknown }).id === 'string' ? (raw as { id: string }).id : String(index);
  return { ...t, id: `plugin:${pluginId}:${local}`, name: t.name, preset: undefined, pluginName };
}

/** An action-template file of a plugin: { "name": "…", "actions": [{ "type": "narration", "params": {…} }] }. */
export function pluginActionTemplate(pluginId: string, pluginName: string, raw: unknown, index: number): PluginActionTemplate {
  const r = raw as { name?: unknown; actions?: unknown };
  if (!r || typeof r !== 'object' || !isStr(r.name) || !Array.isArray(r.actions) || !r.actions.length) throw new Error('an action template needs "name" and a non-empty "actions" list');
  const actions: Action[] = r.actions.map((a: unknown, i: number) => {
    const x = a as { type?: unknown; params?: unknown };
    if (!x || typeof x !== 'object' || typeof x.type !== 'string' || !isKnownActionType(x.type)) throw new Error(`action ${i + 1} has an unknown type`);
    const params = x.params && typeof x.params === 'object' ? (JSON.parse(JSON.stringify(x.params)) as Record<string, unknown>) : {};
    return { id: newId('a'), type: x.type, params };
  });
  return { id: `plugin:${pluginId}:${index}`, name: r.name.trim(), actions, pluginName };
}

export function isPluginItemId(id: string): boolean {
  return id.startsWith('plugin:');
}
