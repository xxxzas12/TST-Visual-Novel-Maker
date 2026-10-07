// Runs inside the editor's preview iframe: the real game runtime, isolated from the editor UI.
import '../runtime/runtime.css';
import { Player } from '../runtime/player/player';
import type { GameData } from '../shared/types';
import { assetUrlForPath } from './assetUrl';

export interface PreviewRequest {
  type: 'tstvn:run';
  game: GameData;
  sceneId?: string | null;
  index?: number;
  skipTitle: boolean;
  namespace: string;
}

let player: Player | null = null;

declare global {
  interface Window {
    __tstvnPlayer?: Player;
  }
}

window.addEventListener('message', (e: MessageEvent<PreviewRequest>) => {
  if (e.source !== window.parent || e.data?.type !== 'tstvn:run') return;
  player?.destroy();
  const mount = document.getElementById('tstvn-game')!;
  player = new Player(mount, e.data.game, {
    resolvePath: (p) => assetUrlForPath(p),
    corsImages: true,
    storageNamespace: e.data.namespace,
    preview: { sceneId: e.data.sceneId, index: e.data.index, skipTitle: e.data.skipTitle },
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
