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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import { KEYBOARD_SCROLL_DEFAULTS } from '@/constants/keyboardScrollProps';
import { useKeyboard } from '@/services/MobileOptimization';
import type { EstimateAiDraft } from '@/utils/estimateAiDraft';
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
  type ManualPackageMode,
  type ManualPricingInputs,
} from '@/utils/estimateAiDraftPricing';
import type { PricingProposal } from '@/utils/estimateAiDraftPricing';

type Props = {
  visible: boolean;
  draft: EstimateAiDraft | null;
  /** Pre-fill rates from saved/rough proposal (adjust flow). */
  seedProposal?: PricingProposal | null;
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

function RateField({
  label,
  value,
  onChangeText,
  placeholder,
  Colors,
  onFieldFocus,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  Colors: ReturnType<typeof getColors>;
  onFieldFocus?: (fieldRef: React.RefObject<View | null>) => void;
}) {
  const wrapRef = useRef<View>(null);

  return (
    <View ref={wrapRef} style={{ marginBottom: 8 }} collapsable={false}>
      <Text style={{ color: Colors.sub, fontSize: 11, marginBottom: 3 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        placeholder={placeholder}
        placeholderTextColor={Colors.sub}
        onFocus={() => onFieldFocus?.(wrapRef)}
        style={{
          borderWidth: 1,
          borderColor: Colors.line,
          borderRadius: 10,
          paddingVertical: 10,
          paddingHorizontal: 12,
          color: Colors.text,
          fontSize: 16,
        }}
      />
    </View>
  );
}

export default function AIEstimateManualPricingModal({
  visible,
  draft,
  seedProposal = null,
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
    } else {
      setInputs({});
    }
  }, [visible, draft, seedProposal]);

  const grandTotal = useMemo(
    () => (draft ? computeManualGrandTotal(draft, inputs) : 0),
    [draft, inputs]
  );

  const displayPackages = useMemo(() => {
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
          inp.laborRateLf
      );
    });
  }, [packages, isAdjust, draft, seedProposal]);

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

  if (!visible || !draft) return null;

  const shell = (
    <KeyboardAvoidingView
      style={[styles.shell, { backgroundColor: Colors.bg, paddingTop: embedded ? 0 : insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      enabled={Platform.OS === 'ios'}
    >
        <View style={styles.header}>
          <Text style={[styles.title, { color: Colors.text }]}>
            {isAdjust ? 'Adjust rates' : 'Add prices manually'}
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text style={{ color: Colors.sub, fontSize: 22 }}>×</Text>
          </TouchableOpacity>
        </View>
        <Text style={{ color: Colors.sub, fontSize: 13, paddingHorizontal: 16, marginBottom: 8 }}>
          {isAdjust
            ? 'Rates start from your proposal — edit any line or bump all, then apply.'
            : 'Enter rates or lump sums — only filled fields are calculated.'}
        </Text>

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
            const qty = formatScopeQuantity(pkg);
            const kind = classifyPackageKind(pkg.name);
            const inp = inputs[pkg.name] || {};
            const mode = inp.mode ?? defaultManualMode(kind);
            const preview = computeManualPackagePreview(pkg, inp);

            const cardStyle = {
              borderColor: darkMode ? 'rgba(255,255,255,0.08)' : Colors.line,
              backgroundColor: darkMode ? 'rgba(255,255,255,0.03)' : Colors.surface2,
            };

            return (
              <View key={pkg.name} style={[styles.card, cardStyle]}>
                <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '800' }}>{pkg.name}</Text>
                {qty ? (
                  <Text style={{ color: Colors.sub, fontSize: 12, marginTop: 2, marginBottom: 8 }}>
                    Quantity: {qty}
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
                        label="Demo total"
                        placeholder="Total $"
                        value={inp.lumpSum || ''}
                        onChangeText={(v) => setField(pkg.name, 'lumpSum', v)}
                        onFieldFocus={handleFieldFocus}
                        Colors={Colors}
                      />
                    ) : (
                      <RateField
                        label="Demo rate"
                        placeholder="$ / sqft"
                        value={inp.demoRateSqft || ''}
                        onChangeText={(v) => setField(pkg.name, 'demoRateSqft', v)}
                        onFieldFocus={handleFieldFocus}
                        Colors={Colors}
                      />
                    )}
                  </>
                ) : null}

                {kind === 'flooring' ? (
                  <>
                    <SegmentedControl
                      options={[
                        { id: 'split', label: 'Material + Labor' },
                        { id: 'lump_sum', label: 'Lump sum' },
                      ]}
                      value={mode === 'lump_sum' ? 'lump_sum' : 'split'}
                      onChange={(m) => setMode(pkg.name, m)}
                      Colors={Colors}
                    />
                    {mode === 'lump_sum' ? (
                      <RateField
                        label="Lump sum total"
                        placeholder="Total $"
                        value={inp.lumpSum || ''}
                        onChangeText={(v) => setField(pkg.name, 'lumpSum', v)}
                        onFieldFocus={handleFieldFocus}
                        Colors={Colors}
                      />
                    ) : (
                      <>
                        <RateField
                          label="Material rate"
                          placeholder="$ / sqft"
                          value={inp.materialRateSqft || ''}
                          onChangeText={(v) => setField(pkg.name, 'materialRateSqft', v)}
                          onFieldFocus={handleFieldFocus}
                          Colors={Colors}
                        />
                        <RateField
                          label="Labor rate"
                          placeholder="$ / sqft"
                          value={inp.laborRateSqft || ''}
                          onChangeText={(v) => setField(pkg.name, 'laborRateSqft', v)}
                          onFieldFocus={handleFieldFocus}
                          Colors={Colors}
                        />
                      </>
                    )}
                  </>
                ) : null}

                {kind === 'baseboard' ? (
                  <>
                    <SegmentedControl
                      options={[
                        { id: 'split', label: 'Material + Labor' },
                        { id: 'lump_sum', label: 'Lump sum' },
                      ]}
                      value={mode === 'lump_sum' ? 'lump_sum' : 'split'}
                      onChange={(m) => setMode(pkg.name, m)}
                      Colors={Colors}
                    />
                    {mode === 'lump_sum' ? (
                      <RateField
                        label="Lump sum total"
                        placeholder="Total $"
                        value={inp.lumpSum || ''}
                        onChangeText={(v) => setField(pkg.name, 'lumpSum', v)}
                        onFieldFocus={handleFieldFocus}
                        Colors={Colors}
                      />
                    ) : (
                      <>
                        <RateField
                          label="Material rate"
                          placeholder="$ / LF"
                          value={inp.materialRateLf || ''}
                          onChangeText={(v) => setField(pkg.name, 'materialRateLf', v)}
                          onFieldFocus={handleFieldFocus}
                          Colors={Colors}
                        />
                        <RateField
                          label="Labor rate"
                          placeholder="$ / LF"
                          value={inp.laborRateLf || ''}
                          onChangeText={(v) => setField(pkg.name, 'laborRateLf', v)}
                          onFieldFocus={handleFieldFocus}
                          Colors={Colors}
                        />
                        <RateField
                          label="Caulk & paint"
                          placeholder="Optional total $"
                          value={inp.caulkPaintLump || ''}
                          onChangeText={(v) => setField(pkg.name, 'caulkPaintLump', v)}
                          onFieldFocus={handleFieldFocus}
                          Colors={Colors}
                        />
                      </>
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
              {isAdjust ? 'Apply adjusted pricing' : 'Review calculated draft'}
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
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {shell}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  title: { fontSize: 18, fontWeight: '800', flex: 1 },
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
