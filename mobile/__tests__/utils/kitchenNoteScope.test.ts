import { filterDedicatedKitchenConfirmItems } from '../../utils/kitchenNoteScope';

const GUT =
  'Kitchen remodel. Demo existing cabinets, countertops, backsplash, and vinyl floor. Install 22 LF new cabinets, quartz counters 48 sqft, tile backsplash 32 sqft, and LVP flooring 160 sqft. Baseboards 40 LF. Include sink and dishwasher hookup. No prices yet.';

describe('filterDedicatedKitchenConfirmItems', () => {
  it('keeps named kitchen lines and drops questionnaire leftovers', () => {
    const filtered = filterDedicatedKitchenConfirmItems(
      [
        { id: 'cabinet_demo', label: 'Cabinet demo / removal' },
        { id: 'floor_demo', label: 'Flooring removal / demolition' },
        { id: 'demo', label: 'Shower tile demo / tear-out' },
        { id: 'cabinets', label: '22 LF cabinets' },
        { id: 'backsplash', label: 'Backsplash tile install' },
        { id: 'tile', label: 'Tile' },
        { id: 'flooring', label: 'Kitchen flooring install' },
        { id: 'flooring_lvp', label: 'LVP installation' },
        { id: 'trim', label: 'Trim & baseboard' },
        { id: 'baseboard_install', label: 'Baseboard trim & finish' },
        { id: 'sink_faucet', label: 'Sink & faucet' },
        { id: 'garbage_disposal', label: 'Garbage disposal' },
        { id: 'electrical', label: 'Electrical outlets, GFCI & circuits' },
        { id: 'lighting', label: 'Lighting fixtures & install' },
        { id: 'drywall', label: 'Drywall / patching' },
        { id: 'paint', label: 'Interior painting' },
        { id: 'plumbing', label: 'Plumbing connections' },
        { id: 'interior_finishes', label: 'Interior Finishes' },
        { id: 'labor', label: 'Framing labor' },
        { id: 'permits', label: 'Permits & inspections' },
        { id: 'cleanup', label: 'Cleanup, haul-off & disposal' },
      ],
      { notes: GUT, templateKey: 'kitchen', projectType: 'kitchen' }
    );

    expect(filtered.map(item => item.id)).toEqual([
      'cabinet_demo',
      'floor_demo',
      'cabinets',
      'backsplash',
      'flooring',
      'trim',
      'plumbing',
    ]);
  });

  it('drops install-only kitchen demo cards when the note never says demo', () => {
    const notes =
      'install 24 LF cabinets lump sum $12,000, quartz counters 55 sqft allowance $4,400, backsplash 42 sqft material $8 per sqft and labor $14 per sqft. New LVP flooring 180 sqft material $4.25 per sqft and labor $3.75 per sqft. Baseboard 48 LF at $7 per LF.';
    const filtered = filterDedicatedKitchenConfirmItems(
      [
        { id: 'cabinets', label: 'Cabinets' },
        { id: 'cabinet_demo', label: 'Cabinet demo / removal' },
        { id: 'countertops', label: 'Countertops' },
        { id: 'countertop_demo', label: 'Countertop demo / removal' },
        { id: 'backsplash', label: 'Backsplash' },
        { id: 'backsplash_demo', label: 'Backsplash demo / removal' },
        { id: 'flooring', label: 'Kitchen flooring install' },
        { id: 'floor_demo', label: 'Kitchen flooring demo / removal' },
        { id: 'trim', label: 'Trim & baseboard' },
        { id: 'labor', label: 'Framing labor' },
      ],
      { templateKey: 'kitchen', projectType: 'kitchen', notes }
    );
    expect(filtered.map(item => item.id)).toEqual([
      'cabinets',
      'countertops',
      'backsplash',
      'flooring',
      'trim',
    ]);
  });

  it('leaves a bare kitchen remodel on the full questionnaire', () => {
    const items = [
      { id: 'drywall', label: 'Drywall / patching' },
      { id: 'paint', label: 'Interior painting' },
    ];
    expect(
      filterDedicatedKitchenConfirmItems(items, {
        notes: 'Kitchen remodel',
        templateKey: 'kitchen',
      })
    ).toEqual(items);
  });

  it('keeps a new sink when the note asks for one', () => {
    const filtered = filterDedicatedKitchenConfirmItems(
      [
        { id: 'sink_faucet', label: 'Sink & faucet' },
        { id: 'cabinets', label: 'Cabinets' },
      ],
      {
        notes: 'Kitchen remodel. Install 12 LF cabinets and a new sink and faucet.',
        templateKey: 'kitchen',
      }
    );
    expect(filtered.map(item => item.id)).toEqual(['sink_faucet', 'cabinets']);
  });
});
