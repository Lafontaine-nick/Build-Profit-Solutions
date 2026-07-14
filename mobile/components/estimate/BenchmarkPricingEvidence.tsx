import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BenchmarkComparablesDrawer from './BenchmarkComparablesDrawer';
import type { BenchmarkSuggestion } from '@/utils/benchmarkEngine';
import {
  formatDisplayMoneyNearest100,
  measurementSemanticsV1Enabled,
  missingStatusDisplayLabel,
  stageTitle,
} from '@/utils/measurementSemantics';

type Props = {
  evidence: BenchmarkSuggestion;
  darkMode: boolean;
  /** When false, hide dollar stage totals (included-in-stage children). */
  showTotals?: boolean;
  defaultExpanded?: boolean;
  scopeLabel?: string | null;
};

function rate(value: number | null | undefined): string {
  return value == null ? '—' : `$${value.toFixed(2)}/SF`;
}

export default function BenchmarkPricingEvidence({
  evidence,
  darkMode,
  showTotals = true,
  defaultExpanded = false,
  scopeLabel = null,
}: Props) {
  const semantics = measurementSemanticsV1Enabled();
  // Semantics: always start collapsed; ignore accidental defaultExpanded=true.
  const [expanded, setExpanded] = useState(semantics ? false : defaultExpanded);
  const [showComparables, setShowComparables] = useState(false);
  const text = darkMode ? '#e2e8f0' : '#1e293b';
  const sub = darkMode ? '#94a3b8' : '#64748b';
  const warn = darkMode ? '#fbbf24' : '#92400e';
  const hasPrimary = Boolean(evidence.quantityRoles?.primaryTakeoff?.quantity || evidence.primaryTakeoff?.quantity);
  const statusLabel = missingStatusDisplayLabel(evidence.scopeId);
  const qty = evidence.benchmarkBasis.quantity;
  const blended = evidence.blendedBenchmark.rate;
  const leaveOneOut = evidence.leaveOneOut;

  useEffect(() => {
    if (semantics) setExpanded(false);
  }, [evidence.scopeId, evidence.stageId, semantics]);

  return (
    <View style={[styles.wrap, { borderTopColor: darkMode ? '#334155' : '#cbd5e1' }]}>
      {semantics && showTotals ? (
        <View style={styles.compact}>
          <View style={styles.compactHeader}>
            <Text style={[styles.compactTotal, { color: text }]}>
              {formatDisplayMoneyNearest100(evidence.blendedBenchmark.total)}
            </Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Benchmark only</Text>
            </View>
          </View>
          <Text style={[styles.compactMeta, { color: sub }]}>
            {blended != null ? `$${blended.toFixed(2)} / living SF` : '—'}
            {evidence.localSampleCount ? ` · ${evidence.localSampleCount} local projects` : ''}
          </Text>
          {!hasPrimary ? (
            <Text style={[styles.warning, { color: warn }]}>{statusLabel}</Text>
          ) : null}
        </View>
      ) : null}

      <TouchableOpacity
        style={styles.toggle}
        onPress={() => setExpanded((v) => !v)}
        accessibilityLabel={expanded ? 'Hide pricing details' : 'Show pricing details'}
      >
        <Text style={styles.toggleText}>{expanded ? 'Hide details' : 'Details'}</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={15} color="#0f766e" />
      </TouchableOpacity>

      {expanded ? (
        <View style={styles.expanded}>
          <View style={styles.row}>
            <Text style={[styles.label, { color: sub }]}>Local median</Text>
            <Text style={[styles.value, { color: text }]}>{rate(evidence.localMedian.rate)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={[styles.label, { color: sub }]}>National benchmark</Text>
            <Text style={[styles.value, { color: text }]}>
              {rate(evidence.nationalBenchmark.adjustedRate || evidence.nationalBenchmark.rate)}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={[styles.label, { color: sub }]}>Blended benchmark</Text>
            <Text style={[styles.value, { color: text }]}>{rate(evidence.blendedBenchmark.rate)}</Text>
          </View>
          {showTotals ? (
            <View style={styles.row}>
              <Text style={[styles.label, { color: sub }]}>Pricing quantity</Text>
              <Text style={[styles.value, { color: text }]}>
                {qty != null ? `${qty.toLocaleString()} living SF` : '—'}
              </Text>
            </View>
          ) : null}
          <View style={styles.row}>
            <Text style={[styles.label, { color: sub }]}>Weighting</Text>
            <Text style={[styles.value, { color: text }]}>
              {Math.round(evidence.blendedBenchmark.localWeight * 100)}% local /{' '}
              {Math.round(evidence.blendedBenchmark.nationalWeight * 100)}% national
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={[styles.label, { color: sub }]}>Quantity confidence</Text>
            <Text style={[styles.value, { color: text }]}>{evidence.quantityConfidence}</Text>
          </View>
          <View style={styles.row}>
            <Text style={[styles.label, { color: sub }]}>Price confidence</Text>
            <Text style={[styles.value, { color: text }]}>{evidence.priceConfidence}</Text>
          </View>
          <View style={styles.row}>
            <Text style={[styles.label, { color: sub }]}>Source confidence</Text>
            <Text style={[styles.value, { color: text }]}>{evidence.sourceConfidence}</Text>
          </View>
          {leaveOneOut ? (
            <View style={styles.leaveOneOut}>
              <Text style={[styles.warning, { color: warn, marginTop: 0 }]}>
                Leave-one-out ({leaveOneOut.excludedProjectName})
              </Text>
              {leaveOneOut.available ? (
                <>
                  <View style={styles.row}>
                    <Text style={[styles.label, { color: sub }]}>LOO local median</Text>
                    <Text style={[styles.value, { color: text }]}>
                      {rate(leaveOneOut.localMedianRate)}
                    </Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={[styles.label, { color: sub }]}>LOO blended</Text>
                    <Text style={[styles.value, { color: text }]}>
                      {rate(leaveOneOut.blendedRate)}
                      {leaveOneOut.total != null
                        ? ` · ${formatDisplayMoneyNearest100(leaveOneOut.total)}`
                        : ''}
                    </Text>
                  </View>
                </>
              ) : null}
              <Text style={[styles.disclaimer, { color: sub }]}>{leaveOneOut.note}</Text>
            </View>
          ) : null}
          {!hasPrimary ? (
            <Text style={[styles.warning, { color: warn }]}>
              {statusLabel} · Benchmark: {qty?.toLocaleString() || '—'} living SF
            </Text>
          ) : null}
          <Text style={[styles.disclaimer, { color: sub }]}>
            {evidence.warnings?.[0] ||
              'Benchmark pricing only — detailed takeoff still required.'}
          </Text>
          {evidence.benchmarkLevel === 'stage' ? (
            <Text style={[styles.disclaimer, { color: sub }]}>
              {stageTitle(evidence.stageId)} planning evidence
              {scopeLabel ? ` (shown on ${scopeLabel})` : ''}.
            </Text>
          ) : null}
          <TouchableOpacity style={styles.link} onPress={() => setShowComparables(true)}>
            <Text style={styles.linkText}>View comparable projects</Text>
            <Ionicons name="chevron-forward" size={15} color="#0f766e" />
          </TouchableOpacity>
        </View>
      ) : null}

      <BenchmarkComparablesDrawer
        visible={showComparables}
        onClose={() => setShowComparables(false)}
        detached={evidence.detachedComparables}
        twinHomes={evidence.twinHomeReferences}
        darkMode={darkMode}
        scopeName={
          evidence.benchmarkLevel === 'stage'
            ? null
            : scopeLabel || evidence.label || null
        }
        livingSf={evidence.benchmarkBasis.quantity}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  compact: { marginBottom: 6 },
  compactHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  compactTotal: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15,118,110,0.45)',
    backgroundColor: 'rgba(15,118,110,0.12)',
  },
  badgeText: { color: '#0f766e', fontSize: 10, fontWeight: '800' },
  compactMeta: { fontSize: 12, marginTop: 4, fontWeight: '600' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  toggleText: { color: '#0f766e', fontSize: 12, fontWeight: '800' },
  expanded: { marginTop: 8 },
  leaveOneOut: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148,163,184,0.25)',
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 2, gap: 8 },
  label: { flex: 1, fontSize: 11 },
  value: { flex: 1.1, fontSize: 11, fontWeight: '700', textAlign: 'right', textTransform: 'capitalize' },
  warning: { fontSize: 11, lineHeight: 15, marginTop: 6, fontWeight: '700' },
  disclaimer: { fontSize: 10, lineHeight: 15, marginTop: 5 },
  link: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  linkText: { color: '#0f766e', fontSize: 11, fontWeight: '800' },
});
