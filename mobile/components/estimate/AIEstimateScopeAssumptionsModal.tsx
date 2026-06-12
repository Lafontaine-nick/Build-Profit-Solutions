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
import { resolveDraftScopeNotes } from '@/utils/estimateAiDraft';
import {
  checklistDisplayHelper,
  choiceIdsToScopeState,
  createCustomScopeItem,
  groupScopeChecklistItems,
  initialScopeGroupCollapse,
  markAllUnsureAsExcluded,
  mergeScopeProgressIntoDraft,
  applyKitchenScopeInferences,
  applyScopeInferencesFromNotes,
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
  initialScopeMeasurementInputExtended,
  isDualAllowanceItem,
  overlayDualRatePricingDisplay,
  prepareScopeMeasurementsInputForUi,
  resolveChecklistItemQuantity,
  roughAllowanceSubKey,
  scopeMeasurementsToPayload,
  scopeMeasurementsPayloadForPersist,
  type ScopeMeasurementsInputExtended,
} from '@/utils/scopeItemQuantities';
import {
  emptyQuickMeasurementInput,
  quickMeasurementRowsForTemplate,
  type QuickMeasurementFieldKey,
} from '@/utils/scopeQuickMeasurements';
import { KEYBOARD_ACCESSORY_IDS } from '@/constants/keyboard';
import { aiScopeConfirmNumericKeyboardProps } from '@/constants/inputKeyboardPresets';
import KeyboardPlainAccessory from '@/components/ui/KeyboardPlainAccessory';

import { estimateFlowCardStyle, estimateFlowDividerColor } from '@/utils/estimateFlowCardStyle';
import {
  SCOPE_ITEM_TIER_OPACITY,
  scopeChecklistNoteSummary,
  scopeItemHasNoteSignal,
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
  darkMode,
  Colors,
}: {
  label: string;
  noteBadge?: ScopeItemNoteBadge | null;
  darkMode: boolean;
  Colors: ReturnType<typeof getColors>;
}) {
  const badgeLabel = noteBadge === 'prefilled' ? 'Prefilled' : noteBadge === 'mentioned' ? 'In notes' : null;

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
          <Text style={{ color: '#22c55e', fontSize: 10, fontWeight: '700' }}>{badgeLabel}</Text>
        </View>
      ) : null}
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

function formatResolvedQuantityDisplay(quantity: number, unit: string): string {
  if (unit === 'allowance' || unit === 'lump_sum') {
    return `$${quantity.toLocaleString()}`;
  }
  return `${quantity.toLocaleString()} ${formatUnitLabel(unit)}`;
}

function scopeCardStyle(
  tier: ReturnType<typeof scopeItemVisualTier>,
  Colors: ReturnType<typeof getColors>,
  darkMode: boolean
) {
  return [styles.card, estimateFlowCardStyle(Colors, darkMode), { opacity: SCOPE_ITEM_TIER_OPACITY[tier] }];
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
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  applying: boolean;
}) {
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

  if (rule.dualAllowanceField) {
    const fieldLabels = DUAL_QUANTITY_FIELD_LABELS[itemId];
    const allowanceKey = roughAllowanceSubKey(itemId);
    const countInput = measurementsInput.itemQuantities[itemId];
    const allowanceInput = measurementsInput.itemQuantities[allowanceKey];
    const isEditing = isUserEditingQuantity(measurementsInput, itemId, allowanceKey);

    if (resolved.pricingReady && !isEditing) {
      return (
        <View style={[styles.qtySection, { borderTopColor: dividerColor(darkMode) }]}>
          {resolved.dualCount ? (
            <View style={styles.qtyCompactRow}>
              <Text style={{ color: darkMode ? '#F5F7FA' : Colors.text, fontSize: 12, fontWeight: '600' }}>
                {resolved.dualCount.quantity.toLocaleString()} {fieldLabels?.countUnit || 'each'}
              </Text>
              <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11 }}>
                {fieldLabels?.count || 'Quantity'}
              </Text>
            </View>
          ) : null}
          {resolved.dualMaterial ? (
            <View style={[styles.qtyCompactRow, resolved.dualCount ? { marginTop: 4 } : undefined]}>
              <Text style={{ color: darkMode ? '#F5F7FA' : Colors.text, fontSize: 12, fontWeight: '600' }}>
                ${resolved.dualMaterial.quantity.toLocaleString()}
              </Text>
              <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11 }}>Material</Text>
            </View>
          ) : null}
          {resolved.dualLabor ? (
            <View style={[styles.qtyCompactRow, { marginTop: 4 }]}>
              <Text style={{ color: darkMode ? '#F5F7FA' : Colors.text, fontSize: 12, fontWeight: '600' }}>
                ${resolved.dualLabor.quantity.toLocaleString()}
              </Text>
              <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11 }}>Labor</Text>
            </View>
          ) : null}
          {resolved.dualAllowance ? (
            <View
              style={[
                styles.qtyCompactRow,
                resolved.dualCount || resolved.dualMaterial || resolved.dualLabor ? { marginTop: 4 } : undefined,
              ]}
            >
              <Text style={{ color: darkMode ? '#F5F7FA' : Colors.text, fontSize: 12, fontWeight: '600' }}>
                ${resolved.dualAllowance.quantity.toLocaleString()}
              </Text>
              <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11 }}>
                {resolved.dualMaterial || resolved.dualLabor
                  ? 'Total'
                  : fieldLabels?.allowance || 'Allowance'}
              </Text>
            </View>
          ) : null}
          {resolved.sourceLabel ? (
            <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, marginTop: 4 }}>
              {resolved.sourceLabel}
            </Text>
          ) : null}
          <TouchableOpacity
            onPress={() => {
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
            }}
            activeOpacity={0.7}
          >
            <Text style={{ color: '#22c55e', fontSize: 11, fontWeight: '600', marginTop: 4 }}>
              Edit quantity
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={[styles.qtySection, { borderTopColor: dividerColor(darkMode) }]}>
        <Text style={{ color: '#fbbf24', fontSize: 11, fontWeight: '700', marginBottom: 6 }}>
          {resolved.missingMessage || 'Enter quantity and/or allowance'}
        </Text>
        {rule.quantityHelper ? (
          <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, marginBottom: 8, lineHeight: 15 }}>
            {rule.quantityHelper}
          </Text>
        ) : null}
        <Text style={{ color: Colors.sub, fontSize: 11, fontWeight: '600', marginBottom: 4 }}>
          {fieldLabels?.count || 'Quantity'}
        </Text>
        <View style={styles.qtyInputRow}>
          <TextInput
            value={countInput?.quantity ?? ''}
            onChangeText={(text) => onItemQuantityChange(itemId, text, 'count')}
            onBlur={() => onItemQuantityBlur(itemId, 'count')}
            placeholder="0"
            placeholderTextColor={placeholderColor}
            keyboardType="decimal-pad"
            {...aiScopeConfirmNumericKeyboardProps}
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
        <Text style={{ color: Colors.sub, fontSize: 11, fontWeight: '600', marginTop: 10, marginBottom: 4 }}>
          {fieldLabels?.allowance || 'Allowance ($)'}
        </Text>
        <View style={styles.qtyInputRow}>
          <Text style={{ color: Colors.sub, fontSize: 14, fontWeight: '600' }}>$</Text>
          <TextInput
            value={allowanceInput?.quantity ?? ''}
            onChangeText={(text) => onItemQuantityChange(itemId, text, 'allowance')}
            onBlur={() => onItemQuantityBlur(itemId, 'allowance')}
            placeholder="0"
            placeholderTextColor={placeholderColor}
            keyboardType="decimal-pad"
            {...aiScopeConfirmNumericKeyboardProps}
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
  const isEditingQuantity = isUserEditingQuantity(measurementsInput, itemId);
  const neededLabel =
    (templateKey && QUANTITY_NEEDED_LABELS_BY_TEMPLATE[templateKey]?.[itemId]) ||
    QUANTITY_NEEDED_LABELS[itemId] ||
    quantityNeededLabel(itemId, templateKey, rule.defaultUnit);

  if (resolved.pricingReady && !isEditingQuantity) {
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
        <View style={styles.qtyCompactRow}>
          <Text style={{ color: darkMode ? '#F5F7FA' : Colors.text, fontSize: 12, fontWeight: '600' }}>
            {formatResolvedQuantityDisplay(resolved.quantity ?? 0, resolved.unit)}
          </Text>
          <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11 }}>{resolved.sourceLabel}</Text>
        </View>
        {resolved.combinedAllowanceRole === 'combined_total' ? (
          <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, marginTop: 4, lineHeight: 15 }}>
            One allowance for cabinets and countertops — the countertop line below is included, not
            priced again.
          </Text>
        ) : null}
        <TouchableOpacity
          onPress={() =>
            onItemQuantityChange(itemId, String(resolved.quantity ?? ''), 'count', resolved.unit)
          }
          activeOpacity={0.7}
        >
          <Text style={{ color: '#22c55e', fontSize: 11, fontWeight: '600', marginTop: 4 }}>
            Edit quantity
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.qtySection, { borderTopColor: dividerColor(darkMode) }]}>
      <Text style={{ color: '#fbbf24', fontSize: 11, fontWeight: '700', marginBottom: 6 }}>
        Needs {neededLabel}
      </Text>
      <View style={styles.qtyInputRow}>
        <TextInput
          value={itemInput?.quantity ?? ''}
          onChangeText={(text) => onItemQuantityChange(itemId, text)}
          onBlur={() => onItemQuantityBlur(itemId)}
          placeholder={`Enter ${neededLabel}`}
          placeholderTextColor={placeholderColor}
          keyboardType="decimal-pad"
          {...aiScopeConfirmNumericKeyboardProps}
          editable={!applying}
          style={[
            styles.qtyInput,
            { color: Colors.text, borderColor: inputShell.borderColor, backgroundColor: inputShell.backgroundColor },
          ]}
        />
        <Text style={{ color: Colors.sub, fontSize: 12, fontWeight: '600', minWidth: 40 }}>
          {formatUnitLabel(rule.defaultUnit)}
        </Text>
      </View>
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
  measurementsInput,
  onItemQuantityChange,
  onItemQuantityBlur,
  visualCtx,
  Colors,
  darkMode,
  applying,
}: {
  item: ScopeChecklistItem;
  templateKey?: string | null;
  originalNotes?: string | null;
  onSetState: (state: ScopeAssumptionState) => void;
  measurementsInput: ScopeMeasurementsInputExtended;
  onItemQuantityChange: (
    itemId: string,
    quantity: string,
    field?: 'count' | 'allowance',
    unit?: string
  ) => void;
  onItemQuantityBlur: (itemId: string, field?: 'count' | 'allowance') => void;
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
      </View>
      <QuantitySection
        itemId={item.id}
        choiceId={item.choiceId}
        inScope={item.state === 'included'}
        templateKey={templateKey}
        originalNotes={originalNotes}
        measurementsInput={measurementsInput}
        onItemQuantityChange={onItemQuantityChange}
        onItemQuantityBlur={onItemQuantityBlur}
        Colors={Colors}
        darkMode={darkMode}
        applying={applying}
      />
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
        {...aiScopeConfirmNumericKeyboardProps}
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
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  applying: boolean;
}) {
  const rows = quickMeasurementRowsForTemplate(templateKey, projectType);

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
                  value={measurements[field.key]}
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
}: Props) {
  const insets = useSafeAreaInsets();
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const checklist = draft?.scopeChecklist;
  const scopeNotes = useMemo(() => {
    const resolved = resolveDraftScopeNotes(draft);
    if (resolved) return resolved;
    return String(notesFallback || '').trim();
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
  const scrollRef = useRef<ScrollView>(null);
  const scrollContentRef = useRef<View>(null);
  const itemRefs = useRef<Record<string, View | null>>({});

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    measurementsRef.current = measurements;
  }, [measurements]);

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
      const sourceItems = scopeChecklistItemsForEditing(draft);
      if (!sourceItems.length) return;
      const nextMeasurements = prepareScopeMeasurementsInputForUi(
        initialScopeMeasurementInputExtended(draft, scopeNotes),
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
      setMeasurements(nextMeasurements);
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
    }
  }, [visible, draftScopeRestoreKey, checklist?.templateKey, draft]);

  // Keep rate-pricing subkeys in form state whenever notes are available (handles hot reload / stale saves).
  useEffect(() => {
    if (!visible || !scopeNotes.trim()) return;
    setMeasurements((prev) =>
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
      scopeMeasurementsPayloadForPersist(measurementsRef.current, {
        notes: scopeNotes,
        templateKey: checklist?.templateKey,
      })
    );
  }, [visible, onPersistProgress, applying, scopeNotes, checklist?.templateKey]);

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
      setMeasurements((prev) => ({
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
    setMeasurements((prev) => ({
      ...prev,
      itemQuantities: {
        ...prev.itemQuantities,
        [itemId]: {
          quantity,
          unit: unit || (rule?.dualAllowanceField ? 'each' : rule?.defaultUnit || 'sqft'),
          quantitySource: 'user_entered',
        },
      },
    }));
  };

  const scrollToFirstMissingMeasurement = useCallback(() => {
    for (const item of displayItems) {
      if (!checklistItemInScope(item)) continue;
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
  }, [displayItems, groupedItems, normMeasurements, checklist?.templateKey, scopeNotes]);

  const handleAcceptAllFromNotes = () => {
    hapticTap();
    setItems((prev) =>
      applyScopeInferencesFromNotes(
        prev,
        scopeNotes,
        checklist?.templateKey,
        normMeasurements
      )
    );
    setCollapsedGroups((prev) => {
      const next = { ...prev };
      for (const group of groupedItems) {
        if (group.items.some((item) => scopeItemHasNoteSignal(item, visualCtx))) {
          next[group.title] = false;
        }
      }
      return next;
    });
  };

  const handleItemQuantityBlur = (itemId: string, field: 'count' | 'allowance' = 'count') => {
    setMeasurements((prev) => {
      const key = field === 'allowance' && isDualAllowanceItem(itemId) ? roughAllowanceSubKey(itemId) : itemId;
      const current = prev.itemQuantities[key];
      if (current?.quantity?.trim()) return prev;
      const itemQuantities = { ...prev.itemQuantities };
      delete itemQuantities[key];
      return { ...prev, itemQuantities };
    });
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
        measurementsInput={measurements}
        onItemQuantityChange={handleItemQuantityChange}
        onItemQuantityBlur={handleItemQuantityBlur}
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
      onConfirm(items, scopeMeasurementsToPayload(measurements));
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
                onPress: () => onScopeOnly(scopeMeasurementsToPayload(measurements)),
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

  const handleMarkAllUnsureAsNo = () => {
    hapticTap();
    setItems((prev) => markAllUnsureAsExcluded(prev));
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
        onBack={onBack}
      />

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 120 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
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
          {' · '}
          {summary.unsure} not sure
        </Text>

        <CollapsibleQuickMeasurements
          expanded={quickMeasurementsOpen}
          onToggle={() => setQuickMeasurementsOpen((v) => !v)}
          measurements={measurements}
          setMeasurements={setMeasurements}
          templateKey={checklist?.templateKey}
          projectType={draft?.projectType}
          Colors={Colors}
          darkMode={darkMode}
          applying={applying}
        />

        <View style={styles.scopeActionsRow}>
          <TouchableOpacity
            onPress={() => setShowCustomItemInput((v) => !v)}
            disabled={applying}
            activeOpacity={0.7}
          >
            <Text style={{ color: '#22c55e', fontSize: 12, fontWeight: '700' }}>Add custom scope item</Text>
          </TouchableOpacity>
          {noteSummary.fromNotes > 0 ? (
            <TouchableOpacity onPress={handleAcceptAllFromNotes} disabled={applying} activeOpacity={0.7}>
              <Text style={{ color: '#22c55e', fontSize: 12, fontWeight: '700' }}>Accept all from notes</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={handleMarkAllUnsureAsNo} disabled={applying} activeOpacity={0.7}>
            <Text style={{ color: Colors.sub, fontSize: 12, fontWeight: '700' }}>Mark all Not Sure as No</Text>
          </TouchableOpacity>
        </View>

        {showCustomItemInput ? (
          <View style={[styles.customItemRow, estimateFlowCardStyle(Colors, darkMode)]}>
            <TextInput
              value={customItemLabel}
              onChangeText={setCustomItemLabel}
              placeholder="Describe the work (e.g. heated floor)"
              placeholderTextColor={darkMode ? 'rgba(255,255,255,0.35)' : '#94a3b8'}
              returnKeyType="done"
              blurOnSubmit
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
        ) : null}

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
            onPress={() => onScopeOnly(scopeMeasurementsToPayload(measurements))}
            disabled={applying}
            activeOpacity={0.88}
          >
            <Text style={{ color: Colors.sub, fontWeight: '700', textAlign: 'center' }}>
              Save scope only
            </Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity onPress={onClose} disabled={applying}>
          <Text style={{ color: Colors.sub, fontWeight: '600', textAlign: 'center' }}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onBack}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
      <View style={{ flex: 1, backgroundColor: Colors.bg }}>
        {body}
        <KeyboardPlainAccessory
          nativeID={KEYBOARD_ACCESSORY_IDS.aiScopeConfirmNumeric}
          backgroundColor={Colors.bg}
        />
      </View>
    </Modal>
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
  scopeActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  customItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    padding: 10,
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
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  qtyCompactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
