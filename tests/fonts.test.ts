import { beforeAll, describe, expect, it } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { renameFontFamily } from '../scripts/font-tools.mjs';
import { FontStore, listSystemFonts, parseFontFamilies } from '../src/main/fonts';
import { exportGame } from '../src/main/gameExport';
import { createProject } from '../src/main/projectStore';
import { buildGameData } from '../src/shared/gamedata';
import { validateProject } from '../src/shared/validate';
import { createAction } from '../src/shared/actions';
import { tempDir } from './helpers';

const ARIAL = path.join(process.env.WINDIR ?? 'C:\\Windows', 'Fonts', 'arial.ttf');
const hasArial = existsSync(ARIAL);
let root: string;
let testFont: string;

beforeAll(async () => {
  root = await tempDir('tstvn-fonts-');
  if (hasArial) {
    testFont = path.join(root, 'src', 'MyTestFont.ttf');
    await fs.mkdir(path.dirname(testFont), { recursive: true });
    await fs.writeFile(testFont, renameFontFamily(await fs.readFile(ARIAL), 'TSTVN Test Font'));
  }
});

describe.skipIf(!hasArial)('font files', () => {
  it('reads family names from real font files', async () => {
    expect(parseFontFamilies(await fs.readFile(ARIAL))).toContain('Arial');
    expect(parseFontFamilies(await fs.readFile(testFont))).toEqual(['TSTVN Test Font']);
    expect(parseFontFamilies(Buffer.from('not a font at all, sorry'))).toEqual([]);
  });

  it('lists installed fonts (and scans font folders)', async () => {
    const system = await listSystemFonts();
    expect(system.length).toBeGreaterThan(10);
    expect(system.some((f) => f.family === 'Arial')).toBe(true);
  });

  it('imports, lists, embeds and removes custom fonts without installing them', async () => {
    const store = new FontStore(path.join(root, 'userdata', 'fonts'));
    const f = await store.import(testFont);
    expect(f.family).toBe('TSTVN Test Font');
    expect(f.file.endsWith('.ttf')).toBe(true);
    expect((await store.import(testFont)).id).toBe(f.id); // no duplicates
    expect((await store.list()).map((x) => x.family)).toEqual(['TSTVN Test Font']);

    const txt = path.join(root, 'notes.txt');
    await fs.writeFile(txt, 'x');
    await expect(store.import(txt)).rejects.toThrow(/ttf/);
    const fake = path.join(root, 'fake.otf');
    await fs.writeFile(fake, 'definitely not a font');
    await expect(store.import(fake)).rejects.toThrow(/not a valid font/);

    const { dir, project } = await createProject(path.join(root, 'projects'), 'Font Game', 'blank');
    const embedded = await store.embedInProject(dir, f.id);
    expect(embedded).toEqual({ family: 'TSTVN Test Font', file: `fonts/${f.file}` });
    expect(existsSync(path.join(dir, embedded.file))).toBe(true);

    // Game data uses the font for dialogue and ships the file.
    project.settings.dialogueFont = embedded;
    project.settings.dialogueFontSize = 32;
    project.scenes[0].actions.push(createAction('narration', { text: 'hello' }));
    const game = buildGameData(project);
    expect(game.theme.font.startsWith('"TSTVN Test Font"')).toBe(true);
    expect(game.theme.fontSize).toBe(32);
    expect(game.fonts).toEqual([{ family: 'TSTVN Test Font', path: embedded.file }]);

    const env = {
      runtimeDir: path.join(root, 'rt'),
      shellDir: path.resolve('src/game-shell'),
      electronDir: root,
      electronExe: 'none.exe',
      excludeResources: [],
    };
    await fs.mkdir(env.runtimeDir, { recursive: true });
    await fs.writeFile(path.join(env.runtimeDir, 'runtime.js'), 'window.TSTVN_GAME');
    await fs.writeFile(path.join(env.runtimeDir, 'runtime.css'), '.x{}');
    const r = await exportGame({ dir, project, platform: 'web', outDir: path.join(root, 'out'), env });
    expect(r.ok, JSON.stringify(r)).toBe(true);
    if (r.ok) expect(existsSync(path.join(r.outputPath, embedded.file))).toBe(true);

    // A missing font file is reported and blocks export.
    await fs.rm(path.join(dir, embedded.file));
    expect(validateProject(project, (rel) => existsSync(path.join(dir, rel))).some((i) => i.message.includes('font'))).toBe(true);

    expect(await store.remove(f.id)).toEqual([]);
  });
});
