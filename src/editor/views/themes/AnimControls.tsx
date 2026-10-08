// Animation settings of the Game UI editor: a preset, its duration and easing, and ▶ Preview.
// Choosing a preset fills in sensible values, so beginners never need to understand easing curves.
import { t as tr } from '../../../shared/i18n';
import { EASING_OPTIONS, ENTRANCE_PRESETS, animPreset, presetValue, type AnimPresetOption, type AnimSpec } from '../../../shared/uianim';
import { Field, Slider } from './controls';

interface Props {
  label: string;
  spec: AnimSpec;
  list?: AnimPresetOption[];
  onChange: (next: AnimSpec, key: string) => void;
  onPreview?: () => void;
  testId: string;
}

export function AnimControl({ label, spec, list = ENTRANCE_PRESETS, onChange, onPreview, testId }: Props) {
  const value = presetValue(spec, list);
  return (
    <div className="anim-control" data-testid={testId}>
      <Field label={label}>
        <div className="row" style={{ gap: '0.3rem' }}>
          <select
            className="select grow"
            value={value}
            // A new preset brings its own sensible duration, easing and distance; the delay is kept.
            onChange={(e) => onChange({ ...animPreset(e.target.value, list), delay: spec.delay }, 'preset')}
            data-testid={`${testId}-preset`}
          >
            {list.map((o) => (
              <option key={o.value} value={o.value}>
                {tr(o.label)}
              </option>
            ))}
          </select>
          {onPreview && (
            <button type="button" className="btn sm" onClick={onPreview} disabled={spec.kind === 'none'} title={tr('Preview the animation')} aria-label={tr('Preview the animation')} data-testid={`${testId}-preview`}>
              ▶
            </button>
          )}
        </div>
      </Field>
      {spec.kind !== 'none' && (
        <div className="prop-grid">
          <Slider label={tr('Duration (seconds)')} value={spec.duration} min={0.05} max={2} step={0.05} onChange={(v) => onChange({ ...spec, duration: v }, 'duration')} testId={`${testId}-duration`} />
          <Field label={tr('Easing')} tip={tr('How the movement speeds up and slows down. “Ease Out” starts fast and stops gently.')}>
            <select className="select" value={spec.easing} onChange={(e) => onChange({ ...spec, easing: e.target.value as AnimSpec['easing'] }, 'easing')} data-testid={`${testId}-easing`}>
              {EASING_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {tr(o.label)}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}
    </div>
  );
}
