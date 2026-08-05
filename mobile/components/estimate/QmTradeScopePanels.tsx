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
  return darkMode ? 'rgba(245,247,250,0.62)' : Colors.sub;
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

function QmSqftMeasurementRow({
  label,
  helperText,
  value,
  placeholder,
  onChangeText,
  applying,
  darkMode,
  Colors,
}: {
  label: string;
  helperText?: string;
  value: string;
  placeholder?: string;
  onChangeText: (text: string) => void;
  applying: boolean;
  darkMode: boolean;
  Colors: Colors;
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
      <Text style={{ color: darkMode ? '#F5F7FA' : Colors.text, fontSize: 13, fontWeight: '600', marginBottom: 4 }}>
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
          onChangeText={onChangeText}
          editable={!applying}
          keyboardType="decimal-pad"
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
          sqft
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
  measurementFooter?: React.ReactNode;
  measurementFootersByKey?: Partial<Record<string, React.ReactNode>>;
  darkMode: boolean;
  Colors: Colors;
}) {
  const [existing, setExisting] = useState(() => readFlooringExisting(measurements));
  const [install, setInstall] = useState(() => readFlooringInstall(measurements));
  const [demo, setDemo] = useState(() => readFlooringDemo(measurements));
  const genRef = useRef(0);
  const appliedRef = useRef(0);
  const demoManualRef = useRef(false);

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
          setMeasurements((prev) => ({ ...prev, ...nextExisting, ...nextInstall, ...mergedDemo }));
          appliedRef.current = genRef.current;
          onFlooringQmChange?.({ existing: nextExisting, install: nextInstall, demo: mergedDemo });
        });
      });
    },
    [measurements, notes, onFlooringQmChange, setMeasurements]
  );

  const existingFlooringOptions: Array<{
    id: NonNullable<FlooringExistingCounts['flooringExistingTypes']>[number];
    label: string;
  }> = [
    { id: 'carpet', label: 'Carpet' },
    { id: 'tile', label: 'Tile' },
    { id: 'hardwood', label: 'Hardwood' },
    { id: 'engineered_hardwood', label: 'Engineered Hardwood' },
    { id: 'laminate', label: 'Laminate' },
    { id: 'lvp', label: 'LVP' },
    { id: 'vinyl', label: 'Vinyl' },
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
      const nextDemoTotal = nextTypes.reduce(
        (sum, existingType) =>
          sum + Number(measurements.itemQuantities?.[existingDemoAreaKey(existingType)]?.quantity || 0),
        0
      );
      const gen = ++genRef.current;
      commit(nextExisting, install, gen);
      setExisting(nextExisting);
      const itemQuantities = { ...(measurements.itemQuantities || {}) };
      if (nextDemoTotal > 0) {
        itemQuantities.floor_demo = {
          quantity: nextDemoTotal,
          unit: 'sqft',
          quantitySource: 'user_entered',
        };
      } else {
        delete itemQuantities.floor_demo;
      }
      setMeasurements((prev) => ({
        ...prev,
        ...nextExisting,
        floorDemoSqft: nextDemoTotal > 0 ? nextDemoTotal : null,
        itemQuantities,
        quickMeasurementSources: {
          ...(prev.quickMeasurementSources || {}),
          floorDemoSqft: nextDemoTotal > 0 ? 'user_entered' : 'needs_confirmation',
        },
      }));
    },
    [commit, existing, install, measurements.itemQuantities, setMeasurements]
  );

  const newFlooringOptions: Array<{
    id: NonNullable<ScopeMeasurementsInputExtended['flooringProductScope']>[number];
    label: string;
  }> = [
    { id: 'lvp', label: 'LVP' },
    { id: 'laminate', label: 'Laminate' },
    { id: 'engineered_hardwood', label: 'Engineered Hardwood' },
    { id: 'solid_hardwood', label: 'Solid Hardwood' },
    { id: 'tile', label: 'Tile' },
    { id: 'carpet', label: 'Carpet' },
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
      const gen = ++genRef.current;
      commit(existing, nextInstall, gen);
      setMeasurements((prev) => ({
        ...prev,
        flooringProductScope: nextProducts.length ? nextProducts : null,
        ...nextInstall,
      }));
      setInstall(nextInstall);
    },
    [commit, existing, measurements.flooringProductScope, setMeasurements]
  );

  const transitionForProduct = (product: string) =>
    (measurements.floorPrepTransitions || []).find((transition) => transition.newProduct === product) || null;

  const setFloorPrepTransition = (
    product: string,
    patch: Partial<{ existingType: string; sqft: number; prepLevel: 0 | 1 | 2 | 3 | 4 }>
  ) => {
    setMeasurements((prev) => {
      const current = Array.isArray(prev.floorPrepTransitions) ? prev.floorPrepTransitions : [];
      const existingTransition = current.find((transition) => transition.newProduct === product);
      const nextTransition = {
        existingType: patch.existingType ?? existingTransition?.existingType ?? '',
        newProduct: product,
        sqft: patch.sqft ?? existingTransition?.sqft ?? 0,
        prepLevel: patch.prepLevel ?? existingTransition?.prepLevel ?? null,
      };
      const next = [
        ...current.filter((transition) => transition.newProduct !== product),
        nextTransition,
      ];
      const totalPrepSqft = next.reduce((sum, transition) => sum + Number(transition.sqft || 0), 0);
      return { ...prev, floorPrepTransitions: next, floorPrepSqft: totalPrepSqft || null };
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
  const setExistingDemoArea = (
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
    setMeasurements((prev) => ({
      ...prev,
      floorDemoSqft: total > 0 ? total : null,
      itemQuantities,
      quickMeasurementSources: {
        ...(prev.quickMeasurementSources || {}),
        floorDemoSqft: total > 0 ? 'user_entered' : 'needs_confirmation',
      },
      quickMeasurementUserOverrides: {
        ...(prev.quickMeasurementUserOverrides || {}),
        floorDemoSqft: true,
      },
    }));
  };

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
          <Text style={[styles.qmPanelTitle, { color: darkMode ? '#cbd5e1' : '#475569' }]}>Existing flooring</Text>
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
                  {selected && option.id !== 'unknown' ? (
                    <QmSqftMeasurementRow
                      label={`${option.label} removal area`}
                      helperText="Enter the area of this existing flooring type being removed."
                      value={existingDemoArea(option.id)}
                      placeholder="Enter"
                      onChangeText={(value) => setExistingDemoArea(option.id, value)}
                      applying={applying}
                      darkMode={darkMode}
                      Colors={Colors}
                    />
                  ) : null}
                </React.Fragment>
              );
            })}
          </View>
          {existing.flooringExistingTypes?.includes('vinyl') ? (
            <View style={{ marginTop: 10 }}>
              <Text style={[styles.qmPanelCaption, { color: darkMode ? '#94a3b8' : '#64748b', marginBottom: 6 }]}>
                How is the existing vinyl installed?
              </Text>
              <View style={styles.qmOptionWrap}>
                {[
                  ['sheet_vct', 'Sheet Vinyl / VCT'],
                  ['glue_down', 'Glue-down Vinyl / LVP'],
                  ['floating', 'Floating Vinyl / LVP'],
                  ['unknown', 'Not sure'],
                ].map(([id, label]) => {
                  const selected = measurements.flooringExistingVinylMethod === id;
                  return (
                    <TouchableOpacity
                      key={id}
                      onPress={() => setMeasurements((prev) => ({ ...prev, flooringExistingVinylMethod: id as 'sheet_vct' | 'glue_down' | 'floating' | 'unknown' }))}
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
                        {selected ? '✓ ' : ''}{label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
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
        <Text style={[styles.qmPanelTitle, { color: darkMode ? '#cbd5e1' : '#475569' }]}>New Flooring</Text>
        <Text style={[styles.qmPanelCaption, { color: darkMode ? '#94a3b8' : '#64748b' }]}>
          Select every flooring product being installed. Each selected product gets its own SF measurement and pricing card.
        </Text>
        <View style={styles.qmOptionWrap}>
          {newFlooringOptions.map((option) => {
            const selected = measurements.flooringProductScope?.includes(option.id) ?? false;
            return (
              <React.Fragment key={option.id}>
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
                {selected ? measurementFootersByKey?.[option.id] : null}
                {selected ? (
                  <View style={{ marginTop: 4, marginBottom: 4 }}>
                    <Text style={[styles.qmPanelCaption, { color: darkMode ? '#94a3b8' : '#64748b', marginBottom: 6 }]}>
                      Existing floor this replaces
                    </Text>
                    <View style={styles.qmOptionWrap}>
                      {existingFlooringOptions
                        .map((existingOption) => {
                          const transition = transitionForProduct(option.id);
                          const assigned = transition?.existingType === existingOption.id;
                          return (
                            <TouchableOpacity
                              key={`${option.id}-${existingOption.id}`}
                              onPress={() => setFloorPrepTransition(option.id, { existingType: existingOption.id })}
                              disabled={applying}
                              style={[
                                styles.qmOption,
                                {
                                  borderColor: assigned ? '#34d399' : darkMode ? '#52525b' : '#cbd5e1',
                                  backgroundColor: assigned
                                    ? 'rgba(52, 211, 153, 0.12)'
                                    : darkMode
                                      ? '#27272a'
                                      : '#f1f5f9',
                                },
                              ]}
                            >
                              <Text style={[styles.qmOptionText, { color: assigned ? '#34d399' : darkMode ? '#e4e4e7' : Colors.text }]}>
                                {assigned ? '✓ ' : ''}{existingOption.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                    </View>
                    {transitionForProduct(option.id)?.existingType ? (
                      <View style={{ marginTop: 8 }}>
                        <Text style={[styles.qmPanelCaption, { color: darkMode ? '#94a3b8' : '#64748b', marginBottom: 6 }]}>
                          Recommended prep level
                        </Text>
                        <View style={styles.qmOptionWrap}>
                          {[
                            ['0', 'No additional prep'],
                            ['1', 'Light'],
                            ['2', 'Moderate'],
                            ['3', 'Heavy'],
                            ['4', 'Extensive / review'],
                          ].map(([level, label]) => {
                            const selectedLevel = String(transitionForProduct(option.id)?.prepLevel ?? '') === level;
                            return (
                              <TouchableOpacity
                                key={`${option.id}-prep-${level}`}
                                onPress={() => setFloorPrepTransition(option.id, { prepLevel: Number(level) as 0 | 1 | 2 | 3 | 4 })}
                                disabled={applying}
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
                                  {selectedLevel ? '✓ ' : ''}{label}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    ) : null}
                    {transitionForProduct(option.id)?.existingType ? (
                      <QmSqftMeasurementRow
                        label={`${option.label} prep area`}
                        helperText="Enter only the area requiring prep for this transition."
                        value={String(transitionForProduct(option.id)?.sqft || '')}
                        placeholder="Enter"
                        onChangeText={(value) =>
                          setFloorPrepTransition(option.id, {
                            sqft: Number(value.replace(/,/g, '')) || 0,
                          })
                        }
                        applying={applying}
                        darkMode={darkMode}
                        Colors={Colors}
                      />
                    ) : null}
                  </View>
                ) : null}
              </React.Fragment>
            );
          })}
        </View>
        {measurementFooter}
      </View>
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
