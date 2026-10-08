# Known Issues — TSTVN 1.0.19

None of these block normal use. Each was recorded when the related feature was built; details are in
[docs/updates](docs/updates/).

## Installer & environment
- **Not code-signed:** the installer and TSTVN.exe have no digital signature yet, so Windows SmartScreen may show
  "Windows protected your PC" on first run (More info → Run anyway). Fixing it needs a code-signing certificate.
- **Clean-machine test:** the installer was tested by fully uninstalling first, not on a fresh VM or in
  Windows Sandbox (not available on the test PC, which runs Windows 11 Home).
- **`ELECTRON_RUN_AS_NODE`:** in a terminal that sets `ELECTRON_RUN_AS_NODE=1` (for example VS Code's),
  starting TSTVN from that terminal does not open the app. This is an Electron environment variable.
  Starting from Explorer, the Start Menu or the Desktop works.

## Export
- The exported Windows game's **.exe file icon** in Explorer is still Electron's. The game window and
  taskbar use the game icon. Changing an exe's embedded icon needs a resource editor, which isn't
  bundled.

## Game UI / Themes
- The speech-bubble tail is aimed when a line starts. If the character moves during the line, the tail
  follows on the next line.
- The torn textbox edge uses fixed pixel offsets, so it looks slightly finer on very large screens.
- Texture opacity follows the box opacity (there is no separate texture opacity).
- Custom frame images ignore the corner radius (border images are rectangular). Round frames come
  from the picture itself.
- Gradients are not offered for choice buttons, because they would hide the per-state colours.
- "Animate a character" (a choice action) only shows when that character is on stage.
- Style Library styles belong to one project. To reuse one elsewhere, export a theme (`.tsttheme`)
  that uses it.

## Editor
- The Workspace (resizable and foldable panels) applies to the Scene editor. Other views have fixed
  layouts.
- Some toolbar icons are emoji and some are text symbols (e.g. ⬆). They line up, but their style
  varies with the Windows font version.
- Story Flow lists broken connections but cannot draw them as arrows (the target no longer exists).

## Features by design
- Plugins are data-only: themes and action templates. No code plugins.
- Gallery unlock rules: "seen in the story" and "always unlocked".
- The Character gallery counts characters shown on stage, not speakers who only talk.
- Point & Click has no built-in "inspect and come back". Use a Label before the action and Jump back
  to it.
