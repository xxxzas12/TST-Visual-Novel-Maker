import path from 'node:path';
import fs from 'node:fs/promises';

export function toPosix(p: string): string {
  return p.split(path.sep).join('/');
}

/**
 * Resolves a project-relative path and guarantees it stays inside `root`.
 * Throws on path traversal attempts.
 */
export function resolveInside(root: string, rel: string): string {
  const base = path.resolve(root);
  const abs = path.resolve(base, rel);
  const relCheck = path.relative(base, abs);
  if (relCheck.startsWith('..') || path.isAbsolute(relCheck)) {
    throw new Error(`Path is outside the project: ${rel}`);
  }
  return abs;
}

export function isInside(root: string, abs: string): boolean {
  const r = path.relative(path.resolve(root), path.resolve(abs));
  return !!r && !r.startsWith('..') && !path.isAbsolute(r);
}

export async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** Returns a path that does not exist yet: "name.png", "name (2).png", ... */
export async function uniquePath(abs: string): Promise<string> {
  if (!(await exists(abs))) return abs;
  const dir = path.dirname(abs);
  const ext = path.extname(abs);
  const stem = path.basename(abs, ext).replace(/ \(\d+\)$/, '');
  for (let n = 2; n < 10000; n++) {
    const candidate = path.join(dir, `${stem} (${n})${ext}`);
    if (!(await exists(candidate))) return candidate;
  }
  throw new Error(`Could not find a free file name for ${abs}`);
}

/** Make a string safe for use as a file or folder name on all platforms. */
export function safeName(name: string, fallback = 'Untitled'): string {
  const cleaned = [...name]
    .filter((ch) => ch.charCodeAt(0) >= 32 && !'<>:"/\\|?*'.includes(ch))
    .join('')
    .replace(/[. ]+$/g, '')
    .trim();
  const reserved = /^(con|prn|aux|nul|com\d|lpt\d)$/i;
  if (!cleaned || reserved.test(cleaned)) return fallback;
  return cleaned.slice(0, 120);
}

/** Atomic write: write to a temp file then rename over the target. */
export async function writeFileAtomic(file: string, data: string | Uint8Array): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, data);
  await fs.rename(tmp, file);
}

/** Recursively list files under a directory (absolute paths). */
export async function walkFiles(dir: string, out: string[] = []): Promise<string[]> {
  let entries: import('node:fs').Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) await walkFiles(abs, out);
    else if (e.isFile()) out.push(abs);
  }
  return out;
}

/** Run async tasks with limited concurrency, preserving result order. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}
