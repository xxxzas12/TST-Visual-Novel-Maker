import { t as tr } from '../../shared/i18n';
import { useDeferredValue, useEffect, useMemo } from 'react';
import { useProject } from '../store/project';
import { useUi, type View } from '../store/ui';
import { api } from '../api';
import { closeProject, saveNow, pickAndImportFolder } from '../ops';
import { validateProject } from '../../shared/validate';
import { AssetsView } from './assets/AssetsView';
import { ScenesView } from './scenes/ScenesView';
import { FlowView } from './flow/FlowView';
import { CharactersView } from './CharactersView';
import { VariablesView } from './VariablesView';
import { ThemesView } from './ThemesView';
import { SettingsView } from './SettingsView';
import { ExportView } from './ExportView';
import { BackupsView } from './BackupsView';
import { Onboarding } from './Onboarding';
import { AppSettingsButton } from './AppSettings';
import { AppBrand } from '../components/AppBrand';

const NAV: { view: View; icon: string; label: string; tip: string }[] = [
  { view: 'scenes', icon: '🎬', label: 'Scenes', tip: 'Scene editor (Ctrl+1)' },
  { view: 'flow', icon: '🔀', label: 'Story Flow', tip: 'Story flow (Ctrl+2)' },
  { view: 'assets', icon: '🗂️', label: 'Assets', tip: 'Gallery & files (Ctrl+3)' },
  { view: 'characters', icon: '🧍', label: 'Characters', tip: 'Characters (Ctrl+4)' },
  { view: 'variables', icon: '🔢', label: 'Variables', tip: 'Variables (Ctrl+5)' },
  { view: 'themes', icon: '🎨', label: 'Themes', tip: 'Game UI theme (Ctrl+6)' },
  { view: 'settings', icon: '🛠️', label: 'Project', tip: 'Project settings (Ctrl+7)' },
  { view: 'export', icon: '🚀', label: 'Export', tip: 'Check & export game (Ctrl+8)' },
  { view: 'backups', icon: '🛟', label: 'Backups', tip: 'Backups & restore (Ctrl+9)' },
];

function isTyping(): boolean {
  const el = document.activeElement as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}

export function playFromStart() {
  useUi.getState().openPreview({ skipTitle: false });
}

export function playFromHere() {
  const ui = useUi.getState();
  const p = useProject.getState().project;
  const scene = p?.scenes.find((s) => s.id === ui.sceneId);
  if (!scene) return playFromStart();
  const idx = scene.actions.findIndex((a) => ui.actionIds.includes(a.id));
  ui.openPreview({ sceneId: scene.id, index: Math.max(0, idx), skipTitle: true });
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ui = useUi.getState();
      if (ui.preview || ui.confirm || ui.prompt || ui.importState || ui.appSettings) return;
      const ctrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (ctrl && key === 's') {
        e.preventDefault();
        void saveNow();
      } else if (ctrl && !isTyping() && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        useProject.getState().undo();
      } else if (ctrl && !isTyping() && (key === 'y' || (key === 'z' && e.shiftKey))) {
        e.preventDefault();
        useProject.getState().redo();
      } else if (e.key === 'F5') {
        e.preventDefault();
        if (e.shiftKey) playFromHere();
        else playFromStart();
      } else if (ctrl && /^[1-9]$/.test(e.key)) {
        e.preventDefault();
        ui.setView(NAV[Number(e.key) - 1].view);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** Recovery snapshots every 10 s and a real save every N minutes while there are unsaved changes. */
function useAutosave() {
  useEffect(() => {
    let minutes = 2;
    let blockUnload = true;
    void api.app.getSettings().then((s) => (minutes = s.autosaveMinutes || 2));
    // Automated tests close the window directly; the main process allows it anyway.
    void api.app.info().then((i) => (blockUnload = !i.isE2E));
    let lastSave = Date.now();
    const recovery = setInterval(() => {
      const { dir, project, dirty } = useProject.getState();
      if (dir && project && dirty) void api.project.writeRecovery(dir, project).catch(() => undefined);
    }, 10000);
    const autosave = setInterval(() => {
      const { dirty } = useProject.getState();
      if (dirty && minutes > 0 && Date.now() - lastSave > minutes * 60000) {
        lastSave = Date.now();
        void saveNow(true);
      }
    }, 15000);
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (useProject.getState().dirty) {
        const { dir, project } = useProject.getState();
        if (dir && project) void api.project.writeRecovery(dir, project);
        if (blockUnload) {
          e.preventDefault();
          e.returnValue = false;
        }
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      clearInterval(recovery);
      clearInterval(autosave);
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, []);
}

export function Shell() {
  const project = useProject((s) => s.project)!;
  const dirty = useProject((s) => s.dirty);
  const savedAt = useProject((s) => s.savedAt);
  const canUndo = useProject((s) => s.past.length > 0);
  const canRedo = useProject((s) => s.future.length > 0);
  const missing = useProject((s) => s.missing);
  const view = useUi((s) => s.view);
  const setView = useUi((s) => s.setView);
  useShortcuts();
  useAutosave();

  const deferred = useDeferredValue(project);
  const issues = useMemo(() => validateProject(deferred), [deferred]);
  const errorCount = issues.filter((i) => i.severity === 'error').length;

  return (
    <div className="shell">
      <header className="topbar">
        <AppBrand />
        <span className="project-name ellipsis" title={project.name} data-testid="project-name">
          {project.name}
        </span>
        <button className="btn ghost sm icon" title={tr("Undo (Ctrl+Z)")} aria-label={tr("Undo")} disabled={!canUndo} onClick={() => useProject.getState().undo()} data-testid="undo">
          ↶
        </button>
        <button className="btn ghost sm icon" title={tr("Redo (Ctrl+Y)")} aria-label={tr("Redo")} disabled={!canRedo} onClick={() => useProject.getState().redo()} data-testid="redo">
          ↷
        </button>
        <span className="grow" />
        <button className="btn sm" onClick={() => void pickAndImportFolder()} title={tr("Import a folder of assets")}>
          {tr("⬆ Import")}
        </button>
        <button className="btn sm" onClick={() => void saveNow()} title={tr("Save (Ctrl+S)")} data-testid="save">
          {tr("💾 Save")}
        </button>
        <button className="btn sm primary" onClick={playFromStart} title={tr("Play the game from the title screen (F5)")} data-testid="play">
          {tr("▶ Play")}
        </button>
        <button className="btn sm" onClick={() => setView('export')} title={tr("Export the game")}>
          {tr("🚀 Export")}
        </button>
        <AppSettingsButton compact />
        <button className="btn sm ghost" onClick={() => void closeProject()} title={tr("Close project")} data-testid="close-project">
          {tr("✕ Close")}
        </button>
      </header>
      <div className="main">
        <nav className="nav" aria-label={tr("Main")}>
          {NAV.map((n) => (
            <button key={n.view} className={view === n.view ? 'active' : ''} onClick={() => setView(n.view)} title={tr(n.tip)} data-testid={`nav-${n.view}`}>
              <span className="ico">{n.icon}</span>
              {tr(n.label)}
            </button>
          ))}
        </nav>
        <main className="content">
          {view === 'assets' && <AssetsView />}
          {view === 'scenes' && <ScenesView />}
          {view === 'flow' && <FlowView />}
          {view === 'characters' && <CharactersView />}
          {view === 'variables' && <VariablesView />}
          {view === 'themes' && <ThemesView />}
          {view === 'settings' && <SettingsView />}
          {view === 'export' && <ExportView />}
          {view === 'backups' && <BackupsView />}
        </main>
      </div>
      <footer className="statusbar">
        <span className={dirty ? 'dirty' : ''} data-testid="save-status">
          {dirty ? tr("● Unsaved changes") : savedAt ? tr("✓ Saved {0}", { 0: new Date(savedAt).toLocaleTimeString() }) : tr("✓ Saved")}
        </span>
        <span>{tr("{0} scenes", { 0: project.scenes.length })}</span>
        <span>{tr("{0} assets", { 0: project.assets.length })}</span>
        <span>{tr("{0} characters", { 0: project.characters.length })}</span>
        <button className="btn ghost sm" onClick={() => setView('export')} title={tr("Open project check")} data-testid="issue-count">
          {errorCount ? tr("⛔ {0} problem(s)", { 0: errorCount }) : tr("✅ No problems")}
        </button>
        {missing.length > 0 && (
          <button className="btn ghost sm" onClick={() => setView('export')} style={{ color: 'var(--danger)' }}>
            ⚠️ {tr("{0} missing file(s)", { 0: missing.length })}
          </button>
        )}
        <span className="grow" />
        <span className="faint">
          {tr("Ctrl+S save · F5 play · Shift+F5 play from here")}
        </span>
      </footer>
      <Onboarding />
    </div>
  );
}
