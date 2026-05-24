/**
 * HKCardColl · Color Tokens
 *
 * Canonical brand spec lineage:
 * - Vol.01 (foundation palette): brand/HKCardColl_Brand_Book_Vol.01.pdf
 * - Addendum v01.1 (functional + dark mode Lacquer): brand/brand_book_addendum_v01.md
 * - Vol.03 (UI mapping, light × dark, 8 screens): brand/Vol.03 PDF
 *
 * One hex for Card Orange across both modes — brand recognition by hue.
 * No pure black (#000) or pure white (#FFF) for text — warm palette throughout.
 */

export type ColorTokens = {
  brand: {
    orange: string;        // Card Orange — single hero accent
    peach: string;         // Light warning bg tint
    warmdark: string;      // Dark warning bg
  };
  surface: {
    base: string;          // App canvas
    section: string;       // Section bg
    card: string;          // Card / list row
    elevated: string;      // Modal / floating
  };
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    mute: string;          // Disabled
    inverse: string;       // On brand fill
  };
  border: {
    default: string;
    strong: string;
  };
  state: {
    upTint: string;        // Sage decorative ≥14pt (per A.1)
    upStrong: string;      // Sage body (AA-pass, per A.1)
    down: string;          // Brick
    info: string;          // Slate
    warn: string;          // = brand.orange (dual-weight per A.6)
  };
  overlay: {
    light: string;
    medium: string;
    strong: string;
  };
};

export const lightColors: ColorTokens = {
  brand: {
    orange: '#FF6A1F',
    peach: '#FFF1E5',
    warmdark: '#2A1F18',
  },
  surface: {
    base: '#FFFFFF',
    section: '#F9FAFB',
    card: '#FFFFFF',
    elevated: '#FFFFFF',
  },
  text: {
    primary: '#1A1814',
    secondary: '#6B7280',
    tertiary: '#9CA3AF',
    mute: '#1A181499',
    inverse: '#F6F2EA',
  },
  border: {
    default: '#E5E7EB',
    strong: '#D1D5DB',
  },
  state: {
    upTint: '#5B8C6B',
    upStrong: '#4A7558',
    down: '#C2553D',
    info: '#5C7A9A',
    warn: '#FF6A1F',
  },
  overlay: {
    light: 'rgba(0,0,0,0.4)',
    medium: 'rgba(0,0,0,0.5)',
    strong: 'rgba(0,0,0,0.6)',
  },
};

export const darkColors: ColorTokens = {
  brand: {
    orange: '#FF6A1F',     // SAME — one hex, two modes
    peach: '#FFF1E5',
    warmdark: '#2A1F18',
  },
  surface: {
    base: '#0E0C0A',       // Sumi
    section: '#1A1714',    // Surface-1
    card: '#25211C',       // Surface-2
    elevated: '#33302A',   // Surface-3 (hover/pressed)
  },
  text: {
    primary: '#F0EBE0',    // Paper
    secondary: '#A89E8C',  // Paper-soft
    tertiary: '#7A7060',
    mute: '#F0EBE080',
    inverse: '#1A1814',
  },
  border: {
    default: '#2E2924',
    strong: '#3A352F',
  },
  state: {
    upTint: '#7AB089',
    upStrong: '#7AB089',   // tint=strong @ dark per A.1
    down: '#D26F5A',
    info: '#7A9AB8',
    warn: '#FF6A1F',       // SAME
  },
  overlay: {
    light: 'rgba(0,0,0,0.5)',
    medium: 'rgba(0,0,0,0.65)',
    strong: 'rgba(0,0,0,0.8)',
  },
};

export type ThemeMode = 'light' | 'dark';
export const THEME_STORAGE_KEY = 'theme_mode_v1';
