// Packs a plugin folder into <id>-<version>.tstplugin (a zip) next to it.
//   node scripts/pack-plugin.mjs plugins/tstvn-sample-pack [outDir]
import fs from 'node:fs';
import path from 'node:path';
import { zipSync } from 'fflate';

const dir = path.resolve(process.argv[2] ?? '');
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'plugin.json'), 'utf8'));
const files = {};
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else files[path.relative(dir, p).split(path.sep).join('/')] = new Uint8Array(fs.readFileSync(p));
  }
};
walk(dir);
const out = path.join(path.resolve(process.argv[3] ?? path.dirname(dir)), `${manifest.id}-${manifest.version}.tstplugin`);
fs.writeFileSync(out, zipSync(files, { level: 6 }));
console.log(out);
