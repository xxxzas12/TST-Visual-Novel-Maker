import type { Action, ChoiceEffect, ChoiceOption, Condition, Hotspot, JumpTarget, Project, Theme, Variable } from './types';
import { getActionDef, isKnownActionType } from './actions';
import { t } from './i18n';
import { applyStyles, mapStyleImages, styleAssetIds } from './uistyles';
import { mapThemeImages, resolveTheme, themeAssetIds, themeExists, themeFontRefs } from './themes';

export const ASSET_PARAM_KEYS = ['assetId', 'voice', 'sfx'] as const;

export interface Issue {
  severity: 'error' | 'warning';
  message: string;
  sceneId?: string;
  actionId?: string;
  assetId?: string;
}

/** Hotspots of a Point & Click action (empty for other actions). */
export function hotspotsOf(a: Action): Hotspot[] {
  return a.type === 'pointAndClick' && Array.isArray(a.params?.hotspots) ? a.params.hotspots : [];
}

/** Choice option sounds ("when chosen: play a sound"), which point at assets. */
export function choiceSounds(a: Action): Extract<ChoiceEffect, { kind: 'playSound' }>[] {
  if (a.type !== 'choice' || !Array.isArray(a.params?.options)) return [];
  return (a.params.options as ChoiceOption[]).flatMap((o) => (o.effects ?? []).filter((e): e is Extract<ChoiceEffect, { kind: 'playSound' }> => e.kind === 'playSound'));
}

/** Asset ids directly referenced by an action's params. */
export function directAssetRefs(a: Action): string[] {
  const out: string[] = [];
  for (const k of ASSET_PARAM_KEYS) {
    const v = a.params?.[k];
    if (typeof v === 'string' && v) out.push(v);
  }
  return out;
}

/** All asset ids a project needs at runtime (actions, character expressions in use, title screen). */
export function collectUsedAssetIds(p: Project, includeDisabled = false): Set<string> {
  const used = new Set<string>();
  const charMap = new Map(p.characters.map((c) => [c.id, c]));
  for (const s of p.scenes) {
    for (const a of s.actions) {
      if (a.disabled && !includeDisabled) continue;
      directAssetRefs(a).forEach((id) => used.add(id));
      for (const h of hotspotsOf(a)) if (h.assetId) used.add(h.assetId);
      for (const e of choiceSounds(a)) if (e.assetId) used.add(e.assetId);
      const cid = a.params?.characterId ?? a.params?.speaker;
      if (cid && charMap.has(cid)) {
        // The runtime may show any expression of a character on stage, so include them all.
        charMap.get(cid)!.expressions.forEach((e) => used.add(e.assetId));
      }
    }
  }
  if (p.settings.titleBackgroundAssetId) used.add(p.settings.titleBackgroundAssetId);
  if (p.settings.titleMusicAssetId) used.add(p.settings.titleMusicAssetId);
  if (p.settings.gameIconAssetId) used.add(p.settings.gameIconAssetId);
  for (const t of usedThemes(p)) themeAssetIds(t).forEach((id) => used.add(id));
  return used;
}

/** Themes the game uses: the project theme and scene overrides. */
export function usedThemes(p: Project): Theme[] {
  const ids = new Set([p.settings.themeId, ...p.scenes.map((s) => s.themeId).filter((x): x is string => !!x)]);
  return [...ids].filter((id) => themeExists(id, p.themes)).map((id) => applyStyles(JSON.parse(JSON.stringify(resolveTheme(id, p.themes))) as Theme, p.uiStyles));
}

export interface AssetUsage {
  where: 'action' | 'character' | 'settings' | 'theme';
  sceneId?: string;
  sceneName?: string;
  actionId?: string;
  characterId?: string;
  label: string;
}

export function findAssetUsages(p: Project, assetId: string): AssetUsage[] {
  const out: AssetUsage[] = [];
  for (const s of p.scenes) {
    s.actions.forEach((a, i) => {
      if (directAssetRefs(a).includes(assetId) || hotspotsOf(a).some((h) => h.assetId === assetId) || choiceSounds(a).some((e) => e.assetId === assetId)) {
        out.push({ where: 'action', sceneId: s.id, sceneName: s.name, actionId: a.id, label: `${s.name} › #${i + 1} ${isKnownActionType(a.type) ? t(getActionDef(a.type).label) : a.type}` });
      }
    });
  }
  for (const c of p.characters) {
    for (const e of c.expressions) {
      if (e.assetId === assetId) out.push({ where: 'character', characterId: c.id, label: `${t('Character')} ${c.name} › ${e.name}` });
    }
  }
  if (p.settings.titleBackgroundAssetId === assetId) out.push({ where: 'settings', label: t('Title screen background') });
  if (p.settings.titleMusicAssetId === assetId) out.push({ where: 'settings', label: t('Title screen music') });
  if (p.settings.gameIconAssetId === assetId) out.push({ where: 'settings', label: t('Game icon') });
  for (const th of p.themes) {
    if (themeAssetIds(th).includes(assetId)) out.push({ where: 'theme', label: t('Theme “{name}”', { name: th.name }) });
  }
  for (const st of p.uiStyles ?? []) {
    if (styleAssetIds(st).includes(assetId)) out.push({ where: 'theme', label: t('Style “{name}”', { name: st.name }) });
  }
  return out;
}

/** Point every reference of one asset at another (mutates; use inside an immer recipe). */
export function replaceAssetReferences(p: Project, fromId: string, toId: string): number {
  let n = 0;
  for (const s of p.scenes) {
    for (const a of s.actions) {
      for (const k of ASSET_PARAM_KEYS) {
        if (a.params?.[k] === fromId) {
          a.params[k] = toId;
          n++;
        }
      }
      for (const h of hotspotsOf(a)) {
        if (h.assetId === fromId) {
          h.assetId = toId;
          n++;
        }
      }
      for (const e of choiceSounds(a)) {
        if (e.assetId === fromId) {
          e.assetId = toId;
          n++;
        }
      }
    }
  }
  for (const c of p.characters) {
    for (const e of c.expressions) {
      if (e.assetId === fromId) {
        e.assetId = toId;
        n++;
      }
    }
  }
  if (p.settings.titleBackgroundAssetId === fromId) p.settings.titleBackgroundAssetId = toId;
  if (p.settings.titleMusicAssetId === fromId) p.settings.titleMusicAssetId = toId;
  if (p.settings.gameIconAssetId === fromId) p.settings.gameIconAssetId = toId;
  for (const th of p.themes) {
    mapThemeImages(th, (id) => (id === fromId ? (n++, toId) : id));
  }
  n += mapStyleImages(p.uiStyles, (id) => (id === fromId ? toId : id));
  return n;
}

/** Remove all references to an asset (mutates). Expressions using it are removed. */
export function removeAssetReferences(p: Project, assetId: string): number {
  let n = 0;
  for (const s of p.scenes) {
    for (const a of s.actions) {
      for (const k of ASSET_PARAM_KEYS) {
        if (a.params?.[k] === assetId) {
          a.params[k] = '';
          n++;
        }
      }
      for (const h of hotspotsOf(a)) {
        if (h.assetId === assetId) {
          h.assetId = undefined;
          n++;
        }
      }
      for (const e of choiceSounds(a)) {
        if (e.assetId === assetId) {
          e.assetId = '';
          n++;
        }
      }
    }
  }
  for (const c of p.characters) {
    const before = c.expressions.length;
    c.expressions = c.expressions.filter((e) => e.assetId !== assetId);
    n += before - c.expressions.length;
    if (c.defaultExpressionId && !c.expressions.some((e) => e.id === c.defaultExpressionId)) {
      c.defaultExpressionId = c.expressions[0]?.id;
    }
  }
  if (p.settings.titleBackgroundAssetId === assetId) p.settings.titleBackgroundAssetId = undefined;
  if (p.settings.titleMusicAssetId === assetId) p.settings.titleMusicAssetId = undefined;
  if (p.settings.gameIconAssetId === assetId) p.settings.gameIconAssetId = undefined;
  for (const th of p.themes) {
    mapThemeImages(th, (id) => (id === assetId ? (n++, null) : id));
  }
  n += mapStyleImages(p.uiStyles, (id) => (id === assetId ? null : id));
  return n;
}

const TYPE_NAME: Record<Variable['type'], string> = { number: 'Number', string: 'Text', boolean: 'True / False' };

/** A value that fits a variable type (what the editor's inputs produce, or text that clearly means it). */
export function valueFits(type: Variable['type'], value: unknown): boolean {
  if (type === 'boolean') return typeof value === 'boolean' || value === 'true' || value === 'false';
  if (type === 'number') return (typeof value === 'number' && Number.isFinite(value)) || (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)));
  return value !== undefined && value !== null && typeof value !== 'object';
}

/** Problems with a condition whose variable exists: wrong comparison or a value of the wrong type. */
export function conditionProblem(c: Condition, v: Variable): string | null {
  if (v.type === 'boolean' && c.op !== '==' && c.op !== '!=') return t('“{name}” is True / False — compare it with “equals” or “is not”.', { name: v.name });
  if (!valueFits(v.type, c.value)) return t('“{name}” is a {type} variable but is compared with “{value}”.', { name: v.name, type: t(TYPE_NAME[v.type]), value: String(c.value) });
  return null;
}

function labelExists(p: Project, label: string | undefined): boolean {
  if (!label) return false;
  return p.scenes.some((s) => s.actions.some((a) => a.type === 'label' && !a.disabled && a.params.name === label));
}

function checkTarget(p: Project, target: JumpTarget | undefined, push: (msg: string) => void, allowNext: boolean) {
  if (!target) return push(t('Jump target is missing.'));
  switch (target.kind) {
    case 'next':
      if (!allowNext) push(t('Jump target is not set.'));
      return;
    case 'scene':
      if (!target.sceneId || !p.scenes.some((s) => s.id === target.sceneId)) push(t('Jump target scene does not exist.'));
      return;
    case 'label':
      if (!labelExists(p, target.label)) push(t('Label “{name}” does not exist.', { name: target.label ?? '' }));
      return;
    case 'action':
      if (!target.actionId || !p.scenes.some((s) => s.actions.some((a) => a.id === target.actionId))) push(t('Jump target action does not exist.'));
      return;
  }
}

/**
 * Validate a project's integrity. `fileExists` (optional) checks asset files on disk
 * by project-relative path.
 */
export function validateProject(p: Project, fileExists?: (relPath: string) => boolean): Issue[] {
  const issues: Issue[] = [];
  const assetMap = new Map(p.assets.map((a) => [a.id, a]));
  const charMap = new Map(p.characters.map((c) => [c.id, c]));
  const varMap = new Map(p.variables.map((v) => [v.id, v]));
  const varNames = new Set(p.variables.map((v) => v.name));
  const sceneIds = new Set(p.scenes.map((s) => s.id));

  if (p.scenes.length === 0) issues.push({ severity: 'error', message: t('The project has no scenes.') });
  if (p.settings.startSceneId && !sceneIds.has(p.settings.startSceneId)) {
    issues.push({ severity: 'error', message: t('The start scene no longer exists. Choose a new start scene in Story Flow.') });
  }

  const fontFiles = new Set<string>();
  if (p.settings.dialogueFont?.file) fontFiles.add(p.settings.dialogueFont.file);
  for (const th of usedThemes(p)) themeFontRefs(th).forEach((f) => f.file && fontFiles.add(f.file));
  for (const file of fontFiles) {
    if (fileExists && !fileExists(file)) issues.push({ severity: 'error', message: t('Missing font file: {path}', { path: file }) });
  }
  if (!themeExists(p.settings.themeId, p.themes)) {
    issues.push({ severity: 'warning', message: t('The project theme no longer exists — the Modern theme is used.') });
  }
  for (const s of p.scenes) {
    if (s.themeId && !themeExists(s.themeId, p.themes)) {
      issues.push({ severity: 'warning', message: t('{scene}: its theme no longer exists — the project theme is used.', { scene: s.name }), sceneId: s.id });
    }
  }

  const used = collectUsedAssetIds(p);
  for (const id of used) {
    const asset = assetMap.get(id);
    if (!asset) {
      issues.push({ severity: 'error', message: t('A referenced asset is missing from the project (id {id}).', { id }), assetId: id });
    } else if (fileExists && !fileExists(asset.path)) {
      issues.push({ severity: 'error', message: t('Missing asset file: {path}', { path: asset.path }), assetId: id });
    }
  }

  for (const s of p.scenes) {
    for (const a of s.actions) {
      if (a.disabled) continue;
      const push = (message: string, severity: Issue['severity'] = 'error') => issues.push({ severity, message: `${s.name}: ${message}`, sceneId: s.id, actionId: a.id });
      if (!isKnownActionType(a.type)) {
        push(t('Unknown action type “{type}”.', { type: a.type }));
        continue;
      }
      const def = getActionDef(a.type);
      const label = t(def.label);
      const pr = a.params ?? {};
      for (const f of def.fields) {
        if (def.visibleWhen?.[f.key] && !def.visibleWhen[f.key](pr)) continue;
        const v = pr[f.key];
        if (f.kind === 'asset' && v && !assetMap.has(v)) push(t('{action}: the asset “{field}” was removed.', { action: label, field: t(f.label) }));
        if (f.kind === 'character' && v && !charMap.has(v)) push(t('{action}: character no longer exists.', { action: label }));
        if (f.kind === 'expression' && v) {
          const c = charMap.get(pr[f.characterKey]);
          if (c && !c.expressions.some((e) => e.id === v)) push(t('{action}: expression no longer exists.', { action: label }));
        }
        if (f.kind === 'scene' && (!v || !sceneIds.has(v))) push(t('{action}: choose a scene.', { action: label }));
        if (f.kind === 'variable' && (!v || !varMap.has(v))) push(t('{action}: choose a variable.', { action: label }));
        if (f.kind === 'target') checkTarget(p, v, (m) => push(`${label}: ${m}`), !!f.allowNext);
      }
      if (['addCharacter', 'moveCharacter', 'changeExpression', 'animateCharacter'].includes(a.type) && !pr.characterId) {
        push(t('{action}: choose a character.', { action: label }));
      }
      if (a.type === 'changeBackground' && !pr.assetId && !pr.color) push(t('Change Background: choose an image or color.'));
      if (['showCG', 'playBGM', 'changeBGM', 'playSFX', 'playVoice', 'playVideo'].includes(a.type) && !pr.assetId) {
        push(t('{action}: choose an asset.', { action: label }), 'warning');
      }
      if (a.type === 'choice') {
        const opts = (pr.options ?? []) as any[];
        if (opts.length === 0) push(t('Choice has no options.'));
        opts.forEach((o, i) => {
          if (!String(o.text ?? '').trim()) push(t('Choice option {n} has no text.', { n: i + 1 }), 'warning');
          checkTarget(p, o.target, (m) => push(`${t('Choice option {n}', { n: i + 1 })}: ${m}`), true);
          if (o.condition && !varMap.has(o.condition.variableId)) push(t('Choice option {n}: condition variable is missing.', { n: i + 1 }));
          const cp = o.condition && varMap.has(o.condition.variableId) ? conditionProblem(o.condition, varMap.get(o.condition.variableId)!) : null;
          if (cp) push(`${t('Choice option {n}', { n: i + 1 })}: ${cp}`);
          const opt = t('Choice option {n}', { n: i + 1 });
          for (const e of (o.effects ?? []) as ChoiceEffect[]) {
            if (e.kind === 'setVariable' || e.kind === 'addVariable') {
              const v = varMap.get(e.variableId);
              if (!v) push(`${opt}: ${t('the variable to change is missing.')}`);
              else if (e.kind === 'addVariable' && v.type !== 'number') push(`${opt}: ${t('only Number variables can be added to (“{var}” is a {type} variable).', { var: v.name, type: t(TYPE_NAME[v.type]) })}`);
              else if (e.kind === 'setVariable' && !valueFits(v.type, e.value))
                push(`${opt}: ${t('“{var}” is a {type} variable but would be set to “{value}”.', { var: v.name, type: t(TYPE_NAME[v.type]), value: String(e.value ?? '') })}`);
            } else if (e.kind === 'playSound') {
              if (!e.assetId) push(`${opt}: ${t('choose a sound to play.')}`, 'warning');
              else if (!assetMap.has(e.assetId)) push(`${opt}: ${t('the sound file is missing.')}`);
            } else if (e.kind === 'animateCharacter') {
              if (!e.characterId || !charMap.has(e.characterId)) push(`${opt}: ${t('choose a character to animate.')}`, 'warning');
            }
          }
        });
      }
      if (a.type === 'pointAndClick') {
        const hs = hotspotsOf(a);
        if (hs.length === 0) push(t('Point & Click has no clickable objects.'));
        hs.forEach((h, i) => {
          const name = h.label?.trim() || t('Object {n}', { n: i + 1 });
          if (!h.label?.trim()) push(t('Point & Click object {n} has no name.', { n: i + 1 }), 'warning');
          if (!(h.w > 0 && h.h > 0)) push(t('{name}: the clickable area has no size.', { name }));
          checkTarget(p, h.target, (m) => push(`${name}: ${m}`), true);
          if (h.condition && !varMap.has(h.condition.variableId)) push(t('{name}: condition variable is missing.', { name }));
          if (h.variableId && !varMap.has(h.variableId)) push(t('{name}: the variable to set is missing.', { name }));
          const hc = h.condition && varMap.has(h.condition.variableId) ? conditionProblem(h.condition, varMap.get(h.condition.variableId)!) : null;
          if (hc) push(`${name}: ${hc}`);
          const hv = h.variableId ? varMap.get(h.variableId) : undefined;
          if (hv && !valueFits(hv.type, h.value)) push(t('{name}: “{var}” is a {type} variable but would be set to “{value}”.', { name, var: hv.name, type: t(TYPE_NAME[hv.type]), value: String(h.value ?? '') }));
          if (h.assetId && !assetMap.has(h.assetId)) push(t('{name}: the image was removed.', { name }));
        });
      }
      if (a.type === 'conditional') {
        for (const c of (pr.conditions ?? []) as any[]) {
          if (!varMap.has(c.variableId)) push(t('Conditional Branch: a condition uses a missing variable.'));
          else {
            const cp = conditionProblem(c, varMap.get(c.variableId)!);
            if (cp) push(`${label}: ${cp}`);
          }
        }
      }
      if ((a.type === 'dialogue' || a.type === 'narration') && !String(pr.text ?? '').trim()) push(t('{action} has no text.', { action: label }), 'warning');
      // Variable actions: the value must fit the variable's type.
      const tv = typeof pr.variableId === 'string' ? varMap.get(pr.variableId) : undefined;
      if (tv) {
        if (a.type === 'checkVariable') {
          const cp = conditionProblem({ variableId: tv.id, op: pr.op ?? '==', value: pr.value }, tv);
          if (cp) push(`${label}: ${cp}`);
        }
        if (a.type === 'setVariable' && !valueFits(tv.type, pr.value)) {
          push(t('{action}: “{var}” is a {type} variable but would be set to “{value}”.', { action: label, var: tv.name, type: t(TYPE_NAME[tv.type]), value: String(pr.value ?? '') }));
        }
        if ((a.type === 'addVariable' || a.type === 'subtractVariable') && tv.type !== 'number') {
          push(t('{action}: “{var}” is a {type} variable — only Number variables can be added to or subtracted from.', { action: label, var: tv.name, type: t(TYPE_NAME[tv.type]) }));
        }
      }
      // {Name} in text must name a variable (otherwise players see the braces).
      for (const key of ['text', 'question', 'prompt', 'message'] as const) {
        const txt = pr[key];
        if (typeof txt !== 'string') continue;
        for (const m of txt.matchAll(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g)) {
          if (!varNames.has(m[1])) push(t('{action}: “{{0}}” in the text is not a variable name.', { action: label, 0: m[1] }), 'warning');
        }
      }
    }
  }
  return issues;
}
