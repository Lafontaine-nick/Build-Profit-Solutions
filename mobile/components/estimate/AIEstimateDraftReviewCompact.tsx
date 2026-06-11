import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { EstimateAiDraft } from '@/utils/estimateAiDraft';
import { formatDraftMoney, getScopePackages } from '@/utils/estimateAiDraft';
import {
  compactPackageAmount,
  compactPackageStatusLabel,
  dedupeMissingPriceSuggestions,
  formatScopeQuantity,
  getCompactProjectSummary,
  getCompactStillNeeded,
  getUniformStatusLabel,
  pendingProposalCalculatedTotal,
  scopePackageNeedsManualPrice,
  scopePackagePricingHint,
  SCOPE_LIST_DEFAULT_LIMIT,
  shouldHidePerRowStatus,
} from '@/utils/estimateDraftReviewUi';
import { draftHasApplyablePricing } from '@/utils/estimateAiDraftPricing';
import type { EstimateConfidenceLevel } from '@/utils/estimateAiDraft';
import { estimateFlowCardStyle, estimateFlowDividerColor } from '@/utils/estimateFlowCardStyle';

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
  onSuggestMissingPrices?: () => void;
  suggestingMissingPrices?: boolean;
  onPriceScopeItem?: (packageName: string) => void;
  onRegenerate: () => void;
  showDetailsContent: React.ReactNode;
};

const SCOPE_CARD_INSET = 14;
const flowCard = (Colors: Colors, darkMode: boolean) =>
  estimateFlowCardStyle(Colors, darkMode, { marginBottom: 12 });
const flowDivider = (darkMode: boolean) => estimateFlowDividerColor(darkMode);

export default function AIEstimateDraftReviewCompact({
  draft,
  Colors,
  darkMode,
  busy,
  confStyle,
  onSuggestMissingPrices,
  suggestingMissingPrices,
  onPriceScopeItem,
  onRegenerate,
  showDetailsContent,
}: Props) {
  const [showDetails, setShowDetails] = useState(false);
  const [showAllScope, setShowAllScope] = useState(false);
  const scopePackages = getScopePackages(draft);
  const stillNeeded = getCompactStillNeeded(draft, 5);
  const hasPricing = draftHasApplyablePricing(draft);
  const statedTotal = draft.statedTotal ?? draft.totalValidation?.statedTotal;
  const pendingTotal = pendingProposalCalculatedTotal(draft);
  const calculatedTotal =
    draft.calculatedLineItemTotal ??
    draft.calculatedTotal ??
    draft.totalValidation?.calculatedLineItemsTotal ??
    (pendingTotal > 0 ? pendingTotal : null);
  const partialCount = scopePackages.filter((p) => p.status === 'partial_pricing').length;
  const missingPriceCount = scopePackages.filter((p) => p.status === 'missing_price').length;
  const hideRowStatus = shouldHidePerRowStatus(scopePackages);
  const uniformStatusLabel = getUniformStatusLabel(scopePackages);
  const visibleScope = showAllScope
    ? scopePackages
    : scopePackages.slice(0, SCOPE_LIST_DEFAULT_LIMIT);
  const hiddenScopeCount = Math.max(0, scopePackages.length - SCOPE_LIST_DEFAULT_LIMIT);
  const showSuggestPrices = Boolean(onSuggestMissingPrices && (missingPriceCount > 0 || partialCount > 0));
  const roughSuggestionLines = dedupeMissingPriceSuggestions(
    draft.pricingMemoryMissingSuggestions || [],
    6
  );
  const hasRoughOnScope = scopePackages.some((p) => p.status === 'rough_price');

  return (
    <>
      {draft.estimateConfidence ? (
        <View
          style={{
            ...flowCard(Colors, darkMode),
            backgroundColor: confStyle.bg,
          }}
        >
          <Text style={{ color: confStyle.color, fontSize: 13, fontWeight: '800' }}>
            {draft.estimateConfidence.label}
          </Text>
          <Text style={{ color: Colors.text, fontSize: 13, marginTop: 4, lineHeight: 18 }} numberOfLines={2}>
            {hasPricing
              ? draft.estimateConfidence.summary
              : 'Scope and quantities found. Confirm items below, then add or apply pricing.'}
          </Text>
        </View>
      ) : null}

      <View style={flowCard(Colors, darkMode)}>
        <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '800', marginBottom: 4 }}>
          {getCompactProjectSummary(draft)}
        </Text>
        {draft.projectAddress ? (
          <Text style={{ color: Colors.sub, fontSize: 12, marginBottom: 4 }} numberOfLines={1}>
            {draft.projectAddress}
          </Text>
        ) : null}
        {statedTotal != null && statedTotal > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <Text style={{ color: Colors.sub, fontSize: 13 }}>Bid total in notes:</Text>
            <Text style={{ color: '#22c55e', fontSize: 15, fontWeight: '800' }}>
              {formatDraftMoney(statedTotal)}
            </Text>
            {draft.totalMatches === true ? (
              <MaterialIcons name="check-circle" size={16} color="#22c55e" />
            ) : null}
          </View>
        ) : calculatedTotal != null && calculatedTotal > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <Text style={{ color: Colors.sub, fontSize: 13 }}>Calculated total:</Text>
            <Text style={{ color: '#22c55e', fontSize: 15, fontWeight: '800' }}>
              {formatDraftMoney(calculatedTotal)}
            </Text>
          </View>
        ) : null}
        {uniformStatusLabel ? (
          <Text style={{ color: '#60a5fa', fontSize: 12, marginTop: 6 }}>{uniformStatusLabel}</Text>
        ) : partialCount > 0 ? (
          <Text style={{ color: '#60a5fa', fontSize: 12, marginTop: 6 }}>
            {partialCount} item{partialCount === 1 ? '' : 's'} need more pricing
          </Text>
        ) : null}
      </View>

      <View style={flowCard(Colors, darkMode)}>
        <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '800', marginBottom: 10 }}>
          Scope ({scopePackages.length})
        </Text>
        {missingPriceCount > 0 ? (
          <Text style={{ color: Colors.sub, fontSize: 12, lineHeight: 17, marginBottom: 10 }}>
            Tap any <Text style={{ fontWeight: '700', color: '#fbbf24' }}>Needs price</Text> item to
            enter a price before applying.
          </Text>
        ) : null}
        {visibleScope.map((pkg, index) => {
          const qty = formatScopeQuantity(pkg);
          const amount = compactPackageAmount(pkg, draft);
          const statusLabel = compactPackageStatusLabel(pkg, draft);
          const hint = !amount ? scopePackagePricingHint(pkg) : null;
          const needsPrice = scopePackageNeedsManualPrice(pkg, draft);
          const showStatus =
            !hideRowStatus &&
            amount &&
            pkg.status !== 'user_provided' &&
            pkg.status !== 'confirmed' &&
            statusLabel !== 'Confirmed';
          const rowBody = (
            <>
              <Text style={{ color: Colors.sub, fontSize: 13, width: 20 }}>{index + 1}.</Text>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700' }} numberOfLines={2}>
                  {pkg.name}
                </Text>
                {qty ? (
                  <Text style={{ color: Colors.sub, fontSize: 12, marginTop: 2 }}>{qty}</Text>
                ) : hint ? (
                  <Text style={{ color: Colors.sub, fontSize: 12, marginTop: 2 }}>{hint}</Text>
                ) : null}
                {needsPrice ? (
                  <Text style={{ color: '#60a5fa', fontSize: 11, marginTop: 4, fontWeight: '600' }}>
                    Tap to add price
                  </Text>
                ) : null}
              </View>
              <View style={{ alignItems: 'flex-end', maxWidth: '42%' }}>
                {amount ? (
                  <Text style={{ color: '#22c55e', fontSize: 14, fontWeight: '800' }}>{amount}</Text>
                ) : (
                  <Text style={{ color: needsPrice ? '#fbbf24' : Colors.sub, fontSize: 12, fontWeight: needsPrice ? '700' : '400' }}>
                    {statusLabel}
                  </Text>
                )}
                {showStatus ? (
                  <Text style={{ color: Colors.sub, fontSize: 10, marginTop: 2 }}>{statusLabel}</Text>
                ) : null}
              </View>
            </>
          );
          return needsPrice && onPriceScopeItem ? (
            <TouchableOpacity
              key={`scope-${pkg.name}-${index}`}
              activeOpacity={0.88}
              disabled={busy}
              onPress={() => onPriceScopeItem(pkg.name)}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 10,
                marginHorizontal: -SCOPE_CARD_INSET,
                paddingHorizontal: SCOPE_CARD_INSET,
                paddingVertical: 10,
                borderTopWidth: index > 0 ? StyleSheet.hairlineWidth : 0,
                borderTopColor: flowDivider(darkMode),
                backgroundColor: darkMode ? 'rgba(251,191,36,0.08)' : 'rgba(251,191,36,0.06)',
              }}
            >
              {rowBody}
            </TouchableOpacity>
          ) : (
            <View
              key={`scope-${pkg.name}-${index}`}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 10,
                paddingVertical: 10,
                borderTopWidth: index > 0 ? StyleSheet.hairlineWidth : 0,
                borderTopColor: flowDivider(darkMode),
              }}
            >
              {rowBody}
            </View>
          );
        })}
        {hiddenScopeCount > 0 && !showAllScope ? (
          <TouchableOpacity activeOpacity={0.88} onPress={() => setShowAllScope(true)} style={{ marginTop: 8 }}>
            <Text style={{ color: '#60a5fa', fontSize: 13, fontWeight: '700', textAlign: 'center' }}>
              Show all {scopePackages.length} items
            </Text>
          </TouchableOpacity>
        ) : null}
        {showAllScope && hiddenScopeCount > 0 ? (
          <TouchableOpacity activeOpacity={0.88} onPress={() => setShowAllScope(false)} style={{ marginTop: 8 }}>
            <Text style={{ color: Colors.sub, fontSize: 12, fontWeight: '600', textAlign: 'center' }}>
              Show less
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {roughSuggestionLines.length > 0 || hasRoughOnScope ? (
        <View
          style={{
            ...flowCard(Colors, darkMode),
            borderColor: 'rgba(251, 191, 36, 0.35)',
            backgroundColor: darkMode ? 'rgba(251, 191, 36, 0.08)' : 'rgba(251, 191, 36, 0.06)',
          }}
        >
          <Text style={{ color: '#fbbf24', fontSize: 13, fontWeight: '800', marginBottom: 6 }}>
            AI price suggestions
          </Text>
          <Text style={{ color: Colors.sub, fontSize: 12, lineHeight: 18, marginBottom: 8 }}>
            {draft.pricingMemoryMissingMessage ||
              'Rates for items still missing template pricing — review before applying to your bid.'}
          </Text>
          {roughSuggestionLines.map((line, i) => (
            <Text key={`sug-${i}`} style={{ color: Colors.text, fontSize: 12, marginBottom: 4 }}>
              • {line}
            </Text>
          ))}
        </View>
      ) : null}

      {stillNeeded.items.length > 0 ? (
        <View style={flowCard(Colors, darkMode)}>
          <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '800', marginBottom: 8 }}>
            Still needed
          </Text>
          {stillNeeded.items
            .filter((item) => !/finish pricing on partial scope/i.test(item))
            .map((item, i) => (
              <Text key={`need-${i}`} style={{ color: Colors.sub, fontSize: 13, marginBottom: 4, lineHeight: 18 }}>
                • {item}
              </Text>
            ))}
          {stillNeeded.overflow > 0 ? (
            <Text style={{ color: '#60a5fa', fontSize: 12, marginTop: 2 }}>
              + {stillNeeded.overflow} more in details
            </Text>
          ) : null}
        </View>
      ) : null}

      {showSuggestPrices ? (
        <TouchableOpacity
          activeOpacity={0.88}
          disabled={busy}
          onPress={onSuggestMissingPrices}
          style={{
            marginBottom: 12,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#60a5fa',
            opacity: busy ? 0.5 : 1,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {suggestingMissingPrices ? (
              <ActivityIndicator size="small" color="#60a5fa" />
            ) : (
              <MaterialIcons name="lightbulb-outline" size={16} color="#60a5fa" />
            )}
            <Text style={{ color: '#60a5fa', fontSize: 14, fontWeight: '700' }}>Suggest missing prices</Text>
          </View>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => setShowDetails((v) => !v)}
        style={{ marginBottom: showDetails ? 10 : 4, alignItems: 'center' }}
      >
        <Text style={{ color: '#60a5fa', fontSize: 13, fontWeight: '700' }}>
          {showDetails ? 'Hide details' : 'View details'}
        </Text>
      </TouchableOpacity>

      {showDetails ? showDetailsContent : null}

      <TouchableOpacity activeOpacity={0.88} disabled={busy} onPress={onRegenerate} style={{ marginTop: 8 }}>
        <Text style={{ color: Colors.sub, fontSize: 13, fontWeight: '600', textAlign: 'center' }}>
          Edit notes & regenerate
        </Text>
      </TouchableOpacity>
    </>
  );
}
