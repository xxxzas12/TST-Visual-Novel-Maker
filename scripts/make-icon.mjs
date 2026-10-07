// Generates build/icon.png (512×512): gradient rounded square with a speech bubble — the TSTVN app icon.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pngBuffer } from './media.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const S = 512;
const R = 110;

function insideRoundRect(x, y, x0, y0, x1, y1, r) {
  const cx = Math.max(x0 + r, Math.min(x, x1 - r));
  const cy = Math.max(y0 + r, Math.min(y, y1 - r));
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

const png = pngBuffer(S, S, (x, y) => {
  if (!insideRoundRect(x, y, 16, 16, S - 16, S - 16, R)) return [0, 0, 0, 0];
  const t = (x + y) / (2 * S);
  const bg = [Math.round(109 + (154 - 109) * t), Math.round(124 + (107 - 124) * t), 255];
  // Speech bubble with a tail.
  const bubble = insideRoundRect(x, y, 96, 120, 416, 340, 70);
  const tail = y >= 320 && y <= 410 && x >= 150 && x <= 250 && x - 150 <= (410 - y) * 1.1;
  if (bubble || tail) {
    // Three "dialogue lines" inside the bubble.
    for (const [ly, w] of [[180, 220], [230, 260], [280, 160]]) {
      if (y >= ly && y <= ly + 22 && x >= 146 && x <= 146 + w && insideRoundRect(x, y, 146, ly, 146 + w, ly + 22, 11)) return [...bg, 255];
    }
    return [255, 255, 255, 255];
  }
  return [...bg, 255];
});

await mkdir(path.join(root, 'build'), { recursive: true });
await writeFile(path.join(root, 'build', 'icon.png'), png);
console.log('build/icon.png written');
