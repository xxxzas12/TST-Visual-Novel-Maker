import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { ExportProgress, TstvnApi } from '../shared/api';

const call =
  (channel: string) =>
  (...args: unknown[]) =>
    ipcRenderer.invoke(channel, ...args);

const api: TstvnApi = {
  app: {
    info: call('app:info') as TstvnApi['app']['info'],
    getSettings: call('app:getSettings') as TstvnApi['app']['getSettings'],
    setSettings: call('app:setSettings') as TstvnApi['app']['setSettings'],
    logo: call('app:logo') as TstvnApi['app']['logo'],
    setLogo: call('app:setLogo') as TstvnApi['app']['setLogo'],
    resetLogo: call('app:resetLogo') as TstvnApi['app']['resetLogo'],
    recent: call('app:recent') as TstvnApi['app']['recent'],
    removeRecent: call('app:removeRecent') as TstvnApi['app']['removeRecent'],
    setTitle: call('app:setTitle') as TstvnApi['app']['setTitle'],
  },
  dialog: {
    pickFolder: call('dialog:pickFolder') as TstvnApi['dialog']['pickFolder'],
    pickFiles: call('dialog:pickFiles') as TstvnApi['dialog']['pickFiles'],
    saveFile: call('dialog:saveFile') as TstvnApi['dialog']['saveFile'],
  },
  project: {
    create: call('project:create') as TstvnApi['project']['create'],
    open: call('project:open') as TstvnApi['project']['open'],
    save: call('project:save') as TstvnApi['project']['save'],
    writeRecovery: call('project:writeRecovery') as TstvnApi['project']['writeRecovery'],
    discardRecovery: call('project:discardRecovery') as TstvnApi['project']['discardRecovery'],
    fileExists: call('project:fileExists') as TstvnApi['project']['fileExists'],
    validate: call('project:validate') as TstvnApi['project']['validate'],
  },
  assets: {
    scan: call('assets:scan') as TstvnApi['assets']['scan'],
    execute: call('assets:execute') as TstvnApi['assets']['execute'],
    list: call('assets:list') as TstvnApi['assets']['list'],
    createFolder: call('assets:createFolder') as TstvnApi['assets']['createFolder'],
    rename: call('assets:rename') as TstvnApi['assets']['rename'],
    move: call('assets:move') as TstvnApi['assets']['move'],
    copy: call('assets:copy') as TstvnApi['assets']['copy'],
    remove: call('assets:remove') as TstvnApi['assets']['remove'],
    register: call('assets:register') as TstvnApi['assets']['register'],
    replace: call('assets:replace') as TstvnApi['assets']['replace'],
    exportFiles: call('assets:exportFiles') as TstvnApi['assets']['exportFiles'],
    reveal: call('assets:reveal') as TstvnApi['assets']['reveal'],
    regenerateThumb: call('assets:regenerateThumb') as TstvnApi['assets']['regenerateThumb'],
  },
  backups: {
    create: call('backups:create') as TstvnApi['backups']['create'],
    list: call('backups:list') as TstvnApi['backups']['list'],
    restore: call('backups:restore') as TstvnApi['backups']['restore'],
    remove: call('backups:remove') as TstvnApi['backups']['remove'],
  },
  pkg: {
    exportPackage: call('pkg:export') as TstvnApi['pkg']['exportPackage'],
    importPackage: call('pkg:import') as TstvnApi['pkg']['importPackage'],
  },
  templates: {
    list: call('templates:list') as TstvnApi['templates']['list'],
    save: call('templates:save') as TstvnApi['templates']['save'],
    remove: call('templates:remove') as TstvnApi['templates']['remove'],
  },
  game: {
    export: call('game:export') as TstvnApi['game']['export'],
    onProgress: (cb: (p: ExportProgress) => void) => {
      const listener = (_e: Electron.IpcRendererEvent, p: ExportProgress) => cb(p);
      ipcRenderer.on('game:progress', listener);
      return () => ipcRenderer.removeListener('game:progress', listener);
    },
    run: call('game:run') as TstvnApi['game']['run'],
    openPath: call('game:openPath') as TstvnApi['game']['openPath'],
  },
  fonts: {
    system: call('fonts:system') as TstvnApi['fonts']['system'],
    custom: call('fonts:custom') as TstvnApi['fonts']['custom'],
    import: call('fonts:import') as TstvnApi['fonts']['import'],
    remove: call('fonts:remove') as TstvnApi['fonts']['remove'],
    embed: call('fonts:embed') as TstvnApi['fonts']['embed'],
  },
  plugins: {
    list: call('plugins:list') as TstvnApi['plugins']['list'],
    install: call('plugins:install') as TstvnApi['plugins']['install'],
    remove: call('plugins:remove') as TstvnApi['plugins']['remove'],
    setEnabled: call('plugins:setEnabled') as TstvnApi['plugins']['setEnabled'],
    contributions: call('plugins:contributions') as TstvnApi['plugins']['contributions'],
    openFolder: call('plugins:openFolder') as TstvnApi['plugins']['openFolder'],
  },
  themes: {
    exportFile: call('themes:export') as TstvnApi['themes']['exportFile'],
    importFile: call('themes:import') as TstvnApi['themes']['importFile'],
  },
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
};

contextBridge.exposeInMainWorld('tstvn', api);
