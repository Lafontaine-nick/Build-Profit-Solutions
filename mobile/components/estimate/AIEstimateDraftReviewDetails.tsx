import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import type { EstimateAiDraft } from '@/utils/estimateAiDraft';
import { formatDraftMoney, getScopePackages } from '@/utils/estimateAiDraft';
import {
  compactNeedsReviewForDisplay,
  dedupeMissingPriceSuggestions,
  draftHasUnpricedScope,
  getStillNeededList,
  groupGenericMissingScopeItems,
  summarizePricingWarnings,
  summarizeWhatAiDidForDisplay,
} from '@/utils/estimateDraftReviewUi';
import { estimateFlowCardStyle } from '@/utils/estimateFlowCardStyle';

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
  warnings: string[];
  needsReview: string[];
  clarifyQuestions?: string[] | null;
  onApplyScopeOnly?: () => void;
  onClarifyMissing?: () => void;
  onRequestRoughRange?: () => void;
  roughRangeLoading?: boolean;
  markupPct?: number;
};

const flowCard = (Colors: Colors, darkMode: boolean) =>
  estimateFlowCardStyle(Colors, darkMode, { marginBottom: 10 });

const REDUNDANT_STILL_NEEDED =
  /labor vs material breakdown per room|suggest material.*labor split|combined prices\)|flooring labor and materials|demo \/ removal/i;

function canonicalStillNeededKey(item: string): string {
  const k = item.trim().toLowerCase();
  if (/customer name/.test(k)) return 'customer-name';
  if (/customer phone|phone/.test(k)) return 'customer-phone';
  if (/payment/.test(k)) return 'payment-terms';
  if (/project address|address missing/.test(k)) return 'project-address';
  if (/permit/.test(k)) return 'permit-responsibility';
  if (/start date/.test(k)) return 'start-date';
  return k;
}

function Collapsible({
  title,
  defaultOpen = false,
  Colors,
  darkMode,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  Colors: Colors;
  darkMode: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={flowCard(Colors, darkMode)}>
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => setOpen((v) => !v)}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <Text style={{ color: Colors.text, fontSize: 13, fontWeight: '800', flex: 1 }}>{title}</Text>
        <Text style={{ color: '#60a5fa', fontSize: 12, fontWeight: '700' }}>{open ? 'Hide' : 'Show'}</Text>
      </TouchableOpacity>
      {open ? <View style={{ marginTop: 10 }}>{children}</View> : null}
    </View>
  );
}

export default function AIEstimateDraftReviewDetails({
  draft,
  Colors,
  darkMode,
  busy,
  warnings,
  needsReview,
  clarifyQuestions,
  onApplyScopeOnly,
  onClarifyMissing,
  onRequestRoughRange,
  roughRangeLoading,
}: Props) {
  const scopePackages = getScopePackages(draft);
  const tv = draft.totalValidation;
  const whatAiDid = summarizeWhatAiDidForDisplay(draft.whatAiDid || [], 3);
  const hasUnpricedScope = draftHasUnpricedScope(draft);
  const calculatedTotal =
    tv?.calculatedLineItemsTotal ?? draft.calculatedLineItemTotal ?? draft.calculatedTotal;
  const fullStillNeeded = groupGenericMissingScopeItems(
    (() => {
      const raw = draft.stillNeededReview?.length ? draft.stillNeededReview : getStillNeededList(draft);
      const reviewSource = needsReview.length
        ? needsReview
        : draft.needsReviewItems?.length
          ? draft.needsReviewItems
          : draft.missingInfo || [];
      const merged: string[] = [];
      const seen = new Set<string>();
      const add = (s: string) => {
        const k = s.trim().toLowerCase();
        if (!k || seen.has(k)) return;
        seen.add(k);
        merged.push(s.trim());
      };
      for (const s of raw) add(s);
      for (const s of reviewSource) {
        if (/partial pricing for/i.test(s)) continue;
        if (/:\s*partial pricing/i.test(s)) continue;
        add(s);
      }
      const normalized: string[] = [];
      const canonicalSeen = new Set<string>();
      for (const item of merged) {
        if (calculatedTotal != null && calculatedTotal > 0 && /no overall bid total was found/i.test(item)) {
          continue;
        }
        const key = canonicalStillNeededKey(item);
        if (canonicalSeen.has(key)) continue;
        canonicalSeen.add(key);
        normalized.push(item);
      }
      return normalized;
    })()
  ).filter(
    (item) =>
      !/finish pricing on partial scope/i.test(item) &&
      !REDUNDANT_STILL_NEEDED.test(item) &&
      (hasUnpricedScope || !/need pricing|pricing for/i.test(item))
  );
  const summaryWarnings = summarizePricingWarnings(warnings).filter(
    (warning) =>
      hasUnpricedScope ||
      !/partial pricing|need pricing|still need pricing|room\/areas need pricing/i.test(warning)
  );
  const compactReview = compactNeedsReviewForDisplay(needsReview, 5);
  const missingPriceHints = dedupeMissingPriceSuggestions(draft.pricingMemoryMissingSuggestions || [], 4);
  const partialCount = scopePackages.filter((p) => p.status === 'partial_pricing').length;
  return (
    <>
      <Text style={{ color: Colors.sub, fontSize: 13, lineHeight: 18, marginBottom: 12, textAlign: 'center' }}>
        Details below focus on missing project info, pricing notes, and review warnings.
      </Text>

      {whatAiDid.length > 0 ? (
        <View style={flowCard(Colors, darkMode)}>
          {whatAiDid.map((line, i) => (
            <Text
              key={`did-${i}`}
              style={{ color: Colors.sub, fontSize: 13, marginBottom: i < whatAiDid.length - 1 ? 6 : 0, lineHeight: 18 }}
            >
              • {line}
            </Text>
          ))}
        </View>
      ) : null}

      {draft.noPricingDetected ? (
        <View style={flowCard(Colors, darkMode)}>
          {onApplyScopeOnly ? (
            <TouchableOpacity activeOpacity={0.88} disabled={busy} onPress={onApplyScopeOnly} style={{ marginBottom: 6 }}>
              <Text style={{ color: '#60a5fa', fontSize: 13, fontWeight: '700' }}>Save scope only (no prices)</Text>
            </TouchableOpacity>
          ) : null}
          {onClarifyMissing ? (
            <TouchableOpacity activeOpacity={0.88} disabled={busy} onPress={onClarifyMissing} style={{ marginBottom: 6 }}>
              <Text style={{ color: '#60a5fa', fontSize: 13, fontWeight: '700' }}>Ask clarifying questions</Text>
            </TouchableOpacity>
          ) : null}
          {onRequestRoughRange ? (
            <TouchableOpacity activeOpacity={0.88} disabled={busy} onPress={onRequestRoughRange}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {roughRangeLoading ? <ActivityIndicator size="small" color="#fbbf24" /> : null}
                <Text style={{ color: '#fbbf24', fontSize: 13, fontWeight: '700' }}>Rough budget range</Text>
              </View>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {summaryWarnings.length > 0 ? (
        <View style={flowCard(Colors, darkMode)}>
          <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '800', marginBottom: 6 }}>
            Heads up
          </Text>
          {summaryWarnings.map((warning, index) => (
            <Text key={`warn-${index}`} style={{ color: '#fbbf24', fontSize: 13, marginBottom: 6, lineHeight: 18 }}>
              • {warning}
            </Text>
          ))}
        </View>
      ) : null}

      {draft.roughEstimate ? (
        <View style={flowCard(Colors, darkMode)}>
          <Text style={{ color: '#fbbf24', fontSize: 13, fontWeight: '700' }}>
            Rough estimate: {formatDraftMoney(draft.roughEstimate.low)} –{' '}
            {formatDraftMoney(draft.roughEstimate.high)}
          </Text>
        </View>
      ) : null}

      {missingPriceHints.length > 0 && !draft.noPricingDetected && partialCount === 0 ? (
        <View style={flowCard(Colors, darkMode)}>
          <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '800', marginBottom: 4 }}>
            Pricing gaps
          </Text>
          <Text style={{ color: Colors.sub, fontSize: 13, lineHeight: 18 }}>
            Common gaps: {missingPriceHints.join(' · ')}
          </Text>
        </View>
      ) : null}

      {fullStillNeeded.length > 0 ? (
        <Collapsible
          title={`Still needed (${fullStillNeeded.length})`}
          defaultOpen={fullStillNeeded.length <= 6}
          Colors={Colors}
          darkMode={darkMode}
        >
          {fullStillNeeded.map((item, index) => (
            <Text key={`missing-full-${index}`} style={{ color: Colors.sub, fontSize: 13, marginBottom: 6, lineHeight: 18 }}>
              • {item}
            </Text>
          ))}
        </Collapsible>
      ) : null}

      {compactReview.items.length > 0 && fullStillNeeded.length === 0 ? (
        <Collapsible title={`Missing project info (${compactReview.items.length})`} Colors={Colors} darkMode={darkMode}>
          {compactReview.items.map((item, index) => (
            <Text key={`missing-${index}`} style={{ color: Colors.sub, fontSize: 13, marginBottom: 6, lineHeight: 18 }}>
              • {item}
            </Text>
          ))}
          {compactReview.overflow > 0 ? (
            <Text style={{ color: Colors.sub, fontSize: 12 }}>+ {compactReview.overflow} more</Text>
          ) : null}
        </Collapsible>
      ) : null}

      {scopePackages.length > 0 ? (
        <Collapsible title={`Scope notes (${scopePackages.length})`} Colors={Colors} darkMode={darkMode}>
          {scopePackages.map((pkg, index) => (
            <View key={`${pkg.name}-${index}`} style={{ marginBottom: index < scopePackages.length - 1 ? 10 : 0 }}>
              <Text style={{ color: Colors.text, fontSize: 13, fontWeight: '700' }}>{pkg.name}</Text>
              {pkg.scope ? (
                <Text style={{ color: Colors.sub, fontSize: 13, marginTop: 4, lineHeight: 18 }} numberOfLines={3}>
                  {pkg.scope}
                </Text>
              ) : (
                <Text style={{ color: Colors.sub, fontSize: 13, marginTop: 4 }}>No scope text</Text>
              )}
            </View>
          ))}
        </Collapsible>
      ) : null}

      {draft.allowances.length > 0 ? (
        <Collapsible title="Allowances" Colors={Colors} darkMode={darkMode}>
          {draft.allowances.map((allowance, index) => (
            <Text key={`allow-${index}`} style={{ color: Colors.sub, fontSize: 13, marginBottom: 6, lineHeight: 18 }}>
              • {allowance.name || allowance.description}: {formatDraftMoney(allowance.rate ?? allowance.amount)}
              {allowance.unit ? ` ${allowance.unit}` : ''}
            </Text>
          ))}
        </Collapsible>
      ) : null}

      {(draft.pricingMemorySuggestions?.length ?? 0) > 0 ? (
        <Collapsible title="Pricing history matches" Colors={Colors} darkMode={darkMode}>
          {draft.pricingMemorySuggestions!.slice(0, 5).map((s, i) => (
            <Text key={`pm-${i}`} style={{ color: Colors.sub, fontSize: 13, marginBottom: 6, lineHeight: 18 }}>
              • {s.scopeItemName}: ${s.suggestedUnitRate}/{s.unitType}
            </Text>
          ))}
        </Collapsible>
      ) : null}

      {clarifyQuestions && clarifyQuestions.length > 0 ? (
        <Collapsible title="Clarifying questions" defaultOpen Colors={Colors} darkMode={darkMode}>
          {clarifyQuestions.map((q, index) => (
            <Text key={`clarify-${index}`} style={{ color: Colors.text, fontSize: 13, marginBottom: 6, lineHeight: 18 }}>
              {index + 1}. {q}
            </Text>
          ))}
        </Collapsible>
      ) : null}
    </>
  );
}
