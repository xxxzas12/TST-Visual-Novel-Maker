import type { Action, GameData, GameScene, JumpTarget, TextStyle } from '../../shared/types';
import {
  applyStateAction,
  applyVarAction,
  emptyVisualState,
  initialVars,
  stateBeforeAction,
  type ChangeHint,
  type VarValues,
  type VisualState,
} from './state';
import { evalCondition, evalConditions, interpolate } from './conditions';

export interface DialogueView {
  speakerId: string | null;
  speakerName: string | null;
  speakerColor: string | null;
  text: string;
  style: TextStyle;
  textSpeed: number;
  /** True when the action did not set its own speed (the theme's speed may apply). */
  defaultSpeed?: boolean;
  narration: boolean;
}

export interface ChoiceView {
  question: string;
  /** disabled = condition not met, shown greyed out ("show when locked"). */
  options: { text: string; disabled?: boolean }[];
}

export type AudioCommand =
  | { kind: 'sfx'; assetId: string; volume: number; loop: boolean }
  | { kind: 'stopSfx' }
  | { kind: 'voice'; assetId: string; volume: number };

export interface AnimateCommand {
  target: string;
  animation: string;
  duration: number;
  custom?: any;
}

/** Everything the engine needs from the presentation layer. */
export interface RuntimeHost {
  render(state: VisualState, hints: ChangeHint[], instant: boolean): Promise<void>;
  dialogue(d: DialogueView): Promise<void>;
  choice(c: ChoiceView): Promise<number>;
  waitClick(): Promise<void>;
  delay(seconds: number): Promise<void>;
  audio(cmd: AudioCommand): void;
  animate(cmd: AnimateCommand): Promise<void>;
  screenEffect(effect: string, duration: number): Promise<void>;
  video(assetId: string, skippable: boolean): Promise<void>;
  saveMenu(mode: 'menu' | 'auto'): Promise<void>;
  loadMenu(): Promise<void>;
  toTitle(): void;
  end(message: string): Promise<void>;
  error(message: string): void;
  /** The story entered another scene (scene themes). */
  sceneChanged?(sceneId: string): void;
}

export interface Pointer {
  sceneId: string;
  index: number;
}

export interface SaveState {
  v: 1;
  ptr: Pointer;
  vars: VarValues;
  state: VisualState;
  savedAt: number;
  sceneName: string;
  text: string;
}

const MAX_STEPS_WITHOUT_INPUT = 10000;

export class Engine {
  readonly game: GameData;
  private readonly host: RuntimeHost;
  private readonly sceneMap: Map<string, GameScene>;
  private runId = 0;
  private ptr: Pointer | null = null;
  /** Pointer of the action currently being executed (what a save resumes). */
  private current: Pointer | null = null;
  vars: VarValues;
  state: VisualState = emptyVisualState();
  lastText = '';
  running = false;

  constructor(game: GameData, host: RuntimeHost) {
    this.game = game;
    this.host = host;
    this.sceneMap = new Map(game.scenes.map((s) => [s.id, s]));
    this.vars = initialVars(game);
  }

  /** Start a new game from the beginning (or from a scene/action for Play From Here). */
  async start(sceneId?: string | null, index = 0): Promise<void> {
    this.stop();
    const sid = sceneId ?? this.game.startSceneId ?? this.game.sceneOrder[0];
    if (!sid || !this.sceneMap.has(sid)) {
      this.host.error('This game has no scenes to play.');
      return;
    }
    const scene = this.sceneMap.get(sid)!;
    const idx = Math.max(0, Math.min(index, scene.actions.length));
    // Warm-up: replay earlier state actions so "Play From Here" shows the right stage.
    const warm = stateBeforeAction(this.game, scene.actions, idx);
    this.state = warm.state;
    this.vars = warm.vars;
    this.lastText = '';
    await this.host.render(this.state, [], true);
    this.launch({ sceneId: sid, index: idx });
  }

  snapshot(): SaveState | null {
    const at = this.current ?? this.ptr;
    if (!at) return null;
    return {
      v: 1,
      ptr: { ...at },
      vars: { ...this.vars },
      state: JSON.parse(JSON.stringify(this.state)),
      savedAt: Date.now(),
      sceneName: this.sceneMap.get(at.sceneId)?.name ?? '',
      text: this.lastText,
    };
  }

  async restore(save: SaveState): Promise<void> {
    this.stop();
    if (!save || save.v !== 1 || !this.sceneMap.has(save.ptr.sceneId)) {
      this.host.error('This save cannot be loaded (the story changed or the save is damaged).');
      return;
    }
    this.vars = { ...initialVars(this.game), ...save.vars };
    this.state = save.state;
    this.lastText = save.text;
    await this.host.render(this.state, [], true);
    this.launch({ ...save.ptr });
  }

  stop(): void {
    this.runId++;
    this.running = false;
  }

  private launch(ptr: Pointer) {
    this.runId++;
    this.ptr = ptr;
    this.current = { ...ptr };
    const id = this.runId;
    this.running = true;
    void this.loop(id).catch((e) => {
      if (id === this.runId) {
        this.running = false;
        this.host.error(e instanceof Error ? e.message : String(e));
      }
    });
  }

  private nextSceneId(sceneId: string): string | null {
    const i = this.game.sceneOrder.indexOf(sceneId);
    return i >= 0 && i + 1 < this.game.sceneOrder.length ? this.game.sceneOrder[i + 1] : null;
  }

  /** Resolve a jump target to a pointer. null = continue with next action. */
  resolveTarget(t: JumpTarget | undefined, fromSceneId: string): Pointer | null | 'invalid' {
    if (!t || t.kind === 'next') return null;
    if (t.kind === 'scene') return t.sceneId && this.sceneMap.has(t.sceneId) ? { sceneId: t.sceneId, index: 0 } : 'invalid';
    if (t.kind === 'label') {
      const find = (s: GameScene) => s.actions.findIndex((a) => a.type === 'label' && a.params.name === t.label);
      const here = this.sceneMap.get(fromSceneId);
      if (here) {
        const i = find(here);
        if (i >= 0) return { sceneId: here.id, index: i };
      }
      for (const s of this.game.scenes) {
        const i = find(s);
        if (i >= 0) return { sceneId: s.id, index: i };
      }
      return 'invalid';
    }
    if (t.kind === 'action') {
      for (const s of this.game.scenes) {
        const i = s.actions.findIndex((a) => a.id === t.actionId);
        if (i >= 0) return { sceneId: s.id, index: i };
      }
      return 'invalid';
    }
    return 'invalid';
  }

  private async loop(id: number): Promise<void> {
    let steps = 0;
    let lastScene: string | null = null;
    while (id === this.runId && this.ptr) {
      const scene = this.sceneMap.get(this.ptr.sceneId);
      if (!scene) throw new Error('A scene in the story is missing.');
      if (scene.id !== lastScene) {
        lastScene = scene.id;
        this.host.sceneChanged?.(scene.id);
      }
      if (this.ptr.index >= scene.actions.length) {
        const next = this.nextSceneId(scene.id);
        if (!next) {
          this.running = false;
          await this.host.end('The End');
          return;
        }
        this.ptr = { sceneId: next, index: 0 };
        continue;
      }
      const action = scene.actions[this.ptr.index];
      this.current = { ...this.ptr };
      const result = await this.exec(action, scene, id);
      if (id !== this.runId) return;
      if (result === 'stop') {
        this.running = false;
        return;
      }
      if (result === 'blocked') steps = 0;
      else if (++steps > MAX_STEPS_WITHOUT_INPUT) {
        throw new Error('The story is stuck in an endless loop (jumps without any dialogue). Check your Jump and Label actions.');
      }
      if (result && typeof result === 'object') this.ptr = result;
      else this.ptr = { sceneId: this.ptr.sceneId, index: this.ptr.index + 1 };
    }
  }

  private jumpOrNext(t: JumpTarget | undefined, scene: GameScene): Pointer | undefined {
    const r = this.resolveTarget(t, scene.id);
    if (r === 'invalid') throw new Error(`A jump in “${scene.name}” points to something that no longer exists.`);
    return r ?? undefined;
  }

  /** Executes one action. Returns a pointer to jump, 'blocked' if it waited for the player, 'stop', or undefined to continue. */
  private async exec(a: Action, scene: GameScene, id: number): Promise<Pointer | 'blocked' | 'stop' | undefined> {
    const p = a.params ?? {};
    const host = this.host;

    // State-changing actions (background, characters, BGM…)
    const r = applyStateAction(this.state, a, this.game);
    if (r.hints.length) {
      this.state = r.state;
      await host.render(this.state, r.hints, false);
      if (id !== this.runId) return 'stop';
    }
    const vars = applyVarAction(this.vars, a, this.game);
    if (vars !== this.vars) this.vars = vars;

    switch (a.type) {
      case 'dialogue':
      case 'narration': {
        const ch = a.type === 'dialogue' && p.speaker ? this.game.characters.find((c) => c.id === p.speaker) : undefined;
        const text = interpolate(p.text ?? '', this.vars, this.game.variables);
        this.lastText = text;
        if (p.voice) host.audio({ kind: 'voice', assetId: p.voice, volume: 100 });
        if (p.sfx) host.audio({ kind: 'sfx', assetId: p.sfx, volume: 100, loop: false });
        await host.dialogue({
          speakerId: ch?.id ?? null,
          speakerName: ch ? ch.displayName || ch.name : null,
          speakerColor: ch?.color ?? null,
          text,
          style: p.style ?? {},
          textSpeed: p.textSpeed > 0 ? p.textSpeed : this.game.textSpeed,
          defaultSpeed: !(p.textSpeed > 0),
          narration: a.type === 'narration' || !ch,
        });
        return 'blocked';
      }
      case 'choice': {
        const all = (p.options ?? []) as any[];
        const met = (o: any) => !o.condition || evalCondition(o.condition, this.vars, this.game.variables);
        // Options whose condition fails are hidden, or shown disabled when "show when locked" is on.
        const visible = all.filter((o) => met(o) || o.showLocked);
        if (!visible.some(met)) return undefined;
        this.lastText = p.question ?? this.lastText;
        await host.saveMenu('auto');
        const pick = await host.choice({
          question: interpolate(p.question ?? '', this.vars, this.game.variables),
          options: visible.map((o) => ({ text: interpolate(o.text, this.vars, this.game.variables), ...(met(o) ? {} : { disabled: true }) })),
        });
        if (id !== this.runId) return 'stop';
        let opt = visible[Math.max(0, Math.min(pick, visible.length - 1))];
        if (!met(opt)) opt = visible.find(met)!;
        return this.jumpOrNext(opt.target, scene) ?? 'blocked';
      }
      case 'jumpScene':
        if (!p.sceneId || !this.sceneMap.has(p.sceneId)) throw new Error(`“${scene.name}” jumps to a scene that no longer exists.`);
        return { sceneId: p.sceneId, index: 0 };
      case 'changeScene': {
        if (!p.sceneId || !this.sceneMap.has(p.sceneId)) throw new Error(`“${scene.name}” changes to a scene that no longer exists.`);
        await host.screenEffect('blackout', 0.6);
        if (p.clearStage !== false) {
          const hints: ChangeHint[] = this.state.characters.map((c) => ({ target: `char:${c.id}`, exit: 'none' }));
          this.state = { ...this.state, characters: [], images: [], cg: null };
          await host.render(this.state, hints, true);
        }
        this.current = { sceneId: p.sceneId, index: 0 };
        await host.saveMenu('auto');
        return { sceneId: p.sceneId, index: 0 };
      }
      case 'endGame':
        this.running = false;
        await host.end(p.message || 'The End');
        return 'stop';
      case 'returnToTitle':
        this.running = false;
        host.toTitle();
        return 'stop';
      case 'playSFX':
        if (p.assetId) host.audio({ kind: 'sfx', assetId: p.assetId, volume: p.volume ?? 100, loop: !!p.loop });
        return undefined;
      case 'stopSFX':
        host.audio({ kind: 'stopSfx' });
        return undefined;
      case 'playVoice':
        if (p.assetId) host.audio({ kind: 'voice', assetId: p.assetId, volume: p.volume ?? 100 });
        return undefined;
      case 'animateCharacter': {
        const run = host.animate({ target: `char:${p.characterId}`, animation: p.animation, duration: p.duration ?? 0.5, custom: p.custom });
        if (p.wait) await run;
        return undefined;
      }
      case 'screenEffect':
        await host.screenEffect(p.effect || 'shake', p.duration ?? 0.5);
        return undefined;
      case 'playVideo':
        if (p.assetId) {
          await host.video(p.assetId, p.skippable !== false);
          return 'blocked';
        }
        return undefined;
      case 'wait':
        await host.waitClick();
        return 'blocked';
      case 'delay':
        await host.delay(Math.max(0, Number(p.seconds) || 0));
        return 'blocked';
      case 'jump':
        return this.jumpOrNext(p.target, scene);
      case 'conditional': {
        const ok = evalConditions(p.conditions ?? [], p.logic === 'any' ? 'any' : 'all', this.vars, this.game.variables);
        return this.jumpOrNext(ok ? p.then : p.else, scene);
      }
      case 'checkVariable': {
        const ok = evalCondition({ variableId: p.variableId, op: p.op, value: p.value }, this.vars, this.game.variables);
        return ok ? this.jumpOrNext(p.target, scene) : undefined;
      }
      case 'saveGame':
        this.current = { sceneId: scene.id, index: (this.current?.index ?? 0) + 1 };
        await host.saveMenu(p.mode === 'menu' ? 'menu' : 'auto');
        return p.mode === 'menu' ? 'blocked' : undefined;
      case 'loadGame':
        await host.loadMenu();
        return 'blocked';
      default:
        return undefined;
    }
  }
}
