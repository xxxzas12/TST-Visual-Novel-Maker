import fs from 'node:fs/promises';

/** Reads image dimensions from the file header (PNG, JPEG, GIF, WebP, BMP) without decoding. */
export async function readImageSize(file: string): Promise<{ width: number; height: number } | null> {
  let fh: fs.FileHandle | null = null;
  try {
    fh = await fs.open(file, 'r');
    const head = Buffer.alloc(64 * 1024);
    const { bytesRead } = await fh.read(head, 0, head.length, 0);
    return parseImageSize(head.subarray(0, bytesRead));
  } catch {
    return null;
  } finally {
    await fh?.close();
  }
}

export function parseImageSize(b: Buffer): { width: number; height: number } | null {
  if (b.length < 24) return null;
  // PNG
  if (b.readUInt32BE(0) === 0x89504e47 && b.toString('ascii', 12, 16) === 'IHDR') {
    return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  }
  // GIF
  if (b.toString('ascii', 0, 3) === 'GIF') {
    return { width: b.readUInt16LE(6), height: b.readUInt16LE(8) };
  }
  // BMP
  if (b.toString('ascii', 0, 2) === 'BM' && b.length >= 26) {
    return { width: Math.abs(b.readInt32LE(18)), height: Math.abs(b.readInt32LE(22)) };
  }
  // WebP
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = b.toString('ascii', 12, 16);
    if (chunk === 'VP8 ' && b.length >= 30) return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L' && b.length >= 25) {
      const bits = b.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (chunk === 'VP8X' && b.length >= 30) {
      return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
    }
    return null;
  }
  // JPEG: walk segments to the SOF marker
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = b[i + 1];
      const len = b.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
      }
      i += 2 + len;
    }
  }
  return null;
}
