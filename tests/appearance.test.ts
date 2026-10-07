// Light & Dark palettes must keep text readable (WCAG 2.1 contrast), checked straight from styles.css.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const css = fs.readFileSync('src/editor/styles.css', 'utf8');

function block(selectorStart: string): Record<string, string> {
  const i = css.indexOf(selectorStart);
  if (i < 0) throw new Error(`block ${selectorStart} not found`);
  const body = css.slice(css.indexOf('{', i) + 1, css.indexOf('}', i));
  const vars: Record<string, string> = {};
  for (const m of body.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) vars[m[1]] = m[2];
  return vars;
}

function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

const palettes = { dark: block(':root,'), light: block("[data-theme='light'] {") };

describe('appearance contrast', () => {
  for (const [name, p] of Object.entries(palettes)) {
    it(`${name} mode: body text ≥ 7:1, secondary text ≥ 4.5:1, hints ≥ 3:1`, () => {
      for (const bg of ['--bg0', '--bg1', '--bg2']) {
        expect(contrast(p['--text'], p[bg]), `text on ${bg}`).toBeGreaterThanOrEqual(7);
        expect(contrast(p['--muted'], p[bg]), `muted on ${bg}`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(p['--faint'], p[bg]), `faint on ${bg}`).toBeGreaterThanOrEqual(3);
      }
      expect(contrast(p['--text'], p['--bg3']), 'text on hover bg').toBeGreaterThanOrEqual(4.5);
    });
  }
  it('both palettes define the same variables', () => {
    for (const k of Object.keys(palettes.light)) expect(palettes.dark[k], k).toBeDefined();
  });
});
