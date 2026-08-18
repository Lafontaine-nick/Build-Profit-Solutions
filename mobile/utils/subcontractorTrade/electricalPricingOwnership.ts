/**
 * Electrical pricing ownership boundaries.
 *
 * A named appliance hookup owns its dedicated circuit and connection. Generic
 * circuit cards own only additional homeruns. Standalone 240V receptacles own
 * the device/termination, never the dedicated circuit.
 */

export type ElectricalOwnershipInput = {
  rangeHookupCount?: number | null;
  dryerHookupCount?: number | null;
  waterHeaterHookupCount?: number | null;
  evChargerHookupCount?: number | null;
  dishwasherHookupCount?: number | null;
  disposalHookupCount?: number | null;
  microwaveHookupCount?: number | null;
  refrigeratorHookupCount?: number | null;
  hvacHookupCount?: number | null;
};

type ApplianceOwner = {
  label: string;
  measurementKey: keyof ElectricalOwnershipInput;
  genericCircuitIds: readonly string[];
  owns240VReceptacleConnection: boolean;
};

export const ELECTRICAL_PRICING_OWNERSHIP = {
  electrical_range_hookup: {
    label: 'Electric range circuit + hookup',
    measurementKey: 'rangeHookupCount',
    genericCircuitIds: ['electrical_circuit_50a'],
    owns240VReceptacleConnection: true,
  },
  electrical_dryer_hookup: {
    label: 'Electric dryer circuit + hookup',
    measurementKey: 'dryerHookupCount',
    genericCircuitIds: ['electrical_circuit_30a'],
    owns240VReceptacleConnection: true,
  },
  electrical_dishwasher_hookup: {
    label: 'Dishwasher circuit + hookup',
    measurementKey: 'dishwasherHookupCount',
    genericCircuitIds: ['electrical_dedicated_20a'],
    owns240VReceptacleConnection: false,
  },
  electrical_disposal_hookup: {
    label: 'Disposal circuit + hookup',
    measurementKey: 'disposalHookupCount',
    genericCircuitIds: ['electrical_dedicated_20a'],
    owns240VReceptacleConnection: false,
  },
  electrical_microwave_hookup: {
    label: 'Microwave circuit + hookup',
    measurementKey: 'microwaveHookupCount',
    genericCircuitIds: ['electrical_dedicated_20a'],
    owns240VReceptacleConnection: false,
  },
  electrical_refrigerator_hookup: {
    label: 'Refrigerator circuit + hookup',
    measurementKey: 'refrigeratorHookupCount',
    genericCircuitIds: ['electrical_dedicated_20a'],
    owns240VReceptacleConnection: false,
  },
  electrical_water_heater_hookup: {
    label: 'Electric water heater circuit + hookup',
    measurementKey: 'waterHeaterHookupCount',
    genericCircuitIds: ['electrical_circuit_30a'],
    owns240VReceptacleConnection: true,
  },
  electrical_hvac_hookup: {
    label: 'HVAC circuit + hookup',
    measurementKey: 'hvacHookupCount',
    genericCircuitIds: [
      'electrical_circuit_30a',
      'electrical_circuit_40a',
      'electrical_circuit_50a',
      'electrical_circuit_60a_plus',
    ],
    owns240VReceptacleConnection: true,
  },
  electrical_ev_charger_hookup: {
    label: 'EV charger circuit + hookup',
    measurementKey: 'evChargerHookupCount',
    genericCircuitIds: ['electrical_circuit_60a_plus'],
    owns240VReceptacleConnection: true,
  },
} as const satisfies Record<string, ApplianceOwner>;

const OWNERS = Object.values(ELECTRICAL_PRICING_OWNERSHIP);

function positive(value: number | null | undefined): boolean {
  return Number(value) > 0;
}

function explicitlySelected(quantitySource?: string | null): boolean {
  return (
    quantitySource === 'user_entered' ||
    quantitySource === 'contractor_confirmed_from_plan_review'
  );
}

function ownersForGenericCircuit(
  itemId: string,
  input: ElectricalOwnershipInput
): ApplianceOwner[] {
  return OWNERS.filter(
    owner =>
      owner.genericCircuitIds.includes(itemId) &&
      positive(input[owner.measurementKey])
  );
}

export function electricalGenericCircuitOverlapWarning(
  itemId: string,
  input: ElectricalOwnershipInput & { quantitySource?: string | null }
): string | null {
  if (!explicitlySelected(input.quantitySource)) return null;
  const owners = ownersForGenericCircuit(itemId, input);
  if (!owners.length) return null;
  const labels = owners.map(owner => owner.label).join(', ');
  return `Possible duplicate electrical scope: this circuit may already be included in ${labels}. Confirm it is an additional homerun before applying both prices.`;
}

export function electrical240VReceptacleOverlapWarning(
  input: ElectricalOwnershipInput & { quantitySource?: string | null }
): string | null {
  if (!explicitlySelected(input.quantitySource)) return null;
  const owners = OWNERS.filter(
    owner =>
      owner.owns240VReceptacleConnection &&
      positive(input[owner.measurementKey])
  );
  if (!owners.length) return null;
  const labels = owners.map(owner => owner.label).join(', ');
  return `Possible duplicate electrical scope: this 240V receptacle may already be included in ${labels}. Confirm it is a separate device before applying both prices.`;
}
