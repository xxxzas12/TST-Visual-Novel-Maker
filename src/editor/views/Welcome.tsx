import { t as tr } from '../../shared/i18n';
import { useEffect, useState } from 'react';
import { LanguageSelect } from '../components/LanguageSelect';
import type { AppInfo, RecentProject, UserTemplateInfo } from '../../shared/api';
import { BUILTIN_TEMPLATES } from '../../shared/project';
import { api } from '../api';
import { loadProjectResult, openProjectDir, run } from '../ops';
import { confirmDialog, toast } from '../store/ui';
import { AppSettingsButton } from './AppSettings';
import { AppBrand } from '../components/AppBrand';

export function Welcome() {
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [recent, setRecent] = useState<RecentProject[]>([]);
  const [userTemplates, setUserTemplates] = useState<UserTemplateInfo[]>([]);
  const [name, setName] = useState('My Visual Novel');
  const [template, setTemplate] = useState('blank');
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const [i, r, t, s] = await Promise.all([api.app.info(), api.app.recent(), api.templates.list(), api.app.getSettings()]);
      setInfo(i);
      setRecent(r);
      setUserTemplates(t);
      setLocation(s.lastProjectParent ?? i.defaultProjectsDir);
    })();
  }, []);

  const create = async () => {
    if (!name.trim() || !location) return;
    setBusy(true);
    const r = await run(() => api.project.create(location, name.trim(), template), tr("Could not create project"));
    setBusy(false);
    if (r) {
      void api.app.setSettings({ lastProjectParent: location });
      await loadProjectResult(r);
      toast(tr("Project “{0}” created", { 0: r.project.name }), 'success');
    }
  };

  const open = async () => {
    const dir = await api.dialog.pickFolder(tr('Open a TSTVN project folder'), location || undefined);
    if (dir) await openProjectDir(dir);
  };

  const importPkg = async () => {
    const files = await api.dialog.pickFiles(tr('Import a .tstvn project package'), [{ name: tr('TSTVN package'), extensions: ['tstvn'] }], false);
    if (!files[0]) return;
    const parent = await api.dialog.pickFolder(tr('Choose where to put the imported project'), location || undefined);
    if (!parent) return;
    setBusy(true);
    const r = await run(() => api.pkg.importPackage(files[0], parent), tr("Import failed"));
    setBusy(false);
    if (r) {
      await loadProjectResult(r);
      toast(tr("Project package imported"), 'success');
    }
  };

  const removeTemplate = async (t: UserTemplateInfo) => {
    if (!(await confirmDialog({ title: tr("Delete template?"), message: tr("Delete your template “{0}”?", { 0: t.name }), confirmLabel: tr("Delete"), danger: true }))) return;
    await api.templates.remove(t.id);
    setUserTemplates(await api.templates.list());
    if (template === `user:${t.id}`) setTemplate('blank');
  };

  return (
    <div className="welcome" data-testid="welcome">
      <div className="welcome-inner">
        <div className="hero">
          <div className="row">
            <div className="grow">
              <AppBrand size={1.4} testId="welcome-brand" />
            </div>
            <LanguageSelect />
            <AppSettingsButton />
          </div>
          <h1>{tr("Create Your First Visual Novel")}</h1>
          <p>{tr("Import your art and music, build scenes visually, preview instantly and export a real game — no code needed.")}</p>
        </div>

        <section className="panel" style={{ padding: '1.2rem' }}>
          <div className="section-title">{tr("New project")}</div>
          <div className="row" style={{ gap: '0.8rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <div className="field grow" style={{ marginBottom: 0, minWidth: '16rem' }}>
              <label htmlFor="pname">{tr("Project name")}</label>
              <input id="pname" className="input" value={name} onChange={(e) => setName(e.target.value)} data-testid="new-project-name" />
            </div>
            <div className="field grow" style={{ marginBottom: 0, minWidth: '20rem' }}>
              <label>{tr("Save in")}</label>
              <div className="row">
                <input className="input grow" value={location} onChange={(e) => setLocation(e.target.value)} data-testid="new-project-location" />
                <button
                  className="btn"
                  onClick={async () => {
                    const d = await api.dialog.pickFolder(tr('Choose where to save projects'), location || undefined);
                    if (d) setLocation(d);
                  }}
                >
                  {tr("Browse…")}
                </button>
              </div>
            </div>
          </div>
          <div className="section-title">{tr("Template")}</div>
          <div className="template-grid" style={{ marginBottom: '1rem' }}>
            {BUILTIN_TEMPLATES.map((t) => (
              <button key={t.id} className={`template-card ${template === t.id ? 'selected' : ''}`} onClick={() => setTemplate(t.id)} data-testid={`template-${t.id}`}>
                <span className="ico">{t.icon}</span>
                <b>{tr(t.name)}</b>
                <span className="small muted">{tr(t.description)}</span>
              </button>
            ))}
            {userTemplates.map((t) => (
              <div key={t.id} className={`template-card ${template === `user:${t.id}` ? 'selected' : ''}`} onClick={() => setTemplate(`user:${t.id}`)} role="button" tabIndex={0}>
                <span className="ico">⭐</span>
                <b>{t.name}</b>
                <span className="small muted">{tr("Your template")}</span>
                <button
                  className="btn ghost sm"
                  style={{ alignSelf: 'flex-start' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    void removeTemplate(t);
                  }}
                >
                  {tr("Delete")}
                </button>
              </div>
            ))}
          </div>
          <div className="row">
            <button className="btn primary" onClick={() => void create()} disabled={busy || !name.trim() || !location} data-testid="create-project">
              {tr("✨ Create Project")}
            </button>
            <span className="grow" />
            <button className="btn" onClick={() => void open()} disabled={busy} data-testid="open-project">
              {tr("📂 Open Project…")}
            </button>
            <button className="btn" onClick={() => void importPkg()} disabled={busy} data-testid="import-package">
              {tr("📦 Import .tstvn…")}
            </button>
          </div>
        </section>

        <section>
          <div className="section-title">{tr("Recent projects")}</div>
          {recent.length === 0 ? (
            <div className="muted small">{tr("No recent projects yet.")}</div>
          ) : (
            <div className="recent-list">
              {recent.map((r) => (
                <div key={r.path} className="recent-item" onClick={() => void openProjectDir(r.path)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && void openProjectDir(r.path)} data-testid="recent-item">
                  <span style={{ fontSize: '1.4rem' }}>📘</span>
                  <div className="grow">
                    <b>{r.name}</b>
                    <div className="small faint ellipsis">{r.path}</div>
                  </div>
                  <span className="small faint">{new Date(r.openedAt).toLocaleDateString()}</span>
                  <button
                    className="btn ghost sm"
                    title={tr("Remove from list (files are not deleted)")}
                    onClick={async (e) => {
                      e.stopPropagation();
                      setRecent(await api.app.removeRecent(r.path));
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
        {info && <div className="small faint">{tr("TSTVN")} {info.version}</div>}
      </div>
    </div>
  );
}
