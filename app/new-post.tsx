import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
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

type MediaAsset = {
  uri: string;
  type: 'image' | 'video';
  fileName?: string;
  mimeType?: string;
};

export default function NewPostScreen() {
  const router = useRouter();
  const [media, setMedia] = useState<MediaAsset | null>(null);
  const [caption, setCaption] = useState('');
  const [cardName, setCardName] = useState('');
  const [setName, setSetName] = useState('');
  const [uploading, setUploading] = useState(false);

  async function pickMedia(type: 'image' | 'video') {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: type === 'image'
        ? ImagePicker.MediaTypeOptions.Images
        : ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 0.85,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setMedia({
        uri: asset.uri,
        type,
        fileName: asset.fileName ?? `upload_${Date.now()}`,
        mimeType: asset.mimeType ?? (type === 'image' ? 'image/jpeg' : 'video/mp4'),
      });
    }
  }

  async function handlePost() {
    if (!media) { Alert.alert('請先選擇圖片或影片'); return; }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('未登入');

      // Upload media to Supabase Storage
      const ext = media.mimeType?.split('/')[1] ?? 'jpg';
      const filePath = `${user.id}/${Date.now()}.${ext}`;

      const response = await fetch(media.uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from('posts')
        .upload(filePath, blob, { contentType: media.mimeType });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('posts')
        .getPublicUrl(filePath);

      // Insert post record
      const { error: insertError } = await supabase.from('posts').insert({
        user_id: user.id,
        media_url: publicUrl,
        media_type: media.type,
        thumbnail_url: media.type === 'image' ? publicUrl : null,
        caption: caption.trim() || null,
        card_name: cardName.trim() || null,
        set_name: setName.trim() || null,
      });

      if (insertError) throw insertError;

      Alert.alert('成功', '帖子已發佈！', [
        { text: '好', onPress: () => router.back() }
      ]);
    } catch (e: any) {
      Alert.alert('上傳失敗', e.message ?? '請再試一次');
    } finally {
      setUploading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Text style={styles.cancelText}>取消</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>新帖子</Text>
          <TouchableOpacity
            style={[styles.postBtn, (!media || uploading) && styles.postBtnDisabled]}
            onPress={handlePost}
            disabled={!media || uploading}
          >
            {uploading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.postBtnText}>發佈</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>

          {/* Media Picker */}
          {!media ? (
            <View style={styles.mediaPicker}>
              <Text style={styles.mediaPickerTitle}>選擇媒體</Text>
              <View style={styles.mediaPickerBtns}>
                <TouchableOpacity
                  style={styles.mediaTypeBtn}
                  onPress={() => pickMedia('image')}
                >
                  <Text style={styles.mediaTypeBtnEmoji}>🖼️</Text>
                  <Text style={styles.mediaTypeBtnText}>圖片</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.mediaTypeBtn}
                  onPress={() => pickMedia('video')}
                >
                  <Text style={styles.mediaTypeBtnEmoji}>🎬</Text>
                  <Text style={styles.mediaTypeBtnText}>影片</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.previewWrap}>
              <Image source={{ uri: media.uri }} style={styles.preview} resizeMode="cover" />
              {media.type === 'video' && (
                <View style={styles.videoOverlay}>
                  <Text style={styles.videoOverlayText}>▶ 影片</Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.changeMedia}
                onPress={() => setMedia(null)}
              >
                <Text style={styles.changeMediaText}>更換</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Form */}
          <View style={styles.form}>

            <View style={styles.field}>
              <Text style={styles.label}>說點什麼...</Text>
              <TextInput
                style={styles.captionInput}
                value={caption}
                onChangeText={setCaption}
                placeholder="今日抽到了..."
                placeholderTextColor="#9CA3AF"
                multiline
                maxLength={300}
                textAlignVertical="top"
              />
              <Text style={styles.charCount}>{caption.length}/300</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.field}>
              <Text style={styles.label}>卡片名稱（選填）</Text>
              <TextInput
                style={styles.input}
                value={cardName}
                onChangeText={setCardName}
                placeholder="例：Charizard ex"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.field}>
              <Text style={styles.label}>系列（選填）</Text>
              <TextInput
                style={styles.input}
                value={setName}
                onChangeText={setSetName}
                placeholder="例：Prismatic Evolutions"
                placeholderTextColor="#9CA3AF"
              />
            </View>

          </View>

          <View style={{ height: 60 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 0.5,
    borderBottomColor: '#F3F4F6',
  },
  headerBtn: { minWidth: 56 },
  cancelText: { fontSize: 15, color: '#6B7280' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#101828' },
  postBtn: {
    backgroundColor: '#FF6900',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 8,
    minWidth: 56,
    alignItems: 'center',
  },
  postBtnDisabled: { backgroundColor: '#FDBA74' },
  postBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },

  // Media picker
  mediaPicker: {
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#F3F4F6',
    borderStyle: 'dashed',
  },
  mediaPickerTitle: { fontSize: 15, fontWeight: '600', color: '#101828', marginBottom: 20 },
  mediaPickerBtns: { flexDirection: 'row', gap: 16 },
  mediaTypeBtn: {
    width: 100,
    height: 100,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  mediaTypeBtnEmoji: { fontSize: 32, marginBottom: 8 },
  mediaTypeBtnText: { fontSize: 13, fontWeight: '600', color: '#101828' },

  // Preview
  previewWrap: { margin: 16, borderRadius: 16, overflow: 'hidden', position: 'relative' },
  preview: { width: '100%', height: 300 },
  videoOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  videoOverlayText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  changeMedia: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  changeMediaText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  // Form
  form: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  field: { paddingVertical: 14 },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  captionInput: {
    fontSize: 15,
    color: '#101828',
    minHeight: 80,
    lineHeight: 22,
  },
  input: { fontSize: 15, color: '#101828' },
  charCount: { fontSize: 11, color: '#D1D5DB', textAlign: 'right', marginTop: 4 },
  divider: { height: 0.5, backgroundColor: '#F3F4F6' },
});