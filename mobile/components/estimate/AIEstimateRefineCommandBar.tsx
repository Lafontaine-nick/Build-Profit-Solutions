import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

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
  const [examplesOpen, setExamplesOpen] = useState(false);
  const trimmed = command.trim();
  const canSubmit = trimmed.length > 0 && !refining && !busy;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmitCommand(trimmed);
    setCommand('');
  };

  return (
    <View style={{ marginBottom: 12 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 6,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <MaterialIcons name="auto-fix-high" size={15} color="#60a5fa" />
          <Text style={{ color: Colors.text, fontSize: 13, fontWeight: '700' }}>Ask AI</Text>
        </View>
        <TouchableOpacity activeOpacity={0.8} onPress={() => setExamplesOpen((v) => !v)}>
          <Text style={{ color: Colors.sub, fontSize: 12, fontWeight: '600' }}>
            {examplesOpen ? 'Hide' : 'Examples'}
          </Text>
        </TouchableOpacity>
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          borderWidth: 1,
          borderColor: trimmed
            ? 'rgba(96, 165, 250, 0.45)'
            : darkMode
              ? 'rgba(148, 163, 184, 0.18)'
              : Colors.line,
          borderRadius: 10,
          paddingLeft: 12,
          paddingRight: 5,
          paddingVertical: Platform.OS === 'ios' ? 7 : 4,
          backgroundColor: darkMode ? 'rgba(255,255,255,0.04)' : Colors.surface2,
        }}
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
          style={{ flex: 1, color: Colors.text, fontSize: 14, paddingVertical: 6 }}
        />
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={!canSubmit}
          onPress={handleSubmit}
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: canSubmit ? '#3b82f6' : 'rgba(59, 130, 246, 0.22)',
          }}
        >
          {refining ? (
            <ActivityIndicator size="small" color="#eff6ff" />
          ) : (
            <MaterialIcons name="arrow-upward" size={17} color="#eff6ff" />
          )}
        </TouchableOpacity>
      </View>

      {examplesOpen ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 8 }}
          contentContainerStyle={{ gap: 6 }}
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
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: darkMode ? 'rgba(148, 163, 184, 0.22)' : Colors.line,
                backgroundColor: darkMode ? 'rgba(255,255,255,0.03)' : Colors.surface2,
              }}
            >
              <Text style={{ color: Colors.sub, fontSize: 12 }}>{chip}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}

      {appliedSummary && appliedSummary.length > 0 ? (
        <View
          style={{
            marginTop: 8,
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 8,
          }}
        >
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
