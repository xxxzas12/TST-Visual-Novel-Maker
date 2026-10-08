import { Fragment, useEffect } from 'react';
import { useProject } from './store/project';
import { applyLanguage, changedPrefs, refreshPlugins, useUi } from './store/ui';
import { DialogHost, Toasts } from './components/Modal';
import { Welcome } from './views/Welcome';
import { Shell } from './views/Shell';
import { ImportFlow } from './views/assets/ImportFlow';
import { PreviewModal } from './views/PreviewModal';
import { AppSettingsDialog } from './views/AppSettings';
import { api } from './api';
import { autosaveConfig } from '../shared/autosave';
import { normalizeCustomWorkspaces, normalizeLayout } from '../shared/workspace';
import { applyLook, DEFAULT_UI_FONT_SIZE, registerCustomFonts } from './appearance';

export function App() {
  const hasProject = useProject((s) => !!s.project);
  const importState = useUi((s) => s.importState);
  const preview = useUi((s) => s.preview);
  const uiFont = useUi((s) => s.uiFont);
  const uiFontSize = useUi((s) => s.uiFontSize);
  const appearance = useUi((s) => s.appearance);
  const language = useUi((s) => s.language);

  useEffect(() => {
    // Dropping files anywhere must never navigate the editor away.
    const stop = (e: DragEvent) => {
      if (Array.from(e.dataTransfer?.types ?? []).includes('Files')) e.preventDefault();
    };
    window.addEventListener('dragover', stop);
    window.addEventListener('drop', stop);
    void api.fonts.custom().then(registerCustomFonts).catch(() => undefined);
    void api.app.logo().then((appLogo) => useUi.setState({ appLogo })).catch(() => undefined);
    void refreshPlugins();
    void api.app.getSettings().then((s) => {
      useUi.setState({
        uiFont: s.uiFont ?? '',
        // Older settings stored a scale factor instead of a size.
        uiFontSize: s.uiFontSize ?? Math.round(DEFAULT_UI_FONT_SIZE * (s.uiScale ?? 1)),
        appearance: s.appearance ?? 'dark',
        autosave: autosaveConfig(s),
        // Preferences changed before these settings arrived keep the user's choice.
        ...(changedPrefs.has('workspace') ? {} : { workspace: normalizeLayout(s.workspace) }),
        ...(changedPrefs.has('customWorkspaces') ? {} : { customWorkspaces: normalizeCustomWorkspaces(s.customWorkspaces) }),
        ...(changedPrefs.has('themeEditorAdvanced') ? {} : { themeEditorAdvanced: !!s.themeEditorAdvanced }),
      });
      applyLanguage(s.language === 'th' ? 'th' : 'en');
    });
    return () => {
      window.removeEventListener('dragover', stop);
      window.removeEventListener('drop', stop);
    };
  }, []);

  useEffect(() => {
    applyLook({ uiFont, uiFontSize, appearance });
    if (appearance !== 'system') return;
    const mq = matchMedia('(prefers-color-scheme: light)');
    const onChange = () => applyLook({ uiFont, uiFontSize, appearance });
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [uiFont, uiFontSize, appearance]);

  // Keyed by language: switching language re-renders every translated string.
  return (
    <Fragment key={language}>
      {hasProject ? <Shell /> : <Welcome />}
      {importState && <ImportFlow />}
      {preview && <PreviewModal />}
      <AppSettingsDialog />
      <DialogHost />
      <Toasts />
    </Fragment>
  );
}
