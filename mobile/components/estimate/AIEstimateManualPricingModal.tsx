import React, { useEffect, useMemo, useState } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import type { EstimateAiDraft } from '@/utils/estimateAiDraft';
import { formatDraftMoney, getScopePackages } from '@/utils/estimateAiDraft';
import { formatScopeQuantity } from '@/utils/estimateDraftReviewUi';
import {
  buildManualPricingProposal,
  classifyPackageKind,
  computeManualGrandTotal,
  computeManualPackagePreview,
  defaultManualMode,
  type ManualPackageMode,
  type ManualPricingInputs,
} from '@/utils/estimateAiDraftPricing';

type Props = {
  visible: boolean;
  draft: EstimateAiDraft | null;
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
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  Colors: ReturnType<typeof getColors>;
}) {
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={{ color: Colors.sub, fontSize: 11, marginBottom: 3 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        placeholder={placeholder}
        placeholderTextColor={Colors.sub}
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

  useEffect(() => {
    if (!visible) setInputs({});
  }, [visible]);

  const grandTotal = useMemo(
    () => (draft ? computeManualGrandTotal(draft, inputs) : 0),
    [draft, inputs]
  );

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

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.shell, { backgroundColor: Colors.bg, paddingTop: insets.top }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: Colors.text }]}>Add prices manually</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text style={{ color: Colors.sub, fontSize: 22 }}>×</Text>
          </TouchableOpacity>
        </View>
        <Text style={{ color: Colors.sub, fontSize: 13, paddingHorizontal: 16, marginBottom: 8 }}>
          Enter rates or lump sums — only filled fields are calculated.
        </Text>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 200 }}
          keyboardShouldPersistTaps="handled"
        >
          {packages.map((pkg) => {
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
                        Colors={Colors}
                      />
                    ) : (
                      <RateField
                        label="Demo rate"
                        placeholder="$ / sqft"
                        value={inp.demoRateSqft || ''}
                        onChangeText={(v) => setField(pkg.name, 'demoRateSqft', v)}
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
                        Colors={Colors}
                      />
                    ) : (
                      <>
                        <RateField
                          label="Material rate"
                          placeholder="$ / sqft"
                          value={inp.materialRateSqft || ''}
                          onChangeText={(v) => setField(pkg.name, 'materialRateSqft', v)}
                          Colors={Colors}
                        />
                        <RateField
                          label="Labor rate"
                          placeholder="$ / sqft"
                          value={inp.laborRateSqft || ''}
                          onChangeText={(v) => setField(pkg.name, 'laborRateSqft', v)}
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
                        Colors={Colors}
                      />
                    ) : (
                      <>
                        <RateField
                          label="Material rate"
                          placeholder="$ / LF"
                          value={inp.materialRateLf || ''}
                          onChangeText={(v) => setField(pkg.name, 'materialRateLf', v)}
                          Colors={Colors}
                        />
                        <RateField
                          label="Labor rate"
                          placeholder="$ / LF"
                          value={inp.laborRateLf || ''}
                          onChangeText={(v) => setField(pkg.name, 'laborRateLf', v)}
                          Colors={Colors}
                        />
                        <RateField
                          label="Caulk & paint"
                          placeholder="Optional total $"
                          value={inp.caulkPaintLump || ''}
                          onChangeText={(v) => setField(pkg.name, 'caulkPaintLump', v)}
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
            <Text style={styles.primaryBtnText}>Review calculated draft</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose}>
            <Text style={{ color: Colors.sub, fontWeight: '700', textAlign: 'center' }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
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
