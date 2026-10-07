import { t as tr } from '../../shared/i18n';
import type { Project, Variable, VariableType } from '../../shared/types';
import { newId } from '../../shared/ids';
import { coerceValue } from '../../runtime/core/state';
import { useProject } from '../store/project';
import { confirmDialog } from '../store/ui';
import { VarValueInput } from './scenes/fields';

export const VAR_NAME = /^[\p{L}\p{N}_]+$/u;

function usages(p: Project, id: string): number {
  let n = 0;
  for (const s of p.scenes)
    for (const a of s.actions) {
      const json = JSON.stringify(a.params);
      if (json.includes(`"${id}"`)) n++;
    }
  return n;
}

export function VariablesView() {
  const project = useProject((s) => s.project)!;
  const update = (id: string, fn: (v: Variable) => void, key?: string) =>
    useProject.getState().update((p) => {
      const v = p.variables.find((x) => x.id === id);
      if (v) fn(v);
    }, key);

  const add = () => {
    let n = project.variables.length + 1;
    while (project.variables.some((v) => v.name === `Variable${n}`)) n++;
    useProject.getState().update((p) => void p.variables.push({ id: newId('v'), name: `Variable${n}`, type: 'number', initial: 0 }));
  };

  const remove = async (v: Variable) => {
    const n = usages(project, v.id);
    if (n && !(await confirmDialog({ title: tr("Delete “{0}”?", { 0: v.name }), message: tr("It is used by {0} action(s). Those actions will show problems until you fix them.", { 0: n }), confirmLabel: tr("Delete"), danger: true }))) return;
    useProject.getState().update((p) => void (p.variables = p.variables.filter((x) => x.id !== v.id)));
  };

  return (
    <>
      <div className="view-header">
        <h2>{tr("Variables")}</h2>
        <span className="muted small">
          {tr("Remember things the player did: money, affection, flags. Show them in text with {Name}.")}
        </span>
        <span className="grow" />
        <button className="btn sm primary" onClick={add} data-testid="add-variable">
          {tr("＋ New Variable")}
        </button>
      </div>
      <div className="view-body">
        {project.variables.length === 0 ? (
          <div className="empty">
            <div className="big">🔢</div>
            <div>{tr("No variables yet. Example: Love_A = 0, Money = 100, QuestComplete = false.")}</div>
          </div>
        ) : (
          <table className="table" data-testid="variables-table">
            <thead>
              <tr>
                <th>{tr("Name")}</th>
                <th style={{ width: '9rem' }}>{tr("Type")}</th>
                <th style={{ width: '12rem' }}>{tr("Starts at")}</th>
                <th>{tr("Description")}</th>
                <th style={{ width: '5rem' }}>{tr("Used")}</th>
                <th style={{ width: '3rem' }} />
              </tr>
            </thead>
            <tbody>
              {project.variables.map((v) => {
                const dup = project.variables.some((x) => x.id !== v.id && x.name === v.name);
                const bad = !VAR_NAME.test(v.name);
                return (
                  <tr key={v.id}>
                    <td>
                      <input
                        className="input"
                        value={v.name}
                        onChange={(e) => update(v.id, (x) => void (x.name = e.target.value.replace(/\s+/g, '_')), `vname:${v.id}`)}
                        style={dup || bad ? { borderColor: 'var(--danger)' } : undefined}
                        aria-label={tr("Variable name")}
                        data-testid={`var-name-${v.name}`}
                      />
                      {(dup || bad) && <div className="small" style={{ color: 'var(--danger)' }}>{dup ? tr("Name already used") : tr("Use letters, numbers and _ only")}</div>}
                    </td>
                    <td>
                      <select
                        className="select"
                        value={v.type}
                        onChange={(e) =>
                          update(v.id, (x) => {
                            x.type = e.target.value as VariableType;
                            x.initial = coerceValue(x.type, x.initial);
                          })
                        }
                        aria-label={tr("Variable type")}
                      >
                        <option value="number">{tr("Number")}</option>
                        <option value="string">{tr("Text")}</option>
                        <option value="boolean">{tr("True / False")}</option>
                      </select>
                    </td>
                    <td>
                      <VarValueInput variable={v} value={v.initial} onChange={(val) => update(v.id, (x) => void (x.initial = coerceValue(x.type, val)), `vinit:${v.id}`)} />
                    </td>
                    <td>
                      <input className="input" value={v.description ?? ''} onChange={(e) => update(v.id, (x) => void (x.description = e.target.value), `vdesc:${v.id}`)} placeholder={tr("What is it for?")} />
                    </td>
                    <td className="muted">{usages(project, v.id)}</td>
                    <td>
                      <button className="btn ghost sm icon" onClick={() => void remove(v)} title={tr("Delete variable")}>
                        🗑
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <div className="sub-card small muted" style={{ marginTop: '1rem' }}>
          <b style={{ color: 'var(--text)' }}>{tr("Using variables without code")}</b>
          <ul style={{ margin: '0.3rem 0 0', paddingLeft: '1.2rem', lineHeight: 1.6 }}>
            <li>{tr("Change them with Set Variable / Add Value / Subtract Value actions (e.g. after a choice).")}</li>
            <li>{tr("Branch with Conditional Branch: “Love_A ≥ 50 → Good Ending, otherwise → Normal Ending”.")}</li>
            <li>{tr("Hide choice options unless a condition is true.")}</li>
          </ul>
        </div>
      </div>
    </>
  );
}
