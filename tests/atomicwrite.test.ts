// writeFileAtomic retries a rename blocked for a moment by another reader (Windows EPERM/EBUSY).
import { afterEach, describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import { writeFileAtomic } from '../src/main/paths';
import { tempDir } from './helpers';

afterEach(() => vi.restoreAllMocks());

const err = (code: string) => Object.assign(new Error(code), { code });

describe('writeFileAtomic', () => {
  it('retries transient locks and then writes', async () => {
    const dir = await tempDir('tstvn-atomic-');
    const file = path.join(dir, 'settings.json');
    const real = fs.rename.bind(fs);
    let calls = 0;
    vi.spyOn(fs, 'rename').mockImplementation(async (a, b) => {
      if (++calls <= 2) throw err('EPERM');
      return real(a, b);
    });
    await writeFileAtomic(file, '{"ok":true}');
    expect(calls).toBe(3);
    expect(await fs.readFile(file, 'utf8')).toBe('{"ok":true}');
    expect((await fs.readdir(dir)).filter((f) => f.endsWith('.tmp'))).toEqual([]);
  });

  it('fails on real errors without leaving temp files behind', async () => {
    const dir = await tempDir('tstvn-atomic-');
    vi.spyOn(fs, 'rename').mockRejectedValue(err('ENOSPC'));
    await expect(writeFileAtomic(path.join(dir, 'x.json'), 'x')).rejects.toThrow('ENOSPC');
    expect(await fs.readdir(dir)).toEqual([]);
  });

  it('gives up after a few attempts if the file stays locked', async () => {
    const dir = await tempDir('tstvn-atomic-');
    const spy = vi.spyOn(fs, 'rename').mockRejectedValue(err('EBUSY'));
    await expect(writeFileAtomic(path.join(dir, 'x.json'), 'x', 2)).rejects.toThrow('EBUSY');
    expect(spy).toHaveBeenCalledTimes(3);
    expect(await fs.readdir(dir)).toEqual([]);
  });
});
