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
          {section === 'autosave' && app && (
            <div className="col">
              <div className="section-title">{tr('Autosave & recovery')}</div>
              <div className="field">
                <span className="field-label">{tr('Autosave every (minutes, 0 = off; recovery copies are always kept)')}</span>
                <NumberInput value={app.autosaveMinutes} min={0} max={60} onChange={(v) => void setAppSetting({ autosaveMinutes: Math.max(0, Math.round(v)) })} />
              </div>
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
