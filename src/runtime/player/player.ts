import type { GameData } from '../../shared/types';
import { themeToCssVars } from '../../shared/themes';
import { charBoxStyle, fitStage, imageBoxStyle } from '../../shared/stage';
import { Engine, type AnimateCommand, type AudioCommand, type ChoiceView, type DialogueView, type RuntimeHost } from '../core/engine';
import type { ChangeHint, CharState, ImageState, VisualState } from '../core/state';
import { AudioManager } from './audio';
import { emphasisFrames, enterFrames, exitFrames, play, transitionInFrames, transitionOutFrames } from './animate';
import { applyStyle, h, sleep } from './dom';
import { AUTO_SLOT, SaveStorage, type PlayerSettings, type SlotData } from './storage';
import { makeTranslator, type Translate } from './strings';

/** Optional native capabilities provided by the desktop shell (exported Windows game). */
export interface HostBridge {
  quit?: () => void;
  setDisplayMode?: (mode: 'windowed' | 'fullscreen' | 'borderless') => void;
  supportsBorderless?: boolean;
}

export interface PlayerOptions {
  /** Converts a project-relative asset path into a URL. */
  resolvePath: (path: string) => string;
  storageNamespace?: string;
  host?: HostBridge;
  /** Load images with CORS so save screenshots work when assets come from another origin (editor preview). */
  corsImages?: boolean;
  /** Editor preview: start at a scene/action and skip the title screen. */
  preview?: { sceneId?: string | null; index?: number; skipTitle?: boolean };
  onEvent?: (type: string, detail?: unknown) => void;
}

type Screen = 'title' | 'game' | 'end' | 'error';
type MenuView = 'pause' | 'save' | 'load' | 'settings' | null;

export class Player implements RuntimeHost {
  readonly game: GameData;
  readonly engine: Engine;
  private readonly opts: PlayerOptions;
  private readonly container: HTMLElement;
  private readonly storage: SaveStorage;
  private readonly sound: AudioManager;
  settings: PlayerSettings;
  private readonly tr: Translate;

  private root!: HTMLDivElement;
  private sceneEl!: HTMLDivElement;
  private bgLayer!: HTMLDivElement;
  private stage!: HTMLDivElement;
  private cgLayer!: HTMLDivElement;
  private fx!: HTMLDivElement;
  private ui!: HTMLDivElement;
  private dialog!: HTMLDivElement;
  private nameEl!: HTMLDivElement;
  private textEl!: HTMLDivElement;
  private indicator!: HTMLDivElement;
  private choicesEl!: HTMLDivElement;
  private quick!: HTMLDivElement;
  private overlay!: HTMLDivElement;
  private screenEl!: HTMLDivElement;
  private toastEl!: HTMLDivElement;

  private charEls = new Map<string, HTMLDivElement>();
  private imageEls = new Map<string, HTMLDivElement>();
  private bgKey = '';
  private cgKey = '';
  private bgmKey = '';

  private screen: Screen = 'title';
  private menu: MenuView = null;
  private menuResolver: (() => void) | null = null;
  private advanceResolver: (() => void) | null = null;
  private finishTyping: (() => void) | null = null;
  private choiceActive = false;
  private uiHidden = false;
  private autoMode = false;
  private skipMode = false;
  private blackout = false;
  private idleTimer: number | undefined;
  private skipTimer: number | undefined;
  private resizeObserver: ResizeObserver | null = null;
  private disposers: (() => void)[] = [];

  constructor(container: HTMLElement, game: GameData, opts: PlayerOptions) {
    this.container = container;
    this.game = game;
    this.opts = opts;
    this.tr = makeTranslator(game.language);
    this.storage = new SaveStorage(game.id, opts.storageNamespace ?? 'tstvn');
    this.settings = this.storage.getSettings(game.displayMode === 'borderless' && !opts.host?.supportsBorderless ? 'windowed' : game.displayMode);
    this.sound = new AudioManager(this.settings.volumes);
    this.engine = new Engine(game, this);
    this.mount();
  }

  // ---------------------------------------------------------------- setup

  private mount() {
    this.root = h('div', { class: 'tvn-root', tabindex: 0, 'data-testid': 'tvn-root' });
    applyStyle(this.root, themeToCssVars(this.game.theme));
    // Fonts shipped with the game (no installation needed on the player's device).
    for (const f of this.game.fonts ?? []) {
      const css = `@font-face{font-family:${JSON.stringify(f.family)};src:url(${JSON.stringify(this.opts.resolvePath(f.path))});font-display:swap}`;
      this.root.append(h('style', {}, css));
    }
    this.root.dataset.dialogPos = this.game.theme.dialog.position;
    this.root.dataset.anim = this.game.theme.animation;

    this.bgLayer = h('div', { class: 'tvn-bg-layer' });
    this.stage = h('div', { class: 'tvn-stage' });
    this.cgLayer = h('div', { class: 'tvn-cg-layer' });
    this.sceneEl = h('div', { class: 'tvn-scene' }, this.bgLayer, this.stage, this.cgLayer);
    this.fx = h('div', { class: 'tvn-fx' });

    this.nameEl = h('div', { class: 'tvn-name', 'data-testid': 'tvn-name' });
    this.textEl = h('div', { class: 'tvn-text', 'data-testid': 'tvn-text' });
    this.indicator = h('div', { class: 'tvn-indicator', 'aria-hidden': 'true' }, '▼');
    this.dialog = h('div', { class: 'tvn-dialog tvn-hidden', 'data-testid': 'tvn-dialog', role: 'log', 'aria-live': 'polite' }, this.nameEl, this.textEl, this.indicator);
    this.choicesEl = h('div', { class: 'tvn-choices tvn-hidden', role: 'menu', 'data-testid': 'tvn-choices' });

    const qb = (label: string, title: string, fn: () => void, testid: string) =>
      h('button', { class: 'tvn-qbtn', title, 'aria-label': title, 'data-testid': testid, onclick: (e: Event) => { e.stopPropagation(); fn(); } }, label);
    this.quick = h(
      'div',
      { class: 'tvn-quick tvn-hidden' },
      qb(this.tr('Auto'), this.tr('Auto-advance (A)'), () => this.toggleAuto(), 'tvn-q-auto'),
      qb(this.tr('Save'), this.tr('Save (S)'), () => void this.openMenu('save'), 'tvn-q-save'),
      qb(this.tr('Load'), this.tr('Load (L)'), () => void this.openMenu('load'), 'tvn-q-load'),
      qb(this.tr('Hide'), this.tr('Hide UI (H / right-click)'), () => this.setUiHidden(true), 'tvn-q-hide'),
      qb('☰', this.tr('Menu (Esc)'), () => void this.openMenu('pause'), 'tvn-q-menu'),
    );
    this.ui = h('div', { class: 'tvn-ui' }, this.dialog, this.choicesEl, this.quick);
    this.overlay = h('div', { class: 'tvn-overlay tvn-hidden' });
    this.screenEl = h('div', { class: 'tvn-screen tvn-hidden' });
    this.toastEl = h('div', { class: 'tvn-toast tvn-hidden', role: 'status' });

    this.root.append(this.sceneEl, this.fx, this.ui, this.screenEl, this.overlay, this.toastEl);
    this.container.append(this.root);

    const onPointer = (e: PointerEvent) => this.onPointerUp(e);
    const onContext = (e: MouseEvent) => {
      e.preventDefault();
      if (this.screen === 'game' && !this.menu) this.setUiHidden(!this.uiHidden);
    };
    const onKeyDown = (e: KeyboardEvent) => this.onKeyDown(e);
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control') {
        window.clearTimeout(this.skipTimer);
        this.skipMode = false;
      }
    };
    const onMove = () => this.bumpIdle();
    this.root.addEventListener('pointerup', onPointer);
    this.root.addEventListener('contextmenu', onContext);
    this.root.addEventListener('pointermove', onMove);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    this.disposers.push(() => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    });

    this.resizeObserver = new ResizeObserver(() => this.layout());
    this.resizeObserver.observe(this.root);
    this.layout();
    this.applyIdleClass();
  }

  /** Fit the stage to the window and scale UI text for small screens. */
  private layout() {
    const w = this.root.clientWidth || window.innerWidth;
    const hgt = this.root.clientHeight || window.innerHeight;
    const fit = fitStage(w, hgt, this.game.resolution);
    applyStyle(this.stage, { width: `${fit.width}px`, height: `${fit.height}px`, left: `${fit.left}px`, top: `${fit.top}px` });
    const scale = Math.max(0.55, Math.min(1.5, Math.min(w / 1280, hgt / 720)));
    this.root.style.setProperty('--tvn-ui-scale', String(scale));
    this.root.dataset.orientation = hgt > w ? 'portrait' : 'landscape';
    this.root.dataset.compact = Math.min(w, hgt) < 520 ? 'true' : 'false';
  }

  async boot() {
    this.root.focus({ preventScroll: true });
    const pv = this.opts.preview;
    if (pv?.skipTitle) await this.startGame(pv.sceneId ?? null, pv.index ?? 0);
    else this.showTitle();
  }

  destroy() {
    this.engine.stop();
    this.sound.stopAll();
    this.resizeObserver?.disconnect();
    this.disposers.forEach((d) => d());
    window.clearTimeout(this.idleTimer);
    window.clearTimeout(this.skipTimer);
    this.root.remove();
  }

  private emit(type: string, detail?: unknown) {
    this.opts.onEvent?.(type, detail);
  }

  private assetUrl(id: string | undefined): string | null {
    if (!id) return null;
    const a = this.game.assets[id];
    if (!a) {
      console.warn(`[TSTVN] Missing asset ${id}`);
      return null;
    }
    return this.opts.resolvePath(a.path);
  }

  // ---------------------------------------------------------------- input

  private isUiTarget(e: Event): boolean {
    const t = e.target as HTMLElement | null;
    return !!t?.closest('button, input, select, label, .tvn-overlay, .tvn-screen, .tvn-choices, .tvn-quick');
  }

  private onPointerUp(e: PointerEvent) {
    this.bumpIdle();
    if (e.button !== 0) return;
    if (this.isUiTarget(e)) return;
    if (this.screen !== 'game' || this.menu) return;
    if (this.uiHidden) {
      this.setUiHidden(false);
      return;
    }
    this.advance();
  }

  private onKeyDown(e: KeyboardEvent) {
    this.bumpIdle();
    const inField = (e.target as HTMLElement | null)?.closest('input, select, textarea');
    if (e.key === 'F11' || (e.key === 'Enter' && e.altKey)) {
      e.preventDefault();
      void this.setDisplayMode(this.isFullscreen() ? 'windowed' : 'fullscreen');
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (this.menu === 'pause') this.closeMenu();
      else if (this.menu) void this.openMenu(this.screen === 'game' ? 'pause' : null);
      else if (this.uiHidden) this.setUiHidden(false);
      else if (this.screen === 'game') void this.openMenu('pause');
      return;
    }
    // Ctrl+<key> is a shortcut, not "hold Ctrl to skip".
    if (e.ctrlKey && e.key !== 'Control') window.clearTimeout(this.skipTimer);
    if (e.ctrlKey && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      if (this.screen === 'game' && !this.menu) void this.openMenu('save');
      return;
    }
    if (inField || this.menu || this.screen !== 'game') return;
    if (this.choiceActive) {
      const n = parseInt(e.key, 10);
      const btns = [...this.choicesEl.querySelectorAll('button')];
      if (n >= 1 && n <= btns.length) btns[n - 1].click();
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const i = btns.indexOf(document.activeElement as HTMLButtonElement);
        const next = e.key === 'ArrowDown' ? (i + 1) % btns.length : (i - 1 + btns.length) % btns.length;
        btns[next]?.focus();
      }
      return;
    }
    switch (e.key) {
      case ' ':
      case 'Enter':
        e.preventDefault();
        if (this.uiHidden) this.setUiHidden(false);
        else this.advance();
        break;
      case 'Control':
        // Hold Ctrl to skip (starts after a short hold so Ctrl+S etc. don't skip a line).
        if (!e.repeat) {
          window.clearTimeout(this.skipTimer);
          this.skipTimer = window.setTimeout(() => {
            this.skipMode = true;
            this.advance();
          }, 300);
        }
        break;
      case 'h':
      case 'H':
        this.setUiHidden(!this.uiHidden);
        break;
      case 'a':
      case 'A':
        this.toggleAuto();
        break;
      case 's':
      case 'S':
        if (!e.ctrlKey) void this.openMenu('save');
        break;
      case 'l':
      case 'L':
        void this.openMenu('load');
        break;
    }
  }

  private advance() {
    if (this.finishTyping) {
      this.finishTyping();
      return;
    }
    if (this.advanceResolver) {
      const r = this.advanceResolver;
      this.advanceResolver = null;
      r();
    }
  }

  private toggleAuto() {
    this.autoMode = !this.autoMode;
    this.quick.querySelector('[data-testid="tvn-q-auto"]')?.classList.toggle('tvn-on', this.autoMode);
    this.toast(this.autoMode ? this.tr('Auto mode ON') : this.tr('Auto mode OFF'));
    if (this.autoMode && !this.finishTyping && this.advanceResolver && !this.choiceActive) this.advance();
  }

  private setUiHidden(hidden: boolean) {
    this.uiHidden = hidden;
    this.root.classList.toggle('tvn-ui-hidden', hidden);
  }

  private bumpIdle() {
    this.root.classList.remove('tvn-idle');
    window.clearTimeout(this.idleTimer);
    if (this.settings.autoHideUI) {
      this.idleTimer = window.setTimeout(() => this.root.classList.add('tvn-idle'), 3000);
    }
  }

  private applyIdleClass() {
    this.root.classList.toggle('tvn-autohide', this.settings.autoHideUI);
    this.bumpIdle();
  }

  private toast(msg: string) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.remove('tvn-hidden');
    window.clearTimeout((this.toastEl as any)._t);
    (this.toastEl as any)._t = window.setTimeout(() => this.toastEl.classList.add('tvn-hidden'), 1400);
  }

  // ---------------------------------------------------------------- screens

  private clearStage() {
    this.bgLayer.replaceChildren();
    this.stage.replaceChildren();
    this.cgLayer.replaceChildren();
    this.charEls.clear();
    this.imageEls.clear();
    this.bgKey = '';
    this.cgKey = '';
    this.bgmKey = '';
    this.fx.style.opacity = '0';
    this.blackout = false;
  }

  private setScreen(screen: Screen) {
    this.screen = screen;
    this.root.dataset.screen = screen;
    const inGame = screen === 'game';
    this.quick.classList.toggle('tvn-hidden', !inGame);
    if (!inGame) {
      this.dialog.classList.add('tvn-hidden');
      this.choicesEl.classList.add('tvn-hidden');
    }
    this.screenEl.classList.toggle('tvn-hidden', inGame);
  }

  showTitle() {
    this.engine.stop();
    this.sound.stopAll();
    this.clearStage();
    this.closeMenu();
    this.setUiHidden(false);
    this.autoMode = false;
    this.setScreen('title');
    const bg = this.assetUrl(this.game.titleBackgroundAssetId);
    if (bg) this.bgLayer.append(this.makeBg({ assetId: this.game.titleBackgroundAssetId }));
    const music = this.assetUrl(this.game.titleMusicAssetId);
    if (music) this.sound.playBgm(`title`, music, 80, true, 1);
    const latest = this.storage.latest();
    const btn = (label: string, fn: () => void, testid: string, primary = false) =>
      h('button', { class: `tvn-btn${primary ? ' tvn-primary' : ''}`, 'data-testid': testid, onclick: (e: Event) => { e.stopPropagation(); fn(); } }, label);
    this.screenEl.className = 'tvn-screen tvn-title-screen';
    this.screenEl.replaceChildren(
      h(
        'div',
        { class: 'tvn-title-box' },
        h('h1', { class: 'tvn-game-title', 'data-testid': 'tvn-title' }, this.game.title || 'Untitled'),
        this.game.author ? h('div', { class: 'tvn-author' }, this.tr('by {author}', { author: this.game.author })) : null,
        h(
          'div',
          { class: 'tvn-title-buttons' },
          btn(this.tr('Start'), () => void this.startGame(null, 0), 'tvn-start', true),
          latest ? btn(this.tr('Continue'), () => void this.loadSlot(latest.slot), 'tvn-continue') : null,
          btn(this.tr('Load'), () => void this.openMenu('load'), 'tvn-load'),
          btn(this.tr('Settings'), () => void this.openMenu('settings'), 'tvn-settings'),
          this.opts.host?.quit ? btn(this.tr('Quit'), () => this.opts.host?.quit?.(), 'tvn-quit') : null,
        ),
      ),
    );
    (this.screenEl.querySelector('button') as HTMLButtonElement | null)?.focus({ preventScroll: true });
    this.emit('title');
  }

  async startGame(sceneId: string | null, index: number) {
    this.closeMenu();
    this.sound.stopAll();
    this.clearStage();
    this.setScreen('game');
    this.root.focus({ preventScroll: true });
    this.emit('start', { sceneId, index });
    await this.engine.start(sceneId, index);
  }

  private async loadSlot(slot: string) {
    const data = this.storage.getSlot(slot);
    if (!data) return;
    this.closeMenu();
    this.sound.stopAll();
    this.clearStage();
    this.setScreen('game');
    this.setUiHidden(false);
    this.root.focus({ preventScroll: true });
    await this.engine.restore(data.save);
    this.toast(this.tr('Game loaded'));
    this.emit('load', { slot });
  }

  // ---------------------------------------------------------------- RuntimeHost: visuals

  private makeBg(bg: { assetId?: string; color?: string } | null): HTMLDivElement {
    const el = h('div', { class: 'tvn-bg-item' });
    if (!bg) return el;
    const url = this.assetUrl(bg.assetId);
    if (url) {
      el.append(h('img', { class: 'tvn-shot', crossorigin: this.opts.corsImages ? 'anonymous' : undefined, src: url, alt: '', draggable: 'false' }));
    } else {
      el.style.background = bg.color || (bg.assetId ? '#3a1c1c' : '#000');
      if (bg.assetId) el.append(h('div', { class: 'tvn-missing' }, this.tr('Missing background')));
    }
    return el;
  }

  /** Swap the content of a layer with a transition. */
  private async swapLayer(layer: HTMLElement, next: HTMLElement | null, hint: ChangeHint | undefined, instant: boolean) {
    const old = [...layer.children] as HTMLElement[];
    const dur = instant ? 0 : (hint?.duration ?? 0.5);
    const tr = instant ? 'none' : hint?.transition;
    if (next) layer.append(next);
    if (dur > 0 && tr && tr !== 'none') {
      if (next) await play(next, transitionInFrames(tr), dur, 'ease', 'none');
      else await Promise.all(old.map((o) => play(o, transitionOutFrames(tr), dur, 'ease', 'forwards')));
    }
    old.forEach((o) => o.remove());
  }

  private makeChar(c: CharState): HTMLDivElement {
    const el = h('div', { class: 'tvn-char', 'data-char': c.id });
    const anim = h('div', { class: 'tvn-char-anim' });
    anim.append(this.charImg(c));
    el.append(anim);
    applyStyle(el, charBoxStyle(c));
    el.dataset.expr = c.expressionId;
    return el;
  }

  private charImg(c: CharState): HTMLElement {
    const ch = this.game.characters.find((x) => x.id === c.id);
    const expr = ch?.expressions.find((e) => e.id === c.expressionId) ?? ch?.expressions[0];
    const url = this.assetUrl(expr?.assetId);
    if (!url) return h('div', { class: 'tvn-missing tvn-missing-char' }, ch ? ch.name : this.tr('Missing character'));
    const img = h('img', { class: 'tvn-shot', crossorigin: this.opts.corsImages ? 'anonymous' : undefined, src: url, alt: ch?.name ?? '', draggable: 'false' });
    if (c.flip) img.style.transform = 'scaleX(-1)';
    return img;
  }

  private makeImage(i: ImageState): HTMLDivElement {
    const el = h('div', { class: 'tvn-image', 'data-slot': i.slot });
    const url = this.assetUrl(i.assetId);
    const anim = h('div', { class: 'tvn-char-anim' });
    if (url) {
      const img = h('img', { class: 'tvn-shot', crossorigin: this.opts.corsImages ? 'anonymous' : undefined, src: url, alt: '', draggable: 'false' });
      if (i.flip) img.style.transform = 'scaleX(-1)';
      anim.append(img);
    } else anim.append(h('div', { class: 'tvn-missing' }, this.tr('Missing image')));
    el.append(anim);
    applyStyle(el, imageBoxStyle(i, this.game.assets[i.assetId], this.game.resolution));
    return el;
  }

  async render(state: VisualState, hints: ChangeHint[], instant: boolean): Promise<void> {
    await this.liftBlackout();
    const hint = (t: string) => hints.find((x) => x.target === t);
    const fast = instant || this.skipMode;
    const jobs: Promise<void>[] = [];

    const bgKey = state.background ? `${state.background.assetId ?? ''}|${state.background.color ?? ''}` : '';
    if (bgKey !== this.bgKey) {
      this.bgKey = bgKey;
      jobs.push(this.swapLayer(this.bgLayer, this.makeBg(state.background), hint('background'), fast));
    }

    const cgKey = state.cg ?? '';
    if (cgKey !== this.cgKey) {
      this.cgKey = cgKey;
      jobs.push(this.swapLayer(this.cgLayer, state.cg ? this.makeBg({ assetId: state.cg }) : null, hint('cg'), fast));
    }

    // Characters
    const wanted = new Map(state.characters.map((c) => [c.id, c]));
    for (const [id, el] of this.charEls) {
      if (!wanted.has(id)) {
        this.charEls.delete(id);
        const hnt = hint(`char:${id}`);
        jobs.push(
          (fast ? Promise.resolve() : play(el.firstElementChild!, exitFrames(hnt?.exit ?? 'fade'), hnt?.duration ?? 0.3, 'ease', 'forwards')).then(() => el.remove()),
        );
      }
    }
    for (const c of state.characters) {
      const existing = this.charEls.get(c.id);
      const hnt = hint(`char:${c.id}`);
      if (!existing) {
        const el = this.makeChar(c);
        this.stage.append(el);
        this.charEls.set(c.id, el);
        if (!fast && hnt?.enter) jobs.push(play(el.firstElementChild!, enterFrames(hnt.enter), hnt.duration ?? 0.4, 'ease'));
        continue;
      }
      if (existing.dataset.expr !== c.expressionId || existing.dataset.flip !== String(c.flip)) {
        existing.dataset.expr = c.expressionId;
        existing.dataset.flip = String(c.flip);
        const anim = existing.firstElementChild as HTMLElement;
        const old = anim.firstElementChild as HTMLElement | null;
        const img = this.charImg(c);
        anim.append(img);
        if (old) {
          old.classList.add('tvn-fading');
          if (fast) old.remove();
          else void play(old, [{ opacity: 1 }, { opacity: 0 }], 0.2, 'ease', 'forwards').then(() => old.remove());
        }
      }
      const target = charBoxStyle(c);
      if (!fast && hnt?.move && hnt.move.duration > 0) {
        const from = { left: existing.style.left, bottom: existing.style.bottom, height: existing.style.height, transform: existing.style.transform, opacity: existing.style.opacity };
        if (from.left !== target.left || from.bottom !== target.bottom || from.height !== target.height || from.transform !== target.transform || from.opacity !== target.opacity) {
          applyStyle(existing, target);
          jobs.push(
            play(
              existing,
              [from, { left: target.left, bottom: target.bottom, height: target.height, transform: target.transform, opacity: target.opacity }],
              hnt.move.duration,
              hnt.move.easing,
            ),
          );
        }
      } else applyStyle(existing, target);
    }

    // Images
    const wantedImgs = new Map(state.images.map((i) => [i.slot, i]));
    for (const [slot, el] of this.imageEls) {
      const want = wantedImgs.get(slot);
      if (!want || el.dataset.asset !== want.assetId) {
        this.imageEls.delete(slot);
        const hnt = hint(`image:${slot}`);
        jobs.push((fast ? Promise.resolve() : play(el, transitionOutFrames(hnt?.transition ?? 'fade'), hnt?.duration ?? 0.3, 'ease', 'forwards')).then(() => el.remove()));
      }
    }
    for (const i of state.images) {
      let el = this.imageEls.get(i.slot);
      const hnt = hint(`image:${i.slot}`);
      if (!el) {
        el = this.makeImage(i);
        el.dataset.asset = i.assetId;
        this.stage.append(el);
        this.imageEls.set(i.slot, el);
        if (!fast && hnt?.transition) jobs.push(play(el.firstElementChild!, transitionInFrames(hnt.transition), hnt.duration ?? 0.4, 'ease'));
      } else applyStyle(el, imageBoxStyle(i, this.game.assets[i.assetId], this.game.resolution));
    }

    // Background music
    const bgmKey = state.bgm ? `${state.bgm.assetId}` : '';
    const bgmHint = hint('bgm');
    if (bgmKey !== this.bgmKey || bgmHint) {
      this.bgmKey = bgmKey;
      if (state.bgm) {
        const url = this.assetUrl(state.bgm.assetId);
        if (url) this.sound.playBgm(state.bgm.assetId, url, state.bgm.volume, state.bgm.loop, fast ? 0 : (bgmHint?.fade ?? 1));
      } else this.sound.stopBgm(fast ? 0 : (bgmHint?.fade ?? 1));
    }

    await Promise.all(jobs);
  }

  async animate(cmd: AnimateCommand): Promise<void> {
    const el = cmd.target.startsWith('char:') ? this.charEls.get(cmd.target.slice(5)) : this.imageEls.get(cmd.target.slice(6));
    if (!el || this.skipMode) return;
    await play(el.firstElementChild!, emphasisFrames(cmd.animation, cmd.custom), cmd.duration, cmd.animation === 'custom' ? 'ease-in-out' : 'ease');
  }

  async screenEffect(effect: string, duration: number): Promise<void> {
    if (this.skipMode && effect !== 'blackout') return;
    switch (effect) {
      case 'shake':
        await play(this.sceneEl, emphasisFrames('shake'), duration);
        break;
      case 'flash':
        this.fx.style.background = '#fff';
        await play(this.fx, [{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 0 }], duration);
        break;
      case 'fade-black':
        this.fx.style.background = '#000';
        await play(this.fx, [{ opacity: 0 }, { opacity: 1, offset: 0.5 }, { opacity: 0 }], duration);
        break;
      case 'blackout':
        this.fx.style.background = '#000';
        await play(this.fx, [{ opacity: 0 }, { opacity: 1 }], duration);
        this.fx.style.opacity = '1';
        this.blackout = true;
        break;
    }
  }

  private async liftBlackout() {
    if (!this.blackout) return;
    this.blackout = false;
    this.fx.style.opacity = '0';
    await play(this.fx, [{ opacity: 1 }, { opacity: 0 }], 0.5);
  }

  // ---------------------------------------------------------------- RuntimeHost: text & input

  async dialogue(d: DialogueView): Promise<void> {
    await this.liftBlackout();
    this.choicesEl.classList.add('tvn-hidden');
    const dlg = this.dialog;
    const wasHidden = dlg.classList.contains('tvn-hidden');
    dlg.classList.remove('tvn-hidden');
    dlg.classList.toggle('tvn-narration', d.narration);
    if (wasHidden && this.game.theme.animation !== 'none') {
      void play(dlg, this.game.theme.animation === 'slide' ? [{ transform: 'translateY(30px)', opacity: 0 }, { transform: 'none', opacity: 1 }] : [{ opacity: 0 }, { opacity: 1 }], 0.25);
    }
    this.nameEl.textContent = d.speakerName ?? '';
    this.nameEl.classList.toggle('tvn-hidden', !d.speakerName);
    if (d.speakerColor) this.nameEl.style.setProperty('--tvn-speaker', d.speakerColor);
    else this.nameEl.style.removeProperty('--tvn-speaker');

    const st = d.style ?? {};
    applyStyle(this.textEl, {
      fontWeight: st.bold ? '700' : '',
      fontStyle: st.italic ? 'italic' : '',
      color: st.color ?? '',
      textAlign: st.align ?? '',
      fontSize: st.size ? `calc(${st.size}px * var(--tvn-ui-scale))` : '',
    });
    this.indicator.classList.remove('tvn-show');
    this.emit('dialogue', d);

    await this.typeText(d.text, d.textSpeed * this.settings.textSpeedFactor);
    this.indicator.classList.add('tvn-show');
    await this.waitAdvance(this.settings.autoDelay + Math.min(4, d.text.length / 40));
    this.indicator.classList.remove('tvn-show');
    this.sound.stopVoice();
  }

  private typeText(text: string, cps: number): Promise<void> {
    this.textEl.textContent = '';
    if (this.skipMode || cps <= 0 || cps >= 500) {
      this.textEl.textContent = text;
      return Promise.resolve();
    }
    const chars = [...text];
    let i = 0;
    return new Promise((resolve) => {
      const step = Math.max(10, 1000 / cps);
      const timer = window.setInterval(() => {
        i++;
        this.textEl.textContent = chars.slice(0, i).join('');
        if (i >= chars.length) done();
      }, step);
      const done = () => {
        window.clearInterval(timer);
        this.textEl.textContent = text;
        this.finishTyping = null;
        resolve();
      };
      this.finishTyping = done;
    });
  }

  /** Wait for click/tap/key, or auto/skip timers. */
  private waitAdvance(autoSeconds?: number): Promise<void> {
    return new Promise((resolve) => {
      let timer: number | undefined;
      this.advanceResolver = () => {
        window.clearTimeout(timer);
        resolve();
      };
      const tick = () => {
        if (!this.advanceResolver) return;
        if (this.menu) {
          timer = window.setTimeout(tick, 300);
          return;
        }
        if (this.skipMode) this.advance();
        else if (this.autoMode && autoSeconds !== undefined) this.advance();
      };
      if (this.skipMode) timer = window.setTimeout(tick, 60);
      else if (this.autoMode && autoSeconds !== undefined) timer = window.setTimeout(tick, autoSeconds * 1000);
    });
  }

  async choice(c: ChoiceView): Promise<number> {
    await this.liftBlackout();
    this.skipMode = false;
    this.choiceActive = true;
    if (c.question) {
      this.dialog.classList.remove('tvn-hidden');
      this.nameEl.classList.add('tvn-hidden');
      this.textEl.textContent = c.question;
      this.indicator.classList.remove('tvn-show');
    } else this.dialog.classList.add('tvn-hidden');
    this.emit('choice', c);
    return new Promise((resolve) => {
      const buttons = c.options.map((o, i) =>
        h(
          'button',
          {
            class: 'tvn-choice',
            role: 'menuitem',
            'data-testid': `tvn-choice-${i}`,
            onclick: (e: Event) => {
              e.stopPropagation();
              this.choiceActive = false;
              this.choicesEl.classList.add('tvn-hidden');
              this.choicesEl.replaceChildren();
              resolve(i);
            },
          },
          o.text,
        ),
      );
      this.choicesEl.replaceChildren(...buttons);
      this.choicesEl.classList.remove('tvn-hidden');
      buttons[0]?.focus({ preventScroll: true });
    });
  }

  async waitClick(): Promise<void> {
    await this.liftBlackout();
    this.dialog.classList.add('tvn-hidden');
    await this.waitAdvance(this.settings.autoDelay);
  }

  async delay(seconds: number): Promise<void> {
    await this.liftBlackout();
    await sleep((this.skipMode ? Math.min(seconds, 0.05) : seconds) * 1000);
  }

  audio(cmd: AudioCommand): void {
    if (cmd.kind === 'stopSfx') {
      this.sound.stopSfx();
      return;
    }
    const url = this.assetUrl(cmd.assetId);
    if (!url) return;
    if (cmd.kind === 'sfx') this.sound.playSfx(url, cmd.volume, cmd.loop);
    else if (!this.skipMode) this.sound.playVoice(url, cmd.volume);
  }

  async video(assetId: string, skippable: boolean): Promise<void> {
    const url = this.assetUrl(assetId);
    if (!url) return;
    await this.liftBlackout();
    const v = h('video', { class: 'tvn-video', src: url, autoplay: true, playsinline: true });
    const wrap = h('div', { class: 'tvn-video-wrap' }, v, skippable ? h('div', { class: 'tvn-video-hint' }, this.tr('Click to skip')) : null);
    this.root.append(wrap);
    this.sound.stopBgm(0.3);
    await new Promise<void>((resolve) => {
      const done = () => {
        wrap.remove();
        resolve();
      };
      v.onended = done;
      v.onerror = done;
      if (skippable) wrap.addEventListener('pointerup', (e) => { e.stopPropagation(); done(); });
      void v.play().catch(() => undefined);
    });
  }

  // ---------------------------------------------------------------- saves

  /** Small screenshot composed from the visible layers (falls back to null if the canvas is tainted). */
  private captureScreenshot(): string | null {
    try {
      const W = 320;
      const H = Math.round((W * this.game.resolution.height) / this.game.resolution.width);
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      const stageRect = this.stage.getBoundingClientRect();
      if (stageRect.width === 0) return null;
      const sx = W / stageRect.width;
      const sy = H / stageRect.height;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      const bgItem = this.bgLayer.lastElementChild as HTMLElement | null;
      if (bgItem?.style.background) {
        ctx.fillStyle = bgItem.style.backgroundColor || '#000';
        ctx.fillRect(0, 0, W, H);
      }
      const imgs = [...this.root.querySelectorAll<HTMLImageElement>('.tvn-scene img.tvn-shot:not(.tvn-fading)')];
      for (const img of imgs) {
        if (!img.complete || img.naturalWidth === 0) continue;
        const r = img.getBoundingClientRect();
        ctx.drawImage(img, (r.left - stageRect.left) * sx, (r.top - stageRect.top) * sy, r.width * sx, r.height * sy);
      }
      return canvas.toDataURL('image/jpeg', 0.7);
    } catch {
      return null;
    }
  }

  private writeSlot(slot: string): boolean {
    const save = this.engine.snapshot();
    if (!save) return false;
    const data: SlotData = { save, screenshot: this.captureScreenshot() };
    const ok = this.storage.putSlot(slot, data);
    this.emit('save', { slot, ok });
    return ok;
  }

  async saveMenu(mode: 'menu' | 'auto'): Promise<void> {
    if (mode === 'auto') {
      this.writeSlot(AUTO_SLOT);
      return;
    }
    await this.openMenu('save');
  }

  async loadMenu(): Promise<void> {
    await this.openMenu('load');
  }

  // ---------------------------------------------------------------- menus

  private closeMenu() {
    this.menu = null;
    this.overlay.classList.add('tvn-hidden');
    this.overlay.replaceChildren();
    const r = this.menuResolver;
    this.menuResolver = null;
    r?.();
    if (this.screen === 'game') this.root.focus({ preventScroll: true });
  }

  /** Opens a menu view; resolves when the menu closes. */
  openMenu(view: MenuView): Promise<void> {
    if (!view) {
      this.closeMenu();
      return Promise.resolve();
    }
    if (view === 'save' && this.screen !== 'game') return Promise.resolve();
    this.menu = view;
    this.overlay.classList.remove('tvn-hidden');
    this.overlay.dataset.view = view;
    const back = () => (this.screen === 'game' && view !== 'pause' ? void this.openMenu('pause') : this.closeMenu());
    const header = (title: string) =>
      h('div', { class: 'tvn-menu-header' }, h('h2', {}, title), h('button', { class: 'tvn-btn tvn-close', 'data-testid': 'tvn-menu-close', onclick: () => this.closeMenu(), 'aria-label': this.tr('Close') }, '✕'));

    if (view === 'pause') {
      const b = (label: string, fn: () => void, testid: string) => h('button', { class: 'tvn-btn', 'data-testid': testid, onclick: fn }, label);
      this.overlay.replaceChildren(
        h(
          'div',
          { class: 'tvn-menu tvn-pause' },
          header(this.tr('Menu')),
          h(
            'div',
            { class: 'tvn-menu-list' },
            b(this.tr('Resume'), () => this.closeMenu(), 'tvn-resume'),
            b(this.tr('Save'), () => void this.openMenu('save'), 'tvn-menu-save'),
            b(this.tr('Load'), () => void this.openMenu('load'), 'tvn-menu-load'),
            b(this.tr('Settings'), () => void this.openMenu('settings'), 'tvn-menu-settings'),
            b(this.uiHidden ? this.tr('Show UI') : this.tr('Hide UI'), () => { this.closeMenu(); this.setUiHidden(true); }, 'tvn-menu-hide'),
            b(this.tr('Return to Title'), () => this.confirmInMenu(this.tr('Return to the title screen? Unsaved progress will be lost.'), () => this.showTitle()), 'tvn-menu-title'),
            this.opts.host?.quit ? b(this.tr('Quit Game'), () => this.confirmInMenu(this.tr('Quit the game?'), () => this.opts.host?.quit?.()), 'tvn-menu-quit') : null,
          ),
        ),
      );
    } else if (view === 'save' || view === 'load') {
      const grid = h('div', { class: 'tvn-slots' });
      for (const slot of this.storage.slots()) {
        if (view === 'save' && slot === AUTO_SLOT) continue;
        const data = this.storage.getSlot(slot);
        const label = slot === AUTO_SLOT ? this.tr('Auto Save') : this.tr('Slot {n}', { n: slot });
        const card = h(
          'button',
          {
            class: `tvn-slot${data ? '' : ' tvn-empty'}`,
            'data-testid': `tvn-slot-${slot}`,
            disabled: view === 'load' && !data,
            onclick: () => {
              if (view === 'load') {
                if (data) void this.loadSlot(slot);
              } else if (data) {
                this.confirmInMenu(this.tr('Overwrite {label}?', { label }), () => this.doSave(slot), () => void this.openMenu('save'));
              } else this.doSave(slot);
            },
          },
          data?.screenshot ? h('img', { class: 'tvn-slot-shot', src: data.screenshot, alt: '' }) : h('div', { class: 'tvn-slot-shot tvn-slot-blank' }, data ? '' : this.tr('Empty')),
          h('div', { class: 'tvn-slot-label' }, label),
          data ? h('div', { class: 'tvn-slot-meta' }, `${new Date(data.save.savedAt).toLocaleString()}`) : null,
          data ? h('div', { class: 'tvn-slot-text' }, `${data.save.sceneName}${data.save.text ? ` — ${data.save.text.slice(0, 60)}` : ''}`) : null,
        );
        grid.append(card);
      }
      this.overlay.replaceChildren(h('div', { class: 'tvn-menu tvn-saveload' }, header(view === 'save' ? this.tr('Save Game') : this.tr('Load Game')), grid, h('div', { class: 'tvn-menu-footer' }, h('button', { class: 'tvn-btn', onclick: back }, this.tr('Back')))));
    } else if (view === 'settings') {
      this.overlay.replaceChildren(h('div', { class: 'tvn-menu tvn-settings' }, header(this.tr('Settings')), this.settingsForm(), h('div', { class: 'tvn-menu-footer' }, h('button', { class: 'tvn-btn', onclick: back }, this.tr('Back')))));
    }
    (this.overlay.querySelector('button:not([disabled])') as HTMLButtonElement | null)?.focus({ preventScroll: true });
    const prev = this.menuResolver;
    return new Promise<void>((resolve) => {
      this.menuResolver = () => {
        prev?.();
        resolve();
      };
    });
  }

  private doSave(slot: string) {
    const ok = this.writeSlot(slot);
    this.toast(ok ? this.tr('Game saved') : this.tr('Could not save (storage full?)'));
    void this.openMenu('save');
  }

  private confirmInMenu(message: string, yes: () => void, no?: () => void) {
    const box = h(
      'div',
      { class: 'tvn-menu tvn-confirm', role: 'alertdialog' },
      h('p', {}, message),
      h(
        'div',
        { class: 'tvn-confirm-buttons' },
        h('button', { class: 'tvn-btn tvn-primary', 'data-testid': 'tvn-confirm-yes', onclick: () => yes() }, this.tr('Yes')),
        h('button', { class: 'tvn-btn', 'data-testid': 'tvn-confirm-no', onclick: () => (no ? no() : void this.openMenu('pause')) }, this.tr('No')),
      ),
    );
    this.overlay.replaceChildren(box);
    (box.querySelector('button') as HTMLButtonElement).focus();
  }

  private settingsForm(): HTMLElement {
    const s = this.settings;
    const save = () => {
      this.storage.putSettings(this.settings);
      this.sound.setVolumes(this.settings.volumes);
      this.applyIdleClass();
    };
    const slider = (label: string, value: number, min: number, max: number, step: number, set: (v: number) => void, fmt: (v: number) => string) => {
      const out = h('span', { class: 'tvn-val' }, fmt(value));
      const input = h('input', { type: 'range', min, max, step, value, 'aria-label': label });
      input.addEventListener('input', () => {
        set(parseFloat(input.value));
        out.textContent = fmt(parseFloat(input.value));
        save();
      });
      return h('label', { class: 'tvn-field' }, h('span', {}, label), input, out);
    };
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    const modes: [PlayerSettings['displayMode'], string][] = [
      ['windowed', this.tr('Windowed')],
      ['fullscreen', this.tr('Fullscreen')],
    ];
    if (this.opts.host?.supportsBorderless) modes.push(['borderless', this.tr('Borderless')]);
    const select = h('select', { 'aria-label': 'Display mode', 'data-testid': 'tvn-display' }, ...modes.map(([v, l]) => h('option', { value: v, selected: s.displayMode === v || (v === 'fullscreen' && this.isFullscreen() && s.displayMode !== 'borderless') }, l)));
    select.addEventListener('change', () => void this.setDisplayMode(select.value as PlayerSettings['displayMode']));
    const autoHide = h('input', { type: 'checkbox', checked: s.autoHideUI, 'aria-label': 'Auto-hide UI' });
    autoHide.addEventListener('change', () => {
      this.settings.autoHideUI = autoHide.checked;
      save();
    });
    return h(
      'div',
      { class: 'tvn-form' },
      slider(this.tr('Text speed'), s.textSpeedFactor, 0.25, 4, 0.25, (v) => (this.settings.textSpeedFactor = v), (v) => `${v}×`),
      slider(this.tr('Auto speed'), s.autoDelay, 0.5, 5, 0.25, (v) => (this.settings.autoDelay = v), (v) => `${v}s`),
      slider(this.tr('Master volume'), s.volumes.master, 0, 1, 0.05, (v) => (this.settings.volumes.master = v), pct),
      slider(this.tr('Music'), s.volumes.bgm, 0, 1, 0.05, (v) => (this.settings.volumes.bgm = v), pct),
      slider(this.tr('Sound effects'), s.volumes.sfx, 0, 1, 0.05, (v) => (this.settings.volumes.sfx = v), pct),
      slider(this.tr('Voice'), s.volumes.voice, 0, 1, 0.05, (v) => (this.settings.volumes.voice = v), pct),
      h('label', { class: 'tvn-field' }, h('span', {}, this.tr('Display')), select),
      h('label', { class: 'tvn-field tvn-check' }, h('span', {}, this.tr('Auto-hide buttons when idle')), autoHide),
    );
  }

  private isFullscreen() {
    return !!document.fullscreenElement || this.settings.displayMode === 'fullscreen';
  }

  async setDisplayMode(mode: PlayerSettings['displayMode']) {
    this.settings.displayMode = mode;
    this.storage.putSettings(this.settings);
    if (this.opts.host?.setDisplayMode) {
      this.opts.host.setDisplayMode(mode);
      return;
    }
    try {
      if (mode === 'fullscreen' && !document.fullscreenElement) await document.documentElement.requestFullscreen();
      if (mode !== 'fullscreen' && document.fullscreenElement) await document.exitFullscreen();
    } catch {
      this.toast(this.tr('Fullscreen is not available here'));
    }
  }

  // ---------------------------------------------------------------- end / errors

  async end(message: string): Promise<void> {
    this.sound.stopBgm(2);
    await this.liftBlackout();
    this.setScreen('end');
    this.screenEl.className = 'tvn-screen tvn-end-screen';
    const pv = this.opts.preview;
    return new Promise((resolve) => {
      this.screenEl.replaceChildren(
        h(
          'div',
          { class: 'tvn-title-box' },
          h('h1', { class: 'tvn-game-title', 'data-testid': 'tvn-end' }, message || this.tr('The End')),
          h(
            'div',
            { class: 'tvn-title-buttons' },
            pv?.skipTitle
              ? h('button', { class: 'tvn-btn tvn-primary', 'data-testid': 'tvn-restart', onclick: () => { resolve(); void this.startGame(pv.sceneId ?? null, pv.index ?? 0); } }, this.tr('Play Again'))
              : null,
            h('button', { class: 'tvn-btn', 'data-testid': 'tvn-to-title', onclick: () => { resolve(); this.showTitle(); } }, this.tr('Return to Title')),
          ),
        ),
      );
      this.emit('end', message);
    });
  }

  toTitle(): void {
    this.showTitle();
  }

  error(message: string): void {
    console.error('[TSTVN]', message);
    this.setScreen('error');
    this.screenEl.className = 'tvn-screen tvn-error-screen';
    this.screenEl.replaceChildren(
      h(
        'div',
        { class: 'tvn-title-box' },
        h('h2', {}, this.tr('Something went wrong')),
        h('p', { 'data-testid': 'tvn-error' }, message),
        h('button', { class: 'tvn-btn tvn-primary', onclick: () => this.showTitle() }, this.tr('Return to Title')),
      ),
    );
    this.emit('error', message);
  }

  // Exposed for tests / editor
  get currentScreen() {
    return this.screen;
  }
}
