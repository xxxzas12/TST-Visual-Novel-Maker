import { useEffect, useMemo, useState } from 'react';
import { t as tr } from '../../shared/i18n';
import type { CustomFont, SystemFont } from '../../shared/api';
import { api } from '../api';
import { fontStack, registerCustomFonts } from '../appearance';
import { confirmDialog, toast } from '../store/ui';
import { run } from '../ops';
import { Modal } from './Modal';

export interface FontChoice {
  family: string;
  /** Set when the font is an imported custom font. */
  customId?: string;
}

export const FONT_SAMPLE = 'Aa กขค สวัสดี 123';

/**
 * Pick a font: installed system fonts + fonts imported into TSTVN (.ttf/.otf).
 * Every entry is rendered in its own font; the preview shows the current choice before confirming.
 */
export function FontPicker(props: {
  title: string;
  value: FontChoice | null;
  defaultLabel: string;
  onPick: (choice: FontChoice | null) => void;
  onClose: () => void;
}) {
  const [system, setSystem] = useState<SystemFont[] | null>(null);
  const [custom, setCustom] = useState<CustomFont[]>([]);
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState<FontChoice | null>(props.value);

  const loadCustom = async () => {
    const list = await api.fonts.custom();
    await registerCustomFonts(list);
    setCustom(list);
    return list;
  };

  useEffect(() => {
    void loadCustom();
    void api.fonts.system().then(setSystem);
  }, []);

  const q = query.trim().toLowerCase();
  const sysList = useMemo(() => (system ?? []).filter((f) => !q || f.family.toLowerCase().includes(q)), [system, q]);
  const customList = custom.filter((f) => !q || f.family.toLowerCase().includes(q));

  const importFont = async () => {
    const files = await api.dialog.pickFiles(tr('Import Font'), [{ name: tr('Font files'), extensions: ['ttf', 'otf'] }], false);
    if (!files[0]) return;
    const f = await run(() => api.fonts.import(files[0]), tr('Font import failed'));
    if (!f) return;
    await loadCustom();
    setSel({ family: f.family, customId: f.id });
    toast(tr('Font “{0}” imported', { 0: f.family }), 'success');
  };

  const removeFont = async (f: CustomFont) => {
    const ok = await confirmDialog({
      title: tr('Remove font “{0}”?', { 0: f.family }),
      message: tr('The font is removed from TSTVN. Projects that already use it keep their own copy.'),
      confirmLabel: tr('Remove'),
      danger: true,
    });
    if (!ok) return;
    setCustom(await api.fonts.remove(f.id));
    if (sel?.customId === f.id) setSel(null);
  };

  const row = (family: string, choice: FontChoice | null, label: string, extra?: React.ReactNode) => {
    const active = (sel?.family ?? '') === family && (!!sel?.customId === !!choice?.customId || !choice);
    return (
      <div
        key={`${choice?.customId ?? 'sys'}:${family}`}
        className={`font-row ${active ? 'selected' : ''}`}
        role="option"
        aria-selected={active}
        tabIndex={0}
        onClick={() => setSel(choice)}
        onKeyDown={(e) => e.key === 'Enter' && setSel(choice)}
        onDoubleClick={() => props.onPick(choice)}
        data-testid={`font-${label}`}
      >
        <span className="font-name ellipsis" style={{ fontFamily: fontStack(choice?.family) }}>
          {label}
        </span>
        <span className="font-sample ellipsis" style={{ fontFamily: fontStack(choice?.family) }}>
          {FONT_SAMPLE}
        </span>
        {extra}
      </div>
    );
  };

  return (
    <Modal
      title={props.title}
      onClose={props.onClose}
      size="wide"
      testId="font-picker"
      footer={
        <>
          <button className="btn" onClick={() => void importFont()} data-testid="import-font">
            {tr('⬆ Import Font')}
          </button>
          <span className="grow" />
          <button className="btn" onClick={props.onClose}>
            {tr('Cancel')}
          </button>
          <button className="btn primary" onClick={() => props.onPick(sel)} data-testid="font-picker-ok">
            {tr('Use this font')}
          </button>
        </>
      }
    >
      <div className="font-preview" style={{ fontFamily: fontStack(sel?.family) }} data-testid="font-picker-preview">
        <div className="small faint" style={{ fontFamily: 'var(--ui-font)' }}>
          {sel ? sel.family : props.defaultLabel}
        </div>
        <div style={{ fontSize: '1.6rem' }}>{tr('The quick brown fox jumps over the lazy dog.')}</div>
        <div style={{ fontSize: '1.25rem' }}>นักเดินทางผู้กล้าหาญ ก้าวเข้าสู่ป่าแห่งความลับ — 0123456789</div>
      </div>
      <input className="input" placeholder={tr('🔍 Search fonts…')} value={query} onChange={(e) => setQuery(e.target.value)} autoFocus data-testid="font-search" />
      <div className="font-list" role="listbox" aria-label={tr('Fonts')}>
        {!q && row('', null, props.defaultLabel)}
        <div className="section-title" style={{ marginTop: '0.6rem' }}>
          {tr('Custom Fonts')} ({customList.length})
        </div>
        {customList.length === 0 && <div className="small faint">{tr('No imported fonts yet. Use “Import Font” to add a .ttf or .otf file.')}</div>}
        {customList.map((f) =>
          row(
            f.family,
            { family: f.family, customId: f.id },
            f.family,
            <button
              className="btn ghost sm icon"
              title={tr('Remove font')}
              aria-label={tr('Remove font')}
              onClick={(e) => {
                e.stopPropagation();
                void removeFont(f);
              }}
            >
              ✕
            </button>,
          ),
        )}
        <div className="section-title" style={{ marginTop: '0.6rem' }}>
          {tr('System Fonts')} {system ? `(${sysList.length})` : ''}
        </div>
        {!system && <div className="small faint">{tr('Loading installed fonts…')}</div>}
        {sysList.map((f) => row(f.family, { family: f.family }, f.family))}
      </div>
    </Modal>
  );
}
