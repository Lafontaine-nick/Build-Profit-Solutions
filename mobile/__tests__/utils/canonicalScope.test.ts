import {
  applyCanonicalScopeToChecklistItems,
  buildCanonicalScope,
  canonicalItemIsExcluded,
  canonicalScopeBlocksItemId,
  finalizeCanonicalScope,
} from '@/utils/canonicalScope';
import {
  groupScopeChecklistItems,
  hydrateScopeChecklistFromNotes,
} from '@/utils/estimateScopeChecklistUi';
import { repairDraftRatePricingFromNotes } from '@/utils/estimateAiDraft';
import { resolveScopeFoundClarification } from '@/utils/scopeFoundClarification';
import { quickMeasurementRowsForInput } from '@/utils/scopeQuickMeasurements';
import { confirmScopeDisplayItemsFromDraft } from '@/utils/scopePackagesForReview';

const OWNER_CARPET_NOTE =
  'Remove 1,200 sqft of carpet and install 1,200 sqft of LVP. Homeowner is removing the carpet.';

describe('canonical scope contract', () => {
  it('excludes owner-handled flooring demo and keeps LVP', () => {
    const scope = buildCanonicalScope({
      notes: OWNER_CARPET_NOTE,
      checklistItems: [
        { id: 'floor_demo', state: 'included' },
        { id: 'flooring_lvp', state: 'included' },
      ],
    });
    expect(canonicalItemIsExcluded(scope, 'floor_demo')).toBe(true);
    expect(
      scope.items.find(item => item.id === 'flooring_lvp')?.status
    ).toBe('included');
    expect(
      applyCanonicalScopeToChecklistItems(
        [
          { id: 'floor_demo', state: 'included' },
          { id: 'floor_demo_style_carpet', state: 'included' },
          { id: 'flooring_lvp', state: 'included' },
        ],
        OWNER_CARPET_NOTE,
        scope
      ).map(item => item.id)
    ).toEqual(['flooring_lvp']);
  });

  it('freezes demo off reveal, measurements, confirm scope, and pricing', () => {
    const repaired = finalizeCanonicalScope(
      repairDraftRatePricingFromNotes(
        {
          originalNotes: OWNER_CARPET_NOTE,
          projectType: 'flooring',
          estimateTier: 'room_remodel',
          scopeChecklist: {
            templateKey: 'flooring',
            items: [
              { id: 'floor_demo', label: 'Flooring demo / removal', state: 'included' },
              { id: 'flooring_lvp', label: 'LVP', state: 'included' },
            ],
          },
          scopeMeasurements: { floorDemoSqft: 1200, flooringLvpSqft: 1200 },
        } as never,
        OWNER_CARPET_NOTE
      ),
      OWNER_CARPET_NOTE
    );
    expect(canonicalItemIsExcluded(repaired.canonicalScope, 'floor_demo')).toBe(
      true
    );
    expect(repaired.scopeChecklist?.items?.map(item => item.id)).not.toContain(
      'floor_demo'
    );
    expect(repaired.scopeMeasurements?.floorDemoSqft).toBeUndefined();
    expect(resolveScopeFoundClarification(OWNER_CARPET_NOTE)).toBe(null);
    expect(
      hydrateScopeChecklistFromNotes(
        repaired.scopeChecklist?.items || [],
        'flooring',
        OWNER_CARPET_NOTE,
        repaired.scopeMeasurements as never,
        'flooring'
      ).map(item => item.id)
    ).not.toContain('floor_demo');
    expect(
      quickMeasurementRowsForInput('flooring', 'flooring', {}, [], {
        scopeNotes: OWNER_CARPET_NOTE,
      })
        .flat()
        .map(field => field.key)
    ).not.toContain('floorDemoSqft');
  });

  it('keeps an explicit drywall hang exclusion on mixed notes', () => {
    const notes =
      'Replace carpet with 900 sqft LVP. Reroof 26 squares of architectural shingles. Paint walls, 2,000 sqft. Replace the stucco, 1,800 sqft. HVAC service call to diagnose the furnace. Patch and texture 300 sqft of drywall. No new hang.';
    const scope = buildCanonicalScope({ notes });
    expect(canonicalItemIsExcluded(scope, 'drywall_hang')).toBe(true);
    expect(canonicalScopeBlocksItemId(scope, 'hang')).toBe(true);
    expect(canonicalItemIsExcluded(scope, 'floor_demo')).toBe(false);
    expect(canonicalScopeBlocksItemId(scope, 'floor_demo')).toBe(false);
    expect(canonicalScopeBlocksItemId(scope, 'flooring_lvp')).toBe(false);
  });

  it('drops interior painting on a bathroom note that never names paint', () => {
    const notes =
      'Bathroom remodel, demo bathroom floor and shower floor tile and shower walls. Install new shower walls with waterproofing and shower wall tile. Install new shower pan and tile. Install new bathroom floor. Install new vanity and countertop.';
    const saved = buildCanonicalScope({
      notes,
      checklistItems: [
        { id: 'interior_paint', state: 'included' },
        { id: 'vanity', state: 'included' },
      ],
    });
    const items = applyCanonicalScopeToChecklistItems(
      [
        { id: 'interior_paint', state: 'included', label: 'Interior painting' },
        { id: 'vanity', state: 'included', label: 'Vanity' },
        { id: 'shower_tile', state: 'included', label: 'Shower wall tile' },
      ],
      notes,
      saved
    );
    expect(items.map(item => item.id)).not.toContain('interior_paint');
    expect(items.map(item => item.id)).toContain('vanity');
    expect(items.map(item => item.id)).toContain('shower_tile');
  });

  it('keeps bathroom tile cards and puts baseboard demo with demo', () => {
    const notes =
      'Bathroom remodel, demo bathroom floor and shower floor tile and shower walls. Install new shower walls with waterproofing and shower wall tile. Install new shower pan and tile. Install new bathroom floor. Install new vanity and countertop.';
    const saved = buildCanonicalScope({
      notes,
      checklistItems: [
        { id: 'tile', state: 'included' },
        { id: 'tile_flooring', state: 'included' },
        { id: 'shower_tile', state: 'included' },
        { id: 'floor_tile', state: 'included' },
        { id: 'baseboard_demo', state: 'included' },
        { id: 'baseboard_install', state: 'included' },
      ],
    });
    const items = applyCanonicalScopeToChecklistItems(
      [
        { id: 'tile', state: 'included', label: 'Tile' },
        { id: 'tile_flooring', state: 'included', label: 'Tile' },
        { id: 'shower_tile', state: 'included', label: 'Shower wall tile' },
        { id: 'floor_tile', state: 'included', label: 'Bathroom floor' },
        { id: 'baseboard_demo', state: 'included', label: 'Baseboard demo' },
        { id: 'baseboard_install', state: 'included', label: 'Baseboard' },
      ],
      notes,
      saved
    );
    const ids = items.map(item => item.id);
    expect(ids).not.toContain('tile');
    expect(ids).not.toContain('tile_flooring');
    expect(ids).toContain('shower_tile');
    expect(ids).toContain('floor_tile');
    const groups = groupScopeChecklistItems(items, 'bathroom', { notes });
    const demo = groups.find(group => group.title === 'Demo');
    const other = groups.find(group => group.title === 'Other');
    expect(demo?.items.map(item => item.id)).toContain('baseboard_demo');
    expect(other?.items.map(item => item.id)).toContain('baseboard_install');
    expect(other?.items.map(item => item.id) || []).not.toContain('baseboard_demo');
    expect(groups.flatMap(group => group.items).map(item => item.id)).not.toContain(
      'tile'
    );
  });

  it('drops unnamed template cards on a dedicated paint note', () => {
    const items = applyCanonicalScopeToChecklistItems(
      [
        { id: 'interior_paint', state: 'included', label: 'Wall paint' },
        { id: 'electrical', state: 'included', label: 'Electrical' },
        { id: 'plumbing', state: 'included', label: 'Plumbing' },
        { id: 'flooring', state: 'included', label: 'Flooring' },
      ],
      'Paint walls, 2,000 sqft.'
    );
    expect(items.map(item => item.id)).toEqual(['interior_paint']);
  });

  it('drops unnamed roofing template cards on a reroof note', () => {
    const items = applyCanonicalScopeToChecklistItems(
      [
        { id: 'roofing', state: 'included', label: 'Roofing' },
        { id: 'roofing_system', state: 'included', label: 'Roofing system' },
        { id: 'gutters', state: 'included', label: 'Gutters' },
        { id: 'windows', state: 'included', label: 'Windows' },
        { id: 'siding', state: 'included', label: 'Siding' },
        { id: 'electrical', state: 'included', label: 'Electrical' },
      ],
      'Reroof 26 squares of architectural shingles.'
    );
    expect(items.map(item => item.id)).toEqual(
      expect.arrayContaining(['roofing'])
    );
    expect(items.map(item => item.id)).toEqual(
      expect.arrayContaining(['roofing_system'])
    );
    expect(items.map(item => item.id)).not.toContain('gutters');
    expect(items.map(item => item.id)).not.toContain('windows');
    expect(items.map(item => item.id)).not.toContain('siding');
    expect(items.map(item => item.id)).not.toContain('electrical');
  });

  it('does not let hydrate restore HVAC equipment on a service-call note', () => {
    const notes = 'HVAC service call to diagnose the furnace.';
    const hydrated = hydrateScopeChecklistFromNotes(
      [
        { id: 'service_call', state: 'included', label: 'HVAC service call' },
        { id: 'equipment_replace', state: 'included', label: 'Equipment replace' },
        { id: 'furnace', state: 'included', label: 'Furnace' },
        { id: 'ductwork', state: 'included', label: 'Ductwork' },
        { id: 'hvac', state: 'included', label: 'HVAC system' },
      ],
      'hvac',
      notes,
      {} as never,
      'hvac'
    );
    expect(hydrated.map(item => item.id)).toEqual(['service_call']);
  });

  it('drops unnamed HVAC template cards on a service-call note', () => {
    const items = applyCanonicalScopeToChecklistItems(
      [
        { id: 'service_call', state: 'included', label: 'HVAC service call' },
        { id: 'equipment_replace', state: 'included', label: 'Equipment replace' },
        { id: 'ductwork', state: 'included', label: 'Ductwork' },
        { id: 'thermostat', state: 'included', label: 'Thermostat' },
        { id: 'hvac', state: 'included', label: 'HVAC system' },
      ],
      'HVAC service call to diagnose the furnace.'
    );
    expect(items.map(item => item.id)).toEqual(['service_call']);
  });

  it('drops unnamed stucco template cards on a stucco-only note', () => {
    const items = applyCanonicalScopeToChecklistItems(
      [
        { id: 'stucco', state: 'included', label: 'Stucco' },
        { id: 'windows', state: 'included', label: 'Windows' },
        { id: 'electrical', state: 'included', label: 'Electrical' },
        { id: 'plumbing', state: 'included', label: 'Plumbing' },
      ],
      'Replace the stucco, 1,800 sqft.'
    );
    expect(items.map(item => item.id)).toEqual(['stucco']);
  });

  it('drops unnamed drywall template cards when the note only names a hang', () => {
    const items = applyCanonicalScopeToChecklistItems(
      [
        { id: 'drywall', state: 'included', label: 'Drywall hang / finish' },
        { id: 'patch_repair', state: 'included', label: 'Patch / repair' },
        { id: 'interior_paint', state: 'included', label: 'Paint' },
        { id: 'floor_demo', state: 'included', label: 'Flooring demo' },
      ],
      'Hang 800 sqft of drywall.'
    );
    expect(items.map(item => item.id)).toEqual(['drywall']);
  });

  it('drops unnamed room-remodel template cards on a mixed trade note', () => {
    const notes =
      'Replace carpet with 900 sqft LVP. Reroof 26 squares of architectural shingles. Paint walls, 2,000 sqft. Replace the stucco, 1,800 sqft. HVAC service call to diagnose the furnace. Patch and texture 300 sqft of drywall. No new hang.';
    const items = applyCanonicalScopeToChecklistItems(
      [
        { id: 'flooring_lvp', state: 'included', label: 'LVP' },
        { id: 'roofing', state: 'included', label: 'Roofing' },
        { id: 'interior_paint', state: 'included', label: 'Paint' },
        { id: 'stucco', state: 'included', label: 'Stucco' },
        { id: 'service_call', state: 'included', label: 'HVAC service call' },
        { id: 'patch_repair', state: 'included', label: 'Drywall repair' },
        { id: 'electrical', state: 'included', label: 'Electrical' },
        { id: 'plumbing', state: 'included', label: 'Plumbing' },
        { id: 'windows', state: 'included', label: 'Windows' },
        { id: 'cabinets', state: 'included', label: 'Cabinets' },
        { id: 'drywall_hang', state: 'included', label: 'Hang' },
      ],
      notes
    );
    expect(items.map(item => item.id).sort()).toEqual(
      [
        'flooring_lvp',
        'interior_paint',
        'patch_repair',
        'roofing',
        'service_call',
        'stucco',
      ].sort()
    );
  });

  it('adds named mixed-trade jobs onto an empty checklist', () => {
    const notes =
      'Replace carpet with 900 sqft LVP. Reroof 26 squares of architectural shingles. Paint walls, 2,000 sqft. Replace the stucco, 1,800 sqft. HVAC service call to diagnose the furnace. Patch and texture 300 sqft of drywall. No new hang.';
    const items = applyCanonicalScopeToChecklistItems([], notes);
    expect(items.map(item => item.id)).toEqual(
      expect.arrayContaining([
        'flooring_lvp',
        'roofing',
        'interior_paint',
        'stucco',
        'service_call',
        'patch_repair',
      ])
    );
    expect(items.map(item => item.id)).not.toContain('drywall_hang');
    expect(items.map(item => item.id)).not.toContain('floor_demo');
  });

  it('keeps excluded items off Confirm Scope after a later parse tries to add them', () => {
    const repaired = finalizeCanonicalScope(
      repairDraftRatePricingFromNotes(
        {
          originalNotes: OWNER_CARPET_NOTE,
          projectType: 'flooring',
          estimateTier: 'room_remodel',
          scopeChecklist: {
            templateKey: 'flooring',
            items: [
              { id: 'floor_demo', label: 'Flooring demo / removal', state: 'included' },
              { id: 'flooring', label: 'Flooring installation', state: 'included' },
              { id: 'flooring_lvp', label: 'LVP', state: 'included' },
            ],
          },
          scopeMeasurements: { floorDemoSqft: 1200, flooringLvpSqft: 1200 },
        } as never,
        OWNER_CARPET_NOTE
      ),
      OWNER_CARPET_NOTE
    );
    expect(
      confirmScopeDisplayItemsFromDraft(repaired).map(item => item.id)
    ).toEqual(['flooring_lvp']);
    expect(
      groupScopeChecklistItems(
        [
          { id: 'floor_demo', state: 'included', label: 'Flooring demo / removal' },
          { id: 'flooring_lvp', state: 'included', label: 'LVP' },
        ],
        'flooring',
        { notes: OWNER_CARPET_NOTE }
      )
        .flatMap(group => group.items)
        .map(item => item.id)
    ).toEqual(['flooring_lvp']);
  });
});
