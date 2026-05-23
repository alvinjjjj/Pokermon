/**
 * i18n.ts — Internationalization setup using i18next + react-i18next
 *
 * Language detection priority:
 *   1. User's saved preference (AsyncStorage) — if they've changed it before
 *   2. Device locale (expo-localization) — first launch
 *   3. Fallback: 'zh-HK'
 *
 * Supported languages:
 *   zh-HK  Traditional Chinese (Hong Kong)
 *   en     English
 *   ja     Japanese
 *   zh-CN  Simplified Chinese
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from 'i18next';
import { NativeModules, Platform } from 'react-native';
import { initReactI18next } from 'react-i18next';

import en from '../locales/en.json';
import ja from '../locales/ja.json';
import zhCN from '../locales/zh-CN.json';
import zhHK from '../locales/zh-HK.json';

const LANGUAGE_KEY = '@app_language';

export const SUPPORTED_LANGUAGES = [
  { code: 'zh-HK', label: '繁體中文', flag: '🇭🇰' },
  { code: 'en',    label: 'English',  flag: '🇺🇸' },
  { code: 'ja',    label: '日本語',   flag: '🇯🇵' },
  { code: 'zh-CN', label: '简体中文', flag: '🇨🇳' },
] as const;

export type LanguageCode = typeof SUPPORTED_LANGUAGES[number]['code'];

const SUPPORTED_CODES = SUPPORTED_LANGUAGES.map(l => l.code);

/**
 * Map device locale to one of our supported codes.
 * Examples:
 *   'zh-Hant-HK' → 'zh-HK'
 *   'zh-Hant'    → 'zh-HK'
 *   'zh-Hans'    → 'zh-CN'
 *   'zh-CN'      → 'zh-CN'
 *   'ja-JP'      → 'ja'
 *   'en-US'      → 'en'
 *   'fr-FR'      → 'en'  (fallback)
 */
function mapLocaleToCode(locale: string): LanguageCode {
  const l = locale.toLowerCase();

  if (l.startsWith('zh-hant') || l === 'zh-hk' || l === 'zh-tw' || l === 'zh-mo') return 'zh-HK';
  if (l.startsWith('zh-hans') || l === 'zh-cn' || l === 'zh-sg')                   return 'zh-CN';
  if (l.startsWith('zh'))                                                            return 'zh-HK';
  if (l.startsWith('ja'))                                                            return 'ja';
  if (l.startsWith('en'))                                                            return 'en';

  return 'zh-HK'; // default fallback
}

/** Get device preferred language — works in Expo Go + bare workflow, no native module needed */
function getDeviceLanguage(): LanguageCode {
  // iOS: Settings bundle locale
  // Android: device locale from NativeModules
  const locale: string =
    (Platform.OS === 'ios'
      ? NativeModules.SettingsManager?.settings?.AppleLocale
        ?? NativeModules.SettingsManager?.settings?.AppleLanguages?.[0]
      : NativeModules.I18nManager?.localeIdentifier
    ) ?? 'zh-HK';
  return mapLocaleToCode(locale);
}

/**
 * Load language: saved preference → device locale → 'zh-HK'
 * First launch: no saved preference → use device locale and save it.
 */
export async function getSavedLanguage(): Promise<LanguageCode> {
  try {
    const saved = await AsyncStorage.getItem(LANGUAGE_KEY);
    if (saved && SUPPORTED_CODES.includes(saved as LanguageCode)) {
      return saved as LanguageCode;
    }
    // First launch — detect from device and save
    const deviceCode = getDeviceLanguage();
    await AsyncStorage.setItem(LANGUAGE_KEY, deviceCode);
    return deviceCode;
  } catch {
    return getDeviceLanguage();
  }
}

/** Persist + apply a language change */
export async function changeLanguage(code: LanguageCode): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_KEY, code);
  await i18n.changeLanguage(code);
}

// ── Initialize i18next (synchronous, lng set async after mount) ───────────────

i18n.use(initReactI18next).init({
  // compatibilityJSON 'v3' option was removed in i18next v22+. The default
  // JSON format (v4) is what our locale files already use.
  resources: {
    'zh-HK': { translation: zhHK },
    'en':    { translation: en   },
    'ja':    { translation: ja   },
    'zh-CN': { translation: zhCN },
  },
  // Start with device language immediately (synchronous best-guess)
  // LanguageProvider will override with the saved preference after AsyncStorage loads
  lng:          getDeviceLanguage(),
  fallbackLng:  'zh-HK',
  interpolation: { escapeValue: false },
});

export default i18n;
