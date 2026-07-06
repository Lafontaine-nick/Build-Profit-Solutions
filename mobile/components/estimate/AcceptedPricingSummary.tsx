import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { getColors } from '@/theme/getColors';
import type { ScopeItemIntelligence } from '@/utils/scopeIntelligence';
import { formatUnitLabel } from '@/utils/scopeItemQuantities';
import { isFormulaQuantityApplyTargetActive, shouldShowFormulaQuantityButton } from '@/utils/scopeFormulaRegistry';
import type { AssemblyComponentStatus } from '@/utils/scopeAssemblyRegistry';
import type { ScopeGapNotice } from '@/utils/scopeAssemblyRegistry';
import {
  buildSecondaryDisclosureContent,
  getPricingSecondaryAction,
  itemSpecificAssemblyComponents,
  type AcceptedPricingDisplay,
} from '@/utils/acceptedPricingSummaryUi';
import {
  formatParentIncludedScopeGapSummary,
  getReviewableScopeComponents,
  type ScopeGapPricingContext,
  type ScopeGapResolutionsMap,
} from '@/utils/scopeReviewUi';
import type { BenchmarkScopeAssumption, BenchmarkScopeAssumptionProfile } from '@/utils/benchmarkScopeAssumptions';
import ScopeReviewSheet from '@/components/estimate/ScopeReviewSheet';

function captionColor(darkMode: boolean, Colors: ReturnType<typeof getColors>) {
  return darkMode ? 'rgba(255,255,255,0.62)' : Colors.sub;
}

function calculatedQuantityAlreadyActive(intelligence: ScopeItemIntelligence): boolean {
  const formula = intelligence.formula;
  const current = intelligence.quantity.value;
  if (!formula || current == null) return false;
  return isFormulaQuantityApplyTargetActive({
    scopeKey: intelligence.scopeItemKey,
    formula,
    quantity: current,
    unit: intelligence.quantity.unit,
    source: intelligence.quantity.source,
  });
}

function confidenceBadgeColors(label: NonNullable<AcceptedPricingDisplay['confidenceLabel']>, darkMode: boolean) {
  if (label === 'Scope review pending') {
    return {
      border: darkMode ? 'rgba(251,191,36,0.35)' : 'rgba(245,158,11,0.28)',
      background: darkMode ? 'rgba(251,191,36,0.1)' : 'rgba(245,158,11,0.08)',
      text: '#fbbf24',
    };
  }
  if (label === 'High confidence') {
    return {
      border: darkMode ? 'rgba(34,197,94,0.35)' : 'rgba(22,163,74,0.28)',
      background: darkMode ? 'rgba(34,197,94,0.12)' : 'rgba(22,163,74,0.08)',
      text: '#22c55e',
    };
  }
  if (label === 'Medium confidence') {
    return {
      border: darkMode ? 'rgba(251,191,36,0.35)' : 'rgba(245,158,11,0.28)',
      background: darkMode ? 'rgba(251,191,36,0.1)' : 'rgba(245,158,11,0.08)',
      text: '#fbbf24',
    };
  }
  return {
    border: darkMode ? 'rgba(96,165,250,0.35)' : 'rgba(59,130,246,0.28)',
    background: darkMode ? 'rgba(96,165,250,0.12)' : 'rgba(59,130,246,0.08)',
    text: '#60a5fa',
  };
}

export function PricingSourceBadge({ label, darkMode }: { label: string; darkMode: boolean }) {
  return (
    <View
      style={[
        styles.badge,
        {
          borderColor: darkMode ? 'rgba(96,165,250,0.35)' : 'rgba(59,130,246,0.28)',
          backgroundColor: darkMode ? 'rgba(96,165,250,0.12)' : 'rgba(59,130,246,0.08)',
        },
      ]}
    >
      <Text style={{ color: '#60a5fa', fontSize: 11, fontWeight: '700' }} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

export function PricingConfidenceBadge({
  label,
  darkMode,
}: {
  label: NonNullable<AcceptedPricingDisplay['confidenceLabel']>;
  darkMode: boolean;
}) {
  const colors = confidenceBadgeColors(label, darkMode);
  return (
    <View style={[styles.badge, { borderColor: colors.border, backgroundColor: colors.background }]}>
      <Text style={{ color: colors.text, fontSize: 11, fontWeight: '700' }} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

export function ScopeIntelligenceDetailsPanel({
  intelligence,
  scopeKey,
  Colors,
  darkMode,
  onUseCalculatedQuantity,
  includeProjectGaps = false,
}: {
  intelligence: ScopeItemIntelligence;
  scopeKey: string;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  onUseCalculatedQuantity?: () => void;
  includeProjectGaps?: boolean;
}) {
  const formula = intelligence.formula;
  const assembly = intelligence.assembly;
  const pricingCompleteness = intelligence.pricingCompleteness;
  const itemMissing = itemSpecificAssemblyComponents(assembly?.missingComponents, scopeKey);

  return (
    <View style={{ gap: 8 }}>
      {formula && !calculatedQuantityAlreadyActive(intelligence) ? (
        <View style={{ gap: 6 }}>
          <Text style={[styles.detailText, { color: captionColor(darkMode, Colors) }]}>
            {formula.formulaExplanation}
          </Text>
          {onUseCalculatedQuantity &&
          shouldShowFormulaQuantityButton({ scopeKey, formula }) ? (
            <TouchableOpacity
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`Use calculated quantity of ${formula.roundedValue.toLocaleString()} ${formatUnitLabel(formula.unit)}`}
              onPress={onUseCalculatedQuantity}
              style={[
                styles.formulaActionButton,
                {
                  borderColor: darkMode ? 'rgba(34,197,94,0.28)' : 'rgba(22,163,74,0.32)',
                  backgroundColor: darkMode ? 'rgba(34,197,94,0.05)' : 'rgba(34,197,94,0.04)',
                },
              ]}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={16}
                color={darkMode ? 'rgba(110,231,160,0.9)' : '#16a34a'}
              />
              <Text
                style={[
                  styles.formulaActionText,
                  { color: darkMode ? 'rgba(110,231,160,0.92)' : '#15803d' },
                ]}
              >
                Use {formula.roundedValue.toLocaleString()} {formatUnitLabel(formula.unit)} calculated quantity
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
      {assembly ? (
        <View style={{ gap: 4 }}>
          <Text style={[styles.detailHeading, { color: '#f59e0b' }]}>Scope coverage</Text>
          <Text style={[styles.detailText, { color: captionColor(darkMode, Colors) }]}>
            {assembly.completeness.replace(/_/g, ' ')} · {assembly.confidence} inclusion confidence
          </Text>
          {itemMissing.length ? (
            <Text style={[styles.detailText, { color: captionColor(darkMode, Colors) }]}>
              Possible missing: {itemMissing.map((item) => item.label).join(', ')}
            </Text>
          ) : null}
        </View>
      ) : null}
      {pricingCompleteness ? (
        <View style={{ gap: 4 }}>
          <Text style={[styles.detailHeading, { color: '#a78bfa' }]}>Pricing review</Text>
          <Text style={[styles.detailText, { color: captionColor(darkMode, Colors) }]}>
            {pricingCompleteness.rateType.replace(/_/g, ' ')} · {pricingCompleteness.status.replace(/_/g, ' ')}
          </Text>
          {pricingCompleteness.dateRelevance?.message ? (
            <Text style={[styles.detailText, { color: captionColor(darkMode, Colors) }]}>
              {pricingCompleteness.dateRelevance.message}
            </Text>
          ) : null}
          {pricingCompleteness.regionalRelevance?.overall === 'low' ? (
            <Text style={[styles.detailText, { color: captionColor(darkMode, Colors) }]}>
              Regional relevance needs review.
            </Text>
          ) : null}
          {pricingCompleteness.minimumCharge?.status === 'review' ? (
            <Text style={[styles.detailText, { color: captionColor(darkMode, Colors) }]}>
              Minimum charge may apply.
            </Text>
          ) : null}
          {pricingCompleteness.missingCostComponents.length ? (
            <Text style={[styles.detailText, { color: captionColor(darkMode, Colors) }]}>
              Missing cost components: {pricingCompleteness.missingCostComponents.join(', ')}
            </Text>
          ) : null}
        </View>
      ) : null}
      {includeProjectGaps && intelligence.scopeGaps.length ? (
        <View style={{ gap: 4 }}>
          <Text style={[styles.detailHeading, { color: '#f59e0b' }]}>Project gaps</Text>
          {intelligence.scopeGaps.map((gap) => (
            <Text key={gap.key} style={[styles.detailText, { color: captionColor(darkMode, Colors) }]}>
              {gap.label}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function AcceptedPricingSummary({
  display,
  intelligence,
  scopeKey,
  scopeItemLabel,
  resolved,
  suggestedBlock,
  comparisonBlock,
  scopeGapResolutions,
  scopeGapPricingContext,
  originalNotes,
  Colors,
  darkMode,
  onEditPricing,
  onScopeGapResolutionsChange,
  onScopeGapPriceSeparately,
  onScopeGapIncludeInParentPrice,
}: {
  display: AcceptedPricingDisplay;
  intelligence: ScopeItemIntelligence;
  scopeKey: string;
  scopeItemLabel: string;
  resolved: import('@/utils/scopeItemQuantities').ResolvedItemQuantity;
  suggestedBlock?: import('@/utils/scopeItemQuantities').SuggestedPricingBlock | null;
  comparisonBlock?: import('@/utils/scopeItemQuantities').SuggestedPricingBlock | null;
  scopeGapResolutions?: ScopeGapResolutionsMap;
  scopeGapPricingContext?: ScopeGapPricingContext;
  originalNotes?: string | null;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  onEditPricing: () => void;
  onScopeGapResolutionsChange?: (next: ScopeGapResolutionsMap) => void;
  onScopeGapPriceSeparately?: (
    componentKey: string,
    component: AssemblyComponentStatus,
    benchmarkAssumption?: BenchmarkScopeAssumption | null,
    benchmarkProfile?: BenchmarkScopeAssumptionProfile | null
  ) => void;
  onScopeGapIncludeInParentPrice?: (
    componentKey: string,
    component: AssemblyComponentStatus,
    addonAmount: number,
    benchmarkAssumption?: BenchmarkScopeAssumption | null,
    benchmarkProfile?: BenchmarkScopeAssumptionProfile | null
  ) => void;
}) {
  const [secondaryOpen, setSecondaryOpen] = useState(false);
  const [scopeReviewOpen, setScopeReviewOpen] = useState(false);

  const reviewableComponents = useMemo(
    () =>
      getReviewableScopeComponents(
        intelligence.assembly?.unknownComponents,
        scopeKey,
        originalNotes,
        suggestedBlock?.benchmarkScopeProfile
      ),
    [intelligence.assembly?.unknownComponents, scopeKey, originalNotes, suggestedBlock?.benchmarkScopeProfile]
  );

  const secondaryAction = useMemo(
    () =>
      getPricingSecondaryAction({
        display,
        intelligence,
        resolved,
        suggestedBlock,
        comparisonBlock,
        scopeKey,
        originalNotes,
        scopeGapResolutions,
        scopeGapPricingContext,
      }),
    [display, intelligence, resolved, suggestedBlock, comparisonBlock, scopeKey, originalNotes, scopeGapResolutions, scopeGapPricingContext]
  );

  const opensScopeReviewSheet =
    secondaryAction?.kind === 'review_missing_scope' || secondaryAction?.kind === 'needs_separate_pricing';

  const secondaryDisclosure = useMemo(() => {
    if (!secondaryAction || !secondaryOpen || opensScopeReviewSheet) return null;
    return buildSecondaryDisclosureContent({
      action: secondaryAction,
      display,
      intelligence,
      resolved,
      suggestedBlock,
      comparisonBlock,
      scopeKey,
    });
  }, [
    secondaryAction,
    secondaryOpen,
    opensScopeReviewSheet,
    display,
    intelligence,
    resolved,
    suggestedBlock,
    comparisonBlock,
    scopeKey,
  ]);

  const includedAddonSummary = useMemo(
    () => formatParentIncludedScopeGapSummary(scopeKey, scopeGapResolutions),
    [scopeKey, scopeGapResolutions]
  );

  const methodLine =
    display.pricingModel === 'unit_pricing' && display.subtitleLine
      ? display.subtitleLine
      : display.pricingTypeLabel;

  return (
    <View style={{ gap: 8 }}>
      <View style={styles.summaryTopRow}>
        <Text style={[styles.totalText, { color: darkMode ? '#F5F7FA' : Colors.text }]}>{display.totalLabel}</Text>
        <Text style={[styles.statusText, { color: captionColor(darkMode, Colors) }]}>{display.selectionStatusLabel}</Text>
      </View>
      <Text style={[styles.typeText, { color: captionColor(darkMode, Colors) }]}>{methodLine}</Text>
      {display.pricingModel === 'material_labor_split' && display.subtitleLine ? (
        <Text style={[styles.subtitleText, { color: captionColor(darkMode, Colors) }]}>{display.subtitleLine}</Text>
      ) : null}
      {includedAddonSummary ? (
        <View
          style={[
            styles.includedSummaryRow,
            {
              borderColor: darkMode ? 'rgba(34,197,94,0.38)' : 'rgba(22,163,74,0.28)',
              backgroundColor: darkMode ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.08)',
            },
          ]}
        >
          <Text
            style={[
              styles.includedSummaryText,
              { color: darkMode ? '#4ade80' : '#16a34a' },
            ]}
          >
            {includedAddonSummary}
          </Text>
        </View>
      ) : null}
      <View style={styles.badgeRow}>
        <PricingSourceBadge label={display.pricingSourceLabel} darkMode={darkMode} />
        {display.showConfidenceBadge && display.confidenceLabel ? (
          <PricingConfidenceBadge label={display.confidenceLabel} darkMode={darkMode} />
        ) : null}
      </View>
      {display.warningMessage ? (
        <Text style={[styles.warningText, { color: darkMode ? '#fbbf24' : '#d97706' }]}>{display.warningMessage}</Text>
      ) : null}
      <View style={[styles.actionLinksRow, !secondaryAction && styles.actionLinksRowSingle]}>
        <TouchableOpacity onPress={onEditPricing} activeOpacity={0.7} accessibilityRole="button">
          <Text style={styles.editLink}>Edit pricing</Text>
        </TouchableOpacity>
        {secondaryAction ? (
          <TouchableOpacity
            onPress={() => {
              if (opensScopeReviewSheet) {
                setScopeReviewOpen(true);
              } else {
                setSecondaryOpen((open) => !open);
              }
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ expanded: opensScopeReviewSheet ? scopeReviewOpen : secondaryOpen }}
          >
            <Text style={styles.editLink}>
              {opensScopeReviewSheet ? secondaryAction.label : secondaryOpen ? 'Hide' : secondaryAction.label}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {secondaryDisclosure ? (
        <View
          style={[
            styles.detailsPanel,
            {
              borderColor: darkMode ? 'rgba(96,165,250,0.22)' : 'rgba(96,165,250,0.18)',
              backgroundColor: darkMode ? 'rgba(15,23,42,0.58)' : 'rgba(248,250,252,0.92)',
            },
          ]}
        >
          <Text style={[styles.detailHeading, { color: darkMode ? '#F5F7FA' : Colors.text }]}>
            {secondaryDisclosure.heading}
          </Text>
          {secondaryDisclosure.kind === 'rows'
            ? secondaryDisclosure.rows.map((row) => (
                <Text key={row.label} style={[styles.detailText, { color: captionColor(darkMode, Colors) }]}>
                  {row.label}: {row.value}
                </Text>
              ))
            : null}
        </View>
      ) : null}

      <ScopeReviewSheet
        visible={scopeReviewOpen}
        scopeItemId={scopeKey}
        scopeItemLabel={scopeItemLabel}
        priceLabel={display.totalLabel}
        components={reviewableComponents}
        benchmarkProfile={suggestedBlock?.benchmarkScopeProfile}
        resolutions={scopeGapResolutions}
        pricingContext={scopeGapPricingContext}
        Colors={Colors}
        darkMode={darkMode}
        onClose={() => setScopeReviewOpen(false)}
        onResolve={(next) => onScopeGapResolutionsChange?.(next)}
        onPriceSeparately={(componentKey, component, benchmarkAssumption, benchmarkProfile) => {
          onScopeGapPriceSeparately?.(componentKey, component, benchmarkAssumption, benchmarkProfile);
          setScopeReviewOpen(false);
        }}
        onIncludeInParentPrice={(componentKey, component, addonAmount, benchmarkAssumption, benchmarkProfile) => {
          onScopeGapIncludeInParentPrice?.(
            componentKey,
            component,
            addonAmount,
            benchmarkAssumption,
            benchmarkProfile
          );
          setScopeReviewOpen(false);
        }}
      />
    </View>
  );
}

export function ProjectReviewSummary({
  gaps,
  Colors,
  darkMode,
}: {
  gaps: ScopeGapNotice[];
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!gaps.length) return null;
  return (
    <View
      style={[
        styles.projectReviewCard,
        {
          borderColor: darkMode ? 'rgba(245,158,11,0.28)' : 'rgba(245,158,11,0.22)',
          backgroundColor: darkMode ? 'rgba(245,158,11,0.06)' : 'rgba(245,158,11,0.05)',
        },
      ]}
    >
      <Text style={{ color: darkMode ? '#F5F7FA' : Colors.text, fontSize: 14, fontWeight: '800' }}>
        Items needing review
      </Text>
      <Text style={{ color: captionColor(darkMode, Colors), fontSize: 12, marginTop: 4 }}>
        {gaps.length} item{gaps.length === 1 ? '' : 's'} need review
      </Text>
      <View style={{ marginTop: 8, gap: 4 }}>
        {(open ? gaps : gaps.slice(0, 3)).map((gap) => (
          <Text key={gap.key} style={{ color: captionColor(darkMode, Colors), fontSize: 12 }}>
            • {gap.label}
          </Text>
        ))}
      </View>
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => setOpen((value) => !value)}
        style={{ marginTop: 10 }}
        accessibilityRole="button"
      >
        <Text style={styles.editLink}>{open ? 'Hide items' : 'Review items'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  totalText: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  typeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  subtitleText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  includedSummaryRow: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 2,
  },
  includedSummaryText: {
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: '100%',
  },
  warningText: {
    fontSize: 12,
    lineHeight: 17,
  },
  actionLinksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  actionLinksRowSingle: {
    justifyContent: 'flex-start',
  },
  editLink: {
    color: '#22c55e',
    fontSize: 13,
    fontWeight: '700',
  },
  detailsPanel: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 6,
    marginTop: 4,
  },
  detailHeading: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
  },
  detailText: {
    fontSize: 12,
    lineHeight: 17,
  },
  formulaActionButton: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
  },
  formulaActionText: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    flexShrink: 1,
  },
  projectReviewCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
});
