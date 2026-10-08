import { useEffect, useMemo, useState } from 'react';
import { t as tr } from '../../shared/i18n';
import type { ProjectSettings } from '../../shared/types';
import { buildGameData } from '../../shared/gamedata';
import { resolveTheme } from '../../shared/themes';
import { fontStackFor } from '../../shared/uilayout';
import { api } from '../api';
import { DEFAULT_UI_FONT_SIZE, DIALOGUE_FONT_SIZE_RANGE, fontStack, UI_FONT_SIZE_RANGE } from '../appearance';
import { FontPicker, type FontChoice } from '../components/FontPicker';
import { PreviewFrame } from '../components/PreviewFrame';
import { useProject, getDir } from '../store/project';
import { toast, useUi } from '../store/ui';
import { run } from '../ops';
import { demoGame } from './ThemesView';

interface Draft {
  uiFont: string;
  uiFontSize: number;
  dialogueFont: ProjectSettings['dialogueFont'];
  dialogueFontSize: number | null;
}

const DEFAULTS: Draft = { uiFont: '', uiFontSize: DEFAULT_UI_FONT_SIZE, dialogueFont: null, dialogueFontSize: null };

const same = (a: Draft, b: Draft) => JSON.stringify(a) === JSON.stringify(b);

/** Font settings: editor UI font/size and the game's dialogue font/size, with preview before applying. */
export function FontSettings() {
  const project = useProject((s) => s.project)!;
  const uiFont = useUi((s) => s.uiFont);
  const uiFontSize = useUi((s) => s.uiFontSize);
  const saved: Draft = useMemo(
    () => ({ uiFont, uiFontSize, dialogueFont: project.settings.dialogueFont ?? null, dialogueFontSize: project.settings.dialogueFontSize ?? null }),
    [uiFont, uiFontSize, project.settings.dialogueFont, project.settings.dialogueFontSize],
  );
  const [draft, setDraft] = useState<Draft>(saved);
  const [picking, setPicking] = useState<null | 'ui' | 'dialogue'>(null);
  const dirty = !same(draft, saved);
  const theme = resolveTheme(project.settings.themeId, project.themes);
  const themeFamily = theme.fontFace?.family ?? theme.font.split(',')[0].replace(/["']/g, '').trim();

  // Live game preview (debounced so dragging a slider doesn't restart the game on every pixel).
  const [previewDraft, setPreviewDraft] = useState(draft);
  useEffect(() => {
    const t = setTimeout(() => setPreviewDraft(draft), 300);
    return () => clearTimeout(t);
  }, [draft]);
  const game = useMemo(() => {
    const p = { ...project, settings: { ...project.settings, dialogueFont: previewDraft.dialogueFont, dialogueFontSize: previewDraft.dialogueFontSize } };
    const base = buildGameData(p);
    return demoGame(base, base.theme, project);
  }, [project, previewDraft.dialogueFont, previewDraft.dialogueFontSize]);

  const apply = async () => {
    const next = await run(() => api.app.setSettings({ uiFont: draft.uiFont, uiFontSize: draft.uiFontSize }), tr('Could not save settings'));
    if (!next) return;
    useUi.setState({ uiFont: draft.uiFont, uiFontSize: draft.uiFontSize });
    if (draft.dialogueFont !== saved.dialogueFont || draft.dialogueFontSize !== saved.dialogueFontSize) {
      useProject.getState().update((p) => {
        p.settings.dialogueFont = draft.dialogueFont;
        p.settings.dialogueFontSize = draft.dialogueFontSize;
      });
    }
    toast(tr('Font settings applied'), 'success');
  };

  const pickDialogue = async (c: FontChoice | null) => {
    setPicking(null);
    if (!c) return setDraft({ ...draft, dialogueFont: null });
    if (c.customId) {
      // Copy the font into the project so previews and exported games can load it.
      const embedded = await run(() => api.fonts.embed(getDir(), c.customId!), tr('Font import failed'));
      if (embedded) setDraft({ ...draft, dialogueFont: embedded });
    } else setDraft({ ...draft, dialogueFont: { family: c.family } });
  };

  const uiSize = draft.uiFontSize;
  const sample = (mode: 'dark' | 'light') => (
    <div className="mode-preview" data-theme={mode} style={{ fontFamily: fontStack(draft.uiFont), fontSize: uiSize }} data-testid={`font-preview-${mode}`}>
      <div className="small muted" style={{ fontSize: uiSize * 0.85 }}>
        {mode === 'dark' ? tr('Dark Mode') : tr('Light Mode')}
      </div>
      <b style={{ fontSize: uiSize * 1.25 }}>{tr('Scene 01 — First Meeting')}</b>
      <div>{tr('Drag a background onto the stage.')}</div>
      <div className="muted">นักเดินทางผู้กล้าหาญ · The quick brown fox · 0123456789</div>
    </div>
  );

  return (
    <div className="sub-card font-settings" data-testid="font-settings">
      <div className="row">
        <div className="section-title grow">{tr('Fonts')}</div>
        {dirty && <span className="badge warn">{tr('Preview — not applied yet')}</span>}
      </div>
      <div className="font-settings-grid">
        <div className="col">
          <div className="field">
            <span className="field-label">{tr('Program font (TSTVN interface)')}</span>
            <div className="font-current">
              <span className="grow ellipsis" style={{ fontFamily: fontStack(draft.uiFont) }} data-testid="ui-font-name">
                {draft.uiFont || tr('Default (Segoe UI)')}
              </span>
              <button className="btn sm" onClick={() => setPicking('ui')} data-testid="change-ui-font">
                {tr('Change…')}
              </button>
            </div>
          </div>
          <div className="field">
            <span className="field-label">
              {tr('Program font size')}: {uiSize}px
            </span>
            <input
              type="range"
              min={UI_FONT_SIZE_RANGE.min}
              max={UI_FONT_SIZE_RANGE.max}
              value={uiSize}
              onChange={(e) => setDraft({ ...draft, uiFontSize: Number(e.target.value) })}
              aria-label={tr('Program font size')}
              data-testid="ui-font-size"
            />
          </div>
          <div className="mode-previews">
            {sample('dark')}
            {sample('light')}
          </div>
        </div>

        <div className="col">
          <div className="field">
            <span className="field-label">{tr('Dialogue font (this game)')}</span>
            <div className="font-current">
              <span className="grow ellipsis" style={{ fontFamily: draft.dialogueFont ? fontStack(draft.dialogueFont.family) : fontStackFor(theme, null) }} data-testid="dialogue-font-name">
                {draft.dialogueFont ? draft.dialogueFont.family : tr('Theme default ({0})', { 0: themeFamily })}
              </span>
              {draft.dialogueFont?.file && <span className="badge ok">{tr('included in game')}</span>}
              <button className="btn sm" onClick={() => setPicking('dialogue')} data-testid="change-dialogue-font">
                {tr('Change…')}
              </button>
            </div>
            {theme.dialog.text.font && (
              <span className="small faint">{tr('The theme “{0}” sets its own dialogue font ({1}); it is used instead. Change it in Themes.', { 0: tr(theme.name), 1: theme.dialog.text.font.family })}</span>
            )}
            {draft.dialogueFont && !draft.dialogueFont.file && (
              <span className="small faint">{tr('System fonts only appear if players have them installed. Import the font file to include it in the game.')}</span>
            )}
          </div>
          <div className="field">
            <label className="check">
              <input
                type="checkbox"
                checked={draft.dialogueFontSize === null}
                onChange={(e) => setDraft({ ...draft, dialogueFontSize: e.target.checked ? null : theme.dialog.text.size })}
                data-testid="dialogue-size-theme"
              />
              {tr('Use the theme’s text size ({0}px)', { 0: theme.dialog.text.size })}
            </label>
            {draft.dialogueFontSize !== null && (
              <>
                <span className="field-label">
                  {tr('Dialogue font size')}: {draft.dialogueFontSize}px
                </span>
                <input
                  type="range"
                  min={DIALOGUE_FONT_SIZE_RANGE.min}
                  max={DIALOGUE_FONT_SIZE_RANGE.max}
                  value={draft.dialogueFontSize}
                  onChange={(e) => setDraft({ ...draft, dialogueFontSize: Number(e.target.value) })}
                  aria-label={tr('Dialogue font size')}
                  data-testid="dialogue-font-size"
                />
              </>
            )}
          </div>
          <PreviewFrame game={game} skipTitle sceneId="demo" index={0} namespace="tstvn-font-preview" className="theme-preview-frame" testId="font-game-preview" />
        </div>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button className="btn" onClick={() => setDraft(DEFAULTS)} disabled={same(draft, DEFAULTS)} data-testid="fonts-reset">
          {tr('Reset to Default')}
        </button>
        <span className="grow" />
        <button className="btn" onClick={() => setDraft(saved)} disabled={!dirty} data-testid="fonts-cancel">
          {tr('Cancel')}
        </button>
        <button className="btn primary" onClick={() => void apply()} disabled={!dirty} data-testid="fonts-apply">
          {tr('Apply')}
        </button>
      </div>
      {picking === 'ui' && (
        <FontPicker
          title={tr('Program font')}
          value={draft.uiFont ? { family: draft.uiFont } : null}
          defaultLabel={tr('Default (Segoe UI)')}
          onClose={() => setPicking(null)}
          onPick={(c) => {
            setPicking(null);
            setDraft({ ...draft, uiFont: c?.family ?? '' });
          }}
        />
      )}
      {picking === 'dialogue' && (
        <FontPicker
          title={tr('Dialogue font')}
          value={draft.dialogueFont ? { family: draft.dialogueFont.family } : null}
          defaultLabel={tr('Theme default ({0})', { 0: themeFamily })}
          onClose={() => setPicking(null)}
          onPick={(c) => void pickDialogue(c)}
        />
      )}
    </div>
  );
}
