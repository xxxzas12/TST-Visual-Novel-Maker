// Core TSTVN project data model.
// The Editor edits a Project; the Runtime plays GameData built from a Project.

export type AssetType =
  | 'background'
  | 'character'
  | 'portrait'
  | 'cg'
  | 'ui'
  | 'music'
  | 'voice'
  | 'sfx'
  | 'video'
  | 'unknown';

export type MediaKind = 'image' | 'audio' | 'video';

export interface Asset {
  id: string;
  /** Path relative to the project root, always using forward slashes, e.g. "assets/Characters/Alice/happy.png". */
  path: string;
  name: string;
  ext: string;
  kind: MediaKind;
  type: AssetType;
  size: number;
  hash: string;
  width?: number;
  height?: number;
  tags: string[];
  hasThumb: boolean;
  /** Bumped whenever the file content is replaced (cache busting). */
  rev: number;
  importedAt: number;
}

export interface Expression {
  id: string;
  name: string;
  assetId: string;
}

export interface Character {
  id: string;
  name: string;
  displayName: string;
  color: string;
  expressions: Expression[];
  defaultExpressionId?: string;
  /** Asset folder this character was generated from, if any. */
  sourceFolder?: string;
}

export type JumpTargetKind = 'next' | 'scene' | 'label' | 'action';

export interface JumpTarget {
  kind: JumpTargetKind;
  sceneId?: string;
  label?: string;
  actionId?: string;
}

export type CompareOp = '==' | '!=' | '>' | '>=' | '<' | '<=';

export interface Condition {
  variableId: string;
  op: CompareOp;
  value: string | number | boolean;
}

export interface ChoiceOption {
  id: string;
  text: string;
  target: JumpTarget;
  /** Optional: only show this option when the condition holds. */
  condition?: Condition | null;
  /** When the condition fails: show the option disabled instead of hiding it. */
  showLocked?: boolean;
}

/** A clickable area of a Point & Click action (position and size in % of the stage). */
export interface Hotspot {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Optional image drawn in the area (an object to click, e.g. a key). */
  assetId?: string;
  target: JumpTarget;
  /** Only clickable (and visible) while the condition holds. */
  condition?: Condition | null;
  /** Optional: set a variable when clicked (e.g. has_key = true). */
  variableId?: string;
  value?: string | number | boolean;
}

export interface TextStyle {
  bold?: boolean;
  italic?: boolean;
  color?: string;
  size?: number;
  align?: 'left' | 'center' | 'right';
}

export interface CustomAnimation {
  from: AnimFrame;
  to: AnimFrame;
}

export interface AnimFrame {
  x?: number;
  y?: number;
  scale?: number;
  rotate?: number;
  opacity?: number;
}

export type ActionType =
  // story
  | 'dialogue'
  | 'narration'
  | 'choice'
  | 'pointAndClick'
  | 'jumpScene'
  | 'endGame'
  // visual
  | 'changeBackground'
  | 'showCG'
  | 'hideCG'
  | 'showImage'
  | 'hideImage'
  | 'screenEffect'
  | 'playVideo'
  // character
  | 'addCharacter'
  | 'removeCharacter'
  | 'moveCharacter'
  | 'changeExpression'
  | 'animateCharacter'
  // audio
  | 'playBGM'
  | 'stopBGM'
  | 'changeBGM'
  | 'playSFX'
  | 'stopSFX'
  | 'playVoice'
  // flow
  | 'wait'
  | 'delay'
  | 'label'
  | 'jump'
  | 'conditional'
  // variable
  | 'setVariable'
  | 'addVariable'
  | 'subtractVariable'
  | 'checkVariable'
  // game
  | 'saveGame'
  | 'loadGame'
  | 'changeScene'
  | 'returnToTitle';

/**
 * Actions use a flat params bag so that the editor can render properties
 * generically from the action definitions in shared/actions.ts.
 */
export interface Action {
  id: string;
  type: ActionType;
  disabled?: boolean;
  note?: string;
  params: Record<string, any>;
}

export interface Scene {
  id: string;
  name: string;
  tags: string[];
  actions: Action[];
  flowPos?: { x: number; y: number };
  /** Theme override for this scene (null/undefined = project theme). */
  themeId?: string | null;
}

export interface Chapter {
  id: string;
  name: string;
  sceneIds: string[];
  collapsed?: boolean;
}

export type VariableType = 'number' | 'string' | 'boolean';

export interface Variable {
  id: string;
  name: string;
  type: VariableType;
  initial: number | string | boolean;
  description?: string;
}

// ---------- Game UI theme ----------
// Sizes are "design pixels" on a 1920×1080 UI canvas (1080×1920 in portrait); the runtime
// scales them to the player's screen. Lengths can also be % of the safe area or viewport units.

export type UiUnit = 'px' | '%' | 'vw' | 'vh';

export interface UiLength {
  value: number;
  unit: UiUnit;
}

export type UiAnchor = 'top-left' | 'top' | 'top-right' | 'left' | 'center' | 'right' | 'bottom-left' | 'bottom' | 'bottom-right';

/** A font family; `file` = font embedded in the project (fonts/…), otherwise a system font. */
export interface FontRef {
  family: string;
  file?: string;
}

export interface UiShadow {
  /** Blur size in design px (0 = no shadow). */
  size: number;
  /** Vertical offset in design px. */
  y: number;
  color: string;
  opacity: number;
}

/** Background + border of a UI element. */
export interface UiSurface {
  background: string;
  /** Background image (asset id), drawn over the color. */
  image: string | null;
  imageFit: 'stretch' | 'cover' | 'contain' | 'tile';
  /** Opacity of the background (color and image), 0–1. Text stays fully opaque. */
  opacity: number;
  borderColor: string;
  borderWidth: number;
  radius: number;
  shadow: UiShadow;
  /** Blur of the scene behind the element (frosted glass), design px. */
  blur: number;
}

export interface UiText {
  /** null = the theme's font. */
  font: FontRef | null;
  size: number;
  color: string;
  lineHeight: number;
  letterSpacing: number;
  align: 'left' | 'center' | 'right';
  bold: boolean;
  /** Soft outline/shadow behind letters for readability on busy backgrounds. */
  shadow: boolean;
}

export interface UiPadding {
  x: number;
  y: number;
}

export interface ThemeDialogBox {
  anchor: UiAnchor;
  x: UiLength;
  y: UiLength;
  width: UiLength;
  /** Minimum height; the box grows with long text (and scrolls before it would leave the screen). */
  height: UiLength;
  padding: UiPadding;
  surface: UiSurface;
  text: UiText;
  /** Characters per second; null = project default. */
  textSpeed: number | null;
}

export interface ThemeNameBox {
  enabled: boolean;
  /** inside = top of the dialogue box, outside = sitting on the box's top edge. */
  attach: 'inside' | 'outside';
  align: 'left' | 'center' | 'right';
  /** Offset in design px. */
  x: number;
  y: number;
  /** Minimum size in design px (0 = fit the name). */
  width: number;
  height: number;
  padding: UiPadding;
  surface: UiSurface;
  text: UiText;
  /** Underline the name in the speaking character's color. */
  speakerColor: boolean;
}

export interface ChoiceStateStyle {
  background: string;
  color: string;
  borderColor: string;
  opacity: number;
}

export type ChoiceState = 'normal' | 'hover' | 'pressed' | 'disabled';

export interface ThemeChoices {
  /** Where the group of buttons sits (inside the space not covered by the dialogue box). */
  anchor: UiAnchor;
  x: UiLength;
  y: UiLength;
  /** Button width. */
  width: UiLength;
  minWidth: number;
  /** Minimum button height (design px). */
  height: number;
  padding: UiPadding;
  /** Space between buttons. */
  spacing: number;
  surface: UiSurface;
  text: UiText;
  states: Record<ChoiceState, ChoiceStateStyle>;
  hoverAnimation: 'none' | 'grow' | 'lift' | 'glow' | 'slide';
  pressAnimation: 'none' | 'shrink' | 'sink';
  /** Seconds. */
  animationSpeed: number;
}

export type MenuAction = 'auto' | 'skip' | 'save' | 'load' | 'settings' | 'hide' | 'menu';

export interface MenuButtonDef {
  id: string;
  action: MenuAction;
  /** '' = default label in the game's language. */
  label: string;
  hideOnMobile: boolean;
}

export interface ThemeMenuBar {
  enabled: boolean;
  anchor: UiAnchor;
  x: UiLength;
  y: UiLength;
  direction: 'row' | 'column';
  spacing: number;
  height: number;
  minWidth: number;
  padding: UiPadding;
  surface: UiSurface;
  text: UiText;
  hover: { background: string; color: string };
  buttons: MenuButtonDef[];
}

export interface ThemeAccessibility {
  /** Text is never rendered smaller than this (CSS px), whatever the screen size. */
  minFontSize: number;
  /** Buttons are never smaller than this (CSS px) — 44 is the usual touch guideline. */
  minTouchTarget: number;
  /** Start with high-contrast UI (players can also toggle it in Settings). */
  highContrast: boolean;
}

export interface Theme {
  id: string;
  name: string;
  preset?: string;
  version: 2;
  /** Fallback font stack (CSS). */
  font: string;
  /** Main game font chosen by the user (overrides `font`). */
  fontFace: FontRef | null;
  dialog: ThemeDialogBox;
  nameBox: ThemeNameBox;
  choice: ThemeChoices;
  menuBar: ThemeMenuBar;
  /** Title screen, pause menu, save/load and settings screens. */
  menu: {
    background: string;
    color: string;
    accent: string;
    opacity: number;
  };
  /** How the dialogue box appears. */
  animation: 'fade' | 'slide' | 'none';
  accessibility: ThemeAccessibility;
}

export interface ActionTemplate {
  id: string;
  name: string;
  actions: Action[];
}

export interface AssetCollection {
  id: string;
  name: string;
  assetIds: string[];
}

export interface ProjectSettings {
  title: string;
  author: string;
  resolution: { width: number; height: number };
  startSceneId?: string;
  textSpeed: number;
  themeId: string;
  titleBackgroundAssetId?: string;
  titleMusicAssetId?: string;
  /** Game icon (image asset): window/taskbar icon of the exported Windows game and Web favicon. Not the TSTVN logo. */
  gameIconAssetId?: string;
  /** In-game Gallery (Extras on the title screen). */
  gallery?: ProjectGallery;
  displayMode: 'windowed' | 'fullscreen' | 'borderless';
  /** Language of the game's own menus (Start, Save, Load…). */
  language: 'en' | 'th';
  /** Font for dialogue and game UI; null = use the theme's font. `file` = embedded project font (fonts/…). */
  dialogueFont?: { family: string; file?: string } | null;
  /** Dialogue font size in design px (1920×1080 UI canvas); null = theme size. */
  dialogueFontSize?: number | null;
  /** 2 = game UI theme format with design-pixel sizes (older projects are migrated on load). */
  uiVersion?: number;
}

/**
 * When a gallery item unlocks. A union so more rules (e.g. a variable condition) can be added later
 * without changing existing data.
 */
export type GalleryUnlock = { mode: 'seen' } | { mode: 'always' };

export interface ProjectGallery {
  enabled: boolean;
  sections: { cg: boolean; characters: boolean; music: boolean; endings: boolean };
  /** Per item key (cg:<assetId>, char:<id>, music:<assetId>, ending:<actionId>); default "seen". */
  unlock: Record<string, GalleryUnlock>;
}

export interface GameGallery {
  sections: ('cg' | 'characters' | 'music' | 'endings')[];
  items: { key: string; section: 'cg' | 'characters' | 'music' | 'endings'; label: string; assetId?: string; characterId?: string; sceneName?: string }[];
  /** Keys unlocked from the start. */
  alwaysUnlocked: string[];
}

export interface Project {
  format: 'tstvn-project';
  version: 1;
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  template?: string;
  settings: ProjectSettings;
  assets: Asset[];
  characters: Character[];
  chapters: Chapter[];
  scenes: Scene[];
  variables: Variable[];
  themes: Theme[];
  actionTemplates: ActionTemplate[];
  collections: AssetCollection[];
}

// ---------- Runtime game data ----------

export interface GameAsset {
  path: string;
  type: AssetType;
  kind: MediaKind;
  width?: number;
  height?: number;
}

export interface GameScene {
  id: string;
  name: string;
  actions: Action[];
  /** Key into GameData.themes when the scene overrides the project theme. */
  themeId?: string;
}

export interface GameData {
  format: 'tstvn-game';
  version: 1;
  id: string;
  title: string;
  author: string;
  resolution: { width: number; height: number };
  startSceneId: string | null;
  sceneOrder: string[];
  scenes: GameScene[];
  characters: Character[];
  variables: Variable[];
  /** Project theme. */
  theme: Theme;
  /** Scene override themes, by id. */
  themes?: Record<string, Theme>;
  assets: Record<string, GameAsset>;
  textSpeed: number;
  titleBackgroundAssetId?: string;
  titleMusicAssetId?: string;
  /** Project game icon (window/taskbar of the Windows game, browser tab of the Web game). */
  iconAssetId?: string;
  /** In-game gallery; absent when the project has none. */
  gallery?: GameGallery;
  displayMode: 'windowed' | 'fullscreen' | 'borderless';
  language?: 'en' | 'th';
  /** Embedded font files to load with @font-face (project-relative paths). */
  fonts?: { family: string; path: string }[];
}
