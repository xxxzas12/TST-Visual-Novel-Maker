// Contract between the Electron main process and the editor renderer.
import type { Asset, AssetType, MediaKind, Project } from './types';
import type { Issue } from './validate';

export interface RecentProject {
  path: string;
  name: string;
  openedAt: number;
}

export interface AppSettings {
  onboardingDone: boolean;
  lastProjectParent?: string;
  autosaveMinutes: number;
  uiScale?: number;
  language?: 'en' | 'th';
  /** Editor UI font family ('' = default). */
  uiFont?: string;
  /** Editor UI base font size in px (default 14). */
  uiFontSize?: number;
  appearance?: 'dark' | 'light' | 'system';
}

export interface SystemFont {
  family: string;
}

export interface CustomFont {
  id: string;
  family: string;
  /** File name inside the app's fonts folder. */
  file: string;
  originalName: string;
}

export interface AppInfo {
  version: string;
  platform: string;
  defaultProjectsDir: string;
  isDev: boolean;
  isE2E: boolean;
}

export interface OpenProjectResult {
  dir: string;
  project: Project;
  recovery?: { savedAt: number; project: Project };
}

export interface UserTemplateInfo {
  id: string;
  name: string;
  createdAt: number;
}

export interface ImportItem {
  id: string;
  source: string;
  dest: string;
  kind: MediaKind;
  ext: string;
  type: AssetType;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  size: number;
  hash: string;
  width?: number;
  height?: number;
  inPlace: boolean;
  duplicate?: { reason: 'hash' | 'path' | 'batch'; existingPath: string; existingAssetId?: string };
}

export interface ImportPlan {
  items: ImportItem[];
  unsupported: string[];
  errors: { path: string; message: string }[];
  scanned: number;
}

export type DuplicateDecision = 'skip' | 'replace' | 'keep';

export interface ReplacedAsset {
  assetId: string;
  hash: string;
  size: number;
  width?: number;
  height?: number;
  hasThumb: boolean;
}

export interface ImportReport {
  imported: number;
  images: number;
  audio: number;
  video: number;
  unsupported: number;
  duplicates: number;
  replaced: number;
  errors: { path: string; message: string }[];
  unsupportedFiles: string[];
}

export interface ImportResult {
  added: Asset[];
  replaced: ReplacedAsset[];
  report: ImportReport;
}

export interface TreeListing {
  folders: string[];
  files: { path: string; size: number; mtime: number }[];
}

export interface PathMove {
  from: string;
  to: string;
}

export interface BackupInfo {
  id: string;
  reason: string;
  createdAt: number;
  hasFiles: boolean;
}

export type ExportPlatform = 'windows' | 'web';

export interface ExportGameRequest {
  dir: string;
  project: Project;
  platform: ExportPlatform;
  outDir: string;
}

export type ExportGameResult =
  | { ok: true; outputPath: string; launchPath: string; files: number; bytes: number; warnings: Issue[]; checks: string[] }
  | { ok: false; errors: string[]; warnings: Issue[] };

export interface ExportProgress {
  step: string;
  percent: number;
}

export interface FileFilter {
  name: string;
  extensions: string[];
}

/** The API exposed on window.tstvn by the preload script. */
export interface TstvnApi {
  app: {
    info(): Promise<AppInfo>;
    getSettings(): Promise<AppSettings>;
    setSettings(patch: Partial<AppSettings>): Promise<AppSettings>;
    recent(): Promise<RecentProject[]>;
    removeRecent(path: string): Promise<RecentProject[]>;
    setTitle(title: string): Promise<void>;
  };
  dialog: {
    pickFolder(title: string, defaultPath?: string): Promise<string | null>;
    pickFiles(title: string, filters: FileFilter[], multi: boolean): Promise<string[]>;
    saveFile(title: string, defaultPath: string, filters: FileFilter[]): Promise<string | null>;
  };
  project: {
    create(parentDir: string, name: string, template: string): Promise<OpenProjectResult>;
    open(dir: string): Promise<OpenProjectResult>;
    save(dir: string, project: Project): Promise<number>;
    writeRecovery(dir: string, project: Project): Promise<void>;
    discardRecovery(dir: string): Promise<void>;
    fileExists(dir: string, relPaths: string[]): Promise<boolean[]>;
    validate(dir: string, project: Project): Promise<Issue[]>;
  };
  assets: {
    scan(dir: string, sources: string[], existing: Asset[]): Promise<ImportPlan>;
    execute(dir: string, plan: ImportPlan, decisions: Record<string, DuplicateDecision>, existing: Asset[]): Promise<ImportResult>;
    list(dir: string): Promise<TreeListing>;
    createFolder(dir: string, rel: string): Promise<string>;
    rename(dir: string, rel: string, newName: string): Promise<PathMove>;
    move(dir: string, rels: string[], destFolder: string): Promise<PathMove[]>;
    copy(dir: string, rels: string[], destFolder: string): Promise<PathMove[]>;
    remove(dir: string, rels: string[], backupId: string): Promise<string[]>;
    register(dir: string, rels: string[]): Promise<Asset[]>;
    replace(dir: string, rel: string, source: string, assetId: string): Promise<{ path: string; replaced: ReplacedAsset }>;
    exportFiles(dir: string, rels: string[], destDir: string): Promise<number>;
    reveal(dir: string, rel: string): Promise<void>;
    regenerateThumb(dir: string, rel: string, assetId: string): Promise<boolean>;
  };
  backups: {
    create(dir: string, project: Project, reason: string): Promise<string>;
    list(dir: string): Promise<BackupInfo[]>;
    restore(dir: string, id: string): Promise<Project>;
    remove(dir: string, id: string): Promise<void>;
  };
  pkg: {
    exportPackage(dir: string, project: Project, file: string): Promise<{ files: number; bytes: number }>;
    importPackage(file: string, parentDir: string): Promise<OpenProjectResult>;
  };
  templates: {
    list(): Promise<UserTemplateInfo[]>;
    save(name: string, project: Project): Promise<UserTemplateInfo>;
    remove(id: string): Promise<void>;
  };
  game: {
    export(req: ExportGameRequest): Promise<ExportGameResult>;
    onProgress(cb: (p: ExportProgress) => void): () => void;
    run(launchPath: string): Promise<void>;
    openPath(path: string): Promise<void>;
  };
  fonts: {
    system(): Promise<SystemFont[]>;
    custom(): Promise<CustomFont[]>;
    import(file: string): Promise<CustomFont>;
    remove(id: string): Promise<CustomFont[]>;
    /** Copy a custom font into the project (fonts/…) so exported games include it. */
    embed(dir: string, id: string): Promise<{ family: string; file: string }>;
  };
  getPathForFile(file: File): string;
}

/** URL for an imported font in the editor (served by the main process). */
export function customFontUrl(f: Pick<CustomFont, 'file'>): string {
  return `tstvn-font://f/${encodeURIComponent(f.file)}`;
}
