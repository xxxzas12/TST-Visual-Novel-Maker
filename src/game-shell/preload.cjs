'use strict';
const { contextBridge, ipcRenderer } = require('electron');

// Minimal native bridge for the game runtime: quit and fullscreen only.
contextBridge.exposeInMainWorld('tstvnHost', {
  quit: () => ipcRenderer.send('tstvn:quit'),
  setDisplayMode: (mode) => ipcRenderer.send('tstvn:display', String(mode)),
  supportsBorderless: false,
});
