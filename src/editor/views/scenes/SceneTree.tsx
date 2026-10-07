import { t as tr } from '../../../shared/i18n';
import { useMemo, useState } from 'react';
import { useProject } from '../../store/project';
import { useUi, promptDialog } from '../../store/ui';
import { searchScenes } from '../../../shared/search';
import { DND_SCENE, getDrag, hasDrag, setDrag } from '../../dnd';
import {
  addChapter,
  addScene,
  deleteChapter,
  deleteScene,
  duplicateChapter,
  duplicateScene,
  moveChapter,
  moveScene,
  renameChapter,
  renameScene,
  toggleChapter,
} from '../../sceneOps';

export function SceneTree() {
  const project = useProject((s) => s.project)!;
  const sceneId = useUi((s) => s.sceneId);
  const selectScene = useUi((s) => s.selectScene);
  const [query, setQuery] = useState('');
  const [dropAt, setDropAt] = useState<{ chapterId: string; index: number } | null>(null);
  const sceneMap = useMemo(() => new Map(project.scenes.map((s) => [s.id, s])), [project.scenes]);
  const hits = useMemo(() => searchScenes(project, query), [project, query]);

  const rename = async (kind: 'scene' | 'chapter', id: string, current: string) => {
    const name = await promptDialog({ title: tr("Rename {0}", { 0: kind }), label: tr("Name"), value: current, confirmLabel: tr("Rename") });
    if (!name) return;
    if (kind === 'scene') renameScene(id, name);
    else renameChapter(id, name);
  };

  const onDropScene = (e: React.DragEvent, chapterId: string, index: number) => {
    const id = getDrag<string>(e, DND_SCENE);
    setDropAt(null);
    if (id) {
      e.preventDefault();
      moveScene(id, chapterId, index);
    }
  };

  return (
    <div className="col" style={{ gap: '0.4rem' }}>
      <input className="input" placeholder={tr("🔍 Search scenes, chapters, tags, dialogue…")} value={query} onChange={(e) => setQuery(e.target.value)} data-testid="scene-search" />
      {query ? (
        <div className="col" style={{ gap: '0.15rem' }} data-testid="scene-search-results">
          {hits.length === 0 && <div className="small faint">{tr("No scenes match “{0}”.", { 0: query })}</div>}
          {hits.map((h) => (
            <div
              key={h.sceneId}
              className={`scene-item ${h.sceneId === sceneId ? 'selected' : ''}`}
              style={{ paddingLeft: '0.4rem', flexDirection: 'column', alignItems: 'flex-start' }}
              onClick={() => {
                selectScene(h.sceneId);
                if (h.actionId) useUi.getState().selectActions([h.actionId]);
              }}
            >
              <span>🎬 {sceneMap.get(h.sceneId)?.name}</span>
              <span className="small faint">
                {h.match === 'dialogue' ? `“${h.snippet}”` : h.match === 'tag' ? tr("tags: {0}", { 0: h.snippet }) : h.match === 'chapter' ? tr("in matching chapter") : tr("name match")}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div role="tree" aria-label={tr("Chapters and scenes")}>
          {project.chapters.map((ch, ci) => (
            <div key={ch.id} className="chapter">
              <div
                className="chapter-head"
                onClick={() => toggleChapter(ch.id)}
                onDragOver={(e) => {
                  if (hasDrag(e, DND_SCENE)) {
                    e.preventDefault();
                    setDropAt({ chapterId: ch.id, index: ch.sceneIds.length });
                  }
                }}
                onDrop={(e) => onDropScene(e, ch.id, ch.sceneIds.length)}
                data-testid={`chapter-${ch.name}`}
              >
                <span className="faint">{ch.collapsed ? '▸' : '▾'}</span>
                <span className="ellipsis grow">📖 {ch.name}</span>
                <button className="btn ghost sm icon" title={tr("Add scene to {0}", { 0: ch.name })} onClick={(e) => (e.stopPropagation(), addScene(ch.id))} data-testid={`add-scene-${ch.name}`}>
                  ＋
                </button>
                <span className="actions">
                  <button className="btn ghost sm icon" title={tr("Rename chapter")} onClick={(e) => (e.stopPropagation(), void rename('chapter', ch.id, ch.name))}>
                    ✏️
                  </button>
                  <button className="btn ghost sm icon" title={tr("Move up")} disabled={ci === 0} onClick={(e) => (e.stopPropagation(), moveChapter(ch.id, -1))}>
                    ↑
                  </button>
                  <button className="btn ghost sm icon" title={tr("Move down")} disabled={ci === project.chapters.length - 1} onClick={(e) => (e.stopPropagation(), moveChapter(ch.id, 1))}>
                    ↓
                  </button>
                  <button className="btn ghost sm icon" title={tr("Duplicate chapter")} onClick={(e) => (e.stopPropagation(), duplicateChapter(ch.id))}>
                    ⧉
                  </button>
                  <button className="btn ghost sm icon" title={tr("Delete chapter")} onClick={(e) => (e.stopPropagation(), void deleteChapter(ch.id))}>
                    🗑
                  </button>
                </span>
              </div>
              {!ch.collapsed &&
                ch.sceneIds.map((sid, i) => {
                  const s = sceneMap.get(sid);
                  if (!s) return null;
                  const isStart = project.settings.startSceneId === sid;
                  return (
                    <div
                      key={sid}
                      className={`scene-item ${sid === sceneId ? 'selected' : ''} ${dropAt?.chapterId === ch.id && dropAt.index === i ? 'drop-before' : ''}`}
                      onClick={() => selectScene(sid)}
                      onDoubleClick={() => void rename('scene', sid, s.name)}
                      draggable
                      onDragStart={(e) => setDrag(e, DND_SCENE, sid)}
                      onDragOver={(e) => {
                        if (hasDrag(e, DND_SCENE)) {
                          e.preventDefault();
                          setDropAt({ chapterId: ch.id, index: i });
                        }
                      }}
                      onDragLeave={() => setDropAt(null)}
                      onDrop={(e) => onDropScene(e, ch.id, i)}
                      role="treeitem"
                      aria-selected={sid === sceneId}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') selectScene(sid);
                        if (e.key === 'F2') void rename('scene', sid, s.name);
                        if (e.key === 'Delete') void deleteScene(sid);
                      }}
                      data-testid={`scene-${s.name}`}
                    >
                      <span>{isStart ? '🚩' : '🎬'}</span>
                      <span className="ellipsis grow" title={tr("{0} — {1} actions", { 0: s.name, 1: s.actions.length })}>
                        {s.name}
                      </span>
                      <span className="actions">
                        <button className="btn ghost sm icon" title={tr("Rename (F2)")} onClick={(e) => (e.stopPropagation(), void rename('scene', sid, s.name))}>
                          ✏️
                        </button>
                        <button className="btn ghost sm icon" title={tr("Duplicate scene")} onClick={(e) => (e.stopPropagation(), duplicateScene(sid))}>
                          ⧉
                        </button>
                        <button className="btn ghost sm icon" title={tr("Delete scene")} onClick={(e) => (e.stopPropagation(), void deleteScene(sid))}>
                          🗑
                        </button>
                      </span>
                    </div>
                  );
                })}
            </div>
          ))}
          <div className="row" style={{ marginTop: '0.4rem' }}>
            <button className="btn sm grow" onClick={() => addScene()} data-testid="add-scene">
              {tr("＋ Scene")}
            </button>
            <button
              className="btn sm grow"
              onClick={async () => {
                const name = await promptDialog({ title: tr("New chapter"), label: tr("Chapter name"), value: tr("Chapter {0}", { 0: project.chapters.length + 1 }), confirmLabel: tr("Create") });
                if (name) addChapter(name);
              }}
              data-testid="add-chapter"
            >
              {tr("＋ Chapter")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
