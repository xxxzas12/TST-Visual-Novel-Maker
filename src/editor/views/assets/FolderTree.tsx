import { t as tr } from '../../../shared/i18n';
import { useMemo, useState } from 'react';
import type { Asset } from '../../../shared/types';
import { DND_ASSETS, DND_FOLDER, getDrag, hasDrag, setDrag } from '../../dnd';
import { movePaths } from '../../ops';

export interface FolderNode {
  path: string;
  name: string;
  children: FolderNode[];
  count: number;
}

export function buildFolderTree(folders: string[], assets: Asset[]): FolderNode {
  const root: FolderNode = { path: 'assets', name: tr('All assets'), children: [], count: 0 };
  const map = new Map<string, FolderNode>([['assets', root]]);
  const all = new Set(folders);
  for (const a of assets) {
    const parts = a.path.split('/');
    for (let i = 2; i < parts.length; i++) all.add(parts.slice(0, i).join('/'));
  }
  for (const f of [...all].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
    if (f === 'assets' || !f.startsWith('assets/')) continue;
    const parentPath = f.slice(0, f.lastIndexOf('/'));
    const node: FolderNode = { path: f, name: f.slice(f.lastIndexOf('/') + 1), children: [], count: 0 };
    map.set(f, node);
    (map.get(parentPath) ?? root).children.push(node);
  }
  for (const a of assets) {
    let folder = a.path.slice(0, a.path.lastIndexOf('/'));
    while (folder) {
      const n = map.get(folder);
      if (n) n.count++;
      if (folder === 'assets') break;
      folder = folder.slice(0, folder.lastIndexOf('/'));
    }
  }
  return root;
}

export function flattenFolders(node: FolderNode, depth = 0, out: { node: FolderNode; depth: number }[] = []) {
  out.push({ node, depth });
  node.children.forEach((c) => flattenFolders(c, depth + 1, out));
  return out;
}

export function FolderTree(props: { root: FolderNode; selected: string | null; onSelect: (path: string | null) => void }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const rows = useMemo(() => {
    const out: { node: FolderNode; depth: number }[] = [];
    const walk = (n: FolderNode, d: number) => {
      out.push({ node: n, depth: d });
      if (!collapsed.has(n.path)) n.children.forEach((c) => walk(c, d + 1));
    };
    walk(props.root, 0);
    return out;
  }, [props.root, collapsed]);

  const toggle = (p: string) => {
    const next = new Set(collapsed);
    if (next.has(p)) next.delete(p);
    else next.add(p);
    setCollapsed(next);
  };

  return (
    <div role="tree" aria-label={tr("Asset folders")}>
      {rows.map(({ node, depth }) => {
        const isSel = (props.selected ?? 'assets') === node.path;
        return (
          <div
            key={node.path}
            role="treeitem"
            aria-selected={isSel}
            tabIndex={0}
            className={`tree-item ${isSel ? 'selected' : ''} ${dropTarget === node.path ? 'drop-target' : ''}`}
            style={{ paddingLeft: `${0.45 + depth * 0.9}rem` }}
            onClick={() => props.onSelect(node.path === 'assets' ? null : node.path)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') props.onSelect(node.path === 'assets' ? null : node.path);
              if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') toggle(node.path);
            }}
            draggable={node.path !== 'assets'}
            onDragStart={(e) => setDrag(e, DND_FOLDER, node.path)}
            onDragOver={(e) => {
              if (hasDrag(e, DND_ASSETS) || hasDrag(e, DND_FOLDER)) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setDropTarget(node.path);
              }
            }}
            onDragLeave={() => setDropTarget((d) => (d === node.path ? null : d))}
            onDrop={(e) => {
              setDropTarget(null);
              const assetPaths = getDrag<{ paths: string[] }>(e, DND_ASSETS)?.paths;
              const folder = getDrag<string>(e, DND_FOLDER);
              const items = assetPaths ?? (folder ? [folder] : []);
              if (items.length) {
                e.preventDefault();
                e.stopPropagation();
                void movePaths(items, node.path);
              }
            }}
            data-testid={`folder-${node.path}`}
            title={node.path}
          >
            <span
              className="caret"
              onClick={(e) => {
                e.stopPropagation();
                toggle(node.path);
              }}
            >
              {node.children.length ? (collapsed.has(node.path) ? '▸' : '▾') : ''}
            </span>
            <span>{depth === 0 ? '🗂️' : '📁'}</span>
            <span className="ellipsis">{node.name}</span>
            <span className="count">{node.count}</span>
          </div>
        );
      })}
    </div>
  );
}
