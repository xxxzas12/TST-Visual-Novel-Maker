import { easingToCss } from '../../shared/animations';
import type { AnimFrame } from '../../shared/types';

type Keyframes = Keyframe[];

function frame(f: AnimFrame | undefined): Keyframe {
  const x = f?.x ?? 0;
  const y = f?.y ?? 0;
  const s = f?.scale ?? 1;
  const r = f?.rotate ?? 0;
  return { transform: `translate(${x}px, ${y}px) scale(${s}) rotate(${r}deg)`, opacity: f?.opacity ?? 1 };
}

export function transitionInFrames(name: string | undefined): Keyframes | null {
  switch (name) {
    case 'fade':
      return [{ opacity: 0 }, { opacity: 1 }];
    case 'slide-left':
      return [{ transform: 'translateX(100%)' }, { transform: 'translateX(0)' }];
    case 'slide-right':
      return [{ transform: 'translateX(-100%)' }, { transform: 'translateX(0)' }];
    case 'slide-up':
      return [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }];
    case 'slide-down':
      return [{ transform: 'translateY(-100%)' }, { transform: 'translateY(0)' }];
    case 'zoom-in':
      return [{ transform: 'scale(1.25)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }];
    case 'zoom-out':
      return [{ transform: 'scale(0.8)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }];
    case 'flash':
      return [{ opacity: 0, filter: 'brightness(4)' }, { opacity: 1, filter: 'brightness(2)', offset: 0.4 }, { opacity: 1, filter: 'brightness(1)' }];
    default:
      return null;
  }
}

export function transitionOutFrames(name: string | undefined): Keyframes | null {
  switch (name) {
    case 'fade':
    case 'flash':
      return [{ opacity: 1 }, { opacity: 0 }];
    case 'slide-left':
      return [{ transform: 'translateX(0)' }, { transform: 'translateX(-100%)' }];
    case 'slide-right':
      return [{ transform: 'translateX(0)' }, { transform: 'translateX(100%)' }];
    case 'slide-up':
      return [{ transform: 'translateY(0)' }, { transform: 'translateY(-100%)' }];
    case 'slide-down':
      return [{ transform: 'translateY(0)' }, { transform: 'translateY(100%)' }];
    case 'zoom-in':
      return [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.25)', opacity: 0 }];
    case 'zoom-out':
      return [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(0.8)', opacity: 0 }];
    default:
      return null;
  }
}

export function enterFrames(name: string | undefined): Keyframes | null {
  switch (name) {
    case 'fade':
      return [{ opacity: 0 }, { opacity: 1 }];
    case 'slide-left':
      return [{ transform: 'translateX(-60vw)', opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }];
    case 'slide-right':
      return [{ transform: 'translateX(60vw)', opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }];
    case 'slide-up':
      return [{ transform: 'translateY(30%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }];
    case 'zoom':
      return [{ transform: 'scale(0.6)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }];
    case 'bounce':
      return [
        { transform: 'translateY(40%) scale(0.9)', opacity: 0 },
        { transform: 'translateY(-6%) scale(1.03)', opacity: 1, offset: 0.6 },
        { transform: 'translateY(2%) scale(0.99)', offset: 0.8 },
        { transform: 'translateY(0) scale(1)', opacity: 1 },
      ];
    default:
      return null;
  }
}

export function exitFrames(name: string | undefined): Keyframes | null {
  switch (name) {
    case 'fade':
      return [{ opacity: 1 }, { opacity: 0 }];
    case 'slide-left':
      return [{ transform: 'translateX(0)', opacity: 1 }, { transform: 'translateX(-60vw)', opacity: 0 }];
    case 'slide-right':
      return [{ transform: 'translateX(0)', opacity: 1 }, { transform: 'translateX(60vw)', opacity: 0 }];
    case 'slide-down':
      return [{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(30%)', opacity: 0 }];
    case 'zoom':
      return [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(0.6)', opacity: 0 }];
    default:
      return null;
  }
}

export function emphasisFrames(name: string | undefined, custom?: { from?: AnimFrame; to?: AnimFrame }): Keyframes {
  switch (name) {
    case 'shake':
      return [0, -18, 16, -12, 10, -6, 4, 0].map((x) => ({ transform: `translateX(${x}px)` }));
    case 'bounce':
      return [
        { transform: 'translateY(0) scaleY(1)' },
        { transform: 'translateY(0) scaleY(0.9)', offset: 0.2 },
        { transform: 'translateY(-8%) scaleY(1.05)', offset: 0.5 },
        { transform: 'translateY(0) scaleY(0.95)', offset: 0.8 },
        { transform: 'translateY(0) scaleY(1)' },
      ];
    case 'jump':
      return [{ transform: 'translateY(0)' }, { transform: 'translateY(-12%)', offset: 0.4 }, { transform: 'translateY(0)' }];
    case 'pulse':
      return [{ transform: 'scale(1)' }, { transform: 'scale(1.08)', offset: 0.5 }, { transform: 'scale(1)' }];
    case 'spin':
      return [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }];
    case 'zoom':
      return [{ transform: 'scale(1)' }, { transform: 'scale(1.25)', offset: 0.5 }, { transform: 'scale(1)' }];
    case 'custom':
      return [frame(custom?.from), frame(custom?.to)];
    default:
      return [{ transform: 'none' }, { transform: 'none' }];
  }
}

/** Runs a Web Animation and resolves when it ends (or immediately when duration is 0). */
export function play(el: Element, frames: Keyframes | null, seconds: number, easing?: string, fill: FillMode = 'none'): Promise<void> {
  if (!frames || seconds <= 0 || typeof (el as HTMLElement).animate !== 'function') return Promise.resolve();
  const anim = (el as HTMLElement).animate(frames, { duration: seconds * 1000, easing: easingToCss(easing), fill });
  return new Promise((resolve) => {
    anim.onfinish = () => resolve();
    anim.oncancel = () => resolve();
  });
}
