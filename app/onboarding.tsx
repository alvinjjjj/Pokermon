import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
    Dimensions,
    FlatList,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    title: '追蹤你的 Pokemon 卡牌收藏',
    sub: '輕鬆管理你的每一張卡，隨時掌握市場價格變化',
    image: require('../assets/images/Onboarding_01.png'),
  },
  {
    id: '2',
    title: '即時價格追蹤',
    sub: '連接全球市場數據，讓你的收藏價值一目了然',
    image: require('../assets/images/Onboarding_02.png'),
  },
  {
    id: '3',
    title: '加入香港收藏家社群',
    sub: '與其他收藏家交流、換卡\n一起發掘最珍貴的卡牌',
    image: require('../assets/images/Onboarding_03.png'),
  },
];

export default function OnboardingScreen() {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.logo}>HKCARDCOLL</Text>

      <FlatList
  ref={flatListRef}
  data={SLIDES}
  horizontal
  pagingEnabled
  showsHorizontalScrollIndicator={false}
  keyExtractor={item => item.id}
  style={{ flexGrow: 0 }}  // 加这行
  onMomentumScrollEnd={e => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    setActiveIndex(index);
  }}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <Image source={item.image} style={styles.cardImage} resizeMode="contain" />
            <Text style={styles.slideTitle}>{item.title}</Text>
            <Text style={styles.slideSub}>{item.sub}</Text>
          </View>
        )}
      />

      {/* Dots */}
      <View style={styles.dotsRow}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[styles.dot, activeIndex === i && styles.dotActive]} />
        ))}
      </View>

      {/* Buttons */}
      <View style={styles.btnWrap}>
        <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/login')}>
          <Text style={styles.loginBtnText}>Login</Text>
        </TouchableOpacity>
        <View style={styles.registerRow}>
          <Text style={styles.registerText}>還沒有帳戶？ </Text>
          <TouchableOpacity onPress={() => router.push('/register')}>
            <Text style={styles.registerLink}>立即註冊</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  logo: { fontSize: 16, fontWeight: '900', letterSpacing: 4, color: '#101828', textAlign: 'center', paddingTop: 16, marginBottom: 8 },
  slide: { width, paddingHorizontal: 24, alignItems: 'center' },
  cardImage: { width: width - 80, height: (width - 80) * 1.1, marginVertical: 20, borderRadius: 16 },
  slideTitle: { fontSize: 22, fontWeight: '800', color: '#101828', textAlign: 'center', marginBottom: 10 },
  slideSub: { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 24 },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 20, marginBottom: 28 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E5E7EB' },
  dotActive: { backgroundColor: '#FF6900', width: 20 },
  btnWrap: { paddingHorizontal: 24, paddingBottom: 32 },
  loginBtn: { backgroundColor: '#FF6900', borderRadius: 50, paddingVertical: 18, alignItems: 'center', marginBottom: 20 },
  loginBtnText: { fontSize: 17, fontWeight: '600', color: '#fff' },
  registerRow: { flexDirection: 'row', justifyContent: 'center' },
  registerText: { fontSize: 14, color: '#9CA3AF' },
  registerLink: { fontSize: 14, color: '#FF6900', fontWeight: '700' },
});