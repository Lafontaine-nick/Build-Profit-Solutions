import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import type { EstimateAiDraft, EstimateDraftScopePackage } from '@/utils/estimateAiDraft';
import { formatDraftMoney, getScopePackages } from '@/utils/estimateAiDraft';
import {
  draftHasApplyablePricing,
} from '@/utils/estimateAiDraftPricing';
import { countUnpricedRoughPricingTiers } from '@/utils/roughPricingTiers';
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
  /** True after suggest failed, or when unpriced items have no national average. */
  roughPricingUnavailable?: boolean;
  onAddPricesManually?: () => void;
  onContinueUnpriced?: () => void;
};

const ROUGH_UNAVAILABLE_COPY =
  'Rough pricing not available, please enter amount manually';

function SuggestPricingBtn({
  label,
  onPress,
  disabled,
  loading,
  darkMode,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  darkMode: boolean;
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
        borderWidth: 1.5,
        borderColor: disabled ? 'rgba(34, 197, 94, 0.28)' : 'rgba(34, 197, 94, 0.55)',
        backgroundColor: darkMode ? 'rgba(34, 197, 94, 0.06)' : 'rgba(34, 197, 94, 0.04)',
        marginBottom: 10,
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {loading ? <ActivityIndicator size="small" color="#22c55e" /> : null}
        <Text style={{ color: '#22c55e', fontSize: 14, fontWeight: '700', textAlign: 'center' }}>
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
  roughPricingUnavailable = false,
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
  const unpricedPackages = getScopePackages(draft).filter((pkg) =>
    scopePackageNeedsManualPrice(pkg, draft)
  );
  const unpricedCount = unpricedPackages.length;
  const roughTiers = countUnpricedRoughPricingTiers(draft);
  const showRoughUnavailable =
    unpricedCount > 0 &&
    (roughPricingUnavailable || roughTiers.suggestable === 0);
  const savedRatesPrimary = showRoughUnavailable && showUseSavedPricing;
  const packageMeasurementLines = measuredScopeLines(getScopePackages(draft), draft);
  const measuredLines = packageMeasurementLines.length ? packageMeasurementLines : quickMeasurementLines(draft);
  const suggestCount =
    unpricedCount > 0 ? roughTiers.suggestable : pricingReadiness.ready;
  const roughLabel =
    suggestCount > 0
      ? hasPricing
        ? roughTiers.ready > 0 && roughTiers.planning > 0
          ? `Suggest pricing · ${roughTiers.ready} ready · ${roughTiers.planning} planning`
          : roughTiers.planning > 0 && roughTiers.ready === 0
            ? roughTiers.planning === 1
              ? 'Suggest planning price for 1 item'
              : `Suggest planning prices for ${roughTiers.planning} items`
            : suggestCount === 1
              ? 'Suggest pricing for 1 item still missing a price'
              : `Suggest pricing for ${suggestCount} items still missing a price`
        : pricingReadiness.needsMeasurement > 0
          ? `Suggest pricing for ${suggestCount} measured items`
          : 'Suggest pricing from measurements'
      : 'Add measurements to suggest pricing';
  const hasMemorySuggestions = (draft.pricingMemorySuggestions?.length ?? 0) > 0;
  const templateHints = (draft.pricingMemoryMissingSuggestions || []).filter(
    (s) => s.source === 'saved_template'
  );
  const [showReadyItems, setShowReadyItems] = useState(false);
  const statusLine = savedRatesPrimary
    ? roughTiers.manualOnly === 1
      ? 'No rough estimate for this scope — saved rates available'
      : `${roughTiers.manualOnly} scopes need manual pricing — saved rates may apply`
    : showRoughUnavailable
      ? ROUGH_UNAVAILABLE_COPY
      : unpricedCount > 0
      ? pricingReadiness.needsMeasurement > 0 && !hasPricing
        ? `${pricingReadiness.ready} ready · ${pricingReadiness.needsMeasurement} need measurements`
        : roughTiers.manualOnly > 0 && roughTiers.suggestable > 0
          ? `${unpricedCount} items still need a price · ${roughTiers.manualOnly} enter manually`
          : roughTiers.manualOnly > 0 && roughTiers.suggestable === 0
            ? roughTiers.manualOnly === 1
              ? '1 item needs manual pricing'
              : `${roughTiers.manualOnly} items need manual pricing`
            : unpricedCount === 1
              ? '1 item still needs a price'
              : `${unpricedCount} items still need a price`
      : pricingReadiness.ready > 0
        ? `${pricingReadiness.ready} ready for suggested pricing`
        : 'Add measurements in Confirm Scope to unlock pricing';

  return (
    <View style={estimateFlowCardStyle(Colors, darkMode, { marginBottom: 12 })}>
      <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '800', marginBottom: 6 }}>
        {hasPricing ? 'Finish pricing' : 'Add pricing'}
      </Text>

      {measuredLines.length > 0 && !showRoughUnavailable ? (
        <View style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <Text
              style={{
                color: darkMode ? 'rgba(148, 163, 184, 0.9)' : Colors.sub,
                fontSize: 12,
                fontWeight: '600',
                flex: 1,
              }}
            >
              {statusLine}
            </Text>
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => setShowReadyItems((open) => !open)}
              accessibilityRole="button"
            >
              <Text style={{ color: '#93c5fd', fontSize: 12, fontWeight: '600' }}>
                {showReadyItems ? 'Hide' : 'Show'}
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
      ) : (
        <Text
          style={{
            color: showRoughUnavailable && !savedRatesPrimary
              ? darkMode
                ? 'rgba(251, 191, 36, 0.95)'
                : '#b45309'
              : Colors.sub,
            fontSize: 12,
            lineHeight: 17,
            marginBottom: 10,
            fontWeight: showRoughUnavailable && !savedRatesPrimary ? '600' : '400',
          }}
        >
          {statusLine}
        </Text>
      )}

      {savedRatesPrimary ? (
        <SuggestPricingBtn
          label="Apply saved rates"
          onPress={onUseSavedPricing}
          disabled={busy}
          loading={suggestingMissingPrices}
          darkMode={darkMode}
        />
      ) : showRoughUnavailable ? null : (
        <SuggestPricingBtn
          label={roughLabel}
          onPress={suggestCount > 0 ? onSuggestRoughPrices : onAddPricesManually}
          disabled={busy || (suggestCount === 0 && !onAddPricesManually)}
          loading={roughRangeLoading}
          darkMode={darkMode}
        />
      )}
      {draft.roughEstimate ? (
        <Text style={{ color: Colors.sub, fontSize: 11, marginBottom: 6, marginTop: -2 }}>
          Rough range: {formatDraftMoney(draft.roughEstimate.low)} –{' '}
          {formatDraftMoney(draft.roughEstimate.high)}
        </Text>
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 14,
          marginTop: 2,
        }}
      >
        {showUseSavedPricing && !savedRatesPrimary ? (
          <SecondaryLink
            label="Saved rates"
            onPress={onUseSavedPricing}
            disabled={busy}
            loading={suggestingMissingPrices}
          />
        ) : null}
        <SecondaryLink
          label={showRoughUnavailable ? 'Enter amount manually' : 'Add manually'}
          onPress={onAddPricesManually}
          disabled={busy}
          color={darkMode ? 'rgba(226, 232, 240, 0.85)' : Colors.text}
        />
      </View>
      {showUseSavedPricing && templateHints.length > 0 ? (
        <Text style={{ color: Colors.sub, fontSize: 11, textAlign: 'center', marginTop: 4 }}>
          {templateHints.length} match{templateHints.length === 1 ? '' : 'es'} from your saved template
        </Text>
      ) : showUseSavedPricing && hasMemorySuggestions ? (
        <Text style={{ color: Colors.sub, fontSize: 11, textAlign: 'center', marginTop: 4 }}>
          Based on your saved pricing — approve before applying
        </Text>
      ) : showUseSavedPricing && draft.pricingMemoryMessage ? (
        <Text style={{ color: Colors.sub, fontSize: 11, textAlign: 'center', marginTop: 4 }}>
          {draft.pricingMemoryMessage}
        </Text>
      ) : null}
    </View>
  );
}
