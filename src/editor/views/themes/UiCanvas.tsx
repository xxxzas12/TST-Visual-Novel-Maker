// Visual Game UI editor: the real game runtime (design mode) in an iframe at device size,
// with selection boxes, drag-to-move and resize handles drawn on top.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { t as tr } from '../../../shared/i18n';
import type { GameData, Theme } from '../../../shared/types';
import type { DesignLayout, DesignSample } from '../../../runtime/player/player';
import { makeContext, type UiContext } from '../../../shared/uilayout';
import { moveElement, resizeEdges, resizeElement, type DevicePreset, type ResizeEdge, type UiElementId } from '../../../shared/uicheck';
import { PreviewFrame } from '../../components/PreviewFrame';

interface Props {
  /** Interactive "try it" mode: the demo game runs, no selection overlay. */
  play?: boolean;
  game: GameData;
  theme: Theme;
  device: DevicePreset;
  sample: DesignSample;
  selected: UiElementId | null;
  editable: boolean;
  onSelect: (el: UiElementId | null) => void;
  /** Called continuously while dragging with the theme as it should be now. */
  onChange: (next: Theme, key: string) => void;
  onReadOnlyEdit: () => void;
}

/** Order matters: later entries are drawn on top. */
function selectable(layout: DesignLayout, theme: Theme): { id: UiElementId; rect: DesignLayout['rects'][string] }[] {
  const out: { id: UiElementId; rect: DesignLayout['rects'][string] }[] = [];
  const r = layout.rects;
  if (r.dialog) out.push({ id: 'dialog', rect: r.dialog });
  if (r.name && theme.nameBox.enabled) out.push({ id: 'name', rect: r.name });
  if (r.choices) out.push({ id: 'choices', rect: r.choices });
  if (r.menubar && theme.menuBar.enabled) out.push({ id: 'menubar', rect: r.menubar });
  for (const b of theme.menuBar.buttons) {
    const rect = r[`button:${b.id}`];
    if (rect && theme.menuBar.enabled) out.push({ id: `button:${b.id}`, rect });
  }
  return out;
}

export function UiCanvas(props: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 800, h: 450 });
  const [layout, setLayout] = useState<DesignLayout | null>(null);
  const drag = useRef<{
    id: UiElementId;
    edge: ResizeEdge | null;
    x: number;
    y: number;
    start: Theme;
    ctx: UiContext;
    moved: boolean;
  } | null>(null);
  const { device } = props;

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setBox({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // A new device restarts the preview; old rectangles no longer apply.
  useEffect(() => setLayout(null), [device]);

  const k = Math.max(0.05, Math.min((box.w - 8) / device.width, (box.h - 8) / device.height));

  const ctxFor = (l: DesignLayout): UiContext =>
    makeContext(props.theme, l.viewport.width, l.viewport.height, {
      top: l.area.top,
      left: l.area.left,
      right: l.viewport.width - l.area.left - l.area.width,
      bottom: l.viewport.height - l.area.top - l.area.height,
    });

  const begin = (e: React.PointerEvent, id: UiElementId, edge: ResizeEdge | null) => {
    if (e.button !== 0 || !layout) return;
    e.stopPropagation();
    e.preventDefault();
    props.onSelect(id);
    if (!props.editable) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = {
      id,
      edge,
      x: e.clientX,
      y: e.clientY,
      start: JSON.parse(JSON.stringify(props.theme)) as Theme,
      ctx: ctxFor(layout),
      moved: false,
    };
  };

  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.x) / k;
    const dy = (e.clientY - d.y) / k;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) < 3) return;
    if (!d.moved && !props.editable) return props.onReadOnlyEdit();
    d.moved = true;
    const next = JSON.parse(JSON.stringify(d.start)) as Theme;
    if (d.edge) resizeElement(next, d.id, d.edge, dx, dy, d.ctx);
    else moveElement(next, d.id, dx, dy, d.ctx);
    props.onChange(next, `ui-drag:${d.id}:${d.edge ?? 'move'}`);
  };

  const end = () => {
    drag.current = null;
  };

  const items = layout ? selectable(layout, props.theme) : [];
  const sel = items.find((i) => i.id === props.selected);

  return (
    <div className="ui-canvas" ref={wrap} data-testid="ui-canvas">
      <div className="ui-device-box" style={{ width: device.width * k, height: device.height * k }}>
        <div
          className="ui-device"
          style={{
            width: device.width,
            height: device.height,
            transform: `scale(${k})`,
          }}
          data-device={device.id}
        >
          {props.play ? (
            <PreviewFrame
              game={props.game}
              skipTitle
              sceneId="demo"
              index={0}
              namespace="tstvn-theme-preview"
              className="ui-frame interactive"
              testId="theme-preview"
              safeArea={device.safe}
              liveTheme={props.theme}
            />
          ) : (
            <PreviewFrame
              game={props.game}
              skipTitle
              sceneId="demo"
              index={0}
              namespace="tstvn-ui-design"
              className="ui-frame"
              testId="ui-design-frame"
              design={props.sample}
              safeArea={device.safe}
              liveTheme={props.theme}
              onEvent={onLayoutEvent(setLayout)}
            />
          )}
          {!props.play && (
            <div
              className="ui-overlay"
              onPointerDown={(e) => {
                if (e.target === e.currentTarget) props.onSelect(null);
              }}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={end}
              data-testid="ui-overlay"
            >
              {device.safe.top + device.safe.bottom + device.safe.left + device.safe.right > 0 && (
                <div
                  className="ui-safe"
                  style={{
                    left: device.safe.left,
                    top: device.safe.top,
                    right: device.safe.right,
                    bottom: device.safe.bottom,
                  }}
                  title={tr('Safe area (outside: notch / rounded corners)')}
                />
              )}
              {items.map((it) => (
                <div
                  key={it.id}
                  className={`ui-hit ${it.id === props.selected ? 'selected' : ''} ${props.editable ? '' : 'readonly'}`}
                  style={{
                    left: it.rect.left,
                    top: it.rect.top,
                    width: it.rect.width,
                    height: it.rect.height,
                    borderWidth: 2 / k,
                  }}
                  onPointerDown={(e) => begin(e, it.id, null)}
                  data-testid={`ui-el-${it.id}`}
                  title={it.id}
                />
              ))}
              {sel &&
                props.editable &&
                resizeEdges(sel.id).map((edge) => (
                  <div
                    key={edge}
                    className={`ui-handle ui-handle-${edge}`}
                    style={{
                      ...handlePos(sel.rect, edge),
                      width: 12 / k,
                      height: 12 / k,
                      marginLeft: -6 / k,
                      marginTop: -6 / k,
                    }}
                    onPointerDown={(e) => begin(e, sel.id, edge)}
                    data-testid={`ui-handle-${edge}`}
                  />
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Stable handler factory (PreviewFrame re-subscribes when onEvent changes).
const handlers = new WeakMap<object, (event: string, detail: unknown) => void>();
function onLayoutEvent(set: (l: DesignLayout) => void) {
  let h = handlers.get(set);
  if (!h) {
    h = (event, detail) => {
      if (event === 'layout' && detail) set(detail as DesignLayout);
    };
    handlers.set(set, h);
  }
  return h;
}

function handlePos(r: { left: number; top: number; width: number; height: number }, edge: ResizeEdge): React.CSSProperties {
  const x = edge.includes('w') ? r.left : edge.includes('e') ? r.left + r.width : r.left + r.width / 2;
  const y = edge.startsWith('n') ? r.top : edge.startsWith('s') ? r.top + r.height : r.top + r.height / 2;
  return { left: x, top: y };
}
