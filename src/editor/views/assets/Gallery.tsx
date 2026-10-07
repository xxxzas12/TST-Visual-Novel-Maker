import { t as tr } from '../../../shared/i18n';
import { useEffect, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Asset } from '../../../shared/types';
import { AssetThumb, TYPE_ICON } from '../../components/AssetThumb';
import { DND_ASSETS, setDrag } from '../../dnd';
import { formatBytes } from '../../api';

const TILE = 150;
const GAP = 10;
const LABEL = 40;

/**
 * Virtualized grid/list. Only visible rows are rendered and thumbnails load
 * lazily, so projects with thousands of assets stay fast.
 */
export function Gallery(props: {
  assets: Asset[];
  selected: Set<string>;
  missing: Set<string>;
  mode: 'grid' | 'list';
  onClickAsset: (a: Asset, index: number, e: React.MouseEvent) => void;
  onDoubleClick: (a: Asset) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const cols = props.mode === 'grid' ? Math.max(1, Math.floor((width - GAP) / (TILE + GAP))) : 1;
  const rowCount = Math.ceil(props.assets.length / cols);
  const rowHeight = props.mode === 'grid' ? TILE + LABEL + GAP : 46;
  const tileW = props.mode === 'grid' ? Math.floor((width - GAP * (cols + 1)) / cols) : 0;

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 4,
  });

  useEffect(() => {
    virtualizer.measure();
  }, [rowHeight, cols, virtualizer]);

  const dragStart = (e: React.DragEvent, a: Asset) => {
    const ids = props.selected.has(a.id) ? props.assets.filter((x) => props.selected.has(x.id)) : [a];
    setDrag(e, DND_ASSETS, { ids: ids.map((x) => x.id), paths: ids.map((x) => x.path) });
  };

  return (
    <div className="gallery-scroll" ref={scrollRef} tabIndex={0} onKeyDown={props.onKeyDown} data-testid="gallery" aria-label={tr("Asset gallery")}>
      <div style={{ height: virtualizer.getTotalSize() + GAP, position: 'relative' }}>
        {virtualizer.getVirtualItems().map((row) => {
          const items = props.assets.slice(row.index * cols, row.index * cols + cols);
          if (props.mode === 'list') {
            const a = items[0];
            return (
              <div
                key={a.id}
                className={`list-row ${props.selected.has(a.id) ? 'selected' : ''}`}
                style={{ top: row.start, height: rowHeight }}
                onClick={(e) => props.onClickAsset(a, row.index, e)}
                onDoubleClick={() => props.onDoubleClick(a)}
                draggable
                onDragStart={(e) => dragStart(e, a)}
                data-testid={`asset-${a.name}`}
                title={a.path}
              >
                <div className="mini">
                  <AssetThumb asset={a} missing={props.missing.has(a.id)} />
                </div>
                <div className="ellipsis">
                  {a.name}
                  {props.missing.has(a.id) && <span className="badge danger" style={{ marginLeft: 6 }}>{tr("missing")}</span>}
                  <div className="small faint ellipsis">{a.path}</div>
                </div>
                <span className="badge">
                  {TYPE_ICON[a.type]} {a.type}
                </span>
                <span className="small muted">{a.width ? `${a.width}×${a.height}` : a.ext.toUpperCase()}</span>
                <span className="small muted">{formatBytes(a.size)}</span>
              </div>
            );
          }
          return (
            <div key={row.index} style={{ position: 'absolute', top: row.start + GAP, left: 0, right: 0, height: TILE + LABEL }}>
              {items.map((a, i) => (
                <div
                  key={a.id}
                  className={`tile ${props.selected.has(a.id) ? 'selected' : ''}`}
                  style={{ left: GAP + i * (tileW + GAP), width: tileW, height: TILE + LABEL }}
                  onClick={(e) => props.onClickAsset(a, row.index * cols + i, e)}
                  onDoubleClick={() => props.onDoubleClick(a)}
                  draggable
                  onDragStart={(e) => dragStart(e, a)}
                  data-testid={`asset-${a.name}`}
                  title={`${a.path}\n${a.type}${a.width ? ` · ${a.width}×${a.height}` : ''}`}
                >
                  <div className="thumb">
                    <AssetThumb asset={a} missing={props.missing.has(a.id)} />
                    <span className="badge type-dot">{TYPE_ICON[a.type]}</span>
                    {props.missing.has(a.id) && <span className="badge danger missing-flag">{tr("missing")}</span>}
                  </div>
                  <div className="meta ellipsis">{a.name}</div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
