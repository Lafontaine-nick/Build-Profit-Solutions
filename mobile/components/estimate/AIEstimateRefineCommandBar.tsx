import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import ReliableFlowPress from '@/components/estimate/ReliableFlowPress';
import { estimateFlowCardStyle } from '@/utils/estimateFlowCardStyle';

type Colors = {
  text: string;
  sub: string;
  line: string;
  surface2: string;
};

type Props = {
  Colors: Colors;
  darkMode: boolean;
  busy: boolean;
  refining: boolean;
  appliedSummary?: string[] | null;
  lastCommand?: string | null;
  /** After measurements land — soft placeholder hint only. */
  showPricingNudge?: boolean;
  onSubmitCommand: (command: string) => void;
  onDismissSummary?: () => void;
  /** `hero` — compact FAB in card corner; expanded panel inline. `inline` — full-width collapsed bar. */
  variant?: 'inline' | 'hero';
};

const EXAMPLE_CHIPS = [
  'set framing to $17,000',
  'cabinets $8k material $4k labor',
  'add landscaping $3,500',
  'remove demo, customer doing it',
];

export default function AIEstimateRefineCommandBar({
  Colors,
  darkMode,
  busy,
  refining,
  appliedSummary,
  lastCommand,
  showPricingNudge = false,
  onSubmitCommand,
  onDismissSummary,
  variant = 'inline',
}: Props) {
  const [command, setCommand] = useState('');
  /** Collapsed by default — keep Step 3 focused on the scope list. */
  const [expanded, setExpanded] = useState(false);
  const [examplesOpen, setExamplesOpen] = useState(false);
  const trimmed = command.trim();
  const canSubmit = trimmed.length > 0 && !refining && !busy;
  const hasSummary = Boolean(appliedSummary?.length);

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmitCommand(trimmed);
    setCommand('');
  };

  const summaryBanner = hasSummary ? (
    <View style={[styles.summaryBanner, variant === 'hero' ? { marginTop: 12, marginBottom: 0 } : null]}>
      <MaterialIcons name="check-circle" size={14} color="#22c55e" style={{ marginTop: 1 }} />
      <Text style={{ color: Colors.sub, fontSize: 12, lineHeight: 16, flex: 1 }}>
        {lastCommand ? `“${lastCommand}” · ` : ''}
        {(appliedSummary || []).slice(0, 2).join(' · ')}
        {(appliedSummary || []).length > 2 ? ` · +${(appliedSummary || []).length - 2} more` : ''}
      </Text>
      {onDismissSummary ? (
        <TouchableOpacity activeOpacity={0.75} onPress={onDismissSummary} hitSlop={8}>
          <MaterialIcons name="close" size={15} color={Colors.sub} />
        </TouchableOpacity>
      ) : null}
    </View>
  ) : null;

  const expandedPanel = expanded ? (
        <View
          style={
            variant === 'hero'
              ? [
                  styles.heroPanel,
                  {
                    borderColor: darkMode ? 'rgba(148, 163, 184, 0.18)' : Colors.line,
                    backgroundColor: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                  },
                ]
              : estimateFlowCardStyle(Colors, darkMode, { marginBottom: 0 })
          }
        >
          <View style={styles.titleRow}>
            <View style={styles.titleLeft}>
              <View
                style={[
                  styles.iconBadge,
                  {
                    backgroundColor: darkMode ? 'rgba(34, 197, 94, 0.16)' : 'rgba(34, 197, 94, 0.12)',
                  },
                ]}
              >
                <MaterialIcons name="auto-fix-high" size={16} color="#22c55e" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '700' }}>Ask AI</Text>
                <Text style={{ color: Colors.sub, fontSize: 12, lineHeight: 16, marginTop: 1 }}>
                  Change prices or scope in plain English
                </Text>
              </View>
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setExpanded(false)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Hide Ask AI"
            >
              <Text style={{ color: Colors.sub, fontSize: 13, fontWeight: '600' }}>Hide</Text>
            </TouchableOpacity>
          </View>

          <View
            style={[
              styles.inputRow,
              {
                borderColor: trimmed
                  ? 'rgba(34, 197, 94, 0.45)'
                  : darkMode
                    ? 'rgba(148, 163, 184, 0.2)'
                    : Colors.line,
                backgroundColor: darkMode ? 'rgba(255,255,255,0.04)' : Colors.surface2,
              },
            ]}
          >
            <TextInput
              value={command}
              onChangeText={setCommand}
              editable={!refining && !busy}
              placeholder={
                showPricingNudge
                  ? 'Set a price… e.g. cabinets $8,000'
                  : 'e.g. set framing $7k material $10k labor'
              }
              placeholderTextColor={darkMode ? 'rgba(148, 163, 184, 0.55)' : '#94a3b8'}
              returnKeyType="send"
              onSubmitEditing={handleSubmit}
              style={{ flex: 1, color: Colors.text, fontSize: 15, paddingVertical: 8 }}
            />
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={!canSubmit}
              onPress={handleSubmit}
              accessibilityRole="button"
              accessibilityLabel="Send Ask AI command"
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: canSubmit
                  ? '#22c55e'
                  : darkMode
                    ? 'rgba(34, 197, 94, 0.22)'
                    : 'rgba(34, 197, 94, 0.28)',
              }}
            >
              {refining ? (
                <ActivityIndicator size="small" color="#0f172a" />
              ) : (
                <MaterialIcons
                  name="arrow-upward"
                  size={18}
                  color={canSubmit ? '#0f172a' : 'rgba(15, 23, 42, 0.45)'}
                />
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setExamplesOpen((v) => !v)}
            hitSlop={8}
            style={{ marginTop: 10, alignSelf: 'flex-start' }}
            accessibilityRole="button"
          >
            <Text style={{ color: Colors.sub, fontSize: 12, fontWeight: '600' }}>
              {examplesOpen ? 'Hide examples' : 'Examples'}
            </Text>
          </TouchableOpacity>

          {examplesOpen ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginTop: 8 }}
              contentContainerStyle={{ gap: 8 }}
            >
              {EXAMPLE_CHIPS.map((chip) => (
                <TouchableOpacity
                  key={chip}
                  activeOpacity={0.85}
                  disabled={refining || busy}
                  onPress={() => {
                    setCommand(chip);
                    setExamplesOpen(false);
                  }}
                  style={[
                    styles.chip,
                    {
                      borderColor: darkMode ? 'rgba(148, 163, 184, 0.22)' : Colors.line,
                      backgroundColor: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                    },
                  ]}
                >
                  <Text style={{ color: Colors.sub, fontSize: 12, fontWeight: '600' }}>{chip}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : null}
        </View>
  ) : null;

  if (variant === 'hero') {
    return (
      <>
        {!expanded ? (
          <View style={styles.heroFabAnchor}>
            <ReliableFlowPress
              onPress={() => setExpanded(true)}
              style={[
                styles.heroFab,
                {
                  backgroundColor: darkMode ? 'rgba(34, 197, 94, 0.14)' : 'rgba(34, 197, 94, 0.1)',
                  borderColor: darkMode ? 'rgba(34, 197, 94, 0.35)' : 'rgba(34, 197, 94, 0.28)',
                },
              ]}
              accessibilityLabel="Ask AI to change prices or scope"
            >
              <MaterialIcons name="auto-fix-high" size={22} color="#22c55e" />
            </ReliableFlowPress>
          </View>
        ) : null}
        {!expanded ? summaryBanner : null}
        {expandedPanel}
      </>
    );
  }

  return (
    <View style={{ marginBottom: 12 }}>
      {summaryBanner}
      {expandedPanel}
      {!expanded ? (
        <ReliableFlowPress
          onPress={() => setExpanded(true)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 12,
            backgroundColor: darkMode ? 'rgba(34, 197, 94, 0.08)' : 'rgba(34, 197, 94, 0.06)',
          }}
          accessibilityLabel="Open Ask AI to change prices or scope"
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, paddingRight: 8 }}>
            <MaterialIcons name="auto-fix-high" size={15} color="#22c55e" />
            <Text style={{ color: Colors.text, fontSize: 13, fontWeight: '600', flexShrink: 1 }}>
              Ask AI
            </Text>
            <Text style={{ color: Colors.sub, fontSize: 12, flexShrink: 1 }} numberOfLines={1}>
              {showPricingNudge ? 'Set a missing price' : 'Change prices or scope'}
            </Text>
          </View>
          <Text style={{ color: '#22c55e', fontSize: 13, fontWeight: '600' }}>Show</Text>
        </ReliableFlowPress>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  collapsedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  openPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 8,
    paddingLeft: 12,
    paddingRight: 8,
    borderRadius: 999,
    backgroundColor: '#22c55e',
  },
  openPillText: {
    color: '#052e16',
    fontSize: 13,
    fontWeight: '800',
  },
  summaryBanner: {
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  titleLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingLeft: 12,
    paddingRight: 5,
    paddingVertical: Platform.OS === 'ios' ? 6 : 4,
  },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  heroFabAnchor: {
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 2,
  },
  heroFab: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  heroPanel: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
