import { create } from 'zustand';
import { produce, setAutoFreeze } from 'immer';
import type { Project } from '../../shared/types';

setAutoFreeze(true);

const HISTORY_LIMIT = 150;
const COALESCE_MS = 1200;

export interface ProjectState {
  dir: string | null;
  project: Project | null;
  past: Project[];
  future: Project[];
  dirty: boolean;
  savedAt: number | null;
  /** Asset ids whose files are missing on disk. */
  missing: string[];
  lastKey: string | null;
  lastTime: number;
  load(dir: string, project: Project, dirty?: boolean): void;
  close(): void;
  /**
   * Change the project. Every change is undoable; changes with the same
   * `coalesce` key in quick succession (typing, dragging) become one undo step.
   */
  update(recipe: (draft: Project) => void, coalesce?: string): void;
  replace(project: Project): void;
  undo(): void;
  redo(): void;
  markSaved(at: number): void;
  setMissing(ids: string[]): void;
}

export const useProject = create<ProjectState>((set, get) => ({
  dir: null,
  project: null,
  past: [],
  future: [],
  dirty: false,
  savedAt: null,
  missing: [],
  lastKey: null,
  lastTime: 0,
  load: (dir, project, dirty = false) =>
    set({ dir, project: produce(project, () => undefined), past: [], future: [], dirty, savedAt: dirty ? null : Date.now(), missing: [], lastKey: null, lastTime: 0 }),
  close: () => set({ dir: null, project: null, past: [], future: [], dirty: false, savedAt: null, missing: [], lastKey: null }),
  update: (recipe, coalesce) => {
    const { project, past, lastKey, lastTime } = get();
    if (!project) return;
    const next = produce(project, recipe);
    if (next === project) return;
    const now = Date.now();
    const merge = !!coalesce && coalesce === lastKey && now - lastTime < COALESCE_MS;
    set({
      project: next,
      past: merge ? past : [...past.slice(-HISTORY_LIMIT + 1), project],
      future: [],
      dirty: true,
      lastKey: coalesce ?? null,
      lastTime: now,
    });
  },
  replace: (project) => {
    const { project: cur, past } = get();
    set({ project: produce(project, () => undefined), past: cur ? [...past.slice(-HISTORY_LIMIT + 1), cur] : past, future: [], dirty: true, lastKey: null });
  },
  undo: () => {
    const { past, project, future } = get();
    if (!past.length || !project) return;
    set({ project: past[past.length - 1], past: past.slice(0, -1), future: [project, ...future], dirty: true, lastKey: null });
  },
  redo: () => {
    const { past, project, future } = get();
    if (!future.length || !project) return;
    set({ project: future[0], past: [...past, project], future: future.slice(1), dirty: true, lastKey: null });
  },
  markSaved: (at) => set({ dirty: false, savedAt: at }),
  setMissing: (ids) => set({ missing: ids }),
}));

export function getProject(): Project {
  const p = useProject.getState().project;
  if (!p) throw new Error('No project is open.');
  return p;
}

export function getDir(): string {
  const d = useProject.getState().dir;
  if (!d) throw new Error('No project is open.');
  return d;
}
