import {
  checklistChoiceFromWetAreaFinish,
  countBathPlanRooms,
  isBathPlanRoom,
  listBathPlanRooms,
  resolveBathCount,
  resolveEffectiveWetAreaFinish,
  resolveShowerDoorCount,
  sumBathFloorSqft,
  wetAreaFinishFromChecklistChoice,
} from '@/utils/planBathRooms';
import type { PlanRoomMeasurement } from '@/utils/estimateAiDraft';

const rooms: PlanRoomMeasurement[] = [
  { name: 'Primary Suite', areaSqft: 254, sourceType: 'plan_explicit' },
  { name: 'Primary Bath', lengthFt: 10, widthFt: 9.5, areaSqft: 95, sourceType: 'plan_explicit' },
  { name: 'Bath 2', areaSqft: 42, sourceType: 'plan_explicit' },
  { name: 'Powder', areaSqft: 18, sourceType: 'plan_explicit' },
  { name: 'Kitchen', areaSqft: 194, sourceType: 'plan_explicit' },
];

describe('planBathRooms', () => {
  test('detects bath / powder labels and excludes Primary Suite bedroom', () => {
    expect(isBathPlanRoom('Primary Bath')).toBe(true);
    expect(isBathPlanRoom('Powder')).toBe(true);
    expect(isBathPlanRoom('ensuite')).toBe(true);
    expect(isBathPlanRoom('Primary Suite')).toBe(false);
    expect(isBathPlanRoom('Kitchen')).toBe(false);
    expect(listBathPlanRooms(rooms).map((r) => r.name)).toEqual([
      'Primary Bath',
      'Bath 2',
      'Powder',
    ]);
    expect(countBathPlanRooms(rooms)).toBe(3);
  });

  test('sums bath floor SF only from labeled baths with area', () => {
    expect(sumBathFloorSqft(rooms)).toBe(155);
    expect(sumBathFloorSqft([{ name: 'Bath', sourceType: 'plan_explicit' }])).toBeNull();
    expect(sumBathFloorSqft([])).toBeNull();
  });

  test('resolveBathCount prefers explicit tile count, then floor SF — not labeled room count', () => {
    expect(resolveBathCount({ planRooms: rooms })).toBeNull();
    expect(resolveBathCount({ bathCount: 2, planRooms: rooms })).toBe(2);
    expect(resolveBathCount({ bathCount: 2, bathroomFloorSqft: 90 })).toBe(2);
    expect(resolveBathCount({ bathroomFloorSqft: 90 })).toBe(1);
    expect(resolveBathCount({})).toBeNull();
  });

  test('resolveEffectiveWetAreaFinish keeps tile when prefab/tub counts are also set', () => {
    expect(
      resolveEffectiveWetAreaFinish({ bathCount: 2, prefabBathCount: 1, tubBathCount: 1 })
    ).toBe('tile');
    expect(resolveEffectiveWetAreaFinish({ prefabBathCount: 1 })).toBe('prefab');
    expect(resolveEffectiveWetAreaFinish({ tubBathCount: 1 })).toBe('tub');
    expect(resolveEffectiveWetAreaFinish({ wetAreaFinish: 'tile' })).toBe('tile');
    expect(resolveEffectiveWetAreaFinish({})).toBeNull();
  });

  test('resolveShowerDoorCount prefers explicit doors, else tile + prefab', () => {
    expect(resolveShowerDoorCount({ showerDoorCount: 3, bathCount: 2, prefabBathCount: 1 })).toBe(3);
    expect(resolveShowerDoorCount({ bathCount: 2, prefabBathCount: 1 })).toBe(3);
    expect(resolveShowerDoorCount({ bathCount: 2 })).toBe(2);
    expect(resolveShowerDoorCount({ prefabBathCount: 1 })).toBe(1);
    expect(resolveShowerDoorCount({ tubBathCount: 2 } as any)).toBeNull();
    expect(resolveShowerDoorCount({})).toBeNull();
  });

  test('maps checklist wet_area_install choice ↔ QM finish', () => {
    expect(wetAreaFinishFromChecklistChoice('tile_pan')).toBe('tile');
    expect(wetAreaFinishFromChecklistChoice('tub')).toBe('tub');
    expect(wetAreaFinishFromChecklistChoice('prefab')).toBe('prefab');
    expect(wetAreaFinishFromChecklistChoice('staying')).toBeNull();
    expect(checklistChoiceFromWetAreaFinish('tile')).toBe('tile_pan');
    expect(checklistChoiceFromWetAreaFinish('tub')).toBe('tub');
    expect(checklistChoiceFromWetAreaFinish('prefab')).toBe('prefab');
    expect(checklistChoiceFromWetAreaFinish(null)).toBeNull();
  });
});
