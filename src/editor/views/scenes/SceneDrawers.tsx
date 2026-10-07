import { t as tr } from '../../../shared/i18n';
import { useMemo, useState } from 'react';
import type { Asset, AssetType } from '../../../shared/types';
import { filterAssets } from '../../../shared/search';
import { useProject } from '../../store/project';
import { useUi } from '../../store/ui';
import { AssetThumb } from '../../components/AssetThumb';
import { DND_ASSETS, DND_CHARACTER, setDrag } from '../../dnd';
import { actionForAsset, actionForCharacter, insertActions } from '../../sceneOps';
import { pickAndImportFolder } from '../../ops';
import type { VisualState } from '../../../runtime/core/state';
import { thumbUrl } from '../../assetUrl';

const GROUPS: { label: string; types: AssetType[] }[] = [
  { label: 'All', types: [] },
  { label: 'BG', types: ['background'] },
  { label: 'Chars', types: ['character', 'portrait'] },
  { label: 'CG', types: ['cg'] },
  { label: 'Audio', types: ['music', 'sfx', 'voice'] },
  { label: 'Other', types: ['ui', 'video', 'unknown'] },
];

export function AssetDrawer({ stage }: { stage: VisualState }) {
  const assets = useProject((s) => s.project?.assets ?? []);
  const sceneId = useUi((s) => s.sceneId);
  const [group, setGroup] = useState(0);
  const [q, setQ] = useState('');
  const list = useMemo(() => filterAssets(assets, { query: q, types: GROUPS[group].types }), [assets, q, group]);
  const add = (a: Asset) => {
    const p = useProject.getState().project;
    if (!p || !sceneId) return;
    const act = actionForAsset(p, a, stage);
    if (act) insertActions(sceneId, [act]);
  };
  if (!assets.length) {
    return (
      <div className="empty">
        <div className="big">📥</div>
        <div className="small">{tr("No assets yet.")}</div>
        <button className="btn sm primary" onClick={() => void pickAndImportFolder()}>
          {tr("Import Folder…")}
        </button>
      </div>
    );
  }
  return (
    <div className="col" style={{ gap: '0.4rem' }}>
      <input className="input" placeholder={tr("🔍 Search assets")} value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="tags">
        {GROUPS.map((g, i) => (
          <button key={g.label} className={`chip ${group === i ? 'on' : ''}`} onClick={() => setGroup(i)}>
            {tr(g.label)}
          </button>
        ))}
      </div>
      <div className="small faint">{tr("Drag onto the stage or action list, or double-click to add.")}</div>
      <div className="mini-gallery">
        {list.slice(0, 400).map((a) => (
          <div
            key={a.id}
            className="mini-tile"
            draggable
            onDragStart={(e) => setDrag(e, DND_ASSETS, { ids: [a.id], paths: [a.path] })}
            onDoubleClick={() => add(a)}
            title={tr("{0} ({1}) — double-click to add", { 0: a.name, 1: a.type })}
            data-testid={`drawer-${a.name}`}
          >
            <div className="t">
              <AssetThumb asset={a} />
            </div>
            <div className="n ellipsis">{a.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CharacterDrawer({ stage }: { stage: VisualState }) {
  const project = useProject((s) => s.project)!;
  const sceneId = useUi((s) => s.sceneId);
  const assetMap = useMemo(() => new Map(project.assets.map((a) => [a.id, a])), [project.assets]);
  if (!project.characters.length) {
    return (
      <div className="empty">
        <div className="big">🧍</div>
        <div className="small">{tr("No characters yet. Import a “Characters/Name/expression.png” folder or create one in Characters.")}</div>
        <button className="btn sm" onClick={() => useUi.getState().setView('characters')}>
          {tr("Open Characters")}
        </button>
      </div>
    );
  }
  return (
    <div className="col" style={{ gap: '0.6rem' }}>
      <div className="small faint">{tr("Drag an expression onto the stage. If the character is already there, its expression changes.")}</div>
      {project.characters.map((c) => (
        <div key={c.id}>
          <div className="row" style={{ marginBottom: '0.25rem' }}>
            <span style={{ width: 10, height: 10, borderRadius: 5, background: c.color }} />
            <b className="grow">{c.name}</b>
            {stage.characters.some((x) => x.id === c.id) && <span className="badge ok">{tr("on stage")}</span>}
          </div>
          <div className="mini-gallery">
            {c.expressions.map((e) => {
              const a = assetMap.get(e.assetId);
              const url = a ? thumbUrl(a) : null;
              return (
                <div
                  key={e.id}
                  className="mini-tile"
                  draggable
                  onDragStart={(ev) => setDrag(ev, DND_CHARACTER, { characterId: c.id, expressionId: e.id })}
                  onDoubleClick={() => sceneId && insertActions(sceneId, [actionForCharacter(c.id, e.id, stage)])}
                  title={`${c.name} — ${e.name}`}
                  data-testid={`drawer-char-${c.name}-${e.name}`}
                >
                  <div className="t">{url ? <img src={url} alt={e.name} loading="lazy" /> : '🧍'}</div>
                  <div className="n ellipsis">{e.name}</div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
