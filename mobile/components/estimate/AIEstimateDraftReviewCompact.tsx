import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActionSheetIOS,
  Pressable,
  Keyboard,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { EstimateAiDraft } from '@/utils/estimateAiDraft';
import { formatDraftMoney } from '@/utils/estimateAiDraft';
import { getScopePackagesForReview } from '@/utils/scopePackagesForReview';
import {
  compactPackageAmount,
  compactPackagePricingSourceColor,
  compactPackagePricingSourceLabel,
  compactPackageStatusLabel,
  dedupeMissingPriceSuggestions,
  formatScopeQuantity,
  getCompactProjectSummary,
  resolveScopePackageBudgetBreakdown,
  type ScopePackageBudgetBreakdown,
  scopePackageNeedsManualPrice,
  scopePackagePricingHint,
  scopePackagePricedAmount,
  SCOPE_LIST_DEFAULT_LIMIT,
  shouldHidePerRowStatus,
  shouldShowStep3TemplateRatesCard,
} from '@/utils/estimateDraftReviewUi';
import { isSoftCostScopePackage } from '@/utils/softCostScope';
import type { EstimateConfidenceLevel } from '@/utils/estimateAiDraft';
import { estimateFlowCardStyle, estimateFlowDividerColor } from '@/utils/estimateFlowCardStyle';
import {
  computeStep3ReviewTotals,
  getStep3ReviewHeroMarkupSubline,
  getStep3ReviewPlanningDisclaimer,
  getStep3ReviewScopeMetaLabel,
  getStep3ReviewStatusBadge,
  shouldDefaultShowAllStep3ScopeItems,
} from '@/utils/estimateDraftReviewStep3Ui';
import { getInitialRevealDisplayTitle } from '@/utils/estimateInitialRevealUi';
import ReliableFlowPress from '@/components/estimate/ReliableFlowPress';
import ScopeBudgetBreakdownPanel from '@/components/estimate/ScopeBudgetBreakdownPanel';
import {
  Step3ScopeAllowancePricingEditor,
  Step3ScopePricingEditor,
} from '@/components/estimate/ScopePricingEditor';

type Colors = {
  text: string;
  sub: string;
  line: string;
  bg: string;
  surface2: string;
};

type Props = {
  draft: EstimateAiDraft;
  Colors: Colors;
  darkMode: boolean;
  busy: boolean;
  confStyle: { bg: string; color: string };
  confidenceLevel?: EstimateConfidenceLevel;
  onPriceScopeItem?: (packageName: string) => void;
  onUpdateScopeBudgetSplit?: (
    packageName: string,
    material: number,
    labor: number,
    basis?: ScopePackageBudgetBreakdown['basis']
  ) => void;
  onRemoveScopeItem?: (packageName: string) => void;
  markupPct?: number;
};

const flowCard = (Colors: Colors, darkMode: boolean) => ({
  ...estimateFlowCardStyle(Colors, darkMode, { marginBottom: 12 }),
  marginHorizontal: -8,
});
const flowDivider = (darkMode: boolean) => estimateFlowDividerColor(darkMode);

const STEP3_STATUS_COLORS = {
  ready: { bg: 'rgba(34, 197, 94, 0.14)', color: '#4ade80' },
  review: { bg: 'rgba(251, 191, 36, 0.12)', color: '#fbbf24' },
  partial: { bg: 'rgba(45, 255, 196, 0.1)', color: '#2DFFC4' },
};

function roundedMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function HeroStatChip({
  label,
  value,
  Colors,
  darkMode,
}: {
  label: string;
  value: string;
  Colors: Colors;
  darkMode: boolean;
}) {
  return (
    <View
      style={{
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        minWidth: 96,
        backgroundColor: darkMode ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.7)',
      }}
    >
      <Text
        style={{
          color: Colors.sub,
          fontSize: 11,
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          marginBottom: 2,
        }}
      >
        {label}
      </Text>
      <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '800' }}>{value}</Text>
    </View>
  );
}

function PriceRow({
  label,
  value,
  Colors,
  highlight,
}: {
  label: string;
  value: string;
  Colors: Colors;
  highlight?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
      <Text style={{ color: Colors.sub, fontSize: 14, fontWeight: '600' }}>{label}</Text>
      <Text style={{ color: highlight ? '#22c55e' : Colors.text, fontSize: 15, fontWeight: '700' }}>
        {value}
      </Text>
    </View>
  );
}

function emptyBudgetBreakdown(
  pkg: {
    price?: number | null;
    knownSubtotal?: number | null;
    calculatedSubtotal?: number | null;
    materialPrice?: number | null;
    laborPrice?: number | null;
    scopeQuantities?: Array<{ quantity: number; unit: string }>;
  },
  existing?: ScopePackageBudgetBreakdown | null
): ScopePackageBudgetBreakdown {
  if (existing) return existing;
  const q = pkg.scopeQuantities?.[0];
  const basis = q && q.quantity > 0 ? { quantity: q.quantity, unit: q.unit } : null;
  const pkgMat = Math.max(0, Number(pkg.materialPrice) || 0);
  const pkgLab = Math.max(0, Number(pkg.laborPrice) || 0);
  const packageTotal = Math.max(
    0,
    Number(pkg.price ?? pkg.knownSubtotal ?? pkg.calculatedSubtotal ?? 0) || 0
  );
  // Unpriced: start at $0 / $0. Priced lump with no resolved split: keep total on labor.
  if (packageTotal <= 0 && pkgMat <= 0 && pkgLab <= 0) {
    return {
      total: 0,
      material: 0,
      labor: 0,
      materialSource: 'manual',
      laborSource: 'manual',
      basis,
    };
  }
  if (pkgMat > 0 || pkgLab > 0) {
    return {
      total: Math.round((pkgMat + pkgLab) * 100) / 100 || packageTotal,
      material: pkgMat,
      labor: pkgLab,
      materialSource: 'manual',
      laborSource: 'manual',
      basis,
    };
  }
  return {
    total: packageTotal,
    material: 0,
    labor: packageTotal,
    materialSource: 'manual',
    laborSource: 'manual',
    basis,
  };
}

function softCostPackageAmount(pkg: {
  price?: number | null;
  knownSubtotal?: number | null;
  calculatedSubtotal?: number | null;
  materialPrice?: number | null;
  laborPrice?: number | null;
}): number {
  const total = Math.max(
    0,
    Number(pkg.price ?? pkg.knownSubtotal ?? pkg.calculatedSubtotal ?? 0) || 0
  );
  if (total > 0) return total;
  return Math.max(0, (Number(pkg.materialPrice) || 0) + (Number(pkg.laborPrice) || 0));
}

export default function AIEstimateDraftReviewCompact({
  draft,
  Colors,
  darkMode,
  busy,
  confStyle,
  onPriceScopeItem,
  onUpdateScopeBudgetSplit,
  onRemoveScopeItem,
  markupPct = 0,
}: Props) {
  const [showRoughSuggestions, setShowRoughSuggestions] = useState(false);
  const [showAllScope, setShowAllScope] = useState(() => {
    const count = getScopePackagesForReview(draft).length;
    return (
      Boolean(draft.scopeAssumptionsConfirmed || draft.confirmedAssumptions?.length) ||
      shouldDefaultShowAllStep3ScopeItems(count)
    );
  });
  const [editingPricingFor, setEditingPricingFor] = useState<string | null>(null);
  const [expandedBudgetSplits, setExpandedBudgetSplits] = useState<Record<string, true>>({});
  const [liveSplitByPackage, setLiveSplitByPackage] = useState<
    Record<string, { material: number; labor: number }>
  >({});
  const scopePackages = getScopePackagesForReview(draft);
  const step3Totals = useMemo(() => computeStep3ReviewTotals(draft, markupPct), [draft, markupPct]);
  if (__DEV__) {
    const q = draft.scopeMeasurements?.itemQuantities || {};
    const pkg = scopePackages.find((p) => /flooring|lvp/i.test(`${p.name || ''} ${p.scope || ''}`));
    if (pkg) {
      console.log('[scope-pricing] step3 render', {
        rows: scopePackages.map((p) => ({
          name: p.name,
          price: p.price ?? p.knownSubtotal ?? p.calculatedSubtotal,
          status: p.status,
        })),
        material: q.flooring__material,
        labor: q.flooring__labor,
        allowance: q.flooring__allowance,
        packagePrice: pkg.price ?? pkg.knownSubtotal ?? pkg.calculatedSubtotal,
        packageStatus: pkg.status,
      });
    }
  }
  const {
    heroAmount,
    heroLabel,
    material: materialTotal,
    labor: laborTotal,
    allowance: allowanceTotal,
    calculatedTotal,
    estimatedBidWithMarkup,
    statedTotal,
    scopeItemCount,
  } = step3Totals;
  const statusBadge = getStep3ReviewStatusBadge(step3Totals);
  const statusStyle = STEP3_STATUS_COLORS[statusBadge.tone];
  const planningDisclaimer = getStep3ReviewPlanningDisclaimer(step3Totals);
  const heroMarkupSubline = getStep3ReviewHeroMarkupSubline(
    markupPct,
    calculatedTotal,
    statedTotal
  );
  const displayTitle = getInitialRevealDisplayTitle(draft);
  const normalizedMarkupPct = Math.max(0, Number(markupPct) || 0);
  const visibleScope = showAllScope
    ? scopePackages
    : scopePackages.slice(0, SCOPE_LIST_DEFAULT_LIMIT);
  const hiddenScopeCount = Math.max(0, scopePackages.length - SCOPE_LIST_DEFAULT_LIMIT);
  const roughSuggestionLines = dedupeMissingPriceSuggestions(
    draft.pricingMemoryMissingSuggestions || [],
    6
  );
  const hasRoughOnScope = scopePackages.some((p) => p.status === 'rough_price');
  const showTemplateRatesCard = shouldShowStep3TemplateRatesCard(draft, {
    roughSuggestionLineCount: roughSuggestionLines.length,
    hasRoughOnScope,
    pricingReady: statusBadge.tone === 'ready',
  });
  const hideRowStatus = shouldHidePerRowStatus(scopePackages);
  const showHeroStats =
    heroAmount != null &&
    (materialTotal != null || laborTotal != null || allowanceTotal != null);
  const showTotalsCard =
    !showHeroStats &&
    ((calculatedTotal != null && calculatedTotal > 0) ||
      allowanceTotal != null ||
      (statedTotal != null && statedTotal > 0));

  const confirmRemoveScopeItem = (packageName: string) => {
    Alert.alert(
      'Delete scope item?',
      `Remove “${packageName}” from this draft? You can add it again from Confirm Scope.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (editingPricingFor === packageName) {
              setEditingPricingFor(null);
            }
            setExpandedBudgetSplits((current) => {
              if (!current[packageName]) return current;
              const next = { ...current };
              delete next[packageName];
              return next;
            });
            onRemoveScopeItem?.(packageName);
          },
        },
      ]
    );
  };

  const openScopeRowActions = (params: {
    packageName: string;
    hasAmount: boolean;
    canEditInline: boolean;
    openInlinePricing: () => void;
  }) => {
    if (busy) return;
    const { packageName, hasAmount, canEditInline, openInlinePricing } = params;
    const canPrice = canEditInline || Boolean(onPriceScopeItem);
    const canDelete = Boolean(onRemoveScopeItem);
    if (!canPrice && !canDelete) return;

    const options: string[] = [];
    const actions: Array<() => void> = [];
    if (canPrice) {
      options.push(hasAmount ? 'Edit price' : 'Add price');
      actions.push(openInlinePricing);
    }
    if (canDelete) {
      options.push('Delete');
      actions.push(() => confirmRemoveScopeItem(packageName));
    }
    options.push('Cancel');

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: options.length - 1,
          destructiveButtonIndex: canDelete ? options.indexOf('Delete') : undefined,
          title: packageName,
        },
        (buttonIndex) => {
          if (buttonIndex == null || buttonIndex >= actions.length) return;
          actions[buttonIndex]?.();
        }
      );
      return;
    }

    Alert.alert(
      packageName,
      undefined,
      [
        ...actions.map((action, i) => ({
          text: options[i],
          style: options[i] === 'Delete' ? ('destructive' as const) : ('default' as const),
          onPress: action,
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ]
    );
  };

  return (
    <>
      <View style={flowCard(Colors, darkMode)}>
        <View style={{ marginBottom: 4 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8,
              gap: 8,
            }}
          >
            <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
              <Text style={[styles.statusBadgeText, { color: statusStyle.color }]}>
                {statusBadge.label}
              </Text>
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 8,
                flexShrink: 1,
              }}
            >
              {scopeItemCount > 0 ? (
                <Text
                  style={{ color: Colors.sub, fontSize: 12, fontWeight: '600' }}
                  numberOfLines={1}
                >
                  {getStep3ReviewScopeMetaLabel(scopeItemCount)}
                </Text>
              ) : null}
            </View>
          </View>

          <Text
            style={{ color: Colors.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.3 }}
            numberOfLines={2}
          >
            {displayTitle}
          </Text>
          {getCompactProjectSummary(draft) !== displayTitle ? (
            <Text style={{ color: Colors.sub, fontSize: 12, marginTop: 4 }} numberOfLines={2}>
              {getCompactProjectSummary(draft)}
            </Text>
          ) : null}
          {draft.projectAddress ? (
            <Text style={{ color: Colors.sub, fontSize: 12, marginTop: 4 }} numberOfLines={1}>
              {draft.projectAddress}
            </Text>
          ) : null}

          {heroAmount != null ? (
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 12 }}>
              <Text style={{ color: '#22c55e', fontSize: 36, fontWeight: '900', letterSpacing: -0.8 }}>
                {formatDraftMoney(heroAmount)}
              </Text>
              {draft.totalMatches === true ? (
                <MaterialIcons name="check-circle" size={18} color="#22c55e" />
              ) : null}
            </View>
          ) : null}
          {heroAmount != null ? (
            <Text style={{ color: Colors.sub, fontSize: 12, fontWeight: '600', marginTop: 4 }}>
              {heroLabel}
            </Text>
          ) : null}
          {heroMarkupSubline ? (
            <Text style={{ color: Colors.sub, fontSize: 12, fontWeight: '600', marginTop: 2 }}>
              {heroMarkupSubline}
            </Text>
          ) : null}
          {planningDisclaimer ? (
            <Text style={{ color: Colors.sub, fontSize: 12, marginTop: 6, lineHeight: 17 }}>
              {planningDisclaimer}
            </Text>
          ) : null}

          {showHeroStats ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
              {materialTotal != null ? (
                <HeroStatChip
                  label="Materials"
                  value={formatDraftMoney(materialTotal)}
                  Colors={Colors}
                  darkMode={darkMode}
                />
              ) : null}
              {laborTotal != null ? (
                <HeroStatChip
                  label="Labor"
                  value={formatDraftMoney(laborTotal)}
                  Colors={Colors}
                  darkMode={darkMode}
                />
              ) : null}
              {allowanceTotal != null ? (
                <HeroStatChip
                  label="Allowances"
                  value={formatDraftMoney(allowanceTotal)}
                  Colors={Colors}
                  darkMode={darkMode}
                />
              ) : null}
            </View>
          ) : null}

          {draft.estimateConfidence && statusBadge.tone !== 'ready' ? (
            <Text
              style={{ color: confStyle.color, fontSize: 11, fontWeight: '600', marginTop: 10 }}
              numberOfLines={2}
            >
              {draft.estimateConfidence.label}
            </Text>
          ) : null}

        </View>

        <View
          style={{
            height: StyleSheet.hairlineWidth,
            backgroundColor: flowDivider(darkMode),
            marginTop: 12,
            marginBottom: 2,
          }}
        />

        {visibleScope.map((pkg, index) => {
          const qty = formatScopeQuantity(pkg, draft);
          const amount = compactPackageAmount(pkg, draft);
          const isSoftCost = isSoftCostScopePackage(pkg, draft);
          const resolvedBreakdown = amount ? resolveScopePackageBudgetBreakdown(pkg, draft) : null;
          // Soft costs are flat allowances — never show a fake Material $0 / Labor split.
          const budgetBreakdown = isSoftCost ? null : resolvedBreakdown;
          const statusLabel = compactPackageStatusLabel(pkg, draft);
          const pricingSourceLabel = compactPackagePricingSourceLabel(pkg, draft);
          const hint = !amount ? scopePackagePricingHint(pkg) : null;
          const needsPrice = scopePackageNeedsManualPrice(pkg, draft);
          const isEditingPricing = editingPricingFor === pkg.name;
          const canEditInline = Boolean(onUpdateScopeBudgetSplit);
          const liveSplit = isEditingPricing ? liveSplitByPackage[pkg.name] : undefined;
          const liveSplitTotal =
            liveSplit != null ? roundedMoney(liveSplit.material + liveSplit.labor) : null;
          const rowAmount =
            liveSplitTotal != null && liveSplitTotal > 0 ? formatDraftMoney(liveSplitTotal) : amount;
          const editorBreakdown =
            isEditingPricing && canEditInline && !isSoftCost
              ? emptyBudgetBreakdown(pkg, resolvedBreakdown)
              : null;
          const showBudgetSplit =
            Boolean(budgetBreakdown) &&
            !isEditingPricing &&
            Boolean(expandedBudgetSplits[pkg.name]);
          const showAllowanceEditor = isEditingPricing && canEditInline && isSoftCost;
          const showStatus =
            !hideRowStatus &&
            amount &&
            !pricingSourceLabel &&
            pkg.status !== 'user_provided' &&
            pkg.status !== 'confirmed' &&
            statusLabel !== 'Confirmed';
          const openInlinePricing = () => {
            if (canEditInline) {
              setEditingPricingFor(pkg.name);
              if (!isSoftCost) {
                const seedBreakdown = emptyBudgetBreakdown(pkg, resolvedBreakdown);
                setLiveSplitByPackage((current) => ({
                  ...current,
                  [pkg.name]: {
                    material: Number(seedBreakdown.material) || 0,
                    labor: Number(seedBreakdown.labor) || 0,
                  },
                }));
              }
              return;
            }
            onPriceScopeItem?.(pkg.name);
          };
          const collapseBudgetSplit = () => {
            Keyboard.dismiss();
            setEditingPricingFor((current) => (current === pkg.name ? null : current));
            setExpandedBudgetSplits((current) => {
              if (!current[pkg.name]) return current;
              const next = { ...current };
              delete next[pkg.name];
              return next;
            });
            setLiveSplitByPackage((current) => {
              if (!current[pkg.name]) return current;
              const next = { ...current };
              delete next[pkg.name];
              return next;
            });
          };
          const toggleBudgetSplit = () => {
            if (!budgetBreakdown) return;
            // Chevron collapse = Done: close budget split and exit inline Material/Labor edit.
            if (isEditingPricing || expandedBudgetSplits[pkg.name]) {
              collapseBudgetSplit();
              return;
            }
            setExpandedBudgetSplits((current) => ({ ...current, [pkg.name]: true }));
          };
          const showRowMenu =
            !isEditingPricing &&
            (Boolean(onRemoveScopeItem) || canEditInline || Boolean(onPriceScopeItem));
          return (
            <Pressable
              key={`scope-${pkg.name}-${index}`}
              onLongPress={
                showRowMenu
                  ? () =>
                      openScopeRowActions({
                        packageName: pkg.name,
                        hasAmount: Boolean(amount),
                        canEditInline,
                        openInlinePricing,
                      })
                  : undefined
              }
              delayLongPress={320}
              style={{
                paddingVertical: 12,
                borderTopWidth: index > 0 ? StyleSheet.hairlineWidth : 0,
                borderTopColor: flowDivider(darkMode),
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={{ color: Colors.text, fontSize: 15, fontWeight: '600', letterSpacing: -0.2 }}
                    numberOfLines={2}
                  >
                    {pkg.name}
                  </Text>
                  {qty ? (
                    <Text style={{ color: Colors.sub, fontSize: 12, marginTop: 3 }}>{qty}</Text>
                  ) : isSoftCost ? (
                    <Text style={{ color: Colors.sub, fontSize: 12, marginTop: 3 }}>Allowance</Text>
                  ) : hint ? (
                    <Text style={{ color: Colors.sub, fontSize: 12, marginTop: 3 }}>{hint}</Text>
                  ) : null}
                </View>
                <View style={{ alignItems: 'flex-end', flexShrink: 0, flexDirection: 'row', gap: 2 }}>
                  <View style={{ alignItems: 'flex-end' }}>
                    {rowAmount ? (
                      <TouchableOpacity
                        activeOpacity={budgetBreakdown ? 0.75 : 1}
                        disabled={!budgetBreakdown}
                        onPress={toggleBudgetSplit}
                        accessibilityRole={budgetBreakdown ? 'button' : undefined}
                        accessibilityLabel={
                          budgetBreakdown
                            ? showBudgetSplit
                              ? `Hide budget split for ${pkg.name}`
                              : `Show budget split for ${pkg.name}`
                            : undefined
                        }
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}
                      >
                        <Text
                          style={{
                            color: '#22c55e',
                            fontSize: 15,
                            fontWeight: '600',
                            letterSpacing: -0.2,
                          }}
                        >
                          {rowAmount}
                        </Text>
                        {budgetBreakdown ? (
                          <MaterialIcons
                            name={showBudgetSplit ? 'expand-less' : 'expand-more'}
                            size={18}
                            color="rgba(34, 197, 94, 0.85)"
                          />
                        ) : null}
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        disabled={busy || (!canEditInline && !onPriceScopeItem)}
                        onPress={openInlinePricing}
                      >
                        <Text
                          style={{
                            color: needsPrice ? '#fbbf24' : Colors.sub,
                            fontSize: 13,
                            fontWeight: needsPrice ? '600' : '400',
                          }}
                        >
                          {needsPrice ? 'Add price' : statusLabel}
                        </Text>
                      </TouchableOpacity>
                    )}
                    {showStatus ? (
                      <Text style={{ color: Colors.sub, fontSize: 10, marginTop: 2 }}>
                        {statusLabel}
                      </Text>
                    ) : null}
                    {pricingSourceLabel ? (
                      <Text
                        style={{
                          color: compactPackagePricingSourceColor(
                            pricingSourceLabel,
                            darkMode,
                            Colors.sub
                          ),
                          fontSize: 10,
                          fontWeight: '600',
                          marginTop: 2,
                        }}
                      >
                        {pricingSourceLabel}
                      </Text>
                    ) : null}
                  </View>
                  {showRowMenu ? (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      disabled={busy}
                      hitSlop={{ top: 10, bottom: 10, left: 8, right: 4 }}
                      accessibilityRole="button"
                      accessibilityLabel={`Actions for ${pkg.name}`}
                      onPress={() =>
                        openScopeRowActions({
                          packageName: pkg.name,
                          hasAmount: Boolean(amount),
                          canEditInline,
                          openInlinePricing,
                        })
                      }
                      style={{ paddingTop: 1, paddingLeft: 2 }}
                    >
                      <MaterialIcons name="more-horiz" size={20} color={Colors.sub} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
              {showBudgetSplit && budgetBreakdown ? (
                <ScopeBudgetBreakdownPanel
                  breakdown={budgetBreakdown}
                  Colors={Colors}
                  darkMode={darkMode}
                />
              ) : null}
              {(editorBreakdown || showAllowanceEditor) && onUpdateScopeBudgetSplit ? (
                showAllowanceEditor ? (
                  <Step3ScopeAllowancePricingEditor
                    packageName={pkg.name}
                    amount={softCostPackageAmount(pkg)}
                    Colors={Colors}
                    darkMode={darkMode}
                    busy={busy}
                    onDone={collapseBudgetSplit}
                    onUpdateScopeBudgetSplit={onUpdateScopeBudgetSplit}
                  />
                ) : editorBreakdown ? (
                  <Step3ScopePricingEditor
                    packageName={pkg.name}
                    breakdown={editorBreakdown}
                    Colors={Colors}
                    darkMode={darkMode}
                    busy={busy}
                    onDone={collapseBudgetSplit}
                    onUpdateScopeBudgetSplit={onUpdateScopeBudgetSplit}
                    onLiveSplitChange={(material, labor) => {
                      setLiveSplitByPackage((current) => ({
                        ...current,
                        [pkg.name]: { material, labor },
                      }));
                    }}
                  />
                ) : null
              ) : null}
            </Pressable>
          );
        })}
        {hiddenScopeCount > 0 && !showAllScope ? (
          <ReliableFlowPress onPress={() => setShowAllScope(true)} style={{ marginTop: 8 }}>
            <Text style={{ color: Colors.sub, fontSize: 13, fontWeight: '600', textAlign: 'center' }}>
              Show all {scopePackages.length} items
            </Text>
          </ReliableFlowPress>
        ) : null}
        {showAllScope && hiddenScopeCount > 0 ? (
          <ReliableFlowPress onPress={() => setShowAllScope(false)} style={{ marginTop: 8 }}>
            <Text style={{ color: Colors.sub, fontSize: 12, fontWeight: '600', textAlign: 'center' }}>
              Show less
            </Text>
          </ReliableFlowPress>
        ) : null}
      </View>

      {showTotalsCard ? (
        <View style={flowCard(Colors, darkMode)}>
          <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '800', marginBottom: 6 }}>
            Totals
          </Text>
          {materialTotal != null ? (
            <PriceRow label="Materials" value={formatDraftMoney(materialTotal)} Colors={Colors} />
          ) : null}
          {laborTotal != null ? (
            <PriceRow label="Labor" value={formatDraftMoney(laborTotal)} Colors={Colors} />
          ) : null}
          {allowanceTotal != null ? (
            <PriceRow label="Allowances" value={formatDraftMoney(allowanceTotal)} Colors={Colors} />
          ) : null}
          {calculatedTotal != null && calculatedTotal > 0 ? (
            <PriceRow label="Total" value={formatDraftMoney(calculatedTotal)} Colors={Colors} highlight />
          ) : null}
          {estimatedBidWithMarkup != null ? (
            <>
              <PriceRow
                label={`Est. bid w/ ${normalizedMarkupPct}% markup`}
                value={formatDraftMoney(estimatedBidWithMarkup)}
                Colors={Colors}
              />
              <Text style={{ color: Colors.sub, fontSize: 11, lineHeight: 16, marginTop: 2 }}>
                Uses your current markup setting. Overhead and project costs on Step 5 may change the final bid.
              </Text>
            </>
          ) : null}
          {statedTotal != null && statedTotal > 0 ? (
            <PriceRow label="In your notes" value={formatDraftMoney(statedTotal)} Colors={Colors} />
          ) : null}
          {draft.totalMatches === true ? (
            <Text style={{ color: '#22c55e', fontSize: 12, marginTop: 4 }}>Totals match your notes.</Text>
          ) : null}
        </View>
      ) : null}

      {showTemplateRatesCard ? (
        <View
          style={{
            ...flowCard(Colors, darkMode),
            marginTop: 12,
          }}
        >
          <ReliableFlowPress
            onPress={() => setShowRoughSuggestions((v) => !v)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
            accessibilityLabel={
              showRoughSuggestions ? 'Hide template rate notes' : 'Show template rate notes'
            }
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, paddingRight: 8 }}>
              <MaterialIcons name="info-outline" size={15} color="#fbbf24" />
              <Text style={{ color: Colors.text, fontSize: 13, fontWeight: '600', flexShrink: 1 }}>
                Template rates used for planning
              </Text>
            </View>
            <Text style={{ color: Colors.sub, fontSize: 12, fontWeight: '600' }}>
              {showRoughSuggestions ? 'Hide' : 'Show'}
            </Text>
          </ReliableFlowPress>
          {showRoughSuggestions ? (
            <View style={{ marginTop: 10 }}>
              {roughSuggestionLines.map((line, i) => (
                <Text key={`sug-${i}`} style={{ color: Colors.sub, fontSize: 12, marginBottom: 4, lineHeight: 17 }}>
                  {line}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
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
});
