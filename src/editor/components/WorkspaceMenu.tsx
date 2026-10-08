// Top-bar "Workspace" menu: layout presets, saved workspaces and which panels are shown.
import { useEffect, useRef, useState } from 'react';
import { t as tr } from '../../shared/i18n';
import { newId } from '../../shared/ids';
import { WORKSPACE_PRESETS, isUnchanged, type PanelId } from '../../shared/workspace';
import { applyWorkspace, promptDialog, setCustomWorkspaces, setWorkspace, toast, useUi } from '../store/ui';

const PANELS: { id: PanelId; label: string }[] = [
  { id: 'left', label: 'Scenes, assets & cast panel' },
  { id: 'stage', label: 'Stage preview' },
  { id: 'inspector', label: 'Properties panel' },
];

export function WorkspaceMenu() {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const ws = useUi((s) => s.workspace);
  const custom = useUi((s) => s.customWorkspaces);
  const ref = useRef<HTMLDivElement>(null);
  const unchanged = isUnchanged(ws, custom);
  const current = WORKSPACE_PRESETS.find((p) => p.id === ws.base)?.name ?? custom.find((w) => w.id === ws.base)?.name;

  useEffect(() => {
    if (!pos) return;
    ref.current?.querySelector<HTMLElement>('.menu-item')?.focus();
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setPos(null);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPos(null);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const items = [...(ref.current?.querySelectorAll<HTMLElement>('.menu-item') ?? [])];
        const i = items.indexOf(document.activeElement as HTMLElement);
        items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
      }
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', key);
    };
  }, [pos]);

  const pick = (id: string) => {
    applyWorkspace(id);
    useUi.getState().setView('scenes');
    setPos(null);
  };

  const saveAs = async () => {
    setPos(null);
    const name = await promptDialog({ title: tr('Save workspace'), label: tr('Workspace name'), value: tr('My workspace'), confirmLabel: tr('Save') });
    if (!name?.trim()) return;
    const id = newId('ws');
    setCustomWorkspaces([...useUi.getState().customWorkspaces, { id, name: name.trim(), layout: { ...useUi.getState().workspace, base: id } }]);
    setWorkspace({ base: id });
    toast(tr('Workspace “{0}” saved', { 0: name.trim() }), 'success');
  };

  const remove = (id: string) => {
    setCustomWorkspaces(custom.filter((w) => w.id !== id));
    // The layout stays as it is; it just no longer belongs to a saved workspace.
    if (ws.base === id) setWorkspace({ base: 'default' });
  };

  const setPanel = (id: PanelId, shown: boolean) => setWorkspace({ panels: { ...ws.panels, [id]: shown ? 'open' : 'hidden' } });

  return (
    <>
      <button
        className="btn sm"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setPos(pos ? null : { x: Math.min(r.left, window.innerWidth - 300), y: r.bottom + 4 });
        }}
        title={tr('Workspace: layout presets and panels')}
        aria-haspopup="menu"
        aria-expanded={!!pos}
        data-testid="workspace-menu"
      >
        🪟 {current ? tr(current) : tr('Workspace')}
        {!unchanged && <span className="faint">*</span>} ▾
      </button>
      {pos && (
        <div ref={ref} className="menu-pop" role="menu" style={{ left: pos.x, top: pos.y }} data-testid="workspace-pop">
          <div className="menu-head">{tr('Workspace')}</div>
          {WORKSPACE_PRESETS.map((p) => (
            <button key={p.id} className="menu-item" role="menuitemradio" aria-checked={ws.base === p.id} onClick={() => pick(p.id)} data-testid={`workspace-${p.id}`}>
              <span className="tick">{ws.base === p.id ? '✓' : ''}</span>
              <span>
                {tr(p.name)}
                <small>{tr(p.description)}</small>
              </span>
            </button>
          ))}
          {custom.length > 0 && <div className="menu-head">{tr('My workspaces')}</div>}
          {custom.map((w) => (
            <div key={w.id} className="row" style={{ gap: 0 }}>
              <button className="menu-item grow" role="menuitemradio" aria-checked={ws.base === w.id} onClick={() => pick(w.id)} data-testid={`workspace-custom-${w.name}`}>
                <span className="tick">{ws.base === w.id ? '✓' : ''}</span>
                {w.name}
              </button>
              <button className="btn ghost sm icon" title={tr('Delete workspace')} aria-label={tr('Delete workspace')} onClick={() => remove(w.id)} data-testid={`workspace-delete-${w.name}`}>
                ✕
              </button>
            </div>
          ))}
          <button className="menu-item" onClick={() => void saveAs()} data-testid="workspace-save">
            <span className="tick" />
            {tr('Save current layout as a workspace…')}
          </button>
          {!unchanged && (
            <button className="menu-item" onClick={() => pick(custom.some((w) => w.id === ws.base) || WORKSPACE_PRESETS.some((p) => p.id === ws.base) ? ws.base : 'default')} data-testid="workspace-reset">
              <span className="tick">⟲</span>
              {tr('Reset layout')}
            </button>
          )}
          <hr />
          <div className="menu-head">{tr('Panels')}</div>
          {PANELS.map((p) => (
            <button key={p.id} className="menu-item" role="menuitemcheckbox" aria-checked={ws.panels[p.id] !== 'hidden'} onClick={() => setPanel(p.id, ws.panels[p.id] !== 'open')} data-testid={`panel-toggle-${p.id}`}>
              <span className="tick">{ws.panels[p.id] === 'open' ? '✓' : ws.panels[p.id] === 'collapsed' ? '–' : ''}</span>
              {tr(p.label)}
            </button>
          ))}
          <button className="menu-item" role="menuitemcheckbox" aria-checked={ws.swapSides} onClick={() => setWorkspace({ swapSides: !ws.swapSides })} data-testid="workspace-swap">
            <span className="tick">{ws.swapSides ? '✓' : ''}</span>
            {tr('Properties on the left')}
          </button>
          <button className="menu-item" role="menuitemcheckbox" aria-checked={ws.compactNav} onClick={() => setWorkspace({ compactNav: !ws.compactNav })} data-testid="workspace-compact-nav">
            <span className="tick">{ws.compactNav ? '✓' : ''}</span>
            {tr('Compact sidebar (icons only)')}
          </button>
          <div className="small faint" style={{ padding: '0.4rem 0.6rem' }}>
            {tr('Drag the dividers between panels to resize them. Your layout is remembered.')}
          </div>
        </div>
      )}
    </>
  );
}
