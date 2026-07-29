import {
  inferWetAreaInstallSteppersFromIntent,
  mergeInferredWetAreaInstallSteppers,
  reconcileExclusiveShowerPanSteppers,
} from '../../utils/wetAreaInstallInference';

describe('wetAreaInstallInference', () => {
  test('tile walls + tile shower floor from explicit notes', () => {
    const inferred = inferWetAreaInstallSteppersFromIntent({
      notes: 'Demo shower and tile the walls and tile the shower floor.',
    });
    expect(inferred.bathCount).toBe(1);
    expect(inferred.tilePanBathCount).toBe(1);
    expect(inferred.prefabBathCount).toBeNull();
  });

  test('tub install only when notes say tub install', () => {
    const inferred = inferWetAreaInstallSteppersFromIntent({
      notes: 'Tub install with new fixtures.',
    });
    expect(inferred.tubBathCount).toBe(1);
    expect(inferred.bathCount).toBeNull();
  });

  test('prefab shower pan vs prefab enclosure', () => {
    expect(
      inferWetAreaInstallSteppersFromIntent({
        notes: 'Install prefab shower pan and waterproofing.',
      }).prefabBathCount
    ).toBe(1);
    expect(
      inferWetAreaInstallSteppersFromIntent({
        notes: 'Install prefab shower enclosure unit.',
      }).prefabEnclosureBathCount
    ).toBe(1);
  });

  test('checklist shower tile + floor tile fills both steppers', () => {
    const inferred = inferWetAreaInstallSteppersFromIntent({
      notes: '',
      showerTileIncluded: true,
      showerFloorTileIncluded: true,
    });
    expect(inferred.bathCount).toBe(1);
    expect(inferred.tilePanBathCount).toBe(1);
  });

  test('demo tub without install does not prefill tub install', () => {
    const inferred = inferWetAreaInstallSteppersFromIntent({
      notes: 'Remove existing tub for shower conversion.',
    });
    expect(inferred.tubBathCount).toBeNull();
  });

  test('keeping existing clears install inference', () => {
    const inferred = inferWetAreaInstallSteppersFromIntent({
      notes: 'Tile shower walls and keeping existing tub/shower.',
      wetAreaInstallChoiceId: 'staying',
    });
    expect(inferred.bathCount).toBeNull();
    expect(inferred.tilePanBathCount).toBeNull();
  });

  test('merge keeps user-entered counts over inference', () => {
    const merged = mergeInferredWetAreaInstallSteppers(
      { bathCount: 1, tilePanBathCount: null, prefabBathCount: null, prefabEnclosureBathCount: null, tubBathCount: null, showerDoorCount: null },
      inferWetAreaInstallSteppersFromIntent({ notes: 'Install prefab shower pan.' })
    );
    expect(merged.bathCount).toBe(1);
    expect(merged.prefabBathCount).toBe(1);
  });

  test('tile pan and prefab pan cannot both be inferred', () => {
    const inferred = inferWetAreaInstallSteppersFromIntent({
      notes: 'Tile shower floor and install prefab shower pan.',
      showerFloorTileIncluded: true,
    });
    expect(inferred.tilePanBathCount).toBe(1);
    expect(inferred.prefabBathCount).toBeNull();
  });

  test('demo prefab pan + tile shower pan installs tile pan only', () => {
    const inferred = inferWetAreaInstallSteppersFromIntent({
      notes:
        'Demo shower walls, demo prefab shower pan, and tile shower walls, and tile shower pan.',
    });
    expect(inferred.bathCount).toBe(1);
    expect(inferred.tilePanBathCount).toBe(1);
    expect(inferred.prefabBathCount).toBeNull();
  });

  test('reconcile clears prefab when both pans were saved', () => {
    const reconciled = reconcileExclusiveShowerPanSteppers({
      bathCount: 1,
      tilePanBathCount: 1,
      prefabBathCount: 1,
      prefabEnclosureBathCount: null,
      tubBathCount: null,
      showerDoorCount: null,
    });
    expect(reconciled.tilePanBathCount).toBe(1);
    expect(reconciled.prefabBathCount).toBeNull();
  });
});
