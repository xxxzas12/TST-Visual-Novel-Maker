// Custom application logo (TSTVN itself, not games): stored in the app's user data.
import path from 'node:path';
import fs from 'node:fs/promises';
import { exists } from './paths';

export const LOGO_EXTENSIONS = ['png', 'jpg', 'jpeg', 'ico'];
const MAX_BYTES = 10 * 1024 * 1024;

/** Decodes an image file; returns its PNG data URL (at most `max` px) or null if it is not an image. */
export type ImageLoader = (file: string, max: number) => Promise<string | null>;

export class LogoStore {
  constructor(
    private readonly dir: string,
    private readonly load: ImageLoader,
  ) {}

  private async current(): Promise<string | null> {
    for (const ext of LOGO_EXTENSIONS) {
      const f = path.join(this.dir, `logo.${ext}`);
      if (await exists(f)) return f;
    }
    return null;
  }

  /** Path of the custom logo file, if one is set. */
  file(): Promise<string | null> {
    return this.current();
  }

  /** Data URL of the custom logo (for the editor UI), or null when TSTVN uses its default logo. */
  async get(): Promise<string | null> {
    const f = await this.current();
    return f ? this.load(f, 256) : null;
  }

  /** Validates and stores a new logo; returns its data URL. */
  async set(source: string): Promise<string> {
    const ext = path.extname(source).slice(1).toLowerCase();
    if (!LOGO_EXTENSIONS.includes(ext)) throw new Error('Choose a PNG, JPG or ICO image.');
    const st = await fs.stat(source).catch(() => null);
    if (!st?.isFile()) throw new Error('The image file was not found.');
    if (st.size > MAX_BYTES) throw new Error('The image is too large (max 10 MB).');
    const url = await this.load(source, 256);
    if (!url) throw new Error('This file is not a readable image.');
    await this.reset();
    await fs.mkdir(this.dir, { recursive: true });
    await fs.copyFile(source, path.join(this.dir, `logo.${ext}`));
    return url;
  }

  /** Back to the default TSTVN logo. */
  async reset(): Promise<void> {
    for (const ext of LOGO_EXTENSIONS) await fs.rm(path.join(this.dir, `logo.${ext}`), { force: true });
  }
}
