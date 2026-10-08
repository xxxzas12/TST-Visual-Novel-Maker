// Choice style picker: one card per choice preset with a small drawing of two buttons (normal and hover).
// Hovering (or focusing) a card previews it in the live canvas; clicking applies it.
import { t as tr } from '../../../shared/i18n';
import { CHOICE_PRESETS, choiceParts } from '../../../shared/choicestyle';
import type { ThemeChoices } from '../../../shared/types';
import { withAlpha } from '../../../shared/themes';

/** Small drawing of two choice buttons (normal and hover), for presets and saved styles. */
export function ChoiceThumb({ choice: c }: { choice: ThemeChoices }) {
  const btn = (state: 'normal' | 'hover') => {
    const s = c.states[state];
    return {
      '--cb-bg': withAlpha(s.background, Math.max(state === 'normal' && c.shape === 'underline' ? 0 : 0.5, s.opacity)),
      '--cb-color': s.color,
      '--cb-bc': s.borderColor,
      '--cb-bw': `${Math.min(2, Math.max(c.surface.borderWidth > 0 ? 1 : 0, c.surface.borderWidth / 2))}px`,
      '--cb-r': `${Math.min(10, c.surface.radius / 3)}px`,
    } as React.CSSProperties;
  };
  return (
    <div className="cb-thumb" data-shape={c.shape} data-anchor={c.anchor} aria-hidden>
      {(['normal', 'hover'] as const).map((state) => (
        <span key={state} className="cb-btn" style={btn(state)}>
          {c.icon && <i>{c.icon}</i>}
          <span className="cb-line" />
        </span>
      ))}
    </div>
  );
}

interface Props {
  current: string | null;
  onPreview: (id: string | null) => void;
  onPick: (id: string) => void;
}

export function ChoicePresets({ current, onPreview, onPick }: Props) {
  return (
    <div className="tb-grid" role="listbox" aria-label={tr('Choice style')} onMouseLeave={() => onPreview(null)} data-testid="choice-presets">
      {CHOICE_PRESETS.map((p) => (
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
          data-testid={`choice-preset-${p.id}`}
        >
          <ChoiceThumb choice={choiceParts(p)} />
          <span className="tb-label">{tr(p.name)}</span>
        </button>
      ))}
    </div>
  );
}
