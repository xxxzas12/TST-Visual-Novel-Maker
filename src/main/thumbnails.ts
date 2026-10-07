import fs from 'node:fs/promises';
import path from 'node:path';
import { nativeImage } from 'electron';
import type { Thumbnailer } from './importer';

const THUMB = 256;

/** Electron-native thumbnails (PNG keeps sprite transparency). */
export const electronThumbnailer: Thumbnailer = async (source, dest) => {
  let img = nativeImage.createFromPath(source);
  if (img.isEmpty()) {
    try {
      img = await nativeImage.createThumbnailFromPath(source, { width: THUMB, height: THUMB });
    } catch {
      return null;
    }
  }
  if (img.isEmpty()) return null;
  const size = img.getSize();
  const resized =
    size.width > THUMB || size.height > THUMB
      ? img.resize(size.width >= size.height ? { width: THUMB, quality: 'good' } : { height: THUMB, quality: 'good' })
      : img;
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, resized.toPNG());
  return size;
};
