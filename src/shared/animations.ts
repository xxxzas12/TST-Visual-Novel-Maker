// Animation presets shared by the editor (dropdowns) and runtime (implementation).

export interface PresetOption {
  value: string;
  label: string;
}

export const TRANSITIONS: PresetOption[] = [
  { value: 'none', label: 'None (instant)' },
  { value: 'fade', label: 'Fade' },
  { value: 'slide-left', label: 'Slide Left' },
  { value: 'slide-right', label: 'Slide Right' },
  { value: 'slide-up', label: 'Slide Up' },
  { value: 'slide-down', label: 'Slide Down' },
  { value: 'zoom-in', label: 'Zoom In' },
  { value: 'zoom-out', label: 'Zoom Out' },
  { value: 'flash', label: 'Flash' },
];

export const ENTER_ANIMATIONS: PresetOption[] = [
  { value: 'none', label: 'None' },
  { value: 'fade', label: 'Fade In' },
  { value: 'slide-left', label: 'Slide from Left' },
  { value: 'slide-right', label: 'Slide from Right' },
  { value: 'slide-up', label: 'Rise Up' },
  { value: 'zoom', label: 'Zoom In' },
  { value: 'bounce', label: 'Bounce In' },
];

export const EXIT_ANIMATIONS: PresetOption[] = [
  { value: 'none', label: 'None' },
  { value: 'fade', label: 'Fade Out' },
  { value: 'slide-left', label: 'Slide to Left' },
  { value: 'slide-right', label: 'Slide to Right' },
  { value: 'slide-down', label: 'Sink Down' },
  { value: 'zoom', label: 'Zoom Out' },
];

export const EMPHASIS_ANIMATIONS: PresetOption[] = [
  { value: 'shake', label: 'Shake' },
  { value: 'bounce', label: 'Bounce' },
  { value: 'jump', label: 'Jump' },
  { value: 'pulse', label: 'Pulse' },
  { value: 'spin', label: 'Spin (Rotate)' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'custom', label: 'Custom…' },
];

export const SCREEN_EFFECTS: PresetOption[] = [
  { value: 'shake', label: 'Screen Shake' },
  { value: 'flash', label: 'White Flash' },
  { value: 'fade-black', label: 'Fade to Black and Back' },
];

export const EASINGS: PresetOption[] = [
  { value: 'ease', label: 'Smooth' },
  { value: 'linear', label: 'Linear' },
  { value: 'ease-in', label: 'Ease In' },
  { value: 'ease-out', label: 'Ease Out' },
  { value: 'ease-in-out', label: 'Ease In-Out' },
  { value: 'back', label: 'Overshoot' },
];

export function easingToCss(easing: string | undefined): string {
  switch (easing) {
    case 'linear':
    case 'ease-in':
    case 'ease-out':
    case 'ease-in-out':
      return easing;
    case 'back':
      return 'cubic-bezier(0.34, 1.56, 0.64, 1)';
    default:
      return 'ease';
  }
}
