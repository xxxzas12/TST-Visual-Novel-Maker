// Runs inside the editor's preview iframe: the real game runtime, isolated from the editor UI.
import '../runtime/runtime.css';
import { Player, type DesignSample } from '../runtime/player/player';
import type { GameData, Theme } from '../shared/types';
import { assetUrlForPath } from './assetUrl';

export interface PreviewRequest {
  type: 'tstvn:run';
  game: GameData;
  sceneId?: string | null;
  index?: number;
  skipTitle: boolean;
  namespace: string;
  /** UI designer mode (see Player.design). */
  design?: DesignSample;
  safeArea?: { top: number; right: number; bottom: number; left: number };
}

/** Live theme change without restarting the game. */
export interface PreviewThemeRequest {
  type: 'tstvn:theme';
  theme: Theme;
}

/** Editor preview: play an element's animation again. */
export interface PreviewReplayRequest {
  type: 'tstvn:replay';
  target: 'dialog' | 'choices' | 'text';
}

let player: Player | null = null;

declare global {
  interface Window {
    __tstvnPlayer?: Player;
  }
}

window.addEventListener('message', (e: MessageEvent<PreviewRequest | PreviewThemeRequest | PreviewReplayRequest>) => {
  if (e.source !== window.parent) return;
  if (e.data?.type === 'tstvn:replay') {
    player?.replayAnimation(e.data.target);
    return;
  }
  if (e.data?.type === 'tstvn:theme') {
    player?.setTheme(e.data.theme);
    return;
  }
  if (e.data?.type !== 'tstvn:run') return;
  player?.destroy();
  const mount = document.getElementById('tstvn-game')!;
  player = new Player(mount, e.data.game, {
    resolvePath: (p) => assetUrlForPath(p),
    corsImages: true,
    storageNamespace: e.data.namespace,
    preview: { sceneId: e.data.sceneId, index: e.data.index, skipTitle: e.data.skipTitle },
    design: e.data.design,
    safeArea: e.data.safeArea,
    onEvent: (type, detail) => window.parent.postMessage({ type: 'tstvn:event', event: type, detail: safeDetail(detail) }, '*'),
  });
  window.__tstvnPlayer = player;
  void player.boot();
});

function safeDetail(d: unknown) {
  try {
    return JSON.parse(JSON.stringify(d ?? null));
  } catch {
    return null;
  }
}

window.parent.postMessage({ type: 'tstvn:ready' }, '*');
