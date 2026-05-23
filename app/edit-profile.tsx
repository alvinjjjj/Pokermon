import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import Loader from '../components/Loader';

export default function EditProfileScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [bio, setBio]          = useState('');
  const [avatarUrl, setAvatarUrl]   = useState<string | null>(null);
  const [localAvatar, setLocalAvatar] = useState<string | null>(null);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [userId, setUserId]         = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { return; }
      setUserId(user.id);

      const { data } = await supabase
        .from('profiles')
        .select('username, bio, avatar_url')
        .eq('id', user.id)
        .single();

      if (data) {
        setUsername(data.username ?? '');
        setBio(data.bio ?? '');
        setAvatarUrl(data.avatar_url ?? null);
      }
    } catch (e) {
      if (__DEV__) console.error('[EditProfile] loadProfile error:', e);
    } finally {
      setLoading(false);
    }
  };

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.4,   // keep well under 1 MB
    });
    if (!result.canceled && result.assets[0]) {
      setLocalAvatar(result.assets[0].uri);
    }
  };

  const uploadAvatar = async (uri: string): Promise<string | null> => {
    try {
      const rawExt = uri.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'jpg';
      const ext    = ['jpg', 'jpeg', 'png', 'webp'].includes(rawExt) ? rawExt : 'jpg';
      const mime   = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      // flat path — avoids folder-based RLS issues
      const path   = `avatar_${userId}_${Date.now()}.${ext}`;

      const response    = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();

      const { error } = await supabase.storage
        .from('avatars')
        .upload(path, arrayBuffer, { contentType: mime, upsert: true });

      if (error) {
        if (__DEV__) console.error('uploadAvatar error:', error.message);
        Alert.alert(t('editProfile.avatarUploadFailed'), error.message);
        return null;
      }
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      return data.publicUrl;
    } catch (e: any) {
      if (__DEV__) console.error('uploadAvatar exception:', e?.message ?? e);
      Alert.alert(t('editProfile.avatarUploadFailed'), e?.message ?? t('editProfile.unknownError'));
      return null;
    }
  };

  const handleSave = async () => {
    if (!username.trim()) {
      Alert.alert(t('common.error'), t('editProfile.usernameEmpty'));
      return;
    }
    setSaving(true);
    try {
      let finalAvatarUrl = avatarUrl;
      if (localAvatar) {
        const uploaded = await uploadAvatar(localAvatar);
        if (uploaded) {
          finalAvatarUrl = uploaded;
        } else {
          // uploadAvatar already showed an alert — stop here
          return;
        }
      }

      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          username: username.trim(),
          bio: bio.trim(),
          avatar_url: finalAvatarUrl,
        }, { onConflict: 'id' });

      if (error) {
        Alert.alert(t('editProfile.saveFailed'), error.message);
      } else {
        Alert.alert(t('editProfile.saved'), t('editProfile.profileUpdated'), [
          { text: t('common.ok'), onPress: () => router.replace('/(tabs)/profile' as any) },
        ]);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Loader size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const displayAvatar = localAvatar ?? avatarUrl;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>{t('editProfile.cancel')}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('editProfile.title')}</Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={styles.headerBtn}
          >
            {saving
              ? <ActivityIndicator size="small" color="#FF6900" />
              : <Text style={[styles.headerBtnText, styles.headerSaveText]}>{t('editProfile.save')}</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Avatar */}
          <TouchableOpacity style={styles.avatarWrap} onPress={pickAvatar}>
            {displayAvatar ? (
              <Image source={{ uri: displayAvatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder} />
            )}
            <View style={styles.avatarEditBadge}>
              <Image source={require('../assets/icons/pen.png')} style={styles.avatarEditIcon} />
            </View>
          </TouchableOpacity>
          <Text style={styles.changePhotoText}>{t('editProfile.changePhoto')}</Text>

          {/* Fields */}
          <View style={styles.fieldGroup}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t('editProfile.username')}</Text>
              <TextInput
                style={styles.fieldInput}
                value={username}
                onChangeText={setUsername}
                placeholder={t('editProfile.usernamePlaceholder')}
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                maxLength={30}
              />
            </View>
            <View style={styles.separator} />
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t('editProfile.bio')}</Text>
              <TextInput
                style={[styles.fieldInput, styles.bioInput]}
                value={bio}
                onChangeText={setBio}
                placeholder={t('editProfile.bioPlaceholder')}
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
                maxLength={150}
              />
              <Text style={styles.charCount}>{bio.length}/150</Text>
            </View>
          </View>

          <View style={{ height: 60 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F3F4F6',
  },
  headerBtn: { minWidth: 60 },
  headerBtnText: { fontSize: 16, color: '#6B7280' },
  headerSaveText: { color: '#FF6900', fontWeight: '700', textAlign: 'right' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#101828' },

  content: { alignItems: 'center', paddingTop: 28, paddingHorizontal: 16 },

  avatarWrap: { position: 'relative', marginBottom: 8 },
  avatar: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 2, borderColor: '#FF6900',
  },
  avatarPlaceholder: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#FF6900',
  },
  avatarEmoji: { fontSize: 44 },
  avatarEditBadge: {
    position: 'absolute', bottom: 2, right: 2,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#FF6900',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  avatarEditIcon: { width: 14, height: 14, resizeMode: 'contain', tintColor: '#fff' },
  changePhotoText: { fontSize: 14, color: '#FF6900', fontWeight: '600', marginBottom: 28 },

  fieldGroup: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  field: { paddingHorizontal: 16, paddingVertical: 14 },
  fieldLabel: { fontSize: 12, color: '#9CA3AF', fontWeight: '600', marginBottom: 6 },
  fieldInput: { fontSize: 16, color: '#101828' },
  bioInput: { height: 72, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: '#D1D5DB', textAlign: 'right', marginTop: 4 },
  separator: { height: 0.5, backgroundColor: '#E5E7EB', marginLeft: 16 },
});
