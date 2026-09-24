import {
  countFilledQuickMeasurements,
  quickMeasurementDisplayLabel,
  quickMeasurementHelperText,
  quickMeasurementRowsForInput,
  quickMeasurementRowsForTemplate,
  quickMeasurementSectionsForRows,
  notesRequireInteriorPaintMeasurements,
  resolveEffectiveQuickMeasurementTemplateKey,
  resolveQuickMeasurementDisplayValue,
  resolveQuickMeasurementTemplateKey,
} from '@/utils/scopeQuickMeasurements';
import { tradeQuickMeasurementFieldKeys } from '@/utils/planImportTradeConfig';

describe('scopeQuickMeasurements', () => {
  it('keeps stale generic paint and baseboard fields out of stucco takeoff cards', () => {
    const fields = quickMeasurementRowsForInput(
      'stucco',
      'other',
      {
        exteriorPaintSqft: '1900',
        baseboardLf: '60',
        stuccoGrossWallSqft: '2400',
        stuccoGarageOpeningSqft: '0',
      },
      ['exteriorPaintSqft', 'baseboardLf'],
      {
        scopeNotes:
          'Repair and install stucco. Gross exterior wall area is 2,400 sqft. Deduct 320 sqft for window and door openings, 0 sqft for garage door openings, and 180 sqft for other non-stucco finishes.',
      }
    )
      .flat()
      .map(field => field.key);

    expect(fields).toContain('stuccoGarageOpeningSqft');
    expect(fields).not.toContain('exteriorPaintSqft');
    expect(fields).not.toContain('baseboardLf');
  });

  it('keeps roof decking out of generic deck and wall-paint cards', () => {
    const notes =
      'Tear off and remove the existing roof, then replace 28 roofing squares, repair 180 sqft decking, install gutters and downspouts, replace four windows, repair siding, install R-38 attic insulation, repair drywall, and paint ceilings.';
    const fields = quickMeasurementRowsForInput(
      'room_remodel',
      'other',
      {
        roofSquares: '28',
        roofDeckingReplacementSqft: '180',
        deckSqft: '180',
        windowCount: '4',
        insulationRValue: 'R-38',
      },
      ['roofSquares', 'roofDeckingReplacementSqft', 'deckSqft', 'windowCount'],
      { scopeNotes: notes }
    )
      .flat()
      .map(field => field);

    expect(fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'drywallSqft',
          label: 'Drywall repair area',
        }),
        expect.objectContaining({
          key: 'roofSquares',
          label: 'Roofing replacement',
        }),
        expect.objectContaining({
          key: 'roofDeckingReplacementSqft',
          label: 'Roof decking repair',
        }),
      ])
    );
    expect(fields.some(field => field.key === 'deckSqft')).toBe(false);
    expect(fields.some(field => field.key === 'wallPaintSqft')).toBe(false);
  });

  it('hides the generic room-floor field for mixed interior refreshes', () => {
    const notes =
      'Full interior refresh on a 1,900 sqft house. Paint all walls and ceilings, new LVP throughout main floor about 1,100 sqft, update 6 interior doors and trim, patch drywall where needed. No exterior work on this one.';
    const keys = quickMeasurementRowsForTemplate('room_remodel', 'other', notes)
      .flat()
      .map(field => field.key);

    expect(keys).not.toContain('bathroomFloorSqft');
    expect(keys).toContain('wallPaintSqft');
    expect(keys).toContain('baseboardLf');
  });

  it('keeps measured ceiling paint from creating a blank wall-paint card', () => {
    const notes =
      'Replace 1 existing HVAC system and 120 LF of ductwork. Install 1 new 3-ton heat-pump system, 1 thermostat, 8 supply registers, and 2 return grilles, including startup and testing. Also repair 240 sqft of drywall, replace 3 interior doors, and paint 1,100 sqft of ceilings. Excludes electrical service upgrades, plumbing, and structural repairs.';
    const keys = quickMeasurementRowsForInput(
      'room_remodel',
      'other',
      {},
      [],
      { scopeNotes: notes }
    )
      .flat()
      .map(field => field.key);

    expect(keys).toContain('ceilingPaintSqft');
    expect(keys).not.toContain('wallPaintSqft');
  });

  it('keeps unmeasured ceiling paint on the ceiling card only', () => {
    const notes =
      'Remove the existing HVAC system and ductwork, then install a new heat-pump system with thermostat, supply registers, and return grilles, including startup and testing. System count, tonnage, ductwork length, thermostat count, register count, and return grille count must be confirmed. Also patch drywall and paint ceilings. Excludes electrical service upgrades and plumbing.';
    const keys = quickMeasurementRowsForInput(
      'room_remodel',
      'other',
      {},
      [],
      { scopeNotes: notes }
    )
      .flat()
      .map(field => field.key);

    expect(keys).toContain('ceilingPaintSqft');
    expect(keys).not.toContain('wallPaintSqft');
    expect(keys).not.toContain('paintAreaSqft');
  });

  it('keeps mixed-note measurements owned by their explicit scopes', () => {
    const notes =
      'Paint 2,000 sqft walls and ceilings with prep, demolition and removal of damaged drywall, six interior doors, 180 LF baseboard, 300 sqft drywall repair, 900 sqft flooring, three replacement windows, and R-30 attic insulation.';
    const keys = quickMeasurementRowsForInput(
      'room_remodel',
      'painting',
      {
        drywallSqft: '300',
        patchRepairSqft: '300',
        flooringSqft: '900',
        baseboardLf: '180',
        wallPaintSqft: '2000',
        paintAreaSqft: '2000',
        interiorDoorCount: '6',
        windowCount: '3',
        insulationRValue: 'R-30',
      },
      [
        'drywallSqft',
        'patchRepairSqft',
        'flooringSqft',
        'baseboardLf',
        'wallPaintSqft',
        'paintAreaSqft',
        'interiorDoorCount',
        'windowCount',
        'insulationRValue',
      ],
      { scopeNotes: notes }
    )
      .flat()
      .map(field => field.key);

    expect(keys).not.toContain('floorAreaSqft');
    expect(keys).not.toContain('paintAreaSqft');
    expect(keys).not.toContain('patchRepairSqft');
    expect(keys).toEqual(
      expect.arrayContaining([
        'flooringSqft',
        'drywallSqft',
        'baseboardLf',
        'wallPaintSqft',
        'interiorDoorCount',
        'windowCount',
        'atticInsulationSqft',
        'insulationRValue',
      ])
    );
  });

  it('labels a shared walls and ceilings paint scope as one field', () => {
    const notes =
      'Remodel an existing 1,400 sqft home interior. Repaint interior walls and ceilings, and install 180 linear feet of baseboard.';
    expect(notesRequireInteriorPaintMeasurements(notes)).toBe(true);
    const fields = quickMeasurementRowsForInput(
      'room_remodel',
      'other',
      {},
      [],
      { scopeNotes: notes }
    ).flat();
    expect(fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'wallPaintSqft',
          label: 'Walls & ceilings paint',
        }),
      ])
    );
    expect(fields.some(field => field.key === 'ceilingPaintSqft')).toBe(false);
  });

  it('does not require an interior paint area for exterior trim paint', () => {
    const notes =
      'Demolish and remove the existing patio, then excavate and pour a 750 sqft patio with gravel base, rebar, thickened edge, retaining wall, 400 sqft pavers, landscaping, two exterior doors, siding repairs, and exterior trim paint.';
    expect(notesRequireInteriorPaintMeasurements(notes)).toBe(false);
    expect(
      quickMeasurementRowsForInput('room_remodel', 'other', {}, [], {
        scopeNotes: notes,
      })
        .flat()
        .some(field => field.key === 'wallPaintSqft')
    ).toBe(false);
    expect(
      quickMeasurementRowsForInput('room_remodel', 'other', {}, [], {
        scopeNotes: notes,
      })
        .flat()
        .some(field => field.key === 'baseboardLf')
    ).toBe(false);
  });

  it('restores one labeled walls and ceilings paint field for a shared noted area', () => {
    const notes =
      'Paint 2,000 sqft walls and ceilings with prep, demolition and removal of damaged drywall.';
    const fields = quickMeasurementRowsForInput(
      'room_remodel',
      'painting',
      { wallPaintSqft: '2000', ceilingPaintSqft: '2000' },
      ['wallPaintSqft', 'ceilingPaintSqft'],
      { scopeNotes: notes }
    ).flat();

    expect(fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'wallPaintSqft',
          label: 'Walls & ceilings paint',
        }),
      ])
    );
    expect(fields.some(field => field.key === 'ceilingPaintSqft')).toBe(false);
  });

  it('labels drywall removal separately and keeps the explicit combined paint area', () => {
    const notes =
      'Paint 2,000 sqft walls and ceilings with prep, demolition and removal of damaged drywall, six interior doors, 180 LF baseboard, 300 sqft drywall repair, 900 sqft flooring, three replacement windows, and R-30 attic insulation.';
    const fields = quickMeasurementRowsForInput(
      'room_remodel',
      'painting',
      {},
      [],
      { scopeNotes: notes }
    ).flat();

    expect(fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'wallPaintSqft',
          label: 'Walls & ceilings paint',
        }),
        expect.objectContaining({
          key: 'wallDemoSqft',
          label: 'Drywall demolition area',
        }),
      ])
    );
    expect(fields.some(field => field.key === 'ceilingPaintSqft')).toBe(false);
  });

  it('labels wall-only and ceiling-only paint scopes from the notes', () => {
    const wallFields = quickMeasurementRowsForInput(
      'room_remodel',
      'other',
      {},
      [],
      { scopeNotes: 'Paint 1,000 sqft walls.' }
    ).flat();
    const ceilingFields = quickMeasurementRowsForInput(
      'room_remodel',
      'other',
      {},
      [],
      { scopeNotes: 'Paint 900 sqft ceilings.' }
    ).flat();

    expect(wallFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'wallPaintSqft', label: 'Walls paint' }),
      ])
    );
    expect(wallFields.some(field => field.key === 'ceilingPaintSqft')).toBe(
      false
    );
    expect(ceilingFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'ceilingPaintSqft',
          label: 'Ceiling paint',
        }),
      ])
    );
    expect(ceilingFields.some(field => field.key === 'wallPaintSqft')).toBe(
      false
    );
  });

  it('keeps paint visible for confirmation when notes provide no paint area', () => {
    const notes =
      'Remove existing insulation where necessary, then install R-21 batt insulation in 2,000 sqft walls, R-38 blown insulation in 1,200 sqft attic, R-30 floor insulation in 900 sqft, include gap sealing, repair drywall, install flooring, replace four windows, and paint.';
    const rows = quickMeasurementRowsForInput('room_remodel', 'other', {}, [], {
      scopeNotes: notes,
    });
    const fields = rows.flat();

    expect(fields.map(field => field.key)).toContain('wallPaintSqft');
    expect(fields.map(field => field.key)).not.toContain('ceilingPaintSqft');
    expect(fields.find(field => field.key === 'wallPaintSqft')?.label).toBe(
      'Paint'
    );
  });

  it('uses flooring removal instead of wall demolition for flooring notes', () => {
    const notes =
      'Remove and dispose of 1,200 sqft existing flooring, then install LVP with underlayment, transitions, 120 LF baseboard, two interior doors, 150 sqft drywall repair, four windows, R-21 wall insulation, and interior paint.';
    const fields = quickMeasurementRowsForInput(
      'room_remodel',
      'flooring',
      {},
      [],
      { scopeNotes: notes }
    ).flat();

    expect(fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'floorDemoSqft',
          label: 'Flooring removal',
        }),
        expect.objectContaining({
          key: 'wallPaintSqft',
          label: 'Paint',
        }),
      ])
    );
    expect(fields.some(field => field.key === 'wallDemoSqft')).toBe(false);
  });

  it('filters stale room-remodel measurements for kitchen notes', () => {
    const notes =
      'Remodel an existing kitchen without changing the footprint. Install 42 linear feet of new cabinets, 55 sqft of quartz countertops, and 35 sqft of backsplash tile. Include flooring protection, demolition, disposal, and cleanup. No wall removal or structural framing.';
    const keys = quickMeasurementRowsForInput('room_remodel', 'other', {}, [], {
      scopeNotes: notes,
    })
      .flat()
      .map(field => field.key);

    expect(keys).toContain('cabinetLf');
    expect(keys).toContain('countertopSqft');
    expect(keys).not.toContain('floorAreaSqft');
    expect(keys).not.toContain('flooringSqft');
    expect(keys).not.toContain('drywallSqft');
    expect(keys).not.toContain('baseboardLf');
    expect(keys).not.toContain('wallPaintSqft');
    expect(keys).not.toContain('ceilingPaintSqft');
  });

  it('uses a base drywall measurement for bare drywall notes', () => {
    const rows = quickMeasurementRowsForInput('bathroom', 'bathroom', {}, [], {
      scopeNotes: 'Remodel the bathroom and install drywall.',
    });
    const fields = rows.flat();

    expect(fields.map(field => field.key)).toContain('drywallSqft');
    expect(fields.map(field => field.key)).not.toContain('patchRepairSqft');
    expect(fields.find(field => field.key === 'drywallSqft')?.label).toBe(
      'Drywall install'
    );
  });

  it('uses the patch and texture measurement for drywall patch notes', () => {
    const rows = quickMeasurementRowsForInput('bathroom', 'bathroom', {}, [], {
      scopeNotes: 'Patch drywall and match the existing texture.',
    });
    const fields = rows.flat();

    expect(fields.map(field => field.key)).toContain('patchRepairSqft');
    expect(fields.find(field => field.key === 'patchRepairSqft')?.label).toBe(
      'Drywall patch & texture'
    );
  });

  it('adds an interior door count for bare door notes', () => {
    const rows = quickMeasurementRowsForInput('bathroom', 'bathroom', {}, [], {
      scopeNotes: 'Remodel the bathroom with drywall, doors, and paint.',
    });

    expect(rows.flat().map(field => field.key)).toContain('interiorDoorCount');
  });

  it('keeps unrelated paint measurements out of insulation quick measurements', () => {
    const keys = quickMeasurementRowsForInput(
      'insulation',
      'insulation',
      { wallPaintSqft: '2200' },
      ['wallPaintSqft']
    )
      .flat()
      .map(field => field.key);

    expect(keys).not.toContain('wallPaintSqft');
    expect(keys).not.toContain('ceilingPaintSqft');
    expect(keys).toContain('exteriorWallInsulationSqft');
  });

  it('labels addition floor area as ADU for ADU projects and marks it primary', () => {
    const rows = quickMeasurementRowsForTemplate('addition', 'adu');
    const floorArea = rows.flat().find(field => field.key === 'floorAreaSqft');
    const flooring = rows.flat().find(field => field.key === 'flooringSqft');

    expect(floorArea?.label).toBe('ADU');
    expect(floorArea?.unit).toBe('sqft');
    expect(floorArea?.placeholder).toBe('650');
    expect(floorArea?.primary).toBe(true);
    expect(flooring?.label).toBe('Flooring');
  });

  it('labels addition floor area by project type', () => {
    const roomAddition = quickMeasurementRowsForTemplate(
      'addition',
      'room_addition'
    )
      .flat()
      .find(field => field.key === 'floorAreaSqft');
    const garageConversion = quickMeasurementRowsForTemplate(
      'addition',
      'garage_conversion'
    )
      .flat()
      .find(field => field.key === 'floorAreaSqft');

    expect(roomAddition?.label).toBe('Room addition');
    expect(garageConversion?.label).toBe('Garage conversion');
    expect(garageConversion?.placeholder).toBe('400');
  });

  it('hides new-build structure fields for garage conversion quick measurements', () => {
    const notes =
      'Convert 2-car garage to office/studio, about 400 sqft. Insulate walls and ceiling, drywall hang and finish, paint.';
    const keys = quickMeasurementRowsForTemplate(
      'addition',
      'garage_conversion',
      notes
    )
      .flat()
      .map(field => field.key);
    expect(keys).toContain('floorAreaSqft');
    expect(keys).not.toContain('garageSqft');
    expect(keys).not.toContain('excavationCy');
    expect(keys).not.toContain('concreteCy');
    expect(keys).not.toContain('roofSquares');
    expect(keys).not.toContain('concreteSqft');
    expect(keys).not.toContain('showerWallTileSqft');
    expect(keys).toContain('windowCount');
    expect(keys).toContain('exteriorDoorCount');
    expect(keys).toContain('interiorDoorCount');
  });

  it('keeps an interior room remodel on the remodel measurement layout', () => {
    expect(
      resolveEffectiveQuickMeasurementTemplateKey({
        templateKey: 'room_remodel',
        planRoomCount: 11,
        livingSf: 3098,
        garageSf: 900,
      })
    ).toBe('room_remodel');
    expect(
      resolveEffectiveQuickMeasurementTemplateKey({
        templateKey: 'kitchen',
        planRoomCount: 1,
        livingSf: 180,
      })
    ).toBe('kitchen');
  });

  it('keeps a standalone bathroom remodel on the bathroom measurement layout', () => {
    expect(
      resolveEffectiveQuickMeasurementTemplateKey({
        templateKey: 'bathroom',
        projectType: 'bathroom',
        notes:
          'Remodel bathroom with shower tile, shower pan, vanity, toilet, drywall, insulation, and paint.',
      })
    ).toBe('bathroom');
  });

  it('keeps cross-trade measurement fields on bathroom remodels', () => {
    const keys = quickMeasurementRowsForTemplate(
      'bathroom',
      'bathroom',
      'Remodel bathroom with windows, an exterior door, insulation, and paint.'
    )
      .flat()
      .map(field => field.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'windowCount',
        'exteriorDoorCount',
        'exteriorWallInsulationSqft',
      ])
    );
  });

  it('shows only note-backed window and exterior-door measurements', () => {
    const bathroomNotes =
      'Remodel bathroom with two interior doors, insulation, and paint.';
    const bathroomKeys = quickMeasurementRowsForTemplate(
      'bathroom',
      'bathroom',
      bathroomNotes
    )
      .flat()
      .map(field => field.key);
    expect(bathroomKeys).not.toContain('windowCount');
    expect(bathroomKeys).not.toContain('exteriorDoorCount');

    const crossTradeKeys = quickMeasurementRowsForTemplate(
      'bathroom',
      'bathroom',
      'Remodel bathroom and replace 2 windows and 1 exterior door.'
    )
      .flat()
      .map(field => field.key);
    expect(crossTradeKeys).toEqual(
      expect.arrayContaining(['windowCount', 'exteriorDoorCount'])
    );
  });

  it('does not mistake exterior wall insulation for exterior doors', () => {
    const notes =
      'Remodel bathroom with two interior doors, 120 sqft drywall repair, R-21 exterior wall insulation, and paint.';
    const rows = quickMeasurementRowsForInput('bathroom', 'bathroom', {}, [], {
      scopeNotes: notes,
    });
    const keys = rows.flat().map(field => field.key);

    expect(keys).not.toContain('windowCount');
    expect(keys).not.toContain('exteriorDoorCount');
  });

  it('routes insulation-only notes to the insulation measurement layout', () => {
    const notes =
      'Insulate an existing 1,800 sqft two-story home. Install R-21 fiberglass batt insulation in 2,000 sqft of exterior walls, R-38 blown insulation in 1,200 sqft of attic area, and R-30 batt insulation in 900 sqft of floor area. Include air sealing and normal installation. No drywall removal.';

    expect(
      resolveEffectiveQuickMeasurementTemplateKey({
        templateKey: 'room_remodel',
        projectType: 'other',
        notes,
      })
    ).toBe('insulation');
  });

  it('routes framing-focused room-addition notes to framing measurements', () => {
    const notes =
      'Frame a new 600 sqft room addition with 8-foot walls. Include exterior wall framing and interior partitions totaling 120 linear feet, roof tie-in framing, headers for 4 windows and 1 exterior door, sheathing, and blocking.';
    expect(
      resolveEffectiveQuickMeasurementTemplateKey({
        templateKey: 'room_addition',
        projectType: 'room_addition',
        notes,
      })
    ).toBe('framing');

    const keys = quickMeasurementRowsForTemplate(
      'room_addition',
      'room_addition',
      notes
    )
      .flat()
      .map(field => field.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'wallDemoSqft',
        'framedAreaSqft',
        'wallFramingLf',
        'sheathingSqft',
        'framingOpeningCount',
      ])
    );
    expect(keys).not.toContain('kitchenFloorSqft');
    expect(keys).not.toContain('cabinetLf');
  });

  it('promotes structural mixed notes out of a windows-and-doors layout', () => {
    const notes =
      'Demolish existing nonstructural walls, then frame 1,600 sqft of walls with headers, blocking, two door openings, structural sheathing, six windows, two exterior doors, R-21 insulation, 1,600 sqft drywall, flooring, and paint.';
    expect(
      resolveEffectiveQuickMeasurementTemplateKey({
        templateKey: 'windows_doors',
        projectType: 'windows_doors',
        notes,
      })
    ).toBe('room_remodel');
  });

  it('uses only remodel measurements supported by the notes', () => {
    const rows = quickMeasurementRowsForTemplate(
      'room_remodel',
      'room_remodel',
      'Remodel an existing 1,400 sqft home interior. Install 900 sqft of LVP, replace 12 linear feet of kitchen countertops, install 42 linear feet of cabinets, repair 300 sqft of drywall, and install 180 linear feet of baseboard.'
    );
    const fields = rows.flat();
    expect(fields.map(field => field.key)).toEqual([
      'floorAreaSqft',
      'flooringSqft',
      'cabinetLf',
      'countertopLf',
      'drywallSqft',
      'baseboardLf',
    ]);
    expect(fields.find(field => field.key === 'countertopLf')?.unit).toBe('LF');
    expect(fields.map(field => field.key)).not.toContain('bathroomFloorSqft');
  });

  it('keeps bathroom measurements note-driven when no wet-area rebuild is mentioned', () => {
    const notes =
      'Remove existing bathroom fixtures, then reroute 25 LF bathroom plumbing and install a toilet, vanity, faucet, shower valve, 90 sqft flooring, 120 sqft drywall repair, 40 LF cabinets, two windows, insulation, and paint.';
    const fields = quickMeasurementRowsForInput(
      'bathroom',
      'bathroom',
      {},
      [],
      { scopeNotes: notes }
    )
      .flat()
      .map(field => field);
    const keys = fields.map(field => field.key);

    expect(keys).toEqual(
      expect.arrayContaining([
        'plumbingRerouteLf',
        'bathroomFloorSqft',
        'patchRepairSqft',
        'windowCount',
        'exteriorWallInsulationSqft',
      ])
    );
    expect(fields.find(field => field.key === 'plumbingRerouteLf')?.label).toBe(
      'Plumbing reroute'
    );
    expect(fields.find(field => field.key === 'bathroomFloorSqft')?.label).toBe(
      'Flooring installation'
    );
    expect(keys).not.toContain('showerWallTileSqft');
    expect(keys).not.toContain('showerFloorTileSqft');
    expect(keys).not.toContain('exteriorDoorCount');
    expect(keys).not.toContain('baseboardLf');
    expect(keys).not.toContain('flooringSqft');
    expect(keys).not.toContain('drywallSqft');
    expect(keys).not.toContain('cabinetLf');

    const mixedRows = quickMeasurementRowsForInput(
      'room_remodel',
      'other',
      {},
      [],
      { scopeNotes: notes }
    );
    const mixedKeys = mixedRows.flat().map(field => field.key);
    expect(mixedKeys).toContain('plumbingRerouteLf');
    expect(mixedKeys).toContain('bathroomFloorSqft');
    expect(mixedKeys).toContain('cabinetLf');
    expect(mixedKeys).not.toContain('flooringSqft');
    expect(mixedKeys).not.toContain('drywallSqft');
  });

  it('keeps a whole-home remodel out of kitchen and bathroom finish fields', () => {
    const notes =
      'Remodel a 2,400 sqft home with demolition and removal of existing cabinets, fixtures, flooring, drywall, and finishes as needed; kitchen and bathroom updates, 1,800 sqft flooring, 500 sqft drywall repair, six windows, two exterior doors, four interior doors, wall and attic insulation, air sealing, trim, plumbing, electrical, and interior paint.';
    const keys = quickMeasurementRowsForInput(
      'room_remodel',
      'other',
      {},
      [],
      { scopeNotes: notes }
    )
      .flat()
      .map(field => field.key);

    expect(keys).toContain('flooringSqft');
    expect(keys).toContain('drywallSqft');
    expect(keys).not.toContain('bathroomFloorSqft');
    expect(keys).not.toContain('kitchenFloorSqft');
    expect(keys).not.toContain('cabinetLf');
  });

  it('exposes note-backed framing measurements inside a mixed remodel', () => {
    const notes =
      'Demolish existing nonstructural walls, then frame 1,600 sqft of walls with headers, blocking, two door openings, structural sheathing, six windows, two exterior doors, R-21 insulation, 1,600 sqft drywall, flooring, and paint.';
    const keys = quickMeasurementRowsForInput('room_remodel', 'other', {}, [], {
      scopeNotes: notes,
    })
      .flat()
      .map(field => field.key);

    expect(keys).toEqual(
      expect.arrayContaining([
        'framedAreaSqft',
        'framingOpeningCount',
        'sheathingSqft',
        'drywallSqft',
        'flooringSqft',
        'wallPaintSqft',
        'windowCount',
        'exteriorDoorCount',
        'insulationRValue',
      ])
    );
  });

  it('compacts mixed-scope measurements to note-backed trade fields', () => {
    const notes =
      'Remodel an existing 2,000 sqft home and build a 350 sqft addition. Electrical scope includes a 200A main panel, wiring and boxes for 30 standard receptacle locations, 6 GFCI receptacle locations, 20 switch locations, 26 recessed-light rough-in locations, four dedicated 20A circuits, and 240 LF of conduit. Repair 420 sqft of drywall, install six windows and two exterior doors, add R-21 wall insulation, install 1,100 sqft flooring, replace 160 LF baseboard, and paint the interior.';
    const keys = [
      'floorAreaSqft',
      'mainPanelCount',
      'serviceAmperage',
      'dedicated20aCircuitCount',
      'standardReceptacleCount',
      'gfciReceptacleCount',
      'singlePoleSwitchCount',
      'recessedLightCount',
      'conduitLf',
      'windowCount',
      'exteriorDoorCount',
      'exteriorWallInsulationSqft',
    ] as any;
    const fields = quickMeasurementRowsForInput(
      'room_remodel',
      'other',
      {},
      keys,
      { scopeNotes: notes, crossScopeMode: true }
    )
      .flat()
      .map(field => field.key);

    expect(fields).toEqual(
      expect.arrayContaining([
        'floorAreaSqft',
        'mainPanelCount',
        'serviceAmperage',
        'dedicated20aCircuitCount',
        'standardReceptacleCount',
        'gfciReceptacleCount',
        'singlePoleSwitchCount',
        'recessedLightCount',
        'conduitLf',
        'windowCount',
        'exteriorDoorCount',
        'flooringSqft',
        'drywallSqft',
        'baseboardLf',
        'wallPaintSqft',
      ])
    );
    expect(fields).not.toEqual(
      expect.arrayContaining([
        'kitchenFloorSqft',
        'cabinetLf',
        'countertopSqft',
        'bathroomFloorSqft',
        'garageSqft',
      ])
    );
    expect(
      quickMeasurementRowsForInput(
        'room_remodel',
        'other',
        {},
        keys,
        { scopeNotes: notes, crossScopeMode: true }
      )
        .flat()
        .find(field => field.key === 'floorAreaSqft')?.label
    ).toBe('Addition');
  });

  it('uses living-first ground_up layout for new builds', () => {
    expect(resolveQuickMeasurementTemplateKey(null, 'new_build')).toBe(
      'ground_up'
    );
    const keys = quickMeasurementRowsForTemplate('ground_up', 'new_build')
      .flat()
      .map(field => field.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'floorAreaSqft',
        'garageSqft',
        'deckSqft',
        'kitchenFloorSqft',
        'bathroomFloorSqft',
        'showerWallTileSqft',
        'showerFloorTileSqft',
        'concreteSqft',
        'roofSquares',
        'drywallSqft',
        'cabinetLf',
        'countertopSqft',
        'wallPaintSqft',
        'exteriorPaintSqft',
      ])
    );
    const living = quickMeasurementRowsForTemplate('ground_up', 'new_build')
      .flat()
      .find(field => field.key === 'floorAreaSqft');
    expect(living?.label).toBe('Living area');
    expect(living?.primary).toBe(true);
  });

  it('maps home_addition project type to addition living-first fields', () => {
    expect(resolveQuickMeasurementTemplateKey(null, 'home_addition')).toBe(
      'addition'
    );
    const keys = quickMeasurementRowsForTemplate('addition', 'home_addition')
      .flat()
      .map(field => field.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'floorAreaSqft',
        'garageSqft',
        'deckSqft',
        'kitchenFloorSqft',
        'bathroomFloorSqft',
        'showerWallTileSqft',
        'showerFloorTileSqft',
      ])
    );
  });

  it('prefers live form state over note prefill for note-backed quick fields', () => {
    expect(
      resolveQuickMeasurementDisplayValue(
        'drywallSqft',
        { drywallSqft: '1205' },
        { drywallSqft: '1000' }
      )
    ).toBe('1205');
    expect(
      resolveQuickMeasurementDisplayValue(
        'drywallSqft',
        { drywallSqft: '' },
        { drywallSqft: '1000' }
      )
    ).toBe('1000');
    expect(
      resolveQuickMeasurementDisplayValue(
        'cabinetPaintSqft',
        { cabinetPaintSqft: '' },
        { cabinetPaintSqft: '200' },
        { cabinetPaintSqft: true }
      )
    ).toBe('');
  });

  it('keeps addition quick measurement rows stable while typing', () => {
    const before = quickMeasurementRowsForInput(
      'addition',
      'adu',
      { excavationCy: '50' },
      ['excavationCy']
    );
    const after = quickMeasurementRowsForInput(
      'addition',
      'adu',
      { excavationCy: '51' },
      ['excavationCy']
    );
    expect(before.map(row => row.map(field => field.key).join('-'))).toEqual(
      after.map(row => row.map(field => field.key).join('-'))
    );
  });

  it('groups addition fields with primary Structure section first', () => {
    const rows = quickMeasurementRowsForTemplate('addition', 'adu');
    const sections = quickMeasurementSectionsForRows(rows);
    expect(sections[0]?.id).toBe('structure');
    expect(sections[0]?.rows[0]?.[0]?.key).toBe('floorAreaSqft');
    expect(sections[0]?.rows[0]?.[0]?.primary).toBe(true);
    expect(sections.map(s => s.id)).toEqual(
      expect.arrayContaining(['structure', 'exterior', 'interior', 'site'])
    );
  });

  it('counts filled quick measurements including note prefill', () => {
    const rows = quickMeasurementRowsForTemplate('addition', 'adu');
    const counts = countFilledQuickMeasurements(
      rows,
      { excavationCy: '50' },
      { flooringSqft: '1000' }
    );
    expect(counts.total).toBeGreaterThan(0);
    expect(counts.filled).toBe(2);
  });

  it('bathroom quick measurements omit baseboard unless notes include LF', () => {
    const keys = quickMeasurementRowsForTemplate('bathroom', 'bathroom')
      .flat()
      .map(field => field.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'bathroomFloorSqft',
        'showerWallTileSqft',
        'showerFloorTileSqft',
        'wallPaintSqft',
      ])
    );
    expect(keys).not.toContain('baseboardLf');
  });

  it('labels generic LF trim as Trim and explicit baseboard as Baseboard', () => {
    const trimField = quickMeasurementRowsForTemplate(
      'bathroom',
      'bathroom',
      'Remodel bathroom with 65 LF trim.'
    )
      .flat()
      .find(field => field.key === 'baseboardLf');
    const baseboardField = quickMeasurementRowsForTemplate(
      'bathroom',
      'bathroom',
      'Install 65 LF baseboard.'
    )
      .flat()
      .find(field => field.key === 'baseboardLf');

    expect(trimField?.label).toBe('Trim');
    expect(baseboardField?.label).toBe('Baseboard');
  });

  it('exposes plumbing quick measurements for plumbing and plumbing_service templates', () => {
    expect(
      resolveQuickMeasurementTemplateKey('plumbing_service', 'plumbing')
    ).toBe('plumbing');
    const keys = quickMeasurementRowsForTemplate('plumbing_service', 'plumbing')
      .flat()
      .map(field => field.key);
    expect(keys).toEqual([
      'plumbingRoughPointCount',
      'plumbingTrimHookupCount',
      'fixtureReplacementCount',
      'fixtureRepairCount',
      'waterLineLf',
      'sewerLineLf',
      'plumbingFixturesHardwareCount',
      'waterHeaterCount',
      'gasLineLf',
      'gasApplianceConnectionCount',
    ]);
    expect(keys).not.toEqual(
      expect.arrayContaining([
        'drainCleaningCount',
        'serviceCallCount',
        'partsMaterialsCount',
        'emergencyFeeCount',
        'plumbingCleanupCount',
      ])
    );
    expect(keys).not.toContain('floorAreaSqft');
  });

  it('keeps standalone plumbing measurements explicit instead of inferring living area', () => {
    const fields = quickMeasurementRowsForTemplate(
      'plumbing',
      'plumbing'
    ).flat();
    expect(
      quickMeasurementHelperText(
        fields.find(field => field.key === 'plumbingRoughPointCount')!
      )
    ).toMatch(/not living sf/i);
    expect(fields.find(field => field.key === 'waterLineLf')?.unit).toBe('LF');
  });

  it('restores the full physical plumbing card for ground-up Notes/Voice flow', () => {
    const rows = quickMeasurementRowsForInput('plumbing', 'plumbing', {}, [], {
      plumbingNotesFlow: true,
      plumbingWorkflowMode: 'new_construction',
      scopeNotes:
        'Plumbing rough-in for ground-up construction: Install underground and above-slab DWV piping, domestic hot and cold water lines, vent piping, hose-bib lines, and connections for all fixtures shown on plans. Set fixture stub-outs at kitchen, bathrooms, laundry, and utility areas. Pressure-test water lines and inspect/test drain and vent systems before concealment. Excludes fixtures, trim, excavation beyond plumbing trenches, utility tap fees, and final connections.',
    });

    expect(rows.flat().map(field => field.key)).toEqual([
      'plumbingRoughPointCount',
      'plumbingTrimHookupCount',
      'waterLineLf',
      'sewerLineLf',
      'plumbingFixturesHardwareCount',
      'waterHeaterCount',
      'gasLineLf',
      'gasApplianceConnectionCount',
    ]);
  });

  it('shows note-backed service plumbing measurements for component replacements and disposal', () => {
    const rows = quickMeasurementRowsForInput(
      'plumbing_service',
      'plumbing',
      {},
      [],
      {
        plumbingNotesFlow: true,
        plumbingWorkflowMode: 'service',
        scopeNotes:
          'Replace kitchen faucet, two angle stops, braided supply lines, and 1-1/2-inch P-trap. Replace hall bathroom toilet fill valve, flapper, and supply line. Dispose of replaced plumbing parts.',
      }
    );
    expect(rows.flat().map(field => field.key)).toEqual(
      expect.arrayContaining([
        'fixtureReplacementCount',
        'partsMaterialsCount',
        'plumbingCleanupCount',
      ])
    );
  });

  it('keeps Plumbing fields visible in selected-trade Quick Measurements', () => {
    const allowed = new Set(tradeQuickMeasurementFieldKeys('plumbing'));
    const fields = quickMeasurementRowsForTemplate(
      'plumbing_service',
      'plumbing'
    )
      .flat()
      .filter(field => allowed.has(field.key));
    expect(fields.length).toBeGreaterThan(0);
    expect(fields.map(field => field.key)).toEqual(
      expect.arrayContaining(['plumbingRoughPointCount', 'waterLineLf'])
    );
  });

  it('uses a physical-only Plumbing projection for Plan Export', () => {
    const rows = quickMeasurementRowsForInput(
      'plumbing_service',
      'ground_up',
      {
        serviceCallCount: '1',
        fixtureRepairCount: '2',
        partsMaterialsCount: '1',
      },
      [],
      { plumbingPlanImport: true }
    );
    expect(rows.flat().map(field => field.key)).toEqual([
      'plumbingRoughPointCount',
      'plumbingTrimHookupCount',
      'waterLineLf',
      'sewerLineLf',
      'gasLineLf',
    ]);
    expect(rows.flat().find(field => field.key === 'waterLineLf')?.label).toBe(
      'Underground water service / under-slab piping'
    );
    expect(rows.flat().find(field => field.key === 'sewerLineLf')?.label).toBe(
      'Underground sewer / drain / under-slab DWV'
    );
    expect(rows.flat().map(field => field.key)).not.toEqual(
      expect.arrayContaining([
        'fixtureRepairCount',
        'serviceCallCount',
        'drainCleaningCount',
        'partsMaterialsCount',
        'emergencyFeeCount',
        'plumbingCleanupCount',
      ])
    );
  });

  it('keeps explicit service rows for Notes/manual Plumbing flows', () => {
    const rows = quickMeasurementRowsForInput(
      'plumbing_service',
      'room_remodel',
      {
        emergencyFeeCount: '1',
        plumbingCleanupCount: '1',
      },
      [],
      { plumbingNotesFlow: true }
    );
    expect(rows.flat().map(field => field.key)).toEqual([
      'plumbingRoughPointCount',
      'plumbingTrimHookupCount',
      'fixtureReplacementCount',
      'fixtureRepairCount',
      'waterLineLf',
      'sewerLineLf',
      'plumbingFixturesHardwareCount',
      'waterHeaterCount',
      'gasLineLf',
      'gasApplianceConnectionCount',
      'serviceCallCount',
      'drainCleaningCount',
    ]);
    expect(rows.flat().map(field => field.key)).not.toEqual(
      expect.arrayContaining([
        'partsMaterialsCount',
        'emergencyFeeCount',
        'plumbingCleanupCount',
      ])
    );
  });

  it('uses service-only rows for standalone Plumbing Service mode', () => {
    const rows = quickMeasurementRowsForInput(
      'plumbing_service',
      'simple_unit',
      {},
      [],
      {
        plumbingNotesFlow: true,
        plumbingWorkflowMode: 'service',
      }
    );
    expect(rows.flat().map(field => field.key)).toEqual([
      'serviceCallCount',
      'fixtureRepairCount',
      'fixtureReplacementCount',
      'drainCleaningCount',
      'partsMaterialsCount',
      'plumbingCleanupCount',
    ]);
  });

  it('keeps kitchen quick fields when checklist is kitchen even if projectType is flooring', () => {
    const rows = quickMeasurementRowsForTemplate('kitchen', 'flooring');
    const keys = rows.flat().map(field => field.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'kitchenFloorSqft',
        'backsplashSqft',
        'countertopSqft',
        'cabinetLf',
        'wallPaintSqft',
        'baseboardLf',
      ])
    );
    expect(keys).not.toContain('floorAreaSqft');
    expect(keys).not.toContain('bathroomFloorSqft');
  });

  it('keeps the kitchen floor field for a quantified cross-trade LVP note', () => {
    const notes =
      'Remodel kitchen with 38 LF cabinets, 48 sqft quartz counters, 220 sqft drywall repair, 700 sqft LVP, two new windows, and interior paint.';
    const rows = quickMeasurementRowsForInput(
      'room_remodel',
      'other',
      {},
      ['kitchenFloorSqft'],
      { scopeNotes: notes }
    );
    expect(rows.flat().map(field => field.key)).toContain('kitchenFloorSqft');
  });

  it('shows a blank exterior trim paint field and hides duplicate patio area', () => {
    const notes =
      'Demolish and remove the existing patio, then excavate and pour a 750 sqft patio with gravel base, rebar, thickened edge, retaining wall, 400 sqft pavers, landscaping, two exterior doors, siding repairs, and exterior trim paint.';
    const fields = quickMeasurementRowsForInput('concrete', 'other', {}, [], {
      scopeNotes: notes,
    })
      .flat()
      .map(field => field);

    expect(fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'exteriorPaintSqft',
          label: 'Exterior trim paint',
          placeholder: 'Enter',
        }),
      ])
    );
    expect(fields.some(field => field.key === 'deckSqft')).toBe(false);
  });

  it('shows blank confirmation fields for note-identified mixed exterior scopes', () => {
    const notes =
      'Demolish and remove the existing patio, then excavate and pour a 750 sqft patio with gravel base, rebar, thickened edge, retaining wall, 400 sqft pavers, landscaping, two exterior doors, siding repairs, and exterior trim paint.';
    const fields = quickMeasurementRowsForInput('concrete', 'other', {}, [], {
      scopeNotes: notes,
    })
      .flat()
      .map(field => field);

    expect(fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'landscapeSqft',
          label: 'Landscaping area',
          placeholder: 'Enter',
          unit: 'sqft',
        }),
        expect.objectContaining({
          key: 'sidingRepairSqft',
          label: 'Siding repair area',
          placeholder: 'Enter',
          unit: 'sqft',
        }),
        expect.objectContaining({
          key: 'retainingWallLf',
          label: 'Retaining wall length',
          placeholder: 'Enter',
          unit: 'LF',
        }),
      ])
    );
  });

  it('relabels concrete flatwork as exterior-only with a clarifying helper (excludes house/garage slab)', () => {
    const rows = quickMeasurementRowsForTemplate('ground_up', 'new_build');
    const flatwork = rows.flat().find(field => field.key === 'concreteSqft');
    expect(flatwork?.label).toBe('Exterior concrete flatwork');
    expect(flatwork?.helperText).toMatch(/driveway/i);
    expect(flatwork?.helperText).toMatch(/not the house or garage slab/i);
  });

  it('labels foundation quantity to match included building slabs', () => {
    const rows = quickMeasurementRowsForTemplate('ground_up', 'new_build');
    const foundation = rows.flat().find(field => field.key === 'concreteCy');
    expect(foundation?.label).toMatch(/Foundation and building slabs/i);
  });

  it('clarifies Living vs Gross interior floor area', () => {
    const living = {
      key: 'floorAreaSqft' as const,
      label: 'Living area',
      placeholder: '',
      unit: 'sqft',
      group: 'structure' as const,
    };
    const gross = {
      key: 'flooringSqft' as const,
      label: 'Flooring',
      placeholder: '',
      unit: 'sqft',
      group: 'interior' as const,
    };
    expect(quickMeasurementHelperText(living)).toMatch(/living area/i);
    expect(quickMeasurementHelperText(gross)).toMatch(/matches living area/i);
    // Display label rename is behind measurement-semantics flag; helper always applies.
    const labeled = quickMeasurementDisplayLabel(gross);
    expect(
      labeled === 'Gross interior floor area' || labeled === 'Flooring'
    ).toBe(true);
  });

  it('shows all note-backed electrical rough-in quantities', () => {
    const notes =
      'Electrical rough-in for a 2,400 sqft new construction home: install 18 recessed lights, 12 standard receptacles, 4 GFCI receptacles, 10 switches, two dedicated 20A circuits, one 200A main panel, and 150 LF conduit. Excludes light fixtures, fans, low-voltage, EV charging, utility work, and final trim.';
    const measurements = {
      mainPanelCount: 1,
      serviceAmperage: 200,
      dedicated20aCircuitCount: 2,
      standardReceptacleCount: 12,
      gfciReceptacleCount: 4,
      singlePoleSwitchCount: 10,
      recessedLightCount: 18,
      conduitLf: 150,
    };
    const keys = quickMeasurementRowsForInput(
      'electrical',
      'other',
      measurements,
      Object.keys(measurements) as Array<keyof typeof measurements>,
      { scopeNotes: notes }
    )
      .flat()
      .map(field => field.key);

    expect(keys).toEqual(
      expect.arrayContaining([
        'mainPanelCount',
        'serviceAmperage',
        'dedicated20aCircuitCount',
        'standardReceptacleCount',
        'gfciReceptacleCount',
        'singlePoleSwitchCount',
        'recessedLightCount',
        'conduitLf',
      ])
    );
    expect(keys).not.toContain('floorAreaSqft');
  });
});
