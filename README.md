# TSTVN — TST Visual Novel Maker

TSTVN is a desktop app for making visual novels **without writing code**:

> Import → Organize → Create → Preview → Test → Export

Drag in a folder of art and music, build scenes visually with actions (dialogue, choices, characters,
backgrounds, music, variables, animations), press **Play**, and export a real game for **Windows** or the
**Web** (which also runs on phones).

---

## Install

Run **`TSTVN-Setup-<version>.exe`** (built into `release/` by `npm run dist`) on any Windows 10/11 x64 PC.
The installer has two steps: **Install TSTVN** (tick *Create Desktop shortcut* / *Create Start Menu icon*)
and **✓ Installed successfully** (*Launch TSTVN*). It installs for the current user (no admin needed) into
`%LOCALAPPDATA%\Programs\TSTVN`, upgrades an existing installation in place, and can be removed from
Windows Settings → Apps. Silent install: `TSTVN-Setup-<version>.exe /S` (creates both shortcuts).

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

## Game UI & Themes

**Themes** is a visual editor for everything players see on top of the story — no code:

- **Dialogue box, name box, choice buttons, menu bar and each menu button** can be clicked in a live
  preview of the real game, then **dragged** to move, **resized** with handles, **aligned** to screen
  edges, nudged with the arrow keys; menu buttons can be **duplicated / deleted / added**
  (Auto, Skip, Save, Load, Settings, Hide UI, Menu).
- The **properties panel** shows every setting of the selected element: position (anchor + X/Y),
  width/height in **px** (on a 1920×1080 canvas), **%** or **vw/vh**, padding, background color/image,
  opacity, border, corner radius, shadow, background blur, font (system or imported .ttf/.otf), size,
  color, line height, letter spacing, alignment, text speed; choice buttons have **Normal / Hover /
  Pressed / Disabled** styles and hover/press animations.
- **Device previews** (desktop, laptop, tablet, phones with notches) and a **layout check** for all of
  them: the UI scales to every screen, stays inside the safe area, never makes text smaller than the
  minimum or buttons smaller than the touch target, never lets choices cover the dialogue, and warns about
  low contrast or overlaps.
- **Presets:** Modern, Minimal, Classic, Dark, Soft, RPG, Romance, Horror (+ Fantasy). Presets are
  read-only: **Edit a copy** / **Save as Custom Preset**, then edit, rename or delete your own.
- **Project theme + scene overrides:** "Use for whole project", "Use in scenes…", or the 🎨 menu in
  the Scenes view.
- **Export / Import .tsttheme** — a single file with the theme, its images and fonts, to share or reuse.
- **Accessibility:** minimum text size, minimum touch target, high contrast default; players can change
  text size and high contrast in the game's Settings. Choice options can be shown greyed out when their
  condition is not met ("show when locked").

Everything is saved in the project, and the exported game reads the same theme data — what you design is
what players get.

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
npm run dist         # build + package → release/TSTVN-Setup-<version>.exe (installer) + release/win-unpacked/
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
