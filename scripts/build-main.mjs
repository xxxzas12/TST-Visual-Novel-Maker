// Bundles the Electron main + preload scripts and copies the exported-game shell.
import { build } from 'esbuild';
import { cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const common = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  external: ['electron'],
  sourcemap: 'linked',
  logLevel: 'warning',
};

await build({ ...common, entryPoints: [path.join(root, 'src/main/main.ts')], outfile: path.join(root, 'dist/main/main.cjs') });
await build({ ...common, entryPoints: [path.join(root, 'src/preload/preload.ts')], outfile: path.join(root, 'dist/main/preload.cjs') });

await mkdir(path.join(root, 'dist/game-shell'), { recursive: true });
await cp(path.join(root, 'src/game-shell'), path.join(root, 'dist/game-shell'), { recursive: true });
console.log('main, preload and game shell built');
