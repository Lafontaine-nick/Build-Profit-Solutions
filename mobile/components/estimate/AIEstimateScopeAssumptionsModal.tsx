import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import AIEstimateFlowHeader from '@/components/estimate/AIEstimateFlowHeader';
import type {
  EstimateAiDraft,
  ScopeAssumptionState,
  ScopeChecklistItem,
  ScopeMeasurements,
} from '@/utils/estimateAiDraft';
import {
  checklistDisplayHelper,
  createCustomScopeItem,
  groupScopeChecklistItems,
  initialScopeGroupCollapse,
  markAllUnsureAsExcluded,
  mergeScopeProgressIntoDraft,
  normalizeScopeChecklistItems,
  scopeChecklistItemsForEditing,
  scopeChecklistItemsForPersist,
  expandWetAreaDerivedScopeItems,
  WET_AREA_DERIVED_ITEM_IDS,
  scopeChecklistSummaryCounts,
} from '@/utils/estimateScopeChecklistUi';
import {
  CHECKLIST_ITEM_QUANTITY_RULES,
  countScopePricingReadiness,
  formatUnitLabel,
  initialScopeMeasurementInputExtended,
  normalizeScopeMeasurements,
  resolveChecklistItemQuantity,
  scopeMeasurementsToPayload,
  type ScopeMeasurementsInputExtended,
} from '@/utils/scopeItemQuantities';
import { KEYBOARD_ACCESSORY_IDS } from '@/constants/keyboard';
import { aiScopeConfirmNumericKeyboardProps } from '@/constants/inputKeyboardPresets';
import KeyboardPlainAccessory from '@/components/ui/KeyboardPlainAccessory';

type Props = {
  visible: boolean;
  draft: EstimateAiDraft | null;
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
  demo: 'tear-out sqft (floor + shower)',
  floor_demo: 'bathroom floor sqft',
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
  countertops: 'countertop LF or sqft',
  backsplash: 'backsplash sqft',
  flooring: 'floor sqft',
  rock_mulch: 'sqft, CY, or tons',
  sod_turf: 'turf sqft',
  pavers: 'paver sqft',
  concrete: 'concrete sqft or CY',
  excavation: 'excavation CY or sqft',
  plumbing_rough: 'fixture count or allowance',
  electrical_rough: 'device count or allowance',
};

function hapticTap() {
  if (Platform.OS !== 'web') {
    Haptics.selectionAsync();
  }
}

/** Match Budget tab / project overview inner cards. */
function scopeCardStyle(Colors: ReturnType<typeof getColors>, darkMode: boolean) {
  return {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(148, 163, 184, 0.12)' : Colors.line,
    backgroundColor: Colors.surface2,
    ...(darkMode
      ? {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.18,
          shadowRadius: 12,
          elevation: 3,
        }
      : {}),
  };
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
  return darkMode ? 'rgba(148, 163, 184, 0.12)' : 'rgba(148, 163, 184, 0.2)';
}

function buildNormFromInput(input: ScopeMeasurementsInputExtended) {
  return normalizeScopeMeasurements(scopeMeasurementsToPayload(input));
}

function QuantitySection({
  itemId,
  choiceId,
  inScope,
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
  measurementsInput: ScopeMeasurementsInputExtended;
  onItemQuantityChange: (itemId: string, quantity: string) => void;
  onItemQuantityBlur: (itemId: string) => void;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  applying: boolean;
}) {
  if (!inScope || !CHECKLIST_ITEM_QUANTITY_RULES[itemId]) return null;

  const norm = buildNormFromInput(measurementsInput);
  const resolved = resolveChecklistItemQuantity(itemId, norm, { choiceId });
  const rule = CHECKLIST_ITEM_QUANTITY_RULES[itemId];
  if (!resolved.showInput && !resolved.pricingReady) return null;
  const itemInput = measurementsInput.itemQuantities[itemId];
  const isEditingQuantity = Object.prototype.hasOwnProperty.call(
    measurementsInput.itemQuantities,
    itemId
  );
  const inputShell = inputShellStyle(Colors, darkMode);
  const placeholderColor = darkMode ? 'rgba(255,255,255,0.35)' : '#94a3b8';
  const neededLabel = QUANTITY_NEEDED_LABELS[itemId] || formatUnitLabel(rule.defaultUnit);

  if (resolved.pricingReady && !isEditingQuantity) {
    return (
      <View style={[styles.qtySection, { borderTopColor: dividerColor(darkMode) }]}>
        <View style={styles.qtyCompactRow}>
          <Text style={{ color: darkMode ? '#F5F7FA' : Colors.text, fontSize: 12, fontWeight: '600' }}>
            {resolved.quantity?.toLocaleString()} {formatUnitLabel(resolved.unit)}
          </Text>
          <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11 }}>{resolved.sourceLabel}</Text>
        </View>
        <TouchableOpacity
          onPress={() => onItemQuantityChange(itemId, String(resolved.quantity ?? ''))}
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
  measurementsInput,
  onItemQuantityChange,
  onItemQuantityBlur,
  Colors,
  darkMode,
  applying,
}: {
  item: ScopeChecklistItem;
  measurementsInput: ScopeMeasurementsInputExtended;
  onItemQuantityChange: (itemId: string, quantity: string) => void;
  onItemQuantityBlur: (itemId: string) => void;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  applying: boolean;
}) {
  const helper = checklistDisplayHelper(item);

  return (
    <View style={[styles.card, scopeCardStyle(Colors, darkMode)]}>
      <Text style={{ color: darkMode ? '#F5F7FA' : Colors.text, fontSize: 14, fontWeight: '700', lineHeight: 20 }}>
        {item.label}
      </Text>
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
  onSetState,
  measurementsInput,
  onItemQuantityChange,
  onItemQuantityBlur,
  Colors,
  darkMode,
  applying,
}: {
  item: ScopeChecklistItem;
  onSetState: (state: ScopeAssumptionState) => void;
  measurementsInput: ScopeMeasurementsInputExtended;
  onItemQuantityChange: (itemId: string, quantity: string) => void;
  onItemQuantityBlur: (itemId: string) => void;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  applying: boolean;
}) {
  const helper = checklistDisplayHelper(item);

  return (
    <View style={[styles.card, scopeCardStyle(Colors, darkMode)]}>
      <Text style={{ color: darkMode ? '#F5F7FA' : Colors.text, fontSize: 14, fontWeight: '700', lineHeight: 20 }}>
        {item.label}
      </Text>
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
  onSelect,
  measurementsInput,
  onItemQuantityChange,
  onItemQuantityBlur,
  Colors,
  darkMode,
  applying,
}: {
  item: ScopeChecklistItem;
  onSelect: (choiceId: string) => void;
  measurementsInput: ScopeMeasurementsInputExtended;
  onItemQuantityChange: (itemId: string, quantity: string) => void;
  onItemQuantityBlur: (itemId: string) => void;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  applying: boolean;
}) {
  const inScope = Boolean(item.choiceId && item.choiceId !== 'not_in_scope' && item.choiceId !== 'unsure');
  const helper = checklistDisplayHelper(item);

  return (
    <View style={[styles.card, scopeCardStyle(Colors, darkMode)]}>
      <Text style={{ color: darkMode ? '#F5F7FA' : Colors.text, fontSize: 14, fontWeight: '700', lineHeight: 20 }}>
        {item.label}
      </Text>
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
  Colors,
  darkMode,
  applying,
}: {
  expanded: boolean;
  onToggle: () => void;
  measurements: ScopeMeasurementsInputExtended;
  setMeasurements: React.Dispatch<React.SetStateAction<ScopeMeasurementsInputExtended>>;
  templateKey?: string;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  applying: boolean;
}) {
  const tk = templateKey || 'bathroom';
  const showBath = tk === 'bathroom' || tk === 'room_remodel';
  const showKitchen = tk === 'kitchen';
  const showLandscape = tk === 'landscaping';
  const showRoof = tk === 'roofing';
  const showDrywall = tk === 'drywall';
  const showPaint = tk === 'painting' || tk === 'room_remodel';
  const showConcrete = tk === 'concrete' || tk === 'deck_patio';
  const showExcavation = tk === 'excavation';

  return (
    <View style={[styles.quickMeasurements, scopeCardStyle(Colors, darkMode)]}>
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
          {showBath ? (
            <>
              <View style={styles.measurementsRow}>
                <QuickMeasurementField
                  label="Bathroom floor sqft"
                  value={measurements.bathroomFloorSqft}
                  onChangeText={(bathroomFloorSqft) =>
                    setMeasurements((prev) => ({ ...prev, bathroomFloorSqft }))
                  }
                  placeholder="e.g. 90"
                  Colors={Colors}
                  darkMode={darkMode}
                  applying={applying}
                />
                <QuickMeasurementField
                  label="Shower wall sqft"
                  value={measurements.showerWallTileSqft}
                  onChangeText={(showerWallTileSqft) =>
                    setMeasurements((prev) => ({ ...prev, showerWallTileSqft }))
                  }
                  placeholder="e.g. 90"
                  Colors={Colors}
                  darkMode={darkMode}
                  applying={applying}
                />
              </View>
              <View style={styles.measurementsRow}>
                <QuickMeasurementField
                  label="Shower floor sqft"
                  value={measurements.showerFloorTileSqft}
                  onChangeText={(showerFloorTileSqft) =>
                    setMeasurements((prev) => ({ ...prev, showerFloorTileSqft }))
                  }
                  placeholder="e.g. 15"
                  Colors={Colors}
                  darkMode={darkMode}
                  applying={applying}
                />
                <QuickMeasurementField
                  label="Wall/ceiling paint sqft"
                  value={measurements.wallPaintSqft}
                  onChangeText={(wallPaintSqft) => setMeasurements((prev) => ({ ...prev, wallPaintSqft }))}
                  placeholder="e.g. 175"
                  Colors={Colors}
                  darkMode={darkMode}
                  applying={applying}
                />
              </View>
              <QuickMeasurementField
                label="Baseboard linear feet"
                value={measurements.baseboardLf}
                onChangeText={(baseboardLf) => setMeasurements((prev) => ({ ...prev, baseboardLf }))}
                placeholder="e.g. 24"
                Colors={Colors}
                darkMode={darkMode}
                applying={applying}
              />
            </>
          ) : null}
          {showKitchen ? (
            <View style={styles.measurementsRow}>
              <QuickMeasurementField
                label="Kitchen floor sqft"
                value={measurements.kitchenFloorSqft}
                onChangeText={(kitchenFloorSqft) => setMeasurements((prev) => ({ ...prev, kitchenFloorSqft }))}
                placeholder="e.g. 180"
                Colors={Colors}
                darkMode={darkMode}
                applying={applying}
              />
              <QuickMeasurementField
                label="Backsplash sqft"
                value={measurements.backsplashSqft}
                onChangeText={(backsplashSqft) => setMeasurements((prev) => ({ ...prev, backsplashSqft }))}
                placeholder="e.g. 40"
                Colors={Colors}
                darkMode={darkMode}
                applying={applying}
              />
            </View>
          ) : null}
          {showLandscape ? (
            <QuickMeasurementField
              label="Landscape coverage sqft"
              value={measurements.landscapeSqft}
              onChangeText={(landscapeSqft) => setMeasurements((prev) => ({ ...prev, landscapeSqft }))}
              placeholder="e.g. 1200"
              Colors={Colors}
              darkMode={darkMode}
              applying={applying}
            />
          ) : null}
          {showRoof ? (
            <QuickMeasurementField
              label="Roof squares"
              value={measurements.roofSquares}
              onChangeText={(roofSquares) => setMeasurements((prev) => ({ ...prev, roofSquares }))}
              placeholder="e.g. 28"
              Colors={Colors}
              darkMode={darkMode}
              applying={applying}
            />
          ) : null}
          {showDrywall ? (
            <QuickMeasurementField
              label="Drywall sqft"
              value={measurements.drywallSqft}
              onChangeText={(drywallSqft) => setMeasurements((prev) => ({ ...prev, drywallSqft }))}
              placeholder="e.g. 800"
              Colors={Colors}
              darkMode={darkMode}
              applying={applying}
            />
          ) : null}
          {showPaint ? (
            <QuickMeasurementField
              label="Paint sqft"
              value={measurements.wallPaintSqft}
              onChangeText={(wallPaintSqft) => setMeasurements((prev) => ({ ...prev, wallPaintSqft }))}
              placeholder="e.g. 1500"
              Colors={Colors}
              darkMode={darkMode}
              applying={applying}
            />
          ) : null}
          {showConcrete ? (
            <View style={styles.measurementsRow}>
              <QuickMeasurementField
                label="Concrete sqft"
                value={measurements.concreteSqft}
                onChangeText={(concreteSqft) => setMeasurements((prev) => ({ ...prev, concreteSqft }))}
                placeholder="e.g. 400"
                Colors={Colors}
                darkMode={darkMode}
                applying={applying}
              />
              <QuickMeasurementField
                label="Concrete CY"
                value={measurements.concreteCy}
                onChangeText={(concreteCy) => setMeasurements((prev) => ({ ...prev, concreteCy }))}
                placeholder="e.g. 12"
                Colors={Colors}
                darkMode={darkMode}
                applying={applying}
              />
            </View>
          ) : null}
          {showExcavation ? (
            <QuickMeasurementField
              label="Excavation CY"
              value={measurements.excavationCy}
              onChangeText={(excavationCy) => setMeasurements((prev) => ({ ...prev, excavationCy }))}
              placeholder="e.g. 45"
              Colors={Colors}
              darkMode={darkMode}
              applying={applying}
            />
          ) : null}
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
  Colors,
  darkMode,
}: {
  title: string;
  items: ScopeChecklistItem[];
  collapsed: boolean;
  onToggle: () => void;
  renderItem: (item: ScopeChecklistItem) => React.ReactNode;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
}) {
  if (!items.length) return null;

  return (
    <View style={styles.groupSection}>
      {title ? (
        <TouchableOpacity
          style={[styles.groupHeader, { borderBottomColor: dividerColor(darkMode) }]}
          onPress={onToggle}
          activeOpacity={0.7}
        >
          <Text style={{ color: darkMode ? '#F5F7FA' : Colors.text, fontSize: 13, fontWeight: '800', flex: 1 }}>
            {title}
          </Text>
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
  const [items, setItems] = useState<ScopeChecklistItem[]>([]);
  const [measurements, setMeasurements] = useState<ScopeMeasurementsInputExtended>({
    bathroomFloorSqft: '',
    kitchenFloorSqft: '',
    backsplashSqft: '',
    landscapeSqft: '',
    roofSquares: '',
    drywallSqft: '',
    concreteSqft: '',
    concreteCy: '',
    excavationCy: '',
    baseboardLf: '',
    showerWallTileSqft: '',
    showerFloorTileSqft: '',
    wallPaintSqft: '',
    itemQuantities: {},
  });
  const [quickMeasurementsOpen, setQuickMeasurementsOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [customItemLabel, setCustomItemLabel] = useState('');
  const [showCustomItemInput, setShowCustomItemInput] = useState(false);
  const itemsRef = useRef(items);
  const measurementsRef = useRef(measurements);

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
      }),
    [draft?.confirmedAssumptions, draft?.scopeMeasurements, draft?.scopeChecklist?.items]
  );

  useEffect(() => {
    if (visible && checklist?.items?.length) {
      const sourceItems = scopeChecklistItemsForEditing(draft);
      if (!sourceItems.length) return;
      const normalized = normalizeScopeChecklistItems(sourceItems);
      const nextMeasurements = initialScopeMeasurementInputExtended(draft);
      setItems(normalized);
      setMeasurements(nextMeasurements);
      setQuickMeasurementsOpen(false);
      setCustomItemLabel('');
      setShowCustomItemInput(false);
      const grouped = groupScopeChecklistItems(
        expandWetAreaDerivedScopeItems(normalized),
        checklist.templateKey
      );
      setCollapsedGroups(initialScopeGroupCollapse(grouped, buildNormFromInput(nextMeasurements)));
    }
  }, [visible, draftScopeRestoreKey, checklist?.templateKey, draft]);

  useEffect(() => {
    if (visible || !onPersistProgress || applying) return;
    const currentItems = itemsRef.current;
    if (!currentItems.length) return;
    onPersistProgress(
      scopeChecklistItemsForPersist(currentItems),
      scopeMeasurementsToPayload(measurementsRef.current)
    );
  }, [visible, onPersistProgress, applying]);

  const displayItems = useMemo(() => expandWetAreaDerivedScopeItems(items), [items]);

  const normMeasurements = useMemo(
    () => buildNormFromInput(measurements),
    [measurements]
  );

  const pricingCounts = useMemo(
    () => countScopePricingReadiness(displayItems, normMeasurements),
    [displayItems, normMeasurements]
  );

  const summary = useMemo(
    () => scopeChecklistSummaryCounts(displayItems, pricingCounts.needsMeasurement),
    [displayItems, pricingCounts.needsMeasurement]
  );

  const groupedItems = useMemo(
    () => groupScopeChecklistItems(displayItems, checklist?.templateKey),
    [displayItems, checklist?.templateKey]
  );

  const handleItemQuantityChange = (itemId: string, quantity: string) => {
    const rule = CHECKLIST_ITEM_QUANTITY_RULES[itemId];
    setMeasurements((prev) => ({
      ...prev,
      itemQuantities: {
        ...prev.itemQuantities,
        [itemId]: { quantity, unit: rule?.defaultUnit || 'sqft' },
      },
    }));
  };

  const handleItemQuantityBlur = (itemId: string) => {
    setMeasurements((prev) => {
      const current = prev.itemQuantities[itemId];
      if (current?.quantity?.trim()) return prev;
      const itemQuantities = { ...prev.itemQuantities };
      delete itemQuantities[itemId];
      return { ...prev, itemQuantities };
    });
  };

  const renderItem = (item: ScopeChecklistItem) =>
    item.derivedFrom === 'wet_area_install' || WET_AREA_DERIVED_ITEM_IDS.has(item.id) ? (
      <WetAreaInstallLineCard
        item={item}
        measurementsInput={measurements}
        onItemQuantityChange={handleItemQuantityChange}
        onItemQuantityBlur={handleItemQuantityBlur}
        Colors={Colors}
        darkMode={darkMode}
        applying={applying}
      />
    ) : item.inputType === 'choice' && (item.options?.length ?? 0) > 0 ? (
      <ChoiceRow
        item={item}
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
        Colors={Colors}
        darkMode={darkMode}
        applying={applying}
      />
    ) : (
      <YesNoRow
        item={item}
        onSetState={(state) =>
          setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, state } : row)))
        }
        measurementsInput={measurements}
        onItemQuantityChange={handleItemQuantityChange}
        onItemQuantityBlur={handleItemQuantityBlur}
        Colors={Colors}
        darkMode={darkMode}
        applying={applying}
      />
    );

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
          { text: 'Enter missing measurements', style: 'cancel' },
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
        omitTopSafeArea
        disabled={applying}
        onBack={onBack}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 120 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={{
            color: captionColor(darkMode, Colors),
            fontSize: 12,
            marginTop: 4,
            marginBottom: 12,
            lineHeight: 17,
          }}
        >
          {summary.included} included · {summary.needsMeasurement} need measurements · {summary.unsure}{' '}
          not sure
        </Text>

        <CollapsibleQuickMeasurements
          expanded={quickMeasurementsOpen}
          onToggle={() => setQuickMeasurementsOpen((v) => !v)}
          measurements={measurements}
          setMeasurements={setMeasurements}
          templateKey={checklist?.templateKey}
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
          <TouchableOpacity onPress={handleMarkAllUnsureAsNo} disabled={applying} activeOpacity={0.7}>
            <Text style={{ color: Colors.sub, fontSize: 12, fontWeight: '700' }}>Mark all Not Sure as No</Text>
          </TouchableOpacity>
        </View>

        {showCustomItemInput ? (
          <View style={[styles.customItemRow, scopeCardStyle(Colors, darkMode)]}>
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
            Colors={Colors}
            darkMode={darkMode}
          />
        ))}
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
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onBack}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top', 'left', 'right']}>
        {body}
        <KeyboardPlainAccessory
          nativeID={KEYBOARD_ACCESSORY_IDS.aiScopeConfirmNumeric}
          backgroundColor={Colors.bg}
        />
      </SafeAreaView>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 12,
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
