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
  shouldPinDrywallFinishCardAfterQuickMeasurements,
  type ScopeChecklistItem,
} from '@/utils/estimateScopeChecklistUi';
import {
  DRYWALL_BOARD_BUCKET_DEFINITIONS,
  drywallReviewSurfaces,
  resolveDrywallBoardBucketPackageTotal,
  resolveDrywallBoardMix,
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
        Planning estimate
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
  onSurfaceChange,
  Colors,
  darkMode,
  cardStyles,
}: {
  measurements: Record<string, unknown>;
  onSurfaceChange: (surface: 'house' | 'garage', sqft: number) => void;
  Colors: Colors;
  darkMode: boolean;
  cardStyles: CardStyles;
}) {
  const planFacts = measurements.planFacts as Record<string, unknown> | null;
  const packageTotal = resolveDrywallBoardBucketPackageTotal(measurements, {
    planFacts,
  });
  const surfaces = drywallReviewSurfaces(measurements);
  const rows: Array<{
    id: 'house' | 'garage';
    bucket: DrywallBoardBucketDefinition;
    value: number;
  }> = [
    {
      id: 'house',
      value: surfaces.houseInteriorSqft,
      bucket: {
        ...DRYWALL_BOARD_BUCKET_DEFINITIONS[0],
        title: 'House interior',
        helperText: 'Walls and ceilings. 1/2" on the walls, 5/8" on the ceilings.',
        confirmation: 'optional',
      },
    },
    {
      id: 'garage',
      value: surfaces.garageSqft,
      bucket: {
        ...DRYWALL_BOARD_BUCKET_DEFINITIONS[2],
        title: 'Garage',
        helperText: 'Garage walls and ceiling, hung as 5/8" Type X.',
        confirmation: 'optional',
      },
    },
  ];

  return (
    <View style={{ marginTop: 12 }}>
      {rows.map(row => (
        <BoardBucketQuantityRow
          key={row.id}
          bucket={row.bucket}
          value={row.value}
          onCommit={sqft => onSurfaceChange(row.id, sqft)}
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
          {`Drywall package ${Math.round(packageTotal).toLocaleString()} SF`}
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

function YesNoRow({
  label,
  included,
  onChange,
  Colors,
  darkMode,
}: {
  label: string;
  included: boolean;
  onChange: (included: boolean) => void;
  Colors: Colors;
  darkMode: boolean;
}) {
  return (
    <View style={{ marginTop: 14 }}>
      <Text
        style={{
          color: darkMode ? '#F5F7FA' : Colors.text,
          fontSize: 13,
          fontWeight: '700',
          marginBottom: 8,
        }}
      >
        {label}
      </Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(
          [
            { label: 'Yes', value: true },
            { label: 'No', value: false },
          ] as const
        ).map(choice => {
          const active = included === choice.value;
          const yes = choice.value;
          return (
            <TouchableOpacity
              key={choice.label}
              activeOpacity={0.88}
              onPress={() => {
                hapticTap();
                onChange(choice.value);
              }}
              style={{
                flex: 1,
                minHeight: 40,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: active
                  ? yes
                    ? 'rgba(45, 204, 154, 0.16)'
                    : darkMode
                      ? 'rgba(255,255,255,0.08)'
                      : 'rgba(15,23,42,0.06)'
                  : darkMode
                    ? 'rgba(255,255,255,0.03)'
                    : 'rgba(0,0,0,0.02)',
                borderWidth: 1,
                borderColor: active
                  ? yes
                    ? 'rgba(45, 204, 154, 0.55)'
                    : darkMode
                      ? 'rgba(255,255,255,0.28)'
                      : 'rgba(15,23,42,0.28)'
                  : darkMode
                    ? 'rgba(255,255,255,0.1)'
                    : Colors.line,
              }}
            >
              <Text
                style={{
                  color: active
                    ? yes
                      ? '#8eecc9'
                      : darkMode
                        ? '#F5F7FA'
                        : Colors.text
                    : darkMode
                      ? '#94a3b8'
                      : Colors.sub,
                  fontSize: 14,
                  fontWeight: active ? '700' : '600',
                }}
              >
                {choice.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export function DrywallFinishQuickMeasurementToggles({
  tapeIncluded,
  textureIncluded,
  onTapeChange,
  onTextureChange,
  Colors,
  darkMode,
}: {
  tapeIncluded: boolean;
  textureIncluded: boolean;
  onTapeChange: (included: boolean) => void;
  onTextureChange: (included: boolean) => void;
  Colors: Colors;
  darkMode: boolean;
}) {
  return (
    <View style={{ marginTop: 4, marginBottom: 6 }}>
      <YesNoRow
        label="Tape and mud"
        included={tapeIncluded}
        onChange={onTapeChange}
        Colors={Colors}
        darkMode={darkMode}
      />
      <YesNoRow
        label="Drywall texture"
        included={textureIncluded}
        onChange={onTextureChange}
        Colors={Colors}
        darkMode={darkMode}
      />
    </View>
  );
}

function FinishPriceLine({
  label,
  priceLabel,
}: {
  label: string;
  priceLabel: string;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 12,
        gap: 12,
      }}
    >
      <Text style={{ color: '#cbd5e1', fontSize: 14, fontWeight: '700', flex: 1 }}>
        {label}
      </Text>
      <Text style={{ color: '#2dcc9a', fontSize: 22, fontWeight: '800' }}>
        {priceLabel}
      </Text>
    </View>
  );
}

export function DrywallFinishCrewCard({
  tapeIncluded,
  textureIncluded,
  tapePriceLabel,
  texturePriceLabel,
  finishChoiceId,
  onFinishChange,
  Colors,
  darkMode,
  cardStyles,
}: {
  tapeIncluded: boolean;
  textureIncluded: boolean;
  tapePriceLabel: string | null;
  texturePriceLabel: string | null;
  finishChoiceId: string;
  onFinishChange: (choiceId: string) => void;
  Colors: Colors;
  darkMode: boolean;
  cardStyles: CardStyles;
}) {
  return (
    <View style={pinnedDrywallScopeCardStyle(Colors, darkMode, cardStyles.card)}>
      <Text
        style={{
          color: darkMode ? '#F5F7FA' : Colors.text,
          fontSize: 15,
          fontWeight: '800',
        }}
      >
        Drywall finish
      </Text>
      {!tapeIncluded && !textureIncluded ? (
        <Text
          style={{
            color: captionColor(darkMode, Colors),
            fontSize: 12,
            lineHeight: 16,
            marginTop: 6,
          }}
        >
          Choose tape and mud or texture in Quick measurements to price this card.
        </Text>
      ) : null}
      {tapeIncluded && tapePriceLabel ? (
        <FinishPriceLine label="Tape and mud" priceLabel={tapePriceLabel} />
      ) : null}
      {textureIncluded && texturePriceLabel ? (
        <FinishPriceLine label="Texture" priceLabel={texturePriceLabel} />
      ) : null}
      {textureIncluded ? (
        <DrywallFinishTextureSection
          selectedChoiceId={finishChoiceId}
          onSelect={onFinishChange}
          Colors={Colors}
          darkMode={darkMode}
          cardStyles={cardStyles}
        />
      ) : null}
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

const TEXTURE_FINISH_SHORT_LABEL: Record<string, string> = {
  orange_peel: 'Orange peel',
  knockdown: 'Knockdown',
  skip_trowel: 'Skip trowel',
  smooth_level_4: 'Level 4',
  smooth_level_5: 'Level 5',
  custom_specialty: 'Custom',
};

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
  const selectedNote = drywallFinishOptionLabel(displayedChoiceId);
  return (
    <View style={{ marginTop: 14 }}>
      <Text
        style={{
          color: captionColor(darkMode, Colors),
          fontSize: 11,
          fontWeight: '700',
          marginBottom: 8,
        }}
      >
        Texture finish
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {DRYWALL_TEXTURE_CHOICE_OPTIONS.filter(opt => opt.id !== 'unsure').map(
          opt => (
            <ChoiceChip
              key={opt.id}
              label={TEXTURE_FINISH_SHORT_LABEL[opt.id] || opt.label}
              active={displayedChoiceId === opt.id}
              onPress={() => {
                hapticTap();
                onSelect(opt.id);
              }}
              Colors={Colors}
              darkMode={darkMode}
              choiceChipWide={{
                width: '48%',
                minWidth: '48%',
                flexGrow: 0,
                paddingVertical: 10,
                paddingHorizontal: 8,
                borderRadius: 12,
                borderWidth: 1,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            />
          )
        )}
      </View>
      <Text
        style={{
          color: captionColor(darkMode, Colors),
          fontSize: 11,
          lineHeight: 15,
          marginTop: 8,
        }}
      >
        {selectedNote}
      </Text>
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
