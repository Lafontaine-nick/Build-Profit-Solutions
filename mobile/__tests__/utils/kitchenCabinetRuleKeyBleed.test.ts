import { lookupRuleKeyForPackage } from '../../utils/scopeItemQuantities';

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
    expect(lookupRuleKeyForPackage('Entry door')).toBe('windows_doors');
  });

  test('sink faucet disposal does not inherit cleanup', () => {
    expect(lookupRuleKeyForPackage('Sink, faucet & disposal')).toBe('sink_faucet');
    expect(lookupRuleKeyForPackage('Job cleanup / haul-off')).toBe('cleanup');
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
