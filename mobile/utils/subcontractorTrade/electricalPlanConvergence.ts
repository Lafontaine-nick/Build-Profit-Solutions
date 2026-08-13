/**
 * Canonical Electrical Notes/Voice/Manual architecture.
 * Phase 1: keys, ownership, scope cards, parser, and persistence.
 * Does not calibrate rates or extract plan symbols.
 */

import { applyElectricalServicePanelOwnership } from './electricalServicePanelPricing';

export type ElectricalProjectCondition =
  | 'new_construction'
  | 'remodel_open_wall'
  | 'finished_wall_service';

export type ElectricalPanelLocation = 'indoor' | 'outdoor';

export type ElectricalQuantityKey =
  | 'mainPanelCount'
  | 'subpanelCount'
  | 'panelUpgradeCount'
  | 'serviceUpgradeCount'
  | 'serviceAmperage'
  | 'standardCircuitCount'
  | 'dedicated20aCircuitCount'
  | 'circuit30aCount'
  | 'circuit40aCount'
  | 'circuit50aCount'
  | 'circuit60aPlusCount'
  | 'standardReceptacleCount'
  | 'gfciReceptacleCount'
  | 'afciReceptacleCount'
  | 'exteriorReceptacleCount'
  | 'floorReceptacleCount'
  | 'usbReceptacleCount'
  | 'receptacle240vCount'
  | 'singlePoleSwitchCount'
  | 'threeWaySwitchCount'
  | 'fourWaySwitchCount'
  | 'dimmerSwitchCount'
  | 'occupancySwitchCount'
  | 'smartSwitchCount'
  | 'standardFixtureCount'
  | 'recessedLightCount'
  | 'pendantLightCount'
  | 'decorativeLightCount'
  | 'exteriorLightCount'
  | 'undercabinetLightCount'
  | 'ceilingFanCount'
  | 'bathExhaustFanCount'
  | 'rangeHookupCount'
  | 'dryerHookupCount'
  | 'dishwasherHookupCount'
  | 'disposalHookupCount'
  | 'microwaveHookupCount'
  | 'refrigeratorHookupCount'
  | 'waterHeaterHookupCount'
  | 'hvacHookupCount'
  | 'evChargerHookupCount'
  | 'smokeDetectorCount'
  | 'coDetectorCount'
  | 'doorbellCount'
  | 'cat6DropCount'
  | 'tvCoaxCount'
  | 'securityPrewireCount'
  | 'cameraPrewireCount'
  | 'deviceRemovalCount'
  | 'fixtureRemovalCount'
  | 'relocateCount'
  | 'abandonedCircuitCount';

export type ElectricalCardGroupId =
  | 'service_panels'
  | 'circuits'
  | 'receptacles'
  | 'switches'
  | 'lighting'
  | 'fans'
  | 'appliances'
  | 'life_safety'
  | 'rough_modifications';

export type ElectricalCardDefinition = {
  itemId: string;
  measurementKey: ElectricalQuantityKey;
  label: string;
  helper: string;
  unit: 'each' | 'amp';
  groupId: ElectricalCardGroupId;
  groupTitle: string;
  voltage?: '120V' | '240V';
};

export const ELECTRICAL_CARD_GROUPS: Array<{
  id: ElectricalCardGroupId;
  title: string;
}> = [
  { id: 'service_panels', title: 'Service / panels' },
  { id: 'circuits', title: 'Circuits' },
  { id: 'receptacles', title: 'Receptacles' },
  { id: 'switches', title: 'Switches / controls' },
  { id: 'lighting', title: 'Lighting' },
  { id: 'fans', title: 'Fans' },
  { id: 'appliances', title: 'Appliance / equipment hookups' },
  { id: 'life_safety', title: 'Life safety / low voltage' },
  { id: 'rough_modifications', title: 'Rough / modifications' },
];

const C = (
  itemId: string,
  measurementKey: ElectricalQuantityKey,
  label: string,
  helper: string,
  groupId: ElectricalCardGroupId,
  extra: Partial<Pick<ElectricalCardDefinition, 'unit' | 'voltage'>> = {}
): ElectricalCardDefinition => ({
  itemId,
  measurementKey,
  label,
  helper,
  unit: extra.unit || 'each',
  groupId,
  groupTitle:
    ELECTRICAL_CARD_GROUPS.find(group => group.id === groupId)?.title || groupId,
  ...(extra.voltage ? { voltage: extra.voltage } : {}),
});

/** One owner and one unit per quantity. Never share a measurement key across cards. */
export const ELECTRICAL_CARDS: ElectricalCardDefinition[] = [
  C(
    'electrical_main_panel',
    'mainPanelCount',
    'Main panel',
    'New main-panel install only. Service upgrades own included panel/meter work. Amperage is a separate attribute.',
    'service_panels'
  ),
  C(
    'electrical_subpanel',
    'subpanelCount',
    'Subpanel',
    'Branch / subpanel count. Not the main service panel.',
    'service_panels'
  ),
  C(
    'electrical_panel_upgrade',
    'panelUpgradeCount',
    'Panel upgrade',
    'In-place panel swap at the same or increased panel capacity. Not service conductors, meter, or utility coordination.',
    'service_panels'
  ),
  C(
    'electrical_service_upgrade',
    'serviceUpgradeCount',
    'Service upgrade',
    'Service-size change including included panel/meter, grounding/bonding, and utility coordination. Do not also price Main panel or Panel upgrade for the same replacement.',
    'service_panels'
  ),
  C(
    'electrical_standard_circuit',
    'standardCircuitCount',
    'Standard 15/20A circuits',
    'General 120V lighting and receptacle homeruns. Dedicated appliance circuits, devices, and hookups are separate.',
    'circuits',
    { voltage: '120V' }
  ),
  C(
    'electrical_dedicated_20a',
    'dedicated20aCircuitCount',
    'Dedicated 20A circuits',
    'Dedicated 120V 20A appliance homeruns. Do not also count as standard circuits. Dishwasher / disposal / microwave / refrigerator hookups own those circuits.',
    'circuits',
    { voltage: '120V' }
  ),
  C(
    'electrical_circuit_30a',
    'circuit30aCount',
    '30A circuits',
    'Generic 30A homeruns, typically 240V. A dryer or water-heater hookup owns that circuit instead.',
    'circuits',
    { voltage: '240V' }
  ),
  C(
    'electrical_circuit_40a',
    'circuit40aCount',
    '40A circuits',
    '40A circuits, typically 240V. Do not also count a matching appliance hookup here.',
    'circuits',
    { voltage: '240V' }
  ),
  C(
    'electrical_circuit_50a',
    'circuit50aCount',
    '50A circuits',
    'Generic 50A homeruns. A 50A range circuit belongs on Range hookup, not here.',
    'circuits',
    { voltage: '240V' }
  ),
  C(
    'electrical_circuit_60a_plus',
    'circuit60aPlusCount',
    '60A+ circuits',
    '60A and larger feeder / equipment homeruns. EV charger hookups own that circuit. Specialty / confirm.',
    'circuits',
    { voltage: '240V' }
  ),
  C(
    'electrical_standard_receptacle',
    'standardReceptacleCount',
    'Standard receptacles',
    '120V duplex outlets. Device / box / plate only — the homerun is a circuit card. GFCI, AFCI, exterior, floor, USB, and 240V devices are separate.',
    'receptacles',
    { voltage: '120V' }
  ),
  C(
    'electrical_gfci_receptacle',
    'gfciReceptacleCount',
    'GFCI receptacles',
    'GFCI / WR kitchen, bath, garage, and wet-location devices. Not a standard receptacle and not the homerun.',
    'receptacles',
    { voltage: '120V' }
  ),
  C(
    'electrical_afci_receptacle',
    'afciReceptacleCount',
    'AFCI / dual-function receptacle',
    'Device + box + plate only. Does not include AFCI/dual-function breaker or new circuit wiring. Do not also count as standard or GFCI.',
    'receptacles',
    { voltage: '120V' }
  ),
  C(
    'electrical_exterior_receptacle',
    'exteriorReceptacleCount',
    'Exterior receptacles',
    'Weather-resistant exterior devices, including outdoor GFCI/WR. Distinct from interior GFCI. Homerun is separate.',
    'receptacles',
    { voltage: '120V' }
  ),
  C(
    'electrical_floor_receptacle',
    'floorReceptacleCount',
    'Floor receptacles',
    'Floor boxes / floor outlets. Device only — not a standard receptacle and not the homerun.',
    'receptacles',
    { voltage: '120V' }
  ),
  C(
    'electrical_usb_receptacle',
    'usbReceptacleCount',
    'USB / specialty receptacles',
    'USB, USB-C, or other specialty 120V devices. Not a standard receptacle. Homerun is separate.',
    'receptacles',
    { voltage: '120V' }
  ),
  C(
    'electrical_240v_receptacle',
    'receptacle240vCount',
    '240V receptacles',
    '240V receptacle devices only. Range / dryer hookups own those connections. Homerun is a circuit or hookup card.',
    'receptacles',
    { voltage: '240V' }
  ),
  C(
    'electrical_single_pole_switch',
    'singlePoleSwitchCount',
    'Single-pole switch',
    'Device + box + plate only. Does not include homerun, relocation, fishing, or wall repair. 3-way, 4-way, dimmer, occupancy, and smart switches own those locations instead.',
    'switches'
  ),
  C(
    'electrical_3way_switch',
    'threeWaySwitchCount',
    '3-way switch',
    '3-way switch devices. Count devices, not traveler circuits. Device + box + plate only — not a new circuit and not a relocation.',
    'switches'
  ),
  C(
    'electrical_4way_switch',
    'fourWaySwitchCount',
    '4-way switch',
    '4-way switch devices. Count devices, not traveler circuits. Device + box + plate only — not a new circuit and not a relocation.',
    'switches'
  ),
  C(
    'electrical_dimmer_switch',
    'dimmerSwitchCount',
    'Dimmer switch',
    'Dimmer switch device only. Does not include lighting fixture. Owns the switch location — do not also count as a single-pole switch.',
    'switches'
  ),
  C(
    'electrical_occupancy_switch',
    'occupancySwitchCount',
    'Occupancy / motion sensor switch',
    'Occupancy or vacancy / motion sensor switch. Owns the switch location — not a single-pole switch. Homerun and relocation are separate.',
    'switches'
  ),
  C(
    'electrical_smart_switch',
    'smartSwitchCount',
    'Smart switch',
    'Smart / wifi / home-automation switch. Owns the switch location — do not also count a single-pole switch. Homerun and relocation are separate.',
    'switches'
  ),
  C(
    'electrical_standard_fixture',
    'standardFixtureCount',
    'Standard / vanity fixture',
    'Surface, flush, or vanity fixtures. Fixture + hang only — not the homerun and not a dimmer. Recessed, pendant, decorative, exterior, and under-cabinet are separate.',
    'lighting'
  ),
  C(
    'electrical_recessed_light',
    'recessedLightCount',
    'Recessed / canless / wafer light',
    'Recessed cans, canless, or wafer lights. Fixture + hang only — not the homerun. Do not also count as a standard fixture.',
    'lighting'
  ),
  C(
    'electrical_pendant_light',
    'pendantLightCount',
    'Pendant light',
    'Pendant fixtures. Fixture + hang only — not the homerun and not a standard fixture.',
    'lighting'
  ),
  C(
    'electrical_decorative_light',
    'decorativeLightCount',
    'Decorative / chandelier',
    'Chandeliers, heavy decorative, or specialty fixtures. Fixture + hang only. Specialty / confirm — not a standard fixture and not the homerun.',
    'lighting'
  ),
  C(
    'electrical_exterior_light',
    'exteriorLightCount',
    'Exterior light',
    'Exterior wall packs, floods, or porch lights. Fixture + hang only — not the homerun.',
    'lighting'
  ),
  C(
    'electrical_undercabinet_light',
    'undercabinetLightCount',
    'Under-cabinet fixture',
    'Under-cabinet fixture install only. Does not include a new homerun or cabinet wiring runs. Recessed, pendant, and standard fixtures are separate.',
    'lighting'
  ),
  C(
    'electrical_ceiling_fan',
    'ceilingFanCount',
    'Ceiling fan',
    'Ceiling fan fixtures, with or without a light kit. Fixture + hang only — not a new fan-rated box, homerun, or bath exhaust fan.',
    'fans'
  ),
  C(
    'electrical_bath_exhaust_fan',
    'bathExhaustFanCount',
    'Bathroom exhaust fan electrical install',
    'Fan + electrical connection only. Does not include ducting, roof/wall venting, or HVAC work. Distinct from ceiling fans. Homerun is a circuit card.',
    'fans'
  ),
  C(
    'electrical_range_hookup',
    'rangeHookupCount',
    'Range hookup',
    'Range / cooktop circuit and connection. Owns the 50A range circuit — do not also count a generic 50A card or a 240V receptacle.',
    'appliances',
    { voltage: '240V' }
  ),
  C(
    'electrical_dryer_hookup',
    'dryerHookupCount',
    'Dryer hookup',
    'Electric dryer circuit and connection. Owns the 30A dryer circuit — do not also count a generic 30A card or a 240V receptacle.',
    'appliances',
    { voltage: '240V' }
  ),
  C(
    'electrical_dishwasher_hookup',
    'dishwasherHookupCount',
    'Dishwasher hookup',
    'Dishwasher circuit and connection. Owns that dedicated 20A — do not also count a generic dedicated 20A card.',
    'appliances',
    { voltage: '120V' }
  ),
  C(
    'electrical_disposal_hookup',
    'disposalHookupCount',
    'Disposal hookup',
    'Garbage disposal circuit and connection. Owns that dedicated 20A. An air switch is a switch card, not this hookup.',
    'appliances',
    { voltage: '120V' }
  ),
  C(
    'electrical_microwave_hookup',
    'microwaveHookupCount',
    'Microwave hookup',
    'Dedicated microwave / hood circuit and connection. Owns that dedicated 20A — do not also count a generic dedicated 20A card.',
    'appliances',
    { voltage: '120V' }
  ),
  C(
    'electrical_refrigerator_hookup',
    'refrigeratorHookupCount',
    'Refrigerator dedicated circuit / connection',
    'Dedicated refrigerator circuit and connection only. Do not use this card for a fridge on an existing receptacle — that is a standard receptacle. Owns that dedicated 20A.',
    'appliances',
    { voltage: '120V' }
  ),
  C(
    'electrical_water_heater_hookup',
    'waterHeaterHookupCount',
    'Electric water heater electrical connection',
    'Electric water-heater circuit and connection. Not a gas water heater. Owns that 30A circuit — do not also count a generic 30A card.',
    'appliances',
    { voltage: '240V' }
  ),
  C(
    'electrical_hvac_hookup',
    'hvacHookupCount',
    'HVAC hookup',
    'HVAC equipment electrical connection only. Not the HVAC trade package and not a generic circuit card. Specialty / confirm.',
    'appliances',
    { voltage: '240V' }
  ),
  C(
    'electrical_ev_charger_hookup',
    'evChargerHookupCount',
    'EV charger hookup',
    'EV charger circuit and connection. Owns the 60A+ feeder — do not also count a generic 60A+ card. Specialty / confirm.',
    'appliances',
    { voltage: '240V' }
  ),
  C(
    'electrical_smoke_detector',
    'smokeDetectorCount',
    'Smoke detectors',
    'Hardwired smoke alarms. Device + interconnect only — not a new homerun.',
    'life_safety'
  ),
  C(
    'electrical_co_detector',
    'coDetectorCount',
    'CO detectors',
    'Hardwired carbon-monoxide alarms. Device + interconnect only. Combo units count here only when called out as CO.',
    'life_safety'
  ),
  C(
    'electrical_doorbell',
    'doorbellCount',
    'Doorbell',
    'Standard doorbell / chime wiring and device. Not a video doorbell or camera.',
    'life_safety'
  ),
  C(
    'electrical_cat6_drop',
    'cat6DropCount',
    'CAT6 / data drops',
    'Data / CAT6 drops or outlets. Drop only — not a new homerun and not a whole-house structured wiring package. Camera drops are a separate card.',
    'life_safety'
  ),
  C(
    'electrical_tv_coax',
    'tvCoaxCount',
    'TV / coax',
    'TV, coax, or RG6 outlets. Drop only — not a new homerun.',
    'life_safety'
  ),
  C(
    'electrical_security_prewire',
    'securityPrewireCount',
    'Security prewire',
    'Security / alarm prewire drops only. Does not include cameras, keypads, or monitoring. Camera drops are a separate card.',
    'life_safety'
  ),
  C(
    'electrical_camera_prewire',
    'cameraPrewireCount',
    'Camera prewire / low-voltage drop',
    'Camera prewire / low-voltage drop only. Does not include cameras or equipment (Ring, Nest, PoE). Drop only — not a new homerun. Do not also count as CAT6 or security prewire.',
    'life_safety'
  ),
  C(
    'electrical_device_removal',
    'deviceRemovalCount',
    'Device removal',
    'Remove existing receptacles or switches. Cap / make-safe only. Not a relocate and not a new device. Wall repair is a separate trade.',
    'rough_modifications'
  ),
  C(
    'electrical_fixture_removal',
    'fixtureRemovalCount',
    'Fixture removal',
    'Remove existing light fixtures or fans. Cap / make-safe only. Not a relocate and not a new fixture.',
    'rough_modifications'
  ),
  C(
    'electrical_relocate',
    'relocateCount',
    'Relocate outlet / switch / fixture',
    'Move an existing outlet, switch, or fixture. Not a new device card. Wire modification stays here; wall repair is a separate trade.',
    'rough_modifications'
  ),
  C(
    'electrical_abandoned_circuit',
    'abandonedCircuitCount',
    'Abandoned circuits',
    'Make-safe / abandon existing circuits. Not a new homerun. Tracing in finished walls is specialty / confirm.',
    'rough_modifications'
  ),
];

export const ELECTRICAL_ITEM_IDS = ELECTRICAL_CARDS.map(card => card.itemId);

export const ELECTRICAL_SCOPE_ALLOWLIST = [
  'electrical_rough',
  'electrical_trim',
  'electrical',
  ...ELECTRICAL_ITEM_IDS,
  'cleanup',
];

export const ELECTRICAL_QUANTITY_KEYS = ELECTRICAL_CARDS.map(
  card => card.measurementKey
) as ElectricalQuantityKey[];

/** Service size is an attribute of the panel/service, not a fake quantity card. */
export const ELECTRICAL_ATTRIBUTE_KEYS = ['serviceAmperage'] as const;

/** Review keys include owned quantities plus the service amperage attribute. */
export const ELECTRICAL_REVIEW_MEASUREMENT_KEYS = [
  ...ELECTRICAL_QUANTITY_KEYS,
  ...ELECTRICAL_ATTRIBUTE_KEYS,
] as const;

export const ELECTRICAL_NEEDS_PRICING_LABEL = 'Needs pricing';

const CARD_BY_ITEM_ID = new Map(
  ELECTRICAL_CARDS.map(card => [card.itemId, card])
);
const CARD_BY_KEY = new Map(
  ELECTRICAL_CARDS.map(card => [card.measurementKey, card])
);

export function isCanonicalElectricalItemId(itemId: string | null | undefined): boolean {
  return Boolean(itemId && CARD_BY_ITEM_ID.has(itemId));
}

export function electricalCardForItemId(
  itemId: string | null | undefined
): ElectricalCardDefinition | null {
  return (itemId && CARD_BY_ITEM_ID.get(itemId)) || null;
}

export function electricalCardForMeasurementKey(
  key: string | null | undefined
): ElectricalCardDefinition | null {
  return (key && CARD_BY_KEY.get(key as ElectricalQuantityKey)) || null;
}

export function electricalMeasurementKeyOwnership(): Record<
  ElectricalQuantityKey,
  string
> {
  return Object.fromEntries(
    ELECTRICAL_CARDS.map(card => [card.measurementKey, card.itemId])
  ) as Record<ElectricalQuantityKey, string>;
}

export type ElectricalStructuredMeasurements = {
  electricalScope?: string[] | null;
  electricalProjectCondition?: ElectricalProjectCondition | null;
  electricalIncludeRough?: boolean | null;
  electricalIncludeTrim?: boolean | null;
  electricalConduit?: boolean | null;
  electricalTrenching?: boolean | null;
  existingServiceAmperage?: number | null;
  electricalPanelLocation?: ElectricalPanelLocation | null;
  electricalMeterMainCombo?: boolean | null;
  itemQuantities?: Record<
    string,
    { quantity: number; unit: string; quantitySource?: string }
  > | null;
};

export type ElectricalParsedMeasurements = Partial<
  Record<ElectricalQuantityKey, number>
> &
  ElectricalStructuredMeasurements;

const PROJECT_CONDITION_VALUES = new Set<ElectricalProjectCondition>([
  'new_construction',
  'remodel_open_wall',
  'finished_wall_service',
]);

function positiveNumber(value: unknown): number | null {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function readBooleanFlag(value: unknown): boolean | null {
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === 0 || value === '0')
    return false;
  return null;
}

function readProjectCondition(value: unknown): ElectricalProjectCondition | null {
  const raw = String(value || '').trim();
  return PROJECT_CONDITION_VALUES.has(raw as ElectricalProjectCondition)
    ? (raw as ElectricalProjectCondition)
    : null;
}

function readPanelLocation(value: unknown): ElectricalPanelLocation | null {
  const raw = String(value || '').trim().toLowerCase();
  return raw === 'indoor' || raw === 'outdoor' ? raw : null;
}

function readExplicitElectricalScope(input: Record<string, unknown>): string[] | null {
  if (!Array.isArray(input.electricalScope)) return null;
  const allowed = new Set(ELECTRICAL_ITEM_IDS);
  const scope = input.electricalScope
    .map(String)
    .filter(id => allowed.has(id));
  return scope.length ? [...new Set(scope)] : null;
}

function inferredScopeFromQuantities(
  input: Record<string, unknown>
): string[] {
  const scope: string[] = [];
  for (const card of ELECTRICAL_CARDS) {
    if (card.measurementKey === 'serviceAmperage') continue;
    if (positiveNumber(input[card.measurementKey]) != null) {
      scope.push(card.itemId);
    }
  }
  return scope;
}

function buildItemQuantities(
  input: Record<string, unknown>,
  source = 'user_entered'
): Record<string, { quantity: number; unit: string; quantitySource: string }> {
  const out: Record<
    string,
    { quantity: number; unit: string; quantitySource: string }
  > = {};
  for (const card of ELECTRICAL_CARDS) {
    if (card.measurementKey === 'serviceAmperage') continue;
    const quantity = positiveNumber(input[card.measurementKey]);
    if (quantity == null) continue;
    out[card.itemId] = {
      quantity,
      unit: card.unit,
      quantitySource: source,
    };
  }
  return out;
}

/**
 * Converge notes/voice/manual electrical inputs onto canonical keys.
 * Does not invoke pricing or plan-symbol extraction.
 */
export function buildElectricalStructuredMeasurements(
  input: Record<string, unknown>,
  quantitySource = 'user_entered'
): ElectricalStructuredMeasurements {
  const inferred = inferredScopeFromQuantities(input);
  const explicit = readExplicitElectricalScope(input);
  const electricalScope = explicit?.length
    ? [...new Set([...explicit, ...inferred])]
    : inferred.length
      ? inferred
      : null;
  const itemQuantities = buildItemQuantities(input, quantitySource);
  return {
    electricalScope,
    electricalProjectCondition: readProjectCondition(
      input.electricalProjectCondition
    ),
    electricalIncludeRough: readBooleanFlag(input.electricalIncludeRough),
    electricalIncludeTrim: readBooleanFlag(input.electricalIncludeTrim),
    electricalConduit: readBooleanFlag(input.electricalConduit),
    electricalTrenching: readBooleanFlag(input.electricalTrenching),
    existingServiceAmperage: positiveNumber(input.existingServiceAmperage),
    electricalPanelLocation: readPanelLocation(input.electricalPanelLocation),
    electricalMeterMainCombo: readBooleanFlag(input.electricalMeterMainCombo),
    itemQuantities: Object.keys(itemQuantities).length ? itemQuantities : null,
  };
}

export function normalizeElectricalScalarMeasurements(
  input: Record<string, unknown>,
  _structured?: ElectricalStructuredMeasurements
): Record<string, number | string> {
  const out: Record<string, number | string> = {};
  for (const key of ELECTRICAL_REVIEW_MEASUREMENT_KEYS) {
    const n = positiveNumber(input[key]);
    if (n != null) out[key] = n;
  }
  return out;
}

export function copyElectricalQuantityFields(
  source: Record<string, unknown> | null | undefined,
  parse: (value: unknown) => number | null = positiveNumber
): Partial<Record<ElectricalQuantityKey, number | null>> {
  const out: Partial<Record<ElectricalQuantityKey, number | null>> = {};
  if (!source) return out;
  for (const key of ELECTRICAL_REVIEW_MEASUREMENT_KEYS) {
    const parsed = parse(source[key]);
    if (parsed != null) out[key] = parsed;
  }
  return out;
}

export function copyElectricalConditionFields(source: Record<string, unknown> | null | undefined): {
  electricalScope: string[] | null;
  electricalProjectCondition: ElectricalProjectCondition | null;
  electricalIncludeRough: boolean | null;
  electricalIncludeTrim: boolean | null;
  electricalConduit: boolean | null;
  electricalTrenching: boolean | null;
  existingServiceAmperage: number | null;
  electricalPanelLocation: ElectricalPanelLocation | null;
  electricalMeterMainCombo: boolean | null;
} {
  return {
    electricalScope: readExplicitElectricalScope(source || {}),
    electricalProjectCondition: readProjectCondition(
      source?.electricalProjectCondition
    ),
    electricalIncludeRough: readBooleanFlag(source?.electricalIncludeRough),
    electricalIncludeTrim: readBooleanFlag(source?.electricalIncludeTrim),
    electricalConduit: readBooleanFlag(source?.electricalConduit),
    electricalTrenching: readBooleanFlag(source?.electricalTrenching),
    existingServiceAmperage: positiveNumber(source?.existingServiceAmperage),
    electricalPanelLocation: readPanelLocation(source?.electricalPanelLocation),
    electricalMeterMainCombo: readBooleanFlag(source?.electricalMeterMainCombo),
  };
}

export function electricalChecklistGroups(): Array<{
  title: string;
  itemIds: string[];
}> {
  return [
    ...ELECTRICAL_CARD_GROUPS.map(group => ({
      title: group.title,
      itemIds: ELECTRICAL_CARDS.filter(card => card.groupId === group.id).map(
        card => card.itemId
      ),
    })),
    { title: 'Closeout', itemIds: ['cleanup'] },
  ];
}

export function electricalTemplateItems(): Array<{
  id: string;
  inputType: 'yes_no';
  label: string;
  helperText: string;
  category: string;
}> {
  return [
    ...ELECTRICAL_CARDS.filter(card => card.measurementKey !== 'serviceAmperage').map(
      card => ({
        id: card.itemId,
        inputType: 'yes_no' as const,
        label: card.label,
        helperText: card.helper,
        category: card.groupId,
      })
    ),
    {
      id: 'cleanup',
      inputType: 'yes_no',
      label: 'Cleanup & disposal',
      helperText: 'Job cleanup and debris from electrical work.',
      category: 'closeout',
    },
  ];
}

export function syncElectricalScopeItems<T extends { id: string; state?: string }>(
  items: T[],
  params: {
    electricalScope?: string[] | null;
    quantities?: Partial<Record<ElectricalQuantityKey, unknown>>;
  }
): T[] {
  const included = new Set(params.electricalScope || []);
  for (const card of ELECTRICAL_CARDS) {
    if (card.measurementKey === 'serviceAmperage') continue;
    if (positiveNumber(params.quantities?.[card.measurementKey]) != null) {
      included.add(card.itemId);
    }
  }
  if (!included.size) return items;
  return items.map(item => {
    if (!included.has(item.id)) return item;
    if (item.state === 'excluded') return item;
    return item.state === 'included' ? item : { ...item, state: 'included' };
  });
}

const WORD_COUNTS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

const COUNT_TOKEN = String.raw`(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)`;

function parseCountToken(raw: string | undefined): number | null {
  const token = String(raw || '').toLowerCase();
  if (WORD_COUNTS[token] != null) return WORD_COUNTS[token];
  const n = Number(String(token).replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

type ParseRule = {
  key: ElectricalQuantityKey;
  pattern: RegExp;
  defaultCount?: number;
};

const APPLIANCE_RULES: ParseRule[] = [
  {
    key: 'rangeHookupCount',
    pattern: new RegExp(
      String.raw`${COUNT_TOKEN}?\s*(?:\d+\s*amp(?:ere)?s?\s+)?(?:electric\s+)?range(?:\s+circuit|\s+hookup)s?\b|\b(?:electric\s+)?range(?:\s+circuit|\s+hookup)s?\b|\belectric\s+ranges?\b`,
      'i'
    ),
  },
  {
    key: 'dryerHookupCount',
    pattern: new RegExp(
      String.raw`${COUNT_TOKEN}?\s*(?:\d+\s*amp(?:ere)?s?\s+)?(?:electric\s+)?dryer(?:\s+circuit|\s+hookup)?s?\b|\b(?:electric\s+)?dryer(?:\s+circuit|\s+hookup)s?\b`,
      'i'
    ),
  },
  {
    key: 'dishwasherHookupCount',
    pattern: new RegExp(
      String.raw`${COUNT_TOKEN}?\s*dishwasher(?:\s+circuit|\s+hookup)?s?\b|\bdishwasher(?:\s+circuit|\s+hookup)s?\b`,
      'i'
    ),
  },
  {
    key: 'disposalHookupCount',
    pattern: new RegExp(
      String.raw`${COUNT_TOKEN}?\s*(?:garbage\s+)?disposal(?:\s+circuit|\s+hookup)?s?\b|\b(?:garbage\s+)?disposal(?:\s+circuit|\s+hookup)s?\b`,
      'i'
    ),
  },
  {
    key: 'microwaveHookupCount',
    pattern: new RegExp(
      String.raw`${COUNT_TOKEN}?\s*(?:dedicated\s+)?microwave(?:\s+circuit|\s+hookup)?s?\b|\b(?:dedicated\s+)?microwave(?:\s+circuit|\s+hookup)s?\b`,
      'i'
    ),
  },
  {
    key: 'refrigeratorHookupCount',
    pattern: new RegExp(
      String.raw`${COUNT_TOKEN}?\s*(?:dedicated\s+)?(?:refrigerator|fridge)(?:\s+dedicated)?(?:\s+circuit|\s+hookup)s?\b|\b(?:dedicated\s+)?(?:refrigerator|fridge)(?:\s+dedicated)?(?:\s+circuit|\s+hookup)s?\b`,
      'i'
    ),
  },
  {
    key: 'waterHeaterHookupCount',
    pattern: new RegExp(
      String.raw`${COUNT_TOKEN}?\s*electric\s+water[\s-]?heater(?:\s+(?:circuit|hookup|electrical\s+connection))?s?\b|\bwater[\s-]?heater(?:\s+(?:circuit|hookup|electrical\s+connection))s?\b`,
      'i'
    ),
  },
  {
    key: 'hvacHookupCount',
    pattern: new RegExp(
      String.raw`${COUNT_TOKEN}?\s*(?:hvac|air[\s-]?handler|condenser)(?:\s+circuit|\s+hookup|\s+disconnect)?s?\b|\b(?:hvac|air[\s-]?handler|condenser)(?:\s+circuit|\s+hookup|\s+disconnect)s?\b`,
      'i'
    ),
  },
  {
    key: 'evChargerHookupCount',
    pattern: new RegExp(
      String.raw`${COUNT_TOKEN}?\s*(?:ev\s+charger|electric\s+vehicle\s+charger|car\s+charger)(?:\s+circuit|\s+hookup)?s?\b|\b(?:ev\s+charger|electric\s+vehicle\s+charger)(?:\s+circuit|\s+hookup)s?\b`,
      'i'
    ),
  },
];

const DEVICE_RULES: ParseRule[] = [
  {
    key: 'recessedLightCount',
    pattern: new RegExp(
      String.raw`${COUNT_TOKEN}\s*(?:recessed|canless|wafer|can)\s+(?:lights?|lighting|cans?|fixtures?)\b|\b(?:recessed|canless|wafer)\s+(?:lights?|lighting|cans?|fixtures?)\b`,
      'i'
    ),
  },
  {
    key: 'pendantLightCount',
    pattern: new RegExp(
      String.raw`${COUNT_TOKEN}\s*pendants?(?:\s+lights?|\s+fixtures?)?\b|\bpendants?(?:\s+lights?|\s+fixtures?)?\b`,
      'i'
    ),
  },
  {
    key: 'decorativeLightCount',
    pattern: new RegExp(
      String.raw`${COUNT_TOKEN}\s*(?:decorative|chandeliers?|heavy)(?:\s+(?:lights?|fixtures?))?\b|\b(?:decorative|chandeliers?|heavy)\s+(?:lights?|fixtures?)\b|\bchandeliers?\b`,
      'i'
    ),
  },
  {
    key: 'exteriorLightCount',
    pattern: new RegExp(
      String.raw`${COUNT_TOKEN}\s*(?:exterior|outdoor|porch)\s+(?:lights?|lighting|fixtures?)\b|\b(?:exterior|outdoor|porch)\s+(?:lights?|lighting|fixtures?)\b`,
      'i'
    ),
  },
  {
    key: 'undercabinetLightCount',
    pattern: new RegExp(
      String.raw`${COUNT_TOKEN}\s*(?:under[\s-]?cabinet|undercabinet)\s+(?:lights?|lighting|fixtures?)?\b|\b(?:under[\s-]?cabinet|undercabinet)\s+(?:lights?|lighting)\b`,
      'i'
    ),
  },
  {
    key: 'ceilingFanCount',
    pattern: new RegExp(
      String.raw`${COUNT_TOKEN}\s*ceiling\s+fans?\b|\bceiling\s+fans?\b`,
      'i'
    ),
  },
  {
    key: 'bathExhaustFanCount',
    pattern: new RegExp(
      String.raw`${COUNT_TOKEN}\s*(?:bath(?:room)?\s+)?(?:exhaust|bath)\s+fans?\b|\b(?:bath(?:room)?\s+)?(?:exhaust|bath)\s+fans?\b`,
      'i'
    ),
  },
  {
    key: 'standardFixtureCount',
    pattern: new RegExp(
      String.raw`${COUNT_TOKEN}\s*(?:standard\s+|vanity\s+)?(?:light\s+)?fixtures?\b|${COUNT_TOKEN}\s*vanity\s+lights?\b|\b(?:standard\s+)?light\s+fixtures?\b|\bvanity\s+lights?\b`,
      'i'
    ),
  },
  {
    key: 'gfciReceptacleCount',
    pattern: new RegExp(
      String.raw`${COUNT_TOKEN}\s*gfci(?:\s+outlets?|\s+receptacles?|\s+plugs?)?\b|\bgfci(?:\s+outlets?|\s+receptacles?|\s+plugs?)\b`,
      'i'
    ),
  },
  {
    key: 'afciReceptacleCount',
    pattern: new RegExp(
      String.raw`${COUNT_TOKEN}\s*afci(?:\s+outlets?|\s+receptacles?)?\b|\bafci(?:\s+outlets?|\s+receptacles?)\b`,
      'i'
    ),
  },
  {
    key: 'exteriorReceptacleCount',
    pattern: new RegExp(
      String.raw`${COUNT_TOKEN}\s*(?:exterior|outdoor|weather[\s-]?resistant|wr)\s+(?:outlets?|receptacles?|gfci)\b|\b(?:exterior|outdoor)\s+(?:outlets?|receptacles?)\b`,
      'i'
    ),
  },
  {
    key: 'floorReceptacleCount',
    pattern: new RegExp(
      String.raw`${COUNT_TOKEN}\s*floor\s+(?:outlets?|receptacles?|boxes)\b|\bfloor\s+(?:outlets?|receptacles?)\b`,
      'i'
    ),
  },
  {
    key: 'usbReceptacleCount',
    pattern: new RegExp(
      String.raw`${COUNT_TOKEN}\s*(?:usb|usb[\s-]?c|specialty)\s+(?:outlets?|receptacles?)\b|\b(?:usb|usb[\s-]?c)\s+(?:outlets?|receptacles?)\b`,
      'i'
    ),
  },
  {
    key: 'receptacle240vCount',
    pattern: new RegExp(
      String.raw`${COUNT_TOKEN}\s*(?:240\s*v(?:olt)?|220\s*v(?:olt)?)\s+(?:outlets?|receptacles?)\b|\b(?:240\s*v(?:olt)?|220\s*v(?:olt)?)\s+(?:outlets?|receptacles?)\b`,
      'i'
    ),
  },
  {
    key: 'standardReceptacleCount',
    pattern: new RegExp(
      String.raw`${COUNT_TOKEN}\s*(?:standard\s+)?(?:outlets?|receptacles?|plugs?)\b|\b(?:standard\s+)?(?:outlets?|receptacles?)\b`,
      'i'
    ),
  },
  {
    key: 'threeWaySwitchCount',
    pattern: new RegExp(
      String.raw`${COUNT_TOKEN}\s*(?:3|three)[\s-]?way\s+switch(?:es)?\b|\b(?:3|three)[\s-]?way\s+switch(?:es)?\b`,
      'i'
    ),
  },
  {
    key: 'fourWaySwitchCount',
    pattern: new RegExp(
      String.raw`${COUNT_TOKEN}\s*(?:4|four)[\s-]?way\s+switch(?:es)?\b|\b(?:4|four)[\s-]?way\s+switch(?:es)?\b`,
      'i'
    ),
  },
  {
    key: 'dimmerSwitchCount',
    pattern: new RegExp(
      String.raw`${COUNT_TOKEN}\s*dimmers?(?:\s+switch(?:es)?)?\b|\bdimmers?(?:\s+switch(?:es)?)?\b`,
      'i'
    ),
  },
  {
    key: 'occupancySwitchCount',
    pattern: new RegExp(
      String.raw`${COUNT_TOKEN}\s*(?:occupancy|vacancy|motion)\s+(?:sensor(?:s)?(?:\s+switch(?:es)?)?|switch(?:es)?)\b|\b(?:occupancy|vacancy|motion)\s+(?:sensor(?:s)?(?:\s+switch(?:es)?)?|switch(?:es)?)\b`,
      'i'
    ),
  },
  {
    key: 'smartSwitchCount',
    pattern: new RegExp(
      String.raw`${COUNT_TOKEN}\s*smart\s+switch(?:es)?\b|\bsmart\s+switch(?:es)?\b`,
      'i'
    ),
  },
  {
    key: 'singlePoleSwitchCount',
    pattern: new RegExp(
      String.raw`${COUNT_TOKEN}\s*(?:standard\s+)?(?:single[\s-]?pole\s+)?switch(?:es)?\b|\b(?:standard\s+)?(?:single[\s-]?pole\s+)?switch(?:es)?\b`,
      'i'
    ),
  },
  {
    key: 'smokeDetectorCount',
    pattern: new RegExp(
      String.raw`${COUNT_TOKEN}\s*smoke(?:\s+detectors?|\s+alarms?)?\b|\bsmoke(?:\s+detectors?|\s+alarms?)\b`,
      'i'
    ),
  },
  {
    key: 'coDetectorCount',
    pattern: new RegExp(
      String.raw`${COUNT_TOKEN}\s*(?:co|carbon\s+monoxide)(?:\s+detectors?|\s+alarms?)?\b|\b(?:co|carbon\s+monoxide)(?:\s+detectors?|\s+alarms?)\b`,
      'i'
    ),
  },
  {
    key: 'doorbellCount',
    pattern: new RegExp(
      String.raw`${COUNT_TOKEN}\s*door\s*bells?\b|\bdoor\s*bells?\b`,
      'i'
    ),
  },
  {
    key: 'cameraPrewireCount',
    pattern: new RegExp(
      String.raw`${COUNT_TOKEN}\s*(?:(?:poe|ring|nest)\s+)?cameras?\s+(?:prewire|pre[\s-]?wire|drops?|runs?|cables?)\b|${COUNT_TOKEN}\s*camera\s+(?:prewire|pre[\s-]?wire)s?\b|\bprewire\s+${COUNT_TOKEN}\s+(?:(?:poe|ring|nest)\s+)?cameras?\b|\b(?:camera\s+)?(?:prewire|pre[\s-]?wire)s?\s+(?:for\s+)?(?:${COUNT_TOKEN}\s+)?(?:(?:poe|ring|nest)\s+)?cameras?\b|\blow[\s-]?voltage\s+camera\s+drops?\b|\b(?:video|ring|nest)\s+door\s*bells?\s+(?:prewire|pre[\s-]?wire|drops?)\b|\bcameras?\s+(?:prewire|pre[\s-]?wire|drops?)\b`,
      'i'
    ),
  },
  {
    key: 'cat6DropCount',
    pattern: new RegExp(
      String.raw`${COUNT_TOKEN}\s*(?:cat\s*6|data|ethernet)\s+(?:drops?|outlets?|jacks?|runs?)?\b|\b(?:cat\s*6|data|ethernet)\s+(?:drops?|outlets?|jacks?)\b`,
      'i'
    ),
  },
  {
    key: 'tvCoaxCount',
    pattern: new RegExp(
      String.raw`${COUNT_TOKEN}\s*(?:tv|coax|rg6)\s+(?:outlets?|drops?|jacks?)?\b|\b(?:tv|coax|rg6)\s+(?:outlets?|drops?|jacks?)\b`,
      'i'
    ),
  },
  {
    key: 'securityPrewireCount',
    pattern: new RegExp(
      String.raw`${COUNT_TOKEN}\s*(?:security|alarm)\s+(?:prewire|pre[\s-]?wire|drops?)?\b|\b(?:security|alarm)\s+(?:prewire|pre[\s-]?wire)\b`,
      'i'
    ),
  },
  {
    key: 'deviceRemovalCount',
    pattern: new RegExp(
      String.raw`${COUNT_TOKEN}\s*(?:remove|removal of)\s+(?:existing\s+)?(?:outlets?|receptacles?|switches?|devices?)\b|\b(?:remove|removal of)\s+(?:${COUNT_TOKEN}\s+)?(?:existing\s+)?(?:outlets?|receptacles?|switches?|devices?)\b`,
      'i'
    ),
  },
  {
    key: 'fixtureRemovalCount',
    pattern: new RegExp(
      String.raw`${COUNT_TOKEN}\s*(?:remove|removal of)\s+(?:existing\s+)?(?:(?:light\s+)?fixtures?|(?:ceiling\s+)?fans?)\b|\b(?:remove|removal of)\s+(?:${COUNT_TOKEN}\s+)?(?:existing\s+)?(?:(?:light\s+)?fixtures?|(?:ceiling\s+)?fans?)\b`,
      'i'
    ),
  },
  {
    key: 'relocateCount',
    pattern: new RegExp(
      String.raw`${COUNT_TOKEN}\s*(?:relocat(?:e|ion)s?|move(?:s|d)?)\s+(?:an?\s+|the\s+)?(?:existing\s+)?(?:outlets?|switches?|fixtures?|devices?|switch\s+locations?)?\b|\b(?:relocat(?:e|ion)s?|move(?:s|d)?)\s+(?:${COUNT_TOKEN}\s+)?(?:an?\s+|the\s+)?(?:existing\s+)?(?:outlets?|switches?|fixtures?|devices?|switch\s+locations?)\b`,
      'i'
    ),
  },
  {
    key: 'abandonedCircuitCount',
    pattern: new RegExp(
      String.raw`${COUNT_TOKEN}\s*abandon(?:ed)?\s+circuits?\b|\babandon(?:ed)?\s+(?:${COUNT_TOKEN}\s+)?circuits?\b`,
      'i'
    ),
  },
];

const CIRCUIT_RULES: ParseRule[] = [
  {
    key: 'dedicated20aCircuitCount',
    pattern: new RegExp(
      String.raw`${COUNT_TOKEN}\s*dedicated\s+(?:20\s*amp(?:ere)?s?\s+)?circuits?\b|\bdedicated\s+(?:20\s*amp(?:ere)?s?\s+)?circuits?\b`,
      'i'
    ),
  },
  {
    key: 'circuit30aCount',
    pattern: new RegExp(
      String.raw`${COUNT_TOKEN}\s*(?:dedicated\s+)?30\s*amp(?:ere)?s?\s+circuits?\b|\b(?:dedicated\s+)?30\s*amp(?:ere)?s?\s+circuits?\b`,
      'i'
    ),
  },
  {
    key: 'circuit40aCount',
    pattern: new RegExp(
      String.raw`${COUNT_TOKEN}\s*(?:dedicated\s+)?40\s*amp(?:ere)?s?\s+circuits?\b|\b(?:dedicated\s+)?40\s*amp(?:ere)?s?\s+circuits?\b`,
      'i'
    ),
  },
  {
    key: 'circuit50aCount',
    pattern: new RegExp(
      String.raw`${COUNT_TOKEN}\s*(?:dedicated\s+)?50\s*amp(?:ere)?s?\s+circuits?\b|\b(?:dedicated\s+)?50\s*amp(?:ere)?s?\s+circuits?\b`,
      'i'
    ),
  },
  {
    key: 'circuit60aPlusCount',
    pattern: new RegExp(
      String.raw`${COUNT_TOKEN}\s*(?:dedicated\s+)?(?:60|70|80|100)\s*amp(?:ere)?s?\s+circuits?\b|\b(?:dedicated\s+)?(?:60|70|80|100)\s*amp(?:ere)?s?\s+circuits?\b`,
      'i'
    ),
  },
  {
    key: 'standardCircuitCount',
    pattern: new RegExp(
      String.raw`${COUNT_TOKEN}\s*(?:standard\s+)?(?:15|20)\s*amp(?:ere)?s?\s+circuits?\b|\b(?:standard\s+)?(?:15\/20|15|20)\s*amp(?:ere)?s?\s+circuits?\b|${COUNT_TOKEN}\s*(?:new\s+)?(?:branch\s+)?circuits?\b`,
      'i'
    ),
  },
];

function matchRuleCount(text: string, rule: ParseRule): number | null {
  const match = text.match(rule.pattern);
  if (!match) return null;
  const raw = match.slice(1).find(part => part != null && String(part).trim());
  const counted = parseCountToken(raw);
  if (counted != null) return counted;
  return rule.defaultCount ?? 1;
}

function parseProjectCondition(text: string): ElectricalProjectCondition | null {
  const n = text.toLowerCase();
  if (
    /\bnew\s+construction\b|\bnew\s+build\b|\bfull\s+rough(?:[\s-]?in)?\b|\bopen[\s-]?frame\b/.test(
      n
    )
  ) {
    return 'new_construction';
  }
  if (
    /\bfinished[\s-]?wall\b|\bfish(?:ing)?\s+(?:in\s+)?(?:finished\s+)?walls?\b|\bretrofit\b|\bservice\s+call\b/.test(
      n
    )
  ) {
    return 'finished_wall_service';
  }
  if (/\bremodel\b|\bopen[\s-]?wall\b|\bwalls?\s+open\b/.test(n)) {
    return 'remodel_open_wall';
  }
  return null;
}

function looksLikeElectricalNotes(text: string): boolean {
  return /\b(electrical|outlet|receptacle|gfci|afci|switch(?:es)?|dimmers?|recessed|canless|wafer|vanity\s+lights?|pendant|chandelier|panel|subpanel|circuits?|ceiling\s+fan|amp(?:ere)?s?|\d+\s*a\b|service|ev\s+charger|cat\s*6|smoke\s+detector|doorbell|cameras?|prewire|poe|remove|removal|relocat|abandon|conduit|rough[\s-]?in|finished[\s-]?wall|fish(?:ing)?\s+(?:in\s+)?walls?)\b/i.test(
    text
  );
}

function isSpecializedReceptacleClause(clause: string): boolean {
  return /\bgfci\b|\bafci\b|\bexterior\b|\boutdoor\b|\bfloor\s+(?:outlet|receptacle)\b|\busb\b|\b240\s*v|\b220\s*v/i.test(
    clause
  );
}

function isSpecializedSwitchClause(clause: string): boolean {
  return /\b(?:3|three)[\s-]?way\b|\b(?:4|four)[\s-]?way\b|\bdimmers?\b|\boccupancy\b|\bvacancy\b|\bmotion\b|\bsmart\s+switch/i.test(
    clause
  );
}

function isDeviceRelocationClause(clause: string): boolean {
  return (
    /\brelocat/i.test(clause) ||
    /\bmove(?:s|d)?\s+(?:an?\s+|the\s+|\d+\s+|one\s+|two\s+)?(?:existing\s+)?(?:switch|outlet|receptacle|fixture|device)/i.test(
      clause
    )
  );
}

function isSwitchDeviceRule(key: ElectricalQuantityKey): boolean {
  return (
    key === 'singlePoleSwitchCount' ||
    key === 'threeWaySwitchCount' ||
    key === 'fourWaySwitchCount' ||
    key === 'dimmerSwitchCount' ||
    key === 'occupancySwitchCount' ||
    key === 'smartSwitchCount'
  );
}

function isInstallReceptacleRule(key: ElectricalQuantityKey): boolean {
  return (
    key === 'standardReceptacleCount' ||
    key === 'gfciReceptacleCount' ||
    key === 'afciReceptacleCount' ||
    key === 'exteriorReceptacleCount' ||
    key === 'floorReceptacleCount' ||
    key === 'usbReceptacleCount' ||
    key === 'receptacle240vCount'
  );
}

function isInstallFixtureRule(key: ElectricalQuantityKey): boolean {
  return (
    key === 'standardFixtureCount' ||
    key === 'recessedLightCount' ||
    key === 'pendantLightCount' ||
    key === 'decorativeLightCount' ||
    key === 'exteriorLightCount' ||
    key === 'undercabinetLightCount' ||
    key === 'ceilingFanCount' ||
    key === 'bathExhaustFanCount'
  );
}

function isDeviceRemovalClause(clause: string): boolean {
  return new RegExp(
    String.raw`\b(?:remove|removal of)\s+(?:${COUNT_TOKEN}\s+)?(?:existing\s+)?(?:outlets?|receptacles?|switches?|devices?)\b`,
    'i'
  ).test(clause);
}

function isFixtureRemovalClause(clause: string): boolean {
  return new RegExp(
    String.raw`\b(?:remove|removal of)\s+(?:${COUNT_TOKEN}\s+)?(?:existing\s+)?(?:(?:light\s+)?fixtures?|(?:ceiling\s+)?fans?)\b`,
    'i'
  ).test(clause);
}

function isSpecializedLightClause(clause: string): boolean {
  return /\brecessed\b|\bcanless\b|\bwafer\b|\bpendants?\b|\bchandeliers?\b|\bdecorative\b|\bexterior\s+light|\bunder[\s-]?cabinet/i.test(
    clause
  );
}

function isApplianceOwnedCircuit(clause: string): boolean {
  return /\brange\b|\bdryer\b|\bdishwasher\b|\bdisposal\b|\bmicrowave\b|\brefrigerator\b|\bwater[\s-]?heater\b|\bhvac\b|\bev\s+charger/i.test(
    clause
  );
}

function isCameraPrewireClause(clause: string): boolean {
  if (
    /\b(?:video|ring|nest)\s+door\s*bells?\s+(?:prewire|pre[\s-]?wire|drops?)\b/i.test(
      clause
    )
  ) {
    return true;
  }
  return (
    /\bcameras?\b/i.test(clause) &&
    /\b(?:prewire|pre[\s-]?wire|drops?|runs?|cables?|cat\s*6|low[\s-]?voltage)\b/i.test(
      clause
    )
  );
}

function isVideoDoorbellClause(clause: string): boolean {
  return /\b(?:video|ring|nest|camera)\s+door\s*bells?\b/i.test(clause);
}

function isWholeHouseWiringPackageClause(clause: string): boolean {
  if (
    !/\b(?:whole[\s-]?house|structured\s+wiring(?:\s+package)?)\b/i.test(clause)
  ) {
    return false;
  }
  return !new RegExp(
    String.raw`${COUNT_TOKEN}\s*(?:cat\s*6|data|ethernet)\s+(?:drops?|outlets?|jacks?|runs?)`,
    'i'
  ).test(clause);
}

/**
 * Parse Notes/Voice electrical examples onto canonical keys.
 * Manual edits remain authoritative via existing user_entered merge.
 */
export function parseElectricalMeasurementsFromNotes(
  notes: string
): ElectricalParsedMeasurements {
  const text = String(notes || '').trim();
  if (!text || !looksLikeElectricalNotes(text)) return {};

  const clauses = text
    .split(/(?<=[.;\n])\s+|\s*(?:,|and)\s+(?=\d|a\b|an\b|one|two|three|four|five|six|seven|eight|nine|ten)/i)
    .map(part => part.trim())
    .filter(Boolean);
  const searchClauses = clauses.length ? clauses : [text];
  const out: ElectricalParsedMeasurements = {};

  const assign = (key: ElectricalQuantityKey, quantity: number | null) => {
    if (quantity == null || quantity <= 0) return;
    out[key] = (out[key] || 0) + quantity;
  };

  const panelMatch = text.match(
    /(\d+)\s*(?:amp(?:ere)?s?|a)\s+(?:main\s+)?panel|\b(?:main\s+)?panel\s*(?:is|:)?\s*(\d+)\s*(?:amp(?:ere)?s?|a)\b/i
  );
  if (panelMatch) {
    const amps = Number(panelMatch[1] || panelMatch[2]);
    if (Number.isFinite(amps) && amps > 0) out.serviceAmperage = amps;
  } else {
    const ampOnly = text.match(/\b(\d+)\s*(?:amp(?:ere)?s?|a)\s+(?:service|panel)\b/i);
    if (ampOnly) {
      const amps = Number(ampOnly[1]);
      if (Number.isFinite(amps) && amps > 0) out.serviceAmperage = amps;
    }
  }

  if (/\bsub[\s-]?panels?\b/i.test(text)) {
    const count =
      matchRuleCount(
        text,
        {
          key: 'subpanelCount',
          pattern: new RegExp(
            String.raw`${COUNT_TOKEN}\s*sub[\s-]?panels?\b|\bsub[\s-]?panels?\b`,
            'i'
          ),
        }
      ) || 1;
    assign('subpanelCount', count);
  }
  if (/\bpanel\s+upgrade|\bupgrade\s+(?:the\s+)?panel\b/i.test(text)) {
    assign(
      'panelUpgradeCount',
      matchRuleCount(text, {
        key: 'panelUpgradeCount',
        pattern: new RegExp(
          String.raw`${COUNT_TOKEN}\s*panel\s+upgrades?\b|\bpanel\s+upgrade`,
          'i'
        ),
      }) || 1
    );
  } else if (/\bservice\s+upgrade|\bupgrade\s+(?:the\s+)?service\b/i.test(text)) {
    assign(
      'serviceUpgradeCount',
      matchRuleCount(text, {
        key: 'serviceUpgradeCount',
        pattern: new RegExp(
          String.raw`${COUNT_TOKEN}\s*service\s+upgrades?\b|\bservice\s+upgrade`,
          'i'
        ),
      }) || 1
    );
  } else if (
    /\b(?:main\s+)?panels?\b/i.test(text) &&
    !/\bsub[\s-]?panel\b/i.test(text)
  ) {
    assign(
      'mainPanelCount',
      matchRuleCount(text, {
        key: 'mainPanelCount',
        pattern: new RegExp(
          String.raw`${COUNT_TOKEN}\s*(?:main\s+)?panels?\b|\b(?:install|new)\s+(?:a\s+)?(?:\d+\s*amp(?:ere)?s?\s+)?(?:main\s+)?panel\b`,
          'i'
        ),
      }) || 1
    );
  }

  const owned = applyElectricalServicePanelOwnership(out, text);
  for (const key of Object.keys(out)) {
    if (!(key in owned)) delete out[key as keyof ElectricalParsedMeasurements];
  }
  Object.assign(out, owned);

  for (const clause of searchClauses) {
    for (const rule of APPLIANCE_RULES) {
      if (rule.key === 'waterHeaterHookupCount' && /\bgas\b/i.test(clause)) {
        continue;
      }
      assign(rule.key, matchRuleCount(clause, rule));
    }
  }

  for (const clause of searchClauses) {
    for (const rule of CIRCUIT_RULES) {
      if (isApplianceOwnedCircuit(clause)) {
        continue;
      }
      if (
        rule.key === 'dedicated20aCircuitCount' &&
        /\b(?:30|40|50|60|70|80|100)\s*amp/i.test(clause)
      ) {
        continue;
      }
      if (
        rule.key === 'standardCircuitCount' &&
        (/\bdedicated\b/i.test(clause) ||
          /\b(?:30|40|50|60|70|80|100)\s*amp/i.test(clause) ||
          /\babandon/i.test(clause))
      ) {
        continue;
      }
      if (
        rule.key === 'circuit50aCount' &&
        /\brange\b/i.test(clause)
      ) {
        continue;
      }
      if (
        rule.key === 'circuit60aPlusCount' &&
        /\bev\s+charger\b/i.test(clause)
      ) {
        continue;
      }
      assign(rule.key, matchRuleCount(clause, rule));
    }
  }

  for (const clause of searchClauses) {
    for (const rule of DEVICE_RULES) {
      if (
        rule.key === 'standardReceptacleCount' &&
        isSpecializedReceptacleClause(clause)
      ) {
        continue;
      }
      if (
        rule.key === 'gfciReceptacleCount' &&
        (/\b(?:exterior|outdoor)\b/i.test(clause) || /\bafci\b/i.test(clause))
      ) {
        continue;
      }
      if (
        rule.key === 'receptacle240vCount' &&
        isApplianceOwnedCircuit(clause)
      ) {
        continue;
      }
      if (
        (isSwitchDeviceRule(rule.key) ||
          isInstallReceptacleRule(rule.key) ||
          isInstallFixtureRule(rule.key)) &&
        isDeviceRelocationClause(clause)
      ) {
        continue;
      }
      if (
        (isSwitchDeviceRule(rule.key) || isInstallReceptacleRule(rule.key)) &&
        isDeviceRemovalClause(clause)
      ) {
        continue;
      }
      if (
        isInstallFixtureRule(rule.key) &&
        isFixtureRemovalClause(clause)
      ) {
        continue;
      }
      if (
        rule.key === 'singlePoleSwitchCount' &&
        isSpecializedSwitchClause(clause)
      ) {
        continue;
      }
      if (
        rule.key === 'standardFixtureCount' &&
        isSpecializedLightClause(clause)
      ) {
        continue;
      }
      if (
        rule.key === 'bathExhaustFanCount' &&
        /\bceiling\s+fan/i.test(clause)
      ) {
        continue;
      }
      if (rule.key === 'doorbellCount' && isVideoDoorbellClause(clause)) {
        continue;
      }
      if (
        (rule.key === 'cat6DropCount' || rule.key === 'securityPrewireCount') &&
        isCameraPrewireClause(clause)
      ) {
        continue;
      }
      if (
        rule.key === 'cat6DropCount' &&
        isWholeHouseWiringPackageClause(clause)
      ) {
        continue;
      }
      assign(rule.key, matchRuleCount(clause, rule));
    }
  }

  const condition = parseProjectCondition(text);
  if (condition) out.electricalProjectCondition = condition;
  if (/\brough(?:[\s-]?in)?\b/i.test(text)) out.electricalIncludeRough = true;
  if (/\btrim(?:[\s-]?out)?\b|\bdevices?\s+and\s+plates\b/i.test(text)) {
    out.electricalIncludeTrim = true;
  }
  if (/\bconduit\b/i.test(text)) out.electricalConduit = true;
  if (/\btrench(?:ing)?\b/i.test(text)) out.electricalTrenching = true;

  const structured = buildElectricalStructuredMeasurements(
    {
      ...out,
    },
    'notes'
  );
  const definedStructured = Object.fromEntries(
    Object.entries(structured).filter(([, value]) => value != null)
  );
  return {
    ...out,
    ...definedStructured,
  };
}

export function electricalQuantityRules(): Record<
  string,
  {
    defaultUnit: string;
    allowedUnits: string[];
    measurementKey: ElectricalQuantityKey;
    requiresUserQuantity: boolean;
    quantityHelper: string;
    missingMessage: string;
  }
> {
  return Object.fromEntries(
    ELECTRICAL_CARDS.filter(card => card.measurementKey !== 'serviceAmperage').map(
      card => [
        card.itemId,
        {
          defaultUnit: card.unit,
          allowedUnits: [card.unit, 'allowance', 'lump_sum'],
          measurementKey: card.measurementKey,
          requiresUserQuantity: true,
          quantityHelper: card.helper,
          missingMessage: ELECTRICAL_NEEDS_PRICING_LABEL,
        },
      ]
    )
  );
}

/**
 * Package vs detailed Electrical pricing.
 *
 * PACKAGE MODE: whole-project `electrical_rough` allowance when detailed counts
 * are unavailable (bathroom/kitchen/ground-up compatibility).
 *
 * DETAILED MODE: owned circuit/device/fixture/panel counts. Once those exist,
 * the generic rough package must not auto-price the same branch/device work.
 *
 * Living SF / floor SF / building SF is never a quantity owner for canonical
 * Electrical cards, and it must not price `electrical_rough` on the Electrical
 * estimator or alongside detailed takeoff.
 */
export type ElectricalPricingMode = 'package' | 'detailed';

function readPositiveQuantity(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'object' && value && 'quantity' in (value as object)) {
    return readPositiveQuantity((value as { quantity?: unknown }).quantity);
  }
  return positiveNumber(value);
}

export function hasDetailedElectricalQuantities(
  input: Record<string, unknown> | null | undefined
): boolean {
  if (!input) return false;
  const itemQuantities = (input.itemQuantities || {}) as Record<
    string,
    { quantity?: unknown }
  >;
  for (const card of ELECTRICAL_CARDS) {
    if (card.measurementKey === 'serviceAmperage') continue;
    if (readPositiveQuantity(input[card.measurementKey]) != null) return true;
    if (readPositiveQuantity(itemQuantities[card.itemId]?.quantity) != null) {
      return true;
    }
  }
  const scope = Array.isArray(input.electricalScope) ? input.electricalScope : [];
  return scope.some(id => isCanonicalElectricalItemId(String(id)));
}

export function electricalPricingMode(
  input: Record<string, unknown> | null | undefined
): ElectricalPricingMode {
  return hasDetailedElectricalQuantities(input) ? 'detailed' : 'package';
}

/**
 * False when the generic rough package would double-count detailed takeoff,
 * or when the standalone Electrical estimator is the active template.
 */
export function shouldAutoPriceElectricalRoughPackage(
  input: Record<string, unknown> | null | undefined,
  templateKey?: string | null
): boolean {
  if (String(templateKey || '').toLowerCase() === 'electrical') return false;
  if (hasDetailedElectricalQuantities(input)) return false;
  return true;
}
