import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import {
  fetchPhotoToScope,
  type PhotoExistingFeature,
  type PhotoScopeDetection,
  type PhotoScopeImage,
} from '@/utils/estimateAiDraft';

type Colors = {
  text: string;
  sub: string;
  line: string;
  surface2: string;
};

type SitePhoto = {
  id: string;
  uri: string;
  mimeType: string;
};

export type SitePhotoAttachment = SitePhoto;

export type SitePhotoState = {
  photoCount: number;
  /** True after a successful Detect scope run for the current photo set. */
  hasAnalyzed: boolean;
};

export type EstimateSitePhotosStripHandle = {
  /** Same path as the "Detect scope from N photo(s)" button. */
  detectScope: () => void;
};

type Props = {
  Colors: Colors;
  darkMode: boolean;
  disabled?: boolean;
  existingNotes: string;
  /** Restore thumbnails when reopening Step 1 (same app session). */
  initialPhotos?: SitePhoto[];
  /** True when structured detections already ran for this photo set. */
  initialHasAnalyzed?: boolean;
  /** Called with merged notes + structured detections after successful vision analysis. */
  onNotesMerged: (
    mergedNotes: string,
    detectionCount: number,
    detections: PhotoScopeDetection[],
    existingFeatures?: PhotoExistingFeature[]
  ) => void;
  /** Lets parent remind on Generate when photos exist but Detect hasn't run. */
  onPhotoStateChange?: (state: SitePhotoState) => void;
  onPhotosChange?: (photos: SitePhoto[]) => void;
  /** Tighter layout inside Build with AI accordion. */
  embedded?: boolean;
};

const MAX_PHOTOS = 4;

function mimeFromUri(uri: string, assetType?: string | null): string {
  if (assetType && assetType.startsWith('image/')) return assetType;
  const lower = String(uri || '').toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'image/heic';
  return 'image/jpeg';
}

async function readPhotoBase64(uri: string): Promise<string> {
  return FileSystemLegacy.readAsStringAsync(uri, { encoding: 'base64' });
}

/** Notes the contractor actually typed/dictated — excludes a previous photo block. */
function contractorIntentNotes(notes: string): string {
  const marker = '--- Site photos ---';
  const n = String(notes || '');
  return (n.includes(marker) ? n.slice(0, n.indexOf(marker)) : n).trim();
}

export default forwardRef<EstimateSitePhotosStripHandle, Props>(function EstimateSitePhotosStrip(
  {
    Colors,
    darkMode,
    disabled = false,
    existingNotes,
    initialPhotos,
    initialHasAnalyzed = false,
    onNotesMerged,
    onPhotoStateChange,
    onPhotosChange,
    embedded = false,
  },
  ref
) {
  const [photos, setPhotos] = useState<SitePhoto[]>(initialPhotos || []);
  const [analyzing, setAnalyzing] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(Boolean(initialHasAnalyzed));
  const analyzePhotosRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (initialPhotos?.length) {
      setPhotos(initialPhotos);
    }
  }, [initialPhotos]);

  useEffect(() => {
    setHasAnalyzed(Boolean(initialHasAnalyzed));
  }, [initialHasAnalyzed]);

  const updatePhotos = (updater: SitePhoto[] | ((prev: SitePhoto[]) => SitePhoto[])) => {
    setPhotos((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      onPhotosChange?.(next);
      return next;
    });
  };

  useEffect(() => {
    onPhotoStateChange?.({ photoCount: photos.length, hasAnalyzed });
  }, [photos.length, hasAnalyzed, onPhotoStateChange]);

  const addAssets = (assets: ImagePicker.ImagePickerAsset[]) => {
    const next: SitePhoto[] = [];
    for (const asset of assets) {
      if (!asset?.uri) continue;
      next.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        uri: asset.uri,
        mimeType: mimeFromUri(asset.uri, asset.mimeType),
      });
    }
    if (!next.length) {
      Alert.alert('Photo unavailable', 'Could not read that image. Try another photo.');
      return;
    }
    // New photos need a fresh Detect pass.
    setHasAnalyzed(false);
    updatePhotos((prev) => [...prev, ...next].slice(0, MAX_PHOTOS));
  };

  const takePhoto = async () => {
    if (disabled || analyzing || photos.length >= MAX_PHOTOS) return;
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Camera needed', 'Allow camera access to take site photos.');
        return;
      }
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        // Full frame — no crop UI. Do not keep base64 in React state (OOM risk).
        allowsEditing: false,
        quality: 0.45,
        exif: false,
        base64: false,
      });
      if (!result.canceled && result.assets?.[0]) addAssets(result.assets);
    } catch (err: unknown) {
      console.warn('Site photos: camera failed', err);
      Alert.alert('Camera failed', 'Could not take a photo. Try Library instead.');
    }
  };

  const pickFromLibrary = async () => {
    if (disabled || analyzing || photos.length >= MAX_PHOTOS) return;
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Photos needed', 'Allow photo library access to attach site photos.');
        return;
      }
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: Math.max(1, MAX_PHOTOS - photos.length),
        quality: 0.45,
        exif: false,
        base64: false,
        allowsEditing: false,
        // Prefer JPEG/PNG over HEIC when the OS can provide it.
        preferredAssetRepresentationMode:
          ImagePicker.UIImagePickerPreferredAssetRepresentationMode?.Compatible,
      });
      if (!result.canceled && result.assets?.length) addAssets(result.assets);
    } catch (err: unknown) {
      console.warn('Site photos: library failed', err);
      Alert.alert('Library failed', 'Could not open photos. Please try again.');
    }
  };

  const removePhoto = (id: string) => {
    setHasAnalyzed(false);
    updatePhotos((prev) => prev.filter((p) => p.id !== id));
  };

  const analyzePhotos = async () => {
    if (!photos.length || analyzing || disabled) return;
    // Photos show conditions; notes state intent. Without intent the detected
    // scope can point the wrong way (e.g. finished bath → demo? reference?).
    if (!contractorIntentNotes(existingNotes)) {
      Alert.alert(
        'Add a quick note first?',
        'Photos show conditions, but a sentence about what you want done (type or Dictate) makes the detected scope much more accurate.',
        [
          { text: 'Add notes first', style: 'cancel' },
          { text: 'Detect anyway', onPress: () => void runPhotoAnalysis() },
        ]
      );
      return;
    }
    await runPhotoAnalysis();
  };

  analyzePhotosRef.current = () => {
    void analyzePhotos();
  };

  useImperativeHandle(ref, () => ({
    detectScope: () => analyzePhotosRef.current(),
  }));

  const runPhotoAnalysis = async () => {
    if (!photos.length || analyzing || disabled) return;
    setAnalyzing(true);
    try {
      const images: PhotoScopeImage[] = [];
      for (const p of photos) {
        try {
          const base64 = await readPhotoBase64(p.uri);
          if (!base64) continue;
          // Backend converts HEIC→JPEG for OpenAI; send the real mime when known.
          images.push({ base64, mimeType: p.mimeType || 'image/jpeg' });
        } catch (readErr) {
          console.warn('Site photos: failed to read', p.uri, readErr);
        }
      }
      if (!images.length) {
        Alert.alert('Photo unavailable', 'Could not read the attached photos. Try retaking them.');
        return;
      }

      const result = await fetchPhotoToScope({
        images,
        // Re-analyzing must use only the contractor's intent. Feeding the
        // previous photo block back to vision creates a hallucination loop
        // (e.g. a prior "shower tile" guess becomes new job-note context).
        existingNotes: contractorIntentNotes(existingNotes),
      });
      if (!result.success) {
        Alert.alert(
          'Could not read photos',
          result.reason || 'Try clearer jobsite photos of rooms or finishes.'
        );
        return;
      }
      if (!result.mergedNotes?.trim() && !result.notesBlock?.trim()) {
        Alert.alert('No scope found', 'Nothing useful was detected. Try different angles.');
        return;
      }
      onNotesMerged(
        result.mergedNotes || result.notesBlock,
        result.detections?.length || 0,
        result.detections || [],
        result.existingFeatures || []
      );
      setHasAnalyzed(true);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Please try again.';
      const upstreamUnavailable = /connection error|openai|vision service unavailable/i.test(message);
      Alert.alert(
        upstreamUnavailable ? 'AI service unavailable' : 'Photo analysis failed',
        upstreamUnavailable
          ? 'The backend is running, but it could not connect to the AI provider. Check the Mac internet/DNS connection and try again.'
          : message
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const atLimit = photos.length >= MAX_PHOTOS;

  return (
    <View
      style={{
        marginBottom: embedded ? 0 : 14,
        paddingTop: embedded ? 12 : 0,
        borderTopWidth: embedded ? 1 : 0,
        borderTopColor: embedded
          ? darkMode
            ? 'rgba(148, 163, 184, 0.12)'
            : Colors.line
          : 'transparent',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: embedded ? 6 : 8,
        }}
      >
        <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700' }}>
          Site photos
        </Text>
        <Text style={{ color: Colors.sub, fontSize: 11 }}>
          Optional · up to {MAX_PHOTOS}
        </Text>
      </View>

      {!embedded ? (
        <Text style={{ color: Colors.sub, fontSize: 12, lineHeight: 16, marginBottom: 10 }}>
          Add room photos — AI detects finishes and likely scope (not measurements or prices).
        </Text>
      ) : (
        <Text style={{ color: Colors.sub, fontSize: 11, lineHeight: 15, marginBottom: 8 }}>
          Finishes and likely scope only — not measurements or prices.
        </Text>
      )}

      <View style={{ flexDirection: 'row', gap: 8, marginBottom: photos.length ? 10 : 0 }}>
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={disabled || analyzing || atLimit}
          onPress={takePhoto}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 10,
            paddingVertical: 7,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: darkMode ? 'rgba(148, 163, 184, 0.25)' : Colors.line,
            opacity: disabled || analyzing || atLimit ? 0.45 : 1,
          }}
        >
          <MaterialIcons name="photo-camera" size={16} color="#22c55e" />
          <Text style={{ color: Colors.text, fontSize: 12, fontWeight: '700' }}>Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={disabled || analyzing || atLimit}
          onPress={pickFromLibrary}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 10,
            paddingVertical: 7,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: darkMode ? 'rgba(148, 163, 184, 0.25)' : Colors.line,
            opacity: disabled || analyzing || atLimit ? 0.45 : 1,
          }}
        >
          <MaterialIcons name="photo-library" size={16} color="#60a5fa" />
          <Text style={{ color: Colors.text, fontSize: 12, fontWeight: '700' }}>Library</Text>
        </TouchableOpacity>
      </View>

      {photos.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
          style={{ marginBottom: 10 }}
        >
          {photos.map((p) => (
            <View key={p.id} style={{ position: 'relative' }}>
              <Image
                source={{ uri: p.uri }}
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 10,
                  backgroundColor: darkMode ? 'rgba(255,255,255,0.06)' : Colors.surface2,
                }}
              />
              <TouchableOpacity
                activeOpacity={0.85}
                disabled={analyzing}
                onPress={() => removePhoto(p.id)}
                hitSlop={8}
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: darkMode ? '#0f172a' : '#fff',
                  borderWidth: 1,
                  borderColor: darkMode ? 'rgba(148,163,184,0.35)' : Colors.line,
                }}
              >
                <MaterialIcons name="close" size={14} color={Colors.sub} />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      ) : null}

      {photos.length > 0 ? (
        <TouchableOpacity
          activeOpacity={0.88}
          disabled={disabled || analyzing}
          onPress={analyzePhotos}
          style={{
            paddingVertical: 11,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
            borderWidth: 1.5,
            borderColor: analyzing ? 'rgba(96, 165, 250, 0.35)' : 'rgba(96, 165, 250, 0.55)',
            backgroundColor: darkMode ? 'rgba(59, 130, 246, 0.08)' : 'rgba(59, 130, 246, 0.05)',
            opacity: disabled ? 0.5 : 1,
          }}
        >
          {analyzing ? (
            <>
              <ActivityIndicator size="small" color="#60a5fa" />
              <Text style={{ color: '#60a5fa', fontSize: 13, fontWeight: '700' }}>
                Reading photos…
              </Text>
            </>
          ) : (
            <>
              <MaterialIcons name="image-search" size={18} color="#60a5fa" />
              <Text style={{ color: '#60a5fa', fontSize: 13, fontWeight: '700' }}>
                Detect scope from {photos.length} photo{photos.length === 1 ? '' : 's'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      ) : null}
    </View>
  );
});
