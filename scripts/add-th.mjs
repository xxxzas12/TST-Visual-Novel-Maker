// Adds Thai translations to src/shared/i18n-th.ts from a JSON file { "English key": "ไทย" }.
// Only keys that are still missing are added; prints keys that remain untranslated.
//   node scripts/add-th.mjs translations.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectKeys } from './i18n-keys.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'src/shared/i18n-th.ts');
const add = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
let src = fs.readFileSync(FILE, 'utf8');
const has = (k) => src.includes(JSON.stringify(k) + ':');
const missing = collectKeys().filter((k) => !has(k));
const lines = missing.filter((k) => k in add).map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(add[k])},`);
const end = src.lastIndexOf('};');
src = src.slice(0, end) + (lines.length ? lines.join('\n') + '\n' : '') + src.slice(end);
fs.writeFileSync(FILE, src);
const left = missing.filter((k) => !(k in add));
console.log(`added ${lines.length}; still missing ${left.length}${left.length ? ': ' + JSON.stringify(left) : ''}`);
