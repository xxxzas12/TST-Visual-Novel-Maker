import { t as tr } from '../../shared/i18n';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { autosaveDue, autosaveIn } from '../../shared/autosave';
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
import { WorkspaceMenu } from '../components/WorkspaceMenu';

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

/**
 * Crash-recovery snapshots every 10 s (always on) and, when enabled, an autosave N minutes after the
 * first unsaved change. The interval is read on every tick, so changes in Application Settings apply at once.
 */
function useAutosave() {
  useEffect(() => {
    let blockUnload = true;
    // Automated tests close the window directly; the main process allows it anyway.
    void api.app.info().then((i) => (blockUnload = !i.isE2E));
    let saving = false;
    const recovery = setInterval(() => {
      const { dir, project, dirty } = useProject.getState();
      if (dir && project && dirty) void api.project.writeRecovery(dir, project).catch(() => undefined);
    }, 10000);
    const autosave = setInterval(() => {
      if (saving || !autosaveDue(Date.now(), useProject.getState().dirtySince, useUi.getState().autosave)) return;
      saving = true;
      void saveNow(true, true).finally(() => (saving = false));
    }, 2000);
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

/** Current time, refreshed every second while `active` (for the autosave countdown). */
function useClock(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

function formatLeft(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}s`;
}

export function Shell() {
  const project = useProject((s) => s.project)!;
  const dirty = useProject((s) => s.dirty);
  const savedAt = useProject((s) => s.savedAt);
  const savedByAutosave = useProject((s) => s.savedByAutosave);
  const dirtySince = useProject((s) => s.dirtySince);
  const autosave = useUi((s) => s.autosave);
  const now = useClock(dirty && autosave.enabled);
  const autosaveLeft = autosaveIn(now, dirtySince, autosave);
  const canUndo = useProject((s) => s.past.length > 0);
  const canRedo = useProject((s) => s.future.length > 0);
  const missing = useProject((s) => s.missing);
  const view = useUi((s) => s.view);
  const setView = useUi((s) => s.setView);
  const compactNav = useUi((s) => s.workspace.compactNav);
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
        <WorkspaceMenu />
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
        <nav className={`nav ${compactNav ? 'compact' : ''}`} aria-label={tr("Main")}>
          {NAV.map((n) => (
            <button key={n.view} className={view === n.view ? 'active' : ''} onClick={() => setView(n.view)} title={tr(n.tip)} aria-label={tr(n.label)} data-testid={`nav-${n.view}`}>
              <span className="ico" aria-hidden>{n.icon}</span>
              <span className="nav-label">{tr(n.label)}</span>
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
          {dirty ? tr("● Unsaved changes") : savedAt ? (savedByAutosave ? tr("✓ Autosaved {0}", { 0: new Date(savedAt).toLocaleTimeString() }) : tr("✓ Saved {0}", { 0: new Date(savedAt).toLocaleTimeString() })) : tr("✓ Saved")}
        </span>
        <button className="btn ghost sm" onClick={() => useUi.getState().openAppSettings('autosave')} title={tr("Autosave settings")} data-testid="autosave-status">
          {!autosave.enabled
            ? tr("Autosave off")
            : autosaveLeft !== null
              ? tr("Autosave in {0}", { 0: formatLeft(autosaveLeft) })
              : tr("Autosave every {0} min", { 0: autosave.minutes })}
        </button>
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
