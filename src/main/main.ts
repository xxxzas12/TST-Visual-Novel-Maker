import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, net, protocol, shell } from 'electron';
import type { Asset, Project, Theme } from '../shared/types';
import type { AppSettings, DuplicateDecision, ExportGameRequest, FileFilter, ImportPlan } from '../shared/api';
import { validateProject } from '../shared/validate';
import { createBackup, deleteBackup, listBackups, restoreBackup } from './backups';
import { pickFiles, pickFolder, saveFile } from './dialogs';
import { copyPaths, createFolder, expandFiles, exportFiles, listTree, movePaths, removePaths, renamePath, assetPath } from './fileops';
import { exportGame, type ExportEnv } from './gameExport';
import { hashFile } from './hash';
import { executeImport, scanImport, thumbPath } from './importer';
import { importPackage, exportPackage } from './packageIO';
import { exists, resolveInside, toPosix, uniquePath } from './paths';
import { createProject, discardRecovery, duplicateProject, openProject, saveProject, UserStore, writeRecovery } from './projectStore';
import { electronThumbnailer } from './thumbnails';
import { FontStore, listSystemFonts } from './fonts';
import { readImageSize } from './imageSize';
import { exportThemeFile, importThemeFile } from './themeIO';
import { LogoStore, type ImageLoader } from './branding';
import { PluginStore } from './plugins';
import { extOf } from '../shared/classify';
import { getLanguage, setLanguage } from '../shared/i18n';

if (process.env.TSTVN_USER_DATA) app.setPath('userData', process.env.TSTVN_USER_DATA);
const isE2E = process.env.TSTVN_E2E === '1';

protocol.registerSchemesAsPrivileged([
  { scheme: 'tstvn-asset', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true, bypassCSP: true } },
  { scheme: 'tstvn-font', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, bypassCSP: true } },
]);

let mainWindow: BrowserWindow | null = null;
/** Only files of the currently open project are served to the renderer. */
let currentProjectDir: string | null = null;
const store = new UserStore(app.getPath('userData'));
const fontStore = new FontStore(path.join(app.getPath('userData'), 'fonts'));

/** Decodes an image with Electron (PNG/JPG/ICO) into a PNG data URL no larger than `max` px. */
const loadImage: ImageLoader = async (file, max) => {
  const img = nativeImage.createFromPath(file);
  if (img.isEmpty()) return null;
  const { width, height } = img.getSize();
  const k = Math.min(1, max / Math.max(width, height));
  return (k < 1 ? img.resize({ width: Math.round(width * k), height: Math.round(height * k), quality: 'best' }) : img).toDataURL();
};
const pluginStore = new PluginStore(path.join(app.getPath('userData'), 'plugins'));
const logoStore = new LogoStore(path.join(app.getPath('userData'), 'branding'), loadImage);

/** TSTVN's own window/taskbar icon: the custom application logo, or the default icon. */
async function applyWindowIcon() {
  if (!mainWindow) return;
  const file = await logoStore.file();
  const img = file ? nativeImage.createFromPath(file) : null;
  if (img && !img.isEmpty()) mainWindow.setIcon(img);
  else mainWindow.setIcon(await app.getFileIcon(process.execPath, { size: 'large' }));
}

const DEFAULT_SETTINGS: AppSettings = { onboardingDone: false, autosaveMinutes: 2 };

function appRoot() {
  return app.getAppPath();
}

function exportEnv(): ExportEnv {
  const packaged = app.isPackaged;
  return {
    runtimeDir: packaged ? path.join(process.resourcesPath, 'runtime') : path.join(appRoot(), 'dist', 'runtime'),
    shellDir: packaged ? path.join(process.resourcesPath, 'game-shell') : path.join(appRoot(), 'dist', 'game-shell'),
    electronDir: path.dirname(process.execPath),
    electronExe: path.basename(process.execPath),
    excludeResources: ['app', 'app.asar', 'app.asar.unpacked', 'default_app.asar', 'runtime', 'game-shell'],
  };
}

function setProject(dir: string) {
  currentProjectDir = path.resolve(dir);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    title: 'TSTVN',
    backgroundColor: '#14161f',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    void logoStore.file().then((f) => {
      if (f) void applyWindowIcon();
    });
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (e, url) => {
    const allowed = process.env.TSTVN_DEV_URL ? url.startsWith(process.env.TSTVN_DEV_URL) : url.startsWith('file:');
    if (!allowed) e.preventDefault();
  });
  // Unsaved changes: the renderer blocks unload while dirty; ask the user here.
  mainWindow.webContents.on('will-prevent-unload', (event) => {
    if (isE2E) {
      event.preventDefault();
      return;
    }
    const choice = dialog.showMessageBoxSync(mainWindow!, {
      type: 'question',
      buttons: ['Leave without saving', 'Stay'],
      defaultId: 1,
      cancelId: 1,
      title: 'Unsaved changes',
      message: 'You have unsaved changes. Your work is kept in a recovery file, but it is safer to save first.',
    });
    if (choice === 0) event.preventDefault();
  });
  if (process.env.TSTVN_DEV_URL) void mainWindow.loadURL(process.env.TSTVN_DEV_URL);
  else void mainWindow.loadFile(path.join(appRoot(), 'dist', 'editor', 'index.html'));
  mainWindow.on('closed', () => (mainWindow = null));
}

function buildMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    { label: 'File', submenu: [{ role: 'quit' }] },
    { label: 'Edit', submenu: [{ role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    { label: 'Help', submenu: [{ label: 'TSTVN on disk', click: () => void shell.openPath(appRoot()) }] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/** Registers an IPC handler (renderer -> main request/response). */
function handle(channel: string, fn: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => unknown) {
  ipcMain.handle(channel, async (event, ...args) => fn(event, ...args));
}

function registerIpc() {
  // ---------- app ----------
  handle('app:info', () => ({
    version: app.getVersion(),
    platform: process.platform,
    defaultProjectsDir: path.join(app.getPath('documents'), 'TSTVN Projects'),
    isDev: !app.isPackaged,
    isE2E,
  }));
  handle('app:getSettings', async () => ({ ...DEFAULT_SETTINGS, language: getLanguage(), ...(await store.readJson<Partial<AppSettings>>('settings.json', {})) }));
  // Read-modify-write of settings.json is serialized: overlapping calls (e.g. a startup write
  // while the user picks a language) must not overwrite each other with stale data.
  let settingsQueue: Promise<unknown> = Promise.resolve();
  handle('app:setSettings', (_e, patch: Partial<AppSettings>) => {
    // Apply the language at once, before any disk I/O: requests are handled in the order they arrive,
    // so a "create project" sent right after switching language always sees the new language.
    if (patch.language) setLanguage(patch.language);
    const job = settingsQueue.then(async () => {
      const next = { ...DEFAULT_SETTINGS, ...(await store.readJson<Partial<AppSettings>>('settings.json', {})), ...patch };
      await store.writeJson('settings.json', next);
      return next;
    });
    settingsQueue = job.catch(() => undefined);
    return job;
  });
  handle('app:logo', () => logoStore.get());
  handle('app:setLogo', async (_e, file: string) => {
    const url = await logoStore.set(file);
    await applyWindowIcon();
    return url;
  });
  handle('app:resetLogo', async () => {
    await logoStore.reset();
    await applyWindowIcon();
  });
  handle('app:recent', () => store.recent());
  handle('app:removeRecent', (_e, p: string) => store.removeRecent(p));
  handle('app:setTitle', (_e, title: string) => mainWindow?.setTitle(title));

  // ---------- dialogs ----------
  handle('dialog:pickFolder', (_e, title: string, defaultPath?: string) => pickFolder(mainWindow, title, defaultPath));
  handle('dialog:pickFiles', (_e, title: string, filters: FileFilter[], multi: boolean) => pickFiles(mainWindow, title, filters, multi));
  handle('dialog:saveFile', (_e, title: string, defaultPath: string, filters: FileFilter[]) => saveFile(mainWindow, title, defaultPath, filters));

  // ---------- project ----------
  handle('project:create', async (_e, parentDir: string, name: string, template: string) => {
    await fs.mkdir(parentDir, { recursive: true });
    const userTemplate = template.startsWith('user:') ? await store.loadTemplate(template.slice(5)) : undefined;
    const r = await createProject(parentDir, name, template, userTemplate);
    setProject(r.dir);
    await store.addRecent(r.dir, r.project.name);
    return r;
  });
  handle('project:duplicate', async (_e, dir: string, name: string) => {
    const r = await duplicateProject(dir, name);
    setProject(r.dir);
    await store.addRecent(r.dir, r.project.name);
    return r;
  });
  handle('project:open', async (_e, dir: string) => {
    const r = await openProject(dir);
    setProject(r.dir);
    await store.addRecent(r.dir, r.project.name);
    return r;
  });
  handle('project:save', (_e, dir: string, project: Project) => saveProject(dir, project));
  handle('project:writeRecovery', (_e, dir: string, project: Project) => writeRecovery(dir, project));
  handle('project:discardRecovery', (_e, dir: string) => discardRecovery(dir));
  handle('project:fileExists', (_e, dir: string, rels: string[]) =>
    rels.map((r) => {
      try {
        return existsSync(resolveInside(dir, r));
      } catch {
        return false;
      }
    }),
  );
  handle('project:validate', (_e, dir: string, project: Project) =>
    validateProject(project, (rel) => {
      try {
        return existsSync(resolveInside(dir, rel));
      } catch {
        return false;
      }
    }),
  );

  // ---------- assets / file manager ----------
  handle('assets:scan', (_e, dir: string, sources: string[], existing: Asset[]) => scanImport(dir, sources, existing));
  handle('assets:execute', (_e, dir: string, plan: ImportPlan, decisions: Record<string, DuplicateDecision>, existing: Asset[]) =>
    executeImport(dir, plan, decisions, existing, electronThumbnailer),
  );
  handle('assets:list', (_e, dir: string) => listTree(dir));
  handle('assets:createFolder', (_e, dir: string, rel: string) => createFolder(dir, rel));
  handle('assets:rename', (_e, dir: string, rel: string, name: string) => renamePath(dir, rel, name));
  handle('assets:move', (_e, dir: string, rels: string[], dest: string) => movePaths(dir, rels, dest));
  handle('assets:copy', (_e, dir: string, rels: string[], dest: string) => copyPaths(dir, rels, dest));
  handle('assets:remove', (_e, dir: string, rels: string[], backupId: string) => removePaths(dir, rels, backupId));
  handle('assets:register', async (_e, dir: string, rels: string[]) => {
    const files = await expandFiles(dir, rels);
    const plan = await scanImport(dir, files.map((r) => resolveInside(dir, r)), []);
    const decisions = Object.fromEntries(plan.items.map((i) => [i.id, 'keep' as DuplicateDecision]));
    const r = await executeImport(dir, plan, decisions, [], electronThumbnailer);
    return r.added;
  });
  handle('assets:replace', async (_e, dir: string, rel: string, source: string, assetId: string) => {
    const abs = assetPath(dir, rel);
    const newExt = extOf(source);
    let target = abs;
    if (newExt && newExt !== extOf(abs)) {
      target = await uniquePath(path.join(path.dirname(abs), `${path.basename(abs, path.extname(abs))}.${newExt}`));
    }
    await fs.copyFile(source, target);
    if (target !== abs && (await exists(abs))) await fs.rm(abs, { force: true });
    const dims = await electronThumbnailer(target, thumbPath(dir, assetId)).catch(() => null);
    const st = await fs.stat(target);
    const fallbackDims = dims ?? (await readImageSize(target));
    return {
      path: toPosix(path.relative(dir, target)),
      replaced: { assetId, hash: await hashFile(target), size: st.size, width: fallbackDims?.width, height: fallbackDims?.height, hasThumb: !!dims },
    };
  });
  handle('assets:exportFiles', (_e, dir: string, rels: string[], dest: string) => exportFiles(dir, rels, dest));
  handle('assets:reveal', (_e, dir: string, rel: string) => {
    const abs = resolveInside(dir, rel);
    if (!existsSync(abs)) return void shell.openPath(path.dirname(abs));
    if (statSync(abs).isDirectory()) void shell.openPath(abs);
    else shell.showItemInFolder(abs);
  });
  handle('assets:regenerateThumb', async (_e, dir: string, rel: string, assetId: string) => !!(await electronThumbnailer(resolveInside(dir, rel), thumbPath(dir, assetId)).catch(() => null)));

  // ---------- backups ----------
  handle('backups:create', (_e, dir: string, project: Project, reason: string) => createBackup(dir, project, reason));
  handle('backups:list', (_e, dir: string) => listBackups(dir));
  handle('backups:restore', async (_e, dir: string, id: string) => {
    const current = await openProject(dir).then(
      (r) => r.project,
      () => null,
    );
    return restoreBackup(dir, id, current);
  });
  handle('backups:remove', (_e, dir: string, id: string) => deleteBackup(dir, id));

  // ---------- packages ----------
  handle('pkg:export', (_e, dir: string, project: Project, file: string) => exportPackage(dir, project, file));
  handle('pkg:import', async (_e, file: string, parentDir: string) => {
    await fs.mkdir(parentDir, { recursive: true });
    const dir = await importPackage(file, parentDir);
    const r = await openProject(dir);
    setProject(r.dir);
    await store.addRecent(r.dir, r.project.name);
    return r;
  });

  // ---------- user templates ----------
  // ---------- fonts ----------
  handle('fonts:system', () => listSystemFonts());
  handle('fonts:custom', () => fontStore.list());
  handle('fonts:import', (_e, file: string) => fontStore.import(file));
  handle('fonts:remove', (_e, id: string) => fontStore.remove(id));
  handle('fonts:embed', (_e, dir: string, id: string) => fontStore.embedInProject(dir, id));

  // ---------- plugins ----------
  handle('plugins:list', () => pluginStore.list());
  handle('plugins:install', (_e, source: string) => pluginStore.install(source));
  handle('plugins:remove', (_e, id: string) => pluginStore.remove(id));
  handle('plugins:setEnabled', (_e, id: string, enabled: boolean) => pluginStore.setEnabled(id, enabled));
  handle('plugins:contributions', () => pluginStore.contributions());
  handle('plugins:openFolder', async () => {
    await fs.mkdir(pluginStore.dir, { recursive: true });
    await shell.openPath(pluginStore.dir);
  });

  // ---------- game UI themes ----------
  handle('themes:export', (_e, dir: string, theme: Theme, assets: Asset[], file: string) => exportThemeFile(dir, theme, assets, file));
  handle('themes:import', (_e, dir: string, file: string, existing: Asset[]) => importThemeFile(dir, file, existing, electronThumbnailer));

  handle('templates:list', () => store.listTemplates());
  handle('templates:save', (_e, name: string, project: Project) => store.saveTemplate(name, project));
  handle('templates:remove', (_e, id: string) => store.removeTemplate(id));

  // ---------- game export ----------
  handle('game:export', (event, req: ExportGameRequest) =>
    exportGame({ ...req, env: exportEnv(), onProgress: (p) => event.sender.send('game:progress', p) }),
  );
  handle('game:run', async (_e, launchPath: string) => {
    if (launchPath.toLowerCase().endsWith('.exe')) {
      const env = { ...process.env };
      delete env.ELECTRON_RUN_AS_NODE;
      const child = spawn(launchPath, [], { detached: true, stdio: 'ignore', cwd: path.dirname(launchPath), env });
      child.unref();
    } else {
      const err = await shell.openPath(launchPath);
      if (err) throw new Error(err);
    }
  });
  handle('game:openPath', async (_e, p: string) => {
    const err = await shell.openPath(p);
    if (err) throw new Error(err);
  });
}

function registerFontProtocol() {
  // tstvn-font://f/<file> — fonts imported into TSTVN (not installed in Windows)
  protocol.handle('tstvn-font', async (request) => {
    try {
      const file = fontStore.filePath(decodeURIComponent(new URL(request.url).pathname.replace(/^\/+/, '')));
      if (!existsSync(file)) return new Response('Not found', { status: 404 });
      const res = await net.fetch(pathToFileURL(file).toString());
      const headers = new Headers(res.headers);
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Content-Type', file.toLowerCase().endsWith('.otf') ? 'font/otf' : 'font/ttf');
      return new Response(res.body, { status: res.status, headers });
    } catch {
      return new Response('Forbidden', { status: 403 });
    }
  });
}

function registerAssetProtocol() {
  // tstvn-asset://project/<project-relative path>
  protocol.handle('tstvn-asset', async (request) => {
    try {
      if (!currentProjectDir) return new Response('No project open', { status: 404 });
      const url = new URL(request.url);
      const rel = url.pathname
        .split('/')
        .filter(Boolean)
        .map((s) => decodeURIComponent(s))
        .join('/');
      const abs = resolveInside(currentProjectDir, rel);
      if (!existsSync(abs)) return new Response('Not found', { status: 404 });
      const res = await net.fetch(pathToFileURL(abs).toString());
      const headers = new Headers(res.headers);
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Cache-Control', 'no-cache');
      return new Response(res.body, { status: res.status, headers });
    } catch {
      return new Response('Forbidden', { status: 403 });
    }
  });
}

app.whenReady().then(async () => {
  const saved = await store.readJson<Partial<AppSettings>>('settings.json', {});
  // First run: follow the OS language (Thai → Thai, otherwise English).
  setLanguage(saved.language ?? (!isE2E && app.getLocale().toLowerCase().startsWith('th') ? 'th' : 'en'));
  registerAssetProtocol();
  registerFontProtocol();
  registerIpc();
  buildMenu();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
