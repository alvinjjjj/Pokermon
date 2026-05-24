export type ColorTokens = {
  brand: { primary: string; primaryHover: string; primaryTint: string };
  surface: { base: string; subtle: string; muted: string; elevated: string };
  text: { primary: string; secondary: string; tertiary: string; disabled: string; inverse: string };
  border: { default: string; strong: string };
  success: { base: string; tint: string };
  danger: { base: string; tint: string };
  warning: { base: string; tint: string };
  info: { base: string; tint: string };
  overlay: { light: string; medium: string; strong: string };
};

export const lightColors: ColorTokens = {
  brand: { primary: '#FF6900', primaryHover: '#E55A00', primaryTint: '#FFF3E8' },
  surface: { base: '#FFFFFF', subtle: '#F9FAFB', muted: '#F3F4F6', elevated: '#FFFFFF' },
  text: { primary: '#101828', secondary: '#374151', tertiary: '#6B7280', disabled: '#9CA3AF', inverse: '#FFFFFF' },
  border: { default: '#E5E7EB', strong: '#D1D5DB' },
  success: { base: '#00A63E', tint: '#ECFDF5' },
  danger:  { base: '#E7000B', tint: '#FEF2F2' },
  warning: { base: '#F59E0B', tint: '#FFFBEB' },
  info:    { base: '#3B82F6', tint: '#EFF6FF' },
  overlay: { light: 'rgba(0,0,0,0.4)', medium: 'rgba(0,0,0,0.5)', strong: 'rgba(0,0,0,0.6)' },
};

export const darkColors: ColorTokens = {
  brand: { primary: '#FF7A1A', primaryHover: '#FF8F3D', primaryTint: '#2A1808' },
  surface: { base: '#0F1115', subtle: '#15181F', muted: '#1C2029', elevated: '#252A35' },
  text: { primary: '#F3F4F6', secondary: '#D1D5DB', tertiary: '#9CA3AF', disabled: '#6B7280', inverse: '#101828' },
  border: { default: '#2A2F3A', strong: '#3A4150' },
  success: { base: '#34D399', tint: '#052E1B' },
  danger:  { base: '#F87171', tint: '#3A0F0F' },
  warning: { base: '#FBBF24', tint: '#382A06' },
  info:    { base: '#60A5FA', tint: '#0F2440' },
  overlay: { light: 'rgba(0,0,0,0.6)', medium: 'rgba(0,0,0,0.75)', strong: 'rgba(0,0,0,0.85)' },
};

export type ThemeMode = 'light' | 'dark';
export const THEME_STORAGE_KEY = 'theme_mode_v1';
