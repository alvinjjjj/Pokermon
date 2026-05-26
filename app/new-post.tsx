import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
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
import { useTheme } from '../theme/ThemeProvider';
import { type ColorTokens } from '../constants/colors';

type MediaAsset = {
  uri: string;
  type: 'image' | 'video';
  fileName?: string;
  mimeType?: string;
};

type PostCategory = 'post' | 'unboxing';

export default function NewPostScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { t } = useTranslation();
  const [media, setMedia]               = useState<MediaAsset | null>(null);
  const [caption, setCaption]           = useState('');
  const [cardName, setCardName]         = useState('');
  const [setName, setSetName]           = useState('');
  const [postCategory, setPostCategory] = useState<PostCategory>('post');
  const [uploading, setUploading]       = useState(false);
  const [showTos, setShowTos]           = useState(false);
  const [tosChecked, setTosChecked]     = useState(false);
  const [tosLoading, setTosLoading]     = useState(false);
  const userIdRef = useRef<string | null>(null);
  // 用 ref 追蹤本次 mount 是否已顯示過 ToS（避免 hot-reload 問題）
  const tosShownRef = useRef(false);

  useEffect(() => { checkTos(); }, []);

  // ── ToS check：只顯示一次（永久）─────────────────────────────────────────
  const TOS_KEY = 'tos_agreed_v1';

  const checkTos = async () => {
    if (tosShownRef.current) return;
    // 先查 AsyncStorage（最快，不需網絡）
    const cached = await AsyncStorage.getItem(TOS_KEY);
    if (cached === 'true') {
      tosShownRef.current = true;
      return;
    }
    // 再查 DB（處理帳號已在其他裝置同意的情況）
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    userIdRef.current = user.id;
    const { data } = await supabase
      .from('profiles').select('tos_agreed_at').eq('id', user.id).single();
    if (data?.tos_agreed_at) {
      // DB 已有記錄，寫入本機快取，之後不再查 DB
      await AsyncStorage.setItem(TOS_KEY, 'true');
      tosShownRef.current = true;
    } else {
      setShowTos(true);
    }
  };

  const handleTosAgree = async () => {
    setTosLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('profiles')
        .update({ tos_agreed_at: new Date().toISOString() })
        .eq('id', user.id);
    }
    // 本機永久記錄，之後重啟 app 都不再顯示
    await AsyncStorage.setItem(TOS_KEY, 'true');
    tosShownRef.current = true;
    setTosLoading(false);
    setShowTos(false);
  };

  // ── Media pickers ─────────────────────────────────────────────────────────

  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('search.cameraPermission'), t('search.cameraPermissionMsg'));
      return false;
    }
    return true;
  };

  const pickFromLibrary = async (type: 'image' | 'video') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: type === 'image'
        ? ImagePicker.MediaTypeOptions.Images
        : ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 0.85,
      videoMaxDuration: 60,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > 50 * 1024 * 1024) {
        Alert.alert(t('newPost.fileTooLarge'));
        return;
      }
      setMedia({
        uri: asset.uri,
        type,
        fileName: asset.fileName ?? `upload_${Date.now()}`,
        mimeType: asset.mimeType ?? (type === 'image' ? 'image/jpeg' : 'video/mp4'),
      });
    }
  };

  const pickFromCamera = async (type: 'image' | 'video') => {
    const ok = await requestCameraPermission();
    if (!ok) return;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: type === 'image'
        ? ImagePicker.MediaTypeOptions.Images
        : ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 0.85,
      videoMaxDuration: 60,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > 50 * 1024 * 1024) {
        Alert.alert(t('newPost.fileTooLarge'));
        return;
      }
      setMedia({
        uri: asset.uri,
        type,
        fileName: asset.fileName ?? `upload_${Date.now()}`,
        mimeType: asset.mimeType ?? (type === 'image' ? 'image/jpeg' : 'video/mp4'),
      });
    }
  };

  const showPickerSheet = (type: 'image' | 'video') => {
    Alert.alert(
      type === 'image' ? t('newPost.selectImageSource') : t('newPost.selectVideoSource'),
      undefined,
      [
        { text: t('newPost.camera'), onPress: () => pickFromCamera(type) },
        { text: t('newPost.library'), onPress: () => pickFromLibrary(type) },
        { text: t('common.cancel'), style: 'cancel' },
      ]
    );
  };

  // ── Upload + post ─────────────────────────────────────────────────────────

  const handlePost = async () => {
    if (uploading) return;                                       // guard against double-tap
    if (!media) { Alert.alert(t('newPost.noMedia')); return; }
    setUploading(true);

    let posted = false;
    let uploadedFilePath: string | null = null; // track so we can clean up on DB failure
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(t('newPost.notLoggedIn'));

      const ext      = media.mimeType?.split('/')[1] ?? 'jpg';
      const filePath = `${user.id}/${Date.now()}.${ext}`;

      const response    = await fetch(media.uri);
      const arrayBuffer = await response.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from('posts')
        .upload(filePath, arrayBuffer, { contentType: media.mimeType });

      if (uploadError) throw uploadError;
      uploadedFilePath = filePath; // file is now in storage

      const { data: { publicUrl } } = supabase.storage
        .from('posts')
        .getPublicUrl(filePath);

      const { data: insertData, error: insertError } = await supabase
        .from('posts')
        .insert({
          user_id:        user.id,
          media_url:      publicUrl,
          media_type:     media.type,
          thumbnail_url:  media.type === 'image' ? publicUrl : null,
          caption:        caption.trim() || null,
          card_name:      cardName.trim() || null,
          set_name:       setName.trim() || null,
          post_category:  postCategory,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      // 調用 AI 審核（背景執行，不阻塞用戶）
      supabase.functions.invoke('moderate-post', {
        body: { post_id: insertData.id, media_url: publicUrl, media_type: media.type },
      }).catch(e => { if (__DEV__) console.warn('Moderation invoke failed:', e); });

      posted = true;
      // 跳到社交頁，立即看到新帖子
      router.replace('/(tabs)/social' as any);

    } catch (e: any) {
      // Clean up the uploaded file if the DB insert (or any later step) failed,
      // so we don't leave orphaned files in storage.
      if (uploadedFilePath) {
        supabase.storage.from('posts').remove([uploadedFilePath])
          .catch(rmErr => { if (__DEV__) console.warn('Orphan cleanup failed:', rmErr); });
      }
      Alert.alert(t('newPost.uploadFailed'), e.message ?? t('common.tryAgain'));
    } finally {
      // Only release the guard on failure — on success the screen unmounts via router.replace
      if (!posted) setUploading(false);
    }
  };

  // ── ToS Modal ─────────────────────────────────────────────────────────────

  const renderTosModal = () => (
    <Modal visible={showTos} transparent animationType="slide" onRequestClose={() => setShowTos(false)}>
      <View style={styles.tosOverlay}>
        <View style={styles.tosSheet}>
          <Text style={styles.tosTitle}>{t('newPost.tosTitle')}</Text>
          <Text style={styles.tosSubtitle}>{t('newPost.tosSubtitle')}</Text>

          <ScrollView style={styles.tosScroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.tosSection}>{t('newPost.tosForbiddenSection')}</Text>
            <Text style={styles.tosItem}>{t('newPost.tosForbidden1')}</Text>
            <Text style={styles.tosItem}>{t('newPost.tosForbidden2')}</Text>
            <Text style={styles.tosItem}>{t('newPost.tosForbidden3')}</Text>
            <Text style={styles.tosItem}>{t('newPost.tosForbidden4')}</Text>
            <Text style={styles.tosItem}>{t('newPost.tosForbidden5')}</Text>

            <Text style={[styles.tosSection, { marginTop: 16 }]}>{t('newPost.tosAllowedSection')}</Text>
            <Text style={styles.tosItem}>{t('newPost.tosAllowed1')}</Text>
            <Text style={styles.tosItem}>{t('newPost.tosAllowed2')}</Text>
            <Text style={styles.tosItem}>{t('newPost.tosAllowed3')}</Text>

            <Text style={[styles.tosSection, { marginTop: 16 }]}>{t('newPost.tosAutoSection')}</Text>
            <Text style={styles.tosBody}>
              {t('newPost.tosAutoBody')}
            </Text>
            <View style={{ height: 16 }} />
          </ScrollView>

          <TouchableOpacity
            style={styles.tosCheckRow}
            onPress={() => setTosChecked(prev => !prev)}
          >
            <View style={[styles.tosCheckbox, tosChecked && styles.tosCheckboxChecked]}>
              {tosChecked && <Text style={styles.tosCheckmark}>✓</Text>}
            </View>
            <Text style={styles.tosCheckLabel}>
              {t('newPost.tosCheckLabel')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tosAgreeBtn, !tosChecked && styles.tosAgreeBtnDisabled]}
            onPress={tosChecked ? handleTosAgree : undefined}
            disabled={!tosChecked || tosLoading}
          >
            {tosLoading
              // '#fff' kept raw — always-white on brand orange
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.tosAgreeBtnText}>{t('newPost.tosAgreeBtn')}</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={styles.tosCancelBtn} onPress={() => router.back()}>
            <Text style={styles.tosCancelText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} disabled={uploading}>
            <Text style={[styles.cancelText, uploading && { opacity: 0.4 }]}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('newPost.title')}</Text>
          <TouchableOpacity
            style={[styles.postBtn, (!media || uploading) && styles.postBtnDisabled]}
            onPress={handlePost}
            disabled={!media || uploading}
          >
            {uploading
              // '#fff' kept raw — always-white on brand orange
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.postBtnText}>{t('newPost.publish')}</Text>
            }
          </TouchableOpacity>
        </View>

        {/* ── 帖子類型 selector ── */}
        <View style={styles.categoryRow}>
          <TouchableOpacity
            style={[styles.categoryBtn, postCategory === 'post' && styles.categoryBtnActive]}
            onPress={() => setPostCategory('post')}
          >
            <Text style={[styles.categoryText, postCategory === 'post' && styles.categoryTextActive]}>
              {t('newPost.categoryPost')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.categoryBtn, postCategory === 'unboxing' && styles.categoryBtnActive]}
            onPress={() => setPostCategory('unboxing')}
          >
            <Text style={[styles.categoryText, postCategory === 'unboxing' && styles.categoryTextActive]}>
              {t('newPost.categoryUnboxing')}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* ── Media section ── */}
          {!media ? (
            <View style={styles.pickerSection}>
              <Text style={styles.pickerTitle}>{t('newPost.selectMedia')}</Text>

              <View style={styles.pickerRow}>
                <TouchableOpacity style={[styles.pickerBtn, styles.pickerBtnCamera]} onPress={() => pickFromCamera('image')}>
                  <Text style={styles.pickerBtnLabel}>{t('newPost.takePhoto')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.pickerBtn, styles.pickerBtnCamera]} onPress={() => pickFromCamera('video')}>
                  <Text style={styles.pickerBtnLabel}>{t('newPost.recordVideo')}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.orDivider}>
                <View style={styles.orLine} />
                <Text style={styles.orText}>{t('newPost.orFromLibrary')}</Text>
                <View style={styles.orLine} />
              </View>

              <View style={styles.pickerRow}>
                <TouchableOpacity style={[styles.pickerBtn, styles.pickerBtnLibrary]} onPress={() => pickFromLibrary('image')}>
                  <Text style={[styles.pickerBtnLabel, styles.pickerBtnLabelLight]}>{t('newPost.photo')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.pickerBtn, styles.pickerBtnLibrary]} onPress={() => pickFromLibrary('video')}>
                  <Text style={[styles.pickerBtnLabel, styles.pickerBtnLabelLight]}>{t('newPost.video')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.previewWrap}>
              <Image source={{ uri: media.uri }} style={styles.preview} resizeMode="cover" />
              {media.type === 'video' && (
                <View style={styles.videoOverlay}>
                  <Text style={styles.videoOverlayText}>{t('newPost.videoTag')}</Text>
                </View>
              )}
              <View style={styles.reprPickRow}>
                <TouchableOpacity style={styles.reprPickBtn} onPress={() => setMedia(null)}>
                  <Text style={styles.reprPickText}>{t('newPost.removeMedia')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.reprPickBtn} onPress={() => showPickerSheet(media.type)}>
                  <Text style={styles.reprPickText}>{t('newPost.changeMedia')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── Form ── */}
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>{t('newPost.captionLabel')}</Text>
              <TextInput
                style={styles.captionInput}
                value={caption}
                onChangeText={setCaption}
                placeholder={t('newPost.captionPlaceholder')}
                placeholderTextColor={colors.text.tertiary}
                multiline
                maxLength={300}
                textAlignVertical="top"
              />
              <Text style={styles.charCount}>{caption.length}/300</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.field}>
              <Text style={styles.label}>{t('newPost.cardNameLabel')}</Text>
              <TextInput
                style={styles.input}
                value={cardName}
                onChangeText={setCardName}
                placeholder={t('newPost.cardNamePlaceholder')}
                placeholderTextColor={colors.text.tertiary}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.field}>
              <Text style={styles.label}>{t('newPost.setNameLabel')}</Text>
              <TextInput
                style={styles.input}
                value={setName}
                onChangeText={setSetName}
                placeholder={t('newPost.setNamePlaceholder')}
                placeholderTextColor={colors.text.tertiary}
              />
            </View>
          </View>

          <View style={{ height: 60 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {renderTosModal()}
    </SafeAreaView>
  );
}

function makeStyles(colors: ColorTokens) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.surface.section },

    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 12,
      backgroundColor: colors.surface.card, borderBottomWidth: 0.5, borderBottomColor: colors.surface.section,
    },
    headerBtn: { minWidth: 56 },
    cancelText: { fontSize: 15, color: colors.text.secondary },
    headerTitle: { fontSize: 16, fontWeight: '700', color: colors.text.primary },
    postBtn: {
      backgroundColor: colors.brand.orange, borderRadius: 10,
      paddingHorizontal: 18, paddingVertical: 8, minWidth: 60, alignItems: 'center',
    },
    postBtnDisabled: { backgroundColor: '#FDBA74' }, // light-orange disabled state, kept raw
    // '#fff' kept raw — always-white on brand orange
    postBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

    // Category selector
    categoryRow: {
      flexDirection: 'row', gap: 10,
      paddingHorizontal: 16, paddingVertical: 12,
      backgroundColor: colors.surface.card, borderBottomWidth: 0.5, borderBottomColor: colors.surface.section,
    },
    categoryBtn: {
      flex: 1, paddingVertical: 10, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1.5, borderColor: colors.border.default, backgroundColor: colors.surface.section,
    },
    categoryBtnActive: { backgroundColor: colors.brand.peach, borderColor: colors.brand.orange },
    categoryText: { fontSize: 14, fontWeight: '600', color: colors.text.tertiary },
    categoryTextActive: { color: colors.brand.orange },

    // Picker
    pickerSection: {
      margin: 16, backgroundColor: colors.surface.card, borderRadius: 20,
      padding: 24, borderWidth: 1, borderColor: colors.surface.section,
    },
    pickerTitle: { fontSize: 14, fontWeight: '700', color: colors.text.primary, marginBottom: 18, textAlign: 'center' },
    pickerRow: { flexDirection: 'row', gap: 12, marginBottom: 4 },
    pickerBtn: {
      flex: 1, borderRadius: 16, paddingVertical: 22,
      alignItems: 'center', justifyContent: 'center',
    },
    pickerBtnCamera: { backgroundColor: colors.brand.orange },
    pickerBtnLibrary: { backgroundColor: colors.surface.section },
    // '#fff' kept raw — always-white on brand orange
    pickerBtnLabel: { fontSize: 15, fontWeight: '700', color: '#fff' },
    pickerBtnLabelLight: { color: colors.text.primary },

    orDivider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 16 },
    orLine: { flex: 1, height: 0.5, backgroundColor: colors.border.default },
    orText: { fontSize: 12, color: colors.text.tertiary, fontWeight: '500' },

    // Preview
    previewWrap: { margin: 16, borderRadius: 20, overflow: 'hidden', position: 'relative' },
    preview: { width: '100%', height: 340 },
    videoOverlay: {
      position: 'absolute', top: 12, left: 12,
      // rgba(0,0,0,0.55) kept raw — on-image scrim
      backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8,
      paddingHorizontal: 10, paddingVertical: 5,
    },
    // '#fff' kept raw — always-white on dark scrim
    videoOverlayText: { color: '#fff', fontSize: 13, fontWeight: '600' },
    reprPickRow: { position: 'absolute', top: 12, right: 12, flexDirection: 'row', gap: 8 },
    reprPickBtn: {
      // rgba(0,0,0,0.55) kept raw — on-image scrim
      backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8,
      paddingHorizontal: 12, paddingVertical: 6,
    },
    // '#fff' kept raw — always-white on dark scrim
    reprPickText: { color: '#fff', fontSize: 13, fontWeight: '600' },

    // Form
    form: {
      backgroundColor: colors.surface.card, borderRadius: 20,
      marginHorizontal: 16, paddingHorizontal: 16, paddingTop: 4,
    },
    field: { paddingVertical: 14 },
    label: {
      fontSize: 11, fontWeight: '700', color: colors.text.tertiary,
      textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8,
    },
    captionInput: { fontSize: 15, color: colors.text.primary, minHeight: 80, lineHeight: 22 },
    input: { fontSize: 15, color: colors.text.primary },
    charCount: { fontSize: 11, color: colors.border.strong, textAlign: 'right', marginTop: 4 },
    divider: { height: 0.5, backgroundColor: colors.surface.section },

    // ToS Modal
    tosOverlay: { flex: 1, backgroundColor: colors.overlay.medium, justifyContent: 'flex-end' },
    tosSheet: {
      backgroundColor: colors.surface.elevated, borderTopLeftRadius: 28, borderTopRightRadius: 28,
      paddingHorizontal: 20, paddingTop: 24, paddingBottom: 36, maxHeight: '88%',
    },
    tosTitle: { fontSize: 22, fontWeight: '800', color: colors.text.primary, textAlign: 'center', marginBottom: 4 },
    tosSubtitle: { fontSize: 14, color: colors.text.secondary, textAlign: 'center', marginBottom: 18 },
    tosScroll: { maxHeight: 320 },
    tosSection: { fontSize: 13, fontWeight: '800', color: colors.text.primary, marginBottom: 8, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
    tosItem: { fontSize: 14, color: colors.text.primary, lineHeight: 22, marginBottom: 2 },
    tosBody: { fontSize: 13, color: colors.text.secondary, lineHeight: 20 },
    tosCheckRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 20, marginBottom: 16 },
    tosCheckbox: {
      width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.border.strong,
      alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
    },
    tosCheckboxChecked: { backgroundColor: colors.brand.orange, borderColor: colors.brand.orange },
    // '#fff' kept raw — always-white on brand orange
    tosCheckmark: { fontSize: 13, color: '#fff', fontWeight: '800' },
    tosCheckLabel: { flex: 1, fontSize: 13, color: colors.text.primary, lineHeight: 20 },
    tosAgreeBtn: {
      backgroundColor: colors.brand.orange, borderRadius: 16, paddingVertical: 16, alignItems: 'center',
    },
    tosAgreeBtnDisabled: { backgroundColor: '#FDBA74' }, // light-orange disabled state, kept raw
    // '#fff' kept raw — always-white on brand orange
    tosAgreeBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
    tosCancelBtn: { paddingVertical: 14, alignItems: 'center' },
    tosCancelText: { fontSize: 14, color: colors.text.tertiary },
  });
}
