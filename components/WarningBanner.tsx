/**
 * WarningBanner — per Brand Book Addendum v01.1 §A.6
 *
 * Card Orange dual-weight pattern:
 *   - Primary CTA = solid Orange fill (not this component)
 *   - Warning   = Peach (or Warm-dark) bg + Orange outline + Ink (or Paper) text
 *
 * Visual differentiation by FILL MODE, same hue family.
 *
 * Hierarchy rule (A.6):
 *   severity="block" → caller must disable CTA until warning resolved
 *   severity="info"  → CTA stays enabled; banner just above CTA, read first
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

type Props = {
  severity: 'block' | 'info';
  title?: string;
  message: string;
  // Caller can wire to icon if desired; default text-only
};

export function WarningBanner({ severity, title, message }: Props) {
  const { mode, colors } = useTheme();

  const backgroundColor = mode === 'dark' ? colors.brand.warmdark : colors.brand.peach;
  const borderColor = colors.brand.orange;
  const titleColor = colors.text.primary;
  const messageColor = colors.text.secondary;

  return (
    <View
      style={[
        styles.banner,
        { backgroundColor, borderColor },
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion={severity === 'block' ? 'assertive' : 'polite'}
    >
      <Text style={[styles.icon, { color: borderColor }]}>!</Text>
      <View style={styles.content}>
        {title ? (
          <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
        ) : null}
        <Text style={[styles.message, { color: messageColor }]}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 10,
    alignItems: 'flex-start',
  },
  icon: {
    fontSize: 16,
    fontWeight: '700',
    width: 18,
    textAlign: 'center',
    lineHeight: 18,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
  },
});
