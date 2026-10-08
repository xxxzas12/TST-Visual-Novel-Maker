import type { SaveState } from '../core/engine';
import type { Volumes } from './audio';

export interface SlotData {
  save: SaveState;
  screenshot: string | null;
}

export interface PlayerSettings {
  textSpeedFactor: number;
  autoDelay: number;
  volumes: Volumes;
  autoHideUI: boolean;
  displayMode: 'windowed' | 'fullscreen' | 'borderless';
  /** Accessibility: multiplies every UI text size. */
  textScale: number;
  /** Accessibility: null = the theme's default. */
  highContrast: boolean | null;
}

export const AUTO_SLOT = 'auto';
export const SLOT_COUNT = 12;

export const DEFAULT_SETTINGS: PlayerSettings = {
  textSpeedFactor: 1,
  autoDelay: 1.5,
  volumes: { master: 1, bgm: 0.8, sfx: 1, voice: 1 },
  autoHideUI: false,
  displayMode: 'windowed',
  textScale: 1,
  highContrast: null,
};

/** Save slots and settings in localStorage (works in Electron, browsers and mobile WebViews). */
export class SaveStorage {
  private prefix: string;

  constructor(gameId: string, namespace = 'tstvn') {
    this.prefix = `${namespace}:${gameId}`;
  }

  private read<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(`${this.prefix}:${key}`);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  private write(key: string, value: unknown): boolean {
    try {
      localStorage.setItem(`${this.prefix}:${key}`, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  getSlot(slot: string): SlotData | null {
    return this.read<SlotData>(`save:${slot}`);
  }

  putSlot(slot: string, data: SlotData): boolean {
    // If storage is full, retry without the screenshot.
    return this.write(`save:${slot}`, data) || this.write(`save:${slot}`, { ...data, screenshot: null });
  }

  removeSlot(slot: string) {
    try {
      localStorage.removeItem(`${this.prefix}:save:${slot}`);
    } catch {
      /* storage unavailable */
    }
  }

  slots(): string[] {
    return [AUTO_SLOT, ...Array.from({ length: SLOT_COUNT }, (_, i) => String(i + 1))];
  }

  latest(): { slot: string; data: SlotData } | null {
    let best: { slot: string; data: SlotData } | null = null;
    for (const s of this.slots()) {
      const d = this.getSlot(s);
      if (d && (!best || d.save.savedAt > best.data.save.savedAt)) best = { slot: s, data: d };
    }
    return best;
  }

  getSettings(defaultDisplay: PlayerSettings['displayMode']): PlayerSettings {
    const s = this.read<Partial<PlayerSettings>>('settings') ?? {};
    return {
      ...DEFAULT_SETTINGS,
      displayMode: defaultDisplay,
      ...s,
      volumes: { ...DEFAULT_SETTINGS.volumes, ...(s.volumes ?? {}) },
    };
  }

  putSettings(s: PlayerSettings) {
    this.write('settings', s);
  }
}
