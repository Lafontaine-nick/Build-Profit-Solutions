import { lookupRuleKeyForPackage } from '../../utils/scopeItemQuantities';
import { parseScopeMeasurementsFromNotes } from '../../utils/scopeMeasurementParser';
import { getMeasurementRelevance } from '../../utils/getMeasurementRelevance';
import { resolveQuickMeasurementFields } from '../../utils/quickMeasurementProvenance';
import { quickMeasurementRowsForTemplate } from '../../utils/scopeQuickMeasurements';
import {
  suppressBathroomFalsePositiveFloorDemoScope,
  stripBathroomFalsePositiveFloorDemoQuantities,
} from '../../utils/estimateScopeChecklistUi';
import type { ScopeChecklistItem } from '../../utils/estimateAiDraft';

describe('kitchen package rule keys do not steal cabinet LF/rates', () => {
  test('Cabinet hardware maps to cabinet_hardware, not cabinets', () => {
    expect(lookupRuleKeyForPackage('Cabinet hardware')).toBe('cabinet_hardware');
    expect(
      lookupRuleKeyForPackage('Cabinet hardware', 'Pulls, knobs, and install.')
    ).toBe('cabinet_hardware');
  });

  test('Appliance reinstall does not inherit cabinets from "after cabinets" scope text', () => {
    expect(
      lookupRuleKeyForPackage(
        'Appliance reinstall & hookup',
        'Reconnect and install appliances after cabinets.'
      )
    ).toBe('appliances');
    expect(lookupRuleKeyForPackage('Appliance removal')).toBe('appliance_removal');
  });

  test('Real cabinet install still maps to cabinets', () => {
    expect(lookupRuleKeyForPackage('New cabinet install')).toBe('cabinets');
    expect(lookupRuleKeyForPackage('Cabinet Installation')).toBe('cabinets');
    expect(lookupRuleKeyForPackage('Cabinets')).toBe('cabinets');
  });

  test('Cabinet demo maps to demo, not cabinets', () => {
    expect(lookupRuleKeyForPackage('Cabinet & countertop demo')).toBe('demo');
    expect(lookupRuleKeyForPackage('Kitchen Demo')).toBe('demo');
  });
});

describe('cross-trade package rule keys do not steal qty/rates', () => {
  test('carpet/flooring demo does not inherit flooring install rates', () => {
    expect(lookupRuleKeyForPackage('Carpet removal')).toBe('floor_demo');
    expect(lookupRuleKeyForPackage('Remove existing carpet')).toBe('floor_demo');
    expect(lookupRuleKeyForPackage('Flooring demo / removal')).toBe('floor_demo');
    expect(lookupRuleKeyForPackage('LVP install')).toBe('flooring');
  });

  test('roof underlayment does not inherit floor_prep rates', () => {
    expect(lookupRuleKeyForPackage('Underlayment / ice & water')).toBe('underlayment');
    expect(lookupRuleKeyForPackage('Roof underlayment')).toBe('underlayment');
    expect(lookupRuleKeyForPackage('Floor prep / underlayment')).toBe('floor_prep');
  });

  test('shower/glass door does not inherit windows_doors', () => {
    expect(lookupRuleKeyForPackage('Shower door')).toBe('glass_door');
    expect(lookupRuleKeyForPackage('Glass door')).toBe('glass_door');
    expect(lookupRuleKeyForPackage('Entry door')).toBe('exterior_doors');
  });

  test('sink faucet disposal does not inherit cleanup', () => {
    expect(lookupRuleKeyForPackage('Sink, faucet & disposal')).toBe('sink_faucet');
    expect(lookupRuleKeyForPackage('Job cleanup / haul-off')).toBe('cleanup');
  });

  test('trash haul-off is haul_off soft-cost, not cleanup $1k', () => {
    expect(lookupRuleKeyForPackage('Trash Haul Off')).toBe('haul_off');
    expect(lookupRuleKeyForPackage('Haul-off / dumpster')).toBe('haul_off');
    expect(lookupRuleKeyForPackage('Cleanup & disposal')).toBe('cleanup');
  });

  test('deck demo and roof decking do not inherit deck surface install', () => {
    expect(lookupRuleKeyForPackage('Demo / removal of existing deck')).toBe('demo_removal');
    expect(lookupRuleKeyForPackage('Decking repair / replace')).toBe('decking_repair');
    expect(lookupRuleKeyForPackage('Deck stain / seal')).toBe('staining_sealing');
    expect(lookupRuleKeyForPackage('Install composite decking')).toBe('decking');
  });

  test('tub demo does not inherit tub install', () => {
    expect(lookupRuleKeyForPackage('Bathtub demo')).toBe('tub_demo');
    expect(lookupRuleKeyForPackage('Tub install')).toBe('tub_install');
  });

  test('countertop demo does not inherit countertop install', () => {
    expect(lookupRuleKeyForPackage('Countertop demo')).toBe('demo');
    expect(lookupRuleKeyForPackage('Countertop fabrication & install')).toBe('countertops');
  });

  test('ground-up Counters / Stucco package labels map to checklist rule keys', () => {
    // Bare "Counters" previously missed `\bcountertop` and fell through to kitchen $/living SF.
    expect(lookupRuleKeyForPackage('Counters')).toBe('countertops');
    expect(lookupRuleKeyForPackage('Counters', 'Kitchen countertops')).toBe('countertops');
    expect(lookupRuleKeyForPackage('Stucco / exterior wall finish')).toBe('stucco');
    expect(lookupRuleKeyForPackage('Stucco')).toBe('stucco');
    // Paint still wins over bare stucco install.
    expect(lookupRuleKeyForPackage('Stucco paint')).toBe('exterior_paint');
  });

  test('framing hardware does not inherit framing $/sqft', () => {
    expect(lookupRuleKeyForPackage('Framing hardware')).toBe('hardware');
    expect(lookupRuleKeyForPackage('Framing / shell')).toBe('framing');
  });

  test('cabinet painting does not inherit cabinet LF rates', () => {
    expect(lookupRuleKeyForPackage('Cabinet painting')).toBe('trim_paint');
  });

  test('HVAC ventilation does not inherit bath exhaust fan', () => {
    expect(lookupRuleKeyForPackage('HVAC ventilation')).toBe('ventilation');
    expect(lookupRuleKeyForPackage('Exhaust fan')).toBe('exhaust_fan');
  });

  test('concrete removal does not inherit concrete install', () => {
    expect(lookupRuleKeyForPackage('Concrete removal')).toBe('demo_removal');
    expect(lookupRuleKeyForPackage('Concrete patio')).toBe('pour_flatwork');
  });

  test('roof tear-off and tie-in stay distinct from shingle install', () => {
    expect(lookupRuleKeyForPackage('Roof tear-off')).toBe('tear_off');
    expect(lookupRuleKeyForPackage('Roofing tie-in')).toBe('roof_tie_in');
    expect(lookupRuleKeyForPackage('Shingles / roofing install')).toBe('shingles_roofing');
  });

  test('exterior paint does not inherit interior paint', () => {
    expect(lookupRuleKeyForPackage('Exterior Painting')).toBe('exterior_paint');
    expect(lookupRuleKeyForPackage('Interior Painting')).toBe('interior_paint');
    expect(lookupRuleKeyForPackage('Siding paint')).toBe('exterior_paint');
  });

  test('drywall patch does not match bare non-drywall patch via drywall key alone', () => {
    expect(lookupRuleKeyForPackage('Drywall hang')).toBe('hang');
    expect(lookupRuleKeyForPackage('Drywall tape and finish')).toBe('finish_tape');
    expect(lookupRuleKeyForPackage('Drywall patch')).toBe('patch_repair');
    expect(lookupRuleKeyForPackage('Drywall')).toBe('drywall');
  });

  test('plumbing connections does not fall to plumbing_rough catch-all', () => {
    expect(lookupRuleKeyForPackage('Plumbing connections')).toBe('plumbing');
    expect(lookupRuleKeyForPackage('Plumbing rough-in')).toBe('plumbing_rough');
  });
});

describe('bathroom wet-area notes do not false-positive floor demo', () => {
  const BATH_NOTES =
    'Demo / tear-out of existing bathroom — Existing tub and tile surround visible. Remove existing tub for shower conversion. Tile shower walls. Floor is tiled.';

  test('tear-out near tub/tile surround does not map package text to floor_demo', () => {
    expect(lookupRuleKeyForPackage('Demo / tear-out of existing bathroom', BATH_NOTES)).toBe('demo');
    expect(lookupRuleKeyForPackage('Remove existing tub', BATH_NOTES)).toBe('tub_demo');
  });

  test('parsed notes do not inject floor_demo itemQuantities for wet-area demo language', () => {
    const parsed = parseScopeMeasurementsFromNotes(BATH_NOTES, { templateKey: 'bathroom' });
    expect(parsed.itemQuantities?.floor_demo).toBeUndefined();
  });

  test('bath floor quick measurement stays optional for wet-area-only scope', () => {
    const included = ['demo', 'tub_demo', 'shower_tile', 'waterproofing', 'plumbing_rough', 'glass_door', 'drywall'];
    expect(getMeasurementRelevance({ measurementKey: 'bathroomFloorSqft', includedScopeKeys: included }).relevant).toBe(
      false
    );
    const rows = quickMeasurementRowsForTemplate('bathroom', 'bathroom');
    const results = resolveQuickMeasurementFields({
      rows,
      measurements: {},
      includedScopeKeys: included,
      templateKey: 'bathroom',
    });
    expect(results.find((r) => r.key === 'bathroomFloorSqft')?.state).toBe('not_relevant');
  });

  test('prefab wet area shows shower wall suggestion without bath floor SF', () => {
    const included = ['demo', 'tub_demo', 'shower_tile', 'waterproofing', 'plumbing_rough', 'glass_door', 'drywall'];
    const rows = quickMeasurementRowsForTemplate('bathroom', 'bathroom');
    const results = resolveQuickMeasurementFields({
      rows,
      measurements: { wetAreaFinish: 'prefab' },
      includedScopeKeys: included,
      templateKey: 'bathroom',
    });
    expect(results.find((r) => r.key === 'bathroomFloorSqft')?.state).toBe('not_relevant');
    const walls = results.find((r) => r.key === 'showerWallTileSqft');
    expect(walls?.state).toBe('estimate_available');
    expect(walls?.estimate?.value).toBe(80);
    expect(results.find((r) => r.key === 'showerFloorTileSqft')?.state).toBe('not_relevant');
  });

  test('stale floor_demo scope and quantities are stripped on wet-area-only bathroom hydrate', () => {
    const items: ScopeChecklistItem[] = [
      { id: 'demo', label: 'Demo', state: 'included', inputType: 'yes_no' },
      { id: 'tub_demo', label: 'Tub demo', state: 'included', inputType: 'yes_no', noteBacked: true },
      { id: 'floor_demo', label: 'Flooring demo', state: 'included', inputType: 'yes_no', noteBacked: true },
      { id: 'floor_tile', label: 'Bath floor tile', state: 'included', inputType: 'yes_no', noteBacked: true },
    ];
    const suppressed = suppressBathroomFalsePositiveFloorDemoScope(items, 'bathroom', BATH_NOTES);
    expect(suppressed.find((i) => i.id === 'floor_demo')?.state).toBe('excluded');
    expect(suppressed.find((i) => i.id === 'floor_tile')?.state).toBe('excluded');

    const stripped = stripBathroomFalsePositiveFloorDemoQuantities(
      { floor_demo: { quantity: 90, unit: 'sqft' }, demo: { quantity: 1, unit: 'allowance' } },
      'bathroom',
      BATH_NOTES
    );
    expect(stripped?.floor_demo).toBeUndefined();
    expect(stripped?.demo).toBeDefined();

    const included = suppressed.filter((i) => i.state === 'included').map((i) => i.id);
    expect(getMeasurementRelevance({ measurementKey: 'bathroomFloorSqft', includedScopeKeys: included }).relevant).toBe(
      false
    );
  });
});
