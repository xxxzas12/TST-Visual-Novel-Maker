import { t as tr } from '../../shared/i18n';
import { useMemo, useRef, useState } from 'react';
import type { GameData, Project, Theme } from '../../shared/types';
import { THEME_PRESETS, resolveTheme, themeFontRefs } from '../../shared/themes';
import { buildGameData, gameTheme } from '../../shared/gamedata';
import { createAction } from '../../shared/actions';
import { newId, deepClone } from '../../shared/ids';
import { makeContext } from '../../shared/uilayout';
import { DEVICES, alignElement, canAlign, checkAllDevices, deleteMenuButton, duplicateMenuButton, moveElement, positioned, type AlignEdge, type UiElementId } from '../../shared/uicheck';
import { useProject, getDir } from '../store/project';
import { confirmDialog, toast } from '../store/ui';
import { api } from '../api';
import { run } from '../ops';
import { Modal } from '../components/Modal';
import { UiCanvas } from './themes/UiCanvas';
import { ThemeProps, elementLabel, menuActionLabel } from './themes/ThemeProps';

function Swatches({ t }: { t: Theme }) {
  return (
    <div className="row" style={{ gap: 4 }}>
      {[t.dialog.surface.background, t.nameBox.surface.background, t.choice.states.hover.background, t.menu.accent, t.dialog.text.color].map((c, i) => (
        <span
          key={i}
          style={{
            width: 16,
            height: 16,
            borderRadius: 4,
            background: c,
            border: '1px solid var(--line2)',
          }}
        />
      ))}
    </div>
  );
}

/** A tiny game that shows the theme's dialogue box, name box and choices. */
export function demoGame(base: GameData, theme: Theme, project: Project): GameData {
  const assets = { ...base.assets };
  // Every image is available so theme images picked in the editor show up immediately.
  for (const a of project.assets)
    if (a.kind === 'image')
      assets[a.id] = {
        path: a.path,
        type: a.type,
        kind: a.kind,
        width: a.width,
        height: a.height,
      };
  const bg = project.assets.find((a) => a.type === 'background' && a.kind === 'image');
  const ch = base.characters[0];
  const actions = [
    createAction('changeBackground', bg ? { assetId: bg.id, transition: 'none' } : { color: '#4b5d8a', transition: 'none' }),
    ...(ch ? [createAction('addCharacter', { characterId: ch.id, enter: 'none' })] : []),
    createAction('dialogue', {
      speaker: ch?.id ?? '',
      text: tr('This is how dialogue looks with this theme. Click to see a choice!'),
    }),
    createAction('choice', {
      question: tr('Which option do you like?'),
      options: [
        {
          id: 'a',
          text: tr('The first option'),
          target: { kind: 'next' },
          condition: null,
        },
        {
          id: 'b',
          text: tr('The second option'),
          target: { kind: 'next' },
          condition: null,
        },
      ],
    }),
    createAction('narration', {
      text: tr('Narration text appears without a name box.'),
    }),
  ];
  const fonts = [...(base.fonts ?? [])];
  for (const f of themeFontRefs(theme)) if (f.file && !fonts.some((x) => x.path === f.file)) fonts.push({ family: f.family, path: f.file });
  return {
    ...base,
    id: 'theme-preview',
    theme,
    themes: {},
    fonts,
    assets,
    startSceneId: 'demo',
    sceneOrder: ['demo'],
    scenes: [{ id: 'demo', name: 'Demo', actions }],
  };
}

const ALIGN: { edge: AlignEdge; icon: string; label: string }[] = [
  { edge: 'left', icon: '⇤', label: 'Align left' },
  { edge: 'hcenter', icon: '↔', label: 'Center horizontally' },
  { edge: 'right', icon: '⇥', label: 'Align right' },
  { edge: 'top', icon: '⤒', label: 'Align top' },
  { edge: 'vcenter', icon: '↕', label: 'Center vertically' },
  { edge: 'bottom', icon: '⤓', label: 'Align bottom' },
];

const DEVICE_ICON: Record<string, string> = {
  desktop: '🖥',
  laptop: '💻',
  tablet: '📱',
  'tablet-portrait': '📱',
  phone: '📱',
  'phone-portrait': '📱',
};

export function ThemesView() {
  const project = useProject((s) => s.project)!;
  const activeId = project.settings.themeId;
  const [selId, setSelId] = useState(activeId);
  const [el, setEl] = useState<UiElementId | null>('dialog');
  const [deviceId, setDeviceId] = useState('desktop');
  const [mode, setMode] = useState<'design' | 'play'>('design');
  const [scenesOpen, setScenesOpen] = useState(false);
  const [showChecks, setShowChecks] = useState(true);
  const device = DEVICES.find((d) => d.id === deviceId) ?? DEVICES[0];
  const sel = resolveTheme(selId, project.themes);
  const isCustom = project.themes.some((t) => t.id === selId);
  const live = useMemo(() => gameTheme(project, sel.id), [project, sel.id]);
  const sceneUses = project.scenes.filter((s) => s.themeId === selId).length;

  // The demo game only restarts when its content changes (fonts, assets, characters), not on every style edit.
  const liveRef = useRef(live);
  liveRef.current = live;
  const fontKey = themeFontRefs(live)
    .map((f) => f.file ?? '')
    .join('|');
  const game = useMemo(() => {
    const p = useProject.getState().project!;
    return demoGame(buildGameData(p), liveRef.current, p);
    // Restart triggers only: style edits reach the running preview live (liveTheme).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.assets, project.characters, project.settings.language, fontKey]);

  const labels = useMemo(() => Object.fromEntries((['auto', 'skip', 'save', 'load', 'settings', 'hide', 'menu'] as const).map((a) => [a, menuActionLabel(a)])), []);
  const issues = useMemo(() => checkAllDevices(live, labels), [live, labels]);
  const sample = useMemo(
    () => ({
      speaker: project.characters[0]?.displayName || project.characters[0]?.name || tr('Character'),
      text: tr('Dialogue text appears here. Drag a box to move it, drag the handles to resize it.'),
      choices: [tr('Choice (normal)'), tr('Choice (hover)'), tr('Choice (pressed)'), tr('Choice (disabled)')],
    }),
    [project.characters],
  );

  const readOnly = () => toast(tr('Presets can’t be edited directly — click “Edit a copy” to make your own version.'), 'info');

  const edit = (fn: (t: Theme) => void, key: string) => {
    if (!isCustom) return readOnly();
    useProject.getState().update((p) => {
      const t = p.themes.find((x) => x.id === selId);
      if (t) fn(t);
    }, `theme:${selId}:${key}`);
  };

  const replaceTheme = (next: Theme, key: string) => {
    if (!isCustom) return readOnly();
    useProject.getState().update((p) => {
      const i = p.themes.findIndex((x) => x.id === selId);
      if (i >= 0) p.themes[i] = { ...next, id: selId, name: p.themes[i].name };
    }, `theme:${selId}:${key}`);
  };

  const copyOf = (apply: boolean, name?: string) => {
    const copy = deepClone(sel);
    copy.id = newId('th');
    copy.name = name ?? `${tr(sel.name)} (${tr('custom')})`;
    copy.preset = undefined;
    useProject.getState().update((p) => {
      p.themes.push(copy);
      if (apply) p.settings.themeId = copy.id;
    });
    setSelId(copy.id);
    return copy;
  };

  const createCustom = () => {
    copyOf(true);
    toast(tr('Custom theme created and applied'), 'success');
  };

  const saveAsPreset = () => {
    const copy = copyOf(false, tr('{0} copy', { 0: tr(sel.name) }));
    toast(tr('Saved as custom preset “{0}”', { 0: copy.name }), 'success');
  };

  const removeCustom = async () => {
    const msg = sceneUses
      ? tr('Games using it will switch to the Modern theme. {0} scene(s) using it will use the project theme.', { 0: sceneUses })
      : tr('Games using it will switch to the Modern theme.');
    if (
      !(await confirmDialog({
        title: tr('Delete theme “{0}”?', { 0: sel.name }),
        message: msg,
        confirmLabel: tr('Delete'),
        danger: true,
      }))
    )
      return;
    useProject.getState().update((p) => {
      p.themes = p.themes.filter((t) => t.id !== selId);
      if (p.settings.themeId === selId) p.settings.themeId = 'modern';
      for (const s of p.scenes) if (s.themeId === selId) s.themeId = null;
    });
    setSelId('modern');
  };

  const exportTheme = async () => {
    const file = await api.dialog.saveFile(tr('Export theme'), `${getDir()}\\${sel.name.replace(/[\\/:*?"<>|]+/g, '_')}.tsttheme`, [{ name: tr('TSTVN theme'), extensions: ['tsttheme'] }]);
    if (!file) return;
    const r = await run(() => api.themes.exportFile(getDir(), sel, project.assets, file), tr('Theme export failed'));
    if (r) toast(tr('Theme exported ({0} files)', { 0: r.files }), 'success');
  };

  const importTheme = async () => {
    const files = await api.dialog.pickFiles(tr('Import theme'), [{ name: tr('TSTVN theme'), extensions: ['tsttheme'] }], false);
    if (!files[0]) return;
    const r = await run(() => api.themes.importFile(getDir(), files[0], useProject.getState().project!.assets), tr('Theme import failed'));
    if (!r) return;
    useProject.getState().update((p) => {
      p.assets.push(...r.added);
      p.themes.push(r.theme);
    });
    setSelId(r.theme.id);
    toast(tr('Theme “{0}” imported', { 0: r.theme.name }), 'success');
  };

  const align = (edge: AlignEdge) => el && edit((t) => alignElement(t, el, edge), `align:${el}`);
  const isButton = !!el?.startsWith('button:');
  const buttonId = isButton ? el!.slice(7) : '';
  const duplicate = () => {
    if (!isButton) return;
    let nid: string | null = null;
    edit((t) => void (nid = duplicateMenuButton(t, buttonId)), 'dup');
    if (nid) setEl(`button:${nid}`);
  };
  const remove = () => {
    if (!isButton) return;
    edit((t) => void deleteMenuButton(t, buttonId), 'del');
    setEl('menubar');
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!el || mode !== 'design' || (e.target as HTMLElement).closest('input, select, textarea')) return;
    const step = e.shiftKey ? 10 : 1;
    const c = makeContext(live, device.width, device.height, device.safe);
    const nudge = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }[e.key];
    if (nudge) {
      e.preventDefault();
      edit((t) => moveElement(t, el, nudge[0] * c.s, nudge[1] * c.s, c), `nudge:${el}`);
    } else if (e.key === 'Delete' && isButton) {
      e.preventDefault();
      remove();
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D') && isButton) {
      e.preventDefault();
      duplicate();
    }
  };

  const deviceIssues = (id: string) => issues.filter((i) => i.device === id && i.severity === 'warning').length;
  const elements: UiElementId[] = ['dialog', 'name', 'choices', 'menubar', ...sel.menuBar.buttons.map((b) => `button:${b.id}` as UiElementId)];

  const list = (themes: readonly Theme[]) =>
    themes.map((t) => (
      <button key={t.id} className={`card theme-card ${t.id === selId ? 'selected' : ''}`} onClick={() => setSelId(t.id)} data-testid={`theme-${t.name}`}>
        <div className="row">
          <b className="grow ellipsis">{tr(t.name)}</b>
          {t.id === activeId && <span className="badge ok">{tr('in use')}</span>}
          {project.scenes.some((s) => s.themeId === t.id) && (
            <span className="badge">
              {tr('{0} scene(s)', {
                0: project.scenes.filter((s) => s.themeId === t.id).length,
              })}
            </span>
          )}
        </div>
        <Swatches t={t} />
      </button>
    ));

  return (
    <>
      <div className="view-header">
        <h2>{tr('Game UI & Themes')}</h2>
        <span className="muted small">{tr('Design the dialogue box, name box, choices and menu buttons players see.')}</span>
        <span className="grow" />
        <button className="btn sm" onClick={() => void importTheme()} data-testid="import-theme">
          {tr('⬆ Import Theme')}
        </button>
        <button className="btn sm primary" onClick={createCustom} data-testid="create-theme">
          {tr('＋ Create Custom Theme')}
        </button>
      </div>
      <div className="ui-editor" onKeyDown={onKey}>
        <aside className="ui-themes">
          <div className="section-title">{tr('Presets')}</div>
          {list(THEME_PRESETS)}
          <div className="section-title" style={{ marginTop: '0.8rem' }}>
            {tr('My themes')} ({project.themes.length})
          </div>
          {project.themes.length === 0 && <div className="small faint">{tr('Click “Edit a copy” on a preset to make your own theme.')}</div>}
          {list(project.themes)}
        </aside>

        <section className="ui-main">
          <div className="ui-toolbar">
            <h3 className="ellipsis" style={{ margin: 0, maxWidth: '16rem' }} data-testid="theme-title">
              {tr(sel.name)}
            </h3>
            {!isCustom && <span className="badge">{tr('preset (read-only)')}</span>}
            {selId !== activeId ? (
              <button className="btn primary sm" onClick={() => useProject.getState().update((p) => void (p.settings.themeId = selId))} data-testid="use-theme">
                {tr('✓ Use for whole project')}
              </button>
            ) : (
              <span className="badge ok">{tr('Project theme')}</span>
            )}
            <button className="btn sm" onClick={() => setScenesOpen(true)} data-testid="theme-scenes">
              {tr('🎬 Use in scenes…')} {sceneUses ? `(${sceneUses})` : ''}
            </button>
            {!isCustom && (
              <button className="btn sm" onClick={() => copyOf(false)} data-testid="edit-copy">
                {tr('✏️ Edit a copy')}
              </button>
            )}
            <button className="btn sm" onClick={saveAsPreset} data-testid="save-as-preset">
              {tr('⧉ Save as Custom Preset')}
            </button>
            <button className="btn sm" onClick={() => void exportTheme()} data-testid="export-theme">
              {tr('⬇ Export .tsttheme')}
            </button>
            {isCustom && (
              <button className="btn sm danger" onClick={() => void removeCustom()} data-testid="delete-theme">
                {tr('🗑 Delete')}
              </button>
            )}
          </div>

          <div className="ui-toolbar">
            <div className="seg" role="tablist">
              <button className={mode === 'design' ? 'on' : ''} onClick={() => setMode('design')} data-testid="ui-mode-design">
                {tr('✥ Design')}
              </button>
              <button className={mode === 'play' ? 'on' : ''} onClick={() => setMode('play')} data-testid="ui-mode-play">
                {tr('▶ Try it')}
              </button>
            </div>
            <div className="seg" role="radiogroup" aria-label={tr('Device')}>
              {DEVICES.map((d) => (
                <button key={d.id} className={d.id === deviceId ? 'on' : ''} onClick={() => setDeviceId(d.id)} title={`${tr(d.label)} ${d.width}×${d.height}`} data-testid={`device-${d.id}`}>
                  <span className={d.id.endsWith('portrait') ? '' : d.id === 'phone' ? 'rot' : ''}>{DEVICE_ICON[d.id]}</span> {tr(d.label)}
                  {deviceIssues(d.id) > 0 && (
                    <span
                      className="dot-warn"
                      title={tr('{0} layout warning(s)', {
                        0: deviceIssues(d.id),
                      })}
                    />
                  )}
                </button>
              ))}
            </div>
            <span className="small faint">
              {device.width}×{device.height}
            </span>
          </div>

          {mode === 'design' && (
            <div className="ui-toolbar">
              <select
                className="select"
                value={el ?? ''}
                onChange={(e) => setEl((e.target.value || null) as UiElementId | null)}
                aria-label={tr('Selected element')}
                data-testid="ui-element-select"
                style={{ maxWidth: '14rem' }}
              >
                <option value="">{tr('Theme')}</option>
                {elements.map((x) => (
                  <option key={x} value={x}>
                    {elementLabel(x, sel)}
                  </option>
                ))}
              </select>
              {ALIGN.map((a) => (
                <button
                  key={a.edge}
                  className="btn sm icon"
                  title={tr(a.label)}
                  aria-label={tr(a.label)}
                  disabled={!el || !canAlign(el, a.edge)}
                  onClick={() => align(a.edge)}
                  data-testid={`align-${a.edge}`}
                >
                  {a.icon}
                </button>
              ))}
              <span className="faint">|</span>
              <button
                className="btn sm"
                disabled={!isButton}
                title={isButton ? tr('Duplicate (Ctrl+D)') : tr('Only menu buttons can be duplicated or deleted. Other elements can be hidden.')}
                onClick={duplicate}
                data-testid="ui-duplicate"
              >
                {tr('⧉ Duplicate')}
              </button>
              <button
                className="btn sm"
                disabled={!isButton}
                title={isButton ? tr('Delete (Del)') : tr('Only menu buttons can be duplicated or deleted. Other elements can be hidden.')}
                onClick={remove}
                data-testid="ui-delete"
              >
                {tr('🗑 Delete')}
              </button>
              <span className="grow" />
              <span className="small faint">{tr('Arrow keys: move 1px (Shift: 10px)')}</span>
            </div>
          )}

          <div className="ui-work" tabIndex={-1}>
            <UiCanvas
              key={mode}
              play={mode === 'play'}
              game={game}
              theme={live}
              device={device}
              sample={sample}
              selected={el}
              editable={isCustom}
              onSelect={setEl}
              onChange={replaceTheme}
              onReadOnlyEdit={readOnly}
            />
          </div>

          <div className="ui-checks" data-testid="layout-check">
            <button className="btn ghost sm" onClick={() => setShowChecks(!showChecks)}>
              {showChecks ? '▾' : '▸'} {tr('Layout check on all devices')} — {issues.filter((i) => i.severity === 'warning').length} ⚠ · {issues.filter((i) => i.severity === 'info').length} ℹ
            </button>
            {showChecks && (
              <div className="ui-check-list">
                {issues.length === 0 && <div className="small ok-text">{tr('✓ No problems: the UI fits, stays readable and does not overlap on every device.')}</div>}
                {issues.map((i, n) => (
                  <button
                    key={n}
                    className={`ui-check ${i.severity}`}
                    onClick={() => {
                      if (i.device !== 'all') setDeviceId(i.device);
                      if (i.element !== 'theme') setEl(i.element);
                      setMode('design');
                    }}
                    data-testid={`layout-issue-${i.severity}`}
                  >
                    <span>{i.severity === 'warning' ? '⚠' : 'ℹ'}</span>
                    <b>{i.device === 'all' ? tr('All devices') : tr(DEVICES.find((d) => d.id === i.device)!.label)}</b>
                    <span className="grow">{i.message}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="props ui-props" data-testid={isCustom ? 'theme-editor' : 'theme-props-readonly'}>
          <div className="row" style={{ padding: '0.6rem 0.8rem 0' }}>
            <b className="grow ellipsis">{elementLabel(el, sel)}</b>
            {el && positioned(el) !== el && (
              <button className="btn ghost sm" onClick={() => setEl('menubar')}>
                {tr('Menu Bar')}
              </button>
            )}
          </div>
          {!isCustom && (
            <div className="issue-box small" style={{ margin: '0.6rem 0.8rem 0' }}>
              {tr('Presets are read-only.')}{' '}
              <button className="btn sm primary" onClick={() => copyOf(false)}>
                {tr('✏️ Edit a copy')}
              </button>
            </div>
          )}
          <fieldset disabled={!isCustom} className="ui-props-body">
            <ThemeProps theme={isCustom ? sel : live} el={el} edit={edit} onSelect={setEl} gameFont={project.settings.dialogueFont?.family ?? null} />
          </fieldset>
        </aside>
      </div>
      {scenesOpen && <SceneThemes themeId={selId} themeName={tr(sel.name)} onClose={() => setScenesOpen(false)} />}
    </>
  );
}

/** Choose the scenes that use a theme instead of the project theme. */
function SceneThemes({ themeId, themeName, onClose }: { themeId: string; themeName: string; onClose: () => void }) {
  const project = useProject((s) => s.project)!;
  const sceneMap = new Map(project.scenes.map((s) => [s.id, s]));
  const set = (sceneId: string, on: boolean) =>
    useProject.getState().update((p) => {
      const s = p.scenes.find((x) => x.id === sceneId);
      if (s) s.themeId = on ? themeId : null;
    });
  return (
    <Modal
      title={tr('Scenes using “{0}”', { 0: themeName })}
      onClose={onClose}
      testId="scene-themes"
      footer={
        <button className="btn primary" onClick={onClose}>
          {tr('Done')}
        </button>
      }
    >
      <div className="small muted" style={{ marginBottom: '0.6rem' }}>
        {themeId === project.settings.themeId
          ? tr('This is the project theme: every scene uses it unless the scene has its own theme. Ticking a scene pins it to this theme even if the project theme changes later.')
          : tr('Ticked scenes use this theme instead of the project theme.')}
      </div>
      {project.chapters.map((c) => (
        <div key={c.id} style={{ marginBottom: '0.6rem' }}>
          <div className="section-title">{c.name}</div>
          {c.sceneIds.map((id) => {
            const s = sceneMap.get(id);
            if (!s) return null;
            const other = s.themeId && s.themeId !== themeId ? resolveTheme(s.themeId, project.themes) : null;
            return (
              <label key={id} className="check" style={{ display: 'flex' }}>
                <input type="checkbox" checked={s.themeId === themeId} onChange={(e) => set(id, e.target.checked)} data-testid={`scene-theme-${s.name}`} />
                <span className="grow">{s.name}</span>
                {other && <span className="small faint">{tr('now: {0}', { 0: tr(other.name) })}</span>}
              </label>
            );
          })}
        </div>
      ))}
    </Modal>
  );
}
