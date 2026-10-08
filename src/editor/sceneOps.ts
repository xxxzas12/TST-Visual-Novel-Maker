import { t as tr } from '../shared/i18n';
import type { Action, Asset, Project, Scene } from '../shared/types';
import { cloneActions, createAction } from '../shared/actions';
import { newId } from '../shared/ids';
import { getProject, useProject } from './store/project';
import { confirmDialog, toast, useUi } from './store/ui';
import { backup } from './ops';
import type { VisualState } from '../runtime/core/state';

export function findScene(p: Project, id: string | null | undefined): Scene | undefined {
  return id ? p.scenes.find((s) => s.id === id) : undefined;
}

/** Insert actions after the current selection (or at the end) and select them. */
export function insertActions(sceneId: string, actions: Action[], at?: number) {
  if (!actions.length) return;
  const ui = useUi.getState();
  const scene = findScene(getProject(), sceneId);
  if (!scene) return;
  let index = at;
  if (index === undefined) {
    const selIdx = scene.actions.map((a, i) => (ui.actionIds.includes(a.id) ? i : -1)).filter((i) => i >= 0);
    index = selIdx.length ? Math.max(...selIdx) + 1 : scene.actions.length;
  }
  useProject.getState().update((p) => {
    const s = findScene(p, sceneId)!;
    s.actions.splice(index!, 0, ...actions);
  });
  ui.selectActions(actions.map((a) => a.id));
}

export function addAction(sceneId: string, type: Action['type'], params: Record<string, any> = {}) {
  const a = createAction(type, params);
  insertActions(sceneId, [a]);
  return a;
}

export function deleteActions(sceneId: string, ids: string[]) {
  useProject.getState().update((p) => {
    const s = findScene(p, sceneId);
    if (s) s.actions = s.actions.filter((a) => !ids.includes(a.id));
  });
  useUi.getState().selectActions([]);
}

export function duplicateActions(sceneId: string, ids: string[]) {
  const scene = findScene(getProject(), sceneId);
  if (!scene) return;
  const picked = scene.actions.filter((a) => ids.includes(a.id));
  const copies = cloneActions(picked);
  const last = Math.max(...scene.actions.map((a, i) => (ids.includes(a.id) ? i : -1)));
  insertActions(sceneId, copies, last + 1);
}

export function toggleDisabled(sceneId: string, ids: string[]) {
  useProject.getState().update((p) => {
    const s = findScene(p, sceneId);
    if (!s) return;
    const anyEnabled = s.actions.some((a) => ids.includes(a.id) && !a.disabled);
    for (const a of s.actions) if (ids.includes(a.id)) a.disabled = anyEnabled;
  });
}

/** Move a set of actions so they start at `toIndex` (index in the list before removal). */
export function moveActions(sceneId: string, ids: string[], toIndex: number) {
  useProject.getState().update((p) => {
    const s = findScene(p, sceneId);
    if (!s) return;
    const moving = s.actions.filter((a) => ids.includes(a.id));
    const before = s.actions.slice(0, toIndex).filter((a) => !ids.includes(a.id)).length;
    const rest = s.actions.filter((a) => !ids.includes(a.id));
    rest.splice(before, 0, ...moving);
    s.actions = rest;
  });
}

export function updateActionParams(sceneId: string, actionId: string, patch: Record<string, any>, coalesce?: string) {
  useProject.getState().update((p) => {
    const a = findScene(p, sceneId)?.actions.find((x) => x.id === actionId);
    if (a) Object.assign(a.params, patch);
  }, coalesce ?? `params:${actionId}:${Object.keys(patch).join(',')}`);
}

/**
 * Drag & drop: what action does dropping this asset create?
 *  Background -> Change Background, CG -> Show CG, Character sprite -> Add Character
 *  (or Change Expression if already on stage), Music -> Play BGM, SFX -> Play SFX,
 *  Voice -> Play Voice, Video -> Play Video, other images -> Show Image.
 */
export function actionForAsset(p: Project, asset: Asset, stage?: VisualState, dropX?: number, dropY?: number): Action | null {
  if (asset.kind === 'audio') {
    if (asset.type === 'sfx') return createAction('playSFX', { assetId: asset.id });
    if (asset.type === 'voice') return createAction('playVoice', { assetId: asset.id });
    return createAction('playBGM', { assetId: asset.id });
  }
  if (asset.kind === 'video') return createAction('playVideo', { assetId: asset.id });
  if (asset.type === 'background') return createAction('changeBackground', { assetId: asset.id });
  if (asset.type === 'cg') return createAction('showCG', { assetId: asset.id });
  const owner = p.characters.find((c) => c.expressions.some((e) => e.assetId === asset.id));
  if (owner) {
    const expr = owner.expressions.find((e) => e.assetId === asset.id)!;
    return actionForCharacter(owner.id, expr.id, stage, dropX);
  }
  return createAction('showImage', {
    slot: asset.name.replace(/\.[^.]+$/, ''),
    assetId: asset.id,
    x: dropX !== undefined ? Math.round(dropX) : 50,
    y: dropY !== undefined ? Math.round(dropY) : 50,
  });
}

export function actionForCharacter(characterId: string, expressionId: string, stage?: VisualState, dropX?: number): Action {
  if (stage?.characters.some((c) => c.id === characterId)) {
    return createAction('changeExpression', { characterId, expressionId });
  }
  return createAction('addCharacter', { characterId, expressionId, x: dropX !== undefined ? Math.round(dropX) : 50 });
}

// ---------------- chapters & scenes ----------------

export function addScene(chapterId?: string, name?: string): string {
  const p = getProject();
  const chId = chapterId ?? chapterOf(p, useUi.getState().sceneId) ?? p.chapters[p.chapters.length - 1]?.id;
  const id = newId('s');
  useProject.getState().update((d) => {
    let ch = d.chapters.find((c) => c.id === chId);
    if (!ch) {
      ch = { id: newId('ch'), name: `Chapter ${d.chapters.length + 1}`, sceneIds: [] };
      d.chapters.push(ch);
    }
    const n = d.scenes.length + 1;
    d.scenes.push({ id, name: name ?? `Scene ${String(n).padStart(2, '0')}`, tags: [], actions: [], flowPos: { x: 80 + (n % 5) * 240, y: 80 + Math.floor(n / 5) * 160 } });
    ch.sceneIds.push(id);
    if (!d.settings.startSceneId) d.settings.startSceneId = id;
  });
  useUi.getState().selectScene(id);
  return id;
}

export function chapterOf(p: Project, sceneId: string | null): string | undefined {
  return p.chapters.find((c) => sceneId && c.sceneIds.includes(sceneId))?.id;
}

export function addChapter(name?: string): string {
  const id = newId('ch');
  useProject.getState().update((d) => {
    d.chapters.push({ id, name: name ?? `Chapter ${d.chapters.length + 1}`, sceneIds: [] });
  });
  return id;
}

export function renameChapter(id: string, name: string) {
  useProject.getState().update((d) => {
    const c = d.chapters.find((x) => x.id === id);
    if (c && name.trim()) c.name = name.trim();
  });
}

export function renameScene(id: string, name: string) {
  useProject.getState().update((d) => {
    const s = findScene(d, id);
    if (s && name.trim()) s.name = name.trim();
  });
}

export function duplicateScene(id: string): string | null {
  const p = getProject();
  const src = findScene(p, id);
  if (!src) return null;
  const copyId = newId('s');
  useProject.getState().update((d) => {
    const ch = d.chapters.find((c) => c.sceneIds.includes(id));
    d.scenes.push({
      id: copyId,
      name: `${src.name} (copy)`,
      tags: [...src.tags],
      actions: cloneActions(src.actions),
      flowPos: src.flowPos ? { x: src.flowPos.x + 40, y: src.flowPos.y + 60 } : undefined,
    });
    if (ch) ch.sceneIds.splice(ch.sceneIds.indexOf(id) + 1, 0, copyId);
  });
  useUi.getState().selectScene(copyId);
  return copyId;
}

function referencesToScene(p: Project, id: string): number {
  let n = 0;
  for (const s of p.scenes) {
    for (const a of s.actions) {
      const json = JSON.stringify(a.params);
      if (json.includes(`"${id}"`)) n++;
    }
  }
  return n;
}

export async function deleteScene(id: string) {
  const p = getProject();
  const s = findScene(p, id);
  if (!s) return;
  if (p.scenes.length <= 1) {
    toast(tr("A project needs at least one scene."), 'warning');
    return;
  }
  const refs = referencesToScene(p, id);
  const ok = await confirmDialog({
    title: tr("Delete scene “{0}”?", { 0: s.name }),
    message: tr("{0} action(s) will be deleted.{1} A backup is created first.", { 0: s.actions.length, 1: refs ? ` ${refs} jump(s) point to this scene and will show as problems.` : '' }),
    confirmLabel: tr("Delete scene"),
    danger: true,
  });
  if (!ok) return;
  await backup(tr('Delete scene {0}', { 0: s.name }));
  useProject.getState().update((d) => {
    d.scenes = d.scenes.filter((x) => x.id !== id);
    d.chapters.forEach((c) => (c.sceneIds = c.sceneIds.filter((x) => x !== id)));
    if (d.settings.startSceneId === id) d.settings.startSceneId = d.chapters.flatMap((c) => c.sceneIds)[0];
  });
  const ui = useUi.getState();
  if (ui.sceneId === id) ui.selectScene(getProject().chapters.flatMap((c) => c.sceneIds)[0] ?? null);
}

export async function deleteChapter(id: string) {
  const p = getProject();
  const ch = p.chapters.find((c) => c.id === id);
  if (!ch) return;
  if (p.chapters.length <= 1) {
    toast(tr("A project needs at least one chapter."), 'warning');
    return;
  }
  if (ch.sceneIds.length && p.scenes.length - ch.sceneIds.length < 1) {
    toast(tr("A project needs at least one scene."), 'warning');
    return;
  }
  const ok = await confirmDialog({
    title: tr("Delete chapter “{0}”?", { 0: ch.name }),
    message: ch.sceneIds.length ? tr("Its {0} scene(s) will be deleted too. A backup is created first.", { 0: ch.sceneIds.length }) : tr("The chapter is empty."),
    confirmLabel: tr("Delete chapter"),
    danger: true,
  });
  if (!ok) return;
  await backup(tr('Delete chapter {0}', { 0: ch.name }));
  useProject.getState().update((d) => {
    const ids = new Set(ch.sceneIds);
    d.scenes = d.scenes.filter((s) => !ids.has(s.id));
    d.chapters = d.chapters.filter((c) => c.id !== id);
    if (d.settings.startSceneId && ids.has(d.settings.startSceneId)) d.settings.startSceneId = d.chapters.flatMap((c) => c.sceneIds)[0];
  });
  const ui = useUi.getState();
  if (ui.sceneId && ch.sceneIds.includes(ui.sceneId)) ui.selectScene(getProject().chapters.flatMap((c) => c.sceneIds)[0] ?? null);
}

export function duplicateChapter(id: string) {
  const p = getProject();
  const ch = p.chapters.find((c) => c.id === id);
  if (!ch) return;
  useProject.getState().update((d) => {
    const newIds: string[] = [];
    for (const sid of ch.sceneIds) {
      const s = findScene(p, sid);
      if (!s) continue;
      const nid = newId('s');
      newIds.push(nid);
      d.scenes.push({ id: nid, name: `${s.name} (copy)`, tags: [...s.tags], actions: cloneActions(s.actions), flowPos: s.flowPos ? { x: s.flowPos.x + 40, y: s.flowPos.y + 300 } : undefined });
    }
    const idx = d.chapters.findIndex((c) => c.id === id);
    d.chapters.splice(idx + 1, 0, { id: newId('ch'), name: `${ch.name} (copy)`, sceneIds: newIds });
  });
}

/** Move a scene into a chapter at a position (drag & drop in the scene tree). */
export function moveScene(sceneId: string, toChapterId: string, toIndex: number) {
  useProject.getState().update((d) => {
    const from = d.chapters.find((c) => c.sceneIds.includes(sceneId));
    const to = d.chapters.find((c) => c.id === toChapterId);
    if (!from || !to) return;
    const oldIdx = from.sceneIds.indexOf(sceneId);
    from.sceneIds.splice(oldIdx, 1);
    let idx = toIndex;
    if (from === to && oldIdx < toIndex) idx--;
    to.sceneIds.splice(Math.max(0, Math.min(idx, to.sceneIds.length)), 0, sceneId);
  });
}

export function moveChapter(id: string, delta: number) {
  useProject.getState().update((d) => {
    const i = d.chapters.findIndex((c) => c.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= d.chapters.length) return;
    const [c] = d.chapters.splice(i, 1);
    d.chapters.splice(j, 0, c);
  });
}

export function toggleChapter(id: string) {
  useProject.getState().update((d) => {
    const c = d.chapters.find((x) => x.id === id);
    if (c) c.collapsed = !c.collapsed;
  }, `collapse:${id}`);
}

export function saveActionTemplate(sceneId: string, ids: string[], name: string) {
  const scene = findScene(getProject(), sceneId);
  if (!scene || !ids.length) return;
  const actions = cloneActions(scene.actions.filter((a) => ids.includes(a.id)));
  useProject.getState().update((d) => {
    d.actionTemplates.push({ id: newId('at'), name: name.trim() || 'Template', actions });
  });
  toast(tr("Saved template “{0}” ({1} actions)", { 0: name, 1: actions.length }), 'success');
}

/** Inserts a copy of a project template or of a template contributed by an enabled plugin. */
export function insertActionTemplate(sceneId: string, templateId: string) {
  const t = getProject().actionTemplates.find((x) => x.id === templateId) ?? useUi.getState().plugins.actionTemplates.find((x) => x.id === templateId);
  if (!t) return;
  insertActions(sceneId, cloneActions(t.actions));
}
