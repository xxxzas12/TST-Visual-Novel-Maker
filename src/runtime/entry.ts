// Standalone runtime entry used by exported games (Windows, Web, future mobile wrappers).
import './runtime.css';
import type { GameData } from '../shared/types';
import { Player, type HostBridge } from './player/player';

declare global {
  interface Window {
    TSTVN_GAME?: GameData;
    tstvnHost?: HostBridge;
    __tstvnPlayer?: Player;
  }
}

export function encodeAssetPath(p: string): string {
  return p.split('/').map(encodeURIComponent).join('/');
}

function boot() {
  const mount = document.getElementById('tstvn-game') ?? document.body;
  const game = window.TSTVN_GAME;
  if (!game || game.format !== 'tstvn-game') {
    mount.textContent = 'Game data could not be loaded (game.js is missing or damaged).';
    mount.setAttribute('style', 'color:#fff;font:16px system-ui;padding:24px');
    return;
  }
  document.title = game.title;
  const player = new Player(mount, game, { resolvePath: encodeAssetPath, host: window.tstvnHost });
  window.__tstvnPlayer = player;
  void player.boot();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
