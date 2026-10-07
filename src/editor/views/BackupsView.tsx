import { t as tr } from '../../shared/i18n';
import { useCallback, useEffect, useState } from 'react';
import type { BackupInfo } from '../../shared/api';
import { useProject, getDir, getProject } from '../store/project';
import { confirmDialog, toast } from '../store/ui';
import { api, formatTime } from '../api';
import { refreshMissing, run } from '../ops';

export function BackupsView() {
  const dir = useProject((s) => s.dir)!;
  const [list, setList] = useState<BackupInfo[]>([]);
  const refresh = useCallback(() => void api.backups.list(dir).then(setList), [dir]);
  useEffect(refresh, [refresh]);

  const restore = async (b: BackupInfo) => {
    const ok = await confirmDialog({
      title: tr("Restore this backup?"),
      message: tr("Your project will go back to {0} (“{1}”).{2} Your current state is backed up first, so this can be undone.", { 0: formatTime(b.createdAt), 1: b.reason, 2: b.hasFiles ? ` ${tr('Deleted files from that operation are brought back.')}` : '' }),
      confirmLabel: tr("Restore"),
    });
    if (!ok) return;
    if (useProject.getState().dirty) await api.project.save(getDir(), getProject());
    const project = await run(() => api.backups.restore(getDir(), b.id), tr("Restore failed"));
    if (!project) return;
    useProject.getState().load(getDir(), project);
    void refreshMissing();
    refresh();
    toast(tr("Backup restored"), 'success');
  };

  const remove = async (b: BackupInfo) => {
    if (!(await confirmDialog({ title: tr("Delete backup?"), message: tr("Delete the backup from {0}? This cannot be undone.", { 0: formatTime(b.createdAt) }), confirmLabel: tr("Delete"), danger: true }))) return;
    await run(() => api.backups.remove(getDir(), b.id), tr("Delete failed"));
    refresh();
  };

  return (
    <>
      <div className="view-header">
        <h2>{tr("Backups")}</h2>
        <span className="muted small">{tr("TSTVN backs up automatically before deleting, importing, mass replacing and restoring.")}</span>
        <span className="grow" />
        <button
          className="btn sm primary"
          onClick={async () => {
            await run(() => api.backups.create(getDir(), getProject(), tr('Manual backup')), tr("Backup failed"));
            refresh();
            toast(tr("Backup created"), 'success');
          }}
          data-testid="create-backup"
        >
          {tr("＋ Backup now")}
        </button>
      </div>
      <div className="view-body">
        {list.length === 0 ? (
          <div className="empty">
            <div className="big">🛟</div>
            <div>{tr("No backups yet.")}</div>
          </div>
        ) : (
          <table className="table" data-testid="backup-table">
            <thead>
              <tr>
                <th>{tr("When")}</th>
                <th>{tr("Reason")}</th>
                <th>{tr("Files")}</th>
                <th style={{ width: '12rem' }} />
              </tr>
            </thead>
            <tbody>
              {list.map((b) => (
                <tr key={b.id}>
                  <td>{formatTime(b.createdAt)}</td>
                  <td>{b.reason}</td>
                  <td className="muted small">{b.hasFiles ? tr("includes deleted files") : tr("project data")}</td>
                  <td>
                    <div className="row">
                      <button className="btn sm" onClick={() => void restore(b)} data-testid="restore-backup">
                        {tr("⟲ Restore")}
                      </button>
                      <button className="btn sm danger" onClick={() => void remove(b)}>
                        {tr("Delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
