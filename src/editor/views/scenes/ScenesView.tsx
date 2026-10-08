import { t as tr } from '../../../shared/i18n';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { ActionType } from '../../../shared/types';
import { validateProject } from '../../../shared/validate';
import { THEME_PRESETS } from '../../../shared/themes';
import { useProject } from '../../store/project';
import { setWorkspace, useUi } from '../../store/ui';
import { LIMITS, workspaceLayout, type LeftTab, type PanelId } from '../../../shared/workspace';
import { PanelRail, Splitter } from '../../components/Splitter';
import { addAction, addScene, findScene, insertActionTemplate } from '../../sceneOps';
import { SceneTree } from './SceneTree';
import { AssetDrawer, CharacterDrawer } from './SceneDrawers';
import { Stage, useStageState } from './Stage';
import { ActionList } from './ActionList';
import { ActionMenu } from './ActionMenu';
import { Properties } from './Properties';

export function ScenesView() {
  const project = useProject((s) => s.project)!;
  const sceneId = useUi((s) => s.sceneId);
  const actionIds = useUi((s) => s.actionIds);
  const ws = useUi((s) => s.workspace);
  // The tab starts on the workspace's tab (e.g. Assets in Art / Assets); switching tabs is not a layout change.
  const [tab, setTab] = useState<LeftTab>(ws.leftTab);
  useEffect(() => setTab(ws.leftTab), [ws.leftTab]);
  // Size of a panel when a splitter drag starts.
  const dragStart = useRef(0);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const scene = findScene(project, sceneId);

  useEffect(() => {
    if (!scene && project.scenes.length) useUi.getState().selectScene(project.chapters.flatMap((c) => c.sceneIds)[0] ?? project.scenes[0].id);
  }, [scene, project]);

  const lastSelectedIndex = scene ? Math.max(-1, ...scene.actions.map((a, i) => (actionIds.includes(a.id) ? i : -1))) : -1;
  // The stage shows the state right after the selected action (or the whole scene when nothing is selected).
  const upto = scene ? (lastSelectedIndex >= 0 ? lastSelectedIndex + 1 : scene.actions.length) : 0;
  const { state, sources } = useStageState(project, scene, upto);

  const deferred = useDeferredValue(project);
  const issues = useMemo(() => (scene ? validateProject(deferred).filter((i) => i.sceneId === scene.id) : []), [deferred, scene]);
  const issueIds = useMemo(() => new Set(issues.filter((i) => i.severity === 'error').map((i) => i.actionId!)), [issues]);

  if (!scene) {
    return (
      <div className="empty" style={{ flex: 1 }}>
        <div className="big">🎬</div>
        <button className="btn primary" onClick={() => addScene()}>
          {tr("＋ Create a scene")}
        </button>
      </div>
    );
  }

  const quick = (type: ActionType, params: Record<string, any> = {}) => addAction(scene.id, type, params);
  const firstChar = project.characters[0];
  const selectedAction = lastSelectedIndex >= 0 ? scene.actions[lastSelectedIndex] : undefined;

  const fold = (id: PanelId) => setWorkspace({ panels: { ...ws.panels, [id]: 'collapsed' } });
  const unfold = (id: PanelId) => setWorkspace({ panels: { ...ws.panels, [id]: 'open' } });
  const presetSize = (key: 'leftWidth' | 'inspectorWidth' | 'stageShare') => (workspaceLayout(ws.base, useUi.getState().customWorkspaces) ?? workspaceLayout('default', [])!)[key];
  const clampTo = (v: number, lim: { min: number; max: number }) => Math.round(Math.min(lim.max, Math.max(lim.min, v)) * 1000) / 1000;
  // Dragging toward the panel's outer edge makes it smaller.
  const resize = (key: 'leftWidth' | 'inspectorWidth', outerOnLeft: boolean) => ({
    onDragStart: () => (dragStart.current = useUi.getState().workspace[key]),
    onDrag: (d: number) => setWorkspace({ [key]: clampTo(dragStart.current + (outerOnLeft ? d : -d), LIMITS[key]) }),
    onStep: (d: number) => setWorkspace({ [key]: clampTo(useUi.getState().workspace[key] + (outerOnLeft ? d : -d), LIMITS[key]) }),
    onReset: () => setWorkspace({ [key]: presetSize(key) }),
  });

  const leftSide = !ws.swapSides;
  const leftPanel =
    ws.panels.left === 'open' ? (
      <aside className="left-pane" style={{ width: ws.leftWidth }} data-testid="panel-left">
        <div className="tabs" role="tablist">
          {(['scenes', 'assets', 'characters'] as LeftTab[]).map((t) => (
            <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)} role="tab" aria-selected={tab === t} data-testid={`left-tab-${t}`}>
              {t === 'scenes' ? tr("🎬 Scenes") : t === 'assets' ? tr("🗂️ Assets") : tr("🧍 Cast")}
            </button>
          ))}
          <button className="btn ghost sm icon" onClick={() => fold('left')} title={tr("Fold this panel")} aria-label={tr("Fold this panel")} data-testid="fold-left">
            {ws.swapSides ? '»' : '«'}
          </button>
        </div>
        <div className="left-scroll">
          {tab === 'scenes' && <SceneTree />}
          {tab === 'assets' && <AssetDrawer stage={state} />}
          {tab === 'characters' && <CharacterDrawer stage={state} />}
        </div>
      </aside>
    ) : ws.panels.left === 'collapsed' ? (
      <PanelRail icon="🎬" label={tr("Scenes, assets & cast")} side={leftSide ? 'left' : 'right'} onOpen={() => unfold('left')} testId="rail-left" />
    ) : null;
  const leftSplit = ws.panels.left === 'open' && <Splitter axis="x" label={tr("Drag to resize the panel (double-click: reset)")} {...resize('leftWidth', leftSide)} testId="split-left" />;
  const inspector =
    ws.panels.inspector === 'open' ? (
      <aside className="props" style={{ width: ws.inspectorWidth }} data-testid="panel-inspector">
        <div className="panel-head">
          <span className="grow">{tr("Properties")}</span>
          <button className="btn ghost sm icon" onClick={() => fold('inspector')} title={tr("Fold this panel")} aria-label={tr("Fold this panel")} data-testid="fold-inspector">
            {ws.swapSides ? '«' : '»'}
          </button>
        </div>
        <Properties scene={scene} issues={issues} />
      </aside>
    ) : ws.panels.inspector === 'collapsed' ? (
      <PanelRail icon="⚙" label={tr("Properties")} side={leftSide ? 'right' : 'left'} onOpen={() => unfold('inspector')} testId="rail-inspector" />
    ) : null;
  const inspectorSplit = ws.panels.inspector === 'open' && <Splitter axis="x" label={tr("Drag to resize the panel (double-click: reset)")} {...resize('inspectorWidth', !leftSide)} testId="split-inspector" />;

  return (
    <div className="scene-layout">
      {leftSide ? leftPanel : inspector}
      {leftSide ? leftSplit : inspectorSplit}
      <section className="center-pane">
        {ws.panels.stage === 'open' ? (
          <>
            <Stage scene={scene} state={state} sources={sources} selectedAction={selectedAction} onFold={() => fold('stage')} />
            <Splitter
              axis="y"
              label={tr("Drag to resize the stage (double-click: reset)")}
              onDragStart={() => (dragStart.current = useUi.getState().workspace.stageShare)}
              onDrag={(d) => setWorkspace({ stageShare: clampTo(dragStart.current + d / window.innerHeight, LIMITS.stageShare) })}
              onStep={(d) => setWorkspace({ stageShare: clampTo(useUi.getState().workspace.stageShare + d / window.innerHeight, LIMITS.stageShare) })}
              onReset={() => setWorkspace({ stageShare: presetSize('stageShare') })}
              testId="split-stage"
            />
          </>
        ) : ws.panels.stage === 'collapsed' ? (
          <button className="stage-folded" onClick={() => unfold('stage')} data-testid="rail-stage">
            {tr("🖼 Stage preview is folded — click to show it")}
          </button>
        ) : null}
        <div className="quickbar" aria-label={tr("Quick actions")}>
          <b className="ellipsis" style={{ maxWidth: '12rem' }} title={scene.name} data-testid="current-scene">
            {scene.name}
          </b>
          <span className="faint">|</span>
          <button className="btn sm" onClick={() => quick('dialogue', { speaker: firstChar?.id ?? '', text: '' })} title={tr("Add a dialogue line")} data-testid="quick-dialogue">
            {tr("💬 Dialogue")}
          </button>
          <button className="btn sm" onClick={() => quick('addCharacter', { characterId: firstChar?.id ?? '' })} title={tr("Bring a character on stage")} data-testid="quick-character">
            {tr("🧍 Character")}
          </button>
          <button className="btn sm" onClick={() => quick('changeBackground')} title={tr("Change the background")} data-testid="quick-background">
            {tr("🏞️ Background")}
          </button>
          <button className="btn sm" onClick={() => quick('choice')} title={tr("Add a choice")} data-testid="quick-choice">
            {tr("🔀 Choice")}
          </button>
          <button className="btn sm" onClick={() => quick('playBGM')} title={tr("Play background music")} data-testid="quick-audio">
            {tr("🎵 Audio")}
          </button>
          <button
            className="btn sm primary"
            onClick={(e) => {
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setMenu({ x: r.left, y: r.bottom + 4 });
            }}
            title={tr("All actions (search, categories, templates)")}
            data-testid="add-action"
          >
            {tr("＋ Action")}
          </button>
          <span className="grow" />
          <select
            className="select sm"
            style={{ width: 'auto', maxWidth: '11rem' }}
            value={scene.themeId ?? ''}
            onChange={(e) => useProject.getState().update((p) => void (findScene(p, scene.id)!.themeId = e.target.value || null))}
            title={tr("Game UI theme of this scene")}
            aria-label={tr("Game UI theme of this scene")}
            data-testid="scene-theme"
          >
            <option value="">{tr("🎨 Project theme")}</option>
            {[...THEME_PRESETS, ...project.themes].map((t) => (
              <option key={t.id} value={t.id}>
                🎨 {tr(t.name)}
              </option>
            ))}
          </select>
          <span className="small faint">{tr("{0} actions", { 0: scene.actions.length })}</span>
        </div>
        <ActionList scene={scene} issueIds={issueIds} stage={state} />
      </section>
      {leftSide ? inspectorSplit : leftSplit}
      {leftSide ? inspector : leftPanel}

      {menu && (
        <ActionMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          onPick={(type) => {
            setMenu(null);
            quick(type);
          }}
          onPickTemplate={(id) => {
            setMenu(null);
            insertActionTemplate(scene.id, id);
          }}
        />
      )}
    </div>
  );
}
