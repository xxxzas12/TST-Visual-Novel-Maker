import { t as tr } from '../../shared/i18n';
import { useState } from 'react';
import { LANGUAGES } from '../../shared/i18n';
import type { ProjectSettings } from '../../shared/types';
import { useProject, getProject } from '../store/project';
import { useUi, promptDialog, toast } from '../store/ui';
import { api } from '../api';
import { SceneSelect, NumberInput } from './scenes/fields';
import { AssetPicker } from '../components/AssetPicker';
import { AssetThumb } from '../components/AssetThumb';
import { duplicateProjectFlow, run } from '../ops';
import { GameFontSettings } from './FontSettings';
import { GallerySettings } from './GallerySettings';

const RESOLUTIONS = [
  { label: '1920 × 1080 (16:9 Full HD)', w: 1920, h: 1080 },
  { label: '1280 × 720 (16:9 HD)', w: 1280, h: 720 },
  { label: '1920 × 1200 (16:10)', w: 1920, h: 1200 },
  { label: '1440 × 1080 (4:3)', w: 1440, h: 1080 },
  { label: '2560 × 1080 (21:9)', w: 2560, h: 1080 },
];

export function SettingsView() {
  const project = useProject((s) => s.project)!;
  const dir = useProject((s) => s.dir)!;
  const s = project.settings;
  const [pick, setPick] = useState<null | 'bg' | 'music' | 'icon'>(null);
  const icon = project.assets.find((a) => a.id === s.gameIconAssetId);
  const assetName = (id?: string) => (id ? (project.assets.find((a) => a.id === id)?.name ?? '⚠ missing') : 'None');

  const set = (patch: Partial<ProjectSettings>, key?: string) => useProject.getState().update((p) => void Object.assign(p.settings, patch), key);

  return (
    <>
      <div className="view-header">
        <h2>{tr("Project Settings")}</h2>
        <span className="muted small">{tr("Saved in this project and used by the exported game.")}</span>
        <span className="grow" />
        <button className="btn sm ghost" onClick={() => useUi.getState().openAppSettings('general')} data-testid="open-app-settings">
          {tr("⚙ Application settings…")}
        </button>
      </div>
      <div className="view-body">
        <div className="cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(22rem, 1fr))', alignItems: 'start' }}>
          <div className="sub-card">
            <div className="section-title">{tr("Game")}</div>
            <div className="field">
              <span className="field-label">{tr("Project name")}</span>
              <input className="input" value={project.name} onChange={(e) => useProject.getState().update((p) => void (p.name = e.target.value), 'pname')} data-testid="settings-project-name" />
            </div>
            <div className="field">
              <span className="field-label">{tr("Game title (shown on the title screen)")}</span>
              <input className="input" value={s.title} onChange={(e) => set({ title: e.target.value }, 'title')} data-testid="settings-title" />
            </div>
            <div className="field">
              <span className="field-label">{tr("Author")}</span>
              <input className="input" value={s.author} onChange={(e) => set({ author: e.target.value }, 'author')} data-testid="settings-author" />
            </div>
            <div className="field">
              <span className="field-label">{tr("Start scene")}</span>
              <SceneSelect value={s.startSceneId ?? ''} onChange={(v) => set({ startSceneId: v })} />
            </div>
            <div className="field">
              <span className="field-label">{tr("Resolution (aspect ratio of the stage)")}</span>
              <select
                className="select"
                value={`${s.resolution.width}x${s.resolution.height}`}
                onChange={(e) => {
                  const [w, h] = e.target.value.split('x').map(Number);
                  set({ resolution: { width: w, height: h } });
                }}
              >
                {RESOLUTIONS.map((r) => (
                  <option key={r.label} value={`${r.w}x${r.h}`}>
                    {tr(r.label)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <span className="field-label">{tr("Default text speed (characters per second)")}</span>
              <NumberInput value={s.textSpeed} min={5} max={500} step={5} onChange={(v) => set({ textSpeed: v }, 'ts')} />
            </div>
            <div className="field">
              <span className="field-label">{tr("Game language (menus players see: Start, Save, Load…)")}</span>
              <select className="select" value={s.language ?? 'en'} onChange={(e) => set({ language: e.target.value as ProjectSettings['language'] })} data-testid="game-language">
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <span className="field-label">{tr("Window mode (Windows export)")}</span>
              <select className="select" value={s.displayMode} onChange={(e) => set({ displayMode: e.target.value as ProjectSettings['displayMode'] })}>
                <option value="windowed">{tr("Windowed")}</option>
                <option value="fullscreen">{tr("Fullscreen")}</option>
                <option value="borderless">{tr("Borderless (frameless, covers the screen)")}</option>
              </select>
            </div>
            <div className="field" data-testid="game-icon-field">
              <span className="field-label">{tr("Game icon (window and taskbar of the Windows game, browser tab of the Web game)")}</span>
              <div className="row">
                <div className="mini" style={{ width: 40, height: 40 }}>
                  {icon ? <AssetThumb asset={icon} /> : s.gameIconAssetId ? '⚠️' : '🎮'}
                </div>
                <span className="grow ellipsis" data-testid="game-icon-name">
                  {icon ? icon.name : s.gameIconAssetId ? tr("Missing asset") : tr("None (default)")}
                </span>
                <button className="btn sm" onClick={() => setPick('icon')} data-testid="choose-game-icon">
                  {tr("Choose…")}
                </button>
                {s.gameIconAssetId && (
                  <button className="btn sm ghost" onClick={() => set({ gameIconAssetId: undefined })} title={tr("Clear")} aria-label={tr("Clear")}>
                    ✕
                  </button>
                )}
              </div>
              <span className="small faint">{tr("Only for this game. TSTVN’s own logo is set in Application Settings.")}</span>
            </div>
          </div>

          <div className="sub-card">
            <div className="section-title">{tr("Title screen")}</div>
            <div className="field">
              <span className="field-label">{tr("Background")}</span>
              <div className="row">
                <span className="grow ellipsis">{assetName(s.titleBackgroundAssetId)}</span>
                <button className="btn sm" onClick={() => setPick('bg')}>
                  {tr("Choose…")}
                </button>
                {s.titleBackgroundAssetId && (
                  <button className="btn sm ghost" onClick={() => set({ titleBackgroundAssetId: undefined })}>
                    ✕
                  </button>
                )}
              </div>
            </div>
            <div className="field">
              <span className="field-label">{tr("Music")}</span>
              <div className="row">
                <span className="grow ellipsis">{assetName(s.titleMusicAssetId)}</span>
                <button className="btn sm" onClick={() => setPick('music')}>
                  {tr("Choose…")}
                </button>
                {s.titleMusicAssetId && (
                  <button className="btn sm ghost" onClick={() => set({ titleMusicAssetId: undefined })}>
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="sub-card">
            <div className="section-title">{tr("Project files")}</div>
            <div className="small muted ellipsis" title={dir}>
              {dir}
            </div>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <button className="btn sm" onClick={() => void api.game.openPath(dir)}>
                {tr("📂 Open project folder")}
              </button>
              <button
                className="btn sm"
                onClick={async () => {
                  const name = await promptDialog({ title: tr("Save as Template"), label: tr("Template name (structure, variables, theme and action templates are saved — not media)"), value: tr("{0} template", { 0: project.name }), confirmLabel: tr("Save") });
                  if (!name) return;
                  const t = await run(() => api.templates.save(name, getProject()), tr("Could not save template"));
                  if (t) toast(tr("Template “{0}” saved — pick it when creating a new project", { 0: t.name }), 'success');
                }}
                data-testid="save-as-template"
              >
                {tr("⭐ Save project as Template")}
              </button>
              <button className="btn sm" onClick={() => void duplicateProjectFlow(dir, project.name)} data-testid="duplicate-project">
                {tr("⧉ Duplicate project…")}
              </button>
            </div>
          </div>

          <GallerySettings />
          <GameFontSettings />
        </div>
      </div>
      {pick && (
        <AssetPicker
          media={pick === 'music' ? 'audio' : 'image'}
          types={pick === 'bg' ? ['background', 'cg'] : pick === 'icon' ? ['ui', 'unknown', 'portrait', 'character', 'cg', 'background'] : ['music']}
          title={pick === 'bg' ? tr("Title screen background") : pick === 'icon' ? tr("Game icon") : tr("Title screen music")}
          onClose={() => setPick(null)}
          onPick={(a) => {
            set(pick === 'bg' ? { titleBackgroundAssetId: a.id } : pick === 'icon' ? { gameIconAssetId: a.id } : { titleMusicAssetId: a.id });
            setPick(null);
          }}
        />
      )}
    </>
  );
}
