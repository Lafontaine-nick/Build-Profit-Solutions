import React, { useCallback, useEffect, useMemo, useRef, useState, memo, startTransition } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  StatusBar,
  Platform,
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
import type { EstimateAiDraft } from '@/utils/estimateAiDraft';
import { formatDraftMoney } from '@/utils/estimateAiDraft';
import { getScopePackagesForReview } from '@/utils/scopePackagesForReview';
import { scopePackagePricedAmount } from '@/utils/estimateDraftReviewUi';
import {
  countInitialRevealAttentionItems,
  draftNeedsScopeConfirmation,
  getInitialRevealConfirmItems,
  getInitialRevealDisplayTitle,
  getInitialRevealHeroDisplay,
  getInitialRevealPlanningDisclaimer,
  getInitialRevealPrimaryCtaLabel,
  getInitialRevealScopeMetaLabel,
  getInitialRevealStatusLabel,
  getInitialRevealTagline,
  getInitialRevealTotals,
  getInitialRevealUnderstoodBullets,
  shouldDefaultExpandInitialRevealScope,
  shouldShowInitialRevealWhatWeFound,
} from '@/utils/estimateInitialRevealUi';
import { estimateFlowCardStyle, estimateFlowDividerColor, aiFlowCardBackground } from '@/utils/estimateFlowCardStyle';
import { BRAND_FRAME_GRADIENT_END, BRAND_FRAME_GRADIENT_START } from '@/constants/brandFrameGradient';

type Props = {
  visible: boolean;
  draft: EstimateAiDraft | null;
  markupPct?: number;
  fromAssistant?: boolean;
  onBack: () => void;
  onClose: () => void;
  onOpenDetailedReview: () => void;
  onConfirmScope?: () => void;
  onRegenerate: () => void;
};

const STATUS_COLORS = {
  ready: { bg: 'rgba(34, 197, 94, 0.14)', color: '#4ade80' },
  mostly: { bg: 'rgba(45, 255, 196, 0.1)', color: '#2DFFC4' },
  review: { bg: 'rgba(251, 191, 36, 0.12)', color: '#fbbf24' },
};

/** Muted teal→blue wash — same angle as back arrow, much lower opacity than the ring. */
const HERO_GRADIENT_DARK = ['rgba(45, 255, 196, 0.05)', 'rgba(0, 166, 255, 0.035)'] as const;
const HERO_GRADIENT_LIGHT = ['rgba(45, 255, 196, 0.07)', 'rgba(0, 166, 255, 0.04)'] as const;
const HERO_BG_DARK = '#0e141c';
/** Brand cyan — links, totals, secondary accents (blue end of back-arrow gradient). */
const BRAND_ACCENT = '#00A6FF';
const BRAND_ACCENT_LIGHT = '#0284c7';
/** Emerald — primary CTA only. */
const FLOW_ACCENT = '#22c55e';

function fireHaptic(style: Haptics.ImpactFeedbackStyle) {
  if (Platform.OS === 'web') return;
  void Haptics.impactAsync(style).catch(() => {});
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
  onBack,
  onClose,
  onOpenDetailedReview,
  onConfirmScope,
  onRegenerate,
}: Props) {
  const insets = useSafeAreaInsets();
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [confirmListExpanded, setConfirmListExpanded] = useState(false);
  const [bidDetailsExpanded, setBidDetailsExpanded] = useState(false);
  const scopeDefaultAppliedRef = useRef(false);

  const PRICING_PREVIEW_COUNT = 3;

  const viewModel = useMemo(() => {
    if (!draft) return null;

    const attentionCount = countInitialRevealAttentionItems(draft);
    const totals = getInitialRevealTotals(draft, markupPct);
    const needsScopeConfirmation = draftNeedsScopeConfirmation(draft);
    const confirmBuckets = getInitialRevealConfirmItems(draft);
    const tagline = getInitialRevealTagline(draft);
    const understood = getInitialRevealUnderstoodBullets(draft, 2);

    return {
      attentionCount,
      status: getInitialRevealStatusLabel(draft, attentionCount),
      totals,
      understood,
      confirmBuckets,
      showWhatWeFound: shouldShowInitialRevealWhatWeFound(understood, tagline),
      displayTitle: getInitialRevealDisplayTitle(draft),
      tagline,
      needsScopeConfirmation,
      primaryCta: getInitialRevealPrimaryCtaLabel(attentionCount, needsScopeConfirmation),
      hero: getInitialRevealHeroDisplay(totals, needsScopeConfirmation),
      scopeMetaLabel: getInitialRevealScopeMetaLabel(totals.scopeItemCount),
      planningDisclaimer: getInitialRevealPlanningDisclaimer(totals, attentionCount),
      defaultScopeExpanded: shouldDefaultExpandInitialRevealScope(totals.scopeItemCount),
      scopePreview: getScopePackagesForReview(draft).slice(0, 6).map((pkg) => {
        const name = String(pkg.name || pkg.scope || 'Scope item').trim();
        const amount = scopePackagePricedAmount(pkg, draft);
        return { name, amount };
      }),
    };
  }, [draft, markupPct]);

  const visiblePricingItems = viewModel
    ? confirmListExpanded
      ? viewModel.confirmBuckets.pricingScope
      : viewModel.confirmBuckets.pricingScope.slice(0, PRICING_PREVIEW_COUNT)
    : [];
  const hiddenPricingCount = viewModel
    ? Math.max(0, viewModel.confirmBuckets.pricingScope.length - visiblePricingItems.length)
    : 0;

  const brandAccent = darkMode ? BRAND_ACCENT : BRAND_ACCENT_LIGHT;
  const flowCardStyle = useMemo(
    () => estimateFlowCardStyle(Colors, darkMode),
    [Colors, darkMode]
  );
  const dividerColor = estimateFlowDividerColor(darkMode);
  const flowCardBg = aiFlowCardBackground(darkMode, Colors.surface2);

  useEffect(() => {
    if (visible) {
      setConfirmListExpanded(false);
      setBidDetailsExpanded(false);
      scopeDefaultAppliedRef.current = false;
      setDetailsExpanded(false);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || !viewModel || scopeDefaultAppliedRef.current) return;
    scopeDefaultAppliedRef.current = true;
    if (viewModel.defaultScopeExpanded) {
      setDetailsExpanded(true);
    }
  }, [visible, viewModel]);

  const handleBack = useCallback(() => {
    fireHaptic(Haptics.ImpactFeedbackStyle.Light);
    onBack();
  }, [onBack]);

  const handlePrimary = useCallback(() => {
    if (viewModel?.needsScopeConfirmation && onConfirmScope) {
      onConfirmScope();
      return;
    }
    onOpenDetailedReview();
  }, [viewModel?.needsScopeConfirmation, onConfirmScope, onOpenDetailedReview]);

  const handleDetailed = useCallback(() => {
    onOpenDetailedReview();
  }, [onOpenDetailedReview]);

  const handleExpandConfirm = useCallback(() => {
    startTransition(() => setConfirmListExpanded(true));
  }, []);

  const handleCollapseConfirm = useCallback(() => {
    startTransition(() => setConfirmListExpanded(false));
  }, []);

  const handleToggleBidDetails = useCallback(() => {
    startTransition(() => setBidDetailsExpanded((v) => !v));
  }, []);

  const handleToggleScope = useCallback(() => {
    startTransition(() => setDetailsExpanded((v) => !v));
  }, []);

  const scrollPaddingBottom = useMemo(
    () => Math.max(insets.bottom, 16) + 108,
    [insets.bottom]
  );

  if (!visible) return null;

  const statusStyle = viewModel ? STATUS_COLORS[viewModel.status.tone] : STATUS_COLORS.mostly;

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={handleBack}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
      <View style={[styles.screen, { backgroundColor: Colors.bg }]}>
        <AIEstimateFlowHeader
          title="Initial estimate"
          subtitle={
            viewModel?.needsScopeConfirmation
              ? 'Your first look — confirm scope to refine the number'
              : 'Quick summary before detailed review'
          }
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
                  { backgroundColor: darkMode ? HERO_BG_DARK : Colors.bg },
                ]}
              >
                <View style={styles.heroTopRow}>
                  <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: statusStyle.color }]}>
                      {viewModel.status.label}
                    </Text>
                  </View>
                  <Text style={[styles.metaText, { color: Colors.sub }]}>
                    {viewModel.scopeMetaLabel}
                  </Text>
                </View>

                <Text style={[styles.projectTitle, { color: Colors.text }]} numberOfLines={2}>
                  {viewModel.displayTitle}
                </Text>
                {viewModel.tagline ? (
                  <Text style={[styles.tagline, { color: Colors.sub }]} numberOfLines={2}>
                    {viewModel.tagline}
                  </Text>
                ) : null}

                <Text
                  style={[
                    styles.heroTotal,
                    {
                      color: viewModel.hero.hasAmount ? brandAccent : Colors.sub,
                      fontSize: viewModel.hero.hasAmount ? 44 : 36,
                    },
                  ]}
                >
                  {viewModel.hero.amountText}
                </Text>
                <Text style={[styles.heroHint, { color: Colors.sub }]}>{viewModel.hero.hint}</Text>
                {viewModel.planningDisclaimer ? (
                  <Text style={[styles.planningDisclaimer, { color: Colors.sub }]}>
                    {viewModel.planningDisclaimer}
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
                        value={formatDraftMoney(viewModel.totals.material)}
                        darkMode={darkMode}
                        Colors={Colors}
                      />
                    ) : null}
                    {viewModel.totals.labor != null ? (
                      <StatChip
                        label="Labor"
                        value={formatDraftMoney(viewModel.totals.labor)}
                        darkMode={darkMode}
                        Colors={Colors}
                      />
                    ) : null}
                    {viewModel.totals.allowance != null ? (
                      <StatChip
                        label="Allowances"
                        value={formatDraftMoney(viewModel.totals.allowance)}
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
                  accessibilityLabel="Open detailed review"
                >
                  <Text style={[styles.detailedReviewLinkText, { color: brandAccent }]}>
                    Open detailed review
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
                    {viewModel.understood.map((line) => (
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
                      <Text style={[styles.blockTitle, { color: Colors.text }]}>Next to confirm</Text>
                      {viewModel.attentionCount > 0 ? (
                        <View style={[styles.countPill, { backgroundColor: 'rgba(251, 191, 36, 0.14)' }]}>
                          <Text style={styles.countPillText}>{viewModel.attentionCount}</Text>
                        </View>
                      ) : null}
                    </View>
                    {visiblePricingItems.map((item, index) => (
                      <View key={`${item}-${index}`} style={styles.checkRow}>
                        <View style={[styles.checkDot, { borderColor: '#fbbf24' }]} />
                        <Text style={[styles.checkText, { color: Colors.text }]} numberOfLines={2}>
                          {item}
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
                    viewModel.confirmBuckets.pricingScope.length > PRICING_PREVIEW_COUNT ? (
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

                {viewModel.confirmBuckets.bidDetails.length > 0 ? (
                  <View
                    style={[
                      styles.block,
                      styles.blockBorder,
                      { borderTopColor: dividerColor },
                    ]}
                  >
                    <ReliablePress
                      onPress={handleToggleBidDetails}
                      style={styles.scopeHeader}
                      accessibilityLabel="Bid details to confirm"
                      accessibilityState={{ expanded: bidDetailsExpanded }}
                    >
                      <View style={[styles.blockTitleRow, { marginBottom: 0 }]}>
                        <Text style={[styles.blockTitle, { color: Colors.text }]}>Bid details</Text>
                        <View
                          style={[
                            styles.countPill,
                            { backgroundColor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' },
                          ]}
                        >
                          <Text style={[styles.countPillText, { color: Colors.sub }]}>
                            {viewModel.confirmBuckets.bidDetails.length}
                          </Text>
                        </View>
                      </View>
                      <MaterialIcons
                        name={bidDetailsExpanded ? 'expand-less' : 'expand-more'}
                        size={22}
                        color={Colors.sub}
                      />
                    </ReliablePress>
                    {bidDetailsExpanded
                      ? viewModel.confirmBuckets.bidDetails.map((item, index) => (
                          <View key={`bid-${item}-${index}`} style={styles.checkRow}>
                            <View
                              style={[
                                styles.checkDot,
                                { borderColor: darkMode ? 'rgba(255,255,255,0.28)' : Colors.line },
                              ]}
                            />
                            <Text style={[styles.checkText, { color: Colors.sub }]} numberOfLines={2}>
                              {item}
                            </Text>
                          </View>
                        ))
                      : null}
                  </View>
                ) : null}

                {viewModel.scopePreview.length > 0 ? (
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
                        Scope · {viewModel.totals.scopeItemCount || viewModel.scopePreview.length} items
                      </Text>
                      <MaterialIcons
                        name={detailsExpanded ? 'expand-less' : 'expand-more'}
                        size={22}
                        color={Colors.sub}
                      />
                    </ReliablePress>
                    {detailsExpanded
                      ? viewModel.scopePreview.map(({ name, amount }) => (
                          <View key={name} style={styles.scopeRow}>
                            <Text style={[styles.scopeName, { color: Colors.text }]} numberOfLines={1}>
                              {name}
                            </Text>
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
                                {amount > 0 ? formatDraftMoney(amount) : '—'}
                              </Text>
                            </View>
                          </View>
                        ))
                      : null}
                  </View>
                ) : null}
              </View>
            </>
          )}
        </GestureScrollView>

        <View
          style={[
            styles.footer,
            {
              paddingBottom: Math.max(insets.bottom, 12),
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
              color="#0f172a"
            />
          </ReliablePress>

          <View style={styles.secondaryRow}>
            <ReliablePress onPress={onRegenerate} style={styles.secondaryPress} accessibilityLabel="Edit notes">
              <Text style={[styles.secondaryText, { color: Colors.sub }]}>Edit notes</Text>
            </ReliablePress>
            <Text style={[styles.secondaryDot, { color: Colors.sub }]}>·</Text>
            <ReliablePress onPress={onClose} style={styles.secondaryPress} accessibilityLabel="Close">
              <Text style={[styles.secondaryText, { color: Colors.sub }]}>Close</Text>
            </ReliablePress>
          </View>
        </View>
      </View>
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
    marginHorizontal: -8,
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
    marginHorizontal: -8,
    paddingVertical: 4,
  },
  detailedReviewLinkText: {
    fontSize: 14,
    fontWeight: '700',
  },
  contentCard: {
    overflow: 'hidden',
    marginHorizontal: -8,
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
    marginTop: 10,
  },
  scopeName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
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
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  secondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  secondaryPress: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  secondaryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryDot: {
    opacity: 0.5,
  },
});
