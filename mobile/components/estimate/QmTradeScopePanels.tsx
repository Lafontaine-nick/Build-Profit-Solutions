import React, { startTransition, useCallback, useEffect, useRef, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
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
  syncPairedBathroomDemoFromInstall,
  type BathroomDemoFixtureCounts,
  type BathroomExistingFixtureCounts,
  type BathroomFixtureDemoOverrideKey,
  type BathroomInstallFixtureCounts,
} from '@/utils/qmScopePanels/bathroomFixtures';

type Colors = ReturnType<typeof getColors>;

function captionColor(darkMode: boolean, Colors: Colors) {
  return darkMode ? 'rgba(245,247,250,0.62)' : Colors.sub;
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
  { key: 'kitchenInstallIslandCount', label: 'Island' },
];

const KITCHEN_DEMO_ROWS: StepperRow[] = [
  { key: 'kitchenDemoCabinetCount', label: 'Remove cabinets / counters' },
  { key: 'kitchenDemoApplianceCount', label: 'Appliance removal' },
  { key: 'kitchenDemoFloorCount', label: 'Floor demo' },
  { key: 'kitchenDemoWallCount', label: 'Wall / soffit demo' },
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
}) {
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
          darkMode={darkMode}
          Colors={Colors}
        />
      ))}
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
    measurements.kitchenDemoApplianceCount,
    measurements.kitchenDemoFloorCount,
    measurements.kitchenDemoWallCount,
  ]);

  const commit = useCallback(
    (
      nextExisting: KitchenExistingCounts,
      nextInstall: KitchenInstallCounts,
      gen: number,
      demoOverride?: { key: KitchenDemoOverrideKey; value: number | null }
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
      let mergedDemo = { ...autoDemo };
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
    [includedScopeKeys, measurements, notes, onKitchenQmChange, setMeasurements]
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
        commit(existing, install, gen, { key, value: cleaned });
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
          titleColor="#38bdf8"
          borderColor={darkMode ? 'rgba(56, 189, 248, 0.28)' : 'rgba(14, 165, 233, 0.22)'}
          backgroundColor={darkMode ? 'rgba(56, 189, 248, 0.06)' : 'rgba(56, 189, 248, 0.05)'}
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
        titleColor="#fbbf24"
        borderColor={darkMode ? 'rgba(251, 191, 36, 0.28)' : 'rgba(217, 119, 6, 0.22)'}
        backgroundColor={darkMode ? 'rgba(251, 191, 36, 0.06)' : 'rgba(251, 191, 36, 0.05)'}
        caption="Set what is in this bid — scope cards sync below."
        rows={KITCHEN_INSTALL_ROWS}
        counts={install as Record<string, number | null>}
        onAdjust={(key, d) => adjustInstall(key as keyof KitchenInstallCounts, d)}
        applying={applying}
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
    measurements.flooringInstallScopeCount,
    measurements.flooringDemoScopeCount,
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

  const adjustExisting = useCallback(
    (delta: number) => {
      const gen = ++genRef.current;
      setExisting((prev) => {
        const current = prev.flooringExistingCount ?? 0;
        const next = { flooringExistingCount: clampQmCount(current + delta < 1 ? null : current + delta) };
        commit(next, install, gen);
        return next;
      });
    },
    [commit, install]
  );

  const adjustInstall = useCallback(
    (delta: number) => {
      const gen = ++genRef.current;
      setInstall((prev) => {
        const current = prev.flooringInstallScopeCount ?? 0;
        const next = { flooringInstallScopeCount: clampQmCount(current + delta < 1 ? null : current + delta) };
        commit(existing, next, gen);
        return next;
      });
    },
    [commit, existing]
  );

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

  return (
    <>
      {showExistingPanel ? (
        <QmScopePanelSection
          title="Existing floor"
          titleColor="#38bdf8"
          borderColor={darkMode ? 'rgba(56, 189, 248, 0.28)' : 'rgba(14, 165, 233, 0.22)'}
          backgroundColor={darkMode ? 'rgba(56, 189, 248, 0.06)' : 'rgba(56, 189, 248, 0.05)'}
          caption="What is in the space now — set manually for notes-only jobs."
          rows={[{ key: 'flooringExistingCount', label: 'Existing flooring' }]}
          counts={existing as Record<string, number | null>}
          onAdjust={(_, d) => adjustExisting(d)}
          applying={applying}
          darkMode={darkMode}
          Colors={Colors}
        />
      ) : null}
      <QmScopePanelSection
        title="Flooring install"
        titleColor="#fbbf24"
        borderColor={darkMode ? 'rgba(251, 191, 36, 0.28)' : 'rgba(217, 119, 6, 0.22)'}
        backgroundColor={darkMode ? 'rgba(251, 191, 36, 0.06)' : 'rgba(251, 191, 36, 0.05)'}
        caption="New floor finish for this bid."
        rows={[{ key: 'flooringInstallScopeCount', label: 'Install flooring' }]}
        counts={install as Record<string, number | null>}
        onAdjust={(_, d) => adjustInstall(d)}
        applying={applying}
        darkMode={darkMode}
        Colors={Colors}
      />
      <QmScopePanelSection
        title="Demo / tear-out"
        titleColor="#f87171"
        borderColor={darkMode ? 'rgba(248, 113, 113, 0.28)' : 'rgba(220, 38, 38, 0.2)'}
        backgroundColor={darkMode ? 'rgba(248, 113, 113, 0.06)' : 'rgba(248, 113, 113, 0.05)'}
        caption={
          showExistingPanel
            ? 'Auto-filled from existing + install — adjust if needed.'
            : 'Auto-filled from photos, notes, and install — adjust if needed.'
        }
        rows={[{ key: 'flooringDemoScopeCount', label: 'Remove existing floor' }]}
        counts={demo as Record<string, number | null>}
        onAdjust={(_, d) => adjustDemo(d)}
        applying={applying}
        darkMode={darkMode}
        Colors={Colors}
      />
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
        mergedDemo = syncPairedBathroomDemoFromInstall(
          nextInstall,
          demoRef.current,
          demoOverridesRef.current
        );
      }
      queueMicrotask(() => {
        if (gen !== genRef.current) return;
        startTransition(() => {
          setDemo(mergedDemo);
          demoRef.current = mergedDemo;
          setMeasurements((prev) => ({ ...prev, ...nextExisting, ...nextInstall, ...mergedDemo }));
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
          [key]: clampQmCount(current + delta < 1 ? null : current + delta),
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
        const next = {
          ...prev,
          [key]: clampQmCount(current + delta < 1 ? null : current + delta),
        };
        commit(existing, next, gen);
        return next;
      });
    },
    [commit, existing]
  );

  const adjustDemo = useCallback(
    (key: BathroomFixtureDemoOverrideKey, delta: number) => {
      const gen = ++genRef.current;
      setDemo((prev) => {
        const current = prev[key] ?? 0;
        const cleaned = clampQmCount(current + delta < 1 ? null : current + delta);
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

  const vanityFixtureGrey = {
    titleColor: darkMode ? '#94a3b8' : '#64748b',
    borderColor: darkMode ? 'rgba(148, 163, 184, 0.28)' : 'rgba(100, 116, 139, 0.22)',
    backgroundColor: darkMode ? 'rgba(148, 163, 184, 0.06)' : 'rgba(100, 116, 139, 0.05)',
  };

  return (
    <>
      {showExistingPanel ? (
        <QmScopePanelSection
          title="Existing fixtures"
          titleColor="#38bdf8"
          borderColor={darkMode ? 'rgba(56, 189, 248, 0.28)' : 'rgba(14, 165, 233, 0.22)'}
          backgroundColor={darkMode ? 'rgba(56, 189, 248, 0.06)' : 'rgba(56, 189, 248, 0.05)'}
          caption={existingCaption}
          rows={BATHROOM_EXISTING_FIXTURE_ROWS}
          counts={existing as Record<string, number | null>}
          onAdjust={(key, d) => adjustExisting(key as keyof BathroomExistingFixtureCounts, d)}
          applying={applying}
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
        darkMode={darkMode}
        Colors={Colors}
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
    readKitchenDemoCounts(measurements).kitchenDemoCabinetCount != null;
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
