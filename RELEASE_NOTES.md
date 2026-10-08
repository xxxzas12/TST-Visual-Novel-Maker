# TSTVN 1.1.0 — Release Notes

TSTVN (TST Visual Novel Maker) is a Windows desktop app for making visual novels without writing
code. You import art and music, build scenes visually, preview the real game, and export it for
Windows or the Web (which also runs on phones).

This release contains everything since the initial release (1.0.0). Version 1.1.0 is the same app as the
last release candidate (1.0.20). Per-version details:
[CHANGELOG.md](CHANGELOG.md) · [docs/VERSION_HISTORY.md](docs/VERSION_HISTORY.md) ·
[docs/updates/](docs/updates/).

## Install
- Run `TSTVN-Setup-1.1.0.exe` on Windows 10/11 x64.
- The installer is not code-signed yet. Windows SmartScreen may show "Windows protected your PC"; click
  **More info → Run anyway**.
- Two steps: **Install TSTVN** (Desktop shortcut and Start Menu icon options), then **✓ Installed
  successfully** (**Launch TSTVN**).
- It installs for the current user (no administrator needed) into `%LOCALAPPDATA%\Programs\TSTVN`.
- Older versions are upgraded in place, and shortcuts are kept.
- Remove it from Windows Settings → Apps.

## Highlights since 1.0.0

### Game UI designer (Themes)
- A visual editor for the dialogue box, name box, choice buttons and menu bar. You drag, resize and
  align them on a live preview of the real game.
- Device previews and an automatic layout check for every screen size.
- **Basic / Advanced** settings: beginners see only the essentials.
- **Textbox styles** with genuinely different shapes:
  - Classic VN;
  - Modern;
  - Speech Bubble, whose tail points at the speaker;
  - Minimal;
  - Fantasy;
  - Sci-Fi;
  - Horror;
  - RPG;
  - Retro.

  Advanced adds glow, gradient, texture, your own frame image, and text outline.
- **Choice styles:** Classic, Modern, Minimal, RPG, Fantasy, Bubble, and Image Button with your own
  pictures per state. Also shapes and an icon in front of options.
- **Choice actions:** an option can set or add to a variable, play a sound, animate a character or
  shake the screen when chosen.
- **Animations:**
  - the dialogue box appears and disappears with presets (Fade, Slide, Pop, Bounce…);
  - text appears letter by letter or word by word;
  - choices appear one after another;
  - ▶ Preview in the editor;
  - Advanced timing controls.
- **Style Library:** save a textbox or choice style once and reuse it everywhere. Editing it updates
  every scene that uses it.
- Themes per project and per scene, and `.tsttheme` import/export.

### Editor
- **Workspace:** resizable, foldable and swappable panels; presets (Default, Writing, Scene Design,
  Art / Assets); saved layouts.
- **Application Settings** (separate from Project Settings):
  - language (English / ไทย);
  - appearance (dark/light);
  - interface font;
  - application logo;
  - plugins;
  - autosave.
- **Autosave** with on/off and interval, an always-on crash recovery, and **Backups** with restore.
- **Story Flow** shows broken connections and opens any scene with one click.
- **Duplicate Project**, project templates, and a getting-started checklist.
- **Validation before export:** missing files, broken jumps, wrong variable types, and broken choice
  actions.

### Game features
- Variables, conditions and branching.
- Optional Point & Click scenes.
- In-game Gallery (CG, characters, music, endings) with unlocking.
- Accessibility: minimum text size, touch targets, high contrast.

### Fixes from the release candidate (1.0.20)
- Preventive fix: editor preferences changed right after launch are no longer put back by the settings that are still
  loading.

### Plugins
- Plugin Manager with install from `.tstplugin` or a folder, enable/disable and remove.
- Plugins are data-only content packs: themes and action templates. They never run code.

## Compatibility
- Projects from every earlier version open unchanged. New settings are added with defaults that keep
  the old look.
- The project format and export format are unchanged by the UI work. New theme fields are optional
  and ignored by older versions.

## Verification of this release (1.1.0)
- `npm run build` ✔
- lint ✔
- `npm test`: 131/131 ✔
- `npm run test:e2e`: 26/26 ✔. This includes:
  - New → Edit → Save → Close → Reopen → Preview → Export, with the exported Windows and Web games
    launched;
  - the packaged TSTVN.exe;
  - plugins, autosave, backup, crash recovery and validation.
- Real installer test (`scripts/test-installer.ps1`): all checks passed, including the upgrade from
  1.0.20.

## Known issues
See [KNOWN_ISSUES.md](KNOWN_ISSUES.md).
