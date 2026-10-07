import { t as tr } from '../../shared/i18n';
import { useEffect, useMemo, useState } from 'react';
import type { Character } from '../../shared/types';
import { newId } from '../../shared/ids';
import { useProject, getDir } from '../store/project';
import { confirmDialog, promptDialog, toast } from '../store/ui';
import { thumbUrl } from '../assetUrl';
import { AssetPicker } from '../components/AssetPicker';
import { ColorInput } from './scenes/fields';
import { createCharactersFromFolder } from '../ops';
import { api } from '../api';
import { buildFolderTree } from './assets/FolderTree';
import { FolderChooser } from './assets/FolderChooser';

function usageCount(p: ReturnType<typeof useProject.getState>['project'], id: string): number {
  if (!p) return 0;
  let n = 0;
  for (const s of p.scenes) for (const a of s.actions) if (a.params.characterId === id || a.params.speaker === id) n++;
  return n;
}

export function CharactersView() {
  const project = useProject((s) => s.project)!;
  const [selId, setSelId] = useState<string | null>(project.characters[0]?.id ?? null);
  const [picking, setPicking] = useState<null | { mode: 'add' } | { mode: 'change'; exprId: string }>(null);
  const [choosingFolder, setChoosingFolder] = useState(false);
  const [folders, setFolders] = useState<string[]>(['assets']);
  const sel = project.characters.find((c) => c.id === selId);
  const assetMap = useMemo(() => new Map(project.assets.map((a) => [a.id, a])), [project.assets]);

  useEffect(() => {
    if (!sel && project.characters.length) setSelId(project.characters[0].id);
  }, [sel, project.characters]);

  const update = (fn: (c: Character) => void, coalesce?: string) =>
    useProject.getState().update((p) => {
      const c = p.characters.find((x) => x.id === selId);
      if (c) fn(c);
    }, coalesce);

  const create = async () => {
    const name = await promptDialog({ title: tr("New character"), label: tr("Name"), value: tr("New Character"), confirmLabel: tr("Create") });
    if (!name) return;
    const id = newId('c');
    useProject.getState().update((p) => void p.characters.push({ id, name, displayName: name, color: '#7ab8ff', expressions: [] }));
    setSelId(id);
  };

  const remove = async (c: Character) => {
    const uses = usageCount(project, c.id);
    const ok = await confirmDialog({
      title: tr("Delete character “{0}”?", { 0: c.name }),
      message: uses ? tr("{0} is used by {1} action(s); they will show as problems until fixed. Image files are not deleted.", { 0: c.name, 1: uses }) : tr("Image files are not deleted."),
      confirmLabel: tr("Delete"),
      danger: true,
    });
    if (!ok) return;
    useProject.getState().update((p) => void (p.characters = p.characters.filter((x) => x.id !== c.id)));
    setSelId(null);
  };

  return (
    <>
      <div className="view-header">
        <h2>{tr("Characters")}</h2>
        <span className="muted small">{tr("Import “Characters/Name/expression.png” folders to create characters automatically.")}</span>
        <span className="grow" />
        <button
          className="btn sm"
          onClick={async () => {
            setFolders((await api.assets.list(getDir())).folders);
            setChoosingFolder(true);
          }}
          data-testid="char-from-folder"
        >
          {tr("📁 Create from Folder…")}
        </button>
        <button className="btn sm primary" onClick={() => void create()} data-testid="new-character">
          {tr("＋ New Character")}
        </button>
      </div>
      <div className="view-body">
        {project.characters.length === 0 ? (
          <div className="empty">
            <div className="big">🧍</div>
            <div>{tr("No characters yet.")}</div>
          </div>
        ) : (
          <div className="two-col">
            <div className="col">
              {project.characters.map((c) => {
                const def = c.expressions.find((e) => e.id === c.defaultExpressionId) ?? c.expressions[0];
                const a = def ? assetMap.get(def.assetId) : undefined;
                const url = a ? thumbUrl(a) : null;
                return (
                  <button key={c.id} className={`card ${c.id === selId ? 'selected' : ''}`} onClick={() => setSelId(c.id)} data-testid={`character-${c.name}`}>
                    <div className="row">
                      <div style={{ width: '3rem', height: '3rem', borderRadius: 8, background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {url ? <img src={url} alt="" style={{ maxWidth: '100%', maxHeight: '100%' }} /> : '🧍'}
                      </div>
                      <div className="grow">
                        <b style={{ color: c.color }}>{c.name}</b>
                        <div className="small muted">{tr("{0} expression(s)", { 0: c.expressions.length })}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            {sel && (
              <div className="col" data-testid="character-editor">
                <div className="row" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <span className="field-label">{tr("Name")}</span>
                    <input className="input" value={sel.name} onChange={(e) => update((c) => void (c.name = e.target.value), `cname:${sel.id}`)} />
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <span className="field-label">{tr("Name shown in game")}</span>
                    <input className="input" value={sel.displayName} onChange={(e) => update((c) => void (c.displayName = e.target.value), `cdisp:${sel.id}`)} />
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <span className="field-label">{tr("Name color")}</span>
                    <ColorInput value={sel.color} onChange={(v) => update((c) => void (c.color = v), `ccolor:${sel.id}`)} />
                  </div>
                  <span className="grow" />
                  <button className="btn danger sm" onClick={() => void remove(sel)}>
                    {tr("🗑 Delete")}
                  </button>
                </div>
                <div className="row">
                  <div className="section-title grow">{tr("Expressions")}</div>
                  <button className="btn sm" onClick={() => setPicking({ mode: 'add' })} data-testid="add-expression">
                    {tr("＋ Add expression")}
                  </button>
                </div>
                {sel.expressions.length === 0 && <div className="small muted">{tr("Add images for this character (e.g. normal, happy, sad).")}</div>}
                <div className="expr-grid">
                  {sel.expressions.map((e) => {
                    const a = assetMap.get(e.assetId);
                    const url = a ? thumbUrl(a) : null;
                    const isDefault = (sel.defaultExpressionId ?? sel.expressions[0]?.id) === e.id;
                    return (
                      <div key={e.id} className={`expr-card ${isDefault ? 'default' : ''}`}>
                        <div className="t">{url ? <img src={url} alt={e.name} loading="lazy" /> : <span title={tr("Image missing")}>⚠️</span>}</div>
                        <div style={{ padding: '0.35rem' }} className="col">
                          <input
                            className="input"
                            value={e.name}
                            onChange={(ev) => update((c) => {
                              const x = c.expressions.find((y) => y.id === e.id);
                              if (x) x.name = ev.target.value;
                            }, `ename:${e.id}`)}
                            aria-label={tr("Expression name")}
                          />
                          <div className="row" style={{ gap: '0.15rem' }}>
                            <button className="btn sm ghost" disabled={isDefault} onClick={() => update((c) => void (c.defaultExpressionId = e.id))} title={tr("Use as default expression")}>
                              {isDefault ? '★' : '☆'}
                            </button>
                            <button className="btn sm ghost" onClick={() => setPicking({ mode: 'change', exprId: e.id })} title={tr("Change image")}>
                              🖼️
                            </button>
                            <button
                              className="btn sm ghost"
                              onClick={() =>
                                update((c) => {
                                  c.expressions = c.expressions.filter((x) => x.id !== e.id);
                                  if (c.defaultExpressionId === e.id) c.defaultExpressionId = c.expressions[0]?.id;
                                })
                              }
                              title={tr("Remove expression (the image file stays)")}
                            >
                              🗑
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {picking && sel && (
        <AssetPicker
          media="image"
          types={['character', 'portrait']}
          title={picking.mode === 'add' ? tr("Add expression to {0}", { 0: sel.name }) : tr("Change expression image")}
          onClose={() => setPicking(null)}
          onPick={(a) => {
            if (picking.mode === 'add') {
              update((c) => {
                const id = newId('e');
                c.expressions.push({ id, name: a.name.replace(/\.[^.]+$/, ''), assetId: a.id });
                if (!c.defaultExpressionId) c.defaultExpressionId = id;
              });
            } else {
              update((c) => {
                const x = c.expressions.find((y) => y.id === picking.exprId);
                if (x) x.assetId = a.id;
              });
            }
            setPicking(null);
          }}
        />
      )}
      {choosingFolder && (
        <FolderChooser
          root={buildFolderTree(folders, project.assets)}
          title={tr("Create characters from folder")}
          confirmLabel={tr("Create")}
          onClose={() => setChoosingFolder(false)}
          onPick={(f) => {
            setChoosingFolder(false);
            if (f === 'assets') {
              toast(tr("Choose a character folder (e.g. Characters/Alice or Characters)."), 'warning');
              return;
            }
            createCharactersFromFolder(f);
          }}
        />
      )}
    </>
  );
}
