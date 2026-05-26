import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Animated,
    Dimensions,
    Easing,
    FlatList,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { type ColorTokens } from '../constants/colors';

const { width, height } = Dimensions.get('window');

// Hero zone = top section painted with soft orange. The mockup image floats
// inside it; the caption + button live on a clean white bottom section.
// This split keeps each region doing ONE thing — much calmer than the
// previous blob + card + shadow combo.
const HERO_HEIGHT   = Math.min(height * 0.52, 460);
// Compound scale: 0.85 × 0.90 × 1.20 ≈ 0.918 of original base.
// Final ~8% smaller than original, with comfortable spacing for the new
// decorative card stack behind the main image.
const MOCKUP_WIDTH  = Math.min(width - 96, 280) * 0.85 * 0.90 * 1.20;
// Aspect 1.26 (= 1.4 × 0.9) — tightened a further 10% in vertical so the
// `contain` mode leaves almost no dead space above/below the image content.
const MOCKUP_HEIGHT = MOCKUP_WIDTH * 1.26;

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const router = useRouter();
  const { t } = useTranslation();

  // Subtle float — adds life without competing for attention.
  const floatAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 2400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [floatAnim]);
  const translateY = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });

  const SLIDES = [
    { id: '1', tag: t('onboarding.slide1Tag'), title: t('onboarding.slide1Title'), sub: t('onboarding.slide1Sub'), image: require('../assets/images/Onboarding_001.jpg') },
    { id: '2', tag: t('onboarding.slide2Tag'), title: t('onboarding.slide2Title'), sub: t('onboarding.slide2Sub'), image: require('../assets/images/Onboarding_002.jpg') },
    { id: '3', tag: t('onboarding.slide3Tag'), title: t('onboarding.slide3Title'), sub: t('onboarding.slide3Sub'), image: require('../assets/images/Onboarding_003.jpg') },
  ];

  return (
    <View style={styles.root}>
      {/* Soft single-layer gradient — peach fades into white. Simpler and
          cleaner than the multi-layer version.
          Decorative gradient stops kept raw — artwork hues, not semantic. */}
      <LinearGradient
        colors={['#FFE9D2', '#FFF6EB', '#FFFFFF']}
        locations={[0, 0.55, 1]}
        style={styles.heroGradient}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <Image
            source={require('../assets/images/Logo.png')}
            style={styles.logoImg}
            resizeMode="contain"
          />
          <TouchableOpacity
            onPress={() => router.replace('/login')}
            style={styles.skipBtn}
            accessibilityLabel={t('onboarding.skip')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
          </TouchableOpacity>
        </View>

        {/* Pager — image + caption stack per slide */}
        <FlatList
          ref={flatListRef}
          data={SLIDES}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={item => item.id}
          style={styles.pager}
          onMomentumScrollEnd={e => {
            const index = Math.round(e.nativeEvent.contentOffset.x / width);
            setActiveIndex(index);
          }}
          renderItem={({ item }) => (
            <View style={styles.slide}>
              {/* Hero — improved TCG card stack:
                    • Back-left:  warm orange gradient card, larger tilt
                    • Back-right: peach card, smaller card peeks out top
                    • Front:      white mockup frame with strong shadow
                  Two small accent dots break the geometric monotony of
                  pure rectangles. */}
              <View style={styles.mockupZone}>
                {/* Subtle accent dots — break up the pure-rectangle look */}
                <View style={[styles.accent, styles.accentTopRight]} />
                <View style={[styles.accent, styles.accentBottomLeft]} />

                {/* Back-left tilted card with gradient — decorative hues, kept raw */}
                <LinearGradient
                  colors={['#FFD9B4', '#FFC089']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.decoCard, styles.decoLeft]}
                />
                {/* Back-right tilted card with gradient — decorative hues, kept raw */}
                <LinearGradient
                  colors={['#FFE89C', '#FFD66B']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.decoCard, styles.decoRight]}
                />

                <Animated.View style={[styles.mockupFrame, { transform: [{ translateY }] }]}>
                  <Image source={item.image} style={styles.mockupImg} resizeMode="contain" />
                </Animated.View>
              </View>

              {/* Caption — sits cleanly on white below the band */}
              <View style={styles.captionWrap}>
                <Text style={styles.tag}>{item.tag}</Text>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.sub}>{item.sub}</Text>
              </View>
            </View>
          )}
        />

        {/* Dots */}
        <View style={styles.dotsRow}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, activeIndex === i && styles.dotActive]} />
          ))}
        </View>

        {/* Bottom CTA */}
        <View style={styles.btnWrap}>
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={() => router.push('/login')}
            activeOpacity={0.85}
            accessibilityLabel={t('onboarding.login')}
          >
            <Text style={styles.loginBtnText}>{t('onboarding.login')}</Text>
          </TouchableOpacity>
          <View style={styles.registerRow}>
            <Text style={styles.registerText}>{t('onboarding.noAccount')}</Text>
            <TouchableOpacity onPress={() => router.push('/register')} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
              <Text style={styles.registerLink}>{t('onboarding.registerNow')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

function makeStyles(colors: ColorTokens) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.surface.card },
    safe: { flex: 1 },

    // ── Hero gradient ────────────────────────────────────────────────────────
    heroGradient: {
      position: 'absolute',
      top: 0, left: 0, right: 0,
      height: HERO_HEIGHT + 80,
    },

    // ── Top bar ──────────────────────────────────────────────────────────────
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 8,
    },
    logoImg: { height: 28, width: 128 },
    skipBtn: { paddingVertical: 6, paddingLeft: 12 },
    skipText: { fontSize: 15, color: colors.text.tertiary, fontWeight: '500' },

    // ── Pager ────────────────────────────────────────────────────────────────
    pager: { flexGrow: 0 },
    slide: { width, alignItems: 'center' },

    // ── Mockup zone — layered card stack ─────────────────────────────────────
    // Outer zone is wider/taller than the main card so the tilted deco cards
    // can peek out from behind without being clipped.
    mockupZone: {
      width: MOCKUP_WIDTH + 56,
      height: MOCKUP_HEIGHT + 32,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
      marginBottom: 28,
    },
    // ── Card stack improvements ──────────────────────────────────────────────
    // Each deco card is a LinearGradient instead of flat color, giving them
    // more visual depth. Sizes/angles tuned so the stack looks intentional
    // rather than random.
    decoCard: {
      position: 'absolute',
      borderRadius: 28,
      // shadowColor '#101828' kept (shadow convention)
      shadowColor: '#101828',
      shadowOpacity: 0.10,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 7 },
      elevation: 3,
    },
    // Slightly bigger so it peeks out generously on the left side.
    decoLeft: {
      width:  MOCKUP_WIDTH * 0.98,
      height: MOCKUP_HEIGHT * 0.98,
      transform: [{ rotate: '-9deg' }, { translateX: -26 }, { translateY: 8 }],
    },
    // Slightly smaller so it sits "behind/further" — adds depth perception.
    decoRight: {
      width:  MOCKUP_WIDTH * 0.94,
      height: MOCKUP_HEIGHT * 0.94,
      transform: [{ rotate:  '7deg' }, { translateX:  24 }, { translateY: 14 }],
    },
    // Tiny accent dots — just enough decoration to break the geometric
    // monotony without adding visual noise. Two only.
    accent: {
      position: 'absolute',
      borderRadius: 999,
      backgroundColor: colors.brand.orange,
    },
    accentTopRight:   { width: 10, height: 10, top:  -4, right:  10 },
    accentBottomLeft: { width:  8, height:  8, bottom: -2, left:  16, opacity: 0.7 },
    // Top "hero" frame — white card with the screenshot inside.
    mockupFrame: {
      width: MOCKUP_WIDTH,
      height: MOCKUP_HEIGHT,
      backgroundColor: colors.surface.card,
      borderRadius: 28,
      padding: 10,
      // shadowColor '#101828' kept (shadow convention)
      shadowColor: '#101828',
      shadowOpacity: 0.18,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 12 },
      elevation: 10,
    },
    mockupImg: { width: '100%', height: '100%', borderRadius: 18 },

    // ── Caption — centered, lives on white background below the curve ────────
    captionWrap: { paddingHorizontal: 32, alignItems: 'center' },
    tag: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.brand.orange,
      letterSpacing: 1.2,
      marginBottom: 12,
      textTransform: 'uppercase',
      textAlign: 'center',
    },
    title: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.text.primary,
      lineHeight: 32,
      marginBottom: 10,
      textAlign: 'center',
    },
    sub: {
      fontSize: 14,
      color: colors.text.secondary,
      lineHeight: 22,
      textAlign: 'center',
    },

    // ── Dots ─────────────────────────────────────────────────────────────────
    dotsRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
      marginTop: 'auto',
      marginBottom: 18,
    },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border.default },
    dotActive: { backgroundColor: colors.brand.orange, width: 22 },

    // ── Bottom CTA ───────────────────────────────────────────────────────────
    btnWrap: { paddingHorizontal: 24, paddingBottom: 16 },
    loginBtn: {
      backgroundColor: colors.brand.orange,
      borderRadius: 50,
      paddingVertical: 17,
      alignItems: 'center',
      marginBottom: 14,
      // brand-colored glow shadow — kept raw per shadow convention
      shadowColor: '#FF6900',
      shadowOpacity: 0.28,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
    // '#fff' kept raw — always-white on Card Orange
    loginBtnText: { fontSize: 17, fontWeight: '700', color: '#fff' },
    registerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
    registerText: { fontSize: 14, color: colors.text.tertiary },
    registerLink: { fontSize: 14, color: colors.brand.orange, fontWeight: '700' },
  });
}
