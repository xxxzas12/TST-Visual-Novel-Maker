# TSTVN plugins

Plugins are **content packs**: they add game UI themes and action templates to TSTVN. They contain only
JSON (no code runs), so installing one is safe.

```
my-plugin/
  plugin.json
  themes/my-theme.json            ← a TSTVN theme (same format as theme.json inside a .tsttheme)
  templates/my-template.json      ← { "name": "…", "actions": [ { "type": "narration", "params": { "text": "…" } } ] }
```

`plugin.json`:

```json
{
  "id": "com.example.my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "author": "You",
  "description": "What it adds.",
  "contributes": { "themes": ["themes/my-theme.json"], "actionTemplates": ["templates/my-template.json"] }
}
```

- `id`: lowercase letters, digits, `.`, `_`, `-` (unique; installing the same id again updates it).
- Theme files may be partial: missing values come from the Modern theme.
- Action `type`s are the editor's action types (`narration`, `dialogue`, `screenEffect`, `playBGM`, …).

Install in TSTVN: **⚙ Settings → Plugins → Install from file…** (a `.tstplugin` = zip of the folder) or
**Install from folder…**. Pack a folder: `node scripts/pack-plugin.mjs plugins/my-plugin`.

`tstvn-sample-pack/` is a working example.
