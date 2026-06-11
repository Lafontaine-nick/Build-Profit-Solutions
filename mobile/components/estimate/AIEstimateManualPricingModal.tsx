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
}: {
  options: { id: ManualPackageMode; label: string }[];
  value: ManualPackageMode;
  onChange: (v: ManualPackageMode) => void;
  Colors: ReturnType<typeof getColors>;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: Colors.line,
        marginBottom: 10,
        overflow: 'hidden',
      }}
    >
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <TouchableOpacity
            key={opt.id}
            activeOpacity={0.88}
            onPress={() => onChange(opt.id)}
            style={{
              flex: 1,
              paddingVertical: 8,
              backgroundColor: active ? 'rgba(96, 165, 250, 0.2)' : 'transparent',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                color: active ? '#60a5fa' : Colors.sub,
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
  );
}

function ManualSplitFields({
  pkg,
  inp,
  onField,
  onFieldFocus,
  Colors,
  darkMode,
}: {
  pkg: EstimateDraftScopePackage;
  inp: ManualPricingInputs[string];
  onField: (field: string, value: string) => void;
  onFieldFocus?: (fieldRef: React.RefObject<View | null>) => void;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
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
        />
        <RateField
          label="Labor rate"
          placeholder="$0 / sqft"
          value={inp.laborRateSqft || ''}
          onChangeText={(v) => onField('laborRateSqft', v)}
          onFieldFocus={onFieldFocus}
          Colors={Colors}
          darkMode={darkMode}
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
        />
        <RateField
          label="Labor rate"
          placeholder="$0 / LF"
          value={inp.laborRateLf || ''}
          onChangeText={(v) => onField('laborRateLf', v)}
          onFieldFocus={onFieldFocus}
          Colors={Colors}
          darkMode={darkMode}
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
      />
      <RateField
        label="Labor"
        placeholder="$0"
        value={inp.laborTotal || ''}
        onChangeText={(v) => onField('laborTotal', v)}
        onFieldFocus={onFieldFocus}
        Colors={Colors}
        darkMode={darkMode}
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
}) {
  const preview = computeManualPackagePreview(pkg, inp);
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
      <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '800' }}>{pkg.name}</Text>
      {qtyLabel ? (
        <Text style={{ color: Colors.sub, fontSize: 12, marginTop: 2, marginBottom: 8 }}>
          Quantity: {qtyLabel}
        </Text>
      ) : null}
      <SegmentedControl
        options={[
          { id: 'split', label: 'Material + Labor' },
          { id: 'lump_sum', label: 'Lump sum' },
        ]}
        value={mode === 'lump_sum' ? 'lump_sum' : 'split'}
        onChange={onSetMode}
        Colors={Colors}
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
        />
      ) : (
        <ManualSplitFields
          pkg={pkg}
          inp={inp}
          onField={onField}
          onFieldFocus={onFieldFocus}
          Colors={Colors}
          darkMode={darkMode}
        />
      )}
      {preview.total > 0 ? (
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
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  Colors: ReturnType<typeof getColors>;
  darkMode?: boolean;
  onFieldFocus?: (fieldRef: React.RefObject<View | null>) => void;
}) {
  const wrapRef = useRef<View>(null);
  const isEmpty = !value?.trim();
  const placeholderColor = inputPlaceholderColor(darkMode, Colors);

  return (
    <View ref={wrapRef} style={{ marginBottom: 8 }} collapsable={false}>
      <Text style={{ color: Colors.sub, fontSize: 11, marginBottom: 3 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        placeholder={placeholder}
        placeholderTextColor={placeholderColor}
        onFocus={() => onFieldFocus?.(wrapRef)}
        style={{
          borderWidth: 1,
          borderColor: Colors.line,
          borderRadius: 10,
          paddingVertical: 10,
          paddingHorizontal: 12,
          color: isEmpty ? placeholderColor : Colors.text,
          fontSize: 16,
          fontWeight: isEmpty ? '500' : '600',
        }}
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
  const headerSubtitle = isSingleItem
    ? 'Enter a lump sum or unit rates for this scope item, then save.'
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
            <Text style={[styles.headerSubtitle, { color: Colors.sub }]} numberOfLines={3}>
              {headerSubtitle}
            </Text>
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
            paddingBottom: hideFooter
              ? Math.max(keyboardHeight, Platform.OS === 'ios' ? 320 : 280) + 24
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
                />
              );
            }

            const preview = computeManualPackagePreview(pkg, inp);
            const cardStyle = {
              borderColor: darkMode ? 'rgba(255,255,255,0.08)' : Colors.line,
              backgroundColor: darkMode ? 'rgba(255,255,255,0.03)' : Colors.surface2,
            };

            return (
              <View key={pkg.name} style={[styles.card, cardStyle]}>
                <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '800' }}>{pkg.name}</Text>
                {qtyLabel ? (
                  <Text style={{ color: Colors.sub, fontSize: 12, marginTop: 2, marginBottom: 8 }}>
                    Quantity: {qtyLabel}
                  </Text>
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
                      />
                    )}
                  </>
                ) : null}

                {preview.total > 0 ? (
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
            styles.footer,
            {
              paddingBottom: Math.max(insets.bottom, 16),
              backgroundColor: Colors.bg,
              borderTopColor: darkMode ? 'rgba(255,255,255,0.1)' : Colors.line,
            },
          ]}
        >
          <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '800', textAlign: 'center' }}>
            Estimated total: {formatDraftMoney(grandTotal)}
          </Text>

          {onToggleSaveToLibrary ? (
            <View style={styles.toggleBlock}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: Colors.text, fontSize: 13, fontWeight: '700' }}>
                  Remember these rates for future bids
                </Text>
                <Text style={{ color: Colors.sub, fontSize: 11, marginTop: 2 }}>
                  Saved after you apply the estimate.
                </Text>
              </View>
              <Switch value={saveToLibrary} onValueChange={onToggleSaveToLibrary} />
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
          <TouchableOpacity onPress={onClose}>
            <Text style={{ color: Colors.sub, fontWeight: '700', textAlign: 'center' }}>Cancel</Text>
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
  title: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  card: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  toggleBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
