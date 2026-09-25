import { applyFinishScheduleToChecklistItems } from '@/utils/finishScheduleScope';
import { buildPlanScopeRecords } from '@/utils/planScopeRecords';

const unsure = (id: string) => ({
  id,
  state: 'unsure' as const,
  helperText: 'Confirm this finish.',
});

describe('finish schedule scope', () => {
  test('selects only the finishes the schedule names', () => {
    const next = applyFinishScheduleToChecklistItems(
      [
        unsure('floor_tile'),
        unsure('shower_tile'),
        unsure('shower_floor_tile'),
        unsure('glass_door'),
      ],
      [
        {
          room: 'Primary Bath',
          floor: 'tile',
          wall: 'paint',
          sheet: 'A-8',
          page: 9,
        },
        {
          room: 'Shower',
          floor: 'tile',
          wall: 'tile',
          glassDoor: true,
          sheet: 'A-8',
          page: 9,
        },
        {
          room: 'Great Room',
          floor: 'carpet',
          wall: 'paint',
        },
      ]
    );
    expect(next.find(item => item.id === 'floor_tile')).toMatchObject({
      state: 'included',
      helperText: expect.stringMatching(/Tile · Primary Bath · finish schedule/),
    });
    expect(next.find(item => item.id === 'shower_tile')).toMatchObject({
      state: 'included',
    });
    expect(next.find(item => item.id === 'shower_floor_tile')).toMatchObject({
      state: 'included',
    });
    expect(next.find(item => item.id === 'glass_door')).toMatchObject({
      state: 'included',
    });
    expect(next.find(item => item.id === 'shower_tile')?.helperText).toMatch(
      /Wall area is not measured/
    );
  });

  test('leaves wet-area cards unsure when the plan has no finish schedule', () => {
    const next = applyFinishScheduleToChecklistItems(
      [unsure('floor_tile'), unsure('shower_tile'), unsure('glass_door')],
      []
    );
    expect(next.map(item => item.state)).toEqual(['unsure', 'unsure', 'unsure']);
  });

  test('does not turn a bath floor into shower tile when the walls are paint', () => {
    const next = applyFinishScheduleToChecklistItems(
      [unsure('floor_tile'), unsure('shower_tile'), unsure('shower_floor_tile')],
      [{ room: 'Primary Bath', floor: 'tile', wall: 'paint' }]
    );
    expect(next.find(item => item.id === 'floor_tile')?.state).toBe('included');
    expect(next.find(item => item.id === 'shower_tile')?.state).toBe('unsure');
    expect(next.find(item => item.id === 'shower_floor_tile')?.state).toBe('unsure');
  });

  test('records the schedule without a measured area', () => {
    const records = buildPlanScopeRecords({
      finishSchedule: [
        {
          room: 'Primary Bath',
          floor: 'tile',
          wall: 'paint',
          sheet: 'A-8',
          page: 9,
        },
      ],
    });
    const schedule = records.find(record => record.id === 'finish-schedule');
    expect(schedule?.findings[0]).toMatchObject({
      label: 'Primary Bath · floor Tile, walls Paint',
      status: 'read_from_plan',
      quantity: null,
      sheet: 'A-8',
    });
  });
});
