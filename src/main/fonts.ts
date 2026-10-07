// Font discovery and custom font storage.
// Family names are read from the font files themselves (OpenType `name` table),
// so they are exactly what CSS / FontFace expect.
import path from 'node:path';
import fs from 'node:fs/promises';
import type { CustomFont, SystemFont } from '../shared/api';
import { newId } from '../shared/ids';
import { exists, writeFileAtomic, resolveInside, toPosix } from './paths';

export const FONT_EXT = ['ttf', 'otf'];
const SCAN_EXT = new Set(['.ttf', '.otf', '.ttc']);

interface NameRecord {
  platform: number;
  encoding: number;
  language: number;
  nameId: number;
  value: string;
}

function decodeUtf16BE(b: Buffer): string {
  let s = '';
  for (let i = 0; i + 1 < b.length; i += 2) s += String.fromCharCode(b.readUInt16BE(i));
  return s;
}

/** Offsets of the fonts inside a file (several for .ttc collections). */
function fontOffsets(buf: Buffer): number[] {
  if (buf.length < 12) return [];
  if (buf.toString('ascii', 0, 4) === 'ttcf') {
    const n = buf.readUInt32BE(8);
    const out: number[] = [];
    for (let i = 0; i < Math.min(n, 64); i++) out.push(buf.readUInt32BE(12 + i * 4));
    return out;
  }
  const v = buf.readUInt32BE(0);
  if (v === 0x00010000 || buf.toString('ascii', 0, 4) === 'OTTO' || buf.toString('ascii', 0, 4) === 'true') return [0];
  return [];
}

export function findTable(buf: Buffer, fontOffset: number, tag: string): { offset: number; length: number; recordAt: number } | null {
  const numTables = buf.readUInt16BE(fontOffset + 4);
  for (let i = 0; i < numTables; i++) {
    const rec = fontOffset + 12 + i * 16;
    if (rec + 16 > buf.length) return null;
    if (buf.toString('ascii', rec, rec + 4) === tag) return { offset: buf.readUInt32BE(rec + 8), length: buf.readUInt32BE(rec + 12), recordAt: rec };
  }
  return null;
}

function readNames(buf: Buffer, fontOffset: number): NameRecord[] {
  const t = findTable(buf, fontOffset, 'name');
  if (!t || t.offset + 6 > buf.length) return [];
  const count = buf.readUInt16BE(t.offset + 2);
  const strings = t.offset + buf.readUInt16BE(t.offset + 4);
  const out: NameRecord[] = [];
  for (let i = 0; i < count; i++) {
    const r = t.offset + 6 + i * 12;
    if (r + 12 > buf.length) break;
    const platform = buf.readUInt16BE(r);
    const encoding = buf.readUInt16BE(r + 2);
    const language = buf.readUInt16BE(r + 4);
    const nameId = buf.readUInt16BE(r + 6);
    const len = buf.readUInt16BE(r + 8);
    const off = strings + buf.readUInt16BE(r + 10);
    if (off + len > buf.length) continue;
    const raw = buf.subarray(off, off + len);
    const value = platform === 0 || platform === 3 ? decodeUtf16BE(raw) : raw.toString('latin1');
    out.push({ platform, encoding, language, nameId, value: value.replace(/\0/g, '').trim() });
  }
  return out;
}

/** Best family name of one font: Windows English legacy family (ID 1), then any family. */
function pickFamily(names: NameRecord[]): string | null {
  const score = (n: NameRecord) => (n.platform === 3 ? 4 : n.platform === 0 ? 2 : 1) + (n.language === 0x409 || n.language === 0 ? 4 : 0);
  for (const id of [1, 16]) {
    const c = names.filter((n) => n.nameId === id && n.value).sort((a, b) => score(b) - score(a));
    if (c.length) return c[0].value;
  }
  return null;
}

/** Family names contained in a font file buffer (empty if it is not a valid TrueType/OpenType font). */
export function parseFontFamilies(buf: Buffer): string[] {
  try {
    const fams = new Set<string>();
    for (const off of fontOffsets(buf)) {
      const f = pickFamily(readNames(buf, off));
      if (f) fams.add(f);
    }
    return [...fams];
  } catch {
    return [];
  }
}

export async function readFontFamilies(file: string): Promise<string[]> {
  try {
    return parseFontFamilies(await fs.readFile(file));
  } catch {
    return [];
  }
}

export function systemFontDirs(): string[] {
  const dirs: string[] = [];
  if (process.platform === 'win32') {
    dirs.push(path.join(process.env.WINDIR ?? 'C:\\Windows', 'Fonts'));
    if (process.env.LOCALAPPDATA) dirs.push(path.join(process.env.LOCALAPPDATA, 'Microsoft', 'Windows', 'Fonts'));
  } else if (process.platform === 'darwin') {
    dirs.push('/System/Library/Fonts', '/Library/Fonts', path.join(process.env.HOME ?? '', 'Library/Fonts'));
  } else {
    dirs.push('/usr/share/fonts', '/usr/local/share/fonts', path.join(process.env.HOME ?? '', '.fonts'));
  }
  return dirs;
}

let systemCache: SystemFont[] | null = null;

/** All installed font families (scanned once per session; ~300 files on a typical Windows PC). */
export async function listSystemFonts(dirs = systemFontDirs()): Promise<SystemFont[]> {
  if (systemCache) return systemCache;
  const families = new Map<string, SystemFont>();
  const walk = async (dir: string, depth: number) => {
    let entries: import('node:fs').Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory() && depth < 3) await walk(p, depth + 1);
      else if (e.isFile() && SCAN_EXT.has(path.extname(e.name).toLowerCase())) {
        for (const family of await readFontFamilies(p)) {
          if (!families.has(family.toLowerCase())) families.set(family.toLowerCase(), { family });
        }
      }
    }
  };
  for (const d of dirs) await walk(d, 0);
  systemCache = [...families.values()].sort((a, b) => a.family.localeCompare(b.family));
  return systemCache;
}

// ---------------- custom (imported) fonts, stored in the app's user data ----------------

export class FontStore {
  constructor(private readonly dir: string) {}

  private index() {
    return path.join(this.dir, 'index.json');
  }

  async list(): Promise<CustomFont[]> {
    try {
      const all = JSON.parse(await fs.readFile(this.index(), 'utf8')) as CustomFont[];
      const ok = await Promise.all(all.map(async (f) => ((await exists(path.join(this.dir, f.file))) ? f : null)));
      return ok.filter((f): f is CustomFont => !!f);
    } catch {
      return [];
    }
  }

  /** Copies a .ttf/.otf into TSTVN's font folder (no Windows installation needed). */
  async import(source: string): Promise<CustomFont> {
    const ext = path.extname(source).toLowerCase().slice(1);
    if (!FONT_EXT.includes(ext)) throw new Error('Only .ttf and .otf font files are supported.');
    const families = await readFontFamilies(source);
    if (!families.length) throw new Error('This file is not a valid font.');
    const list = await this.list();
    const existing = list.find((f) => f.family.toLowerCase() === families[0].toLowerCase());
    if (existing) return existing;
    const id = newId('f');
    const font: CustomFont = { id, family: families[0], file: `${id}.${ext}`, originalName: path.basename(source) };
    await fs.mkdir(this.dir, { recursive: true });
    await fs.copyFile(source, path.join(this.dir, font.file));
    await writeFileAtomic(this.index(), JSON.stringify([...list, font], null, 1));
    return font;
  }

  async remove(id: string): Promise<CustomFont[]> {
    const list = await this.list();
    const f = list.find((x) => x.id === id);
    const next = list.filter((x) => x.id !== id);
    await writeFileAtomic(this.index(), JSON.stringify(next, null, 1));
    if (f) await fs.rm(path.join(this.dir, f.file), { force: true });
    return next;
  }

  filePath(file: string): string {
    return resolveInside(this.dir, path.basename(file));
  }

  /** Copies a custom font into a project (fonts/…) so the game can ship it. Returns the project-relative path. */
  async embedInProject(projectDir: string, id: string): Promise<{ family: string; file: string }> {
    const f = (await this.list()).find((x) => x.id === id);
    if (!f) throw new Error('Font not found.');
    const rel = `fonts/${f.file}`;
    const dest = resolveInside(projectDir, rel);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    if (!(await exists(dest))) await fs.copyFile(path.join(this.dir, f.file), dest);
    return { family: f.family, file: toPosix(rel) };
  }
}
