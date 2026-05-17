import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../../components/Header';
import { getCard } from '../../lib/pokemontcg';
import { supabase } from '../../lib/supabase';

const { width } = Dimensions.get('window');
const CARD_W = (width - 48) / 2;

type Card = {
  id: string;
  card_id: string;
  card_name: string;
  set_name: string;
  purchase_price: number;
  current_price: number;
  quantity: number;
  added_at: string;
  psa_grade?: string;
  image_url?: string;
};

type FilterType = '價格高到低' | '價格低到高' | '最新加入';
const FILTERS: FilterType[] = ['最新加入', '價格高到低', '價格低到高'];

export default function PortfolioScreen() {
  const [cards, setCards] = useState<Card[]>([]);
  const [showValue, setShowValue] = useState(true);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>('最新加入');

  // 刪除 popup
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 重命名 popup
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [portfolioName, setPortfolioName] = useState('Main');
  const [editingName, setEditingName] = useState('');

  const totalValue = cards.reduce((sum, c) => sum + (c.current_price * c.quantity), 0);

  useFocusEffect(
    useCallback(() => {
      fetchCards();
    }, [])
  );

  const fetchCards = async () => {
    setLoading(true);
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) { setLoading(false); return; }

    const { data, error } = await supabase
      .from('user_collection')
      .select('*')
      .eq('user_id', user.id)
      .order('added_at', { ascending: false });

    if (error) { console.error(error); setLoading(false); return; }
    if (!data || data.length === 0) { setCards([]); setLoading(false); return; }

    const cardsWithImages = await Promise.all(
      data.map(async (card) => {
        if (!card.card_id || card.card_id === 'EMPTY') return card;
        try {
          const json = await getCard(card.card_id);
          return { ...card, image_url: json?.data?.images?.small ?? null };
        } catch {
          return card;
        }
      })
    );

    setCards(cardsWithImages);
    setLoading(false);
  };

  const handleLongPress = (card: Card) => {
    setSelectedCard(card);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!selectedCard) return;
    setDeleting(true);
    const { error } = await supabase
      .from('user_collection')
      .delete()
      .eq('id', selectedCard.id);

    if (error) {
      Alert.alert('錯誤', '刪除失敗，請再試一次');
    } else {
      setCards(prev => prev.filter(c => c.id !== selectedCard.id));
      setShowDeleteModal(false);
      setSelectedCard(null);
    }
    setDeleting(false);
  };

  const openRenameModal = () => {
    setEditingName(portfolioName);
    setShowRenameModal(true);
  };

  const handleRename = () => {
    if (editingName.trim()) setPortfolioName(editingName.trim());
    setShowRenameModal(false);
  };

  const getSortedCards = (): Card[] => {
    const sorted = [...cards];
    if (activeFilter === '價格高到低') return sorted.sort((a, b) => b.current_price - a.current_price);
    if (activeFilter === '價格低到高') return sorted.sort((a, b) => a.current_price - b.current_price);
    return sorted.sort((a, b) => new Date(b.added_at).getTime() - new Date(a.added_at).getTime());
  };

  const sortedCards = getSortedCards();

  return (
    <SafeAreaView style={styles.safe}>
      <Header />
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Portfolio Value */}
        <View style={styles.valueSection}>
          {/* 可點擊的作品集名稱 */}
          <TouchableOpacity onPress={openRenameModal} style={styles.nameTouchable}>
            <Text style={styles.valueLabel}>
              作品集：<Text style={styles.valueLabelOrange}>{portfolioName}</Text>
            </Text>
            <Text style={styles.editNameIcon}>✎</Text>
          </TouchableOpacity>

          <View style={styles.valueRow}>
            <Text style={styles.valueAmount}>
              {showValue
                ? `HK$${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : '••••••'}
            </Text>
            <TouchableOpacity onPress={() => setShowValue(!showValue)}>
              <Image
                source={showValue
                  ? require('../../assets/icons/eye.png')
                  : require('../../assets/icons/eye-off.png')
                }
                style={styles.eyeIcon}
              />
            </TouchableOpacity>
          </View>
          <Text style={styles.cardCount}>{cards.length} 張卡片</Text>
        </View>

        {/* Filter Row */}
        <View style={styles.filterRow}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, activeFilter === f && styles.filterChipActive]}
              onPress={() => setActiveFilter(f)}
            >
              <Text style={[styles.filterText, activeFilter === f && styles.filterTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Loading */}
        {loading && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color="#FF6900" size="large" />
            <Text style={styles.loadingText}>載入中...</Text>
          </View>
        )}

        {/* Empty State */}
        {!loading && cards.length === 0 && (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyEmoji}>📦</Text>
            <Text style={styles.emptyText}>還沒有卡片</Text>
            <Text style={styles.emptySub}>去搜尋頁面加入你的第一張卡！</Text>
          </View>
        )}

        {/* Cards Grid */}
        {!loading && sortedCards.length > 0 && (
          <View style={styles.grid}>
            {sortedCards.map(card => {
              const change = card.purchase_price > 0
                ? ((card.current_price - card.purchase_price) / card.purchase_price) * 100
                : 0;
              return (
                <TouchableOpacity
                  key={card.id}
                  style={styles.card}
                  onLongPress={() => handleLongPress(card)}
                  delayLongPress={500}
                >
                  <View style={styles.cardImgBox}>
                    {card.image_url ? (
                      <Image source={{ uri: card.image_url }} style={styles.cardImage} resizeMode="contain" />
                    ) : (
                      <Text style={styles.cardEmoji}>🃏</Text>
                    )}
                    {card.psa_grade && card.psa_grade !== 'Raw' && (
                      <View style={styles.psaBadge}>
                        <Text style={styles.psaBadgeText}>PSA {card.psa_grade}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.cardName} numberOfLines={1}>{card.card_name}</Text>
                    <Text style={styles.cardSet} numberOfLines={1}>{card.set_name}</Text>
                    <View style={styles.priceRow}>
                      <Text style={styles.priceLabel}>單價</Text>
                      <Text style={styles.priceValue}>HK${card.current_price.toLocaleString()}</Text>
                    </View>
                    <View style={styles.priceRow}>
                      <Text style={styles.priceLabel}>Qty: {card.quantity}</Text>
                      <Text style={[styles.changeText, { color: change >= 0 ? '#00A63E' : '#E7000B' }]}>
                        {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                      </Text>
                    </View>
                    <View style={styles.totalBox}>
                      <Text style={styles.totalLabel}>總價值</Text>
                      <Text style={styles.totalValue}>HK${(card.current_price * card.quantity).toFixed(2)}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* 刪除 Modal */}
      <Modal visible={showDeleteModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.deleteModal}>
            {selectedCard?.image_url && (
              <Image source={{ uri: selectedCard.image_url }} style={styles.deleteCardImg} resizeMode="contain" />
            )}
            <Text style={styles.deleteTitle}>{selectedCard?.card_name}</Text>
            <Text style={styles.deleteSub}>{selectedCard?.set_name}</Text>
            <Text style={styles.deleteWarning}>從作品集移除這張卡片？</Text>
            <Text style={styles.deletePrice}>
              總價值 HK${((selectedCard?.current_price ?? 0) * (selectedCard?.quantity ?? 1)).toFixed(2)} 將會減少
            </Text>

            <TouchableOpacity
              style={styles.deleteConfirmBtn}
              onPress={handleDelete}
              disabled={deleting}
            >
              {deleting
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.deleteConfirmText}>移除卡片</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteCancelBtn}
              onPress={() => { setShowDeleteModal(false); setSelectedCard(null); }}
            >
              <Text style={styles.deleteCancelText}>取消</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 重命名 Modal */}
      <Modal visible={showRenameModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.renameModal}>
            <Text style={styles.renameTitle}>修改作品集名稱</Text>
            <TextInput
              style={styles.renameInput}
              value={editingName}
              onChangeText={setEditingName}
              placeholder="輸入名稱"
              placeholderTextColor="#9CA3AF"
              maxLength={20}
              autoFocus
            />
            <Text style={styles.renameCount}>{editingName.length}/20</Text>
            <TouchableOpacity style={styles.renameSaveBtn} onPress={handleRename}>
              <Text style={styles.renameSaveText}>儲存</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.renameCancelBtn} onPress={() => setShowRenameModal(false)}>
              <Text style={styles.renameCancelText}>取消</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },

  valueSection: {
    backgroundColor: '#fff',
    paddingVertical: 20,
    alignItems: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: '#F3F4F6',
  },
  nameTouchable: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  valueLabel: { fontSize: 14, color: '#6B7280' },
  valueLabelOrange: { color: '#FF6900', fontWeight: '600' },
  editNameIcon: { fontSize: 13, color: '#FF6900' },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  valueAmount: { fontSize: 36, fontWeight: '800', color: '#101828' },
  eyeIcon: { width: 20, height: 2, tintColor: '#9CA3AF' },
  cardCount: { fontSize: 13, color: '#9CA3AF', marginTop: 6 },

  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 0.5,
    borderBottomColor: '#F3F4F6',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  filterChipActive: { backgroundColor: '#101828', borderColor: '#101828' },
  filterText: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  filterTextActive: { color: '#fff', fontWeight: '600' },

  loadingWrap: { padding: 60, alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 15, color: '#9CA3AF' },
  emptyWrap: { padding: 60, alignItems: 'center', gap: 8 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontSize: 18, fontWeight: '700', color: '#101828' },
  emptySub: { fontSize: 14, color: '#9CA3AF', textAlign: 'center' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 12 },
  card: {
    width: CARD_W,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
  },
  cardImgBox: {
    width: '100%',
    aspectRatio: 0.72,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardImage: { width: '100%', height: '100%' },
  cardEmoji: { fontSize: 56 },
  psaBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#7C3AED',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  psaBadgeText: { fontSize: 10, color: '#fff', fontWeight: '700' },
  cardBody: { padding: 12 },
  cardName: { fontSize: 14, fontWeight: '700', color: '#101828', marginBottom: 2 },
  cardSet: { fontSize: 11, color: '#6B7280', marginBottom: 10 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  priceLabel: { fontSize: 12, color: '#9CA3AF' },
  priceValue: { fontSize: 13, fontWeight: '700', color: '#101828' },
  changeText: { fontSize: 12, fontWeight: '600' },
  totalBox: { backgroundColor: '#FFF3EB', borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 8 },
  totalLabel: { fontSize: 11, color: '#9CA3AF', marginBottom: 2 },
  totalValue: { fontSize: 15, fontWeight: '800', color: '#FF6900' },

  // Delete Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  deleteModal: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    alignItems: 'center',
  },
  deleteCardImg: { width: 100, height: 140, marginBottom: 12 },
  deleteTitle: { fontSize: 18, fontWeight: '800', color: '#101828', marginBottom: 4, textAlign: 'center' },
  deleteSub: { fontSize: 13, color: '#9CA3AF', marginBottom: 16 },
  deleteWarning: { fontSize: 15, fontWeight: '600', color: '#101828', marginBottom: 6, textAlign: 'center' },
  deletePrice: { fontSize: 13, color: '#EF4444', marginBottom: 24, textAlign: 'center' },
  deleteConfirmBtn: {
    backgroundColor: '#EF4444',
    borderRadius: 14,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  deleteConfirmText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  deleteCancelBtn: { paddingVertical: 12, width: '100%', alignItems: 'center' },
  deleteCancelText: { fontSize: 15, color: '#9CA3AF' },

  // Rename Modal
  renameModal: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    width: '100%',
  },
  renameTitle: { fontSize: 18, fontWeight: '800', color: '#101828', marginBottom: 16 },
  renameInput: {
    borderWidth: 1.5,
    borderColor: '#FF6900',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#101828',
  },
  renameCount: { fontSize: 11, color: '#D1D5DB', textAlign: 'right', marginTop: 4, marginBottom: 20 },
  renameSaveBtn: {
    backgroundColor: '#FF6900',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  renameSaveText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  renameCancelBtn: { paddingVertical: 12, alignItems: 'center' },
  renameCancelText: { fontSize: 15, color: '#9CA3AF' },
});