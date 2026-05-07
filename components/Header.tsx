import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Modal, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';

const CURRENCIES = ['HKD', 'USD', 'JPY', 'CNY'];

function Header() {
  const [currency, setCurrency] = useState('HKD');
  const [showDropdown, setShowDropdown] = useState(false);
  const router = useRouter();

  return (
    <View>
      <View style={styles.row1}>
        <Text style={styles.logo}>HKCARDCOLL</Text>
      </View>
      <View style={styles.row2}>

        {/* Currency Button */}
        <TouchableOpacity style={styles.hkdBtn} onPress={() => setShowDropdown(true)}>
          <Text style={styles.hkdText}>{currency} ▾</Text>
        </TouchableOpacity>

        {/* Icons */}
        <View style={styles.iconRow}>
          <TouchableOpacity onPress={() => router.push('/notifications')}>
            <Image source={require('../assets/icons/alart.png')} style={styles.icon} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/settings')}>
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
                <Text style={styles.dropdownTitle}>選擇貨幣</Text>
                {CURRENCIES.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.dropdownItem, currency === c && styles.dropdownItemActive]}
                    onPress={() => {
                      setCurrency(c);
                      setShowDropdown(false);
                    }}
                  >
                    <Text style={[styles.dropdownText, currency === c && styles.dropdownTextActive]}>
                      {c === 'HKD' ? '🇭🇰 港幣 HKD' :
                       c === 'USD' ? '🇺🇸 美元 USD' :
                       c === 'JPY' ? '🇯🇵 日圓 JPY' :
                       '🇨🇳 人民幣 CNY'}
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
  row1: { alignItems: 'center', paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' },
  logo: { fontSize: 16, fontWeight: '800', color: '#101828', letterSpacing: 3 },
  row2: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' },
  hkdBtn: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  hkdText: { fontSize: 13, color: '#101828' },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  icon: { width: 20, height: 20, tintColor: '#101828' },

  // Dropdown
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-start', paddingTop: 110, paddingHorizontal: 16 },
  dropdown: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
  dropdownTitle: { fontSize: 13, fontWeight: '600', color: '#9CA3AF', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 0.5, borderTopColor: '#F3F4F6' },
  dropdownItemActive: { backgroundColor: '#FFF3EB' },
  dropdownText: { fontSize: 15, color: '#101828' },
  dropdownTextActive: { color: '#FF6900', fontWeight: '600' },
  checkmark: { fontSize: 16, color: '#FF6900', fontWeight: '700' },
});