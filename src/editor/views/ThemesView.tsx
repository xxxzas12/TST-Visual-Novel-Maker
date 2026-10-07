import { t as tr } from '../../shared/i18n';
import { useEffect, useMemo, useState } from 'react';
import type { GameData, Project, Theme } from '../../shared/types';
import { THEME_PRESETS, resolveTheme } from '../../shared/themes';
import { buildGameData } from '../../shared/gamedata';
import { createAction } from '../../shared/actions';
import { newId, deepClone } from '../../shared/ids';
import { useProject } from '../store/project';
import { confirmDialog, toast } from '../store/ui';
import { PreviewFrame } from '../components/PreviewFrame';
import { ColorInput, NumberInput } from './scenes/fields';

const FONTS = [
  { label: 'Modern Sans', value: '"Segoe UI", "Noto Sans Thai", "Noto Sans", system-ui, sans-serif' },
  { label: 'Serif', value: 'Georgia, "Times New Roman", "Noto Serif Thai", serif' },
  { label: 'Storybook', value: '"Palatino Linotype", "Book Antiqua", Palatino, "Noto Serif Thai", serif' },
  { label: 'Rounded', value: '"Trebuchet MS", "Segoe UI", "Noto Sans Thai", sans-serif' },
  { label: 'Typewriter', value: '"Courier New", Consolas, monospace' },
  { label: 'Handwritten', value: '"Comic Sans MS", "Segoe Print", cursive' },
];

function Swatches({ t }: { t: Theme }) {
  return (
    <div className="row" style={{ gap: 4 }}>
      {[t.dialog.background, t.nameBox.background, t.choice.hoverBackground, t.menu.accent, t.textColor].map((c, i) => (
        <span key={i} style={{ width: 16, height: 16, borderRadius: 4, background: c, border: '1px solid var(--line2)' }} />
      ))}
    </div>
  );
}

/** A tiny game that shows the theme's dialogue box, name box and choices. */
export function demoGame(base: GameData, theme: Theme, project: Project): GameData {
  const assets = { ...base.assets };
  const bgAsset = project.assets.find((a) => a.type === 'background' && a.kind === 'image');
  const bg = bgAsset ? ([bgAsset.id, bgAsset] as const) : undefined;
  if (bgAsset) assets[bgAsset.id] = { path: bgAsset.path, type: bgAsset.type, kind: bgAsset.kind, width: bgAsset.width, height: bgAsset.height };
  const ch = base.characters[0];
  for (const e of ch?.expressions ?? []) {
    const a = project.assets.find((x) => x.id === e.assetId);
    if (a) assets[a.id] = { path: a.path, type: a.type, kind: a.kind, width: a.width, height: a.height };
  }
  const actions = [
    createAction('changeBackground', bg ? { assetId: bg[0], transition: 'none' } : { color: '#4b5d8a', transition: 'none' }),
    ...(ch ? [createAction('addCharacter', { characterId: ch.id, enter: 'none' })] : []),
    createAction('dialogue', { speaker: ch?.id ?? '', text: 'This is how dialogue looks with this theme. Click to see a choice!' }),
    createAction('choice', {
      question: 'Which option do you like?',
      options: [
        { id: 'a', text: 'The first option', target: { kind: 'next' }, condition: null },
        { id: 'b', text: 'The second option', target: { kind: 'next' }, condition: null },
      ],
    }),
    createAction('narration', { text: 'Narration text appears without a name box.' }),
  ];
  return { ...base, id: 'theme-preview', theme, assets, startSceneId: 'demo', sceneOrder: ['demo'], scenes: [{ id: 'demo', name: 'Demo', actions }] };
}

export function ThemesView() {
  const project = useProject((s) => s.project)!;
  const activeId = project.settings.themeId;
  const [selId, setSelId] = useState(activeId);
  const all = [...THEME_PRESETS, ...project.themes];
  const sel = resolveTheme(selId, project.themes);
  const isCustom = project.themes.some((t) => t.id === selId);
  const base = useMemo(() => buildGameData(project), [project]);
  const [previewTheme, setPreviewTheme] = useState(sel);
  useEffect(() => {
    const t = setTimeout(() => setPreviewTheme(sel), 250);
    return () => clearTimeout(t);
  }, [sel]);
  const game = useMemo(() => demoGame(base, previewTheme, project), [base, previewTheme, project]);

  const edit = (fn: (t: Theme) => void, key: string) =>
    useProject.getState().update((p) => {
      const t = p.themes.find((x) => x.id === selId);
      if (t) fn(t);
    }, `theme:${selId}:${key}`);

  const createCustom = () => {
    const copy = deepClone(sel);
    copy.id = newId('th');
    copy.name = `${tr(sel.name)} (${tr("custom")})`;
    copy.preset = undefined;
    useProject.getState().update((p) => {
      p.themes.push(copy);
      p.settings.themeId = copy.id;
    });
    setSelId(copy.id);
    toast(tr("Custom theme created and applied"), 'success');
  };

  const removeCustom = async () => {
    if (!(await confirmDialog({ title: tr("Delete theme “{0}”?", { 0: sel.name }), message: tr("Games using it will switch to the Modern theme."), confirmLabel: tr("Delete"), danger: true }))) return;
    useProject.getState().update((p) => {
      p.themes = p.themes.filter((t) => t.id !== selId);
      if (p.settings.themeId === selId) p.settings.themeId = 'modern';
    });
    setSelId('modern');
  };

  const color = (label: string, get: (t: Theme) => string, set: (t: Theme, v: string) => void, key: string) => (
    <div className="field">
      <span className="field-label">{label}</span>
      <ColorInput value={get(sel)} onChange={(v) => edit((t) => set(t, v), key)} />
    </div>
  );
  const num = (label: string, get: (t: Theme) => number, set: (t: Theme, v: number) => void, key: string, min = 0, max = 100, step = 1) => (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="slider-row">
        <input type="range" min={min} max={max} step={step} value={get(sel)} onChange={(e) => edit((t) => set(t, parseFloat(e.target.value)), key)} aria-label={label} />
        <NumberInput value={get(sel)} step={step} onChange={(v) => edit((t) => set(t, v), key)} />
      </div>
    </div>
  );

  return (
    <>
      <div className="view-header">
        <h2>{tr("Themes")}</h2>
        <span className="muted small">{tr("How the game’s dialogue box, name box, choices and menus look to players.")}</span>
        <span className="grow" />
        <button className="btn sm primary" onClick={createCustom} data-testid="create-theme">
          {tr("＋ Create Custom Theme")}
        </button>
      </div>
      <div className="view-body">
        <div className="two-col" style={{ gridTemplateColumns: '16rem 1fr' }}>
          <div className="col">
            {all.map((t) => (
              <button key={t.id} className={`card ${t.id === selId ? 'selected' : ''}`} onClick={() => setSelId(t.id)} data-testid={`theme-${t.name}`}>
                <div className="row">
                  <b className="grow">{tr(t.name)}</b>
                  {t.id === activeId && <span className="badge ok">{tr("in use")}</span>}
                </div>
                <Swatches t={t} />
              </button>
            ))}
          </div>
          <div className="col" style={{ gap: '1rem' }}>
            <div className="row">
              <h3 className="grow">{tr(sel.name)}</h3>
              {selId !== activeId && (
                <button className="btn primary sm" onClick={() => useProject.getState().update((p) => void (p.settings.themeId = selId))} data-testid="use-theme">
                  {tr("✓ Use this theme")}
                </button>
              )}
              {!isCustom && (
                <button className="btn sm" onClick={createCustom}>
                  {tr("✏️ Customize a copy")}
                </button>
              )}
              {isCustom && (
                <button className="btn sm danger" onClick={() => void removeCustom()}>
                  {tr("🗑 Delete")}
                </button>
              )}
            </div>
            <PreviewFrame game={game} skipTitle sceneId="demo" index={0} namespace="tstvn-theme-preview" className="theme-preview-frame" testId="theme-preview" />
            {isCustom ? (
              <div className="cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(16rem, 1fr))', alignItems: 'start' }} data-testid="theme-editor">
                <div className="sub-card">
                  <div className="section-title">{tr("Text")}</div>
                  <div className="field">
                    <span className="field-label">{tr("Theme name")}</span>
                    <input className="input" value={sel.name} onChange={(e) => edit((t) => void (t.name = e.target.value), 'name')} />
                  </div>
                  <div className="field">
                    <span className="field-label">{tr("Font")}</span>
                    <select className="select" value={sel.font} onChange={(e) => edit((t) => void (t.font = e.target.value), 'font')}>
                      {FONTS.map((f) => (
                        <option key={f.label} value={f.value}>
                          {tr(f.label)}
                        </option>
                      ))}
                      {!FONTS.some((f) => f.value === sel.font) && <option value={sel.font}>{tr("Current")}</option>}
                    </select>
                  </div>
                  {num('Font size', (t) => t.fontSize, (t, v) => void (t.fontSize = v), 'fs', 14, 48)}
                  {color('Text color', (t) => t.textColor, (t, v) => void (t.textColor = v), 'tc')}
                  <div className="field">
                    <span className="field-label">{tr("Box animation")}</span>
                    <select className="select" value={sel.animation} onChange={(e) => edit((t) => void (t.animation = e.target.value as Theme['animation']), 'anim')}>
                      <option value="fade">{tr("Fade")}</option>
                      <option value="slide">{tr("Slide up")}</option>
                      <option value="none">{tr("None")}</option>
                    </select>
                  </div>
                </div>
                <div className="sub-card">
                  <div className="section-title">{tr("Dialogue box")}</div>
                  {color('Background', (t) => t.dialog.background, (t, v) => void (t.dialog.background = v), 'dbg')}
                  {num('Opacity', (t) => t.dialog.opacity, (t, v) => void (t.dialog.opacity = v), 'dop', 0, 1, 0.05)}
                  {color('Border color', (t) => t.dialog.borderColor, (t, v) => void (t.dialog.borderColor = v), 'dbc')}
                  {num('Border width', (t) => t.dialog.borderWidth, (t, v) => void (t.dialog.borderWidth = v), 'dbw', 0, 10)}
                  {num('Corner radius', (t) => t.dialog.radius, (t, v) => void (t.dialog.radius = v), 'dr', 0, 40)}
                  {num('Width (%)', (t) => t.dialog.width, (t, v) => void (t.dialog.width = v), 'dw', 50, 100)}
                  {num('Padding', (t) => t.dialog.padding, (t, v) => void (t.dialog.padding = v), 'dp', 8, 60)}
                  <div className="field">
                    <span className="field-label">{tr("Position")}</span>
                    <select className="select" value={sel.dialog.position} onChange={(e) => edit((t) => void (t.dialog.position = e.target.value as Theme['dialog']['position']), 'dpos')}>
                      <option value="bottom">{tr("Bottom")}</option>
                      <option value="middle">{tr("Middle")}</option>
                      <option value="top">{tr("Top")}</option>
                    </select>
                  </div>
                  <label className="check">
                    <input type="checkbox" checked={sel.dialog.shadow} onChange={(e) => edit((t) => void (t.dialog.shadow = e.target.checked), 'dsh')} /> {tr("Shadow")}
                  </label>
                </div>
                <div className="sub-card">
                  <div className="section-title">{tr("Name box")}</div>
                  {color('Background', (t) => t.nameBox.background, (t, v) => void (t.nameBox.background = v), 'nbg')}
                  {color('Text color', (t) => t.nameBox.color, (t, v) => void (t.nameBox.color = v), 'nc')}
                  {num('Corner radius', (t) => t.nameBox.radius, (t, v) => void (t.nameBox.radius = v), 'nr', 0, 30)}
                </div>
                <div className="sub-card">
                  <div className="section-title">{tr("Choice buttons")}</div>
                  {color('Background', (t) => t.choice.background, (t, v) => void (t.choice.background = v), 'cbg')}
                  {num('Opacity', (t) => t.choice.opacity, (t, v) => void (t.choice.opacity = v), 'cop', 0, 1, 0.05)}
                  {color('Text color', (t) => t.choice.color, (t, v) => void (t.choice.color = v), 'cc')}
                  {color('Hover color', (t) => t.choice.hoverBackground, (t, v) => void (t.choice.hoverBackground = v), 'ch')}
                  {color('Border color', (t) => t.choice.borderColor, (t, v) => void (t.choice.borderColor = v), 'cb')}
                  {num('Corner radius', (t) => t.choice.radius, (t, v) => void (t.choice.radius = v), 'cr', 0, 40)}
                </div>
                <div className="sub-card">
                  <div className="section-title">{tr("Menus")}</div>
                  {color('Background', (t) => t.menu.background, (t, v) => void (t.menu.background = v), 'mbg')}
                  {num('Opacity', (t) => t.menu.opacity, (t, v) => void (t.menu.opacity = v), 'mop', 0, 1, 0.05)}
                  {color('Text color', (t) => t.menu.color, (t, v) => void (t.menu.color = v), 'mc')}
                  {color('Accent', (t) => t.menu.accent, (t, v) => void (t.menu.accent = v), 'ma')}
                </div>
              </div>
            ) : (
              <div className="small muted">{tr("Presets can’t be edited directly — click “Customize a copy” to make your own version.")}</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
