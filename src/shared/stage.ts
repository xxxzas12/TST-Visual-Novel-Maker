// Stage geometry shared by the editor's visual scene editor and the runtime,
// so what the author sees while editing matches the game.

export const CHAR_BASE_HEIGHT = 90; // % of stage height at scale 1

/** X positions (in %) for the Left / Center / Right presets. */
export const POSITION_X: Record<string, number> = { left: 22, center: 50, right: 78 };

export interface Placement {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
  flip: boolean;
  layer: number;
}

/** Outer box style for a character: bottom-center anchored, height relative to the stage. */
export function charBoxStyle(c: Placement): Record<string, string> {
  return {
    left: `${c.x}%`,
    bottom: `${100 - c.y}%`,
    height: `${CHAR_BASE_HEIGHT * c.scale}%`,
    zIndex: String(100 + Math.round(c.layer)),
    opacity: String(c.opacity),
    transform: `translateX(-50%) rotate(${c.rotation}deg)`,
    transformOrigin: '50% 100%',
  };
}

/** Outer box style for an image: center anchored, width from the image's pixel size relative to the stage resolution. */
export function imageBoxStyle(
  img: Placement,
  natural: { width?: number; height?: number } | undefined,
  resolution: { width: number; height: number },
): Record<string, string> {
  const w = natural?.width ? (natural.width / resolution.width) * 100 * img.scale : 25 * img.scale;
  return {
    left: `${img.x}%`,
    top: `${img.y}%`,
    width: `${w}%`,
    zIndex: String(100 + Math.round(img.layer)),
    opacity: String(img.opacity),
    transform: `translate(-50%, -50%) rotate(${img.rotation}deg)`,
    transformOrigin: '50% 50%',
  };
}

/** Size of the letterboxed stage that fits inside a container while keeping the game's aspect ratio. */
export function fitStage(containerW: number, containerH: number, res: { width: number; height: number }) {
  const aspect = res.width / res.height;
  let w = containerW;
  let h = containerW / aspect;
  if (h > containerH) {
    h = containerH;
    w = containerH * aspect;
  }
  return { width: w, height: h, left: (containerW - w) / 2, top: (containerH - h) / 2 };
}
