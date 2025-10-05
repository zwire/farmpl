// djb2 hash function
const hashString = (str: string): number => {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) + hash + char; /* hash * 33 + c */
  }
  return hash;
};

// A fixed color palette. Using HSL colors for easy manipulation.
const PALETTE = [
  { h: 210, s: 70, l: 55 }, // Blue
  { h: 160, s: 60, l: 45 }, // Teal
  { h: 30, s: 70, l: 50 }, // Orange
  { h: 340, s: 70, l: 60 }, // Pink
  { h: 260, s: 50, l: 55 }, // Purple
  { h: 50, s: 60, l: 50 }, // Yellow-Orange
  { h: 120, s: 40, l: 50 }, // Green
  { h: 0, s: 60, l: 50 }, // Red
];

// Function to calculate luminance (YIQ formula)
const getLuminance = (r: number, g: number, b: number): number => {
  return (r * 299 + g * 587 + b * 114) / 1000;
};

// HSL to RGB conversion
const hslToRgb = (
  h: number,
  s: number,
  l: number,
): [number, number, number] => {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [255 * f(0), 255 * f(8), 255 * f(4)];
};

export interface CategoryColor {
  background: string;
  foreground: string;
}

export const colorForCategory = (name: string): CategoryColor => {
  if (!name || name === "その他") {
    // A neutral color for "Other" or uncategorized
    return { background: "#E5E7EB", foreground: "#1F2937" }; // gray-200, gray-800
  }

  const hash = Math.abs(hashString(name));
  const color = PALETTE[hash % PALETTE.length];
  const [r, g, b] = hslToRgb(color.h, color.s, color.l);

  const background = `hsl(${color.h}, ${color.s}%, ${color.l}%)`;

  // Determine foreground color based on luminance
  const luminance = getLuminance(r, g, b);
  const foreground = luminance > 128 ? "#000000" : "#FFFFFF";

  return { background, foreground };
};
