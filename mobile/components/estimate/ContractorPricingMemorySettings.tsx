import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Switch, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import {
  fetchPricingMemoryRates,
  fetchPricingMemorySettings,
  updatePricingMemorySettings,
  type PricingMemorySettings,
} from '@/utils/contractorPricingMemory';
import { clearAllSavedPricingData, countSavedPricingSources } from '@/utils/estimateSavedPricingCleanup';
import ContractorPricingLibraryModal from '@/components/estimate/ContractorPricingLibraryModal';

const MINT = '#2dcc9a';
const DANGER = '#f87171';

export default function ContractorPricingMemorySettings() {
  const { theme, darkMode } = useTheme();
  const Colors = getColors(theme);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<PricingMemorySettings | null>(null);
  const [rateCount, setRateCount] = useState(0);
  const [templateCount, setTemplateCount] = useState(0);
  const [showLibrary, setShowLibrary] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, rates, sources] = await Promise.all([
        fetchPricingMemorySettings(),
        fetchPricingMemoryRates().catch(() => []),
        countSavedPricingSources().catch(() => ({ templates: 0, libraryTotal: 0 })),
      ]);
      setSettings(s);
      setRateCount(rates.length);
      setTemplateCount(sources.templates);
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
      'Reset all saved pricing?',
      'This removes saved bid templates on this device and all rates in your pricing library. Draft suggestions will not use your history until you save new bids.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAllSavedPricingData();
              setRateCount(0);
              setTemplateCount(0);
              Alert.alert('Reset complete', 'Saved templates and pricing library rates have been removed.');
            } catch (e) {
              Alert.alert('Error', (e as Error)?.message || 'Could not reset');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={{ padding: 14 }}>
        <ActivityIndicator color={Colors.sub} />
      </View>
    );
  }

  if (!settings) {
    return (
      <Text style={{ color: Colors.sub, fontSize: 13, padding: 16 }}>
        Pricing memory settings unavailable (check backend connection).
      </Text>
    );
  }

  const divider = darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.08)';
  const iconTileBg = darkMode ? '#3A3A3C' : '#e2e8f0';
  const nothingSaved = rateCount === 0 && templateCount === 0;

  const rowShell = (last: boolean) => ({
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    minHeight: 56,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
    borderBottomWidth: last ? 0 : 1,
    borderBottomColor: divider,
  });

  const rowLabel = (icon: string, label: string, detail: string, tone: string = MINT, labelColor = Colors.text) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: iconTileBg,
        }}
      >
        <MaterialIcons name={icon as any} size={20} color={tone} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: labelColor, fontSize: 16 }}>{label}</Text>
        <Text style={{ color: Colors.sub, fontSize: 13, marginTop: 2 }}>{detail}</Text>
      </View>
    </View>
  );

  const toggleRow = (icon: string, label: string, detail: string, key: keyof PricingMemorySettings) => (
    <View key={key} style={rowShell(false)}>
      {rowLabel(icon, label, detail)}
      <Switch
        value={Boolean(settings[key])}
        disabled={saving}
        onValueChange={(v) => void patch(key, v)}
        trackColor={{ false: darkMode ? '#3A3A3C' : '#cbd5e1', true: MINT }}
        thumbColor="#fff"
        ios_backgroundColor={darkMode ? '#3A3A3C' : '#cbd5e1'}
      />
    </View>
  );

  const browseRow = (icon: string, label: string, detail: string, onPress: () => void) => (
    <TouchableOpacity key={label} onPress={onPress} activeOpacity={0.6} style={rowShell(false)}>
      {rowLabel(icon, label, detail)}
      <MaterialIcons name="chevron-right" size={20} color={Colors.sub} />
    </TouchableOpacity>
  );

  return (
    <View>
      {toggleRow(
        'auto-awesome',
        'Remember my pricing',
        'Suggest your approved rates',
        'pricingMemoryEnabled'
      )}
      {browseRow(
        'library-books',
        'Pricing library',
        rateCount === 0 ? 'View and manage saved rates' : `${rateCount} saved rate${rateCount === 1 ? '' : 's'}`,
        () => setShowLibrary(true)
      )}
      <TouchableOpacity
        onPress={handleClear}
        disabled={saving || nothingSaved}
        activeOpacity={0.6}
        style={rowShell(true)}
      >
        {rowLabel(
          'delete-outline',
          'Reset saved pricing',
          nothingSaved ? 'Nothing saved yet' : 'Removes saved rates and bid templates',
          nothingSaved ? Colors.sub : DANGER,
          nothingSaved ? Colors.sub : DANGER
        )}
      </TouchableOpacity>

      <ContractorPricingLibraryModal
        visible={showLibrary}
        onClose={() => {
          setShowLibrary(false);
          void load();
        }}
      />
    </View>
  );
}
