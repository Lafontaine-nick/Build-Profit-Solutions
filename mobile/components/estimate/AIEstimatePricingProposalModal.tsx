import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import type { PricingProposal, PricingScopeItemProposal } from '@/utils/estimateAiDraftPricing';
import {
  comparisonMaterialDetail,
  formatDisplayUnit,
  normalizePricingProposal,
  proposalHasSavedRates,
  proposalUsesSavedPricing,
  setScopeMaterialSource,
  sourceVisual,
  type SourceVisual,
} from '@/utils/estimateAiDraftPricing';
import { formatDraftMoney } from '@/utils/estimateAiDraft';

type Props = {
  visible: boolean;
  proposal: PricingProposal | null;
  title: string;
  subtitle: string;
  applyLabel: string;
  /** saved_only = template/library only; suggest = rough prices with HD + national */
  pricingMode?: 'saved_only' | 'suggest';
  /** Overlay inside Review draft (iOS cannot stack two pageSheet modals). */
  embedded?: boolean;
  onApply: (proposal: PricingProposal) => void;
  onEdit?: (proposal: PricingProposal) => void;
  onAddManually?: () => void;
  onClose: () => void;
};

function formatUnitRate(rate: number, unit: string | null) {
  const rounded = Math.round(rate * 100) / 100;
  const display = rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(2);
  return `$${display}/${formatDisplayUnit(unit) || 'unit'}`;
}

function rateRowLabel(
  line: NonNullable<PricingScopeItemProposal['proposedRates']>[number],
  scopeName: string
) {
  if (line.pricingType === 'material') return 'Material';
  if (line.pricingType === 'labor') return 'Labor';
  const normalized = line.label.replace(/\s+material$/i, '').replace(/\s+install labor$/i, '');
  if (normalized.toLowerCase() === scopeName.toLowerCase()) {
    return line.pricingType === 'material' ? 'Material' : 'Labor';
  }
  return normalized;
}

function SourceBadge({ source, compact }: { source: string; compact?: boolean }) {
  const vis = sourceVisual(source);
  return (
    <View style={[styles.badge, { backgroundColor: vis.bg, borderColor: `${vis.color}55` }]}>
      <View style={[styles.badgeDot, { backgroundColor: vis.color }]} />
      <Text style={[styles.badgeText, { color: vis.color }]}>
        {compact ? vis.shortLabel : vis.label}
      </Text>
    </View>
  );
}

function CompareChip({
  vis,
  rate,
  unit,
  active,
  onPress,
  Colors,
}: {
  vis: SourceVisual;
  rate: number;
  unit: string | null;
  active: boolean;
  onPress: () => void;
  Colors: ReturnType<typeof getColors>;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.compareChip,
        {
          backgroundColor: active ? vis.bg : 'transparent',
          borderColor: active ? vis.color : Colors.line,
        },
      ]}
    >
      <View style={[styles.badgeDot, { backgroundColor: vis.color }]} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: active ? vis.color : Colors.sub, fontSize: 11, fontWeight: '700' }}>
          {vis.shortLabel}
          {active ? ' · used for bid' : ''}
        </Text>
        <Text style={{ color: Colors.text, fontSize: 11, fontWeight: '600', marginTop: 1 }}>
          {formatUnitRate(rate, unit)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function RateRow({
  line,
  scopeName,
  Colors,
}: {
  line: NonNullable<PricingScopeItemProposal['proposedRates']>[number];
  scopeName: string;
  Colors: ReturnType<typeof getColors>;
}) {
  const label = rateRowLabel(line, scopeName);
  return (
    <View style={styles.rateRow}>
      <Text style={[styles.rateLabel, { color: Colors.text }]} numberOfLines={1}>
        {label}
      </Text>
      {line.rate != null && line.unit ? (
        <Text style={[styles.rateUnit, { color: Colors.sub }]}>{formatUnitRate(line.rate, line.unit)}</Text>
      ) : (
        <View style={styles.rateUnit} />
      )}
      <Text style={[styles.rateTotal, { color: Colors.text }]}>
        {line.total != null ? formatDraftMoney(line.total) : '—'}
      </Text>
      <View style={styles.rateBadge}>
        <SourceBadge source={line.source} compact />
      </View>
    </View>
  );
}

function MaterialCompareRow({
  item,
  line,
  onSelectMaterial,
  Colors,
  enabled,
}: {
  item: PricingScopeItemProposal;
  line: NonNullable<PricingScopeItemProposal['proposedRates']>[number];
  onSelectMaterial: (source: 'supplier_pricing' | 'national_trade_average') => void;
  Colors: ReturnType<typeof getColors>;
  enabled: boolean;
}) {
  if (!enabled || line.pricingType !== 'material') return null;

  const hdDetail = comparisonMaterialDetail(item.comparison?.supplier_pricing);
  const natDetail = comparisonMaterialDetail(item.comparison?.national_trade_average);
  if (!hdDetail || !natDetail) return null;

  return (
    <View style={[styles.compareRow, { borderTopColor: Colors.line }]}>
      <Text style={[styles.compareLabel, { color: Colors.sub }]}>Tap to switch material source</Text>
      <View style={styles.compareChips}>
        <CompareChip
          vis={sourceVisual('supplier_pricing')}
          rate={hdDetail.rate}
          unit={hdDetail.unit}
          active={line.source === 'supplier_pricing'}
          onPress={() => onSelectMaterial('supplier_pricing')}
          Colors={Colors}
        />
        <CompareChip
          vis={sourceVisual('national_trade_average')}
          rate={natDetail.rate}
          unit={natDetail.unit}
          active={line.source === 'national_trade_average'}
          onPress={() => onSelectMaterial('national_trade_average')}
          Colors={Colors}
        />
      </View>
    </View>
  );
}

function ScopeCard({
  item,
  showScopeTotal,
  onSelectMaterial,
  showLiveComparison,
  isSavedOnly,
  Colors,
  darkMode,
}: {
  item: PricingScopeItemProposal;
  showScopeTotal: boolean;
  onSelectMaterial: (scopeItemId: string, source: 'supplier_pricing' | 'national_trade_average') => void;
  showLiveComparison: boolean;
  isSavedOnly?: boolean;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const qtyLabel =
    item.quantity != null
      ? `${item.quantity.toLocaleString()} ${formatDisplayUnit(item.unit)}`
      : null;
  const scopeTotal = (item.proposedRates || []).reduce((sum, r) => sum + (r.total || 0), 0);
  const detailAssumptions = (item.proposedRates || []).flatMap((r) => r.assumptions || []);
  const hasDetails = detailAssumptions.length > 0 || Boolean(item.recommended?.reason);
  const unmatched =
    isSavedOnly && scopeTotal <= 0 && (item.warnings?.length ?? 0) > 0;

  if (unmatched) {
    return (
      <View
        style={[
          styles.card,
          styles.unmatchedCard,
          {
            borderColor: darkMode ? 'rgba(251,191,36,0.25)' : 'rgba(251,191,36,0.35)',
            backgroundColor: darkMode ? 'rgba(251,191,36,0.04)' : 'rgba(251,191,36,0.05)',
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.scopeName, { color: Colors.text }]}>{item.scopeName}</Text>
          {qtyLabel ? (
            <Text style={[styles.scopeQty, { color: Colors.sub }]}>{qtyLabel}</Text>
          ) : null}
        </View>
        <Text style={{ color: '#fbbf24', fontSize: 12, lineHeight: 17 }}>
          Not in your saved templates — price manually or use Suggest rough prices.
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: darkMode ? 'rgba(255,255,255,0.08)' : Colors.line,
          backgroundColor: darkMode ? 'rgba(255,255,255,0.03)' : Colors.surface2,
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <Text style={[styles.scopeName, { color: Colors.text }]}>{item.scopeName}</Text>
        {qtyLabel ? (
          <Text style={[styles.scopeQty, { color: Colors.sub }]}>{qtyLabel}</Text>
        ) : null}
      </View>

      {(item.proposedRates || []).map((line, i) => (
        <View key={`pr-${i}`}>
          <RateRow line={line} scopeName={item.scopeName} Colors={Colors} />
          <MaterialCompareRow
            item={item}
            line={line}
            onSelectMaterial={(source) => onSelectMaterial(item.scopeItemId, source)}
            Colors={Colors}
            enabled={showLiveComparison}
          />
        </View>
      ))}

      {showScopeTotal && scopeTotal > 0 ? (
        <View style={[styles.scopeTotalRow, { borderTopColor: Colors.line }]}>
          <Text style={{ color: Colors.sub, fontSize: 12 }}>Scope total</Text>
          <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '800' }}>
            {formatDraftMoney(scopeTotal)}
          </Text>
        </View>
      ) : null}

      {hasDetails ? (
        <TouchableOpacity
          style={styles.detailsToggle}
          onPress={() => setExpanded((v) => !v)}
          activeOpacity={0.7}
        >
          <Text style={{ color: Colors.sub, fontSize: 11, fontWeight: '600' }}>
            {expanded ? 'Hide details' : 'Show details'}
          </Text>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.sub} />
        </TouchableOpacity>
      ) : null}

      {expanded ? (
        <View style={styles.detailsBox}>
          {item.recommended?.reason ? (
            <Text style={{ color: Colors.sub, fontSize: 11, lineHeight: 16, marginBottom: 6 }}>
              {item.recommended.reason}
            </Text>
          ) : null}
          {detailAssumptions.map((a, j) => (
            <Text key={`d-${j}`} style={{ color: Colors.sub, fontSize: 10, lineHeight: 14, marginTop: 2 }}>
              {a}
            </Text>
          ))}
        </View>
      ) : null}

      {(item.warnings || []).map((w, i) => (
        <Text key={`w-${i}`} style={{ color: '#fbbf24', fontSize: 11, marginTop: 8 }}>
          {w}
        </Text>
      ))}
    </View>
  );
}

function SourceLegend({ sources }: { sources: string[] }) {
  if (!sources.length) return null;
  return (
    <View style={styles.legend}>
      {sources.map((source) => (
        <SourceBadge key={source} source={source} />
      ))}
    </View>
  );
}

export default function AIEstimatePricingProposalModal({
  visible,
  proposal,
  title,
  subtitle,
  applyLabel,
  pricingMode: pricingModeProp,
  embedded = false,
  onApply,
  onEdit,
  onAddManually,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const { theme, darkMode } = useTheme();
  const Colors = getColors(theme);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [workingProposal, setWorkingProposal] = useState<PricingProposal | null>(proposal);

  useEffect(() => {
    if (!visible) {
      setWorkingProposal(null);
      return;
    }
    if (proposal) setWorkingProposal(normalizePricingProposal(proposal));
  }, [visible, proposal]);

  const display = normalizePricingProposal(visible ? workingProposal || proposal : null);
  const isSavedOnly =
    pricingModeProp === 'saved_only' || display.pricingMode === 'saved_only';
  const hasContent = proposalHasSavedRates(display);

  const legendSources = useMemo(() => {
    if (!display.scopeItems?.length) return [];
    const found = new Set<string>();
    for (const item of display.scopeItems) {
      for (const line of item.proposedRates || []) {
        if (line.source) found.add(line.source);
      }
    }
    const savedOrder = ['saved_pricing', 'saved_template', 'company_default'];
    const roughOrder = [
      'saved_pricing',
      'saved_template',
      'supplier_pricing',
      'national_trade_average',
      'ai_rough_estimate_fallback',
    ];
    const order = isSavedOnly ? savedOrder : roughOrder;
    return order.filter((s) => found.has(s));
  }, [display, isSavedOnly]);

  const savedMatchStats = useMemo(() => {
    if (!isSavedOnly || !display.scopeItems?.length) return null;
    const matched = display.scopeItems.filter((item) =>
      (item.proposedRates || []).some((r) => (r.total || 0) > 0)
    ).length;
    const total = display.scopeItems.length;
    const unmatched = total - matched;
    if (unmatched <= 0) return `${matched} item${matched === 1 ? '' : 's'} matched`;
    return `${matched} matched · ${unmatched} need pricing`;
  }, [display, isSavedOnly]);

  const partialTemplateMatch =
    isSavedOnly &&
    (display?.scopeItems || []).some(
      (item) =>
        !(item.proposedRates || []).some((r) => (r.total || 0) > 0) &&
        (item.warnings?.length ?? 0) > 0
    );

  const useEngineCards = (display.scopeItems?.length ?? 0) > 0;
  const multiScope = (display.scopeItems?.length ?? 0) > 1;
  const showRoughSavedNote =
    !isSavedOnly && proposalUsesSavedPricing(display);

  const byPackage = new Map<string, NonNullable<PricingProposal['lines']>>();
  if (!useEngineCards) {
    for (const line of display.lines || []) {
      const list = byPackage.get(line.packageName) || [];
      list.push(line);
      byPackage.set(line.packageName, list);
    }
  }

  const handleSelectMaterial = (
    scopeItemId: string,
    source: 'supplier_pricing' | 'national_trade_average'
  ) => {
    setWorkingProposal((prev) => (prev ? setScopeMaterialSource(prev, scopeItemId, source) : prev));
  };

  if (!visible || !proposal) return null;

  const shell = (
    <View style={[styles.shell, { backgroundColor: Colors.bg, paddingTop: embedded ? 0 : insets.top }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: Colors.text }]}>{title}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text style={{ color: Colors.sub, fontSize: 22 }}>×</Text>
          </TouchableOpacity>
        </View>

        {display.empty || !hasContent ? (
          <View style={{ padding: 16, flex: 1 }}>
            <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '800', marginBottom: 8 }}>
              No saved pricing found yet
            </Text>
            <Text style={{ color: Colors.sub, fontSize: 14, lineHeight: 20 }}>
              {display.message ||
                'You have not saved pricing for this scope yet. Add prices manually or request suggested pricing.'}
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }}>
            <Text style={{ color: Colors.sub, fontSize: 13, lineHeight: 18, marginBottom: 12 }}>
              {subtitle}
            </Text>

            {isSavedOnly && savedMatchStats ? (
              <Text style={{ color: Colors.sub, fontSize: 12, fontWeight: '600', marginBottom: 10 }}>
                {savedMatchStats}
              </Text>
            ) : null}

            {!isSavedOnly ? <SourceLegend sources={legendSources} /> : null}

            {isSavedOnly ? (
              <View
                style={[
                  styles.infoBanner,
                  { backgroundColor: darkMode ? 'rgba(96,165,250,0.12)' : 'rgba(96,165,250,0.1)' },
                ]}
              >
                <SourceBadge
                  source={
                    display.primarySource === 'saved_template' ? 'saved_template' : 'saved_pricing'
                  }
                />
                <Text style={{ color: '#60a5fa', fontSize: 12, lineHeight: 17, flex: 1 }}>
                  Template rates only. Use Suggest rough prices for HD Live and national rates.
                </Text>
              </View>
            ) : null}

            {showRoughSavedNote ? (
              <View
                style={[
                  styles.infoBanner,
                  { backgroundColor: darkMode ? 'rgba(96,165,250,0.12)' : 'rgba(96,165,250,0.1)' },
                ]}
              >
                <SourceBadge source={display.primarySource === 'saved_template' ? 'saved_template' : 'saved_pricing'} />
                <Text style={{ color: '#60a5fa', fontSize: 12, lineHeight: 17, flex: 1 }}>
                  Some lines matched your saved pricing. HD Live and national rates shown where
                  available for comparison.
                </Text>
              </View>
            ) : null}

            {!isSavedOnly && display.supplierZipIsFallback ? (
              <View
                style={[
                  styles.infoBanner,
                  { backgroundColor: darkMode ? 'rgba(251,191,36,0.1)' : 'rgba(251,191,36,0.08)' },
                ]}
              >
                <Ionicons name="location-outline" size={16} color="#fbbf24" />
                <Text style={{ color: '#fbbf24', fontSize: 12, lineHeight: 17, flex: 1 }}>
                  No ZIP in notes — HD prices use store near {display.supplierZip || 'default ZIP'}. Add
                  a ZIP for local pricing. National average still shown.
                </Text>
              </View>
            ) : null}

            {!isSavedOnly && display.anyFallbackOnly && !display.anyRealSource ? (
              <View
                style={[
                  styles.infoBanner,
                  { backgroundColor: darkMode ? 'rgba(251,191,36,0.1)' : 'rgba(251,191,36,0.08)' },
                ]}
              >
                <SourceBadge source="ai_rough_estimate_fallback" />
                <Text style={{ color: '#fbbf24', fontSize: 12, lineHeight: 17, flex: 1 }}>
                  No saved or live pricing found — AI estimates for planning only.
                </Text>
              </View>
            ) : null}

            {useEngineCards
              ? display.scopeItems!.map((item) => (
                  <ScopeCard
                    key={item.scopeItemId}
                    item={item}
                    showScopeTotal={multiScope}
                    onSelectMaterial={handleSelectMaterial}
                    showLiveComparison={!isSavedOnly}
                    isSavedOnly={isSavedOnly}
                    Colors={Colors}
                    darkMode={darkMode}
                  />
                ))
              : [...byPackage.entries()].map(([pkgName, lines]) => (
                  <View
                    key={pkgName}
                    style={[
                      styles.card,
                      {
                        borderColor: darkMode ? 'rgba(255,255,255,0.08)' : Colors.line,
                        backgroundColor: darkMode ? 'rgba(255,255,255,0.03)' : Colors.surface2,
                      },
                    ]}
                  >
                    <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '800', marginBottom: 8 }}>
                      {pkgName}
                    </Text>
                    {lines.map((line, i) => (
                      <View key={`${pkgName}-${i}`} style={styles.rateRow}>
                        <Text style={[styles.rateLabel, { color: Colors.text }]} numberOfLines={1}>
                          {line.label}
                        </Text>
                        <Text style={[styles.rateUnit, { color: Colors.sub }]}>{line.formula}</Text>
                        <Text style={[styles.rateTotal, { color: Colors.text }]}>
                          {formatDraftMoney(line.total)}
                        </Text>
                        <View style={styles.rateBadge}>
                          <SourceBadge source={line.priceSource} compact />
                        </View>
                      </View>
                    ))}
                  </View>
                ))}

            <View style={[styles.totalBox, { borderColor: Colors.line }]}>
              <Text style={{ color: Colors.sub, fontSize: 13 }}>
                {partialTemplateMatch ? 'Total (matched items)' : 'Total suggested'}
              </Text>
              <Text style={{ color: Colors.text, fontSize: 22, fontWeight: '800' }}>
                {formatDraftMoney(display.totalSuggested)}
              </Text>
            </View>

            {display.disclaimer ? (
              <TouchableOpacity
                onPress={() => setShowDisclaimer((v) => !v)}
                style={styles.disclaimerToggle}
                activeOpacity={0.7}
              >
                <Text style={{ color: Colors.sub, fontSize: 11 }}>
                  Planning estimates — verify before billing
                </Text>
                <Ionicons
                  name={showDisclaimer ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={Colors.sub}
                />
              </TouchableOpacity>
            ) : null}
            {showDisclaimer && display.disclaimer ? (
              <Text style={{ color: Colors.sub, fontSize: 11, lineHeight: 16, marginTop: 4 }}>
                {display.disclaimer}
              </Text>
            ) : null}
          </ScrollView>
        )}

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16), borderTopColor: Colors.line }]}>
          {!display.empty && hasContent ? (
            <>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => workingProposal && onApply(workingProposal)}
              >
                <Text style={styles.primaryBtnText}>{applyLabel}</Text>
              </TouchableOpacity>
              {onEdit ? (
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => workingProposal && onEdit(workingProposal)}
                >
                  <Text style={{ color: Colors.text, fontWeight: '700' }}>Adjust rates</Text>
                </TouchableOpacity>
              ) : null}
            </>
          ) : onAddManually ? (
            <TouchableOpacity style={styles.primaryBtn} onPress={onAddManually}>
              <Text style={styles.primaryBtnText}>Add prices manually</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={onClose}>
            <Text style={{ color: Colors.sub, fontWeight: '700', textAlign: 'center' }}>Cancel</Text>
          </TouchableOpacity>
        </View>
    </View>
  );

  if (embedded) {
    return (
      <View
        style={[
          StyleSheet.absoluteFillObject,
          styles.embeddedShell,
          { backgroundColor: Colors.bg },
        ]}
      >
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
          {shell}
        </SafeAreaView>
      </View>
    );
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {shell}
    </Modal>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  embeddedShell: {
    zIndex: 102,
    elevation: 102,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: { fontSize: 18, fontWeight: '800', flex: 1 },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  card: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  unmatchedCard: {
    borderStyle: 'dashed',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
  },
  scopeName: { fontSize: 16, fontWeight: '800', flex: 1 },
  scopeQty: { fontSize: 12, fontWeight: '600' },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  rateLabel: {
    fontSize: 14,
    fontWeight: '600',
    width: 72,
  },
  rateUnit: {
    fontSize: 12,
    flex: 1,
    minWidth: 64,
  },
  rateTotal: {
    fontSize: 14,
    fontWeight: '800',
    width: 72,
    textAlign: 'right',
  },
  rateBadge: {
    width: 76,
    alignItems: 'flex-end',
  },
  compareRow: {
    marginTop: 0,
    marginBottom: 6,
    paddingTop: 4,
    paddingBottom: 4,
  },
  compareLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  compareChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  compareChip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    minWidth: '46%',
  },
  scopeTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  detailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 8,
    paddingVertical: 4,
  },
  detailsBox: {
    marginTop: 6,
    paddingTop: 6,
  },
  totalBox: {
    marginTop: 4,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  disclaimerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingVertical: 4,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  primaryBtn: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#0f172a', fontWeight: '800', fontSize: 16 },
  secondaryBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
});
