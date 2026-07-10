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
}: Props) {
  const [command, setCommand] = useState('');
  const [examplesOpen, setExamplesOpen] = useState(true);
  const trimmed = command.trim();
  const canSubmit = trimmed.length > 0 && !refining && !busy;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmitCommand(trimmed);
    setCommand('');
  };

  return (
    <View style={estimateFlowCardStyle(Colors, darkMode, { marginBottom: 12 })}>
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
            <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '800' }}>Ask AI</Text>
            <Text style={{ color: Colors.sub, fontSize: 12, lineHeight: 16, marginTop: 1 }}>
              Change prices or scope in plain English
            </Text>
          </View>
        </View>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setExamplesOpen((v) => !v)}
          hitSlop={8}
          accessibilityRole="button"
        >
          <Text style={{ color: Colors.sub, fontSize: 12, fontWeight: '700' }}>
            {examplesOpen ? 'Hide' : 'Examples'}
          </Text>
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
            width: 40,
            height: 40,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: canSubmit ? '#22c55e' : darkMode ? 'rgba(34, 197, 94, 0.22)' : 'rgba(34, 197, 94, 0.28)',
          }}
        >
          {refining ? (
            <ActivityIndicator size="small" color="#0f172a" />
          ) : (
            <MaterialIcons name="arrow-upward" size={18} color={canSubmit ? '#0f172a' : 'rgba(15, 23, 42, 0.45)'} />
          )}
        </TouchableOpacity>
      </View>

      {examplesOpen ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 10 }}
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

      {appliedSummary && appliedSummary.length > 0 ? (
        <View style={styles.summaryRow}>
          <MaterialIcons name="check-circle" size={14} color="#22c55e" style={{ marginTop: 1 }} />
          <Text style={{ color: Colors.sub, fontSize: 12, lineHeight: 16, flex: 1 }}>
            {lastCommand ? `“${lastCommand}” · ` : ''}
            {appliedSummary.slice(0, 2).join(' · ')}
            {appliedSummary.length > 2 ? ` · +${appliedSummary.length - 2} more` : ''}
          </Text>
          {onDismissSummary ? (
            <TouchableOpacity activeOpacity={0.75} onPress={onDismissSummary} hitSlop={8}>
              <MaterialIcons name="close" size={15} color={Colors.sub} />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingLeft: 12,
    paddingRight: 5,
    paddingVertical: Platform.OS === 'ios' ? 6 : 4,
  },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 9,
    borderWidth: 1,
  },
  summaryRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
});
