// TSTVN exported game — desktop shell (Electron main process).
// Serves the game from the bundled www/ folder through a private app:// origin
// so saves (localStorage) persist and screenshots work.
'use strict';
const electron = require('electron');
const { app, BrowserWindow, Menu, ipcMain, net, protocol } = electron;
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const config = require('./game-config.json');
const WWW = path.join(__dirname, 'www');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

app.setName(config.title || 'Visual Novel');
let win = null;

function createWindow() {
  const borderless = config.displayMode === 'borderless';
  const display = electron.screen.getPrimaryDisplay();
  const work = display.workAreaSize;
  const width = Math.min(1280, Math.round(work.width * 0.9));
  const height = Math.round((width * (config.height || 1080)) / (config.width || 1920));
  win = new BrowserWindow({
    width: borderless ? display.bounds.width : width,
    height: borderless ? display.bounds.height : height,
    x: borderless ? display.bounds.x : undefined,
    y: borderless ? display.bounds.y : undefined,
    minWidth: 480,
    minHeight: 270,
    frame: !borderless,
    fullscreen: config.displayMode === 'fullscreen',
    title: config.title,
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('app://')) e.preventDefault();
  });
  win.loadURL('app://game/index.html');
}

app.whenReady().then(() => {
  protocol.handle('app', (request) => {
    const url = new URL(request.url);
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const file = path.resolve(WWW, rel);
    const check = path.relative(WWW, file);
    if (check.startsWith('..') || path.isAbsolute(check)) {
      return new Response('Forbidden', { status: 403 });
    }
    return net.fetch(pathToFileURL(file).toString());
  });
  Menu.setApplicationMenu(null);
  ipcMain.on('tstvn:quit', () => app.quit());
  ipcMain.on('tstvn:display', (_e, mode) => {
    if (!win) return;
    win.setFullScreen(mode === 'fullscreen');
  });
  createWindow();
});

app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.on('window-all-closed', () => app.quit());
