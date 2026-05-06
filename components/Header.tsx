import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

function Header() {
  return (
    <View>
      <View style={styles.row1}>
        <Text style={styles.logo}>HKCARDCOLL</Text>
      </View>
      <View style={styles.row2}>
        <TouchableOpacity style={styles.hkdBtn}>
          <Text style={styles.hkdText}>HKD ▾</Text>
        </TouchableOpacity>
        <Text style={styles.bell}>🔔</Text>
      </View>
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
  bell: { fontSize: 20 },
});