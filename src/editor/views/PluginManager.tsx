// Settings → Plugins: installed plugins, enable/disable, remove, install, open the plugin folder.
import { useEffect, useState } from 'react';
import { t as tr } from '../../shared/i18n';
import type { PluginInfo } from '../../shared/plugins';
import { api } from '../api';
import { run } from '../ops';
import { confirmDialog, refreshPlugins, toast } from '../store/ui';

export function PluginManager() {
  const [plugins, setPlugins] = useState<PluginInfo[] | null>(null);

  useEffect(() => {
    void api.plugins.list().then(setPlugins);
  }, []);

  const changed = async (list: PluginInfo[]) => {
    setPlugins(list);
    await refreshPlugins();
  };

  const install = async (from: 'file' | 'folder') => {
    let source: string | null = null;
    if (from === 'file') source = (await api.dialog.pickFiles(tr('Install plugin'), [{ name: tr('TSTVN plugin'), extensions: ['tstplugin', 'zip'] }], false))[0] ?? null;
    else source = await api.dialog.pickFolder(tr('Choose a plugin folder (with plugin.json)'));
    if (!source) return;
    const p = await run(() => api.plugins.install(source), tr('Plugin could not be installed'));
    if (!p) return;
    await changed(await api.plugins.list());
    toast(tr('Plugin “{0}” {1} installed', { 0: p.name, 1: p.version }), 'success');
  };

  const remove = async (p: PluginInfo) => {
    const ok = await confirmDialog({
      title: tr('Remove plugin “{0}”?', { 0: p.name }),
      message: tr('Its themes and action templates disappear from TSTVN. Content you already added to a project stays in that project.'),
      confirmLabel: tr('Remove'),
      danger: true,
    });
    if (!ok) return;
    const list = await run(() => api.plugins.remove(p.id), tr('Could not remove the plugin'));
    if (list) await changed(list);
  };

  const toggle = async (p: PluginInfo, enabled: boolean) => {
    // Show the new state at once; the saved list replaces it (or restores it if saving failed).
    const before = plugins;
    setPlugins((list) => list?.map((x) => (x.id === p.id ? { ...x, enabled } : x)) ?? list);
    const list = await run(() => api.plugins.setEnabled(p.id, enabled), tr('Could not change the plugin'));
    if (list) await changed(list);
    else setPlugins(before);
  };

  return (
    <div className="col" data-testid="plugin-manager">
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <div className="section-title grow">{tr('Plugins')}</div>
        <button className="btn sm primary" onClick={() => void install('file')} data-testid="plugin-install-file">
          {tr('⬆ Install from file…')}
        </button>
        <button className="btn sm" onClick={() => void install('folder')} data-testid="plugin-install-folder">
          {tr('📁 Install from folder…')}
        </button>
        <button className="btn sm" onClick={() => void api.plugins.openFolder()} data-testid="plugin-open-folder">
          {tr('📂 Open Plugin Folder')}
        </button>
      </div>
      <div className="small muted">{tr('Plugins add game UI themes (Themes → From plugins) and action templates (＋ Action → Templates). They contain only data, no code. Turning a plugin off hides its content without deleting it.')}</div>
      <div className="section-title" style={{ marginTop: '0.4rem' }}>
        {tr('Installed Plugins')} {plugins ? `(${plugins.length})` : ''}
      </div>
      {plugins?.length === 0 && (
        <div className="empty" style={{ padding: '1.5rem' }}>
          <div className="big">🧩</div>
          <div>{tr('No plugins installed yet. Install a .tstplugin file or a plugin folder.')}</div>
        </div>
      )}
      {plugins?.map((p) => (
        <div key={p.id} className={`plugin-card ${p.enabled && !p.error ? '' : 'off'}`} data-testid={`plugin-${p.id}`}>
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="row" style={{ gap: '0.4rem' }}>
              <b className="ellipsis">{p.name}</b>
              <span className="badge">v{p.version}</span>
              {p.error ? <span className="badge danger">{tr('damaged')}</span> : p.enabled ? <span className="badge ok">{tr('enabled')}</span> : <span className="badge">{tr('disabled')}</span>}
            </div>
            {p.author && <div className="small faint">{tr('by {0}', { 0: p.author })}</div>}
            {p.description && <div className="small muted">{p.description}</div>}
            <div className="small faint">
              {tr('{0} theme(s) · {1} action template(s)', { 0: p.themes, 1: p.actionTemplates })} · <code>{p.id}</code>
            </div>
            {p.error && <div className="small" style={{ color: 'var(--danger-text)' }}>{p.error}</div>}
          </div>
          <label className="check" title={tr('Enable / Disable')}>
            <input type="checkbox" checked={p.enabled} disabled={!!p.error} onChange={(e) => void toggle(p, e.target.checked)} data-testid={`plugin-toggle-${p.id}`} />
            {tr('Enabled')}
          </label>
          <button className="btn sm danger" onClick={() => void remove(p)} data-testid={`plugin-remove-${p.id}`}>
            {tr('Remove')}
          </button>
        </div>
      ))}
    </div>
  );
}
