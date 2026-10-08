import type { JumpTarget, Project } from './types';
import { orderedSceneIds } from './project';
import { t } from './i18n';

export interface FlowEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  kind: 'jump' | 'choice' | 'condition' | 'next';
  /** The action that creates this edge (absent for implicit "next scene" edges). */
  actionId?: string;
}

function sceneOfTarget(p: Project, fromSceneId: string, t: JumpTarget | undefined): string | null {
  if (!t) return null;
  if (t.kind === 'scene') return t.sceneId ?? null;
  if (t.kind === 'label') {
    const from = p.scenes.find((s) => s.id === fromSceneId);
    if (from?.actions.some((a) => a.type === 'label' && a.params.name === t.label)) return null; // same scene
    const s = p.scenes.find((sc) => sc.actions.some((a) => a.type === 'label' && a.params.name === t.label));
    return s ? s.id : null;
  }
  if (t.kind === 'action') {
    const s = p.scenes.find((sc) => sc.actions.some((a) => a.id === t.actionId));
    return s && s.id !== fromSceneId ? s.id : null;
  }
  return null;
}

/** Scene-to-scene connections for the Story Flow view. */
export function deriveFlowEdges(p: Project): FlowEdge[] {
  const edges: FlowEdge[] = [];
  const order = orderedSceneIds(p);
  const exists = new Set(p.scenes.map((s) => s.id));
  for (const s of p.scenes) {
    let endsWithTerminal = false;
    s.actions.forEach((a) => {
      if (a.disabled) return;
      const add = (to: string | null, label: string, kind: FlowEdge['kind'], suffix = '') => {
        if (to && exists.has(to)) edges.push({ id: `${a.id}${suffix}`, from: s.id, to, label, kind, actionId: a.id });
      };
      switch (a.type) {
        case 'jumpScene':
        case 'changeScene':
          add(a.params.sceneId, '', 'jump');
          break;
        case 'jump':
          add(sceneOfTarget(p, s.id, a.params.target), '', 'jump');
          break;
        case 'choice':
          (a.params.options ?? []).forEach((o: any) => add(sceneOfTarget(p, s.id, o.target), o.text, 'choice', `:${o.id}`));
          break;
        case 'pointAndClick':
          (a.params.hotspots ?? []).forEach((h: any) => add(sceneOfTarget(p, s.id, h.target), h.label, 'choice', `:${h.id}`));
          break;
        case 'conditional':
          add(sceneOfTarget(p, s.id, a.params.then), 'if true', 'condition', ':then');
          add(sceneOfTarget(p, s.id, a.params.else), 'otherwise', 'condition', ':else');
          break;
        case 'checkVariable':
          add(sceneOfTarget(p, s.id, a.params.target), 'if match', 'condition');
          break;
      }
    });
    const last = [...s.actions].reverse().find((a) => !a.disabled);
    if (last && ['jumpScene', 'changeScene', 'endGame', 'returnToTitle', 'jump'].includes(last.type)) endsWithTerminal = true;
    if (!endsWithTerminal) {
      const idx = order.indexOf(s.id);
      const next = idx >= 0 ? order[idx + 1] : undefined;
      if (next) edges.push({ id: `next:${s.id}`, from: s.id, to: next, label: 'next', kind: 'next' });
    }
  }
  return edges;
}

export interface BrokenLink {
  sceneId: string;
  actionId: string;
  /** What points nowhere, e.g. "Choice “Go left”" or "Jump to Scene". */
  what: string;
}

/** True when a jump target points to something that does not exist ("continue" is never broken). */
function targetBroken(p: Project, t: JumpTarget | undefined): boolean {
  if (!t || t.kind === 'next') return false;
  if (t.kind === 'scene') return !t.sceneId || !p.scenes.some((s) => s.id === t.sceneId);
  if (t.kind === 'label') return !t.label || !p.scenes.some((s) => s.actions.some((a) => a.type === 'label' && !a.disabled && a.params.name === t.label));
  if (t.kind === 'action') return !t.actionId || !p.scenes.some((s) => s.actions.some((a) => a.id === t.actionId));
  return true;
}

/** Connections that point to a scene, label or action that no longer exists (shown in red on the map). */
export function brokenLinks(p: Project): BrokenLink[] {
  const out: BrokenLink[] = [];
  const sceneIds = new Set(p.scenes.map((s) => s.id));
  for (const s of p.scenes) {
    for (const a of s.actions) {
      if (a.disabled) continue;
      const add = (what: string) => out.push({ sceneId: s.id, actionId: a.id, what });
      const pr = a.params ?? {};
      if ((a.type === 'jumpScene' || a.type === 'changeScene') && (!pr.sceneId || !sceneIds.has(pr.sceneId))) add(a.type === 'jumpScene' ? t('Jump to Scene') : t('Change Scene'));
      if ((a.type === 'jump' || a.type === 'checkVariable') && targetBroken(p, pr.target)) add(a.type === 'jump' ? t('Jump') : t('Check Variable'));
      if (a.type === 'conditional') {
        if (targetBroken(p, pr.then)) add(t('Conditional Branch (if true)'));
        if (targetBroken(p, pr.else)) add(t('Conditional Branch (otherwise)'));
      }
      if (a.type === 'choice') for (const o of pr.options ?? []) if (targetBroken(p, o.target)) add(t('Choice “{0}”', { 0: o.text }));
      if (a.type === 'pointAndClick') for (const h of pr.hotspots ?? []) if (targetBroken(p, h.target)) add(t('Point & Click “{0}”', { 0: h.label }));
    }
  }
  return out;
}
