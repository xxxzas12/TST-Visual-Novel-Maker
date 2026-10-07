import { t as tr } from '../../../shared/i18n';
import { useMemo, useState } from 'react';
import type { AssetType } from '../../../shared/types';
import type { DuplicateDecision } from '../../../shared/api';
import { ASSET_TYPES, typesForKind } from '../../../shared/classify';
import { Modal } from '../../components/Modal';
import { AssetThumb } from '../../components/AssetThumb';
import { useUi } from '../../store/ui';
import { useProject } from '../../store/project';
import { executeImport, setAssetType } from '../../ops';

export function ImportFlow() {
  const st = useUi((s) => s.importState)!;
  const close = () => useUi.getState().setImport(null);

  if (st.stage === 'scanning' || st.stage === 'importing') {
    return (
      <Modal title={st.stage === 'scanning' ? tr("Scanning…") : tr("Importing…")} onClose={() => undefined} testId="import-progress">
        <div className="col" style={{ alignItems: 'center', padding: '1.5rem' }}>
          <div style={{ fontSize: '2.5rem' }}>{st.stage === 'scanning' ? '🔎' : '📥'}</div>
          <div>{st.stage === 'scanning' ? tr("Reading folders and detecting asset types…") : tr("Copying {0} files and creating thumbnails…", { 0: st.plan?.items.length ?? '' })}</div>
          <div className="progress" style={{ width: '100%' }}>
            <div style={{ width: st.stage === 'scanning' ? '35%' : '75%' }} />
          </div>
        </div>
      </Modal>
    );
  }
  if (st.stage === 'review') return <DuplicateReview onClose={close} />;
  return <ImportReportView onClose={close} />;
}

function DuplicateReview({ onClose }: { onClose: () => void }) {
  const plan = useUi((s) => s.importState!.plan!);
  const dups = plan.items.filter((i) => i.duplicate);
  const fresh = plan.items.length - dups.length;
  const [decisions, setDecisions] = useState<Record<string, DuplicateDecision>>(() => Object.fromEntries(dups.map((d) => [d.id, 'skip' as DuplicateDecision])));
  const setAll = (d: DuplicateDecision) => setDecisions(Object.fromEntries(dups.map((x) => [x.id, d === 'replace' && x.duplicate?.reason !== 'path' ? 'skip' : d])));
  const reasonText = { path: 'same name & folder', hash: 'identical file already imported', batch: 'identical file in this import' };
  return (
    <Modal
      title={tr("Duplicates found ({0})", { 0: dups.length })}
      onClose={onClose}
      size="wide"
      testId="duplicate-dialog"
      footer={
        <>
          <span className="grow small muted">
            {tr("{0} new file(s) will be imported.", { 0: fresh })} {plan.unsupported.length ? tr("{0} unsupported file(s) will be ignored.", { 0: plan.unsupported.length }) : ''}
          </span>
          <button className="btn" onClick={onClose}>
            {tr("Cancel")}
          </button>
          <button className="btn primary" onClick={() => void executeImport(decisions)} data-testid="duplicates-continue">
            {tr("Import")}
          </button>
        </>
      }
    >
      <div className="row" style={{ marginBottom: '0.8rem' }}>
        <span className="muted">{tr("Apply to all:")}</span>
        <button className="btn sm" onClick={() => setAll('skip')} data-testid="dup-all-skip">
          {tr("Skip")}
        </button>
        <button className="btn sm" onClick={() => setAll('replace')} data-testid="dup-all-replace">
          {tr("Replace")}
        </button>
        <button className="btn sm" onClick={() => setAll('keep')} data-testid="dup-all-keep">
          {tr("Keep Both")}
        </button>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>{tr("File")}</th>
            <th>{tr("Why")}</th>
            <th style={{ width: '18rem' }}>{tr("Action")}</th>
          </tr>
        </thead>
        <tbody>
          {dups.map((d) => (
            <tr key={d.id}>
              <td>
                <div className="ellipsis" title={d.source} style={{ maxWidth: '24rem' }}>
                  {d.dest.replace(/^assets\//, '')}
                </div>
                <div className="small faint ellipsis" style={{ maxWidth: '24rem' }}>
                  {tr("existing: {0}", { 0: d.duplicate!.existingPath })}
                </div>
              </td>
              <td className="small muted">{reasonText[d.duplicate!.reason]}</td>
              <td>
                <div className="row" style={{ gap: '0.25rem' }}>
                  {(['skip', 'replace', 'keep'] as DuplicateDecision[]).map((opt) => (
                    <button
                      key={opt}
                      className={`btn sm ${decisions[d.id] === opt ? 'active' : ''}`}
                      disabled={opt === 'replace' && d.duplicate!.reason !== 'path'}
                      title={opt === 'replace' && d.duplicate!.reason !== 'path' ? tr("The same file is already in the project") : undefined}
                      onClick={() => setDecisions({ ...decisions, [d.id]: opt })}
                    >
                      {opt === 'skip' ? tr("Skip") : opt === 'replace' ? tr("Replace") : tr("Keep Both")}
                    </button>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}

function ImportReportView({ onClose }: { onClose: () => void }) {
  const st = useUi((s) => s.importState)!;
  const assets = useProject((s) => s.project?.assets ?? []);
  const r = st.report!;
  const newIds = useMemo(() => new Set(st.newAssetIds ?? []), [st.newAssetIds]);
  const unknown = assets.filter((a) => newIds.has(a.id) && a.type === 'unknown');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [bulkType, setBulkType] = useState<AssetType>('background');
  const stats: [string, number][] = [
    ['Imported', r.imported],
    ['Images', r.images],
    ['Audio', r.audio],
    ['Video', r.video],
    ['Unsupported', r.unsupported],
    ['Duplicates', r.duplicates],
  ];
  if (r.replaced) stats.push(['Replaced', r.replaced]);
  stats.push(['Errors', r.errors.length]);

  return (
    <Modal
      title={tr("Import Report")}
      onClose={onClose}
      size="wide"
      testId="import-report"
      footer={
        <>
          <button
            className="btn"
            onClick={() => {
              onClose();
              useUi.getState().setView('assets');
            }}
          >
            {tr("Open Gallery")}
          </button>
          <button className="btn primary" onClick={onClose} data-testid="import-report-done">
            {tr("Done")}
          </button>
        </>
      }
    >
      <div className="stat-grid" data-testid="import-stats">
        {stats.map(([label, n]) => (
          <div key={label} className="stat" data-testid={`stat-${label.toLowerCase()}`}>
            <b>{n}</b>
            <span>{label}</span>
          </div>
        ))}
      </div>
      {st.characters && (st.characters.created > 0 || st.characters.expressions > 0) && (
        <div className="issue-box warn" style={{ marginTop: '1rem', borderColor: 'rgba(62,207,142,.5)', background: 'rgba(62,207,142,.08)' }}>
          {tr("🧍 Created {0} character(s) with {1} expression(s) from your character folders.", { 0: st.characters.created, 1: st.characters.expressions })}
        </div>
      )}
      {unknown.length > 0 && (
        <div style={{ marginTop: '1rem' }} data-testid="unknown-assets">
          <div className="section-title">{tr("Unknown Assets ({0}) — choose a category", { 0: unknown.length })}</div>
          <div className="row" style={{ marginBottom: '0.5rem' }}>
            <button className="btn sm" onClick={() => setChecked(checked.size === unknown.length ? new Set() : new Set(unknown.map((a) => a.id)))}>
              {checked.size === unknown.length ? tr("Select none") : tr("Select all")}
            </button>
            <span className="muted small">{tr("Set selected to")}</span>
            <select className="select" style={{ width: 'auto' }} value={bulkType} onChange={(e) => setBulkType(e.target.value as AssetType)} data-testid="unknown-bulk-type">
              {ASSET_TYPES.filter((t) => t.value !== 'unknown').map((t) => (
                <option key={t.value} value={t.value}>
                  {tr(t.label)}
                </option>
              ))}
            </select>
            <button
              className="btn sm primary"
              disabled={!checked.size}
              onClick={() => {
                setAssetType([...checked], bulkType);
                setChecked(new Set());
              }}
              data-testid="unknown-apply"
            >
              {tr("Apply")}
            </button>
          </div>
          <div className="col" style={{ gap: '0.25rem', maxHeight: '16rem', overflow: 'auto' }}>
            {unknown.map((a) => (
              <label key={a.id} className="row check" style={{ padding: '0.2rem 0.3rem' }}>
                <input
                  type="checkbox"
                  checked={checked.has(a.id)}
                  onChange={(e) => {
                    const n = new Set(checked);
                    if (e.target.checked) n.add(a.id);
                    else n.delete(a.id);
                    setChecked(n);
                  }}
                />
                <span style={{ width: '2.4rem', height: '2.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  <AssetThumb asset={a} />
                </span>
                <span className="grow ellipsis">{a.path}</span>
                <select className="select" style={{ width: 'auto' }} value={a.type} onChange={(e) => setAssetType([a.id], e.target.value as AssetType)}>
                  {typesForKind(a.kind).map((t) => (
                    <option key={t} value={t}>
                      {tr(ASSET_TYPES.find((x) => x.value === t)?.label ?? t)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>
      )}
      {r.unsupportedFiles.length > 0 && (
        <details style={{ marginTop: '1rem' }}>
          <summary className="muted">{tr("Unsupported files ({0})", { 0: r.unsupportedFiles.length })}</summary>
          <ul className="details-list">
            {r.unsupportedFiles.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </details>
      )}
      {r.errors.length > 0 && (
        <div className="issue-box" style={{ marginTop: '1rem' }}>
          <b>{tr("Errors")}</b>
          <ul className="details-list">
            {r.errors.map((e, i) => (
              <li key={i}>
                {e.path}: {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}
