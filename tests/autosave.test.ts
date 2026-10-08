// Autosave rules: on/off, interval, migration of the old "0 minutes = off" setting, due time.
import { describe, expect, it } from 'vitest';
import { autosaveConfig, autosaveDue, autosaveIn } from '../src/shared/autosave';

describe('autosave', () => {
  it('reads old and new settings', () => {
    expect(autosaveConfig({})).toEqual({ enabled: true, minutes: 2 });
    expect(autosaveConfig({ autosaveMinutes: 5 })).toEqual({ enabled: true, minutes: 5 });
    expect(autosaveConfig({ autosaveMinutes: 0 })).toEqual({ enabled: false, minutes: 2 }); // old "off"
    expect(autosaveConfig({ autosaveMinutes: 0, autosaveEnabled: true })).toEqual({ enabled: true, minutes: 2 });
    expect(autosaveConfig({ autosaveMinutes: 10, autosaveEnabled: false })).toEqual({ enabled: false, minutes: 10 });
    expect(autosaveConfig({ autosaveMinutes: 500 }).minutes).toBe(60);
  });

  it('is due N minutes after the first unsaved change, never when off or saved', () => {
    const cfg = { enabled: true, minutes: 2 };
    expect(autosaveDue(1000 + 119_999, 1000, cfg)).toBe(false);
    expect(autosaveDue(1000 + 120_000, 1000, cfg)).toBe(true);
    expect(autosaveDue(1_000_000, null, cfg)).toBe(false);
    expect(autosaveDue(1_000_000, 1000, { ...cfg, enabled: false })).toBe(false);
    expect(autosaveIn(1000 + 30_000, 1000, cfg)).toBe(90_000);
    expect(autosaveIn(5000, null, cfg)).toBeNull();
  });
});
