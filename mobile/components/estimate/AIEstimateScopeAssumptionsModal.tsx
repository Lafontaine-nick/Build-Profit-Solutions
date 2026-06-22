import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import AIEstimateFlowHeader from '@/components/estimate/AIEstimateFlowHeader';
import type {
  EstimateAiDraft,
  ScopeAssumptionState,
  ScopeChecklistItem,
  ScopeMeasurements,
} from '@/utils/estimateAiDraft';
import { formatDraftMoney, resolveDraftScopeNotes, repairDraftRatePricingFromNotes } from '@/utils/estimateAiDraft';
import {
  checklistDisplayHelper,
  choiceIdsToScopeState,
  createCustomScopeItem,
  groupScopeChecklistItems,
  initialScopeGroupCollapse,
  mergeScopeProgressIntoDraft,
  applyKitchenScopeInferences,
  hydrateScopeChecklistFromNotes,
  QUANTITY_NEEDED_LABELS_BY_TEMPLATE,
  quantityNeededLabel,
  scopeChecklistItemsForEditing,
  scopeChecklistItemsForPersist,
  expandWetAreaDerivedScopeItems,
  toggleWallLayoutChoiceIds,
  WET_AREA_DERIVED_ITEM_IDS,
  scopeChecklistSummaryCounts,
} from '@/utils/estimateScopeChecklistUi';
import {
  buildNormalizedScopeMeasurementsFromInput,
  checklistItemInScope,
  countScopePricingReadiness,
  DUAL_QUANTITY_FIELD_LABELS,
  formatUnitLabel,
  getChecklistItemQuantityRule,
  hasCompleteUserSelectedPricing,
  initialScopeMeasurementInputExtended,
  isDualAllowanceItem,
  overlayDualRatePricingDisplay,
  prepareScopeMeasurementsInputForUi,
  resolveChecklistItemQuantity,
  resolveDualRatePricingDisplayFromNotes,
  resolveScopeItemSuggestedPricing,
  roughAllowanceSubKey,
  scopeMeasurementsPayloadForPersist,
  type PricingLegSource,
  type ScopeMeasurementsInputExtended,
  type ScopePricingContext,
  type SuggestedPricingBlock,
} from '@/utils/scopeItemQuantities';
import {
  emptyQuickMeasurementInput,
  quickMeasurementRowsForInput,
  type QuickMeasurementFieldKey,
} from '@/utils/scopeQuickMeasurements';
import { parseScopeMeasurementsFromNotes } from '@/utils/scopeMeasurementParser';

import { estimateFlowCardStyle, estimateFlowDividerColor } from '@/utils/estimateFlowCardStyle';
import {
  SCOPE_ITEM_TIER_OPACITY,
  scopeChecklistNoteSummary,
  scopeItemNoteBadge,
  scopeItemVisualTier,
  type ScopeItemNoteBadge,
  type ScopeItemVisualContext,
} from '@/utils/scopeItemVisualTier';

type Props = {
  visible: boolean;
  draft: EstimateAiDraft | null;
  /** Session notes when draft.originalNotes was not persisted on the draft object. */
  notesFallback?: string | null;
  applying?: boolean;
  fromAssistant?: boolean;
  onBack: () => void;
  onClose: () => void;
  onConfirm: (items: ScopeChecklistItem[], measurements?: ScopeMeasurements) => void;
  onScopeOnly?: (measurements?: ScopeMeasurements) => void;
  /** Persist in-progress scope without API round-trip (e.g. when navigating to review/pricing). */
  onPersistProgress?: (items: ScopeChecklistItem[], measurements?: ScopeMeasurements) => void;
  /** Saved templates + active bid used to prefer saved $/unit rates in suggested pricing. */
  pricingContext?: ScopePricingContext | null;
};

const QUANTITY_NEEDED_LABELS: Record<string, string> = {
  tub_demo: 'tub count',
  shower_floor_demo: 'shower floor demo sqft',
  wet_area_install: 'tub or pan count',
  shower_tile: 'shower wall sqft',
  shower_floor_tile: 'shower floor sqft',
  waterproofing: 'shower wall sqft',
  shower_pan: 'mud pan count (labor + materials)',
  shower_niche: 'niche count',
  shower_bench_curb: 'bench/curb count or LF',
  floor_tile: 'bathroom floor sqft',
  floor_prep: 'floor sqft or allowance',
  paint: 'wall/ceiling paint sqft',
  trim: 'linear feet',
  tub_shower: 'shower area sqft',
  drywall: 'repair sqft',
  cabinets: 'cabinet LF or allowance',
  countertops: 'countertop sqft',
  backsplash: 'backsplash sqft',
  flooring: 'floor sqft',
  rock_mulch: 'sqft, CY, or tons',
  sod_turf: 'turf sqft',
  pavers: 'paver sqft',
  concrete: 'concrete sqft or CY',
  excavation: 'excavation CY or sqft',
};

const scopeNumericInputProps = {
  textContentType: 'none' as const,
  autoComplete: 'off' as const,
};

function hapticTap() {
  if (Platform.OS !== 'web') {
    Haptics.selectionAsync();
  }
}

function inputShellStyle(Colors: ReturnType<typeof getColors>, darkMode: boolean) {
  return {
    backgroundColor: darkMode ? 'rgba(255,255,255,0.05)' : Colors.surface2,
    borderColor: darkMode ? 'rgba(148, 163, 184, 0.16)' : Colors.line,
  };
}

function captionColor(darkMode: boolean, Colors: ReturnType<typeof getColors>) {
  return darkMode ? 'rgba(255,255,255,0.62)' : Colors.sub;
}

function dividerColor(darkMode: boolean) {
  return estimateFlowDividerColor(darkMode);
}

function ScopeItemTitleRow({
  label,
  noteBadge,
  rightAccessory,
  darkMode,
  Colors,
}: {
  label: string;
  noteBadge?: ScopeItemNoteBadge | null;
  rightAccessory?: React.ReactNode;
  darkMode: boolean;
  Colors: ReturnType<typeof getColors>;
}) {
  const badgeLabel =
    noteBadge === 'prefilled'
      ? 'Prefilled'
      : noteBadge === 'mentioned'
        ? 'In notes'
        : noteBadge === 'review'
          ? 'Review'
          : null;
  const badgeColor = noteBadge === 'review' ? '#f59e0b' : '#22c55e';

  return (
    <View style={styles.cardTitleRow}>
      <Text
        style={{
          color: darkMode ? '#F5F7FA' : Colors.text,
          fontSize: 14,
          fontWeight: '700',
          lineHeight: 20,
          flex: 1,
        }}
      >
        {label}
      </Text>
      {badgeLabel ? (
        <View style={[styles.fromNotesBadge, darkMode ? styles.fromNotesBadgeDark : styles.fromNotesBadgeLight]}>
          <Text style={{ color: badgeColor, fontSize: 10, fontWeight: '700' }}>{badgeLabel}</Text>
        </View>
      ) : null}
      {rightAccessory ?? null}
    </View>
  );
}

function isUserEditingQuantity(
  measurementsInput: ScopeMeasurementsInputExtended,
  itemId: string,
  allowanceKey?: string
): boolean {
  const entry = measurementsInput.itemQuantities[itemId];
  const allowanceEntry = allowanceKey ? measurementsInput.itemQuantities[allowanceKey] : undefined;
  return entry?.quantitySource === 'user_entered' || allowanceEntry?.quantitySource === 'user_entered';
}

function formatResolvedQuantityDisplay(quantity: number, unit: string, quantitySource?: string): string {
  if (unit === 'allowance' || unit === 'lump_sum') {
    if (quantitySource === 'default_assumption') {
      return `${quantity.toLocaleString()} ${formatUnitLabel(unit)}`;
    }
    return formatDraftMoney(quantity);
  }
  return `${quantity.toLocaleString()} ${formatUnitLabel(unit)}`;
}

function pricingTextColor(darkMode: boolean, Colors: ReturnType<typeof getColors>) {
  return darkMode ? '#F5F7FA' : Colors.text;
}

function pricingLabelColor(darkMode: boolean, Colors: ReturnType<typeof getColors>) {
  return darkMode ? 'rgba(255,255,255,0.72)' : Colors.sub;
}

/** Maps a per-leg pricing source to the small pill shown next to that line. */
function legPillKind(source: PricingLegSource): 'notes' | 'template' | 'national' {
  if (source === 'notes') return 'notes';
  if (source === 'template') return 'template';
  return 'national';
}

function legSourcePill({
  block,
  leg,
}: {
  block: SuggestedPricingBlock;
  leg: 'material' | 'labor';
}) {
  const source = leg === 'material' ? block.materialSource : block.laborSource;
  if (block.mode === 'note_total_split' && leg === 'labor' && source === 'notes') {
    return <SourcePill kind="remainder" label="Remainder" />;
  }
  return <SourcePill kind={legPillKind(source)} />;
}

function SourcePill({
  kind,
  label,
}: {
  kind: 'notes' | 'national' | 'template' | 'remainder';
  label?: string;
}) {
  const defaultText =
    kind === 'notes'
      ? 'From notes'
      : kind === 'template'
        ? 'Saved rate'
        : kind === 'remainder'
          ? 'Remainder'
          : 'National Average';
  const text = label || defaultText;
  const color =
    kind === 'notes'
      ? '#22c55e'
      : kind === 'template'
        ? '#a78bfa'
        : kind === 'remainder'
          ? '#f59e0b'
          : '#60a5fa';
  const pillStyle =
    kind === 'notes'
      ? styles.sourcePillNotes
      : kind === 'template'
        ? styles.sourcePillTemplate
        : kind === 'remainder'
          ? styles.sourcePillRemainder
        : styles.sourcePillNational;
  return (
    <View style={[styles.sourcePill, pillStyle]}>
      <Text style={{ color, fontSize: 11, fontWeight: '700' }}>{text}</Text>
    </View>
  );
}

/** Saved templates + active bid, supplied once and consumed by every QuantitySection. */
const ScopePricingContextValue = React.createContext<ScopePricingContext | null>(null);

function PricingAmountRow({
  value,
  label,
  pill,
  helper,
  darkMode,
  Colors,
  emphasized,
}: {
  value: string;
  label?: string;
  pill?: React.ReactNode;
  helper?: string | null;
  darkMode: boolean;
  Colors: ReturnType<typeof getColors>;
  emphasized?: boolean;
}) {
  return (
    <View style={[styles.pricingRow, emphasized ? styles.pricingRowEmphasized : undefined]}>
      <View style={styles.pricingRowMain}>
        <Text
          style={{
            color: pricingTextColor(darkMode, Colors),
            fontSize: emphasized ? 17 : 15,
            fontWeight: '700',
            letterSpacing: emphasized ? -0.2 : 0,
          }}
        >
          {value}
        </Text>
        <View style={{ alignItems: 'flex-end', flexShrink: 1 }}>
          {pill ?? (
            <Text style={{ color: pricingLabelColor(darkMode, Colors), fontSize: 13, fontWeight: '600' }}>
              {label}
            </Text>
          )}
        </View>
      </View>
      {helper ? (
        <Text style={[styles.pricingRateHelper, { color: pricingLabelColor(darkMode, Colors) }]}>
          Rate: {helper}
        </Text>
      ) : null}
    </View>
  );
}

function PricingSplitRow({
  label,
  value,
  pill,
  helper,
  darkMode,
  Colors,
}: {
  label: string;
  value: string;
  pill?: React.ReactNode;
  helper?: string | null;
  darkMode: boolean;
  Colors: ReturnType<typeof getColors>;
}) {
  return (
    <View style={styles.pricingSplitRow}>
      <View style={styles.pricingSplitRowMain}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
          <Text style={{ color: pricingLabelColor(darkMode, Colors), fontSize: 14, fontWeight: '600' }}>
            {label}
          </Text>
          {pill ?? null}
        </View>
        <Text style={{ color: pricingTextColor(darkMode, Colors), fontSize: 15, fontWeight: '700' }}>
          {value}
        </Text>
      </View>
      {helper ? (
        <Text style={[styles.pricingRateHelper, { color: pricingLabelColor(darkMode, Colors) }]}>
          Rate: {helper}
        </Text>
      ) : null}
    </View>
  );
}

function SuggestedBudgetSplitRows({
  block,
  Colors,
  darkMode,
  onUsePricing,
}: {
  block: SuggestedPricingBlock;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  onUsePricing?: () => void;
}) {
  const panelBg = darkMode ? 'rgba(96, 165, 250, 0.08)' : 'rgba(96, 165, 250, 0.06)';
  const panelBorder = darkMode ? 'rgba(96, 165, 250, 0.22)' : 'rgba(96, 165, 250, 0.18)';
  const usesTemplate = block.materialSource === 'template' || block.laborSource === 'template';
  const headerTitle =
    block.mode === 'note_total_split'
      ? 'Budget split'
      : block.isComparison
        ? 'Suggested comparison'
        : 'Suggested pricing';
  const headerPillKind = usesTemplate ? 'template' : 'national';
  const headerPillLabel = block.rateSourceLabel;

  const explanation =
    block.mode === 'note_total_split'
      ? `Notes gave one total. Material uses ${usesTemplate ? 'your saved rate' : 'National Average'}; labor is the remaining note total.`
      : block.mode === 'fill_missing'
        ? `Notes only priced one side, so the missing side uses ${usesTemplate ? 'your saved rate' : 'National Average'}. Notes pricing stays primary.`
        : block.isComparison
          ? `Comparison from ${usesTemplate ? 'your saved rate' : 'National Average'}. Notes pricing remains primary.${usesTemplate && block.templateName ? ` Source: ${block.templateName}.` : ''}`
          : `Suggested from ${usesTemplate ? 'your saved rate' : 'National Average'} because notes only gave a quantity, not pricing.`;

  return (
    <View
      style={[
        styles.budgetSplitPanel,
        { backgroundColor: panelBg, borderColor: panelBorder },
      ]}
    >
      <View style={styles.budgetSplitHeader}>
        <Text style={{ color: pricingTextColor(darkMode, Colors), fontSize: 14, fontWeight: '700' }}>
          {headerTitle}
        </Text>
        <SourcePill kind={headerPillKind} label={headerPillLabel} />
      </View>
      <PricingSplitRow
        label="Material"
        value={formatDraftMoney(block.material)}
        pill={legSourcePill({ block, leg: 'material' })}
        helper={unitRateHelper(String(block.material), block.basis)}
        darkMode={darkMode}
        Colors={Colors}
      />
      <PricingSplitRow
        label="Labor"
        value={formatDraftMoney(block.labor)}
        pill={legSourcePill({ block, leg: 'labor' })}
        helper={unitRateHelper(String(block.labor), block.basis)}
        darkMode={darkMode}
        Colors={Colors}
      />
      <PricingSplitRow
        label="Total"
        value={formatDraftMoney(block.total)}
        darkMode={darkMode}
        Colors={Colors}
      />
      {block.helper ? (
        <Text
          style={{
            color: pricingLabelColor(darkMode, Colors),
            fontSize: 12,
            lineHeight: 17,
            marginTop: 8,
          }}
        >
          {block.helper}
        </Text>
      ) : null}
      <Text
        style={{
          color: pricingLabelColor(darkMode, Colors),
          fontSize: 12,
          lineHeight: 17,
          marginTop: 4,
        }}
      >
        {explanation}
      </Text>
      {onUsePricing ? (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onUsePricing}
          style={styles.useSuggestedPricingBtn}
        >
          <Text style={styles.useSuggestedPricingBtnText}>Use this pricing</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/** Collapsible "Compare to suggested/saved" panel shown when notes priced both legs. */
function ComparisonToggle({
  block,
  Colors,
  darkMode,
  onUsePricing,
}: {
  block: SuggestedPricingBlock;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  onUsePricing?: () => void;
}) {
  const usesTemplate = block.materialSource === 'template' || block.laborSource === 'template';
  const [open, setOpen] = useState(usesTemplate);

  useEffect(() => {
    if (usesTemplate) setOpen(true);
  }, [usesTemplate, block.templateName]);

  return (
    <View style={{ marginTop: 8 }}>
      <TouchableOpacity activeOpacity={0.7} onPress={() => setOpen((prev) => !prev)}>
        <Text style={styles.editQuantityLink}>
          {open ? 'Hide comparison' : `Compare to ${usesTemplate ? 'saved rate' : 'National Average'}`}
        </Text>
      </TouchableOpacity>
      {open ? (
        <SuggestedBudgetSplitRows
          block={block}
          Colors={Colors}
          darkMode={darkMode}
          onUsePricing={onUsePricing}
        />
      ) : null}
    </View>
  );
}

function EditQuantityLink({ onPress, label = 'Edit pricing' }: { onPress: () => void; label?: string }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.editQuantityLink}>{label}</Text>
    </TouchableOpacity>
  );
}

function PricingInputField({
  label,
  value,
  helper,
  basis,
  prefix,
  suffix,
  placeholder = '0',
  defaultInputMode = 'total',
  onFocus,
  onChangeText,
  onBlur,
  Colors,
  darkMode,
  applying,
}: {
  label: string;
  value: string;
  helper?: string | null;
  basis?: { quantity: number; unit: string } | null;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
  defaultInputMode?: 'total' | 'rate';
  onFocus: () => void;
  onChangeText: (text: string) => void;
  onBlur: () => void;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  applying: boolean;
}) {
  const [inputMode, setInputMode] = useState<'total' | 'rate'>(defaultInputMode);
  const [rateDraft, setRateDraft] = useState('');
  const [rateEditing, setRateEditing] = useState(false);
  const inputShell = inputShellStyle(Colors, darkMode);
  const placeholderColor = darkMode ? 'rgba(255,255,255,0.35)' : '#94a3b8';
  const supportsRateMode = Boolean(basis?.quantity && basis.quantity > 0);
  const amount = Number(String(value || '').replace(/,/g, ''));
  const rateValue =
    supportsRateMode && Number.isFinite(amount) && amount > 0
      ? String(Math.round((amount / basis!.quantity) * 100) / 100)
      : '';
  const displayValue = inputMode === 'rate' ? (rateEditing ? rateDraft : rateValue) : value;
  const activePrefix = inputMode === 'rate' ? '$' : prefix;
  const activeSuffix = inputMode === 'rate' && basis ? `/${formatUnitLabel(basis.unit)}` : suffix;
  const helperText =
    inputMode === 'rate' && Number.isFinite(amount) && amount > 0
      ? `Total ${formatDraftMoney(amount)}`
      : helper;
  useEffect(() => {
    if (inputMode === 'rate' && !rateEditing) {
      setRateDraft(rateValue);
    }
  }, [inputMode, rateEditing, rateValue]);
  const handleChangeText = (text: string) => {
    if (inputMode === 'rate' && basis?.quantity) {
      const normalized = String(text || '')
        .replace(/,/g, '')
        .replace(/[^\d.]/g, '');
      if (!/^\d*\.?\d*$/.test(normalized)) return;
      setRateDraft(normalized);
      if (!normalized || normalized === '.') {
        onChangeText('');
        return;
      }
      const rate = Number(normalized);
      if (!Number.isFinite(rate)) {
        onChangeText('');
        return;
      }
      onChangeText(String(Math.round(rate * basis.quantity * 100) / 100));
      return;
    }
    onChangeText(text);
  };

  return (
    <View
      style={[
        styles.pricingInputCard,
        {
          borderColor: inputShell.borderColor,
          backgroundColor: darkMode ? 'rgba(255,255,255,0.035)' : 'rgba(248,250,252,0.9)',
        },
      ]}
    >
      <View style={styles.pricingInputHeader}>
        <Text
          style={{
            color: Colors.sub,
            fontSize: 12,
            fontWeight: '700',
          }}
        >
          {label}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        {helperText ? (
          <View
            style={[
              styles.rateChip,
              {
                borderColor: darkMode ? 'rgba(96, 165, 250, 0.28)' : 'rgba(59, 130, 246, 0.24)',
                backgroundColor: darkMode ? 'rgba(96, 165, 250, 0.09)' : 'rgba(59, 130, 246, 0.08)',
              },
            ]}
          >
            <Text style={{ color: '#60a5fa', fontSize: 11, fontWeight: '700' }}>{helperText}</Text>
          </View>
        ) : null}
        {supportsRateMode ? (
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => setInputMode((mode) => (mode === 'total' ? 'rate' : 'total'))}
            style={[
              styles.rateModeToggle,
              {
                borderColor: darkMode ? 'rgba(34, 197, 94, 0.3)' : 'rgba(22, 163, 74, 0.24)',
                backgroundColor: darkMode ? 'rgba(34, 197, 94, 0.08)' : 'rgba(22, 163, 74, 0.08)',
              },
            ]}
          >
            <Text style={{ color: '#22c55e', fontSize: 11, fontWeight: '700' }}>
              {inputMode === 'total' ? `Edit $/${formatUnitLabel(basis!.unit)}` : 'Edit total'}
            </Text>
          </TouchableOpacity>
        ) : null}
        </View>
      </View>
      <View
        style={[
          styles.pricingInputRow,
          {
            borderColor: inputShell.borderColor,
            backgroundColor: inputShell.backgroundColor,
          },
        ]}
      >
        {activePrefix ? (
          <Text style={{ color: captionColor(darkMode, Colors), fontSize: 15, fontWeight: '700' }}>
            {activePrefix}
          </Text>
        ) : null}
        <TextInput
          value={displayValue}
          onFocus={() => {
            if (inputMode === 'rate') {
              setRateEditing(true);
              setRateDraft(rateValue);
            }
            onFocus();
          }}
          onChangeText={handleChangeText}
          onBlur={() => {
            setRateEditing(false);
            onBlur();
          }}
          placeholder={placeholder}
          placeholderTextColor={placeholderColor}
          keyboardType="decimal-pad"
          {...scopeNumericInputProps}
          editable={!applying}
          style={[
            styles.pricingInput,
            { color: Colors.text },
          ]}
        />
        {activeSuffix ? (
          <Text style={{ color: Colors.sub, fontSize: 12, fontWeight: '600', minWidth: 40 }}>
            {activeSuffix}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function parseBudgetSplitBasis(block: SuggestedPricingBlock | null) {
  if (block?.basis && block.basis.quantity > 0) {
    return { quantity: block.basis.quantity, unit: block.basis.unit };
  }
  const match = block?.helper?.match(/^([\d,.]+)\s+([A-Z]+)/i);
  if (!match) return null;
  const quantity = Number(match[1].replace(/,/g, ''));
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  const unit = match[2].toLowerCase() === 'sqft' ? 'sqft' : match[2].toLowerCase();
  return { quantity, unit };
}

function unitRateHelper(
  amountValue: string | undefined,
  basis: { quantity: number; unit: string } | null | undefined
): string | null {
  const amount = Number(String(amountValue || '').replace(/,/g, ''));
  if (!basis || !Number.isFinite(amount) || amount <= 0 || basis.quantity <= 0) return null;
  const rate = Math.round((amount / basis.quantity) * 100) / 100;
  return `${formatDraftMoney(rate)} / ${formatUnitLabel(basis.unit)}`;
}

function scoreScopeNotesForMeasurements(
  notes: string,
  templateKey?: string | null,
  projectType?: string | null
): number {
  const text = String(notes || '').trim();
  if (!text) return 0;
  const parsed = parseScopeMeasurementsFromNotes(text, {
    templateKey: templateKey ?? undefined,
    projectType: projectType ?? undefined,
  });
  let score = Math.min(text.length, 500) / 1000;
  if (parsed.bathroomFloorSqft) score += 8;
  if (parsed.kitchenFloorSqft) score += 8;
  if (parsed.floorAreaSqft) score += 8;
  if (parsed.baseboardLf) score += 5;
  if (parsed.itemQuantities?.floor_demo?.quantity) score += 8;
  if (parsed.itemQuantities?.trim?.quantity) score += 3;
  if (/\bnot\s+priced\s+yet\b/i.test(text)) score += 3;
  return score;
}

function chooseBestScopeNotes(
  draft: EstimateAiDraft | null,
  notesFallback?: string | null
): string {
  const candidates = [
    String(notesFallback || '').trim(),
    resolveDraftScopeNotes(draft),
    String(draft?.originalNotes || '').trim(),
    String(draft?.projectDescription || '').trim(),
    String(draft?.contractScope || '').trim(),
    String(draft?.scopeChecklist?.intro || '').trim(),
  ].filter(Boolean);

  let best = '';
  let bestScore = -1;
  for (const candidate of candidates) {
    const score = scoreScopeNotesForMeasurements(
      candidate,
      draft?.scopeChecklist?.templateKey,
      draft?.projectType
    );
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

function scopeCardStyle(
  tier: ReturnType<typeof scopeItemVisualTier>,
  Colors: ReturnType<typeof getColors>,
  darkMode: boolean
) {
  return [styles.card, estimateFlowCardStyle(Colors, darkMode), { opacity: SCOPE_ITEM_TIER_OPACITY[tier] }];
}

function isCustomScopeItem(item: ScopeChecklistItem): boolean {
  return item.category === 'custom' || String(item.id || '').startsWith('custom_');
}

function customScopePricingTotal(
  measurementsInput: ScopeMeasurementsInputExtended,
  itemId: string
): number {
  const base = measurementsInput.itemQuantities[itemId];
  const allowance = measurementsInput.itemQuantities[`${itemId}__allowance`];
  const material = measurementsInput.itemQuantities[`${itemId}__material`];
  const labor = measurementsInput.itemQuantities[`${itemId}__labor`];
  const total =
    Number(allowance?.quantity || 0) ||
    (base?.unit === 'allowance' ? Number(base.quantity || 0) : 0) ||
    Number(material?.quantity || 0) + Number(labor?.quantity || 0);
  return Number.isFinite(total) && total > 0 ? total : 0;
}

function CustomScopePricingSection({
  itemId,
  inScope,
  measurementsInput,
  onItemQuantityChange,
  onItemQuantityBlur,
  onItemQuantityFocus,
  onSavePricing,
  Colors,
  darkMode,
  applying,
}: {
  itemId: string;
  inScope: boolean;
  measurementsInput: ScopeMeasurementsInputExtended;
  onItemQuantityChange: (
    itemId: string,
    quantity: string,
    field?: 'count' | 'allowance',
    unit?: string
  ) => void;
  onItemQuantityBlur: (itemId: string, field?: 'count' | 'allowance') => void;
  onItemQuantityFocus: (itemId: string, field?: 'count' | 'allowance') => void;
  onSavePricing?: () => void;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  applying: boolean;
}) {
  const [pricingEditorOpen, setPricingEditorOpen] = useState(true);
  if (!inScope) return null;
  const itemInput = measurementsInput.itemQuantities[itemId];
  const materialKey = `${itemId}__material`;
  const laborKey = `${itemId}__labor`;
  const allowanceKey = `${itemId}__allowance`;
  const materialValue = measurementsInput.itemQuantities[materialKey]?.quantity ?? '';
  const laborValue = measurementsInput.itemQuantities[laborKey]?.quantity ?? '';
  const selectedUnit = itemInput?.unit === 'lf' || itemInput?.unit === 'allowance' ? itemInput.unit : 'sqft';
  const basis =
    selectedUnit === 'sqft' || selectedUnit === 'lf'
      ? {
          quantity: Number(String(itemInput?.quantity || '').replace(/,/g, '')),
          unit: selectedUnit,
        }
      : null;
  const validBasis = basis && Number.isFinite(basis.quantity) && basis.quantity > 0 ? basis : null;
  const moneyTotal = (material: string, labor: string) => {
    const materialNumber = Number(String(material || '').replace(/,/g, ''));
    const laborNumber = Number(String(labor || '').replace(/,/g, ''));
    const total =
      (Number.isFinite(materialNumber) && materialNumber > 0 ? materialNumber : 0) +
      (Number.isFinite(laborNumber) && laborNumber > 0 ? laborNumber : 0);
    return total > 0 ? String(Math.round(total * 100) / 100) : '';
  };
  const handleMaterialChange = (text: string) => {
    onItemQuantityChange(materialKey, text, 'count', 'allowance');
    onItemQuantityChange(allowanceKey, moneyTotal(text, laborValue), 'count', 'allowance');
  };
  const handleLaborChange = (text: string) => {
    onItemQuantityChange(laborKey, text, 'count', 'allowance');
    onItemQuantityChange(allowanceKey, moneyTotal(materialValue, text), 'count', 'allowance');
  };
  const splitTotal = moneyTotal(materialValue, laborValue);
  const hasBasis = selectedUnit !== 'allowance' && Boolean(validBasis);
  const hasSplitPricing = hasBasis && Boolean(splitTotal);
  const totalOnlyAmount =
    selectedUnit === 'allowance'
      ? Number(String(itemInput?.quantity || '').replace(/,/g, ''))
      : 0;
  const hasTotalOnlyPricing = selectedUnit === 'allowance' && Number.isFinite(totalOnlyAmount) && totalOnlyAmount > 0;
  const showEditor = pricingEditorOpen || (!hasSplitPricing && !hasTotalOnlyPricing);

  if (!showEditor) {
    return (
      <View style={[styles.qtySection, { borderTopColor: dividerColor(darkMode) }]}>
        {hasTotalOnlyPricing ? (
          <PricingSplitRow
            label="Total"
            value={formatDraftMoney(totalOnlyAmount)}
            darkMode={darkMode}
            Colors={Colors}
          />
        ) : null}
        {hasSplitPricing && validBasis ? (
          <>
            <PricingSplitRow
              label={`Total ${formatUnitLabel(validBasis.unit)}`}
              value={`${validBasis.quantity.toLocaleString()} ${formatUnitLabel(validBasis.unit)}`}
              darkMode={darkMode}
              Colors={Colors}
            />
            {materialValue ? (
              <PricingSplitRow
                label="Material"
                value={formatDraftMoney(Number(materialValue))}
                helper={unitRateHelper(materialValue, validBasis)}
                darkMode={darkMode}
                Colors={Colors}
              />
            ) : null}
            {laborValue ? (
              <PricingSplitRow
                label="Labor"
                value={formatDraftMoney(Number(laborValue))}
                helper={unitRateHelper(laborValue, validBasis)}
                darkMode={darkMode}
                Colors={Colors}
              />
            ) : null}
            <PricingSplitRow
              label="Total"
              value={formatDraftMoney(Number(splitTotal))}
              darkMode={darkMode}
              Colors={Colors}
            />
          </>
        ) : null}
        <EditQuantityLink onPress={() => setPricingEditorOpen(true)} />
      </View>
    );
  }

  return (
    <View style={[styles.qtySection, { borderTopColor: dividerColor(darkMode) }]}>
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => (hasSplitPricing || hasTotalOnlyPricing) && setPricingEditorOpen(false)}
      >
        <Text style={{ color: '#fbbf24', fontSize: 11, fontWeight: '700', marginBottom: 6 }}>
          Edit pricing
        </Text>
        <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, marginBottom: 4, lineHeight: 15 }}>
          Enter a quantity basis, then material and labor totals.
        </Text>
        {hasSplitPricing || hasTotalOnlyPricing ? (
          <Text style={{ color: '#60a5fa', fontSize: 11, fontWeight: '700', marginBottom: 8 }}>
            Tap card to collapse
          </Text>
        ) : null}
      </TouchableOpacity>
      <View style={styles.customPricingModeLinks}>
        {(['sqft', 'lf', 'allowance'] as const).map((unit) => {
          const active = selectedUnit === unit;
          const label = unit === 'allowance' ? 'Use total' : `Use ${formatUnitLabel(unit)}`;
          return (
            <TouchableOpacity
              key={unit}
              activeOpacity={0.75}
              disabled={applying || active}
              onPress={() => onItemQuantityChange(itemId, unit === 'allowance' ? '' : itemInput?.quantity ?? '', 'count', unit)}
              style={[
                styles.customPricingModeChip,
                {
                  borderColor: active ? '#22c55e' : darkMode ? 'rgba(148, 163, 184, 0.24)' : Colors.line,
                  backgroundColor: active
                    ? darkMode
                      ? 'rgba(34, 197, 94, 0.12)'
                      : 'rgba(34, 197, 94, 0.08)'
                    : 'transparent',
                },
              ]}
            >
              <Text
                style={{
                  color: active ? '#22c55e' : '#60a5fa',
                  fontSize: 11,
                  fontWeight: '700',
                }}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <PricingInputField
        label={selectedUnit === 'allowance' ? 'Lump sum / total' : `Total ${formatUnitLabel(selectedUnit)}`}
        value={itemInput?.quantity ?? ''}
        prefix={selectedUnit === 'allowance' ? '$' : undefined}
        suffix={selectedUnit === 'allowance' ? undefined : formatUnitLabel(selectedUnit)}
        placeholder={selectedUnit === 'allowance' ? 'Enter total' : `Enter ${formatUnitLabel(selectedUnit)}`}
        onFocus={() => onItemQuantityFocus(itemId)}
        onChangeText={(text) => onItemQuantityChange(itemId, text, 'count', selectedUnit)}
        onBlur={() => onItemQuantityBlur(itemId)}
        Colors={Colors}
        darkMode={darkMode}
        applying={applying}
      />
      {selectedUnit !== 'allowance' ? (
        <>
          <PricingInputField
            key={`custom-material-${selectedUnit}-${validBasis ? 'rate' : 'total'}`}
            label="Material"
            value={materialValue}
            helper={unitRateHelper(materialValue, validBasis)}
            basis={validBasis}
            prefix="$"
            placeholder={validBasis ? `Material $/${formatUnitLabel(selectedUnit)}` : 'Material total'}
            defaultInputMode={validBasis ? 'rate' : 'total'}
            onFocus={() => onItemQuantityFocus(materialKey)}
            onChangeText={handleMaterialChange}
            onBlur={() => onItemQuantityBlur(materialKey)}
            Colors={Colors}
            darkMode={darkMode}
            applying={applying}
          />
          <PricingInputField
            key={`custom-labor-${selectedUnit}-${validBasis ? 'rate' : 'total'}`}
            label="Labor"
            value={laborValue}
            helper={unitRateHelper(laborValue, validBasis)}
            basis={validBasis}
            prefix="$"
            placeholder={validBasis ? `Labor $/${formatUnitLabel(selectedUnit)}` : 'Labor total'}
            defaultInputMode={validBasis ? 'rate' : 'total'}
            onFocus={() => onItemQuantityFocus(laborKey)}
            onChangeText={handleLaborChange}
            onBlur={() => onItemQuantityBlur(laborKey)}
            Colors={Colors}
            darkMode={darkMode}
            applying={applying}
          />
          {splitTotal ? (
            <PricingSplitRow
              label="Total"
              value={formatDraftMoney(Number(splitTotal))}
              darkMode={darkMode}
              Colors={Colors}
            />
          ) : null}
        </>
      ) : null}
      {hasSplitPricing || hasTotalOnlyPricing ? (
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={applying}
          onPress={() => {
            setPricingEditorOpen(false);
            setTimeout(() => {
              Keyboard.dismiss();
              onSavePricing?.();
            }, 180);
          }}
          style={[styles.savePricingBtn, applying && styles.primaryBtnDisabled]}
        >
          <Text style={styles.savePricingBtnText}>Save pricing</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function buildNormFromInput(
  input: ScopeMeasurementsInputExtended,
  notes?: string | null,
  templateKey?: string | null
) {
  return buildNormalizedScopeMeasurementsFromInput(input, { notes, templateKey });
}

function QuantitySection({
  itemId,
  choiceId,
  inScope,
  templateKey,
  originalNotes,
  measurementsInput,
  onItemQuantityChange,
  onItemQuantityBlur,
  onItemQuantityFocus,
  onApplySuggestedPricing,
  Colors,
  darkMode,
  applying,
}: {
  itemId: string;
  choiceId?: string | null;
  inScope: boolean;
  templateKey?: string | null;
  originalNotes?: string | null;
  measurementsInput: ScopeMeasurementsInputExtended;
  onItemQuantityChange: (
    itemId: string,
    quantity: string,
    field?: 'count' | 'allowance',
    unit?: string
  ) => void;
  onItemQuantityBlur: (itemId: string, field?: 'count' | 'allowance') => void;
  onItemQuantityFocus: (itemId: string, field?: 'count' | 'allowance') => void;
  onApplySuggestedPricing?: (itemId: string, block: SuggestedPricingBlock) => void;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  applying: boolean;
}) {
  const [pricingEditorOpen, setPricingEditorOpen] = useState(false);
  const [focusedPricingField, setFocusedPricingField] = useState<string | null>(null);
  const pricingContext = React.useContext(ScopePricingContextValue);
  const rule = getChecklistItemQuantityRule(itemId, templateKey);
  if (!inScope || !rule) return null;

  const norm = buildNormFromInput(measurementsInput, originalNotes, templateKey);
  let resolved = resolveChecklistItemQuantity(itemId, norm, {
    choiceId,
    templateKey,
    notes: originalNotes,
  });
  if (rule?.dualAllowanceField) {
    resolved = overlayDualRatePricingDisplay(itemId, resolved, norm, originalNotes, templateKey);
  }
  if (!resolved.showInput && !resolved.pricingReady) return null;
  const inputShell = inputShellStyle(Colors, darkMode);
  const placeholderColor = darkMode ? 'rgba(255,255,255,0.35)' : '#94a3b8';
  const focusQuantityField = (targetItemId: string, field: 'count' | 'allowance' = 'count') => {
    setFocusedPricingField(`${targetItemId}:${field}`);
    onItemQuantityFocus(targetItemId, field);
  };
  const blurQuantityField = (targetItemId: string, field: 'count' | 'allowance' = 'count') => {
    setFocusedPricingField(null);
    onItemQuantityBlur(targetItemId, field);
  };

  if (rule.dualAllowanceField) {
    const fieldLabels = DUAL_QUANTITY_FIELD_LABELS[itemId];
    const allowanceKey = roughAllowanceSubKey(itemId);
    const materialKey = `${itemId}__material`;
    const laborKey = `${itemId}__labor`;
    const countInput = measurementsInput.itemQuantities[itemId];
    const allowanceInput = measurementsInput.itemQuantities[allowanceKey];
    const materialInput = measurementsInput.itemQuantities[materialKey];
    const laborInput = measurementsInput.itemQuantities[laborKey];
    const isEditing = pricingEditorOpen || focusedPricingField != null;

    const hasUserSelectedPricing = hasCompleteUserSelectedPricing(
      measurementsInput.itemQuantities,
      itemId
    );

    if (!isEditing && originalNotes?.trim() && !hasUserSelectedPricing) {
      const fromNotes = resolveDualRatePricingDisplayFromNotes(
        itemId,
        measurementsInput,
        originalNotes,
        templateKey
      );
      if (fromNotes) {
        resolved = { ...resolved, ...fromNotes, showInput: true };
      }
    }

    const mergeNotesSplitForDisplay = () => {
      if (isEditing || !originalNotes?.trim() || hasUserSelectedPricing) return resolved;
      if (resolved.dualMaterial && resolved.dualLabor) return resolved;
      const fromNotes = resolveDualRatePricingDisplayFromNotes(
        itemId,
        measurementsInput,
        originalNotes,
        templateKey
      );
      return fromNotes ? { ...resolved, ...fromNotes, showInput: true } : resolved;
    };

    if (__DEV__ && itemId === 'backsplash') {
      const raw = measurementsInput.itemQuantities || {};
      console.log('🧮 Backsplash quantity render', {
        raw: {
          material: raw.backsplash__material?.quantity,
          labor: raw.backsplash__labor?.quantity,
          total: raw.backsplash__allowance?.quantity,
        },
        resolved: {
          material: resolved.dualMaterial?.quantity,
          labor: resolved.dualLabor?.quantity,
          total: resolved.dualAllowance?.quantity,
        },
      });
    }

    if (resolved.pricingReady && !isEditing) {
      const displayResolved = mergeNotesSplitForDisplay();
      const suggested = hasUserSelectedPricing
        ? { fill: null, comparison: null }
        : resolveScopeItemSuggestedPricing(
            itemId,
            measurementsInput,
            templateKey,
            displayResolved,
            pricingContext
          );
      const suggestedBudgetSplit = suggested.fill;
      const suggestedComparisonSplit = suggested.comparison;
      const applySuggestedPricingBlock = (block: SuggestedPricingBlock) => {
        if (onApplySuggestedPricing) {
          onApplySuggestedPricing(itemId, block);
          return;
        }
        hapticTap();
        if (block.basis?.quantity && block.basis.unit) {
          onItemQuantityChange(itemId, String(block.basis.quantity), 'count', block.basis.unit);
        }
        onItemQuantityChange(itemId, String(block.total), 'allowance', 'allowance');
        onItemQuantityChange(materialKey, String(block.material), 'count', 'allowance');
        onItemQuantityChange(laborKey, String(block.labor), 'count', 'allowance');
        setTimeout(() => onItemQuantityBlur(itemId), 0);
      };
      return (
        <View style={[styles.qtySection, { borderTopColor: dividerColor(darkMode) }]}>
          {displayResolved.dualCount ? (
            <PricingSplitRow
              label={fieldLabels?.count || 'Quantity'}
              value={`${displayResolved.dualCount.quantity.toLocaleString()} ${fieldLabels?.countUnit || 'each'}`}
              darkMode={darkMode}
              Colors={Colors}
            />
          ) : null}
          {displayResolved.dualMaterial ? (
            <PricingSplitRow
              label="Material"
              value={formatDraftMoney(displayResolved.dualMaterial.quantity)}
              helper={unitRateHelper(String(displayResolved.dualMaterial.quantity), displayResolved.dualCount)}
              darkMode={darkMode}
              Colors={Colors}
            />
          ) : null}
          {displayResolved.dualLabor ? (
            <PricingSplitRow
              label="Labor"
              value={formatDraftMoney(displayResolved.dualLabor.quantity)}
              helper={unitRateHelper(String(displayResolved.dualLabor.quantity), displayResolved.dualCount)}
              darkMode={darkMode}
              Colors={Colors}
            />
          ) : null}
          {displayResolved.dualAllowance ? (
            <PricingSplitRow
              label={
                displayResolved.dualMaterial || displayResolved.dualLabor
                  ? 'Total'
                  : fieldLabels?.allowance || 'Allowance'
              }
              value={formatDraftMoney(displayResolved.dualAllowance.quantity)}
              pill={
                !displayResolved.dualMaterial && !displayResolved.dualLabor && displayResolved.quantitySource === 'notes' ? (
                  <SourcePill kind="notes" />
                ) : undefined
              }
              darkMode={darkMode}
              Colors={Colors}
            />
          ) : null}
          {displayResolved.quantitySource === 'notes' && (displayResolved.dualMaterial || displayResolved.dualLabor) ? (
            <View style={[styles.pricingRowGap, { alignItems: 'flex-end' }]}>
              <SourcePill kind="notes" />
            </View>
          ) : null}
          {suggestedBudgetSplit ? (
            <SuggestedBudgetSplitRows block={suggestedBudgetSplit} Colors={Colors} darkMode={darkMode} />
          ) : null}
          {suggestedComparisonSplit ? (
            <ComparisonToggle
              block={suggestedComparisonSplit}
              Colors={Colors}
              darkMode={darkMode}
              onUsePricing={() => applySuggestedPricingBlock(suggestedComparisonSplit)}
            />
          ) : null}
          <EditQuantityLink
            onPress={() => {
              setPricingEditorOpen(true);
              if (resolved.dualCount) {
                onItemQuantityChange(
                  itemId,
                  String(resolved.dualCount.quantity),
                  'count',
                  resolved.dualCount.unit
                );
              }
              if (resolved.dualAllowance) {
                onItemQuantityChange(
                  itemId,
                  String(resolved.dualAllowance.quantity),
                  'allowance',
                  resolved.dualAllowance.unit
                );
              }
              if (resolved.dualMaterial) {
                onItemQuantityChange(
                  materialKey,
                  String(resolved.dualMaterial.quantity),
                  'count',
                  'allowance'
                );
              } else if (suggestedBudgetSplit) {
                onItemQuantityChange(materialKey, String(suggestedBudgetSplit.material), 'count', 'allowance');
              }
              if (resolved.dualLabor) {
                onItemQuantityChange(
                  laborKey,
                  String(resolved.dualLabor.quantity),
                  'count',
                  'allowance'
                );
              } else if (suggestedBudgetSplit) {
                onItemQuantityChange(laborKey, String(suggestedBudgetSplit.labor), 'count', 'allowance');
              }
            }}
          />
        </View>
      );
    }

    return (
      <View style={[styles.qtySection, { borderTopColor: dividerColor(darkMode) }]}>
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => resolved.pricingReady && setPricingEditorOpen(false)}
        >
          <Text style={{ color: '#fbbf24', fontSize: 11, fontWeight: '700', marginBottom: 6 }}>
            {pricingEditorOpen ? 'Edit pricing' : resolved.missingMessage || 'Enter quantity and/or allowance'}
          </Text>
          {rule.quantityHelper ? (
            <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, marginBottom: 4, lineHeight: 15 }}>
              {rule.quantityHelper}
            </Text>
          ) : null}
          {pricingEditorOpen ? (
            <Text style={{ color: '#60a5fa', fontSize: 11, fontWeight: '700', marginBottom: 8 }}>
              Tap card to collapse
            </Text>
          ) : null}
        </TouchableOpacity>
        <Text style={{ color: Colors.sub, fontSize: 11, fontWeight: '600', marginBottom: 4 }}>
          {fieldLabels?.count || 'Quantity'}
        </Text>
        <View style={styles.qtyInputRow}>
          <TextInput
            value={countInput?.quantity ?? ''}
            onFocus={() => focusQuantityField(itemId, 'count')}
            onChangeText={(text) => onItemQuantityChange(itemId, text, 'count')}
            onBlur={() => blurQuantityField(itemId, 'count')}
            placeholder="0"
            placeholderTextColor={placeholderColor}
            keyboardType="decimal-pad"
            {...scopeNumericInputProps}
            editable={!applying}
            style={[
              styles.qtyInput,
              { color: Colors.text, borderColor: inputShell.borderColor, backgroundColor: inputShell.backgroundColor },
            ]}
          />
          <Text style={{ color: Colors.sub, fontSize: 12, fontWeight: '600', minWidth: 48 }}>
            {fieldLabels?.countUnit || 'each'}
          </Text>
        </View>
        <PricingInputField
          label="Material"
          value={materialInput?.quantity ?? (resolved.dualMaterial ? String(resolved.dualMaterial.quantity) : '')}
          helper={unitRateHelper(
            materialInput?.quantity ?? (resolved.dualMaterial ? String(resolved.dualMaterial.quantity) : ''),
            resolved.dualCount ?? null
          )}
          basis={resolved.dualCount ?? null}
          prefix="$"
          placeholder="Material total"
          onFocus={() => focusQuantityField(materialKey)}
          onChangeText={(text) => onItemQuantityChange(materialKey, text, 'count', 'allowance')}
          onBlur={() => blurQuantityField(materialKey)}
          Colors={Colors}
          darkMode={darkMode}
          applying={applying}
        />
        <PricingInputField
          label="Labor"
          value={laborInput?.quantity ?? (resolved.dualLabor ? String(resolved.dualLabor.quantity) : '')}
          helper={unitRateHelper(
            laborInput?.quantity ?? (resolved.dualLabor ? String(resolved.dualLabor.quantity) : ''),
            resolved.dualCount ?? null
          )}
          basis={resolved.dualCount ?? null}
          prefix="$"
          placeholder="Labor total"
          onFocus={() => focusQuantityField(laborKey)}
          onChangeText={(text) => onItemQuantityChange(laborKey, text, 'count', 'allowance')}
          onBlur={() => blurQuantityField(laborKey)}
          Colors={Colors}
          darkMode={darkMode}
          applying={applying}
        />
        <Text style={{ color: Colors.sub, fontSize: 11, fontWeight: '600', marginTop: 10, marginBottom: 4 }}>
          {fieldLabels?.allowance || 'Allowance ($)'}
        </Text>
        <View style={styles.qtyInputRow}>
          <Text style={{ color: Colors.sub, fontSize: 14, fontWeight: '600' }}>$</Text>
          <TextInput
            value={allowanceInput?.quantity ?? ''}
            onFocus={() => focusQuantityField(itemId, 'allowance')}
            onChangeText={(text) => onItemQuantityChange(itemId, text, 'allowance')}
            onBlur={() => blurQuantityField(itemId, 'allowance')}
            placeholder="0"
            placeholderTextColor={placeholderColor}
            keyboardType="decimal-pad"
            {...scopeNumericInputProps}
            editable={!applying}
            style={[
              styles.qtyInput,
              { color: Colors.text, borderColor: inputShell.borderColor, backgroundColor: inputShell.backgroundColor },
            ]}
          />
        </View>
      </View>
    );
  }

  const itemInput = measurementsInput.itemQuantities[itemId];
  const materialKey = `${itemId}__material`;
  const laborKey = `${itemId}__labor`;
  const materialInput = measurementsInput.itemQuantities[materialKey];
  const laborInput = measurementsInput.itemQuantities[laborKey];
  const isEditingQuantity = pricingEditorOpen || focusedPricingField != null;
  const isEditingPricing = pricingEditorOpen || focusedPricingField != null;
  const neededLabel =
    (templateKey && QUANTITY_NEEDED_LABELS_BY_TEMPLATE[templateKey]?.[itemId]) ||
    QUANTITY_NEEDED_LABELS[itemId] ||
    quantityNeededLabel(itemId, templateKey, rule.defaultUnit);

  const suggested = resolveScopeItemSuggestedPricing(
    itemId,
    measurementsInput,
    templateKey,
    resolved,
    pricingContext
  );
  const suggestedBudgetSplit = suggested.fill;
  const suggestedComparisonSplit = suggested.comparison;
  const suggestedBasis = parseBudgetSplitBasis(suggestedBudgetSplit);
  const applySuggestedPricingBlock = (block: SuggestedPricingBlock) => {
    hapticTap();
    if (block.basis?.quantity && block.basis.unit) {
      onItemQuantityChange(itemId, String(block.basis.quantity), 'count', block.basis.unit);
    } else {
      onItemQuantityChange(itemId, String(block.total), 'count', 'allowance');
    }
    onItemQuantityChange(`${itemId}__allowance`, String(block.total), 'count', 'allowance');
    onItemQuantityChange(materialKey, String(block.material), 'count', 'allowance');
    onItemQuantityChange(laborKey, String(block.labor), 'count', 'allowance');
    setPricingEditorOpen(false);
    setTimeout(() => onItemQuantityBlur(itemId), 0);
  };

  if (resolved.pricingReady && !isEditingQuantity && !isEditingPricing) {
    if (__DEV__ && itemId === 'demo') {
      const raw = measurementsInput.itemQuantities || {};
      console.log('🧮 Demo quantity render', {
        rawDemo: raw.demo,
        resolved: {
          quantity: resolved.quantity,
          unit: resolved.unit,
          source: resolved.quantitySource,
          label: resolved.sourceLabel,
        },
        hasNotes: Boolean(originalNotes?.trim()),
      });
    }

    if (resolved.combinedAllowanceRole === 'included_in_combined') {
      const combinedTotal = resolved.combinedAllowanceTotal ?? resolved.quantity ?? 0;
      return (
        <View style={[styles.qtySection, { borderTopColor: dividerColor(darkMode) }]}>
          <View style={[styles.includedPill, darkMode ? styles.includedPillDark : styles.includedPillLight]}>
            <Text style={{ color: '#22c55e', fontSize: 11, fontWeight: '700' }}>
              Included in cabinet allowance
            </Text>
          </View>
          <Text
            style={{
              color: darkMode ? '#F5F7FA' : Colors.text,
              fontSize: 12,
              fontWeight: '600',
              marginTop: 8,
            }}
          >
            No separate price
          </Text>
          <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, marginTop: 4, lineHeight: 15 }}>
            Same ${Number(combinedTotal).toLocaleString()} combined total as cabinets above — not added
            again.
          </Text>
        </View>
      );
    }

    return (
      <View style={[styles.qtySection, { borderTopColor: dividerColor(darkMode) }]}>
        <PricingAmountRow
          value={formatResolvedQuantityDisplay(
            resolved.quantity ?? 0,
            resolved.unit,
            resolved.quantitySource
          )}
          pill={resolved.quantitySource === 'notes' ? <SourcePill kind="notes" /> : undefined}
          label={resolved.sourceLabel}
          emphasized
          darkMode={darkMode}
          Colors={Colors}
        />
        {resolved.combinedAllowanceRole === 'combined_total' ? (
          <Text
            style={{
              color: pricingLabelColor(darkMode, Colors),
              fontSize: 12,
              marginTop: 8,
              lineHeight: 17,
            }}
          >
            One allowance for cabinets and countertops — the countertop line below is included, not
            priced again.
          </Text>
        ) : null}
        {suggestedBudgetSplit ? (
          <SuggestedBudgetSplitRows block={suggestedBudgetSplit} Colors={Colors} darkMode={darkMode} />
        ) : null}
        {suggestedComparisonSplit ? (
          <ComparisonToggle
            block={suggestedComparisonSplit}
            Colors={Colors}
            darkMode={darkMode}
            onUsePricing={() => applySuggestedPricingBlock(suggestedComparisonSplit)}
          />
        ) : null}
        <EditQuantityLink
          onPress={() => {
            setPricingEditorOpen(true);
            const total = String(resolved.quantity ?? '');
            const unit = resolved.unit === 'allowance' || resolved.unit === 'lump_sum' ? 'allowance' : resolved.unit;
            onItemQuantityChange(itemId, total, 'count', unit);
            if (suggestedBudgetSplit) {
              onItemQuantityChange(materialKey, String(suggestedBudgetSplit.material), 'count', 'allowance');
              onItemQuantityChange(laborKey, String(suggestedBudgetSplit.labor), 'count', 'allowance');
            }
          }}
        />
      </View>
    );
  }

  const editingUnit = itemInput?.unit || resolved.unit || rule.defaultUnit;
  const editingIsMoneyTotal = editingUnit === 'allowance' || editingUnit === 'lump_sum';
  const showSplitFields = Boolean(materialInput || laborInput || suggestedBudgetSplit);
  const materialValue = materialInput?.quantity ?? (suggestedBudgetSplit ? String(suggestedBudgetSplit.material) : '');
  const laborValue = laborInput?.quantity ?? (suggestedBudgetSplit ? String(suggestedBudgetSplit.labor) : '');

  return (
    <View style={[styles.qtySection, { borderTopColor: dividerColor(darkMode) }]}>
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => resolved.pricingReady && setPricingEditorOpen(false)}
      >
        <Text style={{ color: '#fbbf24', fontSize: 11, fontWeight: '700', marginBottom: 6 }}>
          {isEditingQuantity || isEditingPricing ? 'Edit pricing' : `Needs ${neededLabel}`}
        </Text>
        {rule.quantityHelper ? (
          <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, marginBottom: 4, lineHeight: 15 }}>
            {rule.quantityHelper}
          </Text>
        ) : null}
        {pricingEditorOpen ? (
          <Text style={{ color: '#60a5fa', fontSize: 11, fontWeight: '700', marginBottom: 8 }}>
            Tap card to collapse
          </Text>
        ) : null}
      </TouchableOpacity>
      <PricingInputField
        label={editingIsMoneyTotal ? 'Lump sum / total' : 'Pricing basis'}
        value={itemInput?.quantity ?? ''}
        prefix={editingIsMoneyTotal ? '$' : undefined}
        suffix={editingIsMoneyTotal ? undefined : formatUnitLabel(editingUnit)}
        placeholder={editingIsMoneyTotal ? 'Enter total' : `Enter ${neededLabel}`}
        onFocus={() => focusQuantityField(itemId)}
        onChangeText={(text) => onItemQuantityChange(itemId, text, 'count', editingUnit)}
        onBlur={() => blurQuantityField(itemId)}
        Colors={Colors}
        darkMode={darkMode}
        applying={applying}
      />
      {showSplitFields ? (
        <>
          <PricingInputField
            label="Material"
            value={materialValue}
            helper={unitRateHelper(materialValue, suggestedBasis)}
            basis={suggestedBasis}
            prefix="$"
            placeholder="Material total"
            onFocus={() => focusQuantityField(materialKey)}
            onChangeText={(text) => onItemQuantityChange(materialKey, text, 'count', 'allowance')}
            onBlur={() => blurQuantityField(materialKey)}
            Colors={Colors}
            darkMode={darkMode}
            applying={applying}
          />
          <PricingInputField
            label="Labor"
            value={laborValue}
            helper={unitRateHelper(laborValue, suggestedBasis)}
            basis={suggestedBasis}
            prefix="$"
            placeholder="Labor total"
            onFocus={() => focusQuantityField(laborKey)}
            onChangeText={(text) => onItemQuantityChange(laborKey, text, 'count', 'allowance')}
            onBlur={() => blurQuantityField(laborKey)}
            Colors={Colors}
            darkMode={darkMode}
            applying={applying}
          />
        </>
      ) : null}
    </View>
  );
}

function YesNoChip({
  label,
  active,
  variant,
  onPress,
  Colors,
  darkMode,
}: {
  label: string;
  active: boolean;
  variant: 'yes' | 'no' | 'unsure';
  onPress: () => void;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
}) {
  let borderColor = darkMode ? 'rgba(148, 163, 184, 0.16)' : Colors.line;
  let backgroundColor = darkMode ? 'rgba(255,255,255,0.04)' : 'transparent';
  let textColor = captionColor(darkMode, Colors);

  if (active) {
    if (variant === 'yes') {
      borderColor = '#22c55e';
      backgroundColor = '#22c55e';
      textColor = '#0f172a';
    } else if (variant === 'unsure') {
      borderColor = 'rgba(251,191,36,0.55)';
      backgroundColor = 'transparent';
      textColor = '#d4a017';
    } else {
      borderColor = darkMode ? 'rgba(255,255,255,0.2)' : Colors.line;
      backgroundColor = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';
      textColor = Colors.text;
    }
  }

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={[styles.choiceChip, { borderColor, backgroundColor }]}
    >
      <Text style={{ color: textColor, fontSize: 12, fontWeight: active ? '800' : '600' }}>{label}</Text>
    </TouchableOpacity>
  );
}

function WetAreaInstallLineCard({
  item,
  templateKey,
  originalNotes,
  measurementsInput,
  onItemQuantityChange,
  onItemQuantityBlur,
  onItemQuantityFocus,
  onApplySuggestedPricing,
  onSaveCustomPricing,
  visualCtx,
  Colors,
  darkMode,
  applying,
}: {
  item: ScopeChecklistItem;
  templateKey?: string | null;
  originalNotes?: string | null;
  measurementsInput: ScopeMeasurementsInputExtended;
  onItemQuantityChange: (
    itemId: string,
    quantity: string,
    field?: 'count' | 'allowance',
    unit?: string
  ) => void;
  onItemQuantityBlur: (itemId: string, field?: 'count' | 'allowance') => void;
  onItemQuantityFocus: (itemId: string, field?: 'count' | 'allowance') => void;
  onApplySuggestedPricing?: (itemId: string, block: SuggestedPricingBlock) => void;
  onSaveCustomPricing?: () => void;
  visualCtx: ScopeItemVisualContext;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  applying: boolean;
}) {
  const helper = checklistDisplayHelper(item, templateKey);
  const tier = scopeItemVisualTier(item, visualCtx);
  const noteBadge = scopeItemNoteBadge(item, visualCtx);

  return (
    <View style={scopeCardStyle(tier, Colors, darkMode)}>
      <ScopeItemTitleRow
        label={item.label}
        noteBadge={noteBadge}
        darkMode={darkMode}
        Colors={Colors}
      />
      {helper ? (
        <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, marginTop: 3, lineHeight: 15 }}>
          {helper}
        </Text>
      ) : null}
      <View style={styles.includedPillRow}>
        <View style={[styles.includedPill, darkMode ? styles.includedPillDark : styles.includedPillLight]}>
          <Text style={{ color: '#22c55e', fontSize: 11, fontWeight: '700' }}>Included · labor + materials</Text>
        </View>
      </View>
      <QuantitySection
        itemId={item.id}
        inScope
        templateKey={templateKey}
        originalNotes={originalNotes}
        measurementsInput={measurementsInput}
        onItemQuantityChange={onItemQuantityChange}
        onItemQuantityBlur={onItemQuantityBlur}
        onItemQuantityFocus={onItemQuantityFocus}
        onApplySuggestedPricing={onApplySuggestedPricing}
        Colors={Colors}
        darkMode={darkMode}
        applying={applying}
      />
    </View>
  );
}

function YesNoRow({
  item,
  templateKey,
  originalNotes,
  onSetState,
  onRename,
  onDelete,
  measurementsInput,
  onItemQuantityChange,
  onItemQuantityBlur,
  onItemQuantityFocus,
  onApplySuggestedPricing,
  onSaveCustomPricing,
  visualCtx,
  Colors,
  darkMode,
  applying,
}: {
  item: ScopeChecklistItem;
  templateKey?: string | null;
  originalNotes?: string | null;
  onSetState: (state: ScopeAssumptionState) => void;
  onRename?: (label: string) => void;
  onDelete?: () => void;
  measurementsInput: ScopeMeasurementsInputExtended;
  onItemQuantityChange: (
    itemId: string,
    quantity: string,
    field?: 'count' | 'allowance',
    unit?: string
  ) => void;
  onItemQuantityBlur: (itemId: string, field?: 'count' | 'allowance') => void;
  onItemQuantityFocus: (itemId: string, field?: 'count' | 'allowance') => void;
  onApplySuggestedPricing?: (itemId: string, block: SuggestedPricingBlock) => void;
  onSaveCustomPricing?: () => void;
  visualCtx: ScopeItemVisualContext;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  applying: boolean;
}) {
  const tier = scopeItemVisualTier(item, visualCtx);
  const noteBadge = scopeItemNoteBadge(item, visualCtx);
  const isCustom = isCustomScopeItem(item);
  const helper = isCustom ? 'Added manually. Price as total, sqft, or LF.' : checklistDisplayHelper(item, templateKey);
  const [renaming, setRenaming] = useState(false);
  const [draftLabel, setDraftLabel] = useState(item.label);

  useEffect(() => {
    setDraftLabel(item.label);
  }, [item.label]);

  const saveRename = () => {
    const trimmed = draftLabel.trim();
    if (!trimmed) return;
    onRename?.(trimmed);
    setRenaming(false);
  };

  return (
    <View style={scopeCardStyle(tier, Colors, darkMode)}>
      {isCustom && renaming ? (
        <View style={styles.customRenameRow}>
          <TextInput
            value={draftLabel}
            onChangeText={setDraftLabel}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={saveRename}
            placeholder="Scope item name"
            placeholderTextColor={darkMode ? 'rgba(255,255,255,0.35)' : '#94a3b8'}
            style={[
              styles.customRenameInput,
              {
                color: Colors.text,
                borderColor: darkMode ? 'rgba(148, 163, 184, 0.16)' : Colors.line,
                backgroundColor: darkMode ? 'rgba(255,255,255,0.05)' : Colors.surface2,
              },
            ]}
          />
          <TouchableOpacity onPress={saveRename} activeOpacity={0.75} style={styles.customRenameAction}>
            <Text style={{ color: '#22c55e', fontSize: 12, fontWeight: '800' }}>Save</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScopeItemTitleRow
          label={item.label}
          noteBadge={noteBadge}
          rightAccessory={
            isCustom ? (
              <View style={styles.customCardActions}>
                <View
                  style={[
                    styles.customBadge,
                    darkMode ? styles.customBadgeDark : styles.customBadgeLight,
                  ]}
                >
                  <Text style={{ color: '#60a5fa', fontSize: 10, fontWeight: '700' }}>Custom</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setRenaming(true)}
                  disabled={applying}
                  activeOpacity={0.75}
                  style={styles.customIconBtn}
                >
                  <Ionicons name="pencil-outline" size={15} color="#60a5fa" />
                </TouchableOpacity>
                {onDelete ? (
                  <TouchableOpacity
                    onPress={onDelete}
                    disabled={applying}
                    activeOpacity={0.75}
                    style={styles.customIconBtn}
                  >
                    <Ionicons name="trash-outline" size={15} color="#ef4444" />
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null
          }
          darkMode={darkMode}
          Colors={Colors}
        />
      )}
      {helper ? (
        <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, marginTop: 3, lineHeight: 15 }}>
          {helper}
        </Text>
      ) : null}
      <View style={styles.choiceRow}>
        <YesNoChip
          label="Yes"
          active={item.state === 'included'}
          variant="yes"
          onPress={() => {
            hapticTap();
            onSetState('included');
          }}
          Colors={Colors}
          darkMode={darkMode}
        />
        <YesNoChip
          label="No"
          active={item.state === 'excluded'}
          variant="no"
          onPress={() => {
            hapticTap();
            onSetState('excluded');
          }}
          Colors={Colors}
          darkMode={darkMode}
        />
        {!isCustom ? (
          <YesNoChip
            label="Not sure"
            active={item.state === 'unsure'}
            variant="unsure"
            onPress={() => {
              hapticTap();
              onSetState('unsure');
            }}
            Colors={Colors}
            darkMode={darkMode}
          />
        ) : null}
      </View>
      {isCustom ? (
        <CustomScopePricingSection
          itemId={item.id}
          inScope={item.state === 'included'}
          measurementsInput={measurementsInput}
          onItemQuantityChange={onItemQuantityChange}
          onItemQuantityBlur={onItemQuantityBlur}
          onItemQuantityFocus={onItemQuantityFocus}
          onSavePricing={onSaveCustomPricing}
          Colors={Colors}
          darkMode={darkMode}
          applying={applying}
        />
      ) : (
        <QuantitySection
          itemId={item.id}
          choiceId={item.choiceId}
          inScope={item.state === 'included'}
          templateKey={templateKey}
          originalNotes={originalNotes}
          measurementsInput={measurementsInput}
          onItemQuantityChange={onItemQuantityChange}
          onItemQuantityBlur={onItemQuantityBlur}
          onItemQuantityFocus={onItemQuantityFocus}
          onApplySuggestedPricing={onApplySuggestedPricing}
          Colors={Colors}
          darkMode={darkMode}
          applying={applying}
        />
      )}
    </View>
  );
}

function MultiChoiceRow({
  item,
  templateKey,
  originalNotes,
  onToggle,
  measurementsInput,
  onItemQuantityChange,
  onItemQuantityBlur,
  onItemQuantityFocus,
  onApplySuggestedPricing,
  visualCtx,
  Colors,
  darkMode,
  applying,
}: {
  item: ScopeChecklistItem;
  templateKey?: string | null;
  originalNotes?: string | null;
  onToggle: (optionId: string) => void;
  measurementsInput: ScopeMeasurementsInputExtended;
  onItemQuantityChange: (
    itemId: string,
    quantity: string,
    field?: 'count' | 'allowance',
    unit?: string
  ) => void;
  onItemQuantityBlur: (itemId: string, field?: 'count' | 'allowance') => void;
  onItemQuantityFocus: (itemId: string, field?: 'count' | 'allowance') => void;
  onApplySuggestedPricing?: (itemId: string, block: SuggestedPricingBlock) => void;
  visualCtx: ScopeItemVisualContext;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  applying: boolean;
}) {
  const choiceIds = item.choiceIds ?? [];
  const inScope = choiceIds.some((id) => id === 'remove' || id === 'add');
  const helper = checklistDisplayHelper(item, templateKey);
  const tier = scopeItemVisualTier(item, visualCtx);
  const noteBadge = scopeItemNoteBadge(item, visualCtx);

  return (
    <View style={scopeCardStyle(tier, Colors, darkMode)}>
      <ScopeItemTitleRow
        label={item.label}
        noteBadge={noteBadge}
        darkMode={darkMode}
        Colors={Colors}
      />
      {helper ? (
        <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, marginTop: 3, lineHeight: 15 }}>
          {helper}
        </Text>
      ) : null}
      <View style={styles.choiceWrap}>
        {(item.options || []).map((opt) => {
          const active = choiceIds.includes(opt.id);
          const isUnsure = opt.id === 'unsure';
          const isExcluded = opt.id === 'not_in_scope';
          let borderColor = darkMode ? 'rgba(148, 163, 184, 0.16)' : Colors.line;
          let backgroundColor = darkMode ? 'rgba(255,255,255,0.04)' : 'transparent';
          let textColor = captionColor(darkMode, Colors);

          if (active) {
            if (isUnsure) {
              borderColor = 'rgba(251,191,36,0.55)';
              textColor = '#d4a017';
            } else if (isExcluded) {
              borderColor = darkMode ? 'rgba(148, 163, 184, 0.28)' : Colors.line;
              backgroundColor = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';
              textColor = darkMode ? '#F5F7FA' : Colors.text;
            } else {
              borderColor = '#60a5fa';
              backgroundColor = 'rgba(96,165,250,0.18)';
              textColor = '#60a5fa';
            }
          }

          return (
            <TouchableOpacity
              key={opt.id}
              activeOpacity={0.88}
              onPress={() => {
                hapticTap();
                onToggle(opt.id);
              }}
              style={[styles.choiceChipWide, { borderColor, backgroundColor }]}
            >
              <Text
                style={{
                  color: textColor,
                  fontSize: 12,
                  fontWeight: active ? '800' : '600',
                  textAlign: 'center',
                }}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <QuantitySection
        itemId={item.id}
        inScope={inScope}
        templateKey={templateKey}
        originalNotes={originalNotes}
        measurementsInput={measurementsInput}
        onItemQuantityChange={onItemQuantityChange}
        onItemQuantityBlur={onItemQuantityBlur}
        onItemQuantityFocus={onItemQuantityFocus}
        onApplySuggestedPricing={onApplySuggestedPricing}
        Colors={Colors}
        darkMode={darkMode}
        applying={applying}
      />
    </View>
  );
}

function ChoiceRow({
  item,
  templateKey,
  originalNotes,
  onSelect,
  measurementsInput,
  onItemQuantityChange,
  onItemQuantityBlur,
  onItemQuantityFocus,
  onApplySuggestedPricing,
  visualCtx,
  Colors,
  darkMode,
  applying,
}: {
  item: ScopeChecklistItem;
  templateKey?: string | null;
  originalNotes?: string | null;
  onSelect: (choiceId: string) => void;
  measurementsInput: ScopeMeasurementsInputExtended;
  onItemQuantityChange: (
    itemId: string,
    quantity: string,
    field?: 'count' | 'allowance',
    unit?: string
  ) => void;
  onItemQuantityBlur: (itemId: string, field?: 'count' | 'allowance') => void;
  onItemQuantityFocus: (itemId: string, field?: 'count' | 'allowance') => void;
  onApplySuggestedPricing?: (itemId: string, block: SuggestedPricingBlock) => void;
  visualCtx: ScopeItemVisualContext;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  applying: boolean;
}) {
  const inScope = Boolean(item.choiceId && item.choiceId !== 'not_in_scope' && item.choiceId !== 'unsure');
  const helper = checklistDisplayHelper(item, templateKey);
  const tier = scopeItemVisualTier(item, visualCtx);
  const noteBadge = scopeItemNoteBadge(item, visualCtx);

  return (
    <View style={scopeCardStyle(tier, Colors, darkMode)}>
      <ScopeItemTitleRow
        label={item.label}
        noteBadge={noteBadge}
        darkMode={darkMode}
        Colors={Colors}
      />
      {helper ? (
        <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, marginTop: 3, lineHeight: 15 }}>
          {helper}
        </Text>
      ) : null}
      <View style={styles.choiceWrap}>
        {(item.options || []).map((opt) => {
          const active = item.choiceId === opt.id;
          const isUnsure = opt.id === 'unsure';
          const isExcluded = opt.id === 'not_in_scope';
          let borderColor = darkMode ? 'rgba(148, 163, 184, 0.16)' : Colors.line;
          let backgroundColor = darkMode ? 'rgba(255,255,255,0.04)' : 'transparent';
          let textColor = captionColor(darkMode, Colors);

          if (active) {
            if (isUnsure) {
              borderColor = 'rgba(251,191,36,0.55)';
              textColor = '#d4a017';
            } else if (isExcluded) {
              borderColor = darkMode ? 'rgba(148, 163, 184, 0.28)' : Colors.line;
              backgroundColor = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';
              textColor = darkMode ? '#F5F7FA' : Colors.text;
            } else {
              borderColor = '#60a5fa';
              backgroundColor = 'rgba(96,165,250,0.18)';
              textColor = '#60a5fa';
            }
          }

          return (
            <TouchableOpacity
              key={opt.id}
              activeOpacity={0.88}
              onPress={() => {
                hapticTap();
                onSelect(opt.id);
              }}
              style={[styles.choiceChipWide, { borderColor, backgroundColor }]}
            >
              <Text
                style={{
                  color: textColor,
                  fontSize: 12,
                  fontWeight: active ? '800' : '600',
                  textAlign: 'center',
                }}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <QuantitySection
        itemId={item.id}
        choiceId={item.choiceId}
        inScope={inScope}
        templateKey={templateKey}
        originalNotes={originalNotes}
        measurementsInput={measurementsInput}
        onItemQuantityChange={onItemQuantityChange}
        onItemQuantityBlur={onItemQuantityBlur}
        onItemQuantityFocus={onItemQuantityFocus}
        onApplySuggestedPricing={onApplySuggestedPricing}
        Colors={Colors}
        darkMode={darkMode}
        applying={applying}
      />
    </View>
  );
}

function choiceIdToState(choiceId: string): ScopeAssumptionState {
  if (choiceId === 'not_in_scope') return 'excluded';
  if (choiceId === 'unsure' || !choiceId) return 'unsure';
  return 'included';
}

function QuickMeasurementField({
  label,
  value,
  onChangeText,
  placeholder,
  Colors,
  darkMode,
  applying,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  applying: boolean;
}) {
  const inputShell = inputShellStyle(Colors, darkMode);
  const placeholderColor = darkMode ? 'rgba(255,255,255,0.35)' : '#94a3b8';

  return (
    <View style={styles.measurementField}>
      <Text style={[styles.measurementLabel, { color: captionColor(darkMode, Colors) }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={placeholderColor}
        keyboardType="decimal-pad"
        {...scopeNumericInputProps}
        editable={!applying}
        style={[
          styles.measurementInput,
          {
            color: Colors.text,
            borderColor: inputShell.borderColor,
            backgroundColor: inputShell.backgroundColor,
          },
        ]}
      />
    </View>
  );
}

function CollapsibleQuickMeasurements({
  expanded,
  onToggle,
  measurements,
  setMeasurements,
  templateKey,
  projectType,
  notes,
  Colors,
  darkMode,
  applying,
}: {
  expanded: boolean;
  onToggle: () => void;
  measurements: ScopeMeasurementsInputExtended;
  setMeasurements: React.Dispatch<React.SetStateAction<ScopeMeasurementsInputExtended>>;
  templateKey?: string;
  projectType?: string | null;
  notes?: string | null;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  applying: boolean;
}) {
  const noteQuickMeasurements = useMemo(() => {
    const parsed = parseScopeMeasurementsFromNotes(notes || '', { templateKey, projectType: projectType ?? undefined });
    const out: Partial<Record<QuickMeasurementFieldKey, string>> = {};
    const noteKeys: QuickMeasurementFieldKey[] = [];
    const put = (key: QuickMeasurementFieldKey, value: unknown) => {
      const n = Number(value);
      if (!Number.isFinite(n) || n <= 0) return;
      out[key] = String(n);
      noteKeys.push(key);
    };

    put('bathroomFloorSqft', parsed.bathroomFloorSqft);
    put('kitchenFloorSqft', parsed.kitchenFloorSqft);
    put('floorAreaSqft', parsed.floorAreaSqft);
    put('backsplashSqft', parsed.backsplashSqft);
    put('countertopSqft', parsed.countertopSqft);
    put('cabinetLf', parsed.cabinetLf);
    put('showerWallTileSqft', parsed.showerWallTileSqft);
    put('showerFloorTileSqft', parsed.showerFloorTileSqft);
    put('wallPaintSqft', parsed.wallPaintSqft);
    put('exteriorPaintSqft', parsed.exteriorPaintSqft);
    put('baseboardLf', parsed.baseboardLf);
    put('railingLf', parsed.railingLf);
    put('landscapeSqft', parsed.landscapeSqft);
    put('sodSqft', parsed.sodSqft);
    put('paverSqft', parsed.paverSqft);
    put('rockMulchSqft', parsed.rockMulchSqft);
    put('landscapeTons', parsed.landscapeTons);
    put('roofSquares', parsed.roofSquares);
    put('drywallSqft', parsed.drywallSqft);
    put('concreteSqft', parsed.concreteSqft);
    put('concreteCy', parsed.concreteCy);
    put('excavationCy', parsed.excavationCy);
    put('deckSqft', parsed.deckSqft);

    return { values: out, keys: noteKeys };
  }, [notes, templateKey, projectType]);
  const displayMeasurements = { ...noteQuickMeasurements.values };
  for (const [key, value] of Object.entries(measurements)) {
    if (key === 'itemQuantities') continue;
    if (noteQuickMeasurements.keys.includes(key as QuickMeasurementFieldKey)) continue;
    if (String(value || '').trim()) {
      displayMeasurements[key as QuickMeasurementFieldKey] = String(value);
    }
  }
  const rows = quickMeasurementRowsForInput(templateKey, projectType, displayMeasurements, noteQuickMeasurements.keys);

  const setField = (key: QuickMeasurementFieldKey, value: string) => {
    setMeasurements((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <View style={[styles.quickMeasurements, estimateFlowCardStyle(Colors, darkMode)]}>
      <TouchableOpacity style={styles.quickMeasurementsHeader} onPress={onToggle} activeOpacity={0.7}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: darkMode ? '#F5F7FA' : Colors.text, fontSize: 13, fontWeight: '800' }}>
            Quick measurements
          </Text>
          <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, marginTop: 2 }}>
            Optional — autofill repeated quantities
          </Text>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={captionColor(darkMode, Colors)} />
      </TouchableOpacity>
      {expanded ? (
        <View style={{ marginTop: 10, gap: 10 }}>
          {rows.map((row, rowIdx) => (
            <View
              key={row.map((f) => f.key).join('-') || `row-${rowIdx}`}
              style={row.length > 1 ? styles.measurementsRow : undefined}
            >
              {row.map((field) => (
                <QuickMeasurementField
                  key={field.key}
                  label={field.label}
                  value={displayMeasurements[field.key] || ''}
                  onChangeText={(value) => setField(field.key, value)}
                  placeholder={field.placeholder}
                  Colors={Colors}
                  darkMode={darkMode}
                  applying={applying}
                />
              ))}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ScopeGroupSection({
  title,
  items,
  collapsed,
  onToggle,
  renderItem,
  noteSummary,
  Colors,
  darkMode,
}: {
  title: string;
  items: ScopeChecklistItem[];
  collapsed: boolean;
  onToggle: () => void;
  renderItem: (item: ScopeChecklistItem) => React.ReactNode;
  noteSummary?: { fromNotes: number; toConfirm: number };
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
}) {
  if (!items.length) return null;

  const allSecondary =
    noteSummary != null && noteSummary.fromNotes === 0 && noteSummary.toConfirm === items.length;
  const headerOpacity = allSecondary ? SCOPE_ITEM_TIER_OPACITY.secondary : 1;

  return (
    <View style={styles.groupSection}>
      {title ? (
        <TouchableOpacity
          style={[styles.groupHeader, { borderBottomColor: dividerColor(darkMode), opacity: headerOpacity }]}
          onPress={onToggle}
          activeOpacity={0.7}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ color: darkMode ? '#F5F7FA' : Colors.text, fontSize: 13, fontWeight: '800' }}>
              {title}
            </Text>
            {noteSummary && (noteSummary.fromNotes > 0 || noteSummary.toConfirm > 0) ? (
              <Text style={{ color: captionColor(darkMode, Colors), fontSize: 10, marginTop: 2 }}>
                {noteSummary.fromNotes > 0 ? `${noteSummary.fromNotes} from notes` : null}
                {noteSummary.fromNotes > 0 && noteSummary.toConfirm > 0 ? ' · ' : null}
                {noteSummary.toConfirm > 0 ? `${noteSummary.toConfirm} to confirm` : null}
              </Text>
            ) : null}
          </View>
          <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, marginRight: 6 }}>
            {items.length}
          </Text>
          <Ionicons name={collapsed ? 'chevron-down' : 'chevron-up'} size={16} color={captionColor(darkMode, Colors)} />
        </TouchableOpacity>
      ) : null}
      {!collapsed || !title
        ? items.map((item) => <React.Fragment key={item.id}>{renderItem(item)}</React.Fragment>)
        : null}
    </View>
  );
}

export default function AIEstimateScopeAssumptionsModal({
  visible,
  draft,
  notesFallback,
  applying = false,
  fromAssistant = false,
  onBack,
  onClose,
  onConfirm,
  onScopeOnly,
  onPersistProgress,
  pricingContext = null,
}: Props) {
  const insets = useSafeAreaInsets();
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const checklist = draft?.scopeChecklist;
  const scopeNotes = useMemo(() => {
    return chooseBestScopeNotes(draft, notesFallback);
  }, [draft, notesFallback]);
  const [items, setItems] = useState<ScopeChecklistItem[]>([]);
  const [measurements, setMeasurements] = useState<ScopeMeasurementsInputExtended>({
    ...emptyQuickMeasurementInput(),
    itemQuantities: {},
  });
  const [quickMeasurementsOpen, setQuickMeasurementsOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [customItemLabel, setCustomItemLabel] = useState('');
  const [showCustomItemInput, setShowCustomItemInput] = useState(false);
  const itemsRef = useRef(items);
  const measurementsRef = useRef(measurements);
  const selectedPricingRef = useRef<Record<string, SuggestedPricingBlock>>({});
  const scrollRef = useRef<ScrollView>(null);
  const scrollContentRef = useRef<View>(null);
  const itemRefs = useRef<Record<string, View | null>>({});
  const focusedQuantityRef = useRef<string | null>(null);
  const hydratedVisibleSessionRef = useRef(false);

  const setMeasurementsSynced = useCallback((update: React.SetStateAction<ScopeMeasurementsInputExtended>) => {
    const previous = measurementsRef.current;
    const next =
      typeof update === 'function'
        ? (update as (prev: ScopeMeasurementsInputExtended) => ScopeMeasurementsInputExtended)(previous)
        : update;
    measurementsRef.current = next;
    setMeasurements(next);
  }, []);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    measurementsRef.current = measurements;
  }, [measurements]);

  const scopeMeasurementsPayloadForCurrentState = useCallback(() => {
    const payload = scopeMeasurementsPayloadForPersist(measurementsRef.current, {
      notes: scopeNotes,
      templateKey: checklist?.templateKey,
    });
    const itemQuantities = { ...(payload.itemQuantities || {}) };
    for (const [itemId, block] of Object.entries(selectedPricingRef.current)) {
      const rule = getChecklistItemQuantityRule(itemId, checklist?.templateKey);
      const allowanceKey = rule?.dualAllowanceField ? roughAllowanceSubKey(itemId) : `${itemId}__allowance`;
      itemQuantities[itemId] = {
        quantity: Number(block.basis?.quantity ?? block.total),
        unit: block.basis?.unit || (rule?.dualAllowanceField ? rule.defaultUnit : 'allowance'),
        quantitySource: 'user_entered',
      };
      itemQuantities[allowanceKey] = {
        quantity: Number(block.total),
        unit: 'allowance',
        quantitySource: 'user_entered',
      };
      itemQuantities[`${itemId}__material`] = {
        quantity: Number(block.material),
        unit: 'allowance',
        quantitySource: 'user_entered',
      };
      itemQuantities[`${itemId}__labor`] = {
        quantity: Number(block.labor),
        unit: 'allowance',
        quantitySource: 'user_entered',
      };
    }
    return {
      ...payload,
      itemQuantities: Object.keys(itemQuantities).length ? itemQuantities : payload.itemQuantities,
    };
  }, [checklist?.templateKey, scopeNotes]);

  const draftScopeRestoreKey = useMemo(
    () =>
      JSON.stringify({
        confirmed: draft?.confirmedAssumptions,
        measurements: draft?.scopeMeasurements,
        checklist: draft?.scopeChecklist?.items,
        notes: scopeNotes,
        suggested: draft?.scopeChecklist?.suggestedMeasurements,
      }),
    [
      draft?.confirmedAssumptions,
      draft?.scopeMeasurements,
      draft?.scopeChecklist?.items,
      draft?.scopeChecklist?.suggestedMeasurements,
      scopeNotes,
      notesFallback,
    ]
  );

  useEffect(() => {
    if (visible && checklist?.items?.length) {
      if (hydratedVisibleSessionRef.current) return;
      selectedPricingRef.current = {};
      const sourceItems = scopeChecklistItemsForEditing(draft);
      if (!sourceItems.length) return;
      const draftForScope =
        draft && scopeNotes.trim() ? repairDraftRatePricingFromNotes(draft, scopeNotes) : draft;
      const nextMeasurements = prepareScopeMeasurementsInputForUi(
        initialScopeMeasurementInputExtended(draftForScope, scopeNotes),
        { notes: scopeNotes, templateKey: checklist.templateKey }
      );
      const norm = buildNormFromInput(nextMeasurements, scopeNotes, checklist.templateKey);
      let normalized = hydrateScopeChecklistFromNotes(
        sourceItems,
        checklist.templateKey,
        scopeNotes,
        norm
      );
      normalized = applyKitchenScopeInferences(normalized, checklist.templateKey, {
        notes: scopeNotes,
        measurements: norm,
      });
      setItems(normalized);
      setMeasurementsSynced(nextMeasurements);
      setQuickMeasurementsOpen(false);
      setCustomItemLabel('');
      setShowCustomItemInput(false);
      const grouped = groupScopeChecklistItems(
        expandWetAreaDerivedScopeItems(normalized),
        checklist.templateKey
      );
      setCollapsedGroups(
        initialScopeGroupCollapse(
          grouped,
          norm,
          checklist.templateKey,
          scopeNotes
        )
      );
      hydratedVisibleSessionRef.current = true;
    }
    // `draft` is intentionally excluded: re-running on every parent re-render (e.g. when the
    // keyboard opens) remounts the inputs and drops focus. `draftScopeRestoreKey` is the stable
    // content signature that captures the data this effect actually reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, draftScopeRestoreKey, checklist?.templateKey]);

  useEffect(() => {
    if (visible) return;
    hydratedVisibleSessionRef.current = false;
    setItems([]);
    // Do not clear measurementsRef here. A hidden persist effect runs after
    // this cleanup; clearing the ref first can overwrite the just-confirmed
    // selected pricing in the parent draft.
    setMeasurements({
      ...emptyQuickMeasurementInput(),
      itemQuantities: {},
    });
    setCollapsedGroups({});
    setQuickMeasurementsOpen(false);
    setCustomItemLabel('');
    setShowCustomItemInput(false);
  }, [visible]);

  // Keep rate-pricing subkeys in form state whenever notes are available (handles hot reload / stale saves).
  useEffect(() => {
    if (!visible || !scopeNotes.trim()) return;
    setMeasurementsSynced((prev) =>
      prepareScopeMeasurementsInputForUi(prev, {
        notes: scopeNotes,
        templateKey: checklist?.templateKey,
      })
    );
  }, [visible, scopeNotes, checklist?.templateKey]);

  useEffect(() => {
    if (visible || !onPersistProgress || applying) return;
    const currentItems = itemsRef.current;
    if (!currentItems.length) return;
    onPersistProgress(
      scopeChecklistItemsForPersist(currentItems),
      scopeMeasurementsPayloadForCurrentState()
    );
  }, [visible, onPersistProgress, applying, scopeMeasurementsPayloadForCurrentState]);

  const displayItems = useMemo(() => expandWetAreaDerivedScopeItems(items), [items]);

  const normMeasurements = useMemo(
    () => buildNormFromInput(measurements, scopeNotes, checklist?.templateKey),
    [measurements, scopeNotes, checklist?.templateKey]
  );

  const pricingCounts = useMemo(
    () =>
      countScopePricingReadiness(
        displayItems,
        normMeasurements,
        checklist?.templateKey,
        scopeNotes
      ),
    [displayItems, normMeasurements, checklist?.templateKey, scopeNotes]
  );

  const summary = useMemo(
    () => scopeChecklistSummaryCounts(displayItems, pricingCounts.needsMeasurement),
    [displayItems, pricingCounts.needsMeasurement]
  );

  const persistScopeProgressNow = useCallback(() => {
    if (!onPersistProgress || applying) return;
    const currentItems = itemsRef.current;
    if (!currentItems.length) return;
    onPersistProgress(
      scopeChecklistItemsForPersist(currentItems),
      scopeMeasurementsPayloadForCurrentState()
    );
  }, [onPersistProgress, applying, scopeMeasurementsPayloadForCurrentState]);

  const visualCtx = useMemo<ScopeItemVisualContext>(
    () => ({
      notes: scopeNotes,
      templateKey: checklist?.templateKey,
      measurements: normMeasurements,
    }),
    [scopeNotes, checklist?.templateKey, normMeasurements]
  );

  const noteSummary = useMemo(
    () => scopeChecklistNoteSummary(displayItems, visualCtx),
    [displayItems, visualCtx]
  );

  const groupedItems = useMemo(
    () => groupScopeChecklistItems(displayItems, checklist?.templateKey),
    [displayItems, checklist?.templateKey]
  );

  const handleItemQuantityChange = (
    itemId: string,
    quantity: string,
    field: 'count' | 'allowance' = 'count',
    unit?: string
  ) => {
    const rule = getChecklistItemQuantityRule(itemId, checklist?.templateKey);
    if (field === 'allowance' && rule?.dualAllowanceField) {
      setMeasurementsSynced((prev) => ({
        ...prev,
        itemQuantities: {
          ...prev.itemQuantities,
          [roughAllowanceSubKey(itemId)]: {
            quantity,
            unit: unit || 'allowance',
            quantitySource: 'user_entered',
          },
        },
      }));
      return;
    }
    setMeasurementsSynced((prev) => {
      const itemQuantities = {
        ...prev.itemQuantities,
        [itemId]: {
          quantity,
          unit: unit || (rule?.dualAllowanceField ? 'each' : rule?.defaultUnit || 'sqft'),
          quantitySource: 'user_entered' as const,
        },
      };

      if (rule?.dualAllowanceField && field === 'count') {
        const allowanceKey = roughAllowanceSubKey(itemId);
        const materialKey = `${itemId}__material`;
        const laborKey = `${itemId}__labor`;
        const hasManualPricing = [allowanceKey, materialKey, laborKey].some((key) => {
          const entry = prev.itemQuantities[key];
          return entry?.quantitySource === 'user_entered' && String(entry.quantity || '').trim();
        });

        if (!hasManualPricing) {
          const nextInput = { ...prev, itemQuantities };
          const normalized = buildNormalizedScopeMeasurementsFromInput(nextInput, {
            notes: scopeNotes,
            templateKey: checklist?.templateKey,
          });
          const resolved = resolveChecklistItemQuantity(itemId, normalized, {
            templateKey: checklist?.templateKey,
            notes: scopeNotes,
          });
          const suggested = resolveScopeItemSuggestedPricing(
            itemId,
            nextInput,
            checklist?.templateKey,
            resolved,
            pricingContext
          ).fill;

          if (suggested) {
            itemQuantities[allowanceKey] = {
              quantity: String(suggested.total),
              unit: 'allowance',
              quantitySource: 'inferred',
            };
            itemQuantities[materialKey] = {
              quantity: String(suggested.material),
              unit: 'allowance',
              quantitySource: 'inferred',
            };
            itemQuantities[laborKey] = {
              quantity: String(suggested.labor),
              unit: 'allowance',
              quantitySource: 'inferred',
            };
          }
        }
      }

      return {
        ...prev,
        itemQuantities,
      };
    });
  };

  const scrollToFirstMissingMeasurement = useCallback(() => {
    for (const item of displayItems) {
      if (!checklistItemInScope(item)) continue;
      if (isCustomScopeItem(item)) {
        if (customScopePricingTotal(measurements, item.id) > 0) continue;
        const node = itemRefs.current[item.id];
        const content = scrollContentRef.current;
        if (node && content) {
          node.measureLayout(content, (_x, y) => {
            scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
          });
        }
        return;
      }
      const rule = getChecklistItemQuantityRule(item.id, checklist?.templateKey);
      if (!rule) continue;
      const resolved = resolveChecklistItemQuantity(item.id, normMeasurements, {
        choiceId: item.choiceId,
        templateKey: checklist?.templateKey,
        notes: scopeNotes,
      });
      if (!resolved.showInput || resolved.pricingReady) continue;

      const group = groupedItems.find((g) => g.items.some((row) => row.id === item.id));
      if (group?.title) {
        setCollapsedGroups((prev) => ({ ...prev, [group.title]: false }));
      }

      const node = itemRefs.current[item.id];
      const content = scrollContentRef.current;
      if (node && content) {
        node.measureLayout(content, (_x, y) => {
          scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
        });
      }
      return;
    }
  }, [displayItems, groupedItems, measurements, normMeasurements, checklist?.templateKey, scopeNotes]);

  const handleItemQuantityBlur = (itemId: string, field: 'count' | 'allowance' = 'count') => {
    const focusKey = `${itemId}:${field}`;
    focusedQuantityRef.current = null;
    setTimeout(() => {
      if (focusedQuantityRef.current === focusKey) return;
      setMeasurementsSynced((prev) => {
        const key = field === 'allowance' && isDualAllowanceItem(itemId) ? roughAllowanceSubKey(itemId) : itemId;
        const current = prev.itemQuantities[key];
        if (current?.quantity?.trim()) return prev;
        const itemQuantities = { ...prev.itemQuantities };
        delete itemQuantities[key];
        return { ...prev, itemQuantities };
      });
    }, 250);
  };

  const handleItemQuantityFocus = (itemId: string, field: 'count' | 'allowance' = 'count') => {
    focusedQuantityRef.current = `${itemId}:${field}`;
    setMeasurementsSynced((prev) => {
      const rule = getChecklistItemQuantityRule(itemId, checklist?.templateKey);
      const key = field === 'allowance' && rule?.dualAllowanceField ? roughAllowanceSubKey(itemId) : itemId;
      if (prev.itemQuantities[key]?.quantitySource === 'user_entered') return prev;
      const isPricingSubkey = /__(material|labor)$/.test(itemId);
      return {
        ...prev,
        itemQuantities: {
          ...prev.itemQuantities,
          [key]: {
            quantity: String(prev.itemQuantities[key]?.quantity ?? ''),
            unit: isPricingSubkey || field === 'allowance' ? 'allowance' : rule?.defaultUnit || 'sqft',
            quantitySource: 'user_entered',
          },
        },
      };
    });
  };

  const handleApplySuggestedPricing = useCallback(
    (itemId: string, block: SuggestedPricingBlock) => {
      hapticTap();
      selectedPricingRef.current = {
        ...selectedPricingRef.current,
        [itemId]: block,
      };
      setMeasurementsSynced((prev) => {
        const rule = getChecklistItemQuantityRule(itemId, checklist?.templateKey);
        const allowanceKey = rule?.dualAllowanceField ? roughAllowanceSubKey(itemId) : `${itemId}__allowance`;
        if (__DEV__ && itemId === 'flooring') {
          console.log('[scope-pricing] apply saved pricing', {
            itemId,
            total: block.total,
            material: block.material,
            labor: block.labor,
            basis: block.basis,
          });
        }
        return {
          ...prev,
          itemQuantities: {
            ...prev.itemQuantities,
            [itemId]: {
              quantity: String(block.basis?.quantity ?? block.total),
              unit: block.basis?.unit || (rule?.dualAllowanceField ? rule.defaultUnit : 'allowance'),
              quantitySource: 'user_entered',
            },
            [allowanceKey]: {
              quantity: String(block.total),
              unit: 'allowance',
              quantitySource: 'user_entered',
            },
            [`${itemId}__material`]: {
              quantity: String(block.material),
              unit: 'allowance',
              quantitySource: 'user_entered',
            },
            [`${itemId}__labor`]: {
              quantity: String(block.labor),
              unit: 'allowance',
              quantitySource: 'user_entered',
            },
          },
        };
      });
      setTimeout(() => persistScopeProgressNow(), 0);
    },
    [checklist?.templateKey, persistScopeProgressNow, setMeasurementsSynced]
  );

  const handleDeleteCustomItem = (itemId: string) => {
    const remove = () => {
      hapticTap();
      setItems((prev) => prev.filter((item) => item.id !== itemId));
      setMeasurementsSynced((prev) => {
        const itemQuantities = { ...prev.itemQuantities };
        delete itemQuantities[itemId];
        delete itemQuantities[`${itemId}__material`];
        delete itemQuantities[`${itemId}__labor`];
        delete itemQuantities[`${itemId}__allowance`];
        return { ...prev, itemQuantities };
      });
    };
    Alert.alert('Delete custom item?', 'This removes the custom scope card and its price.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: remove },
    ]);
  };

  const renderItem = (item: ScopeChecklistItem) => {
    const row =
      item.derivedFrom === 'wet_area_install' || WET_AREA_DERIVED_ITEM_IDS.has(item.id) ? (
      <WetAreaInstallLineCard
        item={item}
        templateKey={checklist?.templateKey}
        originalNotes={scopeNotes}
        measurementsInput={measurements}
        onItemQuantityChange={handleItemQuantityChange}
        onItemQuantityBlur={handleItemQuantityBlur}
        onItemQuantityFocus={handleItemQuantityFocus}
        onApplySuggestedPricing={handleApplySuggestedPricing}
        visualCtx={visualCtx}
        Colors={Colors}
        darkMode={darkMode}
        applying={applying}
      />
    ) : item.inputType === 'multi_choice' && (item.options?.length ?? 0) > 0 ? (
      <MultiChoiceRow
        item={item}
        templateKey={checklist?.templateKey}
        originalNotes={scopeNotes}
        onToggle={(optionId) =>
          setItems((prev) =>
            prev.map((row) => {
              if (row.id !== item.id) return row;
              const choiceIds = toggleWallLayoutChoiceIds(row.choiceIds, optionId);
              return {
                ...row,
                choiceIds,
                choiceId: choiceIds[0] ?? null,
                state: choiceIdsToScopeState(choiceIds),
              };
            })
          )
        }
        measurementsInput={measurements}
        onItemQuantityChange={handleItemQuantityChange}
        onItemQuantityBlur={handleItemQuantityBlur}
        onItemQuantityFocus={handleItemQuantityFocus}
        onApplySuggestedPricing={handleApplySuggestedPricing}
        visualCtx={visualCtx}
        Colors={Colors}
        darkMode={darkMode}
        applying={applying}
      />
    ) : item.inputType === 'choice' && (item.options?.length ?? 0) > 0 ? (
      <ChoiceRow
        item={item}
        templateKey={checklist?.templateKey}
        originalNotes={scopeNotes}
        onSelect={(choiceId) =>
          setItems((prev) => {
            const next = prev.map((row) =>
              row.id === item.id ? { ...row, choiceId, state: choiceIdToState(choiceId) } : row
            );
            if (item.id !== 'wet_area_install') return next;
            return next.map((row) => {
              if (row.state !== 'unsure') return row;
              if (choiceId === 'tile_pan') {
                if (['shower_floor_tile', 'waterproofing', 'shower_tile'].includes(row.id)) {
                  return { ...row, state: 'included' as const };
                }
              }
              if (choiceId === 'prefab') {
                if (['waterproofing', 'shower_tile'].includes(row.id)) {
                  return { ...row, state: 'included' as const };
                }
              }
              return row;
            });
          })
        }
        measurementsInput={measurements}
        onItemQuantityChange={handleItemQuantityChange}
        onItemQuantityBlur={handleItemQuantityBlur}
        onItemQuantityFocus={handleItemQuantityFocus}
        onApplySuggestedPricing={handleApplySuggestedPricing}
        visualCtx={visualCtx}
        Colors={Colors}
        darkMode={darkMode}
        applying={applying}
      />
    ) : (
      <YesNoRow
        item={item}
        templateKey={checklist?.templateKey}
        originalNotes={scopeNotes}
        onSetState={(state) =>
          setItems((prev) => {
            const next = prev.map((row) => (row.id === item.id ? { ...row, state } : row));
            return applyKitchenScopeInferences(next, checklist?.templateKey, {
              notes: scopeNotes,
              measurements: normMeasurements,
            });
          })
        }
        onRename={
          isCustomScopeItem(item)
            ? (label) => setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, label } : row)))
            : undefined
        }
        onDelete={isCustomScopeItem(item) ? () => handleDeleteCustomItem(item.id) : undefined}
        onSaveCustomPricing={isCustomScopeItem(item) ? persistScopeProgressNow : undefined}
        measurementsInput={measurements}
        onItemQuantityChange={handleItemQuantityChange}
        onItemQuantityBlur={handleItemQuantityBlur}
        onItemQuantityFocus={handleItemQuantityFocus}
        onApplySuggestedPricing={handleApplySuggestedPricing}
        visualCtx={visualCtx}
        Colors={Colors}
        darkMode={darkMode}
        applying={applying}
      />
    );

    return (
      <View
        ref={(node) => {
          itemRefs.current[item.id] = node;
        }}
        collapsable={false}
      >
        {row}
      </View>
    );
  };

  const handleConfirm = () => {
    if (applying || items.length === 0) return;

    const proceed = () => {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      const payload = scopeMeasurementsPayloadForCurrentState();
      if (__DEV__) {
        const q = payload.itemQuantities || {};
        console.log('[scope-pricing] confirm payload', {
          flooring: q.flooring,
          material: q.flooring__material,
          labor: q.flooring__labor,
          allowance: q.flooring__allowance,
        });
      }
      onConfirm(items, payload);
    };

    if (pricingCounts.needsMeasurement > 0) {
      const count = pricingCounts.needsMeasurement;
      Alert.alert(
        'Measurements still needed',
        `${count} included item${count === 1 ? '' : 's'} still need measurements.`,
        [
          { text: 'Enter missing measurements', style: 'cancel', onPress: scrollToFirstMissingMeasurement },
          {
            text: 'Continue anyway',
            onPress: proceed,
          },
          onScopeOnly
            ? {
                text: 'Save scope only',
                onPress: () =>
                  onScopeOnly(scopeMeasurementsPayloadForCurrentState()),
              }
            : { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }

    proceed();
  };

  const handleAddCustomItem = () => {
    const trimmed = customItemLabel.trim();
    if (!trimmed) return;
    hapticTap();
    setItems((prev) => [...prev, createCustomScopeItem(trimmed)]);
    setCustomItemLabel('');
    setShowCustomItemInput(false);
    setCollapsedGroups((prev) => ({ ...prev, ['Other']: false }));
  };

  const handleBack = () => {
    persistScopeProgressNow();
    onBack();
  };

  const handleClose = () => {
    persistScopeProgressNow();
    onClose();
  };

  const handleScopeOnly = () => {
    persistScopeProgressNow();
    onScopeOnly?.(scopeMeasurementsPayloadForCurrentState());
  };

  if (!visible || !draft || !checklist) return null;

  const body = (
    <View style={[styles.shell, { backgroundColor: Colors.bg }]}>
      <AIEstimateFlowHeader
        title="Confirm scope"
        subtitle="What work is in this bid?"
        step={2}
        stepTotal={3}
        fromAssistant={fromAssistant}
        disabled={applying}
        onBack={handleBack}
      />

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + (showCustomItemInput ? 220 : 120),
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <View ref={scrollContentRef} collapsable={false}>
        <Text
          style={{
            color: captionColor(darkMode, Colors),
            fontSize: 12,
            marginTop: 4,
            marginBottom: 12,
            lineHeight: 17,
          }}
        >
          {noteSummary.fromNotes > 0 ? `${noteSummary.fromNotes} from notes · ` : ''}
          {summary.included} included
          {summary.needsMeasurement > 0 ? (
            <>
              {' · '}
              <Text onPress={scrollToFirstMissingMeasurement} style={{ color: '#fbbf24', fontWeight: '700' }}>
                {summary.needsMeasurement} need measurements
              </Text>
            </>
          ) : (
            ' · 0 need measurements'
          )}
          {summary.unsure > 0 ? (
            <>
              {' · '}
              {summary.unsure} not sure
            </>
          ) : null}
        </Text>

        <CollapsibleQuickMeasurements
          expanded={quickMeasurementsOpen}
          onToggle={() => setQuickMeasurementsOpen((v) => !v)}
          measurements={measurements}
          setMeasurements={setMeasurementsSynced}
          templateKey={checklist?.templateKey}
          projectType={draft?.projectType}
          notes={scopeNotes}
          Colors={Colors}
          darkMode={darkMode}
          applying={applying}
        />

        {groupedItems.map((group) => (
          <ScopeGroupSection
            key={group.title || 'all'}
            title={group.title}
            items={group.items}
            collapsed={Boolean(collapsedGroups[group.title])}
            onToggle={() =>
              setCollapsedGroups((prev) => ({ ...prev, [group.title]: !prev[group.title] }))
            }
            renderItem={renderItem}
            noteSummary={scopeChecklistNoteSummary(group.items, visualCtx)}
            Colors={Colors}
            darkMode={darkMode}
          />
        ))}

        <TouchableOpacity
          style={[
            styles.addScopeItemBtn,
            {
              borderColor: darkMode ? 'rgba(148, 163, 184, 0.22)' : Colors.line,
              backgroundColor: darkMode ? 'rgba(255,255,255,0.02)' : Colors.surface2,
            },
          ]}
          onPress={() => {
            setShowCustomItemInput((open) => {
              const next = !open;
              if (next) {
                setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
              }
              return next;
            });
          }}
          disabled={applying}
          activeOpacity={0.75}
        >
          <Ionicons name="add-circle-outline" size={18} color="#22c55e" />
          <Text style={{ color: '#22c55e', fontSize: 13, fontWeight: '700' }}>Add scope item</Text>
        </TouchableOpacity>

        {showCustomItemInput ? (
          <View style={[styles.customItemCard, estimateFlowCardStyle(Colors, darkMode)]}>
            <View style={styles.customItemHeader}>
              <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '800' }}>
                Custom scope item
              </Text>
              <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, lineHeight: 16 }}>
                Add work the AI or template missed. You can price it after adding.
              </Text>
            </View>
            <View style={styles.customItemInputRow}>
              <TextInput
                value={customItemLabel}
                onChangeText={setCustomItemLabel}
                placeholder="e.g. heated floor, transition strip"
                placeholderTextColor={darkMode ? 'rgba(255,255,255,0.35)' : '#94a3b8'}
                returnKeyType="done"
                blurOnSubmit
                onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80)}
                onSubmitEditing={() => Keyboard.dismiss()}
                editable={!applying}
                style={[
                  styles.customItemInput,
                  {
                    color: Colors.text,
                    borderColor: darkMode ? 'rgba(148, 163, 184, 0.16)' : Colors.line,
                    backgroundColor: darkMode ? 'rgba(255,255,255,0.05)' : Colors.surface2,
                  },
                ]}
              />
              <TouchableOpacity
                style={[styles.customItemAddBtn, !customItemLabel.trim() && { opacity: 0.45 }]}
                onPress={handleAddCustomItem}
                disabled={applying || !customItemLabel.trim()}
              >
                <Text style={{ color: '#0f172a', fontWeight: '800', fontSize: 12 }}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom, 16),
            backgroundColor: Colors.bg,
            borderTopColor: darkMode ? 'rgba(148, 163, 184, 0.12)' : Colors.line,
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.primaryBtn, applying && styles.primaryBtnDisabled]}
          onPress={handleConfirm}
          disabled={applying}
          activeOpacity={0.88}
        >
          {applying ? (
            <ActivityIndicator color="#0f172a" />
          ) : (
            <Text style={styles.primaryBtnText}>Continue to review</Text>
          )}
        </TouchableOpacity>

        {onScopeOnly ? (
          <TouchableOpacity
            onPress={handleScopeOnly}
            disabled={applying}
            activeOpacity={0.88}
          >
            <Text style={{ color: Colors.sub, fontWeight: '700', textAlign: 'center' }}>
              Save scope only
            </Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity onPress={handleClose} disabled={applying}>
          <Text style={{ color: Colors.sub, fontWeight: '600', textAlign: 'center' }}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ScopePricingContextValue.Provider value={pricingContext}>
      <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={handleBack}>
        <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
        <View style={{ flex: 1, backgroundColor: Colors.bg }}>
          {body}
        </View>
      </Modal>
    </ScopePricingContextValue.Provider>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  quickMeasurements: {
    marginBottom: 14,
  },
  quickMeasurementsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  measurementsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  measurementField: {
    flex: 1,
  },
  measurementLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  measurementInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  groupSection: {
    marginBottom: 6,
  },
  addScopeItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
    marginBottom: 12,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  customItemCard: {
    gap: 10,
    marginBottom: 14,
    padding: 12,
  },
  customItemHeader: {
    gap: 3,
  },
  customItemInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customItemInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 14,
  },
  customItemAddBtn: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  card: {
    marginBottom: 8,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  fromNotesBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  fromNotesBadgeLight: {
    borderColor: 'rgba(34, 197, 94, 0.35)',
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
  },
  fromNotesBadgeDark: {
    borderColor: 'rgba(34, 197, 94, 0.35)',
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
  },
  customCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  customBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  customBadgeLight: {
    borderColor: 'rgba(96, 165, 250, 0.32)',
    backgroundColor: 'rgba(96, 165, 250, 0.08)',
  },
  customBadgeDark: {
    borderColor: 'rgba(96, 165, 250, 0.35)',
    backgroundColor: 'rgba(96, 165, 250, 0.12)',
  },
  customIconBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
  },
  customRenameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customRenameInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === 'ios' ? 8 : 7,
    fontSize: 14,
    fontWeight: '700',
  },
  customRenameAction: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  customPricingModeLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  customPricingModeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  savePricingBtn: {
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 11,
    backgroundColor: '#22c55e',
  },
  savePricingBtnText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '800',
  },
  useSuggestedPricingBtn: {
    marginTop: 10,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 10,
    backgroundColor: '#22c55e',
  },
  useSuggestedPricingBtnText: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '800',
  },
  includedPillRow: {
    marginTop: 10,
    marginBottom: 2,
  },
  includedPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.35)',
  },
  includedPillDark: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
  },
  includedPillLight: {
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
  },
  choiceRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  choiceWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  choiceChip: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  choiceChipWide: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    minWidth: '47%',
    flexGrow: 1,
  },
  qtySection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  qtyCompactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pricingRow: {
    minHeight: 30,
  },
  pricingRowMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  pricingRowEmphasized: {
    minHeight: 34,
  },
  pricingRowGap: {
    marginTop: 6,
  },
  pricingSplitRow: {
    marginTop: 10,
  },
  pricingSplitRowMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  pricingRateHelper: {
    alignSelf: 'flex-end',
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 14,
    marginTop: 3,
    opacity: 0.82,
  },
  budgetSplitPanel: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  budgetSplitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
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
  sourcePillTemplate: {
    borderColor: 'rgba(167, 139, 250, 0.35)',
    backgroundColor: 'rgba(167, 139, 250, 0.12)',
  },
  sourcePillRemainder: {
    borderColor: 'rgba(245, 158, 11, 0.35)',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  editQuantityLink: {
    color: '#22c55e',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 10,
  },
  pricingInputCard: {
    marginTop: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingTop: 9,
    paddingBottom: 10,
  },
  pricingInputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 7,
  },
  rateChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  rateModeToggle: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  pricingInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  pricingInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 15,
    fontWeight: '700',
  },
  qtyInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  primaryBtn: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: { color: '#0f172a', fontWeight: '800', fontSize: 16 },
});
