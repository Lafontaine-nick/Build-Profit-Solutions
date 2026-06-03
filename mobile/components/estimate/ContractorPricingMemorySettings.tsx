import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Switch, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import {
  clearPricingMemory,
  fetchPricingMemoryRates,
  fetchPricingMemorySettings,
  updatePricingMemorySettings,
  type PricingMemorySettings,
} from '@/utils/contractorPricingMemory';

type Props = {
  compact?: boolean;
};

export default function ContractorPricingMemorySettings({ compact = false }: Props) {
  const { theme, darkMode } = useTheme();
  const Colors = getColors(theme);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<PricingMemorySettings | null>(null);
  const [rateCount, setRateCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, rates] = await Promise.all([
        fetchPricingMemorySettings(),
        fetchPricingMemoryRates().catch(() => []),
      ]);
      setSettings(s);
      setRateCount(rates.length);
    } catch {
      setSettings(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = async (key: keyof PricingMemorySettings, value: boolean) => {
    if (!settings) return;
    setSaving(true);
    try {
      const next = await updatePricingMemorySettings({ [key]: value });
      setSettings(next);
    } catch (e) {
      Alert.alert('Settings', (e as Error)?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    Alert.alert(
      'Clear pricing memory?',
      'This removes saved rates learned from your past bids. Draft suggestions will no longer use your history until you apply new bids.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearPricingMemory();
              setRateCount(0);
              Alert.alert('Cleared', 'Pricing memory has been cleared.');
            } catch (e) {
              Alert.alert('Error', (e as Error)?.message || 'Could not clear');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={{ padding: compact ? 8 : 14 }}>
        <ActivityIndicator color={Colors.sub} />
      </View>
    );
  }

  if (!settings) {
    return (
      <Text style={{ color: Colors.sub, fontSize: 12 }}>
        Pricing memory settings unavailable (check backend connection).
      </Text>
    );
  }

  const row = (label: string, key: keyof PricingMemorySettings, hint?: string) => (
    <View
      key={key}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
        gap: 12,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: Colors.text, fontSize: 13, fontWeight: '600' }}>{label}</Text>
        {hint ? (
          <Text style={{ color: Colors.sub, fontSize: 11, marginTop: 2, lineHeight: 15 }}>{hint}</Text>
        ) : null}
      </View>
      <Switch
        value={Boolean(settings[key])}
        disabled={saving}
        onValueChange={(v) => void patch(key, v)}
      />
    </View>
  );

  return (
    <View>
      {!compact ? (
        <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '800', marginBottom: 8 }}>
          Contractor pricing memory
        </Text>
      ) : null}
      <Text style={{ color: Colors.sub, fontSize: 12, marginBottom: 12, lineHeight: 17 }}>
        Learns from bids you apply, submit, win, or save as templates — never from canceled or unapplied AI
        drafts. Suggestions require your approval before applying.
      </Text>
      {row('Enable pricing memory', 'pricingMemoryEnabled')}
      {row('Exclude test/demo bids', 'excludeTestBids')}
      {row('Learn when applying draft', 'learnOnApply')}
      {row('Learn on submitted bids', 'learnOnSubmit')}
      {row('Learn on won bids', 'learnOnWon')}
      {row('Learn on completed projects', 'learnOnCompleted')}
      {row('Learn from saved templates', 'learnOnSavedTemplate')}
      <Text style={{ color: Colors.sub, fontSize: 11, marginTop: 4, marginBottom: 8 }}>
        Saved rates: {rateCount}
      </Text>
      <TouchableOpacity onPress={handleClear} disabled={saving || rateCount === 0}>
        <Text style={{ color: rateCount === 0 ? Colors.sub : '#f87171', fontSize: 13, fontWeight: '700' }}>
          Clear pricing memory
        </Text>
      </TouchableOpacity>
    </View>
  );
}
