// Drag & drop payload types used inside the editor.
export const DND_ASSETS = 'application/x-tstvn-assets';
export const DND_CHARACTER = 'application/x-tstvn-character';
export const DND_ACTIONS = 'application/x-tstvn-actions';
export const DND_SCENE = 'application/x-tstvn-scene';
export const DND_FOLDER = 'application/x-tstvn-folder';

export function setDrag(e: React.DragEvent, type: string, data: unknown) {
  e.dataTransfer.setData(type, JSON.stringify(data));
  e.dataTransfer.effectAllowed = 'copyMove';
}

export function getDrag<T>(e: React.DragEvent, type: string): T | null {
  const raw = e.dataTransfer.getData(type);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function hasDrag(e: React.DragEvent, type: string): boolean {
  return Array.from(e.dataTransfer.types).includes(type);
}

export function hasOsFiles(e: React.DragEvent | DragEvent): boolean {
  return Array.from(e.dataTransfer?.types ?? []).includes('Files');
}
