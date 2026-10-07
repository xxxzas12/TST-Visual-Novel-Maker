// Generates real PNG / WAV files (no dependencies). Used by tests and `npm run samples`.
import { deflateSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** RGBA PNG. painter(x, y) -> [r, g, b, a] */
export function pngBuffer(width, height, painter) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  let o = 0;
  for (let y = 0; y < height; y++) {
    raw[o++] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = painter(x, y);
      raw[o++] = r;
      raw[o++] = g;
      raw[o++] = b;
      raw[o++] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** 16-bit mono PCM WAV with a soft sine tone. */
export function wavBuffer(seconds, freq, volume = 0.25) {
  const rate = 22050;
  const n = Math.round(seconds * rate);
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + n * 2, 4);
  b.write('WAVE', 8);
  b.write('fmt ', 12);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const env = Math.min(1, i / 400, (n - i) / 400);
    b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * freq * i) / rate) * 32767 * volume * env), 44 + i * 2);
  }
  return b;
}

function hex(c) {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function backgroundPainter(top, bottom, width, height) {
  const a = hex(top);
  const b = hex(bottom);
  return (x, y) => {
    const t = y / height;
    const hill = height * (0.72 + 0.06 * Math.sin((x / width) * Math.PI * 3));
    if (y > hill) return [Math.round(b[0] * 0.55), Math.round(b[1] * 0.55), Math.round(b[2] * 0.55), 255];
    return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t), 255];
  };
}

/** Simple standing character: head + body, with a mouth shape per expression. */
export function characterPainter(color, expression, width, height) {
  const [r, g, b] = hex(color);
  const cx = width / 2;
  const headY = height * 0.2;
  const headR = width * 0.22;
  return (x, y) => {
    const dx = x - cx;
    const dy = y - headY;
    const inHead = dx * dx + dy * dy < headR * headR;
    const bodyTop = headY + headR * 0.9;
    const bodyHalf = width * 0.18 + (y - bodyTop) * 0.25;
    const inBody = y > bodyTop && y < height * 0.98 && Math.abs(dx) < bodyHalf;
    if (inHead) {
      // eyes
      const ey = headY - headR * 0.15;
      for (const ex of [cx - headR * 0.4, cx + headR * 0.4]) {
        if ((x - ex) ** 2 + (y - ey) ** 2 < (headR * 0.1) ** 2) return [30, 30, 40, 255];
      }
      // mouth
      const my = headY + headR * 0.45;
      const mx = x - cx;
      const inMouthX = Math.abs(mx) < headR * 0.35;
      const curve = (mx / (headR * 0.35)) ** 2 * headR * 0.15;
      const mouth =
        expression === 'happy'
          ? inMouthX && Math.abs(y - (my + headR * 0.1 - curve)) < headR * 0.05
          : expression === 'sad'
            ? inMouthX && Math.abs(y - (my - headR * 0.05 + curve)) < headR * 0.05
            : expression === 'angry'
              ? inMouthX && Math.abs(y - my) < headR * 0.06
              : Math.abs(mx) < headR * 0.2 && Math.abs(y - my) < headR * 0.035;
      if (mouth) return [60, 20, 30, 255];
      return [255, 224, 196, 255];
    }
    if (inBody) return [r, g, b, 255];
    return [0, 0, 0, 0];
  };
}

/**
 * Writes a realistic asset folder:
 * Characters/<Name>/<expression>.png, Backgrounds, CG, Music, SFX, Voice,
 * plus an unknown image and an unsupported file.
 */
export async function makeSampleAssets(root, opts = {}) {
  const big = !!opts.big;
  const bgW = big ? 1920 : 1280;
  const bgH = big ? 1080 : 720;
  const chW = big ? 600 : 300;
  const chH = big ? 1000 : 500;
  const w = async (rel, data) => {
    const f = path.join(root, rel);
    await mkdir(path.dirname(f), { recursive: true });
    await writeFile(f, data);
  };
  for (const [name, color, exprs] of [
    ['Alice', '#e05a8a', ['normal', 'happy', 'sad', 'angry']],
    ['Bob', '#4a7bd0', ['normal', 'angry']],
  ]) {
    for (const e of exprs) await w(`Characters/${name}/${e}.png`, pngBuffer(chW, chH, characterPainter(color, e, chW, chH)));
  }
  await w('Backgrounds/classroom.png', pngBuffer(bgW, bgH, backgroundPainter('#9ad0f5', '#f2e3c6', bgW, bgH)));
  await w('Backgrounds/park.png', pngBuffer(bgW, bgH, backgroundPainter('#7fc8f8', '#86c06c', bgW, bgH)));
  await w('Backgrounds/night street.png', pngBuffer(bgW, bgH, backgroundPainter('#0b1638', '#3b3355', bgW, bgH)));
  await w('CG/confession.png', pngBuffer(bgW, bgH, backgroundPainter('#ffb7c5', '#ffe5ec', bgW, bgH)));
  await w('Music/title theme.wav', wavBuffer(big ? 4 : 1, 330, 0.12));
  await w('Music/daily life.wav', wavBuffer(big ? 4 : 1, 392, 0.12));
  await w('SFX/door.wav', wavBuffer(0.3, 180));
  await w('SFX/bell.wav', wavBuffer(0.4, 880));
  await w('Voice/alice_hello.wav', wavBuffer(0.6, 520));
  await w('Misc/mystery.png', pngBuffer(64, 64, () => [200, 120, 40, 255]));
  await w('notes.txt', Buffer.from('Sample assets for TSTVN.'));
  return root;
}
