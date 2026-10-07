import { t as tr } from '../../../shared/i18n';
import { useMemo, useState } from 'react';
import type { AnimFrame, Asset, ChoiceOption, CompareOp, Condition, JumpTarget, Project, Scene, TextStyle, Variable } from '../../../shared/types';
import type { FieldSpec } from '../../../shared/actions';
import { getActionDef, isKnownActionType } from '../../../shared/actions';
import { newId } from '../../../shared/ids';
import { AssetPicker } from '../../components/AssetPicker';
import { AssetThumb, TYPE_ICON } from '../../components/AssetThumb';
import { DND_ASSETS, getDrag, hasDrag } from '../../dnd';
import { useProject } from '../../store/project';
import { promptDialog } from '../../store/ui';

type Patch = (patch: Record<string, any>, coalesce?: string) => void;

const OPS: CompareOp[] = ['==', '!=', '>', '>=', '<', '<='];
const OP_LABEL: Record<CompareOp, string> = { '==': 'equals', '!=': 'is not', '>': 'greater than', '>=': 'at least', '<': 'less than', '<=': 'at most' };

export function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      {children}
    </div>
  );
}

export function NumberInput({ value, onChange, min, max, step }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <input
      type="number"
      className="input"
      value={Number.isFinite(value) ? value : 0}
      min={min}
      max={max}
      step={step ?? 1}
      onChange={(e) => {
        const v = parseFloat(e.target.value);
        onChange(Number.isFinite(v) ? v : 0);
      }}
    />
  );
}

export function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const hex = /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000';
  return (
    <div className="color-input">
      <input type="color" value={hex} onChange={(e) => onChange(e.target.value)} aria-label={tr("Pick color")} />
      <input className="input" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function AssetField({ spec, value, onChange }: { spec: Extract<FieldSpec, { kind: 'asset' }>; value: string; onChange: (v: string) => void }) {
  const asset = useProject((s) => s.project?.assets.find((a) => a.id === value));
  const missing = useProject((s) => (value ? s.missing.includes(value) : false));
  const [open, setOpen] = useState(false);
  const [over, setOver] = useState(false);
  return (
    <>
      <div
        className={`asset-field ${over ? 'drop-target' : ''}`}
        onDragOver={(e) => {
          if (hasDrag(e, DND_ASSETS)) {
            e.preventDefault();
            setOver(true);
          }
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          setOver(false);
          const d = getDrag<{ ids: string[] }>(e, DND_ASSETS);
          if (d?.ids[0]) {
            e.preventDefault();
            e.stopPropagation();
            onChange(d.ids[0]);
          }
        }}
      >
        <div className="mini">{asset ? <AssetThumb asset={asset} missing={missing} /> : value ? '⚠️' : spec.media === 'audio' ? '🎵' : spec.media === 'video' ? '🎬' : '🖼️'}</div>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="ellipsis">{asset ? asset.name : value ? tr("Missing asset") : tr("None")}</div>
          {asset && <div className="small faint ellipsis">{asset.path}</div>}
        </div>
        <button className="btn sm" onClick={() => setOpen(true)} data-testid={`choose-${spec.key}`}>
          {tr("Choose…")}
        </button>
        {value && (
          <button className="btn sm ghost icon" title={tr("Clear")} onClick={() => onChange('')}>
            ✕
          </button>
        )}
      </div>
      {asset?.kind === 'audio' && <AudioPreview asset={asset} />}
      {open && (
        <AssetPicker
          media={spec.media}
          types={spec.assetTypes}
          title={tr("Choose {0}", { 0: tr(spec.label) })}
          onClose={() => setOpen(false)}
          onPick={(a) => {
            onChange(a.id);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

function AudioPreview({ asset }: { asset: Asset }) {
  const url = `tstvn-asset://project/${asset.path.split('/').map(encodeURIComponent).join('/')}?v=${asset.rev}`;
  return <audio controls src={url} style={{ width: '100%', height: 32 }} />;
}

export function CharacterSelect({ value, onChange, allowNone }: { value: string; onChange: (v: string) => void; allowNone?: string }) {
  const chars = useProject((s) => s.project?.characters ?? []);
  return (
    <select className="select" value={value} onChange={(e) => onChange(e.target.value)} data-testid="character-select">
      <option value="">{allowNone ?? tr("— choose —")}</option>
      {chars.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

function ExpressionSelect({ characterId, value, onChange }: { characterId: string; value: string; onChange: (v: string) => void }) {
  const ch = useProject((s) => s.project?.characters.find((c) => c.id === characterId));
  if (!ch) return <span className="small faint">{tr("Choose a character first.")}</span>;
  return (
    <select className="select" value={value} onChange={(e) => onChange(e.target.value)} data-testid="expression-select">
      <option value="">{ch.expressions.find((e) => e.id === ch.defaultExpressionId)?.name ?? tr("Default")} {tr("(default)")}</option>
      {ch.expressions.map((e) => (
        <option key={e.id} value={e.id}>
          {e.name}
        </option>
      ))}
    </select>
  );
}

export function SceneSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const project = useProject((s) => s.project)!;
  const map = new Map(project.scenes.map((s) => [s.id, s]));
  return (
    <select className="select" value={value ?? ''} onChange={(e) => onChange(e.target.value)} data-testid="scene-select">
      <option value="">{tr("— choose scene —")}</option>
      {project.chapters.map((ch) => (
        <optgroup key={ch.id} label={ch.name}>
          {ch.sceneIds.map((id) => (
            <option key={id} value={id}>
              {map.get(id)?.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

export function VariableSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const vars = useProject((s) => s.project?.variables ?? []);
  return (
    <div className="row">
      <select className="select grow" value={value ?? ''} onChange={(e) => onChange(e.target.value)} data-testid="variable-select">
        <option value="">{tr("— choose variable —")}</option>
        {vars.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name} ({v.type})
          </option>
        ))}
      </select>
      <button
        className="btn sm"
        title={tr("New variable")}
        onClick={async () => {
          const name = await promptDialog({ title: tr("New number variable"), label: tr("Name (e.g. Love_A, Money)"), value: tr("Points"), confirmLabel: tr("Create") });
          if (!name) return;
          const id = newId('v');
          useProject.getState().update((p) => void p.variables.push({ id, name: name.trim().replace(/\s+/g, '_'), type: 'number', initial: 0 }));
          onChange(id);
        }}
      >
        ＋
      </button>
    </div>
  );
}

export function VarValueInput({ variable, value, onChange }: { variable: Variable | undefined; value: unknown; onChange: (v: any) => void }) {
  if (!variable) return <input className="input" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
  if (variable.type === 'boolean')
    return (
      <select className="select" value={String(value === true || value === 'true')} onChange={(e) => onChange(e.target.value === 'true')}>
        <option value="true">{tr("true")}</option>
        <option value="false">{tr("false")}</option>
      </select>
    );
  if (variable.type === 'number') return <NumberInput value={Number(value) || 0} onChange={onChange} />;
  return <input className="input" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
}

function labelsIn(p: Project): string[] {
  return [...new Set(p.scenes.flatMap((s) => s.actions.filter((a) => a.type === 'label').map((a) => String(a.params.name))))].filter(Boolean);
}

export function TargetEditor({ value, onChange, allowNext, scene }: { value: JumpTarget | undefined; onChange: (t: JumpTarget) => void; allowNext?: boolean; scene?: Scene }) {
  const project = useProject((s) => s.project)!;
  const t = value ?? { kind: allowNext ? 'next' : 'label' };
  const labels = useMemo(() => labelsIn(project), [project]);
  return (
    <div className="col" style={{ gap: '0.3rem' }}>
      <select className="select" value={t.kind} onChange={(e) => onChange({ kind: e.target.value as JumpTarget['kind'] })} data-testid="target-kind">
        <option value="next">{tr("Continue (next action)")}</option>
        <option value="scene">{tr("Scene…")}</option>
        <option value="label">{tr("Label…")}</option>
        <option value="action">{tr("Action in this scene…")}</option>
      </select>
      {t.kind === 'scene' && <SceneSelect value={t.sceneId ?? ''} onChange={(sceneId) => onChange({ kind: 'scene', sceneId })} />}
      {t.kind === 'label' && (
        <select className="select" value={t.label ?? ''} onChange={(e) => onChange({ kind: 'label', label: e.target.value })} data-testid="target-label">
          <option value="">{tr("— choose label —")}</option>
          {labels.map((l) => (
            <option key={l} value={l}>
              🏷️ {l}
            </option>
          ))}
        </select>
      )}
      {t.kind === 'label' && labels.length === 0 && <span className="small faint">{tr("Add a Label action first (Flow › Label).")}</span>}
      {t.kind === 'action' && scene && (
        <select className="select" value={t.actionId ?? ''} onChange={(e) => onChange({ kind: 'action', actionId: e.target.value })}>
          <option value="">{tr("— choose action —")}</option>
          {scene.actions.map((a, i) => (
            <option key={a.id} value={a.id}>
              #{i + 1} {isKnownActionType(a.type) ? tr(getActionDef(a.type).label) : a.type}
              {a.params.text ? ` — ${String(a.params.text).slice(0, 30)}` : ''}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

function ConditionRow({ c, onChange, onRemove }: { c: Condition; onChange: (c: Condition) => void; onRemove: () => void }) {
  const vars = useProject((s) => s.project?.variables ?? []);
  const v = vars.find((x) => x.id === c.variableId);
  return (
    <div className="sub-card">
      <VariableSelect value={c.variableId} onChange={(variableId) => onChange({ ...c, variableId })} />
      <div className="row">
        <select className="select" style={{ width: '9rem' }} value={c.op} onChange={(e) => onChange({ ...c, op: e.target.value as CompareOp })} data-testid="condition-op">
          {OPS.map((o) => (
            <option key={o} value={o}>
              {o} {OP_LABEL[o]}
            </option>
          ))}
        </select>
        <div className="grow">
          <VarValueInput variable={v} value={c.value} onChange={(value) => onChange({ ...c, value })} />
        </div>
        <button className="btn sm ghost icon" onClick={onRemove} title={tr("Remove condition")}>
          ✕
        </button>
      </div>
    </div>
  );
}

function ChoiceOptionsEditor({ value, onChange, scene }: { value: ChoiceOption[]; onChange: (v: ChoiceOption[]) => void; scene: Scene }) {
  const opts = value ?? [];
  const set = (i: number, o: ChoiceOption) => onChange(opts.map((x, j) => (j === i ? o : x)));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= opts.length) return;
    const copy = [...opts];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    onChange(copy);
  };
  return (
    <div className="col">
      {opts.map((o, i) => (
        <div key={o.id} className="sub-card" data-testid={`choice-option-${i}`}>
          <div className="row">
            <b className="small">{tr("Option")} {i + 1}</b>
            <span className="grow" />
            <button className="btn sm ghost icon" onClick={() => move(i, -1)} disabled={i === 0} title={tr("Move up")}>
              ↑
            </button>
            <button className="btn sm ghost icon" onClick={() => move(i, 1)} disabled={i === opts.length - 1} title={tr("Move down")}>
              ↓
            </button>
            <button className="btn sm ghost icon" onClick={() => onChange(opts.filter((_, j) => j !== i))} title={tr("Remove option")}>
              ✕
            </button>
          </div>
          <input className="input" value={o.text} onChange={(e) => set(i, { ...o, text: e.target.value })} placeholder={tr("Option text")} data-testid={`choice-text-${i}`} />
          <span className="field-label">{tr("Goes to")}</span>
          <TargetEditor value={o.target} allowNext scene={scene} onChange={(target) => set(i, { ...o, target })} />
          {o.condition ? (
            <>
              <span className="field-label">{tr("Only show if")}</span>
              <ConditionRow c={o.condition} onChange={(condition) => set(i, { ...o, condition })} onRemove={() => set(i, { ...o, condition: null })} />
            </>
          ) : (
            <button className="btn sm ghost" style={{ alignSelf: 'flex-start' }} onClick={() => set(i, { ...o, condition: { variableId: '', op: '>=', value: 0 } })}>
              {tr("＋ Show only if…")}
            </button>
          )}
        </div>
      ))}
      <button className="btn sm" onClick={() => onChange([...opts, { id: newId('o'), text: `Option ${String.fromCharCode(65 + opts.length)}`, target: { kind: 'next' }, condition: null }])} data-testid="add-choice-option">
        {tr("＋ Add option")}
      </button>
    </div>
  );
}

function TextStyleEditor({ value, onChange }: { value: TextStyle; onChange: (v: TextStyle) => void }) {
  const s = value ?? {};
  return (
    <div className="col" style={{ gap: '0.35rem' }}>
      <div className="row">
        <button className={`btn sm ${s.bold ? 'active' : ''}`} onClick={() => onChange({ ...s, bold: !s.bold })} title={tr("Bold")}>
          <b>B</b>
        </button>
        <button className={`btn sm ${s.italic ? 'active' : ''}`} onClick={() => onChange({ ...s, italic: !s.italic })} title={tr("Italic")}>
          <i>I</i>
        </button>
        {(['left', 'center', 'right'] as const).map((al) => (
          <button key={al} className={`btn sm ${s.align === al ? 'active' : ''}`} onClick={() => onChange({ ...s, align: s.align === al ? undefined : al })} title={tr("Align {0}", { 0: al })}>
            {al === 'left' ? '⯇' : al === 'center' ? '≡' : '⯈'}
          </button>
        ))}
      </div>
      <div className="row">
        <label className="check small">
          <input type="checkbox" checked={!!s.color} onChange={(e) => onChange({ ...s, color: e.target.checked ? '#ffe08a' : undefined })} /> {tr("Color")}
        </label>
        {s.color && <ColorInput value={s.color} onChange={(color) => onChange({ ...s, color })} />}
      </div>
      <div className="row">
        <label className="check small">
          <input type="checkbox" checked={!!s.size} onChange={(e) => onChange({ ...s, size: e.target.checked ? 32 : undefined })} /> {tr("Size")}
        </label>
        {s.size && <NumberInput value={s.size} min={10} max={80} onChange={(size) => onChange({ ...s, size })} />}
      </div>
    </div>
  );
}

function CustomAnimEditor({ value, onChange }: { value: { from: AnimFrame; to: AnimFrame }; onChange: (v: { from: AnimFrame; to: AnimFrame }) => void }) {
  const v = value ?? { from: {}, to: {} };
  const keys: (keyof AnimFrame)[] = ['x', 'y', 'scale', 'rotate', 'opacity'];
  return (
    <div className="sub-card">
      <table className="table">
        <thead>
          <tr>
            <th />
            <th>{tr("From")}</th>
            <th>{tr("To")}</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((k) => (
            <tr key={k}>
              <td className="small">{k}</td>
              {(['from', 'to'] as const).map((side) => (
                <td key={side}>
                  <NumberInput
                    value={Number(v[side]?.[k] ?? (k === 'scale' || k === 'opacity' ? 1 : 0))}
                    step={k === 'scale' || k === 'opacity' ? 0.05 : 1}
                    onChange={(n) => onChange({ ...v, [side]: { ...v[side], [k]: n } })}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Renders one action property from its FieldSpec. */
export function FieldRenderer({ spec, params, onPatch, scene }: { spec: FieldSpec; params: Record<string, any>; onPatch: Patch; scene: Scene }) {
  const value = params[spec.key];
  const set = (v: unknown, coalesce?: string) => onPatch({ [spec.key]: v }, coalesce);
  const vars = useProject((s) => s.project?.variables ?? []);
  switch (spec.kind) {
    case 'text':
      return (
        <FieldRow label={tr(spec.label)}>
          <input className="input" value={value ?? ''} placeholder={spec.placeholder ? tr(spec.placeholder) : undefined} onChange={(e) => set(e.target.value, `text:${spec.key}`)} data-testid={`field-${spec.key}`} />
        </FieldRow>
      );
    case 'textarea':
      return (
        <FieldRow label={tr(spec.label)}>
          <textarea className="textarea" value={value ?? ''} placeholder={spec.placeholder ? tr(spec.placeholder) : undefined} onChange={(e) => set(e.target.value, `text:${spec.key}`)} rows={4} data-testid={`field-${spec.key}`} />
        </FieldRow>
      );
    case 'number':
      return (
        <FieldRow label={`${tr(spec.label)}${spec.unit ? ` (${spec.unit})` : ''}`}>
          <NumberInput value={Number(value) || 0} min={spec.min} max={spec.max} step={spec.step} onChange={(v) => set(v, `num:${spec.key}`)} />
        </FieldRow>
      );
    case 'slider':
      return (
        <FieldRow label={tr(spec.label)}>
          <div className="slider-row">
            <input type="range" min={spec.min} max={spec.max} step={spec.step ?? 1} value={Number(value) || 0} onChange={(e) => set(parseFloat(e.target.value), `num:${spec.key}`)} aria-label={tr(spec.label)} data-testid={`field-${spec.key}`} />
            <NumberInput value={Number(value) || 0} step={spec.step} onChange={(v) => set(v, `num:${spec.key}`)} />
          </div>
        </FieldRow>
      );
    case 'boolean':
      return (
        <label className="check field">
          <input type="checkbox" checked={!!value} onChange={(e) => set(e.target.checked)} data-testid={`field-${spec.key}`} />
          {tr(spec.label)}
        </label>
      );
    case 'select':
      return (
        <FieldRow label={tr(spec.label)}>
          <select className="select" value={value ?? ''} onChange={(e) => set(e.target.value)} data-testid={`field-${spec.key}`}>
            {spec.options.map((o) => (
              <option key={o.value} value={o.value}>
                {tr(o.label)}
              </option>
            ))}
          </select>
        </FieldRow>
      );
    case 'color':
      return (
        <FieldRow label={tr(spec.label)}>
          <ColorInput value={value ?? '#000000'} onChange={(v) => set(v, `color:${spec.key}`)} />
        </FieldRow>
      );
    case 'asset':
      return (
        <FieldRow label={`${TYPE_ICON[spec.assetTypes[0]] ?? ''} ${tr(spec.label)}`}>
          <AssetField spec={spec} value={value ?? ''} onChange={(v) => set(v)} />
        </FieldRow>
      );
    case 'character':
      return (
        <FieldRow label={tr(spec.label)}>
          <CharacterSelect value={value ?? ''} onChange={(v) => onPatch({ [spec.key]: v, expressionId: '' })} allowNone={spec.key === 'speaker' ? 'Narrator (no name)' : undefined} />
        </FieldRow>
      );
    case 'expression':
      return (
        <FieldRow label={tr(spec.label)}>
          <ExpressionSelect characterId={params[spec.characterKey]} value={value ?? ''} onChange={(v) => set(v)} />
        </FieldRow>
      );
    case 'scene':
      return (
        <FieldRow label={tr(spec.label)}>
          <SceneSelect value={value ?? ''} onChange={(v) => set(v)} />
        </FieldRow>
      );
    case 'variable':
      return (
        <FieldRow label={tr(spec.label)}>
          <VariableSelect value={value ?? ''} onChange={(v) => set(v)} />
        </FieldRow>
      );
    case 'varValue':
      return (
        <FieldRow label={tr(spec.label)}>
          <VarValueInput variable={vars.find((v) => v.id === params[spec.variableKey])} value={value} onChange={(v) => set(v, `val:${spec.key}`)} />
        </FieldRow>
      );
    case 'compareOp':
      return (
        <FieldRow label={tr(spec.label)}>
          <select className="select" value={value ?? '>='} onChange={(e) => set(e.target.value)}>
            {OPS.map((o) => (
              <option key={o} value={o}>
                {o} {OP_LABEL[o]}
              </option>
            ))}
          </select>
        </FieldRow>
      );
    case 'target':
      return (
        <FieldRow label={tr(spec.label)}>
          <TargetEditor value={value} onChange={(t) => set(t)} allowNext={spec.allowNext} scene={scene} />
        </FieldRow>
      );
    case 'choiceOptions':
      return (
        <FieldRow label={tr(spec.label)}>
          <ChoiceOptionsEditor value={value} onChange={(v) => set(v, 'choice-options')} scene={scene} />
        </FieldRow>
      );
    case 'conditions': {
      const conds: Condition[] = value ?? [];
      return (
        <FieldRow label={tr(spec.label)}>
          <div className="col">
            {conds.length === 0 && <span className="small faint">{tr("No conditions — the branch is always true.")}</span>}
            {conds.map((c, i) => (
              <ConditionRow key={i} c={c} onChange={(nc) => set(conds.map((x, j) => (j === i ? nc : x)), 'conditions')} onRemove={() => set(conds.filter((_, j) => j !== i))} />
            ))}
            <button className="btn sm" onClick={() => set([...conds, { variableId: vars[0]?.id ?? '', op: '>=', value: 0 }])} data-testid="add-condition">
              {tr("＋ Add condition")}
            </button>
          </div>
        </FieldRow>
      );
    }
    case 'textStyle':
      return (
        <FieldRow label={tr(spec.label)}>
          <TextStyleEditor value={value} onChange={(v) => set(v, 'style')} />
        </FieldRow>
      );
    case 'customAnimation':
      return (
        <FieldRow label={tr(spec.label)}>
          <CustomAnimEditor value={value} onChange={(v) => set(v, 'custom-anim')} />
        </FieldRow>
      );
  }
}
