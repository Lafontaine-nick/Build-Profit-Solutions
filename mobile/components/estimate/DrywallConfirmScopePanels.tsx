import React, { useEffect, useState } from 'react';
import {
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  DRYWALL_TEXTURE_CHOICE_OPTIONS,
  drywallFinishOptionLabel,
  hasPlanDrywallPackageTakeoff,
  shouldPinDrywallFinishCardAfterQuickMeasurements,
  type ScopeChecklistItem,
} from '@/utils/estimateScopeChecklistUi';
import {
  DRYWALL_BOARD_BUCKET_DEFINITIONS,
  DRYWALL_SHEET_LENGTH_CHOICE_OPTIONS,
  isDrywallCompletePackageScope,
  resolveDrywallBoardBucketPackageTotal,
  resolveDrywallBoardBucketSqft,
  resolveDrywallBoardMix,
  resolveDrywallSheetLengthChoiceId,
  type DrywallBoardBucketDefinition,
} from '@/utils/subcontractorTrade/drywallPlanConvergence';
import { estimateFlowCardStyle } from '@/utils/estimateFlowCardStyle';
import type { getColors } from '@/constants/Colors';

type Colors = ReturnType<typeof getColors>;

function hapticTap() {
  if (Platform.OS !== 'web') {
    Haptics.selectionAsync();
  }
}

function captionColor(darkMode: boolean, Colors: Colors) {
  return darkMode ? '#94a3b8' : Colors.sub;
}

function inactiveChoiceChipStyle(darkMode: boolean, Colors: Colors) {
  return {
    borderColor: darkMode ? 'rgba(148, 163, 184, 0.28)' : Colors.line,
    backgroundColor: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
    textColor: darkMode ? '#e5e7eb' : Colors.text,
  };
}

function formatBucketDisplay(value: number): string {
  if (!(value > 0)) return '';
  return String(Math.round(value));
}

function parseBucketInput(raw: string): number {
  const parsed = Number(String(raw || '').replace(/,/g, '').trim());
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function shouldShowPinnedDrywallAssemblyOptions(
  templateKey: string | null | undefined,
  measurements: Record<string, unknown>
): boolean {
  return (
    isDrywallCompletePackageScope({
      templateKey,
      planImportMode: measurements.planImportMode as string | null,
      planImportTradeKey: measurements.planImportTradeKey as string | null,
    }) && hasPlanDrywallPackageTakeoff(measurements)
  );
}

export function resolvePinnedDrywallFinishItem(
  templateKey: string | null | undefined,
  measurements: Record<string, unknown>,
  displayItems: ScopeChecklistItem[]
): ScopeChecklistItem | null {
  if (
    !shouldPinDrywallFinishCardAfterQuickMeasurements(
      templateKey,
      {
        planImportMode: measurements.planImportMode as string | null,
        planImportTradeKey: measurements.planImportTradeKey as string | null,
      },
      displayItems
    )
  ) {
    return null;
  }
  return displayItems.find(item => item.id === 'texture') ?? null;
}

export function filterGroupedItemsWithoutPinnedTexture(
  grouped: Array<{ title: string; items: ScopeChecklistItem[] }>,
  pinnedFinishItem: ScopeChecklistItem | null
) {
  if (!pinnedFinishItem) return grouped;
  return grouped
    .map(group => ({
      ...group,
      items: group.items.filter(item => item.id !== 'texture'),
    }))
    .filter(group => group.items.length > 0);
}

type CardStyles = {
  card: ViewStyle;
  choiceWrap: ViewStyle;
  choiceChipWide: ViewStyle;
  inputShell?: ViewStyle;
  inputText?: TextStyle;
};

function ChoiceChip({
  label,
  active,
  onPress,
  Colors,
  darkMode,
  choiceChipWide,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  Colors: Colors;
  darkMode: boolean;
  choiceChipWide: ViewStyle;
}) {
  const inactiveStyle = inactiveChoiceChipStyle(darkMode, Colors);
  let borderColor = inactiveStyle.borderColor;
  let backgroundColor = inactiveStyle.backgroundColor;
  let textColor = inactiveStyle.textColor;
  if (active) {
    borderColor = '#60a5fa';
    backgroundColor = 'rgba(96,165,250,0.18)';
    textColor = '#60a5fa';
  }
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={[choiceChipWide, { borderColor, backgroundColor }]}
    >
      <Text
        style={{
          color: textColor,
          fontSize: 12,
          fontWeight: active ? '800' : '600',
          textAlign: 'center',
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function confirmationBadge(
  confirmation: DrywallBoardBucketDefinition['confirmation'],
  darkMode: boolean
) {
  if (confirmation === 'suggested') {
    return (
      <Text
        style={{
          color: darkMode ? '#86efac' : '#15803d',
          fontSize: 10,
          fontWeight: '700',
          marginTop: 2,
        }}
      >
        Suggested from plan
      </Text>
    );
  }
  if (confirmation === 'needs_confirmation') {
    return (
      <Text
        style={{
          color: darkMode ? '#fcd34d' : '#b45309',
          fontSize: 10,
          fontWeight: '700',
          marginTop: 2,
        }}
      >
        Needs confirmation
      </Text>
    );
  }
  return null;
}

function BoardBucketQuantityRow({
  bucket,
  value,
  onCommit,
  Colors,
  darkMode,
  cardStyles,
}: {
  bucket: DrywallBoardBucketDefinition;
  value: number;
  onCommit: (sqft: number) => void;
  Colors: Colors;
  darkMode: boolean;
  cardStyles: CardStyles;
}) {
  const [draft, setDraft] = useState(formatBucketDisplay(value));
  useEffect(() => {
    setDraft(formatBucketDisplay(value));
  }, [value]);

  const inputShell = cardStyles.inputShell ?? {
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(148, 163, 184, 0.28)' : Colors.line,
    backgroundColor: darkMode ? 'rgba(255,255,255,0.05)' : Colors.surface2,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 96,
  };
  const inputText = cardStyles.inputText ?? {
    color: darkMode ? '#F5F7FA' : Colors.text,
    fontSize: 15,
    fontWeight: '700' as const,
    textAlign: 'right' as const,
  };

  return (
    <View style={{ marginBottom: 12 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 12,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: darkMode ? '#F5F7FA' : Colors.text,
              fontSize: 13,
              fontWeight: '700',
            }}
          >
            {bucket.title}
          </Text>
          <Text
            style={{
              color: captionColor(darkMode, Colors),
              fontSize: 11,
              marginTop: 2,
              lineHeight: 15,
            }}
          >
            {bucket.helperText}
          </Text>
          {confirmationBadge(bucket.confirmation, darkMode)}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <View style={[inputShell, { flexDirection: 'row', alignItems: 'center' }]}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              onBlur={() => {
                const next = parseBucketInput(draft);
                onCommit(next);
                setDraft(formatBucketDisplay(next));
              }}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={captionColor(darkMode, Colors)}
              style={[inputText, { minWidth: 72, padding: 0 }]}
            />
          </View>
          <Text
            style={{
              color: captionColor(darkMode, Colors),
              fontSize: 10,
              marginTop: 4,
              fontWeight: '600',
            }}
          >
            SF
          </Text>
        </View>
      </View>
    </View>
  );
}

export function DrywallBoardQuantitySection({
  measurements,
  onBucketChange,
  Colors,
  darkMode,
  cardStyles,
}: {
  measurements: Record<string, unknown>;
  onBucketChange: (
    measurementKey: DrywallBoardBucketDefinition['measurementKey'],
    sqft: number
  ) => void;
  Colors: Colors;
  darkMode: boolean;
  cardStyles: CardStyles;
}) {
  const planFacts = measurements.planFacts as Record<string, unknown> | null;
  const packageTotal = resolveDrywallBoardBucketPackageTotal(measurements, {
    planFacts,
  });
  const visibleBuckets = DRYWALL_BOARD_BUCKET_DEFINITIONS.filter(bucket => {
    if (bucket.id === 'moisture_resistant') {
      const sqft = resolveDrywallBoardBucketSqft(measurements, bucket.id, {
        planFacts,
      });
      return sqft > 0;
    }
    return true;
  });

  return (
    <View style={{ marginTop: 12 }}>
      <Text
        style={{
          color: captionColor(darkMode, Colors),
          fontSize: 11,
          marginBottom: 8,
          lineHeight: 15,
        }}
      >
        Drywall board quantities
      </Text>
      {visibleBuckets.map(bucket => (
        <BoardBucketQuantityRow
          key={bucket.id}
          bucket={bucket}
          value={resolveDrywallBoardBucketSqft(measurements, bucket.id, {
            planFacts,
          })}
          onCommit={sqft => onBucketChange(bucket.measurementKey, sqft)}
          Colors={Colors}
          darkMode={darkMode}
          cardStyles={cardStyles}
        />
      ))}
      {packageTotal > 0 ? (
        <Text
          style={{
            color: captionColor(darkMode, Colors),
            fontSize: 11,
            marginTop: 2,
            lineHeight: 15,
          }}
        >
          {`Board buckets total ${Math.round(packageTotal).toLocaleString()} SF`}
        </Text>
      ) : null}
    </View>
  );
}

function pinnedDrywallScopeCardStyle(
  Colors: Colors,
  darkMode: boolean,
  card: ViewStyle
): ViewStyle[] {
  return [
    card,
    estimateFlowCardStyle(Colors, darkMode),
    {
      backgroundColor: darkMode ? '#202022' : Colors.surface,
    },
  ];
}

export function PinnedDrywallAssemblyOptionsCard({
  measurements,
  onSheetLengthChange,
  onBoardBucketChange,
  Colors,
  darkMode,
  cardStyles,
}: {
  measurements: Record<string, unknown>;
  onSheetLengthChange: (sheetLength: string) => void;
  onBoardBucketChange: (
    measurementKey: DrywallBoardBucketDefinition['measurementKey'],
    sqft: number
  ) => void;
  Colors: Colors;
  darkMode: boolean;
  cardStyles: CardStyles;
}) {
  const sheetLength = resolveDrywallSheetLengthChoiceId(measurements, {
    completePackage: true,
  });
  return (
    <View style={pinnedDrywallScopeCardStyle(Colors, darkMode, cardStyles.card)}>
      <Text
        style={{
          color: darkMode ? '#F5F7FA' : Colors.text,
          fontSize: 15,
          fontWeight: '800',
        }}
      >
        Drywall board & sheet
      </Text>
      <Text
        style={{
          color: captionColor(darkMode, Colors),
          fontSize: 11,
          marginTop: 3,
          lineHeight: 15,
        }}
      >
        Confirm board SF by thickness and type. Sheet length adjusts board
        material only; labor follows finish and site access.
      </Text>
      <DrywallBoardQuantitySection
        measurements={measurements}
        onBucketChange={onBoardBucketChange}
        Colors={Colors}
        darkMode={darkMode}
        cardStyles={cardStyles}
      />
      <View style={{ marginTop: 12 }}>
        <Text
          style={{
            color: captionColor(darkMode, Colors),
            fontSize: 11,
            marginBottom: 8,
          }}
        >
          Sheet length
        </Text>
        <View style={cardStyles.choiceWrap}>
          {DRYWALL_SHEET_LENGTH_CHOICE_OPTIONS.filter(opt => opt.id !== 'unsure').map(
            opt => (
              <ChoiceChip
                key={opt.id}
                label={opt.label}
                active={sheetLength === opt.id}
                onPress={() => {
                  hapticTap();
                  onSheetLengthChange(opt.id);
                }}
                Colors={Colors}
                darkMode={darkMode}
                choiceChipWide={cardStyles.choiceChipWide}
              />
            )
          )}
        </View>
      </View>
    </View>
  );
}

export function DrywallTextureSelectedLabel({
  choiceId,
  darkMode,
}: {
  choiceId: string;
  darkMode: boolean;
}) {
  return (
    <Text
      style={{
        color: darkMode ? '#93c5fd' : '#2563eb',
        fontSize: 12,
        fontWeight: '700',
        marginTop: 10,
        lineHeight: 16,
      }}
    >
      {`Selected finish: ${drywallFinishOptionLabel(choiceId)}`}
    </Text>
  );
}

export function DrywallFinishTextureSection({
  selectedChoiceId,
  onSelect,
  Colors,
  darkMode,
  cardStyles,
}: {
  selectedChoiceId: string;
  onSelect: (choiceId: string) => void;
  Colors: Colors;
  darkMode: boolean;
  cardStyles: Pick<CardStyles, 'choiceWrap' | 'choiceChipWide'>;
}) {
  const displayedChoiceId = selectedChoiceId || 'orange_peel';
  return (
    <View style={{ marginTop: 12 }}>
      <DrywallTextureSelectedLabel
        choiceId={displayedChoiceId}
        darkMode={darkMode}
      />
      <View style={[cardStyles.choiceWrap, { marginTop: 8 }]}>
        {DRYWALL_TEXTURE_CHOICE_OPTIONS.filter(opt => opt.id !== 'unsure').map(
          opt => (
            <ChoiceChip
              key={opt.id}
              label={opt.label}
              active={displayedChoiceId === opt.id}
              onPress={() => {
                hapticTap();
                onSelect(opt.id);
              }}
              Colors={Colors}
              darkMode={darkMode}
              choiceChipWide={cardStyles.choiceChipWide}
            />
          )
        )}
      </View>
    </View>
  );
}

/** Read-only board mix for embedded scope cards. */
export function DrywallBoardMixSection({
  measurements,
  Colors,
  darkMode,
}: {
  measurements: Record<string, unknown>;
  Colors: Colors;
  darkMode: boolean;
}) {
  const zones = resolveDrywallBoardMix(measurements, {
    planFacts: measurements.planFacts as Record<string, unknown> | null,
  });
  if (!zones.length) return null;
  return (
    <View style={{ marginTop: 12 }}>
      <Text
        style={{
          color: captionColor(darkMode, Colors),
          fontSize: 11,
          marginBottom: 8,
          lineHeight: 15,
        }}
      >
        Board mix
      </Text>
      {zones.map(zone => (
        <View
          key={zone.id}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 6,
            gap: 12,
          }}
        >
          <Text
            style={{
              color: darkMode ? '#e5e7eb' : Colors.text,
              fontSize: 12,
              fontWeight: '600',
              flex: 1,
            }}
          >
            {zone.label}
          </Text>
          <Text
            style={{
              color: captionColor(darkMode, Colors),
              fontSize: 12,
              textAlign: 'right',
              flexShrink: 0,
            }}
          >
            {`${zone.sqft.toLocaleString()} SF · ${zone.boardLabel}`}
          </Text>
        </View>
      ))}
    </View>
  );
}
