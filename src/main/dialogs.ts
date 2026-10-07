import { BrowserWindow, dialog } from 'electron';
import type { FileFilter } from '../shared/api';

/**
 * Native dialogs. During automated E2E tests (TSTVN_E2E=1) the test runner
 * pre-queues answers on globalThis.__tstvnDialogQueue instead of clicking OS dialogs.
 */
declare global {
  var __tstvnDialogQueue: (string | string[] | null)[] | undefined;
}

const isE2E = process.env.TSTVN_E2E === '1';

function queued(): { hit: boolean; value: string | string[] | null } {
  if (!isE2E) return { hit: false, value: null };
  const q = globalThis.__tstvnDialogQueue ?? [];
  if (!q.length) return { hit: true, value: null };
  return { hit: true, value: q.shift() ?? null };
}

export async function pickFolder(win: BrowserWindow | null, title: string, defaultPath?: string): Promise<string | null> {
  const q = queued();
  if (q.hit) return typeof q.value === 'string' ? q.value : null;
  const opts: Electron.OpenDialogOptions = { title, defaultPath, properties: ['openDirectory', 'createDirectory'] };
  const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts);
  return r.canceled ? null : (r.filePaths[0] ?? null);
}

export async function pickFiles(win: BrowserWindow | null, title: string, filters: FileFilter[], multi: boolean): Promise<string[]> {
  const q = queued();
  if (q.hit) return Array.isArray(q.value) ? q.value : q.value ? [q.value] : [];
  const opts: Electron.OpenDialogOptions = { title, filters, properties: multi ? ['openFile', 'multiSelections'] : ['openFile'] };
  const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts);
  return r.canceled ? [] : r.filePaths;
}

export async function saveFile(win: BrowserWindow | null, title: string, defaultPath: string, filters: FileFilter[]): Promise<string | null> {
  const q = queued();
  if (q.hit) return typeof q.value === 'string' ? q.value : null;
  const opts: Electron.SaveDialogOptions = { title, defaultPath, filters };
  const r = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts);
  return r.canceled ? null : (r.filePath ?? null);
}
