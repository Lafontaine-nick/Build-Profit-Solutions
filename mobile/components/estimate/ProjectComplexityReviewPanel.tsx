import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import type { ProjectComplexitySettings } from '@/utils/projectComplexityAdjustments';
import {
  calculateProjectComplexityMultiplier,
  formatComplexityPercent,
  inferProjectComplexitySettings,
  summarizeProjectComplexity,
} from '@/utils/projectComplexityAdjustments';
import { estimateFlowCardStyle } from '@/utils/estimateFlowCardStyle';

type Colors = {
  text: string;
  sub: string;
  line: string;
  bg: string;
  surface2: string;
};

type Props = {
  Colors: Colors;
  darkMode: boolean;
  floorAreaSqft?: number | null;
  storyCount?: number | null;
  projectComplexity?: ProjectComplexitySettings | null;
  plumbingComplexityFactors?: Array<{ key?: string; label?: string }> | null;
  disabled?: boolean;
  onChange?: (next: ProjectComplexitySettings) => void;
};

const CONSTRUCTION_OPTIONS = [
  { id: 'production', label: 'Production' },
  { id: 'standard', label: 'Standard' },
  { id: 'custom', label: 'Custom' },
  { id: 'luxury', label: 'Luxury' },
] as const;

export default function ProjectComplexityReviewPanel({
  Colors,
  darkMode,
  floorAreaSqft,
  storyCount,
  projectComplexity,
  plumbingComplexityFactors,
  disabled,
  onChange,
}: Props) {
  const settings = useMemo(
    () =>
      inferProjectComplexitySettings({
        floorAreaSqft,
        storyCount,
        projectComplexity,
        plumbingComplexityFactors,
      }),
    [floorAreaSqft, storyCount, projectComplexity, plumbingComplexityFactors]
  );
  const breakdown = useMemo(
    () => calculateProjectComplexityMultiplier(settings),
    [settings]
  );
  const rows = useMemo(() => summarizeProjectComplexity(settings), [settings]);
  const card = estimateFlowCardStyle(Colors, darkMode, { marginBottom: 10 });

  const update = (patch: Partial<ProjectComplexitySettings>) => {
    onChange?.({
      ...settings,
      ...patch,
    });
  };

  const chip = (selected: boolean) => ({
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: selected ? '#22c55e' : Colors.line,
    backgroundColor: selected ? 'rgba(34,197,94,0.12)' : Colors.surface2,
  });

  return (
    <View style={card}>
      <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '800', marginBottom: 4 }}>
        Project complexity
      </Text>
      <Text style={{ color: Colors.sub, fontSize: 12, lineHeight: 17, marginBottom: 10 }}>
        Adjusts suggested labor on top of national/regional base rates. Takeoff quantities are unchanged.
      </Text>

      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        {(['automatic', 'manual'] as const).map(mode => (
          <TouchableOpacity
            key={mode}
            disabled={disabled || !onChange}
            style={chip(settings.mode === mode)}
            onPress={() => update({ mode })}
          >
            <Text style={{ color: Colors.text, fontSize: 12, fontWeight: '700' }}>
              {mode === 'automatic' ? 'Automatic' : 'Manual'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {settings.mode === 'manual' ? (
        <View style={{ marginBottom: 12 }}>
          <Text style={{ color: Colors.sub, fontSize: 12, marginBottom: 6 }}>
            Manual adjustment ({formatComplexityPercent(breakdown.totalMultiplier)})
          </Text>
          <TextInput
            editable={!disabled && Boolean(onChange)}
            keyboardType='decimal-pad'
            value={String(
              settings.manualMultiplier != null
                ? Math.round((settings.manualMultiplier - 1) * 100)
                : 0
            )}
            onChangeText={text => {
              const pct = Number(String(text).replace(/[^\d-]/g, ''));
              if (!Number.isFinite(pct)) return;
              update({ manualMultiplier: 1 + pct / 100 });
            }}
            style={{
              borderWidth: 1,
              borderColor: Colors.line,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 10,
              color: Colors.text,
              backgroundColor: Colors.surface2,
            }}
            placeholder='0'
            placeholderTextColor={Colors.sub}
          />
          <Text style={{ color: Colors.sub, fontSize: 11, marginTop: 6 }}>
            Range −25% to +50%
          </Text>
        </View>
      ) : (
        <>
          <Text style={{ color: Colors.sub, fontSize: 12, marginBottom: 8 }}>
            Construction type
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {CONSTRUCTION_OPTIONS.map(option => (
              <TouchableOpacity
                key={option.id}
                disabled={disabled || !onChange}
                style={chip(settings.constructionType === option.id)}
                onPress={() => update({ constructionType: option.id })}
              >
                <Text style={{ color: Colors.text, fontSize: 12, fontWeight: '600' }}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={{ color: Colors.sub, fontSize: 12, marginBottom: 8 }}>
            Site access
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            {(['normal', 'difficult'] as const).map(option => (
              <TouchableOpacity
                key={option}
                disabled={disabled || !onChange}
                style={chip(settings.accessibility === option)}
                onPress={() => update({ accessibility: option })}
              >
                <Text style={{ color: Colors.text, fontSize: 12, fontWeight: '600' }}>
                  {option === 'normal' ? 'Normal' : 'Difficult'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {rows.map(row => (
            <View
              key={row.label}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginBottom: 6,
              }}
            >
              <Text style={{ color: Colors.sub, fontSize: 12, flex: 1 }}>
                {row.label}: {row.detail}
              </Text>
              <Text style={{ color: '#86efac', fontSize: 12, fontWeight: '700' }}>
                {row.percent}
              </Text>
            </View>
          ))}
        </>
      )}

      <View
        style={{
          marginTop: 8,
          paddingTop: 10,
          borderTopWidth: 1,
          borderTopColor: Colors.line,
        }}
      >
        <Text style={{ color: Colors.text, fontSize: 13, fontWeight: '800' }}>
          Total adjustment: {formatComplexityPercent(breakdown.totalMultiplier)}
        </Text>
        {breakdown.capped ? (
          <Text style={{ color: '#fbbf24', fontSize: 11, marginTop: 4 }}>
            Capped to keep automatic adjustments within planning bounds.
          </Text>
        ) : null}
      </View>
    </View>
  );
}
