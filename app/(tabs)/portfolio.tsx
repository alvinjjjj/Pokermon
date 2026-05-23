import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { SkeletonGrid } from '../../components/SkeletonCard';
import { useCurrency } from '../../contexts/CurrencyContext';
import { supabase } from '../../lib/supabase';
import { BOOSTER_SETS } from '../../constants/boosterBoxes';

const { width } = Dimensions.get('window');
// Build a lookup map: setId → localImage (for boxes stored without imageUrl)
const boxLocalImageMap: Record<string, any> = {};
BOOSTER_SETS.forEach(s => { if (s.localImage) boxLocalImageMap[s.id] = s.localImage; });
const CARD_W = (width - 48) / 2;
import { POKEMON_TCG_API_KEY as API_KEY } from '../../constants/config';
import { fetchHiresJPImages } from '../../lib/jpImages';

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
  item_type?: 'card' | 'box';
  box_condition?: 'Sealed' | 'Opened';
};

type FilterType = 'newest' | 'highPrice' | 'lowPrice';

export default function PortfolioScreen() {
  const { convert, currency, rate, symbol } = useCurrency();
  const router = useRouter();
  const { t } = useTranslation();
  const [cards, setCards] = useState<Card[]>([]);
  const [showValue, setShowValue] = useState(true);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>('newest');

  const FILTERS: { key: FilterType; label: string }[] = [
    { key: 'newest',    label: t('portfolio.filterNewest') },
    { key: 'highPrice', label: t('portfolio.filterHighPrice') },
    { key: 'lowPrice',  label: t('portfolio.filterLowPrice') },
  ];

  // 刪除 popup
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 修改 popup (price + quantity + purchase price)
  const [showEditModal, setShowEditModal]   = useState(false);
  const [editPriceText, setEditPriceText]   = useState('');
  const [editPurchaseText, setEditPurchaseText] = useState('');
  const [editQty, setEditQty]               = useState(1);
  const [editSaving, setEditSaving]         = useState(false);

  // 重命名 popup
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [portfolioName, setPortfolioName] = useState('Main');
  const [editingName, setEditingName] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameSuccess, setRenameSuccess] = useState(false);
  // 防止 fetchCards re-fetch 覆蓋剛儲存好的名稱
  const renamingSavedRef = useRef(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Staleness check — fetchCards runs 3 external API calls (artofpkm Supabase,
  // TCGdex JA, pokemontcg.io) plus image write-backs. Re-running it every time
  // the tab regains focus is expensive (50 cards = ~2s wait). Cache the
  // timestamp of the last successful fetch; only re-fetch on tab focus if data
  // is older than this threshold OR if the user explicitly pulls to refresh.
  const STALENESS_MS = 60 * 1000;  // 60 seconds — long enough to skip casual tab swipes
  const lastFetchAtRef = useRef<number>(0);

  const totalValue  = cards.reduce((sum, c) => sum + (c.current_price * c.quantity), 0);
  const cardCount   = cards.filter(c => c.item_type !== 'box').length;
  const boxCount    = cards.filter(c => c.item_type === 'box').length;

  useFocusEffect(
    useCallback(() => {
      const sinceLast = Date.now() - lastFetchAtRef.current;
      // First focus OR data is stale → fetch. Otherwise skip; the cached
      // `cards` state from the previous mount stays visible.
      if (lastFetchAtRef.current === 0 || sinceLast > STALENESS_MS) {
        fetchCards();
      }
    }, [])
  );

  const fetchCards = async (opts: { force?: boolean } = {}) => {
    // Bypass staleness when called from pull-to-refresh or after a write.
    // (Note: today nothing forces explicit re-fetch from inside this file —
    // the edit/delete handlers do optimistic updates without re-fetching.)
    if (!opts.force && Date.now() - lastFetchAtRef.current < STALENESS_MS && cards.length > 0) {
      return;
    }
    setLoading(true);
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) { setLoading(false); return; }
    setUserId(user.id);

    // 載入作品集名稱（如果不是剛做完 rename 才讀，避免競爭條件覆蓋新名稱）
    if (!renamingSavedRef.current) {
      const { data: profileData } = await supabase
        .from('profiles').select('portfolio_name').eq('id', user.id).single();
      if (profileData?.portfolio_name) setPortfolioName(profileData.portfolio_name);
    }
    renamingSavedRef.current = false; // 重置旗標

    const { data, error } = await supabase
      .from('user_collection')
      .select('*')
      .eq('user_id', user.id)
      .order('added_at', { ascending: false });

    if (error) { if (__DEV__) console.error(error); setLoading(false); return; }
    if (!data || data.length === 0) { setCards([]); setLoading(false); return; }

    // ── Batch-fetch / re-verify images ───────────────────────────────────
    // Three recovery paths, ordered by what's most likely to succeed:
    //
    //   (A) PPT-shape names (card_name contains "- xxx/yyy") → use the shared
    //       JP image resolver (artofpkm Supabase + TCGdex JA strict match).
    //   (B) Clean pokemontcg.io ID (e.g. "sv8-201") → batched lookup by id.
    //   (C) Anything else with no image → last-resort name search.
    //
    // IMPORTANT: for JP-shape rows we ALWAYS re-fetch — even if image_url is
    // already populated. Earlier versions of jpImages.ts had a buggy ±5 set-
    // count tolerance plus a "first result" fallback that wrote WRONG images
    // (Riolu shown as Charizard ex, Foxslay shown as Sightseer). The current
    // strict-match version may return null where the buggy version returned
    // a wrong url, so we must override what's in the DB. If the new lookup
    // also returns nothing we leave the row's old url alone (best-effort).
    const PPT_SHAPE = /[-–]\s*0*\d+\s*\/\s*[A-Za-z0-9-]+\s*$/;

    const jpShaped:  Card[] = [];
    const byId:      Card[] = [];
    const byNameLc:  Card[] = [];

    for (const c of data) {
      if (c.item_type === 'box') continue;
      if (!c.card_id || c.card_id === 'EMPTY') continue;

      const looksJp = PPT_SHAPE.test(c.card_name) ||
                      c.card_id.startsWith('ppt_') ||
                      c.card_id.startsWith('jtcg_');

      if (looksJp) {
        // Always re-fetch JP-shape rows (override potentially-wrong DB image)
        jpShaped.push(c);
      } else if (!c.image_url) {
        // Non-JP rows only need a fetch if image is missing
        if (c.card_id.includes('-')) byId.push(c);
        else                          byNameLc.push(c);
      }
    }

    const resolved: Record<string, string> = {};   // card row id → image_url

    // (A) JP image resolver — shared with search.tsx
    if (jpShaped.length > 0) {
      const map = await fetchHiresJPImages(
        jpShaped.map(c => ({ name: c.card_name, setName: c.set_name }))
      );
      for (const c of jpShaped) {
        if (map[c.card_name]) resolved[c.id] = map[c.card_name];
      }
    }

    // (B) pokemontcg.io ID lookup — batched
    if (byId.length > 0) {
      const CHUNK = 100;
      const idToImg: Record<string, string> = {};
      for (let i = 0; i < byId.length; i += CHUNK) {
        const chunk = byId.slice(i, i + CHUNK);
        const q = chunk.map(c => `id:${c.card_id}`).join(' OR ');
        try {
          const res = await fetch(
            `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=${CHUNK}`,
            { headers: { 'X-Api-Key': API_KEY } },
          );
          const json = await res.json();
          for (const apiCard of json.data ?? []) {
            if (apiCard.images?.small) idToImg[apiCard.id] = apiCard.images.small;
          }
        } catch { /* skip */ }
      }
      for (const c of byId) {
        if (idToImg[c.card_id]) resolved[c.id] = idToImg[c.card_id];
      }
    }

    // (C) Plain name lookup — pokemontcg.io with prefix wildcards
    if (byNameLc.length > 0) {
      const uniq = new Map<string, Card[]>();
      for (const c of byNameLc) {
        const key = c.card_name.trim().toLowerCase();
        if (!uniq.has(key)) uniq.set(key, []);
        uniq.get(key)!.push(c);
      }
      // Keep hyphens as word separators, not term content — see search.tsx
      // for the rationale (Ho-Oh / Wo-Chien etc. otherwise misparse).
      const escapeTerm = (s: string) =>
        s.toLowerCase().replace(/[+!(){}\[\]^"~*?:\\/]/g, '').trim();
      const promises = Array.from(uniq.entries()).map(async ([nameLc, rows]) => {
        const terms = nameLc.split(/[\s-]+/).map(escapeTerm).filter(Boolean);
        if (!terms.length) return;
        const q = terms.map(t => `name:${t}*`).join(' ');
        try {
          const res = await fetch(
            `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=10&select=id,name,images`,
            { headers: { 'X-Api-Key': API_KEY } },
          );
          const json = await res.json();
          const list = (json.data ?? []) as Array<{ name: string; images?: { small?: string } }>;
          const hit  = list.find(c => c.name.toLowerCase() === nameLc) ?? list[0];
          if (hit?.images?.small) {
            for (const row of rows) resolved[row.id] = hit.images.small;
          }
        } catch { /* skip */ }
      });
      await Promise.all(promises);
    }

    // Merge resolved images into the rendered cards.
    //
    // We DO NOT clear existing tcgdex.net URLs when the new lookup returns
    // nothing — "nothing" can mean "network timeout / API down", and silently
    // wiping a good image because of a transient failure is worse than showing
    // a possibly-stale image. The only way an image gets cleared from the DB
    // is via explicit user action (delete + re-add).
    const cardsWithImages = data.map(card =>
      resolved[card.id] ? { ...card, image_url: resolved[card.id] } : card
    );

    setCards(cardsWithImages);
    setLoading(false);
    lastFetchAtRef.current = Date.now();   // mark "fresh" — staleness window starts here

    // Write resolved images back to user_collection so subsequent loads are
    // instant and other surfaces (detail page) see them too. Fire-and-forget.
    const writebacks = Object.entries(resolved);
    if (writebacks.length > 0) {
      Promise.all(writebacks.map(([rowId, url]) =>
        supabase.from('user_collection').update({ image_url: url }).eq('id', rowId)
      )).catch(() => { /* best-effort, ignore */ });
    }
  };

  const handleLongPress = (card: Card) => {
    if (deleting) return;
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
      Alert.alert(t('portfolio.deleteError'), t('portfolio.deleteFailed'));
    } else {
      setCards(prev => prev.filter(c => c.id !== selectedCard.id));
      setShowDeleteModal(false);
      setSelectedCard(null);
    }
    setDeleting(false);
  };

  // ─── Edit modal ──────────────────────────────────────────────────────────────
  // Prices in DB are stored in USD; the edit form shows / accepts them in the
  // user's selected currency, then converts back on save.
  const openEditModal = (card: Card) => {
    setSelectedCard(card);
    setEditPriceText(((card.current_price ?? 0) * rate).toFixed(0));
    setEditPurchaseText(((card.purchase_price ?? 0) * rate).toFixed(0));
    setEditQty(Math.max(1, Math.min(999, Math.floor(card.quantity || 1))));
    setShowEditModal(true);
  };

  const handleEditSave = async () => {
    if (!selectedCard || editSaving) return;
    const priceNum    = parseFloat(editPriceText);
    const purchaseNum = parseFloat(editPurchaseText);
    if (isNaN(priceNum) || priceNum <= 0) {
      Alert.alert(t('portfolio.editError'), t('portfolio.editPriceInvalid'));
      return;
    }
    if (isNaN(purchaseNum) || purchaseNum < 0) {
      Alert.alert(t('portfolio.editError'), t('portfolio.editPurchaseInvalid'));
      return;
    }
    setEditSaving(true);
    // Convert from user currency → USD for storage. rate is "USD × rate = local",
    // so to invert we divide local by rate.
    const newPriceUsd    = priceNum    / rate;
    const newPurchaseUsd = purchaseNum / rate;
    const newQty         = Math.max(1, Math.min(999, Math.floor(editQty || 1)));

    const { error } = await supabase
      .from('user_collection')
      .update({
        current_price:  newPriceUsd,
        purchase_price: newPurchaseUsd,
        quantity:       newQty,
      })
      .eq('id', selectedCard.id);

    if (error) {
      Alert.alert(t('portfolio.editError'), error.message);
    } else {
      // Optimistic local update — avoids a full refetch + image rescan
      setCards(prev => prev.map(c => c.id === selectedCard.id
        ? { ...c, current_price: newPriceUsd, purchase_price: newPurchaseUsd, quantity: newQty }
        : c
      ));
      setShowEditModal(false);
      setSelectedCard(null);
    }
    setEditSaving(false);
  };

  const openRenameModal = () => {
    setEditingName(portfolioName);
    setShowRenameModal(true);
  };

  const handleRename = async () => {
    const newName = editingName.trim();
    if (!newName || renameSaving) return;

    // Empty / whitespace-only names rejected — prevents portfolio_name = ''
    // from corrupting the DB and falling through to "Main" on next load.
    if (newName.length === 0 || newName.length > 20) {
      Alert.alert(t('portfolio.saveFailed'), t('portfolio.updateFailed'));
      return;
    }

    if (!userId) return;

    // Set the "ignore fetch" flag BEFORE the optimistic update so a concurrent
    // fetchCards() can't overwrite our new name with the stale DB value.
    renamingSavedRef.current = true;

    const oldName = portfolioName;
    setPortfolioName(newName);
    setShowRenameModal(false);
    setRenameSaving(true);

    try {
      const { data, error } = await supabase.from('profiles')
        .update({ portfolio_name: newName })
        .eq('id', userId)
        .select('portfolio_name');

      if (error) {
        renamingSavedRef.current = false;
        setPortfolioName(oldName);
        Alert.alert(t('portfolio.saveFailed'), error.message);
      } else if (!data || data.length === 0) {
        renamingSavedRef.current = false;
        setPortfolioName(oldName);
        Alert.alert(t('portfolio.saveFailed'), t('portfolio.updateFailed'));
      } else {
        // Success — toast handled by useEffect below (with cleanup).
        setRenameSuccess(true);
      }
    } catch (e: any) {
      renamingSavedRef.current = false;
      setPortfolioName(oldName);
      Alert.alert(t('portfolio.saveFailed'), e?.message ?? t('common.tryAgainLater'));
    } finally {
      setRenameSaving(false);
    }
  };

  // Auto-dismiss the "✓ Updated" toast 2s after rename success. useEffect
  // gives us proper cleanup if the user navigates away before the timer fires
  // (otherwise the bare setTimeout would call setState on an unmounted component).
  useEffect(() => {
    if (!renameSuccess) return;
    const t = setTimeout(() => setRenameSuccess(false), 2000);
    return () => clearTimeout(t);
  }, [renameSuccess]);

  // Memoize — avoid re-sorting on every render. cards is hundreds of items
  // worst case; without useMemo the entire grid re-sorts on every modal toggle.
  const sortedCards = useMemo<Card[]>(() => {
    const sorted = [...cards];
    if (activeFilter === 'highPrice') return sorted.sort((a, b) => b.current_price - a.current_price);
    if (activeFilter === 'lowPrice')  return sorted.sort((a, b) => a.current_price - b.current_price);
    return sorted.sort((a, b) => new Date(b.added_at).getTime() - new Date(a.added_at).getTime());
  }, [cards, activeFilter]);

  return (
    <SafeAreaView style={styles.safe}>
      <Header />
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Portfolio Value */}
        <View style={styles.valueSection}>
          {/* 可點擊的作品集名稱 */}
          <TouchableOpacity onPress={openRenameModal} style={styles.nameTouchable}>
            <Text style={styles.valueLabel}>
              {t('portfolio.portfolioLabel')}<Text style={styles.valueLabelOrange}>{portfolioName}</Text>
            </Text>
            {renameSuccess
              ? <Text style={styles.renameSuccessTag}>{t('portfolio.updated')}</Text>
              : <Text style={styles.editNameIcon}>{t('portfolio.editIcon')}</Text>
            }
          </TouchableOpacity>

          <View style={styles.valueRow}>
            <Text style={styles.valueAmount}>
              {showValue ? convert(totalValue) : '••••••'}
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
          <Text style={styles.cardCount}>
            {cardCount > 0 ? t('portfolio.cardCount', { count: cardCount }) : ''}
            {cardCount > 0 && boxCount > 0 ? ' · ' : ''}
            {boxCount > 0 ? t('portfolio.boxCount', { count: boxCount }) : ''}
            {cards.length === 0 ? t('portfolio.noItems') : ''}
          </Text>
        </View>

        {/* Filter Row */}
        <View style={styles.filterRowWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRowContent}
          >
            {FILTERS.map(f => (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterChip, activeFilter === f.key && styles.filterChipActive]}
                onPress={() => setActiveFilter(f.key)}
              >
                <Text style={[styles.filterText, activeFilter === f.key && styles.filterTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {/* Right fade hint */}
          <View style={styles.filterFade} pointerEvents="none" />
        </View>

        {/* Loading skeleton */}
        {loading && (
          <SkeletonGrid count={6} cardWidth={CARD_W} cardHeight={220} />
        )}

        {/* Empty State */}
        {!loading && cards.length === 0 && (
          <View style={styles.emptyWrap}>
            <Image source={require('../../assets/icons/portfolio.png')} style={styles.emptyEmojiImg} />
            <Text style={styles.emptyText}>{t('portfolio.noCards')}</Text>
            <Text style={styles.emptySub}>{t('portfolio.goToSearch')}</Text>
          </View>
        )}

        {/* Cards Grid */}
        {!loading && sortedCards.length > 0 && (
          <View style={styles.grid}>
            {sortedCards.map(card => {
              const isBox = card.item_type === 'box';
              const change = card.purchase_price > 0
                ? ((card.current_price - card.purchase_price) / card.purchase_price) * 100
                : 0;
              return (
                <TouchableOpacity
                  key={card.id}
                  style={styles.card}
                  onPress={() => {
                    if (card.item_type !== 'box' && card.card_id) {
                      const isJPPortfolio = card.card_id.startsWith('ppt_') || card.card_id.startsWith('jtcg_');
                      router.push({
                        pathname: '/card/[id]' as any,
                        params: isJPPortfolio ? {
                          id:        card.card_id,
                          jp_name:   card.card_name  ?? '',
                          jp_image:  card.image_url  ?? '',
                          jp_set:    card.set_name   ?? '',
                          jp_market: String(card.current_price ?? 0),
                          jp_psa10:  '0',
                          jp_psa9:   '0',
                        } : { id: card.card_id },
                      });
                    }
                  }}
                  onLongPress={() => handleLongPress(card)}
                  delayLongPress={500}
                >
                  <View style={[styles.cardImgBox, isBox && styles.boxImgBox]}>
                    {(() => {
                      // For boxes, try localImage first (card_id = 'box-{setId}')
                      if (isBox) {
                        const setId = card.card_id?.replace('box-', '') ?? '';
                        const local = boxLocalImageMap[setId];
                        if (local) return <Image source={local} style={styles.boxImage} resizeMode="contain" />;
                      }
                      if (card.image_url) return <Image source={{ uri: card.image_url }} style={isBox ? styles.boxImage : styles.cardImage} resizeMode="contain" />;
                      return <Image source={require('../../assets/icons/portfolio.png')} style={{ width: 44, height: 44, tintColor: '#D1D5DB', resizeMode: 'contain' }} />;
                    })()}
                    {/* Grade badge for cards */}
                    {!isBox && card.psa_grade && (
                      <View style={[
                        styles.psaBadge,
                        card.psa_grade === 'Raw'  && styles.gradeBadgeRaw,
                        card.psa_grade === '9'    && styles.gradeBadgePsa9,
                        card.psa_grade === '10'   && styles.gradeBadgePsa10,
                        card.psa_grade === 'PSA 9'  && styles.gradeBadgePsa9,
                        card.psa_grade === 'PSA 10' && styles.gradeBadgePsa10,
                      ]}>
                        <Text style={styles.psaBadgeText}>
                          {card.psa_grade === 'Raw' ? 'Raw'
                            : card.psa_grade === '9'  || card.psa_grade === 'PSA 9'  ? 'PSA 9'
                            : card.psa_grade === '10' || card.psa_grade === 'PSA 10' ? 'PSA 10'
                            : `PSA ${card.psa_grade}`}
                        </Text>
                      </View>
                    )}
                    {/* Sealed / Opened badge for boxes */}
                    {isBox && card.box_condition && (
                      <View style={[styles.psaBadge, card.box_condition === 'Sealed' ? styles.sealedBadge : styles.openedBadge]}>
                        <Text style={styles.psaBadgeText}>
                          {card.box_condition === 'Sealed' ? t('portfolio.sealed') : t('portfolio.opened')}
                        </Text>
                      </View>
                    )}
                    {/* Edit icon — top-left, opens price/qty/purchase edit modal.
                        Stops propagation so it doesn't trigger the card's
                        navigate-to-detail onPress. */}
                    <TouchableOpacity
                      style={styles.editIconBtn}
                      onPress={(e) => { e.stopPropagation(); openEditModal(card); }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      activeOpacity={0.7}
                    >
                      <Image source={require('../../assets/icons/pen.png')} style={styles.editIconImg} />
                    </TouchableOpacity>
                    {/* Box type indicator */}
                    {isBox && (
                      <View style={styles.boxTypePill}>
                        <Text style={styles.boxTypePillText}>{t('portfolio.boosterBox')}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.cardName} numberOfLines={1}>{card.card_name}</Text>
                    <Text style={styles.cardSet} numberOfLines={1}>{card.set_name}</Text>

                    {/* Price + change row */}
                    <View style={styles.priceMainRow}>
                      <Text style={styles.priceMain}>{convert(card.current_price * card.quantity)}</Text>
                      <View style={[styles.changePill, { backgroundColor: change >= 0 ? '#DCFCE7' : '#FEE2E2' }]}>
                        <Text style={[styles.changePillText, { color: change >= 0 ? '#00A63E' : '#E7000B' }]}>
                          {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(1)}%
                        </Text>
                      </View>
                    </View>

                    {/* Qty row — only show if > 1 */}
                    {card.quantity > 1 && (
                      <Text style={styles.qtyText}>×{card.quantity} @ {convert(card.current_price)} {t('portfolio.each')}</Text>
                    )}

                    <TouchableOpacity
                      style={styles.sellBtn}
                      onPress={() => router.push({
                        pathname: '/listing-upload' as any,
                        params: {
                          prefill_card_id:    card.card_id ?? '',
                          prefill_card_name:  card.card_name,
                          prefill_set_name:   card.set_name ?? '',
                          prefill_image_url:  card.image_url ?? '',
                          prefill_price:      String(card.current_price),
                        },
                      })}
                    >
                      <Text style={styles.sellBtnText}>{t('portfolio.sell')}</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* 刪除 Modal */}
      <Modal visible={showDeleteModal} transparent animationType="fade" onRequestClose={() => { setShowDeleteModal(false); setSelectedCard(null); }}>
        <View style={styles.modalOverlay}>
          <View style={styles.deleteModal}>
            {selectedCard?.image_url && (
              <Image source={{ uri: selectedCard.image_url }} style={styles.deleteCardImg} resizeMode="contain" />
            )}
            <Text style={styles.deleteTitle}>{selectedCard?.card_name}</Text>
            <Text style={styles.deleteSub}>{selectedCard?.set_name}</Text>
            <Text style={styles.deleteWarning}>
              {selectedCard?.item_type === 'box' ? t('portfolio.removeBoxConfirm') : t('portfolio.removeCardConfirm')}
            </Text>
            <Text style={styles.deletePrice}>
              {t('portfolio.totalValueDecrease', { value: convert((selectedCard?.current_price ?? 0) * (selectedCard?.quantity ?? 1)) })}
            </Text>

            <TouchableOpacity
              style={styles.deleteConfirmBtn}
              onPress={handleDelete}
              disabled={deleting}
            >
              {deleting
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.deleteConfirmText}>
                    {selectedCard?.item_type === 'box' ? t('portfolio.removeBox') : t('portfolio.removeCard')}
                  </Text>
              }
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteCancelBtn}
              onPress={() => { setShowDeleteModal(false); setSelectedCard(null); }}
            >
              <Text style={styles.deleteCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit Modal — price + quantity + purchase price */}
      <Modal visible={showEditModal} transparent animationType="fade" onRequestClose={() => setShowEditModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.editModal}>
            <Text style={styles.editTitle}>{t('portfolio.editTitle')}</Text>
            <Text style={styles.editSub} numberOfLines={1}>{selectedCard?.card_name}</Text>

            {/* Current price */}
            <Text style={styles.editLabel}>{t('portfolio.editPriceLabel', { symbol })}</Text>
            <TextInput
              style={styles.editInput}
              value={editPriceText}
              onChangeText={setEditPriceText}
              keyboardType="decimal-pad"
              placeholder={t('portfolio.editPricePlaceholder')}
              placeholderTextColor="#9CA3AF"
              textContentType="none"
              autoComplete="off"
              autoCorrect={false}
              spellCheck={false}
            />

            {/* Purchase price */}
            <Text style={styles.editLabel}>{t('portfolio.editPurchaseLabel', { symbol })}</Text>
            <TextInput
              style={styles.editInput}
              value={editPurchaseText}
              onChangeText={setEditPurchaseText}
              keyboardType="decimal-pad"
              placeholder={t('portfolio.editPurchasePlaceholder')}
              placeholderTextColor="#9CA3AF"
              textContentType="none"
              autoComplete="off"
              autoCorrect={false}
              spellCheck={false}
            />

            {/* Quantity stepper */}
            <Text style={styles.editLabel}>{t('portfolio.editQtyLabel')}</Text>
            <View style={styles.editQtyRow}>
              <TouchableOpacity
                style={[styles.editQtyBtn, editQty <= 1 && styles.editQtyBtnDisabled]}
                onPress={() => setEditQty(q => Math.max(1, q - 1))}
                disabled={editQty <= 1}
                activeOpacity={0.7}
              >
                <Text style={styles.editQtyBtnText}>−</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.editQtyInput}
                value={String(editQty)}
                onChangeText={(txt) => {
                  const n = parseInt(txt.replace(/[^0-9]/g, ''), 10);
                  if (isNaN(n)) setEditQty(1);
                  else setEditQty(Math.max(1, Math.min(999, n)));
                }}
                keyboardType="number-pad"
                textContentType="none"
                autoComplete="off"
                autoCorrect={false}
                spellCheck={false}
                maxLength={3}
                selectTextOnFocus
              />
              <TouchableOpacity
                style={[styles.editQtyBtn, editQty >= 999 && styles.editQtyBtnDisabled]}
                onPress={() => setEditQty(q => Math.min(999, q + 1))}
                disabled={editQty >= 999}
                activeOpacity={0.7}
              >
                <Text style={styles.editQtyBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.editSaveBtn} onPress={handleEditSave} disabled={editSaving}>
              {editSaving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.editSaveText}>{t('common.save')}</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity style={styles.editCancelBtn} onPress={() => { setShowEditModal(false); setSelectedCard(null); }}>
              <Text style={styles.editCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Rename Modal */}
      <Modal visible={showRenameModal} transparent animationType="fade" onRequestClose={() => setShowRenameModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.renameModal}>
            <Text style={styles.renameTitle}>{t('portfolio.renameTitle')}</Text>
            <TextInput
              style={styles.renameInput}
              value={editingName}
              onChangeText={setEditingName}
              placeholder={t('portfolio.namePlaceholder')}
              placeholderTextColor="#9CA3AF"
              maxLength={20}
              autoFocus
            />
            <Text style={styles.renameCount}>{editingName.length}/20</Text>
            <TouchableOpacity style={styles.renameSaveBtn} onPress={handleRename} disabled={renameSaving}>
              {renameSaving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.renameSaveText}>{t('common.save')}</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity style={styles.renameCancelBtn} onPress={() => setShowRenameModal(false)}>
              <Text style={styles.renameCancelText}>{t('common.cancel')}</Text>
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
  renameSuccessTag: { fontSize: 12, color: '#00A63E', fontWeight: '700' },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  valueAmount: { fontSize: 36, fontWeight: '800', color: '#101828' },
  eyeIcon: { width: 20, height: 20, tintColor: '#9CA3AF' },
  cardCount: { fontSize: 13, color: '#9CA3AF', marginTop: 6 },

  filterRowWrap: {
    backgroundColor: '#fff',
    borderBottomWidth: 0.5,
    borderBottomColor: '#F3F4F6',
    position: 'relative',
  },
  filterRowContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    flexDirection: 'row',
  },
  filterFade: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 40,
    backgroundColor: 'transparent',
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
  emptyEmojiImg: { width: 48, height: 48, tintColor: '#D1D5DB', resizeMode: 'contain' },
  emptyText: { fontSize: 18, fontWeight: '700', color: '#101828' },
  emptySub: { fontSize: 14, color: '#9CA3AF', textAlign: 'center' },

  // alignItems: 'stretch' makes cards in the same row match the tallest one's
  // height — required for sell-button alignment when one card has the extra
  // "×N @ price" line and its sibling doesn't.
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 12, alignItems: 'stretch' },
  card: {
    width: CARD_W,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
    flexDirection: 'column',
  },
  cardImgBox: {
    width: '100%',
    aspectRatio: 0.72,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  // Same outer shape as cards so the grid stays uniform.
  boxImgBox: {
    aspectRatio: 0.72,
    backgroundColor: '#F3F4F6',
  },
  cardImage: { width: '100%', height: '100%' },
  // Boxes are roughly square so contain leaves a lot of empty space in the
  // tall card-shaped container. Scale 1.5× to fill more of the slot — the
  // container clips with overflow:hidden so it stays inside its bounds.
  boxImage:  { width: '100%', height: '100%', transform: [{ scale: 1.5 }] },
  cardEmoji: { fontSize: 56 },
  psaBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#6B7280',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  gradeBadgeRaw:   { backgroundColor: '#6B7280' },
  gradeBadgePsa9:  { backgroundColor: '#3B82F6' },
  gradeBadgePsa10: { backgroundColor: '#F59E0B' },
  sealedBadge: { backgroundColor: '#059669' },
  openedBadge: { backgroundColor: '#D97706' },
  psaBadgeText: { fontSize: 10, color: '#fff', fontWeight: '700' },
  // Edit icon — small floating circle, top-left of the image area.
  editIconBtn: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  editIconImg: { width: 14, height: 14, tintColor: '#101828', resizeMode: 'contain' },
  boxTypePill: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(124,58,237,0.85)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  boxTypePillText: { fontSize: 10, color: '#fff', fontWeight: '700' },
  // flex:1 stretches the body to fill remaining height; sellBtn uses
  // marginTop:'auto' to stick to the bottom regardless of variable content
  // (cards with ×N quantity have an extra line; cards without don't).
  cardBody: { padding: 10, flex: 1 },
  cardName: { fontSize: 13, fontWeight: '700', color: '#101828', marginBottom: 2 },
  cardSet:  { fontSize: 10, color: '#9CA3AF', marginBottom: 8 },
  priceMainRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  priceMain:    { fontSize: 14, fontWeight: '800', color: '#101828', flexShrink: 1 },
  changePill:   { borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2, marginLeft: 4 },
  changePillText: { fontSize: 10, fontWeight: '700' },
  qtyText:      { fontSize: 10, color: '#9CA3AF', marginBottom: 6 },

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

  // Edit Modal (price / qty / purchase)
  editModal: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    width: '100%',
  },
  editTitle: { fontSize: 18, fontWeight: '800', color: '#101828', textAlign: 'center', marginBottom: 4 },
  editSub:   { fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginBottom: 16 },
  editLabel: { fontSize: 13, color: '#101828', fontWeight: '700', marginBottom: 6, marginTop: 8 },
  editInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: '#101828',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  editQtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  editQtyBtn: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: '#F9FAFB',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  editQtyBtnDisabled: { opacity: 0.35 },
  editQtyBtnText: { fontSize: 22, fontWeight: '700', color: '#101828', lineHeight: 24 },
  editQtyInput: {
    width: 60, height: 40, textAlign: 'center',
    fontSize: 16, fontWeight: '700', color: '#101828',
    backgroundColor: '#F9FAFB', borderRadius: 10,
    borderWidth: 1.5, borderColor: '#E5E7EB',
    paddingVertical: 0,
  },
  editSaveBtn: {
    marginTop: 20,
    backgroundColor: '#FF6900',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  editSaveText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  editCancelBtn: { paddingVertical: 12, alignItems: 'center' },
  editCancelText: { fontSize: 15, color: '#9CA3AF' },

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
  sellBtn: { marginTop: 'auto', backgroundColor: '#FFF3E8', borderRadius: 10, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: '#FFD4B2' },
  sellBtnText: { fontSize: 13, fontWeight: '700', color: '#FF6900' },
});