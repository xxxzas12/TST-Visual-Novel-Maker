import { _electron as electron, type ElectronApplication, type Page, type Locator } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';

export const ROOT = path.resolve(__dirname, '..');
export const TMP = path.join(ROOT, '.e2e-tmp');

export async function freshTmp() {
  await fs.rm(TMP, { recursive: true, force: true });
  await fs.mkdir(TMP, { recursive: true });
}

/** Environment for launching Electron apps. ELECTRON_RUN_AS_NODE (set by e.g. VS Code) would turn Electron into plain Node. */
export function electronEnv(extra: Record<string, string> = {}): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && k !== 'ELECTRON_RUN_AS_NODE') env[k] = v;
  return { ...env, ...extra };
}

export async function launchEditor(): Promise<{ app: ElectronApplication; page: Page; errors: string[] }> {
  const app = await electron.launch({
    args: [ROOT],
    cwd: ROOT,
    env: electronEnv({ TSTVN_E2E: '1', TSTVN_USER_DATA: path.join(TMP, 'userdata') }),
  });
  const page = await app.firstWindow();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Autofill|DevTools|Electron Security Warning/.test(m.text())) errors.push(`console: ${m.text()} ${decodeURIComponent(m.location().url ?? '')}`);
  });
  await page.waitForLoadState('domcontentloaded');
  return { app, page, errors };
}

/** Pre-answer the next native file/folder dialogs (handled in src/main/dialogs.ts when TSTVN_E2E=1). */
export async function queueDialog(app: ElectronApplication, ...answers: (string | string[] | null)[]) {
  await app.evaluate((_electron, a) => {
    globalThis.__tstvnDialogQueue = [...(globalThis.__tstvnDialogQueue ?? []), ...a];
  }, answers);
}

/**
 * HTML5 drag & drop between two elements by dispatching real DragEvents with a
 * shared DataTransfer (what the editor's handlers consume).
 */
export async function dragAndDrop(page: Page, source: Locator, target: Locator, targetPos?: { x: number; y: number }) {
  const s = await source.elementHandle();
  const t = await target.elementHandle();
  if (!s || !t) throw new Error('drag source/target not found');
  await page.evaluate(
    ([src, dst, pos]) => {
      const dt = new DataTransfer();
      const r = (dst as HTMLElement).getBoundingClientRect();
      const x = r.left + (pos ? pos.x * r.width : r.width / 2);
      const y = r.top + (pos ? pos.y * r.height : r.height / 2);
      const fire = (el: Element, type: string, cx = x, cy = y) => el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt, clientX: cx, clientY: cy }));
      const sr = (src as HTMLElement).getBoundingClientRect();
      fire(src as Element, 'dragstart', sr.left + 5, sr.top + 5);
      fire(dst as Element, 'dragenter');
      fire(dst as Element, 'dragover');
      fire(dst as Element, 'drop');
      fire(src as Element, 'dragend');
    },
    [s, t, targetPos ?? null] as const,
  );
}
