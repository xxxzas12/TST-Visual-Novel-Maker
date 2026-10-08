// Story Flow broken-connection detection, and Duplicate Project.
import { describe, expect, it } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createAction } from '../src/shared/actions';
import { createEmptyProject } from '../src/shared/project';
import { brokenLinks, deriveFlowEdges } from '../src/shared/flow';
import { createProject, duplicateProject, openProject, saveProject, writeRecovery } from '../src/main/projectStore';
import { createBackup } from '../src/main/backups';
import { tempDir } from './helpers';

describe('story flow: broken connections', () => {
  it('finds every kind of connection that points nowhere (and nothing else)', () => {
    const p = createEmptyProject('Flow');
    const end = { id: 'end', name: 'End', tags: [], actions: [createAction('label', { name: 'here' }), createAction('endGame', {})] };
    p.scenes.push(end);
    p.chapters[0].sceneIds.push('end');
    p.scenes[0].actions = [
      createAction('jumpScene', { sceneId: 'gone' }),
      createAction('jump', { target: { kind: 'label', label: 'nowhere' } }),
      createAction('jump', { target: { kind: 'label', label: 'here' } }), // fine
      createAction('choice', { options: [{ id: 'a', text: 'Left', target: { kind: 'scene', sceneId: 'gone' } }, { id: 'b', text: 'Right', target: { kind: 'next' } }] }),
      createAction('conditional', { conditions: [], then: { kind: 'scene', sceneId: 'end' }, else: { kind: 'action', actionId: 'missing' } }),
      createAction('pointAndClick', { hotspots: [{ id: 'h', label: 'Door', x: 0, y: 0, w: 10, h: 10, target: { kind: 'scene', sceneId: 'gone' } }] }),
      { ...createAction('jumpScene', { sceneId: 'gone' }), disabled: true }, // disabled: ignored
    ];
    expect(brokenLinks(p).map((b) => b.what)).toEqual(['Jump to Scene', 'Jump', 'Choice “Left”', 'Conditional Branch (otherwise)', 'Point & Click “Door”']);
    expect(brokenLinks(p).every((b) => b.sceneId === p.scenes[0].id)).toBe(true);
    // Valid connections are still drawn; broken ones are not drawn as arrows to nowhere.
    expect(deriveFlowEdges(p).some((e) => e.to === 'end')).toBe(true);
    expect(deriveFlowEdges(p).some((e) => e.to === 'gone')).toBe(false);
  });
});

describe('duplicate project', () => {
  it('copies files with a new id and name, without the original backups or recovery', async () => {
    const root = await tempDir('tstvn-dup-');
    const { dir, project } = await createProject(root, 'Original', 'romance');
    await fs.writeFile(path.join(dir, 'assets', 'pic.png'), 'png');
    await createBackup(dir, project, 'test');
    await writeRecovery(dir, { ...project, name: 'unsaved' });
    const copy = await duplicateProject(dir, 'Original copy');
    expect(copy.dir).toBe(path.join(root, 'Original copy'));
    expect(copy.project.name).toBe('Original copy');
    expect(copy.project.settings.title).toBe('Original copy');
    expect(copy.project.id).not.toBe(project.id);
    expect(copy.project.scenes.map((s) => s.id)).toEqual(project.scenes.map((s) => s.id));
    expect(existsSync(path.join(copy.dir, 'assets', 'pic.png'))).toBe(true);
    expect(existsSync(path.join(copy.dir, '.tstvn', 'backups'))).toBe(false);
    expect((await openProject(copy.dir)).recovery).toBeUndefined();
    // The original is untouched; a second copy gets a unique folder.
    expect((await openProject(dir)).project.id).toBe(project.id);
    await saveProject(dir, project);
    expect((await duplicateProject(dir, 'Original copy')).dir).not.toBe(copy.dir);
  });
});
