# TSTVN Version History

Each version below has a git tag, an entry in [CHANGELOG.md](../CHANGELOG.md) and a detailed report
in [docs/updates](updates/). Dates are commit dates. Version numbers come from `package.json` and were
raised once per feature or fix. Only v1.0.0 and v1.1.0 are published as GitHub Releases (see
[below](#github-releases-downloads)).

| Version | Tag commit | Date | Summary | Report |
|---|---|---|---|---|
| 1.0.0 | 980e0a1 (initial commit, untagged) | 2026-10-07 | Initial release of TSTVN: import, scenes, story flow, preview, export (Windows/Web) | — |
| 1.0.1 | 7fd125e | 2026-10-08 | Game UI / Theme editor; feature audit | [v1.0.1](updates/v1.0.1.md) |
| 1.0.2 | 42248bc | 2026-10-08 | Application Settings separated from Project Settings | [v1.0.2](updates/v1.0.2.md) |
| 1.0.3 | 9b83f48 | 2026-10-08 | Fix: text inputs losing focus after one character | [v1.0.3](updates/v1.0.3.md) |
| 1.0.4 | c43359b | 2026-10-08 | Two-step installer with shortcut options and launch page | [v1.0.4](updates/v1.0.4.md) |
| 1.0.5 | 081af7c | 2026-10-08 | Application logo; per-project game icon | [v1.0.5](updates/v1.0.5.md) |
| 1.0.6 | 9624f60 | 2026-10-08 | Plugin system and Plugin Manager | [v1.0.6](updates/v1.0.6.md) |
| 1.0.7 | e7169b0 | 2026-10-08 | In-game Gallery with unlock rules | [v1.0.7](updates/v1.0.7.md) |
| 1.0.8 | 00b67bc | 2026-10-08 | Optional Point & Click; menu bar, language and EPERM fixes | [v1.0.8](updates/v1.0.8.md) |
| 1.0.9 | ab1ed55 | 2026-10-08 | Variable/condition type validation before export | [v1.0.9](updates/v1.0.9.md) |
| 1.0.10 | a3c19c3 | 2026-10-08 | Autosave on/off, live interval, status indicator | [v1.0.10](updates/v1.0.10.md) |
| 1.0.11 | bc34e40 | 2026-10-08 | Story Flow broken connections; Duplicate Project | [v1.0.11](updates/v1.0.11.md) |
| 1.0.12 | 4d983d2 | 2026-10-08 | Editor workspace: resizable/foldable panels, presets, saved layout | [v1.0.12](updates/v1.0.12.md) |
| 1.0.13 | 211b11e | 2026-10-08 | Textbox style presets with real shapes, hover preview | [v1.0.13](updates/v1.0.13.md) |
| 1.0.14 | 3ebd41c | 2026-10-08 | Advanced textbox settings; Basic/Advanced | [v1.0.14](updates/v1.0.14.md) |
| 1.0.15 | 47bec4e | 2026-10-08 | Choice presets, shapes, icon, button pictures, "when chosen" actions | [v1.0.15](updates/v1.0.15.md) |
| 1.0.16 | 249b498 | 2026-10-08 | Game UI animation presets with preview | [v1.0.16](updates/v1.0.16.md) |
| 1.0.17 | 5af9d23 | 2026-10-08 | Advanced animation controls | [v1.0.17](updates/v1.0.17.md) |
| 1.0.18 | bc86063 | 2026-10-08 | Style Library (reusable textbox and choice styles) | [v1.0.18](updates/v1.0.18.md) |
| 1.0.19 | f2095da | 2026-10-08 | UI polish pass | [v1.0.19](updates/v1.0.19.md) |
| 1.0.20 | eeb6c2b | 2026-10-08 | RC fix: startup settings no longer undo early preference changes; GitHub README/LICENSE merged | [v1.0.20](updates/v1.0.20.md) |
| **1.1.0** | 18ca57a | 2026-10-09 | First public release of the new version line; same app as 1.0.20 | [v1.1.0](updates/v1.1.0.md) |

## Where tags point

- **v1.0.1–v1.0.13, v1.0.18–v1.0.20, v1.1.0:** the feature, fix or release commit itself.
- **v1.0.14–v1.0.17:** the follow-up commit recording that version's full test-gate result. For v1.0.14
  this is a test-only fix, saving before closing in the textbox specs. Each of these sits directly
  after its feature commit, and the app code is identical.
- **v1.0.0:** the repository's initial commit (980e0a1) has no lowercase tag. The GitHub repository has a tag **V1.0.0** (capital V), made on GitHub, which points to a README edit (9760a03) made on GitHub on 2026-10-07 before this history was merged in. It is kept unchanged.

## Installers

`npm run dist` writes `release/TSTVN-Setup-<version>.exe`. Older installers are kept in `release/`
(not tracked in git).

## GitHub Releases (downloads)

| Release | Tag | Installer | Status |
|---|---|---|---|
| TSTVN v1.1.0 | `v1.1.0` (18ca57a) | `TSTVN-Setup-1.1.0.exe` | ⭐ Latest, recommended |
| TSTVN v1.0.0 — First Release | `V1.0.0` (9760a03) | `TSTVN-Setup-1.0.0.exe` (uploaded by the author) | Previous version, kept unchanged |

Versions 1.0.1–1.0.20 were development builds made within two days on the way to 1.1.0. Their tags,
source code and detailed reports are available, but they were never published as releases. 1.1.0
contains all of their changes, and v1.0.20 is the same app as 1.1.0, so no separate installers are
published for them. Any of them could still be built from its tag (`npm ci && npm run dist`) if
needed.

New releases are built by `.github/workflows/release.yml` when a version tag is pushed (see
[GUIDE.md](GUIDE.md#releasing)).
