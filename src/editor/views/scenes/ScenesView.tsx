import { t as tr } from '../../../shared/i18n';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import type { ActionType } from '../../../shared/types';
import { validateProject } from '../../../shared/validate';
import { THEME_PRESETS } from '../../../shared/themes';
import { useProject } from '../../store/project';
import { useUi } from '../../store/ui';
import { addAction, addScene, findScene, insertActionTemplate } from '../../sceneOps';
import { SceneTree } from './SceneTree';
import { AssetDrawer, CharacterDrawer } from './SceneDrawers';
import { Stage, useStageState } from './Stage';
import { ActionList } from './ActionList';
import { ActionMenu } from './ActionMenu';
import { Properties } from './Properties';

type LeftTab = 'scenes' | 'assets' | 'characters';

export function ScenesView() {
  const project = useProject((s) => s.project)!;
  const sceneId = useUi((s) => s.sceneId);
  const actionIds = useUi((s) => s.actionIds);
  const [tab, setTab] = useState<LeftTab>('scenes');
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

  return (
    <div className="scene-layout">
      <aside className="left-pane">
        <div className="tabs" role="tablist">
          {(['scenes', 'assets', 'characters'] as LeftTab[]).map((t) => (
            <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)} role="tab" aria-selected={tab === t} data-testid={`left-tab-${t}`}>
              {t === 'scenes' ? tr("🎬 Scenes") : t === 'assets' ? tr("🗂️ Assets") : tr("🧍 Cast")}
            </button>
          ))}
        </div>
        <div className="left-scroll">
          {tab === 'scenes' && <SceneTree />}
          {tab === 'assets' && <AssetDrawer stage={state} />}
          {tab === 'characters' && <CharacterDrawer stage={state} />}
        </div>
      </aside>

      <section className="center-pane">
        <Stage scene={scene} state={state} sources={sources} selectedAction={selectedAction} />
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
            className="select"
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

      <aside className="props">
        <Properties scene={scene} issues={issues} />
      </aside>

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
