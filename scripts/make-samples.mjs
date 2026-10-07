// npm run samples  ->  creates ./samples/Assets with demo characters, backgrounds, music and sounds
import path from 'node:path';
import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { makeSampleAssets } from './media.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'samples', 'Assets');
await rm(out, { recursive: true, force: true });
await makeSampleAssets(out, { big: true });
console.log(`Sample assets written to ${out}`);
console.log('Drag this folder into TSTVN (Assets → Import) to try the importer.');
