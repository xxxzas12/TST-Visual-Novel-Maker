import { t as tr } from '../../shared/i18n';
import { useEffect, useState } from 'react';
import type { ExportGameResult, ExportPlatform, ExportProgress } from '../../shared/api';
import type { Issue } from '../../shared/validate';
import { useProject, getDir, getProject } from '../store/project';
import { useUi, toast } from '../store/ui';
import { api, errorMessage, formatBytes } from '../api';
import { refreshMissing, removeMissingAsset, replaceAssetFile, replaceReferences, run, saveNow } from '../ops';
import { AssetPicker } from '../components/AssetPicker';
import { typesForKind } from '../../shared/classify';

function joinPath(dir: string, name: string) {
  const sep = dir.includes('\\') ? '\\' : '/';
  return `${dir.replace(/[\\/]+$/, '')}${sep}${name}`;
}

export function ExportView() {
  const project = useProject((s) => s.project)!;
  const dir = useProject((s) => s.dir)!;
  const missing = useProject((s) => s.missing);
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [platform, setPlatform] = useState<ExportPlatform>('windows');
  const [outDir, setOutDir] = useState(() => joinPath(dir, 'exports'));
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [result, setResult] = useState<ExportGameResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [swap, setSwap] = useState<string | null>(null);

  const check = async () => {
    await refreshMissing();
    setIssues(await api.project.validate(getDir(), getProject()));
  };
  useEffect(() => {
    void check();
  }, [project]);

  useEffect(() => api.game.onProgress(setProgress), []);

  const build = async () => {
    setBusy(true);
    setResult(null);
    setProgress({ step: 'Saving project', percent: 1 });
    try {
      if (useProject.getState().dirty) await saveNow(true);
      const r = await api.game.export({ dir, project: getProject(), platform, outDir });
      setResult(r);
      if (r.ok) {
        useUi.setState({ exported: true });
        toast(tr("Export complete!"), 'success');
      } else toast(tr("Export Failed"), 'error');
    } catch (e) {
      setResult({ ok: false, errors: [errorMessage(e)], warnings: [] });
    } finally {
      setBusy(false);
    }
  };

  const exportPackage = async () => {
    const file = await api.dialog.saveFile(tr('Export project package'), joinPath(dir, `${project.name}.tstvn`), [{ name: tr('TSTVN package'), extensions: ['tstvn'] }]);
    if (!file) return;
    if (useProject.getState().dirty) await saveNow(true);
    const r = await run(() => api.pkg.exportPackage(dir, getProject(), file), tr("Package export failed"));
    if (r) toast(tr("Package saved: {0} files, {1}", { 0: r.files, 1: formatBytes(r.bytes) }), 'success');
  };

  const errors = issues?.filter((i) => i.severity === 'error') ?? [];
  const warnings = issues?.filter((i) => i.severity === 'warning') ?? [];
  const missingAssets = project.assets.filter((a) => missing.includes(a.id));
  const goTo = (i: Issue) => {
    if (!i.sceneId) return;
    useUi.getState().selectScene(i.sceneId);
    if (i.actionId) useUi.getState().selectActions([i.actionId]);
    useUi.getState().setView('scenes');
  };

  return (
    <>
      <div className="view-header">
        <h2>{tr("Export")}</h2>
        <span className="muted small">{tr("Check your project, then build a game players can run.")}</span>
      </div>
      <div className="view-body">
        <div className="cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(26rem, 1fr))', alignItems: 'start' }}>
          <div className="sub-card" data-testid="export-game">
            <div className="section-title">{tr("Export Game")}</div>
            <div className="row" style={{ alignItems: 'stretch' }}>
              {(
                [
                  ['windows', '🪟', 'Windows', 'A folder with an .exe — double-click to play.'],
                  ['web', '🌐', 'Web / Mobile browser', 'index.html — runs in any browser, phones included.'],
                ] as const
              ).map(([id, ico, label, desc]) => (
                <button key={id} className={`card grow ${platform === id ? 'selected' : ''}`} onClick={() => setPlatform(id)} data-testid={`platform-${id}`}>
                  <span style={{ fontSize: '1.6rem' }}>{ico}</span>
                  <b>{label}</b>
                  <span className="small muted">{desc}</span>
                </button>
              ))}
            </div>
            <div className="field">
              <span className="field-label">{tr("Output folder")}</span>
              <div className="row">
                <input className="input grow" value={outDir} onChange={(e) => setOutDir(e.target.value)} data-testid="export-outdir" />
                <button
                  className="btn"
                  onClick={async () => {
                    const d = await api.dialog.pickFolder(tr('Choose export folder'), outDir);
                    if (d) setOutDir(d);
                  }}
                >
                  {tr("Browse…")}
                </button>
              </div>
            </div>
            <button className="btn primary" disabled={busy || !outDir} onClick={() => void build()} data-testid="export-build">
              {tr("🚀 EXPORT GAME")}
            </button>
            {busy && progress && (
              <div className="col" data-testid="export-progress">
                <div className="progress">
                  <div style={{ width: `${progress.percent}%` }} />
                </div>
                <span className="small muted">{progress.step}…</span>
              </div>
            )}
            {result?.ok && (
              <div className="issue-box warn" style={{ borderColor: 'rgba(62,207,142,.5)', background: 'rgba(62,207,142,.08)' }} data-testid="export-success">
                <b>{tr("✅ Done — export verified")}</b>
                <ul className="details-list" style={{ background: 'transparent' }}>
                  {result.checks.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
                <div className="small muted" style={{ margin: '0.3rem 0' }}>
                  {tr("{0} files · {1}", { 0: result.files, 1: formatBytes(result.bytes) })} · <span className="ellipsis">{result.outputPath}</span>
                </div>
                <div className="row">
                  <button className="btn sm primary" onClick={() => void run(() => api.game.run(result.launchPath), tr("Could not start the game"))} data-testid="run-exported">
                    {tr("▶ Run Game")}
                  </button>
                  <button className="btn sm" onClick={() => void api.game.openPath(result.outputPath)}>
                    {tr("📂 Open Folder")}
                  </button>
                </div>
              </div>
            )}
            {result && !result.ok && (
              <div className="issue-box" data-testid="export-failed">
                <b>{tr("⛔ Export Failed")}</b>
                <div className="small">{tr("Nothing was written to the output folder. Fix these problems and try again:")}</div>
                <ul className="details-list">
                  {result.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="small faint">{tr("Android and iOS: the Web build already supports touch, notches/safe areas and phone aspect ratios. Use “Web” to test on a phone.")}</div>
          </div>

          <div className="sub-card" data-testid="project-check">
            <div className="row">
              <div className="section-title grow">{tr("Project check")}</div>
              <button className="btn sm" onClick={() => void check()}>
                {tr("↻ Re-check")}
              </button>
            </div>
            {issues === null ? (
              <span className="muted small">{tr("Checking…")}</span>
            ) : errors.length === 0 && warnings.length === 0 ? (
              <div className="badge ok" style={{ alignSelf: 'flex-start' }}>
                {tr("✅ No problems found")}
              </div>
            ) : (
              <div className="col" style={{ gap: '0.3rem', maxHeight: '22rem', overflow: 'auto' }}>
                {[...errors, ...warnings].map((i, k) => (
                  <button key={k} className={`issue-box ${i.severity === 'warning' ? 'warn' : ''}`} style={{ textAlign: 'left', cursor: i.sceneId ? 'pointer' : 'default', marginBottom: 0 }} onClick={() => goTo(i)}>
                    {i.severity === 'error' ? '⛔' : '⚠️'} {i.message}
                  </button>
                ))}
              </div>
            )}
          </div>

          {missingAssets.length > 0 && (
            <div className="sub-card" data-testid="missing-assets">
              <div className="section-title">{tr("Missing assets ({0})", { 0: missingAssets.length })}</div>
              {missingAssets.map((a) => (
                <div key={a.id} className="row" style={{ flexWrap: 'wrap' }}>
                  <span className="grow ellipsis" title={a.path}>
                    ⚠️ {a.path}
                  </span>
                  <button className="btn sm" onClick={() => void replaceAssetFile(a.id, tr("Locate “{0}”", { 0: a.name }))}>
                    {tr("Locate…")}
                  </button>
                  <button className="btn sm" onClick={() => setSwap(a.id)}>
                    {tr("Replace…")}
                  </button>
                  <button className="btn sm danger" onClick={() => void removeMissingAsset(a.id)}>
                    {tr("Remove")}
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="sub-card">
            <div className="section-title">{tr("Project package (.tstvn)")}</div>
            <div className="small muted">{tr("One file with all scenes, assets, characters, variables, themes and settings — for backups or moving to another PC. Import it from the start screen.")}</div>
            <button className="btn" onClick={() => void exportPackage()} data-testid="export-package">
              {tr("📦 Export .tstvn package…")}
            </button>
          </div>
        </div>
      </div>
      {swap && (
        <AssetPicker
          media={project.assets.find((a) => a.id === swap)?.kind ?? 'image'}
          types={typesForKind(project.assets.find((a) => a.id === swap)?.kind ?? 'image')}
          title={tr("Use this asset instead")}
          onClose={() => setSwap(null)}
          onPick={(b) => {
            const from = swap;
            setSwap(null);
            void replaceReferences(from, b.id);
          }}
        />
      )}
    </>
  );
}
