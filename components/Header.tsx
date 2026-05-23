import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Modal, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '../contexts/CurrencyContext';
import { supabase } from '../lib/supabase';

const CURRENCIES = ['HKD', 'USD', 'JPY', 'CNY'] as const;

function Header() {
  const { currency, setCurrency } = useCurrency();
  const { t } = useTranslation();
  const [showDropdown, setShowDropdown]     = useState(false);
  const [unreadCount, setUnreadCount]       = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const router = useRouter();

  useFocusEffect(useCallback(() => {
    fetchUnread();
  }, []));

  const fetchUnread = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Notification unread count
    const { count: notifCount } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false);
    setUnreadCount(notifCount ?? 0);

    // Unread message count (sum of unread_buyer + unread_seller across conversations)
    const [buyerRes, sellerRes] = await Promise.all([
      supabase.from('conversations').select('unread_buyer').eq('buyer_id', user.id).gt('unread_buyer', 0),
      supabase.from('conversations').select('unread_seller').eq('seller_id', user.id).gt('unread_seller', 0),
    ]);
    const msgCount =
      (buyerRes.data ?? []).reduce((s, r) => s + (r.unread_buyer ?? 0), 0) +
      (sellerRes.data ?? []).reduce((s, r) => s + (r.unread_seller ?? 0), 0);
    setUnreadMessages(msgCount);
  };

  const handleNotificationsPress = () => {
    setUnreadCount(0);
    router.push('/(tabs)/notifications' as any);
  };

  const handleInboxPress = () => {
    setUnreadMessages(0); // optimistic clear
    router.push('/(tabs)/inbox' as any);
  };

  return (
    <View>
      <View style={styles.row1}>
        <Image
          source={require('../assets/images/Logo.png')}
          style={styles.logoImg}
          resizeMode="contain"
        />
      </View>
      <View style={styles.row2}>

        {/* Currency Button */}
        <TouchableOpacity style={styles.hkdBtn} onPress={() => setShowDropdown(true)}>
          <Text style={styles.hkdText}>{currency} ▾</Text>
        </TouchableOpacity>

        {/* Icons */}
        <View style={styles.iconRow}>
          <TouchableOpacity onPress={handleInboxPress} style={styles.iconWrap}>
            <Image source={require('../assets/icons/message.png')} style={styles.icon} />
            {unreadMessages > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadMessages > 99 ? '99+' : String(unreadMessages)}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={handleNotificationsPress} style={styles.iconWrap}>
            <Image source={require('../assets/icons/notification.png')} style={styles.icon} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadCount > 99 ? '99+' : String(unreadCount)}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/(tabs)/settings' as any)}>
            <Image source={require('../assets/icons/settings.png')} style={styles.icon} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Dropdown Modal */}
      <Modal visible={showDropdown} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setShowDropdown(false)}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback>
              <View style={styles.dropdown}>
                <Text style={styles.dropdownTitle}>{t('header.selectCurrency')}</Text>
                {CURRENCIES.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.dropdownItem, currency === c && styles.dropdownItemActive]}
                    onPress={() => { setCurrency(c); setShowDropdown(false); }}
                  >
                    <Text style={[styles.dropdownText, currency === c && styles.dropdownTextActive]}>
                      {c === 'HKD' ? t('header.hkd') :
                       c === 'USD' ? t('header.usd') :
                       c === 'JPY' ? t('header.jpy') :
                       t('header.cny')}
                    </Text>
                    {currency === c && <Text style={styles.checkmark}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

export default Header;

const styles = StyleSheet.create({
  row1: { alignItems: 'center', paddingVertical: 8, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' },
  // Logo.png is 4:1 aspect ratio (2560×640). Height 32 → width 128.
  logoImg: { height: 32, width: 128 },
  row2: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' },
  hkdBtn: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  hkdText: { fontSize: 13, color: '#101828' },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconWrap: { position: 'relative' },
  icon: { width: 20, height: 20, tintColor: '#101828' },
  badge: {
    position: 'absolute', top: -6, right: -8,
    backgroundColor: '#FF6900', borderRadius: 10,
    minWidth: 18, height: 18, paddingHorizontal: 4,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#fff',
  },
  badgeText: { fontSize: 10, fontWeight: '800', color: '#fff', lineHeight: 12 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-start', paddingTop: 110, paddingHorizontal: 16 },
  dropdown: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
  dropdownTitle: { fontSize: 13, fontWeight: '600', color: '#9CA3AF', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 0.5, borderTopColor: '#F3F4F6' },
  dropdownItemActive: { backgroundColor: '#FFF3EB' },
  dropdownText: { fontSize: 15, color: '#101828' },
  dropdownTextActive: { color: '#FF6900', fontWeight: '600' },
  checkmark: { fontSize: 16, color: '#FF6900', fontWeight: '700' },
});
