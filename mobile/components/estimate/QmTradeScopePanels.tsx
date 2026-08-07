import React, { startTransition, useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
  FLOOR_PREP_SEVERITY_OPTIONS,
  recommendFloorPrepSeverity,
  type FloorPrepSeverity,
} from '@/utils/flooringDemoPrepBoundary';
import {
  landscapingScopeCanonicalId,
  readLandscapingScope,
} from '@/utils/qmScopePanels/landscapingRemodel';
import { simpleTradeSpec, type SimpleTradeScopeKey } from '@/utils/qmScopePanels/simpleTradeRemodel';
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
    <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: darkMode ? 'rgba(255,255,255,0.08)' : Colors.line }}>
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
          borderColor: highlighted ? '#FACC15' : darkMode ? 'rgba(255,255,255,0.16)' : Colors.line,
          backgroundColor: highlighted ? (darkMode ? '#27272a' : '#f1f5f9') : darkMode ? '#111111' : Colors.surface,
          paddingHorizontal: 10,
          minHeight: 38,
        }}
      >
        <TextInput
          value={formattedValue}
          onChangeText={onChangeText}
          onFocus={onFocus}
          onBlur={onBlur}
          editable={!applying}
          keyboardType="decimal-pad"
          placeholder={placeholder || 'sqft'}
          placeholderTextColor={darkMode ? 'rgba(255,255,255,0.35)' : '#94a3b8'}
          style={{
            flex: 1,
            color: highlighted ? '#FEF3C7' : darkMode ? '#F5F7FA' : Colors.text,
            paddingVertical: Platform.OS === 'ios' ? 8 : 6,
            fontSize: 14,
            fontWeight: '600',
            minWidth: 0,
          }}
        />
        <Text style={{ color: highlighted ? '#FDE68A' : captionColor(darkMode, Colors), fontSize: 11, fontWeight: '700', marginLeft: 6, flexShrink: 0 }}>
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
  measurementsRef.current = measurements;

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
        flooringProductScope: nextProducts.length ? nextProducts : null,
        ...nextInstall,
        ...mergedDemo,
        ...(nextProducts.includes('lvp') ? {} : { flooringLvpSqft: null }),
        ...(nextProducts.includes('laminate') ? {} : { flooringLaminateSqft: null }),
        ...(nextProducts.includes('engineered_hardwood') ? {} : { flooringEngineeredHardwoodSqft: null }),
        ...(nextProducts.includes('solid_hardwood') ? {} : { flooringSolidHardwoodSqft: null }),
        ...(nextProducts.includes('tile') ? {} : { flooringTileSqft: null }),
        ...(nextProducts.includes('carpet') ? {} : { flooringCarpetSqft: null }),
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
    if (!key) {
      const quantityKey = `floor_install__${product}`;
      if (value.trim() && Number.isFinite(numericValue) && numericValue > 0) {
        itemQuantities[quantityKey] = { quantity: numericValue, unit: 'sqft', quantitySource: 'user_entered' };
      } else {
        delete itemQuantities[quantityKey];
      }
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
        </View>
      ) : null}
      <View
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
      </View>
        {selectedNewFlooringOptions.length > 0 ? (
          <View
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
                          opacity: applying ? 0.55 : pressed ? 0.88 : 1,
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
  { id: 'demo_clearing', label: 'Demo / clearing' },
  { id: 'grading', label: 'Grading' },
  { id: 'soil_prep', label: 'Soil prep' },
  { id: 'drainage', label: 'Drainage' },
  { id: 'artificial_turf', label: 'Artificial turf', measurementKey: 'sodSqft', unit: 'sqft' },
  { id: 'sod', label: 'Sod', measurementKey: 'sodSqft', unit: 'sqft' },
  { id: 'rock', label: 'Rock', measurementKey: 'rockMulchSqft', unit: 'sqft' },
  { id: 'mulch', label: 'Mulch', measurementKey: 'rockMulchSqft', unit: 'sqft' },
  { id: 'plants', label: 'Plants', measurementKey: 'landscapeSqft', unit: 'sqft' },
  { id: 'trees', label: 'Trees', measurementKey: 'landscapeSqft', unit: 'sqft' },
  { id: 'irrigation', label: 'Irrigation', measurementKey: 'landscapeSqft', unit: 'sqft' },
  { id: 'concrete_edging', label: 'Concrete edging', measurementKey: 'concreteSqft', unit: 'sqft' },
  { id: 'pavers', label: 'Pavers', measurementKey: 'paverSqft', unit: 'sqft' },
  { id: 'decorative_boulders', label: 'Decorative boulders', measurementKey: 'rockMulchSqft', unit: 'sqft' },
  { id: 'landscape_lighting', label: 'Landscape lighting' },
  { id: 'mobilization', label: 'Equipment / mobilization' },
  { id: 'cleanup', label: 'Cleanup, haul-off & disposal' },
];

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
  const toggle = (id: string) => {
    const canonical = landscapingScopeCanonicalId(id);
    const isSelected = selected.includes(id) || selected.includes(canonical);
    const next = isSelected
      ? selected.filter((value) => value !== id && value !== canonical)
      : [...selected, id];
    setMeasurements((prev) => ({ ...prev, landscapeScope: next.length ? next : null } as ScopeMeasurementsInputExtended));
  };
  const updateMeasurement = (key: string, value: string) => {
    setMeasurements((prev) => ({ ...prev, [key]: value }));
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
      <Text style={[styles.qmPanelTitle, { color: darkMode ? '#cbd5e1' : '#475569' }]}>Landscaping scope</Text>
      <Text style={[styles.qmPanelCaption, { color: darkMode ? '#94a3b8' : '#64748b' }]}>
        Select every landscape component in this bid. Measurements are mostly SF; use coverage area for plant, tree, and irrigation work.
      </Text>
      <View style={styles.qmOptionWrap}>
        {LANDSCAPING_SCOPE_OPTIONS.map((option) => {
          const canonical = landscapingScopeCanonicalId(option.id);
          const hasDisplayAlias = selected.some((id) => ['artificial_turf', 'sod', 'rock', 'mulch', 'decorative_boulders', 'plants', 'trees', 'concrete_edging'].includes(id));
          const active = selected.includes(option.id) || (selected.includes(canonical) && !hasDisplayAlias && option.id === (
            canonical === 'sod_turf'
              ? 'artificial_turf'
              : canonical === 'rock_mulch'
                ? 'rock'
                : canonical === 'plants_trees'
                  ? 'plants'
                  : canonical === 'concrete'
                    ? 'concrete_edging'
                    : canonical
          ));
          return (
            <React.Fragment key={option.id}>
              <TouchableOpacity
                onPress={() => toggle(option.id)}
                disabled={applying}
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
                  label={`${option.label} area`}
                  helperText="Use only the area assigned to this landscape component."
                  value={String((measurements as Record<string, unknown>)[option.measurementKey] || '')}
                  placeholder="Enter"
                  onChangeText={(value) => updateMeasurement(option.measurementKey!, value)}
                  applying={applying}
                  darkMode={darkMode}
                  Colors={Colors}
                />
              ) : null}
            </React.Fragment>
          );
        })}
      </View>
      {selected.some((id) => ['rock', 'mulch', 'decorative_boulders'].includes(id)) ? (
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
        />
      ) : null}
      {measurementFooter}
    </View>
  );
}

export function QmSimpleTradeScopePanels({
  scopeKey,
  measurements,
  setMeasurements,
  applying,
  darkMode,
  Colors,
}: {
  scopeKey: SimpleTradeScopeKey;
  measurements: ScopeMeasurementsInputExtended;
  setMeasurements: React.Dispatch<React.SetStateAction<ScopeMeasurementsInputExtended>>;
  applying: boolean;
  darkMode: boolean;
  Colors: Colors;
}) {
  const spec = simpleTradeSpec(scopeKey);
  const selections = measurements.tradeScopeSelections?.[scopeKey] || [];
  const toggle = (id: string, canonicalId: string) => {
    const selected = selections.includes(id) || selections.includes(canonicalId);
    const next = selected
      ? selections.filter((value) => value !== id && value !== canonicalId)
      : [...selections, id];
    setMeasurements((prev) => ({
      ...prev,
      tradeScopeSelections: {
        ...(prev.tradeScopeSelections || {}),
        [scopeKey]: next.length ? next : null,
      },
    }));
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
