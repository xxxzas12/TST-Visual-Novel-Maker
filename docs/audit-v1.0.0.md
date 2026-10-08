# TSTVN feature audit (v1.0.0 → v1.0.1)

Audited on 2026-10-08 by reading the code and running the existing tests plus extra probes. Each finding
cites the code that implements (or lacks) the feature.

| # | Feature | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Undo / Redo | **Works** | `editor/store/project.ts` keeps `past`/`future` (150 steps; typing/dragging coalesce into one step). Toolbar buttons + Ctrl+Z / Ctrl+Y (`views/Shell.tsx`). E2E: `acceptance.spec.ts` "undo / redo" step. |
| 2 | Backup | **Works** | `main/backups.ts` (create, list, restore with files, delete, prune to 40), backups before risky operations (`ops.ts`), Backups view. E2E: `features.spec.ts` "delete with backup, restore …". |
| 3 | Autosave | **Works, with gaps** | `views/Shell.tsx useAutosave`: a real save every N minutes (App setting `autosaveMinutes`, 0 = off) and a recovery snapshot every 10 s. Recover/Discard on reopen is E2E tested (`features.spec.ts` "crash recovery"). Gaps: (a) the interval is read once when a project opens, so changing it has no effect until the project is reopened; (b) there is no explicit on/off switch (only "0 = off"), and the status bar does not say when the last *autosave* happened. |
| 4 | Validation before export | **Works, with gaps** | `shared/validate.ts` + `ExportView` "Project check"; `main/gameExport.ts` refuses to export when there are errors and re-checks every file in the staging folder. Covered: missing assets/files, missing jump targets (scene/label/action), choices without options/text, missing variables in conditions, missing fonts. Gaps: condition values of the wrong type (e.g. `has_key > 5` on a Boolean), *Set Variable* with a value of the wrong type. *(Correction, v1.0.9: issues can already be clicked to jump to the problem, and missing files offer Locate / Replace / Remove — this was not a gap.)* |
| 5 | Variables / Flags / Conditions / Branching | **Works** | Number / String / Boolean variables (`VariablesView`), actions *Set / Add / Subtract Variable*, *Check Variable*, *Conditional Branch* (if/else, all/any), conditions on choice options, `{Variable}` in text, conditions that jump to scenes. Engine: `runtime/core/conditions.ts`, `engine.ts`. Unit + E2E tested (acceptance: `Love >= 1` branch). |
| 6 | Scene Flow / Story map | **Works, with gaps** | `views/flow/FlowView.tsx` + `shared/flow.ts`: scene nodes, jump/choice/condition/next edges with labels, drag to connect, delete arrows, double-click opens the scene, list view. E2E tested. Gaps: broken links are silently dropped (`deriveFlowEdges` filters targets that don't exist), so the map cannot show them; a single click only selects. |
| 7 | New / Open / Recent / Duplicate project, Project settings, Backup | **Mostly works** | New (templates), Open folder, Recent list, `.tstvn` package import/export, Save as Template, Settings view, Backups — all present and E2E tested. **Missing: Duplicate Project.** Settings mix project and application settings on one page, and application settings are not reachable from the Welcome screen (only the language). |
| 8 | Plugin system | **Does not exist** | No plugin code, API or folder anywhere in `src/`. |

## Bugs found during the audit

- **Text inputs in Settings accept only one character** (Project name, Game title, Author…).
  Reproduced with real keystrokes: typing "Typed Text" leaves `"T"` and focus leaves the input.
  Root cause: `components/PreviewFrame.tsx` calls `frame.focus()` every time it sends a new game to the
  preview iframe; the Settings page contains the font preview (`FontSettings`), whose game is rebuilt on
  every project change, so every keystroke moves focus into the iframe. Existing E2E tests use
  `fill()` (sets the whole value at once) and therefore never caught it. Confirmed in v1.0.3: the new
  key-by-key E2E test fails with the original behavior and passes with the fix.

## Plan (in the requested order)

A Settings split · B input bug · C installer · D application logo · E plugin manager (new) ·
F game gallery (new, runtime) · G point & click (new, optional) · H variables (already exist — only
validation gaps, handled in I) · I validation gaps · J autosave gaps · K flow gaps (+ Duplicate Project).
