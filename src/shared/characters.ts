import type { Asset, Character, Expression } from './types';
import { newId } from './ids';

const CHARACTER_FOLDERS = ['char', 'chars', 'chara', 'character', 'characters', 'sprite', 'sprites', 'standing', 'tachie', 'ตัวละคร'];

const PALETTE = ['#ff7aa2', '#7ab8ff', '#ffc857', '#7bd88f', '#c792ea', '#ff9e64', '#5ad4e6', '#f07178'];

export function titleCase(s: string): string {
  return s
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function baseName(path: string): string {
  const f = path.split('/').pop() ?? path;
  return f.replace(/\.[^.]+$/, '');
}

export interface DetectedCharacter {
  name: string;
  folder: string;
  expressions: { name: string; assetId: string }[];
}

/**
 * Detect characters from asset paths.
 *  - assets/.../Characters/Alice/happy.png -> Alice: Happy
 *  - assets/.../Characters/alice_happy.png -> Alice: Happy
 *  - assets/.../Characters/Alice/Casual/happy.png -> "Alice": "Casual Happy"
 */
export function detectCharacters(assets: Asset[]): DetectedCharacter[] {
  const byKey = new Map<string, DetectedCharacter>();
  for (const a of assets) {
    if (a.kind !== 'image') continue;
    if (a.type !== 'character' && a.type !== 'portrait') continue;
    const parts = a.path.split('/');
    const folderIdx = parts.findIndex((p, i) => i < parts.length - 1 && CHARACTER_FOLDERS.includes(p.toLowerCase()));
    if (folderIdx < 0) continue;
    const rest = parts.slice(folderIdx + 1);
    let charName: string;
    let exprName: string;
    let folder: string;
    if (rest.length >= 2) {
      charName = rest[0];
      exprName = [...rest.slice(1, -1), baseName(rest[rest.length - 1])].join(' ');
      folder = parts.slice(0, folderIdx + 2).join('/');
    } else {
      const tokens = baseName(rest[0]).split(/[_\-\s]+/).filter(Boolean);
      if (tokens.length === 0) continue;
      charName = tokens[0];
      exprName = tokens.length > 1 ? tokens.slice(1).join(' ') : 'normal';
      folder = parts.slice(0, folderIdx + 1).join('/');
    }
    const key = charName.toLowerCase();
    let c = byKey.get(key);
    if (!c) {
      c = { name: titleCase(charName), folder, expressions: [] };
      byKey.set(key, c);
    }
    c.expressions.push({ name: titleCase(exprName), assetId: a.id });
  }
  for (const c of byKey.values()) {
    // "Normal"/"Default" first, otherwise alphabetical.
    c.expressions.sort((x, y) => rank(x.name) - rank(y.name) || x.name.localeCompare(y.name));
  }
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * "Create character from folder": images directly inside `folder` become one
 * character named after the folder; each subfolder with images becomes its own character.
 */
export function charactersFromFolder(assets: Asset[], folder: string): DetectedCharacter[] {
  const prefix = folder.endsWith('/') ? folder : `${folder}/`;
  const groups = new Map<string, DetectedCharacter>();
  for (const a of assets) {
    if (a.kind !== 'image' || !a.path.startsWith(prefix)) continue;
    const rest = a.path.slice(prefix.length).split('/');
    const charFolder = rest.length === 1 ? folder : `${prefix}${rest[0]}`;
    const name = titleCase((rest.length === 1 ? folder.split('/').pop() : rest[0]) ?? 'Character');
    const exprName = titleCase([...rest.slice(rest.length === 1 ? 0 : 1, -1), baseName(rest[rest.length - 1])].join(' '));
    let g = groups.get(charFolder);
    if (!g) {
      g = { name, folder: charFolder, expressions: [] };
      groups.set(charFolder, g);
    }
    g.expressions.push({ name: exprName, assetId: a.id });
  }
  for (const c of groups.values()) c.expressions.sort((x, y) => rank(x.name) - rank(y.name) || x.name.localeCompare(y.name));
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function rank(name: string): number {
  const n = name.toLowerCase();
  return n === 'normal' || n === 'default' || n === 'neutral' ? 0 : 1;
}

/**
 * Merge detected characters into existing ones (matched by name, case-insensitive).
 * Returns the new characters array and how many characters/expressions were added.
 */
export function mergeDetectedCharacters(
  existing: Character[],
  detected: DetectedCharacter[],
): { characters: Character[]; createdCharacters: number; addedExpressions: number } {
  const result = existing.map((c) => ({ ...c, expressions: [...c.expressions] }));
  let createdCharacters = 0;
  let addedExpressions = 0;
  for (const d of detected) {
    let c = result.find((x) => x.name.toLowerCase() === d.name.toLowerCase());
    if (!c) {
      c = {
        id: newId('c'),
        name: d.name,
        displayName: d.name,
        color: PALETTE[(result.length + createdCharacters) % PALETTE.length],
        expressions: [],
        sourceFolder: d.folder,
      };
      result.push(c);
      createdCharacters++;
    }
    for (const e of d.expressions) {
      if (c.expressions.some((x) => x.assetId === e.assetId)) continue;
      let name = e.name;
      if (c.expressions.some((x) => x.name.toLowerCase() === name.toLowerCase())) {
        let n = 2;
        while (c.expressions.some((x) => x.name.toLowerCase() === `${name} ${n}`.toLowerCase())) n++;
        name = `${name} ${n}`;
      }
      const expr: Expression = { id: newId('e'), name, assetId: e.assetId };
      c.expressions.push(expr);
      addedExpressions++;
    }
    if (!c.defaultExpressionId && c.expressions.length) c.defaultExpressionId = c.expressions[0].id;
  }
  return { characters: result, createdCharacters, addedExpressions };
}
