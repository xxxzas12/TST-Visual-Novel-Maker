// Editor workspace: which panels of the scene editor are shown, their sizes and sides.
// Saved in Application Settings, so the editor reopens with the user's layout.

export type PanelId = 'left' | 'inspector' | 'stage';
/** open = shown; collapsed = a thin bar with a button to reopen it; hidden = not shown at all. */
export type PanelState = 'open' | 'collapsed' | 'hidden';
export type LeftTab = 'scenes' | 'assets' | 'characters';

export interface WorkspaceLayout {
  /** Preset or custom workspace this layout started from. */
  base: string;
  /** Width of the left panel (scenes / assets / cast) in px. */
  leftWidth: number;
  /** Width of the inspector (properties) in px. */
  inspectorWidth: number;
  /** Height of the stage preview as a share of the window height. */
  stageShare: number;
  panels: Record<PanelId, PanelState>;
  /** Swap sides: inspector on the left, scene list on the right. */
  swapSides: boolean;
  /** Main sidebar shows icons only. */
  compactNav: boolean;
  leftTab: LeftTab;
}

export interface CustomWorkspace {
  id: string;
  name: string;
  layout: WorkspaceLayout;
}

export const LIMITS = {
  leftWidth: { min: 180, max: 640 },
  inspectorWidth: { min: 240, max: 720 },
  stageShare: { min: 0.15, max: 0.75 },
};

const base: WorkspaceLayout = {
  base: 'default',
  leftWidth: 272,
  inspectorWidth: 352,
  stageShare: 0.38,
  panels: { left: 'open', inspector: 'open', stage: 'open' },
  swapSides: false,
  compactNav: false,
  leftTab: 'scenes',
};

export const WORKSPACE_PRESETS: readonly { id: string; name: string; description: string; layout: WorkspaceLayout }[] = [
  { id: 'default', name: 'Default', description: 'Scenes, stage, actions and properties', layout: base },
  {
    id: 'writing',
    name: 'Writing',
    description: 'A large action list for writing dialogue; the stage is folded away',
    layout: { ...base, base: 'writing', inspectorWidth: 420, panels: { left: 'open', inspector: 'open', stage: 'collapsed' }, compactNav: true },
  },
  {
    id: 'scene',
    name: 'Scene Design',
    description: 'A large stage for placing characters and images',
    layout: { ...base, base: 'scene', stageShare: 0.6, leftTab: 'characters', panels: { left: 'open', inspector: 'open', stage: 'open' }, compactNav: true },
  },
  {
    id: 'art',
    name: 'Art / Assets',
    description: 'A wide asset panel next to the stage, for dragging art into scenes',
    layout: { ...base, base: 'art', leftWidth: 440, stageShare: 0.5, leftTab: 'assets' },
  },
];

export const defaultLayout = (): WorkspaceLayout => clone(base);

function clone(l: WorkspaceLayout): WorkspaceLayout {
  return { ...l, panels: { ...l.panels } };
}

const clamp = (v: unknown, lim: { min: number; max: number }, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(lim.max, Math.max(lim.min, n)) : fallback;
};
const isState = (v: unknown): v is PanelState => v === 'open' || v === 'collapsed' || v === 'hidden';
const isTab = (v: unknown): v is LeftTab => v === 'scenes' || v === 'assets' || v === 'characters';

/** Accepts anything read from settings (missing, old or hand-edited) and returns a valid layout. */
export function normalizeLayout(raw: unknown): WorkspaceLayout {
  const d = defaultLayout();
  if (!raw || typeof raw !== 'object') return d;
  const o = raw as Partial<WorkspaceLayout>;
  const p = (o.panels ?? {}) as Partial<Record<PanelId, unknown>>;
  return {
    base: typeof o.base === 'string' && o.base ? o.base : d.base,
    leftWidth: clamp(o.leftWidth, LIMITS.leftWidth, d.leftWidth),
    inspectorWidth: clamp(o.inspectorWidth, LIMITS.inspectorWidth, d.inspectorWidth),
    stageShare: clamp(o.stageShare, LIMITS.stageShare, d.stageShare),
    panels: { left: isState(p.left) ? p.left : 'open', inspector: isState(p.inspector) ? p.inspector : 'open', stage: isState(p.stage) ? p.stage : 'open' },
    swapSides: !!o.swapSides,
    compactNav: !!o.compactNav,
    leftTab: isTab(o.leftTab) ? o.leftTab : d.leftTab,
  };
}

export function normalizeCustomWorkspaces(raw: unknown): CustomWorkspace[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((w): w is CustomWorkspace => !!w && typeof w === 'object' && typeof w.id === 'string' && typeof w.name === 'string')
    .map((w) => ({ id: w.id, name: w.name, layout: { ...normalizeLayout(w.layout), base: w.id } }));
}

/** The layout of a preset or custom workspace (null when it no longer exists). */
export function workspaceLayout(id: string, custom: CustomWorkspace[]): WorkspaceLayout | null {
  const l = WORKSPACE_PRESETS.find((p) => p.id === id)?.layout ?? custom.find((w) => w.id === id)?.layout;
  return l ? clone(l) : null;
}

/** True when the layout still matches the workspace it started from (no panel moved or resized). */
export function isUnchanged(l: WorkspaceLayout, custom: CustomWorkspace[]): boolean {
  const ref = workspaceLayout(l.base, custom);
  return !!ref && JSON.stringify(normalizeLayout(ref)) === JSON.stringify(normalizeLayout(l));
}
