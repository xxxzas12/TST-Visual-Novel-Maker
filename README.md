# TSTVN — TST Visual Novel Maker

TSTVN is a desktop app for making visual novels **without writing code**:

> Import → Organize → Create → Preview → Test → Export

Drag in a folder of art and music, build scenes visually with actions (dialogue, choices, characters,
backgrounds, music, variables, animations), press **Play**, and export a real game for **Windows** or the
**Web** (which also runs on phones).

---

## Install

Run **`TSTVN-Setup-1.0.0.exe`** (built into `release/` by `npm run dist`) on any Windows 10/11 x64 PC.
It installs for the current user (no admin needed), lets you pick the folder, and creates Desktop and
Start Menu shortcuts. Uninstall from Windows Settings → Apps.

## Language / ภาษา

The editor is available in **English** and **ไทย (Thai)**: switch on the start screen (🌐) or in
**Settings → Editor language**. First run follows the Windows language. Each project also has a
**Game language** (Settings → Game) for the menus players see (Start, Save, Load, Settings…), and new
projects from templates are created in the current language.

## Fonts & appearance

**Settings → Fonts**:
- **Program font** and **program font size** for the TSTVN interface.
- **Dialogue font** and **dialogue font size** for the game (dialogue, names, choices, menus). The default is
  the theme's font and size.
- **The font picker** lists fonts installed in Windows plus **Custom Fonts**. It has search and a live sample,
  and every font is shown in its own typeface.
- **Import Font** adds `.ttf`/`.otf` files. They work in TSTVN without installing them in Windows. When used as
  the dialogue font, the file is copied into the project (`fonts/`) and shipped inside exported games.
- **Previews:** changes are previewed first (Dark and Light samples, plus the real game runtime), then
  **Apply**, **Cancel** or **Reset to Default**. Choices are remembered across restarts.

**Settings → Editor → Appearance**: Dark, Light, or Follow Windows. Both palettes are checked for WCAG contrast
by `tests/appearance.test.ts`.

## Quick start (users)

1. Start TSTVN (Desktop shortcut, `release/win-unpacked/TSTVN.exe`, or `npm start` from source).
2. **Create Project** — pick a template (Blank, Romance, Horror, Mystery, Comedy, or your own).
3. **Assets → Import Folder** (or drag a folder onto the window). Subfolders are scanned, types detected,
   thumbnails made, duplicates found. `Characters/Alice/happy.png` automatically becomes character
   *Alice* with expression *Happy*.
4. **Scenes** — drag a background or a character onto the stage, click **💬 Dialogue**, **🔀 Choice**,
   or **＋ Action** (searchable, by category).
5. **▶ Play** (F5) or **▶ Play From Here** (Shift+F5) — the preview is the real game runtime.
6. **Export → EXPORT GAME** — choose Windows or Web, the export is validated before it is published.

Want demo assets? `npm run samples` writes `samples/Assets` (characters, backgrounds, CG, music, SFX, voice).

### Editor shortcuts

| Keys | Action |
| --- | --- |
| Ctrl+S | Save |
| Ctrl+Z / Ctrl+Y | Undo / Redo |
| F5 / Shift+F5 | Play / Play From Here |
| Ctrl+1 … Ctrl+9 | Switch workspace |
| Ctrl+A, Ctrl+Click, Shift+Click | Multi-select (gallery, action list) |
| Delete, F2, Ctrl+D, Ctrl+C / Ctrl+V | Delete, rename, duplicate, copy/paste actions |
| Alt+↑ / Alt+↓ | Move selected actions |

### In-game controls

Click / tap / Space / Enter = continue · Esc = menu · Ctrl+S or S = save · L = load · A = auto ·
hold Ctrl = skip · H or right-click = hide UI · F11 / Alt+Enter = fullscreen · 1–9 / arrows = choices.

---

## Development

Requirements: **Node.js 22.12+** (developed with Node 24 LTS) on Windows x64. No other tools needed.

```bash
npm install          # also downloads the Electron binary (postinstall)
npm run dev          # editor with hot reload (Vite) + Electron
npm run build        # typecheck + runtime + editor + main process → dist/
npm start            # run the built editor
npm run dist         # build + package → release/TSTVN-Setup-1.0.0.exe (installer) + release/win-unpacked/
node scripts/i18n-keys.mjs --missing   # list UI strings that still need a Thai translation
```

### Tests

```bash
npm run lint         # ESLint (TypeScript + React hooks)
npm run typecheck    # tsc --noEmit, strict
npm test             # Vitest: model, engine, importer, file manager, backups, packages, export
npm run test:e2e     # Playwright drives the real Electron app (needs `npm run build` first)
npm run test:all     # everything above
```

The E2E suite runs the full acceptance workflow: create project → import folder → gallery → file manager →
characters → variables → chapters/scenes → drag & drop → dialogue/choice/conditional/animation → theme →
story flow → preview → play from here → in-game save/load → undo/redo → save/close/reopen → export Web +
Windows → `.tstvn` package → run the exported game at PC, phone-landscape, phone-portrait and 4:3 sizes.
`e2e/packaged.spec.ts` additionally checks that the packaged `TSTVN.exe` exports a working game.

Screenshots from the last E2E run are written to `.e2e-tmp/screenshots/`.

### Export

- **Windows**: a folder with `<Game>.exe` (Electron player + the game). Double-click to play. The window mode
  (windowed / fullscreen / borderless) comes from Settings.
- **Web / mobile browsers**: `index.html` + `runtime.js` + `game.js` + `assets/`. Open locally or upload to any
  web host. Touch, safe areas (notches) and phone aspect ratios are supported.

Every export is built in a staging folder, verified (required files, runtime integrity, game data, every asset
reference) and only then moved into place — a broken export never replaces a working one.

See [docs/architecture.md](docs/architecture.md) and [docs/development-log.md](docs/development-log.md).
