import type { AssetType, MediaKind } from './types';

export const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif', 'svg'];
export const AUDIO_EXT = ['mp3', 'ogg', 'wav', 'm4a', 'aac', 'flac', 'opus', 'weba'];
export const VIDEO_EXT = ['mp4', 'webm', 'ogv', 'm4v', 'mov'];

export function extOf(path: string): string {
  const base = path.split(/[\\/]/).pop() ?? '';
  const i = base.lastIndexOf('.');
  return i > 0 ? base.slice(i + 1).toLowerCase() : '';
}

export function mediaKindOf(ext: string): MediaKind | null {
  const e = ext.toLowerCase();
  if (IMAGE_EXT.includes(e)) return 'image';
  if (AUDIO_EXT.includes(e)) return 'audio';
  if (VIDEO_EXT.includes(e)) return 'video';
  return null;
}

export const ASSET_TYPES: { value: AssetType; label: string; kind: MediaKind | 'any' }[] = [
  { value: 'background', label: 'Background', kind: 'image' },
  { value: 'character', label: 'Character', kind: 'image' },
  { value: 'portrait', label: 'Portrait', kind: 'image' },
  { value: 'cg', label: 'CG', kind: 'image' },
  { value: 'ui', label: 'UI', kind: 'image' },
  { value: 'music', label: 'Music', kind: 'audio' },
  { value: 'voice', label: 'Voice', kind: 'audio' },
  { value: 'sfx', label: 'SFX', kind: 'audio' },
  { value: 'video', label: 'Video', kind: 'video' },
  { value: 'unknown', label: 'Unknown', kind: 'any' },
];

/** Which asset types make sense for a media kind. */
export function typesForKind(kind: MediaKind): AssetType[] {
  return ASSET_TYPES.filter((t) => t.kind === kind || t.kind === 'any').map((t) => t.value);
}

// Keywords are matched against whole folder names and filename tokens.
const RULES: { type: AssetType; kinds: MediaKind[]; words: string[] }[] = [
  { type: 'background', kinds: ['image'], words: ['bg', 'bgs', 'background', 'backgrounds', 'backdrop', 'backdrops', 'location', 'locations', 'scenery', 'ฉาก', 'พื้นหลัง'] },
  { type: 'character', kinds: ['image'], words: ['char', 'chars', 'chara', 'character', 'characters', 'sprite', 'sprites', 'standing', 'tachie', 'ตัวละคร'] },
  { type: 'portrait', kinds: ['image'], words: ['portrait', 'portraits', 'face', 'faces', 'avatar', 'avatars', 'side'] },
  { type: 'cg', kinds: ['image'], words: ['cg', 'cgs', 'event', 'events', 'illustration', 'illustrations', 'ev'] },
  { type: 'ui', kinds: ['image'], words: ['ui', 'gui', 'button', 'buttons', 'icon', 'icons', 'interface', 'frame', 'frames', 'hud'] },
  { type: 'music', kinds: ['audio'], words: ['bgm', 'music', 'musics', 'song', 'songs', 'theme', 'themes', 'ost', 'เพลง'] },
  { type: 'voice', kinds: ['audio'], words: ['voice', 'voices', 'vo', 'vox', 'speech', 'เสียงพากย์'] },
  { type: 'sfx', kinds: ['audio'], words: ['sfx', 'se', 'sound', 'sounds', 'effect', 'effects', 'fx', 'เอฟเฟกต์'] },
  { type: 'video', kinds: ['video'], words: ['video', 'videos', 'movie', 'movies', 'cutscene', 'cutscenes', 'opening', 'op', 'ed'] },
];

function tokensOf(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .split(/[\s_\-.()[\]]+/)
    .filter(Boolean);
}

export interface Classification {
  type: AssetType;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

/**
 * Detect the asset type from folder names, file name, extension and image size.
 * relPath is the path inside the imported folder (forward or back slashes).
 */
export function classifyAsset(relPath: string, kind: MediaKind, dims?: { width?: number; height?: number }): Classification {
  const parts = relPath.split(/[\\/]/).filter(Boolean);
  const file = parts.pop() ?? '';
  const folders = parts.map((p) => p.toLowerCase());

  // 1. Folder names, closest folder first.
  for (let i = folders.length - 1; i >= 0; i--) {
    const folderTokens = [folders[i], ...tokensOf(folders[i])];
    for (const rule of RULES) {
      if (!rule.kinds.includes(kind)) continue;
      if (rule.words.some((w) => folderTokens.includes(w))) {
        return { type: rule.type, confidence: 'high', reason: `folder “${parts[i]}”` };
      }
    }
  }

  // 2. File name tokens (e.g. "bg_school.png", "bgm-title.ogg").
  const fileTokens = tokensOf(file);
  for (const rule of RULES) {
    if (!rule.kinds.includes(kind)) continue;
    if (rule.words.some((w) => fileTokens.includes(w))) {
      return { type: rule.type, confidence: 'medium', reason: `file name “${file}”` };
    }
  }

  // 3. Extension / media kind.
  if (kind === 'video') return { type: 'video', confidence: 'high', reason: 'video file' };

  // 4. Image dimensions: wide, large images are most likely backgrounds.
  if (kind === 'image' && dims?.width && dims?.height) {
    const ratio = dims.width / dims.height;
    if (dims.width >= 1000 && ratio >= 1.3 && ratio <= 2.4) {
      return { type: 'background', confidence: 'low', reason: `wide image ${dims.width}×${dims.height}` };
    }
    if (dims.height >= 600 && ratio <= 0.8) {
      return { type: 'character', confidence: 'low', reason: `tall image ${dims.width}×${dims.height}` };
    }
  }

  return { type: 'unknown', confidence: 'low', reason: 'no hint found' };
}
