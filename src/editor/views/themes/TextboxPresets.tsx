// Textbox style picker: one card per textbox preset with a small drawing of its shape.
// Hovering (or focusing) a card previews it in the live canvas; clicking applies it.
import { t as tr } from '../../../shared/i18n';
import { TEXTBOX_PRESETS, textboxParts, type TextboxPreset } from '../../../shared/textbox';
import { withAlpha } from '../../../shared/themes';

function Thumb({ p }: { p: TextboxPreset }) {
  const { dialog: d, nameBox: n } = textboxParts(p);
  const vars = {
    '--tb-bg': withAlpha(d.surface.background, Math.max(0.55, d.surface.opacity)),
    '--tb-bc': d.surface.borderColor,
    '--tb-bw': `${Math.min(3, Math.max(d.surface.borderWidth > 0 ? 1 : 0, d.surface.borderWidth / 2))}px`,
    '--tb-r': `${Math.min(14, d.surface.radius / 4)}px`,
    '--tb-text': d.text.color,
    '--tb-nbg': n.surface.opacity > 0 ? withAlpha(n.surface.background, n.surface.opacity) : 'transparent',
    '--tb-ncolor': n.text.color,
    '--tb-nbc': n.surface.borderColor,
    '--tb-nbw': `${Math.min(2, n.surface.borderWidth / 2)}px`,
  } as React.CSSProperties;
  return (
    <div className="tb-thumb" data-frame={d.frame} data-shape={n.shape} data-attach={n.attach} data-align={n.align} style={vars} aria-hidden>
      <div className="tb-box">
        <span className="tb-name">{tr('Name')}</span>
        <span className="tb-line" />
        <span className="tb-line short" />
      </div>
    </div>
  );
}

interface Props {
  /** Preset currently applied to the theme (null = none / changed by hand). */
  current: string | null;
  onPreview: (id: string | null) => void;
  onPick: (id: string) => void;
}

export function TextboxPresets({ current, onPreview, onPick }: Props) {
  return (
    <div className="tb-grid" role="listbox" aria-label={tr('Textbox style')} onMouseLeave={() => onPreview(null)} data-testid="textbox-presets">
      {TEXTBOX_PRESETS.map((p) => (
        <button
          key={p.id}
          type="button"
          role="option"
          aria-selected={current === p.id}
          className={`tb-card ${current === p.id ? 'selected' : ''}`}
          title={tr(p.description)}
          onMouseEnter={() => onPreview(p.id)}
          onFocus={() => onPreview(p.id)}
          onBlur={() => onPreview(null)}
          onClick={() => onPick(p.id)}
          data-testid={`textbox-preset-${p.id}`}
        >
          <Thumb p={p} />
          <span className="tb-label">{tr(p.name)}</span>
        </button>
      ))}
    </div>
  );
}
