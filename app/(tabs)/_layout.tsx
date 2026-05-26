import { Tabs } from 'expo-router';
import { Image } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeProvider';

export default function TabLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Tabs screenOptions={{
        tabBarShowLabel: true,
      headerShown: false,
      tabBarStyle: {
        backgroundColor: colors.surface.card,
        borderTopWidth: 0.5,
        borderTopColor: colors.border.default,
        paddingBottom: 28,
        paddingTop: 10,
        height: 90,
      },
      tabBarActiveTintColor: colors.brand.orange,
      tabBarInactiveTintColor: colors.text.tertiary,
      tabBarLabelStyle: { fontSize: 10, marginTop: 3 },
    }}>
      <Tabs.Screen name="index" options={{
        title: t('tabs.home'),
        tabBarIcon: ({ color }) => (
          <Image source={require('../../assets/icons/home.png')} style={{ width: 22, height: 22, tintColor: color }} />
        ),
      }} />
      <Tabs.Screen name="search" options={{
        title: t('tabs.search'),
        tabBarIcon: ({ color }) => (
          <Image source={require('../../assets/icons/search.png')} style={{ width: 22, height: 22, tintColor: color }} />
        ),
      }} />
      <Tabs.Screen name="portfolio" options={{
        title: t('tabs.portfolio'),
        tabBarIcon: ({ color }) => (
          <Image source={require('../../assets/icons/portfolio.png')} style={{ width: 22, height: 22, tintColor: color }} />
        ),
      }} />
      <Tabs.Screen name="shops" options={{
        title: t('tabs.shops'),
        tabBarIcon: ({ color }) => (
          <Image source={require('../../assets/icons/shops.png')} style={{ width: 22, height: 22, tintColor: color }} />
        ),
      }} />
      <Tabs.Screen name="profile" options={{
        title: t('tabs.profile'),
        tabBarIcon: ({ color }) => (
          <Image source={require('../../assets/icons/profile.png')} style={{ width: 22, height: 22, tintColor: color }} />
        ),
      }} />

      {/* 隱藏頁面，不顯示在底部 tab */}
      <Tabs.Screen name="social"        options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="inbox"         options={{ href: null }} />
      <Tabs.Screen name="settings"      options={{ href: null }} />
      <Tabs.Screen name="card/[id]"     options={{ href: null }} />
    </Tabs>
  );
}