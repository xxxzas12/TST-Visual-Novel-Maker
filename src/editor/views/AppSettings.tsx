// Application settings: everything that belongs to TSTVN itself (not to a project).
// Reachable from the Welcome screen and from the top bar inside a project.
import { useEffect, useState } from 'react';
import { t as tr } from '../../shared/i18n';
import type { AppInfo, AppSettings as Settings } from '../../shared/api';
import { api } from '../api';
import type { Appearance } from '../appearance';
import { LanguageSelect } from '../components/LanguageSelect';
import { Modal } from '../components/Modal';
import { useUi, type AppSettingsSection } from '../store/ui';
import { NumberInput } from './scenes/fields';
import { UiFontSettings } from './FontSettings';
import { AUTOSAVE_MINUTES, autosaveConfig } from '../../shared/autosave';
import { AppBrand } from '../components/AppBrand';
import { PluginManager } from './PluginManager';
import { run } from '../ops';
import { toast } from '../store/ui';

/** Custom application logo: TSTVN's own logo and window icon. Games use their own Game icon. */
function AutosaveSettings({ app, onChange }: { app: Settings; onChange: (patch: Partial<Settings>) => void }) {
  // The live setting (updated at once); the file is written in the background.
  const cfg = useUi((s) => s.autosave);
  const save = (patch: Partial<Settings>) => {
    const next = autosaveConfig({ ...app, autosaveEnabled: cfg.enabled, autosaveMinutes: cfg.minutes, ...patch });
    useUi.setState({ autosave: next });
    onChange({ autosaveEnabled: next.enabled, autosaveMinutes: next.minutes });
  };
  return (
    <>
      <label className="check">
        <input type="checkbox" checked={cfg.enabled} onChange={(e) => save({ autosaveEnabled: e.target.checked })} data-testid="autosave-enabled" />
        {tr('Autosave the project')}
      </label>
      <div className="field">
        <span className="field-label">{tr('Save interval: minutes after the first unsaved change')}</span>
        <NumberInput value={cfg.minutes} min={AUTOSAVE_MINUTES.min} max={AUTOSAVE_MINUTES.max} onChange={(v) => save({ autosaveMinutes: Math.round(v) })} />
      </div>
      <div className="small muted" data-testid="autosave-help">
        {tr('Crash recovery is always on: unsaved work is copied every 10 seconds and offered back when the project opens after a crash.')}{' '}
        {tr('Autosave and recovery are separate from Backups — backups are made before risky operations and are listed in the Backups view.')}
      </div>
    </>
  );
}

function LogoSettings() {
  const logo = useUi((s) => s.appLogo);
  const choose = async () => {
    const files = await api.dialog.pickFiles(tr('Choose a logo image'), [{ name: tr('Images'), extensions: ['png', 'jpg', 'jpeg', 'ico'] }], false);
    if (!files[0]) return;
    const url = await run(() => api.app.setLogo(files[0]), tr('Could not use this image'));
    if (!url) return;
    useUi.setState({ appLogo: url });
    toast(tr('Application logo changed'), 'success');
  };
  const reset = async () => {
    await run(() => api.app.resetLogo(), tr('Could not reset the logo'));
    useUi.setState({ appLogo: null });
    toast(tr('Default logo restored'), 'success');
  };
  return (
    <div className="col" data-testid="logo-settings">
      <div className="section-title">{tr('Application logo')}</div>
      <div className="small muted">{tr('Shown on the start screen, in the top bar and as the TSTVN window icon. It does not change your games — each game has its own icon in Project Settings → Game icon.')}</div>
      <div className="logo-preview" data-testid="logo-preview">
        <div className="logo-box">{logo ? <img src={logo} alt={tr('Application logo')} data-testid="logo-preview-img" /> : <span className="faint small">{tr('Default')}</span>}</div>
        <div className="col" style={{ gap: '0.4rem' }}>
          <span className="small faint">{tr('Preview')}</span>
          <AppBrand size={1.4} />
        </div>
      </div>
      <div className="row">
        <button className="btn primary" onClick={() => void choose()} data-testid="logo-choose">
          {tr('Choose Image…')}
        </button>
        <button className="btn" onClick={() => void reset()} disabled={!logo} data-testid="logo-reset">
          {tr('Reset')}
        </button>
        <span className="small faint">{tr('PNG, JPG or ICO; square images look best.')}</span>
      </div>
    </div>
  );
}

export function AppSettingsButton({ compact }: { compact?: boolean }) {
  return (
    <button className={`btn sm ${compact ? 'ghost' : ''}`} onClick={() => useUi.getState().openAppSettings('general')} title={tr('Application settings (language, appearance, fonts, autosave…)')} data-testid="app-settings">
      {compact ? '⚙' : tr('⚙ Settings')}
    </button>
  );
}

const SECTIONS: { id: AppSettingsSection; icon: string; label: string }[] = [
  { id: 'general', icon: '🌐', label: 'General' },
  { id: 'interface', icon: '🔤', label: 'Interface & fonts' },
  { id: 'logo', icon: '🖼️', label: 'Application logo' },
  { id: 'plugins', icon: '🧩', label: 'Plugins' },
  { id: 'autosave', icon: '💾', label: 'Autosave & recovery' },
  { id: 'about', icon: 'ℹ️', label: 'About' },
];

export function AppSettingsDialog() {
  const section = useUi((s) => s.appSettings);
  const [app, setApp] = useState<Settings | null>(null);
  const [info, setInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
    if (!section) return;
    void api.app.getSettings().then(setApp);
    void api.app.info().then(setInfo);
  }, [section]);

  if (!section) return null;
  const close = () => useUi.setState({ appSettings: null });
  const setAppSetting = async (patch: Partial<Settings>) => setApp(await api.app.setSettings(patch));

  return (
    <Modal title={tr('Application Settings')} onClose={close} size="xwide" testId="app-settings-dialog">
      <div className="app-settings">
        <nav className="app-settings-nav" aria-label={tr('Settings categories')}>
          {SECTIONS.map((s) => (
            <button key={s.id} className={section === s.id ? 'active' : ''} onClick={() => useUi.setState({ appSettings: s.id })} data-testid={`app-settings-${s.id}`}>
              <span aria-hidden>{s.icon}</span> {tr(s.label)}
            </button>
          ))}
          <div className="small faint" style={{ marginTop: 'auto' }}>
            {tr('These settings apply to TSTVN on this computer. Game settings are in each project (Project Settings).')}
          </div>
        </nav>
        <div className="app-settings-body">
          {section === 'general' && app && (
            <div className="col">
              <div className="section-title">{tr('General')}</div>
              <div className="field">
                <span className="field-label">{tr('Editor language')}</span>
                <LanguageSelect compact />
              </div>
              <div className="field">
                <span className="field-label">{tr('Appearance')}</span>
                <select
                  className="select"
                  value={app.appearance ?? 'dark'}
                  onChange={(e) => {
                    const appearance = e.target.value as Appearance;
                    useUi.setState({ appearance });
                    void setAppSetting({ appearance });
                  }}
                  data-testid="appearance"
                >
                  <option value="dark">{tr('Dark')}</option>
                  <option value="light">{tr('Light')}</option>
                  <option value="system">{tr('Follow Windows')}</option>
                </select>
              </div>
              <label className="check">
                <input type="checkbox" checked={!app.onboardingDone} onChange={(e) => void setAppSetting({ onboardingDone: !e.target.checked })} /> {tr('Show the getting-started checklist')}
              </label>
            </div>
          )}
          {section === 'interface' && <UiFontSettings />}
          {section === 'logo' && <LogoSettings />}
          {section === 'plugins' && <PluginManager />}
          {section === 'autosave' && app && (
            <div className="col">
              <div className="section-title">{tr('Autosave & recovery')}</div>
              <AutosaveSettings app={app} onChange={(patch) => void setAppSetting(patch)} />
            </div>
          )}
          {section === 'about' && info && (
            <div className="col">
              <div className="section-title">{tr('About')}</div>
              <div className="kv">
                <span className="muted">{tr('Version')}</span>
                <b data-testid="app-version">TSTVN {info.version}</b>
                <span className="muted">{tr('Default project folder')}</span>
                <span className="ellipsis">{info.defaultProjectsDir}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
