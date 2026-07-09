import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import type { EstimateAiDraft, EstimateDraftScopePackage } from '@/utils/estimateAiDraft';
import { formatDraftMoney, getScopePackages } from '@/utils/estimateAiDraft';
import { draftHasApplyablePricing } from '@/utils/estimateAiDraftPricing';
import { countDraftPricingReadiness } from '@/utils/scopeItemQuantities';
import { formatScopeQuantity, scopePackageNeedsManualPrice } from '@/utils/estimateDraftReviewUi';
import AIEstimateSavedPricingApplySummary from '@/components/estimate/AIEstimateSavedPricingApplySummary';
import { estimateFlowCardStyle } from '@/utils/estimateFlowCardStyle';

type Colors = {
  text: string;
  sub: string;
  line: string;
  surface2: string;
};

type Props = {
  draft: EstimateAiDraft;
  Colors: Colors;
  darkMode: boolean;
  busy: boolean;
  showUseSavedPricing?: boolean;
  onUseSavedPricing?: () => void;
  suggestingMissingPrices?: boolean;
  onSuggestRoughPrices?: () => void;
  roughRangeLoading?: boolean;
  onAddPricesManually?: () => void;
  onContinueUnpriced?: () => void;
};

function ActionBtn({
  label,
  onPress,
  disabled,
  color = '#60a5fa',
  loading,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  color?: string;
  loading?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      disabled={disabled || !onPress}
      onPress={onPress}
      style={{
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: color,
        marginBottom: 8,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {loading ? <ActivityIndicator size="small" color={color} /> : null}
        <Text style={{ color, fontSize: 14, fontWeight: '700', textAlign: 'center' }}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

function measuredScopeLines(
  packages: EstimateDraftScopePackage[],
  draft: EstimateAiDraft
): string[] {
  return packages
    .filter((pkg) => scopePackageNeedsManualPrice(pkg, draft))
    .map((pkg) => {
      const qty = formatScopeQuantity(pkg);
      return qty ? `${pkg.name}: ${qty}` : null;
    })
    .filter(Boolean)
    .slice(0, 5) as string[];
}

function quickMeasurementLines(draft: EstimateAiDraft): string[] {
  const measurements = draft.scopeMeasurements || {};
  const rows: Array<[string, unknown, string]> = [
    ['Excavation', measurements.excavationCy, 'CY'],
    ['Foundation concrete', measurements.concreteCy, 'CY'],
    ['Concrete flatwork', measurements.concreteSqft, 'sqft'],
    ['Drywall', measurements.drywallSqft, 'sqft'],
    ['Interior paint', measurements.wallPaintSqft, 'sqft'],
    ['Flooring', measurements.floorAreaSqft, 'sqft'],
    ['Baseboards / trim', measurements.baseboardLf, 'LF'],
  ];
  return rows
    .map(([label, value, unit]) => {
      const n = Number(value || 0);
      return Number.isFinite(n) && n > 0 ? `${label}: ${n.toLocaleString()} ${unit}` : null;
    })
    .filter(Boolean)
    .slice(0, 6) as string[];
}

export default function AIEstimateDraftReviewPricingActions({
  draft,
  Colors,
  darkMode,
  busy,
  showUseSavedPricing = false,
  onUseSavedPricing,
  suggestingMissingPrices,
  onSuggestRoughPrices,
  roughRangeLoading,
  onAddPricesManually,
  onContinueUnpriced,
}: Props) {
  if (draft.savedPricingApplySummary) {
    return (
      <AIEstimateSavedPricingApplySummary
        draft={draft}
        Colors={Colors}
        darkMode={darkMode}
        busy={busy}
        onSuggestRoughPrices={onSuggestRoughPrices}
        roughRangeLoading={roughRangeLoading}
        onAddPricesManually={onAddPricesManually}
        onContinueUnpriced={onContinueUnpriced}
      />
    );
  }

  const hasPricing = draftHasApplyablePricing(draft);
  const pricingReadiness = countDraftPricingReadiness(draft);
  const packageMeasurementLines = measuredScopeLines(getScopePackages(draft), draft);
  const measuredLines = packageMeasurementLines.length ? packageMeasurementLines : quickMeasurementLines(draft);
  const roughLabel =
    pricingReadiness.ready > 0
      ? pricingReadiness.needsMeasurement > 0
        ? `Suggest pricing for ${pricingReadiness.ready} measured items`
        : 'Suggest pricing from measurements'
      : 'Add measurements to suggest pricing';
  const roughHint =
    pricingReadiness.ready === 0
      ? 'Enter sqft, LF, CY, counts, or allowances in Confirm Scope first. Then suggested pricing can calculate material, labor, and totals.'
      : pricingReadiness.needsMeasurement > 0
      ? `${pricingReadiness.needsMeasurement} item${pricingReadiness.needsMeasurement === 1 ? '' : 's'} need measurements first — only ready items will be priced.`
      : 'Suggested pricing uses these measurements and stays review-only until you approve.';
  const hasMemorySuggestions = (draft.pricingMemorySuggestions?.length ?? 0) > 0;
  const templateHints = (draft.pricingMemoryMissingSuggestions || []).filter(
    (s) => s.source === 'saved_template'
  );
  const [showReadyItems, setShowReadyItems] = useState(false);

  return (
    <View style={estimateFlowCardStyle(Colors, darkMode, { marginBottom: 12 })}>
      <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '800', marginBottom: 6 }}>
        {hasPricing ? 'Finish pricing' : 'No pricing found yet'}
      </Text>
      <Text style={{ color: Colors.sub, fontSize: 13, lineHeight: 18, marginBottom: 12 }}>
        {hasPricing
          ? showUseSavedPricing
            ? 'Some scope items still need prices. Apply saved template rates, use AI rough estimates, or enter manually.'
            : 'Some scope items still need prices. Confirmed scope prices are already applied — use suggested pricing or enter manually.'
          : pricingReadiness.ready > 0
            ? 'I found scope measurements, but no material or labor prices. Use suggested pricing to calculate totals.'
            : 'I found the scope, but pricing needs measurements like sqft, LF, CY, counts, or allowances first.'}
      </Text>

      {measuredLines.length > 0 ? (
        <View
          style={{
            marginBottom: 10,
            padding: 10,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: darkMode ? 'rgba(34, 197, 94, 0.22)' : 'rgba(34, 197, 94, 0.2)',
            backgroundColor: 'transparent',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <Text style={{ color: '#22c55e', fontSize: 12, fontWeight: '800', flex: 1 }}>
              Ready for suggested pricing · {measuredLines.length}
            </Text>
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => setShowReadyItems((open) => !open)}
              accessibilityRole="button"
            >
              <Text style={{ color: '#60a5fa', fontSize: 12, fontWeight: '700' }}>
                {showReadyItems ? 'Hide' : 'Show items'}
              </Text>
            </TouchableOpacity>
          </View>
          {showReadyItems
            ? measuredLines.map((line, index) => (
                <Text
                  key={`measured-${index}`}
                  style={{ color: Colors.text, fontSize: 12, marginTop: index === 0 ? 8 : 3 }}
                >
                  • {line}
                </Text>
              ))
            : null}
        </View>
      ) : null}

      {showUseSavedPricing ? (
        <>
          <ActionBtn
            label="Apply my saved rates"
            onPress={onUseSavedPricing}
            disabled={busy}
            loading={suggestingMissingPrices}
          />
          {templateHints.length > 0 ? (
            <View
              style={{
                marginBottom: 8,
                marginTop: -4,
                padding: 10,
                borderRadius: 10,
                backgroundColor: darkMode ? 'rgba(96, 165, 250, 0.1)' : 'rgba(59, 130, 246, 0.08)',
              }}
            >
              <Text style={{ color: '#60a5fa', fontSize: 11, fontWeight: '700', marginBottom: 4 }}>
                Matched from saved bid template
              </Text>
              {templateHints.slice(0, 4).map((s, i) => (
                <Text key={`tpl-${i}`} style={{ color: Colors.sub, fontSize: 11, marginBottom: 2 }}>
                  • {s.scopeItemName}: {formatDraftMoney(s.suggestedAmount)}
                  {s.sourceLabel ? ` (${s.sourceLabel})` : ''}
                </Text>
              ))}
              <Text style={{ color: Colors.sub, fontSize: 11, marginTop: 4 }}>
                Tap Apply my saved rates to use unit rates from your template (e.g. tile demo $/sqft).
              </Text>
            </View>
          ) : hasMemorySuggestions ? (
            <Text style={{ color: Colors.sub, fontSize: 11, marginBottom: 8, marginTop: -4 }}>
              Based on your saved pricing — approve before applying.
            </Text>
          ) : draft.pricingMemoryMessage ? (
            <Text style={{ color: Colors.sub, fontSize: 11, marginBottom: 8, marginTop: -4 }}>
              {draft.pricingMemoryMessage}
            </Text>
          ) : null}
        </>
      ) : null}

      <ActionBtn
        label={roughLabel}
        onPress={onSuggestRoughPrices}
        disabled={busy || pricingReadiness.ready === 0}
        color="#fbbf24"
        loading={roughRangeLoading}
      />
      {draft.roughEstimate ? (
        <Text style={{ color: '#fbbf24', fontSize: 12, marginBottom: 8 }}>
          AI Rough Estimate: {formatDraftMoney(draft.roughEstimate.low)} –{' '}
          {formatDraftMoney(draft.roughEstimate.high)} (review required)
        </Text>
      ) : (
        <Text style={{ color: Colors.sub, fontSize: 11, marginBottom: 8, marginTop: -4 }}>
          {roughHint}
        </Text>
      )}

      <ActionBtn
        label="Add prices manually"
        onPress={onAddPricesManually}
        disabled={busy}
        color={Colors.text}
      />
      <Text style={{ color: Colors.sub, fontSize: 11, textAlign: 'center' }}>
        Enter unit rates or lump sums for each scope item
      </Text>
    </View>
  );
}
