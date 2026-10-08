// Style Library UI: "My styles" next to the presets (use, save, edit only here) and the library window
// (apply, rename, duplicate, delete) — reusable Textbox and Choice styles of the project.
import { t as tr } from '../../../shared/i18n';
import type { Theme } from '../../../shared/types';
import { deleteStyle, findStyle, styleUsers, type UiStyle, type UiStyleKind } from '../../../shared/uistyles';
import { newId } from '../../../shared/ids';
import { useProject } from '../../store/project';
import { confirmDialog, promptDialog, toast } from '../../store/ui';
import { Modal } from '../../components/Modal';
import { TextboxThumb } from './TextboxPresets';
import { ChoiceThumb } from './ChoicePresets';

export function StyleThumb({ s }: { s: UiStyle }) {
  return s.kind === 'textbox' && s.dialog && s.nameBox ? <TextboxThumb dialog={s.dialog} nameBox={s.nameBox} /> : s.choice ? <ChoiceThumb choice={s.choice} /> : null;
}

// Stable fallbacks: a new [] in a store selector would re-render forever.
const NO_STYLES: UiStyle[] = [];
const NO_THEMES: Theme[] = [];

const linkOf = (t: Theme, kind: UiStyleKind) => (kind === 'textbox' ? t.textboxStyleId : t.choiceStyleId);

/** "My styles" under the presets of the Textbox or Choice section. */
export function MyStyles({
  kind,
  theme,
  onUse,
  onSave,
  onDetach,
}: {
  kind: UiStyleKind;
  /** The selected theme (not resolved: its links). */
  theme: Theme;
  onUse: (styleId: string) => void;
  onSave: () => void;
  onDetach: () => void;
}) {
  const styles = useProject((s) => s.project?.uiStyles ?? NO_STYLES).filter((s) => s.kind === kind);
  const themes = useProject((s) => s.project?.themes ?? NO_THEMES);
  const linked = findStyle(styles, linkOf(theme, kind), kind);
  const users = linked ? styleUsers({ themes }, linked).length : 0;
  return (
    <div className="my-styles" data-testid={`my-styles-${kind}`}>
      <div className="section-title" style={{ marginTop: '0.6rem' }}>
        {kind === 'textbox' ? tr('My textbox styles') : tr('My choice styles')}
      </div>
      {linked && (
        <div className="issue-box small" style={{ marginBottom: '0.4rem' }} data-testid={`style-linked-${kind}`}>
          🔗 {tr('Uses the style “{0}”: changes here update every theme that uses it ({1}).', { 0: linked.name, 1: users })}{' '}
          <button className="btn sm" onClick={onDetach} title={tr('Give this theme its own copy, so changes stay here')} data-testid={`style-detach-${kind}`}>
            {tr('Edit only here')}
          </button>
        </div>
      )}
      {styles.length > 0 && (
        <div className="tb-grid">
          {styles.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`tb-card ${linked?.id === s.id ? 'selected' : ''}`}
              aria-pressed={linked?.id === s.id}
              onClick={() => onUse(s.id)}
              title={tr('Use this style in this theme')}
              data-testid={`my-style-${s.name}`}
            >
              <StyleThumb s={s} />
              <span className="tb-label">{s.name}</span>
            </button>
          ))}
        </div>
      )}
      <button className="btn sm" style={{ marginTop: '0.4rem' }} onClick={onSave} data-testid={`style-save-${kind}`}>
        {kind === 'textbox' ? tr('⭐ Save this textbox as a style…') : tr('⭐ Save these choices as a style…')}
      </button>
    </div>
  );
}

/** The Style Library window: every saved style with Apply, Rename, Duplicate and Delete. */
export function StyleLibraryDialog({ onClose, onApply, canApply }: { onClose: () => void; onApply: (s: UiStyle) => void; canApply: boolean }) {
  const styles = useProject((s) => s.project?.uiStyles ?? NO_STYLES);
  const themes = useProject((s) => s.project?.themes ?? NO_THEMES);
  const update = useProject((s) => s.update);

  const rename = async (s: UiStyle) => {
    const name = await promptDialog({ title: tr('Rename style'), label: tr('Style name'), value: s.name, confirmLabel: tr('Rename') });
    if (name?.trim()) update((p) => void (p.uiStyles!.find((x) => x.id === s.id)!.name = name.trim()));
  };
  const duplicate = (s: UiStyle) => {
    const copy: UiStyle = { ...JSON.parse(JSON.stringify(s)), id: newId('st'), name: tr('{0} copy', { 0: s.name }) };
    update((p) => void (p.uiStyles = [...(p.uiStyles ?? []), copy]));
    toast(tr('Style “{0}” created', { 0: copy.name }), 'success');
  };
  const remove = async (s: UiStyle) => {
    const n = styleUsers({ themes }, s).length;
    const ok = await confirmDialog({
      title: tr('Delete style “{0}”?', { 0: s.name }),
      message: n ? tr('{0} theme(s) use it. They keep its look as their own; nothing changes in the game.', { 0: n }) : tr('No theme uses it.'),
      confirmLabel: tr('Delete'),
      danger: true,
    });
    if (ok) update((p) => deleteStyle(p, s.id));
  };

  const group = (kind: UiStyleKind, title: string) => {
    const list = styles.filter((s) => s.kind === kind);
    return (
      <div style={{ marginBottom: '1rem' }}>
        <div className="section-title">
          {title} ({list.length})
        </div>
        {list.length === 0 && <div className="small faint">{tr('None yet. Select the dialogue box or the choices in a theme and click “Save … as a style”.')}</div>}
        <div className="style-lib-grid">
          {list.map((s) => (
            <div key={s.id} className="card style-lib-card" data-testid={`library-style-${s.name}`}>
              <StyleThumb s={s} />
              <b className="ellipsis">{s.name}</b>
              <span className="small faint">{tr('Used by {0} theme(s)', { 0: styleUsers({ themes }, s).length })}</span>
              <div className="row wrap" style={{ gap: '0.25rem' }}>
                <button className="btn sm primary" disabled={!canApply} onClick={() => onApply(s)} title={canApply ? tr('Use it in the selected theme') : tr('Select a theme first')} data-testid="library-apply">
                  {tr('Apply')}
                </button>
                <button className="btn sm" onClick={() => void rename(s)} data-testid="library-rename">
                  {tr('Rename')}
                </button>
                <button className="btn sm" onClick={() => duplicate(s)} data-testid="library-duplicate">
                  {tr('Duplicate')}
                </button>
                <button className="btn sm danger" onClick={() => void remove(s)} data-testid="library-delete">
                  {tr('Delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Modal
      title={tr('Style Library')}
      onClose={onClose}
      size="wide"
      testId="style-library"
      footer={
        <button className="btn primary" onClick={onClose}>
          {tr('Done')}
        </button>
      }
    >
      <div className="small muted" style={{ marginBottom: '0.8rem' }}>
        {tr('Styles are saved in this project. A theme that uses a style follows it: edit the style once and every scene using those themes updates. Use “Edit only here” in a theme to change it just there.')}
      </div>
      {group('textbox', tr('Textbox styles'))}
      {group('choice', tr('Choice styles'))}
    </Modal>
  );
}
