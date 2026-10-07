import { t as tr } from '../../../shared/i18n';
import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { flattenFolders, type FolderNode } from './FolderTree';

/** Pick a destination folder (Move to… / Copy to…). */
export function FolderChooser(props: { root: FolderNode; title: string; confirmLabel: string; onPick: (folder: string) => void; onClose: () => void }) {
  const [sel, setSel] = useState('assets');
  const rows = flattenFolders(props.root);
  return (
    <Modal
      title={props.title}
      onClose={props.onClose}
      testId="folder-chooser"
      footer={
        <>
          <button className="btn" onClick={props.onClose}>
            {tr("Cancel")}
          </button>
          <button className="btn primary" onClick={() => props.onPick(sel)} data-testid="folder-chooser-ok">
            {props.confirmLabel}
          </button>
        </>
      }
    >
      <div style={{ maxHeight: '22rem', overflow: 'auto' }}>
        {rows.map(({ node, depth }) => (
          <div
            key={node.path}
            className={`tree-item ${sel === node.path ? 'selected' : ''}`}
            style={{ paddingLeft: `${0.45 + depth * 0.9}rem` }}
            onClick={() => setSel(node.path)}
            onDoubleClick={() => props.onPick(node.path)}
            data-testid={`choose-${node.path}`}
          >
            <span>{depth === 0 ? '🗂️' : '📁'}</span>
            <span>{depth === 0 ? tr("assets (root)") : node.name}</span>
          </div>
        ))}
      </div>
    </Modal>
  );
}
