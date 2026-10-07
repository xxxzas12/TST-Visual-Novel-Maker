import path from 'node:path';
import fs from 'node:fs/promises';
import { createReadStream, createWriteStream, mkdirSync } from 'node:fs';
import { Unzip, UnzipInflate, Zip, ZipDeflate, ZipPassThrough } from 'fflate';
import type { Project } from '../shared/types';
import { ASSETS_DIR, PROJECT_FILE, normalizeProject } from '../shared/project';
import { exists, resolveInside, safeName, uniquePath, walkFiles, toPosix } from './paths';

const MANIFEST = 'tstvn-package.json';

/**
 * Writes a .tstvn package (zip): manifest + project.json + assets/.
 * Media is stored uncompressed (already compressed formats), JSON is deflated.
 */
export async function exportPackage(dir: string, project: Project, file: string): Promise<{ files: number; bytes: number }> {
  const tmp = `${file}.partial`;
  const out = createWriteStream(tmp);
  let bytes = 0;
  let files = 0;
  const finished = new Promise<void>((resolve, reject) => {
    out.on('finish', () => resolve());
    out.on('error', reject);
  });
  let zipError: Error | null = null;
  const zip = new Zip((err, chunk, final) => {
    if (err) {
      zipError = err;
      out.destroy(err);
      return;
    }
    bytes += chunk.length;
    out.write(chunk);
    if (final) out.end();
  });

  const addText = (name: string, text: string) => {
    const e = new ZipDeflate(name, { level: 6 });
    zip.add(e);
    e.push(new TextEncoder().encode(text), true);
    files++;
  };
  addText(MANIFEST, JSON.stringify({ format: 'tstvn-package', version: 1, name: project.name, exportedAt: Date.now() }));
  addText(PROJECT_FILE, JSON.stringify(project));

  const assetFiles = [...(await walkFiles(path.join(dir, ASSETS_DIR))), ...(await walkFiles(path.join(dir, 'fonts')))];
  for (const abs of assetFiles) {
    const name = toPosix(path.relative(dir, abs));
    const e = new ZipPassThrough(name);
    zip.add(e);
    for await (const chunk of createReadStream(abs)) {
      e.push(new Uint8Array(chunk as Buffer));
    }
    e.push(new Uint8Array(0), true);
    files++;
  }
  zip.end();
  await finished;
  if (zipError) throw zipError;
  await fs.rm(file, { force: true });
  await fs.rename(tmp, file);
  return { files, bytes };
}

/** Extracts a .tstvn package into a new project folder inside parentDir. Returns the project folder. */
export async function importPackage(file: string, parentDir: string): Promise<string> {
  const staging = await uniquePath(path.join(parentDir, `.tstvn-import-${Date.now()}`));
  await fs.mkdir(staging, { recursive: true });
  const writes: Promise<void>[] = [];
  let failure: Error | null = null;
  const unzip = new Unzip((f) => {
    const name = f.name.replace(/\\/g, '/');
    if (name.endsWith('/')) return;
    let dest: string;
    try {
      dest = resolveInside(staging, name);
    } catch (e) {
      failure = e as Error;
      return;
    }
    mkdirSync(path.dirname(dest), { recursive: true });
    const ws = createWriteStream(dest);
    writes.push(
      new Promise<void>((resolve, reject) => {
        ws.on('finish', () => resolve());
        ws.on('error', reject);
      }),
    );
    f.ondata = (err, data, final) => {
      if (err) {
        failure = err;
        ws.destroy(err);
        return;
      }
      ws.write(data);
      if (final) ws.end();
    };
    f.start();
  });
  unzip.register(UnzipInflate);
  try {
    for await (const chunk of createReadStream(file)) unzip.push(new Uint8Array(chunk as Buffer));
    unzip.push(new Uint8Array(0), true);
    await Promise.all(writes);
    if (failure) throw failure;
    if (!(await exists(path.join(staging, MANIFEST))) || !(await exists(path.join(staging, PROJECT_FILE)))) {
      throw new Error('This file is not a valid TSTVN package.');
    }
    const project = normalizeProject(JSON.parse(await fs.readFile(path.join(staging, PROJECT_FILE), 'utf8')));
    await fs.rm(path.join(staging, MANIFEST), { force: true });
    const target = await uniquePath(path.join(parentDir, safeName(project.name, 'Imported Project')));
    await fs.rename(staging, target);
    return target;
  } catch (e) {
    await fs.rm(staging, { recursive: true, force: true });
    throw e;
  }
}
