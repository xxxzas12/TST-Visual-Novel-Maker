# TSTVN Architecture

## Technology decision

| Option | Verdict |
| --- | --- |
| **Electron + React + TypeScript + Vite** | **Chosen.** Only needs Node (installed); full file-system access for the importer/file manager; the editor's own Electron binary doubles as the Windows game player, so *Export Game* is one click with no compiler or terminal; the game runtime is plain web tech, so the same runtime powers editor preview, Windows, Web and (later) Android/iOS WebView wrappers. |
| Tauri | Smaller binaries, but needs Rust + MSVC build tools (not installed) **at export time on the user's PC** to produce a game executable → no one-click build. |
| Godot / Flutter | Strong runtimes, but building a rich asset-management editor UI and exporting would need their SDKs/templates on the user's machine. |

## The big picture

```
            ┌──────────────────────── TSTVN Editor (Electron) ─────────────────────────┐
            │ Renderer: React UI (src/editor)        Main process (src/main)           │
            │  Gallery / File Manager / Scenes  ⇄IPC⇄  importer, file ops, backups,     │
            │  Story Flow / Themes / Export            packages, project store, export │
            └──────────────────────────────┬───────────────────────────────────────────┘
                                           │ project.json  (Project — src/shared/types.ts)
                                           ▼
                           buildGameData() (src/shared/gamedata.ts)
                                           │ GameData (only enabled actions, only used assets)
                                           ▼
                         TSTVN Runtime (src/runtime) — no editor code, no dependencies
                         ┌──────────────┬──────────────────┬────────────────────────┐
                         ▼              ▼                  ▼                        ▼
                  Editor preview   Windows export      Web export        Android / iOS (planned:
                  (iframe)         (Electron shell)    (index.html)      WebView wrapper of Web)
```

Editor and runtime share only `src/shared` (data model, stage geometry, themes, animation presets).
The runtime bundle (`dist/runtime/runtime.js`, ~48 KB) never imports editor code.

## Source layout

```
src/
  shared/      Data model and pure logic used everywhere
    types.ts        Project, Asset, Character, Scene, Action, Theme, GameData
    actions.ts      Action catalogue: categories, fields, defaults, summaries, search
    classify.ts     Asset type detection (folder name → file name → extension → image size)
    characters.ts   Characters/<Name>/<expression>.png → character + expressions
    validate.ts     Integrity checks, reference find / replace / remove
    gamedata.ts     Project → GameData (what preview and export run)
    flow.ts, search.ts, project.ts (templates, normalization), themes.ts, animations.ts, stage.ts, api.ts
  runtime/     Game runtime
    core/engine.ts  Async story interpreter (jumps, labels, conditions, choices, save/restore, loop guard)
    core/state.ts   Pure visual-state reducer (also used by Play From Here and the editor stage)
    player/         DOM renderer: layers, transitions, typewriter, choices, menus, save slots, audio, input
    runtime.css     Responsive, safe-area aware, touch-friendly UI themed by CSS variables
    entry.ts        Standalone boot for exported games
  main/        Electron main process (Node)
    importer.ts     Recursive scan → plan (hash, size, dimensions, duplicates) → execute (copy, thumbnails)
    fileops.ts      Create/rename/move/copy/delete (delete = move into a backup)
    projectStore.ts Create/open/save (atomic), recovery file, recent projects, user templates
    backups.ts      Backups before risky operations, restore (with files), prune
    packageIO.ts    .tstvn zip export/import (streaming, path-traversal safe)
    gameExport.ts   Validate → stage → build → verify → publish
    main.ts         Window, IPC, `tstvn-asset://` protocol (serves only the open project)
  preload/     contextBridge API (window.tstvn), typed by shared/api.ts
  game-shell/  main.cjs + preload.cjs copied into every Windows export
  editor/      React app: views/, components/, store/ (zustand + immer), ops.ts, sceneOps.ts
```

## Project on disk

```
My Novel/
  project.json        The whole project (atomic writes)
  assets/             Imported files, structure preserved; managed by the File Manager
  .tstvn/thumbs/      256px PNG thumbnails (cache, regenerated on import/replace)
  .tstvn/backups/     <id>/project.json (+ files/ for deleted files), max 40
  .tstvn/recovery.json  Unsaved-work snapshot (written every 10 s while dirty)
  exports/            Default export folder
```

Actions reference assets **by id**, never by path, so renaming/moving files in the File Manager never
breaks a scene — only `asset.path` changes.

## Performance

- Gallery: `@tanstack/react-virtual` — only visible rows are in the DOM (40 tiles for 2 000 assets in the
  E2E test), thumbnails are small cached PNGs loaded lazily.
- Import: concurrent hashing/copying (limit 6–8), header-only image size parsing, streaming SHA-1.
- Runtime: assets load on demand when an action shows them; preview/export include only used assets.
- Editor state: immutable updates with structural sharing; undo history coalesces typing/dragging.

## Safety

- Renderer is sandboxed (`contextIsolation`, `sandbox`, no Node). All file access goes through IPC.
- Every IPC path is resolved with `resolveInside()` (no `..` escapes); file-manager ops are limited to `assets/`.
- `tstvn-asset://` serves files of the currently open project only.
- Deletes, imports, mass replaces, scene/chapter deletes and restores create a backup first.
- Export runs in a staging folder and is verified before it replaces the previous build.

## Mobile

The runtime is already touch-first: tap to advance, 44 px touch targets, safe-area insets, letterboxed stage
(characters never go off-screen at 16:9 / 16:10 / 4:3 / 18:9 / 19.5:9 / 20:9 / portrait), UI scaled by
viewport. The Web export runs on phones today; native Android/iOS packages would wrap the same Web export in
a WebView shell (e.g. Capacitor) — no runtime changes required.
