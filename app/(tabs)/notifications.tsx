import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const TABS = ['全部', '消息', '廣告'];

const ALL_NOTIFICATIONS = [
  { id: '1', type: '消息', title: 'CardMaster 讚了你的帖子', desc: '你的 Charizard VMAX 卡片真是太棒了！', time: '5分鐘前', unread: true, color: '#FFE4E6', icon: '❤️' },
  { id: '2', type: '消息', title: '新評論', desc: 'PokeFan852：這張卡多少錢可以出？', time: '1小時前', unread: true, color: '#EFF6FF', icon: '💬' },
  { id: '3', type: '廣告', title: '價格提醒', desc: 'Pikachu V 價格上漲 15%，目前 HK$520', time: '2小時前', unread: true, color: '#DCFCE7', icon: '📈' },
  { id: '4', type: '廣告', title: '限時優惠', desc: '全場卡片 8 折！只到今晚 12 點', time: '3小時前', unread: false, color: '#FFF3EB', icon: '🛍️' },
  { id: '5', type: '消息', title: 'TCG_Collector 關注了你', desc: '查看他的作品集', time: '5小時前', unread: false, color: '#F3F4F6', icon: '👤' },
  { id: '6', type: '廣告', title: '新活動', desc: '週末換卡聚會 - 旺角站 A 出口', time: '1天前', unread: false, color: '#F3E8FF', icon: '🎁' },
  { id: '7', type: '廣告', title: '商家推薦', desc: 'Card Master HK 上新一批日版卡包', time: '2天前', unread: false, color: '#FFF3EB', icon: '🛍️' },
];

export default function NotificationsScreen() {
  const [activeTab, setActiveTab] = useState('全部');
  const router = useRouter();
  const unreadCount = ALL_NOTIFICATIONS.filter(n => n.unread).length;

  const filtered = activeTab === '全部'
    ? ALL_NOTIFICATIONS
    : ALL_NOTIFICATIONS.filter(n => n.type === activeTab);

  return (
    <SafeAreaView style={styles.safe}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>通知</Text>
          <Text style={styles.unreadCount}>{unreadCount} 則未讀</Text>
        </View>
        <TouchableOpacity>
          <Text style={styles.markAll}>✓ 全部標為已讀</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {TABS.map(tab => (
          <TouchableOpacity key={tab} style={styles.tabBtn} onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
            {activeTab === tab && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        {filtered.map(n => (
          <TouchableOpacity key={n.id} style={styles.notifItem}>
            <View style={[styles.notifIcon, { backgroundColor: n.color }]}>
              <Text style={styles.notifEmoji}>{n.icon}</Text>
            </View>
            <View style={styles.notifBody}>
              <Text style={styles.notifTitle}>{n.title}</Text>
              <Text style={styles.notifDesc}>{n.desc}</Text>
              <Text style={styles.notifTime}>{n.time}</Text>
            </View>
            {n.unread && <View style={styles.unreadDot} />}
          </TouchableOpacity>
        ))}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  scroll: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' },
  backBtn: { padding: 4 },
  backIcon: { fontSize: 22, color: '#101828' },
  title: { fontSize: 18, fontWeight: '800', color: '#101828' },
  unreadCount: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  markAll: { fontSize: 13, color: '#FF6900', fontWeight: '600' },
  tabRow: { flexDirection: 'row', paddingHorizontal: 16, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' },
  tabBtn: { marginRight: 24, paddingVertical: 12, position: 'relative' },
  tabText: { fontSize: 15, color: '#9CA3AF', fontWeight: '500' },
  tabTextActive: { color: '#FF6900', fontWeight: '700' },
  tabUnderline: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: '#FF6900', borderRadius: 2 },
  notifItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6', gap: 14 },
  notifIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  notifEmoji: { fontSize: 22 },
  notifBody: { flex: 1 },
  notifTitle: { fontSize: 15, fontWeight: '700', color: '#101828', marginBottom: 3 },
  notifDesc: { fontSize: 13, color: '#6B7280', lineHeight: 18, marginBottom: 4 },
  notifTime: { fontSize: 12, color: '#9CA3AF' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF6900' },
});