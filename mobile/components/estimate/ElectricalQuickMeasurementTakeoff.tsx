import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  CONFIRM_SCOPE_CHIP_COMMIT_MS,
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
  type ElectricalQmField,
} from '@/utils/electricalQuickMeasurementUi';
import type {
  ElectricalPanelLocation,
  ElectricalProjectCondition,
} from '@/utils/subcontractorTrade/electricalPlanConvergence';

type Colors = ReturnType<typeof getColors>;

function deferConfirmScopeUiPatch(task: () => void) {
  return setTimeout(task, CONFIRM_SCOPE_CHIP_COMMIT_MS);
}

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

export function ElectricalConfirmScopeAttributeChips({
  values,
  onPatch,
  darkMode,
  showExistingService,
  quantityTakeoff,
}: {
  values: ElectricalConfirmScopeAttributes;
  onPatch: (patch: Partial<ElectricalConfirmScopeAttributes>) => void;
  darkMode: boolean;
  showExistingService: boolean;
  quantityTakeoff: React.ReactNode;
}) {
  const [local, setLocal] = useState(values);
  const localRef = useRef(values);
  const pendingRef = useRef<ElectricalConfirmScopeAttributes | null>(null);
  const onPatchRef = useRef(onPatch);
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  onPatchRef.current = onPatch;
  localRef.current = local;
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    job_condition: false,
    service_amperage: false,
    panel_location: false,
    packages: false,
    raceway: false,
  });

  useEffect(
    () => () => {
      if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
    },
    []
  );

  useEffect(() => {
    if (pendingRef.current) {
      if (electricalConfirmScopeAttributesEqual(values, pendingRef.current)) {
        pendingRef.current = null;
        setLocal(values);
        localRef.current = values;
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

  const apply = useCallback((patch: Partial<ElectricalConfirmScopeAttributes>) => {
    const next = { ...localRef.current, ...patch };
    pendingRef.current = next;
    localRef.current = next;
    setLocal(next);
    const scheduled = next;
    if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
    commitTimerRef.current = deferConfirmScopeUiPatch(() => {
      if (pendingRef.current !== scheduled) return;
      commitTimerRef.current = null;
      onPatchRef.current(scheduled);
    });
  }, []);

  const toggle = (id: string) =>
    setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));

  const conditionLabel =
    local.electricalProjectCondition === 'new_construction'
      ? 'New construction / full rough'
      : local.electricalProjectCondition === 'remodel_open_wall'
        ? 'Remodel / open wall'
        : local.electricalProjectCondition === 'finished_wall_service'
          ? 'Finished-wall service'
          : null;

  return (
    <View>
      <ElectricalQmCollapsibleCard
        title='Job condition'
        collapsed={Boolean(collapsed.job_condition)}
        onToggle={() => toggle('job_condition')}
        collapsedHint={
          conditionLabel
            ? `${conditionLabel} · tap to expand card`
            : 'Tap to expand card'
        }
        expandedCaption='Job condition adjusts labor only. Do not auto-select a condition from device counts.'
        darkMode={darkMode}
      >
        <View style={styles.chipStack}>
          {(
            [
              ['new_construction', 'New construction / full rough'],
              ['remodel_open_wall', 'Remodel / open wall'],
              ['finished_wall_service', 'Finished-wall service'],
            ] as Array<[ElectricalProjectCondition, string]>
          ).map(([value, label]) => (
            <ConfirmScopeChip
              key={value}
              selected={local.electricalProjectCondition === value}
              label={label}
              darkMode={darkMode}
              onPress={() =>
                apply({
                  electricalProjectCondition:
                    localRef.current.electricalProjectCondition === value
                      ? null
                      : value,
                })
              }
            />
          ))}
        </View>
      </ElectricalQmCollapsibleCard>
      <ElectricalQmCollapsibleCard
        title='Service amperage'
        collapsed={Boolean(collapsed.service_amperage)}
        onToggle={() => toggle('service_amperage')}
        collapsedHint={
          Number(local.serviceAmperage) > 0
            ? `${local.serviceAmperage}A · tap to expand card`
            : 'Leave blank unless printed or you select it'
        }
        expandedCaption='Leave service size blank unless it is printed on the plan or you select it. Never infer 200A from house size or a panel box.'
        darkMode={darkMode}
      >
        <View style={styles.chipStack}>
          {(
            [
              [100, '100A'],
              [125, '125A'],
              [150, '150A'],
              [200, '200A'],
              [400, '400A / specialty'],
            ] as Array<[number, string]>
          ).map(([amps, label]) => (
            <ConfirmScopeChip
              key={String(amps)}
              selected={Number(local.serviceAmperage) === amps}
              label={label}
              darkMode={darkMode}
              onPress={() =>
                apply({
                  serviceAmperage:
                    Number(localRef.current.serviceAmperage) === amps
                      ? null
                      : amps,
                })
              }
            />
          ))}
        </View>
        {showExistingService || Number(local.existingServiceAmperage) > 0 ? (
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
            {(
              [
                [100, '100A'],
                [125, '125A'],
                [150, '150A'],
                [200, '200A'],
              ] as Array<[number, string]>
            ).map(([amps, label]) => (
              <ConfirmScopeChip
                key={`existing-${amps}`}
                selected={Number(local.existingServiceAmperage) === amps}
                label={label}
                darkMode={darkMode}
                onPress={() =>
                  apply({
                    existingServiceAmperage:
                      Number(localRef.current.existingServiceAmperage) === amps
                        ? null
                        : amps,
                  })
                }
              />
            ))}
          </View>
        ) : null}
      </ElectricalQmCollapsibleCard>
      <ElectricalQmCollapsibleCard
        title='Panel location'
        collapsed={Boolean(collapsed.panel_location)}
        onToggle={() => toggle('panel_location')}
        collapsedHint={
          local.electricalPanelLocation || local.electricalMeterMainCombo
            ? 'Selected · tap to expand card'
            : 'Tap to expand card'
        }
        expandedCaption='Indoor / outdoor and meter-main affect panel labor. Leave unselected unless this job needs them.'
        darkMode={darkMode}
      >
        <View style={styles.chipStack}>
          {(
            [
              ['indoor', 'Indoor'],
              ['outdoor', 'Outdoor'],
            ] as Array<[ElectricalPanelLocation, string]>
          ).map(([value, label]) => (
            <ConfirmScopeChip
              key={value}
              selected={local.electricalPanelLocation === value}
              label={label}
              darkMode={darkMode}
              onPress={() =>
                apply({
                  electricalPanelLocation:
                    localRef.current.electricalPanelLocation === value
                      ? null
                      : value,
                })
              }
            />
          ))}
          <ConfirmScopeChip
            selected={Boolean(local.electricalMeterMainCombo)}
            label='Meter / main combo'
            darkMode={darkMode}
            onPress={() =>
              apply({
                electricalMeterMainCombo: !localRef.current.electricalMeterMainCombo,
              })
            }
          />
        </View>
      </ElectricalQmCollapsibleCard>
      {quantityTakeoff}
      <ElectricalQmCollapsibleCard
        title='Packages'
        collapsed={Boolean(collapsed.packages)}
        onToggle={() => toggle('packages')}
        collapsedHint={
          local.electricalIncludeRough || local.electricalIncludeTrim
            ? 'Selected · tap to expand card'
            : 'Tap to expand card'
        }
        expandedCaption='Include rough-in / trim only for whole-project packages — detailed counts already own those cards.'
        darkMode={darkMode}
      >
        <View style={styles.chipStack}>
          <ConfirmScopeChip
            selected={Boolean(local.electricalIncludeRough)}
            label='Include rough-in'
            darkMode={darkMode}
            onPress={() =>
              apply({
                electricalIncludeRough: !localRef.current.electricalIncludeRough,
              })
            }
          />
          <ConfirmScopeChip
            selected={Boolean(local.electricalIncludeTrim)}
            label='Include trim / devices'
            darkMode={darkMode}
            onPress={() =>
              apply({
                electricalIncludeTrim: !localRef.current.electricalIncludeTrim,
              })
            }
          />
        </View>
      </ElectricalQmCollapsibleCard>
      <ElectricalQmCollapsibleCard
        title='Conduit / trenching'
        collapsed={Boolean(collapsed.raceway)}
        onToggle={() => toggle('raceway')}
        collapsedHint={
          local.electricalConduit || local.electricalTrenching
            ? 'Selected · tap to expand card'
            : 'Tap to expand card'
        }
        expandedCaption='A conduit or trenching flag does not invent a length or a price. Enter LF on the Modifications card to price raceway.'
        darkMode={darkMode}
      >
        <View style={styles.chipStack}>
          <ConfirmScopeChip
            selected={Boolean(local.electricalConduit)}
            label='Conduit'
            darkMode={darkMode}
            onPress={() =>
              apply({ electricalConduit: !localRef.current.electricalConduit })
            }
          />
          <ConfirmScopeChip
            selected={Boolean(local.electricalTrenching)}
            label='Trenching'
            darkMode={darkMode}
            onPress={() =>
              apply({
                electricalTrenching: !localRef.current.electricalTrenching,
              })
            }
          />
        </View>
      </ElectricalQmCollapsibleCard>
    </View>
  );
}

export function ElectricalQuickMeasurementTakeoff({
  measurements,
  conflictFields,
  sources,
  userOverrides,
  preferExpandedKeys: _preferExpandedKeys,
  onChangeQuantity,
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
  darkMode: boolean;
  Colors: Colors;
  applying?: boolean;
}) {
  const [pendingQuantities, setPendingQuantities] = useState<Record<string, string>>(
    {}
  );
  const pendingRef = useRef(pendingQuantities);
  pendingRef.current = pendingQuantities;
  const onChangeQuantityRef = useRef(onChangeQuantity);
  onChangeQuantityRef.current = onChangeQuantity;
  const commitTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {}
  );

  useEffect(
    () => () => {
      for (const timer of Object.values(commitTimersRef.current)) {
        clearTimeout(timer);
      }
    },
    []
  );

  useEffect(() => {
    setPendingQuantities(prev => {
      let changed = false;
      const next = { ...prev };
      for (const key of Object.keys(prev)) {
        if (String(measurements[key] ?? '') === String(prev[key] ?? '')) {
          delete next[key];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [measurements]);

  const visibleMeasurements = useMemo(
    () => ({ ...measurements, ...pendingQuantities }),
    [measurements, pendingQuantities]
  );

  const patchQuantity = useCallback((field: string, value: string) => {
    setPendingQuantities(prev => ({ ...prev, [field]: value }));
    if (commitTimersRef.current[field]) {
      clearTimeout(commitTimersRef.current[field]);
    }
    commitTimersRef.current[field] = deferConfirmScopeUiPatch(() => {
      if (pendingRef.current[field] !== value) return;
      delete commitTimersRef.current[field];
      onChangeQuantityRef.current(field, value);
    });
  }, []);

  const groups = useMemo(
    () =>
      buildElectricalQuickMeasurementGroups({
        measurements: visibleMeasurements,
        conflictFields,
        sources,
        userOverrides,
      }),
    [visibleMeasurements, conflictFields, sources, userOverrides]
  );
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});

  return (
    <View>
      {groups.map(group => {
        const isCollapsed =
          collapsed[group.id] ?? electricalQmGroupDefaultCollapsed();
        const selectedCount = group.fields.filter(electricalQmOptionActive).length;
        return (
          <ElectricalQmCollapsibleCard
            key={group.id}
            title={group.title}
            collapsed={isCollapsed}
            onToggle={() =>
              setCollapsed(prev => ({
                ...prev,
                [group.id]: !isCollapsed,
              }))
            }
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
                  draftValue={pendingQuantities[field.key]}
                  expanded={Boolean(expandedKeys[field.key])}
                  onToggleExpand={() =>
                    setExpandedKeys(prev => ({
                      ...prev,
                      [field.key]: !prev[field.key],
                    }))
                  }
                  onChangeQuantity={value => {
                    patchQuantity(field.key, value);
                    if (!String(value || '').trim()) {
                      setExpandedKeys(prev => {
                        if (!prev[field.key]) return prev;
                        const next = { ...prev };
                        delete next[field.key];
                        return next;
                      });
                    }
                  }}
                  applying={Boolean(applying)}
                  darkMode={darkMode}
                  Colors={Colors}
                />
              ))}
            </View>
          </ElectricalQmCollapsibleCard>
        );
      })}
    </View>
  );
}

function ElectricalQmScopeOption({
  field,
  draftValue,
  expanded,
  onToggleExpand,
  onChangeQuantity,
  applying,
  darkMode,
  Colors,
}: {
  field: ElectricalQmField;
  draftValue?: string;
  expanded: boolean;
  onToggleExpand: () => void;
  onChangeQuantity: (value: string) => void;
  applying: boolean;
  darkMode: boolean;
  Colors: Colors;
}) {
  const active = electricalQmOptionActive(field);
  const chipSelected = electricalQmChipSelected(field, expanded);
  const showQuantity = electricalQmShowsQuantity(field, expanded);

  const handleToggle = () => {
    if (applying) return;
    const tapQuantity = electricalQmTapQuantity(field);
    if (tapQuantity != null) {
      onChangeQuantity(tapQuantity);
      if (tapQuantity && !expanded) onToggleExpand();
      return;
    }
    onToggleExpand();
  };

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
            value={electricalQmQuantityInputValue(field, draftValue)}
            placeholder='Enter'
            unitLabel={field.unit}
            onChangeText={onChangeQuantity}
            applying={applying}
            darkMode={darkMode}
            Colors={Colors}
            highlighted
          />
          {active && field.provenanceLabel ? (
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
          {!active ? (
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
}

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
