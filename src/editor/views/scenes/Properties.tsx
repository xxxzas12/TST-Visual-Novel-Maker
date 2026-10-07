import { t as tr } from '../../../shared/i18n';
import type { Issue } from '../../../shared/validate';
import type { Scene } from '../../../shared/types';
import { getActionDef, isKnownActionType } from '../../../shared/actions';
import { useProject } from '../../store/project';
import { useUi, promptDialog } from '../../store/ui';
import { deleteActions, duplicateActions, findScene, renameScene, saveActionTemplate, toggleDisabled } from '../../sceneOps';
import { FieldRenderer } from './fields';
import { playFromHere } from '../Shell';

export function Properties({ scene, issues }: { scene: Scene; issues: Issue[] }) {
  const actionIds = useUi((s) => s.actionIds);
  const startSceneId = useProject((s) => s.project?.settings.startSceneId);
  const selected = scene.actions.filter((a) => actionIds.includes(a.id));

  if (selected.length > 1) {
    return (
      <div className="col" data-testid="props-multi">
        <h3>{tr("{0} actions selected", { 0: selected.length })}</h3>
        <button
          className="btn primary"
          onClick={async () => {
            const name = await promptDialog({ title: tr("Save as Action Template"), label: tr("Template name"), value: tr("Character Introduction"), confirmLabel: tr("Save") });
            if (name) saveActionTemplate(scene.id, actionIds, name);
          }}
          data-testid="save-template"
        >
          {tr("⭐ Save as Template")}
        </button>
        <button className="btn" onClick={() => duplicateActions(scene.id, actionIds)}>
          {tr("⧉ Duplicate")}
        </button>
        <button className="btn" onClick={() => toggleDisabled(scene.id, actionIds)}>
          {tr("☑ Enable / Disable")}
        </button>
        <button className="btn danger" onClick={() => deleteActions(scene.id, actionIds)}>
          {tr("🗑 Delete")}
        </button>
        <p className="small faint">{tr("Tip: drag the selected rows to move them together.")}</p>
      </div>
    );
  }

  if (selected.length === 0) {
    return (
      <div className="col" data-testid="props-scene">
        <div className="section-title">{tr("Scene")}</div>
        <div className="field">
          <span className="field-label">{tr("Name")}</span>
          <input className="input" value={scene.name} onChange={(e) => renameScene(scene.id, e.target.value || ' ')} data-testid="scene-name" />
        </div>
        <div className="field">
          <span className="field-label">{tr("Tags (comma separated)")}</span>
          <input
            className="input"
            value={scene.tags.join(', ')}
            onChange={(e) =>
              useProject.getState().update((p) => {
                const s = findScene(p, scene.id);
                if (s) s.tags = e.target.value.split(',').map((t) => t.trim()).filter(Boolean);
              }, `tags:${scene.id}`)
            }
          />
        </div>
        <label className="check field">
          <input
            type="checkbox"
            checked={startSceneId === scene.id}
            onChange={() => useProject.getState().update((p) => void (p.settings.startSceneId = scene.id))}
            disabled={startSceneId === scene.id}
          />
          {tr("🚩 Game starts with this scene")}
        </label>
        <div className="small muted">{tr("{0} action(s)", { 0: scene.actions.length })}</div>
        <div className="sub-card small muted" style={{ marginTop: '0.8rem' }}>
          <b style={{ color: 'var(--text)' }}>{tr("How to build a scene")}</b>
          <ol style={{ margin: '0.4rem 0 0', paddingLeft: '1.2rem', lineHeight: 1.6 }}>
            <li>{tr("Drag a background onto the stage.")}</li>
            <li>{tr("Drag a character expression onto the stage.")}</li>
            <li>{tr("Click 💬 Dialogue and type the line.")}</li>
            <li>{tr("Add a 🔀 Choice to branch the story.")}</li>
            <li>{tr("Press ▶ Play From Here to test.")}</li>
          </ol>
        </div>
      </div>
    );
  }

  const a = selected[0];
  const index = scene.actions.indexOf(a);
  if (!isKnownActionType(a.type)) return <div className="issue-box">{tr("Unknown action type “{type}”.", { type: a.type })}</div>;
  const def = getActionDef(a.type);
  const own = issues.filter((i) => i.actionId === a.id);
  const patch = (p: Record<string, any>, coalesce?: string) =>
    useProject.getState().update((d) => {
      const act = findScene(d, scene.id)?.actions.find((x) => x.id === a.id);
      if (act) Object.assign(act.params, p);
    }, coalesce ? `${a.id}:${coalesce}` : undefined);

  return (
    <div data-testid="props-action">
      <div className="row" style={{ marginBottom: '0.3rem' }}>
        <span style={{ fontSize: '1.3rem' }}>{def.icon}</span>
        <h3 className="grow">{tr(def.label)}</h3>
        <span className="badge">#{index + 1}</span>
      </div>
      <p className="small muted" style={{ marginTop: 0 }}>
        {tr(def.description)}
      </p>
      {own.map((i, k) => (
        <div key={k} className={`issue-box ${i.severity === 'warning' ? 'warn' : ''}`}>
          {i.severity === 'error' ? '⛔' : '⚠️'} {i.message.replace(`${scene.name}: `, '')}
        </div>
      ))}
      {def.fields.map((f) => {
        if (def.visibleWhen?.[f.key] && !def.visibleWhen[f.key](a.params)) return null;
        return <FieldRenderer key={f.key} spec={f} params={a.params} onPatch={patch} scene={scene} />;
      })}
      <div className="field">
        <span className="field-label">{tr("Note (only visible in the editor)")}</span>
        <input
          className="input"
          value={a.note ?? ''}
          onChange={(e) =>
            useProject.getState().update((d) => {
              const act = findScene(d, scene.id)?.actions.find((x) => x.id === a.id);
              if (act) act.note = e.target.value;
            }, `${a.id}:note`)
          }
        />
      </div>
      <label className="check field">
        <input type="checkbox" checked={!a.disabled} onChange={() => toggleDisabled(scene.id, [a.id])} /> {tr("Enabled")}
      </label>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <button className="btn sm primary" onClick={playFromHere}>
          {tr("▶ Play From Here")}
        </button>
        <button className="btn sm" onClick={() => duplicateActions(scene.id, [a.id])}>
          {tr("⧉ Duplicate")}
        </button>
        <button className="btn sm danger" onClick={() => deleteActions(scene.id, [a.id])}>
          {tr("🗑 Delete")}
        </button>
      </div>
    </div>
  );
}
