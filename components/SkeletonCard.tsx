/**
 * SkeletonCard — animated shimmer placeholder
 * Used while data is loading in Portfolio, Marketplace, Search grids.
 *
 * Usage:
 *   <SkeletonCard width={CARD_W} height={220} />
 *   <SkeletonRow width="100%" height={72} borderRadius={12} />
 */

import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';

type Props = {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
};

export function SkeletonCard({ width, height, borderRadius = 16, style }: Props) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] });

  return (
    <Animated.View
      style={[
        { width: width as any, height, borderRadius, backgroundColor: '#E5E7EB', opacity },
        style,
      ]}
    />
  );
}

/** Grid of skeleton cards — matches the 2-column grid layout */
export function SkeletonGrid({
  count = 6,
  cardWidth,
  cardHeight = 220,
  columns = 2,
  gap = 16,
  paddingHorizontal = 16,
}: {
  count?: number;
  cardWidth: number;
  cardHeight?: number;
  columns?: number;
  gap?: number;
  paddingHorizontal?: number;
}) {
  const rows = Math.ceil(count / columns);
  return (
    <View style={{ paddingHorizontal, paddingTop: 16 }}>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <View key={rowIdx} style={{ flexDirection: 'row', gap, marginBottom: gap }}>
          {Array.from({ length: columns }).map((__, colIdx) => (
            rowIdx * columns + colIdx < count ? (
              <View key={colIdx} style={{ gap: 8 }}>
                {/* Image area */}
                <SkeletonCard width={cardWidth} height={cardWidth * 1.1} borderRadius={12} />
                {/* Title line */}
                <SkeletonCard width={cardWidth * 0.75} height={14} borderRadius={6} />
                {/* Subtitle line */}
                <SkeletonCard width={cardWidth * 0.5} height={11} borderRadius={6} />
                {/* Price line */}
                <SkeletonCard width={cardWidth * 0.4} height={18} borderRadius={6} />
              </View>
            ) : <View key={colIdx} style={{ width: cardWidth }} />
          ))}
        </View>
      ))}
    </View>
  );
}

/** Single horizontal list skeleton row — for merchants / search results */
export function SkeletonRow({
  width,
  height = 72,
  borderRadius = 12,
  marginBottom = 12,
}: {
  width: number | string;
  height?: number;
  borderRadius?: number;
  marginBottom?: number;
}) {
  return (
    <SkeletonCard
      width={width}
      height={height}
      borderRadius={borderRadius}
      style={{ marginBottom }}
    />
  );
}
