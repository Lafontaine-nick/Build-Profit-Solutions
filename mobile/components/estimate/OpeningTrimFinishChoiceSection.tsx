import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  composeTrimFinishChoiceId,
  parseTrimFinishChoice,
  splitTrimFinishChoice,
  TRIM_FINISH_GRADE_OPTIONS,
  TRIM_FINISH_LOCATION_OPTIONS,
  type TrimFinishCoverage,
  type TrimFinishGrade,
} from '@/utils/windowsDoorsTrimFinishPricing';

function hapticTap() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

type ChipColors = {
  borderColor: string;
  backgroundColor: string;
  textColor: string;
};

type OpeningTrimFinishChoiceSectionProps = {
  choiceId: string | null | undefined;
  fieldFinishIncluded: boolean;
  onChoiceChange: (choiceId: string | null) => void;
  onFieldFinishIncludedChange: (included: boolean) => void;
  inactiveChipStyle: ChipColors;
  captionColor: string;
  darkMode: boolean;
  styles: {
    choiceWrap: object;
    choiceChipWide: object;
  };
};

function activeChipStyle(
  isUnsure: boolean,
  isExcluded: boolean,
  darkMode: boolean
): ChipColors {
  if (isUnsure) {
    return {
      borderColor: 'rgba(251,191,36,0.55)',
      backgroundColor: 'rgba(251,191,36,0.12)',
      textColor: '#d4a017',
    };
  }
  if (isExcluded) {
    return {
      borderColor: darkMode ? 'rgba(148, 163, 184, 0.28)' : 'rgba(148, 163, 184, 0.35)',
      backgroundColor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
      textColor: darkMode ? '#F5F7FA' : '#111827',
    };
  }
  return {
    borderColor: '#60a5fa',
    backgroundColor: 'rgba(96,165,250,0.18)',
    textColor: '#60a5fa',
  };
}

function isCommittedTrimFinishChoice(
  choiceId: string | null | undefined
): boolean {
  const id = String(choiceId || '').trim();
  if (!id) return false;
  return (
    id === 'not_in_scope' ||
    id === 'unsure' ||
    parseTrimFinishChoice(id) != null
  );
}

export function OpeningTrimFinishChoiceSection({
  choiceId,
  fieldFinishIncluded,
  onChoiceChange,
  onFieldFinishIncludedChange,
  inactiveChipStyle,
  captionColor,
  darkMode,
  styles,
}: OpeningTrimFinishChoiceSectionProps) {
  const parsed = splitTrimFinishChoice(choiceId);
  const [draftCoverage, setDraftCoverage] = useState<
    TrimFinishCoverage | 'not_in_scope' | 'unsure' | null | undefined
  >(undefined);
  const [draftGrade, setDraftGrade] = useState<
    TrimFinishGrade | null | undefined
  >(undefined);
  const onChoiceChangeRef = useRef(onChoiceChange);
  onChoiceChangeRef.current = onChoiceChange;

  useEffect(() => {
    if (!isCommittedTrimFinishChoice(choiceId)) return;
    setDraftCoverage(undefined);
    setDraftGrade(undefined);
  }, [choiceId]);

  const displayedCoverage =
    draftCoverage !== undefined ? draftCoverage : parsed.coverage;
  const displayedGrade = draftGrade !== undefined ? draftGrade : parsed.grade;

  const commitComposite = useCallback(
    (coverage: TrimFinishCoverage, grade: TrimFinishGrade) => {
      onChoiceChangeRef.current(composeTrimFinishChoiceId(coverage, grade));
    },
    []
  );

  const handleLocationPress = (locationId: string) => {
    hapticTap();
    if (locationId === 'not_in_scope' || locationId === 'unsure') {
      const next = choiceId === locationId ? null : locationId;
      setDraftCoverage(next as 'not_in_scope' | 'unsure' | null);
      setDraftGrade(null);
      onChoiceChangeRef.current(next);
      return;
    }

    const coverage = locationId as TrimFinishCoverage;
    const isActive = displayedCoverage === coverage;
    if (isActive) {
      setDraftCoverage(null);
      setDraftGrade(null);
      onChoiceChangeRef.current(null);
      return;
    }

    setDraftCoverage(coverage);
    const gradeToCommit =
      draftGrade !== undefined ? draftGrade : parsed.grade;
    if (gradeToCommit) {
      setDraftGrade(gradeToCommit);
      commitComposite(coverage, gradeToCommit);
    }
  };

  const handleGradePress = (gradeId: string) => {
    hapticTap();
    const grade = gradeId as TrimFinishGrade;
    const coverage = displayedCoverage;
    if (
      coverage !== 'interior' &&
      coverage !== 'exterior' &&
      coverage !== 'both'
    ) {
      return;
    }
    const isActive = displayedGrade === grade;
    if (isActive) {
      setDraftGrade(null);
      onChoiceChangeRef.current(null);
      return;
    }
    setDraftGrade(grade);
    if (grade === 'unfinished') {
      onFieldFinishIncludedChange(false);
    }
    commitComposite(coverage, grade);
  };

  const showGradeStep =
    displayedCoverage === 'interior' ||
    displayedCoverage === 'exterior' ||
    displayedCoverage === 'both';
  const showFieldFinishToggle =
    showGradeStep &&
    (displayedGrade === 'paint_grade' || displayedGrade === 'stain_grade');

  return (
    <>
      <Text
        style={{
          color: captionColor,
          fontSize: 11,
          marginTop: 8,
          marginBottom: 6,
          lineHeight: 15,
          fontWeight: '700',
        }}
      >
        Trim location
      </Text>
      <View style={styles.choiceWrap}>
        {TRIM_FINISH_LOCATION_OPTIONS.map(opt => {
          const active = displayedCoverage === opt.id;
          const isUnsure = opt.id === 'unsure';
          const isExcluded = opt.id === 'not_in_scope';
          const chipStyle = active
            ? activeChipStyle(isUnsure, isExcluded, darkMode)
            : inactiveChipStyle;
          return (
            <TouchableOpacity
              key={opt.id}
              activeOpacity={0.88}
              onPress={() => handleLocationPress(opt.id)}
              style={[
                styles.choiceChipWide,
                {
                  borderColor: chipStyle.borderColor,
                  backgroundColor: chipStyle.backgroundColor,
                },
              ]}
            >
              <Text
                style={{
                  color: chipStyle.textColor,
                  fontSize: 12,
                  fontWeight: active ? '800' : '600',
                  textAlign: 'center',
                }}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {showGradeStep ? (
        <>
          <Text
            style={{
              color: captionColor,
              fontSize: 11,
              marginTop: 12,
              marginBottom: 6,
              lineHeight: 15,
              fontWeight: '700',
            }}
          >
            Trim material / finish
          </Text>
          <View style={[styles.choiceWrap, { flexDirection: 'row', gap: 8 }]}>
            {TRIM_FINISH_GRADE_OPTIONS.map(opt => {
              const active = displayedGrade === opt.id;
              const chipStyle = active
                ? activeChipStyle(false, false, darkMode)
                : inactiveChipStyle;
              return (
                <TouchableOpacity
                  key={opt.id}
                  activeOpacity={0.88}
                  onPress={() => handleGradePress(opt.id)}
                  style={[
                    styles.choiceChipWide,
                    { flex: 1, minWidth: 0 },
                    {
                      borderColor: chipStyle.borderColor,
                      backgroundColor: chipStyle.backgroundColor,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: chipStyle.textColor,
                      fontSize: 11,
                      fontWeight: active ? '800' : '600',
                      textAlign: 'center',
                    }}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      ) : null}

      {showFieldFinishToggle ? (
        <View style={{ marginTop: 12 }}>
          <Text
            style={{
              color: captionColor,
              fontSize: 11,
              marginBottom: 6,
              lineHeight: 15,
              fontWeight: '700',
            }}
          >
            Field finishing
          </Text>
          <View style={[styles.choiceWrap, { flexDirection: 'row', gap: 8 }]}>
            {[
              { id: false, label: 'Install only' },
              { id: true, label: 'Include paint / stain' },
            ].map(opt => {
              const active = fieldFinishIncluded === opt.id;
              const chipStyle = active
                ? activeChipStyle(false, false, darkMode)
                : inactiveChipStyle;
              return (
                <TouchableOpacity
                  key={String(opt.id)}
                  activeOpacity={0.88}
                  onPress={() => {
                    hapticTap();
                    onFieldFinishIncludedChange(opt.id);
                  }}
                  style={[
                    styles.choiceChipWide,
                    { flex: 1 },
                    {
                      borderColor: chipStyle.borderColor,
                      backgroundColor: chipStyle.backgroundColor,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: chipStyle.textColor,
                      fontSize: 11,
                      fontWeight: active ? '800' : '600',
                      textAlign: 'center',
                    }}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text
            style={{
              color: captionColor,
              fontSize: 10,
              marginTop: 6,
              lineHeight: 14,
            }}
          >
            Paint-grade and stain-grade describe the trim material. Select
            field finishing only when onsite paint or stain is included.
          </Text>
        </View>
      ) : null}
    </>
  );
}
