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

function PrimaryActionBtn({
  label,
  onPress,
  disabled,
  loading,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      disabled={disabled || !onPress}
      onPress={onPress}
      style={{
        paddingVertical: 13,
        paddingHorizontal: 14,
        borderRadius: 12,
        backgroundColor: disabled ? 'rgba(34, 197, 94, 0.28)' : '#22c55e',
        marginBottom: 10,
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {loading ? <ActivityIndicator size="small" color="#052e16" /> : null}
        <Text style={{ color: '#052e16', fontSize: 14, fontWeight: '800', textAlign: 'center' }}>
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function SecondaryLink({
  label,
  onPress,
  disabled,
  loading,
  color = '#93c5fd',
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  color?: string;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={disabled || !onPress}
      onPress={onPress}
      style={{ opacity: disabled ? 0.45 : 1, paddingVertical: 6 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        {loading ? <ActivityIndicator size="small" color={color} /> : null}
        <Text style={{ color, fontSize: 13, fontWeight: '600', textAlign: 'center' }}>{label}</Text>
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
      ? 'Enter measurements in Confirm Scope first, then suggest pricing.'
      : pricingReadiness.needsMeasurement > 0
      ? `${pricingReadiness.needsMeasurement} item${pricingReadiness.needsMeasurement === 1 ? '' : 's'} need measurements first.`
      : 'Suggested pricing stays review-only until you approve.';
  const hasMemorySuggestions = (draft.pricingMemorySuggestions?.length ?? 0) > 0;
  const templateHints = (draft.pricingMemoryMissingSuggestions || []).filter(
    (s) => s.source === 'saved_template'
  );
  const [showReadyItems, setShowReadyItems] = useState(false);
  const headerCopy = hasPricing
    ? 'Some items still need prices.'
    : pricingReadiness.ready > 0
      ? 'Measurements found — suggest pricing to calculate totals.'
      : 'Add measurements in Confirm Scope to unlock suggested pricing.';

  return (
    <View style={estimateFlowCardStyle(Colors, darkMode, { marginBottom: 12 })}>
      <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '800', marginBottom: 4 }}>
        {hasPricing ? 'Finish pricing' : 'No pricing found yet'}
      </Text>
      <Text style={{ color: Colors.sub, fontSize: 12, lineHeight: 17, marginBottom: 12 }}>
        {headerCopy}
      </Text>

      {measuredLines.length > 0 ? (
        <View style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <Text style={{ color: darkMode ? 'rgba(148, 163, 184, 0.9)' : Colors.sub, fontSize: 12, fontWeight: '600', flex: 1 }}>
              Ready for suggested pricing · {measuredLines.length}
            </Text>
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => setShowReadyItems((open) => !open)}
              accessibilityRole="button"
            >
              <Text style={{ color: '#93c5fd', fontSize: 12, fontWeight: '600' }}>
                {showReadyItems ? 'Hide' : 'Show items'}
              </Text>
            </TouchableOpacity>
          </View>
          {showReadyItems
            ? measuredLines.map((line, index) => (
                <Text
                  key={`measured-${index}`}
                  style={{ color: Colors.sub, fontSize: 12, marginTop: index === 0 ? 8 : 3 }}
                >
                  • {line}
                </Text>
              ))
            : null}
        </View>
      ) : null}

      <PrimaryActionBtn
        label={roughLabel}
        onPress={onSuggestRoughPrices}
        disabled={busy || pricingReadiness.ready === 0}
        loading={roughRangeLoading}
      />
      {draft.roughEstimate ? (
        <Text style={{ color: Colors.sub, fontSize: 11, marginBottom: 8, marginTop: -4 }}>
          Rough range: {formatDraftMoney(draft.roughEstimate.low)} –{' '}
          {formatDraftMoney(draft.roughEstimate.high)} (review required)
        </Text>
      ) : (
        <Text style={{ color: Colors.sub, fontSize: 11, marginBottom: 8, marginTop: -4 }}>
          {roughHint}
        </Text>
      )}

      <View style={{ gap: 2, marginTop: 2 }}>
        {showUseSavedPricing ? (
          <>
            <SecondaryLink
              label="Apply my saved rates"
              onPress={onUseSavedPricing}
              disabled={busy}
              loading={suggestingMissingPrices}
            />
            {templateHints.length > 0 ? (
              <Text style={{ color: Colors.sub, fontSize: 11, textAlign: 'center', marginBottom: 2 }}>
                {templateHints.length} match{templateHints.length === 1 ? '' : 'es'} from your saved template
              </Text>
            ) : hasMemorySuggestions ? (
              <Text style={{ color: Colors.sub, fontSize: 11, textAlign: 'center', marginBottom: 2 }}>
                Based on your saved pricing — approve before applying
              </Text>
            ) : draft.pricingMemoryMessage ? (
              <Text style={{ color: Colors.sub, fontSize: 11, textAlign: 'center', marginBottom: 2 }}>
                {draft.pricingMemoryMessage}
              </Text>
            ) : null}
          </>
        ) : null}
        <SecondaryLink
          label="Add prices manually"
          onPress={onAddPricesManually}
          disabled={busy}
          color={darkMode ? 'rgba(226, 232, 240, 0.85)' : Colors.text}
        />
      </View>
    </View>
  );
}
