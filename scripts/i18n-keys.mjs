// Collects every translatable English key used by the editor/shared code.
// Used by tests/i18n.test.ts (all keys must have a Thai translation) and for maintenance:
//   node scripts/i18n-keys.mjs --missing   → prints keys without a Thai translation
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIRS = ['src/editor', 'src/shared'];
const SKIP = new Set(['i18n.ts', 'i18n-th.ts', 'api.ts', 'types.ts']);

/** Keys that come from data rather than literals in the code. */
const EXTRA = ['Modern', 'Minimal', 'Classic', 'Dark', 'Fantasy', 'Soft', 'RPG', 'Romance', 'Horror', 'custom', 'if true', 'otherwise', 'next', 'if match'];

function unquote(q, body) {
  if (q === '"') return JSON.parse(`"${body}"`);
  return body.replace(/\\'/g, "'").replace(/\\\\/g, '\\').replace(/\\n/g, '\n');
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name) && !SKIP.has(e.name)) out.push(p);
  }
  return out;
}

export function collectKeys() {
  const keys = new Set(EXTRA);
  const call = /(?<![\w.$])(?:t|tr)\((["'])((?:\\.|(?!\1)[^\\])*)\1/g;
  const prop = /\b(label|tip|description|placeholder): (["'])((?:\\.|(?!\2)[^\\])*)\2/g;
  for (const d of DIRS) {
    for (const f of walk(path.join(ROOT, d))) {
      const src = fs.readFileSync(f, 'utf8');
      for (const m of src.matchAll(call)) keys.add(unquote(m[1], m[2]));
      for (const m of src.matchAll(prop)) {
        const v = unquote(m[2], m[3]);
        if (/[A-Za-z]{2,}/.test(v) && !/^[a-z_]+$/.test(v)) keys.add(v);
      }
    }
  }
  return [...keys].filter((k) => /[A-Za-z]{2,}/.test(k)).sort();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const keys = collectKeys();
  if (process.argv.includes('--missing')) {
    const th = fs.readFileSync(path.join(ROOT, 'src/shared/i18n-th.ts'), 'utf8');
    const missing = keys.filter((k) => !th.includes(JSON.stringify(k) + ':'));
    console.log(JSON.stringify(missing, null, 1));
    console.error(`${missing.length} missing of ${keys.length}`);
  } else console.log(JSON.stringify(keys, null, 1));
}
