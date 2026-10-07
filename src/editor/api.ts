import type { TstvnApi } from '../shared/api';

declare global {
  interface Window {
    tstvn: TstvnApi;
  }
}

export const api: TstvnApi = window.tstvn;

/** Turns IPC errors ("Error invoking remote method 'x': Error: message") into the plain message. */
export function errorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  return raw.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '');
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function formatTime(t: number): string {
  return new Date(t).toLocaleString();
}
