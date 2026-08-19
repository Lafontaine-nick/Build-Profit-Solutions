import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import type { EstimateAiDraft } from '@/utils/estimateAiDraft';
import { formatDraftMoney } from '@/utils/estimateAiDraft';
import {
  compactNeedsReviewForDisplay,
  summarizePricingWarnings,
} from '@/utils/estimateDraftReviewUi';
import { estimateFlowCardStyle } from '@/utils/estimateFlowCardStyle';
import ProjectComplexityReviewPanel from '@/components/estimate/ProjectComplexityReviewPanel';
import type { ProjectComplexitySettings } from '@/utils/projectComplexityAdjustments';
import { projectComplexityEligibleTemplate } from '@/utils/projectComplexityAdjustments';

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
  onUpdateProjectComplexity?: (next: ProjectComplexitySettings) => void;
};

const flowCard = (Colors: Colors, darkMode: boolean) =>
  estimateFlowCardStyle(Colors, darkMode, { marginBottom: 10 });

/** Pricing gaps already live in Scope / Finish pricing / Still needed — skip here. */
const PRICING_NOISE =
  /pricing for|need pricing|still need pricing|partial pricing|room\/areas need pricing|lump_?sum|organized |detected .+ job/i;

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
  onApplyScopeOnly,
  onClarifyMissing,
  onRequestRoughRange,
  roughRangeLoading,
  onUpdateProjectComplexity,
}: Props) {
  const reviewSource = needsReview.length
    ? needsReview
    : draft.needsReviewItems?.length
      ? draft.needsReviewItems
      : draft.missingInfo || [];
  const projectInfoGaps = compactNeedsReviewForDisplay(
    reviewSource.filter((item) => !PRICING_NOISE.test(item)),
    8
  );
  const summaryWarnings = summarizePricingWarnings(warnings).filter(
    (warning) => !PRICING_NOISE.test(warning)
  );
  const hasPricingHistory = (draft.pricingMemorySuggestions?.length ?? 0) > 0;
  const hasAllowances = (draft.allowances?.length ?? 0) > 0;
  const templateKey = draft.scopeChecklist?.templateKey || null;
  const showComplexity = projectComplexityEligibleTemplate(templateKey);
  const hasAnything =
    showComplexity ||
    draft.noPricingDetected ||
    summaryWarnings.length > 0 ||
    Boolean(draft.roughEstimate) ||
    projectInfoGaps.items.length > 0 ||
    hasAllowances ||
    hasPricingHistory;

  if (!hasAnything) {
    return (
      <Text style={{ color: Colors.sub, fontSize: 12, textAlign: 'center', marginBottom: 4 }}>
        No extra project notes beyond the scope list above.
      </Text>
    );
  }

  return (
    <>
      {showComplexity ? (
        <ProjectComplexityReviewPanel
          Colors={Colors}
          darkMode={darkMode}
          disabled={busy}
          floorAreaSqft={draft.scopeMeasurements?.floorAreaSqft ?? null}
          storyCount={draft.scopeMeasurements?.storyCount ?? null}
          projectComplexity={draft.scopeMeasurements?.projectComplexity ?? null}
          plumbingComplexityFactors={draft.scopeMeasurements?.plumbingComplexityFactors ?? null}
          onChange={onUpdateProjectComplexity}
        />
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

      {projectInfoGaps.items.length > 0 ? (
        <Collapsible
          title={`Project info to confirm (${projectInfoGaps.items.length}${projectInfoGaps.overflow ? '+' : ''})`}
          Colors={Colors}
          darkMode={darkMode}
        >
          {projectInfoGaps.items.map((item, index) => (
            <Text key={`info-${index}`} style={{ color: Colors.sub, fontSize: 13, marginBottom: 6, lineHeight: 18 }}>
              • {item}
            </Text>
          ))}
          {projectInfoGaps.overflow > 0 ? (
            <Text style={{ color: Colors.sub, fontSize: 12 }}>+ {projectInfoGaps.overflow} more</Text>
          ) : null}
        </Collapsible>
      ) : null}

      {hasAllowances ? (
        <Collapsible title="Allowances" Colors={Colors} darkMode={darkMode}>
          {draft.allowances.map((allowance, index) => (
            <Text key={`allow-${index}`} style={{ color: Colors.sub, fontSize: 13, marginBottom: 6, lineHeight: 18 }}>
              • {allowance.name || allowance.description}: {formatDraftMoney(allowance.rate ?? allowance.amount)}
              {allowance.unit ? ` ${allowance.unit}` : ''}
            </Text>
          ))}
        </Collapsible>
      ) : null}

      {hasPricingHistory ? (
        <Collapsible title="Pricing history matches" Colors={Colors} darkMode={darkMode}>
          {draft.pricingMemorySuggestions!.slice(0, 5).map((s, i) => (
            <Text key={`pm-${i}`} style={{ color: Colors.sub, fontSize: 13, marginBottom: 6, lineHeight: 18 }}>
              • {s.scopeItemName}: ${s.suggestedUnitRate}/{s.unitType}
            </Text>
          ))}
        </Collapsible>
      ) : null}
    </>
  );
}
