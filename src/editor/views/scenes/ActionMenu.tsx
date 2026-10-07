import { t as tr } from '../../../shared/i18n';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ActionType } from '../../../shared/types';
import { CATEGORIES, actionsInCategory, searchActions, type ActionCategory } from '../../../shared/actions';
import { useProject } from '../../store/project';

/** Categorized "Add Action" menu with search (e.g. typing "background" finds Change Background). */
export function ActionMenu(props: { x: number; y: number; onPick: (type: ActionType) => void; onPickTemplate: (id: string) => void; onClose: () => void }) {
  const templates = useProject((s) => s.project?.actionTemplates ?? []);
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<ActionCategory | 'templates'>('story');
  const [hot, setHot] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const items = useMemo(() => (query ? searchActions(query) : cat === 'templates' ? [] : actionsInCategory(cat)), [query, cat]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) props.onClose();
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [props]);

  useEffect(() => setHot(0), [query, cat]);

  const left = Math.min(props.x, window.innerWidth - 500);
  const top = Math.min(props.y, window.innerHeight - 560);

  return (
    <div className="action-menu" ref={ref} style={{ left: Math.max(8, left), top: Math.max(8, top) }} role="dialog" aria-label={tr("Add action")} data-testid="action-menu">
      <div style={{ padding: '0.5rem' }}>
        <input
          className="input"
          autoFocus
          placeholder={tr("Search actions… (e.g. background, music, choice)")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') props.onClose();
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setHot((h) => Math.min(items.length - 1, h + 1));
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setHot((h) => Math.max(0, h - 1));
            }
            if (e.key === 'Enter' && items[hot]) props.onPick(items[hot].type);
          }}
          data-testid="action-search"
        />
      </div>
      {!query && (
        <div className="cats">
          {CATEGORIES.map((c) => (
            <button key={c.id} className={`chip ${cat === c.id ? 'on' : ''}`} onClick={() => setCat(c.id)} data-testid={`cat-${c.id}`}>
              {c.icon} {tr(c.label)}
            </button>
          ))}
          <button className={`chip ${cat === 'templates' ? 'on' : ''}`} onClick={() => setCat('templates')} data-testid="cat-templates">
            {tr("⭐ Templates")}
          </button>
        </div>
      )}
      <div className="items">
        {!query && cat === 'templates' ? (
          templates.length === 0 ? (
            <div className="small muted" style={{ gridColumn: 'span 2', padding: '0.8rem' }}>
              {tr("No action templates yet. Select several actions and click “Save as Template” to reuse them in other scenes.")}
            </div>
          ) : (
            templates.map((t) => (
              <button key={t.id} className="menu-item" onClick={() => props.onPickTemplate(t.id)} data-testid={`template-item-${t.name}`}>
                <span>⭐</span>
                <span>
                  <b>{t.name}</b>
                  <div className="d">{tr("{0} actions", { 0: t.actions.length })}</div>
                </span>
              </button>
            ))
          )
        ) : items.length === 0 ? (
          <div className="small muted" style={{ gridColumn: 'span 2', padding: '0.8rem' }}>
            {tr("No action matches “{0}”.", { 0: query })}
          </div>
        ) : (
          items.map((d, i) => (
            <button key={d.type} className={`menu-item ${i === hot ? 'hot' : ''}`} onClick={() => props.onPick(d.type)} onMouseEnter={() => setHot(i)} data-testid={`menu-${d.type}`}>
              <span>{d.icon}</span>
              <span>
                <b>{tr(d.label)}</b>
                <div className="d">{tr(d.description)}</div>
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
