# Changelog

All notable changes to TSTVN. Each version has a detailed report in [docs/updates](docs/updates/).

## v1.0.8
### Added
- Optional **Point & Click** action (👆): clickable objects on the stage (area in %, optional image, name
  shown on hover), each going to a scene/label and optionally setting a variable, with show-conditions.
  Drag/resize the objects on the editor stage; shown in Story Flow; validated; hosts without support fall
  back to a normal choice. The Visual Novel system is unchanged.

### Fixed
- In-game menu bar could be squeezed against the right edge after the title screen (it was measured
  while hidden).
- Switching the editor language and creating a project right away could build the template in the old
  language (the language was applied only after writing settings.json).
- Saving settings (and other atomic writes) could fail with EPERM on Windows when the file was briefly
  open elsewhere; the rename is now retried.

## v1.0.7
### Added
- In-game **Gallery** for games made with TSTVN (title screen → Gallery): CG, Characters, Music and Endings
  tabs with locked (🔒 ???) / unlocked items, unlocked counts, CG/character viewer and music player.
  Items unlock when seen in the story and stay unlocked across new games.
- Project Settings → **Game Gallery**: enable, choose sections, per-item unlock rule ("Unlocks when seen" /
  "Always unlocked"); the rule is a union type ready for more conditions later.

## v1.0.6
### Added
- Plugin system and **Plugin Manager** (⚙ Settings → Plugins): Installed Plugins, Enable/Disable,
  Remove, Install from file (`.tstplugin`/`.zip`) or folder, Open Plugin Folder.
- Plugins are declarative content packs: game UI themes (Themes → From plugins) and action templates
  (＋ Action → Templates). Sample plugin `plugins/tstvn-sample-pack`, format docs `plugins/README.md`,
  `scripts/pack-plugin.mjs`.

## v1.0.5
### Added
- Application Settings → **Application logo**: Choose Image, Preview, Reset. Shown on the Welcome screen,
  the top bar and as TSTVN's window/taskbar icon; stored in the app's user data.
- Project Settings → **Game icon** (per project): window/taskbar icon of the exported Windows game and
  favicon of the Web game. Independent of the application logo.

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
