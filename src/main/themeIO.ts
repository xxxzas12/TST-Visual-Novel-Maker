// .tsttheme files: a zip with theme.json plus the images and fonts the theme uses,
// so a theme can be shared and imported into any project.
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import type { DuplicateDecision } from '../shared/api';
import type { Asset, Theme } from '../shared/types';
import { newId } from '../shared/ids';
import { mapThemeImages, normalizeTheme, themeAssetIds, themeFontRefs } from '../shared/themes';
import { executeImport, scanImport, type Thumbnailer } from './importer';
import { exists, resolveInside, safeName, toPosix, uniquePath, writeFileAtomic } from './paths';

export const THEME_EXT = 'tsttheme';
const MANIFEST = 'theme.json';

interface ThemeManifest {
  format: 'tstvn-theme';
  version: 2;
  exportedAt: number;
  theme: Theme;
  /** asset id used in the theme → file inside the zip */
  images: Record<string, string>;
  /** project font path (fonts/…) → file inside the zip */
  fonts: Record<string, string>;
}

/** Writes a theme and every file it needs into a .tsttheme file. */
export async function exportThemeFile(projectDir: string, theme: Theme, assets: Asset[], file: string): Promise<{ files: number; bytes: number }> {
  const zip: Zippable = {};
  const images: Record<string, string> = {};
  const fonts: Record<string, string> = {};
  const used = new Set<string>();
  const entry = (folder: string, name: string) => {
    let n = `${folder}/${name}`;
    for (let i = 2; used.has(n.toLowerCase()); i++) n = `${folder}/${path.parse(name).name} (${i})${path.extname(name)}`;
    used.add(n.toLowerCase());
    return n;
  };
  for (const id of new Set(themeAssetIds(theme))) {
    const a = assets.find((x) => x.id === id);
    if (!a) throw new Error(`The theme uses an image that is no longer in the project (${id}).`);
    const name = entry('images', path.basename(a.path));
    zip[name] = [new Uint8Array(await fs.readFile(resolveInside(projectDir, a.path))), { level: 0 }];
    images[id] = name;
  }
  for (const f of themeFontRefs(theme)) {
    if (!f.file || fonts[f.file]) continue;
    const name = entry('fonts', path.basename(f.file));
    zip[name] = [new Uint8Array(await fs.readFile(resolveInside(projectDir, f.file))), { level: 0 }];
    fonts[f.file] = name;
  }
  const manifest: ThemeManifest = { format: 'tstvn-theme', version: 2, exportedAt: Date.now(), theme, images, fonts };
  zip[MANIFEST] = strToU8(JSON.stringify(manifest, null, 1));
  const data = zipSync(zip, { level: 6 });
  await writeFileAtomic(file, data);
  return { files: Object.keys(zip).length, bytes: data.length };
}

export interface ThemeImportResult {
  theme: Theme;
  /** New project assets (images copied into assets/UI/Themes/<name>/). */
  added: Asset[];
}

/**
 * Reads a .tsttheme file: images become project assets (identical images already in the
 * project are reused), fonts are copied to fonts/, and the theme gets a new id.
 */
export async function importThemeFile(projectDir: string, file: string, existing: Asset[], thumbnailer: Thumbnailer): Promise<ThemeImportResult> {
  let files: Record<string, Uint8Array>;
  let manifest: ThemeManifest;
  try {
    files = unzipSync(new Uint8Array(await fs.readFile(file)));
    manifest = JSON.parse(strFromU8(files[MANIFEST])) as ThemeManifest;
  } catch {
    throw new Error('This file is not a TSTVN theme (.tsttheme).');
  }
  if (manifest?.format !== 'tstvn-theme' || !manifest.theme) throw new Error('This file is not a TSTVN theme (.tsttheme).');
  const theme = normalizeTheme(manifest.theme);
  theme.id = newId('th');
  theme.preset = undefined;

  // Images → staging folder → regular import (hashing, thumbnails, duplicate detection).
  const staging = path.join(os.tmpdir(), `tstvn-theme-${theme.id}`);
  const uiRoot = path.join(staging, 'UI');
  const folder = path.join(uiRoot, 'Themes', safeName(theme.name, 'Theme'));
  const idByEntry = new Map<string, string>();
  const added: Asset[] = [];
  try {
    const staged = new Map<string, string>(); // zip entry → staged file
    for (const [id, name] of Object.entries(manifest.images ?? {})) {
      const data = files[name];
      if (!data) throw new Error(`The theme file is damaged (missing ${name}).`);
      if (!staged.has(name)) {
        const dest = await uniquePath(path.join(folder, path.basename(name)));
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.writeFile(dest, data);
        staged.set(name, dest);
      }
      idByEntry.set(id, name);
    }
    if (staged.size) {
      const plan = await scanImport(projectDir, [uiRoot], existing);
      const decisions: Record<string, DuplicateDecision> = Object.fromEntries(plan.items.map((i) => [i.id, i.duplicate ? 'skip' : 'keep']));
      const r = await executeImport(projectDir, plan, decisions, existing, thumbnailer);
      if (r.report.errors.length) throw new Error(r.report.errors[0].message);
      added.push(...r.added);
      const byHash = new Map([...existing, ...r.added].map((a) => [a.hash, a.id]));
      const newIdBySource = new Map(plan.items.map((i) => [path.resolve(i.source), byHash.get(i.hash)]));
      const remap = new Map<string, string>();
      for (const [oldId, name] of idByEntry) {
        const nid = newIdBySource.get(path.resolve(staged.get(name)!));
        if (nid) remap.set(oldId, nid);
      }
      mapThemeImages(theme, (id) => remap.get(id) ?? null);
    } else mapThemeImages(theme, () => null);
  } finally {
    await fs.rm(staging, { recursive: true, force: true });
  }

  // Fonts → project fonts/ (an identical file is reused).
  const fontMap = new Map<string, string>();
  for (const [orig, name] of Object.entries(manifest.fonts ?? {})) {
    const data = files[name];
    if (!data) continue;
    let dest = resolveInside(projectDir, `fonts/${path.basename(name)}`);
    if (await exists(dest)) {
      const same = Buffer.from(await fs.readFile(dest)).equals(Buffer.from(data));
      if (!same) dest = await uniquePath(dest);
    }
    await fs.mkdir(path.dirname(dest), { recursive: true });
    if (!(await exists(dest))) await fs.writeFile(dest, data);
    fontMap.set(orig, toPosix(path.relative(projectDir, dest)));
  }
  for (const f of themeFontRefs(theme)) {
    if (!f.file) continue;
    const mapped = fontMap.get(f.file);
    if (mapped) f.file = mapped;
    else delete f.file; // font not shipped: fall back to an installed font of that name
  }
  return { theme, added };
}
