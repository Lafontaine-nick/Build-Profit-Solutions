import React, { useCallback, useEffect, useMemo, useRef, useState, memo, startTransition } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  StatusBar,
  Platform,
  useWindowDimensions,
} from 'react-native';
import {
  ScrollView as GestureScrollView,
  TouchableOpacity as GestureTouchableOpacity,
} from 'react-native-gesture-handler';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import AIEstimateFlowHeader from '@/components/estimate/AIEstimateFlowHeader';
import AnimatedNumberText from '@/components/motion/AnimatedNumberText';
import type { EstimateAiDraft } from '@/utils/estimateAiDraft';
import { notesDescribeDedicatedKitchenRemodel } from '@/utils/kitchenNoteScope';
import {
  readShowerRemovalChoice,
  readShowerRemovalPieces,
  showerRemovalRevealLines,
  type ShowerRemovalPiece,
} from '@/utils/bathroomNoteScope';
import {
  declineRemodelExtent,
  garageDrywallHangChoice,
  garageNoAdditionalWork,
  garageScopeAssistant,
  garageScopeTextAdditions,
  matchScopeOptionText,
  readScopeFoundChoice,
  readScopeFoundClarificationId,
  readScopeFoundPieces,
  remodelExtentAnswered,
  remodelExtentFollowUps,
  remodelExtentSummary,
  resolveScopeFoundClarification,
  ROOF_TEAR_OFF_CARDS,
  FRAMING_SHEATHING_PIECE,
  notesOfferFramingSheathingChip,
  scopeFoundRevealLines,
  toggleRemodelExtentPiece,
  toggleRemodelScopePiece,
  toggleGarageSuggestionPiece,
  withGarageDrywallHangChoice,
  type ScopeFoundChoice,
  type ScopeFoundClarificationId,
} from '@/utils/scopeFoundClarification';
import { formatPlanningMoney } from '@/utils/estimateAiDraft';
import { resolveTextInputKeyboardProps } from '@/constants/inputKeyboardPresets';
import {
  countInitialRevealAttentionItems,
  draftNeedsScopeConfirmation,
  getInitialRevealHeaderCopy,
  getInitialRevealAttentionTitle,
  getInitialRevealChecklistScopePreview,
  initialRevealAmountsByName,
  getInitialRevealConfirmItems,
  getInitialRevealDisplayTitle,
  getInitialRevealHeroDisplay,
  getInitialRevealPlanningDisclaimer,
  getInitialRevealPrimaryCtaLabel,
  getInitialRevealScopeMetaLabel,
  priceShowerRemovalRevealRows,
  initialRevealListsPlanLines,
  getInitialRevealStatusLabel,
  initialRevealStatusAttentionCount,
  getInitialRevealTagline,
  getInitialRevealTotals,
  getInitialRevealUnderstoodBullets,
  initialRevealPricingVisible,
  confirmedAppliedRevealLines,
  omitPricedPaintPlaceholders,
  getScopeTotalCoverageLine,
  shouldDefaultExpandInitialRevealScope,
  planRevealOmitsWhatWeFound,
  shouldShowInitialRevealWhatWeFound,
  understoodRepeatsScopePreview,
} from '@/utils/estimateInitialRevealUi';
import { estimateFlowCardStyle, estimateFlowDividerColor, aiFlowCardBackground } from '@/utils/estimateFlowCardStyle';
import { getEmbeddedAiFlowFooterBottomInset } from '@/constants/ScreenLayout';
import TabScreenBottomScrollFade from '@/components/layout/TabScreenBottomScrollFade';
import { BRAND_FRAME_GRADIENT_END, BRAND_FRAME_GRADIENT_START } from '@/constants/brandFrameGradient';

type Props = {
  visible: boolean;
  draft: EstimateAiDraft | null;
  markupPct?: number;
  fromAssistant?: boolean;
  embedded?: boolean;
  onBack: () => void;
  onOpenDetailedReview: () => void;
  onConfirmScope?: () => void;
  onShowerRemovalChoice?: (
    choice: ShowerRemovalPiece[] | 'none' | 'unsure'
  ) => void;
  onScopeFoundChoice?: (
    id: ScopeFoundClarificationId,
    choice: ScopeFoundChoice | string[],
    extra?: Record<string, string>
  ) => void;
};

const STATUS_COLORS = {
  ready: { bg: 'rgba(34, 197, 94, 0.14)', color: '#4ade80' },
  mostly: { bg: 'rgba(45, 204, 154, 0.14)', color: '#2dcc9a' },
  review: { bg: 'rgba(251, 191, 36, 0.12)', color: '#fbbf24' },
};

/** Visible mint wash on the summary card. */
const HERO_GRADIENT_DARK = ['rgba(45, 204, 154, 0.22)', 'rgba(45, 204, 154, 0.08)'] as const;
const HERO_GRADIENT_LIGHT = ['rgba(45, 204, 154, 0.2)', 'rgba(45, 204, 154, 0.06)'] as const;
const HERO_BG_DARK = '#202022';
/** Mint — links and totals on this summary. */
const BRAND_ACCENT = '#2dcc9a';
const BRAND_ACCENT_LIGHT = '#0f766e';
/** Mint — primary CTA only. */
const FLOW_ACCENT = '#2dcc9a';

function fireHaptic(style: Haptics.ImpactFeedbackStyle) {
  if (Platform.OS === 'web') return;
  void Haptics.impactAsync(style).catch(() => {});
}

function packChipRows<T>(options: T[], size: number): T[][] {
  const rows: T[][] = [];
  let index = 0;
  while (index < options.length) {
    const remaining = options.length - index;
    const count =
      size === 3 && remaining === 4 ? 2 : Math.min(size, remaining);
    rows.push(options.slice(index, index + count));
    index += count;
  }
  return rows;
}

/** Two choices per row keeps the pill layout from feeling cramped. */
function scopeFoundChipRows<T extends { label: string }>(options: T[]): T[][] {
  return options.length ? packChipRows(options, 2) : [];
}

/** A check plus a long word does not fit in a third of the row. */
function removalMaterialColumns<T extends { label: string }>(options: T[]): number {
  if (options.length !== 5 && options.length !== 6) return 2;
  const longest = options.reduce((max, option) => Math.max(max, option.label.length), 0);
  return longest > 12 ? 2 : 3;
}

function ReliablePress({
  onPress,
  disabled,
  children,
  style,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
}: {
  onPress: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  style?: object | object[];
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'link';
  accessibilityState?: { expanded?: boolean };
}) {
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;
  const lockRef = useRef(false);

  const fire = () => {
    if (disabled || lockRef.current) return;
    lockRef.current = true;
    fireHaptic(Haptics.ImpactFeedbackStyle.Light);
    onPressRef.current();
    setTimeout(() => {
      lockRef.current = false;
    }, 400);
  };

  return (
    <GestureTouchableOpacity
      onPressIn={fire}
      disabled={disabled}
      activeOpacity={0.82}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      style={style}
    >
      {children}
    </GestureTouchableOpacity>
  );
}

function AIEstimateInitialRevealModal({
  visible,
  draft,
  markupPct = 0,
  fromAssistant = false,
  embedded = false,
  onBack,
  onOpenDetailedReview,
  onConfirmScope,
  onShowerRemovalChoice,
  onScopeFoundChoice,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const [detailsExpanded, setDetailsExpanded] = useState(true);
  const [confirmListExpanded, setConfirmListExpanded] = useState(false);
  const scopeDefaultAppliedRef = useRef(false);
  const [showerPiecesLive, setShowerPiecesLive] = useState<ShowerRemovalPiece[]>(() =>
    readShowerRemovalPieces(draft?.scopeMeasurements?.showerRemovalPieces)
  );
  const [showerDeclinedLive, setShowerDeclinedLive] = useState<'none' | 'unsure' | null>(
    () => {
      const choice = readShowerRemovalChoice(draft?.scopeMeasurements?.showerRemovalChoice);
      return choice === 'none' || choice === 'unsure' ? choice : null;
    }
  );
  const showerChoiceRef = useRef<ShowerRemovalPiece[] | 'none' | 'unsure'>(
    showerDeclinedLive ?? showerPiecesLive
  );
  showerChoiceRef.current = showerDeclinedLive ?? showerPiecesLive;

  const PRICING_PREVIEW_COUNT = 3;

  const viewModel = useMemo(() => {
    if (!draft) return null;

    const attentionCount = countInitialRevealAttentionItems(draft);
    const totals = getInitialRevealTotals(draft, markupPct);
    const needsScopeConfirmation = draftNeedsScopeConfirmation(draft);
    const pricingVisible = initialRevealPricingVisible(draft);
    const suppressRevealPricing = needsScopeConfirmation || !pricingVisible;
    const confirmBuckets = getInitialRevealConfirmItems(draft);
    const tagline = getInitialRevealTagline(draft);
    const bathroomRemodelNote = String(draft.originalNotes || '');
    const scopePreview = getInitialRevealChecklistScopePreview(draft);
    const understood = getInitialRevealUnderstoodBullets(
      draft,
      draft.projectType === 'plumbing' || draft.projectType === 'plumbing_service'
        ? 4
        : /\b(?:bathroom|bath)\s+(?:remodel|renovation)\b/i.test(
              bathroomRemodelNote
            ) ||
            /\bremodel(?:\s+\w+){0,4}\s+bathroom\b/i.test(bathroomRemodelNote)
          ? 8
          : draft.projectType === 'kitchen' ||
              notesDescribeDedicatedKitchenRemodel(bathroomRemodelNote)
            ? 6
            : 2
    );

    return {
      attentionCount,
      status: getInitialRevealStatusLabel(draft, attentionCount),
      totals,
      understood,
      confirmBuckets,
      showWhatWeFound:
        !planRevealOmitsWhatWeFound(draft) &&
        shouldShowInitialRevealWhatWeFound(understood, tagline) &&
        !understoodRepeatsScopePreview(understood, scopePreview),
      displayTitle: getInitialRevealDisplayTitle(draft),
      tagline,
      needsScopeConfirmation,
      attentionTitle: getInitialRevealAttentionTitle(draft, needsScopeConfirmation),
      primaryCta: getInitialRevealPrimaryCtaLabel(attentionCount, needsScopeConfirmation),
      hero: getInitialRevealHeroDisplay(totals, suppressRevealPricing),
      headerCopy: getInitialRevealHeaderCopy({
        hasAmount:
          !suppressRevealPricing &&
          totals.heroTotal != null &&
          totals.heroTotal > 0,
        needsScopeConfirmation,
      }),
      totalCoverageLine: suppressRevealPricing ? null : getScopeTotalCoverageLine(draft),
      planLines: initialRevealListsPlanLines(draft),
      scopeMetaLabel: getInitialRevealScopeMetaLabel(totals.scopeItemCount, {
        planLines: initialRevealListsPlanLines(draft),
      }),
      planningDisclaimer: suppressRevealPricing
        ? null
        : getInitialRevealPlanningDisclaimer(totals, attentionCount),
      suppressRevealPricing,
      defaultScopeExpanded: shouldDefaultExpandInitialRevealScope(totals.scopeItemCount),
      scopePreview,
    };
  }, [draft, markupPct]);

  const brandAccent = darkMode ? BRAND_ACCENT : BRAND_ACCENT_LIGHT;
  const assistantControlBg = darkMode ? 'rgba(148, 163, 184, 0.22)' : 'rgba(15, 23, 42, 0.06)';
  const assistantControlBorder = darkMode
    ? 'rgba(255,255,255,0.16)'
    : 'rgba(15,23,42,0.16)';
  const flowCardStyle = useMemo(
    () => estimateFlowCardStyle(Colors, darkMode),
    [Colors, darkMode]
  );
  const dividerColor = estimateFlowDividerColor(darkMode);
  const flowCardBg = aiFlowCardBackground(darkMode, Colors.surface2);
  const clarification =
    draft && planRevealOmitsWhatWeFound(draft)
      ? null
      : resolveScopeFoundClarification(draft?.originalNotes);
  const showerRemovalPieces = showerPiecesLive;
  const showerRemovalSelected = showerDeclinedLive;
  const storedScopeFoundId = readScopeFoundClarificationId(
    draft?.scopeMeasurements?.scopeFoundClarificationId
  );
  const showManualScopeAdd = !clarification;
  const scopeFoundIdMatches =
    (clarification &&
      clarification.id !== 'shower' &&
      storedScopeFoundId === clarification.id) ||
    (showManualScopeAdd && storedScopeFoundId === 'remodel_remainder');
  const scopeFoundPieces = scopeFoundIdMatches
    ? readScopeFoundPieces(draft?.scopeMeasurements?.scopeFoundPieces)
    : [];
  const scopeFoundPiecesRef = useRef(scopeFoundPieces);
  const scopeNoteRef = useRef<TextInput>(null);
  const applyTypedScopeRef = useRef<() => boolean>(() => true);
  scopeFoundPiecesRef.current = scopeFoundPieces;
  const scopeFoundSelected = scopeFoundIdMatches
    ? readScopeFoundChoice(draft?.scopeMeasurements?.scopeFoundChoice)
    : null;
  const extentFollowUps =
    clarification?.id === 'remodel_remainder' ? remodelExtentFollowUps(scopeFoundPieces) : [];
  const garageAssistant =
    clarification?.id === 'remodel_remainder'
      ? garageScopeAssistant(draft?.originalNotes)
      : null;
  const hangChoice = garageDrywallHangChoice(scopeFoundPieces);
  const applyGaragePieces = (
    next: string[],
    extra?: Record<string, string>
  ) => {
    if (!clarification) return;
    scopeFoundPiecesRef.current = next;
    onScopeFoundChoice?.(clarification.id, next.length ? next : 'none', extra);
  };
  const applyTypedScope = (): boolean => {
    const text = scopeNote;
    if (!text.trim()) return true;
    if (clarification && !garageAssistant) {
      const ids = matchScopeOptionText(text, clarification.options);
      if (ids.length) {
        if (clarification.id === 'shower') {
          const next = [...new Set([...showerRemovalPieces, ...ids])];
          onShowerRemovalChoice?.(next as ShowerRemovalPiece[]);
        } else if (clarification.multi) {
          let next = scopeFoundPiecesRef.current;
          for (const id of ids) {
            if (!next.includes(id)) next = toggleRemodelScopePiece(next, id);
          }
          scopeFoundPiecesRef.current = next;
          onScopeFoundChoice?.(clarification.id, next);
        } else {
          const choice = readScopeFoundChoice(ids[0]);
          if (choice) onScopeFoundChoice?.(clarification.id, choice);
        }
        setScopeNote('');
        setScopeNoteError('');
        return true;
      }
    }
    const added = garageScopeTextAdditions(text, draft?.originalNotes);
    if (!added.matched) {
      setScopeNoteError(
        clarification || garageAssistant
          ? "That didn't match a scope item. Use Expand list."
          : "That didn't match a scope item."
      );
      return false;
    }
    const merged = [
      ...scopeFoundPiecesRef.current.filter(id => id !== 'garage_no_additional_work'),
      ...added.pieceIds.filter(id => !scopeFoundPiecesRef.current.includes(id)),
    ];
    scopeFoundPiecesRef.current = merged;
    if (clarification) {
      applyGaragePieces(merged, added.counts);
    } else {
      onScopeFoundChoice?.('remodel_remainder', merged, added.counts);
    }
    setScopeNote('');
    setScopeNoteError('');
    return true;
  };
  applyTypedScopeRef.current = applyTypedScope;
  const [activeExtentId, setActiveExtentId] = useState<string | null>(null);
  const [manualScope, setManualScope] = useState(false);
  const [hangEditing, setHangEditing] = useState(false);
  const [scopeNote, setScopeNote] = useState('');
  const [scopeNoteFocused, setScopeNoteFocused] = useState(false);
  const [scopeNoteError, setScopeNoteError] = useState('');
  const removalMaterialOptions = (clarification?.options ?? []).filter(
    option => option.id !== 'none' && option.id !== 'unsure'
  );
  const removalMaterialsFitOnScreen = removalMaterialOptions.length <= 6;
  const visibleRemovalMaterials =
    manualScope || removalMaterialsFitOnScreen
      ? removalMaterialOptions
      : removalMaterialOptions.slice(0, 4);
  const hangStillOpen = Boolean(garageAssistant?.hangQuestion) && !hangChoice;
  const clarificationAnswered = hangStillOpen
    ? false
    : clarification?.id === 'shower'
      ? showerRemovalPieces.length > 0 || Boolean(showerRemovalSelected)
      : Boolean(scopeFoundSelected) ||
        (scopeFoundPieces.length > 0 &&
          extentFollowUps.every(followUp =>
            remodelExtentAnswered(scopeFoundPieces, followUp.parentId)
          ));
  const clarificationOpen =
    Boolean(clarification) &&
    !clarificationAnswered &&
    Boolean(viewModel?.needsScopeConfirmation);
  const settledHvacCount =
    garageAssistant && /\bgarage\b/i.test(String(draft?.originalNotes || ''))
      ? (viewModel?.confirmBuckets.pricingScope || []).filter(
          item => item.trim().toLowerCase() === 'hvac is not in this bid'
        ).length
      : 0;
  const openAttentionItems = (viewModel?.confirmBuckets.pricingScope || []).filter(
    item => settledHvacCount === 0 || item.trim().toLowerCase() !== 'hvac is not in this bid'
  );
  const visiblePricingItems = confirmListExpanded
    ? openAttentionItems
    : openAttentionItems.slice(0, PRICING_PREVIEW_COUNT);
  const hiddenPricingCount = Math.max(
    0,
    openAttentionItems.length - visiblePricingItems.length
  );
  const status =
    draft && viewModel
      ? getInitialRevealStatusLabel(
          draft,
          initialRevealStatusAttentionCount(
            Math.max(0, viewModel.attentionCount - settledHvacCount),
            clarificationOpen
          )
        )
      : null;
  const scopeListRows = useMemo(() => {
    const confirmedLines =
      draft && initialRevealPricingVisible(draft)
        ? confirmedAppliedRevealLines(draft)
        : null;
    if (confirmedLines?.length) {
      return confirmedLines.map(row => ({ ...row, awaitingPrice: false }));
    }
    const preview = viewModel?.scopePreview ?? [];
    const added = [
      ...priceShowerRemovalRevealRows(
        draft,
        showerRemovalRevealLines(
          draft?.originalNotes,
          showerRemovalSelected,
          draft?.scopeMeasurements?.showerWallTileSqft,
          showerRemovalPieces
        )
      ),
      ...scopeFoundRevealLines(
        draft?.originalNotes,
        draft?.scopeMeasurements?.scopeFoundClarificationId,
        draft?.scopeMeasurements?.scopeFoundChoice,
        draft?.scopeMeasurements?.scopeFoundPieces,
        draft?.scopeMeasurements
      ),
    ].filter(
      row =>
        !preview.some(
          existing =>
            existing.name.trim().toLowerCase() === row.name.trim().toLowerCase()
        )
    );
    const addedNames = new Set(added.map(row => row.name.trim().toLowerCase()));
    const previewRows = preview.filter(row => {
      const name = row.name.trim().toLowerCase();
      if (addedNames.has(name)) return false;
      const card = ROOF_TEAR_OFF_CARDS.find(entry => entry.id === name);
      return !card || !addedNames.has(card.label.trim().toLowerCase());
    });
    const amounts = draft ? initialRevealAmountsByName(draft) : new Map();
    const claimed = new Set<string>();
    for (const row of preview) {
      if (!(row.amount > 0)) continue;
      const hit = amounts.get(row.name.trim().toLowerCase());
      if (hit) claimed.add(hit.id);
    }
    const fill = <T extends { name: string; amount: number }>(
      row: T,
      awaitingPrice: boolean
    ) => {
      if (row.amount > 0) return { ...row, awaitingPrice: false };
      const hit = amounts.get(row.name.trim().toLowerCase());
      if (!hit || claimed.has(hit.id) || !(hit.amount > 0)) {
        return { ...row, awaitingPrice };
      }
      claimed.add(hit.id);
      return { ...row, amount: hit.amount, awaitingPrice: false };
    };
    const rows = omitPricedPaintPlaceholders(
      [
        ...added.map(row => fill(row, true)),
        ...previewRows.map(row => fill(row, false)),
      ],
      Boolean(draft && initialRevealPricingVisible(draft))
    );
    if (hangChoice !== 'hang_only') return rows;
    return rows.map(row =>
      /hang\s*\/\s*finish/i.test(row.name)
        ? { ...row, name: row.name.replace(/hang\s*\/\s*finish/gi, 'hang') }
        : row
    );
  }, [
    viewModel,
    draft,
    draft?.originalNotes,
    draft?.scopeMeasurements?.showerWallTileSqft,
    draft?.scopeMeasurements?.scopeFoundClarificationId,
    draft?.scopeMeasurements?.scopeFoundChoice,
    draft?.scopeMeasurements?.scopeFoundPieces,
    showerRemovalPieces,
    showerRemovalSelected,
    hangChoice,
  ]);

  useEffect(() => {
    if (visible) {
      setActiveExtentId(null);
      setManualScope(false);
      setHangEditing(false);
      setScopeNote('');
      setScopeNoteFocused(false);
      setScopeNoteError('');
      setConfirmListExpanded(false);
      scopeDefaultAppliedRef.current = false;
      setDetailsExpanded(true);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || !viewModel || scopeDefaultAppliedRef.current) return;
    scopeDefaultAppliedRef.current = true;
    if (viewModel.defaultScopeExpanded) {
      setDetailsExpanded(true);
    }
  }, [visible, viewModel]);

  const flushShowerChoice = () => {
    onShowerRemovalChoice?.(showerChoiceRef.current);
  };

  const handleBack = useCallback(() => {
    flushShowerChoice();
    onBack();
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  }, [onBack, onShowerRemovalChoice]);

  const handlePrimary = useCallback(() => {
    if (viewModel?.needsScopeConfirmation && onConfirmScope) {
      if (!applyTypedScopeRef.current()) return;
      flushShowerChoice();
      onConfirmScope();
      return;
    }
    onOpenDetailedReview();
  }, [viewModel?.needsScopeConfirmation, onConfirmScope, onOpenDetailedReview, onShowerRemovalChoice]);

  const handleDetailed = useCallback(() => {
    onOpenDetailedReview();
  }, [onOpenDetailedReview]);

  const handleExpandConfirm = useCallback(() => {
    startTransition(() => setConfirmListExpanded(true));
  }, []);

  const handleCollapseConfirm = useCallback(() => {
    startTransition(() => setConfirmListExpanded(false));
  }, []);

  const handleToggleScope = useCallback(() => {
    startTransition(() => setDetailsExpanded((v) => !v));
  }, []);

  const tabBarClearance = embedded
    ? getEmbeddedAiFlowFooterBottomInset(insets.bottom)
    : Math.max(insets.bottom, 12);

  const scrollPaddingBottom = embedded ? 12 : tabBarClearance + 76;

  const primaryFooter = (
    <View
      style={[
        styles.footer,
        {
          paddingBottom: tabBarClearance,
          borderTopColor: darkMode ? 'rgba(255,255,255,0.06)' : Colors.line,
          backgroundColor: Colors.bg,
        },
      ]}
    >
      <ReliablePress
        disabled={!draft}
        onPress={handlePrimary}
        style={[
          styles.primaryBtn,
          { opacity: draft ? 1 : 0.55 },
        ]}
        accessibilityLabel={viewModel?.primaryCta ?? 'Continue'}
      >
        <Text style={styles.primaryBtnText}>{viewModel?.primaryCta ?? 'Continue'}</Text>
        <MaterialIcons
          name={viewModel?.needsScopeConfirmation ? 'chevron-right' : 'arrow-forward'}
          size={22}
          color="#050B13"
        />
      </ReliablePress>
    </View>
  );

  if (!visible) return null;

  const statusStyle = status ? STATUS_COLORS[status.tone] : STATUS_COLORS.mostly;

  const body = (
    <>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
      <View
        style={[
          styles.screen,
          { backgroundColor: Colors.bg },
          embedded ? { height: windowHeight } : null,
        ]}
      >
        <AIEstimateFlowHeader
          title={viewModel?.headerCopy.title ?? 'Initial estimate'}
          subtitle={viewModel?.headerCopy.subtitle ?? 'Quick summary before detailed review'}
          fromAssistant={fromAssistant}
          onBack={handleBack}
        />

        <GestureScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollPaddingBottom }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          delayContentTouches={false}
        >
          {!viewModel ? (
            <Text style={{ color: Colors.sub, fontSize: 14 }}>No draft to show.</Text>
          ) : (
            <>
              <LinearGradient
                colors={darkMode ? HERO_GRADIENT_DARK : HERO_GRADIENT_LIGHT}
                start={BRAND_FRAME_GRADIENT_START}
                end={BRAND_FRAME_GRADIENT_END}
                style={[
                  styles.heroShell,
                  {
                    backgroundColor: darkMode ? HERO_BG_DARK : Colors.bg,
                    borderWidth: 1,
                    borderColor: darkMode ? 'rgba(148, 163, 184, 0.12)' : Colors.line,
                  },
                ]}
              >
                <View style={styles.heroTopRow}>
                  <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: statusStyle.color }]}>
                      {status?.label}
                    </Text>
                  </View>
                  <Text style={[styles.metaText, { color: Colors.sub }]}>
                    {viewModel.needsScopeConfirmation ||
                    scopeListRows.length !== (viewModel.scopePreview?.length || 0)
                      ? getInitialRevealScopeMetaLabel(scopeListRows.length, {
                          planLines: viewModel.planLines,
                        })
                      : viewModel.scopeMetaLabel}
                  </Text>
                </View>

                <Text style={[styles.projectTitle, { color: Colors.text }]} numberOfLines={2}>
                  {hangChoice === 'hang_only'
                    ? viewModel.displayTitle.replace(/hang\s*\/\s*finish/gi, 'hang')
                    : viewModel.displayTitle}
                </Text>
                {viewModel.tagline ? (
                  <Text style={[styles.tagline, { color: Colors.sub }]} numberOfLines={2}>
                    {viewModel.tagline}
                  </Text>
                ) : null}

                {viewModel.hero.hasAmount ? (
                  <AnimatedNumberText
                    style={[
                      styles.heroTotal,
                      { color: brandAccent, fontSize: 44 },
                    ]}
                    duration={900}
                    value={viewModel.hero.amountText}
                  />
                ) : null}
                <Text
                  style={[
                    styles.heroHint,
                    { color: Colors.sub },
                    !viewModel.hero.hasAmount && { marginTop: 14 },
                  ]}
                >
                  {viewModel.hero.hint}
                </Text>
                {viewModel.hero.markupSubline ? (
                  <Text style={[styles.heroMarkupSubline, { color: Colors.sub }]}>
                    {viewModel.hero.markupSubline}
                  </Text>
                ) : null}
                {viewModel.planningDisclaimer ? (
                  <Text style={[styles.planningDisclaimer, { color: Colors.sub }]}>
                    {viewModel.planningDisclaimer}
                  </Text>
                ) : null}
                {viewModel.totalCoverageLine ? (
                  <Text style={[styles.planningDisclaimer, { color: Colors.sub }]}>
                    {viewModel.totalCoverageLine}
                  </Text>
                ) : null}

                {viewModel.hero.hasAmount &&
                (viewModel.totals.material != null ||
                  viewModel.totals.labor != null ||
                  viewModel.totals.allowance != null) ? (
                  <View style={styles.statsRow}>
                    {viewModel.totals.material != null ? (
                      <StatChip
                        label="Materials"
                        value={formatPlanningMoney(viewModel.totals.material)}
                        darkMode={darkMode}
                        Colors={Colors}
                      />
                    ) : null}
                    {viewModel.totals.labor != null ? (
                      <StatChip
                        label="Labor"
                        value={formatPlanningMoney(viewModel.totals.labor)}
                        darkMode={darkMode}
                        Colors={Colors}
                      />
                    ) : null}
                    {viewModel.totals.allowance != null ? (
                      <StatChip
                        label="Allowances"
                        value={formatPlanningMoney(viewModel.totals.allowance)}
                        darkMode={darkMode}
                        Colors={Colors}
                      />
                    ) : null}
                  </View>
                ) : null}
              </LinearGradient>

              {!viewModel.needsScopeConfirmation ? (
                <ReliablePress
                  onPress={handleDetailed}
                  style={styles.detailedReviewLink}
                  accessibilityLabel="View estimate details"
                >
                  <Text style={[styles.detailedReviewLinkText, { color: brandAccent }]}>
                    View estimate details
                  </Text>
                  <MaterialIcons name="arrow-forward" size={16} color={brandAccent} />
                </ReliablePress>
              ) : null}

              <View
                style={[
                  styles.contentCard,
                  flowCardStyle,
                  { padding: 0, backgroundColor: flowCardBg },
                ]}
              >
                {viewModel.showWhatWeFound ? (
                  <View style={styles.block}>
                    <Text style={[styles.blockTitle, { color: Colors.text }]}>What we found</Text>
                    {viewModel.understood.map(line => (
                      <Text key={line} style={[styles.bodyLine, { color: Colors.sub }]}>
                        {line}
                      </Text>
                    ))}
                  </View>
                ) : null}

                {visiblePricingItems.length > 0 ? (
                  <View
                    style={[
                      styles.block,
                      viewModel.showWhatWeFound && styles.blockBorder,
                      { borderTopColor: dividerColor },
                    ]}
                  >
                    <View style={styles.blockTitleRow}>
                      <Text style={[styles.blockTitle, { color: Colors.text }]}>
                        {viewModel.attentionTitle}
                      </Text>
                      {openAttentionItems.length > 0 ? (
                        <View style={[styles.countPill, { backgroundColor: 'rgba(251, 191, 36, 0.14)' }]}>
                          <Text style={styles.countPillText}>{openAttentionItems.length}</Text>
                        </View>
                      ) : null}
                    </View>
                    {visiblePricingItems.map((item, index) => (
                      <View key={`${item}-${index}`} style={styles.checkRow}>
                        <View style={styles.pendingDot} />
                        <Text style={[styles.checkText, { color: Colors.text }]} numberOfLines={2}>
                          {item.replace(/^Price needed for /i, '')}
                        </Text>
                      </View>
                    ))}
                    {!confirmListExpanded && hiddenPricingCount > 0 ? (
                      <ReliablePress
                        onPress={handleExpandConfirm}
                        style={styles.moreLink}
                        accessibilityLabel={`Show ${hiddenPricingCount} more pricing items`}
                      >
                        <Text style={[styles.moreLinkText, { color: brandAccent }]}>
                          +{hiddenPricingCount} more
                        </Text>
                      </ReliablePress>
                    ) : null}
                    {confirmListExpanded &&
                    openAttentionItems.length > PRICING_PREVIEW_COUNT ? (
                      <ReliablePress
                        onPress={handleCollapseConfirm}
                        style={styles.moreLink}
                        accessibilityLabel="Show fewer pricing items"
                      >
                        <Text style={[styles.moreLinkText, { color: Colors.sub, fontWeight: '600' }]}>
                          Show less
                        </Text>
                      </ReliablePress>
                    ) : null}
                  </View>
                ) : null}

                {clarification && viewModel.needsScopeConfirmation ? (
                  <View
                    style={[
                      styles.block,
                      (viewModel.showWhatWeFound || visiblePricingItems.length > 0) &&
                        styles.blockBorder,
                      { borderTopColor: dividerColor },
                    ]}
                  >
                    <View style={styles.blockTitleRow}>
                      <Text
                        style={[
                          styles.blockTitle,
                          { color: clarificationAnswered ? brandAccent : Colors.text },
                        ]}
                      >
                        {clarificationAnswered ? 'Confirmed' : '1 thing to confirm'}
                      </Text>
                      {clarificationAnswered ? (
                        <MaterialIcons name="check-circle" size={16} color={brandAccent} />
                      ) : (
                        <View style={[styles.countPill, { backgroundColor: 'rgba(251, 191, 36, 0.14)' }]}>
                          <Text style={styles.countPillText}>1</Text>
                        </View>
                      )}
                    </View>
                    {garageAssistant ? (
                      <>
                        {garageAssistant.hangQuestion ? (
                          <>
                            {hangChoice && !hangEditing ? (
                              <View style={styles.hangSummaryRow}>
                                <MaterialIcons name="check-circle" size={18} color={brandAccent} />
                                <View style={styles.hangSummaryCopy}>
                                  <Text style={[styles.hangSummaryTitle, { color: Colors.text }]}>
                                    {hangChoice === 'hang_only'
                                      ? 'Drywall · Hang'
                                      : hangChoice === 'unsure'
                                        ? 'Drywall · Not sure yet'
                                        : 'Drywall · Hang and finish'}
                                  </Text>
                                  {scopeListRows.find(row => /drywall/i.test(row.name))?.quantity ? (
                                    <Text style={[styles.hangSummaryDetail, { color: Colors.sub }]}>
                                      {scopeListRows.find(row => /drywall/i.test(row.name))?.quantity}{' '}
                                      confirmed
                                    </Text>
                                  ) : null}
                                </View>
                                <ReliablePress
                                  onPress={() => setHangEditing(true)}
                                  accessibilityLabel="Edit drywall finish"
                                >
                                  <Text style={[styles.hangEdit, { color: brandAccent }]}>Edit</Text>
                                </ReliablePress>
                              </View>
                            ) : (
                              <>
                            <View style={[styles.checkRow, styles.assistantQuestion]}>
                              {hangChoice ? null : <View style={styles.pendingDot} />}
                              <Text style={[styles.checkText, { color: Colors.text }]}>
                                {garageAssistant.hangQuestion}
                              </Text>
                            </View>
                            {scopeFoundChipRows([
                              { id: 'hang_only' as const, label: 'Hang only' },
                              { id: 'hang_and_finish' as const, label: 'Hang and finish' },
                              { id: 'unsure' as const, label: 'Not sure yet' },
                            ]).map(row => (
                              <View
                                key={`hang-${row.map(option => option.id).join('-')}`}
                                style={[
                                  styles.removalChipRow,
                                  styles.assistantChipRow,
                                  row.length === 1 ? styles.hangSingleRow : null,
                                ]}
                              >
                                {row.map(option => {
                                  const selected = hangChoice === option.id;
                                  return (
                                    <GestureTouchableOpacity
                                      key={option.id}
                                      onPress={() => {
                                        applyGaragePieces(
                                          withGarageDrywallHangChoice(
                                            scopeFoundPiecesRef.current,
                                            option.id
                                          )
                                        );
                                        setHangEditing(false);
                                      }}
                                      accessibilityRole="button"
                                      accessibilityState={{ selected }}
                                      containerStyle={
                                        row.length === 1
                                          ? styles.hangSingleChip
                                          : styles.removalChipCell
                                      }
                                      style={[
                                        styles.removalChip,
                                        {
                                          borderColor: selected
                                            ? brandAccent
                                            : 'rgba(148, 163, 184, 0.16)',
                                          backgroundColor: selected
                                            ? 'rgba(45, 204, 154, 0.14)'
                                            : 'rgba(148, 163, 184, 0.16)',
                                        },
                                      ]}
                                    >
                                      {selected ? (
                                        <MaterialIcons name="check" size={15} color={brandAccent} />
                                      ) : null}
                                      <Text
                                        numberOfLines={2}
                                        style={[styles.removalChipText, { color: Colors.text }]}
                                      >
                                        {option.label}
                                      </Text>
                                    </GestureTouchableOpacity>
                                  );
                                })}
                              </View>
                            ))}
                              </>
                            )}
                          </>
                        ) : null}
                        <View style={[styles.checkRow, styles.assistantBlock]}>
                          <Text style={[styles.checkText, { color: Colors.text }]}>
                            Anything else included?
                          </Text>
                        </View>
                        <Text style={[styles.bodyLine, styles.assistantHelp, { color: Colors.sub }]}>
                          {garageAssistant.intro}
                        </Text>
                        {scopeFoundChipRows(
                          manualScope
                            ? [...garageAssistant.suggestions, ...garageAssistant.more]
                            : garageAssistant.suggestions
                        ).map(row => (
                          <View
                            key={`suggest-${row.map(option => option.id).join('-')}`}
                            style={[styles.removalChipRow, styles.assistantChipRow]}
                          >
                            {row.map(option => {
                              const selected = scopeFoundPieces.includes(option.id);
                              return (
                                <GestureTouchableOpacity
                                  key={option.id}
                                  onPress={() =>
                                    applyGaragePieces(
                                      toggleGarageSuggestionPiece(
                                        scopeFoundPiecesRef.current,
                                        option.id
                                      )
                                    )
                                  }
                                  accessibilityRole="button"
                                  accessibilityState={{ selected }}
                                  containerStyle={styles.removalChipCell}
                                  style={[
                                    styles.removalChip,
                                    {
                                      borderColor: selected
                                        ? brandAccent
                                        : 'rgba(148, 163, 184, 0.16)',
                                      backgroundColor: selected
                                        ? 'rgba(45, 204, 154, 0.14)'
                                        : 'rgba(148, 163, 184, 0.16)',
                                    },
                                  ]}
                                >
                                  {selected ? (
                                    <MaterialIcons name="check" size={15} color={brandAccent} />
                                  ) : null}
                                  <Text
                                    numberOfLines={2}
                                    style={[styles.removalChipText, { color: Colors.text }]}
                                  >
                                    {option.label}
                                  </Text>
                                </GestureTouchableOpacity>
                              );
                            })}
                          </View>
                        ))}
                        {garageAssistant.more.length > 0 ? (
                          <ReliablePress
                            onPress={() => setManualScope(value => !value)}
                            style={styles.expandList}
                            accessibilityLabel={manualScope ? 'Show less' : 'Expand list'}
                          >
                            <Text style={[styles.expandListText, { color: Colors.sub }]}>
                              {manualScope ? 'Show less' : 'Expand list'}
                            </Text>
                            <MaterialIcons
                              name={manualScope ? 'expand-less' : 'expand-more'}
                              size={18}
                              color={Colors.sub}
                            />
                          </ReliablePress>
                        ) : null}
                        <View
                          style={[
                            styles.assistantField,
                            {
                              borderColor: scopeNoteFocused ? brandAccent : assistantControlBorder,
                              backgroundColor: assistantControlBg,
                            },
                          ]}
                        >
                          <GestureTouchableOpacity
                            onPress={() => scopeNoteRef.current?.focus()}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            accessibilityLabel="Type to add work"
                          >
                            <MaterialIcons
                              name="edit"
                              size={18}
                              color={scopeNoteFocused ? brandAccent : Colors.sub}
                            />
                          </GestureTouchableOpacity>
                          <TextInput
                            ref={scopeNoteRef}
                            value={scopeNote}
                            onChangeText={value => {
                              setScopeNote(value);
                              if (scopeNoteError) setScopeNoteError('');
                            }}
                            onFocus={() => setScopeNoteFocused(true)}
                            onBlur={() => setScopeNoteFocused(false)}
                            placeholder="Type to add, e.g. 6 outlets"
                            placeholderTextColor={
                              darkMode ? 'rgba(255,255,255,0.55)' : 'rgba(15,23,42,0.45)'
                            }
                            style={[styles.assistantInput, { color: Colors.text }]}
                            onSubmitEditing={() => {
                              applyTypedScope();
                            }}
                          {...resolveTextInputKeyboardProps()}
                          />
                        </View>
                        {scopeNoteError ? (
                          <Text style={[styles.bodyLine, { color: '#fbbf24' }]}>{scopeNoteError}</Text>
                        ) : null}
                        <ReliablePress
                          onPress={() => {
                            applyTypedScope();
                          }}
                          style={styles.assistantAddLink}
                          accessibilityLabel="Add to scope"
                        >
                          <Text style={[styles.extentLinkText, { color: brandAccent }]}>
                            Add to scope
                          </Text>
                        </ReliablePress>
                        <ReliablePress
                          onPress={() =>
                            applyGaragePieces(garageNoAdditionalWork(scopeFoundPiecesRef.current))
                          }
                          accessibilityLabel="No additional work"
                        >
                          <Text
                            style={[
                              styles.checkText,
                              styles.assistantDecline,
                              {
                                color: scopeFoundPieces.includes('garage_no_additional_work')
                                  ? brandAccent
                                  : Colors.sub,
                              },
                            ]}
                          >
                            {scopeFoundPieces.includes('garage_no_additional_work')
                              ? 'No additional work'
                              : 'No additional work'}
                          </Text>
                        </ReliablePress>
                      </>
                    ) : (
                      <>
                    <View style={styles.checkRow}>
                      {clarificationAnswered ? null : <View style={styles.pendingDot} />}
                      <Text style={[styles.checkText, { color: Colors.text }]}>
                        {clarification.question}
                      </Text>
                    </View>
                    {packChipRows(
                      visibleRemovalMaterials,
                      removalMaterialColumns(visibleRemovalMaterials)
                    )
                      .concat(
                        scopeFoundChipRows(
                          clarification.options.filter(
                            option => option.id === 'none' || option.id === 'unsure'
                          )
                        )
                      )
                      .map(row => (
                      <View
                        key={`removal-row-${row.map(option => option.id).join('-')}`}
                        style={[styles.removalChipRow, styles.removalMaterialGridRow]}
                      >
                        {row.map(option => {
                          const exclusive =
                            option.id === 'none' || option.id === 'unsure';
                          const selected =
                            clarification.id === 'shower'
                              ? exclusive
                                ? showerRemovalSelected === option.id
                                : showerRemovalPieces.includes(option.id as ShowerRemovalPiece)
                              : clarification.multi
                                ? exclusive
                                  ? scopeFoundSelected === option.id
                                  : scopeFoundPieces.includes(option.id)
                                : scopeFoundSelected === option.id;
                          return (
                            <GestureTouchableOpacity
                              key={option.id}
                              onPressIn={() => {
                                if (clarification.id === 'shower') {
                                  if (option.id === 'none' || option.id === 'unsure') {
                                    setShowerPiecesLive([]);
                                    setShowerDeclinedLive(option.id);
                                    return;
                                  }
                                  const piece = option.id as ShowerRemovalPiece;
                                  setShowerDeclinedLive(null);
                                  setShowerPiecesLive(current =>
                                    current.includes(piece)
                                      ? current.filter(item => item !== piece)
                                      : [...current, piece]
                                  );
                                  return;
                                }
                                if (clarification.multi) {
                                  if (exclusive) {
                                    scopeFoundPiecesRef.current = [];
                                    const choice = readScopeFoundChoice(option.id);
                                    if (choice) onScopeFoundChoice?.(clarification.id, choice);
                                    return;
                                  }
                                  const next = toggleRemodelScopePiece(
                                    scopeFoundPiecesRef.current,
                                    option.id
                                  );
                                  if (next.includes(option.id)) setActiveExtentId(option.id);
                                  scopeFoundPiecesRef.current = next;
                                  onScopeFoundChoice?.(clarification.id, next);
                                  return;
                                }
                                const choice = readScopeFoundChoice(option.id);
                                if (choice) onScopeFoundChoice?.(clarification.id, choice);
                              }}
                              accessibilityRole="button"
                              accessibilityState={{ selected }}
                              containerStyle={styles.removalChipCell}
                              style={[
                                styles.removalChip,
                                {
                                  borderColor: selected
                                    ? brandAccent
                                    : 'rgba(148, 163, 184, 0.16)',
                                  backgroundColor: selected
                                    ? 'rgba(45, 204, 154, 0.14)'
                                    : exclusive
                                      ? 'rgba(148, 163, 184, 0.11)'
                                      : 'rgba(148, 163, 184, 0.16)',
                                },
                              ]}
                            >
                              {selected ? (
                                <MaterialIcons name="check" size={15} color={brandAccent} />
                              ) : null}
                              <Text
                                numberOfLines={2}
                                style={[
                                  styles.removalChipText,
                                  {
                                    color: selected
                                      ? Colors.text
                                      : exclusive
                                        ? Colors.sub
                                        : Colors.text,
                                  },
                                ]}
                              >
                                {option.label}
                              </Text>
                            </GestureTouchableOpacity>
                          );
                        })}
                      </View>
                    ))}
                    {removalMaterialsFitOnScreen ? null : (
                      <ReliablePress
                        onPress={() => setManualScope(value => !value)}
                        style={styles.expandList}
                        accessibilityLabel={manualScope ? 'Show less' : 'Expand list'}
                      >
                        <Text style={[styles.expandListText, { color: Colors.sub }]}>
                          {manualScope ? 'Show less' : 'Expand list'}
                        </Text>
                        <MaterialIcons
                          name={manualScope ? 'expand-less' : 'expand-more'}
                          size={18}
                          color={Colors.sub}
                        />
                      </ReliablePress>
                    )}
                    <View
                      style={[
                        styles.assistantField,
                        {
                          borderColor: scopeNoteFocused ? brandAccent : assistantControlBorder,
                          backgroundColor: assistantControlBg,
                        },
                      ]}
                    >
                      <GestureTouchableOpacity
                        onPress={() => scopeNoteRef.current?.focus()}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel="Type to add work"
                      >
                        <MaterialIcons
                          name="edit"
                          size={18}
                          color={scopeNoteFocused ? brandAccent : Colors.sub}
                        />
                      </GestureTouchableOpacity>
                      <TextInput
                        ref={scopeNoteRef}
                        value={scopeNote}
                        onChangeText={value => {
                          setScopeNote(value);
                          if (scopeNoteError) setScopeNoteError('');
                        }}
                        onFocus={() => setScopeNoteFocused(true)}
                        onBlur={() => setScopeNoteFocused(false)}
                        placeholder="Type to add, e.g. 6 outlets"
                        placeholderTextColor={
                          darkMode ? 'rgba(255,255,255,0.55)' : 'rgba(15,23,42,0.45)'
                        }
                        style={[styles.assistantInput, { color: Colors.text }]}
                        onSubmitEditing={() => {
                          applyTypedScope();
                        }}
                        {...resolveTextInputKeyboardProps()}
                      />
                    </View>
                    {scopeNoteError ? (
                      <Text style={[styles.bodyLine, { color: '#fbbf24' }]}>{scopeNoteError}</Text>
                    ) : null}
                    <ReliablePress
                      onPress={() => {
                        applyTypedScope();
                      }}
                      style={styles.assistantAddLink}
                      accessibilityLabel="Add to scope"
                    >
                      <Text style={[styles.extentLinkText, { color: brandAccent }]}>
                        Add to scope
                      </Text>
                    </ReliablePress>
                    {clarification.id === 'remodel_remainder'
                      ? extentFollowUps.map(followUp => {
                          const answered = remodelExtentAnswered(
                            scopeFoundPieces,
                            followUp.parentId
                          );
                          const declines = followUp.declines;
                          const declineIds = new Set(declines.map(option => option.id));
                          if (answered && activeExtentId !== followUp.parentId) {
                            return (
                              <View
                                key={followUp.parentId}
                                style={[styles.extentFollowUp, styles.extentSummaryRow]}
                              >
                                <Text
                                  style={[
                                    styles.checkText,
                                    styles.extentSummaryText,
                                    { color: Colors.text },
                                  ]}
                                  numberOfLines={2}
                                >
                                  {followUp.label} ·{' '}
                                  {remodelExtentSummary(scopeFoundPieces, followUp.parentId)}
                                </Text>
                                <ReliablePress
                                  onPress={() => setActiveExtentId(followUp.parentId)}
                                  accessibilityLabel={`Edit ${followUp.label}`}
                                >
                                  <Text style={[styles.extentLinkText, { color: brandAccent }]}>
                                    Edit
                                  </Text>
                                </ReliablePress>
                              </View>
                            );
                          }
                          return (
                            <View key={followUp.parentId} style={styles.extentFollowUp}>
                              <View style={styles.checkRow}>
                                {answered ? null : <View style={styles.pendingDot} />}
                                <Text style={[styles.checkText, { color: Colors.text }]}>
                                  {followUp.question}
                                </Text>
                              </View>
                              {scopeFoundChipRows([...followUp.options, ...declines]).map(row => (
                                  <View
                                    key={`${followUp.parentId}-${row.map(option => option.id).join('-')}`}
                                    style={styles.removalChipRow}
                                  >
                                    {row.map(option => {
                                      const exclusive = declineIds.has(option.id);
                                      const selected = scopeFoundPieces.includes(option.id);
                                      return (
                                        <GestureTouchableOpacity
                                          key={option.id}
                                          onPress={() => {
                                            const next = exclusive
                                              ? declineRemodelExtent(
                                                  scopeFoundPiecesRef.current,
                                                  followUp.parentId,
                                                  option.id
                                                )
                                              : toggleRemodelExtentPiece(
                                                  scopeFoundPiecesRef.current,
                                                  option.id
                                                );
                                            setActiveExtentId(
                                              exclusive ? null : followUp.parentId
                                            );
                                            scopeFoundPiecesRef.current = next;
                                            onScopeFoundChoice?.(clarification.id, next);
                                          }}
                                          accessibilityRole="button"
                                          accessibilityState={{ selected }}
                                          containerStyle={styles.removalChipCell}
                                          style={[
                                            styles.removalChip,
                                            {
                                              borderColor: selected
                                                ? brandAccent
                                                : 'rgba(148, 163, 184, 0.16)',
                                              backgroundColor: selected
                                                ? 'rgba(45, 204, 154, 0.14)'
                                                : exclusive
                                                  ? 'rgba(148, 163, 184, 0.11)'
                                                  : 'rgba(148, 163, 184, 0.16)',
                                            },
                                          ]}
                                        >
                                          {selected ? (
                                            <MaterialIcons
                                              name="check"
                                              size={15}
                                              color={brandAccent}
                                            />
                                          ) : null}
                                          <Text
                                            numberOfLines={2}
                                            style={[
                                              styles.removalChipText,
                                              {
                                                color: selected
                                                  ? Colors.text
                                                  : exclusive
                                                    ? Colors.sub
                                                    : Colors.text,
                                              },
                                            ]}
                                          >
                                            {option.label}
                                          </Text>
                                        </GestureTouchableOpacity>
                                      );
                                    })}
                                  </View>
                                ))}
                              {answered ? (
                                <ReliablePress
                                  onPress={() => setActiveExtentId(null)}
                                  style={styles.extentDone}
                                  accessibilityLabel={`Done with ${followUp.label}`}
                                >
                                  <Text style={[styles.extentLinkText, { color: brandAccent }]}>
                                    Done
                                  </Text>
                                </ReliablePress>
                              ) : null}
                            </View>
                          );
                        })
                      : null}
                      </>
                    )}
                  </View>
                ) : null}

                {showManualScopeAdd ? (
                  <View
                    style={[
                      styles.block,
                      (viewModel.showWhatWeFound || visiblePricingItems.length > 0) &&
                        styles.blockBorder,
                      { borderTopColor: dividerColor },
                    ]}
                  >
                    <Text style={[styles.blockTitle, { color: Colors.text }]}>
                      Anything the note left out?
                    </Text>
                    <Text style={[styles.bodyLine, styles.assistantHelp, { color: Colors.sub }]}>
                      Add any other work for this job.
                    </Text>
                    {notesOfferFramingSheathingChip(draft?.originalNotes) ? (
                      <View style={[styles.removalChipRow, styles.assistantChipRow]}>
                        <GestureTouchableOpacity
                          onPress={() => {
                            const current = scopeFoundPiecesRef.current;
                            const selected = current.includes(FRAMING_SHEATHING_PIECE);
                            const next = selected
                              ? current.filter(id => id !== FRAMING_SHEATHING_PIECE)
                              : [...current, FRAMING_SHEATHING_PIECE];
                            scopeFoundPiecesRef.current = next;
                            onScopeFoundChoice?.(
                              'remodel_remainder',
                              next.length ? next : 'none'
                            );
                          }}
                          accessibilityRole="button"
                          accessibilityLabel="Sheathing"
                          accessibilityState={{
                            selected: scopeFoundPieces.includes(FRAMING_SHEATHING_PIECE),
                          }}
                          containerStyle={styles.sheathingChip}
                          style={[
                            styles.removalChip,
                            {
                              borderColor: scopeFoundPieces.includes(FRAMING_SHEATHING_PIECE)
                                ? brandAccent
                                : 'rgba(148, 163, 184, 0.16)',
                              backgroundColor: scopeFoundPieces.includes(
                                FRAMING_SHEATHING_PIECE
                              )
                                ? 'rgba(45, 204, 154, 0.14)'
                                : 'rgba(148, 163, 184, 0.16)',
                            },
                          ]}
                        >
                          {scopeFoundPieces.includes(FRAMING_SHEATHING_PIECE) ? (
                            <MaterialIcons name="check" size={15} color={brandAccent} />
                          ) : null}
                          <Text
                            numberOfLines={1}
                            style={[styles.removalChipText, { color: Colors.text }]}
                          >
                            Sheathing
                          </Text>
                        </GestureTouchableOpacity>
                      </View>
                    ) : null}
                    <View
                      style={[
                        styles.assistantField,
                        styles.manualScopeField,
                        {
                          borderColor: scopeNoteFocused ? brandAccent : assistantControlBorder,
                          backgroundColor: assistantControlBg,
                        },
                      ]}
                    >
                      <GestureTouchableOpacity
                        onPress={() => scopeNoteRef.current?.focus()}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel="Type to add work"
                      >
                        <MaterialIcons
                          name="edit"
                          size={18}
                          color={scopeNoteFocused ? brandAccent : Colors.sub}
                        />
                      </GestureTouchableOpacity>
                      <TextInput
                        ref={scopeNoteRef}
                        value={scopeNote}
                        onChangeText={value => {
                          setScopeNote(value);
                          if (scopeNoteError) setScopeNoteError('');
                        }}
                        onFocus={() => setScopeNoteFocused(true)}
                        onBlur={() => setScopeNoteFocused(false)}
                        placeholder="Type to add, e.g. 6 outlets"
                        placeholderTextColor={
                          darkMode ? 'rgba(255,255,255,0.55)' : 'rgba(15,23,42,0.45)'
                        }
                        style={[styles.assistantInput, { color: Colors.text }]}
                        onSubmitEditing={() => {
                          applyTypedScope();
                        }}
                        {...resolveTextInputKeyboardProps()}
                      />
                    </View>
                    {scopeNoteError ? (
                      <Text style={[styles.bodyLine, { color: '#fbbf24' }]}>{scopeNoteError}</Text>
                    ) : null}
                    <ReliablePress
                      onPress={() => {
                        applyTypedScope();
                      }}
                      style={styles.assistantAddLink}
                      accessibilityLabel="Add to scope"
                    >
                      <Text style={[styles.extentLinkText, { color: brandAccent }]}>
                        Add to scope
                      </Text>
                    </ReliablePress>
                  </View>
                ) : null}

                {scopeListRows.length > 0 ? (
                  <View
                    style={[
                      styles.block,
                      styles.blockBorder,
                      { borderTopColor: dividerColor },
                    ]}
                  >
                    <ReliablePress
                      onPress={handleToggleScope}
                      style={styles.scopeHeader}
                      accessibilityLabel="Scope items"
                      accessibilityState={{ expanded: detailsExpanded }}
                    >
                      <Text style={[styles.blockTitle, { color: Colors.text }]}>
                        Scope · {(() => {
                          const scopeCount =
                            viewModel.needsScopeConfirmation ||
                            scopeListRows.length !== (viewModel.scopePreview?.length || 0)
                              ? scopeListRows.length
                              : viewModel.totals.scopeItemCount ||
                                scopeListRows.length;
                          const noun = viewModel.planLines
                            ? scopeCount === 1
                              ? 'plan line'
                              : 'plan lines'
                            : scopeCount === 1
                              ? 'item'
                              : 'items';
                          return `${scopeCount} ${noun}`;
                        })()}
                      </Text>
                      <MaterialIcons
                        name={detailsExpanded ? 'expand-less' : 'expand-more'}
                        size={22}
                        color={Colors.sub}
                      />
                    </ReliablePress>
                    {detailsExpanded
                      ? scopeListRows.map(({ name, amount, quantity, awaitingPrice }, index) => (
                        <View key={`${name}-${index}`} style={styles.scopeRow}>
                            <View style={styles.scopeNameWrap}>
                              <Text style={[styles.scopeName, { color: Colors.text }]} numberOfLines={2}>
                                {name}
                                {quantity
                                  ? ` · ${
                                      quantity === 'Not sure'
                                        ? 'Count on the next step'
                                        : quantity
                                    }`
                                  : ''}
                              </Text>
                            </View>
                            {!viewModel.suppressRevealPricing &&
                            (amount > 0 ||
                              awaitingPrice ||
                              !(
                                viewModel.totals.heroTotal != null &&
                                viewModel.totals.heroTotal > 0
                              )) ? (
                              <View style={styles.scopeAmountWrap}>
                                {amount <= 0 ? (
                                  <View style={styles.needsPricePill}>
                                    <Text style={styles.needsPricePillText}>Needs price</Text>
                                  </View>
                                ) : null}
                                <Text
                                  style={[
                                    styles.scopeAmount,
                                    { color: amount > 0 ? brandAccent : Colors.sub },
                                  ]}
                                >
                                  {amount > 0 ? formatPlanningMoney(amount) : '—'}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        ))
                      : null}
                  </View>
                ) : null}
              </View>
            </>
          )}
        </GestureScrollView>

        {primaryFooter}
      </View>
    </>
  );

  if (embedded) {
    return (
      <View
        style={[
          StyleSheet.absoluteFillObject,
          styles.embeddedShell,
          { backgroundColor: Colors.bg },
        ]}
      >
        {body}
        <TabScreenBottomScrollFade />
      </View>
    );
  }

  return (
    <Modal visible animationType="none" presentationStyle="fullScreen" onRequestClose={handleBack}>
      {body}
    </Modal>
  );
}

function StatChip({
  label,
  value,
  darkMode,
  Colors,
}: {
  label: string;
  value: string;
  darkMode: boolean;
  Colors: { text: string; sub: string };
}) {
  return (
    <View
      style={[
        styles.statChip,
        { backgroundColor: darkMode ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.7)' },
      ]}
    >
      <Text style={[styles.statLabel, { color: Colors.sub }]}>{label}</Text>
      <Text style={[styles.statValue, { color: Colors.text }]}>{value}</Text>
    </View>
  );
}

export default memo(AIEstimateInitialRevealModal);

const styles = StyleSheet.create({
  embeddedShell: {
    zIndex: 110,
    elevation: 110,
  },
  screen: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  pressed: {
    opacity: 0.72,
  },
  heroShell: {
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    overflow: 'hidden',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '600',
  },
  projectTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
    lineHeight: 28,
  },
  tagline: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
    fontWeight: '500',
  },
  heroTotal: {
    fontWeight: '900',
    letterSpacing: -1,
    marginTop: 14,
  },
  heroHint: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  heroMarkupSubline: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    opacity: 0.85,
  },
  planningDisclaimer: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 6,
    lineHeight: 17,
    opacity: 0.88,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  statChip: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 96,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  detailedReviewLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 14,
    paddingVertical: 4,
  },
  detailedReviewLinkText: {
    fontSize: 14,
    fontWeight: '700',
  },
  contentCard: {
    overflow: 'hidden',
  },
  block: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  blockBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  blockTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  blockTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  countPill: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countPillText: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '800',
  },
  bodyLine: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  checkDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    marginTop: 2,
  },
  checkText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '500',
  },
  moreLink: {
    marginTop: 2,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  moreLinkText: {
    fontSize: 14,
    fontWeight: '700',
  },
  scopeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scopeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
  },
  scopeName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  scopeNameWrap: {
    flex: 1,
    minWidth: 0,
  },
  scopeAmountWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  needsPricePill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(251, 191, 36, 0.14)',
  },
  needsPricePillText: {
    color: '#fbbf24',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  scopeAmount: {
    fontSize: 14,
    fontWeight: '800',
  },
  pendingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#fbbf24',
    marginTop: 7,
  },
  extentFollowUp: {
    marginTop: 14,
  },
  extentSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  extentSummaryText: {
    flex: 1,
  },
  extentLinkText: {
    fontSize: 15,
    fontWeight: '600',
  },
  extentDone: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingVertical: 4,
  },
  removalChipRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
    marginBottom: 6,
  },
  removalMaterialGridRow: {
    gap: 8,
    marginBottom: 8,
  },
  removalChipCell: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
  },
  hangSingleRow: {
    justifyContent: 'center',
  },
  hangSingleChip: {
    width: '48%',
  },
  hangSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  hangSummaryCopy: {
    flex: 1,
    minWidth: 0,
  },
  hangSummaryTitle: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  hangSummaryDetail: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  hangEdit: {
    fontSize: 15,
    fontWeight: '700',
  },
  removalChip: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  removalChipText: {
    flexShrink: 1,
    minWidth: 0,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: FLOW_ACCENT,
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primaryBtnText: {
    color: '#050B13',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  assistantQuestion: {
    marginBottom: 14,
  },
  assistantBlock: {
    marginTop: 16,
  },
  assistantHelp: {
    marginTop: 2,
    marginBottom: 12,
  },
  assistantChipRow: {
    marginBottom: 10,
  },
  manualScopeField: {
    marginTop: 0,
  },
  sheathingChip: {
    alignSelf: 'flex-start',
  },
  assistantAddLink: {
    alignSelf: 'flex-start',
    marginTop: 14,
    paddingVertical: 6,
  },
  assistantDecline: {
    marginTop: 14,
  },
  assistantField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    marginTop: 16,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  assistantInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    paddingVertical: 12,
    minWidth: 0,
  },
  expandList: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
    marginBottom: 2,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  expandListText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
