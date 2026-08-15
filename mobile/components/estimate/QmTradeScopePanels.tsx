import React, { startTransition, useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { aiScopeConfirmNumericKeyboardProps } from '@/constants/inputKeyboardPresets';
import { getColors } from '@/theme/getColors';
import type { ScopeMeasurementsInputExtended } from '@/utils/scopeItemQuantities';
import {
  emptyKitchenExistingCounts,
  inferExistingKitchenFromNotes,
  inferKitchenInstallFromIntent,
  readKitchenDemoCounts,
  readKitchenExistingCounts,
  readKitchenInstallCounts,
  resolveKitchenDemoFromIntent,
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
  landscapingScopeCanonicalId,
  readLandscapingScope,
} from '@/utils/qmScopePanels/landscapingRemodel';
import {
  FLOOR_PREP_SEVERITY_OPTIONS,
  recommendFloorPrepSeverity,
  type FloorPrepSeverity,
} from '@/utils/flooringDemoPrepBoundary';
import {
  CONCRETE_FLATWORK_OPTIONS,
  CONCRETE_DECORATIVE_FINISH_OPTIONS,
  CONCRETE_DEMO_THICKNESS_OPTIONS,
  CONCRETE_SCOPE_OPTIONS,
  CONCRETE_SLAB_THICKNESS_OPTIONS,
  concreteScopeCanonicalId,
  readConcreteScope,
} from '@/utils/qmScopePanels/concreteRemodel';
import {
  roofingOptionsForIds,
  ROOFING_ACCESSORY_OPTION_IDS,
  ROOFING_DRAINAGE_OPTION_IDS,
  ROOFING_DEMO_OPTION_IDS,
  ROOFING_INSTALL_OPTION_IDS,
  simpleTradeSpec,
  type SimpleTradeScopeKey,
} from '@/utils/qmScopePanels/simpleTradeRemodel';
import {
  emptyBathroomExistingFixtureCounts,
  inferExistingBathroomFixturesFromNotes,
  inferBathroomFixtureInstallFromIntent,
  readBathroomDemoFixtureCounts,
  readBathroomExistingFixtureCounts,
  readBathroomInstallFixtureCounts,
  resolveBathroomFixtureDemoFromIntent,
  type BathroomDemoFixtureCounts,
  type BathroomExistingFixtureCounts,
  type BathroomFixtureDemoOverrideKey,
  type BathroomInstallFixtureCounts,
} from '@/utils/qmScopePanels/bathroomFixtures';
import {
  BATHROOM_VANITY_COUNTERTOP_MATERIAL_OPTIONS,
  normalizeBathroomVanityCountertopMaterialType,
  type BathroomVanityCountertopMaterialType,
} from '@/utils/bathroomVanityCountertopPricing';
import { BATHROOM_QM_STEPPER_MAX } from '@/utils/planBathRooms';

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
});

function captionColor(darkMode: boolean, Colors: Colors) {
  return darkMode ? 'rgba(245,247,250,0.82)' : Colors.sub;
}

export function qmNeutralScopePanelStyle(darkMode: boolean) {
  return {
    titleColor: darkMode ? '#94a3b8' : '#64748b',
    borderColor: darkMode ? 'rgba(148, 163, 184, 0.28)' : 'rgba(100, 116, 139, 0.22)',
    backgroundColor: darkMode ? 'rgba(148, 163, 184, 0.06)' : 'rgba(100, 116, 139, 0.05)',
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

const KITCHEN_INSTALL_ROWS: StepperRow[] = [
  { key: 'kitchenInstallCabinetCount', label: 'New cabinets' },
  { key: 'kitchenInstallCounterCount', label: 'New countertops' },
  { key: 'kitchenInstallBacksplashCount', label: 'New backsplash' },
  { key: 'kitchenInstallFlooringCount', label: 'New flooring' },
  { key: 'kitchenInstallApplianceCount', label: 'Appliance hookup' },
  { key: 'kitchenInstallIslandCount', label: 'Island cabinet/base install' },
];

const KITCHEN_DEMO_ROWS: StepperRow[] = [
  { key: 'kitchenDemoCabinetCount', label: 'Remove cabinets' },
  { key: 'kitchenDemoCounterCount', label: 'Remove countertops (including island)' },
  { key: 'kitchenDemoBacksplashCount', label: 'Remove backsplash' },
  { key: 'kitchenDemoIslandCount', label: 'Demo island' },
  { key: 'kitchenDemoApplianceCount', label: 'Appliance removal' },
  { key: 'kitchenDemoFloorCount', label: 'Floor demo' },
  { key: 'kitchenDemoWallCount', label: 'Wall demo' },
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

const BATHROOM_VANITY_FIXTURE_ROWS: StepperRow[] = [
  ...BATHROOM_INSTALL_FIXTURE_ROWS,
  ...BATHROOM_DEMO_FIXTURE_ROWS,
];

function QmCountStepper({
  label,
  value,
  onAdjust,
  applying,
  max = 1,
  darkMode,
  Colors,
}: {
  label: string;
  value: number | null;
  onAdjust: (delta: number) => void;
  applying: boolean;
  max?: number;
  darkMode: boolean;
  Colors: Colors;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
      }}
    >
      <Text style={{ flex: 1, color: darkMode ? '#F5F7FA' : Colors.text, fontSize: 13, fontWeight: '600' }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <TouchableOpacity
          onPress={() => onAdjust(-1)}
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
          <Text style={{ color: darkMode ? '#F5F7FA' : Colors.text, fontSize: 18, fontWeight: '700' }}>−</Text>
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
          onPress={() => onAdjust(1)}
          disabled={applying || (value != null && value >= max)}
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
            opacity: applying || (value != null && value >= max) ? 0.4 : 1,
          }}
        >
          <Text style={{ color: darkMode ? '#F5F7FA' : Colors.text, fontSize: 18, fontWeight: '700' }}>+</Text>
        </TouchableOpacity>
        </View>
      </View>
  );
}

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
  stepperMax,
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
  stepperMax?: number;
}) {
  const max = stepperMax ?? 1;
  return (
    <View
      style={{
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        borderColor,
        backgroundColor,
        marginBottom: 8,
      }}
    >
      <Text style={{ color: titleColor, fontSize: 12, fontWeight: '800', letterSpacing: 0.4, marginBottom: 4 }}>
        {title.toUpperCase()}
      </Text>
      <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, lineHeight: 15, marginBottom: 8 }}>
        {caption}
      </Text>
      {rows.map((row) => (
        <QmCountStepper
          key={row.key}
          label={row.label}
          value={counts[row.key] ?? null}
          onAdjust={(d) => onAdjust(row.key, d)}
          applying={applying}
          max={max}
          darkMode={darkMode}
          Colors={Colors}
        />
      ))}
      {footer}
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
}) {
  const formattedValue = (() => {
    const raw = String(value || '').replace(/,/g, '');
    if (!raw) return '';
    const match = raw.match(/^(-?)(\d*)(\.\d*)?$/);
    if (!match) return value;
    const [, sign, integerPart, decimalPart = ''] = match;
    const integer = integerPart || '0';
    return `${sign}${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${decimalPart}`;
  })();
  return (
    <View
      style={{
        marginTop: 10,
        paddingTop: 10,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: darkMode ? 'rgba(255,255,255,0.08)' : Colors.line,
      }}
    >
      <Text style={{ color: highlighted ? '#FACC15' : darkMode ? '#F5F7FA' : Colors.text, fontSize: 13, fontWeight: '600', marginBottom: 4 }}>
        {label}
      </Text>
      {helperText ? (
        <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, lineHeight: 15, marginBottom: 8 }}>
          {helperText}
        </Text>
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: 10,
          borderColor: darkMode ? 'rgba(255,255,255,0.16)' : Colors.line,
          backgroundColor: darkMode ? '#111111' : Colors.surface,
          paddingHorizontal: 10,
          minHeight: 38,
        }}
      >
        <TextInput
          value={formattedValue}
          onChangeText={text => onChangeText(text.replace(/,/g, ''))}
          onFocus={onFocus}
          onBlur={onBlur}
          editable={!applying}
          keyboardType={keyboardType}
          {...aiScopeConfirmNumericKeyboardProps}
          placeholder={placeholder || 'sqft'}
          placeholderTextColor={darkMode ? 'rgba(255,255,255,0.35)' : '#94a3b8'}
          style={{
            flex: 1,
            color: darkMode ? '#F5F7FA' : Colors.text,
            paddingVertical: Platform.OS === 'ios' ? 8 : 6,
            fontSize: 14,
            fontWeight: '600',
            minWidth: 0,
          }}
        />
        <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, fontWeight: '700', marginLeft: 6, flexShrink: 0 }}>
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

export function QmKitchenScopePanels({
  measurements,
  setMeasurements,
  notes,
  includedScopeKeys,
  hasSitePhotos,
  showExistingPanel,
  applying,
  onKitchenQmChange,
  measurementFooter,
  darkMode,
  Colors,
}: {
  measurements: ScopeMeasurementsInputExtended;
  setMeasurements: React.Dispatch<React.SetStateAction<ScopeMeasurementsInputExtended>>;
  notes?: string | null;
  includedScopeKeys: string[];
  hasSitePhotos: boolean;
  showExistingPanel: boolean;
  applying: boolean;
  onKitchenQmChange?: (params: {
    existing: KitchenExistingCounts;
    install: KitchenInstallCounts;
    demo: KitchenDemoCounts;
  }) => void;
  measurementFooter?: React.ReactNode;
  darkMode: boolean;
  Colors: Colors;
}) {
  const [existing, setExisting] = useState<KitchenExistingCounts>(() => readKitchenExistingCounts(measurements));
  const [install, setInstall] = useState<KitchenInstallCounts>(() => readKitchenInstallCounts(measurements));
  const [demo, setDemo] = useState<KitchenDemoCounts>(() => readKitchenDemoCounts(measurements));
  const genRef = useRef(0);
  const appliedRef = useRef(0);
  const demoOverridesRef = useRef<Partial<Record<KitchenDemoOverrideKey, boolean>>>({});

  useEffect(() => {
    if (genRef.current !== appliedRef.current) return;
    setExisting(readKitchenExistingCounts(measurements));
    setInstall(readKitchenInstallCounts(measurements));
    setDemo(readKitchenDemoCounts(measurements));
  }, [
    measurements.kitchenExistingCabinetCount,
    measurements.kitchenExistingCounterCount,
    measurements.kitchenExistingApplianceCount,
    measurements.kitchenExistingBacksplashCount,
    measurements.kitchenExistingFloorCount,
    measurements.kitchenInstallCabinetCount,
    measurements.kitchenInstallCounterCount,
    measurements.kitchenInstallApplianceCount,
    measurements.kitchenInstallBacksplashCount,
    measurements.kitchenInstallFlooringCount,
    measurements.kitchenInstallIslandCount,
    measurements.kitchenDemoCabinetCount,
    measurements.kitchenDemoCounterCount,
    measurements.kitchenDemoBacksplashCount,
    measurements.kitchenDemoApplianceCount,
    measurements.kitchenDemoFloorCount,
    measurements.kitchenDemoWallCount,
  ]);

  const commit = useCallback(
    (
      nextExisting: KitchenExistingCounts,
      nextInstall: KitchenInstallCounts,
      gen: number,
      demoOverride?: { key: KitchenDemoOverrideKey; value: number | null },
      currentDemo?: KitchenDemoCounts
    ) => {
      const checklistItems = includedScopeKeys.map((id) => ({
        id,
        state: 'included' as const,
      }));
      const autoDemo = resolveKitchenDemoFromIntent({
        notes,
        existing: nextExisting,
        install: nextInstall,
        checklistItems: checklistItems as import('@/utils/estimateAiDraft').ScopeChecklistItem[],
      });
      // A manual demo edit must not let auto-inference's null fields clear
      // other demo rows that are already selected (e.g. cabinet demo + floor
      // demo). Preserve the current demo state, then apply only non-null
      // inferred values and the explicitly edited row.
      // Use the state snapshot from the row being edited. The closure can be
      // one render behind during rapid stepper taps, which previously caused
      // toggling one demo scope to restore or clear a different one.
      let mergedDemo = demoOverride ? { ...(currentDemo || demo) } : { ...autoDemo };
      if (demoOverride) {
        for (const [key, value] of Object.entries(autoDemo) as [
          KitchenDemoOverrideKey,
          number | null,
        ][]) {
          if (value != null) mergedDemo[key] = value;
        }
      }
      if (demoOverride) {
        demoOverridesRef.current = { ...demoOverridesRef.current, [demoOverride.key]: true };
        mergedDemo = { ...mergedDemo, [demoOverride.key]: demoOverride.value };
      } else {
        const stored = readKitchenDemoCounts(measurements);
        for (const key of Object.keys(demoOverridesRef.current) as KitchenDemoOverrideKey[]) {
          if (demoOverridesRef.current[key]) mergedDemo[key] = stored[key];
        }
      }
      queueMicrotask(() => {
        if (gen !== genRef.current) return;
        startTransition(() => {
          setDemo(mergedDemo);
          setMeasurements((prev) => ({ ...prev, ...nextExisting, ...nextInstall, ...mergedDemo }));
          appliedRef.current = genRef.current;
          onKitchenQmChange?.({ existing: nextExisting, install: nextInstall, demo: mergedDemo });
        });
      });
    },
    [demo, includedScopeKeys, measurements, notes, onKitchenQmChange, setMeasurements]
  );

  const adjustExisting = useCallback(
    (key: keyof KitchenExistingCounts, delta: number) => {
      const gen = ++genRef.current;
      setExisting((prev) => {
        const current = prev[key] ?? 0;
        const next = { ...prev, [key]: clampQmCount(current + delta < 1 ? null : current + delta) };
        commit(next, install, gen);
        return next;
      });
    },
    [commit, install]
  );

  const adjustInstall = useCallback(
    (key: keyof KitchenInstallCounts, delta: number) => {
      const gen = ++genRef.current;
      setInstall((prev) => {
        const current = prev[key] ?? 0;
        const next = { ...prev, [key]: clampQmCount(current + delta < 1 ? null : current + delta) };
        commit(existing, next, gen);
        return next;
      });
    },
    [commit, existing]
  );

  const adjustDemo = useCallback(
    (key: KitchenDemoOverrideKey, delta: number) => {
      const gen = ++genRef.current;
      setDemo((prev) => {
        const current = prev[key] ?? 0;
        const cleaned = clampQmCount(current + delta < 1 ? null : current + delta);
        commit(existing, install, gen, { key, value: cleaned }, prev);
        return { ...prev, [key]: cleaned };
      });
    },
    [commit, existing, install]
  );

  const existingCaption = showExistingPanel
    ? 'What is in the space now — set manually for notes-only jobs.'
    : 'Seeded from photos and notes when site photos are attached.';
  const demoCaption = showExistingPanel
    ? 'Auto-filled from existing + install — adjust if needed.'
    : 'Auto-filled from photos, notes, and install — adjust if needed.';

  return (
    <>
      {showExistingPanel ? (
        <QmScopePanelSection
          title="Existing kitchen"
          {...qmNeutralScopePanelStyle(darkMode)}
          caption={existingCaption}
          rows={KITCHEN_EXISTING_ROWS}
          counts={existing as Record<string, number | null>}
          onAdjust={(key, d) => adjustExisting(key as keyof KitchenExistingCounts, d)}
          applying={applying}
          darkMode={darkMode}
          Colors={Colors}
        />
      ) : null}
      <QmScopePanelSection
        title="Kitchen install"
        titleColor={darkMode ? '#cbd5e1' : '#475569'}
        borderColor={darkMode ? 'rgba(148,163,184,0.28)' : 'rgba(100,116,139,0.24)'}
        backgroundColor={darkMode ? 'rgba(148,163,184,0.06)' : 'rgba(148,163,184,0.05)'}
        caption="Set what is in this bid — scope cards sync below."
        rows={KITCHEN_INSTALL_ROWS}
        counts={install as Record<string, number | null>}
        onAdjust={(key, d) => adjustInstall(key as keyof KitchenInstallCounts, d)}
        applying={applying}
        footer={measurementFooter}
        darkMode={darkMode}
        Colors={Colors}
      />
      <QmScopePanelSection
        title="Demo / tear-out"
        titleColor="#f87171"
        borderColor={darkMode ? 'rgba(248, 113, 113, 0.28)' : 'rgba(220, 38, 38, 0.2)'}
        backgroundColor={darkMode ? 'rgba(248, 113, 113, 0.06)' : 'rgba(248, 113, 113, 0.05)'}
        caption={demoCaption}
        rows={KITCHEN_DEMO_ROWS}
        counts={demo as Record<string, number | null>}
        onAdjust={(key, d) => adjustDemo(key as KitchenDemoOverrideKey, d)}
        applying={applying}
        darkMode={darkMode}
        Colors={Colors}
      />
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
  setMeasurements: React.Dispatch<React.SetStateAction<ScopeMeasurementsInputExtended>>;
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
  const [existing, setExisting] = useState(() => readFlooringExisting(measurements));
  const [install, setInstall] = useState(() => readFlooringInstall(measurements));
  const [demo, setDemo] = useState(() => readFlooringDemo(measurements));
  const [existingExpanded, setExistingExpanded] = useState(true);
  const [newExpanded, setNewExpanded] = useState(true);
  const [prepExpanded, setPrepExpanded] = useState(true);
  const [sqftDrafts, setSqftDrafts] = useState<Record<string, string>>({});
  const [sqftEditingKey, setSqftEditingKey] = useState<string | null>(null);
  const genRef = useRef(0);
  const appliedRef = useRef(0);
  const demoManualRef = useRef(false);
  const measurementsRef = useRef(measurements);
  const existingCardRef = useRef<View>(null);
  const newCardRef = useRef<View>(null);
  const prepCardRef = useRef<View>(null);
  measurementsRef.current = measurements;

  const focusCard = useCallback((cardRef: React.RefObject<View | null>) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const card = cardRef.current;
        const content = scrollContentRef?.current;
        if (!card || !content) return;
        card.measureLayout(content, (_x, y) => {
          scrollRef?.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
        });
      });
    });
  }, [scrollContentRef, scrollRef]);

  const syncScopeFromSnapshot = useCallback(
    (snapshot: ScopeMeasurementsInputExtended) => {
      onFlooringScopeSync?.(snapshot as Record<string, unknown>);
    },
    [onFlooringScopeSync]
  );

  const sqftDraftKey = (kind: 'new' | 'demo' | 'prep', id: string) => `${kind}:${id}`;

  const beginSqftDraft = (kind: 'new' | 'demo' | 'prep', id: string, currentValue: string) => {
    const key = sqftDraftKey(kind, id);
    setSqftEditingKey(key);
    setSqftDrafts((prev) => ({ ...prev, [key]: prev[key] ?? currentValue }));
  };

  const updateSqftDraft = (kind: 'new' | 'demo' | 'prep', id: string, value: string) => {
    const key = sqftDraftKey(kind, id);
    setSqftDrafts((prev) => ({ ...prev, [key]: value }));
  };

  const displaySqftDraft = (kind: 'new' | 'demo' | 'prep', id: string, currentValue: string) => {
    const key = sqftDraftKey(kind, id);
    return sqftEditingKey === key ? sqftDrafts[key] ?? currentValue : currentValue;
  };

  const endSqftDraft = (kind: 'new' | 'demo' | 'prep', id: string, commit: (value: string) => void) => {
    const key = sqftDraftKey(kind, id);
    const value = sqftDrafts[key] ?? '';
    commit(value);
    setSqftEditingKey((current) => (current === key ? null : current));
    setSqftDrafts((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  useEffect(() => {
    if (genRef.current !== appliedRef.current) return;
    setExisting(readFlooringExisting(measurements));
    setInstall(readFlooringInstall(measurements));
    setDemo(readFlooringDemo(measurements));
  }, [
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
            : resolveFlooringDemoFromIntent({ notes, existing: nextExisting, install: nextInstall });
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
          onFlooringQmChange?.({ existing: nextExisting, install: nextInstall, demo: mergedDemo });
          syncScopeFromSnapshot(snapshot);
        });
      });
    },
    [measurements, notes, onFlooringQmChange, setMeasurements, syncScopeFromSnapshot]
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
    (type: NonNullable<FlooringExistingCounts['flooringExistingTypes']>[number]) => {
      const current = existing.flooringExistingTypes || [];
      const nextTypes =
        type === 'unknown'
          ? current.includes('unknown')
            ? []
            : ['unknown' as const]
          : current.includes(type)
            ? current.filter((value) => value !== type && value !== 'unknown')
            : [...current.filter((value) => value !== 'unknown'), type];
      const nextExisting = {
        flooringExistingCount: nextTypes.length ? 1 : null,
        flooringExistingTypes: nextTypes.length ? nextTypes : null,
      };
      const gen = ++genRef.current;
      commit(nextExisting, install, gen);
      setExisting(nextExisting);
      const itemQuantities = { ...(measurements.itemQuantities || {}) };
      for (const key of Object.keys(itemQuantities)) {
        if (key.startsWith('floor_demo__') && !nextTypes.includes(key.replace('floor_demo__', '') as typeof type)) {
          delete itemQuantities[key];
        }
      }
      const nextDemoTotal = nextTypes.reduce(
        (sum, existingType) =>
          sum + Number(itemQuantities[existingDemoAreaKey(existingType)]?.quantity || 0),
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
          floorDemoSqft: nextDemoTotal > 0 ? 'user_entered' : 'needs_confirmation',
        },
      };
      setMeasurements(snapshot);
      syncScopeFromSnapshot(snapshot);
    },
    [commit, existing, install, measurements.itemQuantities, setMeasurements, syncScopeFromSnapshot]
  );

  const newFlooringOptions: Array<{
    id: NonNullable<ScopeMeasurementsInputExtended['flooringProductScope']>[number];
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
    (type: NonNullable<ScopeMeasurementsInputExtended['flooringProductScope']>[number]) => {
      const current = Array.isArray(measurements.flooringProductScope)
        ? measurements.flooringProductScope
        : [];
      const nextProducts = current.includes(type)
        ? current.filter((value) => value !== type)
        : [...current, type];
      const nextInstall = { flooringInstallScopeCount: nextProducts.length ? 1 : null };
      const draftKey = sqftDraftKey('new', type);
      if (!nextProducts.includes(type)) {
        setSqftEditingKey((editing) => (editing === draftKey ? null : editing));
        setSqftDrafts((prev) => {
          if (!(draftKey in prev)) return prev;
          const next = { ...prev };
          delete next[draftKey];
          return next;
        });
      }
      const mergedDemo = resolveFlooringDemoFromIntent({
        notes,
        existing,
        install: nextInstall,
      });
      const nextByProduct = { ...(measurementsRef.current.floorPrepByProduct || {}) };
      if (!nextProducts.includes(type)) {
        delete nextByProduct[type];
      }
      const totalPrep = Object.values(nextByProduct).reduce((sum, entry) => {
        if (!entry || entry.severity === 'none' || !entry.sqft) return sum;
        return sum + Number(entry.sqft);
      }, 0);
      const itemQuantities = { ...(measurementsRef.current.itemQuantities || {}) };
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
        floorPrepByProduct: Object.keys(nextByProduct).length ? nextByProduct : null,
        floorPrepSqft: totalPrep > 0 ? totalPrep : null,
        itemQuantities,
      };
      setInstall(nextInstall);
      setDemo(mergedDemo);
      setMeasurements(snapshot);
      syncScopeFromSnapshot(snapshot);
    },
    [existing, measurements.flooringProductScope, notes, setMeasurements, syncScopeFromSnapshot]
  );

  const floorPrepEntryFor = (product: string) =>
    measurements.floorPrepByProduct?.[product] ?? { sqft: null, severity: null };

  const setFloorPrepForProduct = (
    product: string,
    patch: Partial<{ sqft: number | null; severity: FloorPrepSeverity | null }>
  ) => {
    setMeasurements((prev) => {
      const current = prev.floorPrepByProduct || {};
      const nextEntry = {
        sqft: patch.sqft !== undefined ? patch.sqft : (current[product]?.sqft ?? null),
        severity:
          patch.severity !== undefined ? patch.severity : (current[product]?.severity ?? null),
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
      setDemo((prev) => {
        const current = prev.flooringDemoScopeCount ?? 0;
        const cleaned = clampQmCount(current + delta < 1 ? null : current + delta);
        commit(existing, install, gen, cleaned);
        return { flooringDemoScopeCount: cleaned };
      });
    },
    [commit, existing, install]
  );

  function existingDemoAreaKey(type: NonNullable<FlooringExistingCounts['flooringExistingTypes']>[number]) {
    return `floor_demo__${type}`;
  }
  const existingDemoArea = (
    type: NonNullable<FlooringExistingCounts['flooringExistingTypes']>[number]
  ): string => {
    const value = measurements.itemQuantities?.[existingDemoAreaKey(type)]?.quantity;
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
        sum + Number(itemQuantities[existingDemoAreaKey(existingType)]?.quantity || 0),
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
  const newFlooringMeasurementKey: Record<string, keyof ScopeMeasurementsInputExtended> = {
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
    const numericValue = Number(value.replace(/,/g, ''));
    const prev = measurementsRef.current;
    const itemQuantities = { ...(prev.itemQuantities || {}) };
    const quantityKey = `floor_install__${product}`;
    if (value.trim() && Number.isFinite(numericValue) && numericValue > 0) {
      // Keep the per-product quantity catalog in sync with the legacy
      // product-specific fields so the matching scope card can price it.
      itemQuantities[quantityKey] = { quantity: numericValue, unit: 'sqft', quantitySource: 'user_entered' };
    } else {
      delete itemQuantities[quantityKey];
    }
    const next = {
      ...prev,
      ...(key
        ? {
            [key]:
              value.trim() && Number.isFinite(numericValue) && numericValue > 0 ? numericValue : null,
          }
        : {}),
      itemQuantities,
    };
    const products = Array.isArray(next.flooringProductScope) ? next.flooringProductScope : [];
    const total = products.reduce((sum, selectedProduct) => {
      const selectedKey = newFlooringMeasurementKey[selectedProduct];
      const direct = selectedKey ? Number(next[selectedKey] || 0) : 0;
      const fallback = Number(itemQuantities[`floor_install__${selectedProduct}`]?.quantity || 0);
      return sum + (direct || fallback);
    }, 0);
    const snapshot = {
      ...next,
      floorAreaSqft: total > 0 ? total : next.floorAreaSqft,
      flooringSqft: total > 0 ? total : next.flooringSqft,
      quickMeasurementSources: {
        ...(prev.quickMeasurementSources || {}),
        ...(key ? { [key]: numericValue > 0 ? 'user_entered' : 'needs_confirmation' } : {}),
        ...(total > 0
          ? { floorAreaSqft: 'user_entered', flooringSqft: 'user_entered' }
          : {}),
      },
    };
    setMeasurements(snapshot);
    syncScopeFromSnapshot(snapshot);
  };
  const newFlooringSubtypeOptions = (product: string) =>
    product === 'lvp'
      ? [
          ['floating', 'Floating / click-lock'],
          ['glue_down', 'Glue-down LVP'],
          ['unknown', 'Not sure'],
        ]
      : product === 'sheet_vinyl_vct'
        ? [
            ['sheet_vinyl', 'Sheet vinyl'],
            ['vct', 'VCT (vinyl composition tile)'],
            ['unknown', 'Not sure'],
          ]
        : [];
  const selectedExistingTypes = existing.flooringExistingTypes || [];
  const selectedNewProducts = Array.isArray(measurements.flooringProductScope)
    ? measurements.flooringProductScope
    : [];
  const selectedNewFlooringOptions = newFlooringOptions.filter((option) =>
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
              borderColor: darkMode ? 'rgba(148,163,184,0.28)' : 'rgba(100,116,139,0.24)',
              backgroundColor: darkMode ? 'rgba(148,163,184,0.06)' : 'rgba(148,163,184,0.05)',
            },
          ]}
        >
          <TouchableOpacity onPress={() => setExistingExpanded((expanded) => !expanded)} activeOpacity={0.75}>
            <Text style={[styles.qmPanelTitle, { color: darkMode ? '#cbd5e1' : '#475569' }]}>
              Existing flooring {existingExpanded ? '⌃' : '⌄'}
            </Text>
            {existingExpanded ? (
              <Text style={[styles.qmPanelCaption, { color: darkMode ? '#64748b' : '#94a3b8', marginTop: 2 }]}>
                Tap to collapse card
              </Text>
            ) : (
              <Text style={[styles.qmPanelCaption, { color: darkMode ? '#94a3b8' : '#64748b' }]}>
                {selectedExistingTypes.length} selected · {selectedExistingTypes.reduce((sum, type) => sum + Number(existingDemoArea(type) || 0), 0).toLocaleString()} SF removal
              </Text>
            )}
          </TouchableOpacity>
          {existingExpanded ? (
          <>
          <Text style={[styles.qmPanelCaption, { color: darkMode ? '#94a3b8' : '#64748b' }]}>
            Select what is in the space now. Multiple types are allowed.
          </Text>
          <View style={styles.qmOptionWrap}>
            {existingFlooringOptions.map((option) => {
              const selected = existing.flooringExistingTypes?.includes(option.id) ?? false;
              return (
                <React.Fragment key={option.id}>
                  <TouchableOpacity
                    onPress={() => chooseExistingTypes(option.id)}
                    disabled={applying}
                    activeOpacity={1}
                    style={[
                      styles.qmOption,
                      {
                        borderColor: selected ? '#34d399' : darkMode ? '#52525b' : '#cbd5e1',
                        backgroundColor: selected
                          ? 'rgba(52, 211, 153, 0.12)'
                          : darkMode
                            ? '#27272a'
                            : '#f1f5f9',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.qmOptionText,
                        { color: selected ? '#34d399' : darkMode ? '#e4e4e7' : Colors.text },
                      ]}
                    >
                      {selected ? '✓ ' : ''}{option.label}
                    </Text>
                  </TouchableOpacity>
                  {selected && option.id === 'lvp' ? (
                    <View style={{ marginTop: 10 }}>
                      <Text style={[styles.qmPanelCaption, { color: darkMode ? '#F5F7FA' : Colors.text, marginBottom: 6 }]}>
                        How is the existing LVP installed?
                      </Text>
                      <View style={styles.qmOptionWrap}>
                        {[
                          ['floating', 'Floating / click-lock'],
                          ['glue_down', 'Glue-down LVP'],
                          ['unknown', 'Not sure'],
                        ].map(([id, label]) => {
                          const selectedMethod = measurements.flooringExistingLvpInstallMethod === id;
                          return (
                            <TouchableOpacity
                              key={`${option.id}-${id}`}
                              onPress={() =>
                                setMeasurements((prev) => ({
                                  ...prev,
                                  flooringExistingLvpInstallMethod: id as 'floating' | 'glue_down' | 'unknown',
                                }))
                              }
                              disabled={applying}
                              activeOpacity={1}
                              style={[
                                styles.qmOption,
                                {
                                  borderColor: selectedMethod ? '#34d399' : darkMode ? '#52525b' : '#cbd5e1',
                                  backgroundColor: selectedMethod
                                    ? 'rgba(52, 211, 153, 0.12)'
                                    : darkMode
                                      ? '#27272a'
                                      : '#f1f5f9',
                                },
                              ]}
                            >
                              <Text style={[styles.qmOptionText, { color: selectedMethod ? '#34d399' : darkMode ? '#e4e4e7' : Colors.text }]}>
                                {selectedMethod ? '✓ ' : ''}{label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  ) : null}
                  {selected && option.id === 'sheet_vinyl_vct' ? (
                    <View style={{ marginTop: 10 }}>
                      <Text style={[styles.qmPanelCaption, { color: darkMode ? '#F5F7FA' : Colors.text, marginBottom: 6 }]}>
                        What type of vinyl flooring is being removed?
                      </Text>
                      <View style={styles.qmOptionWrap}>
                        {[
                          ['sheet_vinyl', 'Sheet vinyl'],
                          ['vct', 'VCT (vinyl composition tile)'],
                          ['unknown', 'Not sure'],
                        ].map(([id, label]) => {
                          const selectedSubtype = measurements.flooringExistingSheetVinylType === id;
                          return (
                            <TouchableOpacity
                              key={`${option.id}-${id}`}
                              onPress={() =>
                                setMeasurements((prev) => ({
                                  ...prev,
                                  flooringExistingSheetVinylType: id as 'sheet_vinyl' | 'vct' | 'unknown',
                                }))
                              }
                              disabled={applying}
                              activeOpacity={1}
                              style={[
                                styles.qmOption,
                                {
                                  borderColor: selectedSubtype ? '#34d399' : darkMode ? '#52525b' : '#cbd5e1',
                                  backgroundColor: selectedSubtype
                                    ? 'rgba(52, 211, 153, 0.12)'
                                    : darkMode
                                      ? '#27272a'
                                      : '#f1f5f9',
                                },
                              ]}
                            >
                              <Text style={[styles.qmOptionText, { color: selectedSubtype ? '#34d399' : darkMode ? '#e4e4e7' : Colors.text }]}>
                                {selectedSubtype ? '✓ ' : ''}{label}
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
                      helperText="Enter the area of this existing flooring type being removed."
                      value={displaySqftDraft('demo', option.id, existingDemoArea(option.id))}
                      placeholder="Enter"
                      onFocus={() => beginSqftDraft('demo', option.id, existingDemoArea(option.id))}
                      onChangeText={(value) => updateSqftDraft('demo', option.id, value)}
                      onBlur={() => endSqftDraft('demo', option.id, (value) => commitExistingDemoArea(option.id, value))}
                      applying={applying}
                      darkMode={darkMode}
                      Colors={Colors}
                      highlighted={selected}
                    />
                  ) : null}
                  {selected && option.id === 'sheet_vinyl_vct' && measurements.flooringExistingSheetVinylType ? (
                    <QmSqftMeasurementRow
                      label={
                        measurements.flooringExistingSheetVinylType === 'sheet_vinyl'
                          ? 'Sheet vinyl removal area'
                          : measurements.flooringExistingSheetVinylType === 'vct'
                            ? 'VCT (vinyl composition tile) removal area'
                            : 'Vinyl flooring removal area'
                      }
                      helperText="Enter the area of this existing flooring type being removed."
                      value={displaySqftDraft('demo', option.id, existingDemoArea(option.id))}
                      placeholder="Enter"
                      onFocus={() => beginSqftDraft('demo', option.id, existingDemoArea(option.id))}
                      onChangeText={(value) => updateSqftDraft('demo', option.id, value)}
                      onBlur={() => endSqftDraft('demo', option.id, (value) => commitExistingDemoArea(option.id, value))}
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
                        borderTopColor: darkMode ? 'rgba(255,255,255,0.10)' : Colors.line,
                      }}
                    />
                  ) : null}
                </React.Fragment>
              );
            })}
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
              style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: darkMode ? 'rgba(255,255,255,0.12)' : Colors.line }}
            >
              <Text style={[styles.qmPanelCaption, { color: darkMode ? '#94a3b8' : '#64748b', textAlign: 'center' }]}>
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
            borderColor: darkMode ? 'rgba(148,163,184,0.28)' : 'rgba(100,116,139,0.24)',
            backgroundColor: darkMode ? 'rgba(148,163,184,0.06)' : 'rgba(148,163,184,0.05)',
          },
        ]}
      >
        <TouchableOpacity onPress={() => setNewExpanded((expanded) => !expanded)} activeOpacity={0.75}>
          <Text style={[styles.qmPanelTitle, { color: darkMode ? '#cbd5e1' : '#475569' }]}>
            New Flooring {newExpanded ? '⌃' : '⌄'}
          </Text>
          {newExpanded ? (
            <Text style={[styles.qmPanelCaption, { color: darkMode ? '#64748b' : '#94a3b8', marginTop: 2 }]}>
              Tap to collapse card
            </Text>
          ) : (
            <Text style={[styles.qmPanelCaption, { color: darkMode ? '#94a3b8' : '#64748b' }]}>
              {selectedNewProducts.length} selected · {selectedNewProducts.reduce((sum, product) => sum + Number(newFlooringArea(product) || 0), 0).toLocaleString()} SF installation
            </Text>
          )}
        </TouchableOpacity>
        {newExpanded ? (
        <>
        <Text style={[styles.qmPanelCaption, { color: darkMode ? '#94a3b8' : '#64748b' }]}>
          Select what is being installed. Multiple products are allowed.
        </Text>
        <View style={styles.qmOptionWrap}>
          {[...newFlooringOptions]
            .sort(
              (a, b) =>
                Number(selectedNewProducts.includes(b.id)) - Number(selectedNewProducts.includes(a.id))
            )
            .map((option, index) => {
            const selected = selectedNewProducts.includes(option.id);
            return (
              <React.Fragment key={option.id}>
                {!selected && index === selectedNewFlooringOptions.length ? (
                  <Text style={[styles.qmPanelCaption, { color: darkMode ? '#CBD5E1' : '#64748b', marginTop: 4 }]}>
                    Other flooring options
                  </Text>
                ) : null}
              <View
                style={{
                  width: '100%',
                  gap: 8,
                  marginTop: selected && index > 0 ? 12 : 0,
                  paddingTop: selected && index > 0 ? 12 : 0,
                  borderTopWidth: selected && index > 0 ? 1 : 0,
                  borderTopColor: darkMode ? 'rgba(255,255,255,0.16)' : Colors.line,
                }}
              >
                <TouchableOpacity
                  onPress={() => chooseNewFlooringTypes(option.id)}
                  disabled={applying}
                  activeOpacity={1}
                  style={[
                    styles.qmOption,
                    {
                      borderColor: selected ? '#34d399' : darkMode ? '#52525b' : '#cbd5e1',
                      backgroundColor: selected ? 'rgba(52, 211, 153, 0.12)' : darkMode ? '#27272a' : '#f1f5f9',
                    },
                  ]}
                >
                  <Text style={[styles.qmOptionText, { color: selected ? '#34d399' : darkMode ? '#e4e4e7' : Colors.text }]}>
                    {selected ? '✓ ' : ''}{option.label}
                  </Text>
                </TouchableOpacity>
                {selected ? (
                  <>
                    <QmSqftMeasurementRow
                      label={`${option.label} installation area`}
                      helperText="Enter the area of this new flooring product being installed."
                      value={displaySqftDraft('new', option.id, newFlooringArea(option.id))}
                      placeholder="Enter"
                      onFocus={() => beginSqftDraft('new', option.id, newFlooringArea(option.id))}
                      onChangeText={(value) => updateSqftDraft('new', option.id, value)}
                      onBlur={() => endSqftDraft('new', option.id, (value) => commitNewFlooringArea(option.id, value))}
                      applying={applying}
                      darkMode={darkMode}
                      Colors={Colors}
                      highlighted={selected}
                    />
                    {newFlooringSubtypeOptions(option.id).length > 0 ? (
                      <View style={{ gap: 8, paddingTop: 8 }}>
                        <Text style={[styles.qmPanelCaption, { color: darkMode ? '#F5F7FA' : Colors.text, marginBottom: 6 }]}>
                          {option.id === 'lvp' ? 'How is the new LVP installed?' : 'What type of new vinyl flooring is being installed?'}
                        </Text>
                        <View style={styles.qmOptionWrap}>
                          {newFlooringSubtypeOptions(option.id).map(([id, label]) => {
                            const selectedSubtype =
                              option.id === 'lvp'
                                ? measurements.flooringNewLvpInstallMethod === id
                                : measurements.flooringNewSheetVinylType === id;
                            return (
                              <TouchableOpacity
                                key={`${option.id}-new-${id}`}
                                onPress={() =>
                                  setMeasurements((prev) => ({
                                    ...prev,
                                    ...(option.id === 'lvp'
                                      ? { flooringNewLvpInstallMethod: id as 'floating' | 'glue_down' | 'unknown' }
                                      : { flooringNewSheetVinylType: id as 'sheet_vinyl' | 'vct' | 'unknown' }),
                                  }))
                                }
                                disabled={applying}
                                activeOpacity={1}
                                style={[
                                  styles.qmOption,
                                  {
                                    borderColor: selectedSubtype ? '#34d399' : darkMode ? '#52525b' : '#cbd5e1',
                                    backgroundColor: selectedSubtype
                                      ? 'rgba(52, 211, 153, 0.12)'
                                      : darkMode
                                        ? '#27272a'
                                        : '#f1f5f9',
                                  },
                                ]}
                              >
                                <Text style={[styles.qmOptionText, { color: selectedSubtype ? '#34d399' : darkMode ? '#e4e4e7' : Colors.text }]}>
                                  {selectedSubtype ? '✓ ' : ''}{label}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    ) : null}
                  </>
                ) : null}
              </View>
              </React.Fragment>
            );
            })}
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
            style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: darkMode ? 'rgba(255,255,255,0.12)' : Colors.line }}
          >
            <Text style={[styles.qmPanelCaption, { color: darkMode ? '#94a3b8' : '#64748b', textAlign: 'center' }]}>
              Collapse card ⌃
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
        {selectedNewFlooringOptions.length > 0 ? (
          <View
            ref={prepCardRef}
            style={[
              styles.qmPanel,
              {
                borderColor: darkMode ? 'rgba(148,163,184,0.28)' : 'rgba(100,116,139,0.24)',
                backgroundColor: darkMode ? 'rgba(148,163,184,0.06)' : 'rgba(148,163,184,0.05)',
              },
            ]}
          >
            <TouchableOpacity onPress={() => setPrepExpanded((expanded) => !expanded)} activeOpacity={0.75}>
              <Text style={[styles.qmPanelTitle, { color: darkMode ? '#F5F7FA' : '#475569' }]}>
                Floor prep {prepExpanded ? '⌃' : '⌄'}
              </Text>
              {prepExpanded ? (
                <Text style={[styles.qmPanelCaption, { color: darkMode ? '#CBD5E1' : '#64748b', marginTop: 2 }]}>
                  Confirm additional preparation after demolition
                </Text>
              ) : (
                <Text style={[styles.qmPanelCaption, { color: darkMode ? '#CBD5E1' : '#64748b' }]}>
                  {selectedNewFlooringOptions.length} product{selectedNewFlooringOptions.length === 1 ? '' : 's'} · separate prep by product
                </Text>
              )}
            </TouchableOpacity>
            {prepExpanded ? (
              <>
                <Text style={[styles.qmPanelCaption, { color: darkMode ? '#E2E8F0' : '#64748b' }]}>
                  How much of each installed area needs additional preparation after demolition?
                </Text>
                <View style={{ gap: 16, marginTop: 12 }}>
                  {selectedNewFlooringOptions.map((option) => {
                    const prepEntry = floorPrepEntryFor(option.id);
                    const installSqft = Number(newFlooringArea(option.id) || 0);
                    const prepSqft = prepEntry.sqft == null ? '' : String(prepEntry.sqft);
                    const prepExceedsInstall =
                      installSqft > 0 &&
                      prepEntry.severity !== 'none' &&
                      Number(prepEntry.sqft || 0) > installSqft + 0.01;
                    const suggestedSeverity = recommendFloorPrepSeverity(option.id, measurements);
                    return (
                      <View
                        key={`${option.id}-prep`}
                        style={{
                          gap: 8,
                          paddingTop: 12,
                          borderTopWidth: 1,
                          borderTopColor: darkMode ? 'rgba(148,163,184,0.2)' : 'rgba(100,116,139,0.18)',
                        }}
                      >
                        <Text style={[styles.qmPanelCaption, { color: darkMode ? '#F5F7FA' : Colors.text, fontSize: 16, lineHeight: 21, fontWeight: '700', marginBottom: 2 }]}>
                          {option.label}
                        </Text>
                        {!prepEntry.severity ? (
                          <Text style={[styles.qmPanelCaption, { color: darkMode ? '#CBD5E1' : '#94a3b8' }]}>
                            Suggested starting point: {FLOOR_PREP_SEVERITY_OPTIONS.find((row) => row.id === suggestedSeverity)?.label || 'Medium'}
                          </Text>
                        ) : null}
                        <QmSqftMeasurementRow
                          label="Affected prep area"
                          helperText="Enter only the SF needing extra substrate work after ordinary demolition cleanup."
                          value={displaySqftDraft('prep', option.id, prepSqft)}
                          placeholder="Enter"
                          onFocus={() => beginSqftDraft('prep', option.id, prepSqft)}
                          onChangeText={(value) => updateSqftDraft('prep', option.id, value)}
                          onBlur={() =>
                            endSqftDraft('prep', option.id, (value) => {
                              const numericValue = Number(value.replace(/,/g, ''));
                              setFloorPrepForProduct(option.id, {
                                sqft: value.trim() && Number.isFinite(numericValue) && numericValue > 0 ? numericValue : null,
                              });
                            })
                          }
                          applying={applying}
                          darkMode={darkMode}
                          Colors={Colors}
                        />
                        {prepExceedsInstall ? (
                          <Text style={{ color: '#fbbf24', fontSize: 11, lineHeight: 15 }}>
                            Prep area exceeds this product&apos;s installation area — confirm the affected prep SF.
                          </Text>
                        ) : null}
                        <Text style={[styles.qmPanelCaption, { color: darkMode ? '#E2E8F0' : '#64748b', marginBottom: 6 }]}>
                          Prep severity
                        </Text>
                        <View style={styles.qmOptionWrap}>
                          {FLOOR_PREP_SEVERITY_OPTIONS.map((severityOption) => {
                            const selectedSeverity = prepEntry.severity === severityOption.id;
                            return (
                              <TouchableOpacity
                                key={`${option.id}-severity-${severityOption.id}`}
                                onPress={() =>
                                  setFloorPrepForProduct(option.id, {
                                    severity: severityOption.id,
                                    sqft: severityOption.id === 'none' ? null : prepEntry.sqft,
                                  })
                                }
                                disabled={applying}
                                activeOpacity={1}
                                style={[
                                  styles.qmOption,
                                  {
                                    borderColor: selectedSeverity ? '#34d399' : darkMode ? '#52525b' : '#cbd5e1',
                                    backgroundColor: selectedSeverity
                                      ? 'rgba(52, 211, 153, 0.12)'
                                      : darkMode
                                        ? '#27272a'
                                        : '#f1f5f9',
                                  },
                                ]}
                              >
                                <View style={{ alignItems: 'center', gap: 2 }}>
                                  <Text style={[styles.qmOptionText, { color: selectedSeverity ? '#34d399' : darkMode ? '#e4e4e7' : Colors.text }]}>
                                    {selectedSeverity ? '✓ ' : ''}{severityOption.label}
                                  </Text>
                                  <Text style={{ color: selectedSeverity ? '#A7F3D0' : darkMode ? '#CBD5E1' : '#64748b', fontSize: 10, lineHeight: 14, textAlign: 'center' }}>
                                    {severityOption.helper}
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                        {prepEntry.severity === 'extensive' ? (
                          <Text style={{ color: '#fbbf24', fontSize: 11, lineHeight: 15 }}>
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
                style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: darkMode ? 'rgba(255,255,255,0.12)' : Colors.line }}
              >
                <Text style={[styles.qmPanelCaption, { color: darkMode ? '#94a3b8' : '#64748b', textAlign: 'center' }]}>
                  Collapse card ⌃
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
    </>
  );
}

export function QmBathroomFixturesPanels({
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
}: {
  measurements: ScopeMeasurementsInputExtended;
  setMeasurements: React.Dispatch<React.SetStateAction<ScopeMeasurementsInputExtended>>;
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
}) {
  const [existing, setExisting] = useState<BathroomExistingFixtureCounts>(() =>
    readBathroomExistingFixtureCounts(measurements)
  );
  const [install, setInstall] = useState<BathroomInstallFixtureCounts>(() =>
    readBathroomInstallFixtureCounts(measurements)
  );
  const [demo, setDemo] = useState<BathroomDemoFixtureCounts>(() =>
    readBathroomDemoFixtureCounts(measurements)
  );
  const genRef = useRef(0);
  const appliedRef = useRef(0);
  const demoOverridesRef = useRef<Partial<Record<BathroomFixtureDemoOverrideKey, boolean>>>({});
  const demoRef = useRef(demo);
  demoRef.current = demo;
  const [selectedCountertopMaterial, setSelectedCountertopMaterial] =
    useState<BathroomVanityCountertopMaterialType | null>(() =>
      normalizeBathroomVanityCountertopMaterialType(measurements.bathroomVanityCountertopMaterialType)
    );
  const materialWritePendingRef = useRef(false);

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
  }, [measurements.bathroomVanityCountertopMaterialType, selectedCountertopMaterial]);

  useEffect(() => {
    if (genRef.current !== appliedRef.current) return;
    setExisting(readBathroomExistingFixtureCounts(measurements));
    setInstall(readBathroomInstallFixtureCounts(measurements));
    const nextDemo = readBathroomDemoFixtureCounts(measurements);
    setDemo(nextDemo);
    demoRef.current = nextDemo;
  }, [
    measurements.bathroomExistingVanityCount,
    measurements.bathroomExistingCounterCount,
    measurements.bathroomInstallVanityCount,
    measurements.bathroomInstallCounterCount,
    measurements.bathroomDemoVanityCount,
    measurements.bathroomDemoCounterCount,
  ]);

  const commit = useCallback(
    (
      nextExisting: BathroomExistingFixtureCounts,
      nextInstall: BathroomInstallFixtureCounts,
      gen: number,
      demoOverride?: { key: BathroomFixtureDemoOverrideKey; value: number | null }
    ) => {
      let mergedDemo: BathroomDemoFixtureCounts;
      if (demoOverride) {
        demoOverridesRef.current = { ...demoOverridesRef.current, [demoOverride.key]: true };
        mergedDemo = { ...demoRef.current, [demoOverride.key]: demoOverride.value };
      } else {
        // Install/existing steppers do not auto-set demo — user picks Remove rows separately.
        mergedDemo = { ...demoRef.current };
      }
      queueMicrotask(() => {
        if (gen !== genRef.current) return;
        startTransition(() => {
          setDemo(mergedDemo);
          demoRef.current = mergedDemo;
          setMeasurements((prev) => ({
            ...prev,
            ...nextExisting,
            ...nextInstall,
            ...mergedDemo,
            countertopSqft: prev.countertopSqft,
            bathroomVanityCountertopMaterialType: prev.bathroomVanityCountertopMaterialType,
          }));
          appliedRef.current = genRef.current;
          onBathroomFixturesQmChange?.({
            existing: nextExisting,
            install: nextInstall,
            demo: mergedDemo,
          });
        });
      });
    },
    [onBathroomFixturesQmChange, setMeasurements]
  );

  const adjustExisting = useCallback(
    (key: keyof BathroomExistingFixtureCounts, delta: number) => {
      const gen = ++genRef.current;
      setExisting((prev) => {
        const current = prev[key] ?? 0;
        const next = {
          ...prev,
          [key]: clampQmCount(current + delta < 1 ? null : current + delta, BATHROOM_QM_STEPPER_MAX),
        };
        commit(next, install, gen);
        return next;
      });
    },
    [commit, install]
  );

  const adjustInstall = useCallback(
    (key: keyof BathroomInstallFixtureCounts, delta: number) => {
      const gen = ++genRef.current;
      setInstall((prev) => {
        const current = prev[key] ?? 0;
        const nextInstall = {
          ...prev,
          [key]: clampQmCount(current + delta < 1 ? null : current + delta, BATHROOM_QM_STEPPER_MAX),
        };
        if (
          key === 'bathroomInstallCounterCount' &&
          nextInstall.bathroomInstallCounterCount == null
        ) {
          setSelectedCountertopMaterial(null);
          materialWritePendingRef.current = false;
          queueMicrotask(() => {
            startTransition(() => {
              setMeasurements((m) => ({
                ...m,
                countertopSqft: '',
                bathroomVanityCountertopMaterialType: null,
              }));
            });
          });
        }
        commit(existing, nextInstall, gen);
        return nextInstall;
      });
    },
    [commit, existing, setMeasurements]
  );

  const adjustDemo = useCallback(
    (key: BathroomFixtureDemoOverrideKey, delta: number) => {
      const gen = ++genRef.current;
      setDemo((prev) => {
        const current = prev[key] ?? 0;
        const cleaned = clampQmCount(current + delta < 1 ? null : current + delta, BATHROOM_QM_STEPPER_MAX);
        const next = { ...prev, [key]: cleaned };
        demoRef.current = next;
        commit(existing, install, gen, { key, value: cleaned });
        return next;
      });
    },
    [commit, existing, install]
  );

  const existingCaption = showExistingPanel
    ? 'What is in the space now — set manually for notes-only jobs.'
    : 'Seeded from photos and notes when site photos are attached.';
  const fixtureCaption = showExistingPanel
    ? 'Set install and demo for this bid — auto-filled from existing + install.'
    : 'Set install and demo — auto-filled from photos, notes, and install.';

  const vanityFixtureGrey = qmNeutralScopePanelStyle(darkMode);

  const showCountertopSqft = (install.bathroomInstallCounterCount ?? 0) > 0;
  const countertopSqftValue = String(measurements.countertopSqft ?? '').trim();

  const handleCountertopMaterialPress = useCallback(
    (materialId: BathroomVanityCountertopMaterialType) => {
      const next = selectedCountertopMaterial === materialId ? null : materialId;
      materialWritePendingRef.current = true;
      setSelectedCountertopMaterial(next);
      queueMicrotask(() => {
        startTransition(() => {
          setMeasurements((prev) => ({
            ...prev,
            bathroomVanityCountertopMaterialType: next,
          }));
          onBathroomCountertopMaterialChange?.(next);
        });
      });
    },
    [selectedCountertopMaterial, onBathroomCountertopMaterialChange, setMeasurements]
  );

  return (
    <>
      {showExistingPanel ? (
        <QmScopePanelSection
          title="Existing fixtures"
          {...qmNeutralScopePanelStyle(darkMode)}
          caption={existingCaption}
          rows={BATHROOM_EXISTING_FIXTURE_ROWS}
          counts={existing as Record<string, number | null>}
          onAdjust={(key, d) => adjustExisting(key as keyof BathroomExistingFixtureCounts, d)}
          applying={applying}
          stepperMax={BATHROOM_QM_STEPPER_MAX}
          darkMode={darkMode}
          Colors={Colors}
        />
      ) : null}
      <QmScopePanelSection
        title="Vanity & countertop"
        titleColor={vanityFixtureGrey.titleColor}
        borderColor={vanityFixtureGrey.borderColor}
        backgroundColor={vanityFixtureGrey.backgroundColor}
        caption={fixtureCaption}
        rows={BATHROOM_VANITY_FIXTURE_ROWS}
        counts={{ ...install, ...demo } as Record<string, number | null>}
        onAdjust={(key, d) => {
          if (key === 'bathroomInstallVanityCount' || key === 'bathroomInstallCounterCount') {
            adjustInstall(key as keyof BathroomInstallFixtureCounts, d);
          } else if (key === 'bathroomDemoVanityCount' || key === 'bathroomDemoCounterCount') {
            adjustDemo(key as BathroomFixtureDemoOverrideKey, d);
          }
        }}
        applying={applying}
        stepperMax={BATHROOM_QM_STEPPER_MAX}
        darkMode={darkMode}
        Colors={Colors}
        footer={
          showCountertopSqft ? (
            <View style={{ gap: 12 }}>
              <View>
                <Text
                  style={{
                    color: vanityFixtureGrey.titleColor,
                    fontSize: 13,
                    fontWeight: '700',
                    marginBottom: 8,
                  }}
                >
                  Countertop material
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {BATHROOM_VANITY_COUNTERTOP_MATERIAL_OPTIONS.map((opt) => {
                    const active = selectedCountertopMaterial === opt.id;
                    return (
                      <Pressable
                        key={opt.id}
                        disabled={applying}
                        onPress={() => handleCountertopMaterialPress(opt.id)}
                        hitSlop={6}
                        style={({ pressed }) => ({
                          paddingHorizontal: 10,
                          paddingVertical: 8,
                          borderRadius: 999,
                          borderWidth: 1,
                          opacity: applying ? 0.55 : 1,
                          borderColor: active
                            ? Colors.primary
                            : vanityFixtureGrey.borderColor,
                          backgroundColor: active
                            ? darkMode
                              ? 'rgba(56, 189, 248, 0.14)'
                              : 'rgba(14, 165, 233, 0.08)'
                            : 'transparent',
                        })}
                      >
                        <Text
                          style={{
                            color: active ? Colors.primary : vanityFixtureGrey.titleColor,
                            fontSize: 12,
                            fontWeight: active ? '700' : '500',
                          }}
                        >
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <QmSqftMeasurementRow
                label="Countertop sqft"
                helperText="Vanity top or bath counter area — feeds vanity countertop pricing."
                value={countertopSqftValue}
                placeholder="e.g. 10"
                onChangeText={(text) => {
                  setMeasurements((prev) => ({ ...prev, countertopSqft: text }));
                }}
                applying={applying}
                darkMode={darkMode}
                Colors={Colors}
              />
            </View>
          ) : null
        }
      />
    </>
  );
}

const LANDSCAPING_SCOPE_OPTIONS: Array<{ id: string; label: string; measurementKey?: string; unit?: string }> = [
  { id: 'grading', label: 'Grading', measurementKey: 'gradingSqft', unit: 'sqft' },
  { id: 'soil_prep', label: 'Soil prep', measurementKey: 'soilPrepSqft', unit: 'sqft' },
  { id: 'drainage', label: 'Drainage', measurementKey: 'drainageLf', unit: 'LF' },
  { id: 'artificial_turf', label: 'Artificial turf', measurementKey: 'artificialTurfSqft', unit: 'sqft' },
  { id: 'sod', label: 'Sod', measurementKey: 'sodSqft', unit: 'sqft' },
  { id: 'rock', label: 'Rock', measurementKey: 'rockMulchSqft', unit: 'sqft' },
  { id: 'mulch', label: 'Mulch', measurementKey: 'rockMulchSqft', unit: 'sqft' },
  { id: 'plants', label: 'Plants', measurementKey: 'plantCount', unit: 'each' },
  { id: 'trees', label: 'Trees', measurementKey: 'treeCount', unit: 'each' },
  { id: 'irrigation', label: 'Irrigation', measurementKey: 'irrigationZoneCount', unit: 'zone' },
  { id: 'concrete_edging', label: 'Concrete edging', measurementKey: 'concreteEdgingLf', unit: 'LF' },
  { id: 'pavers', label: 'Pavers', measurementKey: 'paverSqft', unit: 'sqft' },
  { id: 'decorative_boulders', label: 'Decorative boulders', measurementKey: 'boulderCount', unit: 'each' },
  { id: 'landscape_lighting', label: 'Landscape lighting', measurementKey: 'landscapeLightCount', unit: 'each' },
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
  medium_vegetation: 'Thick brush, vines, heavier vegetation, shrubs, and small saplings.',
  dense_vegetation: 'Dense overgrowth or heavy vegetation requiring substantially more labor or equipment.',
  unsure: 'Use the medium planning allowance; review clearing conditions before bid.',
};

export function QmLandscapingScopePanels({
  measurements,
  setMeasurements,
  applying,
  measurementFooter,
  darkMode,
  Colors,
}: {
  measurements: ScopeMeasurementsInputExtended;
  setMeasurements: React.Dispatch<React.SetStateAction<ScopeMeasurementsInputExtended>>;
  applying: boolean;
  measurementFooter?: React.ReactNode;
  darkMode: boolean;
  Colors: Colors;
}) {
  const selected = readLandscapingScope(measurements as Record<string, unknown>);
  const demoActive = selected.includes('demo_clearing');
  const [demoExpanded, setDemoExpanded] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const toggle = (id: string) => {
    setMeasurements((prev) => {
      const current = readLandscapingScope(prev as Record<string, unknown>);
      const canonical = landscapingScopeCanonicalId(id);
      const isSelected = current.includes(id) || current.includes(canonical);
      const next = isSelected
        ? current.filter((value) => value !== id && value !== canonical)
        : [...current, id];
      return { ...prev, landscapeScope: next.length ? next : null } as ScopeMeasurementsInputExtended;
    });
  };
  const updateMeasurement = (key: string, value: string) => {
    setMeasurements((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <>
      <View
        style={[
          styles.qmPanel,
          {
            borderColor: darkMode ? 'rgba(148,163,184,0.28)' : 'rgba(100,116,139,0.24)',
            backgroundColor: darkMode ? 'rgba(148,163,184,0.06)' : 'rgba(148,163,184,0.05)',
          },
        ]}
      >
        <TouchableOpacity onPress={() => setDemoExpanded((value) => !value)} activeOpacity={0.75}>
          <Text style={[styles.qmPanelTitle, { color: darkMode ? '#cbd5e1' : '#475569' }]}>
            Demo / clearing {demoExpanded ? '⌃' : '⌄'}
          </Text>
          <Text style={[styles.qmPanelCaption, { color: darkMode ? '#94a3b8' : '#64748b', marginTop: 2 }]}>
            {demoExpanded ? 'Tap to collapse card' : demoActive ? 'Selected · tap to expand card' : 'Tap to expand card'}
          </Text>
        </TouchableOpacity>
        {demoExpanded ? (
          <>
            <Text style={[styles.qmPanelCaption, { color: darkMode ? '#94a3b8' : '#64748b', marginTop: 10 }]}>
              Vegetation and loose landscape debris removal only. Tree removal, excavation, hardscape demolition, and grading are separate.
            </Text>
            <TouchableOpacity
              onPress={() => toggle('demo_clearing')}
              disabled={applying}
              activeOpacity={1}
              style={[
                styles.qmOption,
                {
                  marginTop: 10,
                  borderColor: demoActive ? '#34d399' : darkMode ? '#52525b' : '#cbd5e1',
                  backgroundColor: demoActive ? 'rgba(52, 211, 153, 0.12)' : darkMode ? '#27272a' : '#f1f5f9',
                },
              ]}
            >
              <Text style={[styles.qmOptionText, { color: demoActive ? '#34d399' : darkMode ? '#e4e4e7' : Colors.text }]}>
                {demoActive ? '✓ ' : ''}Demo / clearing
              </Text>
            </TouchableOpacity>
            {demoActive ? (
              <>
            <QmSqftMeasurementRow
              label="Demo / clearing area"
              helperText="Vegetation and loose landscape debris only. Other demolition and excavation are separate."
              value={String(measurements.demoClearingSqft || '')}
              placeholder="Enter"
              unitLabel="sqft"
              onChangeText={(value) => updateMeasurement('demoClearingSqft', value)}
              applying={applying}
              darkMode={darkMode}
              Colors={Colors}
              highlighted
            />
            <Text style={[styles.qmPanelCaption, { color: darkMode ? '#F5F7FA' : Colors.text, marginTop: 10, marginBottom: 6 }]}>
              Clearing level
            </Text>
            <View style={styles.qmOptionWrap}>
              {LANDSCAPE_CLEARING_LEVEL_OPTIONS.map((level) => {
                const selectedLevel = measurements.landscapeClearingLevel === level.id;
                return (
                  <TouchableOpacity
                    key={level.id}
                    onPress={() => setMeasurements((prev) => ({ ...prev, landscapeClearingLevel: level.id }))}
                    disabled={applying}
                    activeOpacity={1}
                    style={[
                      styles.qmOption,
                      {
                        borderColor: selectedLevel ? '#34d399' : darkMode ? '#52525b' : '#cbd5e1',
                        backgroundColor: selectedLevel ? 'rgba(52, 211, 153, 0.12)' : darkMode ? '#27272a' : '#f1f5f9',
                      },
                    ]}
                  >
                    <Text style={[styles.qmOptionText, { color: selectedLevel ? '#34d399' : darkMode ? '#e4e4e7' : Colors.text }]}>
                      {selectedLevel ? '✓ ' : ''}{level.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {measurements.landscapeClearingLevel ? (
              <Text style={[styles.qmPanelCaption, { color: darkMode ? '#94a3b8' : '#64748b', marginTop: 6 }]}>
                {LANDSCAPE_CLEARING_LEVEL_HELPERS[measurements.landscapeClearingLevel]}
              </Text>
            ) : null}
            <Text style={[styles.qmPanelCaption, { color: darkMode ? '#94a3b8' : '#64748b', marginTop: 8 }]}>
              Tree removal, dirt excavation, hardscape demolition, and grading are priced separately.
            </Text>
              </>
            ) : null}
          </>
        ) : null}
      </View>
      <View
        style={[
          styles.qmPanel,
          {
            borderColor: darkMode ? 'rgba(148,163,184,0.28)' : 'rgba(100,116,139,0.24)',
            backgroundColor: darkMode ? 'rgba(148,163,184,0.06)' : 'rgba(148,163,184,0.05)',
          },
        ]}
      >
      <TouchableOpacity onPress={() => setExpanded((value) => !value)} activeOpacity={0.75}>
        <Text style={[styles.qmPanelTitle, { color: darkMode ? '#cbd5e1' : '#475569' }]}>
          Landscaping scope {expanded ? '⌃' : '⌄'}
        </Text>
        {expanded ? (
          <Text style={[styles.qmPanelCaption, { color: darkMode ? '#64748b' : '#94a3b8', marginTop: 2 }]}>
            Tap to collapse card
          </Text>
        ) : (
          <Text style={[styles.qmPanelCaption, { color: darkMode ? '#94a3b8' : '#64748b' }]}>
            {selected.length} selected landscape component{selected.length === 1 ? '' : 's'}
          </Text>
        )}
      </TouchableOpacity>
      {expanded ? (
        <>
          <Text style={[styles.qmPanelCaption, { color: darkMode ? '#94a3b8' : '#64748b' }]}>
            Select every landscape component in this bid. Use SF, LF, each, or zones as shown for each component.
          </Text>
      <View style={styles.qmOptionWrap}>
        {LANDSCAPING_SCOPE_OPTIONS.map((option) => {
          const canonical = landscapingScopeCanonicalId(option.id);
          const preferredAliasByCanonical: Record<string, string> = {
            sod_turf: 'sod',
            concrete: 'concrete_edging',
          };
          const hasAliasForThisComponent = selected.some(
            (value) => value !== canonical && landscapingScopeCanonicalId(value) === canonical
          );
          const active =
            selected.includes(option.id) ||
            (selected.includes(canonical) &&
              !hasAliasForThisComponent &&
              option.id === (preferredAliasByCanonical[canonical] || canonical));
          return (
            <React.Fragment key={option.id}>
              <TouchableOpacity
                onPress={() => toggle(option.id)}
                disabled={applying}
                activeOpacity={1}
                style={[
                  styles.qmOption,
                  {
                    borderColor: active ? '#34d399' : darkMode ? '#52525b' : '#cbd5e1',
                    backgroundColor: active ? 'rgba(52, 211, 153, 0.12)' : darkMode ? '#27272a' : '#f1f5f9',
                  },
                ]}
              >
                <Text style={[styles.qmOptionText, { color: active ? '#34d399' : darkMode ? '#e4e4e7' : Colors.text }]}>
                  {active ? '✓ ' : ''}{option.label}
                </Text>
              </TouchableOpacity>
              {active && option.measurementKey ? (
                <>
                  <QmSqftMeasurementRow
                    label={`${option.label} area`}
                    helperText="Use only the area assigned to this landscape component."
                    value={String((measurements as Record<string, unknown>)[option.measurementKey] || '')}
                    placeholder="Enter"
                    unitLabel={option.unit}
                    onChangeText={(value) => updateMeasurement(option.measurementKey!, value)}
                    applying={applying}
                    darkMode={darkMode}
                    Colors={Colors}
                    highlighted={active}
                  />
                  {option.id === 'demo_clearing' ? (
                    <View style={{ marginTop: 10 }}>
                      <Text style={[styles.qmPanelCaption, { color: darkMode ? '#F5F7FA' : Colors.text, marginBottom: 6 }]}>
                        Clearing level
                      </Text>
                      <View style={styles.qmOptionWrap}>
                        {LANDSCAPE_CLEARING_LEVEL_OPTIONS.map((level) => {
                          const selectedLevel = measurements.landscapeClearingLevel === level.id;
                          return (
                            <TouchableOpacity
                              key={level.id}
                              onPress={() =>
                                setMeasurements((prev) => ({
                                  ...prev,
                                  landscapeClearingLevel: level.id,
                                }))
                              }
                              disabled={applying}
                              activeOpacity={1}
                              style={[
                                styles.qmOption,
                                {
                                  borderColor: selectedLevel ? '#34d399' : darkMode ? '#52525b' : '#cbd5e1',
                                  backgroundColor: selectedLevel
                                    ? 'rgba(52, 211, 153, 0.12)'
                                    : darkMode
                                      ? '#27272a'
                                      : '#f1f5f9',
                                },
                              ]}
                            >
                              <Text style={[styles.qmOptionText, { color: selectedLevel ? '#34d399' : darkMode ? '#e4e4e7' : Colors.text }]}>
                                {selectedLevel ? '✓ ' : ''}{level.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      {measurements.landscapeClearingLevel ? (
                        <Text style={[styles.qmPanelCaption, { color: darkMode ? '#94a3b8' : '#64748b', marginTop: 6 }]}>
                          {LANDSCAPE_CLEARING_LEVEL_HELPERS[measurements.landscapeClearingLevel]}
                        </Text>
                      ) : null}
                      <Text style={[styles.qmPanelCaption, { color: darkMode ? '#94a3b8' : '#64748b', marginTop: 8 }]}>
                        Tree removal, dirt excavation, hardscape demolition, and grading are priced separately.
                      </Text>
                    </View>
                  ) : null}
                  <View
                    style={{
                      height: 8,
                      marginTop: 8,
                      borderTopWidth: 1,
                      borderTopColor: darkMode ? 'rgba(255,255,255,0.10)' : Colors.line,
                    }}
                  />
                </>
              ) : null}
            </React.Fragment>
          );
        })}
      </View>
      {selected.some((id) => ['rock', 'mulch', 'decorative_boulders'].includes(id)) ? (
        <>
          <QmSqftMeasurementRow
            label="Rock / mulch tonnage"
            helperText="Optional when the material is being estimated by weight."
            value={String((measurements as Record<string, unknown>).landscapeTons || '')}
            placeholder="Enter"
            unitLabel="tons"
            onChangeText={(value) => updateMeasurement('landscapeTons', value)}
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
              borderTopColor: darkMode ? 'rgba(255,255,255,0.10)' : Colors.line,
            }}
          />
        </>
      ) : null}
      {measurementFooter}
          <TouchableOpacity
            onPress={() => setExpanded(false)}
            activeOpacity={0.75}
            style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: darkMode ? 'rgba(255,255,255,0.12)' : Colors.line }}
          >
            <Text style={[styles.qmPanelCaption, { color: darkMode ? '#94a3b8' : '#64748b', textAlign: 'center' }]}>
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
  darkMode,
  Colors,
}: {
  measurements: ScopeMeasurementsInputExtended;
  setMeasurements: React.Dispatch<React.SetStateAction<ScopeMeasurementsInputExtended>>;
  applying: boolean;
  measurementFooter?: React.ReactNode;
  darkMode: boolean;
  Colors: Colors;
}) {
  const selected = readConcreteScope(measurements as Record<string, unknown>);
  const [expanded, setExpanded] = useState(true);
  const [sitePrepExpanded, setSitePrepExpanded] = useState(true);
  const [optionalExpanded, setOptionalExpanded] = useState(true);
  const flatworkActive = CONCRETE_FLATWORK_OPTIONS.some((option) => selected.includes(option.id));
  const selectedFlatworkOptions = CONCRETE_FLATWORK_OPTIONS.filter((option) => selected.includes(option.id));
  const concreteAreaByType = measurements.concreteAreaByType || {};
  const flatworkAreaTotal = selectedFlatworkOptions.reduce(
    (sum, option) => sum + (Number(concreteAreaByType[option.id]) || 0),
    0
  );
  const defaultThicknessForType = (id: string) => id === 'rv_pads' ? 5 : 4;
  const selectedDemoBands = measurements.concreteDemoThicknessBands?.length
    ? measurements.concreteDemoThicknessBands
    : measurements.concreteDemoThicknessBand
      ? [measurements.concreteDemoThicknessBand]
      : [];
  const demoAreaByThickness = measurements.concreteDemoAreaByThickness || {};
  const flatworkVolumeCrossCheckCy = selectedFlatworkOptions.reduce((sum, option) => {
    const area = Number(concreteAreaByType[option.id]) || 0;
    const thickness = Number(measurements.concreteThicknessByType?.[option.id]) || defaultThicknessForType(option.id);
    return sum + area * (thickness / 12) / 27;
  }, 0);
  const needsFlatworkArea =
    flatworkActive ||
    selected.includes('reinforcement') ||
    selected.includes('concrete_sealer') ||
    selected.includes('decorative_finish');

  const toggle = (id: string) => {
    setMeasurements((prev) => {
      const current = readConcreteScope(prev as Record<string, unknown>);
      const canonical = concreteScopeCanonicalId(id);
      const isSelected = current.includes(id) || current.includes(canonical);
      const next = isSelected
        ? current.filter((value) => value !== id && value !== canonical)
        : [...current, id];
      const nextFlatworkIds = CONCRETE_FLATWORK_OPTIONS
        .map((option) => option.id)
        .filter((flatworkId) => next.includes(flatworkId));
      const existingAreas = prev.concreteAreaByType || {};
      const nextAreas = Object.fromEntries(
        nextFlatworkIds
          .filter((flatworkId) => existingAreas[flatworkId] != null)
          .map((flatworkId) => [flatworkId, existingAreas[flatworkId]])
      );
      const nextAreaTotal = Object.values(nextAreas).reduce((sum, area) => sum + (Number(area) || 0), 0);
      const clearedDemoMeasurements = isSelected && canonical === 'demo_removal'
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
        concreteSqft: nextFlatworkIds.length > 1 && !Object.keys(nextAreas).length
          ? ''
          : nextAreaTotal > 0
            ? String(nextAreaTotal)
            : prev.concreteSqft,
      } as ScopeMeasurementsInputExtended;
    });
  };

  const updateMeasurement = (key: string, value: string) => {
    setMeasurements((prev) => ({ ...prev, [key]: value }));
  };
  const updateFlatworkArea = (id: string, value: string) => {
    setMeasurements((prev) => {
      const nextAreas = { ...(prev.concreteAreaByType || {}), [id]: value };
      const activeFlatworkIds = CONCRETE_FLATWORK_OPTIONS
        .map((option) => option.id)
        .filter((flatworkId) => readConcreteScope(prev as Record<string, unknown>).includes(flatworkId));
      const total = activeFlatworkIds.reduce((sum, flatworkId) => sum + (Number(nextAreas[flatworkId]) || 0), 0);
      return {
        ...prev,
        concreteAreaByType: nextAreas,
        concreteSqft: total > 0 ? String(total) : '',
      };
    });
  };
  const updateFlatworkThickness = (id: string, value: number) => {
    setMeasurements((prev) => ({
      ...prev,
      concreteThicknessByType: {
        ...(prev.concreteThicknessByType || {}),
        [id]: value,
      },
    }));
  };
  const toggleDemoThickness = (id: string) => {
    setMeasurements((prev) => {
      const current = prev.concreteDemoThicknessBands?.length
        ? prev.concreteDemoThicknessBands
        : prev.concreteDemoThicknessBand
          ? [prev.concreteDemoThicknessBand]
          : [];
      const selected = current.includes(id as typeof current[number]);
      const next = selected
        ? current.filter((band) => band !== id)
        : [...current, id as typeof current[number]];
      const nextAreas = { ...(prev.concreteDemoAreaByThickness || {}) };
      if (!selected && current.length === 1 && Number(prev.concreteDemoSqft) > 0 && Object.keys(nextAreas).length === 0) {
        nextAreas[current[0]] = Number(prev.concreteDemoSqft);
      }
      if (selected) delete nextAreas[id as keyof typeof nextAreas];
      const total = Object.values(nextAreas).reduce((sum, area) => sum + (Number(area) || 0), 0);
      return {
        ...prev,
        concreteDemoThicknessBands: next,
        concreteDemoThicknessBand: next.length === 1 ? next[0] : null,
        concreteDemoAreaByThickness: Object.keys(nextAreas).length ? nextAreas : null,
        concreteDemoSqft: total > 0 ? String(total) : next.length ? prev.concreteDemoSqft : '',
      };
    });
  };
  const updateDemoBandArea = (id: string, value: string) => {
    setMeasurements((prev) => {
      const nextAreas = { ...(prev.concreteDemoAreaByThickness || {}), [id]: value };
      const total = Object.values(nextAreas).reduce((sum, area) => sum + (Number(area) || 0), 0);
      return { ...prev, concreteDemoAreaByThickness: nextAreas, concreteDemoSqft: total > 0 ? String(total) : '' };
    });
  };
  const hasMeasurement = (key: string) => {
    const value = Number(String((measurements as Record<string, unknown>)[key] ?? '').replace(/,/g, ''));
    return Number.isFinite(value) && value > 0;
  };
  const selectedThickness = Number(measurements.concreteThicknessInches) || 4;
  const nationalFlatworkRate = 6 + 4 * (selectedThickness / 4);
  const sitePrepOptionIds = new Set(['demo_removal', 'site_prep', 'excavation']);
  const optionalOptionIds = new Set([
    'reinforcement',
    'complex_forming',
    'concrete_sealer',
    'decorative_finish',
    'additional_haul_off',
  ]);

  return (
    <View style={{ gap: 12 }}>
      <View
        style={[
          styles.qmPanel,
          {
            borderColor: darkMode ? 'rgba(148,163,184,0.28)' : 'rgba(100,116,139,0.24)',
            backgroundColor: darkMode ? 'rgba(148,163,184,0.06)' : 'rgba(148,163,184,0.05)',
          },
        ]}
      >
      <TouchableOpacity onPress={() => setExpanded((value) => !value)} activeOpacity={0.75}>
        <Text style={[styles.qmPanelTitle, { color: darkMode ? '#cbd5e1' : '#475569' }]}>
          Flatwork & footing/foundation pour {expanded ? '⌃' : '⌄'}
        </Text>
        <Text style={[styles.qmPanelCaption, { color: darkMode ? '#94a3b8' : '#64748b', marginTop: 2 }]}>
          {expanded ? 'Tap to collapse card' : selected.length ? 'Selected · tap to expand card' : 'Tap to expand card'}
        </Text>
      </TouchableOpacity>
      {expanded ? (
        <>
          <Text style={[styles.qmPanelCaption, { color: darkMode ? '#94a3b8' : '#64748b', marginTop: 10 }]}>
            Select the flatwork type and any additional work beyond the standard installation.
          </Text>
          <Text style={[styles.qmPanelCaption, { color: '#fbbf24', marginTop: 4, marginBottom: 0 }]}>
            Standard flatwork includes normal forming, placement, basic finish, curing, and cleanup. Add only upgrades or work beyond the standard scope.
          </Text>

          <Text style={[styles.qmPanelCaption, { color: darkMode ? '#F5F7FA' : Colors.text, marginTop: 14, marginBottom: 6 }]}>
            Flatwork type
          </Text>
          <View style={styles.qmOptionWrap}>
            {CONCRETE_FLATWORK_OPTIONS.map((option) => {
              const active = selected.includes(option.id);
              return (
                <TouchableOpacity
                  key={option.id}
                  onPress={() => toggle(option.id)}
                  disabled={applying}
                  activeOpacity={1}
                  style={[
                    styles.qmOption,
                    {
                      borderColor: active ? '#34d399' : darkMode ? '#52525b' : '#cbd5e1',
                      backgroundColor: active ? 'rgba(52, 211, 153, 0.12)' : darkMode ? '#27272a' : '#f1f5f9',
                    },
                  ]}
                >
                  <Text style={[styles.qmOptionText, { color: active ? '#34d399' : darkMode ? '#e4e4e7' : Colors.text }]}>
                    {active ? '✓ ' : ''}{option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {needsFlatworkArea ? (
            <>
              {flatworkActive ? (
                <>
                  <Text style={[styles.qmPanelCaption, { color: darkMode ? '#cbd5e1' : Colors.text, marginTop: 8, marginBottom: 6 }]}>
                    Area by flatwork type
                  </Text>
                  <Text style={[styles.qmPanelCaption, { color: darkMode ? '#94a3b8' : '#64748b', marginBottom: 6 }]}>
                    Enter each selected area separately. Pricing uses the combined total of these entries at ${nationalFlatworkRate.toFixed(2)}/sqft for a {selectedThickness}" slab.
                  </Text>
                  {selectedFlatworkOptions.map((option) => (
                    <React.Fragment key={option.id}>
                      <QmSqftMeasurementRow
                        label={`${option.label} area`}
                        helperText={`Area for this ${option.label.toLowerCase()} only.`}
                        value={String(concreteAreaByType[option.id] ?? (selectedFlatworkOptions.length === 1 ? measurements.concreteSqft || '' : ''))}
                        placeholder="Enter"
                        unitLabel="sqft"
                        onChangeText={(value) => updateFlatworkArea(option.id, value)}
                        applying={applying}
                        darkMode={darkMode}
                        Colors={Colors}
                        highlighted
                      />
                      <Text style={[styles.qmPanelCaption, { color: darkMode ? '#cbd5e1' : Colors.text, marginTop: 6, marginBottom: 4 }]}>
                        {option.label} thickness
                      </Text>
                      <View style={styles.qmOptionWrap}>
                        {CONCRETE_SLAB_THICKNESS_OPTIONS.map((thickness) => {
                          const selectedTypeThickness =
                            Number(measurements.concreteThicknessByType?.[option.id]) || defaultThicknessForType(option.id);
                          const thicknessActive = selectedTypeThickness === thickness.inches;
                          return (
                            <TouchableOpacity
                              key={`${option.id}-${thickness.id}`}
                              onPress={() => updateFlatworkThickness(option.id, thickness.inches)}
                              disabled={applying}
                              activeOpacity={1}
                              style={[
                                styles.qmOption,
                                {
                                  borderColor: thicknessActive ? '#34d399' : darkMode ? '#52525b' : '#cbd5e1',
                                  backgroundColor: thicknessActive ? 'rgba(52, 211, 153, 0.12)' : darkMode ? '#27272a' : '#f1f5f9',
                                },
                              ]}
                            >
                              <Text style={[styles.qmOptionText, { color: thicknessActive ? '#34d399' : darkMode ? '#e4e4e7' : Colors.text }]}>
                                {thicknessActive ? '✓ ' : ''}{thickness.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </React.Fragment>
                  ))}
                  {selectedFlatworkOptions.length > 1 && flatworkAreaTotal <= 0 ? (
                    <Text style={{ color: '#fbbf24', fontSize: 11, marginTop: 8 }}>
                      Enter the square footage for each selected flatwork type before pricing.
                    </Text>
                  ) : null}
                </>
              ) : (
                <QmSqftMeasurementRow
                  label="Flatwork pour area"
                  helperText={`Combined slab, sidewalk, driveway, or patio area. National average pricing uses this area at $${nationalFlatworkRate.toFixed(2)}/sqft for a ${selectedThickness}" slab.`}
                  value={String(measurements.concreteSqft || '')}
                  placeholder="Enter"
                  unitLabel="sqft"
                  onChangeText={(value) => updateMeasurement('concreteSqft', value)}
                  applying={applying}
                  darkMode={darkMode}
                  Colors={Colors}
                  highlighted
                />
              )}
              {Object.keys(concreteAreaByType).length > 0 ? (
                <View style={{ marginTop: 12 }}>
                  <Text style={[styles.qmPanelCaption, { color: darkMode ? '#cbd5e1' : Colors.text, marginBottom: 4 }]}>
                    Concrete volume cross-check
                  </Text>
                  <Text style={[styles.qmPanelCaption, { color: darkMode ? '#94a3b8' : '#64748b', marginBottom: 0 }]}>
                    Approximately {flatworkVolumeCrossCheckCy.toFixed(1)} CY based on each selected type’s area and thickness. This is informational only and does not replace sqft pricing.
                  </Text>
                </View>
              ) : null}
              {!flatworkActive && !hasMeasurement('concreteSqft') ? (
                <Text style={{ color: '#fbbf24', fontSize: 11, marginTop: 8 }}>
                  Enter the combined pour area to price flatwork.
                </Text>
              ) : null}
              <View
                style={{
                  height: 8,
                  marginTop: 8,
                  borderTopWidth: 1,
                  borderTopColor: darkMode ? 'rgba(255,255,255,0.10)' : Colors.line,
                }}
              />
            </>
          ) : null}

          <View style={{ marginTop: 14 }}>
            <Text style={[styles.qmPanelCaption, { color: darkMode ? '#cbd5e1' : Colors.text, fontWeight: '700' }]}>
              Footing / foundation concrete pour
            </Text>
            <Text style={[styles.qmPanelCaption, { color: darkMode ? '#94a3b8' : '#64748b', marginTop: 2 }]}>
              Structural concrete is separate from exterior flatwork and is priced by CY.
            </Text>
            {CONCRETE_SCOPE_OPTIONS.filter((option) => option.id === 'pour_foundation').map((option) => {
              const active = selected.includes(option.id) || selected.includes('footings');
              return (
                <React.Fragment key={option.id}>
                  <TouchableOpacity
                    onPress={() => toggle(option.id)}
                    disabled={applying}
                    activeOpacity={1}
                    style={[
                      styles.qmOption,
                      {
                        marginTop: 10,
                        borderColor: active ? '#34d399' : darkMode ? '#52525b' : '#cbd5e1',
                        backgroundColor: active ? 'rgba(52, 211, 153, 0.12)' : darkMode ? '#27272a' : '#f1f5f9',
                      },
                    ]}
                  >
                    <Text style={[styles.qmOptionText, { color: active ? '#34d399' : darkMode ? '#e4e4e7' : Colors.text }]}>
                      {active ? '✓ ' : ''}{option.label}
                    </Text>
                  </TouchableOpacity>
                  {active && 'measurementKey' in option && option.measurementKey ? (
                    <QmSqftMeasurementRow
                      label="Footing / foundation concrete quantity"
                      helperText="Enter separate footing or foundation concrete CY. Excavation, forms, reinforcement, waterproofing, and accessories are separate."
                      value={String((measurements as Record<string, unknown>)[option.measurementKey] || '')}
                      placeholder="Enter"
                      unitLabel={option.unit}
                      onChangeText={(value) => updateMeasurement(option.measurementKey!, value)}
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

        </>
      ) : null}
    </View>
    {expanded ? (
      <>
        <View
          style={[
            styles.qmPanel,
            {
              borderColor: darkMode ? 'rgba(148,163,184,0.28)' : 'rgba(100,116,139,0.24)',
              backgroundColor: darkMode ? 'rgba(148,163,184,0.06)' : 'rgba(148,163,184,0.05)',
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => setSitePrepExpanded((value) => !value)}
            activeOpacity={0.75}
            style={{ marginTop: 14, marginBottom: 4 }}
          >
            <Text style={[styles.qmPanelCaption, { color: darkMode ? '#cbd5e1' : Colors.text, fontWeight: '700' }]}>
              Site prep & existing conditions {sitePrepExpanded ? '⌃' : '⌄'}
            </Text>
            <Text style={[styles.qmPanelCaption, { color: darkMode ? '#94a3b8' : '#64748b', marginTop: 2 }]}>
              Demo, grading, excavation, and other site conditions.
            </Text>
          </TouchableOpacity>
          {sitePrepExpanded
            ? CONCRETE_SCOPE_OPTIONS.filter((option) => sitePrepOptionIds.has(option.id)).map((option) => {
                const active =
                  selected.includes(option.id) ||
                  (option.id === 'pour_foundation' && selected.includes('footings'));
                return (
                  <React.Fragment key={option.id}>
                    <TouchableOpacity
                      onPress={() => toggle(option.id)}
                      disabled={applying}
                      activeOpacity={1}
                      style={[
                        styles.qmOption,
                        {
                          marginTop: 10,
                          borderColor: active ? '#34d399' : darkMode ? '#52525b' : '#cbd5e1',
                          backgroundColor: active ? 'rgba(52, 211, 153, 0.12)' : darkMode ? '#27272a' : '#f1f5f9',
                        },
                      ]}
                    >
                      <Text style={[styles.qmOptionText, { color: active ? '#34d399' : darkMode ? '#e4e4e7' : Colors.text }]}>
                        {active ? '✓ ' : ''}{option.label}
                      </Text>
                    </TouchableOpacity>
                    {active && 'measurementKey' in option && option.measurementKey ? (
                      <>
                        {option.id !== 'demo_removal' && option.id !== 'excavation' ? (
                          <QmSqftMeasurementRow
                            label={option.label}
                            helperText={'helperText' in option ? option.helperText : undefined}
                            value={String((measurements as Record<string, unknown>)[option.measurementKey] || '')}
                            placeholder="Enter"
                            unitLabel={option.unit}
                            onChangeText={(value) => updateMeasurement(option.measurementKey!, value)}
                            applying={applying}
                            darkMode={darkMode}
                            Colors={Colors}
                            highlighted
                          />
                        ) : null}
                        {option.id !== 'demo_removal' && option.id !== 'excavation' && !hasMeasurement(option.measurementKey) ? (
                          <Text style={{ color: '#fbbf24', fontSize: 11, marginTop: 5 }}>
                            Quantity needed before this scope can be priced.
                          </Text>
                        ) : null}
                        {option.id === 'demo_removal' ? (
                          <>
                            {selectedDemoBands.map((band) => {
                              const bandLabel = CONCRETE_DEMO_THICKNESS_OPTIONS.find((item) => item.id === band)?.label || band;
                              return (
                                <QmSqftMeasurementRow
                                  key={`${band}-demo-area`}
                                  label={`${bandLabel} demo area`}
                                  helperText="Enter the area for this concrete thickness."
                                  value={String(demoAreaByThickness[band] ?? (selectedDemoBands.length === 1 ? measurements.concreteDemoSqft || '' : ''))}
                                  placeholder="Enter"
                                  unitLabel="sqft"
                                  onChangeText={(value) => updateDemoBandArea(band, value)}
                                  applying={applying}
                                  darkMode={darkMode}
                                  Colors={Colors}
                                  highlighted
                                />
                              );
                            })}
                            <Text style={[styles.qmPanelCaption, { color: darkMode ? '#cbd5e1' : Colors.text, marginTop: 10, marginBottom: 6 }]}>
                              Existing concrete thickness · select all that apply
                            </Text>
                            <View style={styles.qmOptionWrap}>
                              {CONCRETE_DEMO_THICKNESS_OPTIONS.map((thickness) => {
                                const activeThickness = selectedDemoBands.includes(thickness.id);
                                return (
                                  <TouchableOpacity
                                    key={thickness.id}
                                    onPress={() => toggleDemoThickness(thickness.id)}
                                    disabled={applying}
                                    activeOpacity={1}
                                    style={[
                                      styles.qmOption,
                                      {
                                        borderColor: activeThickness ? '#34d399' : darkMode ? '#52525b' : '#cbd5e1',
                                        backgroundColor: activeThickness ? 'rgba(52, 211, 153, 0.12)' : darkMode ? '#27272a' : '#f1f5f9',
                                      },
                                    ]}
                                  >
                                    <Text style={[styles.qmOptionText, { color: activeThickness ? '#34d399' : darkMode ? '#e4e4e7' : Colors.text }]}>
                                      {activeThickness ? '✓ ' : ''}{thickness.label}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                            <Text style={[styles.qmPanelCaption, { color: darkMode ? '#cbd5e1' : Colors.text, marginTop: 10, marginBottom: 4 }]}>
                              Demolition conditions · select all that apply
                            </Text>
                            <TouchableOpacity
                              onPress={() => setMeasurements((prev) => ({ ...prev, concreteDemoReinforced: !prev.concreteDemoReinforced }))}
                              disabled={applying}
                              activeOpacity={1}
                              style={[
                                styles.qmOption,
                                {
                                  marginTop: 10,
                                  borderColor: measurements.concreteDemoReinforced ? '#34d399' : darkMode ? '#52525b' : '#cbd5e1',
                                  backgroundColor: measurements.concreteDemoReinforced ? 'rgba(52, 211, 153, 0.12)' : darkMode ? '#27272a' : '#f1f5f9',
                                },
                              ]}
                            >
                              <Text style={[styles.qmOptionText, { color: measurements.concreteDemoReinforced ? '#34d399' : darkMode ? '#e4e4e7' : Colors.text }]}>
                                {measurements.concreteDemoReinforced ? '✓ ' : ''}Reinforced concrete · +$1.25/sqft
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => setMeasurements((prev) => ({ ...prev, concreteDemoLimitedAccess: !prev.concreteDemoLimitedAccess }))}
                              disabled={applying}
                              activeOpacity={1}
                              style={[
                                styles.qmOption,
                                {
                                  marginTop: 8,
                                  borderColor: measurements.concreteDemoLimitedAccess ? '#34d399' : darkMode ? '#52525b' : '#cbd5e1',
                                  backgroundColor: measurements.concreteDemoLimitedAccess ? 'rgba(52, 211, 153, 0.12)' : darkMode ? '#27272a' : '#f1f5f9',
                                },
                              ]}
                            >
                              <Text style={[styles.qmOptionText, { color: measurements.concreteDemoLimitedAccess ? '#34d399' : darkMode ? '#e4e4e7' : Colors.text }]}>
                                {measurements.concreteDemoLimitedAccess ? '✓ ' : ''}Limited access · +$1.50/sqft
                              </Text>
                            </TouchableOpacity>
                            {selectedDemoBands.includes('structural_7_plus') ? (
                              <QmSqftMeasurementRow
                                label="Heavy / structural demo quantity"
                                helperText="Enter demolition CY for the $175/CY review allowance, or use custom pricing."
                                value={String(measurements.concreteDemoCy || '')}
                                placeholder="Enter"
                                unitLabel="CY"
                                onChangeText={(value) => updateMeasurement('concreteDemoCy', value)}
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
                            <Text style={[styles.qmPanelCaption, { color: darkMode ? '#cbd5e1' : Colors.text, marginTop: 10, marginBottom: 6 }]}>
                              How would you like to enter excavation quantity?
                            </Text>
                            <View style={styles.qmOptionWrap}>
                              {([
                                { id: 'direct_cy', label: 'Enter cubic yards directly' },
                                { id: 'area_depth', label: 'Calculate from area + depth' },
                              ] as const).map((mode) => {
                                const selectedMode =
                                  measurements.excavationQuantityMode ||
                                  (Number(measurements.excavationAreaSqft) > 0 && Number(measurements.excavationDepthInches) > 0
                                    ? 'area_depth'
                                    : 'direct_cy');
                                const modeActive = selectedMode === mode.id;
                                return (
                                  <TouchableOpacity
                                    key={mode.id}
                                    onPress={() =>
                                      setMeasurements((prev) =>
                                        mode.id === 'direct_cy'
                                          ? {
                                              ...prev,
                                              excavationQuantityMode: 'direct_cy',
                                              excavationAreaSqft: '',
                                              excavationDepthInches: '',
                                            }
                                          : {
                                              ...prev,
                                              excavationQuantityMode: 'area_depth',
                                              excavationCy: '',
                                            }
                                      )
                                    }
                                    disabled={applying}
                                    activeOpacity={1}
                                    style={[
                                      styles.qmOption,
                                      {
                                        borderColor: modeActive ? '#34d399' : darkMode ? '#52525b' : '#cbd5e1',
                                        backgroundColor: modeActive ? 'rgba(52, 211, 153, 0.12)' : darkMode ? '#27272a' : '#f1f5f9',
                                      },
                                    ]}
                                  >
                                    <Text style={[styles.qmOptionText, { color: modeActive ? '#34d399' : darkMode ? '#e4e4e7' : Colors.text }]}>
                                      {modeActive ? '✓ ' : ''}{mode.label}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                            {(measurements.excavationQuantityMode ||
                              (Number(measurements.excavationAreaSqft) > 0 && Number(measurements.excavationDepthInches) > 0
                                ? 'area_depth'
                                : 'direct_cy')) === 'direct_cy' ? (
                              <QmSqftMeasurementRow
                                label="Direct excavation quantity"
                                helperText="This CY value controls pricing. Area and depth are not used in this mode."
                                value={String(measurements.excavationCy || '')}
                                placeholder="Enter"
                                unitLabel="CY"
                                onChangeText={(value) => updateMeasurement('excavationCy', value)}
                                applying={applying}
                                darkMode={darkMode}
                                Colors={Colors}
                                highlighted
                              />
                            ) : (
                              <>
                                <QmSqftMeasurementRow
                                  label="Excavation area"
                                  helperText="Enter the affected excavation area."
                                  value={String(measurements.excavationAreaSqft || '')}
                                  placeholder="Enter"
                                  unitLabel="sqft"
                                  onChangeText={(value) => updateMeasurement('excavationAreaSqft', value)}
                                  applying={applying}
                                  darkMode={darkMode}
                                  Colors={Colors}
                                  highlighted
                                />
                                <QmSqftMeasurementRow
                                  label="Excavation depth"
                                  helperText="Use for dirt/soil removal; imported fill and off-site disposal remain separate."
                                  value={String(measurements.excavationDepthInches || '')}
                                  placeholder="Enter"
                                  unitLabel="in"
                                  onChangeText={(value) => updateMeasurement('excavationDepthInches', value)}
                                  applying={applying}
                                  darkMode={darkMode}
                                  Colors={Colors}
                                  highlighted
                                />
                                {Number(measurements.excavationAreaSqft) > 0 && Number(measurements.excavationDepthInches) > 0 ? (
                                  <Text style={{ color: darkMode ? '#94a3b8' : '#64748b', fontSize: 11, marginTop: 5 }}>
                                    Calculated excavation quantity: {(Number(measurements.excavationAreaSqft) * (Number(measurements.excavationDepthInches) / 12) / 27).toFixed(1)} CY
                                  </Text>
                                ) : (
                                  <Text style={{ color: '#fbbf24', fontSize: 11, marginTop: 5 }}>
                                    Enter both area and depth before this scope can be priced.
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
        <View
          style={[
            styles.qmPanel,
            {
              borderColor: darkMode ? 'rgba(148,163,184,0.28)' : 'rgba(100,116,139,0.24)',
              backgroundColor: darkMode ? 'rgba(148,163,184,0.06)' : 'rgba(148,163,184,0.05)',
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => setOptionalExpanded((value) => !value)}
            activeOpacity={0.75}
            style={{ marginTop: 14, marginBottom: 4 }}
          >
            <Text style={[styles.qmPanelCaption, { color: darkMode ? '#cbd5e1' : Colors.text, fontWeight: '700' }]}>
              Optional additions {optionalExpanded ? '⌃' : '⌄'}
            </Text>
            <Text style={[styles.qmPanelCaption, { color: darkMode ? '#94a3b8' : '#64748b', marginTop: 2 }]}>
              Reinforcement, complex forming, upgrades, and excess disposal.
            </Text>
          </TouchableOpacity>
          {optionalExpanded
            ? CONCRETE_SCOPE_OPTIONS.filter((option) => optionalOptionIds.has(option.id)).map((option) => {
                const active = selected.includes(option.id);
                return (
                  <React.Fragment key={option.id}>
                    {option.id === 'additional_haul_off' ? (
                      <View
                        style={{
                          marginTop: 8,
                          borderTopWidth: 1,
                          borderTopColor: darkMode ? 'rgba(255,255,255,0.12)' : Colors.line,
                        }}
                      />
                    ) : null}
                    <TouchableOpacity
                      onPress={() => toggle(option.id)}
                      disabled={applying}
                      activeOpacity={1}
                      style={[
                        styles.qmOption,
                        {
                          marginTop: 10,
                          borderColor: active ? '#34d399' : darkMode ? '#52525b' : '#cbd5e1',
                          backgroundColor: active ? 'rgba(52, 211, 153, 0.12)' : darkMode ? '#27272a' : '#f1f5f9',
                        },
                      ]}
                    >
                      <Text style={[styles.qmOptionText, { color: active ? '#34d399' : darkMode ? '#e4e4e7' : Colors.text }]}>
                        {active ? '✓ ' : ''}{option.label}
                      </Text>
                    </TouchableOpacity>
                    {active && option.id === 'decorative_finish' ? (
                      <View
                        style={{
                          marginTop: 8,
                          marginBottom: 8,
                        }}
                      >
                        <Text style={[styles.qmPanelCaption, { color: darkMode ? '#cbd5e1' : Colors.text, marginBottom: 6 }]}>
                          Decorative finish upgrade · select one
                        </Text>
                        <View style={styles.qmOptionWrap}>
                          {CONCRETE_DECORATIVE_FINISH_OPTIONS.map((finish) => {
                            const selectedFinish = measurements.concreteDecorativeFinish || 'integral_color';
                            const finishActive = selectedFinish === finish.id;
                            return (
                              <TouchableOpacity
                                key={finish.id}
                                onPress={() => setMeasurements((prev) => ({ ...prev, concreteDecorativeFinish: finish.id }))}
                                disabled={applying}
                                activeOpacity={1}
                                style={[
                                  styles.qmOption,
                                  {
                                    borderColor: finishActive ? '#34d399' : darkMode ? '#52525b' : '#cbd5e1',
                                    backgroundColor: finishActive
                                      ? 'rgba(52, 211, 153, 0.12)'
                                      : darkMode
                                        ? '#27272a'
                                        : '#f1f5f9',
                                  },
                                ]}
                              >
                                <Text style={[styles.qmOptionText, { color: finishActive ? '#34d399' : darkMode ? '#e4e4e7' : Colors.text }]}>
                                  {finishActive ? '✓ ' : ''}{finish.label} · +${finish.rate.toFixed(2)}/sqft
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    ) : null}
                    {active && 'measurementKey' in option && option.measurementKey ? (
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
                          value={String((measurements as Record<string, unknown>)[option.measurementKey] || '')}
                          placeholder="Enter"
                          unitLabel={option.unit}
                          onChangeText={(value) => updateMeasurement(option.measurementKey!, value)}
                          applying={applying}
                          darkMode={darkMode}
                          Colors={Colors}
                          highlighted
                        />
                        {!hasMeasurement(option.measurementKey) ? (
                          <Text style={{ color: '#fbbf24', fontSize: 11, marginTop: 5 }}>
                            Quantity needed before this scope can be priced.
                          </Text>
                        ) : null}
                        {option.id === 'additional_haul_off' && Number((measurements as Record<string, unknown>)[option.measurementKey]) > 0 ? (
                          <Text style={{ color: darkMode ? '#94a3b8' : '#64748b', fontSize: 11, marginTop: 5 }}>
                            {Number((measurements as Record<string, unknown>)[option.measurementKey])} load
                            {Number((measurements as Record<string, unknown>)[option.measurementKey]) === 1 ? '' : 's'} = $
                            {(Number((measurements as Record<string, unknown>)[option.measurementKey]) * 400).toLocaleString()}
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
            style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: darkMode ? 'rgba(255,255,255,0.12)' : Colors.line }}
          >
            <Text style={[styles.qmPanelCaption, { color: darkMode ? '#94a3b8' : '#64748b', textAlign: 'center' }]}>
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
    backgroundColor: darkMode ? 'rgba(148,163,184,0.06)' : 'rgba(148,163,184,0.05)',
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
  setMeasurements: React.Dispatch<React.SetStateAction<ScopeMeasurementsInputExtended>>;
  applying: boolean;
  darkMode: boolean;
  Colors: Colors;
}) {
  const spec = simpleTradeSpec(scopeKey);
  const hasMeasurement = (key: string) => {
    const value = Number(String((measurements as Record<string, unknown>)[key] ?? '').replace(/,/g, ''));
    return Number.isFinite(value) && value > 0;
  };

  return (
    <View style={styles.qmOptionWrap}>
      {options.map((option) => {
        const canonicalSelected = selections.includes(option.canonicalId);
        const hasAlias = selections.some((value) => spec.options.some((candidate) => candidate.id === value));
        const firstCanonicalOption = spec.options.find((candidate) => candidate.canonicalId === option.canonicalId)?.id;
        const active =
          selections.includes(option.id) ||
          (canonicalSelected && !hasAlias && option.id === firstCanonicalOption);
        return (
          <React.Fragment key={option.id}>
            <TouchableOpacity
              onPress={() => onToggle(option.id, option.canonicalId)}
              disabled={applying}
              activeOpacity={1}
              style={[
                styles.qmOption,
                {
                  borderColor: active ? '#34d399' : darkMode ? '#52525b' : '#cbd5e1',
                  backgroundColor: active ? 'rgba(52, 211, 153, 0.12)' : darkMode ? '#27272a' : '#f1f5f9',
                },
              ]}
            >
              <Text style={[styles.qmOptionText, { color: active ? '#34d399' : darkMode ? '#e4e4e7' : Colors.text }]}>
                {active ? '✓ ' : ''}{option.label}
              </Text>
            </TouchableOpacity>
            {active && option.measurementKey ? (
              <>
                <QmSqftMeasurementRow
                  label={`${option.label} quantity`}
                  helperText={
                    option.measurementHelper ||
                    'Enter only the quantity for this selected component.'
                  }
                  value={String((measurements as Record<string, unknown>)[option.measurementKey] || '')}
                  placeholder="Enter"
                  unitLabel={option.unit}
                  onChangeText={(value) => setMeasurements((prev) => ({ ...prev, [option.measurementKey!]: value }))}
                  applying={applying}
                  darkMode={darkMode}
                  Colors={Colors}
                  highlighted
                />
                {!hasMeasurement(option.measurementKey) ? (
                  <Text style={{ color: '#fbbf24', fontSize: 11, marginTop: 5 }}>
                    Quantity needed before this scope can be priced.
                  </Text>
                ) : null}
              </>
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
  applying,
  darkMode,
  Colors,
}: {
  measurements: ScopeMeasurementsInputExtended;
  setMeasurements: React.Dispatch<React.SetStateAction<ScopeMeasurementsInputExtended>>;
  onScopeSelectionChange?: (measurements: Record<string, unknown>) => void;
  applying: boolean;
  darkMode: boolean;
  Colors: Colors;
}) {
  const scopeKey: SimpleTradeScopeKey = 'roofing';
  const selections = measurements.tradeScopeSelections?.[scopeKey] || [];
  const [installExpanded, setInstallExpanded] = useState(true);
  const [demoExpanded, setDemoExpanded] = useState(true);
  const [accessoryExpanded, setAccessoryExpanded] = useState(true);
  const panelStyle = qmPanelShellStyle(darkMode);

  const toggle = (id: string, _canonicalId: string) => {
    const selected = selections.includes(id);
    const next = selected
      ? selections.filter((value) => value !== id)
      : [...selections, id];
    setMeasurements((prev) => ({
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
  const installSelected = installOptions.some(
    (option) => selections.includes(option.id) || selections.includes(option.canonicalId)
  );

  return (
    <View style={{ gap: 12 }}>
      <View style={[styles.qmPanel, panelStyle]}>
        <TouchableOpacity onPress={() => setInstallExpanded((value) => !value)} activeOpacity={0.75}>
          <Text style={[styles.qmPanelTitle, { color: darkMode ? '#cbd5e1' : '#475569' }]}>
            Roofing install scope {installExpanded ? '⌃' : '⌄'}
          </Text>
          <Text style={[styles.qmPanelCaption, { color: darkMode ? '#94a3b8' : '#64748b', marginTop: 2 }]}>
            {installExpanded
              ? 'Tap to collapse card'
              : installSelected
                ? 'Selected · tap to expand card'
                : 'Tap to expand card'}
          </Text>
        </TouchableOpacity>
        {installExpanded ? (
          <>
            <Text style={[styles.qmPanelCaption, { color: darkMode ? '#94a3b8' : '#64748b', marginTop: 10 }]}>
              Select every install component included in this bid. Measurements feed the corresponding pricing cards.
            </Text>
            <Text style={[styles.qmPanelCaption, { color: '#fbbf24', marginTop: 4, marginBottom: 0 }]}>
              Standard roofing includes normal underlayment, shingles, drip edge, and perimeter cleanup. Add only upgrades or work beyond the standard scope.
            </Text>
            <Text style={[styles.qmPanelCaption, { color: darkMode ? '#F5F7FA' : Colors.text, marginTop: 14, marginBottom: 6 }]}>
              Install components
            </Text>
            <QmTradeScopeOptionList
              options={installOptions}
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
        ) : null}
      </View>

      {installExpanded ? (
        <>
          <View style={[styles.qmPanel, panelStyle]}>
            <TouchableOpacity onPress={() => setDemoExpanded((value) => !value)} activeOpacity={0.75}>
              <Text style={[styles.qmPanelCaption, { color: darkMode ? '#cbd5e1' : Colors.text, fontWeight: '700' }]}>
                Existing roof / tear-off {demoExpanded ? '⌃' : '⌄'}
              </Text>
              <Text style={[styles.qmPanelCaption, { color: darkMode ? '#94a3b8' : '#64748b', marginTop: 2 }]}>
                Tear-off, disposal, and existing roof conditions.
              </Text>
            </TouchableOpacity>
            {demoExpanded ? (
              <QmTradeScopeOptionList
                options={demoOptions}
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

          <View style={[styles.qmPanel, panelStyle]}>
            <TouchableOpacity onPress={() => setAccessoryExpanded((value) => !value)} activeOpacity={0.75}>
              <Text style={[styles.qmPanelCaption, { color: darkMode ? '#cbd5e1' : Colors.text, fontWeight: '700' }]}>
                Ventilation & accessories {accessoryExpanded ? '⌃' : '⌄'}
              </Text>
              <Text style={[styles.qmPanelCaption, { color: darkMode ? '#94a3b8' : '#64748b', marginTop: 2 }]}>
                Vents, penetrations, repairs, and closeout extras.
              </Text>
            </TouchableOpacity>
            {accessoryExpanded ? (
              <QmTradeScopeOptionList
                options={accessoryOptions}
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

          <View style={[styles.qmPanel, panelStyle]}>
            <Text style={[styles.qmPanelCaption, { color: darkMode ? '#cbd5e1' : Colors.text, fontWeight: '700' }]}>
              Other / drainage
            </Text>
            <Text style={[styles.qmPanelCaption, { color: darkMode ? '#94a3b8' : '#64748b', marginTop: 2 }]}>
              Gutters and downspouts priced independently by LF and each.
            </Text>
            <QmTradeScopeOptionList
              options={drainageOptions}
              selections={selections}
              scopeKey={scopeKey}
              onToggle={toggle}
              measurements={measurements}
              setMeasurements={setMeasurements}
              applying={applying}
              darkMode={darkMode}
              Colors={Colors}
            />
            <TouchableOpacity
              onPress={() => setInstallExpanded(false)}
              activeOpacity={0.75}
              style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: darkMode ? 'rgba(255,255,255,0.12)' : Colors.line }}
            >
              <Text style={[styles.qmPanelCaption, { color: darkMode ? '#94a3b8' : '#64748b', textAlign: 'center' }]}>
                Collapse card ⌃
              </Text>
            </TouchableOpacity>
          </View>
        </>
      ) : null}
    </View>
  );
}

function parseStuccoMeasurement(value: unknown): number {
  const parsed = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function reconcileStuccoNetWall(
  measurements: ScopeMeasurementsInputExtended
): Pick<ScopeMeasurementsInputExtended, 'stuccoNetWallSqft' | 'exteriorPaintSqft' | 'quickMeasurementSources'> {
  const gross = parseStuccoMeasurement(measurements.stuccoGrossWallSqft);
  const hasWindowDoorInput = String(measurements.stuccoWindowDoorOpeningSqft ?? '').trim() !== '';
  const hasGarageInput = String(measurements.stuccoGarageOpeningSqft ?? '').trim() !== '';
  const hasOtherFinishInput = String(measurements.stuccoOtherFinishDeductionSqft ?? '').trim() !== '';
  if (!gross || !(hasWindowDoorInput || hasGarageInput || hasOtherFinishInput)) {
    return {};
  }
  const openings =
    parseStuccoMeasurement(measurements.stuccoWindowDoorOpeningSqft) +
    parseStuccoMeasurement(measurements.stuccoGarageOpeningSqft) +
    parseStuccoMeasurement(measurements.stuccoOtherFinishDeductionSqft);
  const net = String(Math.max(0, gross - openings));
  return {
    stuccoNetWallSqft: net,
    exteriorPaintSqft: net,
    quickMeasurementSources: {
      ...(measurements.quickMeasurementSources || {}),
      stuccoNetWallSqft: 'calculated_from_deductions',
      exteriorPaintSqft: 'calculated_from_deductions',
    },
  };
}

export function QmStuccoScopePanels({
  measurements,
  setMeasurements,
  applying,
  darkMode,
  Colors,
}: {
  measurements: ScopeMeasurementsInputExtended;
  setMeasurements: React.Dispatch<React.SetStateAction<ScopeMeasurementsInputExtended>>;
  applying: boolean;
  darkMode: boolean;
  Colors: Colors;
}) {
  const [wallExpanded, setWallExpanded] = useState(true);
  const [addonsExpanded, setAddonsExpanded] = useState(true);
  const [accessExpanded, setAccessExpanded] = useState(true);
  const panelStyle = qmPanelShellStyle(darkMode);

  const updateMeasurement = (key: keyof ScopeMeasurementsInputExtended, value: string) => {
    setMeasurements((prev) => {
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

  const hasMeasurement = (key: string) => parseStuccoMeasurement((measurements as Record<string, unknown>)[key]) > 0;
  const netWall = parseStuccoMeasurement(measurements.stuccoNetWallSqft);
  const grossWall = parseStuccoMeasurement(measurements.stuccoGrossWallSqft);

  return (
    <View style={{ gap: 12 }}>
      <View style={[styles.qmPanel, panelStyle]}>
        <TouchableOpacity onPress={() => setWallExpanded((value) => !value)} activeOpacity={0.75}>
          <Text style={[styles.qmPanelTitle, { color: darkMode ? '#cbd5e1' : '#475569' }]}>
            Stucco wall takeoff {wallExpanded ? '⌃' : '⌄'}
          </Text>
          <Text style={[styles.qmPanelCaption, { color: darkMode ? '#94a3b8' : '#64748b', marginTop: 2 }]}>
            {wallExpanded ? 'Tap to collapse card' : grossWall > 0 ? 'Entered · tap to expand card' : 'Tap to expand card'}
          </Text>
        </TouchableOpacity>
        {wallExpanded ? (
          <>
            <Text style={[styles.qmPanelCaption, { color: darkMode ? '#94a3b8' : '#64748b', marginTop: 10 }]}>
              Enter gross wall area and deduct openings to reach net stucco wall area.
            </Text>
            <Text style={[styles.qmPanelCaption, { color: '#fbbf24', marginTop: 4, marginBottom: 0 }]}>
              Net wall area drives stucco system pricing. Deduct window, door, garage, and other finish areas before pricing.
            </Text>
            <QmSqftMeasurementRow
              label="Exterior wall area — gross"
              helperText="Total exterior wall surface before opening deductions."
              value={String(measurements.stuccoGrossWallSqft || '')}
              placeholder="Enter"
              unitLabel="sqft"
              onChangeText={(value) => updateMeasurement('stuccoGrossWallSqft', value)}
              applying={applying}
              darkMode={darkMode}
              Colors={Colors}
              highlighted
            />
            <QmSqftMeasurementRow
              label="Window & door openings"
              helperText="Combined window and door opening area to deduct."
              value={String(measurements.stuccoWindowDoorOpeningSqft || '')}
              placeholder="Enter"
              unitLabel="sqft"
              onChangeText={(value) => updateMeasurement('stuccoWindowDoorOpeningSqft', value)}
              applying={applying}
              darkMode={darkMode}
              Colors={Colors}
              highlighted
            />
            <QmSqftMeasurementRow
              label="Garage door openings"
              helperText="Garage opening area to deduct from gross wall area."
              value={String(measurements.stuccoGarageOpeningSqft || '')}
              placeholder="Enter"
              unitLabel="sqft"
              onChangeText={(value) => updateMeasurement('stuccoGarageOpeningSqft', value)}
              applying={applying}
              darkMode={darkMode}
              Colors={Colors}
              highlighted
            />
            <QmSqftMeasurementRow
              label="Other finish deductions"
              helperText="Stone, brick, siding, panels, or other areas not receiving stucco."
              value={String(measurements.stuccoOtherFinishDeductionSqft || '')}
              placeholder="Enter"
              unitLabel="sqft"
              onChangeText={(value) => updateMeasurement('stuccoOtherFinishDeductionSqft', value)}
              applying={applying}
              darkMode={darkMode}
              Colors={Colors}
              highlighted
            />
            <QmSqftMeasurementRow
              label="Net stucco wall area"
              helperText={netWall > 0 ? 'Calculated from gross wall area minus openings.' : 'Enter gross wall area and opening deductions to calculate net area.'}
              value={String(measurements.stuccoNetWallSqft || '')}
              placeholder="Calculated"
              unitLabel="sqft"
              onChangeText={(value) => updateMeasurement('stuccoNetWallSqft', value)}
              applying={applying}
              darkMode={darkMode}
              Colors={Colors}
              highlighted
            />
            {grossWall > 0 && netWall <= 0 ? (
              <Text style={{ color: '#fbbf24', fontSize: 11, marginTop: 8 }}>
                Enter opening deductions before this scope can be priced.
              </Text>
            ) : null}
          </>
        ) : null}
      </View>

      {wallExpanded ? (
        <>
          <View style={[styles.qmPanel, panelStyle]}>
            <TouchableOpacity onPress={() => setAddonsExpanded((value) => !value)} activeOpacity={0.75}>
              <Text style={[styles.qmPanelCaption, { color: darkMode ? '#cbd5e1' : Colors.text, fontWeight: '700' }]}>
                Add-ons & architectural details {addonsExpanded ? '⌃' : '⌄'}
              </Text>
              <Text style={[styles.qmPanelCaption, { color: darkMode ? '#94a3b8' : '#64748b', marginTop: 2 }]}>
                Soffits, parapets, foam trim, and control joints.
              </Text>
            </TouchableOpacity>
            {addonsExpanded ? (
              <>
                <QmSqftMeasurementRow
                  label="Soffits / stucco ceilings"
                  helperText="Soffit or stucco ceiling area priced separately from wall area."
                  value={String(measurements.stuccoSoffitSqft || '')}
                  placeholder="Enter"
                  unitLabel="sqft"
                  onChangeText={(value) => updateMeasurement('stuccoSoffitSqft', value)}
                  applying={applying}
                  darkMode={darkMode}
                  Colors={Colors}
                  highlighted
                />
                <QmSqftMeasurementRow
                  label="Parapets / raised walls"
                  helperText="Parapet or raised wall stucco area."
                  value={String(measurements.stuccoParapetSqft || '')}
                  placeholder="Enter"
                  unitLabel="sqft"
                  onChangeText={(value) => updateMeasurement('stuccoParapetSqft', value)}
                  applying={applying}
                  darkMode={darkMode}
                  Colors={Colors}
                  highlighted
                />
                <QmSqftMeasurementRow
                  label="Foam trim / architectural bands"
                  helperText="Linear foam trim or banding."
                  value={String(measurements.stuccoFoamTrimLf || '')}
                  placeholder="Enter"
                  unitLabel="LF"
                  onChangeText={(value) => updateMeasurement('stuccoFoamTrimLf', value)}
                  applying={applying}
                  darkMode={darkMode}
                  Colors={Colors}
                  highlighted
                />
                <QmSqftMeasurementRow
                  label="Control / expansion joints"
                  helperText="Linear control or expansion joint length."
                  value={String(measurements.stuccoControlJointLf || '')}
                  placeholder="Enter"
                  unitLabel="LF"
                  onChangeText={(value) => updateMeasurement('stuccoControlJointLf', value)}
                  applying={applying}
                  darkMode={darkMode}
                  Colors={Colors}
                  highlighted
                />
              </>
            ) : null}
          </View>

          <View style={[styles.qmPanel, panelStyle]}>
            <TouchableOpacity onPress={() => setAccessExpanded((value) => !value)} activeOpacity={0.75}>
              <Text style={[styles.qmPanelCaption, { color: darkMode ? '#cbd5e1' : Colors.text, fontWeight: '700' }]}>
                Access & site conditions {accessExpanded ? '⌃' : '⌄'}
              </Text>
              <Text style={[styles.qmPanelCaption, { color: darkMode ? '#94a3b8' : '#64748b', marginTop: 2 }]}>
                Story height, access difficulty, and localized repair areas.
              </Text>
            </TouchableOpacity>
            {accessExpanded ? (
              <>
                <QmSqftMeasurementRow
                  label="Stories"
                  helperText="Number of stories affecting access and staging."
                  value={String(measurements.stuccoStories || '')}
                  placeholder="1"
                  unitLabel="story"
                  onChangeText={(value) => updateMeasurement('stuccoStories', value)}
                  applying={applying}
                  darkMode={darkMode}
                  Colors={Colors}
                  highlighted
                />
                <QmSqftMeasurementRow
                  label="Typical wall height / story"
                  helperText="Average wall height per story for access planning."
                  value={String(measurements.stuccoWallHeightFt || '')}
                  placeholder="Enter"
                  unitLabel="ft"
                  onChangeText={(value) => updateMeasurement('stuccoWallHeightFt', value)}
                  applying={applying}
                  darkMode={darkMode}
                  Colors={Colors}
                  highlighted
                />
                <QmSqftMeasurementRow
                  label="Access-affected area"
                  helperText="Wall area requiring special access, staging, or protection."
                  value={String(measurements.stuccoAccessAffectedSqft || '')}
                  placeholder="Enter"
                  unitLabel="sqft"
                  onChangeText={(value) => updateMeasurement('stuccoAccessAffectedSqft', value)}
                  applying={applying}
                  darkMode={darkMode}
                  Colors={Colors}
                  highlighted
                />
                <QmSqftMeasurementRow
                  label="Localized repair area"
                  helperText="Patch or repair-only stucco area priced separately from full system work."
                  value={String(measurements.stuccoRepairAffectedSqft || '')}
                  placeholder="Enter"
                  unitLabel="sqft"
                  onChangeText={(value) => updateMeasurement('stuccoRepairAffectedSqft', value)}
                  applying={applying}
                  darkMode={darkMode}
                  Colors={Colors}
                  highlighted
                />
                {!hasMeasurement('stuccoGrossWallSqft') && !hasMeasurement('stuccoRepairAffectedSqft') ? (
                  <Text style={{ color: '#fbbf24', fontSize: 11, marginTop: 8 }}>
                    Enter gross wall area or localized repair area before pricing.
                  </Text>
                ) : null}
              </>
            ) : null}
            <TouchableOpacity
              onPress={() => setWallExpanded(false)}
              activeOpacity={0.75}
              style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: darkMode ? 'rgba(255,255,255,0.12)' : Colors.line }}
            >
              <Text style={[styles.qmPanelCaption, { color: darkMode ? '#94a3b8' : '#64748b', textAlign: 'center' }]}>
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
  onScopeSelectionChange,
  applying,
  darkMode,
  Colors,
}: {
  scopeKey: SimpleTradeScopeKey;
  measurements: ScopeMeasurementsInputExtended;
  setMeasurements: React.Dispatch<React.SetStateAction<ScopeMeasurementsInputExtended>>;
  onScopeSelectionChange?: (measurements: Record<string, unknown>) => void;
  applying: boolean;
  darkMode: boolean;
  Colors: Colors;
}) {
  const spec = simpleTradeSpec(scopeKey);
  const selections = measurements.tradeScopeSelections?.[scopeKey] || [];
  const toggle = (id: string, _canonicalId: string) => {
    // Selections are option IDs, not canonical checklist IDs. Multiple
    // options may intentionally converge on one checklist item (for example,
    // Roofing underlayment and Ice & water shield).
    const selected = selections.includes(id);
    const next = selected
      ? selections.filter((value) => value !== id)
      : [...selections, id];
    setMeasurements((prev) => ({
      ...prev,
      tradeScopeSelections: {
        ...(prev.tradeScopeSelections || {}),
        [scopeKey]: next.length ? next : null,
      },
    }));
    // Sync the Confirm Scope checklist in the same interaction as the
    // selector. The effect in the parent remains as a rehydration safety net,
    // but this prevents the new roofing card from waiting for a later render.
    onScopeSelectionChange?.({
      ...measurements,
      tradeScopeSelections: {
        ...(measurements.tradeScopeSelections || {}),
        [scopeKey]: next.length ? next : null,
      },
    });
  };

  return (
    <View
      style={[
        styles.qmPanel,
        {
          borderColor: darkMode ? 'rgba(148,163,184,0.28)' : 'rgba(100,116,139,0.24)',
          backgroundColor: darkMode ? 'rgba(148,163,184,0.06)' : 'rgba(148,163,184,0.05)',
        },
      ]}
    >
      <Text style={[styles.qmPanelTitle, { color: darkMode ? '#cbd5e1' : '#475569' }]}>
        {scopeKey === 'deck_patio' ? 'Deck & fence scope' : `${scopeKey.charAt(0).toUpperCase()}${scopeKey.slice(1)} scope`}
      </Text>
      <Text style={[styles.qmPanelCaption, { color: darkMode ? '#94a3b8' : '#64748b' }]}>
        Select every component included in this bid. Measurements feed the corresponding pricing cards.
      </Text>
      <View style={styles.qmOptionWrap}>
        {spec.options.map((option) => {
          const canonicalSelected = selections.includes(option.canonicalId);
          const hasAlias = selections.some((value) => spec.options.some((candidate) => candidate.id === value));
          const firstCanonicalOption = spec.options.find((candidate) => candidate.canonicalId === option.canonicalId)?.id;
          const active =
            selections.includes(option.id) ||
            (canonicalSelected && !hasAlias && option.id === firstCanonicalOption);
          return (
            <React.Fragment key={option.id}>
              <TouchableOpacity
                onPress={() => toggle(option.id, option.canonicalId)}
                disabled={applying}
                activeOpacity={1}
                style={[
                  styles.qmOption,
                  {
                    borderColor: active ? '#34d399' : darkMode ? '#52525b' : '#cbd5e1',
                    backgroundColor: active ? 'rgba(52, 211, 153, 0.12)' : darkMode ? '#27272a' : '#f1f5f9',
                  },
                ]}
              >
                <Text style={[styles.qmOptionText, { color: active ? '#34d399' : darkMode ? '#e4e4e7' : Colors.text }]}>
                  {active ? '✓ ' : ''}{option.label}
                </Text>
              </TouchableOpacity>
              {active && option.measurementKey ? (
                <QmSqftMeasurementRow
                  label={`${option.label} measurement`}
                  helperText="Enter only the quantity for this selected component."
                  value={String((measurements as Record<string, unknown>)[option.measurementKey] || '')}
                  placeholder="Enter"
                  unitLabel={option.unit}
                  onChangeText={(value) => setMeasurements((prev) => ({ ...prev, [option.measurementKey!]: value }))}
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
  const demo = resolveKitchenDemoFromIntent({ notes: params.notes, existing, install });
  return { ...measurements, ...existing, ...install, ...demo };
}

export function seedFlooringQmFromIntent(
  measurements: Record<string, unknown>,
  params: { notes?: string | null; hasSitePhotos?: boolean }
): Record<string, unknown> {
  const hasSaved = readFlooringInstall(measurements).flooringInstallScopeCount != null;
  if (hasSaved) return measurements;
  const existing = params.hasSitePhotos
    ? inferExistingFlooringFromNotes(params.notes)
    : emptyFlooringExisting();
  const install = inferFlooringInstallFromIntent({ notes: params.notes });
  const demo = resolveFlooringDemoFromIntent({ notes: params.notes, existing, install });
  return { ...measurements, ...existing, ...install, ...demo };
}

export function seedBathroomFixturesQmFromIntent(
  measurements: Record<string, unknown>,
  params: { notes?: string | null; hasSitePhotos?: boolean }
): Record<string, unknown> {
  const hasSaved =
    readBathroomInstallFixtureCounts(measurements).bathroomInstallVanityCount != null ||
    readBathroomInstallFixtureCounts(measurements).bathroomInstallCounterCount != null ||
    readBathroomDemoFixtureCounts(measurements).bathroomDemoVanityCount != null ||
    readBathroomDemoFixtureCounts(measurements).bathroomDemoCounterCount != null;
  if (hasSaved) return measurements;
  const existing = params.hasSitePhotos
    ? inferExistingBathroomFixturesFromNotes(params.notes)
    : emptyBathroomExistingFixtureCounts();
  const install = inferBathroomFixtureInstallFromIntent({ notes: params.notes });
  const demo = resolveBathroomFixtureDemoFromIntent({ notes: params.notes, existing, install });
  return { ...measurements, ...existing, ...install, ...demo };
}
