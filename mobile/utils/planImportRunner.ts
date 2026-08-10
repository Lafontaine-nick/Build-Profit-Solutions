/**
 * Shared plan import pickers + vision takeoff.
 * Used by Step 1 (Build with AI) and Confirm Scope Quick measurements.
 */
import { Alert, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import {
  fetchPlanToMeasurements,
  type PhotoScopeImage,
  type PlanToMeasurementsResult,
} from '@/utils/estimateAiDraft';
import type { PlanEstimatingMode, PlanTradeKey } from '@/utils/planImportTradeConfig';

export const MAX_PLAN_IMAGES = 8;
export const MAX_PLAN_PDF_BYTES = 20 * 1024 * 1024;

export type PlanImportPage = PhotoScopeImage & { name?: string };

export type PlanTakeoffContext = {
  existingNotes?: string;
  templateKeyHint?: string | null;
  projectTypeHint?: string | null;
  estimatingMode?: PlanEstimatingMode;
  selectedTradeKey?: PlanTradeKey | null;
};

function mimeFromAsset(asset: ImagePicker.ImagePickerAsset): string {
  if (asset.mimeType && asset.mimeType.startsWith('image/')) return asset.mimeType;
  return asset.uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
}

export async function imagesFromPickerAssets(
  assets: ImagePicker.ImagePickerAsset[]
): Promise<PlanImportPage[]> {
  const list = (assets || []).filter((a) => a?.uri).slice(0, MAX_PLAN_IMAGES);
  const images: PlanImportPage[] = [];
  for (const asset of list) {
    const base64 = await FileSystemLegacy.readAsStringAsync(asset.uri, { encoding: 'base64' });
    images.push({ base64, mimeType: mimeFromAsset(asset) });
  }
  return images;
}

/**
 * Run plan takeoff. Returns null when the user should see an alert and stop
 * (already shown). Returns a takeoff object (success or partial) for review.
 */
export async function runPlanTakeoff(
  images: PlanImportPage[],
  ctx: PlanTakeoffContext = {}
): Promise<PlanToMeasurementsResult | null> {
  if (!images.length) return null;

  const takeoff = await fetchPlanToMeasurements({
    images,
    existingNotes: ctx.existingNotes || '',
    templateKeyHint: ctx.templateKeyHint || null,
    projectTypeHint: ctx.projectTypeHint || null,
    estimatingMode: ctx.estimatingMode || 'whole_project',
    selectedTradeKey: ctx.selectedTradeKey || null,
  });

  const hasScope = (takeoff.scope?.detections?.length ?? 0) > 0;
  const hasReadingIssues =
    (takeoff.lowConfidence?.length ?? 0) > 0 || (takeoff.unreadableFields?.length ?? 0) > 0;

  if (!takeoff.success && !hasScope && !hasReadingIssues) {
    Alert.alert('Could not read plan', takeoff.reason || 'Try a clearer floor-plan image.');
    return null;
  }

  if (!takeoff.success && !Object.keys(takeoff.measurements).length && !hasScope) {
    Alert.alert(
      'Plan not clear enough',
      takeoff.reason ||
        'AI could not read square footage from these pages. Retake the photos closer and in focus, or import the original PDF.'
    );
    return null;
  }

  return takeoff;
}

export async function takePlanPhoto(): Promise<ImagePicker.ImagePickerAsset[] | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Camera needed', 'Allow camera access to photograph a floor plan.');
    return null;
  }
  if (Platform.OS !== 'web') {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: false,
    quality: 0.85,
    exif: false,
    base64: false,
  });
  if (result.canceled || !result.assets?.[0]?.uri) return null;
  return [result.assets[0]];
}

export async function pickPlanFromLibrary(): Promise<ImagePicker.ImagePickerAsset[] | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission needed', 'Allow photo library access to import a floor plan image.');
    return null;
  }
  if (Platform.OS !== 'web') {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsMultipleSelection: true,
    selectionLimit: MAX_PLAN_IMAGES,
    quality: 0.85,
    allowsEditing: false,
    exif: false,
    base64: false,
    preferredAssetRepresentationMode:
      ImagePicker.UIImagePickerPreferredAssetRepresentationMode?.Compatible,
  });
  if (result.canceled || !result.assets?.length) return null;
  return result.assets;
}

export async function pickPlanPdf(): Promise<PlanImportPage[] | null> {
  let DocumentPicker: typeof import('expo-document-picker');
  try {
    DocumentPicker = require('expo-document-picker');
  } catch {
    Alert.alert(
      'PDF import needs a rebuild',
      'This app build doesn’t include the PDF picker yet. Use Take photo / Choose from library for now, or rebuild the iOS/Android development client.'
    );
    return null;
  }
  if (typeof DocumentPicker?.getDocumentAsync !== 'function') {
    Alert.alert(
      'PDF import needs a rebuild',
      'This app build doesn’t include the PDF picker yet. Use Take photo / Choose from library for now, or rebuild the iOS/Android development client.'
    );
    return null;
  }

  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return null;
    const asset = result.assets[0];
    if (asset.size != null && asset.size > MAX_PLAN_PDF_BYTES) {
      Alert.alert('PDF too large', 'Keep the plan set under 20MB. Export fewer pages and try again.');
      return null;
    }
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    const base64 = await FileSystemLegacy.readAsStringAsync(asset.uri, { encoding: 'base64' });
    return [{ base64, mimeType: 'application/pdf', name: asset.name || 'plan.pdf' }];
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e || '');
    if (/ExpoDocumentPicker|native module/i.test(msg)) {
      Alert.alert(
        'PDF import needs a rebuild',
        'This app build doesn’t include the PDF picker yet. Use Take photo / Choose from library for now, or rebuild the iOS/Android development client.'
      );
      return null;
    }
    Alert.alert('PDF import failed', msg || 'Could not read the PDF. Try again.');
    return null;
  }
}

/** Present the Import from plan source picker (camera / library / PDF). */
export function promptPlanImportSource(handlers: {
  onCamera: () => void;
  onLibrary: () => void;
  onPdf: () => void;
  title?: string;
  message?: string;
}) {
  Alert.alert(
    handlers.title || 'Import from plan',
    handlers.message ||
      'Photograph a floor plan, choose up to 8 plan pages from your library, or import a PDF plan set.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Take photo', onPress: handlers.onCamera },
      { text: 'Choose from library', onPress: handlers.onLibrary },
      { text: 'Import PDF', onPress: handlers.onPdf },
    ]
  );
}
