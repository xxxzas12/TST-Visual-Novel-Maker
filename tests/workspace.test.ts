// Editor workspace layouts: reading saved (or damaged) layouts, presets, saved workspaces.
import { describe, expect, it } from 'vitest';
import { LIMITS, WORKSPACE_PRESETS, defaultLayout, isUnchanged, normalizeCustomWorkspaces, normalizeLayout, workspaceLayout } from '../src/shared/workspace';

describe('workspace layout', () => {
  it('falls back to the default layout for missing or damaged settings', () => {
    expect(normalizeLayout(undefined)).toEqual(defaultLayout());
    expect(normalizeLayout('nonsense')).toEqual(defaultLayout());
    const l = normalizeLayout({ leftWidth: 99999, inspectorWidth: -5, stageShare: 'x', panels: { left: 'collapsed', stage: 'gone' }, leftTab: 'nope', swapSides: 1 });
    expect(l.leftWidth).toBe(LIMITS.leftWidth.max);
    expect(l.inspectorWidth).toBe(LIMITS.inspectorWidth.min);
    expect(l.stageShare).toBe(defaultLayout().stageShare);
    expect(l.panels).toEqual({ left: 'collapsed', inspector: 'open', stage: 'open' });
    expect(l.leftTab).toBe('scenes');
    expect(l.swapSides).toBe(true);
  });

  it('has the four presets, each different from the others', () => {
    expect(WORKSPACE_PRESETS.map((p) => p.id)).toEqual(['default', 'writing', 'scene', 'art']);
    const json = WORKSPACE_PRESETS.map((p) => JSON.stringify({ ...p.layout, base: '' }));
    expect(new Set(json).size).toBe(4);
    expect(workspaceLayout('writing', [])!.panels.stage).toBe('collapsed');
    expect(workspaceLayout('art', [])!.leftTab).toBe('assets');
    // Returned layouts are copies: changing one never changes the preset.
    workspaceLayout('default', [])!.panels.left = 'hidden';
    expect(workspaceLayout('default', [])!.panels.left).toBe('open');
  });

  it('knows when a layout was changed from its workspace', () => {
    const l = workspaceLayout('scene', [])!;
    expect(isUnchanged(l, [])).toBe(true);
    expect(isUnchanged({ ...l, leftWidth: l.leftWidth + 40 }, [])).toBe(false);
    expect(isUnchanged({ ...l, base: 'deleted-workspace' }, [])).toBe(false);
  });

  it('reads saved workspaces and drops broken entries', () => {
    const custom = normalizeCustomWorkspaces([{ id: 'ws1', name: 'Mine', layout: { leftWidth: 300, panels: { inspector: 'hidden' } } }, { name: 'no id' }, null, 'x']);
    expect(custom).toHaveLength(1);
    expect(custom[0].layout.base).toBe('ws1');
    expect(custom[0].layout.panels.inspector).toBe('hidden');
    expect(isUnchanged(workspaceLayout('ws1', custom)!, custom)).toBe(true);
    expect(normalizeCustomWorkspaces(undefined)).toEqual([]);
  });
});
