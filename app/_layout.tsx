import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import SplashScreen from '../components/SplashScreen';
import { CurrencyProvider } from '../contexts/CurrencyContext';
import { LanguageProvider } from '../contexts/LanguageContext';
import { clearArtofpkmCaches } from '../lib/artofpkm';
import { clearJpImageCaches } from '../lib/jpImages';
import { supabase } from '../lib/supabase';

// Minimum splash display time (ms) so the brand always shows, even when
// Supabase resolves the session in <100 ms (cached locally).
const SPLASH_MIN_MS = 3000;

export default function RootLayout() {
  const [session, setSession] = useState<any>(undefined);
  const [splashMinElapsed, setSplashMinElapsed] = useState(false);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      // Clear cross-user caches on logout to prevent the next signed-in user
      // from seeing the previous user's resolved images on a shared device.
      if (event === 'SIGNED_OUT') {
        clearArtofpkmCaches();
        clearJpImageCaches();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2-second minimum splash window — covers fast cached sessions.
  useEffect(() => {
    const t = setTimeout(() => setSplashMinElapsed(true), SPLASH_MIN_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (session === undefined) return;

    const inTabs     = segments[0] === '(tabs)';
    const inAuthFlow = ['onboarding', 'login', 'register'].includes(segments[0] ?? '');

    // Not logged in + trying to use the app → send to onboarding
    if (!session && inTabs) {
      router.replace('/onboarding');
    }
    // Logged in + on an auth/onboarding screen → send to app
    else if (session && inAuthFlow) {
      router.replace('/(tabs)');
    }
    // Any other screen (e.g. /card/[id], /post-detail) → let it render normally
  }, [session, segments]);

  // Render branded splash while either:
  //   (a) the Supabase session resolution is still pending, OR
  //   (b) the 3-second minimum display window hasn't elapsed yet.
  if (session === undefined || !splashMinElapsed) {
    return <SplashScreen />;
  }

  return (
    <LanguageProvider>
    <CurrencyProvider>
      {/* Dark status-bar icons (clock, signal, battery) — the app uses a
          light background so the iOS default "light" content would render
          white-on-white and be unreadable. */}
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="card/[id]" />
        <Stack.Screen name="edit-profile" />
        <Stack.Screen name="new-post" />
        <Stack.Screen name="post-detail" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="verify-otp" />
        <Stack.Screen name="change-password" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="reset-password" />
        <Stack.Screen name="admin" />
        <Stack.Screen name="user/[id]" />
        <Stack.Screen name="merchant/[id]" />
        <Stack.Screen name="seller-registration" />
        <Stack.Screen name="merchant-registration" />
        <Stack.Screen name="edit-shop" />
        <Stack.Screen name="my-listings" />
        <Stack.Screen name="listing-upload" />
        <Stack.Screen name="listing/[id]" />
        <Stack.Screen name="terms" />
        <Stack.Screen name="privacy" />
        <Stack.Screen name="public-portfolio/[userId]" />
        <Stack.Screen name="chat/[id]" />
      </Stack>
    </CurrencyProvider>
    </LanguageProvider>
  );
}