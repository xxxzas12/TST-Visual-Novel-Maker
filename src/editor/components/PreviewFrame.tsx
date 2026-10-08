import { t as tr } from '../../shared/i18n';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { GameData, Theme } from '../../shared/types';
import type { DesignSample } from '../../runtime/player/player';

export interface PreviewFrameHandle {
  restart(): void;
}

/**
 * Hosts the real game runtime in an isolated iframe (preview.html). The editor
 * sends GameData via postMessage — exactly the data an exported game uses.
 */
export const PreviewFrame = forwardRef<
  PreviewFrameHandle,
  {
    game: GameData;
    sceneId?: string | null;
    index?: number;
    skipTitle: boolean;
    namespace: string;
    className?: string;
    style?: React.CSSProperties;
    onEvent?: (event: string, detail: unknown) => void;
    testId?: string;
    /** UI designer mode. */
    design?: DesignSample;
    safeArea?: { top: number; right: number; bottom: number; left: number };
    /** Applied live (no restart) whenever it changes. */
    liveTheme?: Theme;
  }
>(function PreviewFrame(props, ref) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [runKey, setRunKey] = useState(0);
  const { onEvent } = props;

  useImperativeHandle(ref, () => ({ restart: () => setRunKey((k) => k + 1) }), []);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      if (e.data?.type === 'tstvn:ready') setReady(true);
      if (e.data?.type === 'tstvn:event') onEvent?.(e.data.event, e.data.detail);
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [onEvent]);

  useEffect(() => {
    if (!ready) return;
    frame.current?.contentWindow?.postMessage(
      { type: 'tstvn:run', game: props.game, sceneId: props.sceneId, index: props.index, skipTitle: props.skipTitle, namespace: props.namespace, design: props.design, safeArea: props.safeArea },
      '*',
    );
    if (props.liveTheme) frame.current?.contentWindow?.postMessage({ type: 'tstvn:theme', theme: props.liveTheme }, '*');
    if (!props.design) frame.current?.focus();
    // liveTheme is sent by its own effect below; a theme edit must not restart the game.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, props.game, props.sceneId, props.index, props.skipTitle, props.namespace, props.design, props.safeArea, runKey]);

  useEffect(() => {
    if (ready && props.liveTheme) frame.current?.contentWindow?.postMessage({ type: 'tstvn:theme', theme: props.liveTheme }, '*');
  }, [ready, props.liveTheme]);

  return <iframe ref={frame} src="./preview.html" className={props.className} style={props.style} title={tr("Game preview")} data-testid={props.testId ?? 'preview-frame'} />;
});
