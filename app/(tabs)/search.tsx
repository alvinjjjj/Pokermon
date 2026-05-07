import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../../components/Header';
import { supabase } from '../../lib/supabase';

const { width } = Dimensions.get('window');
const CARD_W = (width - 48) / 2;
const API_KEY = 'b58e91e7-d37e-48af-a472-09f364116acd';

type PokemonCard = {
  id: string;
  name: string;
  set: { name: string; series: string };
  rarity?: string;
  number: string;
  images: { small: string; large: string };
  cardmarket?: { prices?: { averageSellPrice?: number } };
  tcgplayer?: { prices?: { holofoil?: { market?: number }; normal?: { market?: number } } };
};

const CATEGORIES = ['全部', 'EX', 'GX', 'V', 'VMAX', 'ex'];
const LANGUAGES = [
  { label: '🌍 全部', value: '' },
  { label: '🇺🇸 英版', value: 'en' },
  { label: '🇯🇵 日版', value: 'ja' },
  { label: '🇨🇳 中版', value: 'zh-Hant' },
];
const PSA_GRADES = ['全部', 'Raw', '1', '2', '3', '4', '5', '6', '7', '8', '9', '9.5', '10'];

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [cards, setCards] = useState<PokemonCard[]>([]);
  const [hotCards, setHotCards] = useState<PokemonCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [hotLoading, setHotLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('全部');
  const [activeLang, setActiveLang] = useState('');
  const [activePSA, setActivePSA] = useState('全部');
  const [addedCards, setAddedCards] = useState<Set<string>>(new Set());
  const [showPSAModal, setShowPSAModal] = useState(false);
  const [selectedCard, setSelectedCard] = useState<PokemonCard | null>(null);
  const [selectedPSA, setSelectedPSA] = useState('Raw');
  const [adding, setAdding] = useState(false);
  const searchTimeout = useRef<any>(null);

  useEffect(() => {
    fetchHotCards();
  }, []);

  const fetchHotCards = async () => {
    setHotLoading(true);
    try {
      const hotNames = ['Charizard', 'Pikachu', 'Mewtwo', 'Umbreon', 'Rayquaza'];
      const randomName = hotNames[Math.floor(Math.random() * hotNames.length)];
      const res = await fetch(
        `https://api.pokemontcg.io/v2/cards?q=name:"${randomName}"&pageSize=10&orderBy=-set.releaseDate`,
        { headers: { 'X-Api-Key': API_KEY } }
      );
      const data = await res.json();
      setHotCards(data.data || []);
    } catch (e) {
      console.error(e);
    }
    setHotLoading(false);
  };

  const handleSearch = (text: string) => {
    setQuery(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      searchCards(text);
    }, 600);
  };

  const searchCards = async (text: string, category = activeCategory, lang = activeLang) => {
    if (text.length < 2) { setCards([]); return; }
    setLoading(true);
    try {
      let q = `name:"${text}*"`;
      if (category !== '全部') q += ` subtypes:${category}`;
      const url = `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=20&orderBy=-set.releaseDate`;
      const res = await fetch(url, { headers: { 'X-Api-Key': API_KEY } });
      const data = await res.json();
      setCards(data.data || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const getPrice = (card: PokemonCard): number => {
    return card.cardmarket?.prices?.averageSellPrice ||
      card.tcgplayer?.prices?.holofoil?.market ||
      card.tcgplayer?.prices?.normal?.market ||
      0;
  };

  const openPSAModal = (card: PokemonCard) => {
    setSelectedCard(card);
    setSelectedPSA('Raw');
    setShowPSAModal(true);
  };

  const confirmAddToCollection = async () => {
    if (!selectedCard) return;
    setAdding(true);

    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) {
        alert('請先登入');
        setAdding(false);
        return;
      }

      const price = getPrice(selectedCard);

      const { error } = await supabase
        .from('user_collection')
        .insert({
          user_id: user.id,
          card_id: selectedCard.id,
          card_name: selectedCard.name,
          set_name: selectedCard.set.name,
          purchase_price: price,
          current_price: price,
          quantity: 1,
          psa_grade: selectedPSA,
        });

      if (!error) {
        setAddedCards(prev => new Set([...prev, selectedCard.id]));
        setShowPSAModal(false);
        alert(`✅ ${selectedCard.name} (${selectedPSA === 'Raw' ? 'Raw' : `PSA ${selectedPSA}`}) 已加入收藏！`);
      } else {
        console.error('Supabase error:', error);
        alert('加入失敗，請重試');
      }
    } catch (e) {
      console.error(e);
      alert('加入失敗，請重試');
    } finally {
      setAdding(false);
    }
  };

  const renderCard = ({ item }: { item: PokemonCard }) => {
    const price = getPrice(item);
    const isAdded = addedCards.has(item.id);
    return (
      <View style={styles.card}>
        <Image source={{ uri: item.images.small }} style={styles.cardImage} resizeMode="contain" />
        <View style={styles.cardBody}>
          <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.cardSet} numberOfLines={1}>{item.set.name}</Text>
          {item.rarity && <Text style={styles.cardRarity} numberOfLines={1}>{item.rarity}</Text>}
          <Text style={styles.cardPrice}>
            {price > 0 ? `HK$${(price * 7.8).toFixed(0)}` : '價格待定'}
          </Text>
          <TouchableOpacity
            style={[styles.addBtn, isAdded && styles.addBtnAdded]}
            onPress={() => !isAdded && openPSAModal(item)}
          >
            <Text style={styles.addBtnText}>{isAdded ? '✓ 已加入' : '+ 加入收藏'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Header />

      {/* Search Bar */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="搜尋 Pokemon 卡牌..."
            placeholderTextColor="#9CA3AF"
            value={query}
            onChangeText={handleSearch}
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); setCards([]); }}>
              <Text style={styles.clearBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Language Filter */}
      <View style={styles.filterWrap}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={LANGUAGES}
          keyExtractor={item => item.value}
          contentContainerStyle={styles.filterRow}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.langBtn, activeLang === item.value && styles.langBtnActive]}
              onPress={() => { setActiveLang(item.value); if (query) searchCards(query, activeCategory, item.value); }}
            >
              <Text style={[styles.langText, activeLang === item.value && styles.langTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Category Filter */}
      <View style={styles.filterWrap}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={CATEGORIES}
          keyExtractor={item => item}
          contentContainerStyle={styles.filterRow}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.catBtn, activeCategory === item && styles.catBtnActive]}
              onPress={() => { setActiveCategory(item); if (query) searchCards(query, item, activeLang); }}
            >
              <Text style={[styles.catText, activeCategory === item && styles.catTextActive]}>{item}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* PSA Filter */}
      <View style={styles.filterWrap}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={PSA_GRADES}
          keyExtractor={item => item}
          contentContainerStyle={styles.filterRow}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.psaBtn, activePSA === item && styles.psaBtnActive]}
              onPress={() => setActivePSA(item)}
            >
              <Text style={[styles.psaText, activePSA === item && styles.psaTextActive]}>
                {item === '全部' ? '全部' : item === 'Raw' ? 'Raw' : `PSA ${item}`}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Search Loading */}
      {loading && (
        <View style={styles.emptyWrap}>
          <ActivityIndicator color="#FF6900" size="large" />
          <Text style={styles.loadingText}>搜尋中...</Text>
        </View>
      )}

      {/* Search Results */}
      {!loading && query.length > 0 && cards.length === 0 && (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyEmoji}>😢</Text>
          <Text style={styles.emptyTitle}>找不到結果</Text>
          <Text style={styles.emptySub}>試試其他關鍵字</Text>
        </View>
      )}

      {!loading && query.length > 0 && cards.length > 0 && (
        <FlatList
          data={cards}
          keyExtractor={item => item.id}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          renderItem={renderCard}
        />
      )}

      {/* Hot Cards */}
      {!loading && query.length === 0 && (
        <FlatList
          data={hotCards}
          keyExtractor={item => item.id}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          ListHeaderComponent={
            <View style={styles.hotHeader}>
              <Text style={styles.hotTitle}>🔥 今日熱門</Text>
              {hotLoading && <ActivityIndicator color="#FF6900" size="small" />}
            </View>
          }
          renderItem={renderCard}
        />
      )}

      {/* PSA Modal */}
      <Modal visible={showPSAModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>選擇 PSA 等級</Text>
            <Text style={styles.modalSub}>{selectedCard?.name}</Text>
            <View style={styles.psaGrid}>
              {PSA_GRADES.filter(g => g !== '全部').map(grade => (
                <TouchableOpacity
                  key={grade}
                  style={[styles.psaGridBtn, selectedPSA === grade && styles.psaGridBtnActive]}
                  onPress={() => setSelectedPSA(grade)}
                >
                  <Text style={[styles.psaGridText, selectedPSA === grade && styles.psaGridTextActive]}>
                    {grade === 'Raw' ? 'Raw' : `PSA ${grade}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.confirmBtn, adding && { opacity: 0.7 }]}
              onPress={confirmAddToCollection}
              disabled={adding}
            >
              {adding
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.confirmBtnText}>確認加入收藏</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowPSAModal(false)}>
              <Text style={styles.cancelBtnText}>取消</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  searchWrap: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, fontSize: 15, color: '#101828' },
  clearBtn: { fontSize: 14, color: '#9CA3AF', paddingHorizontal: 4 },
  filterWrap: { backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' },
  filterRow: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  langBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  langBtnActive: { backgroundColor: '#101828', borderColor: '#101828' },
  langText: { fontSize: 13, color: '#6B7280' },
  langTextActive: { color: '#fff', fontWeight: '600' },
  catBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  catBtnActive: { backgroundColor: '#FF6900', borderColor: '#FF6900' },
  catText: { fontSize: 13, color: '#6B7280' },
  catTextActive: { color: '#fff', fontWeight: '600' },
  psaBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  psaBtnActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  psaText: { fontSize: 12, color: '#6B7280' },
  psaTextActive: { color: '#fff', fontWeight: '600' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  loadingText: { fontSize: 15, color: '#9CA3AF', marginTop: 8 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#101828' },
  emptySub: { fontSize: 14, color: '#9CA3AF' },
  hotHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  hotTitle: { fontSize: 18, fontWeight: '800', color: '#101828' },
  grid: { padding: 16, paddingBottom: 100 },
  row: { justifyContent: 'space-between', marginBottom: 16 },
  card: { width: CARD_W, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', borderWidth: 0.5, borderColor: '#E5E7EB' },
  cardImage: { width: '100%', height: CARD_W * 1.4, backgroundColor: '#F9FAFB' },
  cardBody: { padding: 10 },
  cardName: { fontSize: 13, fontWeight: '700', color: '#101828', marginBottom: 2 },
  cardSet: { fontSize: 11, color: '#6B7280', marginBottom: 2 },
  cardRarity: { fontSize: 11, color: '#3B82F6', fontWeight: '500', marginBottom: 6 },
  cardPrice: { fontSize: 15, fontWeight: '800', color: '#101828', marginBottom: 8 },
  addBtn: { backgroundColor: '#FF6900', borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  addBtnAdded: { backgroundColor: '#00A63E' },
  addBtnText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#101828', marginBottom: 4 },
  modalSub: { fontSize: 14, color: '#6B7280', marginBottom: 20 },
  psaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  psaGridBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  psaGridBtnActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  psaGridText: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  psaGridTextActive: { color: '#fff', fontWeight: '700' },
  confirmBtn: { backgroundColor: '#FF6900', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 12 },
  confirmBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  cancelBtn: { alignItems: 'center', paddingVertical: 12 },
  cancelBtnText: { fontSize: 15, color: '#9CA3AF' },
});