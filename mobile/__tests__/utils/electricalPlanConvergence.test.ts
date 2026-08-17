import {
  ELECTRICAL_CARDS,
  ELECTRICAL_REVIEW_MEASUREMENT_KEYS,
  electricalCardForMeasurementKey,
  electricalChecklistGroups,
  electricalMeasurementKeyOwnership,
  electricalPricingMode,
  electricalTemplateItems,
  hasDetailedElectricalQuantities,
  isCanonicalElectricalItemId,
  parseElectricalMeasurementsFromNotes,
  buildElectricalStructuredMeasurements,
  normalizeElectricalScalarMeasurements,
  shouldAutoPriceElectricalRoughPackage,
  shouldAutoPriceElectricalTrimPackage,
  syncElectricalScopeItems,
} from '@/utils/subcontractorTrade/electricalPlanConvergence';
import { normalizeTradeMeasurements } from '@/utils/subcontractorTrade/convergence';
import {
  lookupRuleKeyForPackage,
  normalizeScopeMeasurements,
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
  scopeMeasurementsInputFromPayload,
  scopeMeasurementsPayloadForPersist,
  type ScopeMeasurementsInputExtended,
} from '@/utils/scopeItemQuantities';
import { emptyQuickMeasurementInput } from '@/utils/scopeQuickMeasurements';
import { SCOPE_CHECKLIST_GROUPS } from '@/utils/estimateScopeChecklistUi';
import { inferItemStateFromNotes } from '@/utils/scopeItemNoteHints';
import { getTradeScopeAllowlist } from '@/utils/subcontractorTrade';

function inputWith(
  fields: Partial<ScopeMeasurementsInputExtended>
): ScopeMeasurementsInputExtended {
  return {
    ...emptyQuickMeasurementInput(),
    ...fields,
    itemQuantities: fields.itemQuantities ?? {},
  } as ScopeMeasurementsInputExtended;
}

const EXAMPLE_NOTES =
  'Install 18 recessed lights. Add 12 standard outlets. Add 4 GFCI outlets. Install a 200 amp panel. Run two dedicated 20 amp circuits. Install one 50 amp range circuit. Add 3 ceiling fans.';

describe('electrical canonical architecture', () => {
  it('gives every quantity card one owner and one unit', () => {
    const keys = ELECTRICAL_CARDS.map(card => card.measurementKey);
    expect(new Set(keys).size).toBe(keys.length);
    const itemIds = ELECTRICAL_CARDS.map(card => card.itemId);
    expect(new Set(itemIds).size).toBe(itemIds.length);
    const ownership = electricalMeasurementKeyOwnership();
    for (const card of ELECTRICAL_CARDS) {
      expect(ownership[card.measurementKey]).toBe(card.itemId);
      expect(electricalCardForMeasurementKey(card.measurementKey)?.itemId).toBe(
        card.itemId
      );
      expect(
        card.unit === 'each' || card.unit === 'amp' || card.unit === 'lf'
      ).toBe(true);
    }
  });

  it('parses the requested Notes/Voice examples without double-counting', () => {
    const parsed = parseElectricalMeasurementsFromNotes(EXAMPLE_NOTES);
    expect(parsed.recessedLightCount).toBe(18);
    expect(parsed.standardReceptacleCount).toBe(12);
    expect(parsed.gfciReceptacleCount).toBe(4);
    expect(parsed.mainPanelCount).toBe(1);
    expect(parsed.serviceAmperage).toBe(200);
    expect(parsed.dedicated20aCircuitCount).toBe(2);
    expect(parsed.rangeHookupCount).toBe(1);
    expect(parsed.circuit50aCount).toBeUndefined();
    expect(parsed.standardCircuitCount).toBeUndefined();
    expect(parsed.ceilingFanCount).toBe(3);
    expect(parsed.electricalScope).toEqual(
      expect.arrayContaining([
        'electrical_recessed_light',
        'electrical_standard_receptacle',
        'electrical_gfci_receptacle',
        'electrical_main_panel',
        'electrical_dedicated_20a',
        'electrical_range_hookup',
        'electrical_ceiling_fan',
      ])
    );
  });

  it('parses amperage, voltage, and condition wording as attributes', () => {
    const parsed = parseElectricalMeasurementsFromNotes(
      'Remodel open-wall. Install two 240V receptacles and one 30 amp circuit. Include trim-out and trenching.'
    );
    expect(parsed.electricalProjectCondition).toBe('remodel_open_wall');
    expect(parsed.receptacle240vCount).toBe(2);
    expect(parsed.circuit30aCount).toBe(1);
    expect(parsed.electricalIncludeTrim).toBe(true);
    expect(parsed.electricalTrenching).toBe(true);
    expect(parsed.standardReceptacleCount).toBeUndefined();
  });

  it('produces the same canonical keys from notes, voice, and manual entry', () => {
    const fromNotes = parseElectricalMeasurementsFromNotes(EXAMPLE_NOTES);
    const fromVoice = parseElectricalMeasurementsFromNotes(EXAMPLE_NOTES);
    const manual = {
      recessedLightCount: 18,
      standardReceptacleCount: 12,
      gfciReceptacleCount: 4,
      mainPanelCount: 1,
      serviceAmperage: 200,
      dedicated20aCircuitCount: 2,
      rangeHookupCount: 1,
      ceilingFanCount: 3,
    };
    const notesNorm = normalizeTradeMeasurements(
      'electrical',
      fromNotes,
      'notes'
    );
    const voiceNorm = normalizeTradeMeasurements(
      'electrical',
      fromVoice,
      'notes'
    );
    const manualNorm = normalizeTradeMeasurements(
      'electrical',
      manual,
      'manual'
    );

    expect(notesNorm.measurements).toEqual(voiceNorm.measurements);
    expect(notesNorm.measurements.recessedLightCount).toBe(18);
    expect(manualNorm.measurements.recessedLightCount).toBe(18);
    expect(manualNorm.quickMeasurementSources?.recessedLightCount).toBe(
      'user_entered'
    );
    expect(
      notesNorm.structuredMeasurements?.itemQuantities
        ?.electrical_recessed_light
    ).toMatchObject({ quantity: 18, unit: 'each' });
    const structured = buildElectricalStructuredMeasurements(manual);
    const scalar = normalizeElectricalScalarMeasurements(manual, structured);
    expect(scalar.rangeHookupCount).toBe(1);
    expect(structured.itemQuantities?.electrical_circuit_50a).toBeUndefined();
  });

  it('keeps manual user-entered quantities ahead of parsed notes', () => {
    const parsed = parseElectricalMeasurementsFromNotes(EXAMPLE_NOTES);
    const normalized = normalizeTradeMeasurements(
      'electrical',
      {
        ...parsed,
        recessedLightCount: 20,
      },
      'manual'
    );
    expect(normalized.measurements.recessedLightCount).toBe(20);
    expect(normalized.quickMeasurementSources?.recessedLightCount).toBe(
      'user_entered'
    );
  });

  it('round-trips canonical keys, conditions, and item quantities', () => {
    const saved = scopeMeasurementsPayloadForPersist(
      inputWith({
        recessedLightCount: '18',
        standardReceptacleCount: '12',
        gfciReceptacleCount: '4',
        mainPanelCount: '1',
        serviceAmperage: '200',
        dedicated20aCircuitCount: '2',
        rangeHookupCount: '1',
        ceilingFanCount: '3',
        electricalProjectCondition: 'new_construction',
        electricalIncludeRough: true,
        electricalIncludeTrim: true,
        electricalConduit: false,
        electricalTrenching: false,
        electricalScope: ['electrical_recessed_light', 'electrical_main_panel'],
      }),
      { templateKey: 'electrical' }
    );
    expect(saved.recessedLightCount).toBe(18);
    expect(saved.serviceAmperage).toBe(200);
    expect(saved.electricalProjectCondition).toBe('new_construction');
    expect(saved.electricalIncludeRough).toBe(true);
    expect(saved.itemQuantities?.electrical_recessed_light?.quantity).toBe(18);

    const restored = scopeMeasurementsInputFromPayload(saved);
    expect(restored.recessedLightCount).toBe('18');
    expect(restored.electricalProjectCondition).toBe('new_construction');
    expect(restored.itemQuantities.electrical_range_hookup?.quantity).toBe('1');

    const resolved = resolveChecklistItemQuantity(
      'electrical_recessed_light',
      normalizeScopeMeasurements(saved),
      { templateKey: 'electrical' }
    );
    expect(resolved.quantity).toBe(18);
    expect(resolved.unit).toBe('each');
  });

  it('renders every listed Confirm Scope group and keeps empty groups reviewable', () => {
    const groups = electricalChecklistGroups();
    expect(groups.map(group => group.title)).toEqual([
      'Service / panels',
      'Circuits',
      'Receptacles',
      'Switches / controls',
      'Lighting',
      'Fans',
      'Appliance circuit + hookup',
      'Life safety / low voltage',
      'Rough / modifications',
      'Packages',
      'Closeout',
    ]);
    expect(
      SCOPE_CHECKLIST_GROUPS.electrical?.map(group => group.title)
    ).toEqual(groups.map(group => group.title));
    for (const group of groups) {
      expect(group.itemIds.length).toBeGreaterThan(0);
    }
    const templateIds = electricalTemplateItems().map(item => item.id);
    expect(templateIds).toEqual(
      expect.arrayContaining(groups.flatMap(g => g.itemIds))
    );
    expect(groups.find(group => group.title === 'Packages')?.itemIds).toEqual([
      'electrical_rough',
      'electrical_trim',
    ]);
    expect(groups.find(group => group.title === 'Closeout')?.itemIds).toEqual([
      'cleanup',
    ]);
    expect(ELECTRICAL_REVIEW_MEASUREMENT_KEYS).toContain('serviceAmperage');
  });

  it('prices relocate and still withholds electrical_rough', () => {
    const saved = scopeMeasurementsPayloadForPersist(
      inputWith({ relocateCount: '1' }),
      { templateKey: 'electrical' }
    );
    const restored = scopeMeasurementsInputFromPayload(saved);
    const resolved = resolveChecklistItemQuantity(
      'electrical_relocate',
      normalizeScopeMeasurements(saved),
      { templateKey: 'electrical' }
    );
    const pricing = resolveScopeItemSuggestedPricing(
      'electrical_relocate',
      restored as ScopeMeasurementsInputExtended,
      'electrical',
      resolved
    );
    expect(pricing.fill?.total).toBe(200);
    expect(isCanonicalElectricalItemId('electrical_rough')).toBe(false);
    const rough = resolveScopeItemSuggestedPricing(
      'electrical_rough',
      restored as ScopeMeasurementsInputExtended,
      'electrical',
      resolveChecklistItemQuantity(
        'electrical_rough',
        normalizeScopeMeasurements(saved),
        { templateKey: 'electrical' }
      )
    );
    expect(rough.fill).toBeNull();
  });

  it('does not change bathroom Electrical rough pricing', () => {
    const resolved = resolveChecklistItemQuantity(
      'electrical_rough',
      normalizeScopeMeasurements({
        itemQuantities: {
          electrical_rough: {
            quantity: 4,
            unit: 'each',
            quantitySource: 'user_entered',
          },
        },
      }),
      { templateKey: 'bathroom' }
    );
    const pricing = resolveScopeItemSuggestedPricing(
      'electrical_rough',
      inputWith({
        itemQuantities: {
          electrical_rough: {
            quantity: '4',
            unit: 'each',
            quantitySource: 'user_entered',
          },
        },
      }),
      'bathroom',
      resolved
    );
    expect(pricing.fill?.total).toBeGreaterThan(0);
  });

  it('leaves protected trade allowlists unchanged', () => {
    expect(getTradeScopeAllowlist('roofing')?.[0]).toBe('roofing_system');
    expect(getTradeScopeAllowlist('concrete')).toEqual(
      expect.arrayContaining(['pour_flatwork', 'pour_foundation'])
    );
    expect(getTradeScopeAllowlist('flooring')).toEqual(
      expect.arrayContaining(['flooring_lvp', 'tile_flooring'])
    );
    expect(getTradeScopeAllowlist('painting')).toEqual(
      expect.arrayContaining(['interior_paint', 'ceiling_paint'])
    );
    expect(getTradeScopeAllowlist('stucco')?.[0]).toBe('stucco');
  });

  it('does not invent scope from vague electrical notes', () => {
    expect(
      inferItemStateFromNotes('electrical_rough', 'Need some electrical work')
    ).toBe('unsure');
    expect(
      inferItemStateFromNotes('electrical_rough', 'Need electrical work')
    ).toBe('unsure');
    expect(
      inferItemStateFromNotes(
        'electrical_gfci_receptacle',
        'Add 4 GFCI outlets'
      )
    ).toBe('included');
    expect(
      inferItemStateFromNotes('electrical_rough', 'Add 4 GFCI outlets')
    ).toBe('unsure');
    expect(
      inferItemStateFromNotes(
        'electrical_rough',
        'New circuits and electrical rough-in'
      )
    ).toBe('included');
    const vague = parseElectricalMeasurementsFromNotes(
      'Need some electrical work'
    );
    expect(vague.standardReceptacleCount).toBeUndefined();
    expect(vague.electricalScope).toBeUndefined();
  });

  it('does not use living SF as the Electrical quantity owner', () => {
    const detailed = inputWith({
      floorAreaSqft: '1879',
      recessedLightCount: '18',
      standardReceptacleCount: '12',
    });
    expect(
      electricalPricingMode(detailed as unknown as Record<string, unknown>)
    ).toBe('detailed');
    expect(
      shouldAutoPriceElectricalRoughPackage(
        detailed as unknown as Record<string, unknown>,
        'electrical'
      )
    ).toBe(false);
    expect(
      shouldAutoPriceElectricalTrimPackage(
        { ...detailed, electricalIncludeTrim: true } as unknown as Record<
          string,
          unknown
        >,
        'electrical'
      )
    ).toBe(false);
    const roughQty = resolveChecklistItemQuantity(
      'electrical_rough',
      normalizeScopeMeasurements({
        floorAreaSqft: 1879,
        recessedLightCount: 18,
        standardReceptacleCount: 12,
      }),
      { templateKey: 'electrical' }
    );
    expect(roughQty.quantity).not.toBe(1879);
    const pricing = resolveScopeItemSuggestedPricing(
      'electrical_rough',
      detailed,
      'electrical',
      roughQty
    );
    expect(pricing.fill).toBeNull();
  });

  it('keeps ground-up electrical_rough package pricing when detailed counts are absent', () => {
    const measurements = inputWith({ floorAreaSqft: '1879' });
    expect(
      shouldAutoPriceElectricalRoughPackage(
        measurements as unknown as Record<string, unknown>,
        'ground_up'
      )
    ).toBe(true);
    const pricing = resolveScopeItemSuggestedPricing(
      'electrical_rough',
      measurements,
      'ground_up',
      resolveChecklistItemQuantity('electrical_rough', measurements, {
        templateKey: 'ground_up',
      })
    );
    expect(pricing.fill?.total).toBeGreaterThan(16000);
  });

  it('does not stack electrical_rough package work onto detailed takeoff', () => {
    const detailed = {
      recessedLightCount: 18,
      standardReceptacleCount: 12,
      gfciReceptacleCount: 4,
      floorAreaSqft: 1879,
    };
    expect(hasDetailedElectricalQuantities(detailed)).toBe(true);
    expect(shouldAutoPriceElectricalRoughPackage(detailed, 'ground_up')).toBe(
      false
    );
    const pricing = resolveScopeItemSuggestedPricing(
      'electrical_rough',
      inputWith({
        floorAreaSqft: '1879',
        recessedLightCount: '18',
        standardReceptacleCount: '12',
        gfciReceptacleCount: '4',
      }),
      'ground_up',
      resolveChecklistItemQuantity(
        'electrical_rough',
        normalizeScopeMeasurements({
          floorAreaSqft: 1879,
          recessedLightCount: 18,
        }),
        { templateKey: 'ground_up' }
      )
    );
    expect(pricing.fill).toBeNull();
  });

  it('does not invent circuit counts from devices or appliance hookups', () => {
    const devices = parseElectricalMeasurementsFromNotes(
      'Install 18 recessed lights. Add 12 standard outlets. Add 4 GFCI outlets.'
    );
    expect(devices.standardCircuitCount).toBeUndefined();
    expect(devices.dedicated20aCircuitCount).toBeUndefined();

    const range = parseElectricalMeasurementsFromNotes(
      'Install one 50 amp range circuit'
    );
    expect(range.rangeHookupCount).toBe(1);
    expect(range.circuit50aCount).toBeUndefined();
    expect(range.standardCircuitCount).toBeUndefined();

    const dryer = parseElectricalMeasurementsFromNotes(
      'Add a 30 amp dryer circuit'
    );
    expect(dryer.dryerHookupCount).toBe(1);
    expect(dryer.circuit30aCount).toBeUndefined();

    const dishwasher = parseElectricalMeasurementsFromNotes(
      'Run a dedicated 20 amp dishwasher circuit'
    );
    expect(dishwasher.dishwasherHookupCount).toBe(1);
    expect(dishwasher.dedicated20aCircuitCount).toBeUndefined();

    const ev = parseElectricalMeasurementsFromNotes(
      'Install a 60 amp EV charger circuit'
    );
    expect(ev.evChargerHookupCount).toBe(1);
    expect(ev.circuit60aPlusCount).toBeUndefined();
  });

  it('does not treat a kitchen fridge mention as a dedicated refrigerator circuit', () => {
    const kitchen = parseElectricalMeasurementsFromNotes(
      'Electrical: add 12 standard outlets and a refrigerator'
    );
    expect(kitchen.standardReceptacleCount).toBe(12);
    expect(kitchen.refrigeratorHookupCount).toBeUndefined();

    const dedicated = parseElectricalMeasurementsFromNotes(
      'Run a dedicated refrigerator circuit'
    );
    expect(dedicated.refrigeratorHookupCount).toBe(1);
    expect(dedicated.dedicated20aCircuitCount).toBeUndefined();
  });

  it('prices only electric water-heater electrical work, not gas', () => {
    const electric = parseElectricalMeasurementsFromNotes(
      'Electric water heater electrical connection'
    );
    expect(electric.waterHeaterHookupCount).toBe(1);

    const gas = parseElectricalMeasurementsFromNotes(
      'Electrical: replace gas water heater'
    );
    expect(gas.waterHeaterHookupCount).toBeUndefined();
  });

  it('parses owned circuit cards without collapsing dedicated and standard counts', () => {
    const parsed = parseElectricalMeasurementsFromNotes(
      'Add 8 new circuits. Run two dedicated 20 amp circuits. Add one 30 amp circuit and one 40 amp circuit. Add a generic 50 amp circuit.'
    );
    expect(parsed.standardCircuitCount).toBe(8);
    expect(parsed.dedicated20aCircuitCount).toBe(2);
    expect(parsed.circuit30aCount).toBe(1);
    expect(parsed.circuit40aCount).toBe(1);
    expect(parsed.circuit50aCount).toBe(1);
  });

  it('keeps receptacle types distinct and does not include the homerun', () => {
    const mixed = parseElectricalMeasurementsFromNotes(
      'Add 12 standard outlets. Add 4 GFCI outlets. Add 2 exterior GFCI outlets. Add 2 USB outlets and two 240V receptacles.'
    );
    expect(mixed.standardReceptacleCount).toBe(12);
    expect(mixed.gfciReceptacleCount).toBe(4);
    expect(mixed.exteriorReceptacleCount).toBe(2);
    expect(mixed.usbReceptacleCount).toBe(2);
    expect(mixed.receptacle240vCount).toBe(2);
    expect(mixed.standardCircuitCount).toBeUndefined();

    const range = parseElectricalMeasurementsFromNotes(
      'Install one 50 amp range circuit'
    );
    expect(range.rangeHookupCount).toBe(1);
    expect(range.receptacle240vCount).toBeUndefined();
  });

  it('names the AFCI card as a receptacle device, not breaker protection', () => {
    const card = ELECTRICAL_CARDS.find(
      row => row.itemId === 'electrical_afci_receptacle'
    );
    expect(card?.label).toBe('AFCI / dual-function receptacle');
    expect(card?.helper).toMatch(
      /does not include AFCI\/dual-function breaker/i
    );
  });

  it('keeps switch types distinct and does not invent a homerun', () => {
    const mixed = parseElectricalMeasurementsFromNotes(
      'Add 8 single-pole switches. Add two 3-way switches. Add one 4-way switch. Add 4 dimmer switches. Add 2 occupancy switches and 3 smart switches.'
    );
    expect(mixed.singlePoleSwitchCount).toBe(8);
    expect(mixed.threeWaySwitchCount).toBe(2);
    expect(mixed.fourWaySwitchCount).toBe(1);
    expect(mixed.dimmerSwitchCount).toBe(4);
    expect(mixed.occupancySwitchCount).toBe(2);
    expect(mixed.smartSwitchCount).toBe(3);
    expect(mixed.standardCircuitCount).toBeUndefined();

    const dimmerOnly = parseElectricalMeasurementsFromNotes(
      'Install 4 dimmer switches'
    );
    expect(dimmerOnly.dimmerSwitchCount).toBe(4);
    expect(dimmerOnly.singlePoleSwitchCount).toBeUndefined();
  });

  it('maps dimmers and smart switches without stacking a single-pole card', () => {
    const parsed = parseElectricalMeasurementsFromNotes(
      'Install 6 dimmers and 12 smart switches'
    );
    expect(parsed.dimmerSwitchCount).toBe(6);
    expect(parsed.smartSwitchCount).toBe(12);
    expect(parsed.singlePoleSwitchCount).toBeUndefined();
  });

  it('maps a kitchen dedicated circuit, standard switches, and dimmer without a package', () => {
    const parsed = parseElectricalMeasurementsFromNotes(
      'Kitchen: 1 dedicated circuit, 3 standard switches, 1 dimmer'
    );
    expect(parsed.dedicated20aCircuitCount).toBe(1);
    expect(parsed.singlePoleSwitchCount).toBe(3);
    expect(parsed.dimmerSwitchCount).toBe(1);
    expect(parsed.standardCircuitCount).toBeUndefined();
    expect(parsed.electricalIncludeRough).toBeUndefined();
  });

  it('routes moving a switch location to relocate instead of a new device card', () => {
    const parsed = parseElectricalMeasurementsFromNotes(
      'Move a switch location 6 feet over'
    );
    expect(parsed.relocateCount).toBe(1);
    expect(parsed.singlePoleSwitchCount).toBeUndefined();
  });

  it('names modification cards as make-safe / relocate only', () => {
    const byId = Object.fromEntries(
      ELECTRICAL_CARDS.map(card => [card.itemId, card])
    );
    expect(byId.electrical_device_removal.helper).toMatch(/not a new device/i);
    expect(byId.electrical_fixture_removal.helper).toMatch(
      /not a new fixture/i
    );
    expect(byId.electrical_relocate.helper).toMatch(/not a new device card/i);
    expect(byId.electrical_abandoned_circuit.helper).toMatch(
      /not a new homerun/i
    );
  });

  it('names conduit and trenching as LF raceway cards', () => {
    const byId = Object.fromEntries(
      ELECTRICAL_CARDS.map(card => [card.itemId, card])
    );
    expect(byId.electrical_conduit.unit).toBe('lf');
    expect(byId.electrical_trenching.unit).toBe('lf');
    expect(byId.electrical_conduit.label).toBe('Conduit / raceway only');
    expect(byId.electrical_trenching.label).toBe('Trenching — normal soil');
    expect(byId.electrical_conduit.helper).toMatch(/not.*homerun/i);
    expect(byId.electrical_trenching.helper).toMatch(/not conduit/i);
  });

  it('names switch cards as devices, not traveler circuits or fixtures', () => {
    const byId = Object.fromEntries(
      ELECTRICAL_CARDS.map(card => [card.itemId, card])
    );
    expect(byId.electrical_single_pole_switch.label).toBe('Single-pole switch');
    expect(byId.electrical_3way_switch.label).toBe('3-way switch');
    expect(byId.electrical_4way_switch.label).toBe('4-way switch');
    expect(byId.electrical_dimmer_switch.label).toBe('Dimmer switch');
    expect(byId.electrical_occupancy_switch.label).toBe(
      'Occupancy / motion sensor switch'
    );
    expect(byId.electrical_smart_switch.label).toBe('Smart switch');
    expect(byId.electrical_dimmer_switch.helper).toMatch(
      /does not include lighting fixture/i
    );
    expect(byId.electrical_single_pole_switch.helper).toMatch(/relocation/i);
  });

  it('keeps lighting types distinct and maps vanity onto the standard fixture card', () => {
    const mixed = parseElectricalMeasurementsFromNotes(
      'Install 18 recessed lights. Add 6 vanity lights. Add 2 pendants and one chandelier. Add 3 ceiling fans.'
    );
    expect(mixed.recessedLightCount).toBe(18);
    expect(mixed.standardFixtureCount).toBe(6);
    expect(mixed.pendantLightCount).toBe(2);
    expect(mixed.decorativeLightCount).toBe(1);
    expect(mixed.ceilingFanCount).toBe(3);
    expect(mixed.standardCircuitCount).toBeUndefined();
    expect(mixed.dimmerSwitchCount).toBeUndefined();
  });

  it('parses kitchen recessed lights, switches, and circuits without a lighting package', () => {
    const parsed = parseElectricalMeasurementsFromNotes(
      'Kitchen: 12 recessed lights, 3 switches, 2 circuits'
    );
    expect(parsed.recessedLightCount).toBe(12);
    expect(parsed.singlePoleSwitchCount).toBe(3);
    expect(parsed.standardCircuitCount).toBe(2);
    expect(parsed.electricalIncludeRough).toBeUndefined();
  });

  it('names appliance cards as circuit + hookup, not a plug-in only', () => {
    const byId = Object.fromEntries(
      ELECTRICAL_CARDS.map(card => [card.itemId, card])
    );
    expect(byId.electrical_range_hookup.label).toBe(
      'Electric range circuit + hookup'
    );
    expect(byId.electrical_dryer_hookup.label).toBe(
      'Electric dryer circuit + hookup'
    );
    expect(byId.electrical_dishwasher_hookup.label).toBe(
      'Dishwasher circuit + hookup'
    );
    expect(byId.electrical_refrigerator_hookup.label).toBe(
      'Refrigerator circuit + hookup'
    );
    expect(byId.electrical_water_heater_hookup.label).toBe(
      'Electric water heater circuit + hookup'
    );
    expect(byId.electrical_refrigerator_hookup.helper).toMatch(
      /not a plug-in only/i
    );
    expect(byId.electrical_refrigerator_hookup.helper).toMatch(
      /existing receptacle/i
    );
    expect(byId.electrical_water_heater_hookup.helper).toMatch(
      /not a gas water heater/i
    );
  });

  it('keeps camera prewire distinct from CAT6, security, and camera equipment', () => {
    const cameras = parseElectricalMeasurementsFromNotes(
      'Electrical: prewire 4 cameras'
    );
    expect(cameras.cameraPrewireCount).toBe(4);
    expect(cameras.cat6DropCount).toBeUndefined();
    expect(cameras.securityPrewireCount).toBeUndefined();

    const poe = parseElectricalMeasurementsFromNotes(
      'Electrical: add 4 PoE camera drops'
    );
    expect(poe.cameraPrewireCount).toBe(4);
    expect(poe.cat6DropCount).toBeUndefined();

    const securityCameras = parseElectricalMeasurementsFromNotes(
      'Electrical: security camera prewire for 3 cameras'
    );
    expect(securityCameras.cameraPrewireCount).toBe(3);
    expect(securityCameras.securityPrewireCount).toBeUndefined();

    const alarm = parseElectricalMeasurementsFromNotes(
      'Electrical: security alarm prewire'
    );
    expect(alarm.securityPrewireCount).toBe(1);
    expect(alarm.cameraPrewireCount).toBeUndefined();

    const cat6 = parseElectricalMeasurementsFromNotes(
      'Electrical: add 6 CAT6 drops'
    );
    expect(cat6.cat6DropCount).toBe(6);
    expect(cat6.cameraPrewireCount).toBeUndefined();

    const equipment = parseElectricalMeasurementsFromNotes(
      'Electrical: install 4 Ring cameras'
    );
    expect(equipment.cameraPrewireCount).toBeUndefined();
    expect(equipment.cat6DropCount).toBeUndefined();

    const packageNotes = parseElectricalMeasurementsFromNotes(
      'Electrical: whole-house structured wiring package'
    );
    expect(packageNotes.cat6DropCount).toBeUndefined();
    expect(packageNotes.cameraPrewireCount).toBeUndefined();

    const doorbell = parseElectricalMeasurementsFromNotes(
      'Electrical: install a doorbell'
    );
    expect(doorbell.doorbellCount).toBe(1);
    expect(doorbell.cameraPrewireCount).toBeUndefined();

    const ringDoorbell = parseElectricalMeasurementsFromNotes(
      'Electrical: install a Ring doorbell'
    );
    expect(ringDoorbell.doorbellCount).toBeUndefined();
  });

  it('names the camera prewire card as a drop only', () => {
    const byId = Object.fromEntries(
      ELECTRICAL_CARDS.map(card => [card.itemId, card])
    );
    expect(byId.electrical_camera_prewire.label).toBe(
      'Camera prewire / low-voltage drop'
    );
    expect(byId.electrical_camera_prewire.helper).toMatch(
      /not include cameras/i
    );
    expect(byId.electrical_security_prewire.helper).toMatch(
      /camera drops are a separate card/i
    );
    expect(byId.electrical_cat6_drop.helper).toMatch(
      /not a whole-house structured wiring package/i
    );
  });

  it('names under-cabinet and bath-fan cards as fixture/electrical install only', () => {
    const byId = Object.fromEntries(
      ELECTRICAL_CARDS.map(card => [card.itemId, card])
    );
    expect(byId.electrical_undercabinet_light.label).toBe(
      'Under-cabinet fixture'
    );
    expect(byId.electrical_undercabinet_light.helper).toMatch(
      /fixture install only/i
    );
    expect(byId.electrical_bath_exhaust_fan.label).toBe(
      'Bathroom exhaust fan electrical install'
    );
    expect(byId.electrical_bath_exhaust_fan.helper).toMatch(
      /not include ducting/i
    );
    expect(byId.electrical_ceiling_fan.helper).toMatch(/fan-rated box/i);
  });

  it('keeps panel, upgrade, and service cards distinct', () => {
    const main = parseElectricalMeasurementsFromNotes(
      'Install a 200 amp panel'
    );
    const upgrade = parseElectricalMeasurementsFromNotes('Upgrade the panel');
    const service = parseElectricalMeasurementsFromNotes(
      'Service upgrade to 200 amp'
    );
    expect(main.mainPanelCount).toBe(1);
    expect(main.panelUpgradeCount).toBeUndefined();
    expect(upgrade.panelUpgradeCount).toBe(1);
    expect(upgrade.mainPanelCount).toBeUndefined();
    expect(service.serviceUpgradeCount).toBe(1);
    expect(service.mainPanelCount).toBeUndefined();
    expect(service.serviceAmperage).toBe(200);
  });

  it('routes a 100A to 200A service change to service upgrade only', () => {
    const parsed = parseElectricalMeasurementsFromNotes(
      'Upgrade existing 100A service to 200A'
    );
    expect(parsed.serviceUpgradeCount).toBe(1);
    expect(parsed.existingServiceAmperage).toBe(100);
    expect(parsed.serviceAmperage).toBe(200);
    expect(parsed.mainPanelCount).toBeUndefined();
    expect(parsed.panelUpgradeCount).toBeUndefined();
    expect(parsed.electricalScope).toEqual(['electrical_service_upgrade']);
  });

  it('keeps a subpanel independent of a service upgrade', () => {
    const parsed = parseElectricalMeasurementsFromNotes(
      'Upgrade existing 100A service to 200A and add a subpanel'
    );
    expect(parsed.serviceUpgradeCount).toBe(1);
    expect(parsed.subpanelCount).toBe(1);
    expect(parsed.mainPanelCount).toBeUndefined();
    expect(parsed.panelUpgradeCount).toBeUndefined();
  });

  it('parses outdoor and meter/main attributes without extra quantity cards', () => {
    const parsed = parseElectricalMeasurementsFromNotes(
      'Install a 200 amp outdoor panel with meter-main'
    );
    expect(parsed.mainPanelCount).toBe(1);
    expect(parsed.electricalPanelLocation).toBe('outdoor');
    expect(parsed.electricalMeterMainCombo).toBe(true);
    expect(parsed.serviceUpgradeCount).toBeUndefined();
  });

  it('does not map a bare Electrical package name onto electrical_rough', () => {
    expect(lookupRuleKeyForPackage('Electrical fixtures')).toBe(
      'electrical_trim'
    );
    expect(lookupRuleKeyForPackage('Electrical rough-in')).toBe(
      'electrical_rough'
    );
    expect(lookupRuleKeyForPackage('Electrical')).not.toBe('electrical_rough');
  });

  it('drops a Confirm Scope card when its Quick Measurement quantity is cleared', () => {
    const items = [
      { id: 'electrical_main_panel', state: 'included' },
      { id: 'electrical_standard_receptacle', state: 'included' },
      { id: 'electrical_subpanel', state: 'unsure' },
      { id: 'electrical_rough', state: 'unsure' },
    ];
    const selected = syncElectricalScopeItems(items, {
      electricalScope: [
        'electrical_main_panel',
        'electrical_standard_receptacle',
      ],
      quantities: { mainPanelCount: 1, standardReceptacleCount: 50 },
    });
    expect(
      selected.find(row => row.id === 'electrical_main_panel')?.state
    ).toBe('included');
    expect(
      selected.find(row => row.id === 'electrical_standard_receptacle')?.state
    ).toBe('included');

    const afterDeselect = syncElectricalScopeItems(selected, {
      electricalScope: [
        'electrical_main_panel',
        'electrical_standard_receptacle',
      ],
      quantities: { mainPanelCount: '', standardReceptacleCount: 50 },
    });
    expect(
      afterDeselect.find(row => row.id === 'electrical_main_panel')?.state
    ).toBe('unsure');
    expect(
      afterDeselect.find(row => row.id === 'electrical_standard_receptacle')
        ?.state
    ).toBe('included');
    expect(
      afterDeselect.find(row => row.id === 'electrical_subpanel')?.state
    ).toBe('unsure');
  });

  it('materializes every selected electrical quantity into the pricing scope list', () => {
    const selected = syncElectricalScopeItems([], {
      quantities: {
        bathExhaustFanCount: 2,
        floorReceptacleCount: 10,
        rangeHookupCount: 1,
        dryerHookupCount: 1,
        dishwasherHookupCount: 1,
        disposalHookupCount: 1,
        doorbellCount: 1,
      },
    });

    expect(selected).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'electrical_bath_exhaust_fan',
          state: 'included',
        }),
        expect.objectContaining({
          id: 'electrical_floor_receptacle',
          state: 'included',
        }),
        expect.objectContaining({
          id: 'electrical_range_hookup',
          state: 'included',
        }),
        expect.objectContaining({
          id: 'electrical_dryer_hookup',
          state: 'included',
        }),
        expect.objectContaining({
          id: 'electrical_dishwasher_hookup',
          state: 'included',
        }),
        expect.objectContaining({
          id: 'electrical_disposal_hookup',
          state: 'included',
        }),
        expect.objectContaining({
          id: 'electrical_doorbell',
          state: 'included',
        }),
      ])
    );
  });

  it('provides pricing for every measurable electrical quantity card', () => {
    for (const card of ELECTRICAL_CARDS) {
      const input = inputWith({
        electricalProjectCondition: 'new_construction',
        [card.measurementKey]: '1',
        itemQuantities: {
          [card.itemId]: {
            quantity: '1',
            unit: card.unit,
            quantitySource: 'user_entered',
          },
        },
      });
      const normalized = normalizeScopeMeasurements(input);
      const resolved = resolveChecklistItemQuantity(card.itemId, normalized, {
        templateKey: 'electrical',
      });
      const pricing = resolveScopeItemSuggestedPricing(
        card.itemId,
        input,
        'electrical',
        resolved
      );

      expect(resolved.pricingReady).toBe(true);
      expect(pricing.fill).not.toBeNull();
    }
  });

  it('promotes a previously excluded card when a positive quantity is entered', () => {
    const next = syncElectricalScopeItems(
      [{ id: 'electrical_main_panel', state: 'excluded' }],
      { quantities: { mainPanelCount: 1 } }
    );
    expect(next[0].state).toBe('included');
  });

  it('keeps a Notes-inferred Yes when no quantity was entered or cleared', () => {
    const next = syncElectricalScopeItems(
      [{ id: 'electrical_main_panel', state: 'included' }],
      { quantities: {} }
    );
    expect(next[0].state).toBe('included');
  });
});
