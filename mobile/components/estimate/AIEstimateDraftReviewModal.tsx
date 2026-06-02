import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Platform,
  StyleSheet,
  StatusBar,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import AIEstimateFlowHeader from '@/components/estimate/AIEstimateFlowHeader';
import AIEstimateDisclaimer from '@/components/estimate/AIEstimateDisclaimer';
import type { EstimateAiDraft } from '@/utils/estimateAiDraft';
import { draftHasCombinedRoomPrices, formatDraftMoney } from '@/utils/estimateAiDraft';

type Props = {
  visible: boolean;
  draft: EstimateAiDraft | null;
  applying?: boolean;
  suggestingSplits?: boolean;
  fromAssistant?: boolean;
  embedded?: boolean;
  onClose: () => void;
  onBack?: () => void;
  onRegenerate: () => void;
  onSuggestSplits?: () => void;
  onApply: () => void;
};

function SectionCard({
  title,
  children,
  Colors,
  darkMode,
}: {
  title: string;
  children: React.ReactNode;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
}) {
  return (
    <View
      style={{
        marginBottom: 12,
        padding: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: darkMode ? 'rgba(255,255,255,0.08)' : Colors.line,
        backgroundColor: darkMode ? 'rgba(255,255,255,0.03)' : Colors.surface2,
      }}
    >
      <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '800', marginBottom: 8 }}>{title}</Text>
      {children}
    </View>
  );
}

export default function AIEstimateDraftReviewModal({
  visible,
  draft,
  applying = false,
  suggestingSplits = false,
  fromAssistant = false,
  embedded = false,
  onClose,
  onBack,
  onRegenerate,
  onSuggestSplits,
  onApply,
}: Props) {
  const insets = useSafeAreaInsets();
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);

  const handleBack = () => {
    if (applying) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (fromAssistant && onBack) {
      onBack();
    } else {
      onClose();
    }
  };

  const pricedRoomCount = draft?.rooms.filter((room) => room.price != null).length ?? 0;
  const showSuggestSplits =
    !!onSuggestSplits &&
    !!draft &&
    (draftHasCombinedRoomPrices(draft) || (draft.suggestedSplitRoomCount || 0) > 0);
  const hasSuggestedSplits = (draft?.suggestedSplitRoomCount || 0) > 0;
  const busy = applying || suggestingSplits;

  if (!visible) return null;

  const body = (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
        <AIEstimateFlowHeader
          title="Review draft"
          subtitle="Confirm before applying"
          step={fromAssistant ? 2 : undefined}
          fromAssistant={fromAssistant}
          disabled={busy}
          onBack={handleBack}
        />

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 + insets.bottom }}
        >
          {!draft ? (
            <Text style={{ color: Colors.sub, fontSize: 14 }}>No draft to review.</Text>
          ) : (
            <>
              <AIEstimateDisclaimer variant="review" />

              <SectionCard title="Project" Colors={Colors} darkMode={darkMode}>
                <Text style={{ color: Colors.sub, fontSize: 12 }}>Title</Text>
                <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '700', marginBottom: 8 }}>
                  {draft.projectTitle || 'Untitled project'}
                </Text>
                {draft.customerName ? (
                  <>
                    <Text style={{ color: Colors.sub, fontSize: 12 }}>Customer</Text>
                    <Text style={{ color: Colors.text, fontSize: 15, marginBottom: 8 }}>{draft.customerName}</Text>
                  </>
                ) : null}
                <Text style={{ color: Colors.sub, fontSize: 12 }}>Type</Text>
                <Text style={{ color: Colors.text, fontSize: 15 }}>
                  {draft.projectType.replace(/_/g, ' ')}
                </Text>
              </SectionCard>

              <SectionCard title="Totals" Colors={Colors} darkMode={darkMode}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ color: Colors.sub, fontSize: 13 }}>Line items ({pricedRoomCount} priced)</Text>
                  <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700' }}>
                    {formatDraftMoney(draft.calculatedLineItemTotal)}
                  </Text>
                </View>
                {draft.calculatedLaborTotal != null && draft.calculatedLaborTotal > 0 ? (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ color: Colors.sub, fontSize: 13 }}>
                      {hasSuggestedSplits
                        ? 'Labor (suggested)'
                        : (draft.combinedPriceRoomCount || 0) > 0
                          ? 'Trade / area total'
                          : 'Labor'}
                    </Text>
                    <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700' }}>
                      {formatDraftMoney(draft.calculatedLaborTotal)}
                    </Text>
                  </View>
                ) : null}
                {draft.calculatedMaterialTotal != null && draft.calculatedMaterialTotal > 0 ? (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ color: Colors.sub, fontSize: 13 }}>
                      {hasSuggestedSplits ? 'Materials (suggested)' : 'Materials (from notes)'}
                    </Text>
                    <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700' }}>
                      {formatDraftMoney(draft.calculatedMaterialTotal)}
                    </Text>
                  </View>
                ) : (draft.combinedPriceRoomCount || 0) > 0 ? (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ color: Colors.sub, fontSize: 13 }}>Materials (from notes)</Text>
                    <Text style={{ color: Colors.sub, fontSize: 14, fontWeight: '600' }}>Not in notes</Text>
                  </View>
                ) : null}
                {draft.statedTotal != null ? (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: Colors.sub, fontSize: 13 }}>Stated total in notes</Text>
                    <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700' }}>
                      {formatDraftMoney(draft.statedTotal)}
                    </Text>
                  </View>
                ) : null}
              </SectionCard>

              {showSuggestSplits ? (
                <TouchableOpacity
                  activeOpacity={0.88}
                  disabled={busy}
                  onPress={() => {
                    if (Platform.OS !== 'web') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    }
                    onSuggestSplits?.();
                  }}
                >
                  <View
                    style={{
                      marginBottom: 12,
                      borderRadius: 14,
                      paddingVertical: 13,
                      paddingHorizontal: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      borderWidth: 1,
                      borderColor: 'rgba(45, 255, 196, 0.35)',
                      backgroundColor: darkMode ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.08)',
                    }}
                  >
                    {suggestingSplits ? (
                      <ActivityIndicator size="small" color="#22c55e" />
                    ) : (
                      <MaterialIcons name="auto-awesome" size={18} color="#22c55e" />
                    )}
                    <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '700' }}>
                      {hasSuggestedSplits ? 'Re-suggest material & labor split' : 'Suggest material & labor split'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ) : null}

              {draft.pricingWarnings.length > 0 ? (
                <SectionCard title="Pricing warnings" Colors={Colors} darkMode={darkMode}>
                  {draft.pricingWarnings.map((warning, index) => (
                    <Text key={`warn-${index}`} style={{ color: '#fbbf24', fontSize: 13, marginBottom: 6, lineHeight: 18 }}>
                      • {warning}
                    </Text>
                  ))}
                </SectionCard>
              ) : null}

              <SectionCard title={`Rooms & areas (${draft.rooms.length})`} Colors={Colors} darkMode={darkMode}>
                {draft.rooms.map((room, index) => (
                  <View
                    key={`${room.name}-${index}`}
                    style={{
                      marginBottom: index < draft.rooms.length - 1 ? 10 : 0,
                      paddingBottom: index < draft.rooms.length - 1 ? 10 : 0,
                      borderBottomWidth: index < draft.rooms.length - 1 ? StyleSheet.hairlineWidth : 0,
                      borderBottomColor: darkMode ? 'rgba(255,255,255,0.08)' : Colors.line,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                      <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700', flex: 1 }}>{room.name}</Text>
                      <Text style={{ color: room.price != null ? Colors.text : Colors.sub, fontSize: 14, fontWeight: '700' }}>
                        {room.price != null ? formatDraftMoney(room.price) : 'Needs price'}
                      </Text>
                    </View>
                    {room.price != null && room.laborPrice != null && room.materialPrice != null ? (
                      <View style={{ flexDirection: 'row', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
                        <Text style={{ color: Colors.sub, fontSize: 11 }}>
                          Labor {formatDraftMoney(room.laborPrice)}
                          {room.splitIsSuggested ? ' (suggested)' : ''}
                        </Text>
                        <Text style={{ color: Colors.sub, fontSize: 11 }}>
                          Materials {formatDraftMoney(room.materialPrice)}
                          {room.splitIsSuggested ? ' (suggested)' : ''}
                        </Text>
                      </View>
                    ) : room.priceIncludesLaborAndMaterials ? (
                      <Text style={{ color: Colors.sub, fontSize: 11, marginTop: 4 }}>
                        Combined labor + materials (not split in notes)
                      </Text>
                    ) : null}
                    {room.scope ? (
                      <Text style={{ color: Colors.sub, fontSize: 12, marginTop: 4, lineHeight: 17 }} numberOfLines={4}>
                        {room.scope}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </SectionCard>

              {draft.allowances.length > 0 ? (
                <SectionCard title={`Allowances (${draft.allowances.length})`} Colors={Colors} darkMode={darkMode}>
                  {draft.allowances.map((allowance, index) => (
                    <Text key={`allow-${index}`} style={{ color: Colors.sub, fontSize: 13, marginBottom: 6, lineHeight: 18 }}>
                      • {allowance.name || allowance.description}
                      {allowance.amount != null ? ` — ${formatDraftMoney(allowance.amount)}` : ''}
                      {allowance.unit ? ` ${allowance.unit}` : ''}
                    </Text>
                  ))}
                </SectionCard>
              ) : null}

              {draft.missingInfo.length > 0 ? (
                <SectionCard title="Missing info" Colors={Colors} darkMode={darkMode}>
                  {draft.missingInfo.map((item, index) => (
                    <Text key={`missing-${index}`} style={{ color: Colors.sub, fontSize: 13, marginBottom: 6, lineHeight: 18 }}>
                      • {item}
                    </Text>
                  ))}
                </SectionCard>
              ) : null}
            </>
          )}
        </ScrollView>

        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom, 16),
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: darkMode ? 'rgba(255,255,255,0.08)' : Colors.line,
            backgroundColor: Colors.bg,
            gap: 10,
          }}
        >
          <AIEstimateDisclaimer variant="apply" />

          <TouchableOpacity activeOpacity={0.88} disabled={busy} onPress={onRegenerate}>
            <View
              style={{
                borderRadius: 14,
                paddingVertical: 13,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: darkMode ? 'rgba(148, 163, 184, 0.5)' : Colors.line,
              }}
            >
              <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '700' }}>Edit notes & regenerate</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.88} disabled={!draft || busy} onPress={onApply}>
            <LinearGradient
              colors={draft && !busy ? ['#2DFFC4', '#00A6FF'] : ['#64748b', '#475569']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.primaryBtn}
            >
              {applying ? (
                <ActivityIndicator color="#0f172a" />
              ) : (
                <>
                  <MaterialIcons name="check-circle" size={20} color="#0f172a" />
                  <Text style={styles.primaryBtnText}>Apply to Estimate</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
  );

  if (embedded) {
    return (
      <View style={[StyleSheet.absoluteFillObject, styles.embeddedShell, { backgroundColor: Colors.bg }]}>
        {body}
      </View>
    );
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={handleBack}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
      {body}
    </Modal>
  );
}

const styles = StyleSheet.create({
  embeddedShell: {
    zIndex: 101,
    elevation: 101,
  },
  primaryBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
  },
});
