import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { EstimateAiDraft } from '@/utils/estimateAiDraft';
import { formatDraftMoney, getScopePackages } from '@/utils/estimateAiDraft';
import {
  formatScopeQuantity,
  getStillNeededList,
  scopePackagePricingHint,
} from '@/utils/estimateDraftReviewUi';
import { draftHasApplyablePricing } from '@/utils/estimateAiDraftPricing';
import { draftHasUnpricedScope } from '@/utils/estimateDraftReviewUi';
import type { EstimateConfidenceLevel } from '@/utils/estimateAiDraft';
import AIEstimateDraftReviewPricingActions from '@/components/estimate/AIEstimateDraftReviewPricingActions';

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
  onUseSavedPricing?: () => void;
  suggestingMissingPrices?: boolean;
  onSuggestRoughPrices?: () => void;
  roughRangeLoading?: boolean;
  onAddPricesManually?: () => void;
  onRegenerate: () => void;
  showDetailsContent: React.ReactNode;
};

export default function AIEstimateDraftReviewScopeOnly({
  draft,
  Colors,
  darkMode,
  busy,
  confStyle,
  onUseSavedPricing,
  suggestingMissingPrices,
  onSuggestRoughPrices,
  roughRangeLoading,
  onAddPricesManually,
  onRegenerate,
  showDetailsContent,
}: Props) {
  const [showDetails, setShowDetails] = useState(false);
  const scopePackages = getScopePackages(draft);
  const stillNeeded = getStillNeededList(draft);
  const hasPricing = draftHasApplyablePricing(draft);
  const hasUnpriced = draftHasUnpricedScope(draft);
  const showPricingActions = hasUnpriced || !hasPricing;
  const proposal = draft.pendingPricingProposal;

  return (
    <>
      {draft.estimateConfidence ? (
        <View
          style={{
            marginBottom: 12,
            padding: 14,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: darkMode ? 'rgba(255,255,255,0.08)' : Colors.line,
            backgroundColor: confStyle.bg,
          }}
        >
          <Text style={{ color: confStyle.color, fontSize: 13, fontWeight: '800' }}>
            {draft.estimateConfidence.label}
          </Text>
          <Text style={{ color: Colors.text, fontSize: 13, marginTop: 4, lineHeight: 18 }}>
            {hasPricing
              ? draft.estimateConfidence?.summary || 'Pricing added — review and apply to your estimate.'
              : 'Scope and quantities found. Pricing still needed.'}
          </Text>
        </View>
      ) : null}

      {hasPricing && proposal && !proposal.empty ? (
        <View
          style={{
            marginBottom: 12,
            padding: 14,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: 'rgba(34, 197, 94, 0.35)',
            backgroundColor: darkMode ? 'rgba(34, 197, 94, 0.08)' : 'rgba(34, 197, 94, 0.06)',
          }}
        >
          <Text style={{ color: '#22c55e', fontSize: 12, fontWeight: '800', marginBottom: 8 }}>
            {proposal.sourceLabel}
          </Text>
          {proposal.lines.slice(0, 12).map((line, i) => (
            <Text key={`pl-${i}`} style={{ color: Colors.text, fontSize: 12, marginBottom: 4 }}>
              {line.packageName}: {line.formula}
            </Text>
          ))}
          <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '800', marginTop: 8 }}>
            Total: {formatDraftMoney(proposal.totalSuggested)}
          </Text>
        </View>
      ) : null}

      {showPricingActions ? (
        <AIEstimateDraftReviewPricingActions
          draft={draft}
          Colors={Colors}
          darkMode={darkMode}
          busy={busy}
          onUseSavedPricing={onUseSavedPricing}
          suggestingMissingPrices={suggestingMissingPrices}
          onSuggestRoughPrices={onSuggestRoughPrices}
          roughRangeLoading={roughRangeLoading}
          onAddPricesManually={onAddPricesManually}
        />
      ) : null}

      {(draft.pricingMemorySuggestions?.length ?? 0) > 0 ? (
        <View
          style={{
            marginBottom: 12,
            padding: 14,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: 'rgba(96, 165, 250, 0.35)',
            backgroundColor: darkMode ? 'rgba(96, 165, 250, 0.08)' : 'rgba(59, 130, 246, 0.06)',
          }}
        >
          <Text style={{ color: '#60a5fa', fontSize: 12, fontWeight: '800', marginBottom: 8 }}>
            Based on your saved pricing
          </Text>
          {draft.pricingMemorySuggestions!.slice(0, 5).map((s, i) => (
            <Text key={`pms-${i}`} style={{ color: Colors.text, fontSize: 13, marginBottom: 4 }}>
              • {s.scopeItemName}: ${s.suggestedUnitRate}/{s.unitType}
            </Text>
          ))}
        </View>
      ) : null}

      <View
        style={{
          marginBottom: 12,
          padding: 14,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: darkMode ? 'rgba(255,255,255,0.08)' : Colors.line,
          backgroundColor: darkMode ? 'rgba(255,255,255,0.03)' : Colors.surface2,
        }}
      >
        <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '800', marginBottom: 10 }}>
          Scope found
        </Text>
        {scopePackages.map((pkg, index) => {
          const qty = formatScopeQuantity(pkg);
          return (
            <View
              key={`scope-${pkg.name}-${index}`}
              style={{
                marginBottom: index < scopePackages.length - 1 ? 10 : 0,
                paddingBottom: index < scopePackages.length - 1 ? 10 : 0,
                borderBottomWidth: index < scopePackages.length - 1 ? StyleSheet.hairlineWidth : 0,
                borderBottomColor: darkMode ? 'rgba(255,255,255,0.08)' : Colors.line,
              }}
            >
              <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700' }}>
                {index + 1}. {pkg.name}
              </Text>
              <Text style={{ color: Colors.sub, fontSize: 13, marginTop: 4 }}>
                {qty ? `${qty} • ` : ''}
                {scopePackagePricingHint(pkg)}
              </Text>
            </View>
          );
        })}
      </View>

      {stillNeeded.length > 0 ? (
        <View
          style={{
            marginBottom: 12,
            padding: 14,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: darkMode ? 'rgba(255,255,255,0.08)' : Colors.line,
            backgroundColor: darkMode ? 'rgba(255,255,255,0.03)' : Colors.surface2,
          }}
        >
          <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '800', marginBottom: 8 }}>
            Still needed
          </Text>
          {stillNeeded.map((item, i) => (
            <Text key={`need-${i}`} style={{ color: Colors.sub, fontSize: 13, marginBottom: 4 }}>
              • {item}
            </Text>
          ))}
        </View>
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
