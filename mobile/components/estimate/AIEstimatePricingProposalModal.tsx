import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  Keyboard,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import GradientRingBackInner from '@/components/GradientRingBackInner';
import {
  BRAND_FRAME_GRADIENT_COLORS,
  BRAND_FRAME_GRADIENT_END,
  BRAND_FRAME_GRADIENT_START,
} from '@/constants/brandFrameGradient';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import type { PricingProposal, PricingScopeItemProposal } from '@/utils/estimateAiDraftPricing';
import {
  comparisonMaterialDetail,
  confidenceVisual,
  countSavedPricingScopeItems,
  APPROVAL_SUBTEXT,
  BLOCKED_PRICING_MESSAGE,
  countValidSelectedSuggestItems,
  defaultIncludedSuggestScopeIds,
  filterProposalToScopeItems,
  formatDisplayUnit,
  getPricingConfirmMessage,
  isLumpSumUnit,
  MANUAL_PRICING_NO_SOURCE_MESSAGE,
  normalizePricingProposal,
  proposalHasSavedRates,
  proposalUsesSavedPricing,
  reviewStatusVisual,
  scopeItemHasSavedRates,
  setScopeMaterialSource,
  sourceVisual,
  suggestItemIsManualOnly,
  suggestItemNeedsApproval,
  suggestItemNeedsPricing,
  suggestItemSelectable,
  sumValidSelectedSuggestTotal,
  SUGGESTED_PRICING_DISCLAIMER,
  updateScopeProposedRate,
  type SourceVisual,
} from '@/utils/estimateAiDraftPricing';
import { formatDraftMoney } from '@/utils/estimateAiDraft';

type Props = {
  visible: boolean;
  proposal: PricingProposal | null;
  title: string;
  subtitle: string;
  applyLabel?: string;
  /** saved_only = template/library only; suggest = rough prices with HD + national */
  pricingMode?: 'saved_only' | 'suggest';
  /** @deprecated Use standalone fullScreen modal (default). */
  embedded?: boolean;
  onApply: (proposal: PricingProposal) => void;
  onEdit?: (proposal: PricingProposal) => void;
  onAddManually?: () => void;
  /** Wipe templates + pricing library (saved-only modal). */
  onClearAllSavedPricing?: () => void;
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

function SourceBadge({ source, compact, mode = 'saved' }: { source: string; compact?: boolean; mode?: 'saved' | 'suggest' }) {
  const vis = sourceVisual(source, mode);
  const text = compact ? vis.shortLabel : vis.label;
  return (
    <View
      style={[
        styles.badge,
        compact && styles.badgeCompact,
        { backgroundColor: vis.bg, borderColor: `${vis.color}55` },
      ]}
    >
      <View style={[styles.badgeDot, compact && styles.badgeDotCompact, { backgroundColor: vis.color }]} />
      <Text
        style={[styles.badgeText, compact && styles.badgeTextCompact, { color: vis.color }]}
        numberOfLines={1}
      >
        {text}
      </Text>
    </View>
  );
}

function SourceInlineTag({
  source,
  mode = 'saved',
}: {
  source: string;
  mode?: 'saved' | 'suggest';
}) {
  const vis = sourceVisual(source, mode);
  return (
    <Text style={[styles.sourceInlineTag, { color: vis.color }]} numberOfLines={1}>
      {vis.shortLabel}
    </Text>
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
      <View style={styles.compareChipBody}>
        <Text
          style={{ color: active ? vis.color : Colors.sub, fontSize: 11, fontWeight: '700' }}
          numberOfLines={1}
        >
          {vis.shortLabel}
          {active ? ' · in bid' : ''}
        </Text>
        <Text style={{ color: Colors.text, fontSize: 11, fontWeight: '600', marginTop: 1 }}>
          {formatUnitRate(rate, unit)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function ConfidenceBadge({ confidence, compact }: { confidence?: string; compact?: boolean }) {
  const vis = confidenceVisual(confidence);
  const label = compact
    ? confidence === 'high'
      ? 'High'
      : confidence === 'low'
        ? 'Low'
        : 'Medium'
    : vis.label;
  return (
    <View
      style={[
        styles.badge,
        compact && styles.badgeCompact,
        { backgroundColor: vis.bg, borderColor: `${vis.color}55` },
      ]}
    >
      <Text
        style={[styles.badgeText, compact && styles.badgeTextCompact, { color: vis.color }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

function RateRow({
  line,
  scopeName,
  Colors,
  sourceMode = 'saved',
}: {
  line: NonNullable<PricingScopeItemProposal['proposedRates']>[number];
  scopeName: string;
  Colors: ReturnType<typeof getColors>;
  sourceMode?: 'saved' | 'suggest';
}) {
  const label = rateRowLabel(line, scopeName);
  const showUnitRate =
    !isLumpSumUnit(line.unit) &&
    line.pricingType !== 'lump_sum' &&
    line.rate != null &&
    line.rate > 0 &&
    line.unit;
  return (
    <View style={styles.rateRow}>
      <Text style={[styles.rateLabel, { color: Colors.text }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.rateRowRight}>
        {showUnitRate ? (
          <Text style={[styles.rateUnitInline, { color: Colors.sub }]} numberOfLines={1}>
            {formatUnitRate(line.rate!, line.unit!)}
          </Text>
        ) : null}
        <Text style={[styles.rateTotalInline, { color: Colors.text }]} numberOfLines={1}>
          {line.total != null ? formatDraftMoney(line.total) : '—'}
        </Text>
        <SourceInlineTag source={line.source} mode={sourceMode} />
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
  sourceMode = 'suggest',
}: {
  item: PricingScopeItemProposal;
  line: NonNullable<PricingScopeItemProposal['proposedRates']>[number];
  onSelectMaterial: (source: 'supplier_pricing' | 'national_trade_average') => void;
  Colors: ReturnType<typeof getColors>;
  enabled: boolean;
  sourceMode?: 'saved' | 'suggest';
}) {
  if (!enabled || line.pricingType !== 'material') return null;

  const hdDetail = comparisonMaterialDetail(item.comparison?.supplier_pricing);
  const natDetail = comparisonMaterialDetail(item.comparison?.national_trade_average);
  if (!hdDetail || !natDetail) return null;
  if (line.source !== 'supplier_pricing' && line.source !== 'national_trade_average') return null;

  return (
    <View style={[styles.compareRow, { borderTopColor: Colors.line }]}>
      <Text style={[styles.compareLabel, { color: Colors.sub }]}>Tap to switch material source</Text>
      <View style={styles.compareChips}>
        <CompareChip
          vis={sourceVisual('supplier_pricing', sourceMode)}
          rate={hdDetail.rate}
          unit={hdDetail.unit}
          active={line.source === 'supplier_pricing'}
          onPress={() => onSelectMaterial('supplier_pricing')}
          Colors={Colors}
        />
        <CompareChip
          vis={sourceVisual('national_trade_average', sourceMode)}
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

function ScopeRateEditor({
  item,
  draftRates,
  onDraftRateChange,
  Colors,
  darkMode,
}: {
  item: PricingScopeItemProposal;
  draftRates: Record<string, string>;
  onDraftRateChange: (pricingType: 'material' | 'labor', text: string) => void;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
}) {
  const editableLines = (item.proposedRates || []).filter(
    (line) => line.rate != null && line.unit && line.unit !== 'lump_sum'
  );
  if (!editableLines.length) return null;

  return (
    <View style={styles.editPanel}>
      {editableLines.map((line, i) => {
        const pricingType = line.pricingType === 'material' ? 'material' : 'labor';
        const label = rateRowLabel(line, item.scopeName);
        const unitLabel = formatDisplayUnit(line.unit);
        return (
          <View key={`edit-${pricingType}-${i}`} style={styles.editFieldRow}>
            <Text style={{ color: Colors.sub, fontSize: 11, fontWeight: '700', marginBottom: 4 }}>
              {label} · $/{unitLabel}
            </Text>
            <TextInput
              value={draftRates[pricingType] ?? String(line.rate ?? '')}
              onChangeText={(text) => onDraftRateChange(pricingType, text)}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={Colors.sub}
              style={[
                styles.editInput,
                {
                  color: Colors.text,
                  borderColor: darkMode ? 'rgba(255,255,255,0.15)' : Colors.line,
                  backgroundColor: darkMode ? 'rgba(0,0,0,0.25)' : Colors.surface2,
                },
              ]}
            />
          </View>
        );
      })}
    </View>
  );
}

function ScopeCard({
  item,
  showScopeTotal,
  onSelectMaterial,
  showLiveComparison,
  isSavedOnly,
  isSuggestMode,
  included,
  onToggleIncluded,
  isEditing,
  onToggleEdit,
  onRateChange,
  Colors,
  darkMode,
}: {
  item: PricingScopeItemProposal;
  showScopeTotal: boolean;
  onSelectMaterial: (scopeItemId: string, source: 'supplier_pricing' | 'national_trade_average') => void;
  showLiveComparison: boolean;
  isSavedOnly?: boolean;
  isSuggestMode?: boolean;
  included?: boolean;
  onToggleIncluded?: () => void;
  isEditing?: boolean;
  onToggleEdit?: () => void;
  onRateChange?: (pricingType: 'material' | 'labor', rate: number) => void;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [draftRates, setDraftRates] = useState<Record<string, string>>({});
  const qtyLabel =
    item.quantity != null
      ? `${item.quantity.toLocaleString()} ${formatDisplayUnit(item.unit)}`
      : null;
  const scopeTotal = (item.proposedRates || []).reduce((sum, r) => sum + (r.total || 0), 0);
  const detailAssumptions = (item.proposedRates || []).flatMap((r) => r.assumptions || []);
  const hasDetails = detailAssumptions.length > 0 || Boolean(item.recommended?.reason);
  const sourceMode: 'saved' | 'suggest' = isSuggestMode ? 'suggest' : 'saved';
  const needsPricing =
    isSuggestMode
      ? suggestItemNeedsPricing(item)
      : isSavedOnly && scopeTotal <= 0 && (item.warnings?.length ?? 0) > 0;
  const canEdit = Boolean(isSavedOnly && scopeTotal > 0 && onToggleEdit);
  const canToggleInclude = Boolean(isSuggestMode && onToggleIncluded && suggestItemSelectable(item));
  const conf = item.recommended?.confidence;

  useEffect(() => {
    if (!isEditing) {
      setDraftRates({});
      return;
    }
    const next: Record<string, string> = {};
    for (const line of item.proposedRates || []) {
      if (line.pricingType === 'material' && line.rate != null) {
        next.material = String(line.rate);
      }
      if (line.pricingType === 'labor' && line.rate != null) {
        next.labor = String(line.rate);
      }
    }
    setDraftRates(next);
  }, [isEditing, item]);

  const handleDraftRateChange = (pricingType: 'material' | 'labor', text: string) => {
    setDraftRates((prev) => ({ ...prev, [pricingType]: text }));
    const cleaned = text.replace(/,/g, '').trim();
    if (!cleaned) return;
    const n = Number(cleaned);
    if (Number.isFinite(n) && n >= 0) onRateChange?.(pricingType, n);
  };

  if (needsPricing) {
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
        <View style={styles.cardTitleRow}>
          <Text style={[styles.scopeName, { color: Colors.text }]} numberOfLines={2}>
            {item.scopeName}
          </Text>
          {qtyLabel ? (
            <Text style={[styles.scopeQty, { color: Colors.sub }]}>{qtyLabel}</Text>
          ) : null}
        </View>
        <View
          style={[
            styles.needsPricingBadge,
            {
              borderColor: darkMode ? 'rgba(251,191,36,0.45)' : 'rgba(251,191,36,0.55)',
              backgroundColor: darkMode ? 'rgba(251,191,36,0.12)' : 'rgba(251,191,36,0.1)',
            },
          ]}
        >
          <Text style={{ color: '#fbbf24', fontSize: 12, fontWeight: '700' }}>
            {(item.warnings || []).find((w) => /needs manual pricing — no reliable source/i.test(w)) ||
              (item.pricingBlocked
                ? BLOCKED_PRICING_MESSAGE
                : MANUAL_PRICING_NO_SOURCE_MESSAGE)}
          </Text>
        </View>
        {item.unitMismatchSubtext ? (
          <Text style={{ color: Colors.sub, fontSize: 11, lineHeight: 16, marginTop: 8 }}>
            {item.unitMismatchSubtext}
          </Text>
        ) : null}
        {(item.warnings || [])
          .filter((w) => !/needs manual pricing/i.test(w) && w !== item.unitMismatchSubtext)
          .map((w, i) => (
            <Text key={`npw-${i}`} style={{ color: Colors.sub, fontSize: 11, lineHeight: 16, marginTop: 6 }}>
              {w}
            </Text>
          ))}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.card,
        isEditing && styles.cardEditing,
        canToggleInclude && !included && styles.cardExcluded,
        {
          borderColor: isEditing
            ? 'rgba(96,165,250,0.55)'
            : darkMode
              ? 'rgba(255,255,255,0.08)'
              : Colors.line,
          backgroundColor: darkMode ? 'rgba(255,255,255,0.03)' : Colors.surface2,
          opacity: canToggleInclude && !included ? 0.55 : 1,
        },
      ]}
    >
      <View style={styles.cardHeader}>
        {canToggleInclude ? (
          <TouchableOpacity onPress={onToggleIncluded} hitSlop={12} style={styles.includeCheck}>
            <Ionicons
              name={included ? 'checkbox' : 'square-outline'}
              size={22}
              color={included ? '#22c55e' : Colors.sub}
            />
          </TouchableOpacity>
        ) : null}
        <View style={styles.cardHeaderBody}>
          <View style={styles.cardTitleRow}>
            <Text
              style={[styles.scopeName, { color: Colors.text }]}
              numberOfLines={2}
            >
              {item.scopeName}
            </Text>
            {qtyLabel ? (
              <Text style={[styles.scopeQty, { color: Colors.sub }]}>{qtyLabel}</Text>
            ) : null}
            {isEditing && onToggleEdit ? (
              <TouchableOpacity
                onPress={() => {
                  Keyboard.dismiss();
                  onToggleEdit();
                }}
                hitSlop={12}
                activeOpacity={0.7}
                style={styles.cardCloseBtn}
              >
                <Ionicons name="chevron-up" size={18} color={Colors.sub} />
              </TouchableOpacity>
            ) : null}
          </View>
          {(() => {
            const rv = reviewStatusVisual(item.reviewStatus);
            if (!rv) return null;
            return (
              <View
                style={[
                  styles.needsPricingBadge,
                  {
                    alignSelf: 'flex-start',
                    marginTop: 6,
                    borderColor: rv.color,
                    backgroundColor: rv.bg,
                  },
                ]}
              >
                <Text style={{ color: rv.color, fontSize: 11, fontWeight: '700' }}>{rv.label}</Text>
              </View>
            );
          })()}
          {item.reviewStatus === 'needs_approval' && item.approvalSubtext ? (
            <Text style={{ color: Colors.sub, fontSize: 11, lineHeight: 16, marginTop: 6 }}>
              {item.approvalSubtext}
            </Text>
          ) : null}
          {item.reviewStatus === 'needs_approval' &&
          (item.warnings || []).find((w) => w && !/Confirm what is included/i.test(w) && !/Planning estimate/i.test(w)) ? (
            <Text style={{ color: Colors.sub, fontSize: 11, lineHeight: 16, marginTop: 4 }}>
              {(item.warnings || []).find(
                (w) =>
                  w &&
                  !/Confirm what is included/i.test(w) &&
                  !/Planning estimate/i.test(w) &&
                  !/verify before billing/i.test(w)
              )}
            </Text>
          ) : null}
          {item.priceRangeHint?.combinedTotal ? (
            <Text style={{ color: Colors.sub, fontSize: 11, marginTop: 4 }}>
              Typical range: ${Math.round(item.priceRangeHint.combinedTotal.low).toLocaleString()}–$
              {Math.round(item.priceRangeHint.combinedTotal.high).toLocaleString()}
            </Text>
          ) : null}
          {isSuggestMode && conf ? (
            <View style={styles.cardMetaRow}>
              <ConfidenceBadge confidence={conf} compact />
              {canToggleInclude && !included ? (
                <Text style={[styles.includeHint, { color: Colors.sub }]} numberOfLines={2}>
                  {item.reviewStatus === 'needs_approval'
                    ? 'Unchecked — confirm scope, then check to include'
                    : suggestItemNeedsApproval(item)
                      ? 'Unchecked — confirm scope, then check to include'
                      : suggestItemIsManualOnly(item)
                        ? 'Manual pricing recommended'
                        : 'Unchecked — tap box to include'}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>

      {isEditing ? (
        <ScopeRateEditor
          item={item}
          draftRates={draftRates}
          onDraftRateChange={handleDraftRateChange}
          Colors={Colors}
          darkMode={darkMode}
        />
      ) : canEdit ? (
        <TouchableOpacity onPress={onToggleEdit} activeOpacity={0.85}>
          {(item.proposedRates || []).map((line, i) => (
            <View key={`pr-${i}`}>
              <RateRow line={line} scopeName={item.scopeName} Colors={Colors} sourceMode={sourceMode} />
            </View>
          ))}
        </TouchableOpacity>
      ) : (
        (item.proposedRates || []).map((line, i) => (
          <View key={`pr-${i}`}>
            <RateRow line={line} scopeName={item.scopeName} Colors={Colors} sourceMode={sourceMode} />
            <MaterialCompareRow
              item={item}
              line={line}
              onSelectMaterial={(source) => onSelectMaterial(item.scopeItemId, source)}
              Colors={Colors}
              enabled={showLiveComparison}
              sourceMode={sourceMode}
            />
          </View>
        ))
      )}

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

      {(item.warnings || [])
        .filter(
          (w) =>
            w &&
            item.reviewStatus !== 'needs_approval' &&
            !/needs manual pricing|Blocked —|Planning estimate — verify/i.test(w)
        )
        .map((w, i) => (
        <Text key={`w-${i}`} style={{ color: '#fbbf24', fontSize: 11, marginTop: 8 }}>
          {w}
        </Text>
      ))}

      {canEdit && !isEditing ? (
        <TouchableOpacity
          onPress={onToggleEdit}
          activeOpacity={0.75}
          style={styles.adjustRateHint}
        >
          <Text style={{ color: '#22c55e', fontSize: 11, fontStyle: 'italic', textAlign: 'center' }}>
            Click to adjust rate
          </Text>
        </TouchableOpacity>
      ) : null}

      {isEditing && onToggleEdit ? (
        <TouchableOpacity
          onPress={() => {
            Keyboard.dismiss();
            onToggleEdit();
          }}
          activeOpacity={0.88}
          style={[
            styles.doneEditBtn,
            {
              borderColor: darkMode ? 'rgba(96,165,250,0.45)' : 'rgba(59,130,246,0.35)',
              backgroundColor: darkMode ? 'rgba(96,165,250,0.12)' : 'rgba(59,130,246,0.08)',
            },
          ]}
        >
          <Text style={{ color: '#60a5fa', fontSize: 14, fontWeight: '800' }}>Done</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function SourceLegend({ sources, mode = 'saved' }: { sources: string[]; mode?: 'saved' | 'suggest' }) {
  if (!sources.length) return null;
  return (
    <View style={styles.legend}>
      {sources.map((source) => (
        <SourceBadge key={source} source={source} mode={mode} compact />
      ))}
    </View>
  );
}

function SavedPricingFilterTabs({
  active,
  onChange,
  Colors,
  darkMode,
}: {
  active: 'all' | 'priced' | 'needs';
  onChange: (tab: 'all' | 'priced' | 'needs') => void;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
}) {
  const tabs: Array<{ id: 'all' | 'priced' | 'needs'; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'priced', label: 'Priced' },
    { id: 'needs', label: 'Needs pricing' },
  ];
  return (
    <View style={styles.filterTabs}>
      {tabs.map((tab) => {
        const selected = active === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            onPress={() => onChange(tab.id)}
            activeOpacity={0.8}
            style={[
              styles.filterTab,
              {
                borderColor: selected
                  ? '#60a5fa'
                  : darkMode
                    ? 'rgba(255,255,255,0.12)'
                    : Colors.line,
                backgroundColor: selected
                  ? darkMode
                    ? 'rgba(96,165,250,0.14)'
                    : 'rgba(59,130,246,0.1)'
                  : 'transparent',
              },
            ]}
          >
            <Text
              style={{
                color: selected ? '#60a5fa' : Colors.sub,
                fontSize: 12,
                fontWeight: '700',
              }}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
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
  onClearAllSavedPricing,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const { theme, darkMode } = useTheme();
  const Colors = getColors(theme);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [workingProposal, setWorkingProposal] = useState<PricingProposal | null>(proposal);
  const [editingScopeItemId, setEditingScopeItemId] = useState<string | null>(null);
  const [savedFilter, setSavedFilter] = useState<'all' | 'priced' | 'needs'>('all');
  const [includedScopeIds, setIncludedScopeIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!visible) {
      setWorkingProposal(null);
      setEditingScopeItemId(null);
      setSavedFilter('all');
      setIncludedScopeIds(new Set());
      return;
    }
    if (proposal) {
      const normalized = normalizePricingProposal(proposal);
      setWorkingProposal(normalized);
      if (normalized.pricingMode === 'suggest' || pricingModeProp === 'suggest') {
        setIncludedScopeIds(defaultIncludedSuggestScopeIds(normalized.scopeItems || []));
      }
    }
  }, [visible, proposal, pricingModeProp]);

  const display = normalizePricingProposal(visible ? workingProposal || proposal : null);
  const isSavedOnly =
    pricingModeProp === 'saved_only' || display.pricingMode === 'saved_only';
  const isSuggestMode = !isSavedOnly;
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

  const savedCounts = useMemo(
    () => (isSavedOnly ? countSavedPricingScopeItems(display) : null),
    [display, isSavedOnly]
  );

  const savedMatchStats = useMemo(() => {
    if (!savedCounts) return null;
    return `${savedCounts.priced} prices found • ${savedCounts.needsPricing} still need pricing`;
  }, [savedCounts]);

  const filteredScopeItems = useMemo(() => {
    const items = display.scopeItems || [];
    if (isSavedOnly && savedFilter === 'priced') {
      return items.filter((item) => scopeItemHasSavedRates(item));
    }
    if (isSavedOnly && savedFilter === 'needs') {
      return items.filter(
        (item) => !scopeItemHasSavedRates(item) && (item.warnings?.length ?? 0) > 0
      );
    }
    return items;
  }, [display.scopeItems, isSavedOnly, savedFilter]);

  const validSelectedSuggestCount = useMemo(
    () => countValidSelectedSuggestItems(display.scopeItems, includedScopeIds),
    [display.scopeItems, includedScopeIds]
  );

  const suggestTotalSelected = useMemo(
    () =>
      isSuggestMode
        ? sumValidSelectedSuggestTotal(display.scopeItems, includedScopeIds)
        : display.totalSuggested,
    [isSuggestMode, display.scopeItems, display.totalSuggested, includedScopeIds]
  );

  const suggestApplyLabel = useMemo(() => {
    if (!isSuggestMode) return applyLabel || 'Apply suggested pricing';
    if (validSelectedSuggestCount <= 0) return 'Apply valid selected prices';
    return `Apply ${validSelectedSuggestCount} valid selected price${validSelectedSuggestCount === 1 ? '' : 's'}`;
  }, [isSuggestMode, validSelectedSuggestCount, applyLabel]);

  const savedApplyLabel = useMemo(() => {
    if (!isSavedOnly || !savedCounts) return applyLabel || 'Apply saved pricing';
    const n = savedCounts.priced;
    return n > 0 ? `Apply ${n} saved price${n === 1 ? '' : 's'}` : applyLabel || 'Apply saved pricing';
  }, [isSavedOnly, savedCounts, applyLabel]);

  const savedStillNeedCaption = useMemo(() => {
    if (!isSavedOnly || !savedCounts || savedCounts.needsPricing <= 0) return null;
    const n = savedCounts.needsPricing;
    return `${n} item${n === 1 ? '' : 's'} will still need pricing.`;
  }, [isSavedOnly, savedCounts]);

  const suggestUncheckedCaption = useMemo(() => {
    if (!isSuggestMode) return null;
    const selectable = (display.scopeItems || []).filter((item) => suggestItemSelectable(item)).length;
    const unchecked = selectable - validSelectedSuggestCount;
    if (unchecked <= 0) return null;
    return `${unchecked} unchecked — shown for reference. Check a box to include, or price manually later.`;
  }, [isSuggestMode, display.scopeItems, validSelectedSuggestCount]);

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

  const handleScopeRateChange = (
    scopeItemId: string,
    pricingType: 'material' | 'labor',
    rate: number
  ) => {
    setWorkingProposal((prev) =>
      prev ? updateScopeProposedRate(prev, scopeItemId, pricingType, rate) : prev
    );
  };

  const handleBack = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onClose();
  };

  const headerTopPadding = embedded
    ? 0
    : Math.max(insets.top, Platform.OS === 'ios' ? 12 : 0) + 8;

  if (!visible || !proposal) return null;

  const shell = (
    <View style={[styles.shell, { backgroundColor: Colors.bg }]}>
        <View style={[styles.headerRow, { paddingTop: headerTopPadding }]}>
          <View style={styles.headerSide}>
            <LinearGradient
              colors={BRAND_FRAME_GRADIENT_COLORS}
              start={BRAND_FRAME_GRADIENT_START}
              end={BRAND_FRAME_GRADIENT_END}
              style={styles.backButtonBorder}
            >
              <GradientRingBackInner
                darkMode={darkMode}
                onPress={handleBack}
                style={[styles.backButton, { backgroundColor: darkMode ? '#000000' : Colors.bg }]}
              >
                <MaterialIcons
                  name="arrow-back"
                  size={24}
                  color={darkMode ? '#FFFFFF' : Colors.text}
                />
              </GradientRingBackInner>
            </LinearGradient>
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: Colors.text }]}>{title}</Text>
            {subtitle ? (
              <Text style={[styles.headerSubtitle, { color: Colors.sub }]} numberOfLines={2}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          <View style={styles.headerSide} />
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
            {isSavedOnly && onClearAllSavedPricing ? (
              <TouchableOpacity onPress={onClearAllSavedPricing} style={{ marginTop: 16 }}>
                <Text style={{ color: '#f87171', fontWeight: '700', textAlign: 'center' }}>
                  Reset all saved pricing
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }}>
            {isSavedOnly && savedMatchStats ? (
              <Text style={{ color: Colors.sub, fontSize: 12, fontWeight: '600', marginBottom: 10 }}>
                {savedMatchStats}
              </Text>
            ) : null}

            {isSavedOnly ? (
              <SavedPricingFilterTabs
                active={savedFilter}
                onChange={setSavedFilter}
                Colors={Colors}
                darkMode={darkMode}
              />
            ) : null}

            {!isSavedOnly ? <SourceLegend sources={legendSources} mode="suggest" /> : null}

            {isSavedOnly ? (
              <View
                style={[
                  styles.infoBanner,
                  { backgroundColor: darkMode ? 'rgba(96,165,250,0.12)' : 'rgba(96,165,250,0.1)' },
                ]}
              >
                <Text style={{ color: '#60a5fa', fontSize: 12, lineHeight: 17, flex: 1 }}>
                  <Text style={{ fontWeight: '800' }}>
                    {display.primarySource === 'saved_template' ? 'Template' : 'Saved bid'} rates only.
                  </Text>
                  {' '}
                  Use Suggest rough prices for vendor and regional rates.
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
                <View style={styles.infoBannerBadge}>
                  <SourceBadge source={display.primarySource === 'saved_template' ? 'saved_template' : 'saved_pricing'} compact />
                </View>
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
                <SourceBadge source="ai_rough_estimate_fallback" mode="suggest" />
                <Text style={{ color: '#fbbf24', fontSize: 12, lineHeight: 17, flex: 1 }}>
                  No saved or live pricing found — AI estimates for planning only.
                </Text>
              </View>
            ) : null}

            {useEngineCards
              ? filteredScopeItems.map((item) => (
                  <ScopeCard
                    key={item.scopeItemId}
                    item={item}
                    showScopeTotal={multiScope}
                    onSelectMaterial={handleSelectMaterial}
                    showLiveComparison={!isSavedOnly}
                    isSavedOnly={isSavedOnly}
                    isSuggestMode={isSuggestMode}
                    included={includedScopeIds.has(item.scopeItemId)}
                    onToggleIncluded={() =>
                      setIncludedScopeIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(item.scopeItemId)) next.delete(item.scopeItemId);
                        else next.add(item.scopeItemId);
                        return next;
                      })
                    }
                    isEditing={editingScopeItemId === item.scopeItemId}
                    onToggleEdit={() =>
                      setEditingScopeItemId((prev) =>
                        prev === item.scopeItemId ? null : item.scopeItemId
                      )
                    }
                    onRateChange={(pricingType, rate) =>
                      handleScopeRateChange(item.scopeItemId, pricingType, rate)
                    }
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
                        <View style={styles.rateRowRight}>
                          <Text style={[styles.rateUnitInline, { color: Colors.sub }]} numberOfLines={1}>
                            {line.formula}
                          </Text>
                          <Text style={[styles.rateTotalInline, { color: Colors.text }]} numberOfLines={1}>
                            {formatDraftMoney(line.total)}
                          </Text>
                          <SourceInlineTag source={line.priceSource} />
                        </View>
                      </View>
                    ))}
                  </View>
                ))}

            <View style={[styles.totalBox, { borderColor: Colors.line }]}>
              <Text style={{ color: Colors.sub, fontSize: 13 }}>
                {isSuggestMode
                  ? validSelectedSuggestCount > 0
                    ? 'Total (valid selected)'
                    : 'Total suggested'
                  : partialTemplateMatch
                    ? 'Total (matched items)'
                    : 'Total suggested'}
              </Text>
              <Text style={{ color: Colors.text, fontSize: 22, fontWeight: '800' }}>
                {formatDraftMoney(isSuggestMode ? suggestTotalSelected : display.totalSuggested)}
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
              {isSuggestMode ? (
                <Text style={{ color: Colors.sub, fontSize: 11, lineHeight: 16, marginBottom: 4 }}>
                  {SUGGESTED_PRICING_DISCLAIMER}
                </Text>
              ) : null}
              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  isSuggestMode && validSelectedSuggestCount <= 0 && { opacity: 0.45 },
                ]}
                disabled={isSuggestMode && validSelectedSuggestCount <= 0}
                onPress={() => {
                  if (!workingProposal) return;
                  const toApply = isSuggestMode
                    ? filterProposalToScopeItems(workingProposal, includedScopeIds)
                    : workingProposal;
                  const confirmMsg = getPricingConfirmMessage(toApply);
                  if (confirmMsg) {
                    Alert.alert('Confirm pricing', confirmMsg, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Apply anyway', onPress: () => onApply(toApply) },
                    ]);
                    return;
                  }
                  onApply(toApply);
                }}
              >
                <Text style={styles.primaryBtnText}>
                  {isSavedOnly ? savedApplyLabel : suggestApplyLabel}
                </Text>
              </TouchableOpacity>
              {isSavedOnly && savedStillNeedCaption ? (
                <Text style={{ color: Colors.sub, fontSize: 12, textAlign: 'center' }}>
                  {savedStillNeedCaption}
                </Text>
              ) : null}
              {isSuggestMode && suggestUncheckedCaption ? (
                <Text style={{ color: Colors.sub, fontSize: 12, textAlign: 'center', lineHeight: 17 }}>
                  {suggestUncheckedCaption}
                </Text>
              ) : null}
              {isSavedOnly && onClearAllSavedPricing ? (
                <TouchableOpacity onPress={onClearAllSavedPricing} style={{ marginTop: 4 }}>
                  <Text style={{ color: '#f87171', fontSize: 12, fontWeight: '700', textAlign: 'center' }}>
                    Reset all saved pricing (templates + library)
                  </Text>
                </TouchableOpacity>
              ) : null}
              {onEdit && !isSavedOnly ? (
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
        {shell}
      </View>
    );
  }

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleBack}
    >
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
      <View style={[styles.shell, { backgroundColor: Colors.bg }]}>{shell}</View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  embeddedShell: {
    zIndex: 102,
    elevation: 102,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerSide: { width: 52, alignItems: 'flex-start' },
  backButtonBorder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    padding: 1,
    overflow: 'hidden',
  },
  backButton: {
    width: '100%',
    height: '100%',
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  headerSubtitle: { fontSize: 12, marginTop: 4, textAlign: 'center', lineHeight: 17 },
  title: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
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
  badgeCompact: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    gap: 4,
  },
  badgeDotCompact: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  badgeTextCompact: {
    fontSize: 10,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  infoBannerBadge: {
    flexShrink: 0,
    maxWidth: '36%',
  },
  card: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardEditing: {
    borderWidth: 1.5,
  },
  editPanel: {
    marginTop: 4,
    gap: 10,
  },
  editFieldRow: {
    marginBottom: 2,
  },
  editInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '600',
  },
  unmatchedCard: {
    borderStyle: 'dashed',
  },
  needsPricingBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 4,
  },
  filterTabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
    gap: 8,
  },
  cardHeaderBody: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  includeHint: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
    minWidth: 0,
  },
  includeCheck: {
    marginRight: 2,
  },
  cardExcluded: {
    borderStyle: 'dashed',
  },
  cardCloseBtn: {
    padding: 4,
    marginLeft: 2,
  },
  adjustRateHint: {
    marginTop: 8,
    paddingVertical: 6,
  },
  doneEditBtn: {
    marginTop: 12,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  scopeName: { fontSize: 16, fontWeight: '800', flex: 1, flexShrink: 1, minWidth: 0 },
  scopeQty: { fontSize: 12, fontWeight: '600', flexShrink: 0 },
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
    flexShrink: 0,
  },
  rateRowRight: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    minWidth: 0,
  },
  rateUnitInline: {
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
    maxWidth: '100%',
  },
  rateTotalInline: {
    fontSize: 14,
    fontWeight: '800',
    flexShrink: 0,
  },
  sourceInlineTag: {
    fontSize: 10,
    fontWeight: '700',
    flexShrink: 0,
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
    flexDirection: 'column',
    gap: 6,
  },
  compareChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignSelf: 'stretch',
  },
  compareChipBody: {
    flex: 1,
    minWidth: 0,
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
