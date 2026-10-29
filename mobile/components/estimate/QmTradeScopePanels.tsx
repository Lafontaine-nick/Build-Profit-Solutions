import React, {
  forwardRef,
  startTransition,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  aiScopeConfirmNumericKeyboardProps,
  resolveTextInputKeyboardProps,
} from '@/constants/inputKeyboardPresets';
import { getColors } from '@/theme/getColors';
import {
  QM_MEASUREMENT_SHELL_BORDER_DARK,
  QM_MEASUREMENT_SHELL_FILL_DARK,
  qmInactiveMeasurementShellStyle,
} from '@/constants/qmMeasurementShellStyle';
import {
  ROOF_TEAR_OFF_CARDS,
  readScopeFoundPieces,
  readScopeFoundRemovalQuantity,
  scopeFoundNamesLandscapeClearing,
  scopeFoundRemovalMeasurements,
} from '@/utils/scopeFoundClarification';
import { stuccoInstallSystemIds } from '@/utils/stuccoNoteScope';
import {
  kitchenNoteIncludesFloorWork,
  kitchenNoteNamesBacksplash,
  kitchenNoteNamesCabinetWork,
  kitchenNoteNamesCounterWork,
  kitchenNoteNamesSurfaceDemo,
} from '@/utils/kitchenNoteScope';
import {
  notesNameBathroomRemodelPanel,
  notesNameKitchenRemodelPanel,
} from '@/utils/wholeHomeRemodelNote';
import { type ScopeMeasurementsInputExtended } from '@/utils/scopeItemQuantities';
import {
  roofingStoryCountForReview,
  stuccoStoryCountForReview,
  stuccoWallAreaCarriedIntoConfirmScope,
} from '@/utils/planTakeoffReviewUi';
import { measurementRowInfoText } from '@/utils/scopeQuickMeasurements';
import {
  emptyKitchenExistingCounts,
  inferExistingKitchenFromNotes,
  inferKitchenInstallFromIntent,
  readKitchenDemoCounts,
  readKitchenExistingCounts,
  readKitchenInstallCounts,
  resolveKitchenDemoFromIntent,
  resolveKitchenInstallScopeCounts,
  suggestKitchenDemoFromExistingInstall,
  patchKitchenMeasurementItemQuantities,
  kitchenSelectedDemoSurfaces,
  type KitchenDemoCounts,
  type KitchenDemoOverrideKey,
  type KitchenExistingCounts,
  type KitchenInstallCounts,
} from '@/utils/qmScopePanels/kitchenRemodel';
import {
  emptyFlooringExisting,
  inferExistingFlooringFromNotes,
  inferFlooringInstallFromIntent,
  readFlooringDemo,
  readFlooringExisting,
  readFlooringInstall,
  resolveFlooringDemoFromIntent,
  type FlooringDemoCounts,
  type FlooringExistingCounts,
  type FlooringInstallCounts,
} from '@/utils/qmScopePanels/flooringRemodel';
import {
  landscapingDemoChipActive,
  landscapingScopeCanonicalId,
  landscapingScopeChipNamedInNotes,
  readLandscapingScope,
} from '@/utils/qmScopePanels/landscapingRemodel';
import {
  FLOOR_PREP_SEVERITY_OPTIONS,
  type FloorPrepSeverity,
} from '@/utils/flooringDemoPrepBoundary';
import {
  dedicatedFlooringAreaSqft,
  dedicatedFlooringNoteText,
  dedicatedFlooringProductRoles,
  dedicatedFlooringRemovedTypes,
  notesDescribeDedicatedFlooringJob,
  flooringExistingCardStartsOpen,
  notesRequestFloorPrep,
} from '@/utils/flooringNoteScope';
import {
  CONCRETE_BUILDING_SLAB_OPTIONS,
  CONCRETE_FLATWORK_OPTIONS,
  CONCRETE_DECORATIVE_FINISH_OPTIONS,
  CONCRETE_DEMO_THICKNESS_OPTIONS,
  CONCRETE_SCOPE_OPTIONS,
  CONCRETE_SLAB_THICKNESS_OPTIONS,
  concreteScopeCanonicalId,
  readConcreteScope,
} from '@/utils/qmScopePanels/concreteRemodel';
import {
  notesImplyExteriorFlatwork,
  notesImplyStructuralFoundation,
  notesNameConcretePatioWithSod,
} from '@/utils/foundationPlanningMeasurements';
import {
  CONCRETE_PLAN_FLATWORK_AREA_KEYS,
  withConcreteGroundUpFlatworkPrompts,
  withConcreteGroundUpStructurePrompts,
} from '@/utils/subcontractorTrade/concretePlanConvergence';
import {
  HVAC_SYSTEM_TONNAGE_TIERS,
  hvacPlanImportAssumesSystemScope,
  hvacPlanImportLacksPrintedTonnage,
  hvacPlanImportStatesNewBuildSystem,
  hvacNewBuildScopeCaption,
} from '@/utils/subcontractorTrade/hvacPlanConvergence';
import { hvacNotesDropSystemPackage } from '@/utils/scopeItemNoteHints';
import {
  applyHvacScopePanelMeasurementEdit,
  applyHvacScopeMeasurements,
  formatHvacOptionalAddOnChipCaption,
  formatHvacOptionalAddOnIdleHint,
  formatHvacScopeChipQuantity,
  HVAC_EQUIPMENT_OPTION_IDS,
  HVAC_OPTIONAL_ADDON_OPTION_IDS,
  HVAC_SCOPE_DISTRIBUTION_OPTION_IDS,
  HVAC_SYSTEMS_OPTION_ID,
  hvacPlanInstallIncludesDistribution,
  HVAC_CAPACITY_OPTION_ID,
  HVAC_VENTILATION_QUANTITY_HELPER,
  releaseHvacVentilationSelection,
  hvacFieldHasTakeoffEvidence,
  hvacScopeChipActive,
  hvacScopeChipNeedsQuantity,
  hvacScopeChipReviewState,
  resolveHvacTradeScopeSelections,
  summarizeHvacScopePanel,
  hvacScopePanelMeasurementHelper,
  hvacScopePanelMeasurementValue,
  hvacScopeOptionMentionedInNotes,
  hvacWholeHouseVentilationButtonVisible,
  roofingOptionsForIds,
  ROOF_MATERIAL_OPTIONS,
  readRoofMaterialChoice,
  roofMaterialCardLabel,
  roofMaterialChoiceFromLabel,
  roofMaterialPriceIncludes,
  roofingDownspoutQuantityWarning,
  roofingQmOptionAllowanceAmount,
  roofingQmOptionQuantitySatisfied,
  ROOFING_ACCESSORY_OPTION_IDS,
  ROOFING_DRAINAGE_OPTION_IDS,
  ROOFING_DEMO_OPTION_IDS,
  ROOFING_INSTALL_OPTION_IDS,
  simpleTradeSpec,
  simpleTradeOptionActive,
  nextDeckSurfaceSelections,
  collapseDeckSurfaceSelections,
  type SimpleTradeScopeKey,
} from '@/utils/qmScopePanels/simpleTradeRemodel';
import {
  notesDescribeDedicatedDeckJob,
  notesRequestDeckSurface,
  selectedDeckInstallMaterial,
} from '@/utils/deckNoteScope';
import {
  inferExistingBathroomFixturesFromNotes,
  inferBathroomFixtureInstallFromIntent,
  fillBlankToiletFaucetCounts,
  inferBathroomToiletFaucetCounts,
  readBathroomDemoFixtureCounts,
  readBathroomExistingFixtureCounts,
  readBathroomInstallFixtureCounts,
  resolveBathroomFixtureDemoFromIntent,
  resolveBathroomInstallCounterCount,
  namedBathroomDemoKeeps,
  suggestBathroomFixtureDemoFromExistingInstall,
  type BathroomDemoFixtureCounts,
  type BathroomExistingFixtureCounts,
  type BathroomFixtureDemoOverrideKey,
  type BathroomInstallFixtureCounts,
  type BathroomToiletFaucetCounts,
} from '@/utils/qmScopePanels/bathroomFixtures';
import {
  BATHROOM_VANITY_COUNTERTOP_MATERIAL_OPTIONS,
  inferBathroomVanityCountertopMaterialFromNotes,
  normalizeBathroomVanityCountertopMaterialType,
  type BathroomVanityCountertopMaterialType,
} from '@/utils/bathroomVanityCountertopPricing';
import {
  bathroomAffirmativeNotes,
  bathroomNoteClauseHas,
} from '@/utils/bathroomNoteScope';
import { BATHROOM_QM_STEPPER_MAX } from '@/utils/planBathRooms';

const BATHROOM_QM_PARENT_FLUSH_MS = 150;

export type QmBathroomFixturesPanelsHandle = {
  flushPending: () => void;
};

type Colors = ReturnType<typeof getColors>;

const styles = StyleSheet.create({
  qmPanel: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 12 },
  qmPanelTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  qmPanelCaption: { fontSize: 12, lineHeight: 17, marginBottom: 12 },
  qmOptionWrap: {
    flexDirection: 'column',
    gap: 8,
    alignItems: 'stretch',
  },
  qmOption: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qmOptionText: { fontSize: 13, fontWeight: '600' },
  choiceWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  hvacScopeSelectedCard: {
    width: '100%',
    borderWidth: 0,
    borderRadius: 0,
    paddingVertical: 4,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
  },
  hvacScopeSelectedList: {
    gap: 6,
  },
  hvacScopeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  hvacScopeStatusPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexShrink: 0,
  },
  hvacScopeStatusPillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  hvacScopeSelectedTitle: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    flex: 1,
  },
  hvacVentilationRemove: {
    alignSelf: 'flex-start',
    marginTop: 12,
    minHeight: 36,
    justifyContent: 'center',
  },
  hvacVentilationRemoveText: {
    color: '#f87171',
    fontSize: 14,
    fontWeight: '700',
  },
  hvacScopeSelectedSubtext: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
    marginBottom: 8,
  },
  hvacScopeSelectedStatus: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
    marginBottom: 8,
    fontWeight: '600',
  },
  hvacScopeQuantityPill: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  hvacScopeSummary: {
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 6,
    fontWeight: '600',
  },
  hvacScopeCollapseButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hvacScopeIdleWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'flex-start',
  },
  hvacScopeEquipmentStack: {
    flexDirection: 'column',
    gap: 8,
    alignItems: 'stretch',
  },
  hvacScopeIdleCell: {
    width: '48%',
    flexGrow: 0,
    flexShrink: 0,
    alignSelf: 'flex-start',
  },
  hvacScopeEquipmentCell: {
    width: '100%',
    alignSelf: 'stretch',
  },
  hvacScopeAddDivider: {
    marginTop: 8,
    marginBottom: 0,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  hvacScopeOptionalBlock: {
    marginTop: 16,
  },
  hvacScopeSubPanelAddLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  hvacScopeSubPanelBorderless: {
    borderWidth: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 0,
    marginBottom: 0,
  },
  hvacScopeSubPanelBordered: {
    padding: 12,
    marginTop: 8,
    marginBottom: 0,
  },
  hvacScopeSubPanelTitle: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    marginBottom: 2,
  },
  hvacScopeSubPanelCaption: {
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 6,
  },
  hvacScopeSectionSeparator: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148,163,184,0.18)',
    paddingTop: 10,
    marginTop: 8,
  },
  hvacScopeSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  choiceChipWide: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: '47%',
    flexGrow: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceChipWideHvac: {
    flexGrow: 0,
    width: '100%',
    alignSelf: 'stretch',
  },
  choiceChipStackedHvac: {
    flexGrow: 0,
    width: '100%',
    minWidth: '100%',
    alignSelf: 'stretch',
    minHeight: 48,
    paddingVertical: 12,
    alignItems: 'center',
  },
  choiceChipCompact: {
    flexGrow: 0,
    width: '100%',
    minHeight: 40,
    paddingVertical: 10,
  },
});

function captionColor(darkMode: boolean, Colors: Colors) {
  return darkMode ? 'rgba(245,247,250,0.82)' : Colors.sub;
}

/** Inactive scope chips — same fill/border as Needs confirmation measurement rows. */
function inactiveScopeChoiceChipStyle(darkMode: boolean, Colors: Colors) {
  const shell = qmInactiveMeasurementShellStyle(darkMode, Colors);
  return {
    ...shell,
    textColor: darkMode ? '#F5F7FA' : Colors.text,
  };
}

function roofingStoryCountNeedsHighlight(storyCount: unknown): boolean {
  const raw = String(storyCount ?? '')
    .replace(/,/g, '')
    .trim();
  if (!raw) return false;
  const n = Number(raw);
  return !Number.isFinite(n) || n <= 0;
}

function hvacScopePanelColors(darkMode: boolean, Colors: Colors) {
  return {
    borderColor: darkMode
      ? 'rgba(148, 163, 184, 0.28)'
      : 'rgba(100, 116, 139, 0.24)',
    backgroundColor: darkMode ? QM_MEASUREMENT_SHELL_FILL_DARK : '#f1f5f9',
    sectionLabelColor: darkMode ? '#d7e1f0' : '#64748b',
    captionColor: captionColor(darkMode, Colors),
  };
}

function simpleTradeScopePanelTitle(
  scopeKey: SimpleTradeScopeKey,
  notes?: string | null
): string {
  if (scopeKey === 'deck_patio') {
    return /\bfence\b|\bgates?\b|\bchain[\s-]?link\b/i.test(String(notes || ''))
      ? 'Deck & fence scope'
      : 'Deck scope';
  }
  if (scopeKey === 'hvac') return 'HVAC scope';
  if (scopeKey === 'roofing') return 'Roofing scope';
  return `${scopeKey} scope`;
}

function QmScopeChoiceChip({
  label,
  active,
  onPress,
  disabled,
  darkMode,
  Colors,
  style,
  quantityCaption,
  reviewState = 'idle',
  compact = false,
  stacked = false,
  labelFontSize,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  disabled?: boolean;
  darkMode: boolean;
  Colors: Colors;
  style?: object;
  quantityCaption?: string | null;
  reviewState?: 'confirmed' | 'needs_confirmation' | 'idle';
  compact?: boolean;
  stacked?: boolean;
  labelFontSize?: number;
}) {
  const inactiveStyle = inactiveScopeChoiceChipStyle(darkMode, Colors);
  let borderColor = inactiveStyle.borderColor;
  let backgroundColor = inactiveStyle.backgroundColor;
  let textColor = inactiveStyle.textColor;
  if (active && reviewState === 'needs_confirmation') {
    borderColor = '#fbbf24';
    backgroundColor = 'rgba(251, 191, 36, 0.12)';
    textColor = '#fbbf24';
  } else if (active) {
    borderColor = 'rgba(45, 204, 154, 0.55)';
    backgroundColor = 'rgba(45, 204, 154, 0.16)';
    textColor = '#8eecc9';
  }
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.choiceChipWide,
        {
          borderColor,
          backgroundColor,
          borderWidth: inactiveStyle.borderWidth,
          borderRadius: inactiveStyle.borderRadius,
        },
        style,
      ]}
    >
      <Text
        style={{
          color: textColor,
          fontSize: labelFontSize ?? (compact ? 11 : stacked ? 13 : 12),
          fontWeight: active ? '800' : '600',
          textAlign: 'center',
          width: stacked ? '100%' : undefined,
        }}
      >
        {active && reviewState === 'confirmed' ? '✓ ' : ''}
        {label}
      </Text>
      {quantityCaption ? (
        <Text
          style={{
            color:
              active && reviewState === 'needs_confirmation'
                ? '#fcd34d'
                : active
                  ? '#8eecc9'
                  : darkMode
                    ? '#d7e1f0'
                    : '#64748b',
            fontSize: 11,
            fontWeight: '700',
            textAlign: 'center',
            width: stacked ? '100%' : undefined,
            marginTop: 4,
          }}
        >
          {quantityCaption}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

function QmConcreteScopeChoiceChip({
  label,
  active,
  onPress,
  applying,
  darkMode,
  Colors,
  style,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  applying: boolean;
  darkMode: boolean;
  Colors: Colors;
  style?: object;
}) {
  return (
    <QmScopeChoiceChip
      label={label}
      active={active}
      onPress={onPress}
      disabled={applying}
      darkMode={darkMode}
      Colors={Colors}
      style={{ minWidth: '100%', ...style }}
      stacked
    />
  );
}

export function qmNeutralScopePanelStyle(darkMode: boolean) {
  return {
    titleColor: darkMode ? '#d7e1f0' : '#64748b',
    borderColor: darkMode
      ? 'rgba(148, 163, 184, 0.28)'
      : 'rgba(100, 116, 139, 0.22)',
    backgroundColor: darkMode
      ? 'rgba(148, 163, 184, 0.06)'
      : 'rgba(100, 116, 139, 0.05)',
  };
}

/** Existing kitchen / bath fixture panels — matches Quick measurements nested cards. */
export function qmExistingScopePanelStyle(darkMode: boolean) {
  return qmNeutralScopePanelStyle(darkMode);
}

/** Demo / tear-out panels (kitchen, bath). */
export function qmDemoScopePanelStyle(darkMode: boolean) {
  return {
    titleColor: '#f87171',
    borderColor: darkMode
      ? 'rgba(248, 113, 113, 0.28)'
      : 'rgba(220, 38, 38, 0.2)',
    backgroundColor: darkMode
      ? 'rgba(248, 113, 113, 0.06)'
      : 'rgba(248, 113, 113, 0.05)',
  };
}

/** Install panels (kitchen install, vanity & countertop, wet area install). */
export function qmInstallScopePanelStyle(darkMode: boolean) {
  return {
    titleColor: darkMode ? '#cbd5e1' : '#475569',
    borderColor: darkMode ? 'rgba(148,163,184,0.28)' : 'rgba(100,116,139,0.24)',
    backgroundColor: darkMode
      ? 'rgba(148,163,184,0.06)'
      : 'rgba(148,163,184,0.05)',
  };
}

type StepperRow = {
  key: string;
  label: string;
};

const KITCHEN_EXISTING_ROWS: StepperRow[] = [
  { key: 'kitchenExistingCabinetCount', label: 'Existing cabinets' },
  { key: 'kitchenExistingCounterCount', label: 'Existing countertops' },
  { key: 'kitchenExistingApplianceCount', label: 'Existing appliances' },
  { key: 'kitchenExistingBacksplashCount', label: 'Existing backsplash' },
  { key: 'kitchenExistingFloorCount', label: 'Existing floor' },
];

const KITCHEN_INSTALL_STEPPER_ROWS: StepperRow[] = [
  { key: 'kitchenInstallApplianceCount', label: 'Appliance hookup' },
  { key: 'kitchenInstallIslandCount', label: 'Island set & anchor' },
];

const KITCHEN_DEMO_STEPPER_ROWS: StepperRow[] = [
  { key: 'kitchenDemoIslandCount', label: 'Demo island' },
  { key: 'kitchenDemoApplianceCount', label: 'Appliance removal' },
];

const BATHROOM_EXISTING_FIXTURE_ROWS: StepperRow[] = [
  { key: 'bathroomExistingVanityCount', label: 'Existing vanity' },
  { key: 'bathroomExistingCounterCount', label: 'Existing countertop' },
];

const BATHROOM_INSTALL_FIXTURE_ROWS: StepperRow[] = [
  { key: 'bathroomInstallVanityCount', label: 'New vanity' },
  { key: 'bathroomInstallCounterCount', label: 'New countertop' },
];

const BATHROOM_DEMO_FIXTURE_ROWS: StepperRow[] = [
  { key: 'bathroomDemoVanityCount', label: 'Remove vanity' },
  { key: 'bathroomDemoCounterCount', label: 'Remove countertop' },
];

function QmScopeSubheading({
  label,
  darkMode,
  Colors,
}: {
  label: string;
  darkMode: boolean;
  Colors: Colors;
}) {
  return (
    <Text
      style={{
        color: captionColor(darkMode, Colors),
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.6,
        marginBottom: 8,
      }}
    >
      {label.toUpperCase()}
    </Text>
  );
}

const QmCountStepper = React.memo(function QmCountStepper({
  label,
  value,
  rowKey,
  onAdjustRow,
  applying,
  max = 1,
  increaseDisabled = false,
  darkMode,
  Colors,
}: {
  label: string;
  value: number | null;
  rowKey: string;
  onAdjustRow: (key: string, delta: number) => void;
  applying: boolean;
  max?: number;
  increaseDisabled?: boolean;
  darkMode: boolean;
  Colors: Colors;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
        gap: 12,
      }}
    >
      <Text
        style={{
          flex: 1,
          color: darkMode ? '#F5F7FA' : Colors.text,
          fontSize: 13,
          fontWeight: '600',
        }}
      >
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <TouchableOpacity
          onPressIn={() => onAdjustRow(rowKey, -1)}
          disabled={applying || !value}
          activeOpacity={0.6}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: darkMode ? 'rgba(255,255,255,0.16)' : Colors.line,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: applying || !value ? 0.4 : 1,
          }}
        >
          <Text
            style={{
              color: darkMode ? '#F5F7FA' : Colors.text,
              fontSize: 18,
              fontWeight: '700',
            }}
          >
            −
          </Text>
        </TouchableOpacity>
        <Text
          style={{
            minWidth: 28,
            textAlign: 'center',
            color: darkMode ? '#F5F7FA' : Colors.text,
            fontSize: 16,
            fontWeight: '800',
          }}
        >
          {value ?? '—'}
        </Text>
        <TouchableOpacity
          onPressIn={() => onAdjustRow(rowKey, 1)}
          disabled={
            applying || increaseDisabled || (value != null && value >= max)
          }
          activeOpacity={0.6}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: darkMode ? 'rgba(255,255,255,0.16)' : Colors.line,
            alignItems: 'center',
            justifyContent: 'center',
            opacity:
              applying || increaseDisabled || (value != null && value >= max)
                ? 0.4
                : 1,
          }}
        >
          <Text
            style={{
              color: darkMode ? '#F5F7FA' : Colors.text,
              fontSize: 18,
              fontWeight: '700',
            }}
          >
            +
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

function QmScopePanelSection({
  title,
  titleColor,
  borderColor,
  backgroundColor,
  caption,
  rows,
  counts,
  onAdjust,
  applying,
  darkMode,
  Colors,
  footer,
  midContent,
  trailingRows,
  rowBelowContent,
  marginBottom = 12,
  stepperMax,
  stepperIncreaseDisabled,
}: {
  title: string;
  titleColor: string;
  borderColor: string;
  backgroundColor: string;
  caption: string;
  rows: StepperRow[];
  counts: Record<string, number | null>;
  onAdjust: (key: string, delta: number) => void;
  applying: boolean;
  darkMode: boolean;
  Colors: Colors;
  footer?: React.ReactNode;
  midContent?: React.ReactNode;
  trailingRows?: StepperRow[];
  rowBelowContent?: Partial<Record<string, React.ReactNode>>;
  marginBottom?: number;
  stepperMax?: number;
  stepperIncreaseDisabled?: Partial<Record<string, boolean>>;
}) {
  const max = stepperMax ?? 1;
  return (
    <View
      style={{
        borderWidth: 1,
        borderRadius: 14,
        padding: 14,
        borderColor,
        backgroundColor,
        marginBottom,
      }}
    >
      <Text
        style={{
          color: titleColor,
          fontSize: 12,
          fontWeight: '800',
          letterSpacing: 0.4,
          marginBottom: 6,
        }}
      >
        {title.toUpperCase()}
      </Text>
      <Text
        style={{
          color: captionColor(darkMode, Colors),
          fontSize: 11,
          lineHeight: 16,
          marginBottom: 12,
        }}
      >
        {caption}
      </Text>
      {rows.map(row => (
        <React.Fragment key={row.key}>
          <QmCountStepper
            label={row.label}
            value={counts[row.key] ?? null}
            rowKey={row.key}
            onAdjustRow={onAdjust}
            applying={applying}
            max={max}
            darkMode={darkMode}
            Colors={Colors}
          />
          {rowBelowContent?.[row.key] ?? null}
        </React.Fragment>
      ))}
      {midContent}
      {(trailingRows || []).length > 0 && midContent ? (
        <View
          style={{
            marginTop: 8,
            marginBottom: 4,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: darkMode ? 'rgba(255,255,255,0.08)' : Colors.line,
            paddingTop: 8,
          }}
        />
      ) : null}
      {(trailingRows || []).map(row => (
        <QmCountStepper
          key={row.key}
          label={row.label}
          value={counts[row.key] ?? null}
          rowKey={row.key}
          onAdjustRow={onAdjust}
          applying={applying}
          max={max}
          increaseDisabled={stepperIncreaseDisabled?.[row.key] === true}
          darkMode={darkMode}
          Colors={Colors}
        />
      ))}
      {footer}
    </View>
  );
}

export function QmScopeFoundRemovalMeasurements({
  measurements,
  setMeasurements,
  applying,
  darkMode,
  Colors,
}: {
  measurements: ScopeMeasurementsInputExtended;
  setMeasurements: React.Dispatch<
    React.SetStateAction<ScopeMeasurementsInputExtended>
  >;
  applying: boolean;
  darkMode: boolean;
  Colors: Colors;
}) {
  const rows = scopeFoundRemovalMeasurements(
    readScopeFoundPieces(measurements.scopeFoundPieces)
  );
  if (!rows.length) return null;
  const panelStyle = {
    ...qmPanelShellStyle(darkMode),
    backgroundColor: darkMode ? '#2A2A2E' : Colors.surface2,
  };
  const writeQuantity = (
    quantityKey: string,
    unit: 'sqft' | 'each',
    value: string
  ) => {
    const quantity = value.replace(/,/g, '').trim();
    setMeasurements(prev => {
      const itemQuantities = { ...(prev.itemQuantities || {}) };
      if (!quantity || !(Number(quantity) > 0)) {
        delete itemQuantities[quantityKey];
      } else {
        itemQuantities[quantityKey] = {
          quantity,
          unit,
          quantitySource: 'user_entered',
        };
      }
      const stuccoRows = scopeFoundRemovalMeasurements(
        readScopeFoundPieces(prev.scopeFoundPieces)
      ).filter(row => row.quantityKey.startsWith('cladding_demo__'));
      if (stuccoRows.length) {
        const total = stuccoRows.reduce((sum, row) => {
          const amount = Number(
            String(itemQuantities[row.quantityKey]?.quantity ?? '').replace(
              /,/g,
              ''
            )
          );
          return sum + (Number.isFinite(amount) && amount > 0 ? amount : 0);
        }, 0);
        if (total > 0) {
          itemQuantities.cladding_demo = {
            quantity: String(total),
            unit: 'sqft',
            quantitySource: 'user_entered',
          };
        } else {
          delete itemQuantities.cladding_demo;
        }
      }
      return { ...prev, itemQuantities };
    });
  };
  return (
    <View style={[styles.qmPanel, panelStyle]}>
      <Text
        style={[
          styles.qmPanelTitle,
          { color: darkMode ? '#cbd5e1' : '#475569' },
        ]}
      >
        Demo / tear-out
      </Text>
      <Text
        style={[
          styles.qmPanelCaption,
          { color: darkMode ? '#d7e1f0' : '#64748b', marginTop: 2 },
        ]}
      >
        One measurement for each finish selected on Scope found.
      </Text>
      {rows.map(row => (
        <QmSqftMeasurementRow
          key={row.pieceId}
          label={row.label}
          helperText={
            row.unit === 'each'
              ? 'How many of these come out.'
              : 'Area of this finish that comes out.'
          }
          value={readScopeFoundRemovalQuantity(
            measurements.itemQuantities,
            row.quantityKey
          )}
          placeholder={row.unit === 'each' ? 'Enter' : 'Enter sqft'}
          unitLabel={row.unit === 'each' ? 'each' : 'sqft'}
          onChangeText={value => writeQuantity(row.quantityKey, row.unit, value)}
          applying={applying}
          darkMode={darkMode}
          Colors={Colors}
        />
      ))}
    </View>
  );
}

export function QmSqftMeasurementRow({
  label,
  helperText,
  value,
  placeholder,
  unitLabel = 'sqft',
  onChangeText,
  onFocus,
  onBlur,
  applying,
  darkMode,
  Colors,
  highlighted = false,
  keyboardType = 'decimal-pad',
  textEntry = false,
  compact = false,
  sectionLead = false,
  sectionEnd = false,
  reserveHelperSpace = false,
  helperGap,
}: {
  label: string;
  helperText?: string;
  value: string;
  placeholder?: string;
  unitLabel?: string;
  onChangeText: (text: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  applying: boolean;
  darkMode: boolean;
  Colors: Colors;
  highlighted?: boolean;
  keyboardType?: 'decimal-pad' | 'number-pad';
  textEntry?: boolean;
  compact?: boolean;
  sectionLead?: boolean;
  sectionEnd?: boolean;
  reserveHelperSpace?: boolean;
  /** Space between the helper line and the measurement box. */
  helperGap?: number;
}) {
  const defaultPlaceholder =
    unitLabel.toLowerCase() === 'lf' ? 'Enter LF' : 'Enter sqft';
  const formattedValue = (() => {
    const raw = String(value || '');
    if (textEntry) return raw;
    const numeric = raw.replace(/,/g, '');
    if (!numeric) return '';
    const match = numeric.match(/^(-?)(\d*)(\.\d*)?$/);
    if (!match) return value;
    const [, sign, integerPart, decimalPart = ''] = match;
    const integer = integerPart || '0';
    return `${sign}${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${decimalPart}`;
  })();
  const inputShellStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 10,
    minHeight: compact ? 42 : 38,
    ...qmInactiveMeasurementShellStyle(darkMode, Colors, { highlighted }),
  };
  const labelStyle = {
    color: highlighted ? '#FACC15' : darkMode ? '#F5F7FA' : Colors.text,
    fontSize: 13,
    fontWeight: '600' as const,
  };
  const infoBody = measurementRowInfoText({
    label,
    unit: unitLabel,
    helperText,
  });
  const infoButton = (
    <TouchableOpacity
      onPress={() => Alert.alert(label, infoBody)}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole='button'
      accessibilityLabel={`${label} info`}
    >
      <Ionicons
        name='information-circle-outline'
        size={16}
        color={darkMode ? 'rgba(255,255,255,0.55)' : Colors.sub}
      />
    </TouchableOpacity>
  );

  if (compact) {
    return (
      <View
        style={{
          marginTop: 8,
          minHeight: reserveHelperSpace ? 68 : undefined,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Text style={[labelStyle, { flexShrink: 1, lineHeight: 18 }]} numberOfLines={2}>
              {label}
            </Text>
            {infoButton}
          </View>
          <View style={[inputShellStyle, { width: 132, flexShrink: 0 }]}>
            <TextInput
              value={formattedValue}
              onChangeText={text =>
                onChangeText(textEntry ? text : text.replace(/,/g, ''))
              }
              onFocus={onFocus}
              onBlur={onBlur}
              editable={!applying}
              placeholder={placeholder || defaultPlaceholder}
              placeholderTextColor={
                darkMode ? 'rgba(255,255,255,0.35)' : '#d7e1f0'
              }
              style={{
                flex: 1,
                color: darkMode ? '#F5F7FA' : Colors.text,
                paddingVertical: Platform.OS === 'ios' ? 8 : 6,
                fontSize: 14,
                fontWeight: '600',
                minWidth: 0,
                textAlign: 'right',
              }}
              {...(textEntry
                ? resolveTextInputKeyboardProps()
                : {
                    keyboardType,
                    ...aiScopeConfirmNumericKeyboardProps,
                  })}
            />
            <Text
              style={{
                color: captionColor(darkMode, Colors),
                fontSize: 11,
                fontWeight: '700',
                marginLeft: 6,
                flexShrink: 0,
              }}
            >
              {unitLabel}
            </Text>
          </View>
        </View>
        {helperText ? (
          <Text
            style={{
              color: captionColor(darkMode, Colors),
              fontSize: 10,
              lineHeight: 14,
              marginTop: 4,
              marginLeft: 0,
            }}
          >
            {helperText}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View
      style={{
        marginTop: sectionLead ? 0 : 10,
        paddingTop: sectionLead ? 0 : 10,
        paddingBottom: sectionEnd ? 0 : 10,
        borderBottomWidth: sectionEnd ? 0 : 1,
        borderBottomColor: darkMode ? 'rgba(255,255,255,0.08)' : Colors.line,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          marginBottom: helperText ? 2 : 4,
        }}
      >
        <Text style={[labelStyle, { flexShrink: 1 }]}>{label}</Text>
        {infoButton}
      </View>
      {helperText ? (
        <Text
          style={{
            color: captionColor(darkMode, Colors),
            fontSize: 11,
            lineHeight: 15,
            marginBottom: helperGap ?? 8,
          }}
        >
          {helperText}
        </Text>
      ) : null}
      <View style={[inputShellStyle, { minHeight: 42, paddingHorizontal: 12 }]}>
        <TextInput
          value={formattedValue}
          onChangeText={text =>
            onChangeText(textEntry ? text : text.replace(/,/g, ''))
          }
          onFocus={onFocus}
          onBlur={onBlur}
          editable={!applying}
          placeholder={placeholder || defaultPlaceholder}
          placeholderTextColor={darkMode ? 'rgba(255,255,255,0.35)' : '#d7e1f0'}
          style={{
            flex: 1,
            color: darkMode ? '#F5F7FA' : Colors.text,
            paddingVertical: Platform.OS === 'ios' ? 8 : 6,
            fontSize: 16,
            fontWeight: '700',
            minWidth: 0,
          }}
          {...(textEntry
            ? resolveTextInputKeyboardProps()
            : {
                keyboardType,
                ...aiScopeConfirmNumericKeyboardProps,
              })}
        />
        <Text
          style={{
            color: captionColor(darkMode, Colors),
            fontSize: 13,
            fontWeight: '600',
            marginLeft: 8,
            flexShrink: 0,
          }}
        >
          {unitLabel}
        </Text>
      </View>
    </View>
  );
}

function clampQmCount(next: number | null, max = 1): number | null {
  if (next == null || !Number.isFinite(next) || next < 1) return null;
  return Math.min(max, Math.round(next));
}

function kitchenInstallCountsEqual(
  a: KitchenInstallCounts,
  b: KitchenInstallCounts
): boolean {
  return (
    a.kitchenInstallCabinetCount === b.kitchenInstallCabinetCount &&
    a.kitchenInstallCounterCount === b.kitchenInstallCounterCount &&
    a.kitchenInstallApplianceCount === b.kitchenInstallApplianceCount &&
    a.kitchenInstallBacksplashCount === b.kitchenInstallBacksplashCount &&
    a.kitchenInstallFlooringCount === b.kitchenInstallFlooringCount &&
    a.kitchenInstallIslandCount === b.kitchenInstallIslandCount
  );
}

function kitchenDemoCountsEqual(
  a: KitchenDemoCounts,
  b: KitchenDemoCounts
): boolean {
  return (
    a.kitchenDemoCabinetCount === b.kitchenDemoCabinetCount &&
    a.kitchenDemoCounterCount === b.kitchenDemoCounterCount &&
    a.kitchenDemoBacksplashCount === b.kitchenDemoBacksplashCount &&
    a.kitchenDemoIslandCount === b.kitchenDemoIslandCount &&
    a.kitchenDemoApplianceCount === b.kitchenDemoApplianceCount &&
    a.kitchenDemoFloorCount === b.kitchenDemoFloorCount &&
    a.kitchenDemoWallCount === b.kitchenDemoWallCount
  );
}

export function QmKitchenScopePanels({
  measurements,
  setMeasurements,
  notes,
  condensed = false,
  showInstallPanel = true,
  showKitchenFloorField = true,
  includedScopeKeys,
  hasSitePhotos,
  showExistingPanel,
  applying,
  onKitchenQmChange,
  darkMode,
  Colors,
}: {
  measurements: ScopeMeasurementsInputExtended;
  setMeasurements: React.Dispatch<
    React.SetStateAction<ScopeMeasurementsInputExtended>
  >;
  notes?: string | null;
  condensed?: boolean;
  showInstallPanel?: boolean;
  showKitchenFloorField?: boolean;
  includedScopeKeys: string[];
  hasSitePhotos: boolean;
  showExistingPanel: boolean;
  applying: boolean;
  onKitchenQmChange?: (params: {
    existing: KitchenExistingCounts;
    install: KitchenInstallCounts;
    demo: KitchenDemoCounts;
  }) => void;
  darkMode: boolean;
  Colors: Colors;
}) {
  const [existing, setExisting] = useState<KitchenExistingCounts>(() =>
    readKitchenExistingCounts(measurements)
  );
  const [install, setInstall] = useState<KitchenInstallCounts>(() =>
    resolveKitchenInstallScopeCounts(measurements)
  );
  const [demo, setDemo] = useState<KitchenDemoCounts>(() =>
    suggestKitchenDemoFromExistingInstall({
      existing: readKitchenExistingCounts(measurements),
      install: resolveKitchenInstallScopeCounts(measurements),
      demo: readKitchenDemoCounts(measurements),
      measurements,
      notes,
    })
  );
  const genRef = useRef(0);
  const appliedRef = useRef(0);
  const demoOverridesRef = useRef<
    Partial<Record<KitchenDemoOverrideKey, boolean>>
  >({});
  const demoRef = useRef(demo);
  demoRef.current = demo;
  const existingRef = useRef(existing);
  existingRef.current = existing;
  const installRef = useRef(install);
  installRef.current = install;
  const measurementsRef = useRef(measurements);
  measurementsRef.current = measurements;
  type KitchenMeasurementKey =
    | 'cabinetLf'
    | 'countertopSqft'
    | 'kitchenIslandCounterSqft'
    | 'backsplashSqft'
    | 'kitchenFloorSqft'
    | 'floorDemoSqft';
  const readKitchenMeasurementDraft = (
    m: ScopeMeasurementsInputExtended,
    key: KitchenMeasurementKey
  ) => String(m[key] ?? '').trim();
  const [kitchenMeasurementDrafts, setKitchenMeasurementDrafts] = useState<
    Record<KitchenMeasurementKey, string>
  >(() => ({
    cabinetLf: readKitchenMeasurementDraft(measurements, 'cabinetLf'),
    countertopSqft: readKitchenMeasurementDraft(measurements, 'countertopSqft'),
    kitchenIslandCounterSqft: readKitchenMeasurementDraft(
      measurements,
      'kitchenIslandCounterSqft'
    ),
    backsplashSqft: readKitchenMeasurementDraft(measurements, 'backsplashSqft'),
    kitchenFloorSqft: readKitchenMeasurementDraft(
      measurements,
      'kitchenFloorSqft'
    ),
    floorDemoSqft: readKitchenMeasurementDraft(measurements, 'floorDemoSqft'),
  }));
  const kitchenMeasurementDraftRefs = useRef(kitchenMeasurementDrafts);
  kitchenMeasurementDraftRefs.current = kitchenMeasurementDrafts;

  useEffect(() => {
    if (genRef.current !== appliedRef.current) return;
    const keys: KitchenMeasurementKey[] = [
      'cabinetLf',
      'countertopSqft',
      'kitchenIslandCounterSqft',
      'backsplashSqft',
      'kitchenFloorSqft',
      'floorDemoSqft',
    ];
    setKitchenMeasurementDrafts(prev => {
      let changed = false;
      const next = { ...prev };
      for (const key of keys) {
        const external = readKitchenMeasurementDraft(measurements, key);
        if (external !== kitchenMeasurementDraftRefs.current[key]) {
          next[key] = external;
          changed = true;
        }
      }
      if (changed) {
        kitchenMeasurementDraftRefs.current = next;
      }
      return changed ? next : prev;
    });
  }, [
    measurements.cabinetLf,
    measurements.countertopSqft,
    measurements.kitchenIslandCounterSqft,
    measurements.backsplashSqft,
    measurements.kitchenFloorSqft,
  ]);

  useEffect(() => {
    if (genRef.current !== appliedRef.current) return;
    setExisting(readKitchenExistingCounts(measurements));
    setInstall(resolveKitchenInstallScopeCounts(measurements));
    const nextDemo = suggestKitchenDemoFromExistingInstall({
      existing: readKitchenExistingCounts(measurements),
      install: resolveKitchenInstallScopeCounts(measurements),
      demo: readKitchenDemoCounts(measurements),
      measurements,
      overrides: demoOverridesRef.current,
      notes,
    });
    setDemo(nextDemo);
    demoRef.current = nextDemo;
    if (
      nextDemo.kitchenDemoApplianceCount != null &&
      Number(measurements.kitchenDemoApplianceCount) !==
        nextDemo.kitchenDemoApplianceCount &&
      !demoOverridesRef.current.kitchenDemoApplianceCount
    ) {
      setMeasurements(prev => ({
        ...prev,
        kitchenDemoApplianceCount: nextDemo.kitchenDemoApplianceCount,
      }));
    }
  }, [
    measurements.kitchenExistingCabinetCount,
    measurements.kitchenExistingCounterCount,
    measurements.kitchenExistingApplianceCount,
    measurements.kitchenExistingBacksplashCount,
    measurements.kitchenExistingFloorCount,
    measurements.kitchenInstallApplianceCount,
    measurements.kitchenInstallIslandCount,
    measurements.kitchenDemoCabinetCount,
    measurements.kitchenDemoCounterCount,
    measurements.kitchenDemoBacksplashCount,
    measurements.kitchenDemoApplianceCount,
    measurements.kitchenDemoFloorCount,
    measurements.kitchenDemoWallCount,
    measurements.kitchenDemoIslandCount,
    measurements.cabinetLf,
    measurements.countertopSqft,
    measurements.kitchenIslandCounterSqft,
    measurements.backsplashSqft,
    measurements.kitchenFloorSqft,
    Array.isArray(measurements.scopeFoundPieces)
      ? measurements.scopeFoundPieces.map(piece => String(piece)).join(',')
      : '',
    notes,
  ]);

  const scheduleKitchenQmCommit = useCallback(
    (
      nextExisting: KitchenExistingCounts,
      nextInstall: KitchenInstallCounts,
      gen: number,
      demoOverride?: { key: KitchenDemoOverrideKey; value: number | null },
      currentDemo?: KitchenDemoCounts
    ) => {
      queueMicrotask(() => {
        if (gen !== genRef.current) return;
        const measurementSnapshot = measurementsRef.current as Record<
          string,
          unknown
        >;
        const scopeInstall = resolveKitchenInstallScopeCounts({
          ...measurementSnapshot,
          ...nextInstall,
        });
        let mergedDemo: KitchenDemoCounts;
        if (demoOverride) {
          demoOverridesRef.current = {
            ...demoOverridesRef.current,
            [demoOverride.key]: true,
          };
          mergedDemo = {
            ...(currentDemo || demoRef.current),
            [demoOverride.key]: demoOverride.value,
          };
          mergedDemo = suggestKitchenDemoFromExistingInstall({
            existing: nextExisting,
            install: scopeInstall,
            demo: mergedDemo,
            measurements: measurementSnapshot,
            overrides: demoOverridesRef.current,
            notes,
          });
          mergedDemo = {
            ...mergedDemo,
            [demoOverride.key]: demoOverride.value,
          };
        } else {
          mergedDemo = suggestKitchenDemoFromExistingInstall({
            existing: nextExisting,
            install: scopeInstall,
            demo: demoRef.current,
            measurements: measurementSnapshot,
            overrides: demoOverridesRef.current,
            notes,
          });
          for (const key of Object.keys(
            demoOverridesRef.current
          ) as KitchenDemoOverrideKey[]) {
            if (demoOverridesRef.current[key]) {
              mergedDemo[key] = demoRef.current[key];
            }
          }
        }

        existingRef.current = nextExisting;
        installRef.current = scopeInstall;
        demoRef.current = mergedDemo;
        startTransition(() => {
          appliedRef.current = gen;
          setInstall(prev =>
            kitchenInstallCountsEqual(prev, scopeInstall) ? prev : scopeInstall
          );
          setDemo(prev =>
            kitchenDemoCountsEqual(prev, mergedDemo) ? prev : mergedDemo
          );
          setMeasurements(prev => ({
            ...prev,
            ...nextExisting,
            ...scopeInstall,
            ...mergedDemo,
          }));
        });
      });
    },
    [setMeasurements]
  );

  const adjustExisting = useCallback(
    (key: keyof KitchenExistingCounts, delta: number) => {
      const gen = ++genRef.current;
      setExisting(prev => {
        const current = prev[key] ?? 0;
        const next = {
          ...prev,
          [key]: clampQmCount(current + delta < 1 ? null : current + delta),
        };
        existingRef.current = next;
        scheduleKitchenQmCommit(next, installRef.current, gen);
        return next;
      });
    },
    [scheduleKitchenQmCommit]
  );

  const adjustInstall = useCallback(
    (
      key: 'kitchenInstallApplianceCount' | 'kitchenInstallIslandCount',
      delta: number
    ) => {
      const gen = ++genRef.current;
      setInstall(prev => {
        const current = prev[key] ?? 0;
        const nextInstall = {
          ...prev,
          [key]: clampQmCount(
            current + delta < 1 ? null : current + delta,
            Infinity
          ),
        };
        installRef.current = nextInstall;
        scheduleKitchenQmCommit(existingRef.current, nextInstall, gen);
        return nextInstall;
      });
    },
    [scheduleKitchenQmCommit]
  );

  const handleKitchenMeasurementDraftChange = useCallback(
    (key: KitchenMeasurementKey, text: string) => {
      const cleaned = String(text || '').replace(/[^\d.]/g, '');
      kitchenMeasurementDraftRefs.current = {
        ...kitchenMeasurementDraftRefs.current,
        [key]: cleaned,
      };
      setKitchenMeasurementDrafts(prev => ({ ...prev, [key]: cleaned }));
    },
    []
  );

  const commitKitchenMeasurement = useCallback(
    (key: KitchenMeasurementKey) => {
      const cleaned = String(
        kitchenMeasurementDraftRefs.current[key] ?? ''
      ).trim();
      const committed = String(
        (measurementsRef.current as Record<string, unknown>)[key] ?? ''
      ).trim();
      if (cleaned === committed) return;

      const gen = ++genRef.current;
      const snapshot = {
        ...(measurementsRef.current as Record<string, unknown>),
        [key]: cleaned,
      };
      const nextInstall = resolveKitchenInstallScopeCounts(snapshot);
      const mergedDemo = suggestKitchenDemoFromExistingInstall({
        existing: existingRef.current,
        install: nextInstall,
        demo: demoRef.current,
        measurements: snapshot,
        overrides: demoOverridesRef.current,
        notes,
      });
      const itemQuantities = patchKitchenMeasurementItemQuantities(
        (measurementsRef.current.itemQuantities || {}) as Record<
          string,
          { quantity?: string | number; unit?: string; quantitySource?: string }
        >,
        key,
        cleaned,
        snapshot
      );
      installRef.current = nextInstall;
      demoRef.current = mergedDemo;
      appliedRef.current = gen;
      startTransition(() => {
        setInstall(nextInstall);
        setDemo(mergedDemo);
        setMeasurements(prev => ({
          ...prev,
          [key]: cleaned,
          ...nextInstall,
          ...mergedDemo,
          itemQuantities,
        }));
      });
    },
    [setMeasurements]
  );

  const adjustDemo = useCallback(
    (key: KitchenDemoOverrideKey, delta: number) => {
      const gen = ++genRef.current;
      setDemo(prev => {
        const current = prev[key] ?? 0;
        const cleaned = clampQmCount(
          current + delta < 1 ? null : current + delta,
          Infinity
        );
        const next = { ...prev, [key]: cleaned };
        demoRef.current = next;
        scheduleKitchenQmCommit(
          existingRef.current,
          installRef.current,
          gen,
          { key, value: cleaned },
          next
        );
        return next;
      });
    },
    [scheduleKitchenQmCommit]
  );

  const existingCaption = showExistingPanel
    ? 'What is in the space now — set manually for notes-only jobs.'
    : 'Seeded from photos and notes when site photos are attached.';
  const demoCaption = showExistingPanel
    ? 'Auto-filled from existing + install — adjust if needed.'
    : 'Auto-filled from photos, notes, and install — adjust if needed.';
  const installPanelStyle = qmInstallScopePanelStyle(darkMode);
  const cabinetLfValue = kitchenMeasurementDrafts.cabinetLf;
  const countertopSqftValue = kitchenMeasurementDrafts.countertopSqft;
  const kitchenIslandCounterSqftValue =
    kitchenMeasurementDrafts.kitchenIslandCounterSqft;
  const backsplashSqftValue = kitchenMeasurementDrafts.backsplashSqft;
  const kitchenFloorSqftValue = kitchenMeasurementDrafts.kitchenFloorSqft;
  const floorDemoSqftValue = kitchenMeasurementDrafts.floorDemoSqft;
  const hasExplicitKitchenFloorScope = kitchenNoteIncludesFloorWork(notes);
  const showIslandCounterField = (install.kitchenInstallIslandCount ?? 0) > 0;
  const kitchenNoteText = String(notes || '');
  const openKitchenRemodel =
    notesNameKitchenRemodelPanel(kitchenNoteText) &&
    !kitchenNoteNamesCabinetWork(kitchenNoteText) &&
    !kitchenNoteNamesCounterWork(kitchenNoteText) &&
    !kitchenNoteNamesBacksplash(kitchenNoteText);
  const condensedKitchenScope = {
    cabinets:
      kitchenNoteNamesCabinetWork(kitchenNoteText) || openKitchenRemodel,
    counters:
      kitchenNoteNamesCounterWork(kitchenNoteText) || openKitchenRemodel,
    backsplash:
      kitchenNoteNamesBacksplash(kitchenNoteText) || openKitchenRemodel,
    flooring: /\b(?:flooring|lvp|vinyl|laminate|tile)\b/i.test(kitchenNoteText),
    island: /\bisland\b/i.test(kitchenNoteText),
    appliances:
      /\b(?:appliances?|dishwasher|refrigerator|range|oven|hood|microwave)\b/i.test(
        kitchenNoteText
      ),
  };
  const showKitchenIslandCounterField =
    (showIslandCounterField || condensedKitchenScope.island) &&
    (!condensed || condensedKitchenScope.island);
  const notesNameApplianceInstall =
    /\b(?:install|new|replace)\b[^.]{0,40}\b(?:appliances?|dishwashers?|refrigerators?|fridges?|ranges?|ovens?|hoods?|microwaves?)\b|\b(?:appliances?|dishwashers?|refrigerators?|fridges?|ranges?|ovens?|hoods?|microwaves?)\b[^.]{0,40}\b(?:install|new|replace)\b/i.test(
      kitchenNoteText
    );
  const condensedKitchenInstallRows = condensed
    ? KITCHEN_INSTALL_STEPPER_ROWS.filter(row =>
        row.key === 'kitchenInstallIslandCount'
          ? condensedKitchenScope.island
          : notesNameApplianceInstall
      )
    : KITCHEN_INSTALL_STEPPER_ROWS;
  const selectedKitchenDemo = kitchenSelectedDemoSurfaces({
    notes: kitchenNoteText,
    measurements: measurements as Record<string, unknown>,
    demo,
  });
  const showIslandDemoRow = condensed
    ? selectedKitchenDemo.island
    : kitchenNoteNamesSurfaceDemo(kitchenNoteText, 'island');
  const showApplianceDemoRow = condensed
    ? selectedKitchenDemo.appliances
    : true;
  const condensedKitchenDemoRows = condensed
    ? KITCHEN_DEMO_STEPPER_ROWS.filter(row =>
        row.key === 'kitchenDemoIslandCount'
          ? showIslandDemoRow
          : showApplianceDemoRow
      )
    : KITCHEN_DEMO_STEPPER_ROWS;
  const showCabinetDemoRow = condensed
    ? selectedKitchenDemo.cabinet
    : condensedKitchenScope.cabinets;
  const showCounterDemoRow = condensed
    ? selectedKitchenDemo.counter
    : condensedKitchenScope.counters;
  const showBacksplashDemoRow = condensed
    ? selectedKitchenDemo.backsplash
    : condensedKitchenScope.backsplash;
  const showFloorDemoRow =
    showKitchenFloorField &&
    (condensed
      ? selectedKitchenDemo.floor
      : hasExplicitKitchenFloorScope || selectedKitchenDemo.floor);
  const floorDemoUsesRemovalArea = !hasExplicitKitchenFloorScope;
  const hasCondensedKitchenDemo =
    showCabinetDemoRow ||
    showCounterDemoRow ||
    showBacksplashDemoRow ||
    showFloorDemoRow ||
    condensedKitchenDemoRows.length > 0;

  const handleExistingStepperAdjust = useCallback(
    (key: string, delta: number) =>
      adjustExisting(key as keyof KitchenExistingCounts, delta),
    [adjustExisting]
  );
  const handleKitchenMeasurementRowChange = useCallback(
    (key: KitchenMeasurementKey) => ({
      onChangeText: (text: string) =>
        handleKitchenMeasurementDraftChange(key, text),
      onBlur: () => commitKitchenMeasurement(key),
    }),
    [commitKitchenMeasurement, handleKitchenMeasurementDraftChange]
  );
  const cabinetLfField = handleKitchenMeasurementRowChange('cabinetLf');
  const countertopField = handleKitchenMeasurementRowChange('countertopSqft');
  const islandCounterField = handleKitchenMeasurementRowChange(
    'kitchenIslandCounterSqft'
  );
  const backsplashField = handleKitchenMeasurementRowChange('backsplashSqft');
  const kitchenFloorField =
    handleKitchenMeasurementRowChange('kitchenFloorSqft');
  const floorDemoField = handleKitchenMeasurementRowChange('floorDemoSqft');
  const handleInstallStepperAdjust = useCallback(
    (key: string, delta: number) =>
      adjustInstall(
        key as 'kitchenInstallApplianceCount' | 'kitchenInstallIslandCount',
        delta
      ),
    [adjustInstall]
  );
  const handleDemoStepperAdjust = useCallback(
    (key: string, delta: number) =>
      adjustDemo(key as KitchenDemoOverrideKey, delta),
    [adjustDemo]
  );

  return (
    <>
      {!condensed && showExistingPanel ? (
        <QmScopePanelSection
          title='Existing kitchen'
          {...qmExistingScopePanelStyle(darkMode)}
          caption={existingCaption}
          rows={KITCHEN_EXISTING_ROWS}
          counts={existing as Record<string, number | null>}
          onAdjust={handleExistingStepperAdjust}
          applying={applying}
          darkMode={darkMode}
          Colors={Colors}
        />
      ) : null}
      {showInstallPanel ? (
        <QmScopePanelSection
          title='Kitchen install'
          {...installPanelStyle}
          caption='Set what is in this bid — cabinets, counters, and finishes use LF or sqft; scope cards sync below.'
          rows={[]}
          counts={install as Record<string, number | null>}
          onAdjust={handleInstallStepperAdjust}
          applying={applying}
          midContent={
            <View style={{ marginBottom: 4 }}>
              <QmScopeSubheading
                label='Measurements'
                darkMode={darkMode}
                Colors={Colors}
              />
              {condensedKitchenScope.cabinets ? (
                <QmSqftMeasurementRow
                  label='Cabinets'
                  helperText='Cabinet run length for this kitchen — LF, not a fixture count.'
                  value={cabinetLfValue}
                  unitLabel='LF'
                  onChangeText={cabinetLfField.onChangeText}
                  onBlur={cabinetLfField.onBlur}
                  applying={applying}
                  darkMode={darkMode}
                  Colors={Colors}
                  sectionLead
                />
              ) : null}
              {condensedKitchenScope.counters ? (
                <QmSqftMeasurementRow
                  label='Counters'
                  helperText='Perimeter countertop area — island SF is added to this same countertop pricing card.'
                  value={countertopSqftValue}
                  onChangeText={countertopField.onChangeText}
                  onBlur={countertopField.onBlur}
                  applying={applying}
                  darkMode={darkMode}
                  Colors={Colors}
                />
              ) : null}
              {showKitchenIslandCounterField ? (
                <QmSqftMeasurementRow
                  label='Island counter'
                  helperText='Island top area only — rolls into Countertops pricing with perimeter SF.'
                  value={kitchenIslandCounterSqftValue}
                  onChangeText={islandCounterField.onChangeText}
                  onBlur={islandCounterField.onBlur}
                  applying={applying}
                  darkMode={darkMode}
                  Colors={Colors}
                />
              ) : null}
              {condensedKitchenScope.backsplash ? (
                <QmSqftMeasurementRow
                  label='Backsplash'
                  helperText='Backsplash tile area — same takeoff feeds install and demo.'
                  value={backsplashSqftValue}
                  onChangeText={backsplashField.onChangeText}
                  onBlur={backsplashField.onBlur}
                  applying={applying}
                  darkMode={darkMode}
                  Colors={Colors}
                />
              ) : null}
              {showKitchenFloorField &&
              hasExplicitKitchenFloorScope &&
              (!condensed || condensedKitchenScope.flooring) ? (
                <QmSqftMeasurementRow
                  label='Kitchen floor'
                  helperText='Floor finish area — separate from wall layout scope below.'
                  value={kitchenFloorSqftValue}
                  onChangeText={kitchenFloorField.onChangeText}
                  onBlur={kitchenFloorField.onBlur}
                  applying={applying}
                  darkMode={darkMode}
                  Colors={Colors}
                  sectionEnd
                />
              ) : null}
            </View>
          }
          trailingRows={condensedKitchenInstallRows}
          stepperMax={Infinity}
          darkMode={darkMode}
          Colors={Colors}
        />
      ) : null}
      {condensed && !hasCondensedKitchenDemo ? null : (
        <QmScopePanelSection
          title='Demo / tear-out'
          {...qmDemoScopePanelStyle(darkMode)}
          caption={`${demoCaption} Cabinet and counter demo use LF/sqft takeoffs. Backsplash and floor demo use sqft.`}
          rows={[]}
          counts={demo as Record<string, number | null>}
          onAdjust={handleDemoStepperAdjust}
          applying={applying}
          darkMode={darkMode}
          Colors={Colors}
          midContent={
            <View style={{ marginBottom: 4 }}>
              <QmScopeSubheading
                label='Measurements'
                darkMode={darkMode}
                Colors={Colors}
              />
              {showCabinetDemoRow ? (
                <QmSqftMeasurementRow
                  label='Cabinet demo'
                  helperText='Cabinet run length to remove — LF, not a fixture count. Same takeoff as install cabinets.'
                  value={cabinetLfValue}
                  unitLabel='LF'
                  onChangeText={cabinetLfField.onChangeText}
                  onBlur={cabinetLfField.onBlur}
                  applying={applying}
                  darkMode={darkMode}
                  Colors={Colors}
                  sectionLead
                />
              ) : null}
              {showCounterDemoRow ? (
                <QmSqftMeasurementRow
                  label='Countertop demo'
                  helperText={
                    showIslandDemoRow
                      ? 'Perimeter + island counter SF to remove — same takeoff as countertop install.'
                      : 'Perimeter counter sqft to remove. A new island top stays on the install card.'
                  }
                  value={countertopSqftValue}
                  onChangeText={countertopField.onChangeText}
                  onBlur={countertopField.onBlur}
                  applying={applying}
                  darkMode={darkMode}
                  Colors={Colors}
                />
              ) : null}
              {showKitchenIslandCounterField && showIslandDemoRow ? (
                <QmSqftMeasurementRow
                  label='Island counter demo'
                  helperText='Island top tear-out area — combined with perimeter on Countertop demo.'
                  value={kitchenIslandCounterSqftValue}
                  onChangeText={islandCounterField.onChangeText}
                  onBlur={islandCounterField.onBlur}
                  applying={applying}
                  darkMode={darkMode}
                  Colors={Colors}
                />
              ) : null}
              {showBacksplashDemoRow ? (
                <QmSqftMeasurementRow
                  label='Backsplash demo'
                  helperText='Tear-out area — same takeoff as install backsplash when both are in scope.'
                  value={backsplashSqftValue}
                  onChangeText={backsplashField.onChangeText}
                  onBlur={backsplashField.onBlur}
                  applying={applying}
                  darkMode={darkMode}
                  Colors={Colors}
                />
              ) : null}
              {showFloorDemoRow ? (
                <QmSqftMeasurementRow
                  label='Floor demo'
                  helperText='Kitchen floor tear-out area.'
                  value={
                    floorDemoUsesRemovalArea
                      ? floorDemoSqftValue
                      : kitchenFloorSqftValue
                  }
                  onChangeText={
                    floorDemoUsesRemovalArea
                      ? floorDemoField.onChangeText
                      : kitchenFloorField.onChangeText
                  }
                  onBlur={
                    floorDemoUsesRemovalArea
                      ? floorDemoField.onBlur
                      : kitchenFloorField.onBlur
                  }
                  applying={applying}
                  darkMode={darkMode}
                  Colors={Colors}
                  sectionEnd
                />
              ) : null}
            </View>
          }
          trailingRows={condensedKitchenDemoRows}
          stepperMax={Infinity}
        />
      )}
    </>
  );
}

export function QmFlooringScopePanels({
  measurements,
  setMeasurements,
  notes,
  showExistingPanel,
  applying,
  onFlooringQmChange,
  onFlooringScopeSync,
  measurementFooter,
  measurementFootersByKey,
  onFlooringBottomCollapse,
  onFloorPrepCollapse,
  scrollRef,
  scrollContentRef,
  darkMode,
  Colors,
}: {
  measurements: ScopeMeasurementsInputExtended;
  setMeasurements: React.Dispatch<
    React.SetStateAction<ScopeMeasurementsInputExtended>
  >;
  notes?: string | null;
  showExistingPanel: boolean;
  applying: boolean;
  onFlooringQmChange?: (params: {
    existing: FlooringExistingCounts;
    install: FlooringInstallCounts;
    demo: FlooringDemoCounts;
  }) => void;
  onFlooringScopeSync?: (measurements: Record<string, unknown>) => void;
  measurementFooter?: React.ReactNode;
  measurementFootersByKey?: Partial<Record<string, React.ReactNode>>;
  onFlooringBottomCollapse?: () => void;
  onFloorPrepCollapse?: () => void;
  scrollRef?: React.RefObject<ScrollView | null>;
  scrollContentRef?: React.RefObject<View | null>;
  darkMode: boolean;
  Colors: Colors;
}) {
  const flooringNotes = notesDescribeDedicatedFlooringJob(notes)
    ? String(notes || '')
    : dedicatedFlooringNoteText(notes);
  const noteRemovedTypes = dedicatedFlooringRemovedTypes(notes);
  const noteRemovedKey = (noteRemovedTypes || []).join(',');
  const [existing, setExisting] = useState(() =>
    noteRemovedTypes?.length
      ? {
          flooringExistingCount: 1,
          flooringExistingTypes: noteRemovedTypes,
        }
      : readFlooringExisting(measurements)
  );
  const [install, setInstall] = useState(() =>
    readFlooringInstall(measurements)
  );
  const [demo, setDemo] = useState(() => readFlooringDemo(measurements));
  const prepNamedInNotes = notesRequestFloorPrep(flooringNotes);
  const existingNamedInNotes = flooringExistingCardStartsOpen(notes);
  const prepAreaReady = Object.values(measurements.floorPrepByProduct || {}).some(
    entry => Number(entry?.sqft || 0) > 0
  );
  const [existingExpanded, setExistingExpanded] = useState(true);
  const existingAutoOpenedRef = useRef(true);
  const [newExpanded, setNewExpanded] = useState(true);
  const [prepExpanded, setPrepExpanded] = useState(
    () => prepNamedInNotes || prepAreaReady
  );
  const prepAutoOpenedRef = useRef(prepNamedInNotes || prepAreaReady);
  const [showMoreExistingFlooring, setShowMoreExistingFlooring] =
    useState(false);
  const [showMoreNewFlooring, setShowMoreNewFlooring] = useState(false);
  const [sqftDrafts, setSqftDrafts] = useState<Record<string, string>>({});
  const [sqftEditingKey, setSqftEditingKey] = useState<string | null>(null);
  const planFloorSqft = (() => {
    if (measurements.planImportMode !== 'selected_trade') return 0;
    if (measurements.planImportTradeKey !== 'flooring') return 0;
    if (measurements.quickMeasurementSources?.floorAreaSqft === 'user_entered') {
      return 0;
    }
    const living = Number(
      String(measurements.floorAreaSqft ?? '').replace(/,/g, '')
    );
    return Number.isFinite(living) && living > 0 ? living : 0;
  })();
  const genRef = useRef(0);
  const appliedRef = useRef(0);
  const demoManualRef = useRef(false);
  const seededFlooringNoteRef = useRef<string | null>(null);
  const measurementsRef = useRef(measurements);
  const existingCardRef = useRef<View>(null);
  const newCardRef = useRef<View>(null);
  const prepCardRef = useRef<View>(null);
  measurementsRef.current = measurements;

  const focusCard = useCallback(
    (cardRef: React.RefObject<View | null>) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const card = cardRef.current;
          const content = scrollContentRef?.current;
          if (!card || !content) return;
          card.measureLayout(content, (_x, y) => {
            scrollRef?.current?.scrollTo({
              y: Math.max(0, y - 12),
              animated: true,
            });
          });
        });
      });
    },
    [scrollContentRef, scrollRef]
  );

  const syncScopeFromSnapshot = useCallback(
    (snapshot: ScopeMeasurementsInputExtended) => {
      onFlooringScopeSync?.({
        ...(snapshot as Record<string, unknown>),
        scopeNotes: flooringNotes,
      });
    },
    [flooringNotes, onFlooringScopeSync]
  );

  const sqftDraftKey = (kind: 'new' | 'demo' | 'prep', id: string) =>
    `${kind}:${id}`;

  const beginSqftDraft = (
    kind: 'new' | 'demo' | 'prep',
    id: string,
    currentValue: string
  ) => {
    const key = sqftDraftKey(kind, id);
    setSqftEditingKey(key);
    setSqftDrafts(prev => ({ ...prev, [key]: prev[key] ?? currentValue }));
  };

  const updateSqftDraft = (
    kind: 'new' | 'demo' | 'prep',
    id: string,
    value: string
  ) => {
    const key = sqftDraftKey(kind, id);
    setSqftDrafts(prev => ({ ...prev, [key]: value }));
  };

  const displaySqftDraft = (
    kind: 'new' | 'demo' | 'prep',
    id: string,
    currentValue: string
  ) => {
    const key = sqftDraftKey(kind, id);
    return sqftEditingKey === key
      ? (sqftDrafts[key] ?? currentValue)
      : currentValue;
  };

  const endSqftDraft = (
    kind: 'new' | 'demo' | 'prep',
    id: string,
    commit: (value: string) => void
  ) => {
    const key = sqftDraftKey(kind, id);
    const value = sqftDrafts[key] ?? '';
    commit(value);
    setSqftEditingKey(current => (current === key ? null : current));
    setSqftDrafts(prev => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  useEffect(() => {
    if (existingAutoOpenedRef.current) return;
    if (!existingNamedInNotes) return;
    existingAutoOpenedRef.current = true;
    setExistingExpanded(true);
  }, [existingNamedInNotes]);

  useEffect(() => {
    if (seededFlooringNoteRef.current === flooringNotes) return;
    if (
      !noteRemovedTypes?.length &&
      !notesDescribeDedicatedFlooringJob(flooringNotes)
    ) {
      return;
    }
    seededFlooringNoteRef.current = flooringNotes;
    const roles = dedicatedFlooringProductRoles(flooringNotes);
    const installed = new Set(roles.installed.map(product => product.product));
    const removed = roles.removed
      .map(product => product.product)
      .filter(product => !installed.has(product));
    const current = measurementsRef.current.flooringExistingTypes || [];
    const nextTypes = removed.length
      ? removed
      : current.filter(type => type === 'unknown' || !installed.has(type));
    const area =
      Number(
        String(measurementsRef.current.floorDemoSqft ?? '').replace(/,/g, '')
      ) ||
      dedicatedFlooringAreaSqft(flooringNotes) ||
      0;
    const removalKey = removed.length === 1 ? `floor_demo__${removed[0]}` : '';
    const clearPrep = !notesRequestFloorPrep(flooringNotes);
    const existingTypes = nextTypes.length
      ? (nextTypes as NonNullable<
          FlooringExistingCounts['flooringExistingTypes']
        >)
      : null;
    if (existingTypes?.length) {
      setExisting({
        flooringExistingCount: 1,
        flooringExistingTypes: existingTypes,
      });
    }
    setMeasurements(prev => {
      const quantities = { ...(prev.itemQuantities || {}) };
      if (removed.length) {
        for (const key of Object.keys(quantities)) {
          if (!key.startsWith('floor_demo__')) continue;
          const product = key.slice('floor_demo__'.length);
          if (!removed.includes(product)) delete quantities[key];
        }
      }
      if (removalKey && area > 0) {
        quantities[removalKey] = {
          quantity: area,
          unit: 'sqft',
          quantitySource: 'notes',
        };
        quantities.floor_demo = {
          quantity: area,
          unit: 'sqft',
          quantitySource: 'notes',
        };
      }
      if (clearPrep) delete quantities.floor_prep;
      return {
        ...prev,
        flooringExistingCount: existingTypes ? 1 : prev.flooringExistingCount,
        flooringExistingTypes: existingTypes ?? prev.flooringExistingTypes,
        ...(area > 0 && removed.length ? { floorDemoSqft: area } : {}),
        itemQuantities: quantities,
        ...(clearPrep
          ? { floorPrepByProduct: null, floorPrepSqft: null }
          : {}),
      };
    });
  }, [flooringNotes, noteRemovedKey, setMeasurements]);

  useEffect(() => {
    if (prepAutoOpenedRef.current) return;
    if (!prepNamedInNotes && !prepAreaReady) return;
    prepAutoOpenedRef.current = true;
    setPrepExpanded(true);
  }, [prepNamedInNotes, prepAreaReady]);

  useEffect(() => {
    if (genRef.current !== appliedRef.current) return;
    if (noteRemovedTypes?.length) {
      setExisting(prev => {
        const current = prev.flooringExistingTypes || [];
        const same =
          prev.flooringExistingCount === 1 &&
          current.length === noteRemovedTypes.length &&
          noteRemovedTypes.every(type => current.includes(type));
        return same
          ? prev
          : {
              flooringExistingCount: 1,
              flooringExistingTypes: noteRemovedTypes,
            };
      });
      setInstall(readFlooringInstall(measurements));
      setDemo(readFlooringDemo(measurements));
      return;
    }
    const installedProducts = new Set(
      dedicatedFlooringProductRoles(flooringNotes).installed.map(
        product => product.product
      )
    );
    const fromMeasurements = readFlooringExisting(measurements);
    const measuredTypes = (fromMeasurements.flooringExistingTypes || []).filter(
      type => !installedProducts.has(type)
    );
    setExisting({
      flooringExistingCount: measuredTypes.length ? 1 : null,
      flooringExistingTypes: measuredTypes.length ? measuredTypes : null,
    });
    setInstall(readFlooringInstall(measurements));
    setDemo(readFlooringDemo(measurements));
  }, [
    noteRemovedKey,
    measurements.flooringExistingCount,
    measurements.flooringExistingTypes,
    measurements.flooringInstallScopeCount,
    measurements.flooringDemoScopeCount,
    measurements.flooringProductScope,
  ]);

  const commit = useCallback(
    (
      nextExisting: FlooringExistingCounts,
      nextInstall: FlooringInstallCounts,
      gen: number,
      manualDemo?: number | null
    ) => {
      const mergedDemo =
        manualDemo !== undefined
          ? { flooringDemoScopeCount: manualDemo }
          : demoManualRef.current
            ? readFlooringDemo(measurements)
            : resolveFlooringDemoFromIntent({
                notes: flooringNotes,
                existing: nextExisting,
                install: nextInstall,
              });
      queueMicrotask(() => {
        if (gen !== genRef.current) return;
        startTransition(() => {
          setDemo(mergedDemo);
          const snapshot = {
            ...measurementsRef.current,
            ...nextExisting,
            ...nextInstall,
            ...mergedDemo,
          };
          setMeasurements(snapshot);
          appliedRef.current = genRef.current;
          onFlooringQmChange?.({
            existing: nextExisting,
            install: nextInstall,
            demo: mergedDemo,
          });
          syncScopeFromSnapshot(snapshot);
        });
      });
    },
    [
      flooringNotes,
      measurements,
      onFlooringQmChange,
      setMeasurements,
      syncScopeFromSnapshot,
    ]
  );

  const existingFlooringOptions: Array<{
    id: NonNullable<FlooringExistingCounts['flooringExistingTypes']>[number];
    label: string;
  }> = [
    { id: 'carpet', label: 'Carpet' },
    { id: 'tile', label: 'Tile' },
    { id: 'solid_hardwood', label: 'Solid Hardwood' },
    { id: 'engineered_hardwood', label: 'Engineered Hardwood' },
    { id: 'laminate', label: 'Laminate' },
    { id: 'lvp', label: 'LVP' },
    { id: 'sheet_vinyl_vct', label: 'Sheet Vinyl / VCT' },
    { id: 'unknown', label: 'Unknown' },
  ];

  const chooseExistingTypes = useCallback(
    (
      type: NonNullable<FlooringExistingCounts['flooringExistingTypes']>[number]
    ) => {
      const current = existing.flooringExistingTypes || [];
      const nextTypes =
        type === 'unknown'
          ? current.includes('unknown')
            ? []
            : ['unknown' as const]
          : current.includes(type)
            ? current.filter(value => value !== type && value !== 'unknown')
            : [...current.filter(value => value !== 'unknown'), type];
      const nextExisting = {
        flooringExistingCount: nextTypes.length ? 1 : null,
        flooringExistingTypes: nextTypes.length ? nextTypes : null,
      };
      const gen = ++genRef.current;
      commit(nextExisting, install, gen);
      setExisting(nextExisting);
      const itemQuantities = { ...(measurements.itemQuantities || {}) };
      for (const key of Object.keys(itemQuantities)) {
        if (
          key.startsWith('floor_demo__') &&
          !nextTypes.includes(key.replace('floor_demo__', '') as typeof type)
        ) {
          delete itemQuantities[key];
        }
      }
      const nextDemoTotal = nextTypes.reduce(
        (sum, existingType) =>
          sum +
          Number(
            itemQuantities[existingDemoAreaKey(existingType)]?.quantity || 0
          ),
        0
      );
      if (nextDemoTotal > 0) {
        itemQuantities.floor_demo = {
          quantity: nextDemoTotal,
          unit: 'sqft',
          quantitySource: 'user_entered',
        };
      } else {
        delete itemQuantities.floor_demo;
      }
      const snapshot = {
        ...measurementsRef.current,
        ...nextExisting,
        flooringExistingLvpInstallMethod: nextTypes.includes('lvp')
          ? measurementsRef.current.flooringExistingLvpInstallMethod
          : null,
        flooringExistingSheetVinylType: nextTypes.includes('sheet_vinyl_vct')
          ? measurementsRef.current.flooringExistingSheetVinylType
          : null,
        floorDemoSqft: nextDemoTotal > 0 ? nextDemoTotal : null,
        itemQuantities,
        quickMeasurementSources: {
          ...(measurementsRef.current.quickMeasurementSources || {}),
          floorDemoSqft:
            nextDemoTotal > 0 ? 'user_entered' : 'needs_confirmation',
        },
      };
      setMeasurements(snapshot);
      syncScopeFromSnapshot(snapshot);
    },
    [
      commit,
      existing,
      install,
      measurements.itemQuantities,
      setMeasurements,
      syncScopeFromSnapshot,
    ]
  );

  const newFlooringOptions: Array<{
    id: NonNullable<
      ScopeMeasurementsInputExtended['flooringProductScope']
    >[number];
    label: string;
  }> = [
    { id: 'carpet', label: 'Carpet' },
    { id: 'tile', label: 'Tile' },
    { id: 'solid_hardwood', label: 'Solid Hardwood' },
    { id: 'engineered_hardwood', label: 'Engineered Hardwood' },
    { id: 'laminate', label: 'Laminate' },
    { id: 'lvp', label: 'LVP' },
    { id: 'sheet_vinyl_vct', label: 'Sheet Vinyl / VCT' },
    { id: 'unknown', label: 'Unknown' },
  ];

  const chooseNewFlooringTypes = useCallback(
    (
      type: NonNullable<
        ScopeMeasurementsInputExtended['flooringProductScope']
      >[number]
    ) => {
      const current = Array.isArray(measurements.flooringProductScope)
        ? measurements.flooringProductScope
        : [];
      const nextProducts = current.includes(type)
        ? current.filter(value => value !== type)
        : [...current, type];
      const nextInstall = {
        flooringInstallScopeCount: nextProducts.length ? 1 : null,
      };
      const draftKey = sqftDraftKey('new', type);
      if (!nextProducts.includes(type)) {
        setSqftEditingKey(editing => (editing === draftKey ? null : editing));
        setSqftDrafts(prev => {
          if (!(draftKey in prev)) return prev;
          const next = { ...prev };
          delete next[draftKey];
          return next;
        });
      }
      const mergedDemo = resolveFlooringDemoFromIntent({
        notes: flooringNotes,
        existing,
        install: nextInstall,
      });
      const nextByProduct = {
        ...(measurementsRef.current.floorPrepByProduct || {}),
      };
      if (!nextProducts.includes(type)) {
        delete nextByProduct[type];
      }
      const totalPrep = Object.values(nextByProduct).reduce((sum, entry) => {
        if (!entry || entry.severity === 'none' || !entry.sqft) return sum;
        return sum + Number(entry.sqft);
      }, 0);
      const itemQuantities = {
        ...(measurementsRef.current.itemQuantities || {}),
      };
      if (totalPrep > 0) {
        itemQuantities.floor_prep = {
          quantity: totalPrep,
          unit: 'sqft',
          quantitySource: 'user_entered',
        };
      } else {
        delete itemQuantities.floor_prep;
      }
      const snapshot = {
        ...measurementsRef.current,
        flooringProductScope: nextProducts,
        ...nextInstall,
        ...mergedDemo,
        // Preserve entered product quantities so deselect/reselect restores
        // the same scope card and pricing without requiring a new takeoff.
        flooringNewLvpInstallMethod: nextProducts.includes('lvp')
          ? measurementsRef.current.flooringNewLvpInstallMethod
          : null,
        flooringNewSheetVinylType: nextProducts.includes('sheet_vinyl_vct')
          ? measurementsRef.current.flooringNewSheetVinylType
          : null,
        floorPrepByProduct: Object.keys(nextByProduct).length
          ? nextByProduct
          : null,
        floorPrepSqft: totalPrep > 0 ? totalPrep : null,
        itemQuantities,
      };
      setInstall(nextInstall);
      setDemo(mergedDemo);
      setMeasurements(snapshot);
      syncScopeFromSnapshot(snapshot);
    },
    [
      existing,
      flooringNotes,
      measurements.flooringProductScope,
      setMeasurements,
      syncScopeFromSnapshot,
    ]
  );

  const floorPrepEntryFor = (product: string) =>
    measurements.floorPrepByProduct?.[product] ?? {
      sqft: null,
      severity: null,
    };

  const setFloorPrepForProduct = (
    product: string,
    patch: Partial<{ sqft: number | null; severity: FloorPrepSeverity | null }>
  ) => {
    setMeasurements(prev => {
      const current = prev.floorPrepByProduct || {};
      const nextEntry = {
        sqft:
          patch.sqft !== undefined
            ? patch.sqft
            : (current[product]?.sqft ?? null),
        severity:
          patch.severity !== undefined
            ? patch.severity
            : (current[product]?.severity ?? null),
      };
      const nextByProduct = { ...current, [product]: nextEntry };
      const totalPrep = Object.values(nextByProduct).reduce((sum, entry) => {
        if (!entry || entry.severity === 'none' || !entry.sqft) return sum;
        return sum + Number(entry.sqft);
      }, 0);
      const itemQuantities = { ...(prev.itemQuantities || {}) };
      if (totalPrep > 0) {
        itemQuantities.floor_prep = {
          quantity: totalPrep,
          unit: 'sqft',
          quantitySource: 'user_entered',
        };
      } else {
        delete itemQuantities.floor_prep;
      }
      const snapshot = {
        ...prev,
        floorPrepByProduct: nextByProduct,
        floorPrepSqft: totalPrep > 0 ? totalPrep : null,
        itemQuantities,
      };
      syncScopeFromSnapshot(snapshot);
      return snapshot;
    });
  };

  const adjustDemo = useCallback(
    (delta: number) => {
      const gen = ++genRef.current;
      demoManualRef.current = true;
      setDemo(prev => {
        const current = prev.flooringDemoScopeCount ?? 0;
        const cleaned = clampQmCount(
          current + delta < 1 ? null : current + delta
        );
        commit(existing, install, gen, cleaned);
        return { flooringDemoScopeCount: cleaned };
      });
    },
    [commit, existing, install]
  );

  function existingDemoAreaKey(
    type: NonNullable<FlooringExistingCounts['flooringExistingTypes']>[number]
  ) {
    return `floor_demo__${type}`;
  }
  const existingDemoArea = (
    type: NonNullable<FlooringExistingCounts['flooringExistingTypes']>[number]
  ): string => {
    const value =
      measurements.itemQuantities?.[existingDemoAreaKey(type)]?.quantity;
    if (value != null && Number(value) > 0) return String(value);
    if (noteRemovedTypes?.length === 1 && noteRemovedTypes[0] === type) {
      const fromField = Number(
        String(measurements.floorDemoSqft ?? '').replace(/,/g, '')
      );
      if (fromField > 0) return String(fromField);
      const fromNote = dedicatedFlooringAreaSqft(flooringNotes);
      if (fromNote) return String(fromNote);
    }
    return value == null ? '' : String(value);
  };
  const commitExistingDemoArea = (
    type: NonNullable<FlooringExistingCounts['flooringExistingTypes']>[number],
    value: string
  ) => {
    const itemQuantities = { ...(measurements.itemQuantities || {}) };
    const key = existingDemoAreaKey(type);
    const numericValue = Number(value.replace(/,/g, ''));
    if (value.trim() && Number.isFinite(numericValue) && numericValue > 0) {
      itemQuantities[key] = {
        quantity: numericValue,
        unit: 'sqft',
        quantitySource: 'user_entered',
      };
    } else {
      delete itemQuantities[key];
    }
    const total = (existing.flooringExistingTypes || []).reduce(
      (sum, existingType) =>
        sum +
        Number(
          itemQuantities[existingDemoAreaKey(existingType)]?.quantity || 0
        ),
      0
    );
    if (total > 0) {
      itemQuantities.floor_demo = {
        quantity: total,
        unit: 'sqft',
        quantitySource: 'user_entered',
      };
    } else {
      delete itemQuantities.floor_demo;
    }
    const snapshot = {
      ...measurementsRef.current,
      floorDemoSqft: total > 0 ? total : null,
      itemQuantities,
      quickMeasurementSources: {
        ...(measurementsRef.current.quickMeasurementSources || {}),
        floorDemoSqft: total > 0 ? 'user_entered' : 'needs_confirmation',
      },
      quickMeasurementUserOverrides: {
        ...(measurementsRef.current.quickMeasurementUserOverrides || {}),
        floorDemoSqft: true,
      },
    };
    setMeasurements(snapshot);
    syncScopeFromSnapshot(snapshot);
  };
  const newFlooringMeasurementKey: Record<
    string,
    keyof ScopeMeasurementsInputExtended
  > = {
    lvp: 'flooringLvpSqft',
    laminate: 'flooringLaminateSqft',
    engineered_hardwood: 'flooringEngineeredHardwoodSqft',
    solid_hardwood: 'flooringSolidHardwoodSqft',
    tile: 'flooringTileSqft',
    carpet: 'flooringCarpetSqft',
    sheet_vinyl_vct: 'flooringSheetVinylSqft',
  };
  const newFlooringArea = (product: string): string => {
    const key = newFlooringMeasurementKey[product];
    const value = key
      ? measurements[key]
      : measurements.itemQuantities?.[`floor_install__${product}`]?.quantity;
    return value == null ? '' : String(value);
  };
  const commitNewFlooringArea = (product: string, value: string) => {
    const key = newFlooringMeasurementKey[product];
    const scopeItemId: Record<string, string> = {
      lvp: 'flooring_lvp',
      laminate: 'flooring_laminate',
      engineered_hardwood: 'flooring_engineered_hardwood',
      solid_hardwood: 'flooring_solid_hardwood',
      tile: 'tile_flooring',
      carpet: 'flooring_carpet',
      sheet_vinyl_vct: 'flooring_sheet_vinyl',
    };
    const numericValue = Number(value.replace(/,/g, ''));
    const prev = measurementsRef.current;
    const itemQuantities = { ...(prev.itemQuantities || {}) };
    const quantityKey = `floor_install__${product}`;
    if (value.trim() && Number.isFinite(numericValue) && numericValue > 0) {
      // Keep the per-product quantity catalog in sync with the legacy
      // product-specific fields so the matching scope card can price it.
      itemQuantities[quantityKey] = {
        quantity: numericValue,
        unit: 'sqft',
        quantitySource: 'user_entered',
      };
      const checklistId = scopeItemId[product];
      if (checklistId) {
        itemQuantities[checklistId] = {
          quantity: numericValue,
          unit: 'sqft',
          quantitySource: 'user_entered',
        };
      }
    } else {
      delete itemQuantities[quantityKey];
    }
    const next = {
      ...prev,
      ...(key
        ? {
            [key]:
              value.trim() && Number.isFinite(numericValue) && numericValue > 0
                ? numericValue
                : null,
          }
        : {}),
      itemQuantities,
    };
    const snapshot = {
      ...next,
      quickMeasurementSources: {
        ...(prev.quickMeasurementSources || {}),
        ...(key
          ? { [key]: numericValue > 0 ? 'user_entered' : 'needs_confirmation' }
          : {}),
      },
    };
    setMeasurements(snapshot);
    syncScopeFromSnapshot(snapshot);
  };
  const newFlooringSubtypeOptions = (product: string) =>
    product === 'sheet_vinyl_vct'
      ? [
          ['sheet_vinyl', 'Sheet vinyl'],
          ['vct', 'VCT (vinyl composition tile)'],
          ['unknown', 'Not sure'],
        ]
      : [];
  const installedFloorProducts = new Set(
    dedicatedFlooringProductRoles(flooringNotes).installed.map(
      product => product.product
    )
  );
  const selectedExistingTypes = noteRemovedTypes?.length
    ? noteRemovedTypes
    : (existing.flooringExistingTypes || []).filter(
        type => !installedFloorProducts.has(type)
      );
  const selectedNewProducts = Array.isArray(measurements.flooringProductScope)
    ? measurements.flooringProductScope
    : [];
  const selectedNewFlooringOptions = newFlooringOptions.filter(option =>
    selectedNewProducts.includes(option.id)
  );
  return (
    <>
      {showExistingPanel ? (
        <View
          ref={existingCardRef}
          style={[
            styles.qmPanel,
            {
              borderColor: darkMode
                ? 'rgba(148,163,184,0.28)'
                : 'rgba(100,116,139,0.24)',
              backgroundColor: darkMode
                ? 'rgba(148,163,184,0.06)'
                : 'rgba(148,163,184,0.05)',
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => setExistingExpanded(expanded => !expanded)}
            activeOpacity={0.75}
          >
            <Text
              style={[
                styles.qmPanelTitle,
                { color: darkMode ? '#cbd5e1' : '#475569' },
              ]}
            >
              Existing flooring {existingExpanded ? '⌃' : '⌄'}
            </Text>
            {existingExpanded ? (
              <Text
                style={[
                  styles.qmPanelCaption,
                  { color: darkMode ? '#64748b' : '#d7e1f0', marginTop: 2 },
                ]}
              >
                Tap to collapse card
              </Text>
            ) : (
              <Text
                style={[
                  styles.qmPanelCaption,
                  { color: darkMode ? '#d7e1f0' : '#64748b' },
                ]}
              >
                {selectedExistingTypes.length} selected ·{' '}
                {selectedExistingTypes
                  .reduce(
                    (sum, type) => sum + Number(existingDemoArea(type) || 0),
                    0
                  )
                  .toLocaleString()}{' '}
                SF removal
              </Text>
            )}
          </TouchableOpacity>
          {existingExpanded ? (
            <>
              <Text
                style={[
                  styles.qmPanelCaption,
                  { color: darkMode ? '#d7e1f0' : '#64748b' },
                ]}
              >
                Select what is in the space now. Multiple types are allowed.
              </Text>
              <View style={styles.qmOptionWrap}>
                {(selectedExistingTypes.length === 0 || showMoreExistingFlooring
                  ? existingFlooringOptions
                  : existingFlooringOptions.filter(option =>
                      selectedExistingTypes.includes(option.id)
                    )
                ).map(option => {
                  const selected = selectedExistingTypes.includes(option.id);
                  return (
                    <React.Fragment key={option.id}>
                      <TouchableOpacity
                        onPress={() => {
                          if (installedFloorProducts.has(option.id)) return;
                          chooseExistingTypes(option.id);
                        }}
                        disabled={applying}
                        activeOpacity={1}
                        style={[
                          styles.qmOption,
                          {
                            borderColor: selected
                              ? '#34d399'
                              : darkMode
                                ? '#52525b'
                                : '#cbd5e1',
                            backgroundColor: selected
                              ? 'rgba(52, 211, 153, 0.12)'
                              : darkMode
                                ? '#3a3a3c'
                                : '#f1f5f9',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.qmOptionText,
                            {
                              color: selected
                                ? '#34d399'
                                : darkMode
                                  ? '#e4e4e7'
                                  : Colors.text,
                            },
                          ]}
                        >
                          {selected ? '✓ ' : ''}
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                      {selected && option.id === 'lvp' ? (
                        <View style={{ marginTop: 10 }}>
                          <Text
                            style={[
                              styles.qmPanelCaption,
                              {
                                color: darkMode ? '#F5F7FA' : Colors.text,
                                marginBottom: 6,
                              },
                            ]}
                          >
                            How is the existing LVP installed?
                          </Text>
                          <View style={styles.qmOptionWrap}>
                            {[
                              ['floating', 'Floating / click-lock'],
                              ['glue_down', 'Glue-down LVP'],
                              ['unknown', 'Not sure'],
                            ].map(([id, label]) => {
                              const selectedMethod =
                                measurements.flooringExistingLvpInstallMethod ===
                                id;
                              return (
                                <TouchableOpacity
                                  key={`${option.id}-${id}`}
                                  onPress={() =>
                                    setMeasurements(prev => ({
                                      ...prev,
                                      flooringExistingLvpInstallMethod: id as
                                        | 'floating'
                                        | 'glue_down'
                                        | 'unknown',
                                    }))
                                  }
                                  disabled={applying}
                                  activeOpacity={1}
                                  style={[
                                    styles.qmOption,
                                    {
                                      borderColor: selectedMethod
                                        ? '#34d399'
                                        : darkMode
                                          ? '#52525b'
                                          : '#cbd5e1',
                                      backgroundColor: selectedMethod
                                        ? 'rgba(52, 211, 153, 0.12)'
                                        : darkMode
                                          ? '#3a3a3c'
                                          : '#f1f5f9',
                                    },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.qmOptionText,
                                      {
                                        color: selectedMethod
                                          ? '#34d399'
                                          : darkMode
                                            ? '#e4e4e7'
                                            : Colors.text,
                                      },
                                    ]}
                                  >
                                    {selectedMethod ? '✓ ' : ''}
                                    {label}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </View>
                      ) : null}
                      {selected && option.id === 'sheet_vinyl_vct' ? (
                        <View style={{ marginTop: 10 }}>
                          <Text
                            style={[
                              styles.qmPanelCaption,
                              {
                                color: darkMode ? '#F5F7FA' : Colors.text,
                                marginBottom: 6,
                              },
                            ]}
                          >
                            What type of vinyl flooring is being removed?
                          </Text>
                          <View style={styles.qmOptionWrap}>
                            {[
                              ['sheet_vinyl', 'Sheet vinyl'],
                              ['vct', 'VCT (vinyl composition tile)'],
                              ['unknown', 'Not sure'],
                            ].map(([id, label]) => {
                              const selectedSubtype =
                                measurements.flooringExistingSheetVinylType ===
                                id;
                              return (
                                <TouchableOpacity
                                  key={`${option.id}-${id}`}
                                  onPress={() =>
                                    setMeasurements(prev => ({
                                      ...prev,
                                      flooringExistingSheetVinylType: id as
                                        | 'sheet_vinyl'
                                        | 'vct'
                                        | 'unknown',
                                    }))
                                  }
                                  disabled={applying}
                                  activeOpacity={1}
                                  style={[
                                    styles.qmOption,
                                    {
                                      borderColor: selectedSubtype
                                        ? '#34d399'
                                        : darkMode
                                          ? '#52525b'
                                          : '#cbd5e1',
                                      backgroundColor: selectedSubtype
                                        ? 'rgba(52, 211, 153, 0.12)'
                                        : darkMode
                                          ? '#3a3a3c'
                                          : '#f1f5f9',
                                    },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.qmOptionText,
                                      {
                                        color: selectedSubtype
                                          ? '#34d399'
                                          : darkMode
                                            ? '#e4e4e7'
                                            : Colors.text,
                                      },
                                    ]}
                                  >
                                    {selectedSubtype ? '✓ ' : ''}
                                    {label}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </View>
                      ) : null}
                      {selected && option.id !== 'sheet_vinyl_vct' ? (
                        <QmSqftMeasurementRow
                          label={`${option.label} removal area`}
                          helperText='Enter the area of this existing flooring type being removed.'
                          value={displaySqftDraft(
                            'demo',
                            option.id,
                            existingDemoArea(option.id)
                          )}
                          placeholder='Enter'
                          onFocus={() =>
                            beginSqftDraft(
                              'demo',
                              option.id,
                              existingDemoArea(option.id)
                            )
                          }
                          onChangeText={value =>
                            updateSqftDraft('demo', option.id, value)
                          }
                          onBlur={() =>
                            endSqftDraft('demo', option.id, value =>
                              commitExistingDemoArea(option.id, value)
                            )
                          }
                          applying={applying}
                          darkMode={darkMode}
                          Colors={Colors}
                          highlighted={selected}
                        />
                      ) : null}
                      {selected &&
                      option.id === 'sheet_vinyl_vct' &&
                      measurements.flooringExistingSheetVinylType ? (
                        <QmSqftMeasurementRow
                          label={
                            measurements.flooringExistingSheetVinylType ===
                            'sheet_vinyl'
                              ? 'Sheet vinyl removal area'
                              : measurements.flooringExistingSheetVinylType ===
                                  'vct'
                                ? 'VCT (vinyl composition tile) removal area'
                                : 'Vinyl flooring removal area'
                          }
                          helperText='Enter the area of this existing flooring type being removed.'
                          value={displaySqftDraft(
                            'demo',
                            option.id,
                            existingDemoArea(option.id)
                          )}
                          placeholder='Enter'
                          onFocus={() =>
                            beginSqftDraft(
                              'demo',
                              option.id,
                              existingDemoArea(option.id)
                            )
                          }
                          onChangeText={value =>
                            updateSqftDraft('demo', option.id, value)
                          }
                          onBlur={() =>
                            endSqftDraft('demo', option.id, value =>
                              commitExistingDemoArea(option.id, value)
                            )
                          }
                          applying={applying}
                          darkMode={darkMode}
                          Colors={Colors}
                          highlighted={selected}
                        />
                      ) : null}
                      {selected ? (
                        <View
                          style={{
                            height: 8,
                            marginTop: 8,
                            borderTopWidth: 1,
                            borderTopColor: darkMode
                              ? 'rgba(255,255,255,0.10)'
                              : Colors.line,
                          }}
                        />
                      ) : null}
                    </React.Fragment>
                  );
                })}
                {selectedExistingTypes.length > 0 && !showMoreExistingFlooring ? (
                  <TouchableOpacity
                    onPress={() => setShowMoreExistingFlooring(true)}
                    activeOpacity={0.75}
                    accessibilityRole='button'
                    accessibilityLabel='Show extra flooring styles'
                    style={[
                      styles.qmOption,
                      {
                        marginTop: 4,
                        borderColor: darkMode ? '#52525b' : '#cbd5e1',
                        backgroundColor: darkMode ? '#3a3a3c' : '#f1f5f9',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.qmOptionText,
                        { color: darkMode ? '#e4e4e7' : Colors.text },
                      ]}
                    >
                      Show extra flooring styles
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </>
          ) : null}
          {existingExpanded ? (
            <TouchableOpacity
              onPress={() => {
                setExistingExpanded(false);
                focusCard(newCardRef);
              }}
              activeOpacity={0.75}
              style={{
                marginTop: 12,
                paddingTop: 10,
                borderTopWidth: 1,
                borderTopColor: darkMode
                  ? 'rgba(255,255,255,0.12)'
                  : Colors.line,
              }}
            >
              <Text
                style={[
                  styles.qmPanelCaption,
                  {
                    color: darkMode ? '#d7e1f0' : '#64748b',
                    textAlign: 'center',
                  },
                ]}
              >
                Collapse card ⌃
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
      <View
        ref={newCardRef}
        style={[
          styles.qmPanel,
          {
            borderColor: darkMode
              ? 'rgba(148,163,184,0.28)'
              : 'rgba(100,116,139,0.24)',
            backgroundColor: darkMode
              ? 'rgba(148,163,184,0.06)'
              : 'rgba(148,163,184,0.05)',
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => setNewExpanded(expanded => !expanded)}
          activeOpacity={0.75}
        >
          <Text
            style={[
              styles.qmPanelTitle,
              { color: darkMode ? '#F5F7FA' : '#475569' },
            ]}
          >
            New Flooring {newExpanded ? '⌃' : '⌄'}
          </Text>
          {newExpanded ? (
            <Text
              style={[
                styles.qmPanelCaption,
                { color: darkMode ? '#64748b' : '#d7e1f0', marginTop: 2 },
              ]}
            >
              Tap to collapse card
            </Text>
          ) : (
            <Text
              style={[
                styles.qmPanelCaption,
                { color: darkMode ? '#CBD5E1' : '#64748b' },
              ]}
            >
              {(() => {
                const installArea = selectedNewProducts.reduce(
                  (sum, product) => sum + Number(newFlooringArea(product) || 0),
                  0
                );
                if (installArea > 0) {
                  return `${selectedNewProducts.length} selected · ${installArea.toLocaleString()} SF installation`;
                }
                const planCaption =
                  planFloorSqft > 0
                    ? `${planFloorSqft.toLocaleString()} SF from the plan`
                    : '';
                if (selectedNewProducts.length > 0) {
                  const productCaption =
                    selectedNewProducts.length === 1
                      ? '1 product · enter the area'
                      : `${selectedNewProducts.length} products · enter the area`;
                  return planCaption
                    ? `${planCaption} · ${productCaption}`
                    : productCaption;
                }
                return planCaption
                  ? `${planCaption} · choose a product`
                  : 'Choose a product';
              })()}
            </Text>
          )}
        </TouchableOpacity>
        {newExpanded ? (
          <>
            {planFloorSqft > 0 ? (
              <View style={{ marginTop: 10, marginBottom: 4 }}>
                <Text
                  style={[
                    styles.qmPanelTitle,
                    { color: darkMode ? '#F5F7FA' : Colors.text, fontSize: 14 },
                  ]}
                >
                  Flooring area
                </Text>
                <Text
                  style={{
                    color: darkMode ? '#F5F7FA' : Colors.text,
                    fontSize: 16,
                    fontWeight: '700',
                    marginTop: 4,
                  }}
                >
                  {planFloorSqft.toLocaleString()} SF
                </Text>
                <Text
                  style={[
                    styles.qmPanelCaption,
                    { color: '#34d399', marginTop: 2 },
                  ]}
                >
                  Detected from the plan
                </Text>
                <Text
                  style={[
                    styles.qmPanelCaption,
                    { color: darkMode ? '#d7e1f0' : '#64748b', marginTop: 4 },
                  ]}
                >
                  Enter how much of this area is carpet, tile, or another
                  product.
                </Text>
              </View>
            ) : (
              <Text
                style={[
                  styles.qmPanelCaption,
                  { color: darkMode ? '#d7e1f0' : '#64748b' },
                ]}
              >
                Select what is being installed. Multiple products are allowed.
              </Text>
            )}
            <View style={styles.qmOptionWrap}>
              {(selectedNewProducts.length === 0 || showMoreNewFlooring
                ? newFlooringOptions
                : selectedNewFlooringOptions
              ).map((option, index) => {
                  const selected = selectedNewProducts.includes(option.id);
                  return (
                    <React.Fragment key={option.id}>
                      <View
                        style={{
                          width: '100%',
                          gap: 8,
                          marginTop: selected && index > 0 ? 12 : 0,
                          paddingTop: selected && index > 0 ? 12 : 0,
                          borderTopWidth: selected && index > 0 ? 1 : 0,
                          borderTopColor: darkMode
                            ? 'rgba(255,255,255,0.16)'
                            : Colors.line,
                        }}
                      >
                        <TouchableOpacity
                          onPress={() => chooseNewFlooringTypes(option.id)}
                          disabled={applying}
                          activeOpacity={1}
                          style={[
                            styles.qmOption,
                            {
                              borderColor: selected
                                ? '#34d399'
                                : darkMode
                                  ? '#52525b'
                                  : '#cbd5e1',
                              backgroundColor: selected
                                ? 'rgba(52, 211, 153, 0.12)'
                                : darkMode
                                  ? '#3a3a3c'
                                  : '#f1f5f9',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.qmOptionText,
                              {
                                color: selected
                                  ? '#34d399'
                                  : darkMode
                                    ? '#e4e4e7'
                                    : Colors.text,
                              },
                            ]}
                          >
                            {selected ? '✓ ' : ''}
                            {option.label}
                          </Text>
                        </TouchableOpacity>
                        {selected ? (
                          <>
                            <QmSqftMeasurementRow
                              label={`${option.label} installation area`}
                              helperText={
                                planFloorSqft > 0
                                  ? 'Enter how much of the plan flooring area is this product.'
                                  : 'Enter the area of this new flooring product being installed.'
                              }
                              value={displaySqftDraft(
                                'new',
                                option.id,
                                newFlooringArea(option.id)
                              )}
                              placeholder='Enter'
                              onFocus={() =>
                                beginSqftDraft(
                                  'new',
                                  option.id,
                                  newFlooringArea(option.id)
                                )
                              }
                              onChangeText={value =>
                                updateSqftDraft('new', option.id, value)
                              }
                              onBlur={() =>
                                endSqftDraft('new', option.id, value =>
                                  commitNewFlooringArea(option.id, value)
                                )
                              }
                              applying={applying}
                              darkMode={darkMode}
                              Colors={Colors}
                              highlighted={selected}
                            />
                            {newFlooringSubtypeOptions(option.id).length > 0 ? (
                              <View style={{ gap: 8, paddingTop: 8 }}>
                                <Text
                                  style={[
                                    styles.qmPanelCaption,
                                    {
                                      color: darkMode ? '#F5F7FA' : Colors.text,
                                      marginBottom: 6,
                                    },
                                  ]}
                                >
                                  {option.id === 'lvp'
                                    ? 'How is the new LVP installed?'
                                    : 'What type of new vinyl flooring is being installed?'}
                                </Text>
                                <View style={styles.qmOptionWrap}>
                                  {newFlooringSubtypeOptions(option.id).map(
                                    ([id, label]) => {
                                      const selectedSubtype =
                                        option.id === 'lvp'
                                          ? measurements.flooringNewLvpInstallMethod ===
                                            id
                                          : measurements.flooringNewSheetVinylType ===
                                            id;
                                      return (
                                        <TouchableOpacity
                                          key={`${option.id}-new-${id}`}
                                          onPress={() =>
                                            setMeasurements(prev => ({
                                              ...prev,
                                              ...(option.id === 'lvp'
                                                ? {
                                                    flooringNewLvpInstallMethod:
                                                      id as
                                                        | 'floating'
                                                        | 'glue_down'
                                                        | 'unknown',
                                                  }
                                                : {
                                                    flooringNewSheetVinylType:
                                                      id as
                                                        | 'sheet_vinyl'
                                                        | 'vct'
                                                        | 'unknown',
                                                  }),
                                            }))
                                          }
                                          disabled={applying}
                                          activeOpacity={1}
                                          style={[
                                            styles.qmOption,
                                            {
                                              borderColor: selectedSubtype
                                                ? '#34d399'
                                                : darkMode
                                                  ? '#52525b'
                                                  : '#cbd5e1',
                                              backgroundColor: selectedSubtype
                                                ? 'rgba(52, 211, 153, 0.12)'
                                                : darkMode
                                                  ? '#3a3a3c'
                                                  : '#f1f5f9',
                                            },
                                          ]}
                                        >
                                          <Text
                                            style={[
                                              styles.qmOptionText,
                                              {
                                                color: selectedSubtype
                                                  ? '#34d399'
                                                  : darkMode
                                                    ? '#e4e4e7'
                                                    : Colors.text,
                                              },
                                            ]}
                                          >
                                            {selectedSubtype ? '✓ ' : ''}
                                            {label}
                                          </Text>
                                        </TouchableOpacity>
                                      );
                                    }
                                  )}
                                </View>
                              </View>
                            ) : null}
                          </>
                        ) : null}
                      </View>
                    </React.Fragment>
                  );
                })}
              {selectedNewProducts.length > 0 && !showMoreNewFlooring ? (
                <TouchableOpacity
                  onPress={() => setShowMoreNewFlooring(true)}
                  activeOpacity={0.75}
                  accessibilityRole='button'
                  accessibilityLabel='Add another flooring material'
                  style={[
                    styles.qmOption,
                    {
                      marginTop: 4,
                      borderColor: darkMode ? '#52525b' : '#cbd5e1',
                      backgroundColor: darkMode ? '#3a3a3c' : '#f1f5f9',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.qmOptionText,
                      { color: darkMode ? '#e4e4e7' : Colors.text },
                    ]}
                  >
                    + Add another flooring material
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </>
        ) : null}
        {measurementFooter}
        {newExpanded ? (
          <TouchableOpacity
            onPress={() => {
              setNewExpanded(false);
              focusCard(prepCardRef);
            }}
            activeOpacity={0.75}
            style={{
              marginTop: 12,
              paddingTop: 10,
              borderTopWidth: 1,
              borderTopColor: darkMode ? 'rgba(255,255,255,0.12)' : Colors.line,
            }}
          >
            <Text
              style={[
                styles.qmPanelCaption,
                {
                  color: darkMode ? '#d7e1f0' : '#64748b',
                  textAlign: 'center',
                },
              ]}
            >
              Collapse card ⌃
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {selectedNewFlooringOptions.length > 0 &&
      notesRequestFloorPrep(
        flooringNotes
          .split('\n')
          .map(line => line.trim())
          .find(
            line =>
              /\b(?:tear[\s-]?out|remove|install)\b/i.test(line) &&
              /\b(?:carpet|laminate|lvp|flooring|hardwood)\b/i.test(line)
          ) || flooringNotes
      ) ? (
        <View
          ref={prepCardRef}
          style={[
            styles.qmPanel,
            {
              borderColor: darkMode
                ? 'rgba(148,163,184,0.28)'
                : 'rgba(100,116,139,0.24)',
              backgroundColor: darkMode
                ? 'rgba(148,163,184,0.06)'
                : 'rgba(148,163,184,0.05)',
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => setPrepExpanded(expanded => !expanded)}
            activeOpacity={0.75}
          >
            <Text
              style={[
                styles.qmPanelTitle,
                { color: darkMode ? '#F5F7FA' : '#475569' },
              ]}
            >
              Floor prep {prepExpanded ? '⌃' : '⌄'}
            </Text>
            {prepExpanded ? (
              <Text
                style={[
                  styles.qmPanelCaption,
                  { color: darkMode ? '#CBD5E1' : '#64748b', marginTop: 2 },
                ]}
              >
                Substrate prep named in the notes
              </Text>
            ) : (
              <Text
                style={[
                  styles.qmPanelCaption,
                  { color: darkMode ? '#CBD5E1' : '#64748b' },
                ]}
              >
                {selectedNewFlooringOptions.length} product
                {selectedNewFlooringOptions.length === 1 ? '' : 's'} · separate
                prep by product
              </Text>
            )}
          </TouchableOpacity>
          {prepExpanded ? (
            <>
              <Text
                style={[
                  styles.qmPanelCaption,
                  { color: darkMode ? '#E2E8F0' : '#64748b' },
                ]}
              >
                Enter the prep area. Use the install area when the whole floor needs prep.
              </Text>
              <View style={{ gap: 16, marginTop: 12 }}>
                {selectedNewFlooringOptions.map(option => {
                  const prepEntry = floorPrepEntryFor(option.id);
                  const installSqft = Number(newFlooringArea(option.id) || 0);
                  const prepSqft =
                    prepEntry.sqft == null ? '' : String(prepEntry.sqft);
                  const prepExceedsInstall =
                    installSqft > 0 &&
                    prepEntry.severity !== 'none' &&
                    Number(prepEntry.sqft || 0) > installSqft + 0.01;
                  return (
                    <View
                      key={`${option.id}-prep`}
                      style={{
                        gap: 8,
                        paddingTop: 12,
                        borderTopWidth: 1,
                        borderTopColor: darkMode
                          ? 'rgba(148,163,184,0.2)'
                          : 'rgba(100,116,139,0.18)',
                      }}
                    >
                      <Text
                        style={[
                          styles.qmPanelCaption,
                          {
                            color: darkMode ? '#F5F7FA' : Colors.text,
                            fontSize: 16,
                            lineHeight: 21,
                            fontWeight: '700',
                            marginBottom: 2,
                          },
                        ]}
                      >
                        {option.label}
                      </Text>
                      <QmSqftMeasurementRow
                        label='Affected prep area'
                        helperText='Enter only the SF that needs extra substrate work.'
                        value={displaySqftDraft('prep', option.id, prepSqft)}
                        placeholder='Enter'
                        onFocus={() =>
                          beginSqftDraft('prep', option.id, prepSqft)
                        }
                        onChangeText={value =>
                          updateSqftDraft('prep', option.id, value)
                        }
                        onBlur={() =>
                          endSqftDraft('prep', option.id, value => {
                            const numericValue = Number(
                              value.replace(/,/g, '')
                            );
                            setFloorPrepForProduct(option.id, {
                              sqft:
                                value.trim() &&
                                Number.isFinite(numericValue) &&
                                numericValue > 0
                                  ? numericValue
                                  : null,
                            });
                          })
                        }
                        applying={applying}
                        darkMode={darkMode}
                        Colors={Colors}
                      />
                      {prepExceedsInstall ? (
                        <Text
                          style={{
                            color: '#fbbf24',
                            fontSize: 11,
                            lineHeight: 15,
                          }}
                        >
                          Prep area exceeds this product&apos;s installation
                          area — confirm the affected prep SF.
                        </Text>
                      ) : null}
                      <Text
                        style={[
                          styles.qmPanelCaption,
                          {
                            color: darkMode ? '#E2E8F0' : '#64748b',
                            marginBottom: 6,
                          },
                        ]}
                      >
                        Prep severity
                      </Text>
                      <View style={styles.qmOptionWrap}>
                        {FLOOR_PREP_SEVERITY_OPTIONS.map(severityOption => {
                          const selectedSeverity =
                            prepEntry.severity === severityOption.id;
                          return (
                            <TouchableOpacity
                              key={`${option.id}-severity-${severityOption.id}`}
                              onPress={() =>
                                setFloorPrepForProduct(option.id, {
                                  severity: severityOption.id,
                                  sqft:
                                    severityOption.id === 'none'
                                      ? null
                                      : prepEntry.sqft,
                                })
                              }
                              disabled={applying}
                              activeOpacity={1}
                              style={[
                                styles.qmOption,
                                {
                                  borderColor: selectedSeverity
                                    ? '#34d399'
                                    : darkMode
                                      ? '#52525b'
                                      : '#cbd5e1',
                                  backgroundColor: selectedSeverity
                                    ? 'rgba(52, 211, 153, 0.12)'
                                    : darkMode
                                      ? '#3a3a3c'
                                      : '#f1f5f9',
                                },
                              ]}
                            >
                              <View style={{ alignItems: 'center', gap: 2 }}>
                                <Text
                                  style={[
                                    styles.qmOptionText,
                                    {
                                      color: selectedSeverity
                                        ? '#34d399'
                                        : darkMode
                                          ? '#e4e4e7'
                                          : Colors.text,
                                    },
                                  ]}
                                >
                                  {selectedSeverity ? '✓ ' : ''}
                                  {severityOption.label}
                                </Text>
                                <Text
                                  style={{
                                    color: selectedSeverity
                                      ? '#A7F3D0'
                                      : darkMode
                                        ? '#CBD5E1'
                                        : '#64748b',
                                    fontSize: 10,
                                    lineHeight: 14,
                                    textAlign: 'center',
                                  }}
                                >
                                  {severityOption.helper}
                                </Text>
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      {prepEntry.severity === 'extensive' ? (
                        <Text
                          style={{
                            color: '#fbbf24',
                            fontSize: 11,
                            lineHeight: 15,
                          }}
                        >
                          Review before bid — extensive substrate correction.
                        </Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </>
          ) : null}
          {prepExpanded ? (
            <TouchableOpacity
              onPress={() => {
                setPrepExpanded(false);
                onFloorPrepCollapse?.();
              }}
              activeOpacity={0.75}
              style={{
                marginTop: 12,
                paddingTop: 10,
                borderTopWidth: 1,
                borderTopColor: darkMode
                  ? 'rgba(255,255,255,0.12)'
                  : Colors.line,
              }}
            >
              <Text
                style={[
                  styles.qmPanelCaption,
                  {
                    color: darkMode ? '#d7e1f0' : '#64748b',
                    textAlign: 'center',
                  },
                ]}
              >
                Collapse card ⌃
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </>
  );
}

type QmBathroomFixturesPanelsProps = {
  measurements: ScopeMeasurementsInputExtended;
  setMeasurements: React.Dispatch<
    React.SetStateAction<ScopeMeasurementsInputExtended>
  >;
  notes?: string | null;
  includedScopeKeys: string[];
  hasSitePhotos: boolean;
  showExistingPanel: boolean;
  applying: boolean;
  onBathroomFixturesQmChange?: (params: {
    existing: BathroomExistingFixtureCounts;
    install: BathroomInstallFixtureCounts;
    demo: BathroomDemoFixtureCounts;
  }) => void;
  onBathroomCountertopMaterialChange?: (
    materialType: BathroomVanityCountertopMaterialType | null
  ) => void;
  darkMode: boolean;
  Colors: Colors;
};

function fixtureCountSame(
  left: number | null | undefined,
  right: number | null | undefined
): boolean {
  return (left ?? null) === (right ?? null);
}

function bathroomExistingCountsSame(
  left: BathroomExistingFixtureCounts,
  right: BathroomExistingFixtureCounts
): boolean {
  return (
    fixtureCountSame(
      left.bathroomExistingVanityCount,
      right.bathroomExistingVanityCount
    ) &&
    fixtureCountSame(
      left.bathroomExistingCounterCount,
      right.bathroomExistingCounterCount
    )
  );
}

function vanityCabinetLengthStored(
  measurements: { cabinetLf?: unknown; bathroomVanityCabinetLf?: unknown },
  notes?: string | null
): string {
  if (notesNameKitchenRemodelPanel(notes)) {
    return String(measurements.bathroomVanityCabinetLf ?? '').trim();
  }
  return String(measurements.cabinetLf ?? '').trim();
}

function bathroomInstallCountsSame(
  left: BathroomInstallFixtureCounts,
  right: BathroomInstallFixtureCounts
): boolean {
  return (
    fixtureCountSame(
      left.bathroomInstallVanityCount,
      right.bathroomInstallVanityCount
    ) &&
    fixtureCountSame(
      left.bathroomInstallCounterCount,
      right.bathroomInstallCounterCount
    )
  );
}

function bathroomDemoCountsSame(
  left: BathroomDemoFixtureCounts,
  right: BathroomDemoFixtureCounts
): boolean {
  return (
    fixtureCountSame(
      left.bathroomDemoVanityCount,
      right.bathroomDemoVanityCount
    ) &&
    fixtureCountSame(
      left.bathroomDemoCounterCount,
      right.bathroomDemoCounterCount
    )
  );
}

function withUnchangedMeasurementPatch(
  prev: ScopeMeasurementsInputExtended,
  patch: Partial<ScopeMeasurementsInputExtended>
): ScopeMeasurementsInputExtended {
  for (const key of Object.keys(patch) as Array<
    keyof ScopeMeasurementsInputExtended
  >) {
    if (prev[key] !== patch[key]) {
      return { ...prev, ...patch };
    }
  }
  return prev;
}

export const QmBathroomFixturesPanels = React.memo(
  forwardRef<QmBathroomFixturesPanelsHandle, QmBathroomFixturesPanelsProps>(
    function QmBathroomFixturesPanels(
      {
        measurements,
        setMeasurements,
        notes,
        includedScopeKeys,
        hasSitePhotos,
        showExistingPanel,
        applying,
        onBathroomFixturesQmChange,
        onBathroomCountertopMaterialChange,
        darkMode,
        Colors,
      },
      ref
    ) {
      const [existing, setExisting] = useState<BathroomExistingFixtureCounts>(
        () => {
          const saved = readBathroomExistingFixtureCounts(measurements);
          const inferred = inferExistingBathroomFixturesFromNotes(notes);
          return {
            bathroomExistingVanityCount:
              saved.bathroomExistingVanityCount ??
              inferred.bathroomExistingVanityCount,
            bathroomExistingCounterCount:
              saved.bathroomExistingCounterCount ??
              inferred.bathroomExistingCounterCount,
          };
        }
      );
      const [install, setInstall] = useState<BathroomInstallFixtureCounts>(
        () => {
          const saved = readBathroomInstallFixtureCounts(measurements);
          const inferred = inferBathroomFixtureInstallFromIntent({
            notes,
            checklistItems: [],
          });
          return {
            bathroomInstallVanityCount:
              saved.bathroomInstallVanityCount ??
              inferred.bathroomInstallVanityCount,
            bathroomInstallCounterCount:
              saved.bathroomInstallCounterCount ??
              inferred.bathroomInstallCounterCount,
          };
        }
      );
      const [demo, setDemo] = useState<BathroomDemoFixtureCounts>(() => {
        const saved = readBathroomDemoFixtureCounts(measurements);
        const inferred = resolveBathroomFixtureDemoFromIntent({
          notes,
          existing: readBathroomExistingFixtureCounts(measurements),
          install: inferBathroomFixtureInstallFromIntent({
            notes,
            checklistItems: [],
          }),
          checklistItems: [],
        });
        return {
          bathroomDemoVanityCount:
            saved.bathroomDemoVanityCount ?? inferred.bathroomDemoVanityCount,
          bathroomDemoCounterCount:
            saved.bathroomDemoCounterCount ?? inferred.bathroomDemoCounterCount,
        };
      });
      const [toiletFaucet, setToiletFaucet] = useState<BathroomToiletFaucetCounts>(
        () => inferBathroomToiletFaucetCounts(notes)
      );
      const toiletFaucetRef = useRef(toiletFaucet);
      toiletFaucetRef.current = toiletFaucet;
      const genRef = useRef(0);
      const appliedRef = useRef(0);
      const fixtureInstallNotesSeededRef = useRef('');
      const fixtureDemoNotesSeededRef = useRef('');
      const fixtureNoteCountsSeededRef = useRef(false);
      const demoOverridesRef = useRef<
        Partial<Record<BathroomFixtureDemoOverrideKey, boolean>>
      >({});
      const demoRef = useRef(demo);
      demoRef.current = demo;
      const existingRef = useRef(existing);
      existingRef.current = existing;
      const installRef = useRef(install);
      installRef.current = install;
      const parentFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
        null
      );
      const pendingParentPatchRef = useRef<{
        nextExisting: BathroomExistingFixtureCounts;
        nextInstall: BathroomInstallFixtureCounts;
        mergedDemo: BathroomDemoFixtureCounts;
        gen: number;
        cabinetLf?: string;
        countertopSqft?: string;
        materialType?: BathroomVanityCountertopMaterialType | null;
      } | null>(null);
      const [selectedCountertopMaterial, setSelectedCountertopMaterial] =
        useState<BathroomVanityCountertopMaterialType | null>(() =>
          normalizeBathroomVanityCountertopMaterialType(
            measurements.bathroomVanityCountertopMaterialType
          ) ?? inferBathroomVanityCountertopMaterialFromNotes(notes)
        );
      const materialWritePendingRef = useRef(false);
      const cabinetLfRef = useRef(vanityCabinetLengthStored(measurements, notes));
      const countertopSqftRef = useRef(
        String(measurements.countertopSqft ?? '').trim()
      );
      const materialRef = useRef(selectedCountertopMaterial);
      materialRef.current = selectedCountertopMaterial;
      const [cabinetLfDraft, setCabinetLfDraft] = useState(() =>
        vanityCabinetLengthStored(measurements, notes)
      );
      const [countertopSqftDraft, setCountertopSqftDraft] = useState(() =>
        String(measurements.countertopSqft ?? '').trim()
      );

      const vanityLengthSeparate = notesNameKitchenRemodelPanel(notes);
      const vanityLengthExternal = vanityCabinetLengthStored(measurements, notes);
      useEffect(() => {
        const external = vanityLengthExternal;
        if (genRef.current !== appliedRef.current) return;
        if (external !== cabinetLfRef.current) {
          cabinetLfRef.current = external;
          setCabinetLfDraft(external);
        }
      }, [vanityLengthExternal]);

      useEffect(() => {
        const external = String(measurements.countertopSqft ?? '').trim();
        if (genRef.current !== appliedRef.current) return;
        if (external !== countertopSqftRef.current) {
          countertopSqftRef.current = external;
          setCountertopSqftDraft(external);
        }
      }, [measurements.countertopSqft]);

      const onBathroomFixturesQmChangeRef = useRef(onBathroomFixturesQmChange);
      onBathroomFixturesQmChangeRef.current = onBathroomFixturesQmChange;
      const setMeasurementsRef = useRef(setMeasurements);
      setMeasurementsRef.current = setMeasurements;
      useEffect(() => {
        const inferred = inferBathroomToiletFaucetCounts(notes);
        setToiletFaucet(prev => {
          const next = fillBlankToiletFaucetCounts(prev, inferred);
          if (
            next.bathroomDemoToiletCount === prev.bathroomDemoToiletCount &&
            next.bathroomInstallToiletCount === prev.bathroomInstallToiletCount &&
            next.bathroomInstallFaucetCount === prev.bathroomInstallFaucetCount
          ) {
            return prev;
          }
          return next;
        });
        setMeasurements(prev => {
          const next = fillBlankToiletFaucetCounts(
            {
              bathroomDemoToiletCount: prev.bathroomDemoToiletCount ?? null,
              bathroomInstallToiletCount: prev.bathroomInstallToiletCount ?? null,
              bathroomInstallFaucetCount: prev.bathroomInstallFaucetCount ?? null,
            },
            inferred
          );
          if (
            next.bathroomDemoToiletCount === (prev.bathroomDemoToiletCount ?? null) &&
            next.bathroomInstallToiletCount ===
              (prev.bathroomInstallToiletCount ?? null) &&
            next.bathroomInstallFaucetCount ===
              (prev.bathroomInstallFaucetCount ?? null)
          ) {
            return prev;
          }
          return { ...prev, ...next };
        });
      }, [notes, setMeasurements]);

      useEffect(() => {
        const external = normalizeBathroomVanityCountertopMaterialType(
          measurements.bathroomVanityCountertopMaterialType
        );
        if (materialWritePendingRef.current) {
          if (external === selectedCountertopMaterial) {
            materialWritePendingRef.current = false;
          }
          return;
        }
        if (external !== selectedCountertopMaterial) {
          setSelectedCountertopMaterial(external);
        }
      }, [
        measurements.bathroomVanityCountertopMaterialType,
        selectedCountertopMaterial,
      ]);

      useEffect(() => {
        if (genRef.current !== appliedRef.current) return;
        const savedExisting = readBathroomExistingFixtureCounts(measurements);
        const inferredExisting = inferExistingBathroomFixturesFromNotes(notes);
        const noteFallback = !fixtureNoteCountsSeededRef.current;
        const resolvedExisting: BathroomExistingFixtureCounts = noteFallback
          ? {
              bathroomExistingVanityCount:
                savedExisting.bathroomExistingVanityCount ??
                inferredExisting.bathroomExistingVanityCount,
              bathroomExistingCounterCount:
                savedExisting.bathroomExistingCounterCount ??
                inferredExisting.bathroomExistingCounterCount,
            }
          : savedExisting;
        if (!bathroomExistingCountsSame(existingRef.current, resolvedExisting)) {
          setExisting(resolvedExisting);
        }
        const savedInstall = readBathroomInstallFixtureCounts(measurements);
        const inferredInstall = inferBathroomFixtureInstallFromIntent({
          notes,
          checklistItems: [],
        });
        const notesSignature = String(notes || '').trim();
        const shouldSeedFromNotes =
          fixtureInstallNotesSeededRef.current !== notesSignature;
        const resolvedInstall = shouldSeedFromNotes
          ? {
              bathroomInstallVanityCount:
                savedInstall.bathroomInstallVanityCount ??
                inferredInstall.bathroomInstallVanityCount,
              bathroomInstallCounterCount:
                savedInstall.bathroomInstallCounterCount ??
                inferredInstall.bathroomInstallCounterCount,
            }
          : savedInstall;
        if (shouldSeedFromNotes) {
          fixtureInstallNotesSeededRef.current = notesSignature;
          if (
            resolvedInstall.bathroomInstallVanityCount != null ||
            resolvedInstall.bathroomInstallCounterCount != null
          ) {
            setMeasurementsRef.current(prev =>
              withUnchangedMeasurementPatch(prev, resolvedInstall)
            );
            onBathroomFixturesQmChangeRef.current?.({
              existing: readBathroomExistingFixtureCounts(measurements),
              install: resolvedInstall,
              demo: readBathroomDemoFixtureCounts(measurements),
            });
          }
        }
        const resolvedCounter = resolveBathroomInstallCounterCount({
          countertopSqft: measurements.countertopSqft,
          materialType: measurements.bathroomVanityCountertopMaterialType,
        });
        const nextInstall =
          resolvedCounter != null
            ? {
                ...resolvedInstall,
                bathroomInstallCounterCount: resolvedCounter,
              }
            : resolvedInstall;
        if (!bathroomInstallCountsSame(installRef.current, nextInstall)) {
          setInstall(nextInstall);
        }
        const savedDemo = readBathroomDemoFixtureCounts(measurements);
        const inferredDemo = resolveBathroomFixtureDemoFromIntent({
          notes,
          existing: resolvedExisting,
          install: resolvedInstall,
          checklistItems: [],
        });
        const demoNotesChanged = fixtureDemoNotesSeededRef.current !== notesSignature;
        if (demoNotesChanged) fixtureDemoNotesSeededRef.current = notesSignature;
        const nextDemo: BathroomDemoFixtureCounts = {
          bathroomDemoVanityCount: demoOverridesRef.current.bathroomDemoVanityCount
            ? (savedDemo.bathroomDemoVanityCount ??
              demoRef.current.bathroomDemoVanityCount)
            : (savedDemo.bathroomDemoVanityCount ??
              inferredDemo.bathroomDemoVanityCount),
          bathroomDemoCounterCount: demoOverridesRef.current.bathroomDemoCounterCount
            ? (savedDemo.bathroomDemoCounterCount ??
              demoRef.current.bathroomDemoCounterCount)
            : (savedDemo.bathroomDemoCounterCount ??
              inferredDemo.bathroomDemoCounterCount),
        };
        if (
          (savedDemo.bathroomDemoVanityCount == null &&
            nextDemo.bathroomDemoVanityCount != null) ||
          (savedDemo.bathroomDemoCounterCount == null &&
            nextDemo.bathroomDemoCounterCount != null)
        ) {
          setMeasurementsRef.current(prev =>
            withUnchangedMeasurementPatch(prev, {
              bathroomDemoVanityCount:
                prev.bathroomDemoVanityCount ?? nextDemo.bathroomDemoVanityCount,
              bathroomDemoCounterCount:
                prev.bathroomDemoCounterCount ??
                nextDemo.bathroomDemoCounterCount,
            })
          );
        }
        if (!bathroomDemoCountsSame(demoRef.current, nextDemo)) {
          setDemo(nextDemo);
        }
        demoRef.current = nextDemo;
        if (!fixtureNoteCountsSeededRef.current) {
          fixtureNoteCountsSeededRef.current = true;
          const inferredMaterial =
            inferBathroomVanityCountertopMaterialFromNotes(notes);
          if (
            !measurements.bathroomVanityCountertopMaterialType &&
            inferredMaterial
          ) {
            setSelectedCountertopMaterial(inferredMaterial);
          }
          if (
            (savedExisting.bathroomExistingVanityCount == null &&
              resolvedExisting.bathroomExistingVanityCount != null) ||
            (savedExisting.bathroomExistingCounterCount == null &&
              resolvedExisting.bathroomExistingCounterCount != null) ||
            (savedDemo.bathroomDemoVanityCount == null &&
              nextDemo.bathroomDemoVanityCount != null) ||
            (savedDemo.bathroomDemoCounterCount == null &&
              nextDemo.bathroomDemoCounterCount != null) ||
            (!measurements.bathroomVanityCountertopMaterialType &&
              inferredMaterial)
          ) {
            setMeasurementsRef.current(prev =>
              withUnchangedMeasurementPatch(prev, {
                bathroomExistingVanityCount:
                  prev.bathroomExistingVanityCount ??
                  resolvedExisting.bathroomExistingVanityCount,
                bathroomExistingCounterCount:
                  prev.bathroomExistingCounterCount ??
                  resolvedExisting.bathroomExistingCounterCount,
                bathroomDemoVanityCount:
                  prev.bathroomDemoVanityCount ??
                  nextDemo.bathroomDemoVanityCount,
                bathroomDemoCounterCount:
                  prev.bathroomDemoCounterCount ??
                  nextDemo.bathroomDemoCounterCount,
                bathroomVanityCountertopMaterialType:
                  prev.bathroomVanityCountertopMaterialType ?? inferredMaterial,
              })
            );
          }
        }
      }, [
        measurements.bathroomExistingVanityCount,
        measurements.bathroomExistingCounterCount,
        measurements.bathroomInstallVanityCount,
        measurements.bathroomInstallCounterCount,
        measurements.bathroomDemoVanityCount,
        measurements.bathroomDemoCounterCount,
        measurements.countertopSqft,
        measurements.bathroomVanityCountertopMaterialType,
        notes,
      ]);

      const flushToParent = useCallback(() => {
        const pending = pendingParentPatchRef.current;
        if (!pending || pending.gen !== genRef.current) return;
        pendingParentPatchRef.current = null;
        const {
          nextExisting,
          nextInstall,
          mergedDemo,
          cabinetLf,
          countertopSqft,
          materialType,
        } = pending;
        startTransition(() => {
          setMeasurements(prev => ({
            ...prev,
            ...nextExisting,
            ...nextInstall,
            ...mergedDemo,
            ...(vanityLengthSeparate
              ? {
                  bathroomVanityCabinetLf:
                    cabinetLf ?? prev.bathroomVanityCabinetLf,
                }
              : { cabinetLf: cabinetLf ?? prev.cabinetLf }),
            countertopSqft: countertopSqft ?? prev.countertopSqft,
            bathroomVanityCountertopMaterialType:
              materialType !== undefined
                ? materialType
                : prev.bathroomVanityCountertopMaterialType,
          }));
          appliedRef.current = genRef.current;
          onBathroomFixturesQmChange?.({
            existing: nextExisting,
            install: nextInstall,
            demo: mergedDemo,
          });
        });
      }, [onBathroomFixturesQmChange, setMeasurements, vanityLengthSeparate]);

      const scheduleParentFlush = useCallback(() => {
        if (parentFlushTimerRef.current) {
          clearTimeout(parentFlushTimerRef.current);
        }
        parentFlushTimerRef.current = setTimeout(() => {
          parentFlushTimerRef.current = null;
          flushToParent();
        }, BATHROOM_QM_PARENT_FLUSH_MS);
      }, [flushToParent]);

      useImperativeHandle(
        ref,
        () => ({
          flushPending: () => {
            if (parentFlushTimerRef.current) {
              clearTimeout(parentFlushTimerRef.current);
              parentFlushTimerRef.current = null;
            }
            flushToParent();
          },
        }),
        [flushToParent]
      );

      useEffect(
        () => () => {
          if (parentFlushTimerRef.current) {
            clearTimeout(parentFlushTimerRef.current);
          }
        },
        []
      );

      const prepareCommit = useCallback(
        (
          nextExisting: BathroomExistingFixtureCounts,
          nextInstall: BathroomInstallFixtureCounts,
          gen: number,
          demoOverride?: {
            key: BathroomFixtureDemoOverrideKey;
            value: number | null;
          },
          patch?: {
            cabinetLf?: string;
            countertopSqft?: string;
            materialType?: BathroomVanityCountertopMaterialType | null;
          }
        ) => {
          let mergedDemo: BathroomDemoFixtureCounts;
          if (demoOverride) {
            demoOverridesRef.current = {
              ...demoOverridesRef.current,
              [demoOverride.key]: true,
            };
            mergedDemo = {
              ...demoRef.current,
              [demoOverride.key]: demoOverride.value,
            };
          } else {
            mergedDemo = suggestBathroomFixtureDemoFromExistingInstall({
              existing: nextExisting,
              install: nextInstall,
              demo: demoRef.current,
              countertopSqft: countertopSqftRef.current,
              materialType: materialRef.current,
              overrides: demoOverridesRef.current,
              ...namedBathroomDemoKeeps(notes),
            });
          }
          demoRef.current = mergedDemo;
          setDemo(mergedDemo);
          pendingParentPatchRef.current = {
            nextExisting,
            nextInstall,
            mergedDemo,
            gen,
            ...patch,
          };
          scheduleParentFlush();
        },
        [notes, scheduleParentFlush]
      );

      const adjustExisting = useCallback(
        (key: keyof BathroomExistingFixtureCounts, delta: number) => {
          const gen = ++genRef.current;
          const current = existingRef.current[key] ?? 0;
          const nextValue = clampQmCount(
            current + delta < 1 ? null : current + delta,
            BATHROOM_QM_STEPPER_MAX
          );
          const next = {
            ...existingRef.current,
            [key]: nextValue,
          };
          if (key === 'bathroomExistingVanityCount' && nextValue == null) {
            delete demoOverridesRef.current.bathroomDemoVanityCount;
          }
          if (key === 'bathroomExistingCounterCount' && nextValue == null) {
            delete demoOverridesRef.current.bathroomDemoCounterCount;
          }
          existingRef.current = next;
          setExisting(next);
          prepareCommit(next, installRef.current, gen);
        },
        [prepareCommit]
      );

      const adjustInstall = useCallback(
        (key: keyof BathroomInstallFixtureCounts, delta: number) => {
          const gen = ++genRef.current;
          const current = installRef.current[key] ?? 0;
          const nextValue = clampQmCount(
            current + delta < 1 ? null : current + delta,
            BATHROOM_QM_STEPPER_MAX
          );
          const nextInstall = {
            ...installRef.current,
            [key]: nextValue,
          };
          let patch:
            | {
                cabinetLf?: string;
                countertopSqft?: string;
                materialType?: BathroomVanityCountertopMaterialType | null;
              }
            | undefined;
          if (key === 'bathroomInstallVanityCount' && nextValue == null) {
            cabinetLfRef.current = '';
            setCabinetLfDraft('');
            patch = { ...(patch || {}), cabinetLf: '' };
          }
          if (key === 'bathroomInstallCounterCount' && nextValue == null) {
            countertopSqftRef.current = '';
            setCountertopSqftDraft('');
            materialRef.current = null;
            materialWritePendingRef.current = false;
            setSelectedCountertopMaterial(null);
            patch = {
              ...(patch || {}),
              countertopSqft: '',
              materialType: null,
            };
          }
          installRef.current = nextInstall;
          setInstall(nextInstall);
          prepareCommit(
            existingRef.current,
            nextInstall,
            gen,
            undefined,
            patch
          );
        },
        [prepareCommit]
      );

      const adjustDemo = useCallback(
        (key: BathroomFixtureDemoOverrideKey, delta: number) => {
          const gen = ++genRef.current;
          const current = demoRef.current[key] ?? 0;
          const cleaned = clampQmCount(
            current + delta < 1 ? null : current + delta,
            BATHROOM_QM_STEPPER_MAX
          );
          const next = { ...demoRef.current, [key]: cleaned };
          demoRef.current = next;
          setDemo(next);
          prepareCommit(existingRef.current, installRef.current, gen, {
            key,
            value: cleaned,
          });
        },
        [prepareCommit]
      );

      const existingCaption = showExistingPanel
        ? 'What is in the space now — set manually for notes-only jobs.'
        : 'Seeded from photos and notes when site photos are attached.';
      const fixtureCaption = showExistingPanel
        ? 'Set install and demo for this bid — auto-filled from existing + install.'
        : 'Set install and demo — auto-filled from photos, notes, and install.';

      const existingFixtureStyle = qmExistingScopePanelStyle(darkMode);
      const vanityInstallStyle = qmInstallScopePanelStyle(darkMode);

      const handleVanityLfChange = useCallback(
        (text: string) => {
          const cleaned = String(text || '').replace(/[^\d.]/g, '');
          cabinetLfRef.current = cleaned;
          setCabinetLfDraft(cleaned);
          setMeasurements(prev =>
            vanityLengthSeparate
              ? { ...prev, bathroomVanityCabinetLf: cleaned }
              : { ...prev, cabinetLf: cleaned }
          );
        },
        [setMeasurements, vanityLengthSeparate]
      );

      const handleCountertopSqftChange = useCallback(
        (text: string) => {
          const cleaned = String(text || '').replace(/[^\d.]/g, '');
          countertopSqftRef.current = cleaned;
          setCountertopSqftDraft(cleaned);
          setMeasurements(prev => ({ ...prev, countertopSqft: cleaned }));
          const gen = ++genRef.current;
          queueMicrotask(() => {
            startTransition(() => {
              setMeasurements(prev => {
                const materialType =
                  normalizeBathroomVanityCountertopMaterialType(
                    prev.bathroomVanityCountertopMaterialType
                  );
                const nextInstallCount = resolveBathroomInstallCounterCount({
                  countertopSqft: cleaned,
                  materialType,
                });
                const nextInstall = {
                  ...install,
                  bathroomInstallCounterCount: nextInstallCount,
                };
                setInstall(nextInstall);
                if (!cleaned && !materialType) {
                  setSelectedCountertopMaterial(null);
                  materialWritePendingRef.current = false;
                }
                const mergedDemo =
                  suggestBathroomFixtureDemoFromExistingInstall({
                    existing,
                    install: nextInstall,
                    demo: demoRef.current,
                    countertopSqft: cleaned,
                    materialType,
                    overrides: demoOverridesRef.current,
                    ...namedBathroomDemoKeeps(notes),
                  });
                setDemo(mergedDemo);
                demoRef.current = mergedDemo;
                appliedRef.current = gen;
                onBathroomFixturesQmChange?.({
                  existing,
                  install: nextInstall,
                  demo: mergedDemo,
                });
                return {
                  ...prev,
                  countertopSqft: cleaned,
                  ...nextInstall,
                  ...mergedDemo,
                  bathroomVanityCountertopMaterialType:
                    !cleaned && !materialType
                      ? null
                      : prev.bathroomVanityCountertopMaterialType,
                };
              });
            });
          });
        },
        [existing, install, notes, onBathroomFixturesQmChange, setMeasurements]
      );

      const handleCountertopMaterialPress = useCallback(
        (materialId: BathroomVanityCountertopMaterialType) => {
          const next =
            selectedCountertopMaterial === materialId ? null : materialId;
          materialWritePendingRef.current = true;
          setSelectedCountertopMaterial(next);
          materialRef.current = next;
          const gen = ++genRef.current;
          queueMicrotask(() => {
            startTransition(() => {
              setMeasurements(prev => {
                const nextInstallCount = resolveBathroomInstallCounterCount({
                  countertopSqft: countertopSqftRef.current,
                  materialType: next,
                });
                const nextInstall = {
                  ...install,
                  bathroomInstallCounterCount: nextInstallCount,
                };
                setInstall(nextInstall);
                const mergedDemo =
                  suggestBathroomFixtureDemoFromExistingInstall({
                    existing,
                    install: nextInstall,
                    demo: demoRef.current,
                    countertopSqft: countertopSqftRef.current,
                    materialType: next,
                    overrides: demoOverridesRef.current,
                    ...namedBathroomDemoKeeps(notes),
                  });
                setDemo(mergedDemo);
                demoRef.current = mergedDemo;
                appliedRef.current = gen;
                onBathroomFixturesQmChange?.({
                  existing,
                  install: nextInstall,
                  demo: mergedDemo,
                });
                onBathroomCountertopMaterialChange?.(next);
                return {
                  ...prev,
                  bathroomVanityCountertopMaterialType: next,
                  ...nextInstall,
                  ...mergedDemo,
                };
              });
            });
          });
        },
        [
          existing,
          install,
          notes,
          onBathroomCountertopMaterialChange,
          onBathroomFixturesQmChange,
          selectedCountertopMaterial,
          setMeasurements,
        ]
      );

      const noteText = bathroomAffirmativeNotes(notes);
      const vanityForInstall = noteText.replace(
        /\bvanity\s+(?:lights?|lighting)\b/gi,
        ' '
      );
      const notesMentionVanity = /\bvanit(?:y|ies)\b/i.test(vanityForInstall);
      const notesNameNewVanity =
        /\b(?:new|install|replace)\b[^.]{0,50}\bvanit(?:y|ies)\b/i.test(
          vanityForInstall
        ) ||
        /\bvanit(?:y|ies)\b[^.]{0,40}\b(?:new|install|replace)\b/i.test(
          vanityForInstall
        );
      const notesNameDemoVanity = bathroomNoteClauseHas(
        vanityForInstall,
        /\b(?:remove|demo|demolition|tear[\s-]?out|rip[\s-]?out|haul(?:ed)?[\s-]?off)\b[^.]{0,70}\bvanit(?:y|ies)\b/i
      );
      const notesNameNewCountertop =
        /\b(?:new|install|replace)\b[^.]{0,40}\b(?:countertops?|counters?|quartz|granite|vanity\s+top)\b/i.test(
          noteText
        ) ||
        /\b(?:countertops?|counters?|quartz|granite|vanity\s+top)\b[^.]{0,40}\b(?:new|install|replace)\b/i.test(
          noteText
        );
      const notesNameDemoCountertop = bathroomNoteClauseHas(
        noteText,
        /\b(?:remove|demo|demolition|tear[\s-]?out|rip[\s-]?out|haul(?:ed)?[\s-]?off)\b[^.]{0,90}\b(?:countertops?|counters?|vanity\s+top)\b/i
      );
      const notesMentionCountertop =
        /\b(?:countertops?|counters?|quartz|granite|vanity\s+top)\b/i.test(
          noteText
        );
      const openBathroomRemodel =
        notesNameBathroomRemodelPanel(notes) &&
        !notesMentionVanity &&
        !/\btoilets?\b/i.test(noteText) &&
        !/\b(?:shower|tub|bathtub)\b/i.test(noteText);
      const visibleBathroomInstallRows = openBathroomRemodel
        ? BATHROOM_INSTALL_FIXTURE_ROWS.filter(
            row => row.key === 'bathroomInstallVanityCount'
          )
        : BATHROOM_INSTALL_FIXTURE_ROWS.filter(
            row =>
              row.key === 'bathroomInstallVanityCount'
                ? notesNameNewVanity ||
                  install.bathroomInstallVanityCount != null
                : notesNameNewCountertop ||
                  install.bathroomInstallCounterCount != null
          );
      const notesNameExistingVanity =
        /\b(?:existing|current|old)\s+vanit(?:y|ies)\b/i.test(vanityForInstall);
      const notesNameExistingCountertop =
        /\b(?:existing|current|old)\s+(?:vanity\s+)?(?:countertops?|counters?|top)\b/i.test(
          noteText
        );
      const visibleBathroomExistingRows = BATHROOM_EXISTING_FIXTURE_ROWS.filter(
        row =>
          row.key === 'bathroomExistingVanityCount'
            ? notesNameExistingVanity ||
              existing.bathroomExistingVanityCount != null
            : notesNameExistingCountertop ||
              existing.bathroomExistingCounterCount != null
      );
      const visibleBathroomDemoRows = BATHROOM_DEMO_FIXTURE_ROWS.filter(row => {
        if (row.key === 'bathroomDemoVanityCount') {
          return (
            notesNameDemoVanity ||
            demo.bathroomDemoVanityCount != null ||
            existing.bathroomExistingVanityCount != null
          );
        }
        if (row.key === 'bathroomDemoCounterCount') {
          return (
            notesNameDemoCountertop ||
            demo.bathroomDemoCounterCount != null ||
            existing.bathroomExistingCounterCount != null
          );
        }
        return true;
      });

      return (
        <>
          {showExistingPanel && visibleBathroomExistingRows.length > 0 ? (
            <QmScopePanelSection
              title='Existing fixtures'
              {...existingFixtureStyle}
              caption={existingCaption}
              rows={visibleBathroomExistingRows}
              counts={existing as Record<string, number | null>}
              onAdjust={(key, d) =>
                adjustExisting(key as keyof BathroomExistingFixtureCounts, d)
              }
              applying={applying}
              stepperMax={BATHROOM_QM_STEPPER_MAX}
              darkMode={darkMode}
              Colors={Colors}
            />
          ) : null}
          {visibleBathroomInstallRows.length > 0 ||
          visibleBathroomDemoRows.length > 0 ? (
          <QmScopePanelSection
            title={notesMentionCountertop ? 'Vanity & countertop' : 'Vanity'}
            {...vanityInstallStyle}
            caption={fixtureCaption}
            rows={visibleBathroomInstallRows}
            trailingRows={visibleBathroomDemoRows}
            marginBottom={24}
            counts={{ ...install, ...demo } as Record<string, number | null>}
            onAdjust={(key, d) => {
              if (
                key === 'bathroomInstallVanityCount' ||
                key === 'bathroomInstallCounterCount'
              ) {
                adjustInstall(key as keyof BathroomInstallFixtureCounts, d);
              } else if (
                key === 'bathroomDemoVanityCount' ||
                key === 'bathroomDemoCounterCount'
              ) {
                adjustDemo(key as BathroomFixtureDemoOverrideKey, d);
              }
            }}
            stepperIncreaseDisabled={{
              bathroomDemoVanityCount:
                existing.bathroomExistingVanityCount == null &&
                !notesNameDemoVanity,
              bathroomDemoCounterCount:
                existing.bathroomExistingCounterCount == null &&
                !notesNameDemoCountertop,
            }}
            applying={applying}
            stepperMax={BATHROOM_QM_STEPPER_MAX}
            darkMode={darkMode}
            Colors={Colors}
            rowBelowContent={{
              bathroomInstallVanityCount:
                install.bathroomInstallVanityCount != null ? (
                  <View style={{ marginTop: 10, marginBottom: 14 }}>
                    <QmSqftMeasurementRow
                      label='Vanity cabinet LF'
                      helperText='Cabinet run length for this vanity — LF, not fixture count.'
                      value={cabinetLfDraft}
                      placeholder='Enter LF'
                      unitLabel='LF'
                      helperGap={14}
                      sectionLead
                      sectionEnd
                      onChangeText={handleVanityLfChange}
                      applying={applying}
                      darkMode={darkMode}
                      Colors={Colors}
                    />
                  </View>
                ) : null,
              bathroomInstallCounterCount:
                install.bathroomInstallCounterCount != null ? (
                  <View style={{ gap: 16, marginTop: 4, marginBottom: 14 }}>
                    <QmSqftMeasurementRow
                      label='Countertop sqft'
                      helperText='Vanity top or bath counter area — sqft for custom stone; prefab tops can use material only.'
                      value={countertopSqftDraft}
                      placeholder='Enter area'
                      onChangeText={handleCountertopSqftChange}
                      applying={applying}
                      darkMode={darkMode}
                      Colors={Colors}
                      compact
                    />
                    <View style={{ marginTop: 2 }}>
                      <Text
                        style={{
                          color: vanityInstallStyle.titleColor,
                          fontSize: 13,
                          fontWeight: '700',
                          marginBottom: 8,
                        }}
                      >
                        Countertop material
                      </Text>
                      <View
                        style={{
                          flexDirection: 'row',
                          flexWrap: 'wrap',
                          gap: 8,
                        }}
                      >
                        {BATHROOM_VANITY_COUNTERTOP_MATERIAL_OPTIONS.map(
                          opt => {
                            const active =
                              selectedCountertopMaterial === opt.id;
                            return (
                              <Pressable
                                key={opt.id}
                                disabled={applying}
                                onPress={() =>
                                  handleCountertopMaterialPress(opt.id)
                                }
                                hitSlop={6}
                                style={({ pressed }) => ({
                                  paddingHorizontal: 10,
                                  paddingVertical: 8,
                                  borderRadius: 999,
                                  borderWidth: 1,
                                  opacity: applying ? 0.55 : 1,
                                  borderColor: active
                                    ? Colors.primary
                                    : vanityInstallStyle.borderColor,
                                  backgroundColor: active
                                    ? darkMode
                                      ? '#3f3f46'
                                      : '#e4e4e7'
                                    : 'transparent',
                                })}
                              >
                                <Text
                                  style={{
                                    color: active
                                      ? Colors.primary
                                      : vanityInstallStyle.titleColor,
                                    fontSize: 12,
                                    fontWeight: active ? '700' : '500',
                                  }}
                                >
                                  {opt.label}
                                </Text>
                              </Pressable>
                            );
                          }
                        )}
                      </View>
                    </View>
                  </View>
                ) : null,
            }}
          />
          ) : null}
          {openBathroomRemodel ||
          toiletFaucet.bathroomDemoToiletCount != null ||
          toiletFaucet.bathroomInstallToiletCount != null ||
          toiletFaucet.bathroomInstallFaucetCount != null ? (
            <QmScopePanelSection
              title='Toilet & faucet'
              {...vanityInstallStyle}
              caption='Counts from the note. Supply and drain stay on the vanity and faucet.'
              rows={[
                ...(toiletFaucet.bathroomDemoToiletCount != null
                  ? [{ key: 'bathroomDemoToiletCount', label: 'Remove toilet' }]
                  : []),
                ...(openBathroomRemodel ||
                toiletFaucet.bathroomInstallToiletCount != null
                  ? [{ key: 'bathroomInstallToiletCount', label: 'New toilet' }]
                  : []),
                ...(toiletFaucet.bathroomInstallFaucetCount != null
                  ? [{ key: 'bathroomInstallFaucetCount', label: 'New faucet' }]
                  : []),
              ]}
              counts={toiletFaucet as Record<string, number | null>}
              onAdjust={(key, delta) => {
                const previous = toiletFaucetRef.current;
                const current = Number(
                  previous[key as keyof BathroomToiletFaucetCounts] ?? 0
                );
                const nextValue = Math.max(
                  0,
                  Math.min(BATHROOM_QM_STEPPER_MAX, current + delta)
                );
                const next = {
                  ...previous,
                  [key]: nextValue > 0 ? nextValue : null,
                };
                toiletFaucetRef.current = next;
                setToiletFaucet(next);
                setMeasurements(measurementsPrev => ({
                  ...measurementsPrev,
                  ...next,
                }));
              }}
              applying={applying}
              stepperMax={BATHROOM_QM_STEPPER_MAX}
              darkMode={darkMode}
              Colors={Colors}
            />
          ) : null}
        </>
      );
    }
  )
);

const LANDSCAPING_SCOPE_OPTIONS: Array<{
  id: string;
  label: string;
  measurementKey?: string;
  unit?: string;
}> = [
  {
    id: 'grading',
    label: 'Grading',
    measurementKey: 'gradingSqft',
    unit: 'sqft',
  },
  {
    id: 'soil_prep',
    label: 'Soil prep',
    measurementKey: 'soilPrepSqft',
    unit: 'sqft',
  },
  {
    id: 'drainage',
    label: 'Drainage',
    measurementKey: 'drainageLf',
    unit: 'LF',
  },
  {
    id: 'artificial_turf',
    label: 'Artificial turf',
    measurementKey: 'artificialTurfSqft',
    unit: 'sqft',
  },
  { id: 'sod', label: 'Sod', measurementKey: 'sodSqft', unit: 'sqft' },
  { id: 'rock', label: 'Rock', measurementKey: 'rockMulchSqft', unit: 'sqft' },
  {
    id: 'mulch',
    label: 'Mulch',
    measurementKey: 'rockMulchSqft',
    unit: 'sqft',
  },
  { id: 'plants', label: 'Plants', measurementKey: 'plantCount', unit: 'each' },
  { id: 'trees', label: 'Trees', measurementKey: 'treeCount', unit: 'each' },
  {
    id: 'irrigation',
    label: 'Irrigation',
    measurementKey: 'irrigationZoneCount',
    unit: 'zone',
  },
  {
    id: 'concrete_edging',
    label: 'Concrete edging',
    measurementKey: 'concreteEdgingLf',
    unit: 'LF',
  },
  { id: 'pavers', label: 'Pavers', measurementKey: 'paverSqft', unit: 'sqft' },
  {
    id: 'decorative_boulders',
    label: 'Decorative boulders',
    measurementKey: 'boulderCount',
    unit: 'each',
  },
  {
    id: 'landscape_lighting',
    label: 'Landscape lighting',
    measurementKey: 'landscapeLightCount',
    unit: 'each',
  },
  { id: 'mobilization', label: 'Equipment / mobilization' },
  { id: 'cleanup', label: 'Cleanup, haul-off & disposal' },
];

const LANDSCAPE_CLEARING_LEVEL_OPTIONS = [
  { id: 'light_clearing', label: 'Light clearing' },
  { id: 'medium_vegetation', label: 'Medium vegetation clearing' },
  { id: 'dense_vegetation', label: 'Dense vegetation clearing' },
  { id: 'unsure', label: 'Not sure' },
] as const;
const LANDSCAPE_CLEARING_LEVEL_HELPERS: Record<string, string> = {
  light_clearing: 'Grass, weeds, light brush, and minor landscape debris.',
  medium_vegetation:
    'Thick brush, vines, heavier vegetation, shrubs, and small saplings.',
  dense_vegetation:
    'Dense overgrowth or heavy vegetation requiring substantially more labor or equipment.',
  unsure:
    'Use the medium planning allowance; review clearing conditions before bid.',
};

export function QmLandscapingScopePanels({
  measurements,
  setMeasurements,
  applying,
  measurementFooter,
  notes,
  condensed = false,
  darkMode,
  Colors,
}: {
  measurements: ScopeMeasurementsInputExtended;
  setMeasurements: React.Dispatch<
    React.SetStateAction<ScopeMeasurementsInputExtended>
  >;
  applying: boolean;
  measurementFooter?: React.ReactNode;
  notes?: string | null;
  condensed?: boolean;
  darkMode: boolean;
  Colors: Colors;
}) {
  const selected = readLandscapingScope(
    measurements as Record<string, unknown>
  );
  const namedLandscapeRemoval = scopeFoundNamesLandscapeClearing(
    readScopeFoundPieces(measurements.scopeFoundPieces)
  );
  const noteText = String(notes || '');
  const [demoChosen, setDemoChosen] = useState(false);
  const demoSelected = selected.includes('demo_clearing');
  const demoActive = landscapingDemoChipActive({
    selected: demoSelected,
    condensed,
    notes: noteText,
    chosen: demoChosen,
  });
  const shrubsOnly =
    /\bshrubs?\b/i.test(String(notes || '')) &&
    !/\bplants?\b|\bplanting\b|\btrees?\b/i.test(String(notes || ''));
  const noteBackedOption = (id: string): boolean =>
    landscapingScopeChipNamedInNotes(id, noteText);
  const showRockMulchTonnage =
    /\b(?:tons?|tonnage|by\s+weight)\b/i.test(noteText) ||
    selected.some(id =>
      ['rock', 'decorative_boulders', 'landscape_boulders'].includes(id)
    );
  const visibleOptions = condensed
    ? LANDSCAPING_SCOPE_OPTIONS.filter(option => noteBackedOption(option.id))
    : LANDSCAPING_SCOPE_OPTIONS;
  const [demoExpanded, setDemoExpanded] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const toggle = (id: string) => {
    setMeasurements(prev => {
      const current = readLandscapingScope(prev as Record<string, unknown>);
      const canonical = landscapingScopeCanonicalId(id);
      const isSelected = current.includes(id) || current.includes(canonical);
      const next = isSelected
        ? current.filter(value => value !== id && value !== canonical)
        : [...current, id];
      return {
        ...prev,
        landscapeScope: next.length ? next : null,
      } as ScopeMeasurementsInputExtended;
    });
  };
  const updateMeasurement = (key: string, value: string) => {
    setMeasurements(prev => ({ ...prev, [key]: value }));
  };
  if (notesNameConcretePatioWithSod(notes)) return null;

  return (
    <>
      {namedLandscapeRemoval ? null : (
      <View
        style={[
          styles.qmPanel,
          {
            borderColor: darkMode
              ? 'rgba(148,163,184,0.28)'
              : 'rgba(100,116,139,0.24)',
            backgroundColor: darkMode
              ? 'rgba(148,163,184,0.06)'
              : 'rgba(148,163,184,0.05)',
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => setDemoExpanded(value => !value)}
          activeOpacity={0.75}
        >
          <Text
            style={[
              styles.qmPanelTitle,
              { color: darkMode ? '#cbd5e1' : '#475569' },
            ]}
          >
            Demo / clearing {demoExpanded ? '⌃' : '⌄'}
          </Text>
          <Text
            style={[
              styles.qmPanelCaption,
              { color: darkMode ? '#d7e1f0' : '#64748b', marginTop: 2 },
            ]}
          >
            {demoExpanded
              ? 'Tap to collapse card'
              : demoActive
                ? 'Selected · tap to expand card'
                : 'Tap to expand card'}
          </Text>
        </TouchableOpacity>
        {demoExpanded ? (
          <>
            <Text
              style={[
                styles.qmPanelCaption,
                { color: darkMode ? '#d7e1f0' : '#64748b', marginTop: 10 },
              ]}
            >
              Vegetation and loose landscape debris removal only. Tree removal,
              excavation, hardscape demolition, and grading are separate.
            </Text>
            <TouchableOpacity
              onPress={() => {
                if (!demoActive) {
                  setDemoChosen(true);
                  setMeasurements(prev => {
                    const current = readLandscapingScope(
                      prev as Record<string, unknown>
                    );
                    if (current.includes('demo_clearing')) return prev;
                    return {
                      ...prev,
                      landscapeScope: [...current, 'demo_clearing'],
                    } as ScopeMeasurementsInputExtended;
                  });
                  return;
                }
                setDemoChosen(false);
                toggle('demo_clearing');
              }}
              disabled={applying}
              activeOpacity={1}
              style={[
                styles.qmOption,
                {
                  marginTop: 10,
                  borderColor: demoActive
                    ? '#34d399'
                    : darkMode
                      ? '#52525b'
                      : '#cbd5e1',
                  backgroundColor: demoActive
                    ? 'rgba(52, 211, 153, 0.12)'
                    : darkMode
                      ? '#3a3a3c'
                      : '#f1f5f9',
                },
              ]}
            >
              <Text
                style={[
                  styles.qmOptionText,
                  {
                    color: demoActive
                      ? '#34d399'
                      : darkMode
                        ? '#e4e4e7'
                        : Colors.text,
                  },
                ]}
              >
                {demoActive ? '✓ ' : ''}Demo / clearing
              </Text>
            </TouchableOpacity>
            {demoActive ? (
              <>
                <QmSqftMeasurementRow
                  label='Demo / clearing area'
                  helperText='Vegetation and loose landscape debris only. Other demolition and excavation are separate.'
                  value={String(measurements.demoClearingSqft || '')}
                  placeholder='Enter'
                  unitLabel='sqft'
                  onChangeText={value =>
                    updateMeasurement('demoClearingSqft', value)
                  }
                  applying={applying}
                  darkMode={darkMode}
                  Colors={Colors}
                  highlighted
                />
                <Text
                  style={[
                    styles.qmPanelCaption,
                    {
                      color: darkMode ? '#F5F7FA' : Colors.text,
                      marginTop: 10,
                      marginBottom: 6,
                    },
                  ]}
                >
                  Clearing level
                </Text>
                <View style={styles.qmOptionWrap}>
                  {LANDSCAPE_CLEARING_LEVEL_OPTIONS.map(level => {
                    const selectedLevel =
                      measurements.landscapeClearingLevel === level.id;
                    return (
                      <TouchableOpacity
                        key={level.id}
                        onPress={() =>
                          setMeasurements(prev => ({
                            ...prev,
                            landscapeClearingLevel: level.id,
                          }))
                        }
                        disabled={applying}
                        activeOpacity={1}
                        style={[
                          styles.qmOption,
                          {
                            borderColor: selectedLevel
                              ? '#34d399'
                              : darkMode
                                ? '#52525b'
                                : '#cbd5e1',
                            backgroundColor: selectedLevel
                              ? 'rgba(52, 211, 153, 0.12)'
                              : darkMode
                                ? '#3a3a3c'
                                : '#f1f5f9',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.qmOptionText,
                            {
                              color: selectedLevel
                                ? '#34d399'
                                : darkMode
                                  ? '#e4e4e7'
                                  : Colors.text,
                            },
                          ]}
                        >
                          {selectedLevel ? '✓ ' : ''}
                          {level.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {measurements.landscapeClearingLevel ? (
                  <Text
                    style={[
                      styles.qmPanelCaption,
                      { color: darkMode ? '#d7e1f0' : '#64748b', marginTop: 6 },
                    ]}
                  >
                    {
                      LANDSCAPE_CLEARING_LEVEL_HELPERS[
                        measurements.landscapeClearingLevel
                      ]
                    }
                  </Text>
                ) : null}
                <Text
                  style={[
                    styles.qmPanelCaption,
                    { color: darkMode ? '#d7e1f0' : '#64748b', marginTop: 8 },
                  ]}
                >
                  Tree removal, dirt excavation, hardscape demolition, and
                  grading are priced separately.
                </Text>
              </>
            ) : null}
          </>
        ) : null}
      </View>
      )}
      <View
        style={[
          styles.qmPanel,
          {
            borderColor: darkMode
              ? 'rgba(148,163,184,0.28)'
              : 'rgba(100,116,139,0.24)',
            backgroundColor: darkMode
              ? 'rgba(148,163,184,0.06)'
              : 'rgba(148,163,184,0.05)',
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => setExpanded(value => !value)}
          activeOpacity={0.75}
        >
          <Text
            style={[
              styles.qmPanelTitle,
              { color: darkMode ? '#cbd5e1' : '#475569' },
            ]}
          >
            Landscaping scope {expanded ? '⌃' : '⌄'}
          </Text>
          {expanded ? (
            <Text
              style={[
                styles.qmPanelCaption,
                { color: darkMode ? '#64748b' : '#d7e1f0', marginTop: 2 },
              ]}
            >
              Tap to collapse card
            </Text>
          ) : (
            <Text
              style={[
                styles.qmPanelCaption,
                { color: darkMode ? '#d7e1f0' : '#64748b' },
              ]}
            >
              {selected.length} selected landscape component
              {selected.length === 1 ? '' : 's'}
            </Text>
          )}
        </TouchableOpacity>
        {expanded ? (
          <>
            <Text
              style={[
                styles.qmPanelCaption,
                { color: darkMode ? '#d7e1f0' : '#64748b' },
              ]}
            >
              Select every landscape component in this bid. Use SF, LF, each, or
              zones as shown for each component.
            </Text>
            <View style={styles.qmOptionWrap}>
              {visibleOptions.map(option => {
                const canonical = landscapingScopeCanonicalId(option.id);
                const preferredAliasByCanonical: Record<string, string> = {
                  sod_turf: 'sod',
                  concrete: 'concrete_edging',
                };
                const hasAliasForThisComponent = selected.some(
                  value =>
                    value !== canonical &&
                    landscapingScopeCanonicalId(value) === canonical
                );
                const active =
                  selected.includes(option.id) ||
                  (selected.includes(canonical) &&
                    !hasAliasForThisComponent &&
                    option.id ===
                      (preferredAliasByCanonical[canonical] || canonical));
                return (
                  <React.Fragment key={option.id}>
                    <TouchableOpacity
                      onPress={() => toggle(option.id)}
                      disabled={applying}
                      activeOpacity={1}
                      style={[
                        styles.qmOption,
                        {
                          borderColor: active
                            ? '#34d399'
                            : darkMode
                              ? '#52525b'
                              : '#cbd5e1',
                          backgroundColor: active
                            ? 'rgba(52, 211, 153, 0.12)'
                            : darkMode
                              ? '#3a3a3c'
                              : '#f1f5f9',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.qmOptionText,
                          {
                            color: active
                              ? '#34d399'
                              : darkMode
                                ? '#e4e4e7'
                                : Colors.text,
                          },
                        ]}
                      >
                        {active ? '✓ ' : ''}
                        {option.id === 'plants' && shrubsOnly
                          ? 'Shrubs'
                          : option.label}
                      </Text>
                    </TouchableOpacity>
                    {active && option.measurementKey ? (
                      <>
                        <QmSqftMeasurementRow
                          label={
                            option.unit === 'zone'
                              ? `${option.label} zones`
                              : option.unit === 'each'
                                ? `${option.label} count`
                                : option.unit === 'LF'
                                  ? `${option.label} length`
                                  : `${option.label} area`
                          }
                          helperText={
                            option.unit === 'zone'
                              ? 'One zone is one valve-controlled circuit of sprinklers or drip.'
                              : option.unit === 'each'
                                ? 'Count only the items assigned to this component.'
                                : option.unit === 'LF'
                                  ? 'Use only the length assigned to this component.'
                                  : 'Use only the area assigned to this landscape component.'
                          }
                          value={String(
                            (measurements as Record<string, unknown>)[
                              option.measurementKey
                            ] || ''
                          )}
                          placeholder='Enter'
                          unitLabel={option.unit}
                          onChangeText={value =>
                            updateMeasurement(option.measurementKey!, value)
                          }
                          applying={applying}
                          darkMode={darkMode}
                          Colors={Colors}
                          highlighted={active}
                        />
                        {option.id === 'demo_clearing' ? (
                          <View style={{ marginTop: 10 }}>
                            <Text
                              style={[
                                styles.qmPanelCaption,
                                {
                                  color: darkMode ? '#F5F7FA' : Colors.text,
                                  marginBottom: 6,
                                },
                              ]}
                            >
                              Clearing level
                            </Text>
                            <View style={styles.qmOptionWrap}>
                              {LANDSCAPE_CLEARING_LEVEL_OPTIONS.map(level => {
                                const selectedLevel =
                                  measurements.landscapeClearingLevel ===
                                  level.id;
                                return (
                                  <TouchableOpacity
                                    key={level.id}
                                    onPress={() =>
                                      setMeasurements(prev => ({
                                        ...prev,
                                        landscapeClearingLevel: level.id,
                                      }))
                                    }
                                    disabled={applying}
                                    activeOpacity={1}
                                    style={[
                                      styles.qmOption,
                                      {
                                        borderColor: selectedLevel
                                          ? '#34d399'
                                          : darkMode
                                            ? '#52525b'
                                            : '#cbd5e1',
                                        backgroundColor: selectedLevel
                                          ? 'rgba(52, 211, 153, 0.12)'
                                          : darkMode
                                            ? '#3a3a3c'
                                            : '#f1f5f9',
                                      },
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.qmOptionText,
                                        {
                                          color: selectedLevel
                                            ? '#34d399'
                                            : darkMode
                                              ? '#e4e4e7'
                                              : Colors.text,
                                        },
                                      ]}
                                    >
                                      {selectedLevel ? '✓ ' : ''}
                                      {level.label}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                            {measurements.landscapeClearingLevel ? (
                              <Text
                                style={[
                                  styles.qmPanelCaption,
                                  {
                                    color: darkMode ? '#d7e1f0' : '#64748b',
                                    marginTop: 6,
                                  },
                                ]}
                              >
                                {
                                  LANDSCAPE_CLEARING_LEVEL_HELPERS[
                                    measurements.landscapeClearingLevel
                                  ]
                                }
                              </Text>
                            ) : null}
                            <Text
                              style={[
                                styles.qmPanelCaption,
                                {
                                  color: darkMode ? '#d7e1f0' : '#64748b',
                                  marginTop: 8,
                                },
                              ]}
                            >
                              Tree removal, dirt excavation, hardscape
                              demolition, and grading are priced separately.
                            </Text>
                          </View>
                        ) : null}
                        <View
                          style={{
                            height: 8,
                            marginTop: 8,
                            borderTopWidth: 1,
                            borderTopColor: darkMode
                              ? 'rgba(255,255,255,0.10)'
                              : Colors.line,
                          }}
                        />
                      </>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </View>
            {showRockMulchTonnage ? (
              <>
                <QmSqftMeasurementRow
                  label='Rock / mulch tonnage'
                  helperText='Optional when the material is being estimated by weight.'
                  value={String(
                    (measurements as Record<string, unknown>).landscapeTons ||
                      ''
                  )}
                  placeholder='Enter'
                  unitLabel='tons'
                  onChangeText={value =>
                    updateMeasurement('landscapeTons', value)
                  }
                  applying={applying}
                  darkMode={darkMode}
                  Colors={Colors}
                  highlighted
                />
                <View
                  style={{
                    height: 8,
                    marginTop: 8,
                    borderTopWidth: 1,
                    borderTopColor: darkMode
                      ? 'rgba(255,255,255,0.10)'
                      : Colors.line,
                  }}
                />
              </>
            ) : null}
            {measurementFooter}
            <TouchableOpacity
              onPress={() => setExpanded(false)}
              activeOpacity={0.75}
              style={{
                marginTop: 12,
                paddingTop: 10,
                borderTopWidth: 1,
                borderTopColor: darkMode
                  ? 'rgba(255,255,255,0.12)'
                  : Colors.line,
              }}
            >
              <Text
                style={[
                  styles.qmPanelCaption,
                  {
                    color: darkMode ? '#d7e1f0' : '#64748b',
                    textAlign: 'center',
                  },
                ]}
              >
                Collapse card ⌃
              </Text>
            </TouchableOpacity>
          </>
        ) : null}
      </View>
    </>
  );
}

export function QmConcreteScopePanels({
  measurements,
  setMeasurements,
  applying,
  measurementFooter,
  mixedExteriorScope = false,
  promptGroundUpStructure = false,
  notes = '',
  darkMode,
  Colors,
}: {
  measurements: ScopeMeasurementsInputExtended;
  setMeasurements: React.Dispatch<
    React.SetStateAction<ScopeMeasurementsInputExtended>
  >;
  applying: boolean;
  measurementFooter?: React.ReactNode;
  mixedExteriorScope?: boolean;
  promptGroundUpStructure?: boolean;
  notes?: string;
  darkMode: boolean;
  Colors: Colors;
}) {
  useEffect(() => {
    if (!promptGroundUpStructure) return;
    setMeasurements(prev => {
      const scopeIds = new Set(
        Array.isArray(prev.concreteScope)
          ? prev.concreteScope.map(String)
          : []
      );
      const structureOn = [
        'reinforcement',
        'pour_foundation',
        'house_slab',
        'garage_slab',
      ].some(id => scopeIds.has(id));
      const flatworkOn = ['driveways', 'walkways'].some(id => scopeIds.has(id));
      const structureBase = structureOn
        ? prev
        : ({
            ...prev,
            concreteGroundUpStructurePrompted: false,
          } as ScopeMeasurementsInputExtended);
      const withStructure = structureBase.concreteGroundUpStructurePrompted
        ? structureBase
        : (withConcreteGroundUpStructurePrompts(
            structureBase as Record<string, unknown>
          ) as ScopeMeasurementsInputExtended);
      const flatworkBase = flatworkOn
        ? withStructure
        : ({
            ...withStructure,
            concreteGroundUpFlatworkPrompted: false,
            concreteRvGaragePrompted: false,
          } as ScopeMeasurementsInputExtended);
      const withFlatwork = withConcreteGroundUpFlatworkPrompts(
        flatworkBase as Record<string, unknown>,
        { notes }
      ) as ScopeMeasurementsInputExtended;
      if (
        withFlatwork.concreteScope === withStructure.concreteScope &&
        withFlatwork.concreteGroundUpFlatworkPrompted ===
          withStructure.concreteGroundUpFlatworkPrompted &&
        withFlatwork.concreteRvGaragePrompted ===
          withStructure.concreteRvGaragePrompted &&
        withStructure === prev
      ) {
        return prev;
      }
      return withFlatwork;
    });
  }, [notes, promptGroundUpStructure, setMeasurements]);
  const selected = readConcreteScope(measurements as Record<string, unknown>);
  const scopeFoundPieces = Array.isArray(
    (measurements as Record<string, unknown>).scopeFoundPieces
  )
    ? ((measurements as Record<string, unknown>).scopeFoundPieces as unknown[]).map(
        String
      )
    : [];
  const concreteDemoQuantityOwnedByScopeFound =
    ['concrete_demo', 'excavation_demo'].includes(
      String((measurements as Record<string, unknown>).scopeFoundClarificationId || '')
    ) &&
    scopeFoundPieces.some(piece =>
      [
        'concrete_slab',
        'asphalt',
        'concrete_pavers',
        'gravel',
        'site_concrete',
      ].includes(piece)
    );
  const notesIncludeExcavation = /\b(?:excavat(?:e|ion|ing)|dig(?:ging)?|cut\s*(?:\/|and)?\s*fill|soil\s+movement)\b/i.test(
    String(notes || '')
  );
  const excavationOnlyGroundUp =
    notesIncludeExcavation &&
    /\b(?:foundation|footings?)\b/i.test(String(notes || '')) &&
    !/\b(?:pour|place|install|construct|build)\b[^.;\n]{0,40}\b(?:foundation|footings?|slab)\b/i.test(
      String(notes || '')
    );
  const groundUpExcavationFlow =
    (promptGroundUpStructure && notesIncludeExcavation) ||
    excavationOnlyGroundUp;
  const collapseSecondaryPanels =
    groundUpExcavationFlow;
  const [expanded, setExpanded] = useState(!collapseSecondaryPanels);
  const [sitePrepExpanded, setSitePrepExpanded] = useState(true);
  const [optionalExpanded, setOptionalExpanded] = useState(
    !collapseSecondaryPanels
  );
  const flatworkActive = CONCRETE_FLATWORK_OPTIONS.some(option =>
    selected.includes(option.id)
  );
  const selectedFlatworkOptions = CONCRETE_FLATWORK_OPTIONS.filter(option =>
    selected.includes(option.id)
  );
  const concreteAreaByType = measurements.concreteAreaByType || {};
  const flatworkAreaTotal = selectedFlatworkOptions.reduce(
    (sum, option) => sum + (Number(concreteAreaByType[option.id]) || 0),
    0
  );
  const defaultThicknessForType = (id: string) => (id === 'rv_pads' ? 5 : 4);
  const selectedDemoBands = measurements.concreteDemoThicknessBands?.length
    ? measurements.concreteDemoThicknessBands
    : measurements.concreteDemoThicknessBand
      ? [measurements.concreteDemoThicknessBand]
      : [];
  const showStructuralConcrete =
    !String(notes || '').trim() ||
    notesImplyStructuralFoundation(notes) ||
    !notesImplyExteriorFlatwork(notes);
  const demoAreaSqft = Number(
    String(measurements.concreteDemoSqft ?? '').replace(/,/g, '')
  );
  const hasDemoArea = Number.isFinite(demoAreaSqft) && demoAreaSqft > 0;
  const demoAreaByThickness = measurements.concreteDemoAreaByThickness || {};
  const flatworkVolumeCrossCheckCy =
    selectedFlatworkOptions.reduce((sum, option) => {
      const area = Number(concreteAreaByType[option.id]) || 0;
      const thickness =
        Number(measurements.concreteThicknessByType?.[option.id]) ||
        defaultThicknessForType(option.id);
      return sum + (area * (thickness / 12)) / 27;
    }, 0) + (Number(measurements.thickenedEdgeCy) || 0);
  const needsFlatworkArea =
    flatworkActive ||
    selected.includes('reinforcement') ||
    selected.includes('concrete_sealer') ||
    selected.includes('decorative_finish');

  const toggle = (id: string) => {
    setMeasurements(prev => {
      const current = readConcreteScope(prev as Record<string, unknown>);
      const canonical = concreteScopeCanonicalId(id);
      const isSelected = current.includes(id) || current.includes(canonical);
      const next = isSelected
        ? current.filter(value => value !== id && value !== canonical)
        : [...current, id];
      const nextFlatworkIds = CONCRETE_FLATWORK_OPTIONS.map(
        option => option.id
      ).filter(flatworkId => next.includes(flatworkId));
      const existingAreas = prev.concreteAreaByType || {};
      const nextAreas = Object.fromEntries(
        nextFlatworkIds
          .filter(flatworkId => existingAreas[flatworkId] != null)
          .map(flatworkId => [flatworkId, existingAreas[flatworkId]])
      );
      const nextAreaTotal = Object.values(nextAreas).reduce(
        (sum, area) => sum + (Number(area) || 0),
        0
      );
      const clearedDemoMeasurements =
        isSelected && canonical === 'demo_removal'
          ? {
              concreteDemoSqft: '',
              concreteDemoThicknessBand: null,
              concreteDemoThicknessBands: null,
              concreteDemoAreaByThickness: null,
              concreteDemoReinforced: false,
              concreteDemoLimitedAccess: false,
              concreteDemoCy: '',
            }
          : {};
      return {
        ...prev,
        ...clearedDemoMeasurements,
        concreteScope: next.length ? next : null,
        concreteAreaByType: Object.keys(nextAreas).length ? nextAreas : null,
        concreteSqft:
          nextFlatworkIds.length > 1 && !Object.keys(nextAreas).length
            ? ''
            : nextAreaTotal > 0
              ? String(nextAreaTotal)
              : prev.concreteSqft,
      } as ScopeMeasurementsInputExtended;
    });
  };

  const updateMeasurement = (key: string, value: string) => {
    setMeasurements(prev => ({ ...prev, [key]: value }));
  };
  const updateFlatworkArea = (id: string, value: string) => {
    setMeasurements(prev => {
      const nextAreas = { ...(prev.concreteAreaByType || {}), [id]: value };
      const activeFlatworkIds = CONCRETE_FLATWORK_OPTIONS.map(
        option => option.id
      ).filter(flatworkId =>
        readConcreteScope(prev as Record<string, unknown>).includes(flatworkId)
      );
      const total = activeFlatworkIds.reduce(
        (sum, flatworkId) => sum + (Number(nextAreas[flatworkId]) || 0),
        0
      );
      return {
        ...prev,
        concreteAreaByType: nextAreas,
        concreteSqft: total > 0 ? String(total) : '',
      };
    });
  };
  const updateFlatworkThickness = (id: string, value: number) => {
    setMeasurements(prev => ({
      ...prev,
      concreteThicknessByType: {
        ...(prev.concreteThicknessByType || {}),
        [id]: value,
      },
    }));
  };
  const toggleDemoThickness = (id: string) => {
    setMeasurements(prev => {
      const current = prev.concreteDemoThicknessBands?.length
        ? prev.concreteDemoThicknessBands
        : prev.concreteDemoThicknessBand
          ? [prev.concreteDemoThicknessBand]
          : [];
      const selected = current.includes(id as (typeof current)[number]);
      const next = selected
        ? current.filter(band => band !== id)
        : [...current, id as (typeof current)[number]];
      const nextAreas = { ...(prev.concreteDemoAreaByThickness || {}) };
      if (
        !selected &&
        current.length === 1 &&
        Number(prev.concreteDemoSqft) > 0 &&
        Object.keys(nextAreas).length === 0
      ) {
        nextAreas[current[0]] = Number(prev.concreteDemoSqft);
      }
      if (selected) delete nextAreas[id as keyof typeof nextAreas];
      const total = Object.values(nextAreas).reduce(
        (sum, area) => sum + (Number(area) || 0),
        0
      );
      return {
        ...prev,
        concreteDemoThicknessBands: next,
        concreteDemoThicknessBand: next.length === 1 ? next[0] : null,
        concreteDemoAreaByThickness: Object.keys(nextAreas).length
          ? nextAreas
          : null,
        concreteDemoSqft:
          total > 0 ? String(total) : next.length ? prev.concreteDemoSqft : '',
      };
    });
  };
  const updateDemoBandArea = (id: string, value: string) => {
    setMeasurements(prev => {
      const nextAreas = {
        ...(prev.concreteDemoAreaByThickness || {}),
        [id]: value,
      };
      const total = Object.values(nextAreas).reduce(
        (sum, area) => sum + (Number(area) || 0),
        0
      );
      return {
        ...prev,
        concreteDemoAreaByThickness: nextAreas,
        concreteDemoSqft: total > 0 ? String(total) : '',
      };
    });
  };
  const hasMeasurement = (key: string) => {
    const value = Number(
      String((measurements as Record<string, unknown>)[key] ?? '').replace(
        /,/g,
        ''
      )
    );
    return Number.isFinite(value) && value > 0;
  };
  const selectedThickness = Number(measurements.concreteThicknessInches) || 4;
  const excavationQuantityMode =
    measurements.excavationQuantityMode ||
    (Number(measurements.excavationAreaSqft) > 0
      ? 'area_depth'
      : 'direct_cy');
  const nationalFlatworkRate = 6 + 4 * (selectedThickness / 4);
  const sitePrepOptionIds = new Set([
    'demo_removal',
    'site_prep',
    'gravel_base',
    'excavation',
  ]);
  const optionalOptionIds = new Set([
    'reinforcement',
    'complex_forming',
    'concrete_sealer',
    'decorative_finish',
    'concrete_pumping',
    'additional_haul_off',
    'retaining_wall',
  ]);
  const dedicatedFlatwork =
    !showStructuralConcrete && String(notes || '').trim().length > 0;
  const visibleSitePrepOptionIds =
    groundUpExcavationFlow
      ? new Set(['excavation'])
      : mixedExteriorScope || dedicatedFlatwork
      ? new Set(
          Array.from(sitePrepOptionIds).filter(id => selected.includes(id))
        )
      : sitePrepOptionIds;
  const visibleOptionalOptionIds =
    mixedExteriorScope || dedicatedFlatwork
      ? new Set(
          Array.from(optionalOptionIds).filter(id => selected.includes(id))
        )
      : optionalOptionIds;
  const visibleFlatworkOptions =
    mixedExteriorScope ||
    (dedicatedFlatwork && selectedFlatworkOptions.length > 0)
      ? selectedFlatworkOptions
      : CONCRETE_FLATWORK_OPTIONS;
  const flatworkPanelTitle = excavationOnlyGroundUp
    ? 'Foundation pour & flatwork'
    : showStructuralConcrete
      ? 'Flatwork & footing/foundation pour'
    : selectedFlatworkOptions.length === 1
      ? `${selectedFlatworkOptions[0].label} pour`
      : 'Flatwork pour';
  const showSitePrepPanel =
    (groundUpExcavationFlow
      ? true
      : dedicatedFlatwork
        ? visibleSitePrepOptionIds.size > 0
        : !mixedExteriorScope || visibleSitePrepOptionIds.size > 0);
  const showOptionalPanel = dedicatedFlatwork
    ? visibleOptionalOptionIds.size > 0
    : !mixedExteriorScope || visibleOptionalOptionIds.size > 0;
  const panelStyle = groundUpExcavationFlow
    ? {
        ...qmPanelShellStyle(darkMode),
        backgroundColor: darkMode ? '#2A2A2E' : Colors.surface2,
      }
    : qmPanelShellStyle(darkMode);
  if (notesNameConcretePatioWithSod(notes)) return null;

  return (
    <View style={{ gap: 12 }}>
      {showSitePrepPanel ? (
        <View style={[styles.qmPanel, panelStyle]}>
              <TouchableOpacity
                onPress={() => setSitePrepExpanded(value => !value)}
                activeOpacity={0.75}
                style={{ marginTop: 14, marginBottom: 4 }}
              >
                <Text
                  style={[
                    styles.qmPanelTitle,
                    { color: darkMode ? '#cbd5e1' : Colors.text },
                  ]}
                >
                    {groundUpExcavationFlow
                      ? 'Excavation'
                      : 'Site prep & existing conditions'}{' '}
                    {sitePrepExpanded ? '⌃' : '⌄'}
                </Text>
                <Text
                  style={[
                    styles.qmPanelCaption,
                    { color: darkMode ? '#d7e1f0' : '#64748b', marginTop: 2 },
                  ]}
                >
                  {groundUpExcavationFlow
                    ? 'Enter the excavation quantity for this scope.'
                    : 'Demo, grading, excavation, and other site conditions.'}
                </Text>
              </TouchableOpacity>
              {sitePrepExpanded
                ? CONCRETE_SCOPE_OPTIONS.filter(option =>
                    visibleSitePrepOptionIds.has(option.id)
                  ).map(option => {
                    const active =
                      selected.includes(option.id) ||
                      (option.id === 'pour_foundation' &&
                        selected.includes('footings'));
                    return (
                      <React.Fragment key={option.id}>
                        <QmConcreteScopeChoiceChip
                          label={option.label}
                          active={active}
                          onPress={() => toggle(option.id)}
                          applying={applying}
                          darkMode={darkMode}
                          Colors={Colors}
                          style={{ marginTop: 10 }}
                        />
                        {active &&
                        'measurementKey' in option &&
                        option.measurementKey ? (
                          <>
                            {option.id !== 'demo_removal' &&
                            option.id !== 'excavation' ? (
                              <QmSqftMeasurementRow
                                label={option.label}
                                helperText={
                                  option.id === 'complex_forming' &&
                                  !hasMeasurement(option.measurementKey)
                                    ? 'The notes identify a thickened edge but do not specify its length. Enter the confirmed edge length before pricing.'
                                    : 'helperText' in option
                                      ? option.helperText
                                      : undefined
                                }
                                value={String(
                                  (measurements as Record<string, unknown>)[
                                    option.measurementKey
                                  ] || ''
                                )}
                                placeholder='Enter'
                                unitLabel={option.unit}
                                onChangeText={value =>
                                  updateMeasurement(
                                    option.measurementKey!,
                                    value
                                  )
                                }
                                applying={applying}
                                darkMode={darkMode}
                                Colors={Colors}
                                highlighted
                              />
                            ) : null}
                            {option.id !== 'demo_removal' &&
                            option.id !== 'excavation' &&
                            !hasMeasurement(option.measurementKey) ? (
                              <Text
                                style={{
                                  color: '#fbbf24',
                                  fontSize: 11,
                                  marginTop: 5,
                                }}
                              >
                                Quantity needed before this scope can be priced.
                              </Text>
                            ) : null}
                            {option.id === 'demo_removal' &&
                            concreteDemoQuantityOwnedByScopeFound ? (
                              <Text
                                style={{
                                  color: darkMode ? '#d7e1f0' : '#64748b',
                                  fontSize: 11,
                                  lineHeight: 15,
                                  marginTop: 8,
                                }}
                              >
                                Concrete removal quantity is managed in the
                                Demo / tear-out card above.
                              </Text>
                            ) : null}
                            {option.id === 'demo_removal' ? (
                              <>
                                {!concreteDemoQuantityOwnedByScopeFound &&
                                hasDemoArea &&
                                selectedDemoBands.length === 0 ? (
                                  <>
                                    <Text
                                      style={[
                                        styles.qmPanelCaption,
                                        {
                                          color: darkMode
                                            ? '#d7e1f0'
                                            : '#64748b',
                                          marginTop: 8,
                                          marginBottom: 4,
                                        },
                                      ]}
                                    >
                                      {demoAreaSqft} sqft of existing flatwork
                                      is in this bid. Existing thickness is not
                                      in the notes.
                                    </Text>
                                    <QmSqftMeasurementRow
                                      label='Existing flatwork removal'
                                      helperText='Area from the notes. Thickness stays blank until you confirm it.'
                                      value={String(
                                        measurements.concreteDemoSqft || ''
                                      )}
                                      placeholder='Enter'
                                      unitLabel='sqft'
                                      onChangeText={value =>
                                        updateMeasurement(
                                          'concreteDemoSqft',
                                          value
                                        )
                                      }
                                      applying={applying}
                                      darkMode={darkMode}
                                      Colors={Colors}
                                      highlighted
                                    />
                                  </>
                                ) : !concreteDemoQuantityOwnedByScopeFound &&
                                  !hasDemoArea ? (
                                  <Text
                                    style={{
                                      color: darkMode ? '#fbbf24' : '#a16207',
                                      fontSize: 11,
                                      lineHeight: 15,
                                      marginTop: 8,
                                      marginBottom: 4,
                                    }}
                                  >
                                    The notes include removal but do not give
                                    the existing area or thickness.
                                  </Text>
                                ) : null}
                                {!concreteDemoQuantityOwnedByScopeFound &&
                                selectedDemoBands.map(band => {
                                  const bandLabel =
                                    CONCRETE_DEMO_THICKNESS_OPTIONS.find(
                                      item => item.id === band
                                    )?.label || band;
                                  return (
                                    <QmSqftMeasurementRow
                                      key={`${band}-demo-area`}
                                      label={`${bandLabel} demo area`}
                                      helperText='Enter the area for this concrete thickness.'
                                      value={String(
                                        demoAreaByThickness[band] ??
                                          (selectedDemoBands.length === 1
                                            ? measurements.concreteDemoSqft ||
                                              ''
                                            : '')
                                      )}
                                      placeholder='Enter'
                                      unitLabel='sqft'
                                      onChangeText={value =>
                                        updateDemoBandArea(band, value)
                                      }
                                      applying={applying}
                                      darkMode={darkMode}
                                      Colors={Colors}
                                      highlighted
                                    />
                                  );
                                })}
                                <Text
                                  style={[
                                    styles.qmPanelCaption,
                                    {
                                      color: darkMode ? '#cbd5e1' : Colors.text,
                                      marginTop: 10,
                                      marginBottom: 6,
                                    },
                                  ]}
                                >
                                  Existing concrete thickness · select all that
                                  apply
                                </Text>
                                <View style={styles.qmOptionWrap}>
                                  {CONCRETE_DEMO_THICKNESS_OPTIONS.map(
                                    thickness => {
                                      const activeThickness =
                                        selectedDemoBands.includes(
                                          thickness.id
                                        );
                                      return (
                                        <QmConcreteScopeChoiceChip
                                          key={thickness.id}
                                          label={thickness.label}
                                          active={activeThickness}
                                          onPress={() =>
                                            toggleDemoThickness(thickness.id)
                                          }
                                          applying={applying}
                                          darkMode={darkMode}
                                          Colors={Colors}
                                        />
                                      );
                                    }
                                  )}
                                </View>
                                <Text
                                  style={[
                                    styles.qmPanelCaption,
                                    {
                                      color: darkMode ? '#cbd5e1' : Colors.text,
                                      marginTop: 10,
                                      marginBottom: 4,
                                    },
                                  ]}
                                >
                                  Demolition conditions · select all that apply
                                </Text>
                                <QmConcreteScopeChoiceChip
                                  label='Reinforced concrete · +$1.25/sqft'
                                  active={Boolean(
                                    measurements.concreteDemoReinforced
                                  )}
                                  onPress={() =>
                                    setMeasurements(prev => ({
                                      ...prev,
                                      concreteDemoReinforced:
                                        !prev.concreteDemoReinforced,
                                    }))
                                  }
                                  applying={applying}
                                  darkMode={darkMode}
                                  Colors={Colors}
                                  style={{ marginTop: 10 }}
                                />
                                <QmConcreteScopeChoiceChip
                                  label='Limited access · +$1.50/sqft'
                                  active={Boolean(
                                    measurements.concreteDemoLimitedAccess
                                  )}
                                  onPress={() =>
                                    setMeasurements(prev => ({
                                      ...prev,
                                      concreteDemoLimitedAccess:
                                        !prev.concreteDemoLimitedAccess,
                                    }))
                                  }
                                  applying={applying}
                                  darkMode={darkMode}
                                  Colors={Colors}
                                  style={{ marginTop: 8 }}
                                />
                                {selectedDemoBands.includes(
                                  'structural_7_plus'
                                ) ? (
                                  <QmSqftMeasurementRow
                                    label='Heavy / structural demo quantity'
                                    helperText='Enter demolition CY for the $175/CY review allowance, or use custom pricing.'
                                    value={String(
                                      measurements.concreteDemoCy || ''
                                    )}
                                    placeholder='Enter'
                                    unitLabel='CY'
                                    onChangeText={value =>
                                      updateMeasurement('concreteDemoCy', value)
                                    }
                                    applying={applying}
                                    darkMode={darkMode}
                                    Colors={Colors}
                                    highlighted
                                  />
                                ) : null}
                              </>
                            ) : null}
                            {option.id === 'excavation' ? (
                              <>
                                <Text
                                  style={[
                                    styles.qmPanelCaption,
                                    {
                                      color: darkMode ? '#cbd5e1' : Colors.text,
                                      marginTop: 10,
                                      marginBottom: 6,
                                    },
                                  ]}
                                >
                                  How would you like to enter excavation
                                  quantity?
                                </Text>
                                <View style={styles.qmOptionWrap}>
                                  {(
                                    [
                                      {
                                        id: 'direct_cy',
                                        label: 'Enter cubic yards directly',
                                      },
                                      {
                                        id: 'area_depth',
                                        label: 'Calculate from area + depth',
                                      },
                                    ] as const
                                  ).map(mode => {
                                    const selectedMode =
                                      excavationQuantityMode;
                                    const modeActive = selectedMode === mode.id;
                                    return (
                                      <QmConcreteScopeChoiceChip
                                        key={mode.id}
                                        label={mode.label}
                                        active={modeActive}
                                        onPress={() =>
                                          setMeasurements(prev =>
                                            mode.id === 'direct_cy'
                                              ? {
                                                  ...prev,
                                                  excavationQuantityMode:
                                                    'direct_cy',
                                                  excavationAreaSqft: '',
                                                  excavationDepthInches: '',
                                                }
                                              : {
                                                  ...prev,
                                                  excavationQuantityMode:
                                                    'area_depth',
                                                  excavationCy: '',
                                                }
                                          )
                                        }
                                        applying={applying}
                                        darkMode={darkMode}
                                        Colors={Colors}
                                      />
                                    );
                                  })}
                                </View>
                                {excavationQuantityMode === 'direct_cy' ? (
                                  <QmSqftMeasurementRow
                                    label='Direct excavation quantity'
                                    helperText='This CY value controls pricing. Area and depth are not used in this mode.'
                                    value={String(
                                      measurements.excavationCy || ''
                                    )}
                                    placeholder='Enter'
                                    unitLabel='CY'
                                    onChangeText={value =>
                                      updateMeasurement('excavationCy', value)
                                    }
                                    applying={applying}
                                    darkMode={darkMode}
                                    Colors={Colors}
                                    highlighted
                                  />
                                ) : (
                                  <>
                                    <QmSqftMeasurementRow
                                      label='Excavation area'
                                      helperText='Enter the affected excavation area.'
                                      value={String(
                                        measurements.excavationAreaSqft || ''
                                      )}
                                      placeholder='Enter'
                                      unitLabel='sqft'
                                      onChangeText={value =>
                                        updateMeasurement(
                                          'excavationAreaSqft',
                                          value
                                        )
                                      }
                                      applying={applying}
                                      darkMode={darkMode}
                                      Colors={Colors}
                                      highlighted
                                    />
                                    <QmSqftMeasurementRow
                                      label='Excavation depth'
                                      helperText='Planning assumption: when the notes do not specify a dig depth, this may default to slab thickness plus the gravel-base depth. Confirm the actual dirt/soil removal depth; imported fill and off-site disposal remain separate.'
                                      value={String(
                                        measurements.excavationDepthInches || ''
                                      )}
                                      placeholder='Enter'
                                      unitLabel='in'
                                      onChangeText={value =>
                                        updateMeasurement(
                                          'excavationDepthInches',
                                          value
                                        )
                                      }
                                      applying={applying}
                                      darkMode={darkMode}
                                      Colors={Colors}
                                      highlighted
                                    />
                                    {Number(measurements.excavationAreaSqft) >
                                      0 &&
                                    Number(measurements.excavationDepthInches) >
                                      0 ? (
                                      <Text
                                        style={{
                                          color: darkMode ? '#d7e1f0' : '#64748b',
                                          fontSize: 11,
                                          marginTop: 5,
                                        }}
                                      >
                                        Calculated excavation quantity from this
                                        area and depth:{' '}
                                        {(
                                          (Number(
                                            measurements.excavationAreaSqft
                                          ) *
                                            (Number(
                                              measurements.excavationDepthInches
                                            ) /
                                              12)) /
                                          27
                                        ).toFixed(1)}{' '}
                                        CY
                                      </Text>
                                    ) : (
                                      <Text
                                        style={{
                                          color: '#fbbf24',
                                          fontSize: 11,
                                          marginTop: 5,
                                        }}
                                      >
                                        Enter both area and depth before this
                                        scope can be priced.
                                      </Text>
                                    )}
                                  </>
                                )}
                              </>
                            ) : null}
                          </>
                        ) : null}
                      </React.Fragment>
                    );
                  })
                : null}
        </View>
      ) : null}
      <View style={[styles.qmPanel, panelStyle]}>
        <TouchableOpacity
          onPress={() => setExpanded(value => !value)}
          activeOpacity={0.75}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: 10,
            }}
          >
            <Text
              style={[
                styles.qmPanelTitle,
                {
                  color: darkMode ? '#cbd5e1' : '#475569',
                  flexShrink: 1,
                },
              ]}
            >
              {flatworkPanelTitle}
            </Text>
            <Text
              style={{
                color: darkMode ? '#cbd5e1' : '#475569',
                fontSize: 18,
                fontWeight: '800',
                lineHeight: 20,
              }}
            >
              {expanded ? '⌃' : '⌄'}
            </Text>
          </View>
          <Text
            style={[
              styles.qmPanelCaption,
              { color: darkMode ? '#d7e1f0' : '#64748b', marginTop: 2 },
            ]}
          >
            {expanded
              ? 'Tap to collapse card'
              : selected.length
                ? 'Selected · tap to expand card'
                : 'Tap to expand card'}
          </Text>
        </TouchableOpacity>
        {expanded ? (
          <>
            {visibleFlatworkOptions.length > 1 ? (
              <>
                <Text
                  style={[
                    styles.qmPanelCaption,
                    { color: darkMode ? '#d7e1f0' : '#64748b', marginTop: 10 },
                  ]}
                >
                  Select the flatwork type and any additional work beyond the
                  standard installation.
                </Text>
                <Text
                  style={[
                    styles.qmPanelCaption,
                    { color: '#fbbf24', marginTop: 4, marginBottom: 0 },
                  ]}
                >
                  Standard flatwork includes normal forming, placement, basic
                  finish, curing, and cleanup. Add only upgrades or work beyond
                  the standard scope.
                </Text>
              </>
            ) : (
              <Text
                style={[
                  styles.qmPanelCaption,
                  { color: darkMode ? '#d7e1f0' : '#64748b', marginTop: 10 },
                ]}
              >
                Standard flatwork includes forming, placement, basic finish,
                curing, and cleanup.
              </Text>
            )}

            <Text
              style={[
                styles.qmPanelCaption,
                {
                  color: darkMode ? '#F5F7FA' : Colors.text,
                  marginTop: 14,
                  marginBottom: 6,
                },
              ]}
            >
              Flatwork type
            </Text>
            <View style={styles.qmOptionWrap}>
              {visibleFlatworkOptions.map(option => {
                const active = selected.includes(option.id);
                return (
                  <QmConcreteScopeChoiceChip
                    key={option.id}
                    label={option.label}
                    active={active}
                    onPress={() => toggle(option.id)}
                    applying={applying}
                    darkMode={darkMode}
                    Colors={Colors}
                  />
                );
              })}
            </View>

            {needsFlatworkArea ? (
              <>
                {flatworkActive ? (
                  <>
                    <Text
                      style={[
                        styles.qmPanelCaption,
                        {
                          color: darkMode ? '#cbd5e1' : Colors.text,
                          marginTop: 8,
                          marginBottom: 6,
                        },
                      ]}
                    >
                      Area by flatwork type
                    </Text>
                    <Text
                      style={[
                        styles.qmPanelCaption,
                        {
                          color: darkMode ? '#d7e1f0' : '#64748b',
                          marginBottom: 6,
                        },
                      ]}
                    >
                      {visibleFlatworkOptions.length > 1
                        ? 'Enter each selected area separately. Pricing uses the combined total of these entries'
                        : 'Pricing uses this area'}{' '}
                      at ${nationalFlatworkRate.toFixed(2)}/sqft for a{' '}
                      {selectedThickness}" slab.
                    </Text>
                    {selectedFlatworkOptions.map(option => {
                      const planAreaKey = Object.entries(
                        CONCRETE_PLAN_FLATWORK_AREA_KEYS
                      ).find(([, type]) => type === option.id)?.[0];
                      const planArea = planAreaKey
                        ? (measurements as Record<string, unknown>)[planAreaKey]
                        : '';
                      return (
                      <React.Fragment key={option.id}>
                        <QmSqftMeasurementRow
                          label={`${option.label} area`}
                          helperText={`Area for this ${option.label.toLowerCase()} only.`}
                          value={String(
                            concreteAreaByType[option.id] ??
                              planArea ??
                              (selectedFlatworkOptions.length === 1
                                ? measurements.concreteSqft || ''
                                : '')
                          )}
                          placeholder='Enter'
                          unitLabel='sqft'
                          onChangeText={value =>
                            updateFlatworkArea(option.id, value)
                          }
                          applying={applying}
                          darkMode={darkMode}
                          Colors={Colors}
                          highlighted
                        />
                        <Text
                          style={[
                            styles.qmPanelCaption,
                            {
                              color: darkMode ? '#cbd5e1' : Colors.text,
                              marginTop: 6,
                              marginBottom: 4,
                            },
                          ]}
                        >
                          {option.label} thickness
                        </Text>
                        <View style={styles.qmOptionWrap}>
                          {CONCRETE_SLAB_THICKNESS_OPTIONS.map(thickness => {
                            const selectedTypeThickness =
                              Number(
                                measurements.concreteThicknessByType?.[
                                  option.id
                                ]
                              ) || defaultThicknessForType(option.id);
                            const thicknessActive =
                              selectedTypeThickness === thickness.inches;
                            return (
                              <QmConcreteScopeChoiceChip
                                key={`${option.id}-${thickness.id}`}
                                label={thickness.label}
                                active={thicknessActive}
                                onPress={() =>
                                  updateFlatworkThickness(
                                    option.id,
                                    thickness.inches
                                  )
                                }
                                applying={applying}
                                darkMode={darkMode}
                                Colors={Colors}
                              />
                            );
                          })}
                        </View>
                      </React.Fragment>
                      );
                    })}
                    {selectedFlatworkOptions.length > 1 &&
                    flatworkAreaTotal <= 0 ? (
                      <Text
                        style={{ color: '#fbbf24', fontSize: 11, marginTop: 8 }}
                      >
                        Enter the square footage for each selected flatwork type
                        before pricing.
                      </Text>
                    ) : null}
                  </>
                ) : (
                  <QmSqftMeasurementRow
                    label='Flatwork pour area'
                    helperText={`Combined slab, sidewalk, driveway, or patio area. National average pricing uses this area at $${nationalFlatworkRate.toFixed(2)}/sqft for a ${selectedThickness}" slab.`}
                    value={String(measurements.concreteSqft || '')}
                    placeholder='Enter'
                    unitLabel='sqft'
                    onChangeText={value =>
                      updateMeasurement('concreteSqft', value)
                    }
                    applying={applying}
                    darkMode={darkMode}
                    Colors={Colors}
                    highlighted
                  />
                )}
                {Object.keys(concreteAreaByType).length > 0 ? (
                  <View style={{ marginTop: 12 }}>
                    <Text
                      style={[
                        styles.qmPanelCaption,
                        {
                          color: darkMode ? '#cbd5e1' : Colors.text,
                          marginBottom: 4,
                        },
                      ]}
                    >
                      Concrete volume cross-check
                    </Text>
                    <Text
                      style={[
                        styles.qmPanelCaption,
                        {
                          color: darkMode ? '#d7e1f0' : '#64748b',
                          marginBottom: 0,
                        },
                      ]}
                    >
                      Approximately {flatworkVolumeCrossCheckCy.toFixed(1)} CY
                      based on each selected type’s area and thickness
                      {Number(measurements.thickenedEdgeCy) > 0
                        ? ` plus ${Number(measurements.thickenedEdgeCy).toFixed(1)} CY thickened edge`
                        : ''}
                      . This is informational only and does not replace sqft
                      pricing.
                    </Text>
                  </View>
                ) : null}
                {!flatworkActive && !hasMeasurement('concreteSqft') ? (
                  <Text
                    style={{ color: '#fbbf24', fontSize: 11, marginTop: 8 }}
                  >
                    Enter the combined pour area to price flatwork.
                  </Text>
                ) : null}
                <View
                  style={{
                    height: 8,
                    marginTop: 8,
                    borderTopWidth: 1,
                    borderTopColor: darkMode
                      ? 'rgba(255,255,255,0.10)'
                      : Colors.line,
                  }}
                />
              </>
            ) : null}

            {showStructuralConcrete ? (
            <>
            <View style={{ marginTop: 14 }}>
              <Text
                style={[
                  styles.qmPanelCaption,
                  {
                    color: darkMode ? '#cbd5e1' : Colors.text,
                    fontWeight: '700',
                  },
                ]}
              >
                Footing / foundation concrete pour
              </Text>
              <Text
                style={[
                  styles.qmPanelCaption,
                  { color: darkMode ? '#d7e1f0' : '#64748b', marginTop: 2 },
                ]}
              >
                Structural concrete is separate from exterior flatwork and is
                priced by CY.
              </Text>
              {CONCRETE_SCOPE_OPTIONS.filter(
                option => option.id === 'pour_foundation'
              ).map(option => {
                const active =
                  selected.includes(option.id) || selected.includes('footings');
                return (
                  <React.Fragment key={option.id}>
                    <QmConcreteScopeChoiceChip
                      label={option.label}
                      active={active}
                      onPress={() => toggle(option.id)}
                      applying={applying}
                      darkMode={darkMode}
                      Colors={Colors}
                      style={{ marginTop: 10 }}
                    />
                    {active &&
                    'measurementKey' in option &&
                    option.measurementKey ? (
                      <QmSqftMeasurementRow
                        label='Footing / foundation concrete quantity'
                        helperText='Enter separate footing or foundation concrete CY. Excavation, forms, reinforcement, waterproofing, and accessories are separate.'
                        value={String(
                          (measurements as Record<string, unknown>)[
                            option.measurementKey
                          ] || ''
                        )}
                        placeholder='Enter'
                        unitLabel={option.unit}
                        onChangeText={value =>
                          updateMeasurement(option.measurementKey!, value)
                        }
                        applying={applying}
                        darkMode={darkMode}
                        Colors={Colors}
                        highlighted
                      />
                    ) : null}
                  </React.Fragment>
                );
              })}
            </View>

            <View style={{ marginTop: 14 }}>
              <Text
                style={[
                  styles.qmPanelCaption,
                  {
                    color: darkMode ? '#cbd5e1' : Colors.text,
                    fontWeight: '700',
                  },
                ]}
              >
                Building slab pour
              </Text>
              <Text
                style={[
                  styles.qmPanelCaption,
                  { color: darkMode ? '#d7e1f0' : '#64748b', marginTop: 2 },
                ]}
              >
                Enter the house and garage slab areas. These stay blank until
                you type them.
              </Text>
              {CONCRETE_BUILDING_SLAB_OPTIONS.map(option => {
                const active = selected.includes(option.id);
                const thickness =
                  Number(
                    (measurements as Record<string, unknown>)[
                      option.thicknessKey
                    ]
                  ) || 4;
                const area = Number(
                  (measurements as Record<string, unknown>)[option.areaKey]
                );
                const slabCy =
                  Number.isFinite(area) && area > 0
                    ? (area * (thickness / 12)) / 27
                    : 0;
                return (
                  <React.Fragment key={option.id}>
                    <QmConcreteScopeChoiceChip
                      label={option.label}
                      active={active}
                      onPress={() => toggle(option.id)}
                      applying={applying}
                      darkMode={darkMode}
                      Colors={Colors}
                      style={{ marginTop: 10 }}
                    />
                    {active ? (
                      <>
                        <QmSqftMeasurementRow
                          label={`${option.label} area`}
                          helperText='Type the slab area for this pour.'
                          value={String(
                            (measurements as Record<string, unknown>)[
                              option.areaKey
                            ] || ''
                          )}
                          placeholder='Enter'
                          unitLabel='sqft'
                          onChangeText={value =>
                            updateMeasurement(option.areaKey, value)
                          }
                          applying={applying}
                          darkMode={darkMode}
                          Colors={Colors}
                          highlighted
                        />
                        <Text
                          style={[
                            styles.qmPanelCaption,
                            {
                              color: darkMode ? '#cbd5e1' : Colors.text,
                              marginTop: 6,
                              marginBottom: 4,
                            },
                          ]}
                        >
                          {option.label} thickness
                        </Text>
                        <View style={styles.qmOptionWrap}>
                          {CONCRETE_SLAB_THICKNESS_OPTIONS.map(choice => {
                            const thicknessActive =
                              thickness === choice.inches;
                            return (
                              <QmConcreteScopeChoiceChip
                                key={`${option.id}-${choice.id}`}
                                label={choice.label}
                                active={thicknessActive}
                                onPress={() =>
                                  setMeasurements(prev => ({
                                    ...prev,
                                    [option.thicknessKey]: choice.inches,
                                  }))
                                }
                                applying={applying}
                                darkMode={darkMode}
                                Colors={Colors}
                              />
                            );
                          })}
                        </View>
                        {slabCy > 0 ? (
                          <Text
                            style={[
                              styles.qmPanelCaption,
                              {
                                color: darkMode ? '#d7e1f0' : '#64748b',
                                marginTop: 6,
                              },
                            ]}
                          >
                            Approximately {slabCy.toFixed(1)} CY from the area
                            and thickness you enter.
                          </Text>
                        ) : null}
                      </>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </View>
            </>
            ) : null}
          </>
        ) : null}
      </View>
      {showOptionalPanel ? (
        <>
          <View style={[styles.qmPanel, panelStyle]}>
            <TouchableOpacity
              onPress={() => setOptionalExpanded(value => !value)}
              activeOpacity={0.75}
              style={{ marginTop: 14, marginBottom: 4 }}
            >
              <Text
                style={[
                  styles.qmPanelTitle,
                  { color: darkMode ? '#cbd5e1' : Colors.text },
                ]}
              >
                Optional additions {optionalExpanded ? '⌃' : '⌄'}
              </Text>
              <Text
                style={[
                  styles.qmPanelCaption,
                  { color: darkMode ? '#d7e1f0' : '#64748b', marginTop: 2 },
                ]}
              >
                Reinforcement, complex forming, mixed exterior work, upgrades,
                and excess disposal.
              </Text>
            </TouchableOpacity>
            {optionalExpanded
              ? CONCRETE_SCOPE_OPTIONS.filter(option =>
                  visibleOptionalOptionIds.has(option.id)
                ).map(option => {
                  const active = selected.includes(option.id);
                  return (
                    <React.Fragment key={option.id}>
                      {option.id === 'additional_haul_off' ? (
                        <View
                          style={{
                            marginTop: 8,
                            borderTopWidth: 1,
                            borderTopColor: darkMode
                              ? 'rgba(255,255,255,0.12)'
                              : Colors.line,
                          }}
                        />
                      ) : null}
                      <QmConcreteScopeChoiceChip
                        label={option.label}
                        active={active}
                        onPress={() => toggle(option.id)}
                        applying={applying}
                        darkMode={darkMode}
                        Colors={Colors}
                        style={{ marginTop: 10 }}
                      />
                      {active && option.id === 'decorative_finish' ? (
                        <View
                          style={{
                            marginTop: 8,
                            marginBottom: 8,
                          }}
                        >
                          <Text
                            style={[
                              styles.qmPanelCaption,
                              {
                                color: darkMode ? '#cbd5e1' : Colors.text,
                                marginBottom: 6,
                              },
                            ]}
                          >
                            Decorative finish upgrade · select one
                          </Text>
                          <View style={styles.qmOptionWrap}>
                            {CONCRETE_DECORATIVE_FINISH_OPTIONS.map(finish => {
                              const selectedFinish =
                                measurements.concreteDecorativeFinish ||
                                'integral_color';
                              const finishActive = selectedFinish === finish.id;
                              return (
                                <QmConcreteScopeChoiceChip
                                  key={finish.id}
                                  label={`${finish.label} · +$${finish.rate.toFixed(2)}/sqft`}
                                  active={finishActive}
                                  onPress={() =>
                                    setMeasurements(prev => ({
                                      ...prev,
                                      concreteDecorativeFinish: finish.id,
                                    }))
                                  }
                                  applying={applying}
                                  darkMode={darkMode}
                                  Colors={Colors}
                                />
                              );
                            })}
                          </View>
                        </View>
                      ) : null}
                      {active &&
                      'measurementKey' in option &&
                      option.measurementKey ? (
                        <>
                          <QmSqftMeasurementRow
                            label={option.label}
                            helperText={
                              option.id === 'additional_haul_off'
                                ? 'Enter additional truck/dump loads beyond included cleanup. 1 load = $400.'
                                : 'helperText' in option
                                  ? option.helperText
                                  : undefined
                            }
                            value={String(
                              (measurements as Record<string, unknown>)[
                                option.measurementKey
                              ] || ''
                            )}
                            placeholder='Enter'
                            unitLabel={option.unit}
                            onChangeText={value =>
                              updateMeasurement(option.measurementKey!, value)
                            }
                            applying={applying}
                            darkMode={darkMode}
                            Colors={Colors}
                            highlighted
                          />
                          {!hasMeasurement(option.measurementKey) ? (
                            <Text
                              style={{
                                color: '#fbbf24',
                                fontSize: 11,
                                marginTop: 5,
                              }}
                            >
                              Quantity needed before this scope can be priced.
                            </Text>
                          ) : null}
                          {option.id === 'additional_haul_off' &&
                          Number(
                            (measurements as Record<string, unknown>)[
                              option.measurementKey
                            ]
                          ) > 0 ? (
                            <Text
                              style={{
                                color: darkMode ? '#d7e1f0' : '#64748b',
                                fontSize: 11,
                                marginTop: 5,
                              }}
                            >
                              {Number(
                                (measurements as Record<string, unknown>)[
                                  option.measurementKey
                                ]
                              )}{' '}
                              load
                              {Number(
                                (measurements as Record<string, unknown>)[
                                  option.measurementKey
                                ]
                              ) === 1
                                ? ''
                                : 's'}{' '}
                              = $
                              {(
                                Number(
                                  (measurements as Record<string, unknown>)[
                                    option.measurementKey
                                  ]
                                ) * 400
                              ).toLocaleString()}
                            </Text>
                          ) : null}
                        </>
                      ) : null}
                    </React.Fragment>
                  );
                })
              : null}

            {measurementFooter}
            <TouchableOpacity
              onPress={() => setExpanded(false)}
              activeOpacity={0.75}
              style={{
                marginTop: 12,
                paddingTop: 10,
                borderTopWidth: 1,
                borderTopColor: darkMode
                  ? 'rgba(255,255,255,0.12)'
                  : Colors.line,
              }}
            >
              <Text
                style={[
                  styles.qmPanelCaption,
                  {
                    color: darkMode ? '#d7e1f0' : '#64748b',
                    textAlign: 'center',
                  },
                ]}
              >
                Collapse card ⌃
              </Text>
            </TouchableOpacity>
          </View>
        </>
      ) : null}
    </View>
  );
}

type TradeOptionRow = {
  id: string;
  label: string;
  canonicalId: string;
  measurementKey?: string;
  unit?: string;
};

function qmPanelShellStyle(darkMode: boolean) {
  return {
    borderColor: darkMode ? 'rgba(148,163,184,0.28)' : 'rgba(100,116,139,0.24)',
    // Shared top-level job-scope card surface; chips and inputs remain nested.
    backgroundColor: darkMode ? '#2A2A2E' : '#f8fafc',
  };
}

function QmTradeScopeOptionList({
  options,
  selections,
  scopeKey,
  onToggle,
  measurements,
  setMeasurements,
  applying,
  darkMode,
  Colors,
}: {
  options: TradeOptionRow[];
  selections: string[];
  scopeKey: SimpleTradeScopeKey;
  onToggle: (id: string, canonicalId: string) => void;
  measurements: ScopeMeasurementsInputExtended;
  setMeasurements: React.Dispatch<
    React.SetStateAction<ScopeMeasurementsInputExtended>
  >;
  applying: boolean;
  darkMode: boolean;
  Colors: Colors;
}) {
  const spec = simpleTradeSpec(scopeKey);
  const hasMeasurement = (key: string) => {
    const value = Number(
      String((measurements as Record<string, unknown>)[key] ?? '').replace(
        /,/g,
        ''
      )
    );
    return Number.isFinite(value) && value > 0;
  };
  const measurementPayload = measurements as Record<string, unknown>;
  const optionQuantitySatisfied = (option: TradeOptionRow) =>
    scopeKey === 'roofing'
      ? roofingQmOptionQuantitySatisfied(
          option.id,
          option.measurementKey,
          measurementPayload
        )
      : option.measurementKey
        ? hasMeasurement(option.measurementKey)
        : true;

  return (
    <View style={styles.qmOptionWrap}>
      {options.map(option => {
        const canonicalSelected = selections.includes(option.canonicalId);
        const hasAlias = selections.some(value =>
          spec.options.some(candidate => candidate.id === value)
        );
        const firstCanonicalOption = spec.options.find(
          candidate => candidate.canonicalId === option.canonicalId
        )?.id;
        const active =
          selections.includes(option.id) ||
          (canonicalSelected &&
            !hasAlias &&
            option.id === firstCanonicalOption);
        const allowanceAmount =
          scopeKey === 'roofing' && option.id === 'decking_repair'
            ? roofingQmOptionAllowanceAmount(option.id, measurementPayload)
            : null;
        const quantitySatisfied = optionQuantitySatisfied(option);
        const usesSharedRoofSquares =
          scopeKey === 'roofing' && option.measurementKey === 'roofSquares';
        return (
          <React.Fragment key={option.id}>
            <QmScopeChoiceChip
              label={option.label}
              active={active}
              onPress={() => onToggle(option.id, option.canonicalId)}
              disabled={applying}
              darkMode={darkMode}
              Colors={Colors}
              style={{ minWidth: '100%' }}
            />
            {active && option.measurementKey && !usesSharedRoofSquares ? (
              allowanceAmount != null ? (
                <Text
                  style={{
                    color: Colors.sub,
                    fontSize: 12,
                    marginTop: 8,
                    lineHeight: 17,
                  }}
                >
                  Allowance ${allowanceAmount.toLocaleString()} from notes — no
                  sqft needed unless you want to price by area instead.
                </Text>
              ) : (
                <>
                  <QmSqftMeasurementRow
                    label={`${option.label} quantity`}
                    helperText={
                      option.measurementHelper ||
                      'Enter only the quantity for this selected component.'
                    }
                    value={String(
                      (measurements as Record<string, unknown>)[
                        option.measurementKey
                      ] || ''
                    )}
                    placeholder='Enter'
                    unitLabel={option.unit}
                    onChangeText={value =>
                      setMeasurements(prev => ({
                        ...prev,
                        [option.measurementKey!]: value,
                      }))
                    }
                    applying={applying}
                    darkMode={darkMode}
                    Colors={Colors}
                    highlighted={!quantitySatisfied}
                  />
                  {option.id === 'downspouts'
                    ? (() => {
                        const warning =
                          roofingDownspoutQuantityWarning(measurementPayload);
                        return warning ? (
                          <Text
                            style={{
                              color: '#fbbf24',
                              fontSize: 11,
                              marginTop: 5,
                            }}
                          >
                            {warning}
                          </Text>
                        ) : null;
                      })()
                    : null}
                  {!quantitySatisfied ? (
                    <Text
                      style={{ color: '#fbbf24', fontSize: 11, marginTop: 5 }}
                    >
                      Quantity needed before this scope can be priced.
                    </Text>
                  ) : null}
                </>
              )
            ) : null}
          </React.Fragment>
        );
      })}
    </View>
  );
}

export function QmRoofingScopePanels({
  measurements,
  setMeasurements,
  onScopeSelectionChange,
  notes,
  savedCoveringLabel,
  condensed = false,
  applying,
  darkMode,
  Colors,
}: {
  measurements: ScopeMeasurementsInputExtended;
  setMeasurements: React.Dispatch<
    React.SetStateAction<ScopeMeasurementsInputExtended>
  >;
  onScopeSelectionChange?: (measurements: Record<string, unknown>) => void;
  notes?: string | null;
  /** Card name already saved on this bid, used when the choice field was dropped. */
  savedCoveringLabel?: string | null;
  condensed?: boolean;
  applying: boolean;
  darkMode: boolean;
  Colors: Colors;
}) {
  const scopeKey: SimpleTradeScopeKey = 'roofing';
  const selections = measurements.tradeScopeSelections?.[scopeKey] || [];
  const [installExpanded, setInstallExpanded] = useState(true);
  const [demoExpanded, setDemoExpanded] = useState(true);
  const [accessoryExpanded, setAccessoryExpanded] = useState(true);
  const [tearOffRowVisible, setTearOffRowVisible] = useState(
    () =>
      (measurements.tradeScopeSelections?.[scopeKey] || []).includes('tear_off')
  );
  const panelStyle = qmPanelShellStyle(darkMode);

  const toggle = (id: string, _canonicalId: string) => {
    const selected = selections.includes(id);
    const next = selected
      ? selections.filter(value => value !== id)
      : [...selections, id];
    setMeasurements(prev => ({
      ...prev,
      tradeScopeSelections: {
        ...(prev.tradeScopeSelections || {}),
        [scopeKey]: next.length ? next : null,
      },
    }));
    onScopeSelectionChange?.({
      ...measurements,
      tradeScopeSelections: {
        ...(measurements.tradeScopeSelections || {}),
        [scopeKey]: next.length ? next : null,
      },
    });
  };

  const installOptions = roofingOptionsForIds(ROOFING_INSTALL_OPTION_IDS);
  const demoOptions = roofingOptionsForIds(ROOFING_DEMO_OPTION_IDS);
  const accessoryOptions = roofingOptionsForIds(ROOFING_ACCESSORY_OPTION_IDS);
  const drainageOptions = roofingOptionsForIds(ROOFING_DRAINAGE_OPTION_IDS);
  const roofingNoteText = String(notes || '');
  const noteBackedRoofingOption = (id: string): boolean => {
    const patterns: Record<string, RegExp> = {
      tear_off:
        /\b(?:tear[\s-]?off|remove|removal)\b[^.;\n]{0,70}\b(?:roof|shingles?|asphalt)\b|\b(?:roof|shingles?)\b[^.;\n]{0,70}\b(?:tear[\s-]?off|remove|removal)\b/i,
      shingles:
        /\b(?:replace|replacement|install|reroof|re[\s-]?roof)\b[^.;\n]{0,45}\b(?:roof(?:ing)?|shingles?|squares?)\b|\b\d[\d,]*(?:\.\d+)?\s+roofing\s+squares?\b/i,
      decking_repair:
        /\b(?:deck(?:ing)?|roof\s+deck)\b[^.;\n]{0,35}\b(?:repair|replace|replacement)\b|\b(?:repair|replace|replacement)\b[^.;\n]{0,35}\b(?:deck(?:ing)?|roof\s+deck)\b/i,
      gutters: /\bgutters?\b/i,
      downspouts: /\bdownspouts?\b/i,
      underlayment: /\bunderlayment\b/i,
      ice_water_shield:
        /\b(?:ice\s*[&/-]\s*water|ice\s+and\s+water|ice\s*barrier|eaves?\s+protection|ice[\s-]?water\s+shield)\b/i,
      drip_edge: /\bdrip\s+edge\b/i,
      ridge_cap: /\bridge\s+cap\b/i,
      valley_flashing: /\bvalley\s+flashing\b/i,
      pipe_boots: /\bpipe\s+boots?\b/i,
      step_flashing: /\bstep\s+flashing\b/i,
      wall_flashing: /\bwall\s+flashing\b/i,
    };
    return Boolean(patterns[id]?.test(roofingNoteText));
  };
  useEffect(() => {
    if (
      selections.includes('tear_off') ||
      noteBackedRoofingOption('tear_off')
    ) {
      setTearOffRowVisible(true);
    }
  }, [selections, roofingNoteText]);
  const visibleRoofingOptions = (options: typeof installOptions) =>
    condensed
      ? options.filter(
          option =>
            noteBackedRoofingOption(option.id) ||
            ((ROOFING_DEMO_OPTION_IDS as readonly string[]).includes(option.id) &&
              (selections.includes(option.id) ||
                selections.includes(option.canonicalId)))
        )
      : options;
  const visibleInstallOptions = visibleRoofingOptions(installOptions);
  const visibleDemoOptions = visibleRoofingOptions(demoOptions);
  const visibleAccessoryOptions = visibleRoofingOptions(accessoryOptions);
  const visibleDrainageOptions = visibleRoofingOptions(drainageOptions);
  const tearOffRows = ROOF_TEAR_OFF_CARDS.filter(row =>
    readScopeFoundPieces(measurements.scopeFoundPieces).includes(row.piece)
  ).map(row => ({
    ...row,
    typed: String(measurements.itemQuantities?.[row.id]?.quantity ?? ''),
  }));
  const setTearOffSquares = (itemId: string, value: string) => {
    const quantity = value.replace(/,/g, '').trim();
    setMeasurements(prev => {
      const itemQuantities = {
        ...(prev.itemQuantities || {}),
      };
      if (!quantity || !(Number(quantity) > 0)) {
        delete itemQuantities[itemId];
      } else {
        itemQuantities[itemId] = {
          quantity,
          unit: 'squares',
          quantitySource: 'user_entered',
        };
      }
      return { ...prev, itemQuantities };
    });
  };
  const installSelected = installOptions.some(
    option =>
      selections.includes(option.id) || selections.includes(option.canonicalId)
  );
  const planDetected = (key: string) => {
    const source = measurements.quickMeasurementSources?.[key];
    return (
      source === 'plan_detected' ||
      source === 'detected_from_plan' ||
      source === 'plan_verified' ||
      source === 'contractor_confirmed_from_plan_review'
    );
  };
  const roofSquaresValue = String(measurements.roofSquares || '')
    .replace(/,/g, '')
    .trim();
  const roofAreaValue = String(measurements.roofAreaSqft || '')
    .replace(/,/g, '')
    .trim();
  const roofAreaMissing = !(Number(roofSquaresValue) > 0) && !(Number(roofAreaValue) > 0);
  const planOnlyRoof =
    measurements.planImportMode === 'selected_trade' &&
    measurements.planImportTradeKey === 'roofing';
  useEffect(() => {
    if (!planOnlyRoof) return;
    if (measurements.roofingSystemChoice) return;
    const restored = roofMaterialChoiceFromLabel(savedCoveringLabel);
    if (!restored || restored === 'architectural_shingles') return;
    setMeasurements(prev =>
      prev.roofingSystemChoice
        ? prev
        : { ...prev, roofingSystemChoice: restored }
    );
  }, [
    planOnlyRoof,
    measurements.roofingSystemChoice,
    savedCoveringLabel,
    setMeasurements,
  ]);
  useEffect(() => {
    if (!planOnlyRoof) return;
    if (measurements.quickMeasurementUserOverrides?.storyCount) return;
    const next = roofingStoryCountForReview({
      measurements,
      planFacts: measurements.planFacts as Record<string, unknown> | null,
      provenanceEntry:
        measurements.measurementProvenance?.storyCount ??
        measurements.quickMeasurementSources?.storyCount,
    });
    if (next == null) return;
    const current = Number(
      String(measurements.storyCount ?? '').replace(/,/g, '')
    );
    if (current === next) return;
    setMeasurements(prev => {
      if (prev.quickMeasurementUserOverrides?.storyCount) return prev;
      const previous = Number(String(prev.storyCount ?? '').replace(/,/g, ''));
      if (previous === next) return prev;
      return { ...prev, storyCount: String(next) };
    });
  }, [measurements, planOnlyRoof, setMeasurements]);
  const roofMaterial = readRoofMaterialChoice(measurements);
  const setRoofMaterial = (choice: (typeof ROOF_MATERIAL_OPTIONS)[number]['id']) => {
    setMeasurements(prev => ({
      ...prev,
      roofingSystemChoice: choice,
    }));
  };
  const markRoofingMeasurement = (
    key: string,
    value: string,
    selectionId?: string
  ) => {
    setMeasurements(prev => {
      const current = new Set(prev.tradeScopeSelections?.roofing || []);
      if (selectionId) {
        const amount = Number(String(value).replace(/,/g, ''));
        if (Number.isFinite(amount) && amount > 0) current.add(selectionId);
        else current.delete(selectionId);
      }
      return {
        ...prev,
        [key]: value,
        tradeScopeSelections: {
          ...(prev.tradeScopeSelections || {}),
          roofing: current.size ? [...current] : null,
        },
        quickMeasurementSources: {
          ...(prev.quickMeasurementSources || {}),
          [key]: 'user_entered',
        },
        quickMeasurementUserOverrides: {
          ...(prev.quickMeasurementUserOverrides || {}),
          [key]: true,
        },
      };
    });
  };
  const groundUpMeasurementRows: Array<{
    key: string;
    label: string;
    unit: string;
    keyboardType?: 'decimal-pad' | 'number-pad';
    selectionId: string;
  }> = [
    {
      key: 'roofDripEdgeLf',
      label: 'Drip edge',
      unit: 'LF',
      selectionId: 'drip_edge',
    },
    {
      key: 'roofRidgeCapLf',
      label: 'Ridge cap',
      unit: 'LF',
      selectionId: 'ridge_cap',
    },
    {
      key: 'roofRidgeVentLf',
      label: 'Ridge vent',
      unit: 'EA',
      keyboardType: 'number-pad',
      selectionId: 'ridge_vent',
    },
    {
      key: 'roofPipeBootCount',
      label: 'Pipe boots',
      unit: 'EA',
      keyboardType: 'number-pad',
      selectionId: 'pipe_boots',
    },
    {
      key: 'roofGutterLf',
      label: 'Gutters',
      unit: 'LF',
      selectionId: 'gutters',
    },
    {
      key: 'roofDownspoutCount',
      label: 'Downspouts',
      unit: 'EA',
      keyboardType: 'number-pad',
      selectionId: 'downspouts',
    },
  ];

  return (
    <View style={{ gap: 12 }}>
      <View style={[styles.qmPanel, panelStyle]}>
        <TouchableOpacity
          onPress={() => setInstallExpanded(value => !value)}
          activeOpacity={0.75}
        >
          <Text
            style={[
              styles.qmPanelTitle,
              { color: darkMode ? '#cbd5e1' : '#475569' },
            ]}
          >
            {planOnlyRoof ? 'Roofing measurements' : 'Roofing install scope'}{' '}
            {installExpanded ? '⌃' : '⌄'}
          </Text>
          <Text
            style={[
              styles.qmPanelCaption,
              { color: darkMode ? '#d7e1f0' : '#64748b', marginTop: 2 },
            ]}
          >
            {installExpanded
              ? 'Tap to collapse card'
              : installSelected
                ? 'Selected · tap to expand card'
                : 'Tap to expand card'}
          </Text>
        </TouchableOpacity>
        {installExpanded ? (
          <>
            {planOnlyRoof ? (
              <Text
                style={[
                  styles.qmPanelCaption,
                  { color: darkMode ? '#d7e1f0' : '#64748b', marginTop: 10 },
                ]}
              >
                Enter the amounts for this new roof. Blank rows stay unpriced.
              </Text>
            ) : (
              <>
                <Text
                  style={[
                    styles.qmPanelCaption,
                    { color: darkMode ? '#d7e1f0' : '#64748b', marginTop: 10 },
                  ]}
                >
                  Select every install component included in this bid.
                  Measurements feed the corresponding pricing cards.
                </Text>
                <Text
                  style={[
                    styles.qmPanelCaption,
                    { color: '#fbbf24', marginTop: 4, marginBottom: 0 },
                  ]}
                >
                  Standard roofing includes normal underlayment, shingles, drip
                  edge, and perimeter cleanup. Add only upgrades or work beyond
                  the standard scope.
                </Text>
              </>
            )}
            <QmSqftMeasurementRow
              label='Roof pitch'
              helperText={
                planDetected('roofPitch')
                  ? 'Detected from plan.'
                  : 'Enter the pitch shown on the plan, such as 2:12.'
              }
              value={String(measurements.roofPitch || '')}
              placeholder='e.g. 2:12'
              unitLabel='pitch'
              textEntry
              onChangeText={value => markRoofingMeasurement('roofPitch', value)}
              applying={applying}
              darkMode={darkMode}
              Colors={Colors}
            />
            {planOnlyRoof ? (
              <>
                <Text
                  style={[
                    styles.qmPanelCaption,
                    {
                      color: darkMode ? '#d7e1f0' : '#64748b',
                      marginTop: 12,
                      marginBottom: 8,
                      fontWeight: '700',
                    },
                  ]}
                >
                  Roof material
                </Text>
                <View style={[styles.choiceWrap, { marginBottom: 4 }]}>
                  {ROOF_MATERIAL_OPTIONS.map(option => (
                    <QmScopeChoiceChip
                      key={option.id}
                      label={option.label}
                      active={roofMaterial === option.id}
                      reviewState={
                        roofMaterial === option.id ? 'confirmed' : 'idle'
                      }
                      onPress={() => setRoofMaterial(option.id)}
                      disabled={applying}
                      darkMode={darkMode}
                      Colors={Colors}
                      compact
                    />
                  ))}
                </View>
              </>
            ) : null}
            <QmSqftMeasurementRow
              label={
                planOnlyRoof
                  ? roofMaterialCardLabel(roofMaterial)
                  : 'Roof surface area / squares'
              }
              helperText={
                roofAreaMissing
                  ? planOnlyRoof
                    ? `Needs measurement. Not found on plan — enter roof squares. ${roofMaterialPriceIncludes(roofMaterial)}`
                    : 'Needs measurement. Not found on plan — enter roof squares before pricing.'
                  : planOnlyRoof
                    ? roofMaterialPriceIncludes(roofMaterial)
                    : 'Roof squares price the shingle install.'
              }
              value={roofSquaresValue}
              placeholder='Enter roof squares'
              unitLabel='squares'
              onChangeText={value =>
                markRoofingMeasurement(
                  'roofSquares',
                  value.replace(/,/g, ''),
                  planOnlyRoof ? 'shingles' : undefined
                )
              }
              applying={applying}
              darkMode={darkMode}
              Colors={Colors}
              highlighted={roofAreaMissing}
            />
            <QmSqftMeasurementRow
              label='Stories'
              helperText={
                planDetected('storyCount')
                  ? 'Detected from plan.'
                  : 'Enter the number of stories. This does not calculate roof area.'
              }
              value={String(measurements.storyCount || '')}
              placeholder='1'
              unitLabel='story'
              keyboardType='number-pad'
              onChangeText={value =>
                markRoofingMeasurement('storyCount', value.replace(/,/g, ''))
              }
              applying={applying}
              darkMode={darkMode}
              Colors={Colors}
              highlighted={roofingStoryCountNeedsHighlight(
                measurements.storyCount
              )}
            />
            {planOnlyRoof ? (
              groundUpMeasurementRows
                .filter(
                  row =>
                    row.key !== 'roofDripEdgeLf' && row.key !== 'roofRidgeCapLf'
                )
                .map(row => (
                <QmSqftMeasurementRow
                  key={row.key}
                  label={row.label}
                  helperText={
                    row.key === 'roofDripEdgeLf' || row.key === 'roofRidgeCapLf'
                      ? 'Included in the shingle price.'
                      : undefined
                  }
                  value={String(
                    (measurements as Record<string, unknown>)[row.key] || ''
                  ).replace(/,/g, '')}
                  placeholder='Enter'
                  unitLabel={row.unit}
                  keyboardType={row.keyboardType}
                  onChangeText={value =>
                    markRoofingMeasurement(
                      row.key,
                      value.replace(/,/g, ''),
                      row.selectionId
                    )
                  }
                  applying={applying}
                  darkMode={darkMode}
                  Colors={Colors}
                />
              ))
            ) : (
              <>
                <Text
                  style={[
                    styles.qmPanelCaption,
                    {
                      color: darkMode ? '#F5F7FA' : Colors.text,
                      marginTop: 14,
                      marginBottom: 6,
                    },
                  ]}
                >
                  Install components
                </Text>
                <QmTradeScopeOptionList
                  options={visibleInstallOptions}
                  selections={selections}
                  scopeKey={scopeKey}
                  onToggle={toggle}
                  measurements={measurements}
                  setMeasurements={setMeasurements}
                  applying={applying}
                  darkMode={darkMode}
                  Colors={Colors}
                />
              </>
            )}
          </>
        ) : null}
      </View>

      {installExpanded &&
      !planOnlyRoof &&
      (tearOffRowVisible ||
        visibleDemoOptions.length > 0 ||
        selections.some(id =>
          (ROOFING_DEMO_OPTION_IDS as readonly string[]).includes(id)
        )) ? (
        <>
          <View style={[styles.qmPanel, panelStyle]}>
            <TouchableOpacity
              onPress={() => setDemoExpanded(value => !value)}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.qmPanelCaption,
                  {
                    color: darkMode ? '#cbd5e1' : Colors.text,
                    fontWeight: '700',
                  },
                ]}
              >
                Existing roof / tear-off {demoExpanded ? '⌃' : '⌄'}
              </Text>
              <Text
                style={[
                  styles.qmPanelCaption,
                  { color: darkMode ? '#d7e1f0' : '#64748b', marginTop: 2 },
                ]}
              >
                Tear-off, disposal, and existing roof conditions.
              </Text>
            </TouchableOpacity>
            {demoExpanded ? (
              <View style={{ marginTop: 12 }}>
                {tearOffRows.length ? (
                  tearOffRows.map(row => (
                    <QmSqftMeasurementRow
                      key={row.id}
                      label={row.label}
                      helperText={
                        row.piece === 'metal'
                          ? 'Metal tear-off is priced per square, not sqft.'
                          : 'Squares of this material coming off.'
                      }
                      value={row.typed}
                      placeholder='Enter squares'
                      unitLabel='squares'
                      onChangeText={value => setTearOffSquares(row.id, value)}
                      applying={applying}
                      darkMode={darkMode}
                      Colors={Colors}
                    />
                  ))
                ) : (
                  <QmCountStepper
                    label='Tear-off'
                    value={selections.includes('tear_off') ? 1 : null}
                    rowKey='tear_off'
                    onAdjustRow={(_key, delta) => {
                      const on = selections.includes('tear_off');
                      if (delta < 0 && on) toggle('tear_off', 'tear_off');
                      if (delta > 0 && !on) {
                        setTearOffRowVisible(true);
                        toggle('tear_off', 'tear_off');
                      }
                    }}
                    applying={applying}
                    max={1}
                    darkMode={darkMode}
                    Colors={Colors}
                  />
                )}
              </View>
            ) : null}
          </View>

          {visibleAccessoryOptions.length > 0 ? (
            <View style={[styles.qmPanel, panelStyle]}>
              <TouchableOpacity
                onPress={() => setAccessoryExpanded(value => !value)}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.qmPanelCaption,
                    {
                      color: darkMode ? '#cbd5e1' : Colors.text,
                      fontWeight: '700',
                    },
                  ]}
                >
                  Ventilation & accessories {accessoryExpanded ? '⌃' : '⌄'}
                </Text>
                <Text
                  style={[
                    styles.qmPanelCaption,
                    { color: darkMode ? '#d7e1f0' : '#64748b', marginTop: 2 },
                  ]}
                >
                  Vents, penetrations, repairs, and closeout extras.
                </Text>
              </TouchableOpacity>
              {accessoryExpanded ? (
                <QmTradeScopeOptionList
                  options={visibleAccessoryOptions}
                  selections={selections}
                  scopeKey={scopeKey}
                  onToggle={toggle}
                  measurements={measurements}
                  setMeasurements={setMeasurements}
                  applying={applying}
                  darkMode={darkMode}
                  Colors={Colors}
                />
              ) : null}
            </View>
          ) : null}

          {visibleDrainageOptions.length > 0 ? (
            <View style={[styles.qmPanel, panelStyle]}>
              <Text
                style={[
                  styles.qmPanelCaption,
                  {
                    color: darkMode ? '#cbd5e1' : Colors.text,
                    fontWeight: '700',
                  },
                ]}
              >
                Other / drainage
              </Text>
              <Text
                style={[
                  styles.qmPanelCaption,
                  { color: darkMode ? '#d7e1f0' : '#64748b', marginTop: 2 },
                ]}
              >
                Gutters and downspouts priced independently by LF and each.
              </Text>
              <QmTradeScopeOptionList
                options={visibleDrainageOptions}
                selections={selections}
                scopeKey={scopeKey}
                onToggle={toggle}
                measurements={measurements}
                setMeasurements={setMeasurements}
                applying={applying}
                darkMode={darkMode}
                Colors={Colors}
              />
            </View>
          ) : null}
          <TouchableOpacity
            onPress={() => setInstallExpanded(false)}
            activeOpacity={0.75}
            style={{
              marginTop: 12,
              paddingTop: 10,
              borderTopWidth: 1,
              borderTopColor: darkMode
                ? 'rgba(255,255,255,0.12)'
                : Colors.line,
            }}
          >
            <Text
              style={[
                styles.qmPanelCaption,
                {
                  color: darkMode ? '#d7e1f0' : '#64748b',
                  textAlign: 'center',
                },
              ]}
            >
              Collapse card ⌃
            </Text>
          </TouchableOpacity>
        </>
      ) : null}
    </View>
  );
}

function parseStuccoMeasurement(value: unknown): number {
  const parsed = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function stuccoMeasurementInputValue(value: unknown): string {
  return value == null ? '' : String(value);
}

function reconcileStuccoNetWall(
  measurements: ScopeMeasurementsInputExtended
): Partial<Pick<
  ScopeMeasurementsInputExtended,
  'stuccoNetWallSqft' | 'quickMeasurementSources'
>> {
  const gross = parseStuccoMeasurement(measurements.stuccoGrossWallSqft);
  if (!gross) {
    return {};
  }
  const openings =
    parseStuccoMeasurement(measurements.stuccoWindowDoorOpeningSqft) +
    parseStuccoMeasurement(measurements.stuccoGarageOpeningSqft) +
    parseStuccoMeasurement(measurements.stuccoOtherFinishDeductionSqft);
  const net = String(Math.max(0, gross - openings));
  return {
    stuccoNetWallSqft: net,
    quickMeasurementSources: {
      ...(measurements.quickMeasurementSources || {}),
      stuccoNetWallSqft: 'calculated_from_deductions',
    },
  };
}

const STUCCO_SYSTEM_OPTIONS = [
  {
    id: 'three_coat',
    label: '3-coat traditional',
    detail: 'Scratch, brown, and finish over lath.',
  },
  {
    id: 'one_coat',
    label: '1-coat stucco',
    detail: 'One base coat, then a finish coat.',
  },
  {
    id: 'eifs',
    label: 'EIFS / synthetic',
    detail: 'Foam, mesh, and an acrylic finish.',
  },
  {
    id: 'finish_only',
    label: 'Finish coat only',
    detail: 'Color coat over a base that is already there.',
  },
] as const;

export function QmStuccoScopePanels({
  measurements,
  setMeasurements,
  systemChoiceId = null,
  onSystemChoice,
  onStoriesChange,
  applying,
  darkMode,
  Colors,
  notes = null,
}: {
  measurements: ScopeMeasurementsInputExtended;
  setMeasurements: React.Dispatch<
    React.SetStateAction<ScopeMeasurementsInputExtended>
  >;
  systemChoiceId?: string | null;
  onSystemChoice?: (choiceId: string | null) => void;
  onStoriesChange?: () => void;
  applying: boolean;
  darkMode: boolean;
  Colors: Colors;
  notes?: string | null;
}) {
  const [wallExpanded, setWallExpanded] = useState(true);
  const [addonsExpanded, setAddonsExpanded] = useState(true);
  const [accessExpanded, setAccessExpanded] = useState(true);
  const panelStyle = qmPanelShellStyle(darkMode);

  useEffect(() => {
    const derived = reconcileStuccoNetWall(measurements);
    const currentNet = stuccoMeasurementInputValue(
      measurements.stuccoNetWallSqft
    );
    const nextNet =
      derived.stuccoNetWallSqft == null
        ? currentNet
        : stuccoMeasurementInputValue(derived.stuccoNetWallSqft);
    if (currentNet === nextNet) return;
    setMeasurements(prev => {
      const next = {
        ...prev,
        ...reconcileStuccoNetWall(prev),
      };
      return stuccoMeasurementInputValue(next.stuccoNetWallSqft) ===
        stuccoMeasurementInputValue(prev.stuccoNetWallSqft)
        ? prev
        : next;
    });
  }, [
    measurements.stuccoGrossWallSqft,
    measurements.stuccoWindowDoorOpeningSqft,
    measurements.stuccoGarageOpeningSqft,
    measurements.stuccoOtherFinishDeductionSqft,
    measurements.stuccoNetWallSqft,
  ]);

  const planOnlyStucco =
    String(
      (measurements as { planImportMode?: string }).planImportMode || ''
    ) === 'selected_trade' &&
    String(
      (measurements as { planImportTradeKey?: string }).planImportTradeKey ||
        ''
    ) === 'stucco';

  useEffect(() => {
    if (!planOnlyStucco) return;
    if (measurements.quickMeasurementUserOverrides?.stuccoStories) return;
    const next = stuccoStoryCountForReview({
      measurements,
      planFacts: measurements.planFacts as Record<string, unknown> | null,
      provenanceEntry:
        measurements.measurementProvenance?.stuccoStories ??
        measurements.quickMeasurementSources?.stuccoStories,
    });
    if (next == null) return;
    const current = parseStuccoMeasurement(measurements.stuccoStories);
    if (current === next) return;
    setMeasurements(prev => {
      if (prev.quickMeasurementUserOverrides?.stuccoStories) return prev;
      const previous = parseStuccoMeasurement(prev.stuccoStories);
      if (previous === next) return prev;
      return { ...prev, stuccoStories: String(next) };
    });
  }, [measurements, planOnlyStucco, setMeasurements]);

  const stuccoWallCarryAttempted = useRef(false);
  useEffect(() => {
    if (!planOnlyStucco || stuccoWallCarryAttempted.current) return;
    const carried = stuccoWallAreaCarriedIntoConfirmScope({
      measurements,
    });
    const grossPresent =
      Number(String(measurements.stuccoGrossWallSqft ?? '').replace(/,/g, '')) >
      0;
    const netPresent =
      Number(String(measurements.stuccoNetWallSqft ?? '').replace(/,/g, '')) >
      0;
    if (!carried && !grossPresent && !netPresent) return;
    stuccoWallCarryAttempted.current = true;
    if (!carried) return;
    setMeasurements(prev => {
      const next = stuccoWallAreaCarriedIntoConfirmScope({
        measurements: prev,
      });
      if (!next) return prev;
      return { ...prev, ...next };
    });
  }, [measurements, planOnlyStucco, setMeasurements]);

  const updateMeasurement = (
    key: keyof ScopeMeasurementsInputExtended,
    value: string
  ) => {
    setMeasurements(prev => {
      const next = { ...prev, [key]: value };
      const stuccoKeys = new Set([
        'stuccoGrossWallSqft',
        'stuccoWindowDoorOpeningSqft',
        'stuccoGarageOpeningSqft',
        'stuccoOtherFinishDeductionSqft',
      ]);
      if (stuccoKeys.has(String(key))) {
        return { ...next, ...reconcileStuccoNetWall(next) };
      }
      return next;
    });
  };

  const hasMeasurement = (key: string) =>
    parseStuccoMeasurement((measurements as Record<string, unknown>)[key]) > 0;
  const netWall = parseStuccoMeasurement(measurements.stuccoNetWallSqft);
  const grossWall = parseStuccoMeasurement(measurements.stuccoGrossWallSqft);
  const showWindowOpenings = hasMeasurement('stuccoWindowDoorOpeningSqft');
  const showGarageOpenings = hasMeasurement('stuccoGarageOpeningSqft');
  const showOtherDeductions = hasMeasurement('stuccoOtherFinishDeductionSqft');
  const showSoffits = hasMeasurement('stuccoSoffitSqft');
  const showParapets = hasMeasurement('stuccoParapetSqft');
  const showFoamTrim = hasMeasurement('stuccoFoamTrimLf');
  const showControlJoints = hasMeasurement('stuccoControlJointLf');
  const showAccessArea = hasMeasurement('stuccoAccessAffectedSqft');
  const showRepairArea = hasMeasurement('stuccoRepairAffectedSqft');
  const showAddons =
    showSoffits || showParapets || showFoamTrim || showControlJoints;
  const showAccessExtras = showAccessArea || showRepairArea;
  const newHousePlanExport =
    String(
      (measurements as { planImportMode?: string }).planImportMode || ''
    ) === 'selected_trade' &&
    String(
      (measurements as { planImportTradeKey?: string }).planImportTradeKey ||
        ''
    ) === 'stucco';
  const showStoryFields =
    newHousePlanExport ||
    Boolean(
      (measurements as { planImportFingerprint?: string }).planImportFingerprint
    ) ||
    hasMeasurement('stuccoStories') ||
    hasMeasurement('stuccoWallHeightFt');
  const notedSystems = new Set<string>(stuccoInstallSystemIds(notes));
  if (
    systemChoiceId &&
    STUCCO_SYSTEM_OPTIONS.some(option => option.id === systemChoiceId)
  ) {
    notedSystems.add(systemChoiceId);
  }
  const systemOptions = STUCCO_SYSTEM_OPTIONS.filter(
    option =>
      notedSystems.has(option.id) &&
      !(newHousePlanExport && option.id === 'finish_only')
  );

  return (
    <View style={{ gap: 12 }}>
      <View style={[styles.qmPanel, panelStyle]}>
        <TouchableOpacity
          onPress={() => setWallExpanded(value => !value)}
          activeOpacity={0.75}
        >
          <Text
            style={[
              styles.qmPanelTitle,
              { color: darkMode ? '#cbd5e1' : '#475569' },
            ]}
          >
            Stucco wall takeoff {wallExpanded ? '⌃' : '⌄'}
          </Text>
          <Text
            style={[
              styles.qmPanelCaption,
              { color: darkMode ? '#d7e1f0' : '#64748b', marginTop: 2 },
            ]}
          >
            {wallExpanded
              ? 'Tap to collapse card'
              : grossWall > 0
                ? 'Entered · tap to expand card'
                : 'Tap to expand card'}
          </Text>
        </TouchableOpacity>
        {wallExpanded ? (
          <>
            <Text
              style={[
                styles.qmPanelCaption,
                { color: darkMode ? '#d7e1f0' : '#64748b', marginTop: 10 },
              ]}
            >
              Pick the system, then enter the exterior wall area. Scaffolding
              is included in the price.
            </Text>
            <View style={{ gap: 8, marginTop: 4 }}>
              {systemOptions.map(option => {
                const selected = systemChoiceId === option.id;
                return (
                  <TouchableOpacity
                    key={option.id}
                    activeOpacity={0.85}
                    disabled={applying}
                    onPress={() =>
                      onSystemChoice?.(selected ? null : option.id)
                    }
                    style={{
                      borderWidth: 1,
                      borderRadius: 10,
                      paddingHorizontal: 12,
                      paddingVertical: 12,
                      alignItems: 'center',
                      borderColor: selected
                        ? '#34d399'
                        : darkMode
                          ? 'rgba(255,255,255,0.22)'
                          : Colors.line,
                      backgroundColor: selected
                        ? 'rgba(52, 211, 153, 0.12)'
                        : darkMode
                          ? '#3A3A3C'
                          : '#F4F4F5',
                    }}
                  >
                    <Text
                      style={{
                        color: selected
                          ? '#34d399'
                          : darkMode
                            ? '#F5F7FA'
                            : Colors.text,
                        fontSize: 14,
                        fontWeight: '700',
                        textAlign: 'center',
                      }}
                    >
                      {option.label}
                    </Text>
                    <Text
                      style={{
                        color: selected
                          ? '#6ee7b7'
                          : darkMode
                            ? '#d7e1f0'
                            : '#64748b',
                        fontSize: 12,
                        lineHeight: 16,
                        marginTop: 2,
                        textAlign: 'center',
                      }}
                    >
                      {option.detail}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <QmSqftMeasurementRow
              label='Exterior wall area'
              helperText='This is the area the Stucco card prices.'
              value={stuccoMeasurementInputValue(measurements.stuccoGrossWallSqft)}
              placeholder='Enter'
              unitLabel='sqft'
              onChangeText={value =>
                updateMeasurement('stuccoGrossWallSqft', value)
              }
              applying={applying}
              darkMode={darkMode}
              Colors={Colors}
              highlighted={!hasMeasurement('stuccoGrossWallSqft')}
            />
            {showWindowOpenings ? (
              <QmSqftMeasurementRow
                label='Window & door openings'
                helperText='Combined window and door opening area to deduct.'
                value={stuccoMeasurementInputValue(
                  measurements.stuccoWindowDoorOpeningSqft
                )}
                placeholder='Enter'
                unitLabel='sqft'
                onChangeText={value =>
                  updateMeasurement('stuccoWindowDoorOpeningSqft', value)
                }
                applying={applying}
                darkMode={darkMode}
                Colors={Colors}
              />
            ) : null}
            {showGarageOpenings ? (
              <QmSqftMeasurementRow
                label='Garage door openings'
                helperText='Garage opening area to deduct from gross wall area.'
                value={stuccoMeasurementInputValue(
                  measurements.stuccoGarageOpeningSqft
                )}
                placeholder='Enter'
                unitLabel='sqft'
                onChangeText={value =>
                  updateMeasurement('stuccoGarageOpeningSqft', value)
                }
                applying={applying}
                darkMode={darkMode}
                Colors={Colors}
              />
            ) : null}
            {showOtherDeductions ? (
              <QmSqftMeasurementRow
                label='Other finish deductions'
                helperText='Stone, brick, siding, panels, or other areas not receiving stucco.'
                value={stuccoMeasurementInputValue(
                  measurements.stuccoOtherFinishDeductionSqft
                )}
                placeholder='Enter'
                unitLabel='sqft'
                onChangeText={value =>
                  updateMeasurement('stuccoOtherFinishDeductionSqft', value)
                }
                applying={applying}
                darkMode={darkMode}
                Colors={Colors}
              />
            ) : null}
            {showWindowOpenings ||
            showGarageOpenings ||
            showOtherDeductions ||
            (grossWall > 0 && netWall > 0 && Math.abs(netWall - grossWall) > 0.05) ? (
            <QmSqftMeasurementRow
              label='Net stucco wall area'
              helperText='Gross wall area minus opening deductions. This is the area the Stucco card prices.'
              value={stuccoMeasurementInputValue(measurements.stuccoNetWallSqft)}
              placeholder='Calculated'
              unitLabel='sqft'
              onChangeText={value =>
                updateMeasurement('stuccoNetWallSqft', value)
              }
              applying={applying}
              darkMode={darkMode}
              Colors={Colors}
            />
            ) : null}
          </>
        ) : null}
      </View>

      {wallExpanded && showAddons ? (
        <>
          <View style={[styles.qmPanel, panelStyle]}>
            <TouchableOpacity
              onPress={() => setAddonsExpanded(value => !value)}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.qmPanelCaption,
                  {
                    color: darkMode ? '#cbd5e1' : Colors.text,
                    fontWeight: '700',
                  },
                ]}
              >
                Add-ons & architectural details {addonsExpanded ? '⌃' : '⌄'}
              </Text>
              <Text
                style={[
                  styles.qmPanelCaption,
                  { color: darkMode ? '#d7e1f0' : '#64748b', marginTop: 2 },
                ]}
              >
                Soffits, parapets, foam trim, and control joints.
              </Text>
            </TouchableOpacity>
            {addonsExpanded ? (
              <>
                {showSoffits ? (
                  <QmSqftMeasurementRow
                    label='Soffits / stucco ceilings'
                    helperText='Soffit or stucco ceiling area priced separately from wall area.'
                    value={stuccoMeasurementInputValue(
                      measurements.stuccoSoffitSqft
                    )}
                    placeholder='Enter'
                    unitLabel='sqft'
                    onChangeText={value =>
                      updateMeasurement('stuccoSoffitSqft', value)
                    }
                    applying={applying}
                    darkMode={darkMode}
                    Colors={Colors}
                  />
                ) : null}
                {showParapets ? (
                  <QmSqftMeasurementRow
                    label='Parapets / raised walls'
                    helperText='Parapet or raised wall stucco area.'
                    value={stuccoMeasurementInputValue(
                      measurements.stuccoParapetSqft
                    )}
                    placeholder='Enter'
                    unitLabel='sqft'
                    onChangeText={value =>
                      updateMeasurement('stuccoParapetSqft', value)
                    }
                    applying={applying}
                    darkMode={darkMode}
                    Colors={Colors}
                  />
                ) : null}
                {showFoamTrim ? (
                  <QmSqftMeasurementRow
                    label='Foam trim / architectural bands'
                    helperText='Linear foam trim or banding.'
                    value={stuccoMeasurementInputValue(
                      measurements.stuccoFoamTrimLf
                    )}
                    placeholder='Enter'
                    unitLabel='LF'
                    onChangeText={value =>
                      updateMeasurement('stuccoFoamTrimLf', value)
                    }
                    applying={applying}
                    darkMode={darkMode}
                    Colors={Colors}
                  />
                ) : null}
                {showControlJoints ? (
                  <QmSqftMeasurementRow
                    label='Control / expansion joints'
                    helperText='Linear control or expansion joint length.'
                    value={stuccoMeasurementInputValue(
                      measurements.stuccoControlJointLf
                    )}
                    placeholder='Enter'
                    unitLabel='LF'
                    onChangeText={value =>
                      updateMeasurement('stuccoControlJointLf', value)
                    }
                    applying={applying}
                    darkMode={darkMode}
                    Colors={Colors}
                  />
                ) : null}
              </>
            ) : null}
          </View>
        </>
      ) : null}

      {wallExpanded && (showAccessExtras || showStoryFields) ? (
        <>
          <View style={[styles.qmPanel, panelStyle]}>
            <TouchableOpacity
              onPress={() => setAccessExpanded(value => !value)}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.qmPanelCaption,
                  {
                    color: darkMode ? '#cbd5e1' : Colors.text,
                    fontWeight: '700',
                  },
                ]}
              >
                {showAccessExtras
                  ? `Access & site conditions ${accessExpanded ? '⌃' : '⌄'}`
                  : `From the plan ${accessExpanded ? '⌃' : '⌄'}`}
              </Text>
              <Text
                style={[
                  styles.qmPanelCaption,
                  { color: darkMode ? '#d7e1f0' : '#64748b', marginTop: 2 },
                ]}
              >
                {showAccessExtras
                  ? 'Scaffolding is included in the system price. Access and repair areas are separate.'
                  : 'Scaffolding is included in the price. Two-story access adds $1.00/sqft. Three-story access adds $2.00/sqft.'}
              </Text>
            </TouchableOpacity>
            {accessExpanded ? (
              <>
                <QmSqftMeasurementRow
                  label='Stories'
                  helperText='Scaffolding is included. One story stays in the system rate. Two-story access adds $1.00/sqft. Three-story access adds $2.00/sqft.'
                  value={stuccoMeasurementInputValue(measurements.stuccoStories)}
                  placeholder='1'
                  unitLabel='story'
                  onChangeText={value => {
                    setMeasurements(prev => ({
                      ...prev,
                      stuccoStories: value,
                      quickMeasurementUserOverrides: {
                        ...(prev.quickMeasurementUserOverrides || {}),
                        stuccoStories: true,
                      },
                      quickMeasurementSources: {
                        ...(prev.quickMeasurementSources || {}),
                        stuccoStories: 'user_entered',
                      },
                    }));
                    onStoriesChange?.();
                  }}
                  applying={applying}
                  darkMode={darkMode}
                  Colors={Colors}
                  highlighted={!hasMeasurement('stuccoStories')}
                />
                <QmSqftMeasurementRow
                  label='Typical wall height / story'
                  helperText='From the plan. Plate height does not add a separate price.'
                  value={stuccoMeasurementInputValue(measurements.stuccoWallHeightFt)}
                  placeholder='Enter'
                  unitLabel='ft'
                  onChangeText={value =>
                    updateMeasurement('stuccoWallHeightFt', value)
                  }
                  applying={applying}
                  darkMode={darkMode}
                  Colors={Colors}
                  highlighted={!hasMeasurement('stuccoWallHeightFt')}
                />
                {showAccessExtras ? (
                  <>
                    {showAccessArea ? (
                      <QmSqftMeasurementRow
                        label='Access-affected area'
                        helperText='Wall area requiring special access, staging, or protection.'
                        value={stuccoMeasurementInputValue(
                          measurements.stuccoAccessAffectedSqft
                        )}
                        placeholder='Enter'
                        unitLabel='sqft'
                        onChangeText={value =>
                          updateMeasurement('stuccoAccessAffectedSqft', value)
                        }
                        applying={applying}
                        darkMode={darkMode}
                        Colors={Colors}
                      />
                    ) : null}
                    {showRepairArea ? (
                      <QmSqftMeasurementRow
                        label='Localized repair area'
                        helperText='Patch or repair-only stucco area priced separately from full system work.'
                        value={stuccoMeasurementInputValue(
                          measurements.stuccoRepairAffectedSqft
                        )}
                        placeholder='Enter'
                        unitLabel='sqft'
                        onChangeText={value =>
                          updateMeasurement('stuccoRepairAffectedSqft', value)
                        }
                        applying={applying}
                        darkMode={darkMode}
                        Colors={Colors}
                      />
                    ) : null}
                  </>
                ) : null}
              </>
            ) : null}
            <TouchableOpacity
              onPress={() => setWallExpanded(false)}
              activeOpacity={0.75}
              style={{
                marginTop: 12,
                paddingTop: 10,
                borderTopWidth: 1,
                borderTopColor: darkMode
                  ? 'rgba(255,255,255,0.12)'
                  : Colors.line,
              }}
            >
              <Text
                style={[
                  styles.qmPanelCaption,
                  {
                    color: darkMode ? '#d7e1f0' : '#64748b',
                    textAlign: 'center',
                  },
                ]}
              >
                Collapse card ⌃
              </Text>
            </TouchableOpacity>
          </View>
        </>
      ) : null}
    </View>
  );
}

export function QmSimpleTradeScopePanels({
  scopeKey,
  measurements,
  setMeasurements,
  notes,
  condensed = false,
  onScopeSelectionChange,
  applying,
  darkMode,
  Colors,
}: {
  scopeKey: SimpleTradeScopeKey;
  measurements: ScopeMeasurementsInputExtended;
  setMeasurements: React.Dispatch<
    React.SetStateAction<ScopeMeasurementsInputExtended>
  >;
  notes?: string | null;
  condensed?: boolean;
  onScopeSelectionChange?: (measurements: Record<string, unknown>) => void;
  applying: boolean;
  darkMode: boolean;
  Colors: Colors;
}) {
  const spec = simpleTradeSpec(scopeKey);
  const [equipmentExpanded, setEquipmentExpanded] = useState(false);
  const hvacNotes = String(notes || '');
  const existingHvacRemovalMentioned =
    /\b(?:remove|removing|removal|demo|demolish|replace|replacing)\b[^.;\n]{0,80}\b(?:existing\s+)?hvac\b/i.test(
      hvacNotes
    );
  const existingDuctworkRemovalMentioned =
    /\b(?:remove|removing|removal|demo|demolish|replace|replacing)\b[^.;\n]{0,80}\b(?:existing\s+)?ductwork\b/i.test(
      hvacNotes
    );
  const resolvedHvacSelections =
    scopeKey === 'hvac'
      ? (() => {
          const measurementBackedSelections = [
            ['ductwork', 'hvacDuctworkLf'],
            ['thermostat', 'hvacThermostatCount'],
            ['registers', 'hvacSupplyRegisterCount'],
            ['returns', 'hvacReturnGrilleCount'],
            ['ventilation', 'hvacVentilationCount'],
          ]
            .filter(([, field]) =>
              hvacFieldHasTakeoffEvidence(
                measurements as Record<string, unknown>,
                field
              )
            )
            .map(([optionId]) => optionId);
          return Array.from(
            new Set([
              ...resolveHvacTradeScopeSelections(
                measurements as Record<string, unknown>,
                hvacNotes
              ),
              ...measurementBackedSelections,
            ])
          );
        })()
      : [];
  const [localHvacSelections, setLocalHvacSelections] = useState<
    string[] | null
  >(null);
  useEffect(() => {
    if (scopeKey !== 'hvac' || !localHvacSelections) return;
    const parentSelections = resolveHvacTradeScopeSelections(
      measurements as Record<string, unknown>,
      hvacNotes
    );
    if (
      parentSelections.length === localHvacSelections.length &&
      parentSelections.every(selection =>
        localHvacSelections.includes(selection)
      )
    ) {
      setLocalHvacSelections(null);
    }
  }, [scopeKey, measurements, localHvacSelections, hvacNotes]);
  const deckRemovalSelectionIds = (() => {
    if (scopeKey !== 'deck_patio') return [] as string[];
    const pieces = Array.isArray(measurements.scopeFoundPieces)
      ? measurements.scopeFoundPieces.map(piece => String(piece))
      : [];
    return [
      pieces.includes('deck_surface') ? 'deck_surface_demo' : null,
      pieces.includes('deck_railing') ? 'deck_railing_demo' : null,
      pieces.includes('deck_stairs') ? 'deck_stairs_demo' : null,
    ].filter((id): id is string => Boolean(id));
  })();
  const selections =
    scopeKey === 'hvac'
      ? localHvacSelections || resolvedHvacSelections
      : scopeKey === 'deck_patio'
        ? collapseDeckSurfaceSelections(
            Array.from(
              new Set([
                ...(measurements.tradeScopeSelections?.[scopeKey] || []),
                ...deckRemovalSelectionIds,
              ])
            )
          )
        : measurements.tradeScopeSelections?.[scopeKey] || [];
  useEffect(() => {
    if (scopeKey !== 'deck_patio') return;
    const saved = measurements.tradeScopeSelections?.deck_patio || [];
    const missingSelection = deckRemovalSelectionIds.some(id => !saved.includes(id));
    const deckArea = Number(String(measurements.deckSqft ?? '').replace(/,/g, ''));
    const savedDemo = Number(String(measurements.deckDemoSqft ?? '').replace(/,/g, ''));
    const needsDemoArea =
      deckRemovalSelectionIds.includes('deck_surface_demo') &&
      deckArea > 0 &&
      !(savedDemo > 0);
    const surfaceCleared =
      measurements.quickMeasurementUserOverrides?.deckSurfaceChoiceCleared ===
      true;
    const hasSurface =
      saved.includes('wood_deck') || saved.includes('composite_deck');
    const needsSurface =
      !surfaceCleared &&
      !hasSurface &&
      notesDescribeDedicatedDeckJob(notes) &&
      notesRequestDeckSurface(notes);
    if (!missingSelection && !needsDemoArea && !needsSurface) return;
    const surfaceId =
      selectedDeckInstallMaterial(notes, {
        tradeScopeSelections: { deck_patio: saved },
      }) === 'wood'
        ? 'wood_deck'
        : 'composite_deck';
    setMeasurements(prev => {
      const current = prev.tradeScopeSelections?.deck_patio || [];
      const alreadyHasSurface =
        current.includes('wood_deck') || current.includes('composite_deck');
      const nextSelections = Array.from(
        new Set([
          ...current,
          ...deckRemovalSelectionIds,
          ...(needsSurface && !alreadyHasSurface ? [surfaceId] : []),
        ])
      );
      return {
        ...prev,
        tradeScopeSelections: {
          ...(prev.tradeScopeSelections || {}),
          deck_patio: nextSelections,
        },
        ...(needsDemoArea ? { deckDemoSqft: deckArea } : {}),
      };
    });
  }, [
    scopeKey,
    notes,
    deckRemovalSelectionIds,
    measurements.tradeScopeSelections?.deck_patio,
    measurements.deckSqft,
    measurements.deckDemoSqft,
    measurements.quickMeasurementUserOverrides?.deckSurfaceChoiceCleared,
    setMeasurements,
  ]);
  const toggle = (id: string, _canonicalId: string) => {
    // Selections are option IDs, not canonical checklist IDs. Multiple
    // options may intentionally converge on one checklist item (for example,
    // Roofing underlayment and Ice & water shield).
    if (
      scopeKey === 'hvac' &&
      (HVAC_SCOPE_DISTRIBUTION_OPTION_IDS as readonly string[]).includes(id) &&
      hvacPlanInstallIncludesDistribution(
        measurements as Record<string, unknown>,
        selections
      )
    ) {
      return;
    }
    const selected = selections.includes(id);
    const surfaceToggle =
      scopeKey === 'deck_patio' &&
      (id === 'composite_deck' || id === 'wood_deck');
    const next = surfaceToggle
      ? nextDeckSurfaceSelections(selections, id)
      : selected
        ? selections.filter(value => value !== id)
        : [...selections, id];
    const clearingSurface =
      surfaceToggle &&
      selected &&
      !selections.some(
        value =>
          (value === 'wood_deck' || value === 'composite_deck') && value !== id
      );
    if (scopeKey === 'hvac') {
      setLocalHvacSelections(next);
    }
    const quickMeasurementUserOverrides = {
      ...(measurements.quickMeasurementUserOverrides || {}),
    };
    if (surfaceToggle) {
      if (clearingSurface) {
        quickMeasurementUserOverrides.deckSurfaceChoiceCleared = true;
      } else {
        delete quickMeasurementUserOverrides.deckSurfaceChoiceCleared;
      }
    }
    if (scopeKey === 'hvac' && id === HVAC_CAPACITY_OPTION_ID) {
      if (selected) {
        quickMeasurementUserOverrides.hvacSystemTons = true;
      } else {
        delete quickMeasurementUserOverrides.hvacSystemTons;
      }
    }
    const withSelections = {
      ...measurements,
      tradeScopeSelections: {
        ...(measurements.tradeScopeSelections || {}),
        [scopeKey]: next.length ? next : null,
      },
      quickMeasurementUserOverrides,
    };
    const measured =
      scopeKey === 'hvac'
        ? (applyHvacScopeMeasurements(
            withSelections,
            {
              // Notes identify the component, but an unnumbered component
              // still needs a contractor-confirmed quantity. Only seed a
              // default count when this is a manual, note-free selection.
              seedUnquantified:
                !/\b(?:hvac|heating|cooling|furnace|heat[\s-]*pumps?|air\s*condition(?:er|ing)?|ductwork|registers?|return\s+grilles?|thermostats?)\b/i.test(
                  hvacNotes
                ),
            }
          ) as ScopeMeasurementsInputExtended)
        : withSelections;
    const updated =
      scopeKey === 'hvac' && selected && id === 'ventilation'
        ? (releaseHvacVentilationSelection(
            measured as Record<string, unknown>
          ) as ScopeMeasurementsInputExtended)
        : measured;
    setMeasurements(updated);
    onScopeSelectionChange?.(updated);
  };

  const activeOptions = spec.options.filter(option => {
    if (scopeKey === 'hvac') {
      return hvacScopeChipActive(option, selections, measurements, spec);
    }
    return simpleTradeOptionActive(spec, option, selections, notes);
  });
  const measurementRows = new Map<string, (typeof spec.options)[number]>();
  for (const option of activeOptions) {
    if (option.measurementKey && !measurementRows.has(option.measurementKey)) {
      measurementRows.set(option.measurementKey, option);
    }
  }
  const isOptionalAddOn = (optionId: string) =>
    scopeKey === 'hvac' &&
    (HVAC_OPTIONAL_ADDON_OPTION_IDS as readonly string[]).includes(optionId);
  const optionalOptions = spec.options.filter(option =>
    isOptionalAddOn(option.id)
  );
  const optionById = new Map(spec.options.map(option => [option.id, option]));

  const hvacPanelColors = hvacScopePanelColors(darkMode, Colors);

  const getHvacOptionState = (option: (typeof spec.options)[number]) => {
    const active = hvacScopeChipActive(option, selections, measurements, spec);
    const reviewState = hvacScopeChipReviewState(
      measurements,
      option,
      selections,
      notes
    );
    const quantityCaption =
      formatHvacScopeChipQuantity(measurements, option, selections) ??
      formatHvacOptionalAddOnChipCaption(measurements, option);
    const measurementHelper = hvacScopePanelMeasurementHelper(
      measurements,
      option,
      selections,
      notes
    );
    const removalHelper =
      option.id === HVAC_SYSTEMS_OPTION_ID && existingHvacRemovalMentioned
        ? 'Existing HVAC system removal is included in this scope.'
        : option.id === 'ductwork' && existingDuctworkRemovalMentioned
          ? 'Existing ductwork removal is included in this scope.'
          : null;
    return {
      active,
      reviewState,
      quantityCaption,
      measurementHelper: [measurementHelper, removalHelper]
        .filter(Boolean)
        .join(' '),
    };
  };

  const renderHvacSelectedCard = (option: (typeof spec.options)[number]) => {
    const { active, reviewState, quantityCaption, measurementHelper } =
      getHvacOptionState(option);
    const needsReview = reviewState === 'needs_confirmation';
    const needsQuantity = hvacScopeChipNeedsQuantity(
      measurements,
      option,
      selections,
      notes
    );
    const needsCapacityQuantity =
      option.id === HVAC_CAPACITY_OPTION_ID && needsQuantity;
    const statusPillLabel = needsReview
      ? 'Needs review'
      : needsQuantity
        ? 'Needs quantity'
        : quantityCaption
          ? 'In bid'
          : 'In bid';
    const statusPillColors =
      needsReview || needsCapacityQuantity
        ? {
            backgroundColor: 'rgba(251, 191, 36, 0.12)',
            color: '#fbbf24',
          }
        : needsQuantity
          ? {
              backgroundColor: darkMode
                ? 'rgba(255, 255, 255, 0.1)'
                : '#e2e8f0',
              color: darkMode ? '#cbd5e1' : '#475569',
            }
          : {
              backgroundColor: darkMode
                ? 'rgba(52, 211, 153, 0.12)'
                : 'rgba(52, 211, 153, 0.14)',
              color: '#34d399',
            };
    return (
      <View
        key={option.id}
        style={[
          styles.hvacScopeSelectedCard,
          {
            borderColor: 'transparent',
            backgroundColor: 'transparent',
          },
        ]}
      >
        <View style={styles.hvacScopeCardHeader}>
          <Text
            style={[
              styles.hvacScopeSelectedTitle,
              { color: darkMode ? '#f8fafc' : Colors.text },
            ]}
          >
            {option.label}
          </Text>
          <View
            style={[
              styles.hvacScopeStatusPill,
              { backgroundColor: statusPillColors.backgroundColor },
            ]}
          >
            <Text
              style={[
                styles.hvacScopeStatusPillText,
                { color: statusPillColors.color },
              ]}
            >
              {statusPillLabel}
            </Text>
          </View>
        </View>
        {measurementHelper ? (
          <Text
            style={[
              styles.hvacScopeSelectedSubtext,
              { color: hvacPanelColors.captionColor },
            ]}
          >
            {option.id === 'ventilation'
              ? '1 ERV or HRV = 1 each. Not a bath exhaust fan.'
              : measurementHelper}
          </Text>
        ) : null}
        {active &&
        option.measurementKey &&
        option.id !== HVAC_CAPACITY_OPTION_ID &&
        !needsQuantity &&
        !needsReview &&
        quantityCaption == null ? null : active &&
          option.id === HVAC_CAPACITY_OPTION_ID ? (
          <View style={[styles.choiceWrap, { marginTop: 10 }]}>
            {HVAC_SYSTEM_TONNAGE_TIERS.map(tons => {
              const selected =
                Number(hvacScopePanelMeasurementValue(option, measurements)) ===
                tons;
              return (
                <QmScopeChoiceChip
                  key={String(tons)}
                  label={`${tons} ton`}
                  active={selected}
                  reviewState={selected ? 'confirmed' : 'idle'}
                  onPress={() =>
                    setMeasurements(
                      prev =>
                        applyHvacScopePanelMeasurementEdit(
                          prev,
                          option,
                          selected ? '' : String(tons)
                        ) as ScopeMeasurementsInputExtended
                    )
                  }
                  disabled={applying}
                  darkMode={darkMode}
                  Colors={Colors}
                  compact
                />
              );
            })}
          </View>
        ) : active &&
          option.id === HVAC_SYSTEMS_OPTION_ID &&
          hvacPlanImportAssumesSystemScope(
            measurements as Record<string, unknown>
          ) ? null : active && option.measurementKey ? (
          <QmSqftMeasurementRow
            label={
              option.id === HVAC_SYSTEMS_OPTION_ID
                ? 'System count'
                : option.id === HVAC_CAPACITY_OPTION_ID
                  ? 'System capacity'
                  : option.id === 'ventilation'
                    ? 'Units'
                    : `${option.label} quantity`
            }
            helperText={
              needsReview
                ? 'Low-confidence plan read — confirm before pricing.'
                : needsQuantity
                  ? 'Enter a quantity to include this in pricing.'
                  : option.id === 'ventilation'
                    ? HVAC_VENTILATION_QUANTITY_HELPER
                    : undefined
            }
            value={hvacScopePanelMeasurementValue(option, measurements)}
            placeholder='Enter'
            unitLabel={option.unit}
            onChangeText={value =>
              setMeasurements(
                prev =>
                  applyHvacScopePanelMeasurementEdit(
                    prev,
                    option,
                    value
                  ) as ScopeMeasurementsInputExtended
              )
            }
            applying={applying}
            darkMode={darkMode}
            Colors={Colors}
            highlighted={needsReview || needsCapacityQuantity}
            compact
            reserveHelperSpace
          />
        ) : quantityCaption ? (
          <View
            style={[
              styles.hvacScopeQuantityPill,
              {
                borderColor: hvacPanelColors.borderColor,
                backgroundColor: darkMode
                  ? 'rgba(255,255,255,0.04)'
                  : '#ffffff',
              },
            ]}
          >
            <Text
              style={{
                color: darkMode ? '#f8fafc' : Colors.text,
                fontSize: 14,
                fontWeight: '700',
              }}
            >
              {quantityCaption}
            </Text>
          </View>
        ) : null}
        {option.id === 'ventilation' ? (
          <TouchableOpacity
            onPress={() => toggle(option.id, option.canonicalId)}
            disabled={applying}
            activeOpacity={0.75}
            accessibilityLabel='Remove whole-house ventilation from bid'
            style={styles.hvacVentilationRemove}
          >
            <Text style={styles.hvacVentilationRemoveText}>Remove from bid</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  const renderHvacStackedChip = (option: (typeof spec.options)[number]) => {
    const { active, reviewState, quantityCaption } = getHvacOptionState(option);
    const optionalAddOn = isOptionalAddOn(option.id);
    return (
      <View key={option.id} style={styles.hvacScopeEquipmentCell}>
        <QmScopeChoiceChip
          label={option.label}
          active={active}
          reviewState={active ? 'confirmed' : reviewState}
          quantityCaption={active ? null : quantityCaption}
          onPress={() => toggle(option.id, option.canonicalId)}
          disabled={applying}
          darkMode={darkMode}
          Colors={Colors}
          style={[
            styles.choiceChipStackedHvac,
            optionalAddOn
              ? {
                  backgroundColor: darkMode
                    ? 'rgba(255, 255, 255, 0.14)'
                    : '#e2e8f0',
                  borderColor: darkMode
                    ? 'rgba(255, 255, 255, 0.2)'
                    : '#cbd5e1',
                }
              : null,
          ]}
          stacked
        />
      </View>
    );
  };

  const renderHvacIdleChip = (option: (typeof spec.options)[number]) => {
    const { active, reviewState, quantityCaption } = getHvacOptionState(option);
    return (
      <View key={option.id} style={styles.hvacScopeIdleCell}>
        <QmScopeChoiceChip
          label={option.label}
          active={active}
          reviewState={active ? 'confirmed' : reviewState}
          quantityCaption={active ? null : quantityCaption}
          onPress={() => toggle(option.id, option.canonicalId)}
          disabled={applying}
          darkMode={darkMode}
          Colors={Colors}
          style={styles.choiceChipCompact}
          compact
          labelFontSize={13}
        />
      </View>
    );
  };

  const hvacOptionVisible = (option: (typeof spec.options)[number]) => {
    if (
      hvacNotesDropSystemPackage(notes) &&
      (option.id === HVAC_SYSTEMS_OPTION_ID ||
        option.id === HVAC_CAPACITY_OPTION_ID)
    ) {
      return false;
    }
    if (
      option.id === 'ventilation' &&
      !hvacWholeHouseVentilationButtonVisible(
        measurements as Record<string, unknown>,
        notes
      )
    ) {
      return false;
    }
    return (
      !condensed ||
      hvacScopeOptionMentionedInNotes(option.id, notes) ||
      selections.includes(option.id)
    );
  };

  const hvacOptionsForIds = (optionIds: readonly string[]) =>
    optionIds
      .map(id => optionById.get(id))
      .filter(
        (option): option is (typeof spec.options)[number] =>
          Boolean(option) && hvacOptionVisible(option)
      );

  const hvacSelectedForIds = (optionIds: readonly string[]) =>
    hvacOptionsForIds(optionIds).filter(
      option => getHvacOptionState(option).active
    );

  const hvacIdleForIds = (optionIds: readonly string[]) =>
    hvacOptionsForIds(optionIds).filter(
      option => !getHvacOptionState(option).active
    );

  const equipmentChipOptions = hvacOptionsForIds(HVAC_EQUIPMENT_OPTION_IDS);
  const equipmentIdleOptions = hvacIdleForIds(HVAC_EQUIPMENT_OPTION_IDS);
  const optionalSelected = optionalOptions.filter(
    option => hvacOptionVisible(option) && getHvacOptionState(option).active
  );
  const optionalIdle = optionalOptions.filter(
    option => hvacOptionVisible(option) && !getHvacOptionState(option).active
  );

  const hvacScopeSummary =
    scopeKey === 'hvac'
      ? summarizeHvacScopePanel(measurements as Record<string, unknown>, notes)
      : null;

  const hvacPanelShellStyle = {
    borderColor: hvacPanelColors.borderColor,
    backgroundColor: hvacPanelColors.backgroundColor,
  };

  const renderHvacAddToBidSection = (
    idleOptions: (typeof spec.options)[number][],
    {
      equipmentCollapse = false,
      optionalCaption = false,
      selectedOptions = [],
      showSelectedButtons = false,
    }: {
      equipmentCollapse?: boolean;
      optionalCaption?: boolean;
      selectedOptions?: (typeof spec.options)[number][];
      showSelectedButtons?: boolean;
    } = {}
  ) => {
    const seenOptionIds = new Set<string>();
    const optionOrder = new Map(
      spec.options.map((option, index) => [option.id, index])
    );
    const buttonOptions = (showSelectedButtons
      ? [...selectedOptions, ...idleOptions]
      : idleOptions
    )
      .filter(option => {
        if (seenOptionIds.has(option.id)) return false;
        seenOptionIds.add(option.id);
        return true;
      })
      .sort(
        (a, b) =>
          (optionOrder.get(a.id) ?? 0) - (optionOrder.get(b.id) ?? 0)
      );
    const showEquipmentToggle =
      equipmentCollapse && equipmentChipOptions.length > 0;
    const showGenericIdle = !equipmentCollapse && buttonOptions.length > 0;
    if (!showEquipmentToggle && !showGenericIdle && !optionalCaption)
      return null;

    return (
      <View
        style={[
          styles.hvacScopeAddDivider,
          {
            borderTopColor: darkMode
              ? 'rgba(148,163,184,0.22)'
              : 'rgba(100,116,139,0.18)',
          },
        ]}
      >
        {showGenericIdle ? (
          <>
            <Text
              style={[
                styles.hvacScopeSubPanelAddLabel,
                { color: hvacPanelColors.sectionLabelColor },
              ]}
            >
              {showSelectedButtons ? 'HVAC options' : 'Add to bid'}
            </Text>
            <View style={styles.hvacScopeIdleWrap}>
              {buttonOptions.map(renderHvacIdleChip)}
            </View>
          </>
        ) : null}
        {showEquipmentToggle ? (
          <>
            <TouchableOpacity
              key='equipment-toggle'
              activeOpacity={0.85}
              onPress={() => setEquipmentExpanded(expanded => !expanded)}
              style={[
                styles.hvacScopeCollapseButton,
                {
                  borderColor: darkMode
                    ? 'rgba(148,163,184,0.28)'
                    : 'rgba(100,116,139,0.24)',
                  backgroundColor: darkMode
                    ? 'rgba(255,255,255,0.04)'
                    : '#ffffff',
                  marginBottom: equipmentExpanded ? 10 : 0,
                  marginTop: 2,
                },
              ]}
            >
              <Text
                style={{
                  color: darkMode ? '#e5e7eb' : Colors.text,
                  fontSize: 13,
                  fontWeight: '600',
                }}
              >
                {equipmentExpanded
                  ? 'Hide equipment types'
                  : equipmentIdleOptions.length > 0
                    ? `Add equipment · ${equipmentIdleOptions.length} types`
                    : 'Equipment types'}
              </Text>
              <Text
                style={{
                  color: hvacPanelColors.sectionLabelColor,
                  fontSize: 16,
                  fontWeight: '700',
                }}
              >
                {equipmentExpanded ? '⌃' : '⌄'}
              </Text>
            </TouchableOpacity>
            {equipmentExpanded ? (
              <View style={styles.hvacScopeEquipmentStack}>
                {equipmentChipOptions.map(renderHvacStackedChip)}
              </View>
            ) : null}
          </>
        ) : null}
        {optionalCaption && optionalIdle.length ? (
          <View
            style={
              showEquipmentToggle || showGenericIdle
                ? styles.hvacScopeOptionalBlock
                : undefined
            }
          >
            <Text
              style={[
                styles.hvacScopeSectionLabel,
                {
                  color: hvacPanelColors.sectionLabelColor,
                  marginTop: 0,
                  marginBottom: 6,
                },
              ]}
            >
              Optional
            </Text>
            <Text
              style={[
                styles.hvacScopeSubPanelCaption,
                { color: hvacPanelColors.captionColor, marginBottom: 8 },
              ]}
            >
              Include only when documented or explicitly in this bid.
            </Text>
            <View style={styles.hvacScopeEquipmentStack}>
              {optionalIdle.map(renderHvacStackedChip)}
            </View>
            {(() => {
              const optionalIdleHint = optionalIdle
                .map(option => formatHvacOptionalAddOnIdleHint(option))
                .find(Boolean);
              return optionalIdleHint ? (
                <Text
                  style={[
                    styles.hvacScopeSubPanelCaption,
                    {
                      color: hvacPanelColors.captionColor,
                      marginTop: 8,
                      marginBottom: 0,
                    },
                  ]}
                >
                  {optionalIdleHint}
                </Text>
              ) : null;
            })()}
          </View>
        ) : null}
      </View>
    );
  };

  const renderHvacIncludedChip = (option: (typeof spec.options)[number]) => (
    <View key={option.id} style={styles.hvacScopeIdleCell}>
      <QmScopeChoiceChip
        label={option.label}
        active
        reviewState='confirmed'
        quantityCaption='Included'
        onPress={() => undefined}
        disabled
        darkMode={darkMode}
        Colors={Colors}
        style={styles.choiceChipCompact}
        compact
        labelFontSize={13}
      />
    </View>
  );

  const renderHvacScopeSubPanel = ({
    title,
    caption,
    selectedOptions,
    idleOptions,
    includedOptions = [],
    showSummary = false,
    equipmentCollapse = false,
    includeOptionalAddOns = false,
    borderless = false,
    sectionSeparator = false,
  }: {
    title: string;
    caption: string;
    selectedOptions: (typeof spec.options)[number][];
    idleOptions: (typeof spec.options)[number][];
    includedOptions?: (typeof spec.options)[number][];
    showSummary?: boolean;
    equipmentCollapse?: boolean;
    includeOptionalAddOns?: boolean;
    borderless?: boolean;
    sectionSeparator?: boolean;
  }) => {
    const selectedCards = [
      ...selectedOptions,
      ...(includeOptionalAddOns ? optionalSelected : []),
    ];
    const hasContent =
      selectedCards.length ||
      idleOptions.length ||
      includedOptions.length ||
      optionalIdle.length ||
      (equipmentCollapse && equipmentChipOptions.length > 0);

    if (!hasContent) return null;

    return (
      <View
        key={title}
        style={[
          borderless ? null : styles.qmPanel,
          borderless
            ? styles.hvacScopeSubPanelBorderless
            : styles.hvacScopeSubPanelBordered,
          !borderless ? hvacPanelShellStyle : null,
          sectionSeparator ? styles.hvacScopeSectionSeparator : null,
        ]}
      >
        <Text
          style={[
            styles.hvacScopeSubPanelTitle,
            { color: darkMode ? '#F5F7FA' : Colors.text },
          ]}
        >
          {title}
        </Text>
        <Text
          style={[
            styles.hvacScopeSubPanelCaption,
            { color: hvacPanelColors.captionColor },
          ]}
        >
          {caption}
        </Text>
        {showSummary && hvacScopeSummary ? (
          <Text
            style={[
              styles.hvacScopeSummary,
              {
                color:
                  hvacScopeSummary.needsConfirmationCount > 0
                    ? '#fbbf24'
                    : hvacPanelColors.captionColor,
              },
            ]}
          >
            {hvacScopeSummary.inBidCount === 1 &&
            hvacPlanImportAssumesSystemScope(
              measurements as Record<string, unknown>
            )
              ? '1 system in bid'
              : hvacScopeSummary.inBidCount === 1
                ? '1 item in bid'
                : `${hvacScopeSummary.inBidCount} items in bid`}
            {hvacScopeSummary.needsConfirmationCount > 0
              ? ` · ${hvacScopeSummary.needsConfirmationCount} need confirmation`
              : hvacPlanImportStatesNewBuildSystem(
                    measurements as Record<string, unknown>
                  )
                ? ' · planning price until tonnage is entered'
                : ' · ready for pricing'}
          </Text>
        ) : null}
        {selectedCards.length ? (
          <View style={styles.hvacScopeSelectedList}>
            {selectedCards.map(renderHvacSelectedCard)}
          </View>
        ) : null}
        {includedOptions.length ? (
          <View style={styles.hvacScopeIdleWrap}>
            {includedOptions.map(renderHvacIncludedChip)}
          </View>
        ) : null}
        {renderHvacAddToBidSection(idleOptions, {
          equipmentCollapse,
          optionalCaption: includeOptionalAddOns,
          selectedOptions: equipmentCollapse ? [] : selectedOptions,
          showSelectedButtons: !equipmentCollapse,
        })}
      </View>
    );
  };

  const renderOptionChip = (option: (typeof spec.options)[number]) => {
    const active =
      scopeKey === 'hvac'
        ? hvacScopeChipActive(option, selections, measurements, spec)
        : simpleTradeOptionActive(spec, option, selections, notes);
    const quantityCaption =
      scopeKey === 'hvac'
        ? (formatHvacScopeChipQuantity(measurements, option, selections) ??
          formatHvacOptionalAddOnChipCaption(measurements, option))
        : option.measurementKey && active
          ? (() => {
              const value = Number(
                String(
                  (measurements as Record<string, unknown>)[
                    option.measurementKey!
                  ] ?? ''
                ).replace(/,/g, '')
              );
              if (!(Number.isFinite(value) && value > 0)) return null;
              const unit = String(option.unit || 'each');
              const unitKey = unit.toUpperCase();
              if (unitKey === 'LF') return `${value.toLocaleString()} LF`;
              if (unitKey === 'SQFT') return `${value.toLocaleString()} sqft`;
              if (unitKey === 'EACH' || unitKey === 'EA') {
                return `${Math.round(value).toLocaleString()} each`;
              }
              if (unitKey === 'RUN' || unitKey === 'RUNS' || unitKey === 'FLIGHT' || unitKey === 'FLIGHTS') {
                const count = Math.round(value);
                const flight = unitKey.startsWith('FLIGHT');
                return `${count.toLocaleString()} ${count === 1 ? (flight ? 'flight' : 'run') : flight ? 'flights' : 'runs'}`;
              }
              const shown = Number.isInteger(value) ? Math.round(value) : value;
              return `${shown.toLocaleString()} ${unit}`;
            })()
          : null;
    return (
      <QmScopeChoiceChip
        key={option.id}
        label={option.label}
        active={active}
        reviewState={
          scopeKey === 'hvac'
            ? hvacScopeChipReviewState(measurements, option, selections, notes)
            : 'idle'
        }
        quantityCaption={quantityCaption}
        onPress={() => toggle(option.id, option.canonicalId)}
        disabled={applying}
        darkMode={darkMode}
        Colors={Colors}
      />
    );
  };

  const deckOptionVisible = (optionId: string) => {
    if (scopeKey !== 'deck_patio' || !condensed) return true;
    if (selections.includes(optionId)) return true;
    const pieces = Array.isArray(measurements.scopeFoundPieces)
      ? measurements.scopeFoundPieces.map(piece => String(piece))
      : [];
    if (optionId === 'deck_surface_demo' && pieces.includes('deck_surface')) {
      return true;
    }
    if (optionId === 'deck_railing_demo' && pieces.includes('deck_railing')) {
      return true;
    }
    if (optionId === 'deck_stairs_demo' && pieces.includes('deck_stairs')) {
      return true;
    }
    const noteText = String(notes || '');
    const genericDeck =
      /\bdeck(?:ing)?\b/i.test(noteText) &&
      !/\bcomposite\b|\bwood\s+deck(?:ing)?\b/i.test(noteText);
    if (
      (optionId === 'composite_deck' || optionId === 'wood_deck') &&
      genericDeck
    ) {
      return true;
    }
    const patterns: Record<string, RegExp> = {
      deck_demo:
        /\b(?:remove|removal|demo|demolition|tear[\s-]?out)\b[^.]{0,48}\b(?:existing\s+)?deck\b/i,
      footings: /\bfootings?\b/i,
      deck_framing: /\b(?:frame|framing)\b/i,
      wood_fence: /\bwood\s+fence\b/i,
      vinyl_fence: /\bvinyl\s+fence\b/i,
      chain_link: /\bchain[\s-]?link\b/i,
      composite_deck: /\bcomposite\b/i,
      wood_deck: /\bwood\s+deck(?:ing)?\b/i,
      railings: /\brailings?\b/i,
      gates: /\bgates?\b/i,
      stairs: /\bstairs?\b/i,
    };
    return Boolean(patterns[optionId]?.test(noteText));
  };

  const distributionIncludedInInstall =
    scopeKey === 'hvac' &&
    hvacPlanInstallIncludesDistribution(
      measurements as Record<string, unknown>,
      selections
    );
  const includedDistributionOptions = distributionIncludedInInstall
    ? HVAC_SCOPE_DISTRIBUTION_OPTION_IDS.map(id => optionById.get(id)).filter(
        (option): option is (typeof spec.options)[number] => Boolean(option)
      )
    : [];

  if (scopeKey === 'hvac') {
    return (
      <>
        {renderHvacScopeSubPanel({
          title: 'HVAC scope',
          caption:
            String(
              (measurements as { planImportTradeKey?: string })
                .planImportTradeKey || ''
            ) === 'hvac'
              ? hvacNewBuildScopeCaption(
                  measurements as Record<string, unknown>
                ) ||
                (hvacPlanImportLacksPrintedTonnage(
                  measurements as Record<string, unknown>
                )
                  ? 'Not printed on the plans.'
                  : 'System count and tonnage documented on the plans.')
              : 'Named in the notes.',
          selectedOptions: hvacSelectedForIds([
            HVAC_SYSTEMS_OPTION_ID,
            HVAC_CAPACITY_OPTION_ID,
          ]),
          idleOptions: hvacIdleForIds([
            HVAC_SYSTEMS_OPTION_ID,
            HVAC_CAPACITY_OPTION_ID,
          ]),
          showSummary: true,
          borderless: true,
        })}
        {renderHvacScopeSubPanel({
          title: 'Distribution',
          caption: distributionIncludedInInstall
            ? 'Ductwork, registers, returns, and the thermostat are inside the system price until the plans list them separately.'
            : 'Ductwork, thermostats, and air devices in this bid.',
          selectedOptions: distributionIncludedInInstall
            ? []
            : hvacSelectedForIds(HVAC_SCOPE_DISTRIBUTION_OPTION_IDS),
          idleOptions: distributionIncludedInInstall
            ? []
            : hvacIdleForIds(HVAC_SCOPE_DISTRIBUTION_OPTION_IDS),
          includedOptions: distributionIncludedInInstall
            ? []
            : includedDistributionOptions,
          borderless: true,
          sectionSeparator: true,
        })}
        {renderHvacScopeSubPanel({
          title: hvacWholeHouseVentilationButtonVisible(
            measurements as Record<string, unknown>,
            notes
          )
            ? 'Equipment & add-ons'
            : 'Equipment',
          caption: hvacWholeHouseVentilationButtonVisible(
            measurements as Record<string, unknown>,
            notes
          )
            ? 'Equipment types and optional whole-house ventilation.'
            : 'Equipment types.',
          selectedOptions: hvacSelectedForIds(HVAC_EQUIPMENT_OPTION_IDS),
          idleOptions: equipmentIdleOptions,
          equipmentCollapse: true,
          includeOptionalAddOns: true,
        })}
      </>
    );
  }

  return (
    <View
      style={[
        styles.qmPanel,
        {
          borderColor: darkMode
            ? 'rgba(148,163,184,0.28)'
            : 'rgba(100,116,139,0.24)',
          backgroundColor: darkMode
            ? 'rgba(148,163,184,0.06)'
            : 'rgba(148,163,184,0.05)',
        },
      ]}
    >
      <Text
        style={[
          styles.qmPanelTitle,
          { color: darkMode ? '#F5F7FA' : Colors.text },
        ]}
      >
        {simpleTradeScopePanelTitle(scopeKey, notes)}
      </Text>
      <Text
        style={[
          styles.qmPanelCaption,
          { color: captionColor(darkMode, Colors) },
        ]}
      >
        Select every component included in this bid. Measurements feed the
        corresponding pricing cards.
      </Text>
      <>
        <View style={styles.choiceWrap}>
          {spec.options
            .filter(option => !isOptionalAddOn(option.id))
            .filter(option => deckOptionVisible(option.id))
            .map(renderOptionChip)}
        </View>
        {optionalOptions.length ? (
          <>
            <Text
              style={[
                styles.qmPanelCaption,
                {
                  color: captionColor(darkMode, Colors),
                  marginTop: 4,
                  marginBottom: 8,
                  fontWeight: '700',
                },
              ]}
            >
              Optional add-ons
            </Text>
            <View style={styles.choiceWrap}>
              {optionalOptions.map(renderOptionChip)}
            </View>
          </>
        ) : null}
        {Array.from(measurementRows.values()).map(option => (
          <QmSqftMeasurementRow
            key={option.measurementKey}
            label={`${option.quantityLabel || option.label} quantity`}
            helperText={
              option.measurementHelper ||
              'Enter only the quantity for this selected component.'
            }
            value={String(
              (measurements as Record<string, unknown>)[
                option.measurementKey!
              ] || ''
            )}
            placeholder='Enter'
            unitLabel={
              ['runs', 'flights'].includes(String(option.unit || '').toLowerCase())
                ? Number(
                    String(
                      (measurements as Record<string, unknown>)[
                        option.measurementKey!
                      ] ?? ''
                    ).replace(/,/g, '')
                  ) === 1
                  ? String(option.unit || '').toLowerCase() === 'flights'
                    ? 'flight'
                    : 'run'
                  : option.unit
                : option.unit
            }
            onChangeText={value =>
              setMeasurements(prev => {
                const key = option.measurementKey!;
                const next = { ...prev, [key]: value };
                if (scopeKey !== 'deck_patio') return next;
                return {
                  ...next,
                  quickMeasurementSources: {
                    ...(prev.quickMeasurementSources || {}),
                    [key]: 'user_entered',
                  },
                  quickMeasurementUserOverrides: {
                    ...(prev.quickMeasurementUserOverrides || {}),
                    [key]: true,
                  },
                };
              })
            }
            applying={applying}
            darkMode={darkMode}
            Colors={Colors}
            highlighted
          />
        ))}
      </>
    </View>
  );
}

/** Seed kitchen QM counts on first open when nothing saved yet. */
export function seedKitchenQmFromIntent(
  measurements: Record<string, unknown>,
  params: { notes?: string | null; hasSitePhotos?: boolean }
): Record<string, unknown> {
  const hasSaved =
    readKitchenInstallCounts(measurements).kitchenInstallCabinetCount != null ||
    readKitchenDemoCounts(measurements).kitchenDemoCabinetCount != null ||
    readKitchenDemoCounts(measurements).kitchenDemoBacksplashCount != null ||
    readKitchenDemoCounts(measurements).kitchenDemoIslandCount != null;
  if (hasSaved) return measurements;
  const existing = params.hasSitePhotos
    ? inferExistingKitchenFromNotes(params.notes)
    : emptyKitchenExistingCounts();
  const install = inferKitchenInstallFromIntent({ notes: params.notes });
  const demo = resolveKitchenDemoFromIntent({
    notes: params.notes,
    existing,
    install,
  });
  return { ...measurements, ...existing, ...install, ...demo };
}

export function seedFlooringQmFromIntent(
  measurements: Record<string, unknown>,
  params: { notes?: string | null; hasSitePhotos?: boolean }
): Record<string, unknown> {
  const hasSaved =
    readFlooringInstall(measurements).flooringInstallScopeCount != null;
  if (hasSaved) return measurements;
  const existing = params.hasSitePhotos
    ? inferExistingFlooringFromNotes(params.notes)
    : emptyFlooringExisting();
  const install = inferFlooringInstallFromIntent({ notes: params.notes });
  const demo = resolveFlooringDemoFromIntent({
    notes: params.notes,
    existing,
    install,
  });
  return { ...measurements, ...existing, ...install, ...demo };
}

export function seedBathroomFixturesQmFromIntent(
  measurements: Record<string, unknown>,
  params: { notes?: string | null; hasSitePhotos?: boolean }
): Record<string, unknown> {
  const hasSaved =
    readBathroomInstallFixtureCounts(measurements).bathroomInstallVanityCount !=
      null ||
    readBathroomInstallFixtureCounts(measurements)
      .bathroomInstallCounterCount != null ||
    readBathroomDemoFixtureCounts(measurements).bathroomDemoVanityCount !=
      null ||
    readBathroomDemoFixtureCounts(measurements).bathroomDemoCounterCount !=
      null;
  if (hasSaved) return measurements;
  const existing = inferExistingBathroomFixturesFromNotes(params.notes);
  const install = inferBathroomFixtureInstallFromIntent({
    notes: params.notes,
  });
  const demo = resolveBathroomFixtureDemoFromIntent({
    notes: params.notes,
    existing,
    install,
  });
  return { ...measurements, ...existing, ...install, ...demo };
}
