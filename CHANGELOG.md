# Changelog

All notable changes to TSTVN. Each version has a detailed report in [docs/updates](docs/updates/).

## v1.0.4
### Changed
- New two-step installer: **TSTVN — Install TSTVN** with [x] Create Desktop shortcut, [x] Create Start Menu
  icon and an Install button, then **TSTVN — ✓ Installed successfully** with Launch TSTVN and Close
  (English/Thai). Always per-user into `%LOCALAPPDATA%ProgramsTSTVN`; the "all users / only me" and
  folder pages are gone.

### Added
- `scripts/test-installer.ps1`: drives the real installer window and checks files, shortcuts,
  registry, uninstall and upgrade.

### Fixed
- An installed-over (upgraded) copy could end up without shortcuts or an uninstall entry; upgrades from
  v1.0.3 now keep both (tested silent and interactive).

## v1.0.3
### Fixed
- Text inputs (Project name, Game title, Author and others next to a live game preview) lost focus after
  one character. Embedded game previews no longer take keyboard focus when they restart; only the Play
  window does.

### Added
- `e2e/typing.spec.ts`: real keystrokes (continuous typing, arrows, editing in the middle, Backspace,
  select + replace, paste, Thai input) in the Welcome, Project Settings, scene and theme text fields.

## v1.0.2
### Added
- Application Settings window (General, Interface & fonts, Autosave & recovery, About), reachable from
  the Welcome screen (⚙ Settings) and from the top bar inside a project (⚙).
- `e2e/screens.spec.ts` (screenshots of the main screens) and `scripts/release-gate.sh`.

### Changed
- The project page is now **Project Settings** and only contains project/game settings (game info,
  title screen, game font, project files). Editor language, appearance, interface font/size,
  autosave and the checklist moved to Application Settings.
- The font settings are split: interface font (application) and game font (project), each with its own
  preview, Apply, Cancel and Reset.

### Known Issues
- Text inputs on the Project Settings page lose focus after one character (fixed in v1.0.3).

## v1.0.1
### Added
- Game UI / Theme editor: visual editing (select, drag, resize, align, nudge) of the dialogue box,
  name box, choice buttons and menu bar on the real runtime, device previews and a layout check.
- Theme model v2: px / % / vw / vh sizes on a 1920×1080 canvas, choice states (normal, hover, pressed,
  disabled), menu buttons, accessibility limits, presets Modern, Minimal, Classic, Dark, Soft, RPG,
  Romance, Horror (+ Fantasy).
- Scene theme overrides, `.tsttheme` export/import, "show when locked" choice options, player text size
  and high contrast settings.
- Feature audit (`docs/audit-v1.0.0.md`).

### Changed
- Runtime UI styles all come from the theme (no hard-coded dialogue/choice styles).
- Older projects and themes are migrated automatically on load.

### Fixed
- Overlapping `app:setSettings` calls could reset the editor language to English.
- Menu bar measured while shrink-wrapped (wrapped into several rows).

### Known Issues
- Text inputs on the Settings page lose focus after one character (fixed in v1.0.3).

## v1.0.0
### Added
- Initial release: project system, asset import & file manager, scene editor with 33 actions, story
  flow, characters, variables, themes, preview, save/load, backups, autosave & recovery, Windows/Web
  export, Thai/English UI, font system, light/dark appearance, installer.
