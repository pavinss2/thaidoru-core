import { z } from 'zod';

// The small fixed palette every member color rolls up to, so apps like
// Cheki Tracker can group and filter by color. The fancy name stays on
// `color.name` for display (e.g. "Matcha Latte Green" -> shade "Green").
export const COLOR_SHADES = [
  'Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple', 'Pink', 'Brown', 'White', 'Gray', 'Black'
] as const;
export const ColorShadeEnum = z.enum(COLOR_SHADES);
export type ColorShade = z.infer<typeof ColorShadeEnum>;

// One standard hex per shade, for UIs that want a uniform swatch.
export const SHADE_HEX: Record<ColorShade, string> = {
  Red: '#e53935',
  Orange: '#fb8c00',
  Yellow: '#fdd835',
  Green: '#43a047',
  Blue: '#1e88e5',
  Purple: '#8e24aa',
  Pink: '#ec407a',
  Brown: '#795548',
  White: '#ffffff',
  Gray: '#9e9e9e',
  Black: '#000000'
};

// Words that point to a shade. Plain color words win over flavour words,
// so "Blue Cream Soda" is Blue, not Yellow.
const BASIC: Record<string, ColorShade> = {
  red: 'Red', orange: 'Orange', yellow: 'Yellow', green: 'Green', blue: 'Blue',
  purple: 'Purple', violet: 'Purple', pink: 'Pink', brown: 'Brown', white: 'White',
  gray: 'Gray', grey: 'Gray', silver: 'Gray', black: 'Black'
};
const ALIASES: Record<string, ColorShade> = {
  cream: 'Yellow', lemon: 'Yellow', vanilla: 'Yellow', gold: 'Yellow', golden: 'Yellow', banana: 'Yellow', mustard: 'Yellow',
  mint: 'Green', teal: 'Green', emerald: 'Green', kiwi: 'Green', matcha: 'Green', lime: 'Green', olive: 'Green', jade: 'Green',
  sky: 'Blue', skyblue: 'Blue', navy: 'Blue', cyan: 'Blue', aqua: 'Blue', turquoise: 'Blue', sapphire: 'Blue', azure: 'Blue',
  lavender: 'Purple', lilac: 'Purple', grape: 'Purple', magenta: 'Purple', plum: 'Purple', amethyst: 'Purple',
  rose: 'Pink', sakura: 'Pink', salmon: 'Pink', peach: 'Orange', fuchsia: 'Pink', strawberry: 'Pink',
  cherry: 'Red', crimson: 'Red', scarlet: 'Red', ruby: 'Red', wine: 'Red', burgundy: 'Red', coral: 'Red',
  tangerine: 'Orange', apricot: 'Orange', amber: 'Orange',
  chocolate: 'Brown', coffee: 'Brown', mocha: 'Brown', caramel: 'Brown', beige: 'Brown',
  snow: 'White', ivory: 'White', pearl: 'White', milk: 'White',
  charcoal: 'Black', ebony: 'Black', onyx: 'Black'
};

// Names that mean "no color known".
const NO_COLOR = new Set(['', 'n/a', 'na', 'none', 'graduated', 'theme color', 'unknown', '-']);

function shadeFromHex(hex: string): ColorShade | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (d < 0.08) return l > 0.85 ? 'White' : l < 0.2 ? 'Black' : 'Gray';
  const s = d / (1 - Math.abs(2 * l - 1));
  if (l > 0.93) return 'White';
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  if (h < 15 || h >= 345) return l > 0.75 ? 'Pink' : 'Red';
  if (h < 40) return l < 0.35 || s < 0.35 ? 'Brown' : 'Orange';
  if (h < 70) return 'Yellow';
  if (h < 165) return 'Green';
  if (h < 250) return 'Blue';
  if (h < 290) return 'Purple';
  return 'Pink';
}

/** Best guess of the main shade from a color's name, falling back to its hex. */
export function guessShade(name: string | null | undefined, hex?: string | null): ColorShade | null {
  const clean = (name || '').trim().toLowerCase();
  if (NO_COLOR.has(clean)) return null;
  const words = clean.split(/[^a-z]+/).filter(Boolean);
  // Last plain color word wins ("Light Blue" -> Blue), then the last flavour word.
  for (const table of [BASIC, ALIASES]) {
    for (let i = words.length - 1; i >= 0; i--) {
      const hit = table[words[i]];
      if (hit) return hit;
    }
  }
  return hex ? shadeFromHex(hex) : null;
}
