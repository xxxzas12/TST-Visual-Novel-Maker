import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import type { Thumbnailer } from '../src/main/importer';
import { readImageSize } from '../src/main/imageSize';
import { Engine, type RuntimeHost } from '../src/runtime/core/engine';
import type { GameData } from '../src/shared/types';

export async function tempDir(prefix = 'tstvn-test-'): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

/** Node-only thumbnailer for tests: copies the image and reports header dimensions. */
export const testThumbnailer: Thumbnailer = async (src, dest) => {
  const size = await readImageSize(src);
  if (!size) return null;
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(src, dest);
  return size;
};

export interface Recorded {
  calls: { method: string; arg?: unknown }[];
  dialogues: string[];
  choicePicks: number[];
  ended: string | null;
  errors: string[];
}

/**
 * A scripted RuntimeHost: dialogues advance immediately, choices pick from the
 * queue. `done` resolves when the game ends or errors.
 */
export function scriptedHost(picks: number[] = []) {
  const rec: Recorded = { calls: [], dialogues: [], choicePicks: [...picks], ended: null, errors: [] };
  let resolveDone!: () => void;
  const done = new Promise<void>((r) => (resolveDone = r));
  const host: RuntimeHost = {
    render: async (state, hints) => void rec.calls.push({ method: 'render', arg: { state: structuredClone(state), hints } }),
    dialogue: async (d) => {
      rec.calls.push({ method: 'dialogue', arg: d });
      rec.dialogues.push(d.speakerName ? `${d.speakerName}: ${d.text}` : d.text);
    },
    choice: async (c) => {
      rec.calls.push({ method: 'choice', arg: c });
      return rec.choicePicks.shift() ?? 0;
    },
    waitClick: async () => void rec.calls.push({ method: 'waitClick' }),
    delay: async (s) => void rec.calls.push({ method: 'delay', arg: s }),
    audio: (cmd) => void rec.calls.push({ method: 'audio', arg: cmd }),
    animate: async (cmd) => void rec.calls.push({ method: 'animate', arg: cmd }),
    screenEffect: async (e) => void rec.calls.push({ method: 'screenEffect', arg: e }),
    video: async (id) => void rec.calls.push({ method: 'video', arg: id }),
    saveMenu: async (m) => void rec.calls.push({ method: 'saveMenu', arg: m }),
    loadMenu: async () => void rec.calls.push({ method: 'loadMenu' }),
    toTitle: () => {
      rec.calls.push({ method: 'toTitle' });
      resolveDone();
    },
    end: async (m) => {
      rec.ended = m;
      resolveDone();
    },
    error: (m) => {
      rec.errors.push(m);
      resolveDone();
    },
  };
  return { host, rec, done };
}

export async function playThrough(game: GameData, picks: number[] = [], sceneId?: string, index = 0) {
  const { host, rec, done } = scriptedHost(picks);
  const engine = new Engine(game, host);
  await engine.start(sceneId, index);
  await Promise.race([done, new Promise((_, rej) => setTimeout(() => rej(new Error('game did not finish')), 5000))]);
  return { rec, engine };
}
