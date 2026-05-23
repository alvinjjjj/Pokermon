// Redirect stub — real card detail page lives at app/(tabs)/card/[id].tsx
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

export default function CardRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  useEffect(() => {
    if (id) {
      router.replace({ pathname: '/(tabs)/card/[id]', params: { id } } as any);
    }
  }, [id]);
  return <View />;
}
