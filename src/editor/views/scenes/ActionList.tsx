import { t as tr } from '../../../shared/i18n';
import { memo, useMemo, useState } from 'react';
import type { Action, Project, Scene } from '../../../shared/types';
import { cloneActions, getActionDef, isKnownActionType, type SummaryContext } from '../../../shared/actions';
import { useProject } from '../../store/project';
import { useUi } from '../../store/ui';
import { DND_ACTIONS, DND_ASSETS, DND_CHARACTER, getDrag, hasDrag, setDrag } from '../../dnd';
import { actionForAsset, actionForCharacter, deleteActions, duplicateActions, insertActions, moveActions, toggleDisabled } from '../../sceneOps';
import type { VisualState } from '../../../runtime/core/state';

let clipboard: Action[] = [];

export function summaryContext(p: Project): SummaryContext {
  const assets = new Map(p.assets.map((a) => [a.id, a]));
  const chars = new Map(p.characters.map((c) => [c.id, c]));
  const scenes = new Map(p.scenes.map((s) => [s.id, s]));
  const vars = new Map(p.variables.map((v) => [v.id, v]));
  return {
    assetName: (id) => (id ? (assets.get(id)?.name ?? '⚠ missing asset') : '(none)'),
    characterName: (id) => (id ? (chars.get(id)?.name ?? '⚠ missing character') : '(none)'),
    expressionName: (cid, eid) => {
      const c = cid ? chars.get(cid) : undefined;
      if (!eid) return c?.expressions.find((e) => e.id === c.defaultExpressionId)?.name ?? 'default';
      return c?.expressions.find((e) => e.id === eid)?.name ?? '⚠ missing';
    },
    sceneName: (id) => (id ? (scenes.get(id)?.name ?? '⚠ missing scene') : '(choose)'),
    variableName: (id) => (id ? (vars.get(id)?.name ?? '⚠ missing variable') : '(choose)'),
  };
}

const Row = memo(function Row(props: {
  action: Action;
  index: number;
  selected: boolean;
  summary: string;
  hasIssue: boolean;
  dropMark: 'before' | 'after' | null;
  onClick: (e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onToggle: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const a = props.action;
  const def = isKnownActionType(a.type) ? getActionDef(a.type) : null;
  return (
    <div
      className={`action-row cat-${def?.category ?? 'flow'} ${props.selected ? 'selected' : ''} ${a.disabled ? 'disabled' : ''} ${props.hasIssue ? 'has-issue' : ''} ${props.dropMark ? `drop-${props.dropMark}` : ''}`}
      onClick={props.onClick}
      draggable
      onDragStart={props.onDragStart}
      onDragOver={props.onDragOver}
      onDrop={props.onDrop}
      role="option"
      aria-selected={props.selected}
      data-testid={`action-${props.index}`}
      data-type={a.type}
      title={a.note || (def ? tr(def.description) : undefined)}
    >
      <span className="grip" aria-hidden>
        ⠿
      </span>
      <span className="num">{props.hasIssue ? '⚠' : ''}{props.index + 1}</span>
      <span className="ico">{def?.icon ?? '❔'}</span>
      <span className="label ellipsis">{def ? tr(def.label) : a.type}</span>
      <span className="summary ellipsis">{props.summary}</span>
      <span className="row-tools">
        <button className="btn ghost sm icon" title={a.disabled ? tr("Enable") : tr("Disable")} onClick={(e) => (e.stopPropagation(), props.onToggle())}>
          {a.disabled ? '◻' : '☑'}
        </button>
        <button className="btn ghost sm icon" title={tr("Duplicate (Ctrl+D)")} onClick={(e) => (e.stopPropagation(), props.onDuplicate())}>
          ⧉
        </button>
        <button className="btn ghost sm icon" title={tr("Delete (Del)")} onClick={(e) => (e.stopPropagation(), props.onDelete())} data-testid={`delete-action-${props.index}`}>
          🗑
        </button>
      </span>
    </div>
  );
});

export function ActionList({ scene, issueIds, stage }: { scene: Scene; issueIds: Set<string>; stage: VisualState }) {
  const project = useProject((s) => s.project)!;
  const actionIds = useUi((s) => s.actionIds);
  const anchor = useUi((s) => s.actionAnchor);
  const selectActions = useUi((s) => s.selectActions);
  const [drop, setDrop] = useState<{ index: number; mark: 'before' | 'after' } | null>(null);
  const ctx = useMemo(() => summaryContext(project), [project]);
  const selected = useMemo(() => new Set(actionIds), [actionIds]);

  const onRowClick = (a: Action, i: number, e: React.MouseEvent) => {
    if (e.shiftKey && anchor) {
      const from = scene.actions.findIndex((x) => x.id === anchor);
      const [lo, hi] = from < i ? [from, i] : [i, from];
      selectActions(scene.actions.slice(lo, hi + 1).map((x) => x.id), anchor);
    } else if (e.ctrlKey || e.metaKey) {
      selectActions(selected.has(a.id) ? actionIds.filter((x) => x !== a.id) : [...actionIds, a.id], a.id);
    } else selectActions([a.id], a.id);
  };

  const dropIndexFor = (e: React.DragEvent, i: number) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return e.clientY < r.top + r.height / 2 ? { index: i, mark: 'before' as const } : { index: i + 1, mark: 'after' as const };
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    setDrop(null);
    const moving = getDrag<string[]>(e, DND_ACTIONS);
    if (moving) {
      e.preventDefault();
      moveActions(scene.id, moving, index);
      return;
    }
    const assets = getDrag<{ ids: string[] }>(e, DND_ASSETS);
    const ch = getDrag<{ characterId: string; expressionId: string }>(e, DND_CHARACTER);
    const acts: Action[] = [];
    if (ch) acts.push(actionForCharacter(ch.characterId, ch.expressionId, stage));
    for (const id of assets?.ids ?? []) {
      const a = project.assets.find((x) => x.id === id);
      const act = a && actionForAsset(project, a, stage);
      if (act) acts.push(act);
    }
    if (acts.length) {
      e.preventDefault();
      insertActions(scene.id, acts, index);
    }
  };

  const acceptsDrop = (e: React.DragEvent) => hasDrag(e, DND_ACTIONS) || hasDrag(e, DND_ASSETS) || hasDrag(e, DND_CHARACTER);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).closest('input, textarea, select')) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const idx = scene.actions.findIndex((a) => a.id === actionIds[actionIds.length - 1]);
    if (e.key === 'Delete' && actionIds.length) {
      e.preventDefault();
      deleteActions(scene.id, actionIds);
    } else if (ctrl && e.key.toLowerCase() === 'd' && actionIds.length) {
      e.preventDefault();
      duplicateActions(scene.id, actionIds);
    } else if (ctrl && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      selectActions(scene.actions.map((a) => a.id));
    } else if (ctrl && e.key.toLowerCase() === 'c' && actionIds.length) {
      clipboard = scene.actions.filter((a) => selected.has(a.id));
    } else if (ctrl && e.key.toLowerCase() === 'v' && clipboard.length) {
      e.preventDefault();
      insertActions(scene.id, cloneActions(clipboard));
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.max(0, Math.min(scene.actions.length - 1, idx + (e.key === 'ArrowDown' ? 1 : -1)));
      if (e.altKey && actionIds.length) moveActions(scene.id, actionIds, e.key === 'ArrowDown' ? Math.min(scene.actions.length, idx + 2) : Math.max(0, idx - 1 - (actionIds.length - 1)));
      else if (scene.actions[next]) selectActions([scene.actions[next].id]);
    }
  };

  return (
    <div
      className="action-list"
      tabIndex={0}
      onKeyDown={onKeyDown}
      role="listbox"
      aria-multiselectable
      aria-label={tr("Actions")}
      data-testid="action-list"
      onDragOver={(e) => {
        if (acceptsDrop(e)) {
          e.preventDefault();
          if (e.target === e.currentTarget) setDrop({ index: scene.actions.length, mark: 'after' });
        }
      }}
      onDrop={(e) => handleDrop(e, drop?.index ?? scene.actions.length)}
      onDragLeave={(e) => e.target === e.currentTarget && setDrop(null)}
    >
      {scene.actions.length === 0 && (
        <div className="empty">
          <div className="big">🎬</div>
          <div>{tr("This scene is empty.")}</div>
          <div className="small faint">{tr("Use the quick buttons above, “＋ Action”, or drag assets here.")}</div>
        </div>
      )}
      {scene.actions.map((a, i) => (
        <Row
          key={a.id}
          action={a}
          index={i}
          selected={selected.has(a.id)}
          summary={isKnownActionType(a.type) ? getActionDef(a.type).summary(a.params, ctx) : ''}
          hasIssue={issueIds.has(a.id)}
          dropMark={drop && ((drop.mark === 'before' && drop.index === i) || (drop.mark === 'after' && drop.index === i + 1)) ? drop.mark : null}
          onClick={(e) => onRowClick(a, i, e)}
          onDragStart={(e) => {
            const ids = selected.has(a.id) ? scene.actions.filter((x) => selected.has(x.id)).map((x) => x.id) : [a.id];
            setDrag(e, DND_ACTIONS, ids);
            e.dataTransfer.effectAllowed = 'move';
          }}
          onDragOver={(e) => {
            if (acceptsDrop(e)) {
              e.preventDefault();
              e.stopPropagation();
              setDrop(dropIndexFor(e, i));
            }
          }}
          onDrop={(e) => {
            e.stopPropagation();
            handleDrop(e, dropIndexFor(e, i).index);
          }}
          onToggle={() => toggleDisabled(scene.id, [a.id])}
          onDuplicate={() => duplicateActions(scene.id, [a.id])}
          onDelete={() => deleteActions(scene.id, [a.id])}
        />
      ))}
    </div>
  );
}
