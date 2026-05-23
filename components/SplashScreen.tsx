import LottieView from 'lottie-react-native';
import { StyleSheet, View } from 'react-native';

/**
 * Full-screen branded splash. The Pokéball Lottie loops centered on white,
 * matching the in-app <Loader /> for a consistent feel.
 *
 * (Previously this was an animated WebP at assets/images/roading.webp; we
 * switched to Lottie so all loading animations across the app share the
 * same Pokéball motif.)
 */
export default function SplashScreen() {
  return (
    <View style={styles.container}>
      <LottieView
        source={require('../assets/lottie/pokeball.json')}
        autoPlay
        loop
        speed={1}
        style={styles.lottie}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',          // brand black
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 30% smaller than before (220 → 154). Better visual balance against the
  // bold solid-colour background.
  lottie: { width: 154, height: 154 },
});
