// Small property controls used by the Game UI editor.
import { useState } from 'react';
import { t as tr } from '../../../shared/i18n';
import type { FontRef, Theme, UiAnchor, UiLength, UiSurface, UiText, UiUnit } from '../../../shared/types';
import { UI_ANCHORS } from '../../../shared/themes';
import { AssetPicker } from '../../components/AssetPicker';
import { AssetThumb } from '../../components/AssetThumb';
import { FontPicker, type FontChoice } from '../../components/FontPicker';
import { fontStack } from '../../appearance';
import { api } from '../../api';
import { run } from '../../ops';
import { getDir, useProject } from '../../store/project';
import { ColorInput, NumberInput } from '../scenes/fields';

export type Edit = (fn: (t: Theme) => void, key: string) => void;

export function Field({ label, children, testId }: { label: string; children: React.ReactNode; testId?: string }) {
  return (
    <div className="field" data-testid={testId}>
      <span className="field-label">{label}</span>
      {children}
    </div>
  );
}

/** Slider + number box. */
export function Slider(props: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; testId?: string; suffix?: string }) {
  return (
    <Field label={props.suffix ? `${props.label} (${props.suffix})` : props.label}>
      <div className="slider-row">
        <input type="range" min={props.min} max={props.max} step={props.step ?? 1} value={props.value} onChange={(e) => props.onChange(parseFloat(e.target.value))} aria-label={props.label} data-testid={props.testId} />
        <NumberInput value={props.value} step={props.step} onChange={props.onChange} />
      </div>
    </Field>
  );
}

export function ColorField({ label, value, onChange, testId }: { label: string; value: string; onChange: (v: string) => void; testId?: string }) {
  return (
    <Field label={label} testId={testId}>
      <ColorInput value={value} onChange={onChange} />
    </Field>
  );
}

const UNITS: { value: UiUnit; label: string }[] = [
  { value: 'px', label: 'px' },
  { value: '%', label: '%' },
  { value: 'vw', label: 'vw' },
  { value: 'vh', label: 'vh' },
];

/** A length with a unit: design px (1920×1080 canvas), % of the safe area, or viewport units. */
export function LengthInput({ label, value, onChange, testId }: { label: string; value: UiLength; onChange: (v: UiLength) => void; testId?: string }) {
  return (
    <Field label={label}>
      <div className="length-input">
        <input
          type="number"
          className="input"
          value={value.value}
          step={value.unit === 'px' ? 1 : 0.5}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            onChange({ ...value, value: Number.isFinite(v) ? v : 0 });
          }}
          aria-label={label}
          data-testid={testId}
        />
        <select className="select" value={value.unit} onChange={(e) => onChange({ ...value, unit: e.target.value as UiUnit })} aria-label={tr('Unit')} data-testid={testId ? `${testId}-unit` : undefined}>
          {UNITS.map((u) => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </select>
      </div>
    </Field>
  );
}

const ANCHOR_LABEL: Record<UiAnchor, string> = {
  'top-left': '↖',
  top: '↑',
  'top-right': '↗',
  left: '←',
  center: '•',
  right: '→',
  'bottom-left': '↙',
  bottom: '↓',
  'bottom-right': '↘',
};

/** 3×3 anchor grid. */
export function AnchorPicker({ value, onChange, testId }: { value: UiAnchor; onChange: (a: UiAnchor) => void; testId?: string }) {
  return (
    <Field label={tr('Anchor')}>
      <div className="anchor-grid" role="radiogroup" aria-label={tr('Anchor')} data-testid={testId}>
        {UI_ANCHORS.map((a) => (
          <button key={a} type="button" role="radio" aria-checked={a === value} className={a === value ? 'on' : ''} title={a} onClick={() => onChange(a)} data-testid={testId ? `${testId}-${a}` : undefined}>
            {ANCHOR_LABEL[a]}
          </button>
        ))}
      </div>
    </Field>
  );
}

function ImageField({ value, onChange, testId }: { value: string | null; onChange: (id: string | null) => void; testId?: string }) {
  const asset = useProject((s) => (value ? s.project?.assets.find((a) => a.id === value) : undefined));
  const [open, setOpen] = useState(false);
  return (
    <Field label={tr('Background image')}>
      <div className="asset-field">
        <div className="mini">{asset ? <AssetThumb asset={asset} /> : value ? '⚠️' : '🖼️'}</div>
        <div className="grow ellipsis">{asset ? asset.name : value ? tr('Missing asset') : tr('None')}</div>
        <button className="btn sm" onClick={() => setOpen(true)} data-testid={testId}>
          {tr('Choose…')}
        </button>
        {value && (
          <button className="btn sm ghost icon" title={tr('Clear')} aria-label={tr('Clear')} onClick={() => onChange(null)}>
            ✕
          </button>
        )}
      </div>
      {open && (
        <AssetPicker
          media="image"
          types={['ui', 'background', 'cg', 'unknown']}
          title={tr('Choose {0}', { 0: tr('Background image') })}
          onClose={() => setOpen(false)}
          onPick={(a) => {
            setOpen(false);
            onChange(a.id);
          }}
        />
      )}
    </Field>
  );
}

/** Background, image, opacity, border, corners, shadow and blur. `colors` = false when the colors live elsewhere (choice states). */
export function SurfaceEditor({ s, set, prefix, colors = true }: { s: UiSurface; set: (fn: (s: UiSurface) => void, key: string) => void; prefix: string; colors?: boolean }) {
  return (
    <>
      {colors && <ColorField label={tr('Background color')} value={s.background} onChange={(v) => set((x) => void (x.background = v), 'bg')} testId={`${prefix}-bg`} />}
      <ImageField value={s.image} onChange={(v) => set((x) => void (x.image = v), 'img')} testId={`${prefix}-image`} />
      {s.image && (
        <Field label={tr('Image fit')}>
          <select className="select" value={s.imageFit} onChange={(e) => set((x) => void (x.imageFit = e.target.value as UiSurface['imageFit']), 'fit')}>
            <option value="stretch">{tr('Stretch')}</option>
            <option value="cover">{tr('Cover')}</option>
            <option value="contain">{tr('Contain')}</option>
            <option value="tile">{tr('Tile')}</option>
          </select>
        </Field>
      )}
      <Slider label={tr('Opacity')} value={s.opacity} min={0} max={1} step={0.05} onChange={(v) => set((x) => void (x.opacity = v), 'op')} testId={`${prefix}-opacity`} />
      {colors && <ColorField label={tr('Border color')} value={s.borderColor} onChange={(v) => set((x) => void (x.borderColor = v), 'bc')} />}
      <Slider label={tr('Border width')} value={s.borderWidth} min={0} max={20} step={0.5} onChange={(v) => set((x) => void (x.borderWidth = v), 'bw')} testId={`${prefix}-border`} />
      <Slider label={tr('Corner radius')} value={Math.min(s.radius, 200)} min={0} max={200} onChange={(v) => set((x) => void (x.radius = v), 'radius')} testId={`${prefix}-radius`} />
      <Slider label={tr('Shadow size')} value={s.shadow.size} min={0} max={120} onChange={(v) => set((x) => void (x.shadow.size = v), 'sh')} testId={`${prefix}-shadow`} />
      {s.shadow.size > 0 && (
        <>
          <Slider label={tr('Shadow offset')} value={s.shadow.y} min={-40} max={40} onChange={(v) => set((x) => void (x.shadow.y = v), 'shy')} />
          <ColorField label={tr('Shadow color')} value={s.shadow.color} onChange={(v) => set((x) => void (x.shadow.color = v), 'shc')} />
          <Slider label={tr('Shadow opacity')} value={s.shadow.opacity} min={0} max={1} step={0.05} onChange={(v) => set((x) => void (x.shadow.opacity = v), 'sho')} />
        </>
      )}
      <Slider label={tr('Background blur')} value={s.blur} min={0} max={40} onChange={(v) => set((x) => void (x.blur = v), 'blur')} testId={`${prefix}-blur`} />
    </>
  );
}

/** Font picker field; imported fonts are copied into the project so the game ships them. */
export function FontField({ label, value, defaultLabel, onChange, testId }: { label: string; value: FontRef | null; defaultLabel: string; onChange: (f: FontRef | null) => void; testId?: string }) {
  const [open, setOpen] = useState(false);
  const pick = async (c: FontChoice | null) => {
    setOpen(false);
    if (!c) return onChange(null);
    if (c.customId) {
      const embedded = await run(() => api.fonts.embed(getDir(), c.customId!), tr('Font import failed'));
      if (embedded) onChange(embedded);
    } else onChange({ family: c.family });
  };
  return (
    <Field label={label}>
      <div className="font-current">
        <span className="grow ellipsis" style={{ fontFamily: value ? fontStack(value.family) : undefined }} data-testid={testId ? `${testId}-name` : undefined}>
          {value ? value.family : defaultLabel}
        </span>
        {value?.file && <span className="badge ok">{tr('included in game')}</span>}
        <button className="btn sm" onClick={() => setOpen(true)} data-testid={testId}>
          {tr('Change…')}
        </button>
      </div>
      {open && <FontPicker title={label} value={value ? { family: value.family } : null} defaultLabel={defaultLabel} onClose={() => setOpen(false)} onPick={(c) => void pick(c)} />}
    </Field>
  );
}

/** Font, size, color, line height, letter spacing, alignment, bold and text shadow. */
export function TextEditor({ x, set, prefix, color = true, gameFontNote }: { x: UiText; set: (fn: (x: UiText) => void, key: string) => void; prefix: string; color?: boolean; gameFontNote?: string }) {
  return (
    <>
      <FontField label={tr('Font')} value={x.font} defaultLabel={gameFontNote ?? tr('Theme font')} onChange={(f) => set((v) => void (v.font = f), 'font')} testId={`${prefix}-font`} />
      <Slider label={tr('Font size')} suffix="px" value={x.size} min={10} max={96} onChange={(v) => set((t) => void (t.size = v), 'size')} testId={`${prefix}-size`} />
      {color && <ColorField label={tr('Font color')} value={x.color} onChange={(v) => set((t) => void (t.color = v), 'color')} testId={`${prefix}-color`} />}
      <Slider label={tr('Line height')} value={x.lineHeight} min={0.9} max={2.5} step={0.05} onChange={(v) => set((t) => void (t.lineHeight = v), 'lh')} />
      <Slider label={tr('Letter spacing')} value={x.letterSpacing} min={-4} max={12} step={0.5} onChange={(v) => set((t) => void (t.letterSpacing = v), 'ls')} />
      <Field label={tr('Text alignment')}>
        <div className="seg" role="radiogroup">
          {(['left', 'center', 'right'] as const).map((a) => (
            <button key={a} type="button" className={x.align === a ? 'on' : ''} aria-checked={x.align === a} role="radio" onClick={() => set((t) => void (t.align = a), 'align')} data-testid={`${prefix}-align-${a}`}>
              {a === 'left' ? tr('Left') : a === 'center' ? tr('Center') : tr('Right')}
            </button>
          ))}
        </div>
      </Field>
      <div className="row">
        <label className="check">
          <input type="checkbox" checked={x.bold} onChange={(e) => set((t) => void (t.bold = e.target.checked), 'bold')} /> {tr('Bold')}
        </label>
        <label className="check">
          <input type="checkbox" checked={x.shadow} onChange={(e) => set((t) => void (t.shadow = e.target.checked), 'tsh')} /> {tr('Text shadow (readability)')}
        </label>
      </div>
    </>
  );
}

export function Section({ title, children, open = true, testId }: { title: string; children: React.ReactNode; open?: boolean; testId?: string }) {
  return (
    <details className="prop-section" open={open} data-testid={testId}>
      <summary>{title}</summary>
      <div className="prop-section-body">{children}</div>
    </details>
  );
}
