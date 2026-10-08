// Plugin system: manifest validation, install (folder / .tstplugin), enable/disable, update, remove,
// damaged plugins, and the content plugins contribute (themes, action templates).
import { beforeAll, describe, expect, it } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { strToU8, zipSync } from 'fflate';
import { PluginStore } from '../src/main/plugins';
import { validateManifest } from '../src/shared/plugins';
import { tempDir } from './helpers';

const SAMPLE = path.resolve('plugins/tstvn-sample-pack');
let root: string;
beforeAll(async () => {
  root = await tempDir('tstvn-plugins-');
});

describe('plugin manifest', () => {
  const ok = { id: 'com.example.pack', name: 'Pack', version: '1.0.0', contributes: { themes: ['themes/a.json'] } };
  it('accepts a valid manifest', () => {
    expect(validateManifest(ok)).toMatchObject({ id: 'com.example.pack', name: 'Pack', author: '', contributes: { themes: ['themes/a.json'], actionTemplates: [] } });
  });
  it('rejects bad manifests with readable messages', () => {
    expect(() => validateManifest(null)).toThrow(/not a JSON object/);
    expect(() => validateManifest({ ...ok, id: 'Bad Id!' })).toThrow(/"id"/);
    expect(() => validateManifest({ ...ok, name: '' })).toThrow(/"name"/);
    expect(() => validateManifest({ ...ok, version: undefined })).toThrow(/"version"/);
    expect(() => validateManifest({ ...ok, contributes: { themes: ['../../evil.json'] } })).toThrow(/inside the plugin folder/);
    expect(() => validateManifest({ ...ok, contributes: { themes: ['C:/x.json'] } })).toThrow(/inside the plugin folder/);
    expect(() => validateManifest({ ...ok, contributes: {} })).toThrow(/contributes nothing/);
  });
});

describe('plugin store', () => {
  it('installs from a folder, contributes content, disables, re-enables and removes', async () => {
    const store = new PluginStore(path.join(root, 'a', 'plugins'));
    expect(await store.list()).toEqual([]);
    const info = await store.install(SAMPLE);
    expect(info).toMatchObject({ id: 'tstvn.sample-pack', name: 'TSTVN Sample Pack', version: '1.0.0', enabled: true, themes: 1, actionTemplates: 1 });
    expect(info.error).toBeUndefined();

    const c = await store.contributions();
    expect(c.themes.map((t) => [t.id, t.name, t.pluginName])).toEqual([['plugin:tstvn.sample-pack:sunset-glow', 'Sunset Glow', 'TSTVN Sample Pack']]);
    expect(c.themes[0].version).toBe(2); // completed with defaults
    expect(c.themes[0].dialog.surface.background).toBe('#2b1238');
    expect(c.actionTemplates[0]).toMatchObject({ id: 'plugin:tstvn.sample-pack:0', name: 'Dramatic Entrance' });
    expect(c.actionTemplates[0].actions.map((a) => a.type)).toEqual(['screenEffect', 'screenEffect', 'narration']);

    expect((await store.setEnabled('tstvn.sample-pack', false))[0].enabled).toBe(false);
    expect(await store.contributions()).toEqual({ themes: [], actionTemplates: [] });
    await store.setEnabled('tstvn.sample-pack', true);
    expect((await store.contributions()).themes).toHaveLength(1);

    expect(await store.remove('tstvn.sample-pack')).toEqual([]);
    expect(existsSync(path.join(root, 'a', 'plugins', 'tstvn.sample-pack'))).toBe(false);
  });

  it('installs and updates from a .tstplugin zip (with or without a top folder)', async () => {
    const store = new PluginStore(path.join(root, 'b', 'plugins'));
    const zip = (files: Record<string, string>) => zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])));
    const manifest = (version: string) => JSON.stringify({ id: 'com.example.tiny', name: 'Tiny', version, contributes: { actionTemplates: ['t.json'] } });
    const tpl = JSON.stringify({ name: 'Hello', actions: [{ type: 'narration', params: { text: 'hi' } }] });
    const f1 = path.join(root, 'tiny-1.tstplugin');
    await fs.writeFile(f1, zip({ 'plugin.json': manifest('1.0.0'), 't.json': tpl }));
    expect((await store.install(f1)).version).toBe('1.0.0');
    const f2 = path.join(root, 'tiny-2.zip');
    await fs.writeFile(f2, zip({ 'tiny/plugin.json': manifest('2.0.0'), 'tiny/t.json': tpl }));
    expect((await store.install(f2)).version).toBe('2.0.0');
    expect(await store.list()).toHaveLength(1);
  });

  it('rejects broken plugins without touching an installed version', async () => {
    const store = new PluginStore(path.join(root, 'c', 'plugins'));
    await store.install(SAMPLE);
    const bad = path.join(root, 'bad-plugin');
    await fs.mkdir(path.join(bad, 'templates'), { recursive: true });
    await fs.writeFile(path.join(bad, 'plugin.json'), JSON.stringify({ id: 'tstvn.sample-pack', name: 'Broken', version: '9', contributes: { actionTemplates: ['templates/x.json'] } }));
    await fs.writeFile(path.join(bad, 'templates', 'x.json'), JSON.stringify({ name: 'X', actions: [{ type: 'launchRockets' }] }));
    await expect(store.install(bad)).rejects.toThrow(/unknown type/);
    expect((await store.list())[0]).toMatchObject({ name: 'TSTVN Sample Pack', version: '1.0.0' }); // untouched

    const notZip = path.join(root, 'x.tstplugin');
    await fs.writeFile(notZip, 'nope');
    await expect(store.install(notZip)).rejects.toThrow(/not a TSTVN plugin/);
    const evil = path.join(root, 'evil.tstplugin');
    await fs.writeFile(evil, zipSync({ 'plugin.json': strToU8('{}'), '../../escape.txt': strToU8('x') }));
    await expect(store.install(evil)).rejects.toThrow();
    expect(existsSync(path.join(root, 'escape.txt'))).toBe(false);
    await expect(store.install(path.join(root, 'missing'))).rejects.toThrow(/not found/);
  });

  it('reports a damaged installed plugin and skips its content', async () => {
    const store = new PluginStore(path.join(root, 'd', 'plugins'));
    await store.install(SAMPLE);
    await fs.rm(path.join(root, 'd', 'plugins', 'tstvn.sample-pack', 'themes', 'sunset-glow.json'));
    const [p] = await store.list();
    expect(p.error).toMatch(/sunset-glow\.json/);
    expect(await store.contributions()).toEqual({ themes: [], actionTemplates: [] });
  });
});
