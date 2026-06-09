import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  StatusBar,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
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
import { normalizeScopeChecklistItems } from '@/utils/estimateScopeChecklistUi';
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

type Props = {
  visible: boolean;
  draft: EstimateAiDraft | null;
  applying?: boolean;
  fromAssistant?: boolean;
  onBack: () => void;
  onClose: () => void;
  onConfirm: (items: ScopeChecklistItem[], measurements?: ScopeMeasurements) => void;
  onScopeOnly?: (measurements?: ScopeMeasurements) => void;
};

function hapticTap() {
  if (Platform.OS !== 'web') {
    Haptics.selectionAsync();
  }
}

function QuantitySection({
  itemId,
  inScope,
  measurementsInput,
  onItemQuantityChange,
  Colors,
  darkMode,
  applying,
}: {
  itemId: string;
  inScope: boolean;
  measurementsInput: ScopeMeasurementsInputExtended;
  onItemQuantityChange: (itemId: string, quantity: string) => void;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  applying: boolean;
}) {
  if (!inScope || !CHECKLIST_ITEM_QUANTITY_RULES[itemId]) return null;

  const norm = normalizeScopeMeasurements({
    bathroomFloorSqft: parseFloat(measurementsInput.bathroomFloorSqft) || null,
    baseboardLf: parseFloat(measurementsInput.baseboardLf) || null,
    showerWallTileSqft: parseFloat(measurementsInput.showerWallTileSqft) || null,
    wallPaintSqft: parseFloat(measurementsInput.wallPaintSqft) || null,
    itemQuantities: Object.fromEntries(
      Object.entries(measurementsInput.itemQuantities).map(([id, v]) => [
        id,
        { quantity: parseFloat(v.quantity) || null, unit: v.unit },
      ])
    ),
  });

  const resolved = resolveChecklistItemQuantity(itemId, norm);
  const rule = CHECKLIST_ITEM_QUANTITY_RULES[itemId];
  const itemInput = measurementsInput.itemQuantities[itemId];
  const editing = Boolean(itemInput?.quantity);
  const fieldBg = darkMode ? 'rgba(255,255,255,0.06)' : '#eef2f6';
  const fieldBorder = darkMode ? 'rgba(255,255,255,0.1)' : Colors.line;
  const placeholderColor = darkMode ? '#64748b' : '#94a3b8';

  const quantityDisplay =
    resolved.pricingReady && resolved.quantity != null
      ? `${resolved.quantity.toLocaleString()} ${formatUnitLabel(resolved.unit)}`
      : resolved.missingMessage || `Needs ${formatUnitLabel(rule.defaultUnit)}`;

  return (
    <View style={[styles.qtySection, { borderTopColor: darkMode ? 'rgba(255,255,255,0.06)' : Colors.line }]}>
      <View style={styles.qtyRow}>
        <Text style={{ color: Colors.sub, fontSize: 11, fontWeight: '700' }}>Quantity</Text>
        <Text
          style={{
            color: resolved.pricingReady ? Colors.text : '#fbbf24',
            fontSize: 12,
            fontWeight: '700',
          }}
        >
          {quantityDisplay}
        </Text>
      </View>
      <View style={styles.qtyRow}>
        <Text style={{ color: Colors.sub, fontSize: 11, fontWeight: '700' }}>Source</Text>
        <Text style={{ color: Colors.sub, fontSize: 11 }}>{resolved.sourceLabel}</Text>
      </View>
      {resolved.quantityHelper && !editing ? (
        <Text style={{ color: Colors.sub, fontSize: 10, lineHeight: 14, marginTop: 2 }}>
          {resolved.quantityHelper}
        </Text>
      ) : null}
      {resolved.showInput && (!resolved.pricingReady || editing) ? (
        <View style={styles.qtyInputRow}>
          <TextInput
            value={itemInput?.quantity ?? ''}
            onChangeText={(text) => onItemQuantityChange(itemId, text)}
            placeholder={`Enter ${formatUnitLabel(rule.defaultUnit)}`}
            placeholderTextColor={placeholderColor}
            keyboardType="decimal-pad"
            editable={!applying}
            style={[
              styles.qtyInput,
              {
                color: Colors.text,
                borderColor: fieldBorder,
                backgroundColor: fieldBg,
              },
            ]}
          />
          <Text style={{ color: Colors.sub, fontSize: 12, fontWeight: '600', minWidth: 48 }}>
            {formatUnitLabel(rule.defaultUnit)}
          </Text>
        </View>
      ) : resolved.showInput && resolved.pricingReady ? (
        <TouchableOpacity
          onPress={() => onItemQuantityChange(itemId, String(resolved.quantity ?? ''))}
          activeOpacity={0.7}
        >
          <Text style={{ color: '#22c55e', fontSize: 11, fontWeight: '600', marginTop: 4 }}>
            Edit quantity
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function YesNoRow({
  item,
  onSetState,
  measurementsInput,
  onItemQuantityChange,
  Colors,
  darkMode,
  applying,
}: {
  item: ScopeChecklistItem;
  onSetState: (state: ScopeAssumptionState) => void;
  measurementsInput: ScopeMeasurementsInputExtended;
  onItemQuantityChange: (itemId: string, quantity: string) => void;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  applying: boolean;
}) {
  const options: { state: ScopeAssumptionState; label: string; color: string }[] = [
    { state: 'included', label: 'Yes', color: '#22c55e' },
    { state: 'excluded', label: 'No', color: darkMode ? '#f87171' : '#ef4444' },
    { state: 'unsure', label: 'Not sure', color: '#fbbf24' },
  ];

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
      <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700', lineHeight: 20 }}>
        {item.label}
      </Text>
      {item.helperText ? (
        <Text style={{ color: Colors.sub, fontSize: 12, marginTop: 4, lineHeight: 17 }}>
          {item.helperText}
        </Text>
      ) : null}
      <View style={styles.choiceRow}>
        {options.map((opt) => {
          const active = item.state === opt.state;
          return (
            <TouchableOpacity
              key={opt.state}
              activeOpacity={0.88}
              onPress={() => {
                hapticTap();
                onSetState(opt.state);
              }}
              style={[
                styles.choiceChip,
                {
                  borderColor: active ? opt.color : Colors.line,
                  backgroundColor: active ? `${opt.color}20` : 'transparent',
                },
              ]}
            >
              <Text
                style={{
                  color: active ? opt.color : Colors.sub,
                  fontSize: 12,
                  fontWeight: active ? '800' : '600',
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
        inScope={item.state === 'included'}
        measurementsInput={measurementsInput}
        onItemQuantityChange={onItemQuantityChange}
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
  Colors,
  darkMode,
  applying,
}: {
  item: ScopeChecklistItem;
  onSelect: (choiceId: string) => void;
  measurementsInput: ScopeMeasurementsInputExtended;
  onItemQuantityChange: (itemId: string, quantity: string) => void;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  applying: boolean;
}) {
  const inScope = Boolean(item.choiceId && item.choiceId !== 'not_in_scope' && item.choiceId !== 'unsure');

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
      <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700', lineHeight: 20 }}>
        {item.label}
      </Text>
      {item.helperText ? (
        <Text style={{ color: Colors.sub, fontSize: 12, marginTop: 4, lineHeight: 17 }}>
          {item.helperText}
        </Text>
      ) : null}
      <View style={styles.choiceWrap}>
        {(item.options || []).map((opt) => {
          const active = item.choiceId === opt.id;
          const color =
            opt.id === 'not_in_scope'
              ? darkMode
                ? '#f87171'
                : '#ef4444'
              : opt.id === 'unsure'
                ? '#fbbf24'
                : '#60a5fa';
          return (
            <TouchableOpacity
              key={opt.id}
              activeOpacity={0.88}
              onPress={() => {
                hapticTap();
                onSelect(opt.id);
              }}
              style={[
                styles.choiceChipWide,
                {
                  borderColor: active ? color : Colors.line,
                  backgroundColor: active ? `${color}18` : 'transparent',
                },
              ]}
            >
              <Text
                style={{
                  color: active ? color : Colors.sub,
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
        measurementsInput={measurementsInput}
        onItemQuantityChange={onItemQuantityChange}
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

function RoomMeasurementField({
  label,
  hint,
  value,
  onChangeText,
  placeholder,
  Colors,
  darkMode,
  applying,
}: {
  label: string;
  hint?: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  applying: boolean;
}) {
  const fieldBg = darkMode ? 'rgba(255,255,255,0.06)' : '#eef2f6';
  const fieldBorder = darkMode ? 'rgba(255,255,255,0.1)' : Colors.line;
  const placeholderColor = darkMode ? '#64748b' : '#94a3b8';

  return (
    <View style={styles.measurementField}>
      <Text style={[styles.measurementLabel, { color: Colors.sub }]}>{label}</Text>
      {hint ? (
        <Text style={{ color: Colors.sub, fontSize: 10, marginBottom: 4, lineHeight: 13 }}>{hint}</Text>
      ) : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={placeholderColor}
        keyboardType="decimal-pad"
        editable={!applying}
        style={[
          styles.measurementInput,
          { color: Colors.text, borderColor: fieldBorder, backgroundColor: fieldBg },
        ]}
      />
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
}: Props) {
  const insets = useSafeAreaInsets();
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const checklist = draft?.scopeChecklist;
  const [items, setItems] = useState<ScopeChecklistItem[]>([]);
  const [measurements, setMeasurements] = useState<ScopeMeasurementsInputExtended>({
    bathroomFloorSqft: '',
    baseboardLf: '',
    showerWallTileSqft: '',
    wallPaintSqft: '',
    itemQuantities: {},
  });

  useEffect(() => {
    if (visible && checklist?.items?.length) {
      setItems(normalizeScopeChecklistItems(checklist.items.map((i) => ({ ...i }))));
      setMeasurements(initialScopeMeasurementInputExtended(draft));
    } else if (!visible) {
      setItems([]);
      setMeasurements({
        bathroomFloorSqft: '',
        baseboardLf: '',
        showerWallTileSqft: '',
        wallPaintSqft: '',
        itemQuantities: {},
      });
    }
  }, [visible, checklist, draft]);

  const normMeasurements = useMemo(() => {
    return normalizeScopeMeasurements(scopeMeasurementsToPayload(measurements));
  }, [measurements]);

  const pricingCounts = useMemo(
    () => countScopePricingReadiness(items, normMeasurements),
    [items, normMeasurements]
  );

  const inScopeCount = items.filter((i) => i.state === 'included').length;
  const unsureCount = items.filter((i) => i.state === 'unsure').length;
  const outOfScopeCount = items.filter((i) => i.state === 'excluded').length;

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

  const handleConfirm = () => {
    if (applying || items.length === 0) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onConfirm(items, scopeMeasurementsToPayload(measurements));
  };

  if (!visible || !draft || !checklist) return null;

  const legend =
    checklist.legend ||
    'Yes/No rows = is this work in your bid? Fixture rows (tub, toilet, vanity) = pick one option. Not sure = we will not auto-price it.';

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
      >
        <View
          style={[
            styles.measurementsCard,
            {
              borderColor: darkMode ? 'rgba(34,197,94,0.35)' : 'rgba(34,197,94,0.45)',
              backgroundColor: darkMode ? 'rgba(34,197,94,0.06)' : 'rgba(34,197,94,0.04)',
            },
          ]}
        >
          <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '800', marginBottom: 4 }}>
            Room measurements
          </Text>
          <Text style={{ color: Colors.sub, fontSize: 12, lineHeight: 17, marginBottom: 12 }}>
            Floor sqft applies to floor tile and demo only — not every line item. Add shower and paint
            areas separately.
          </Text>
          <View style={styles.measurementsRow}>
            <RoomMeasurementField
              label="FLOOR SQFT"
              hint="Bathroom floor area"
              value={measurements.bathroomFloorSqft}
              onChangeText={(bathroomFloorSqft) =>
                setMeasurements((prev) => ({ ...prev, bathroomFloorSqft }))
              }
              placeholder="e.g. 90"
              Colors={Colors}
              darkMode={darkMode}
              applying={applying}
            />
            <RoomMeasurementField
              label="BASEBOARD LF"
              value={measurements.baseboardLf}
              onChangeText={(baseboardLf) => setMeasurements((prev) => ({ ...prev, baseboardLf }))}
              placeholder="e.g. 24"
              Colors={Colors}
              darkMode={darkMode}
              applying={applying}
            />
          </View>
          <View style={[styles.measurementsRow, { marginTop: 10 }]}>
            <RoomMeasurementField
              label="SHOWER WALL SQFT"
              hint="Shower tile & waterproofing"
              value={measurements.showerWallTileSqft}
              onChangeText={(showerWallTileSqft) =>
                setMeasurements((prev) => ({ ...prev, showerWallTileSqft }))
              }
              placeholder="e.g. 90"
              Colors={Colors}
              darkMode={darkMode}
              applying={applying}
            />
            <RoomMeasurementField
              label="WALL PAINT SQFT"
              hint="Walls + ceiling paint area"
              value={measurements.wallPaintSqft}
              onChangeText={(wallPaintSqft) => setMeasurements((prev) => ({ ...prev, wallPaintSqft }))}
              placeholder="e.g. 175"
              Colors={Colors}
              darkMode={darkMode}
              applying={applying}
            />
          </View>
          {pricingCounts.ready > 0 || pricingCounts.needsMeasurement > 0 ? (
            <Text style={{ color: Colors.sub, fontSize: 11, marginTop: 10, lineHeight: 16 }}>
              {pricingCounts.ready} ready for pricing · {pricingCounts.needsMeasurement} need measurements
            </Text>
          ) : null}
        </View>

        <View
          style={[
            styles.banner,
            {
              borderColor: darkMode ? 'rgba(251,191,36,0.35)' : 'rgba(251,191,36,0.45)',
              backgroundColor: darkMode ? 'rgba(251,191,36,0.08)' : 'rgba(251,191,36,0.06)',
            },
          ]}
        >
          <MaterialIcons name="fact-check" size={20} color="#fbbf24" />
          <View style={{ flex: 1 }}>
            <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '800', marginBottom: 4 }}>
              {checklist.title}
            </Text>
            <Text style={{ color: Colors.sub, fontSize: 13, lineHeight: 18 }}>{checklist.intro}</Text>
          </View>
        </View>

        <View
          style={[
            styles.legendBox,
            {
              borderColor: darkMode ? 'rgba(96,165,250,0.25)' : Colors.line,
              backgroundColor: darkMode ? 'rgba(96,165,250,0.06)' : 'rgba(59,130,246,0.05)',
            },
          ]}
        >
          <Text style={{ color: Colors.sub, fontSize: 12, lineHeight: 17 }}>{legend}</Text>
        </View>

        <Text style={{ color: Colors.sub, fontSize: 12, marginBottom: 12 }}>
          {inScopeCount} in scope · {unsureCount} not sure · {outOfScopeCount} out of scope
        </Text>

        {items.map((item) =>
          item.inputType === 'choice' && (item.options?.length ?? 0) > 0 ? (
            <ChoiceRow
              key={item.id}
              item={item}
              onSelect={(choiceId) =>
                setItems((prev) =>
                  prev.map((row) =>
                    row.id === item.id
                      ? { ...row, choiceId, state: choiceIdToState(choiceId) }
                      : row
                  )
                )
              }
              measurementsInput={measurements}
              onItemQuantityChange={handleItemQuantityChange}
              Colors={Colors}
              darkMode={darkMode}
              applying={applying}
            />
          ) : (
            <YesNoRow
              key={item.id}
              item={item}
              onSetState={(state) =>
                setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, state } : row)))
              }
              measurementsInput={measurements}
              onItemQuantityChange={handleItemQuantityChange}
              Colors={Colors}
              darkMode={darkMode}
              applying={applying}
            />
          )
        )}
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom, 16),
            backgroundColor: Colors.bg,
            borderTopColor: darkMode ? 'rgba(255,255,255,0.1)' : Colors.line,
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
              Build scope only (skip pricing for now)
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
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  measurementsCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    marginTop: 4,
  },
  measurementsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  measurementField: {
    flex: 1,
  },
  measurementLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  measurementInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '600',
  },
  banner: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    marginTop: 4,
  },
  legendBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  card: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
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
  qtyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  qtyInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
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
