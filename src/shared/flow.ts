import type { JumpTarget, Project } from './types';
import { orderedSceneIds } from './project';

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
