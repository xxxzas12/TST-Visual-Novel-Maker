import { create } from 'zustand';
import type { AssetType } from '../../shared/types';
import type { AssetSort } from '../../shared/search';
import type { ImportPlan, ImportReport } from '../../shared/api';
import { getLanguage, setLanguage, type Lang } from '../../shared/i18n';
import { DEFAULT_UI_FONT_SIZE, type Appearance } from '../appearance';

export type AppSettingsSection = 'general' | 'interface' | 'autosave' | 'about';

export type View = 'assets' | 'scenes' | 'flow' | 'characters' | 'variables' | 'themes' | 'settings' | 'export' | 'backups';

export interface Toast {
  id: number;
  kind: 'info' | 'success' | 'error' | 'warning';
  text: string;
}

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  details?: string[];
  resolve: (ok: boolean) => void;
}

export interface PromptRequest {
  title: string;
  label: string;
  value: string;
  confirmLabel?: string;
  resolve: (value: string | null) => void;
}

export interface PreviewRequest {
  sceneId?: string | null;
  index?: number;
  skipTitle: boolean;
}

export interface ImportState {
  stage: 'scanning' | 'review' | 'importing' | 'report';
  sources: string[];
  plan?: ImportPlan;
  report?: ImportReport;
  newAssetIds?: string[];
  characters?: { created: number; expressions: number };
}

export interface GalleryState {
  selected: string[];
  anchor: string | null;
  folder: string | null;
  query: string;
  types: AssetType[];
  tag: string | null;
  collectionId: string | null;
  sort: AssetSort;
  sortDir: 'asc' | 'desc';
  mode: 'grid' | 'list';
}

export interface UiState {
  view: View;
  sceneId: string | null;
  actionIds: string[];
  actionAnchor: string | null;
  gallery: GalleryState;
  toasts: Toast[];
  confirm: ConfirmRequest | null;
  prompt: PromptRequest | null;
  preview: PreviewRequest | null;
  importState: ImportState | null;
  previewOpened: boolean;
  exported: boolean;
  /** Editor look (fonts + appearance), loaded from app settings. */
  uiFont: string;
  uiFontSize: number;
  appearance: Appearance;
  language: Lang;
  /** Open Application Settings section (null = closed). */
  appSettings: AppSettingsSection | null;
  openAppSettings(section: AppSettingsSection): void;
  setView(v: View): void;
  selectScene(id: string | null): void;
  selectActions(ids: string[], anchor?: string | null): void;
  setGallery(patch: Partial<GalleryState>): void;
  toast(text: string, kind?: Toast['kind']): void;
  dismissToast(id: number): void;
  setImport(s: ImportState | null): void;
  openPreview(p: PreviewRequest | null): void;
  set(patch: Partial<UiState>): void;
}

let toastId = 0;

export const defaultGallery: GalleryState = {
  selected: [],
  anchor: null,
  folder: null,
  query: '',
  types: [],
  tag: null,
  collectionId: null,
  sort: 'name',
  sortDir: 'asc',
  mode: 'grid',
};

export const useUi = create<UiState>((set, get) => ({
  view: 'scenes',
  sceneId: null,
  actionIds: [],
  actionAnchor: null,
  gallery: defaultGallery,
  toasts: [],
  confirm: null,
  prompt: null,
  preview: null,
  importState: null,
  previewOpened: false,
  exported: false,
  uiFont: '',
  uiFontSize: DEFAULT_UI_FONT_SIZE,
  appearance: 'dark',
  language: getLanguage(),
  appSettings: null,
  openAppSettings: (appSettings) => set({ appSettings }),
  setView: (view) => set({ view }),
  selectScene: (sceneId) => set({ sceneId, actionIds: [], actionAnchor: null }),
  selectActions: (actionIds, anchor) => set({ actionIds, actionAnchor: anchor === undefined ? (actionIds[actionIds.length - 1] ?? null) : anchor }),
  setGallery: (patch) => set({ gallery: { ...get().gallery, ...patch } }),
  toast: (text, kind = 'info') => {
    const id = ++toastId;
    set({ toasts: [...get().toasts, { id, kind, text }] });
    setTimeout(() => get().dismissToast(id), kind === 'error' ? 7000 : 3500);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  setImport: (importState) => set({ importState }),
  openPreview: (preview) => set(preview ? { preview, previewOpened: true } : { preview: null }),
  set: (patch) => set(patch),
}));

export function toast(text: string, kind?: Toast['kind']) {
  useUi.getState().toast(text, kind);
}

export function confirmDialog(opts: Omit<ConfirmRequest, 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => useUi.setState({ confirm: { ...opts, resolve } }));
}

export function promptDialog(opts: Omit<PromptRequest, 'resolve'>): Promise<string | null> {
  return new Promise((resolve) => useUi.setState({ prompt: { ...opts, resolve } }));
}

/** Switch the editor language (re-renders the whole UI) and remember it. */
export function applyLanguage(lang: Lang) {
  setLanguage(lang);
  document.documentElement.lang = lang;
  useUi.setState({ language: lang });
}
