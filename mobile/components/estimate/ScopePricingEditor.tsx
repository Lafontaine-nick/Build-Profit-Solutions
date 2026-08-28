import React, { startTransition, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Typography } from '@/constants/Typography';
import { formatDraftMoney } from '@/utils/estimateAiDraft';
import type { ScopePackageBudgetBreakdown } from '@/utils/estimateDraftReviewUi';
import {
  formatCountFieldSuffix,
  formatUnitLabel,
} from '@/utils/scopeItemQuantities';

type ScopePricingColors = {
  text: string;
  sub: string;
  line: string;
  surface2: string;
};

export type PricingEntryMode = 'flat' | 'takeoff';

const scopeNumericInputProps = {
  textContentType: 'none' as const,
  autoComplete: 'off' as const,
};

function inputShellStyle(Colors: ScopePricingColors, darkMode: boolean) {
  return {
    backgroundColor: darkMode ? 'rgba(255,255,255,0.05)' : Colors.surface2,
    borderColor: darkMode ? 'rgba(148, 163, 184, 0.16)' : Colors.line,
  };
}

function captionColor(darkMode: boolean, Colors: ScopePricingColors) {
  return darkMode ? 'rgba(255,255,255,0.62)' : Colors.sub;
}

export function parsePricingMoneyAmount(
  value: string | number | null | undefined
): number {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function roundMoney2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function pricingEditorHelperForMode(
  mode: PricingEntryMode,
  fallback?: string | null
): string {
  if (mode === 'flat') {
    return 'Enter material and labor totals — no takeoff quantity required.';
  }
  return (
    fallback ||
    'Enter takeoff quantity, then material and labor (flat $ or per-unit).'
  );
}

function unitRateHelper(
  amountValue: string | undefined,
  basis: { quantity: number; unit: string } | null | undefined
): string | null {
  const amount = Number(String(amountValue || '').replace(/,/g, ''));
  if (!basis || !Number.isFinite(amount) || amount <= 0 || basis.quantity <= 0) {
    return null;
  }
  const rate = Math.round((amount / basis.quantity) * 100) / 100;
  return `${formatDraftMoney(rate)} / ${formatUnitLabel(basis.unit)}`;
}

export function PricingEditorPanel({
  children,
  Colors,
  darkMode,
}: {
  children: React.ReactNode;
  Colors: ScopePricingColors;
  darkMode: boolean;
}) {
  const shell = inputShellStyle(Colors, darkMode);
  return (
    <View
      style={[
        styles.pricingEditorPanel,
        {
          borderColor: shell.borderColor,
          backgroundColor: darkMode ? 'rgba(255,255,255,0.045)' : Colors.surface2,
        },
      ]}
    >
      {children}
    </View>
  );
}

export function PricingEditorHeader({
  helper,
  onDone,
  Colors,
  darkMode,
}: {
  helper?: string | null;
  onDone: () => void;
  Colors: ScopePricingColors;
  darkMode: boolean;
}) {
  return (
    <View style={styles.pricingEditorPanelHeader}>
      <Text
        style={[styles.pricingEditorHelper, { color: captionColor(darkMode, Colors) }]}
        numberOfLines={2}
      >
        {helper || 'Enter pricing for this scope item.'}
      </Text>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => {
          Keyboard.dismiss();
          onDone();
        }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel="Done editing"
        style={styles.pricingEditorDoneBtn}
      >
        <Text style={styles.pricingEditorDoneBtnText}>Done</Text>
      </TouchableOpacity>
    </View>
  );
}

function PricingMatLabRow({
  material,
  labor,
}: {
  material: React.ReactNode;
  labor: React.ReactNode;
}) {
  return (
    <View style={styles.pricingMatLabRow}>
      <View style={styles.pricingMatLabCol}>{material}</View>
      <View style={styles.pricingMatLabCol}>{labor}</View>
    </View>
  );
}

export function PricingEntryModeToggle({
  mode,
  onChange,
  Colors,
  darkMode,
  applying,
}: {
  mode: PricingEntryMode;
  onChange: (next: PricingEntryMode) => void;
  Colors: ScopePricingColors;
  darkMode: boolean;
  applying: boolean;
}) {
  return (
    <View style={styles.customPricingModeLinks}>
      {(
        [
          { id: 'flat' as const, label: 'Flat mat + lab' },
          { id: 'takeoff' as const, label: 'By takeoff' },
        ] as const
      ).map(opt => {
        const active = mode === opt.id;
        return (
          <TouchableOpacity
            key={opt.id}
            activeOpacity={0.75}
            disabled={applying || active}
            onPress={() => onChange(opt.id)}
            style={[
              styles.customPricingModeChip,
              styles.pricingEntryModeChip,
              {
                borderColor: active
                  ? '#22c55e'
                  : darkMode
                    ? 'rgba(148, 163, 184, 0.24)'
                    : Colors.line,
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
                color: active
                  ? '#22c55e'
                  : darkMode
                    ? 'rgba(255,255,255,0.72)'
                    : Colors.sub,
                fontSize: 11,
                fontWeight: '700',
              }}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function PricingRateModeToggle({
  mode,
  onChange,
  unitLabel,
  Colors,
  darkMode,
  applying,
}: {
  mode: 'total' | 'rate';
  onChange: (next: 'total' | 'rate') => void;
  unitLabel: string;
  Colors: ScopePricingColors;
  darkMode: boolean;
  applying: boolean;
}) {
  const rateLabel = `$/${unitLabel}`;
  const options = [
    { id: 'total' as const, label: 'Total' },
    { id: 'rate' as const, label: rateLabel },
  ];
  return (
    <View
      style={styles.pricingRateModeToggleRow}
      accessibilityRole="tablist"
      accessibilityLabel="Material or labor entry mode"
    >
      {options.map(opt => {
        const active = mode === opt.id;
        return (
          <TouchableOpacity
            key={opt.id}
            activeOpacity={0.75}
            disabled={applying}
            onPress={() => onChange(opt.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[
              styles.pricingRateModeChip,
              {
                borderColor: active
                  ? '#22c55e'
                  : darkMode
                    ? 'rgba(148, 163, 184, 0.24)'
                    : Colors.line,
                backgroundColor: active
                  ? darkMode
                    ? 'rgba(34, 197, 94, 0.12)'
                    : 'rgba(22, 163, 74, 0.08)'
                  : 'transparent',
              },
            ]}
          >
            <Text
              style={{
                color: active
                  ? '#22c55e'
                  : darkMode
                    ? 'rgba(255,255,255,0.72)'
                    : Colors.sub,
                fontSize: 10,
                fontWeight: '700',
              }}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function PricingInputField({
  label,
  value,
  helper,
  basis,
  prefix,
  suffix,
  placeholder = '0',
  defaultInputMode = 'total',
  inputMode: controlledInputMode,
  onInputModeChange,
  hideRateModeToggle = false,
  onFocus,
  onChangeText,
  onBlur,
  Colors,
  darkMode,
  applying,
  embedded = false,
  readOnly = false,
}: {
  label: string;
  value: string;
  helper?: string | null;
  basis?: { quantity: number; unit: string } | null;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
  defaultInputMode?: 'total' | 'rate';
  inputMode?: 'total' | 'rate';
  onInputModeChange?: (mode: 'total' | 'rate') => void;
  hideRateModeToggle?: boolean;
  onFocus: () => void;
  onChangeText: (text: string) => void;
  onBlur: () => void;
  Colors: ScopePricingColors;
  darkMode: boolean;
  applying: boolean;
  embedded?: boolean;
  readOnly?: boolean;
}) {
  const [internalInputMode, setInternalInputMode] = useState<'total' | 'rate'>(defaultInputMode);
  const inputMode = controlledInputMode ?? internalInputMode;
  const setInputMode = (next: 'total' | 'rate') => {
    onInputModeChange?.(next);
    if (controlledInputMode == null) setInternalInputMode(next);
  };
  const [rateDraft, setRateDraft] = useState('');
  const [rateEditing, setRateEditing] = useState(false);
  const inputShell = inputShellStyle(Colors, darkMode);
  const placeholderColor = darkMode ? 'rgba(255,255,255,0.35)' : '#94a3b8';
  const supportsRateMode = Boolean(basis?.quantity && basis.quantity > 0) && !readOnly;
  const amount = Number(String(value || '').replace(/,/g, ''));
  const rateValue =
    supportsRateMode && Number.isFinite(amount) && amount > 0
      ? String(Math.round((amount / basis!.quantity) * 100) / 100)
      : '';
  const displayValue = inputMode === 'rate' ? (rateEditing ? rateDraft : rateValue) : value;
  const activePrefix = inputMode === 'rate' ? '$' : prefix;
  const activeSuffix =
    inputMode === 'rate' && basis ? `/${formatUnitLabel(basis.unit)}` : suffix;
  const helperText =
    inputMode === 'rate' && Number.isFinite(amount) && amount > 0
      ? `Total ${formatDraftMoney(amount)}`
      : helper;
  const unitLabel = basis ? formatUnitLabel(basis.unit) : 'unit';
  const fieldPlaceholder =
    supportsRateMode && inputMode === 'rate'
      ? `$/${unitLabel}`
      : supportsRateMode
        ? '0'
        : placeholder;
  const isEmptyValue = !String(displayValue || '').trim();

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
    <View style={embedded ? styles.pricingInputEmbedded : styles.pricingInputEmbedded}>
      <View style={styles.pricingInputHeader}>
        <Text
          style={{
            color: embedded
              ? darkMode
                ? 'rgba(255,255,255,0.72)'
                : Colors.sub
              : Colors.sub,
            fontSize: embedded ? 11 : 12,
            fontWeight: '700',
            flex: hideRateModeToggle ? 1 : undefined,
            flexShrink: 1,
          }}
        >
          {label}
        </Text>
        {supportsRateMode && !hideRateModeToggle ? (
          <PricingRateModeToggle
            mode={inputMode}
            onChange={next => {
              setRateEditing(false);
              setInputMode(next);
            }}
            unitLabel={unitLabel}
            Colors={Colors}
            darkMode={darkMode}
            applying={applying}
          />
        ) : null}
      </View>
      <View
        style={[
          styles.pricingInputRow,
          styles.pricingInputRowEmbedded,
          {
            borderColor: inputShell.borderColor,
            backgroundColor: inputShell.backgroundColor,
            justifyContent: isEmptyValue ? 'center' : 'flex-start',
          },
        ]}
      >
        {activePrefix ? (
          <Text
            style={[
              styles.pricingCurrencyPrefix,
              { color: isEmptyValue ? placeholderColor : Colors.text },
            ]}
          >
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
          placeholder={fieldPlaceholder}
          placeholderTextColor={placeholderColor}
          keyboardType="decimal-pad"
          {...scopeNumericInputProps}
          editable={!applying && !readOnly}
          style={[
            activePrefix ? styles.pricingInputPrefixed : styles.pricingInput,
            { color: isEmptyValue ? placeholderColor : Colors.text },
          ]}
        />
        {activeSuffix ? (
          <Text
            style={{
              color: Colors.sub,
              fontSize: 12,
              fontWeight: '600',
              minWidth: embedded ? 28 : 40,
              lineHeight: 20,
              ...(Platform.OS === 'android'
                ? {
                    includeFontPadding: false,
                    textAlignVertical: 'center' as const,
                  }
                : null),
            }}
          >
            {activeSuffix}
          </Text>
        ) : null}
      </View>
      {helperText ? (
        <Text
          style={{
            color: darkMode ? 'rgba(148, 163, 184, 0.9)' : '#64748b',
            fontSize: 10,
            fontWeight: '600',
            marginTop: 4,
            lineHeight: 14,
          }}
        >
          {helperText}
        </Text>
      ) : null}
    </View>
  );
}

function inferDraftPricingEntryMode(
  breakdown: ScopePackageBudgetBreakdown
): PricingEntryMode {
  const qty = Number(breakdown.basis?.quantity) || 0;
  return qty > 0 ? 'takeoff' : 'flat';
}

function ScopeDraftSplitPricingEditor({
  packageName,
  breakdown,
  entryMode,
  Colors,
  darkMode,
  busy,
  onUpdateScopeBudgetSplit,
  onLiveSplitChange,
}: {
  packageName: string;
  breakdown: ScopePackageBudgetBreakdown;
  entryMode: PricingEntryMode;
  Colors: ScopePricingColors;
  darkMode: boolean;
  busy: boolean;
  onUpdateScopeBudgetSplit: (
    packageName: string,
    material: number,
    labor: number,
    basis?: ScopePackageBudgetBreakdown['basis']
  ) => void;
  onLiveSplitChange?: (material: number, labor: number) => void;
}) {
  const basisUnit = breakdown.basis?.unit || 'sqft';
  const basisUnitLabel = formatUnitLabel(basisUnit);
  const [materialValue, setMaterialValue] = useState(
    breakdown.material > 0 ? String(breakdown.material) : ''
  );
  const [laborValue, setLaborValue] = useState(
    breakdown.labor > 0 ? String(breakdown.labor) : ''
  );
  const [pricingBasisValue, setPricingBasisValue] = useState(
    breakdown.basis?.quantity ? String(breakdown.basis.quantity) : ''
  );
  const [basisFocused, setBasisFocused] = useState(false);
  const [basisDraft, setBasisDraft] = useState(pricingBasisValue);
  const [matLabInputMode, setMatLabInputMode] = useState<'total' | 'rate'>('total');
  const lockedRatesRef = useRef<{ material: number | null; labor: number | null }>({
    material: null,
    labor: null,
  });
  const lastBasisQtyRef = useRef<number | null>(
    breakdown.basis?.quantity ? Number(breakdown.basis.quantity) : null
  );

  useEffect(() => {
    if (!basisFocused) {
      setBasisDraft(pricingBasisValue);
    }
  }, [pricingBasisValue, basisFocused]);

  const effectiveBasisQty =
    parsePricingMoneyAmount(basisFocused ? basisDraft : pricingBasisValue) ||
    (breakdown.basis?.quantity && breakdown.basis.quantity > 0
      ? breakdown.basis.quantity
      : 0);

  const currentBasis =
    effectiveBasisQty > 0
      ? { quantity: effectiveBasisQty, unit: basisUnit }
      : breakdown.basis ?? undefined;

  const publishSplit = (
    nextMaterialValue: string,
    nextLaborValue: string,
    basis = currentBasis
  ) => {
    const material = parsePricingMoneyAmount(nextMaterialValue);
    const labor = parsePricingMoneyAmount(nextLaborValue);
    onLiveSplitChange?.(material, labor);
    startTransition(() => {
      onUpdateScopeBudgetSplit(packageName, material, labor, basis);
    });
  };

  const handleMaterialChange = (text: string) => {
    setMaterialValue(text);
    const amount = parsePricingMoneyAmount(text);
    if (effectiveBasisQty > 0 && amount > 0) {
      lockedRatesRef.current.material = roundMoney2(amount / effectiveBasisQty);
    } else if (!text.trim()) {
      lockedRatesRef.current.material = null;
    }
    publishSplit(text, laborValue);
  };

  const handleLaborChange = (text: string) => {
    setLaborValue(text);
    const amount = parsePricingMoneyAmount(text);
    if (effectiveBasisQty > 0 && amount > 0) {
      lockedRatesRef.current.labor = roundMoney2(amount / effectiveBasisQty);
    } else if (!text.trim()) {
      lockedRatesRef.current.labor = null;
    }
    publishSplit(materialValue, text);
  };

  const handleBasisChange = (text: string) => {
    const nextQty = parsePricingMoneyAmount(text);
    const prevQty = lastBasisQtyRef.current ?? effectiveBasisQty;
    setPricingBasisValue(text);

    if (!(nextQty > 0)) {
      lastBasisQtyRef.current = null;
      publishSplit('', '', undefined);
      setMaterialValue('');
      setLaborValue('');
      return;
    }

    let nextMaterialValue = materialValue;
    let nextLaborValue = laborValue;
    const materialRate =
      lockedRatesRef.current.material ??
      (prevQty > 0 && parsePricingMoneyAmount(materialValue) > 0
        ? roundMoney2(parsePricingMoneyAmount(materialValue) / prevQty)
        : null);
    const laborRate =
      lockedRatesRef.current.labor ??
      (prevQty > 0 && parsePricingMoneyAmount(laborValue) > 0
        ? roundMoney2(parsePricingMoneyAmount(laborValue) / prevQty)
        : null);

    if (materialRate != null && materialRate > 0) {
      nextMaterialValue = String(roundMoney2(materialRate * nextQty));
      lockedRatesRef.current.material = materialRate;
      setMaterialValue(nextMaterialValue);
    }
    if (laborRate != null && laborRate > 0) {
      nextLaborValue = String(roundMoney2(laborRate * nextQty));
      lockedRatesRef.current.labor = laborRate;
      setLaborValue(nextLaborValue);
    }
    lastBasisQtyRef.current = nextQty;
    publishSplit(nextMaterialValue, nextLaborValue, {
      quantity: nextQty,
      unit: basisUnit,
    });
  };

  const splitTotal = (() => {
    const materialNumber = parsePricingMoneyAmount(materialValue);
    const laborNumber = parsePricingMoneyAmount(laborValue);
    const total = materialNumber + laborNumber;
    return total > 0 ? total : null;
  })();

  const editorBasis =
    entryMode === 'takeoff' && effectiveBasisQty > 0 && !basisFocused
      ? { quantity: effectiveBasisQty, unit: basisUnit }
      : null;
  const showTakeoffBasis = entryMode === 'takeoff';
  const sharedMatLabRateMode = Boolean(editorBasis?.quantity && editorBasis.quantity > 0);
  const basisFieldLabel = basisUnit === 'sqft' ? 'Area (sqft)' : `Quantity (${basisUnitLabel})`;

  return (
    <>
      {showTakeoffBasis ? (
        <PricingInputField
          label={basisFieldLabel}
          value={basisFocused ? basisDraft : pricingBasisValue}
          suffix={formatCountFieldSuffix(basisUnit) ?? undefined}
          placeholder={
            breakdown.basis?.quantity
              ? String(breakdown.basis.quantity)
              : `Enter ${basisUnitLabel}`
          }
          embedded
          onFocus={() => {
            setBasisFocused(true);
            setBasisDraft(pricingBasisValue);
          }}
          onChangeText={text => {
            setBasisDraft(text);
          }}
          onBlur={() => {
            setBasisFocused(false);
            handleBasisChange(basisDraft);
          }}
          Colors={Colors}
          darkMode={darkMode}
          applying={busy}
        />
      ) : null}
      {sharedMatLabRateMode ? (
        <View style={styles.pricingMatLabModeRow}>
          <Text
            style={{
              color: captionColor(darkMode, Colors),
              fontSize: 11,
              fontWeight: '600',
              flex: 1,
              flexShrink: 1,
              paddingRight: 8,
            }}
          >
            Material & labor pricing
          </Text>
          <PricingRateModeToggle
            mode={matLabInputMode}
            onChange={setMatLabInputMode}
            unitLabel={basisUnitLabel}
            Colors={Colors}
            darkMode={darkMode}
            applying={busy}
          />
        </View>
      ) : null}
      <PricingMatLabRow
        material={
          <PricingInputField
            label="Material"
            value={materialValue}
            helper={unitRateHelper(materialValue, editorBasis)}
            basis={editorBasis}
            prefix="$"
            placeholder={editorBasis ? `$/${basisUnitLabel}` : '0'}
            defaultInputMode="total"
            inputMode={sharedMatLabRateMode ? matLabInputMode : undefined}
            onInputModeChange={sharedMatLabRateMode ? setMatLabInputMode : undefined}
            hideRateModeToggle={sharedMatLabRateMode}
            embedded
            onFocus={() => {}}
            onChangeText={handleMaterialChange}
            onBlur={() => {}}
            Colors={Colors}
            darkMode={darkMode}
            applying={busy}
          />
        }
        labor={
          <PricingInputField
            label="Labor"
            value={laborValue}
            helper={unitRateHelper(laborValue, editorBasis)}
            basis={editorBasis}
            prefix="$"
            placeholder={editorBasis ? `$/${basisUnitLabel}` : '0'}
            defaultInputMode="total"
            inputMode={sharedMatLabRateMode ? matLabInputMode : undefined}
            onInputModeChange={sharedMatLabRateMode ? setMatLabInputMode : undefined}
            hideRateModeToggle={sharedMatLabRateMode}
            embedded
            onFocus={() => {}}
            onChangeText={handleLaborChange}
            onBlur={() => {}}
            Colors={Colors}
            darkMode={darkMode}
            applying={busy}
          />
        }
      />
      {splitTotal ? (
        <View style={styles.pricingEditorTotalRow}>
          <Text
            style={{
              color: captionColor(darkMode, Colors),
              fontSize: 12,
              fontWeight: '600',
            }}
          >
            Total
          </Text>
          <Text
            style={{
              color: darkMode ? '#F5F7FA' : Colors.text,
              fontSize: 15,
              fontWeight: '800',
            }}
          >
            {formatDraftMoney(splitTotal)}
          </Text>
        </View>
      ) : null}
    </>
  );
}

export function Step3ScopePricingEditor({
  packageName,
  breakdown,
  Colors,
  darkMode,
  busy,
  onDone,
  onUpdateScopeBudgetSplit,
  onLiveSplitChange,
}: {
  packageName: string;
  breakdown: ScopePackageBudgetBreakdown;
  Colors: ScopePricingColors;
  darkMode: boolean;
  busy: boolean;
  onDone: () => void;
  onUpdateScopeBudgetSplit: (
    packageName: string,
    material: number,
    labor: number,
    basis?: ScopePackageBudgetBreakdown['basis']
  ) => void;
  onLiveSplitChange?: (material: number, labor: number) => void;
}) {
  const [entryMode, setEntryMode] = useState<PricingEntryMode>(() =>
    inferDraftPricingEntryMode(breakdown)
  );

  return (
    <PricingEditorPanel Colors={Colors} darkMode={darkMode}>
      <PricingEditorHeader
        helper={pricingEditorHelperForMode(entryMode)}
        onDone={onDone}
        Colors={Colors}
        darkMode={darkMode}
      />
      <PricingEntryModeToggle
        mode={entryMode}
        onChange={setEntryMode}
        Colors={Colors}
        darkMode={darkMode}
        applying={busy}
      />
      <ScopeDraftSplitPricingEditor
        packageName={packageName}
        breakdown={breakdown}
        entryMode={entryMode}
        Colors={Colors}
        darkMode={darkMode}
        busy={busy}
        onUpdateScopeBudgetSplit={onUpdateScopeBudgetSplit}
        onLiveSplitChange={onLiveSplitChange}
      />
    </PricingEditorPanel>
  );
}

export function Step3ScopeAllowancePricingEditor({
  packageName,
  amount,
  Colors,
  darkMode,
  busy,
  onDone,
  onUpdateScopeBudgetSplit,
}: {
  packageName: string;
  amount: number;
  Colors: ScopePricingColors;
  darkMode: boolean;
  busy: boolean;
  onDone: () => void;
  onUpdateScopeBudgetSplit: (
    packageName: string,
    material: number,
    labor: number,
    basis?: ScopePackageBudgetBreakdown['basis']
  ) => void;
}) {
  const [allowanceValue, setAllowanceValue] = useState(amount > 0 ? String(amount) : '');

  return (
    <PricingEditorPanel Colors={Colors} darkMode={darkMode}>
      <PricingEditorHeader
        helper="Enter the allowance total for this item."
        onDone={onDone}
        Colors={Colors}
        darkMode={darkMode}
      />
      <PricingInputField
        label="Allowance"
        value={allowanceValue}
        prefix="$"
        placeholder="Enter allowance"
        embedded
        onFocus={() => {}}
        onChangeText={text => {
          setAllowanceValue(text);
          const next = parsePricingMoneyAmount(text);
          startTransition(() => {
            onUpdateScopeBudgetSplit(packageName, 0, next);
          });
        }}
        onBlur={() => {}}
        Colors={Colors}
        darkMode={darkMode}
        applying={busy}
      />
    </PricingEditorPanel>
  );
}

const styles = StyleSheet.create({
  pricingEditorPanel: {
    marginTop: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 10,
  },
  pricingEditorPanelHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 2,
  },
  pricingEditorHelper: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  pricingEditorDoneBtn: {
    minHeight: 32,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
  },
  pricingEditorDoneBtnText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '800',
  },
  customPricingModeLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  customPricingModeChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  pricingEntryModeChip: {
    flex: 1,
    alignItems: 'center',
  },
  pricingMatLabRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  pricingMatLabModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 4,
    marginBottom: 2,
  },
  pricingMatLabCol: {
    flex: 1,
    minWidth: 0,
  },
  pricingEditorTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148, 163, 184, 0.2)',
  },
  pricingInputEmbedded: {
    gap: 4,
  },
  pricingInputRowEmbedded: {
    minHeight: 40,
    paddingHorizontal: 8,
    gap: 2,
  },
  pricingRateModeToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  pricingRateModeChip: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  pricingInputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  pricingInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    minHeight: 44,
  },
  pricingInputPrefixed: {
    flex: 1,
    textAlign: 'left',
    paddingLeft: 0,
    paddingRight: 0,
    margin: 0,
    height: undefined,
    minHeight: 20,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15,
    fontFamily: Typography.fonts.secondary,
    fontWeight: '700',
    ...(Platform.OS === 'android'
      ? { lineHeight: 20, textAlignVertical: 'center' as const, includeFontPadding: false }
      : null),
  },
  pricingCurrencyPrefix: {
    fontSize: 15,
    fontFamily: Typography.fonts.secondary,
    fontWeight: '700',
    lineHeight: 20,
    ...(Platform.OS === 'android'
      ? { includeFontPadding: false, textAlignVertical: 'center' as const }
      : null),
  },
  pricingInput: {
    flex: 1,
    paddingVertical: 0,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    height: 40,
    ...(Platform.OS === 'android'
      ? { textAlignVertical: 'center' as const, includeFontPadding: false }
      : {}),
  },
});
