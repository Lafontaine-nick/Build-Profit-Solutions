import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Platform,
  StyleSheet,
  StatusBar,
  Keyboard,
  ScrollView,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-react';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import AIEstimateFlowHeader from '@/components/estimate/AIEstimateFlowHeader';
import { aiFlowCardBackground, estimateStep1InputCardStyle, ESTIMATE_FLOW_GREEN } from '@/utils/estimateFlowCardStyle';
import { getEmbeddedAiFlowFooterBottomInset } from '@/constants/ScreenLayout';
import {
  buildPlanImportSteps,
  type AiGeneratePhaseId,
} from '@/utils/aiEstimateGeneratingUi';
import AIEstimateGeneratingOverlay from '@/components/estimate/AIEstimateGeneratingOverlay';
import AIEstimateDisclaimer from '@/components/estimate/AIEstimateDisclaimer';
import EstimateVoiceDictationButton from '@/components/estimate/EstimateVoiceDictationButton';
import EstimateSitePhotosStrip, {
  type EstimateSitePhotosStripHandle,
  type SitePhotoAttachment,
  type SitePhotoState,
} from '@/components/estimate/EstimateSitePhotosStrip';
import EstimatePlanImportStrip, {
  type PlanImportApplyResult,
} from '@/components/estimate/EstimatePlanImportStrip';
import type {
  PhotoExistingFeature,
  PhotoScopeDetection,
  PlanImportPayload,
} from '@/utils/estimateAiDraft';
import { measurementSemanticsV1Enabled } from '@/utils/measurementSemantics';
import { syncClerkTokenToAsyncStorage } from '@/utils/authTokenHelper';
import { useKeyboard } from '@/services/MobileOptimization';
import { resolveTextInputKeyboardProps } from '@/constants/inputKeyboardPresets';
import {
  buildImportedPlanSummaryText,
  buildPlanReadyJobNotesPrompt,
  importedPlanSummaryCollapsedSubtitle,
  stripPlanTakeoffFromNotes,
} from '@/utils/planTakeoffReviewUi';
import ReliableFlowPress from '@/components/estimate/ReliableFlowPress';
import {
  BRAND_FRAME_GRADIENT_COLORS,
  BRAND_FRAME_GRADIENT_END,
  BRAND_FRAME_GRADIENT_START,
} from '@/constants/brandFrameGradient';
import { getPlanTradeConfiguration } from '@/utils/planImportTradeConfig';
import type {
  PlumbingPerformerMode,
  PlumbingWorkflowMode,
} from '@/utils/subcontractorTrade/plumbingPlanConvergence';

type Props = {
  visible: boolean;
  generating?: boolean;
  generatingPhase?: AiGeneratePhaseId | null;
  generatingSteps?: AiGeneratePhaseId[];
  initialNotes?: string;
  /** Restore plan takeoff when reopening Step 1 after Confirm Scope Back. */
  initialPlanImport?: PlanImportPayload | null;
  /** Restore vision detections when reopening Step 1 (Regenerate / Back). */
  initialPhotoDetections?: PhotoScopeDetection[];
  initialPhotoExistingFeatures?: PhotoExistingFeature[];
  /** Restore attached photo thumbnails for the same session. */
  initialSitePhotos?: SitePhotoAttachment[];
  /** True when a Confirm Scope / review draft already exists — show Continue instead of wiping. */
  hasExistingDraft?: boolean;
  /** Resume opens Confirm scope (Step 2) instead of Review draft (Step 3). */
  resumeToScopeConfirm?: boolean;
  /** Notes stored with the saved draft — used for Regenerate when the field is left empty. */
  savedSessionNotes?: string;
  fromAssistant?: boolean;
  /** Render inside AI Assistant instead of a separate Modal (fixes iOS stacking). */
  embedded?: boolean;
  onClose: () => void;
  onBack?: () => void;
  /** Resume preserved Confirm Scope without regenerating. */
  onContinueDraft?: () => void;
  /** Clear saved draft progress and reset Step 1 inputs. */
  onStartFresh?: () => void;
  /** Keep parent lastPlanImport in sync when user imports/replaces a plan. */
  onPlanImportChange?: (planImport: PlanImportPayload | null) => void;
  onPhotoDetectionsChange?: (detections: PhotoScopeDetection[]) => void;
  onPhotoExistingFeaturesChange?: (features: PhotoExistingFeature[]) => void;
  onSitePhotosChange?: (photos: SitePhotoAttachment[]) => void;
  onGenerate: (
    notes: string,
    photoDetections?: PhotoScopeDetection[],
    planImport?: PlanImportPayload | null,
    sitePhotos?: SitePhotoAttachment[],
    photoExistingFeatures?: PhotoExistingFeature[],
    authToken?: string | null
  ) => void;
};

function contractorIntentNotes(notes: string): string {
  const marker = '--- Site photos ---';
  const text = String(notes || '');
  return (
    text.includes(marker) ? text.slice(0, text.indexOf(marker)) : text
  ).trim();
}

function stablePhotoIds(photos: SitePhotoAttachment[]): string {
  return [...photos]
    .map((photo) => photo.id)
    .sort()
    .join('|');
}

function stableDetectionKey(detections: PhotoScopeDetection[]): string {
  return JSON.stringify(
    [...detections]
      .map((detection) => `${detection.itemId}:${detection.state}`)
      .sort()
  );
}

function stableExistingFeatureKey(features: PhotoExistingFeature[]): string {
  return JSON.stringify(
    [...features]
      .map((feature) => feature.feature)
      .sort()
  );
}

function planImportSnapshot(plan: PlanImportPayload | null | undefined): string {
  if (!plan) return '';
  if (plan.planImportFingerprint) return plan.planImportFingerprint;
  return JSON.stringify({
    measurements: Object.keys(plan.measurements || {}).length,
    rooms: plan.rooms?.length || 0,
    scope: plan.scopeDetections?.length || 0,
    trade: plan.selectedTrade || null,
    mode: plan.estimatingMode || null,
  });
}

export default function AIEstimateBuilderModal({
  visible,
  generating = false,
  generatingPhase = null,
  generatingSteps = [],
  initialNotes = '',
  initialPlanImport = null,
  initialPhotoDetections = [],
  initialPhotoExistingFeatures = [],
  initialSitePhotos = [],
  hasExistingDraft = false,
  resumeToScopeConfirm = false,
  savedSessionNotes = '',
  fromAssistant = false,
  embedded = false,
  onClose,
  onBack,
  onContinueDraft,
  onStartFresh,
  onPlanImportChange,
  onPhotoDetectionsChange,
  onPhotoExistingFeaturesChange,
  onSitePhotosChange,
  onGenerate,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { getToken } = useAuth();
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const photosStripRef = useRef<EstimateSitePhotosStripHandle>(null);
  const notesInputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const revealGenerateAfterPasteRef = useRef(false);
  const [notesInputSessionKey, setNotesInputSessionKey] = useState(0);
  const { keyboardHeight, isKeyboardVisible } = useKeyboard();
  const keyboardWasVisibleRef = useRef(false);
  const [notes, setNotes] = useState('');
  const notesRef = useRef('');
  const [notesSyncTick, setNotesSyncTick] = useState(0);
  const bumpNotesSync = useCallback(() => {
    setNotesSyncTick((tick) => tick + 1);
  }, []);
  const applyNotesText = useCallback((text: string) => {
    const next = text ?? '';
    if (notesRef.current === next) return;
    notesRef.current = next;
    setNotes(next);
    bumpNotesSync();
  }, [bumpNotesSync]);

  const commitNotesFromInput = useCallback(
    (text?: string) => {
      if (typeof text === 'string') {
        applyNotesText(text);
        return;
      }
      applyNotesText(notesRef.current);
    },
    [applyNotesText]
  );

  const syncNotesFromNativeEvent = useCallback(
    (text?: string | null) => {
      if (typeof text !== 'string') return;
      applyNotesText(text);
    },
    [applyNotesText]
  );

  const revealGenerateAfterPaste = useCallback(() => {
    revealGenerateAfterPasteRef.current = true;
  }, []);

  const handleNotesTextChange = useCallback(
    (text?: string | null) => {
      if (typeof text !== 'string') return;
      const previousLength = notesRef.current.length;
      syncNotesFromNativeEvent(text);
      // RN does not expose a distinct paste event. A multi-character insertion
      // is the reliable native signal for the paste action used in this field.
      if (text.length - previousLength > 1) {
        revealGenerateAfterPaste();
      }
    },
    [revealGenerateAfterPaste, syncNotesFromNativeEvent]
  );

  const handleNotesContentSizeChange = useCallback(() => {
    if (!revealGenerateAfterPasteRef.current) return;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
      revealGenerateAfterPasteRef.current = false;
    });
  }, []);

  const dismissNotesEditing = useCallback(() => {
    notesInputRef.current?.blur();
    Keyboard.dismiss();
  }, []);
  const [photoDetections, setPhotoDetections] = useState<PhotoScopeDetection[]>(
    []
  );
  const [photoExistingFeatures, setPhotoExistingFeatures] = useState<
    PhotoExistingFeature[]
  >([]);
  const [sitePhotos, setSitePhotos] = useState<SitePhotoAttachment[]>([]);
  const [photoState, setPhotoState] = useState<SitePhotoState>({
    photoCount: 0,
    hasAnalyzed: false,
  });
  const [planImport, setPlanImport] = useState<PlanImportPayload | null>(null);
  const [plumbingOnly, setPlumbingOnly] = useState(false);
  const [plumbingWorkflowMode, setPlumbingWorkflowMode] =
    useState<PlumbingWorkflowMode>('bathroom_remodel');
  const [plumbingPerformerMode, setPlumbingPerformerMode] =
    useState<PlumbingPerformerMode | null>(null);
  const [planSummaryExpanded, setPlanSummaryExpanded] = useState(false);
  const [localGenerating, setLocalGenerating] = useState(false);
  const [planImportBusy, setPlanImportBusy] = useState(false);
  const authTokenRef = useRef<string | null>(null);
  const [planImportPhase, setPlanImportPhase] =
    useState<AiGeneratePhaseId | null>(null);
  const planImportSteps = useMemo(() => buildPlanImportSteps(), []);
  const busy = generating || localGenerating || planImportBusy;
  const overlayPhase = planImportBusy ? planImportPhase : generatingPhase;
  const overlaySteps = planImportBusy ? planImportSteps : generatingSteps;
  const semanticsOn = measurementSemanticsV1Enabled();

  useEffect(() => {
    if (!visible) return;
    void getToken()
      .then(token => {
        authTokenRef.current = token || null;
        if (token) return syncClerkTokenToAsyncStorage(token);
        return undefined;
      })
      .catch(() => undefined);
  }, [getToken, visible]);

  const wasVisibleRef = useRef(false);
  useEffect(() => {
    if (visible && !wasVisibleRef.current) {
      // Reset only when the modal opens — not when initialNotes identity changes mid-session
      // (that was wiping planImport after Apply to bid).
      const restoredNotes = initialNotes || savedSessionNotes || '';
      setNotes(restoredNotes);
      notesRef.current = restoredNotes;
      setNotesInputSessionKey((key) => key + 1);
      bumpNotesSync();
      Keyboard.dismiss();
      setPhotoDetections(initialPhotoDetections || []);
      setPhotoExistingFeatures(initialPhotoExistingFeatures || []);
      setSitePhotos(initialSitePhotos || []);
      setPhotoState({
        photoCount: initialSitePhotos?.length || 0,
        hasAnalyzed: Boolean(initialPhotoDetections?.length),
      });
      // Restore plan import when resuming a draft session; otherwise start clean.
      setPlanImport(initialPlanImport || null);
      const standalonePlumbing =
        initialPlanImport?.tradeWorkflowSource === 'standalone_trade' &&
        initialPlanImport.selectedTrade === 'plumbing';
      setPlumbingOnly(standalonePlumbing);
      setPlumbingWorkflowMode(
        initialPlanImport?.plumbingWorkflowMode || 'bathroom_remodel'
      );
      setPlumbingPerformerMode(
        initialPlanImport?.plumbingPerformerMode || null
      );
      setPlanSummaryExpanded(false);
    }
    if (!visible) {
      setLocalGenerating(false);
      setPlanImportBusy(false);
      setPlanImportPhase(null);
    }
    wasVisibleRef.current = visible;
  }, [
    visible,
    initialNotes,
    savedSessionNotes,
    initialPlanImport,
    initialPhotoDetections,
    initialSitePhotos,
    bumpNotesSync,
  ]);

  useEffect(() => {
    if (!generating) {
      setLocalGenerating(false);
    }
  }, [generating]);

  useEffect(() => {
    if (isKeyboardVisible) {
      keyboardWasVisibleRef.current = true;
      return;
    }
    if (!keyboardWasVisibleRef.current) return;
    keyboardWasVisibleRef.current = false;
    // The keyboard spacer is removed when the keyboard hides. Reconcile the
    // ScrollView offset after that layout pass so the footer does not briefly
    // sit high above a large black gap.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollToEnd({ animated: false });
      });
    });
  }, [isKeyboardVisible]);

  useEffect(() => {
    if (!visible || Platform.OS === 'web') return;
    const event = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const sub = Keyboard.addListener(event, () => {
      notesInputRef.current?.blur();
      requestAnimationFrame(() => {
        commitNotesFromInput();
        bumpNotesSync();
      });
    });
    return () => sub.remove();
  }, [visible, bumpNotesSync, commitNotesFromInput]);

  const resolveNotesText = useCallback(() => {
    return String(notesRef.current || notes || '');
  }, [notes, notesSyncTick]);

  const resolveEffectiveNotes = useCallback(() => {
    const typed = resolveNotesText().trim();
    if (typed) return typed;
    return String(savedSessionNotes || '').trim();
  }, [resolveNotesText, savedSessionNotes]);

  const handleBack = () => {
    if (busy) return;
    if (onBack) {
      onBack();
    } else {
      onClose();
    }
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  const handleTranscript = (text: string) => {
    const existing = resolveNotesText().trim();
    const next = existing ? `${existing}\n${text}` : text;
    applyNotesText(next);
  };

  const handlePhotoNotesMerged = (
    mergedNotes: string,
    detectionCount: number,
    detections: PhotoScopeDetection[],
    existingFeatures?: PhotoExistingFeature[]
  ) => {
    applyNotesText(mergedNotes);
    setPhotoDetections(detections || []);
    setPhotoExistingFeatures(existingFeatures || []);
    onPhotoDetectionsChange?.(detections || []);
    onPhotoExistingFeaturesChange?.(existingFeatures || []);
    // Defer alert so it doesn't fight the modal / picker dismiss animation.
    setTimeout(() => {
      if (detectionCount > 0) {
        Alert.alert(
          'Scope from photos',
          `${detectionCount} item${detectionCount === 1 ? '' : 's'} detected and added to Job notes. Review the text, then Generate.`
        );
      } else {
        Alert.alert(
          'Photo notes added',
          'Observations were added to Job notes. Review the text, then Generate.'
        );
      }
    }, 0);
  };

  const handlePlanApplied = (result: PlanImportApplyResult) => {
    // Notes-only routing must not leak into the Plan Export flow.
    setPlumbingOnly(false);
    setPlumbingWorkflowMode('new_construction');
    setPlumbingPerformerMode(null);
    if (semanticsOn) {
      // Keep Job notes user-editable; structured plan data stays authoritative.
      const userNotes = stripPlanTakeoffFromNotes(result.mergedNotes || '');
      const measCount = Object.keys(result.measurements || {}).length;
      const tradeLabel =
        result.estimatingMode === 'selected_trade'
          ? getPlanTradeConfiguration(result.selectedTrade)?.label || null
          : null;
      applyNotesText(
        userNotes.trim()
          ? userNotes
          : buildPlanReadyJobNotesPrompt({
              livingSf: tradeLabel
                ? undefined
                : Number(result.measurements?.floorAreaSqft) || null,
              measurementCount: measCount,
              spaceCount: tradeLabel ? 0 : result.rooms?.length || 0,
              scopeCount: result.scopeDetections?.length || 0,
              tradeLabel,
            })
      );
      setPlanSummaryExpanded(false);
    } else if (result.mergedNotes?.trim()) {
      applyNotesText(result.mergedNotes);
    }
    const nextPlanImport: PlanImportPayload = {
      measurements: result.measurements,
      planImportFingerprint: result.planImportFingerprint,
      scopeDetections: result.scopeDetections,
      rooms: result.rooms || [],
      notesBlock: result.notesBlock || null,
      areaReconciliation: result.areaReconciliation ?? null,
      buildingAreas: result.buildingAreas,
      planFacts: result.planFacts,
      fieldConfidence: result.fieldConfidence,
      quickMeasurementSources: result.quickMeasurementSources,
      measurementProvenance: result.measurementProvenance,
      measurementConflicts: result.measurementConflicts,
      electricalValidation: result.electricalValidation,
      utilityConnections: result.utilityConnections,
      fixtureInventory: result.fixtureInventory,
      complexityFactors: result.complexityFactors,
      plumbingReviewStatus: result.plumbingReviewStatus,
      waterHeaterDetail: result.waterHeaterDetail,
      gasApplianceScope: result.gasApplianceScope,
      estimatingMode: result.estimatingMode,
      selectedTrade: result.selectedTrade,
      tradeProvenance: result.tradeProvenance,
      missingInfo: result.missingInfo,
    };
    setPlanImport(nextPlanImport);
    onPlanImportChange?.(nextPlanImport);
    setTimeout(() => {
      const meas = Object.keys(result.measurements || {}).length;
      const scope = result.scopeDetections?.length || 0;
      Alert.alert(
        'Plan ready',
        semanticsOn
          ? hasExistingDraft
            ? 'Your plan is loaded. Update scope below to rebuild from this plan, or keep your current draft.'
            : 'Your plan is loaded. Tap Generate Estimate Draft at the bottom to build your scope draft.'
          : [
              meas ? `${meas} measurement${meas === 1 ? '' : 's'} ready` : null,
              scope
                ? `${scope} scope item${scope === 1 ? '' : 's'} ready`
                : null,
              hasExistingDraft
                ? 'Update scope below, or keep your current draft.'
                : 'Review Job notes, then Generate.',
            ]
              .filter(Boolean)
              .join('. ')
      );
    }, 0);
  };

  const hasPlanImport =
    Boolean(planImport) &&
    (Object.keys(planImport?.measurements || {}).length > 0 ||
      (planImport?.rooms?.length || 0) > 0 ||
      (planImport?.scopeDetections?.length || 0) > 0 ||
      planImport?.estimatingMode === 'selected_trade');
  const selectedPlanTrade =
    planImport?.estimatingMode === 'selected_trade'
      ? getPlanTradeConfiguration(planImport.selectedTrade)
      : null;

  const importedPlanSummary = useMemo(() => {
    if (!semanticsOn || !planImport) return '';
    if (selectedPlanTrade) {
      const quantityCount = Object.keys(planImport.measurements || {}).length;
      const scopeCount = planImport.scopeDetections?.length || 0;
      const reviewCount = planImport.missingInfo?.length || 0;
      return `${selectedPlanTrade.label} takeoff: ${quantityCount} plan ${
        quantityCount === 1 ? 'quantity' : 'quantities'
      }, ${scopeCount} relevant scope ${
        scopeCount === 1 ? 'item' : 'items'
      }, ${reviewCount} item${reviewCount === 1 ? '' : 's'} to review.`;
    }
    return buildImportedPlanSummaryText({
      notesBlock: planImport.notesBlock,
      measurements: planImport.measurements || null,
      rooms: planImport.rooms || null,
      scopeLabels: (planImport.scopeDetections || [])
        .map(d => d.label || d.itemId)
        .filter(Boolean),
    });
  }, [semanticsOn, planImport, selectedPlanTrade]);

  const importedPlanCollapsedSubtitle = useMemo(() => {
    if (!semanticsOn || !planImport) return '';
    if (selectedPlanTrade) {
      const quantityCount = Object.keys(planImport.measurements || {}).length;
      const scopeCount = planImport.scopeDetections?.length || 0;
      return `${selectedPlanTrade.label} takeoff · ${quantityCount} plan ${
        quantityCount === 1 ? 'quantity' : 'quantities'
      } · ${scopeCount} relevant scope ${scopeCount === 1 ? 'item' : 'items'}`;
    }
    return importedPlanSummaryCollapsedSubtitle({
      livingSf: Number(planImport.measurements?.floorAreaSqft) || null,
      spaceCount: planImport.rooms?.length || 0,
      scopeCount: planImport.scopeDetections?.length || 0,
    });
  }, [semanticsOn, planImport, selectedPlanTrade]);

  const planReadySubtitle = useMemo(() => {
    if (!hasPlanImport || !planImport) return null;
    if (selectedPlanTrade) {
      const quantityCount = Object.keys(planImport.measurements || {}).length;
      const reviewCount = planImport.missingInfo?.length || 0;
      return `${selectedPlanTrade.label} takeoff ready · ${quantityCount} plan ${
        quantityCount === 1 ? 'quantity' : 'quantities'
      } · ${reviewCount} item${reviewCount === 1 ? '' : 's'} to review`;
    }
    if (importedPlanCollapsedSubtitle) return importedPlanCollapsedSubtitle;
    if (semanticsOn) return null;
    const bits = [
      Object.keys(planImport.measurements || {}).length
        ? `${Object.keys(planImport.measurements || {}).length} measurements`
        : null,
      planImport.rooms?.length ? `${planImport.rooms.length} rooms` : null,
      planImport.scopeDetections?.length
        ? `${planImport.scopeDetections.length} scope items`
        : null,
    ].filter(Boolean);
    return bits.length ? bits.join(' · ') : 'Plan reviewed';
  }, [
    hasPlanImport,
    planImport,
    importedPlanCollapsedSubtitle,
    semanticsOn,
    selectedPlanTrade,
  ]);

  const runGenerate = async () => {
    const trimmed = resolveEffectiveNotes();
    const canRun = Boolean(trimmed || (semanticsOn && hasPlanImport));
    if (!canRun || busy) {
      if (__DEV__ && busy) {
        console.log('🤖 Generate skipped — already busy');
      }
      return;
    }
    if (__DEV__) {
      console.warn('🤖 Generate tapped — starting draft request');
    }
    let token = authTokenRef.current;
    if (!token) {
      token = await Promise.race([
        getToken(),
        new Promise<string | null>((resolve) => setTimeout(() => resolve(null), 8000)),
      ]);
      authTokenRef.current = token;
    }
    if (!token) {
      Alert.alert(
        'Sign in required',
        'Could not get your session token. Sign out and sign back in, then try again.'
      );
      return;
    }
    setLocalGenerating(true);
    Keyboard.dismiss();
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    try {
      // Prefer user notes; when empty with semantics + plan import, pass summary as notes context.
      const notesForGenerate =
        contractorIntentNotes(trimmed) ||
        (semanticsOn && importedPlanSummary ? importedPlanSummary : trimmed);
      const hasActualPlan =
        Boolean(planImport) &&
        (Object.keys(planImport?.measurements || {}).length > 0 ||
          Boolean(planImport?.planImportFingerprint) ||
          Boolean(planImport?.rooms?.length) ||
          Boolean(planImport?.scopeDetections?.length));
      const routePlanImport = plumbingOnly
        ? {
            ...(planImport || {}),
            estimatingMode: 'selected_trade' as const,
            selectedTrade: 'plumbing' as const,
            ...(hasActualPlan
              ? {}
              : { tradeWorkflowSource: 'standalone_trade' as const }),
            plumbingWorkflowMode,
            plumbingPerformerMode,
          }
        : planImport;
      await onGenerate(
        notesForGenerate,
        photoDetections,
        routePlanImport,
        sitePhotos,
        photoExistingFeatures,
        authTokenRef.current
      );
    } catch {
      /* parent shows Alert on failure */
    } finally {
      setLocalGenerating(false);
    }
  };

  const handleCancelGenerating = () => {
    setLocalGenerating(false);
    if (onBack) {
      onBack();
    } else {
      onClose();
    }
  };

  const handleContinueDraft = () => {
    if (busy || !onContinueDraft) return;
    Keyboard.dismiss();
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onContinueDraft();
  };

  const handleStartFresh = () => {
    if (busy || !onStartFresh) return;
    Alert.alert(
      'Start fresh?',
      'This clears your saved scope draft, job notes, plan import, and photos from Build with AI. Saved progress is removed from this device. Your current bid is not affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start fresh',
          style: 'destructive',
          onPress: () => {
            applyNotesText('');
            setNotesInputSessionKey((key) => key + 1);
            setPlanImport(null);
            onPlanImportChange?.(null);
            setPhotoDetections([]);
            onPhotoDetectionsChange?.([]);
            setPhotoExistingFeatures([]);
            onPhotoExistingFeaturesChange?.([]);
            setSitePhotos([]);
            onSitePhotosChange?.([]);
            setPhotoState({ photoCount: 0, hasAnalyzed: false });
            setPlumbingOnly(false);
            setPlanSummaryExpanded(false);
            onStartFresh();
          },
        },
      ]
    );
  };

  const proceedGenerate = () => {
    // Photos attached but Detect never run — remind so users don't skip vision scope.
    if (photoState.photoCount > 0 && !photoState.hasAnalyzed) {
      const n = photoState.photoCount;
      Alert.alert(
        'Detect scope from photos?',
        `You added ${n} photo${n === 1 ? '' : 's'} but haven't run Detect scope yet. That step finds finishes and likely work from the pictures — worth doing before generating.`,
        [
          {
            text: hasExistingDraft ? 'Regenerate anyway' : 'Generate anyway',
            style: 'cancel',
            onPress: () => void runGenerate(),
          },
          {
            text: 'Detect first',
            onPress: () => photosStripRef.current?.detectScope(),
          },
        ]
      );
      return;
    }
    void runGenerate();
  };

  const handleGenerate = () => {
    if (busy) return;
    dismissNotesEditing();
    const run = () => {
      commitNotesFromInput();
      const trimmed = resolveEffectiveNotes();
      const canRun = Boolean(trimmed || (semanticsOn && hasPlanImport));
      if (!canRun) return;
      if (hasExistingDraft) {
        Alert.alert(
          'Replace current scope draft?',
          'Your Yes/No choices, measurements you confirmed, and applied prices will reset. Plan and notes stay — regenerate rebuilds scope from them.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Regenerate',
              style: 'destructive',
              onPress: proceedGenerate,
            },
          ]
        );
        return;
      }
      proceedGenerate();
    };
    if (Platform.OS === 'ios') {
      setTimeout(run, 64);
    } else {
      requestAnimationFrame(run);
    }
  };

  const placeholderColor = darkMode ? 'rgba(255,255,255,0.4)' : Colors.sub;
  const inputShell = {
    backgroundColor: aiFlowCardBackground(darkMode, Colors.surface2),
    borderColor: darkMode ? 'rgba(148, 163, 184, 0.12)' : Colors.line,
  };
  const tabBarClearance = embedded
    ? getEmbeddedAiFlowFooterBottomInset(insets.bottom)
    : Math.max(insets.bottom, 16);
  // Generate CTA + Start fresh + footer top padding
  const footerChromeHeight = 96;
  const keyboardUp = isKeyboardVisible;
  const canGenerate = useMemo(
    () =>
      Boolean(
        resolveEffectiveNotes() || (semanticsOn && hasPlanImport)
      ),
    [resolveEffectiveNotes, semanticsOn, hasPlanImport]
  );

  const baselineNotes = useMemo(
    () => contractorIntentNotes(savedSessionNotes || initialNotes || '').trim(),
    [savedSessionNotes, initialNotes]
  );

  const inputsChangedSinceDraft = useMemo(() => {
    if (!hasExistingDraft) return false;

    const currentNotes = contractorIntentNotes(
      resolveNotesText().trim() || savedSessionNotes || ''
    ).trim();
    if (currentNotes !== baselineNotes) return true;

    if (
      planImportSnapshot(planImport) !==
      planImportSnapshot(initialPlanImport)
    ) {
      return true;
    }

    if (
      stablePhotoIds(sitePhotos) !==
      stablePhotoIds(initialSitePhotos || [])
    ) {
      return true;
    }

    if (
      stableDetectionKey(photoDetections) !==
      stableDetectionKey(initialPhotoDetections || [])
    ) {
      return true;
    }

    if (
      stableExistingFeatureKey(photoExistingFeatures) !==
      stableExistingFeatureKey(initialPhotoExistingFeatures || [])
    ) {
      return true;
    }

    return false;
  }, [
    hasExistingDraft,
    baselineNotes,
    resolveNotesText,
    notesSyncTick,
    savedSessionNotes,
    planImport,
    initialPlanImport,
    sitePhotos,
    initialSitePhotos,
    photoDetections,
    initialPhotoDetections,
    photoExistingFeatures,
    initialPhotoExistingFeatures,
  ]);

  const showSavedNotesHint =
    hasExistingDraft &&
    Boolean(String(savedSessionNotes || '').trim()) &&
    !resolveNotesText().trim() &&
    inputsChangedSinceDraft;
  const generateBtnEnabled = canGenerate && !busy;

  const hasBuilderSessionContent = useMemo(() => {
    if (hasExistingDraft) return true;
    if (Boolean(resolveEffectiveNotes().trim())) return true;
    if (hasPlanImport) return true;
    if (sitePhotos.length > 0) return true;
    if (photoDetections.length > 0) return true;
    return false;
  }, [
    hasExistingDraft,
    resolveEffectiveNotes,
    notesSyncTick,
    hasPlanImport,
    sitePhotos,
    photoDetections,
  ]);

  const startFreshLink =
    hasBuilderSessionContent && onStartFresh ? (
      <ReliableFlowPress
        disabled={busy}
        onPress={handleStartFresh}
        haptic='light'
        style={styles.startFreshLinkBtn}
      >
        <Text
          style={[
            styles.startFreshLinkText,
            {
              color: darkMode ? 'rgba(248, 113, 113, 0.92)' : '#dc2626',
            },
          ]}
        >
          Start fresh
        </Text>
      </ReliableFlowPress>
    ) : null;

  const scrollBottomPad = keyboardUp
    ? Math.max(keyboardHeight, Platform.OS === 'ios' ? 320 : 280) + 24
    : footerChromeHeight + tabBarClearance + 16;

  const embeddedShellStyle = embedded
    ? {
        position: 'absolute' as const,
        top: 0,
        left: 0,
        right: 0,
        height: windowHeight,
        backgroundColor: Colors.bg,
      }
    : null;

  if (!visible) return null;

  const notesMinHeight = embedded ? 220 : 200;
  const notesInputShellStyle = {
    backgroundColor: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
    borderColor: darkMode ? 'rgba(148, 163, 184, 0.12)' : Colors.line,
  };

  const generateActions = (
    <>
      {hasExistingDraft && onContinueDraft && !busy ? (
        inputsChangedSinceDraft ? (
          <>
            <ReliableFlowPress
              disabled={!generateBtnEnabled}
              onPress={handleGenerate}
              haptic='medium'
              style={[
                styles.generateCtaShell,
                !generateBtnEnabled ? styles.generateCtaDisabled : null,
                { marginBottom: 8 },
              ]}
            >
              {generateBtnEnabled ? (
                <LinearGradient
                  colors={BRAND_FRAME_GRADIENT_COLORS}
                  start={BRAND_FRAME_GRADIENT_START}
                  end={BRAND_FRAME_GRADIENT_END}
                  style={styles.generateCta}
                >
                  <MaterialIcons name='auto-awesome' size={18} color='#0f172a' />
                  <Text style={styles.generateCtaText}>Update scope from notes</Text>
                </LinearGradient>
              ) : (
                <View style={styles.generateCta}>
                  <MaterialIcons
                    name='auto-awesome'
                    size={18}
                    color={
                      darkMode ? 'rgba(148, 163, 184, 0.55)' : Colors.sub
                    }
                  />
                  <Text
                    style={[
                      styles.generateCtaText,
                      {
                        color: darkMode
                          ? 'rgba(148, 163, 184, 0.55)'
                          : Colors.sub,
                      },
                    ]}
                  >
                    Update scope from notes
                  </Text>
                </View>
              )}
            </ReliableFlowPress>
            <ReliableFlowPress
              onPress={handleContinueDraft}
              haptic='light'
              style={styles.regenerateLinkBtn}
            >
              <MaterialIcons name='arrow-forward' size={16} color={ESTIMATE_FLOW_GREEN} />
              <Text style={[styles.regenerateLinkText, { color: ESTIMATE_FLOW_GREEN }]}>
                Keep current draft
              </Text>
            </ReliableFlowPress>
            {startFreshLink}
          </>
        ) : (
          <>
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={handleContinueDraft}
            style={[
              styles.primaryBtn,
              { backgroundColor: ESTIMATE_FLOW_GREEN, marginBottom: 4 },
            ]}
          >
            <MaterialIcons name='arrow-forward' size={20} color='#0f172a' />
            <Text style={styles.primaryBtnText}>
              {resumeToScopeConfirm
                ? 'Continue to Confirm scope'
                : 'Continue to review'}
            </Text>
          </TouchableOpacity>
          {startFreshLink}
          </>
        )
      ) : (
      <>
      <ReliableFlowPress
        disabled={!generateBtnEnabled || busy}
        onPress={handleGenerate}
        haptic='medium'
        style={[
          styles.generateCtaShell,
          !generateBtnEnabled || busy ? styles.generateCtaDisabled : null,
        ]}
      >
        {generateBtnEnabled && !busy ? (
          <LinearGradient
            colors={BRAND_FRAME_GRADIENT_COLORS}
            start={BRAND_FRAME_GRADIENT_START}
            end={BRAND_FRAME_GRADIENT_END}
            style={styles.generateCta}
          >
            <MaterialIcons name='auto-awesome' size={18} color='#0f172a' />
            <Text style={styles.generateCtaText}>
              {selectedPlanTrade
                ? `Generate ${selectedPlanTrade.label} Estimate Draft`
                : 'Generate Estimate Draft'}
            </Text>
          </LinearGradient>
        ) : (
          <View style={styles.generateCta}>
            {busy ? (
              <>
                <ActivityIndicator color='#0f172a' size='small' />
                <Text style={styles.generateCtaText}>Generating…</Text>
              </>
            ) : (
              <>
                <MaterialIcons
                  name='auto-awesome'
                  size={18}
                  color={
                    darkMode ? 'rgba(148, 163, 184, 0.55)' : Colors.sub
                  }
                />
                <Text
                  style={[
                    styles.generateCtaText,
                    {
                      color: darkMode
                        ? 'rgba(148, 163, 184, 0.55)'
                        : Colors.sub,
                    },
                  ]}
                >
                  {selectedPlanTrade
                    ? `Generate ${selectedPlanTrade.label} Estimate Draft`
                    : 'Generate Estimate Draft'}
                </Text>
              </>
            )}
          </View>
        )}
      </ReliableFlowPress>
      {startFreshLink}
      </>
      )}
    </>
  );

  const notesField = (
    <>
      <Text
        style={{
          color: Colors.sub,
          fontSize: 13,
          lineHeight: 18,
          marginBottom: 10,
        }}
      >
        {hasExistingDraft
          ? inputsChangedSinceDraft
            ? 'You changed notes, photos, or plan since your last draft. Update scope to rebuild, or keep your current draft.'
            : resumeToScopeConfirm
              ? 'Your saved draft is ready. Continue below to confirm scope items and pricing.'
              : 'Your saved draft is ready. Continue below to review scope pricing and apply to your bid.'
          : 'Paste or dictate job notes — AI drafts scope for review.'}
      </Text>

      <View>
        <EstimatePlanImportStrip
          Colors={Colors}
          darkMode={darkMode}
          disabled={busy}
          existingNotes={notes}
          existingPlanImport={planImport}
          planReadySubtitle={planReadySubtitle}
          embedded
          onImportingChange={setPlanImportBusy}
          onImportPhaseChange={setPlanImportPhase}
          onApplied={handlePlanApplied}
        />

        <EstimateSitePhotosStrip
          ref={photosStripRef}
          Colors={Colors}
          darkMode={darkMode}
          disabled={busy}
          embedded
          existingNotes={notes}
          initialPhotos={sitePhotos}
          initialHasAnalyzed={photoState.hasAnalyzed}
          onNotesMerged={handlePhotoNotesMerged}
          onPhotoStateChange={setPhotoState}
          onPhotosChange={next => {
            setSitePhotos(next);
            onSitePhotosChange?.(next);
          }}
        />

        {semanticsOn && importedPlanSummary ? (
          <View style={{ marginBottom: 16 }}>
            <TouchableOpacity
              onPress={() => setPlanSummaryExpanded(v => !v)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: planSummaryExpanded ? 8 : 0,
              }}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                <Text
                  style={{ color: Colors.text, fontSize: 14, fontWeight: '700' }}
                >
                  Imported plan summary
                </Text>
                {!planSummaryExpanded && importedPlanCollapsedSubtitle ? (
                  <Text
                    style={{ color: Colors.sub, fontSize: 12, marginTop: 3 }}
                    numberOfLines={1}
                  >
                    {importedPlanCollapsedSubtitle}
                  </Text>
                ) : null}
              </View>
              <MaterialIcons
                name={planSummaryExpanded ? 'expand-less' : 'expand-more'}
                size={22}
                color={Colors.sub}
              />
            </TouchableOpacity>
            {planSummaryExpanded ? (
              <View
                style={[
                  styles.notesInput,
                  inputShell,
                  {
                    opacity: 0.95,
                  },
                ]}
              >
                <Text
                  style={{
                    color: Colors.sub,
                    fontSize: 12,
                    lineHeight: 17,
                    marginBottom: 8,
                  }}
                >
                  Read-only. Structured plan measurements stay authoritative —
                  editing Job notes below does not change imported numbers unless
                  you re-run plan import.
                </Text>
                <Text
                  style={{ color: Colors.text, fontSize: 14, lineHeight: 20 }}
                >
                  {importedPlanSummary}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      <View
        style={estimateStep1InputCardStyle(Colors, darkMode, {
          marginBottom: 8,
          marginHorizontal: embedded ? -8 : undefined,
        })}
      >
        <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700' }}>
          Job notes
        </Text>
        <Text style={{ color: Colors.sub, fontSize: 12, lineHeight: 16, marginTop: 4, marginBottom: showSavedNotesHint ? 4 : 10 }}>
          Paste or dictate your walkthrough — sizes, materials, or lump sums if you have them.
        </Text>
        {showSavedNotesHint ? (
          <Text
            style={{
              color: Colors.sub,
              fontSize: 11,
              lineHeight: 15,
              marginBottom: 10,
              fontStyle: 'italic',
            }}
          >
            Update scope uses your saved notes unless you paste new ones here.
          </Text>
        ) : null}
        <TextInput
          key={`job-notes-${notesInputSessionKey}`}
          ref={notesInputRef}
          value={notes}
          onChangeText={handleNotesTextChange}
          onChange={(event) => handleNotesTextChange(event.nativeEvent.text)}
          editable={!busy}
          multiline
          scrollEnabled={false}
          textAlignVertical='top'
          onContentSizeChange={handleNotesContentSizeChange}
          onSubmitEditing={(event) => {
            syncNotesFromNativeEvent(event.nativeEvent.text);
            dismissNotesEditing();
          }}
          onEndEditing={(event) => {
            syncNotesFromNativeEvent(event.nativeEvent.text);
          }}
          onBlur={(event) => {
            syncNotesFromNativeEvent(event.nativeEvent.text);
          }}
          {...resolveTextInputKeyboardProps({ multiline: true })}
          placeholder='Bathroom remodel — shower tile, vanity, plumbing, demo…'
          placeholderTextColor={placeholderColor}
          style={[
            styles.notesInput,
            {
              color: Colors.text,
              minHeight: notesMinHeight,
              ...notesInputShellStyle,
            },
          ]}
        />
        <View style={{ marginTop: 10 }}>
          <EstimateVoiceDictationButton
            Colors={Colors}
            darkMode={darkMode}
            disabled={busy}
            variant="action"
            onTranscript={handleTranscript}
          />
        </View>
      </View>

      {false && notes.trim() && !hasPlanImport ? (
        <View
          style={{
            borderRadius: 14,
            borderWidth: 1,
            borderColor: Colors.line,
            backgroundColor: darkMode
              ? 'rgba(255,255,255,0.035)'
              : Colors.surface2,
            padding: 12,
            marginTop: 14,
          }}
        >
          <Text
            style={{
              color: Colors.text,
              fontSize: 13,
              fontWeight: '800',
              marginBottom: 8,
            }}
          >
            Notes estimate scope
          </Text>
          <View style={{ gap: 7 }}>
            {[
              ['whole_project', 'Whole Project / General Contractor'],
              ['plumbing_only', 'Single Trade / Plumbing Only'],
            ].map(([id, label]) => {
              const active =
                id === 'plumbing_only' ? plumbingOnly : !plumbingOnly;
              return (
                <TouchableOpacity
                  key={id}
                  disabled={busy}
                  onPress={() => {
                    const nextPlumbingOnly = id === 'plumbing_only';
                    setPlumbingOnly(nextPlumbingOnly);
                    if (!nextPlumbingOnly) {
                      setPlumbingPerformerMode(null);
                      setPlumbingWorkflowMode('bathroom_remodel');
                    }
                  }}
                  style={{
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: active ? '#22c55e' : Colors.line,
                    backgroundColor: active
                      ? 'rgba(34,197,94,0.12)'
                      : 'transparent',
                    paddingHorizontal: 11,
                    paddingVertical: 8,
                  }}
                >
                  <Text
                    style={{
                      color: Colors.text,
                      fontSize: 12,
                      fontWeight: '700',
                    }}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {plumbingOnly ? (
            <>
              <Text
                style={{
                  color: Colors.text,
                  fontSize: 12,
                  fontWeight: '700',
                  marginTop: 10,
                  marginBottom: 6,
                }}
              >
                Plumbing mode
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {(
                  [
                    ['bathroom_remodel', 'Bathroom Remodel'],
                    ['service', 'Service'],
                    ['new_construction', 'New Construction'],
                  ] as Array<[PlumbingWorkflowMode, string]>
                ).map(([mode, label]) => (
                  <TouchableOpacity
                    key={mode}
                    disabled={busy}
                    onPress={() => setPlumbingWorkflowMode(mode)}
                    style={{
                      borderRadius: 15,
                      borderWidth: 1,
                      borderColor:
                        plumbingWorkflowMode === mode ? '#22c55e' : Colors.line,
                      backgroundColor:
                        plumbingWorkflowMode === mode
                          ? 'rgba(34,197,94,0.12)'
                          : 'transparent',
                      paddingHorizontal: 9,
                      paddingVertical: 6,
                    }}
                  >
                    <Text
                      style={{
                        color: Colors.text,
                        fontSize: 11,
                        fontWeight: '700',
                      }}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text
                style={{
                  color: Colors.text,
                  fontSize: 12,
                  fontWeight: '700',
                  marginTop: 10,
                  marginBottom: 6,
                }}
              >
                Performer
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {(
                  [
                    ['self_performed', 'I do the work'],
                    ['subcontracted', 'I hire a plumber'],
                    ['existing_quote', 'Existing quote'],
                  ] as Array<[PlumbingPerformerMode, string]>
                ).map(([mode, label]) => (
                  <TouchableOpacity
                    key={mode}
                    disabled={busy}
                    onPress={() => setPlumbingPerformerMode(mode)}
                    style={{
                      borderRadius: 15,
                      borderWidth: 1,
                      borderColor:
                        plumbingPerformerMode === mode
                          ? '#22c55e'
                          : Colors.line,
                      backgroundColor:
                        plumbingPerformerMode === mode
                          ? 'rgba(34,197,94,0.12)'
                          : 'transparent',
                      paddingHorizontal: 9,
                      paddingVertical: 6,
                    }}
                  >
                    <Text
                      style={{
                        color: Colors.text,
                        fontSize: 11,
                        fontWeight: '700',
                      }}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : null}
        </View>
      ) : null}

      <AIEstimateDisclaimer variant='compact' />
    </>
  );

  const footer = (
    <View
      style={{
        paddingTop: 12,
        paddingBottom: embedded ? 0 : tabBarClearance,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: darkMode ? 'rgba(255,255,255,0.08)' : Colors.line,
        backgroundColor: Colors.bg,
      }}
    >
      {generateActions}
    </View>
  );

  const scrollContentStyle = embedded
    ? {
        flexGrow: 1,
        paddingBottom: keyboardUp ? scrollBottomPad : tabBarClearance + 8,
      }
    : { paddingBottom: scrollBottomPad };

  const body = (
    <View
      style={{
        flex: 1,
        backgroundColor: Colors.bg,
        ...(embedded ? { height: windowHeight } : null),
      }}
    >
      <AIEstimateFlowHeader
        title='Build with AI'
        subtitle={
          hasExistingDraft
            ? inputsChangedSinceDraft
              ? 'Inputs changed — update or keep draft'
              : resumeToScopeConfirm
                ? 'Draft saved — confirm scope below'
                : 'Draft saved — continue to review'
            : 'Notes, photos, or plans'
        }
        step={1}
        stepTotal={3}
        fromAssistant={fromAssistant}
        disabled={busy}
        onBack={handleBack}
      />
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, scrollContentStyle]}
        keyboardShouldPersistTaps='always'
        keyboardDismissMode='none'
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={false}
        {...(Platform.OS === 'ios' && !embedded
          ? {
              maintainVisibleContentPosition: {
                minIndexForVisible: 0,
                autoscrollToTopThreshold: 100,
              },
            }
          : null)}
      >
        {notesField}
        {embedded ? <View style={{ flexGrow: 1, minHeight: 16 }} /> : null}
        {embedded && !busy ? footer : null}
      </ScrollView>
      {!embedded && !busy ? footer : null}
    </View>
  );

  if (embedded) {
    return (
      <View style={[embeddedShellStyle, styles.embeddedShell]}>
        {body}
        <AIEstimateGeneratingOverlay
          visible={busy}
          phase={overlayPhase}
          steps={overlaySteps}
          onCancel={handleCancelGenerating}
        />
      </View>
    );
  }

  return (
    <Modal
      visible
      animationType='none'
      presentationStyle='fullScreen'
      onRequestClose={handleBack}
    >
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
      <View style={{ flex: 1, backgroundColor: Colors.bg }}>
        {body}
        <AIEstimateGeneratingOverlay
          visible={busy}
          phase={overlayPhase}
          steps={overlaySteps}
          onCancel={handleCancelGenerating}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  embeddedShell: {
    zIndex: 100,
    elevation: 100,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    lineHeight: 22,
  },
  primaryBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  generateCtaShell: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  generateCta: {
    width: '100%',
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  generateCtaDisabled: {
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.18)',
  },
  generateCtaText: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
    flexShrink: 1,
    textAlign: 'center',
  },
  primaryBtnDisabled: {
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.18)',
  },
  regenerateLinkBtn: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  regenerateLinkText: {
    fontSize: 14,
    fontWeight: '700',
  },
  startFreshLinkBtn: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginTop: 4,
  },
  startFreshLinkText: {
    fontSize: 13,
    fontWeight: '600',
  },
  primaryBtnText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
    flexShrink: 1,
    textAlign: 'center',
  },
});
