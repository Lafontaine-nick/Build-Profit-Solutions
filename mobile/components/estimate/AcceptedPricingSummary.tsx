import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { getColors } from '@/theme/getColors';
import type { ScopeItemIntelligence } from '@/utils/scopeIntelligence';
import type { AssemblyComponentStatus } from '@/utils/scopeAssemblyRegistry';
import type { ScopeGapNotice } from '@/utils/scopeAssemblyRegistry';
import {
  buildSecondaryDisclosureContent,
  getPricingSecondaryAction,
  itemSpecificAssemblyComponents,
  type AcceptedPricingDisplay,
} from '@/utils/acceptedPricingSummaryUi';

function captionColor(darkMode: boolean, Colors: ReturnType<typeof getColors>) {
  return darkMode ? 'rgba(255,255,255,0.62)' : Colors.sub;
}

function confidenceBadgeColors(label: NonNullable<AcceptedPricingDisplay['confidenceLabel']>, darkMode: boolean) {
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

export function PricingSourceBadge({
  label,
  darkMode,
}: {
  label: string;
  darkMode: boolean;
}) {
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
  const itemUnknown = itemSpecificAssemblyComponents(assembly?.unknownComponents, scopeKey);
  const itemMissing = itemSpecificAssemblyComponents(assembly?.missingComponents, scopeKey);

  return (
    <View style={{ gap: 8 }}>
      {formula ? (
        <View style={{ gap: 4 }}>
          <Text style={[styles.detailText, { color: captionColor(darkMode, Colors) }]}>
            Calculated quantity: {formula.roundedValue.toLocaleString()} ({formula.confidence} confidence)
          </Text>
          <Text style={[styles.detailText, { color: captionColor(darkMode, Colors) }]}>{formula.formulaExplanation}</Text>
          {onUseCalculatedQuantity ? (
            <TouchableOpacity activeOpacity={0.75} onPress={onUseCalculatedQuantity} style={styles.inlineAction}>
              <Text style={styles.inlineActionText}>Use calculated quantity</Text>
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
      {itemUnknown.length ? (
        <ScopeItemReviewDetails
          components={itemUnknown}
          Colors={Colors}
          darkMode={darkMode}
        />
      ) : null}
    </View>
  );
}

function ScopeReviewPanel({
  components,
  Colors,
  darkMode,
}: {
  components: AssemblyComponentStatus[];
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
}) {
  return (
    <View style={{ gap: 10 }}>
      {components.map((component) => (
        <View key={component.key} style={{ gap: 6 }}>
          <Text style={[styles.detailText, { color: darkMode ? '#F5F7FA' : Colors.text, fontWeight: '700' }]}>
            {component.label}
          </Text>
          <Text style={[styles.detailText, { color: captionColor(darkMode, Colors) }]}>Not confirmed</Text>
          <View style={styles.actionRow}>
            {['Included', 'Excluded', 'Priced elsewhere'].map((label) => (
              <TouchableOpacity
                key={`${component.key}-${label}`}
                activeOpacity={0.75}
                onPress={() =>
                  Alert.alert(
                    'Scope review noted',
                    `${label} for ${component.label} will be saved with inclusion metadata. No totals were changed.`
                  )
                }
                style={[styles.actionChip, { borderColor: darkMode ? 'rgba(245,158,11,0.35)' : 'rgba(245,158,11,0.28)' }]}
              >
                <Text style={styles.actionChipText}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function ScopeItemReviewDetails({
  components,
  Colors,
  darkMode,
}: {
  components: AssemblyComponentStatus[];
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
}) {
  if (!components.length) return null;
  return (
    <View style={{ gap: 8 }}>
      <Text style={[styles.detailHeading, { color: '#f59e0b' }]}>Scope review</Text>
      <ScopeReviewPanel components={components} Colors={Colors} darkMode={darkMode} />
    </View>
  );
}

export function AcceptedPricingSummary({
  display,
  intelligence,
  scopeKey,
  resolved,
  suggestedBlock,
  comparisonBlock,
  Colors,
  darkMode,
  onEditPricing,
}: {
  display: AcceptedPricingDisplay;
  intelligence: ScopeItemIntelligence;
  scopeKey: string;
  resolved: import('@/utils/scopeItemQuantities').ResolvedItemQuantity;
  suggestedBlock?: import('@/utils/scopeItemQuantities').SuggestedPricingBlock | null;
  comparisonBlock?: import('@/utils/scopeItemQuantities').SuggestedPricingBlock | null;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  onEditPricing: () => void;
}) {
  const [secondaryOpen, setSecondaryOpen] = useState(false);

  const secondaryAction = useMemo(
    () =>
      getPricingSecondaryAction({
        display,
        intelligence,
        resolved,
        suggestedBlock,
        comparisonBlock,
        scopeKey,
      }),
    [display, intelligence, resolved, suggestedBlock, comparisonBlock, scopeKey]
  );

  const secondaryDisclosure = useMemo(() => {
    if (!secondaryAction || !secondaryOpen) return null;
    return buildSecondaryDisclosureContent({
      action: secondaryAction,
      display,
      intelligence,
      resolved,
      suggestedBlock,
      comparisonBlock,
      scopeKey,
    });
  }, [secondaryAction, secondaryOpen, display, intelligence, resolved, suggestedBlock, comparisonBlock, scopeKey]);

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
            onPress={() => setSecondaryOpen((open) => !open)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ expanded: secondaryOpen }}
          >
            <Text style={styles.editLink}>{secondaryOpen ? 'Hide' : secondaryAction.label}</Text>
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
          {secondaryDisclosure.kind === 'scope_review' ? (
            <ScopeReviewPanel
              components={secondaryDisclosure.components}
              Colors={Colors}
              darkMode={darkMode}
            />
          ) : null}
        </View>
      ) : null}
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
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actionChipText: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '700',
  },
  inlineAction: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.35)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  inlineActionText: {
    color: '#22c55e',
    fontSize: 11,
    fontWeight: '700',
  },
  projectReviewCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
});
