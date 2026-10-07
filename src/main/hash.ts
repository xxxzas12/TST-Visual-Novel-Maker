import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';

/** Streaming SHA-1 of a file (fast enough for thousands of assets, constant memory). */
export function hashFile(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = createHash('sha1');
    const s = createReadStream(file);
    s.on('data', (d) => h.update(d));
    s.on('error', reject);
    s.on('end', () => resolve(h.digest('hex')));
  });
}
