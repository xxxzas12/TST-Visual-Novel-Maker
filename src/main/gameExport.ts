import path from 'node:path';
import fs from 'node:fs/promises';
import type { GameData, Project } from '../shared/types';
import type { ExportGameResult, ExportPlatform, ExportProgress } from '../shared/api';
import { buildGameData } from '../shared/gamedata';
import { validateProject } from '../shared/validate';
import { exists, resolveInside, safeName, walkFiles } from './paths';
import { existsSync } from 'node:fs';
import { t } from '../shared/i18n';

export interface ExportEnv {
  /** Folder containing runtime.js and runtime.css. */
  runtimeDir: string;
  /** Folder containing the desktop game shell (main.cjs, preload.cjs). */
  shellDir: string;
  /** Folder containing the Electron binaries to package (Windows). */
  electronDir: string;
  /** File name of the Electron executable inside electronDir. */
  electronExe: string;
  /** Entries inside electronDir/resources that belong to the editor and must not be copied. */
  excludeResources: string[];
}

export interface ExportOptions {
  dir: string;
  project: Project;
  platform: ExportPlatform;
  outDir: string;
  env: ExportEnv;
  onProgress?: (p: ExportProgress) => void;
}

export function gameIndexHtml(title: string, iconPath?: string): string {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  const icon = iconPath ? `<link rel="icon" href="${esc(iconPath.split('/').map(encodeURIComponent).join('/'))}">
` : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="theme-color" content="#000000">
<title>${esc(title)}</title>
${icon}<link rel="stylesheet" href="runtime.css">
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}#tstvn-game{position:fixed;inset:0}</style>
</head>
<body>
<div id="tstvn-game"></div>
<script src="game.js"></script>
<script src="runtime.js"></script>
</body>
</html>
`;
}

export function gameJs(data: GameData): string {
  // JSON is valid JS; escape "</" so the data can never close a script tag.
  return `window.TSTVN_GAME = ${JSON.stringify(data).replace(/<\//g, '<\\/')};\n`;
}

export function parseGameJs(text: string): GameData {
  const m = /^window\.TSTVN_GAME = ([\s\S]*);\s*$/.exec(text);
  if (!m) throw new Error('game.js is malformed');
  return JSON.parse(m[1]) as GameData;
}

/** Project-relative path of the game icon, if the game has one. */
function gameIconPath(data: GameData): string | undefined {
  return data.iconAssetId ? data.assets[data.iconAssetId]?.path : undefined;
}

/** Writes the platform-independent web game (index.html, runtime, game data, assets) into wwwDir. */
async function writeWebGame(dir: string, data: GameData, wwwDir: string, env: ExportEnv, progress: (step: string, pct: number) => void) {
  await fs.mkdir(wwwDir, { recursive: true });
  await fs.writeFile(path.join(wwwDir, 'index.html'), gameIndexHtml(data.title, gameIconPath(data)));
  await fs.copyFile(path.join(env.runtimeDir, 'runtime.js'), path.join(wwwDir, 'runtime.js'));
  await fs.copyFile(path.join(env.runtimeDir, 'runtime.css'), path.join(wwwDir, 'runtime.css'));
  await fs.writeFile(path.join(wwwDir, 'game.js'), gameJs(data));
  for (const f of data.fonts ?? []) {
    const dest = resolveInside(wwwDir, f.path);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(resolveInside(dir, f.path), dest);
  }
  const assets = Object.values(data.assets);
  let i = 0;
  for (const a of assets) {
    const src = resolveInside(dir, a.path);
    const dest = resolveInside(wwwDir, a.path);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(src, dest);
    i++;
    if (i % 10 === 0 || i === assets.length) progress(`Copying assets (${i}/${assets.length})`, 20 + Math.round((i / Math.max(1, assets.length)) * 40));
  }
}

/** Verifies an exported web game folder: required files, data integrity and every asset reference. */
export async function verifyWebGame(wwwDir: string): Promise<{ errors: string[]; checks: string[] }> {
  const errors: string[] = [];
  const checks: string[] = [];
  for (const f of ['index.html', 'runtime.js', 'runtime.css', 'game.js']) {
    const p = path.join(wwwDir, f);
    if (!(await exists(p))) errors.push(t('Required file missing: {f}', { f }));
    else if ((await fs.stat(p)).size === 0) errors.push(t('Required file is empty: {f}', { f }));
  }
  if (errors.length) return { errors, checks };
  checks.push(t('Required files present'));
  const html = await fs.readFile(path.join(wwwDir, 'index.html'), 'utf8');
  if (!html.includes('runtime.js') || !html.includes('game.js')) errors.push(t('index.html does not load the runtime.'));
  const runtime = await fs.readFile(path.join(wwwDir, 'runtime.js'), 'utf8');
  if (!runtime.includes('TSTVN_GAME')) errors.push(t('runtime.js is not a TSTVN runtime.'));
  else checks.push(t('Runtime integrity OK'));
  let data: GameData;
  try {
    data = parseGameJs(await fs.readFile(path.join(wwwDir, 'game.js'), 'utf8'));
  } catch (e) {
    errors.push(t('Game data is unreadable: {msg}', { msg: (e as Error).message }));
    return { errors, checks };
  }
  if (data.format !== 'tstvn-game') errors.push(t('Game data has the wrong format.'));
  if (!data.scenes.length) errors.push(t('Game has no scenes.'));
  if (data.startSceneId && !data.scenes.some((s) => s.id === data.startSceneId)) errors.push(t('Start scene is missing from game data.'));
  checks.push(t('Game data OK ({n} scenes)', { n: data.scenes.length }));
  let missing = 0;
  for (const a of Object.values(data.assets)) {
    if (!(await exists(path.join(wwwDir, a.path)))) {
      errors.push(t('Asset file missing in export: {path}', { path: a.path }));
      missing++;
    }
  }
  for (const f of data.fonts ?? []) {
    if (!(await exists(path.join(wwwDir, f.path)))) {
      errors.push(t('Required file missing: {f}', { f: f.path }));
      missing++;
    }
  }
  if (!missing) checks.push(t('All {n} asset references resolve', { n: Object.keys(data.assets).length }));
  // Every asset id referenced by characters/actions must be in the asset table.
  const table = new Set(Object.keys(data.assets));
  for (const s of data.scenes) {
    for (const a of s.actions) {
      for (const k of ['assetId', 'voice', 'sfx']) {
        const v = a.params?.[k];
        if (typeof v === 'string' && v && !table.has(v)) errors.push(t('Broken reference in “{scene}”: asset {id}', { scene: s.name, id: v }));
      }
    }
  }
  return { errors, checks };
}

async function dirStats(dir: string) {
  const files = await walkFiles(dir);
  let bytes = 0;
  for (const f of files) bytes += (await fs.stat(f)).size;
  return { files: files.length, bytes };
}

/**
 * Export workflow: validate -> build into a staging folder -> verify -> move into place.
 * A broken package is never left in the output folder.
 */
export async function exportGame(opts: ExportOptions): Promise<ExportGameResult> {
  const { dir, project, platform, outDir, env } = opts;
  const progress = (step: string, percent: number) => opts.onProgress?.({ step, percent });

  progress('Checking project', 2);
  const issues = validateProject(project, (rel) => {
    try {
      return existsSync(resolveInside(dir, rel));
    } catch {
      return false;
    }
  });
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  if (errors.length) return { ok: false, errors: errors.map((e) => e.message), warnings };

  for (const f of ['runtime.js', 'runtime.css']) {
    if (!(await exists(path.join(env.runtimeDir, f)))) return { ok: false, errors: [t('The TSTVN runtime is missing ({f}). Reinstall or rebuild TSTVN.', { f })], warnings };
  }

  const data = buildGameData(project);
  const baseName = safeName(data.title, 'Game');
  const finalDir = path.join(outDir, `${baseName}-${platform === 'windows' ? 'Windows' : 'Web'}`);
  const staging = path.join(outDir, `.${baseName}-${platform}-staging-${Date.now()}`);
  await fs.mkdir(outDir, { recursive: true });

  try {
    let wwwDir: string;
    let launchRel: string;
    if (platform === 'windows') {
      progress('Copying game engine', 8);
      if (!(await exists(path.join(env.electronDir, env.electronExe)))) {
        return { ok: false, errors: [t('The Windows player is missing from this TSTVN installation.')], warnings };
      }
      const exclude = new Set(env.excludeResources.map((x) => x.toLowerCase()));
      await fs.cp(env.electronDir, staging, {
        recursive: true,
        filter: (src) => {
          const rel = path.relative(env.electronDir, src);
          const parts = rel.split(path.sep);
          // The installer's uninstaller belongs to the editor, not to the game.
          if (parts.length === 1 && /^uninstall/i.test(parts[0])) return false;
          if (parts[0]?.toLowerCase() === 'resources' && parts[1] && exclude.has(parts[1].toLowerCase())) return false;
          return true;
        },
      });
      const exeName = `${baseName}.exe`;
      await fs.rename(path.join(staging, env.electronExe), path.join(staging, exeName));
      const appDir = path.join(staging, 'resources', 'app');
      await fs.mkdir(appDir, { recursive: true });
      await fs.writeFile(path.join(appDir, 'package.json'), JSON.stringify({ name: baseName.toLowerCase().replace(/[^a-z0-9-]+/g, '-') || 'game', productName: data.title, version: '1.0.0', main: 'main.cjs' }, null, 1));
      await fs.copyFile(path.join(env.shellDir, 'main.cjs'), path.join(appDir, 'main.cjs'));
      await fs.copyFile(path.join(env.shellDir, 'preload.cjs'), path.join(appDir, 'preload.cjs'));
      await fs.writeFile(
        path.join(appDir, 'game-config.json'),
        JSON.stringify(
          {
            title: data.title,
            displayMode: data.displayMode,
            width: data.resolution.width,
            height: data.resolution.height,
            // Window/taskbar icon: the project's game icon (inside www/), never the TSTVN logo.
            ...(gameIconPath(data) ? { icon: `www/${gameIconPath(data)}` } : {}),
          },
          null,
          1,
        ),
      );
      wwwDir = path.join(appDir, 'www');
      launchRel = exeName;
    } else {
      wwwDir = staging;
      launchRel = 'index.html';
    }

    progress('Writing game files', 18);
    await writeWebGame(dir, data, wwwDir, env, progress);
    if (platform === 'web') {
      await fs.writeFile(
        path.join(staging, 'README.txt'),
        `${data.title}\r\n\r\nOpen index.html in a browser to play, or upload this folder to any web host.\r\nWorks on desktop and mobile browsers.\r\n`,
      );
    }

    progress('Verifying export', 75);
    const verify = await verifyWebGame(wwwDir);
    if (platform === 'windows') {
      for (const f of [launchRel, 'resources/app/main.cjs', 'resources/app/preload.cjs', 'resources/app/package.json', 'resources/app/game-config.json']) {
        if (!(await exists(path.join(staging, f)))) verify.errors.push(t('Required file missing: {f}', { f }));
      }
      if (!verify.errors.length) verify.checks.push(t('Windows executable and game shell present'));
    }
    if (verify.errors.length) {
      await fs.rm(staging, { recursive: true, force: true });
      return { ok: false, errors: verify.errors, warnings };
    }

    progress('Finishing', 92);
    if (await exists(finalDir)) await fs.rm(finalDir, { recursive: true, force: true });
    await fs.rename(staging, finalDir);
    const stats = await dirStats(finalDir);
    progress('Done', 100);
    return { ok: true, outputPath: finalDir, launchPath: path.join(finalDir, launchRel), files: stats.files, bytes: stats.bytes, warnings, checks: verify.checks };
  } catch (e) {
    await fs.rm(staging, { recursive: true, force: true }).catch(() => undefined);
    return { ok: false, errors: [t('Export failed: {msg}', { msg: (e as Error).message })], warnings };
  }
}
