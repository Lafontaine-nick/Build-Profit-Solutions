import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Keyboard,
  StatusBar,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import GradientRingBackInner from '@/components/GradientRingBackInner';
import {
  BRAND_FRAME_GRADIENT_COLORS,
  BRAND_FRAME_GRADIENT_END,
  BRAND_FRAME_GRADIENT_START,
} from '@/constants/brandFrameGradient';
import { KEYBOARD_SCROLL_DEFAULTS } from '@/constants/keyboardScrollProps';
import { estimateFlowCardStyle } from '@/utils/estimateFlowCardStyle';
import { useKeyboard } from '@/services/MobileOptimization';
import type { EstimateAiDraft, EstimateDraftScopePackage } from '@/utils/estimateAiDraft';
import { formatDraftMoney, getScopePackages } from '@/utils/estimateAiDraft';
import { formatScopeQuantity } from '@/utils/estimateDraftReviewUi';
import {
  buildManualPricingProposal,
  bumpManualInputRates,
  classifyPackageKind,
  computeManualGrandTotal,
  computeManualPackagePreview,
  defaultManualMode,
  manualPricingInputsFromProposal,
  manualSplitInputKind,
  packageQuantityUnit,
  type ManualPackageMode,
  type ManualPricingInputs,
} from '@/utils/estimateAiDraftPricing';
import type { PricingProposal } from '@/utils/estimateAiDraftPricing';

type Props = {
  visible: boolean;
  draft: EstimateAiDraft | null;
  /** Pre-fill rates from saved/rough proposal (adjust flow). */
  seedProposal?: PricingProposal | null;
  /** When set, show only this scope package (tap-to-price from review). */
  focusPackageName?: string | null;
  embedded?: boolean;
  saveToLibrary: boolean;
  onToggleSaveToLibrary?: (v: boolean) => void;
  onCalculate: (proposal: ReturnType<typeof buildManualPricingProposal>) => void;
  onClose: () => void;
};

function SegmentedControl({
  options,
  value,
  onChange,
  Colors,
  darkMode,
  compact = false,
}: {
  options: { id: ManualPackageMode; label: string }[];
  value: ManualPackageMode;
  onChange: (v: ManualPackageMode) => void;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  compact?: boolean;
}) {
  return (
    <View
      style={[
        styles.segmentedTrack,
        compact && styles.segmentedTrackCompact,
        {
          backgroundColor: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(15, 23, 42, 0.04)',
          borderColor: darkMode ? 'rgba(255,255,255,0.08)' : Colors.line,
        },
      ]}
    >
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <TouchableOpacity
            key={opt.id}
            activeOpacity={0.88}
            onPress={() => onChange(opt.id)}
            style={[
              styles.segmentedOption,
              compact && styles.segmentedOptionCompact,
              active
                ? {
                    backgroundColor: darkMode ? 'rgba(34, 197, 94, 0.22)' : 'rgba(34, 197, 94, 0.14)',
                  }
                : null,
            ]}
          >
            <Text
              style={[
                styles.segmentedOptionText,
                compact && styles.segmentedOptionTextCompact,
                { color: active ? '#22c55e' : Colors.sub, fontWeight: active ? '800' : '600' },
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function ManualSplitFields({
  pkg,
  inp,
  onField,
  onFieldFocus,
  Colors,
  darkMode,
  compact = false,
}: {
  pkg: EstimateDraftScopePackage;
  inp: ManualPricingInputs[string];
  onField: (field: string, value: string) => void;
  onFieldFocus?: (fieldRef: React.RefObject<View | null>) => void;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  compact?: boolean;
}) {
  const splitKind = manualSplitInputKind(packageQuantityUnit(pkg));
  const showCaulk = classifyPackageKind(pkg.name) === 'baseboard' && splitKind === 'lf';

  if (splitKind === 'sqft') {
    return (
      <>
        <RateField
          label="Material rate"
          placeholder="$0 / sqft"
          value={inp.materialRateSqft || ''}
          onChangeText={(v) => onField('materialRateSqft', v)}
          onFieldFocus={onFieldFocus}
          Colors={Colors}
          darkMode={darkMode}
          compact={compact}
        />
        <RateField
          label="Labor rate"
          placeholder="$0 / sqft"
          value={inp.laborRateSqft || ''}
          onChangeText={(v) => onField('laborRateSqft', v)}
          onFieldFocus={onFieldFocus}
          Colors={Colors}
          darkMode={darkMode}
          compact={compact}
        />
      </>
    );
  }

  if (splitKind === 'lf') {
    return (
      <>
        <RateField
          label="Material rate"
          placeholder="$0 / LF"
          value={inp.materialRateLf || ''}
          onChangeText={(v) => onField('materialRateLf', v)}
          onFieldFocus={onFieldFocus}
          Colors={Colors}
          darkMode={darkMode}
          compact={compact}
        />
        <RateField
          label="Labor rate"
          placeholder="$0 / LF"
          value={inp.laborRateLf || ''}
          onChangeText={(v) => onField('laborRateLf', v)}
          onFieldFocus={onFieldFocus}
          Colors={Colors}
          darkMode={darkMode}
          compact={compact}
        />
        {showCaulk ? (
          <RateField
            label="Caulk & paint"
            placeholder="$0"
            value={inp.caulkPaintLump || ''}
            onChangeText={(v) => onField('caulkPaintLump', v)}
            onFieldFocus={onFieldFocus}
            Colors={Colors}
            darkMode={darkMode}
            compact={compact}
          />
        ) : null}
      </>
    );
  }

  return (
    <>
      <RateField
        label="Material"
        placeholder="$0"
        value={inp.materialTotal || ''}
        onChangeText={(v) => onField('materialTotal', v)}
        onFieldFocus={onFieldFocus}
        Colors={Colors}
        darkMode={darkMode}
        compact={compact}
      />
      <RateField
        label="Labor"
        placeholder="$0"
        value={inp.laborTotal || ''}
        onChangeText={(v) => onField('laborTotal', v)}
        onFieldFocus={onFieldFocus}
        Colors={Colors}
        darkMode={darkMode}
        compact={compact}
      />
    </>
  );
}

function MaterialLaborCard({
  pkg,
  qtyLabel,
  inp,
  mode,
  onSetMode,
  onField,
  onFieldFocus,
  Colors,
  darkMode,
  compact = false,
}: {
  pkg: EstimateDraftScopePackage;
  qtyLabel: string | null;
  inp: ManualPricingInputs[string];
  mode: ManualPackageMode;
  onSetMode: (mode: ManualPackageMode) => void;
  onField: (field: string, value: string) => void;
  onFieldFocus?: (fieldRef: React.RefObject<View | null>) => void;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  compact?: boolean;
}) {
  const preview = computeManualPackagePreview(pkg, inp);
  const cardStyle = compact
    ? [estimateFlowCardStyle(Colors, darkMode), styles.compactCard]
    : [
        styles.card,
        {
          borderColor: darkMode ? 'rgba(255,255,255,0.08)' : Colors.line,
          backgroundColor: darkMode ? 'rgba(255,255,255,0.03)' : Colors.surface2,
        },
      ];

  return (
    <View style={cardStyle}>
      {!compact ? (
        <>
          <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '800' }}>{pkg.name}</Text>
          {qtyLabel ? (
            <Text style={{ color: Colors.sub, fontSize: 12, marginTop: 2, marginBottom: 8 }}>
              Quantity: {qtyLabel}
            </Text>
          ) : null}
        </>
      ) : null}
      <SegmentedControl
        options={[
          { id: 'split', label: 'Material + Labor' },
          { id: 'lump_sum', label: 'Lump sum' },
        ]}
        value={mode === 'lump_sum' ? 'lump_sum' : 'split'}
        onChange={onSetMode}
        Colors={Colors}
        darkMode={darkMode}
        compact={compact}
      />
      {mode === 'lump_sum' ? (
        <RateField
          label="Lump sum"
          placeholder="$0"
          value={inp.lumpSum || ''}
          onChangeText={(v) => onField('lumpSum', v)}
          onFieldFocus={onFieldFocus}
          Colors={Colors}
          darkMode={darkMode}
          compact={compact}
          hero={compact}
        />
      ) : (
        <ManualSplitFields
          pkg={pkg}
          inp={inp}
          onField={onField}
          onFieldFocus={onFieldFocus}
          Colors={Colors}
          darkMode={darkMode}
          compact={compact}
        />
      )}
      {!compact && preview.total > 0 ? (
        <View
          style={{
            marginTop: 6,
            paddingTop: 8,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: Colors.line,
          }}
        >
          {preview.breakdown.map((line, i) => (
            <Text key={`bd-${i}`} style={{ color: Colors.sub, fontSize: 11, marginBottom: 2 }}>
              {line}
            </Text>
          ))}
          <Text style={{ color: '#22c55e', fontSize: 13, fontWeight: '800', marginTop: 4 }}>
            Total: {formatDraftMoney(preview.total)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function inputPlaceholderColor(darkMode: boolean, Colors: ReturnType<typeof getColors>) {
  return darkMode ? 'rgba(255,255,255,0.35)' : '#94a3b8';
}

function RateField({
  label,
  value,
  onChangeText,
  placeholder,
  Colors,
  darkMode = false,
  onFieldFocus,
  compact = false,
  hero = false,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  Colors: ReturnType<typeof getColors>;
  darkMode?: boolean;
  onFieldFocus?: (fieldRef: React.RefObject<View | null>) => void;
  compact?: boolean;
  hero?: boolean;
}) {
  const wrapRef = useRef<View>(null);
  const isEmpty = !value?.trim();
  const placeholderColor = inputPlaceholderColor(darkMode, Colors);
  const fieldBg = darkMode ? 'rgba(255,255,255,0.06)' : Colors.surface2;
  const fieldBorder = darkMode ? 'rgba(255,255,255,0.1)' : Colors.line;

  if (hero) {
    return (
      <View ref={wrapRef} style={styles.heroFieldWrap} collapsable={false}>
        <Text style={[styles.fieldLabel, { color: Colors.sub }]}>{label}</Text>
        <View
          style={[
            styles.heroInputRow,
            {
              backgroundColor: fieldBg,
              borderColor: isEmpty ? fieldBorder : 'rgba(34, 197, 94, 0.35)',
            },
          ]}
        >
          <Text style={[styles.heroCurrency, { color: isEmpty ? placeholderColor : '#22c55e' }]}>$</Text>
          <TextInput
            value={value}
            onChangeText={onChangeText}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={placeholderColor}
            onFocus={() => onFieldFocus?.(wrapRef)}
            style={[
              styles.heroInput,
              { color: isEmpty ? placeholderColor : Colors.text },
            ]}
          />
        </View>
      </View>
    );
  }

  return (
    <View ref={wrapRef} style={[styles.fieldWrap, compact && styles.fieldWrapCompact]} collapsable={false}>
      <Text style={[styles.fieldLabel, compact && styles.fieldLabelCompact, { color: Colors.sub }]}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        placeholder={placeholder}
        placeholderTextColor={placeholderColor}
        onFocus={() => onFieldFocus?.(wrapRef)}
        style={[
          styles.fieldInput,
          compact && styles.fieldInputCompact,
          {
            borderColor: fieldBorder,
            backgroundColor: fieldBg,
            color: isEmpty ? placeholderColor : Colors.text,
            fontWeight: isEmpty ? '500' : '600',
          },
        ]}
      />
    </View>
  );
}

export default function AIEstimateManualPricingModal({
  visible,
  draft,
  seedProposal = null,
  focusPackageName = null,
  embedded = false,
  saveToLibrary,
  onToggleSaveToLibrary,
  onCalculate,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const { theme, darkMode } = useTheme();
  const Colors = getColors(theme);
  const packages = useMemo(() => (draft ? getScopePackages(draft) : []), [draft]);
  const [inputs, setInputs] = useState<ManualPricingInputs>({});
  const [fieldFocused, setFieldFocused] = useState(false);
  const [keyboardUp, setKeyboardUp] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(0);
  const { keyboardHeight } = useKeyboard();
  const keyboardHeightRef = useRef(0);
  keyboardHeightRef.current = keyboardHeight;
  const isAdjust = Boolean(seedProposal && !seedProposal.empty);
  const isSingleItem = Boolean(focusPackageName);
  const hideFooter = fieldFocused || keyboardUp;

  useEffect(() => {
    if (!visible) {
      setFieldFocused(false);
      setKeyboardUp(false);
      return undefined;
    }
    if (Platform.OS === 'web') return undefined;

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardUp(true));
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardUp(false);
      setFieldFocused(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  const handleFieldFocus = useCallback((fieldRef: React.RefObject<View | null>) => {
    setFieldFocused(true);
    const delay = Platform.OS === 'ios' ? 280 : 120;
    setTimeout(() => {
      const kb = Math.max(keyboardHeightRef.current || 0, Platform.OS === 'ios' ? 290 : 260);
      const marginAboveKeyboard = Platform.OS === 'ios' ? 88 : 72;
      fieldRef.current?.measureInWindow?.((_x, y, _w, h) => {
        const winH = Dimensions.get('window').height;
        const keyboardTopY = winH - kb;
        const clearLineY = keyboardTopY - marginAboveKeyboard;
        const fieldBottomY = y + h;
        const overflow = fieldBottomY - clearLineY;
        if (overflow > 2 && scrollRef.current) {
          scrollRef.current.scrollTo({ y: scrollYRef.current + overflow, animated: true });
        }
      });
    }, delay);
  }, []);

  useEffect(() => {
    if (!visible) {
      setInputs({});
      return;
    }
    if (draft && seedProposal && !seedProposal.empty) {
      setInputs(manualPricingInputsFromProposal(draft, seedProposal));
      return;
    }
    if (focusPackageName) {
      setInputs({
        [focusPackageName]: { mode: 'split' },
      });
      return;
    }
    setInputs({});
  }, [visible, draft, seedProposal, focusPackageName]);

  const grandTotal = useMemo(
    () => (draft ? computeManualGrandTotal(draft, inputs) : 0),
    [draft, inputs]
  );

  const displayPackages = useMemo(() => {
    if (focusPackageName) {
      return packages.filter((p) => p.name === focusPackageName);
    }
    if (!isAdjust || !draft || !seedProposal) return packages;
    const seeded = manualPricingInputsFromProposal(draft, seedProposal);
    return packages.filter((p) => {
      const inp = seeded[p.name];
      if (!inp) return false;
      return Boolean(
        inp.lumpSum ||
          inp.demoRateSqft ||
          inp.materialRateSqft ||
          inp.laborRateSqft ||
          inp.materialRateLf ||
          inp.laborRateLf ||
          inp.materialTotal ||
          inp.laborTotal
      );
    });
  }, [packages, isAdjust, draft, seedProposal, focusPackageName]);

  const setField = (pkgName: string, field: string, value: string) => {
    setInputs((prev) => ({
      ...prev,
      [pkgName]: { ...(prev[pkgName] || {}), [field]: value },
    }));
  };

  const setMode = (pkgName: string, mode: ManualPackageMode) => {
    setInputs((prev) => ({
      ...prev,
      [pkgName]: { ...(prev[pkgName] || {}), mode },
    }));
  };

  const handleReview = () => {
    if (!draft) return;
    const proposal = buildManualPricingProposal(draft, inputs);
    if (proposal.empty) return;
    onCalculate(proposal);
  };

  const handleBack = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onClose();
  };

  const headerTitle = isSingleItem
    ? 'Add price'
    : isAdjust
      ? 'Adjust rates'
      : 'Add prices manually';
  const focusPackage = displayPackages[0] ?? null;
  const focusQtyLabel = focusPackage ? formatScopeQuantity(focusPackage) : null;
  const headerSubtitle = isSingleItem
    ? null
    : isAdjust
      ? 'Rates start from your proposal — edit any line or bump all, then apply.'
      : 'Enter rates or lump sums — only filled fields are calculated.';
  const headerTopPadding = embedded
    ? 0
    : Math.max(insets.top, Platform.OS === 'ios' ? 8 : 0) + 4;

  if (!visible || !draft) return null;

  const shell = (
    <KeyboardAvoidingView
      style={[styles.shell, { backgroundColor: Colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      enabled={Platform.OS === 'ios'}
    >
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
            <Text style={[styles.title, { color: Colors.text }]}>{headerTitle}</Text>
            {isSingleItem && focusPackage ? (
              <>
                <Text style={[styles.scopeName, { color: Colors.text }]} numberOfLines={2}>
                  {focusPackage.name}
                </Text>
                {focusQtyLabel ? (
                  <Text style={[styles.scopeQty, { color: Colors.sub }]}>{focusQtyLabel}</Text>
                ) : null}
              </>
            ) : null}
            {headerSubtitle ? (
              <Text style={[styles.headerSubtitle, { color: Colors.sub }]} numberOfLines={3}>
                {headerSubtitle}
              </Text>
            ) : null}
          </View>
          <View style={styles.headerSide} />
        </View>

        {isAdjust ? (
          <View style={styles.bumpRow}>
            {[5, 10, 15].map((pct) => (
              <TouchableOpacity
                key={pct}
                activeOpacity={0.88}
                onPress={() => setInputs((prev) => bumpManualInputRates(prev, pct))}
                style={[
                  styles.bumpChip,
                  {
                    borderColor: darkMode ? 'rgba(96,165,250,0.35)' : Colors.line,
                    backgroundColor: darkMode ? 'rgba(96,165,250,0.1)' : 'rgba(59,130,246,0.08)',
                  },
                ]}
              >
                <Text style={{ color: '#60a5fa', fontSize: 12, fontWeight: '800' }}>+{pct}% all</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: isSingleItem ? 8 : 0,
            flexGrow: isSingleItem ? 1 : undefined,
            justifyContent: isSingleItem && !hideFooter ? 'center' : undefined,
            paddingBottom: hideFooter
              ? Math.max(keyboardHeight, Platform.OS === 'ios' ? 320 : 280) + 24
              : isSingleItem
                ? insets.bottom + 24
                : insets.bottom + 200,
          }}
          onScroll={(e) => {
            scrollYRef.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          {...KEYBOARD_SCROLL_DEFAULTS}
        >
          {displayPackages.map((pkg) => {
            const qtyLabel = formatScopeQuantity(pkg);
            const kind = classifyPackageKind(pkg.name);
            const inp = inputs[pkg.name] || {};
            const mode = inp.mode ?? (focusPackageName ? 'split' : defaultManualMode(kind));

            if (kind === 'flooring' || kind === 'baseboard' || kind === 'other') {
              return (
                <MaterialLaborCard
                  key={pkg.name}
                  pkg={pkg}
                  qtyLabel={qtyLabel}
                  inp={inp}
                  mode={mode}
                  onSetMode={(m) => setMode(pkg.name, m)}
                  onField={(field, value) => setField(pkg.name, field, value)}
                  onFieldFocus={handleFieldFocus}
                  Colors={Colors}
                  darkMode={darkMode}
                  compact={isSingleItem}
                />
              );
            }

            const preview = computeManualPackagePreview(pkg, inp);
            const cardStyle = isSingleItem
              ? [estimateFlowCardStyle(Colors, darkMode), styles.compactCard]
              : [
                  styles.card,
                  {
                    borderColor: darkMode ? 'rgba(255,255,255,0.08)' : Colors.line,
                    backgroundColor: darkMode ? 'rgba(255,255,255,0.03)' : Colors.surface2,
                  },
                ];

            return (
              <View key={pkg.name} style={cardStyle}>
                {!isSingleItem ? (
                  <>
                    <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '800' }}>{pkg.name}</Text>
                    {qtyLabel ? (
                      <Text style={{ color: Colors.sub, fontSize: 12, marginTop: 2, marginBottom: 8 }}>
                        Quantity: {qtyLabel}
                      </Text>
                    ) : null}
                  </>
                ) : null}

                {kind === 'tile_demo' ? (
                  <>
                    <SegmentedControl
                      options={[
                        { id: 'rate', label: 'Rate' },
                        { id: 'lump_sum', label: 'Lump sum' },
                      ]}
                      value={mode === 'lump_sum' ? 'lump_sum' : 'rate'}
                      onChange={(m) => setMode(pkg.name, m)}
                      Colors={Colors}
                      darkMode={darkMode}
                      compact={isSingleItem}
                    />
                    {mode === 'lump_sum' ? (
                      <RateField
                        label="Lump sum"
                        placeholder="$0"
                        value={inp.lumpSum || ''}
                        onChangeText={(v) => setField(pkg.name, 'lumpSum', v)}
                        onFieldFocus={handleFieldFocus}
                        Colors={Colors}
                        darkMode={darkMode}
                        compact={isSingleItem}
                        hero={isSingleItem}
                      />
                    ) : (
                      <RateField
                        label="Demo rate"
                        placeholder="$0 / sqft"
                        value={inp.demoRateSqft || ''}
                        onChangeText={(v) => setField(pkg.name, 'demoRateSqft', v)}
                        onFieldFocus={handleFieldFocus}
                        Colors={Colors}
                        darkMode={darkMode}
                        compact={isSingleItem}
                      />
                    )}
                  </>
                ) : null}

                {!isSingleItem && preview.total > 0 ? (
                  <View
                    style={{
                      marginTop: 6,
                      paddingTop: 8,
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: Colors.line,
                    }}
                  >
                    {preview.breakdown.map((line, i) => (
                      <Text key={`bd-${i}`} style={{ color: Colors.sub, fontSize: 11, marginBottom: 2 }}>
                        {line}
                      </Text>
                    ))}
                    <Text style={{ color: '#22c55e', fontSize: 13, fontWeight: '800', marginTop: 4 }}>
                      Total: {formatDraftMoney(preview.total)}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>

        {!hideFooter ? (
        <View
          style={[
            isSingleItem ? styles.compactFooter : styles.footer,
            {
              paddingBottom: Math.max(insets.bottom, 16),
              backgroundColor: Colors.bg,
              borderTopColor: darkMode ? 'rgba(255,255,255,0.1)' : Colors.line,
            },
          ]}
        >
          {isSingleItem ? (
            <View style={styles.compactTotalRow}>
              <Text style={{ color: Colors.sub, fontSize: 13, fontWeight: '600' }}>Total</Text>
              <Text
                style={{
                  color: grandTotal > 0 ? '#22c55e' : Colors.sub,
                  fontSize: 22,
                  fontWeight: '800',
                }}
              >
                {formatDraftMoney(grandTotal)}
              </Text>
            </View>
          ) : (
            <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '800', textAlign: 'center' }}>
              Estimated total: {formatDraftMoney(grandTotal)}
            </Text>
          )}

          {onToggleSaveToLibrary ? (
            <View style={[styles.toggleBlock, isSingleItem && styles.toggleBlockCompact]}>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: Colors.text,
                    fontSize: isSingleItem ? 12 : 13,
                    fontWeight: '700',
                  }}
                >
                  Remember these rates for future bids
                </Text>
                {!isSingleItem ? (
                  <Text style={{ color: Colors.sub, fontSize: 11, marginTop: 2 }}>
                    Saved after you apply the estimate.
                  </Text>
                ) : null}
              </View>
              <Switch
                value={saveToLibrary}
                onValueChange={onToggleSaveToLibrary}
                trackColor={{ false: '#475569', true: '#22c55e' }}
                thumbColor="#ffffff"
              />
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.primaryBtn, grandTotal <= 0 && styles.primaryBtnDisabled]}
            onPress={handleReview}
            disabled={grandTotal <= 0}
            activeOpacity={0.88}
          >
            <Text style={styles.primaryBtnText}>
              {isSingleItem
                ? 'Save price'
                : isAdjust
                  ? 'Apply adjusted pricing'
                  : 'Review calculated draft'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={isSingleItem ? styles.compactCancelBtn : undefined}>
            <Text
              style={{
                color: Colors.sub,
                fontWeight: '700',
                textAlign: 'center',
                fontSize: isSingleItem ? 14 : 15,
              }}
            >
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
        ) : null}
      </KeyboardAvoidingView>
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
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={handleBack}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
      <View style={[styles.shell, { backgroundColor: Colors.bg }]}>{shell}</View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  embeddedShell: {
    zIndex: 103,
    elevation: 103,
  },
  bumpRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  bumpChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerSide: { width: 52, alignItems: 'flex-start', paddingTop: 6 },
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
  headerText: { flex: 1, alignItems: 'center', paddingHorizontal: 8, paddingTop: 10 },
  headerSubtitle: { fontSize: 12, marginTop: 4, textAlign: 'center', lineHeight: 17 },
  scopeName: { fontSize: 17, fontWeight: '800', textAlign: 'center', marginTop: 6, lineHeight: 22 },
  scopeQty: { fontSize: 12, fontWeight: '600', textAlign: 'center', marginTop: 4 },
  title: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  card: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  compactCard: {
    marginBottom: 0,
    padding: 16,
  },
  segmentedTrack: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
    padding: 3,
    overflow: 'hidden',
  },
  segmentedTrackCompact: {
    marginBottom: 16,
  },
  segmentedOption: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: 'center',
  },
  segmentedOptionCompact: {
    paddingVertical: 10,
  },
  segmentedOptionText: {
    fontSize: 12,
  },
  segmentedOptionTextCompact: {
    fontSize: 13,
  },
  fieldWrap: {
    marginBottom: 8,
  },
  fieldWrapCompact: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 11,
    marginBottom: 4,
    fontWeight: '600',
  },
  fieldLabelCompact: {
    fontSize: 12,
    marginBottom: 6,
  },
  fieldInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  fieldInputCompact: {
    paddingVertical: 14,
    fontSize: 17,
  },
  heroFieldWrap: {
    marginTop: 4,
  },
  heroInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  heroCurrency: {
    fontSize: 28,
    fontWeight: '800',
    marginRight: 4,
  },
  heroInput: {
    flex: 1,
    fontSize: 32,
    fontWeight: '800',
    paddingVertical: 10,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  compactFooter: {
    paddingHorizontal: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  compactTotalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  compactCancelBtn: {
    paddingVertical: 4,
  },
  toggleBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleBlockCompact: {
    paddingVertical: 2,
  },
  primaryBtn: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnDisabled: {
    backgroundColor: '#475569',
    opacity: 0.7,
  },
  primaryBtnText: { color: '#0f172a', fontWeight: '800', fontSize: 16 },
});
