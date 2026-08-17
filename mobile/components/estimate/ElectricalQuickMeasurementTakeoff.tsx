import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ConfirmScopeChip } from '@/components/estimate/ConfirmScopeChip';
import { QmSqftMeasurementRow } from '@/components/estimate/QmTradeScopePanels';
import { getColors } from '@/theme/getColors';
import {
  buildElectricalQuickMeasurementGroups,
  electricalConfirmScopeAttributesEqual,
  electricalQmGroupCaption,
  electricalQmGroupDefaultCollapsed,
  electricalQmChipSelected,
  electricalQmOptionActive,
  electricalQmQuantityInputValue,
  electricalQmShowsQuantity,
  electricalQmTapQuantity,
  type ElectricalConfirmScopeAttributes,
  type ElectricalQmGroup,
  type ElectricalQmField,
} from '@/utils/electricalQuickMeasurementUi';
import type { ElectricalProjectCondition } from '@/utils/subcontractorTrade/electricalPlanConvergence';

type Colors = ReturnType<typeof getColors>;

const JOB_CONDITION_OPTIONS: [ElectricalProjectCondition, string][] = [
  ['new_construction', 'New construction / full rough'],
  ['remodel_open_wall', 'Remodel / open wall'],
  ['finished_wall_service', 'Finished-wall service'],
];
const SERVICE_AMPERAGE_OPTIONS: [number, string][] = [
  [100, '100A'],
  [125, '125A'],
  [150, '150A'],
  [200, '200A'],
  [400, '400A / specialty'],
];
const EXISTING_SERVICE_AMPERAGE_OPTIONS: [number, string][] = [
  [100, '100A'],
  [125, '125A'],
  [150, '150A'],
  [200, '200A'],
];
const PANEL_LOCATION_OPTIONS: ['indoor' | 'outdoor', string][] = [
  ['indoor', 'Indoor'],
  ['outdoor', 'Outdoor'],
];
const METER_MAIN_COMBO_OPTION = {
  key: 'electricalMeterMainCombo',
  label: 'Meter / main combo',
} as const;

function useElectricalAttributeLocal(
  values: ElectricalConfirmScopeAttributes,
  onPatch: (patch: Partial<ElectricalConfirmScopeAttributes>) => void,
) {
  const [local, setLocal] = useState(values);
  const localRef = useRef(values);
  const pendingRef = useRef<ElectricalConfirmScopeAttributes | null>(null);
  const onPatchRef = useRef(onPatch);
  onPatchRef.current = onPatch;
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    job_condition: false,
    service_amperage: false,
    panel_location: false,
    packages: false,
    raceway: false,
  });

  useEffect(() => {
    if (pendingRef.current) {
      if (electricalConfirmScopeAttributesEqual(values, pendingRef.current)) {
        pendingRef.current = null;
      }
      return;
    }
    if (electricalConfirmScopeAttributesEqual(values, localRef.current)) return;
    setLocal(values);
    localRef.current = values;
  }, [
    values.electricalProjectCondition,
    values.serviceAmperage,
    values.existingServiceAmperage,
    values.electricalPanelLocation,
    values.electricalMeterMainCombo,
    values.electricalIncludeRough,
    values.electricalIncludeTrim,
    values.electricalConduit,
    values.electricalTrenching,
  ]);

  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
    },
    [],
  );

  const apply = useCallback((patch: Partial<ElectricalConfirmScopeAttributes>) => {
    const next = { ...localRef.current, ...patch };
    pendingRef.current = next;
    localRef.current = next;
    setLocal(next);
    if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
    commitTimerRef.current = setTimeout(() => {
      commitTimerRef.current = null;
      onPatchRef.current(patch);
    }, 0);
  }, []);

  const toggle = useCallback(
    (id: string) =>
      setCollapsed(previous => ({
        ...previous,
        [id]: !(previous[id] ?? false),
      })),
    [],
  );

  return { local, localRef, apply, collapsed, toggle, setCollapsed };
}

function useElectricalAttributeHandlers(
  apply: ReturnType<typeof useElectricalAttributeLocal>['apply'],
  localRef: ReturnType<typeof useElectricalAttributeLocal>['localRef'],
  toggle: ReturnType<typeof useElectricalAttributeLocal>['toggle'],
) {
  const selectJobCondition = useCallback(
    (electricalProjectCondition: ElectricalProjectCondition | null) =>
      apply({ electricalProjectCondition }),
    [apply],
  );
  const selectServiceAmperage = useCallback(
    (serviceAmperage: number | null) => apply({ serviceAmperage }),
    [apply],
  );
  const selectExistingServiceAmperage = useCallback(
    (existingServiceAmperage: number | null) =>
      apply({ existingServiceAmperage }),
    [apply],
  );
  const selectPanelLocation = useCallback(
    (electricalPanelLocation: 'indoor' | 'outdoor' | null) =>
      apply({ electricalPanelLocation }),
    [apply],
  );
  const toggleMeterMainCombo = useCallback(
    () =>
      apply({
        electricalMeterMainCombo: !localRef.current.electricalMeterMainCombo,
      }),
    [apply, localRef],
  );
  const togglePackageOption = useCallback(
    (key: 'electricalIncludeRough' | 'electricalIncludeTrim') =>
      apply({ [key]: !localRef.current[key] }),
    [apply, localRef],
  );
  const toggleRacewayOption = useCallback(
    (key: 'electricalConduit' | 'electricalTrenching') =>
      apply({ [key]: !localRef.current[key] }),
    [apply, localRef],
  );
  const toggleJobCondition = useCallback(() => toggle('job_condition'), [toggle]);
  const toggleServiceAmperage = useCallback(
    () => toggle('service_amperage'),
    [toggle],
  );
  const togglePanelLocation = useCallback(() => toggle('panel_location'), [toggle]);
  const togglePackages = useCallback(() => toggle('packages'), [toggle]);
  const toggleRaceway = useCallback(() => toggle('raceway'), [toggle]);

  return {
    selectJobCondition,
    selectServiceAmperage,
    selectExistingServiceAmperage,
    selectPanelLocation,
    toggleMeterMainCombo,
    togglePackageOption,
    toggleRacewayOption,
    toggleJobCondition,
    toggleServiceAmperage,
    togglePanelLocation,
    togglePackages,
    toggleRaceway,
  };
}

const ElectricalAttributeChoiceChips = React.memo(function ElectricalAttributeChoiceChips<
  T extends string | number,
>({
  value,
  options,
  darkMode,
  onChange,
}: {
  value: T | null;
  options: [T, string][];
  darkMode: boolean;
  onChange: (value: T | null) => void;
}) {
  const valueRef = useRef<T | null>(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [optimisticValue, setOptimisticValue] = useState<T | null | undefined>(
    undefined,
  );
  const displayedValue =
    optimisticValue !== undefined ? optimisticValue : value;

  useEffect(() => {
    if (optimisticValue !== undefined && value === optimisticValue) {
      setOptimisticValue(undefined);
    }
  }, [optimisticValue, value]);
  valueRef.current = displayedValue;

  return (
    <View style={styles.chipStack}>
      {options.map(([option, label]) => (
        <ConfirmScopeChip
          key={String(option)}
          selected={displayedValue === option}
          label={label}
          darkMode={darkMode}
          onPress={() => {
            const current = valueRef.current;
            const next = current === option ? null : option;
            setOptimisticValue(next);
            onChangeRef.current(next);
          }}
        />
      ))}
    </View>
  );
}, (previous, next) => {
  if (
    previous.value !== next.value ||
    previous.darkMode !== next.darkMode ||
    previous.options.length !== next.options.length
  ) {
    return false;
  }
  return previous.options.every(
    ([option, label], index) =>
      option === next.options[index][0] && label === next.options[index][1],
  );
}) as <T extends string | number>(props: {
  value: T | null;
  options: [T, string][];
  darkMode: boolean;
  onChange: (value: T | null) => void;
}) => React.ReactElement;

const ElectricalAttributeToggleChips = React.memo(
  function ElectricalAttributeToggleChips({
    options,
    darkMode,
    onToggle,
  }: {
    options: { key: string; label: string; selected: boolean }[];
    darkMode: boolean;
    onToggle: (key: string) => void;
  }) {
    const onToggleRef = useRef(onToggle);
    onToggleRef.current = onToggle;
    const [optimisticSelected, setOptimisticSelected] = useState<
      Record<string, boolean>
    >({});
    useEffect(() => {
      setOptimisticSelected(previous => {
        let next: Record<string, boolean> | null = null;
        for (const option of options) {
          const optimistic = previous[option.key];
          if (optimistic === undefined || optimistic !== option.selected) continue;
          next ||= { ...previous };
          delete next[option.key];
        }
        return next || previous;
      });
    }, [options]);
    return (
      <View style={styles.chipStack}>
        {options.map(option => (
          <ConfirmScopeChip
            key={option.key}
            selected={optimisticSelected[option.key] ?? option.selected}
            label={option.label}
            darkMode={darkMode}
            onPress={() => {
              const next = !(
                optimisticSelected[option.key] ?? option.selected
              );
              setOptimisticSelected(previous => ({
                ...previous,
                [option.key]: next,
              }));
              onToggleRef.current(option.key);
            }}
          />
        ))}
      </View>
    );
  },
  (previous, next) =>
    previous.darkMode === next.darkMode &&
    previous.options.length === next.options.length &&
    previous.options.every(
      (option, index) =>
        option.key === next.options[index].key &&
        option.label === next.options[index].label &&
        option.selected === next.options[index].selected,
    ),
);

export function ElectricalQmCollapsibleCard({
  title,
  collapsed,
  onToggle,
  collapsedHint,
  expandedCaption,
  darkMode,
  children,
}: {
  title: string;
  collapsed: boolean;
  onToggle: () => void;
  collapsedHint?: string;
  expandedCaption?: string;
  darkMode: boolean;
  children?: React.ReactNode;
}) {
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
      <TouchableOpacity onPress={onToggle} activeOpacity={0.75}>
        <Text
          style={[
            styles.qmPanelTitle,
            { color: darkMode ? '#cbd5e1' : '#475569' },
          ]}
        >
          {title} {collapsed ? '⌄' : '⌃'}
        </Text>
        <Text
          style={[
            styles.qmPanelCaption,
            {
              color: darkMode ? '#94a3b8' : '#64748b',
              marginTop: 2,
              marginBottom: 0,
            },
          ]}
        >
          {collapsed
            ? collapsedHint || 'Tap to expand card'
            : 'Tap to collapse card'}
        </Text>
      </TouchableOpacity>
      {collapsed ? null : (
        <>
          {expandedCaption ? (
            <Text
              style={[
                styles.qmPanelCaption,
                {
                  color: darkMode ? '#94a3b8' : '#64748b',
                  marginTop: 10,
                  marginBottom: 6,
                },
              ]}
            >
              {expandedCaption}
            </Text>
          ) : null}
          {children}
        </>
      )}
    </View>
  );
}

const ElectricalJobConditionCard = React.memo(function ElectricalJobConditionCard({
  condition,
  collapsed,
  darkMode,
  onToggle,
  onSelect,
}: {
  condition: ElectricalProjectCondition | null;
  collapsed: boolean;
  darkMode: boolean;
  onToggle: () => void;
  onSelect: (value: ElectricalProjectCondition | null) => void;
}) {
  const conditionLabel =
    condition === 'new_construction'
      ? 'New construction / full rough'
      : condition === 'remodel_open_wall'
        ? 'Remodel / open wall'
        : condition === 'finished_wall_service'
          ? 'Finished-wall service'
          : null;

  return (
    <ElectricalQmCollapsibleCard
      title='Job condition'
      collapsed={collapsed}
      onToggle={onToggle}
      collapsedHint={
        conditionLabel
          ? `${conditionLabel} · tap to expand card`
          : 'Tap to expand card'
      }
      expandedCaption='Job condition adjusts labor only. Do not auto-select a condition from device counts.'
      darkMode={darkMode}
    >
      <ElectricalAttributeChoiceChips
        value={condition}
        options={JOB_CONDITION_OPTIONS}
        darkMode={darkMode}
        onChange={onSelect}
      />
    </ElectricalQmCollapsibleCard>
  );
}, (previous, next) =>
  previous.condition === next.condition &&
  previous.collapsed === next.collapsed &&
  previous.darkMode === next.darkMode &&
  previous.onToggle === next.onToggle &&
  previous.onSelect === next.onSelect);

const ElectricalServiceAmperageCard = React.memo(
  function ElectricalServiceAmperageCard({
    serviceAmperage,
    existingServiceAmperage,
    showExistingService,
    collapsed,
    darkMode,
    onToggle,
    onSelectService,
    onSelectExisting,
  }: {
    serviceAmperage: number | null;
    existingServiceAmperage: number | null;
    showExistingService: boolean;
    collapsed: boolean;
    darkMode: boolean;
    onToggle: () => void;
    onSelectService: (value: number | null) => void;
    onSelectExisting: (value: number | null) => void;
  }) {
    return (
      <ElectricalQmCollapsibleCard
        title='Service amperage'
        collapsed={collapsed}
        onToggle={onToggle}
        collapsedHint={
          Number(serviceAmperage) > 0
            ? `${serviceAmperage}A · tap to expand card`
            : 'Leave blank unless printed or you select it'
        }
        expandedCaption='Leave service size blank unless it is printed on the plan or you select it. Never infer 200A from house size or a panel box.'
        darkMode={darkMode}
      >
        <ElectricalAttributeChoiceChips
          value={serviceAmperage}
          options={SERVICE_AMPERAGE_OPTIONS}
          darkMode={darkMode}
          onChange={onSelectService}
        />
        {showExistingService || Number(existingServiceAmperage) > 0 ? (
          <View style={{ gap: 10, marginTop: 12 }}>
            <Text
              style={{
                color: darkMode ? '#cbd5e1' : '#475569',
                fontWeight: '700',
                fontSize: 13,
              }}
            >
              Existing service size
            </Text>
            <ElectricalAttributeChoiceChips
              value={existingServiceAmperage}
              options={EXISTING_SERVICE_AMPERAGE_OPTIONS}
              darkMode={darkMode}
              onChange={onSelectExisting}
            />
          </View>
        ) : null}
      </ElectricalQmCollapsibleCard>
    );
  },
  (previous, next) =>
    previous.serviceAmperage === next.serviceAmperage &&
    previous.existingServiceAmperage === next.existingServiceAmperage &&
    previous.showExistingService === next.showExistingService &&
    previous.collapsed === next.collapsed &&
    previous.darkMode === next.darkMode &&
    previous.onToggle === next.onToggle &&
    previous.onSelectService === next.onSelectService &&
    previous.onSelectExisting === next.onSelectExisting,
);

const ElectricalPanelLocationCard = React.memo(
  function ElectricalPanelLocationCard({
    panelLocation,
    meterMainCombo,
    collapsed,
    darkMode,
    onToggle,
    onSelectLocation,
    onToggleMeterMain,
  }: {
    panelLocation: 'indoor' | 'outdoor' | null;
    meterMainCombo: boolean;
    collapsed: boolean;
    darkMode: boolean;
    onToggle: () => void;
    onSelectLocation: (value: 'indoor' | 'outdoor' | null) => void;
    onToggleMeterMain: () => void;
  }) {
    return (
      <ElectricalQmCollapsibleCard
        title='Panel location'
        collapsed={collapsed}
        onToggle={onToggle}
        collapsedHint={
          panelLocation || meterMainCombo
            ? 'Selected · tap to expand card'
            : 'Tap to expand card'
        }
        expandedCaption='Indoor / outdoor and meter-main affect panel labor. Leave unselected unless this job needs them.'
        darkMode={darkMode}
      >
        <ElectricalAttributeChoiceChips
          value={panelLocation}
          options={PANEL_LOCATION_OPTIONS}
          darkMode={darkMode}
          onChange={onSelectLocation}
        />
        <View style={{ marginTop: 10 }}>
          <ElectricalAttributeToggleChips
            options={[
              {
                ...METER_MAIN_COMBO_OPTION,
                selected: meterMainCombo,
              },
            ]}
            darkMode={darkMode}
            onToggle={onToggleMeterMain}
          />
        </View>
      </ElectricalQmCollapsibleCard>
    );
  },
  (previous, next) =>
    previous.panelLocation === next.panelLocation &&
    previous.meterMainCombo === next.meterMainCombo &&
    previous.collapsed === next.collapsed &&
    previous.darkMode === next.darkMode &&
    previous.onToggle === next.onToggle &&
    previous.onSelectLocation === next.onSelectLocation &&
    previous.onToggleMeterMain === next.onToggleMeterMain,
);

const ElectricalPackagesCard = React.memo(
  function ElectricalPackagesCard({
    includeRough,
    includeTrim,
    collapsed,
    darkMode,
    onToggle,
    onToggleOption,
  }: {
    includeRough: boolean;
    includeTrim: boolean;
    collapsed: boolean;
    darkMode: boolean;
    onToggle: () => void;
    onToggleOption: (key: 'electricalIncludeRough' | 'electricalIncludeTrim') => void;
  }) {
    return (
      <ElectricalQmCollapsibleCard
        title='Packages'
        collapsed={collapsed}
        onToggle={onToggle}
        collapsedHint={
          includeRough || includeTrim
            ? 'Selected · tap to expand card'
            : 'Tap to expand card'
        }
        expandedCaption='Include rough-in / trim only for whole-project packages — detailed counts already own those cards.'
        darkMode={darkMode}
      >
        <ElectricalAttributeToggleChips
          options={[
            {
              key: 'electricalIncludeRough',
              label: 'Include rough-in',
              selected: includeRough,
            },
            {
              key: 'electricalIncludeTrim',
              label: 'Include trim / devices',
              selected: includeTrim,
            },
          ]}
          darkMode={darkMode}
          onToggle={key =>
            onToggleOption(key as 'electricalIncludeRough' | 'electricalIncludeTrim')
          }
        />
      </ElectricalQmCollapsibleCard>
    );
  },
  (previous, next) =>
    previous.includeRough === next.includeRough &&
    previous.includeTrim === next.includeTrim &&
    previous.collapsed === next.collapsed &&
    previous.darkMode === next.darkMode &&
    previous.onToggle === next.onToggle &&
    previous.onToggleOption === next.onToggleOption,
);

const ElectricalRacewayCard = React.memo(
  function ElectricalRacewayCard({
    includeConduit,
    includeTrenching,
    collapsed,
    darkMode,
    onToggle,
    onToggleOption,
  }: {
    includeConduit: boolean;
    includeTrenching: boolean;
    collapsed: boolean;
    darkMode: boolean;
    onToggle: () => void;
    onToggleOption: (key: 'electricalConduit' | 'electricalTrenching') => void;
  }) {
    return (
      <ElectricalQmCollapsibleCard
        title='Conduit / trenching'
        collapsed={collapsed}
        onToggle={onToggle}
        collapsedHint={
          includeConduit || includeTrenching
            ? 'Selected · tap to expand card'
            : 'Tap to expand card'
        }
        expandedCaption='A conduit or trenching flag does not invent a length or a price. Enter LF on the Modifications card to price raceway.'
        darkMode={darkMode}
      >
        <ElectricalAttributeToggleChips
          options={[
            {
              key: 'electricalConduit',
              label: 'Conduit',
              selected: includeConduit,
            },
            {
              key: 'electricalTrenching',
              label: 'Trenching',
              selected: includeTrenching,
            },
          ]}
          darkMode={darkMode}
          onToggle={key =>
            onToggleOption(key as 'electricalConduit' | 'electricalTrenching')
          }
        />
      </ElectricalQmCollapsibleCard>
    );
  },
  (previous, next) =>
    previous.includeConduit === next.includeConduit &&
    previous.includeTrenching === next.includeTrenching &&
    previous.collapsed === next.collapsed &&
    previous.darkMode === next.darkMode &&
    previous.onToggle === next.onToggle &&
    previous.onToggleOption === next.onToggleOption,
);

const ElectricalAttributeJobServiceCards = React.memo(
  function ElectricalAttributeJobServiceCards({
    condition,
    serviceAmperage,
    existingServiceAmperage,
    jobConditionCollapsed,
    serviceAmperageCollapsed,
    darkMode,
    showExistingService,
    onToggleJobCondition,
    onToggleServiceAmperage,
    onSelectJobCondition,
    onSelectServiceAmperage,
    onSelectExistingServiceAmperage,
  }: {
    condition: ElectricalProjectCondition | null;
    serviceAmperage: number | null;
    existingServiceAmperage: number | null;
    jobConditionCollapsed: boolean;
    serviceAmperageCollapsed: boolean;
    darkMode: boolean;
    showExistingService: boolean;
    onToggleJobCondition: () => void;
    onToggleServiceAmperage: () => void;
    onSelectJobCondition: (value: ElectricalProjectCondition | null) => void;
    onSelectServiceAmperage: (value: number | null) => void;
    onSelectExistingServiceAmperage: (value: number | null) => void;
  }) {
    return (
      <View>
        <ElectricalJobConditionCard
          condition={condition}
          collapsed={jobConditionCollapsed}
          darkMode={darkMode}
          onToggle={onToggleJobCondition}
          onSelect={onSelectJobCondition}
        />
        <ElectricalServiceAmperageCard
          serviceAmperage={serviceAmperage}
          existingServiceAmperage={existingServiceAmperage}
          showExistingService={showExistingService}
          collapsed={serviceAmperageCollapsed}
          darkMode={darkMode}
          onToggle={onToggleServiceAmperage}
          onSelectService={onSelectServiceAmperage}
          onSelectExisting={onSelectExistingServiceAmperage}
        />
      </View>
    );
  },
  (previous, next) =>
    previous.darkMode === next.darkMode &&
    previous.showExistingService === next.showExistingService &&
    previous.condition === next.condition &&
    previous.serviceAmperage === next.serviceAmperage &&
    previous.existingServiceAmperage === next.existingServiceAmperage &&
    previous.jobConditionCollapsed === next.jobConditionCollapsed &&
    previous.serviceAmperageCollapsed === next.serviceAmperageCollapsed &&
    previous.onToggleJobCondition === next.onToggleJobCondition &&
    previous.onToggleServiceAmperage === next.onToggleServiceAmperage &&
    previous.onSelectJobCondition === next.onSelectJobCondition &&
    previous.onSelectServiceAmperage === next.onSelectServiceAmperage &&
    previous.onSelectExistingServiceAmperage ===
      next.onSelectExistingServiceAmperage,
);

const ElectricalAttributeBottomCards = React.memo(
  function ElectricalAttributeBottomCards({
    includeRough,
    includeTrim,
    includeConduit,
    includeTrenching,
    packagesCollapsed,
    racewayCollapsed,
    darkMode,
    onTogglePackages,
    onToggleRaceway,
    onTogglePackageOption,
    onToggleRacewayOption,
  }: {
    includeRough: boolean;
    includeTrim: boolean;
    includeConduit: boolean;
    includeTrenching: boolean;
    packagesCollapsed: boolean;
    racewayCollapsed: boolean;
    darkMode: boolean;
    onTogglePackages: () => void;
    onToggleRaceway: () => void;
    onTogglePackageOption: (
      key: 'electricalIncludeRough' | 'electricalIncludeTrim',
    ) => void;
    onToggleRacewayOption: (
      key: 'electricalConduit' | 'electricalTrenching',
    ) => void;
  }) {
    return (
      <View>
        <ElectricalPackagesCard
          includeRough={includeRough}
          includeTrim={includeTrim}
          collapsed={packagesCollapsed}
          darkMode={darkMode}
          onToggle={onTogglePackages}
          onToggleOption={onTogglePackageOption}
        />
        <ElectricalRacewayCard
          includeConduit={includeConduit}
          includeTrenching={includeTrenching}
          collapsed={racewayCollapsed}
          darkMode={darkMode}
          onToggle={onToggleRaceway}
          onToggleOption={onToggleRacewayOption}
        />
      </View>
    );
  },
  (previous, next) =>
    previous.darkMode === next.darkMode &&
    previous.includeRough === next.includeRough &&
    previous.includeTrim === next.includeTrim &&
    previous.includeConduit === next.includeConduit &&
    previous.includeTrenching === next.includeTrenching &&
    previous.packagesCollapsed === next.packagesCollapsed &&
    previous.racewayCollapsed === next.racewayCollapsed &&
    previous.onTogglePackages === next.onTogglePackages &&
    previous.onToggleRaceway === next.onToggleRaceway &&
    previous.onTogglePackageOption === next.onTogglePackageOption &&
    previous.onToggleRacewayOption === next.onToggleRacewayOption,
);

export function ElectricalJobConditionControls({
  values,
  onPatch,
  darkMode,
}: {
  values: ElectricalConfirmScopeAttributes;
  onPatch: (patch: Partial<ElectricalConfirmScopeAttributes>) => void;
  darkMode: boolean;
}) {
  const { local, localRef, apply, collapsed, toggle } =
    useElectricalAttributeLocal(values, onPatch);
  const handlers = useElectricalAttributeHandlers(apply, localRef, toggle);

  return (
    <ElectricalJobConditionCard
      condition={local.electricalProjectCondition}
      collapsed={Boolean(collapsed.job_condition)}
      darkMode={darkMode}
      onToggle={handlers.toggleJobCondition}
      onSelect={handlers.selectJobCondition}
    />
  );
}

export function ElectricalServiceAmperageControls({
  values,
  onPatch,
  darkMode,
  showExistingService,
}: {
  values: ElectricalConfirmScopeAttributes;
  onPatch: (patch: Partial<ElectricalConfirmScopeAttributes>) => void;
  darkMode: boolean;
  showExistingService: boolean;
}) {
  const { local, localRef, apply, collapsed, toggle } =
    useElectricalAttributeLocal(values, onPatch);
  const handlers = useElectricalAttributeHandlers(apply, localRef, toggle);

  return (
    <ElectricalServiceAmperageCard
      serviceAmperage={local.serviceAmperage}
      existingServiceAmperage={local.existingServiceAmperage}
      showExistingService={showExistingService}
      collapsed={Boolean(collapsed.service_amperage)}
      darkMode={darkMode}
      onToggle={handlers.toggleServiceAmperage}
      onSelectService={handlers.selectServiceAmperage}
      onSelectExisting={handlers.selectExistingServiceAmperage}
    />
  );
}

export const ElectricalConfirmScopeJobServiceCards = React.memo(
  function ElectricalConfirmScopeJobServiceCards({
  values,
  onPatch,
  darkMode,
  showExistingService,
}: {
  values: ElectricalConfirmScopeAttributes;
  onPatch: (patch: Partial<ElectricalConfirmScopeAttributes>) => void;
  darkMode: boolean;
  showExistingService: boolean;
}) {
  return (
    <>
      <ElectricalJobConditionControls
        values={values}
        onPatch={onPatch}
        darkMode={darkMode}
      />
      <ElectricalServiceAmperageControls
        values={values}
        onPatch={onPatch}
        darkMode={darkMode}
        showExistingService={showExistingService}
      />
    </>
  );
  },
  (previous, next) =>
    previous.darkMode === next.darkMode &&
    previous.showExistingService === next.showExistingService &&
    previous.onPatch === next.onPatch &&
    previous.values.electricalProjectCondition ===
      next.values.electricalProjectCondition &&
    previous.values.serviceAmperage === next.values.serviceAmperage &&
    previous.values.existingServiceAmperage === next.values.existingServiceAmperage,
);

export const ElectricalPanelLocationControls = React.memo(
  function ElectricalPanelLocationControls({
    values,
    onPatch,
    darkMode,
  }: {
    values: ElectricalConfirmScopeAttributes;
    onPatch: (patch: Partial<ElectricalConfirmScopeAttributes>) => void;
    darkMode: boolean;
  }) {
    const [panelLocation, setPanelLocation] = useState(
      values.electricalPanelLocation,
    );
    const [meterMainCombo, setMeterMainCombo] = useState(
      values.electricalMeterMainCombo,
    );
    const [collapsed, setCollapsed] = useState(false);
    const pendingRef = useRef<{
      panelLocation: ElectricalConfirmScopeAttributes['electricalPanelLocation'];
      meterMainCombo: boolean;
    } | null>(null);
    const onPatchRef = useRef(onPatch);
    onPatchRef.current = onPatch;
    const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const panelLocationRef = useRef(panelLocation);
    panelLocationRef.current = panelLocation;
    const meterMainComboRef = useRef(meterMainCombo);
    meterMainComboRef.current = meterMainCombo;

    useEffect(() => {
      if (pendingRef.current) {
        if (
          pendingRef.current.panelLocation === values.electricalPanelLocation &&
          pendingRef.current.meterMainCombo === values.electricalMeterMainCombo
        ) {
          pendingRef.current = null;
        }
        return;
      }
      setPanelLocation(values.electricalPanelLocation);
      setMeterMainCombo(values.electricalMeterMainCombo);
    }, [values.electricalPanelLocation, values.electricalMeterMainCombo]);

    useEffect(
      () => () => {
        if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
      },
      [],
    );

    const schedulePatch = useCallback(
      (patch: Partial<ElectricalConfirmScopeAttributes>) => {
        if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
        commitTimerRef.current = setTimeout(() => {
          commitTimerRef.current = null;
          onPatchRef.current(patch);
        }, 180);
      },
      [],
    );

    const selectPanelLocation = useCallback(
      (electricalPanelLocation: 'indoor' | 'outdoor' | null) => {
        setPanelLocation(electricalPanelLocation);
        pendingRef.current = {
          panelLocation: electricalPanelLocation,
          meterMainCombo: meterMainComboRef.current,
        };
        schedulePatch({ electricalPanelLocation });
      },
      [schedulePatch],
    );

    const toggleMeterMainCombo = useCallback(() => {
      const next = !meterMainComboRef.current;
      setMeterMainCombo(next);
      pendingRef.current = {
        panelLocation: panelLocationRef.current,
        meterMainCombo: next,
      };
      schedulePatch({ electricalMeterMainCombo: next });
    }, [schedulePatch]);

    const togglePanelLocation = useCallback(
      () => setCollapsed(current => !current),
      [],
    );

    return (
      <ElectricalPanelLocationCard
        panelLocation={panelLocation}
        meterMainCombo={meterMainCombo}
        collapsed={collapsed}
        darkMode={darkMode}
        onToggle={togglePanelLocation}
        onSelectLocation={selectPanelLocation}
        onToggleMeterMain={toggleMeterMainCombo}
      />
    );
  },
  (previous, next) =>
    previous.darkMode === next.darkMode &&
    previous.onPatch === next.onPatch &&
    previous.values.electricalPanelLocation ===
      next.values.electricalPanelLocation &&
    previous.values.electricalMeterMainCombo ===
      next.values.electricalMeterMainCombo,
);

export const ElectricalConfirmScopePackagesRacewayCards = React.memo(
  function ElectricalConfirmScopePackagesRacewayCards({
  values,
  onPatch,
  darkMode,
}: {
  values: ElectricalConfirmScopeAttributes;
  onPatch: (patch: Partial<ElectricalConfirmScopeAttributes>) => void;
  darkMode: boolean;
}) {
  const { local, localRef, apply, collapsed, toggle } =
    useElectricalAttributeLocal(values, onPatch);
  const handlers = useElectricalAttributeHandlers(apply, localRef, toggle);

  return (
    <ElectricalAttributeBottomCards
      includeRough={Boolean(local.electricalIncludeRough)}
      includeTrim={Boolean(local.electricalIncludeTrim)}
      includeConduit={Boolean(local.electricalConduit)}
      includeTrenching={Boolean(local.electricalTrenching)}
      packagesCollapsed={Boolean(collapsed.packages)}
      racewayCollapsed={Boolean(collapsed.raceway)}
      darkMode={darkMode}
      onTogglePackages={handlers.togglePackages}
      onToggleRaceway={handlers.toggleRaceway}
      onTogglePackageOption={handlers.togglePackageOption}
      onToggleRacewayOption={handlers.toggleRacewayOption}
    />
  );
  },
  (previous, next) =>
    previous.darkMode === next.darkMode &&
    previous.onPatch === next.onPatch &&
    previous.values.electricalIncludeRough === next.values.electricalIncludeRough &&
    previous.values.electricalIncludeTrim === next.values.electricalIncludeTrim &&
    previous.values.electricalConduit === next.values.electricalConduit &&
    previous.values.electricalTrenching === next.values.electricalTrenching,
);

export const ElectricalConfirmScopeAttributesPanel = React.memo(
  function ElectricalConfirmScopeAttributesPanel({
    values,
    onCommit,
    commitRef,
    darkMode,
    showExistingService,
  }: {
    values: ElectricalConfirmScopeAttributes;
    onCommit: (attributes: ElectricalConfirmScopeAttributes) => void;
    commitRef?: React.MutableRefObject<(() => void) | null>;
    darkMode: boolean;
    showExistingService: boolean;
  }) {
    const [local, setLocal] = useState(values);
    const localRef = useRef(values);
    const dirtyRef = useRef(false);
    const onCommitRef = useRef(onCommit);
    onCommitRef.current = onCommit;
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
      job_condition: false,
      service_amperage: false,
      panel_location: false,
      packages: false,
      raceway: false,
    });

    useEffect(() => {
      if (dirtyRef.current) return;
      if (electricalConfirmScopeAttributesEqual(values, localRef.current)) {
        return;
      }
      localRef.current = values;
      setLocal(values);
    }, [values]);

    const commit = useCallback(() => {
      if (!dirtyRef.current) return;
      dirtyRef.current = false;
      onCommitRef.current(localRef.current);
    }, []);

    useEffect(() => {
      if (!commitRef) return;
      commitRef.current = commit;
      return () => {
        if (commitRef.current === commit) commitRef.current = null;
        commit();
      };
    }, [commitRef, commit]);

    const apply = useCallback(
      (patch: Partial<ElectricalConfirmScopeAttributes>) => {
        const next = { ...localRef.current, ...patch };
        localRef.current = next;
        dirtyRef.current = true;
        setLocal(next);
      },
      [],
    );

    const toggle = useCallback(
      (id: string) =>
        setCollapsed(previous => ({
          ...previous,
          [id]: !(previous[id] ?? false),
        })),
      [],
    );
    const handlers = useElectricalAttributeHandlers(
      apply,
      localRef,
      toggle,
    );

    return (
      <>
        <ElectricalJobConditionCard
          condition={local.electricalProjectCondition}
          collapsed={Boolean(collapsed.job_condition)}
          darkMode={darkMode}
          onToggle={handlers.toggleJobCondition}
          onSelect={handlers.selectJobCondition}
        />
        <ElectricalServiceAmperageCard
          serviceAmperage={local.serviceAmperage}
          existingServiceAmperage={local.existingServiceAmperage}
          showExistingService={showExistingService}
          collapsed={Boolean(collapsed.service_amperage)}
          darkMode={darkMode}
          onToggle={handlers.toggleServiceAmperage}
          onSelectService={handlers.selectServiceAmperage}
          onSelectExisting={handlers.selectExistingServiceAmperage}
        />
        <ElectricalPanelLocationCard
          panelLocation={local.electricalPanelLocation}
          meterMainCombo={Boolean(local.electricalMeterMainCombo)}
          collapsed={Boolean(collapsed.panel_location)}
          darkMode={darkMode}
          onToggle={handlers.togglePanelLocation}
          onSelectLocation={handlers.selectPanelLocation}
          onToggleMeterMain={handlers.toggleMeterMainCombo}
        />
        <ElectricalAttributeBottomCards
          includeRough={Boolean(local.electricalIncludeRough)}
          includeTrim={Boolean(local.electricalIncludeTrim)}
          includeConduit={Boolean(local.electricalConduit)}
          includeTrenching={Boolean(local.electricalTrenching)}
          packagesCollapsed={Boolean(collapsed.packages)}
          racewayCollapsed={Boolean(collapsed.raceway)}
          darkMode={darkMode}
          onTogglePackages={handlers.togglePackages}
          onToggleRaceway={handlers.toggleRaceway}
          onTogglePackageOption={handlers.togglePackageOption}
          onToggleRacewayOption={handlers.toggleRacewayOption}
        />
      </>
    );
  },
  (previous, next) =>
    previous.darkMode === next.darkMode &&
    previous.showExistingService === next.showExistingService &&
    previous.onCommit === next.onCommit &&
    previous.commitRef === next.commitRef &&
    electricalConfirmScopeAttributesEqual(previous.values, next.values),
);

/** Backward-compatible name for callers that only render the attribute panel. */
export const ElectricalConfirmScopeAttributeChips =
  ElectricalConfirmScopeAttributesPanel;

function ElectricalQuickMeasurementTakeoffView({
  measurements,
  conflictFields,
  sources,
  userOverrides,
  preferExpandedKeys: _preferExpandedKeys,
  onChangeQuantity,
  quantityEditingRef,
  darkMode,
  Colors,
  applying,
}: {
  measurements: Record<string, unknown>;
  conflictFields: string[];
  sources?: Record<string, string | undefined> | null;
  userOverrides?: Record<string, boolean | undefined> | null;
  preferExpandedKeys?: string[];
  onChangeQuantity: (field: string, value: string) => void;
  quantityEditingRef?: React.RefObject<boolean>;
  darkMode: boolean;
  Colors: Colors;
  applying?: boolean;
}) {
  const onChangeQuantityRef = useRef(onChangeQuantity);
  onChangeQuantityRef.current = onChangeQuantity;
  const [optimisticQuantities, setOptimisticQuantities] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    setOptimisticQuantities(previous => {
      let next: Record<string, string> | null = null;
      for (const [key, value] of Object.entries(previous)) {
        if (String(measurements[key] ?? '') !== value) continue;
        next ||= { ...previous };
        delete next[key];
      }
      return next || previous;
    });
  }, [measurements]);

  const effectiveMeasurements = useMemo(
    () => ({ ...measurements, ...optimisticQuantities }),
    [measurements, optimisticQuantities]
  );

  const commitQuantity = useCallback((field: string, value: string) => {
    setOptimisticQuantities(previous => ({ ...previous, [field]: value }));
    onChangeQuantityRef.current(field, value);
  }, []);

  const groups = useMemo(
    () =>
      buildElectricalQuickMeasurementGroups({
        measurements: effectiveMeasurements,
        conflictFields,
        sources,
        userOverrides,
      }),
    [effectiveMeasurements, conflictFields, sources, userOverrides]
  );
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  const toggleExpanded = useCallback((fieldKey: string) => {
    setExpandedKeys(previous => ({
      ...previous,
      [fieldKey]: !previous[fieldKey],
    }));
  }, []);
  const commitFieldQuantity = useCallback((fieldKey: string, value: string) => {
    commitQuantity(fieldKey, value);
    if (!String(value || '').trim()) {
      setExpandedKeys(previous => {
        if (!previous[fieldKey]) return previous;
        const next = { ...previous };
        delete next[fieldKey];
        return next;
      });
    }
  }, [commitQuantity]);
  const toggleGroup = useCallback((groupId: string) => {
    setCollapsed(previous => ({
      ...previous,
      [groupId]: !(previous[groupId] ?? electricalQmGroupDefaultCollapsed()),
    }));
  }, []);

  return (
    <View>
      {groups.map(group => {
        const isCollapsed =
          collapsed[group.id] ?? electricalQmGroupDefaultCollapsed();
        return (
          <ElectricalQmGroupCard
            key={group.id}
            group={group}
            collapsed={isCollapsed}
            expandedKeys={expandedKeys}
            onToggleGroup={toggleGroup}
            onToggleExpand={toggleExpanded}
            onCommitQuantity={commitFieldQuantity}
            quantityEditingRef={quantityEditingRef}
            applying={Boolean(applying)}
            darkMode={darkMode}
            Colors={Colors}
          />
        );
      })}
    </View>
  );
}

export const ElectricalQuickMeasurementTakeoff = React.memo(
  ElectricalQuickMeasurementTakeoffView,
  (previous, next) =>
    previous.measurements === next.measurements &&
    previous.conflictFields === next.conflictFields &&
    previous.sources === next.sources &&
    previous.userOverrides === next.userOverrides &&
    previous.darkMode === next.darkMode &&
    previous.Colors === next.Colors &&
    previous.applying === next.applying &&
    previous.quantityEditingRef === next.quantityEditingRef &&
    previous.onChangeQuantity === next.onChangeQuantity,
);

function ElectricalQmGroupCardView({
  group,
  collapsed,
  expandedKeys,
  onToggleGroup,
  onToggleExpand,
  onCommitQuantity,
  quantityEditingRef,
  applying,
  darkMode,
  Colors,
}: {
  group: ElectricalQmGroup;
  collapsed: boolean;
  expandedKeys: Record<string, boolean>;
  onToggleGroup: (groupId: string) => void;
  onToggleExpand: (fieldKey: string) => void;
  onCommitQuantity: (fieldKey: string, value: string) => void;
  quantityEditingRef?: React.RefObject<boolean>;
  applying: boolean;
  darkMode: boolean;
  Colors: Colors;
}) {
  const selectedCount = group.fields.filter(electricalQmOptionActive).length;
  return (
    <ElectricalQmCollapsibleCard
      title={group.title}
      collapsed={collapsed}
      onToggle={() => onToggleGroup(group.id)}
      collapsedHint={
        selectedCount > 0
          ? 'Selected · tap to expand card'
          : 'Tap to expand card'
      }
      expandedCaption={electricalQmGroupCaption(group.id)}
      darkMode={darkMode}
    >
      <View style={styles.qmOptionWrap}>
        {group.fields.map(field => (
          <ElectricalQmScopeOption
            key={field.key}
            field={field}
            fieldKey={field.key}
            expanded={Boolean(expandedKeys[field.key])}
            quantityEditingRef={quantityEditingRef}
            onToggleExpand={onToggleExpand}
            onCommitQuantity={onCommitQuantity}
            applying={applying}
            darkMode={darkMode}
            Colors={Colors}
          />
        ))}
      </View>
    </ElectricalQmCollapsibleCard>
  );
}

const ElectricalQmGroupCard = React.memo(
  ElectricalQmGroupCardView,
  (previous, next) => {
    if (
      previous.group.id !== next.group.id ||
      previous.collapsed !== next.collapsed ||
      previous.applying !== next.applying ||
      previous.darkMode !== next.darkMode ||
      previous.Colors !== next.Colors ||
      previous.quantityEditingRef !== next.quantityEditingRef ||
      previous.onToggleGroup !== next.onToggleGroup ||
      previous.onToggleExpand !== next.onToggleExpand ||
      previous.onCommitQuantity !== next.onCommitQuantity ||
      previous.group.fields.length !== next.group.fields.length
    ) {
      return false;
    }
    return previous.group.fields.every((field, index) => {
      const nextField = next.group.fields[index];
      return (
        field.key === nextField.key &&
        field.value === nextField.value &&
        field.selected === nextField.selected &&
        field.conflicted === nextField.conflicted &&
        field.provenanceLabel === nextField.provenanceLabel &&
        Boolean(previous.expandedKeys[field.key]) ===
          Boolean(next.expandedKeys[nextField.key])
      );
    });
  },
);

const ElectricalQmScopeOption = React.memo(function ElectricalQmScopeOption({
  field,
  fieldKey,
  expanded,
  quantityEditingRef,
  onToggleExpand,
  onCommitQuantity,
  applying,
  darkMode,
  Colors,
}: {
  field: ElectricalQmField;
  fieldKey: string;
  expanded: boolean;
  quantityEditingRef?: React.RefObject<boolean>;
  onToggleExpand: (fieldKey: string) => void;
  onCommitQuantity: (fieldKey: string, value: string) => void;
  applying: boolean;
  darkMode: boolean;
  Colors: Colors;
}) {
  const active = electricalQmOptionActive(field);
  // EA chips own their quantity selection. Once deselected, do not let the
  // previous expanded state keep the quantity editor mounted for one more
  // parent render.
  const visibleExpanded =
    field.unit === 'EA' && !field.conflicted && !field.selected
      ? false
      : expanded;
  const chipSelected = electricalQmChipSelected(field, visibleExpanded);
  const showQuantity = electricalQmShowsQuantity(field, visibleExpanded);
  const committedValue = electricalQmQuantityInputValue(field);
  const [isEditingQuantity, setIsEditingQuantity] = useState(false);
  const [quantityDraft, setQuantityDraft] = useState(committedValue);
  const isEditingQuantityRef = useRef(false);
  const quantityDraftRef = useRef(quantityDraft);
  quantityDraftRef.current = quantityDraft;
  const onCommitQuantityRef = useRef(onCommitQuantity);
  onCommitQuantityRef.current = onCommitQuantity;

  const setQuantityEditing = useCallback(
    (editing: boolean) => {
      isEditingQuantityRef.current = editing;
      if (quantityEditingRef) quantityEditingRef.current = editing;
      setIsEditingQuantity(editing);
    },
    [quantityEditingRef]
  );

  useEffect(() => {
    if (isEditingQuantityRef.current) return;
    setQuantityDraft(committedValue);
  }, [committedValue]);

  const beginQuantityEdit = useCallback(() => {
    setQuantityDraft(committedValue);
    setQuantityEditing(true);
  }, [committedValue, setQuantityEditing]);

  const finishQuantityEdit = useCallback(() => {
    if (!isEditingQuantityRef.current) return;
    const value = quantityDraftRef.current;
    setQuantityEditing(false);
    onCommitQuantityRef.current(fieldKey, value);
  }, [fieldKey, setQuantityEditing]);

  const handleQuantityChange = useCallback(
    (text: string) => {
      if (!isEditingQuantityRef.current) {
        setQuantityDraft(committedValue);
        setQuantityEditing(true);
      }
      setQuantityDraft(text);
    },
    [committedValue, setQuantityEditing]
  );

  const handleToggle = () => {
    if (applying) return;
    const tapQuantity = electricalQmTapQuantity(field);
    if (tapQuantity != null) {
      setQuantityEditing(false);
      onCommitQuantityRef.current(fieldKey, tapQuantity);
      if (!tapQuantity && expanded) onToggleExpand(fieldKey);
      if (tapQuantity && !expanded) onToggleExpand(fieldKey);
      return;
    }
    onToggleExpand(fieldKey);
  };

  const inputValue = isEditingQuantity ? quantityDraft : committedValue;
  const showStatusBelowInput = !isEditingQuantity;

  return (
    <View>
      <ConfirmScopeChip
        selected={chipSelected}
        label={field.label}
        darkMode={darkMode}
        disabled={applying}
        accessibilityLabel={
          active
            ? `Remove ${field.label} from scope`
            : chipSelected
              ? `Collapse ${field.label} quantity`
              : `Include ${field.label} in scope`
        }
        onPress={handleToggle}
      />
      {showQuantity ? (
        <>
          <QmSqftMeasurementRow
            label={`${field.label} quantity`}
            helperText={
              field.conflicted
                ? 'Confirm the orange conflict above, or enter only the quantity for this component.'
                : 'Enter only the quantity for this selected component.'
            }
            value={inputValue}
            placeholder='Enter'
            unitLabel={field.unit}
            keyboardType={field.unit === 'LF' ? 'decimal-pad' : 'number-pad'}
            onChangeText={handleQuantityChange}
            onFocus={beginQuantityEdit}
            onBlur={finishQuantityEdit}
            applying={applying}
            darkMode={darkMode}
            Colors={Colors}
            highlighted
          />
          {showStatusBelowInput && active && field.provenanceLabel ? (
            <Text
              style={{
                color: darkMode ? '#94a3b8' : '#64748b',
                fontSize: 11,
                marginTop: 4,
              }}
            >
              {field.value?.toLocaleString()} {field.unit} · {field.provenanceLabel}
            </Text>
          ) : null}
          {showStatusBelowInput && !active ? (
            <Text style={{ color: '#fbbf24', fontSize: 11, marginTop: 5 }}>
              {field.conflicted
                ? 'Unresolved plan conflict — this stays unpriced until you choose or enter a count.'
                : 'Quantity needed before this scope can be priced.'}
            </Text>
          ) : null}
        </>
      ) : null}
    </View>
  );
}, (previous, next) =>
  previous.field.key === next.field.key &&
  previous.field.value === next.field.value &&
  previous.field.selected === next.field.selected &&
  previous.field.conflicted === next.field.conflicted &&
  previous.field.provenanceLabel === next.field.provenanceLabel &&
  previous.expanded === next.expanded &&
  previous.applying === next.applying &&
  previous.darkMode === next.darkMode &&
  previous.Colors === next.Colors &&
  previous.quantityEditingRef === next.quantityEditingRef &&
  previous.onToggleExpand === next.onToggleExpand &&
  previous.onCommitQuantity === next.onCommitQuantity);

const styles = StyleSheet.create({
  qmPanel: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 12 },
  qmPanelTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  qmPanelCaption: { fontSize: 12, lineHeight: 17, marginBottom: 12 },
  qmOptionWrap: {
    flexDirection: 'column',
    gap: 8,
    alignItems: 'stretch',
  },
  chipStack: { gap: 10 },
});
