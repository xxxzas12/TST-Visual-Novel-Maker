// Animation settings of the Game UI editor: a preset, its duration and easing, and ▶ Preview.
// Choosing a preset fills in sensible values, so beginners never need to understand easing curves.
// Advanced adds delay, direction, distance, start size, rotation and opacity.
import { t as tr } from '../../../shared/i18n';
import { EASING_OPTIONS, ENTRANCE_PRESETS, animPreset, presetValue, type AnimDirection, type AnimPresetOption, type AnimSpec } from '../../../shared/uianim';
import { Field, Slider } from './controls';

interface Props {
  label: string;
  spec: AnimSpec;
  list?: AnimPresetOption[];
  onChange: (next: AnimSpec, key: string) => void;
  onPreview?: () => void;
  /** Show the fine controls (delay, direction, distance, scale, rotation, opacity). */
  advanced?: boolean;
  testId: string;
}

const DIRECTIONS: { value: AnimDirection; label: string }[] = [
  { value: 'up', label: '↑ Up' },
  { value: 'down', label: '↓ Down' },
  { value: 'left', label: '← Left' },
  { value: 'right', label: '→ Right' },
];

export function AnimControl({ label, spec, list = ENTRANCE_PRESETS, onChange, onPreview, advanced = false, testId }: Props) {
  const value = presetValue(spec, list);
  const preset = animPreset(value, list);
  const changed = (['duration', 'delay', 'easing', 'distance', 'scale', 'rotate', 'opacity', 'direction'] as const).some((k) => spec[k] !== preset[k]);
  const moves = spec.kind === 'slide' || spec.kind === 'bounce' || spec.kind === 'shake';
  const sizes = spec.kind === 'pop' || spec.kind === 'scale' || spec.kind === 'pulse';
  const set = (patch: Partial<AnimSpec>, key: string) => onChange({ ...spec, ...patch }, key);
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
          <Slider label={tr('Duration (seconds)')} value={spec.duration} min={0.05} max={2} step={0.05} onChange={(v) => set({ duration: v }, 'duration')} testId={`${testId}-duration`} />
          <Field label={tr('Easing')} tip={tr('How the movement speeds up and slows down. “Ease Out” starts fast and stops gently.')}>
            <select className="select" value={spec.easing} onChange={(e) => set({ easing: e.target.value as AnimSpec['easing'] }, 'easing')} data-testid={`${testId}-easing`}>
              {EASING_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {tr(o.label)}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}
      {advanced && spec.kind !== 'none' && (
        <div className="anim-advanced" data-testid={`${testId}-advanced`}>
          <div className="prop-grid">
            <Slider label={tr('Delay (seconds)')} value={spec.delay} min={0} max={2} step={0.05} onChange={(v) => set({ delay: v }, 'delay')} testId={`${testId}-delay`} />
            {(spec.kind === 'slide' || spec.kind === 'bounce') && (
              <Field label={tr('Direction')}>
                <select className="select" value={spec.direction} onChange={(e) => set({ direction: e.target.value as AnimDirection }, 'direction')} data-testid={`${testId}-direction`}>
                  {DIRECTIONS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {tr(d.label)}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {moves && (
              <Slider label={tr('Distance')} suffix="px" tip={tr('How far it moves, in pixels of a 1920×1080 screen.')} value={spec.distance} min={0} max={400} step={2} onChange={(v) => set({ distance: v }, 'distance')} testId={`${testId}-distance`} />
            )}
            {sizes && <Slider label={tr('Start size')} tip={tr('1 = normal size. Smaller grows in, larger shrinks in.')} value={spec.scale} min={0} max={2} step={0.05} onChange={(v) => set({ scale: v }, 'scale')} testId={`${testId}-scale`} />}
            <Slider label={tr('Start rotation')} suffix="°" value={spec.rotate} min={-180} max={180} step={5} onChange={(v) => set({ rotate: v }, 'rotate')} testId={`${testId}-rotate`} />
            <Slider label={tr('Start opacity')} tip={tr('0 = starts invisible, 1 = starts fully visible.')} value={spec.opacity} min={0} max={1} step={0.05} onChange={(v) => set({ opacity: v }, 'opacity')} testId={`${testId}-opacity`} />
          </div>
          {changed && (
            <button type="button" className="btn sm ghost" onClick={() => onChange({ ...preset }, 'reset')} data-testid={`${testId}-reset`}>
              {tr('⟲ Back to the preset’s values')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
