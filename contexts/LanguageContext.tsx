/**
 * LanguageContext.tsx
 *
 * Provides a React context to read and switch the app language.
 * Wrap your root layout with <LanguageProvider> once, then use
 * useLanguage() anywhere to get the current code and switch it.
 *
 * Example — wrap in app/_layout.tsx:
 *   import { LanguageProvider } from '../contexts/LanguageContext';
 *   // inside JSX:
 *   <LanguageProvider><Stack /></LanguageProvider>
 *
 * Example — language picker in settings:
 *   import { useLanguage } from '../contexts/LanguageContext';
 *   import { SUPPORTED_LANGUAGES } from '../lib/i18n';
 *   const { language, setLanguage } = useLanguage();
 *   // render SUPPORTED_LANGUAGES.map(...) and call setLanguage(code) on press
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import '../lib/i18n';                            // must import to initialise i18next
import { changeLanguage, getSavedLanguage, LanguageCode, SUPPORTED_LANGUAGES } from '../lib/i18n';

type LanguageContextValue = {
  language: LanguageCode;
  setLanguage: (code: LanguageCode) => Promise<void>;
  supportedLanguages: typeof SUPPORTED_LANGUAGES;
  isLoading: boolean;
};

const LanguageContext = createContext<LanguageContextValue>({
  language: 'zh-HK',
  setLanguage: async () => {},
  supportedLanguages: SUPPORTED_LANGUAGES,
  isLoading: true,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLang] = useState<LanguageCode>('zh-HK');
  const [isLoading, setIsLoading] = useState(true);

  // Load saved language on mount
  useEffect(() => {
    getSavedLanguage().then(async (code) => {
      await changeLanguage(code);
      setLang(code);
      setIsLoading(false);
    });
  }, []);

  const setLanguage = async (code: LanguageCode) => {
    await changeLanguage(code);
    setLang(code);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, supportedLanguages: SUPPORTED_LANGUAGES, isLoading }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
