// Draggable divider between two panels. Drag (or arrow keys) to resize, double-click to reset.
import { useRef } from 'react';

interface Props {
  /** 'x' = a vertical bar that changes widths; 'y' = a horizontal bar that changes heights. */
  axis: 'x' | 'y';
  label: string;
  /** Called with the pointer movement in px since the drag started. */
  onDrag: (delta: number) => void;
  onDragStart?: () => void;
  onReset?: () => void;
  /** Keyboard step in px (arrow keys; Shift = 5×). */
  onStep?: (delta: number) => void;
  testId?: string;
}

export function Splitter({ axis, label, onDrag, onDragStart, onReset, onStep, testId }: Props) {
  const dragging = useRef(false);
  return (
    <div
      className={`splitter splitter-${axis}`}
      role="separator"
      aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
      aria-label={label}
      title={label}
      tabIndex={0}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        const start = axis === 'x' ? e.clientX : e.clientY;
        const el = e.currentTarget;
        el.setPointerCapture(e.pointerId);
        dragging.current = true;
        onDragStart?.();
        document.body.classList.add(axis === 'x' ? 'resizing-x' : 'resizing-y');
        const move = (ev: PointerEvent) => onDrag((axis === 'x' ? ev.clientX : ev.clientY) - start);
        const up = () => {
          dragging.current = false;
          document.body.classList.remove('resizing-x', 'resizing-y');
          el.removeEventListener('pointermove', move);
          el.removeEventListener('pointerup', up);
          el.removeEventListener('pointercancel', up);
        };
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerup', up);
        el.addEventListener('pointercancel', up);
      }}
      onDoubleClick={onReset}
      onKeyDown={(e) => {
        const dir = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[e.key];
        if (!dir || !onStep) return;
        if ((axis === 'x') !== (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return;
        e.preventDefault();
        onStep(dir * (e.shiftKey ? 50 : 10));
      }}
      data-testid={testId}
    />
  );
}

/** A folded panel: a thin bar that reopens the panel when clicked. */
export function PanelRail({ icon, label, side, onOpen, testId }: { icon: string; label: string; side: 'left' | 'right'; onOpen: () => void; testId?: string }) {
  return (
    <button className={`panel-rail panel-rail-${side}`} onClick={onOpen} title={label} aria-label={label} data-testid={testId}>
      <span aria-hidden>{side === 'left' ? '»' : '«'}</span>
      <span className="panel-rail-icon" aria-hidden>
        {icon}
      </span>
      <span className="panel-rail-label">{label}</span>
    </button>
  );
}
