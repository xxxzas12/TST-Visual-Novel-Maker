// Properties panel of the Game UI editor: shows the settings of the selected element.
import { t as tr } from '../../../shared/i18n';
import type { ChoiceShape, ChoiceState, DialogFrame, MenuAction, NameShape, Theme, UiSurface, UiText } from '../../../shared/types';
import { CHOICE_SHAPES, DIALOG_FRAMES, MENU_ACTIONS, NAME_SHAPES, SANS } from '../../../shared/themes';
import { deleteMenuButton, duplicateMenuButton, moveMenuButton, type UiElementId } from '../../../shared/uicheck';
import { newId } from '../../../shared/ids';
import { AnchorPicker, ColorField, Field, FontField, ImageField, LengthInput, Section, Slider, SurfaceEditor, TextEditor, type Edit } from './controls';
import { useState } from 'react';
import { AnimControl } from './AnimControls';
import { EXIT_PRESETS, INDICATOR_ANIMS, TEXT_REVEALS, legacyAnimation, type IndicatorAnim, type TextReveal, type ThemeAnimations } from '../../../shared/uianim';

export type ReplayTarget = 'dialog' | 'choices' | 'text';

/** Edits a theme's animations; the older single setting is kept in step for older TSTVN versions. */
const animEdit = (edit: Edit) => (fn: (a: ThemeAnimations) => void, key: string) =>
  edit((t) => {
    fn(t.anim);
    t.animation = legacyAnimation(t.anim.dialogIn);
  }, `anim:${key}`);

const FALLBACK_FONTS = [
  { label: 'Modern Sans', value: SANS },
  { label: 'Serif', value: 'Georgia, "Times New Roman", "Noto Serif Thai", serif' },
  { label: 'Storybook', value: '"Palatino Linotype", "Book Antiqua", Palatino, "Noto Serif Thai", serif' },
  { label: 'Rounded', value: '"Trebuchet MS", "Segoe UI", "Leelawadee UI", "Noto Sans Thai", sans-serif' },
  { label: 'Typewriter', value: '"Courier New", Consolas, "Leelawadee UI", monospace' },
  { label: 'Handwritten', value: '"Comic Sans MS", "Segoe Print", cursive' },
];

export function menuActionLabel(a: MenuAction): string {
  switch (a) {
    case 'auto':
      return tr('Auto');
    case 'skip':
      return tr('Skip');
    case 'save':
      return tr('Save');
    case 'load':
      return tr('Load');
    case 'settings':
      return tr('Settings');
    case 'hide':
      return tr('Hide UI');
    default:
      return tr('Menu');
  }
}

export function frameLabel(f: DialogFrame): string {
  return {
    box: tr('Box'),
    bubble: tr('Speech bubble (tail points at the speaker)'),
    band: tr('Shadow band (no box)'),
    ornate: tr('Ornate (double border, corner gems)'),
    tech: tr('Tech (cut corners, scan lines)'),
    torn: tr('Torn (ragged edges)'),
    window: tr('Game window (double frame)'),
    pixel: tr('Pixel art'),
  }[f];
}

export function shapeLabel(x: NameShape): string {
  return { box: tr('Box'), tab: tr('Tab joined to the box'), ribbon: tr('Ribbon'), plain: tr('Text only'), slant: tr('Slanted'), pixel: tr('Pixel art') }[x];
}

const CHOICE_ICONS = ['▶', '◆', '✦', '♥', '★', '➤'];

export function choiceShapeLabel(x: ChoiceShape): string {
  return {
    box: tr('Box'),
    pill: tr('Pill (fully rounded)'),
    bubble: tr('Speech bubble'),
    banner: tr('Banner (notched ends)'),
    underline: tr('Text with a line underneath'),
    cut: tr('Cut corners'),
    tag: tr('Tag (pointed left end)'),
  }[x];
}

export function elementLabel(el: UiElementId | null, theme: Theme): string {
  if (!el) return tr('Theme');
  if (el === 'dialog') return tr('Dialogue Box');
  if (el === 'name') return tr('Name Box');
  if (el === 'choices') return tr('Choice Buttons');
  if (el === 'menubar') return tr('Menu Bar');
  const b = theme.menuBar.buttons.find((x) => `button:${x.id}` === el);
  return tr('Menu Button: {0}', { 0: b ? b.label || menuActionLabel(b.action) : '?' });
}

interface Props {
  theme: Theme;
  el: UiElementId | null;
  edit: Edit;
  onSelect: (el: UiElementId | null) => void;
  /** Family set in Settings → Fonts (used when the theme has no font of its own). */
  gameFont: string | null;
  /** Show every setting (Advanced) or only the essentials (Basic). */
  advanced: boolean;
  /** ▶ Preview: play an element's animation in the canvas. */
  onReplay?: (target: ReplayTarget) => void;
}

export function ThemeProps({ theme, el, edit, onSelect, gameFont, advanced, onReplay }: Props) {
  const anim = animEdit(edit);
  const surf = (pick: (t: Theme) => UiSurface, key: string) => (fn: (s: UiSurface) => void, k: string) => edit((t) => fn(pick(t)), `${key}:${k}`);
  const text = (pick: (t: Theme) => UiText, key: string) => (fn: (x: UiText) => void, k: string) => edit((t) => fn(pick(t)), `${key}:${k}`);
  const themeFontLabel = theme.fontFace ? theme.fontFace.family : gameFont ? tr('Game font ({0})', { 0: gameFont }) : tr('Theme font');

  if (!el) return <ThemeGeneral theme={theme} edit={edit} gameFont={gameFont} advanced={advanced} onReplay={onReplay} />;

  if (el === 'dialog') {
    const d = theme.dialog;
    return (
      <>
        <Section title={tr('Position & size')} testId="props-dialog-layout">
          <AnchorPicker value={d.anchor} onChange={(a) => edit((t) => void (t.dialog.anchor = a), 'd:anchor')} testId="dialog-anchor" />
          <div className="prop-grid">
            {advanced && <LengthInput label="X" value={d.x} onChange={(v) => edit((t) => void (t.dialog.x = v), 'd:x')} testId="dialog-x" />}
            {advanced && <LengthInput label="Y" value={d.y} onChange={(v) => edit((t) => void (t.dialog.y = v), 'd:y')} testId="dialog-y" />}
            <LengthInput label={tr('Width')} value={d.width} onChange={(v) => edit((t) => void (t.dialog.width = v), 'd:w')} testId="dialog-width" />
            <LengthInput label={tr('Height (minimum)')} value={d.height} onChange={(v) => edit((t) => void (t.dialog.height = v), 'd:h')} testId="dialog-height" />
          </div>
          {advanced && (
            <div className="prop-grid">
              <Slider label={tr('Padding X')} value={d.padding.x} min={0} max={160} onChange={(v) => edit((t) => void (t.dialog.padding.x = v), 'd:px')} testId="dialog-padding-x" />
              <Slider label={tr('Padding Y')} value={d.padding.y} min={0} max={120} onChange={(v) => edit((t) => void (t.dialog.padding.y = v), 'd:py')} testId="dialog-padding-y" />
            </div>
          )}
          <div className="small faint">{tr('px = pixels on a 1920×1080 screen, scaled to every screen size. % = share of the screen. The box never leaves the screen and grows (then scrolls) for long text.')}</div>
        </Section>
        <Section title={tr('Box style')}>
          {advanced && (
            <Field label={tr('Shape')}>
              <select className="select" value={d.frame} onChange={(e) => edit((t) => void (t.dialog.frame = e.target.value as DialogFrame), 'd:frame')} data-testid="dialog-frame">
                {DIALOG_FRAMES.map((f) => (
                  <option key={f} value={f}>
                    {frameLabel(f)}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <SurfaceEditor s={d.surface} set={surf((t) => t.dialog.surface, 'd')} prefix="dialog" advanced={advanced} />
        </Section>
        <Section title={tr('Text')}>
          <TextEditor x={d.text} set={text((t) => t.dialog.text, 'dt')} prefix="dialog-text" gameFontNote={themeFontLabel} advanced={advanced} />
          <Field label={tr('Text speed')}>
            <label className="check">
              <input type="checkbox" checked={d.textSpeed === null} onChange={(e) => edit((t) => void (t.dialog.textSpeed = e.target.checked ? null : 40), 'd:speed')} data-testid="dialog-speed-default" />
              {tr('Use the project’s text speed')}
            </label>
          </Field>
          {d.textSpeed !== null && <Slider label={tr('Characters per second')} value={d.textSpeed} min={5} max={200} onChange={(v) => edit((t) => void (t.dialog.textSpeed = v), 'd:speed')} testId="dialog-speed" />}
        </Section>
        <Section title={tr('Animation')} testId="props-dialog-anim">
          <AnimControl label={tr('Appear')} spec={theme.anim.dialogIn} onChange={(v, k) => anim((a) => void (a.dialogIn = v), `in:${k}`)} onPreview={onReplay && (() => onReplay('dialog'))} testId="anim-dialog-in" />
          <AnimControl label={tr('Disappear')} list={EXIT_PRESETS} spec={theme.anim.dialogOut} onChange={(v, k) => anim((a) => void (a.dialogOut = v), `out:${k}`)} onPreview={onReplay && (() => onReplay('dialog'))} testId="anim-dialog-out" />
          <Field label={tr('Text appears')}>
            <div className="row" style={{ gap: '0.3rem' }}>
              <select className="select grow" value={theme.anim.text} onChange={(e) => anim((a) => void (a.text = e.target.value as TextReveal), 'text')} data-testid="anim-text">
                {TEXT_REVEALS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {tr(o.label)}
                  </option>
                ))}
              </select>
              {onReplay && (
                <button type="button" className="btn sm" onClick={() => onReplay('text')} title={tr('Preview the animation')} aria-label={tr('Preview the animation')} data-testid="anim-text-preview">
                  ▶
                </button>
              )}
            </div>
          </Field>
          <Field label={tr('“Continue” mark')}>
            <select className="select" value={theme.anim.indicator} onChange={(e) => anim((a) => void (a.indicator = e.target.value as IndicatorAnim), 'indicator')} data-testid="anim-indicator">
              {INDICATOR_ANIMS.map((o) => (
                <option key={o.value} value={o.value}>
                  {tr(o.label)}
                </option>
              ))}
            </select>
          </Field>
        </Section>
      </>
    );
  }

  if (el === 'name') {
    const n = theme.nameBox;
    return (
      <>
        <Section title={tr('Name box')}>
          <label className="check">
            <input type="checkbox" checked={n.enabled} onChange={(e) => edit((t) => void (t.nameBox.enabled = e.target.checked), 'n:on')} data-testid="name-enabled" /> {tr('Show the name box')}
          </label>
          <Field label={tr('Placement')}>
            <select className="select" value={n.attach} onChange={(e) => edit((t) => void (t.nameBox.attach = e.target.value as 'inside' | 'outside'), 'n:attach')} data-testid="name-attach">
              <option value="inside">{tr('Inside the dialogue box')}</option>
              <option value="outside">{tr('On top of the dialogue box')}</option>
            </select>
          </Field>
          <Field label={tr('Align')}>
            <div className="seg">
              {(['left', 'center', 'right'] as const).map((a) => (
                <button key={a} type="button" className={n.align === a ? 'on' : ''} onClick={() => edit((t) => void (t.nameBox.align = a), 'n:align')}>
                  {a === 'left' ? tr('Left') : a === 'center' ? tr('Center') : tr('Right')}
                </button>
              ))}
            </div>
          </Field>
          {advanced && (
            <div className="prop-grid">
              <Slider label={tr('Offset X')} value={n.x} min={-400} max={400} onChange={(v) => edit((t) => void (t.nameBox.x = v), 'n:x')} testId="name-x" />
              <Slider label={tr('Offset Y')} value={n.y} min={-200} max={200} onChange={(v) => edit((t) => void (t.nameBox.y = v), 'n:y')} testId="name-y" />
              <Slider label={tr('Minimum width')} value={n.width} min={0} max={800} onChange={(v) => edit((t) => void (t.nameBox.width = v), 'n:w')} testId="name-width" />
              <Slider label={tr('Minimum height')} value={n.height} min={0} max={200} onChange={(v) => edit((t) => void (t.nameBox.height = v), 'n:h')} testId="name-height" />
              <Slider label={tr('Padding X')} value={n.padding.x} min={0} max={100} onChange={(v) => edit((t) => void (t.nameBox.padding.x = v), 'n:px')} />
              <Slider label={tr('Padding Y')} value={n.padding.y} min={0} max={60} onChange={(v) => edit((t) => void (t.nameBox.padding.y = v), 'n:py')} />
            </div>
          )}
          <label className="check">
            <input type="checkbox" checked={n.speakerColor} onChange={(e) => edit((t) => void (t.nameBox.speakerColor = e.target.checked), 'n:sc')} /> {tr('Underline in the character’s color')}
          </label>
        </Section>
        <Section title={tr('Box style')}>
          {advanced && (
            <Field label={tr('Shape')}>
              <select className="select" value={n.shape} onChange={(e) => edit((t) => void (t.nameBox.shape = e.target.value as NameShape), 'n:shape')} data-testid="name-shape">
                {NAME_SHAPES.map((x) => (
                  <option key={x} value={x}>
                    {shapeLabel(x)}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <SurfaceEditor s={n.surface} set={surf((t) => t.nameBox.surface, 'n')} prefix="name" advanced={advanced} />
        </Section>
        <Section title={tr('Text')}>
          <TextEditor x={n.text} set={text((t) => t.nameBox.text, 'nt')} prefix="name-text" gameFontNote={themeFontLabel} advanced={advanced} />
        </Section>
      </>
    );
  }

  if (el === 'choices') return <ChoiceProps theme={theme} edit={edit} surf={surf} text={text} fontLabel={themeFontLabel} advanced={advanced} onReplay={onReplay} />;

  // Menu bar or one of its buttons.
  const m = theme.menuBar;
  const btn = el.startsWith('button:') ? m.buttons.find((b) => `button:${b.id}` === el) : undefined;
  return (
    <>
      {btn && (
        <Section title={elementLabel(el, theme)} testId="props-menu-button">
          <Field label={tr('Action')}>
            <select className="select" value={btn.action} onChange={(e) => edit((t) => void (t.menuBar.buttons.find((b) => b.id === btn.id)!.action = e.target.value as MenuAction), `b:${btn.id}:a`)} data-testid="button-action">
              {MENU_ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {menuActionLabel(a)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={tr('Label (empty = default in the game’s language)')}>
            <input className="input" value={btn.label} placeholder={menuActionLabel(btn.action)} onChange={(e) => edit((t) => void (t.menuBar.buttons.find((b) => b.id === btn.id)!.label = e.target.value), `b:${btn.id}:l`)} data-testid="button-label" />
          </Field>
          <label className="check">
            <input type="checkbox" checked={btn.hideOnMobile} onChange={(e) => edit((t) => void (t.menuBar.buttons.find((b) => b.id === btn.id)!.hideOnMobile = e.target.checked), `b:${btn.id}:m`)} /> {tr('Hide on small screens (phones)')}
          </label>
          <div className="row wrap">
            <button className="btn sm" onClick={() => edit((t) => moveMenuButton(t, btn.id, -1), `b:move`)}>
              {tr('◀ Move earlier')}
            </button>
            <button className="btn sm" onClick={() => edit((t) => moveMenuButton(t, btn.id, 1), `b:move`)}>
              {tr('Move later ▶')}
            </button>
          </div>
        </Section>
      )}
      <Section title={tr('Menu bar')} testId="props-menubar">
        <label className="check">
          <input type="checkbox" checked={m.enabled} onChange={(e) => edit((t) => void (t.menuBar.enabled = e.target.checked), 'm:on')} data-testid="menubar-enabled" /> {tr('Show the menu bar')}
        </label>
        <AnchorPicker value={m.anchor} onChange={(a) => edit((t) => void (t.menuBar.anchor = a), 'm:anchor')} testId="menubar-anchor" />
        <div className="prop-grid">
          <LengthInput label="X" value={m.x} onChange={(v) => edit((t) => void (t.menuBar.x = v), 'm:x')} testId="menubar-x" />
          <LengthInput label="Y" value={m.y} onChange={(v) => edit((t) => void (t.menuBar.y = v), 'm:y')} testId="menubar-y" />
        </div>
        <Field label={tr('Direction')}>
          <select className="select" value={m.direction} onChange={(e) => edit((t) => void (t.menuBar.direction = e.target.value as 'row' | 'column'), 'm:dir')}>
            <option value="row">{tr('Horizontal')}</option>
            <option value="column">{tr('Vertical')}</option>
          </select>
        </Field>
        <div className="prop-grid">
          <Slider label={tr('Spacing')} value={m.spacing} min={0} max={60} onChange={(v) => edit((t) => void (t.menuBar.spacing = v), 'm:gap')} />
          <Slider label={tr('Button height')} value={m.height} min={20} max={140} onChange={(v) => edit((t) => void (t.menuBar.height = v), 'm:h')} testId="menubar-height" />
          <Slider label={tr('Minimum width')} value={m.minWidth} min={20} max={300} onChange={(v) => edit((t) => void (t.menuBar.minWidth = v), 'm:mw')} />
          <Slider label={tr('Padding X')} value={m.padding.x} min={0} max={80} onChange={(v) => edit((t) => void (t.menuBar.padding.x = v), 'm:px')} />
        </div>
        <div className="section-title">{tr('Buttons')}</div>
        <div className="col" style={{ gap: '0.3rem' }}>
          {m.buttons.map((b) => (
            <div key={b.id} className={`list-row ${el === `button:${b.id}` ? 'selected' : ''}`}>
              <button className="btn ghost sm grow" style={{ justifyContent: 'flex-start' }} onClick={() => onSelect(`button:${b.id}`)} data-testid={`select-button-${b.action}`}>
                {b.label || menuActionLabel(b.action)}
              </button>
              <button className="btn ghost sm icon" title={tr('Duplicate')} aria-label={tr('Duplicate')} onClick={() => edit((t) => void duplicateMenuButton(t, b.id), 'b:dup')}>
                ⧉
              </button>
              <button className="btn ghost sm icon" title={tr('Delete')} aria-label={tr('Delete')} onClick={() => edit((t) => void deleteMenuButton(t, b.id), 'b:del')}>
                ✕
              </button>
            </div>
          ))}
          <AddMenuButton onAdd={(a) => edit((t) => void t.menuBar.buttons.push({ id: newId('mb'), action: a, label: '', hideOnMobile: false }), 'b:add')} />
        </div>
      </Section>
      <Section title={tr('Button style')}>
        <SurfaceEditor s={m.surface} set={surf((t) => t.menuBar.surface, 'm')} prefix="menubar" advanced={advanced} />
        <ColorField label={tr('Hover background')} value={m.hover.background} onChange={(v) => edit((t) => void (t.menuBar.hover.background = v), 'm:hbg')} />
        <ColorField label={tr('Hover text color')} value={m.hover.color} onChange={(v) => edit((t) => void (t.menuBar.hover.color = v), 'm:hc')} />
      </Section>
      <Section title={tr('Text')}>
        <TextEditor x={m.text} set={text((t) => t.menuBar.text, 'mt')} prefix="menubar-text" gameFontNote={themeFontLabel} advanced={advanced} />
      </Section>
    </>
  );
}

function AddMenuButton({ onAdd }: { onAdd: (a: MenuAction) => void }) {
  const [action, setAction] = useState<MenuAction>('skip');
  return (
    <div className="row">
      <select className="select grow" value={action} onChange={(e) => setAction(e.target.value as MenuAction)} aria-label={tr('Action')} data-testid="new-button-action">
        {MENU_ACTIONS.map((a) => (
          <option key={a} value={a}>
            {menuActionLabel(a)}
          </option>
        ))}
      </select>
      <button className="btn sm" onClick={() => onAdd(action)} data-testid="add-menu-button">
        {tr('＋ Add button')}
      </button>
    </div>
  );
}

function ChoiceProps({
  theme,
  edit,
  surf,
  text,
  fontLabel,
  advanced,
  onReplay,
}: {
  theme: Theme;
  edit: Edit;
  advanced: boolean;
  onReplay?: (target: ReplayTarget) => void;
  surf: (pick: (t: Theme) => UiSurface, key: string) => (fn: (s: UiSurface) => void, k: string) => void;
  text: (pick: (t: Theme) => UiText, key: string) => (fn: (x: UiText) => void, k: string) => void;
  fontLabel: string;
}) {
  const [state, setState] = useState<ChoiceState>('normal');
  const c = theme.choice;
  const s = c.states[state];
  const stateName: Record<ChoiceState, string> = { normal: tr('Normal'), hover: tr('Hover'), pressed: tr('Pressed'), disabled: tr('Disabled') };
  return (
    <>
      <Section title={tr('Position & size')}>
        <AnchorPicker value={c.anchor} onChange={(a) => edit((t) => void (t.choice.anchor = a), 'c:anchor')} testId="choice-anchor" />
        <div className="prop-grid">
          {advanced && <LengthInput label="X" value={c.x} onChange={(v) => edit((t) => void (t.choice.x = v), 'c:x')} testId="choice-x" />}
          {advanced && <LengthInput label="Y" value={c.y} onChange={(v) => edit((t) => void (t.choice.y = v), 'c:y')} testId="choice-y" />}
          <LengthInput label={tr('Button width')} value={c.width} onChange={(v) => edit((t) => void (t.choice.width = v), 'c:w')} testId="choice-width" />
        </div>
        <div className="prop-grid">
          {advanced && <Slider label={tr('Minimum width')} value={c.minWidth} min={0} max={1200} onChange={(v) => edit((t) => void (t.choice.minWidth = v), 'c:mw')} testId="choice-min-width" />}
          {advanced && <Slider label={tr('Button height (minimum)')} value={c.height} min={30} max={200} onChange={(v) => edit((t) => void (t.choice.height = v), 'c:h')} testId="choice-height" />}
          <Slider label={tr('Spacing')} value={c.spacing} min={0} max={80} onChange={(v) => edit((t) => void (t.choice.spacing = v), 'c:gap')} testId="choice-spacing" />
          {advanced && <Slider label={tr('Padding X')} value={c.padding.x} min={0} max={120} onChange={(v) => edit((t) => void (t.choice.padding.x = v), 'c:px')} />}
          {advanced && <Slider label={tr('Padding Y')} value={c.padding.y} min={0} max={80} onChange={(v) => edit((t) => void (t.choice.padding.y = v), 'c:py')} />}
        </div>
        <div className="small faint">{tr('Choices always use the free space next to the dialogue box, so they never cover it.')}</div>
      </Section>
      {advanced && (
        <Section title={tr('Shape & icon')} testId="props-choice-shape">
          <Field label={tr('Shape')}>
            <select className="select" value={c.shape} onChange={(e) => edit((t) => void (t.choice.shape = e.target.value as ChoiceShape), 'c:shape')} data-testid="choice-shape">
              {CHOICE_SHAPES.map((x) => (
                <option key={x} value={x}>
                  {choiceShapeLabel(x)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={tr('Icon in front of each option')} tip={tr('A symbol or emoji shown before the text of every option, e.g. ▶ ◆ ♥ ★. Leave empty for none.')}>
            <div className="row" style={{ gap: '0.3rem' }}>
              <input className="input" style={{ width: '5rem' }} value={c.icon} maxLength={4} onChange={(e) => edit((t) => void (t.choice.icon = e.target.value), 'c:icon')} placeholder={tr('none')} data-testid="choice-icon" />
              {CHOICE_ICONS.map((i) => (
                <button key={i} type="button" className={`btn sm ${c.icon === i ? 'active' : ''}`} onClick={() => edit((t) => void (t.choice.icon = c.icon === i ? '' : i), 'c:icon')} aria-pressed={c.icon === i} data-testid={`choice-icon-${i}`}>
                  {i}
                </button>
              ))}
            </div>
          </Field>
        </Section>
      )}
      <Section title={tr('States')} testId="props-choice-states">
        <div className="seg" role="tablist">
          {(Object.keys(stateName) as ChoiceState[]).map((k) => (
            <button key={k} type="button" role="tab" className={state === k ? 'on' : ''} aria-selected={state === k} onClick={() => setState(k)} data-testid={`choice-state-${k}`}>
              {stateName[k]}
            </button>
          ))}
        </div>
        <ColorField label={tr('Background color')} value={s.background} onChange={(v) => edit((t) => void (t.choice.states[state].background = v), `c:${state}:bg`)} testId="choice-state-bg" />
        <ColorField label={tr('Text color')} value={s.color} onChange={(v) => edit((t) => void (t.choice.states[state].color = v), `c:${state}:c`)} testId="choice-state-color" />
        {advanced && (
          <>
            <Slider label={tr('Background opacity')} value={s.opacity} min={0} max={1} step={0.05} onChange={(v) => edit((t) => void (t.choice.states[state].opacity = v), `c:${state}:op`)} testId="choice-state-opacity" />
            <ColorField label={tr('Border color')} value={s.borderColor} onChange={(v) => edit((t) => void (t.choice.states[state].borderColor = v), `c:${state}:bc`)} />
          </>
        )}
        {(advanced || c.preset === 'image') && (
          <ImageField
            label={tr('Button picture ({0})', { 0: stateName[state] })}
            tip={tr('Your own picture for this state of the button (Image Button). Empty states use the Normal picture.')}
            value={s.image}
            onChange={(v) => edit((t) => void (t.choice.states[state].image = v), `c:${state}:img`)}
            testId="choice-state-image"
          />
        )}
      </Section>
      {advanced && (
        <Section title={tr('Hover & press feedback')}>
          <Field label={tr('Hover animation')}>
            <select className="select" value={c.hoverAnimation} onChange={(e) => edit((t) => void (t.choice.hoverAnimation = e.target.value as Theme['choice']['hoverAnimation']), 'c:ha')} data-testid="choice-hover-anim">
              <option value="none">{tr('None')}</option>
              <option value="grow">{tr('Grow')}</option>
              <option value="lift">{tr('Lift')}</option>
              <option value="glow">{tr('Glow')}</option>
              <option value="slide">{tr('Slide')}</option>
            </select>
          </Field>
          <Field label={tr('Pressed animation')}>
            <select className="select" value={c.pressAnimation} onChange={(e) => edit((t) => void (t.choice.pressAnimation = e.target.value as Theme['choice']['pressAnimation']), 'c:pa')} data-testid="choice-press-anim">
              <option value="none">{tr('None')}</option>
              <option value="shrink">{tr('Shrink')}</option>
              <option value="sink">{tr('Sink')}</option>
            </select>
          </Field>
          <Slider label={tr('Animation speed (seconds)')} value={c.animationSpeed} min={0} max={1} step={0.05} onChange={(v) => edit((t) => void (t.choice.animationSpeed = v), 'c:speed')} />
        </Section>
      )}
      {advanced && (
        <Section title={tr('Button style')}>
          <SurfaceEditor s={c.surface} set={surf((t) => t.choice.surface, 'c')} prefix="choice" colors={false} advanced={advanced} />
        </Section>
      )}
      <Section title={tr('Text')}>
        <TextEditor x={c.text} set={text((t) => t.choice.text, 'ct')} prefix="choice-text" color={false} gameFontNote={fontLabel} advanced={advanced} />
      </Section>
      <Section title={tr('Animation')} testId="props-choice-anim">
        <AnimControl
          label={tr('Appear')}
          spec={theme.anim.choicesIn}
          onChange={(v, k) => animEdit(edit)((a) => void (a.choicesIn = v), `choices:${k}`)}
          onPreview={onReplay && (() => onReplay('choices'))}
          testId="anim-choices-in"
        />
        {theme.anim.choicesIn.kind !== 'none' && (
          <label className="check">
            <input
              type="checkbox"
              checked={theme.anim.choiceStagger > 0}
              onChange={(e) => animEdit(edit)((a) => void (a.choiceStagger = e.target.checked ? 0.08 : 0), 'stagger')}
              data-testid="anim-choices-stagger"
            />{' '}
            {tr('One after another')}
          </label>
        )}
      </Section>
    </>
  );
}

function ThemeGeneral({ theme, edit, gameFont, advanced, onReplay }: { theme: Theme; edit: Edit; gameFont: string | null; advanced: boolean; onReplay?: (target: ReplayTarget) => void }) {
  const a = theme.accessibility;
  return (
    <>
      <Section title={tr('Theme')} testId="props-theme">
        <Field label={tr('Theme name')}>
          <input className="input" value={theme.name} onChange={(e) => edit((t) => void (t.name = e.target.value), 'name')} data-testid="theme-name" />
        </Field>
        <FontField
          label={tr('Theme font')}
          value={theme.fontFace}
          defaultLabel={tr('Built-in font')}
          onChange={(f) => edit((t) => void (t.fontFace = f), 'fontFace')}
          testId="theme-font"
        />
        {gameFont && <div className="small faint">{tr('Settings → Fonts sets the game font “{0}”; it replaces this theme font (fonts chosen for single elements still win).', { 0: gameFont })}</div>}
        {advanced && (
          <Field label={tr('Fallback fonts')} tip={tr('Used for letters the chosen font does not have, and when it is not installed on the player’s computer.')}>
            <select className="select" value={theme.font} onChange={(e) => edit((t) => void (t.font = e.target.value), 'font')}>
              {FALLBACK_FONTS.map((f) => (
                <option key={f.label} value={f.value}>
                  {tr(f.label)}
                </option>
              ))}
              {!FALLBACK_FONTS.some((f) => f.value === theme.font) && <option value={theme.font}>{tr('Current')}</option>}
            </select>
          </Field>
        )}
        <AnimControl
          label={tr('Dialogue box animation')}
          spec={theme.anim.dialogIn}
          onChange={(v, k) => animEdit(edit)((a) => void (a.dialogIn = v), `in:${k}`)}
          onPreview={onReplay && (() => onReplay('dialog'))}
          testId="theme-animation"
        />
      </Section>
      <Section title={tr('Menus & title screen')}>
        <ColorField label={tr('Background')} value={theme.menu.background} onChange={(v) => edit((t) => void (t.menu.background = v), 'mbg')} />
        <Slider label={tr('Opacity')} value={theme.menu.opacity} min={0} max={1} step={0.05} onChange={(v) => edit((t) => void (t.menu.opacity = v), 'mop')} />
        <ColorField label={tr('Text color')} value={theme.menu.color} onChange={(v) => edit((t) => void (t.menu.color = v), 'mc')} />
        <ColorField label={tr('Accent')} value={theme.menu.accent} onChange={(v) => edit((t) => void (t.menu.accent = v), 'ma')} testId="theme-accent" />
      </Section>
      <Section title={tr('Accessibility')} testId="props-accessibility">
        <Slider label={tr('Minimum text size')} suffix="px" value={a.minFontSize} min={10} max={24} onChange={(v) => edit((t) => void (t.accessibility.minFontSize = v), 'a:font')} testId="min-font-size" />
        <Slider label={tr('Minimum touch target')} suffix="px" value={a.minTouchTarget} min={24} max={72} onChange={(v) => edit((t) => void (t.accessibility.minTouchTarget = v), 'a:touch')} testId="min-touch" />
        <label className="check">
          <input type="checkbox" checked={a.highContrast} onChange={(e) => edit((t) => void (t.accessibility.highContrast = e.target.checked), 'a:hc')} data-testid="high-contrast" /> {tr('High contrast by default')}
        </label>
        <div className="small faint">{tr('Players can also change the text size and turn high contrast on or off in the game’s Settings.')}</div>
      </Section>
    </>
  );
}
