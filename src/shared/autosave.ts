// Autosave rules (separate from Backups and from the always-on crash-recovery snapshots).
import type { AppSettings } from './api';

export interface AutosaveConfig {
  enabled: boolean;
  /** Save this many minutes after the first unsaved change. */
  minutes: number;
}

export const AUTOSAVE_MINUTES = { min: 1, max: 60, default: 2 };

/** Reads the autosave settings; older settings used "0 minutes" to mean off. */
export function autosaveConfig(s: Partial<Pick<AppSettings, 'autosaveEnabled' | 'autosaveMinutes'>>): AutosaveConfig {
  const raw = Number(s.autosaveMinutes);
  const enabled = s.autosaveEnabled ?? !(Number.isFinite(raw) && raw <= 0);
  const minutes = Number.isFinite(raw) && raw > 0 ? Math.min(AUTOSAVE_MINUTES.max, Math.max(AUTOSAVE_MINUTES.min, Math.round(raw))) : AUTOSAVE_MINUTES.default;
  return { enabled, minutes };
}

/** True when an autosave should happen now. `dirtySince` = time of the first unsaved change (null = saved). */
export function autosaveDue(now: number, dirtySince: number | null, cfg: AutosaveConfig): boolean {
  return cfg.enabled && dirtySince !== null && now - dirtySince >= cfg.minutes * 60_000;
}

/** Milliseconds until the next autosave (null when none is pending). */
export function autosaveIn(now: number, dirtySince: number | null, cfg: AutosaveConfig): number | null {
  if (!cfg.enabled || dirtySince === null) return null;
  return Math.max(0, dirtySince + cfg.minutes * 60_000 - now);
}
