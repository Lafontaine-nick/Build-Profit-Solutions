import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatDraftMoney } from '@/utils/estimateAiDraft';
import {
  budgetSplitSourceColor,
  budgetSplitSourceLabel,
  type ScopePackageBudgetBreakdown,
} from '@/utils/estimateDraftReviewUi';

type Colors = {
  text: string;
  sub: string;
  line: string;
  surface2: string;
};

function pricingTextColor(darkMode: boolean, Colors: Colors) {
  return darkMode ? '#F5F7FA' : Colors.text;
}

function pricingLabelColor(darkMode: boolean, Colors: Colors) {
  return darkMode ? 'rgba(255,255,255,0.72)' : Colors.sub;
}

function formatUnitLabel(unit: string | null | undefined) {
  const normalized = String(unit || '').toLowerCase();
  if (normalized === 'sqft' || normalized === 'sf') return 'sqft';
  if (normalized === 'lf' || normalized === 'linear foot' || normalized === 'linear feet') return 'LF';
  return normalized || 'unit';
}

function rateHelper(amount: number, basis: ScopePackageBudgetBreakdown['basis']) {
  if (!basis?.quantity || basis.quantity <= 0) return null;
  const rate = amount / basis.quantity;
  if (!Number.isFinite(rate) || rate <= 0) return null;
  return `Rate: ${formatDraftMoney(rate)} / ${formatUnitLabel(basis.unit)}`;
}

function SourcePill({
  source,
}: {
  source: ScopePackageBudgetBreakdown['materialSource'];
}) {
  const isNotes = source === 'notes';
  const isManual = source === 'manual';
  return (
    <View
      style={[
        styles.sourcePill,
        isManual ? styles.sourcePillManual : isNotes ? styles.sourcePillNotes : styles.sourcePillNational,
      ]}
    >
      <Text
        style={{
          color: budgetSplitSourceColor(source),
          fontSize: 11,
          fontWeight: '700',
        }}
      >
        {budgetSplitSourceLabel(source)}
      </Text>
    </View>
  );
}

export default function ScopeBudgetBreakdownPanel({
  breakdown,
  Colors,
  darkMode,
  showWhyHelper = true,
  style,
}: {
  breakdown: ScopePackageBudgetBreakdown;
  Colors: Colors;
  darkMode: boolean;
  showWhyHelper?: boolean;
  style?: object;
}) {
  const isSuggested =
    breakdown.materialSource === 'suggested' && breakdown.laborSource === 'suggested';
  const sameSource = breakdown.materialSource === breakdown.laborSource;
  const panelBg = isSuggested
    ? darkMode
      ? 'rgba(96, 165, 250, 0.08)'
      : 'rgba(96, 165, 250, 0.06)'
    : darkMode
      ? 'rgba(255,255,255,0.04)'
      : Colors.surface2;
  const panelBorder = isSuggested
    ? darkMode
      ? 'rgba(96, 165, 250, 0.22)'
      : 'rgba(96, 165, 250, 0.18)'
    : darkMode
      ? 'rgba(148, 163, 184, 0.16)'
      : Colors.line;

  const renderLine = (
    lineLabel: string,
    amount: number,
    source: ScopePackageBudgetBreakdown['materialSource']
  ) => {
    const helper = rateHelper(amount, breakdown.basis);
    return (
      <View key={lineLabel} style={styles.breakdownLineBlock}>
        <View style={styles.breakdownLineRow}>
          <Text
            style={{
              flex: 1,
              marginRight: 12,
              color: pricingLabelColor(darkMode, Colors),
              fontSize: 14,
              fontWeight: '600',
            }}
          >
            {lineLabel}
          </Text>
          <View style={{ alignItems: 'flex-end', flexShrink: 0 }}>
            <Text
              style={{
                color: pricingTextColor(darkMode, Colors),
                fontSize: 15,
                fontWeight: '700',
              }}
            >
              {formatDraftMoney(amount)}
            </Text>
            {helper ? (
              <Text style={{ color: pricingLabelColor(darkMode, Colors), fontSize: 11, marginTop: 2 }}>
                {helper}
              </Text>
            ) : null}
          </View>
        </View>
        {!sameSource ? (
          <View style={styles.breakdownPillRow}>
            <SourcePill source={source} />
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View
      style={[
        styles.breakdownPanel,
        { backgroundColor: panelBg, borderColor: panelBorder },
        style,
      ]}
    >
      <View style={styles.breakdownHeader}>
        <Text style={{ color: pricingTextColor(darkMode, Colors), fontSize: 14, fontWeight: '700' }}>
          Budget split
        </Text>
        {sameSource ? <SourcePill source={breakdown.materialSource} /> : null}
      </View>
      {renderLine('Material', breakdown.material, breakdown.materialSource)}
      {renderLine('Labor', breakdown.labor, breakdown.laborSource)}
      {showWhyHelper && isSuggested ? (
        <Text
          style={{
            color: pricingLabelColor(darkMode, Colors),
            fontSize: 12,
            lineHeight: 17,
            marginTop: 8,
          }}
        >
          Why this split? Notes only gave one total, so materials use National Average and labor gets
          the remainder.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  breakdownPanel: {
    marginTop: 10,
    alignSelf: 'stretch',
    width: '100%',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  breakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  breakdownLineBlock: {
    marginTop: 8,
  },
  breakdownLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  breakdownPillRow: {
    alignItems: 'flex-end',
    marginTop: 4,
  },
  sourcePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  sourcePillNotes: {
    borderColor: 'rgba(34, 197, 94, 0.35)',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  sourcePillNational: {
    borderColor: 'rgba(96, 165, 250, 0.35)',
    backgroundColor: 'rgba(96, 165, 250, 0.1)',
  },
  sourcePillManual: {
    borderColor: 'rgba(251, 191, 36, 0.35)',
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
  },
});
