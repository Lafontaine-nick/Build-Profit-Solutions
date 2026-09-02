import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  ScrollView,
  Platform,
  TextInput,
  Keyboard,
  Alert,
  StatusBar,
  KeyboardAvoidingView,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  BRAND_FRAME_GRADIENT_COLORS,
  BRAND_FRAME_GRADIENT_END,
  BRAND_FRAME_GRADIENT_START,
} from '@/constants/brandFrameGradient';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import { FORM_KEYBOARD_SCROLL_PROPS } from '@/constants/keyboardScrollProps';
import { resolveTextInputKeyboardProps } from '@/constants/inputKeyboardPresets';
import {
  estimateFlowPrimaryButtonStyle,
  estimateFlowPrimaryButtonTextStyle,
  estimateStep1InputCardStyle,
} from '@/utils/estimateFlowCardStyle';
import GradientRingBackInner from '@/components/GradientRingBackInner';
import type { ProjectPhoto } from '@/services/projectPhotoService';
import { removeProjectPhoto, updateProjectPhotoCaption } from '@/services/projectPhotoService';
import AddProjectPhotoModal from '@/components/AddProjectPhotoModal';

type Props = {
  projectId: string;
  photos: ProjectPhoto[];
  darkMode: boolean;
  textColor: string;
  mutedColor: string;
  surfaceColor: string;
  lineColor: string;
  onPhotosChanged: () => void;
};

function formatPhotoDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

export default function ProjectPhotosCard({
  projectId,
  photos,
  darkMode,
  textColor,
  mutedColor,
  surfaceColor,
  lineColor,
  onPhotosChanged,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { theme, darkMode: themeDarkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const isDark = darkMode ?? themeDarkMode;

  const [viewerPhoto, setViewerPhoto] = useState<ProjectPhoto | null>(null);
  const [viewerCaption, setViewerCaption] = useState('');
  const [savingCaption, setSavingCaption] = useState(false);
  const [deletingPhoto, setDeletingPhoto] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const previewPhotos = useMemo(() => photos.slice(0, 12), [photos]);
  const placeholderTint = isDark ? 'rgba(226, 232, 240, 0.58)' : mutedColor;
  const imageStageHeight = Math.min(Math.max(windowHeight * 0.42, 240), 420);
  const fieldSurface = useMemo(
    () => ({
      backgroundColor: isDark ? '#18181b' : surfaceColor,
      borderColor: isDark ? '#3f3f46' : lineColor,
    }),
    [isDark, surfaceColor, lineColor]
  );

  const openViewer = (photo: ProjectPhoto) => {
    setViewerPhoto(photo);
    setViewerCaption(photo.caption || '');
  };

  const closeViewer = () => {
    setViewerPhoto(null);
    setViewerCaption('');
    setSavingCaption(false);
    setDeletingPhoto(false);
  };

  const handleDeletePhoto = () => {
    if (!viewerPhoto || !projectId || deletingPhoto || savingCaption) return;

    Alert.alert(
      'Delete photo',
      'Remove this photo from your project portfolio? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                setDeletingPhoto(true);
                await removeProjectPhoto(projectId, viewerPhoto.id);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                onPhotosChanged();
                closeViewer();
              } catch (error) {
                console.error('Failed to delete project photo:', error);
                Alert.alert('Error', 'Failed to delete photo. Please try again.');
                setDeletingPhoto(false);
              }
            })();
          },
        },
      ]
    );
  };

  const handleSaveCaption = async () => {
    if (!viewerPhoto || !projectId || savingCaption) return;
    try {
      setSavingCaption(true);
      await updateProjectPhotoCaption(projectId, viewerPhoto.id, viewerCaption);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onPhotosChanged();
      closeViewer();
    } catch (error) {
      console.error('Failed to update photo caption:', error);
    } finally {
      setSavingCaption(false);
    }
  };

  return (
    <>
      <View style={{ marginTop: 12 }}>
        <LinearGradient
          colors={BRAND_FRAME_GRADIENT_COLORS}
          start={{ x: 0.05, y: 0.15 }}
          end={{ x: 0.95, y: 0.85 }}
          style={styles.overviewBorder}
        >
          <View style={[styles.overviewInner, { backgroundColor: darkMode ? '#000000' : surfaceColor }]}>
            <View style={[styles.sectionHeader, { borderBottomColor: darkMode ? 'rgba(148,163,184,0.1)' : lineColor }]}>
              <MaterialIcons name="photo-library" size={22} color="#22c55e" />
              <Text style={[styles.sectionTitle, { color: textColor, marginLeft: 12 }]}>Site Photos</Text>
              {photos.length > 0 ? (
                <Text style={[styles.countLabel, { color: mutedColor, marginRight: 10 }]}>
                  {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
                </Text>
              ) : null}
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowAddModal(true);
                }}
                style={[
                  styles.addButton,
                  photos.length === 0 ? { marginLeft: 'auto' } : null,
                ]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialIcons name="add" size={22} color="#22d3ee" />
              </TouchableOpacity>
            </View>

            {photos.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.thumbRow}
              >
                {previewPhotos.map((photo) => (
                  <TouchableOpacity
                    key={photo.id}
                    activeOpacity={0.85}
                    onPress={() => openViewer(photo)}
                    style={[
                      styles.thumbWrap,
                      { borderColor: darkMode ? 'rgba(148,163,184,0.2)' : lineColor },
                    ]}
                  >
                    <Image source={{ uri: photo.localUri }} style={styles.thumbImage} resizeMode="cover" />
                    <View style={styles.thumbDatePill}>
                      <Text style={styles.thumbDateText} numberOfLines={photo.caption ? 2 : 1}>
                        {photo.caption?.trim() || formatPhotoDate(photo.takenAt)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.emptyWrap}>
                <MaterialIcons name="photo-camera" size={28} color="#22d3ee" />
                <Text style={[styles.emptyTitle, { color: textColor }]}>No site photos yet</Text>
                <Text style={[styles.emptyBody, { color: mutedColor }]}>
                  Tap + to add portfolio photos, or attach them from a daily log.
                </Text>
              </View>
            )}
          </View>
        </LinearGradient>
      </View>

      <AddProjectPhotoModal
        visible={showAddModal}
        projectId={projectId}
        onClose={() => setShowAddModal(false)}
        onSaved={onPhotosChanged}
      />

      <Modal
        visible={viewerPhoto !== null}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeViewer}
      >
        <View style={[styles.viewerScreen, { backgroundColor: isDark ? '#000000' : Colors.bg }]}>
          <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
          <View style={[styles.viewerSafeArea, { paddingTop: insets.top }]}>
            <View style={styles.viewerHeader}>
              <View style={styles.viewerHeaderSide}>
                <LinearGradient
                  colors={BRAND_FRAME_GRADIENT_COLORS}
                  start={BRAND_FRAME_GRADIENT_START}
                  end={BRAND_FRAME_GRADIENT_END}
                  style={styles.viewerBackBorder}
                >
                  <GradientRingBackInner
                    darkMode={isDark}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      closeViewer();
                    }}
                    style={[styles.viewerBackButton, !isDark && { backgroundColor: Colors.bg }]}
                  >
                    <MaterialIcons
                      name="arrow-back"
                      size={24}
                      color={isDark ? '#FFFFFF' : textColor}
                    />
                  </GradientRingBackInner>
                </LinearGradient>
              </View>
              <View style={styles.viewerHeaderCenter}>
                <Text style={[styles.viewerHeaderTitle, { color: textColor }]}>Site photo</Text>
                {viewerPhoto ? (
                  <Text style={[styles.viewerHeaderDate, { color: mutedColor }]}>
                    {formatPhotoDate(viewerPhoto.takenAt)}
                  </Text>
                ) : null}
              </View>
              <View style={[styles.viewerHeaderSide, styles.viewerHeaderSideRight]}>
                <TouchableOpacity
                  onPress={handleDeletePhoto}
                  disabled={savingCaption || deletingPhoto}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={[
                    styles.viewerDeleteIconBtn,
                    (savingCaption || deletingPhoto) && styles.viewerBtnDisabled,
                  ]}
                >
                  <MaterialIcons name="delete-outline" size={22} color="#f87171" />
                </TouchableOpacity>
              </View>
            </View>

            {viewerPhoto ? (
              <KeyboardAvoidingView
                style={styles.viewerBody}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
              >
                <ScrollView
                  style={styles.viewerScroll}
                  contentContainerStyle={styles.viewerScrollContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  {...FORM_KEYBOARD_SCROLL_PROPS}
                >
                  <View
                    style={[
                      styles.viewerImageStage,
                      {
                        height: imageStageHeight,
                        borderColor: isDark ? 'rgba(148,163,184,0.15)' : lineColor,
                        backgroundColor: isDark ? '#0b0f14' : '#f1f5f9',
                      },
                    ]}
                  >
                    <Image
                      source={{ uri: viewerPhoto.localUri }}
                      style={styles.viewerImage}
                      resizeMode="contain"
                    />
                  </View>

                  <View style={estimateStep1InputCardStyle(Colors, isDark, { marginBottom: 0 })}>
                    <Text style={[styles.viewerFieldLabel, { color: textColor }]}>Description</Text>
                    <Text style={[styles.viewerFieldHint, { color: mutedColor }]}>
                      Optional — note what this photo shows.
                    </Text>
                    <TextInput
                      value={viewerCaption}
                      onChangeText={setViewerCaption}
                      placeholder="e.g. Rough plumbing passed inspection"
                      placeholderTextColor={placeholderTint}
                      multiline
                      scrollEnabled={false}
                      textAlignVertical="top"
                      onSubmitEditing={() => Keyboard.dismiss()}
                      {...(Platform.OS === 'ios'
                        ? { keyboardAppearance: isDark ? 'dark' : 'light' }
                        : {})}
                      {...resolveTextInputKeyboardProps({ multiline: true })}
                      style={[
                        styles.viewerCaptionInput,
                        fieldSurface,
                        { color: textColor },
                      ]}
                    />
                  </View>
                </ScrollView>

                <View
                  style={[
                    styles.viewerFooter,
                    {
                      paddingBottom: Math.max(insets.bottom, 8) + 4,
                      borderTopColor: isDark ? 'rgba(148,163,184,0.12)' : lineColor,
                      backgroundColor: isDark ? '#000000' : Colors.bg,
                    },
                  ]}
                >
                  <TouchableOpacity
                    style={[
                      estimateFlowPrimaryButtonStyle(),
                      (savingCaption || deletingPhoto) && styles.viewerBtnDisabled,
                    ]}
                    onPress={handleSaveCaption}
                    disabled={savingCaption || deletingPhoto}
                  >
                    <MaterialIcons name="check" size={22} color="#071018" />
                    <Text style={estimateFlowPrimaryButtonTextStyle()}>
                      {savingCaption ? 'Saving…' : 'Save changes'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.viewerDeleteLink}
                    onPress={handleDeletePhoto}
                    disabled={savingCaption || deletingPhoto}
                  >
                    <Text style={styles.viewerDeleteLinkText}>
                      {deletingPhoto ? 'Deleting…' : 'Delete photo'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overviewBorder: {
    borderRadius: 20,
    padding: 1,
    marginBottom: 16,
  },
  overviewInner: {
    borderRadius: 18,
    padding: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  countLabel: {
    marginLeft: 'auto',
    fontSize: 13,
    fontWeight: '600',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(34, 211, 238, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.28)',
  },
  thumbRow: {
    gap: 10,
    paddingVertical: 4,
  },
  thumbWrap: {
    width: 108,
    height: 108,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 3 },
    }),
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  thumbDatePill: {
    position: 'absolute',
    left: 6,
    right: 6,
    bottom: 6,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  thumbDateText: {
    color: '#f8fafc',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  emptyBody: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 280,
  },
  viewerScreen: {
    flex: 1,
  },
  viewerSafeArea: {
    flex: 1,
  },
  viewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  viewerHeaderSide: {
    width: 44,
    alignItems: 'flex-start',
  },
  viewerHeaderSideRight: {
    alignItems: 'flex-end',
  },
  viewerBackBorder: {
    borderRadius: 20,
    padding: 1,
    overflow: 'hidden',
  },
  viewerBackButton: {
    width: 40,
    height: 40,
    borderRadius: 19,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerHeaderCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  viewerHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  viewerHeaderDate: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  viewerDeleteIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.22)',
  },
  viewerBody: {
    flex: 1,
  },
  viewerScroll: {
    flex: 1,
  },
  viewerScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
  },
  viewerImageStage: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 14,
  },
  viewerImage: {
    width: '100%',
    height: '100%',
  },
  viewerFieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  viewerFieldHint: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  viewerCaptionInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 88,
  },
  viewerBtnDisabled: {
    opacity: 0.65,
  },
  viewerFooter: {
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 2,
    marginTop: 'auto',
  },
  viewerDeleteLink: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  viewerDeleteLinkText: {
    color: '#f87171',
    fontSize: 14,
    fontWeight: '700',
  },
});
