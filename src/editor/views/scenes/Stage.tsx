import { t as tr } from '../../../shared/i18n';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Action, Project, Scene, Hotspot } from '../../../shared/types';
import { charBoxStyle, imageBoxStyle, POSITION_X } from '../../../shared/stage';
import { stateBeforeAction, type VisualState } from '../../../runtime/core/state';
import { assetUrl } from '../../assetUrl';
import { useProject } from '../../store/project';
import { useUi } from '../../store/ui';
import { DND_ASSETS, DND_CHARACTER, getDrag, hasDrag } from '../../dnd';
import { actionForAsset, actionForCharacter, insertActions, updateActionParams } from '../../sceneOps';
import { playFromHere, playFromStart } from '../Shell';

const EDITABLE = new Set(['addCharacter', 'moveCharacter', 'showImage']);

export function useStageState(project: Project, scene: Scene | undefined, uptoIndex: number) {
  return useMemo(() => {
    if (!scene) return { state: { background: null, cg: null, characters: [], images: [], bgm: null } as VisualState, sources: {} as Record<string, string> };
    const r = stateBeforeAction({ characters: project.characters, variables: project.variables }, scene.actions, uptoIndex);
    return { state: r.state, sources: r.sources };
  }, [project.characters, project.variables, scene, uptoIndex]);
}

function selectedTarget(a: Action | undefined): string | null {
  if (!a) return null;
  if (['addCharacter', 'moveCharacter', 'changeExpression', 'animateCharacter', 'removeCharacter'].includes(a.type) && a.params.characterId) return `char:${a.params.characterId}`;
  if (a.type === 'dialogue' && a.params.speaker) return `char:${a.params.speaker}`;
  if (a.type === 'showImage' || a.type === 'hideImage') return `image:${a.params.slot}`;
  return null;
}

type DragMode = 'move' | 'scale' | 'rotate';

export function Stage({ scene, state, sources, selectedAction, onFold }: { scene: Scene; state: VisualState; sources: Record<string, string>; selectedAction?: Action; onFold?: () => void }) {
  const project = useProject((s) => s.project)!;
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 640, h: 360 });
  const [snap, setSnap] = useState(true);
  const [guide, setGuide] = useState(false);
  const [dropping, setDropping] = useState(false);
  const res = project.settings.resolution;
  const stageShare = useUi((s) => s.workspace.stageShare);
  const assetMap = useMemo(() => new Map(project.assets.map((a) => [a.id, a])), [project.assets]);
  const charMap = useMemo(() => new Map(project.characters.map((c) => [c.id, c])), [project.characters]);
  const target = selectedTarget(selectedAction);
  const actionById = useMemo(() => new Map(scene.actions.map((a) => [a.id, a])), [scene.actions]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const maxH = Math.max(160, window.innerHeight * stageShare);
      const w = Math.min(el.clientWidth, (maxH * res.width) / res.height);
      setSize({ w, h: (w * res.height) / res.width });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [res.width, res.height, stageShare]);

  /** The action whose parameters control a stage element (what dragging edits). */
  const sourceAction = (key: string): Action | undefined => {
    const id = sources[key];
    const a = id ? actionById.get(id) : undefined;
    return a && EDITABLE.has(a.type) ? a : undefined;
  };

  const snapVal = (v: number, step: number) => (snap ? Math.round(v / step) * step : Math.round(v * 10) / 10);

  const startDrag = (e: React.PointerEvent, key: string, mode: DragMode) => {
    e.stopPropagation();
    e.preventDefault();
    const src = sourceAction(key);
    const selectId = src?.id ?? sources[key];
    if (selectId) useUi.getState().selectActions([selectId]);
    if (!src) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const p0 = { ...src.params };
    const el = (e.currentTarget as HTMLElement).closest('.stage-el') as HTMLElement | null;
    const rect = el?.getBoundingClientRect();
    const onMove = (ev: PointerEvent) => {
      const dx = ((ev.clientX - startX) / size.w) * 100;
      const dy = ((ev.clientY - startY) / size.h) * 100;
      if (mode === 'move') {
        let x = snapVal((p0.x ?? 50) + dx, 1);
        if (snap && Math.abs(x - 50) < 2) x = 50;
        const y = snapVal((p0.y ?? 100) + dy, 1);
        setGuide(x === 50);
        updateActionParams(scene.id, src.id, { x, y }, `stage:${src.id}`);
      } else if (mode === 'scale' && rect) {
        const grow = (ev.clientX - startX + (ev.clientY - startY)) / Math.max(40, rect.height);
        const scale = Math.max(0.1, Math.min(3, snapVal((p0.scale ?? 1) * (1 + grow), 0.05)));
        updateActionParams(scene.id, src.id, { scale }, `stage:${src.id}`);
      } else if (mode === 'rotate' && rect) {
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        let deg = (Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180) / Math.PI + 90;
        if (deg > 180) deg -= 360;
        updateActionParams(scene.id, src.id, { rotation: snap ? Math.round(deg / 15) * 15 : Math.round(deg) }, `stage:${src.id}`);
      }
    };
    const onUp = () => {
      setGuide(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const editSelected = (patch: (p: Record<string, any>) => Record<string, any>) => {
    if (!target) return;
    const src = sourceAction(target);
    if (src) updateActionParams(scene.id, src.id, patch(src.params));
  };
  const selectedSource = target ? sourceAction(target) : undefined;

  const onDrop = (e: React.DragEvent) => {
    setDropping(false);
    const rect = stageRef.current?.getBoundingClientRect();
    const x = rect ? ((e.clientX - rect.left) / rect.width) * 100 : 50;
    const y = rect ? ((e.clientY - rect.top) / rect.height) * 100 : 50;
    const assets = getDrag<{ ids: string[] }>(e, DND_ASSETS);
    const ch = getDrag<{ characterId: string; expressionId: string }>(e, DND_CHARACTER);
    const acts: Action[] = [];
    if (ch) acts.push(actionForCharacter(ch.characterId, ch.expressionId, state, snapVal(x, 1)));
    for (const id of assets?.ids ?? []) {
      const a = assetMap.get(id);
      const act = a && actionForAsset(project, a, state, snapVal(x, 1), snapVal(y, 1));
      if (act) acts.push(act);
    }
    if (acts.length) {
      e.preventDefault();
      insertActions(scene.id, acts);
    }
  };

  const bg = state.background;
  const bgAsset = bg?.assetId ? assetMap.get(bg.assetId) : undefined;
  const dialogueText = selectedAction && (selectedAction.type === 'dialogue' || selectedAction.type === 'narration') ? selectedAction.params.text : null;
  const speaker = selectedAction?.type === 'dialogue' ? charMap.get(selectedAction.params.speaker) : undefined;

  return (
    <div className="stage-wrap">
      <div className="stage-toolbar">
        <button className={`btn sm ${snap ? 'active' : ''}`} onClick={() => setSnap(!snap)} title={tr("Snap to grid and center")}>
          {tr("🧲 Snap")}
        </button>
        <span className="faint small">{tr("Align:")}</span>
        {(['left', 'center', 'right'] as const).map((pos) => (
          <button key={pos} className="btn sm" disabled={!selectedSource} onClick={() => editSelected(() => ({ x: POSITION_X[pos] }))} title={tr("Align {0}", { 0: pos })} data-testid={`align-${pos}`}>
            {pos === 'left' ? '⇤' : pos === 'center' ? '↔' : '⇥'}
          </button>
        ))}
        <button className="btn sm" disabled={!selectedSource} onClick={() => editSelected((p) => ({ flip: !p.flip }))} title={tr("Flip horizontally")}>
          {tr("⇋ Flip")}
        </button>
        <button className="btn sm" disabled={!selectedSource} onClick={() => editSelected((p) => ({ layer: (p.layer ?? 1) + 1 }))} title={tr("Bring forward")}>
          {tr("⬆ Layer")}
        </button>
        <button className="btn sm" disabled={!selectedSource} onClick={() => editSelected((p) => ({ layer: (p.layer ?? 1) - 1 }))} title={tr("Send backward")}>
          {tr("⬇ Layer")}
        </button>
        <button className="btn sm" disabled={!selectedSource} onClick={() => editSelected(() => ({ scale: 1, rotation: 0, opacity: 1 }))} title={tr("Reset scale, rotation and opacity")}>
          {tr("⟲ Reset")}
        </button>
        <span className="grow" />
        <button className="btn sm" onClick={playFromStart} title={tr("Play from the title screen (F5)")}>
          {tr("▶ Play")}
        </button>
        <button className="btn sm primary" onClick={playFromHere} title={tr("Play from the selected action (Shift+F5)")} data-testid="play-from-here">
          {tr("▶ Play From Here")}
        </button>
        {onFold && (
          <button className="btn ghost sm icon" onClick={onFold} title={tr("Fold the stage preview")} aria-label={tr("Fold the stage preview")} data-testid="fold-stage">
            ▴
          </button>
        )}
      </div>
      <div ref={wrapRef} style={{ width: '100%' }}>
        <div
          ref={stageRef}
          className={`stage-outer ${dropping ? 'drop-target' : ''}`}
          style={{ width: size.w, height: size.h, maxHeight: 'none', aspectRatio: 'auto' }}
          onDragOver={(e) => {
            if (hasDrag(e, DND_ASSETS) || hasDrag(e, DND_CHARACTER)) {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
              setDropping(true);
            }
          }}
          onDragLeave={() => setDropping(false)}
          onDrop={onDrop}
          onPointerDown={() => useUi.getState().selectActions(sources.background ? [sources.background] : [])}
          data-testid="stage"
        >
          <div className="stage-bg" style={{ background: bg?.color ?? '#000' }}>
            {bgAsset && <img src={assetUrl(bgAsset)} alt="" draggable={false} />}
          </div>
          {state.characters.map((c) => {
            const ch = charMap.get(c.id);
            const expr = ch?.expressions.find((e) => e.id === c.expressionId) ?? ch?.expressions[0];
            const a = expr ? assetMap.get(expr.assetId) : undefined;
            const key = `char:${c.id}`;
            const editable = !!sourceAction(key);
            return (
              <div
                key={key}
                className={`stage-el char ${target === key ? 'selected' : ''} ${editable ? '' : 'locked'}`}
                style={charBoxStyle(c)}
                onPointerDown={(e) => startDrag(e, key, 'move')}
                title={`${ch?.name ?? 'Character'}${editable ? ' — drag to move' : ' — add a Move Character action to reposition here'}`}
                data-testid={`stage-char-${ch?.name}`}
              >
                {a ? <img src={assetUrl(a)} alt={ch?.name} style={{ transform: c.flip ? 'scaleX(-1)' : undefined }} /> : <div className="tvn-missing" style={{ height: '100%', aspectRatio: '1/2', padding: 4 }}>{ch?.name}</div>}
                {target === key && editable && (
                  <>
                    <span className="stage-handle scale" onPointerDown={(e) => startDrag(e, key, 'scale')} title={tr("Drag to scale")} />
                    <span className="stage-handle rotate" onPointerDown={(e) => startDrag(e, key, 'rotate')} title={tr("Drag to rotate")} />
                  </>
                )}
              </div>
            );
          })}
          {state.images.map((img) => {
            const a = assetMap.get(img.assetId);
            const key = `image:${img.slot}`;
            const editable = !!sourceAction(key);
            return (
              <div
                key={key}
                className={`stage-el image ${target === key ? 'selected' : ''}`}
                style={imageBoxStyle(img, a, res)}
                onPointerDown={(e) => startDrag(e, key, 'move')}
                title={img.slot}
              >
                {a && <img src={assetUrl(a)} alt={img.slot} style={{ transform: img.flip ? 'scaleX(-1)' : undefined }} />}
                {target === key && editable && (
                  <>
                    <span className="stage-handle scale" onPointerDown={(e) => startDrag(e, key, 'scale')} />
                    <span className="stage-handle rotate" onPointerDown={(e) => startDrag(e, key, 'rotate')} />
                  </>
                )}
              </div>
            );
          })}
          {state.cg && assetMap.get(state.cg) && (
            <div className="stage-cg" style={{ pointerEvents: 'none' }}>
              <img src={assetUrl(assetMap.get(state.cg)!)} alt="CG" />
            </div>
          )}
          {selectedAction?.type === 'pointAndClick' &&
            ((selectedAction.params.hotspots ?? []) as Hotspot[]).map((h, i) => {
              const img = h.assetId ? assetMap.get(h.assetId) : undefined;
              const drag = (e: React.PointerEvent, mode: 'move' | 'size') => {
                e.stopPropagation();
                e.preventDefault();
                const x0 = e.clientX;
                const y0 = e.clientY;
                const start = { ...h };
                const onMove = (ev: PointerEvent) => {
                  const dx = ((ev.clientX - x0) / size.w) * 100;
                  const dy = ((ev.clientY - y0) / size.h) * 100;
                  const next =
                    mode === 'move'
                      ? { x: Math.max(0, Math.min(100 - start.w, snapVal(start.x + dx, 1))), y: Math.max(0, Math.min(100 - start.h, snapVal(start.y + dy, 1))) }
                      : { w: Math.max(2, Math.min(100 - start.x, snapVal(start.w + dx, 1))), h: Math.max(2, Math.min(100 - start.y, snapVal(start.h + dy, 1))) };
                  const list = ((selectedAction.params.hotspots ?? []) as Hotspot[]).map((x) => (x.id === h.id ? { ...x, ...next } : x));
                  updateActionParams(scene.id, selectedAction.id, { hotspots: list }, `hotspot:${h.id}`);
                };
                const onUp = () => {
                  window.removeEventListener('pointermove', onMove);
                  window.removeEventListener('pointerup', onUp);
                };
                window.addEventListener('pointermove', onMove);
                window.addEventListener('pointerup', onUp);
              };
              return (
                <div
                  key={h.id}
                  className="stage-hotspot"
                  style={{ left: `${h.x}%`, top: `${h.y}%`, width: `${h.w}%`, height: `${h.h}%` }}
                  onPointerDown={(e) => drag(e, 'move')}
                  title={tr("{0} — drag to move", { 0: h.label })}
                  data-testid={`stage-hotspot-${i}`}
                >
                  {img && <img src={assetUrl(img)} alt="" draggable={false} />}
                  <span className="stage-hotspot-label">{h.label || '?'}</span>
                  <span className="stage-hotspot-size" onPointerDown={(e) => drag(e, 'size')} title={tr("Drag to resize")} data-testid={`stage-hotspot-size-${i}`} />
                </div>
              );
            })}
          {guide && <div className="stage-guide" style={{ left: '50%' }} />}
          {dialogueText !== null && dialogueText !== undefined && (
            <div className="stage-dialog">
              {speaker && <b style={{ color: speaker.color }}>{speaker.displayName || speaker.name}</b>}
              <div className="ellipsis">{dialogueText || '…'}</div>
            </div>
          )}
          {!bg && state.characters.length === 0 && (
            <div className="stage-empty">
              {tr("Drag a background or character here")}
              <br />
              {tr("or use the quick buttons below.")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
