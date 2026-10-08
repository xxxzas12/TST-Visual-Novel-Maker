# Changelog

All notable changes to TSTVN. Each version has a detailed report in [docs/updates](docs/updates/).

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
