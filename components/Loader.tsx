import LottieView from 'lottie-react-native';
import { StyleSheet, View } from 'react-native';

/**
 * Branded Lottie loader. Replaces React Native's `<ActivityIndicator>` so
 * every spinner in the app is the same Pokéball animation — consistent
 * brand voice + cuter than the OS spinner.
 *
 * Sizes:
 *   • small   — 32px (inline buttons, list footer)
 *   • medium  — 56px (in-page loaders, modals)
 *   • large   — 96px (full-screen splash / empty state)
 *
 * Drop-in usage:
 *   <Loader />                  // medium, brand orange
 *   <Loader size="small" />     // for inline buttons
 *   <Loader color="#fff" />     // not used by Lottie directly (the JSON
 *                                  defines its own colors) — color prop
 *                                  is accepted for API parity with
 *                                  ActivityIndicator but does nothing here
 *
 * Performance: LottieView keeps its frames cached after first render, so
 * having multiple loaders on-screen doesn't multiply CPU cost.
 */
type Size = 'small' | 'medium' | 'large';

const SIZE_PX: Record<Size, number> = {
  small:  32,
  medium: 56,
  large:  96,
};

export default function Loader({
  size = 'medium',
  style,
}: {
  size?: Size;
  /** Optional override; usually leave alone. */
  color?: string;
  style?: any;
}) {
  const px = SIZE_PX[size];
  return (
    <View style={[styles.wrap, style]}>
      <LottieView
        source={require('../assets/lottie/pokeball.json')}
        autoPlay
        loop
        speed={1}
        style={{ width: px, height: px }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
