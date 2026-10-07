export interface Volumes {
  master: number;
  bgm: number;
  sfx: number;
  voice: number;
}

function fadeVolume(el: HTMLAudioElement, to: number, seconds: number): Promise<void> {
  const from = el.volume;
  if (seconds <= 0) {
    el.volume = clamp(to);
    return Promise.resolve();
  }
  const start = performance.now();
  return new Promise((resolve) => {
    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / (seconds * 1000));
      el.volume = clamp(from + (to - from) * t);
      if (t < 1) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
}

const clamp = (v: number) => Math.max(0, Math.min(1, v));

/** BGM with crossfades, polyphonic SFX, single-channel voice. */
export class AudioManager {
  private bgm: HTMLAudioElement | null = null;
  private bgmKey = '';
  private bgmBase = 1;
  private sfx = new Set<HTMLAudioElement>();
  private voice: HTMLAudioElement | null = null;
  volumes: Volumes;

  constructor(volumes: Volumes) {
    this.volumes = volumes;
  }

  private safePlay(el: HTMLAudioElement) {
    const r = el.play();
    if (r && typeof r.catch === 'function') r.catch(() => undefined);
  }

  playBgm(key: string, url: string, volume: number, loop: boolean, fade: number) {
    const target = (volume / 100) * this.volumes.bgm * this.volumes.master;
    if (this.bgm && this.bgmKey === key) {
      this.bgmBase = volume / 100;
      this.bgm.loop = loop;
      void fadeVolume(this.bgm, target, 0.3);
      return;
    }
    this.stopBgm(fade);
    const el = new Audio(url);
    el.loop = loop;
    el.volume = fade > 0 ? 0 : clamp(target);
    this.bgm = el;
    this.bgmKey = key;
    this.bgmBase = volume / 100;
    this.safePlay(el);
    if (fade > 0) void fadeVolume(el, target, fade);
  }

  stopBgm(fade: number) {
    const old = this.bgm;
    this.bgm = null;
    this.bgmKey = '';
    if (!old) return;
    void fadeVolume(old, 0, fade).then(() => {
      old.pause();
      old.src = '';
    });
  }

  playSfx(url: string, volume: number, loop: boolean) {
    const el = new Audio(url);
    el.loop = loop;
    el.volume = clamp((volume / 100) * this.volumes.sfx * this.volumes.master);
    this.sfx.add(el);
    el.onended = () => this.sfx.delete(el);
    this.safePlay(el);
  }

  stopSfx() {
    for (const el of this.sfx) {
      el.pause();
      el.src = '';
    }
    this.sfx.clear();
  }

  playVoice(url: string, volume: number) {
    this.stopVoice();
    const el = new Audio(url);
    el.volume = clamp((volume / 100) * this.volumes.voice * this.volumes.master);
    this.voice = el;
    this.safePlay(el);
  }

  stopVoice() {
    if (this.voice) {
      this.voice.pause();
      this.voice.src = '';
      this.voice = null;
    }
  }

  setVolumes(v: Volumes) {
    this.volumes = v;
    if (this.bgm) this.bgm.volume = clamp(this.bgmBase * v.bgm * v.master);
  }

  get currentBgmKey() {
    return this.bgmKey;
  }

  stopAll() {
    this.stopBgm(0);
    this.stopSfx();
    this.stopVoice();
  }
}
