import { t as tr } from '../../shared/i18n';
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildGameData } from '../../shared/gamedata';
import { useProject } from '../store/project';
import { useUi } from '../store/ui';
import { PreviewFrame, type PreviewFrameHandle } from '../components/PreviewFrame';

/** Device presets to test responsive layouts (PC and mobile aspect ratios). */
const DEVICES = [
  { id: 'fit', label: 'Fit window', w: 0, h: 0 },
  { id: '16:9', label: 'PC 16:9', w: 1280, h: 720 },
  { id: '16:10', label: 'PC 16:10', w: 1280, h: 800 },
  { id: '4:3', label: 'Tablet 4:3', w: 1024, h: 768 },
  { id: '18:9', label: 'Phone 18:9', w: 720, h: 360 },
  { id: '19.5:9', label: 'Phone 19.5:9', w: 844, h: 390 },
  { id: '20:9', label: 'Phone 20:9', w: 800, h: 360 },
  { id: 'portrait', label: 'Phone portrait', w: 390, h: 844 },
];

export function PreviewModal() {
  const req = useUi((s) => s.preview)!;
  const project = useProject((s) => s.project)!;
  // Snapshot the game when the preview opens so edits behind the modal don't restart it.
  const game = useMemo(() => buildGameData(project), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [device, setDevice] = useState('fit');
  const [box, setBox] = useState({ w: 800, h: 450 });
  const stageRef = useRef<HTMLDivElement>(null);
  const frame = useRef<PreviewFrameHandle>(null);
  const close = () => useUi.getState().openPreview(null);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth - 32, h: el.clientHeight - 32 }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    // Esc inside the game opens the game menu; Ctrl+W / the toolbar closes the preview.
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey && e.key.toLowerCase() === 'w') || e.key === 'F5') {
        e.preventDefault();
        if (e.key === 'F5') frame.current?.restart();
        else close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const d = DEVICES.find((x) => x.id === device)!;
  let w = box.w;
  let h = box.h;
  if (d.w) {
    const scale = Math.min(1, box.w / d.w, box.h / d.h);
    w = Math.round(d.w * scale);
    h = Math.round(d.h * scale);
  }
  const sceneName = req.sceneId ? project.scenes.find((s) => s.id === req.sceneId)?.name : null;

  return (
    <div className="preview-modal" data-testid="preview-modal">
      <div className="preview-toolbar">
        <b>{tr("▶ Preview")}</b>
        <span className="small muted">{req.skipTitle && sceneName ? tr("from “{0}” action #{1}", { 0: sceneName, 1: (req.index ?? 0) + 1 }) : tr("from title screen")}</span>
        <span className="grow" />
        {DEVICES.map((x) => (
          <button key={x.id} className={`btn sm ${device === x.id ? 'active' : ''}`} onClick={() => setDevice(x.id)} data-testid={`device-${x.id}`}>
            {tr(x.label)}
          </button>
        ))}
        <button className="btn sm" onClick={() => frame.current?.restart()} title={tr("Restart (F5)")}>
          {tr("⟲ Restart")}
        </button>
        <button className="btn sm primary" onClick={close} data-testid="close-preview" title={tr("Close preview (Ctrl+W)")}>
          {tr("✕ Close")}
        </button>
      </div>
      <div className="preview-stage" ref={stageRef}>
        <PreviewFrame
          ref={frame}
          game={game}
          sceneId={req.sceneId}
          index={req.index}
          skipTitle={req.skipTitle}
          namespace="tstvn-preview"
          className="preview-frame"
          style={{ width: w, height: h }}
        />
      </div>
      <div className="small faint" style={{ padding: '0.3rem 0.8rem' }}>
        {tr("Click / Space / Enter = continue · Esc = game menu · H = hide UI · A = auto · Ctrl = skip · this is exactly what players see.")}
      </div>
    </div>
  );
}
