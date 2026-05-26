/**
 * PSAGradeBadge — per Brand Book Addendum v01.1 §A.3
 *
 * Rule: NO color fills, NO gold, NO glitter. Typography + outline tells story.
 *   PSA 10 / BGS 10 Black Label → Card Orange 1px border + Ink text (hero)
 *   PSA 9 / BGS 9.5 and below   → Ink 1px border + Ink text
 *   Raw / 未評級                 → Mute 1px border + Mute text
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export type PSAGrade = '10' | '9' | 'raw';

type Props = {
  grade: PSAGrade;
  // Optional: companies like BGS / CGC — visual treatment same as PSA
  authority?: 'PSA' | 'BGS' | 'CGC';
  size?: 'sm' | 'md';
};

export function PSAGradeBadge({ grade, authority = 'PSA', size = 'md' }: Props) {
  const { colors } = useTheme();

  // Border color logic per A.3
  const borderColor =
    grade === '10' ? colors.brand.orange
    : grade === '9' ? colors.text.primary
    : colors.text.mute;

  // Text color: same as border for visual coherence
  const textColor =
    grade === 'raw' ? colors.text.tertiary : colors.text.primary;

  const isSmall = size === 'sm';
  const label = grade === 'raw' ? 'RAW' : `${authority} · ${grade}`;

  return (
    <View
      style={[
        styles.badge,
        {
          borderColor,
          paddingHorizontal: isSmall ? 6 : 8,
          paddingVertical: isSmall ? 2 : 4,
        },
      ]}
    >
      <Text
        style={[
          styles.label,
          {
            color: textColor,
            fontSize: isSmall ? 10 : 11,
            letterSpacing: isSmall ? 0.3 : 0.4,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    borderRadius: 3,
    alignSelf: 'flex-start',
  },
  label: {
    fontWeight: '600',
    textTransform: 'uppercase',
  },
});
