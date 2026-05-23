/**
 * LanguagePicker.tsx
 *
 * A ready-to-use language selection UI. Drop it into the Settings screen.
 *
 * Usage in settings.tsx:
 *   import LanguagePicker from '../../components/LanguagePicker';
 *   // inside JSX (e.g. in a new section):
 *   <LanguagePicker />
 */

import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLanguage } from '../contexts/LanguageContext';

export default function LanguagePicker() {
  const { language, setLanguage, supportedLanguages } = useLanguage();

  return (
    <View style={styles.container}>
      {supportedLanguages.map((lang, index) => {
        const isActive = language === lang.code;
        const isLast   = index === supportedLanguages.length - 1;
        return (
          <React.Fragment key={lang.code}>
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => setLanguage(lang.code)}
            >
              <Text style={styles.flag}>{lang.flag}</Text>
              <Text style={[styles.label, isActive && styles.labelActive]}>
                {lang.label}
              </Text>
              {isActive && (
                <Text style={styles.check}>✓</Text>
              )}
            </Pressable>
            {!isLast && <View style={styles.separator} />}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 15,
    gap: 14,
  },
  rowPressed: {
    backgroundColor: '#FFF3E8',
  },
  flag: {
    fontSize: 22,
    width: 28,
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    color: '#101828',
    flex: 1,
  },
  labelActive: {
    fontWeight: '700',
    color: '#FF6900',
  },
  check: {
    fontSize: 16,
    color: '#FF6900',
    fontWeight: '700',
  },
  separator: {
    height: 0.5,
    backgroundColor: '#F3F4F6',
    marginLeft: 58,
  },
});
