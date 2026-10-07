import { t as tr } from '../../shared/i18n';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useUi } from '../store/ui';

export function Modal(props: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'normal' | 'wide' | 'xwide';
  testId?: string;
}) {
  const { onClose } = props;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${props.size === 'wide' ? 'wide' : props.size === 'xwide' ? 'xwide' : ''}`} role="dialog" aria-modal="true" data-testid={props.testId}>
        <div className="modal-header">
          <h3>{props.title}</h3>
          <button className="btn ghost icon" onClick={onClose} title={tr("Close (Esc)")} aria-label={tr("Close")}>
            ✕
          </button>
        </div>
        <div className="modal-body">{props.children}</div>
        {props.footer && <div className="modal-footer">{props.footer}</div>}
      </div>
    </div>
  );
}

/** Renders the global confirm and prompt dialogs requested through the UI store. */
export function DialogHost() {
  const confirm = useUi((s) => s.confirm);
  const prompt = useUi((s) => s.prompt);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (prompt) {
      setValue(prompt.value);
      setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [prompt]);

  if (confirm) {
    const done = (ok: boolean) => {
      useUi.setState({ confirm: null });
      confirm.resolve(ok);
    };
    return (
      <Modal
        title={confirm.title}
        onClose={() => done(false)}
        testId="confirm-dialog"
        footer={
          <>
            <button className="btn" onClick={() => done(false)} data-testid="confirm-cancel">
              {confirm.cancelLabel ?? tr("Cancel")}
            </button>
            <button className={`btn ${confirm.danger ? 'danger' : 'primary'}`} onClick={() => done(true)} autoFocus data-testid="confirm-ok">
              {confirm.confirmLabel ?? tr("OK")}
            </button>
          </>
        }
      >
        <p style={{ margin: 0, lineHeight: 1.55 }}>{confirm.message}</p>
        {confirm.details && confirm.details.length > 0 && (
          <ul className="details-list">
            {confirm.details.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        )}
      </Modal>
    );
  }
  if (prompt) {
    const done = (v: string | null) => {
      useUi.setState({ prompt: null });
      prompt.resolve(v);
    };
    return (
      <Modal
        title={prompt.title}
        onClose={() => done(null)}
        testId="prompt-dialog"
        footer={
          <>
            <button className="btn" onClick={() => done(null)}>
              {tr("Cancel")}
            </button>
            <button className="btn primary" onClick={() => done(value)} disabled={!value.trim()} data-testid="prompt-ok">
              {prompt.confirmLabel ?? tr("OK")}
            </button>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (value.trim()) done(value);
          }}
          className="field"
        >
          <label>{prompt.label}</label>
          <input ref={inputRef} className="input" value={value} onChange={(e) => setValue(e.target.value)} autoFocus data-testid="prompt-input" />
        </form>
      </Modal>
    );
  }
  return null;
}

export function Toasts() {
  const toasts = useUi((s) => s.toasts);
  const dismiss = useUi((s) => s.dismissToast);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`} data-testid={`toast-${t.kind}`}>
          <span>{t.kind === 'success' ? '✅' : t.kind === 'error' ? '⛔' : t.kind === 'warning' ? '⚠️' : 'ℹ️'}</span>
          <span className="grow">{t.text}</span>
          <button className="btn ghost sm icon" onClick={() => dismiss(t.id)} aria-label={tr("Dismiss")}>
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
