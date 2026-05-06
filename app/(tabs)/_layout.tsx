import { Tabs } from 'expo-router';
import { Image } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
        tabBarShowLabel: true,
      headerShown: false,
      tabBarStyle: {
        backgroundColor: '#fff',
        borderTopWidth: 0.5,
        borderTopColor: '#E5E7EB',
        paddingBottom: 28,
        paddingTop: 10,
        height: 90,
      },
      tabBarActiveTintColor: '#FF6900',
      tabBarInactiveTintColor: '#9CA3AF',
      tabBarLabelStyle: { fontSize: 10, marginTop: 3 },
    }}>
      <Tabs.Screen name="index" options={{
        title: '主頁',
        tabBarIcon: ({ color }) => (
          <Image source={require('../../assets/icons/主頁.png')} style={{ width: 22, height: 22, tintColor: color }} />
        ),
      }} />
      <Tabs.Screen name="search" options={{
        title: '搜尋',
        tabBarIcon: ({ color }) => (
          <Image source={require('../../assets/icons/搜尋.png')} style={{ width: 22, height: 22, tintColor: color }} />
        ),
      }} />
      <Tabs.Screen name="shops" options={{
        title: '商店',
        tabBarIcon: ({ color }) => (
          <Image source={require('../../assets/icons/商店.png')} style={{ width: 22, height: 22, tintColor: color }} />
        ),
      }} />
      <Tabs.Screen name="social" options={{
        title: '社交',
        tabBarIcon: ({ color }) => (
          <Image source={require('../../assets/icons/社交.png')} style={{ width: 22, height: 22, tintColor: color }} />
        ),
      }} />
      <Tabs.Screen name="portfolio" options={{
        title: '作品集',
        tabBarIcon: ({ color }) => (
          <Image source={require('../../assets/icons/作品集.png')} style={{ width: 22, height: 22, tintColor: color }} />
        ),
      }} />
      <Tabs.Screen name="profile" options={{
        title: '個人',
        tabBarIcon: ({ color }) => (
          <Image source={require('../../assets/icons/個人.png')} style={{ width: 22, height: 22, tintColor: color }} />
        ),
      }} />
    </Tabs>
  );
}