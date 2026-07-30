import type { ScopeChecklistItem } from '@/utils/estimateAiDraft';
import { isSplitTileWetAreaCounts } from '@/utils/planBathRooms';
import { hydrateWetAreaStepperCounts } from '@/utils/planBathRooms';
import {
  inferExistingWetAreaFromNotes,
  mergeDemoCountsWithOverrides,
  readWetAreaDemoCounts,
  readWetAreaExistingCounts,
  reconcileExistingWetAreaCounts,
  resolveDemoWetAreaFromIntent,
  resolveEffectiveExistingWetArea,
  type WetAreaDemoOverrideKey,
} from '@/utils/wetAreaExistingDemo';
import {
  syncWetAreaDemoScopeItems,
  syncWetAreaScopeFromSteppers,
  syncWetAreaTileScopeItems,
  syncWaterproofingFromTileScopeItems,
  syncBathroomFloorTileScopeItems,
} from '@/utils/estimateScopeChecklistUi';
import type { QmPanelDefinition, QmPanelHydrateContext } from '@/utils/qmScopePanels/types';

export const BATHROOM_WET_AREA_EMBEDDED_IDS = new Set([
  'wet_area_install',
  'tub_install',
  'prefab_shower_pan',
  'prefab_shower_enclosure',
  'tub_demo',
  'shower_floor_demo',
]);

function hydrateBathroom(ctx: QmPanelHydrateContext): Record<string, unknown> {
  if (
    !isSplitTileWetAreaCounts({
      templateKey: ctx.templateKey ?? 'bathroom',
      wholeHomeLayout: ctx.wholeHomeLayout ?? false,
    })
  ) {
    return ctx.measurements;
  }

  const wet = ctx.checklistItems.find((r) => r.id === 'wet_area_install');
  const showerTile = ctx.checklistItems.find((r) => r.id === 'shower_tile');
  const showerFloorTile = ctx.checklistItems.find((r) => r.id === 'shower_floor_tile');
  const tubDemo = ctx.checklistItems.find((r) => r.id === 'tub_demo');
  const showerFloorDemo = ctx.checklistItems.find((r) => r.id === 'shower_floor_demo');
  const floorDemo = ctx.checklistItems.find((r) => r.id === 'floor_demo');
  const floorTile = ctx.checklistItems.find((r) => r.id === 'floor_tile');
  const glassDoor = ctx.checklistItems.find((r) => r.id === 'glass_door');

  const steppers = hydrateWetAreaStepperCounts({
    measurements: ctx.measurements,
    wetAreaInstallChoiceId: wet?.choiceId ?? ctx.wetAreaInstallChoiceId,
    showerTileIncluded: showerTile ? showerTile.state === 'included' : ctx.showerTileIncluded,
    showerFloorTileIncluded: showerFloorTile?.state === 'included',
    bathFloorTileIncluded: floorTile?.state === 'included',
    glassDoorIncluded: glassDoor ? glassDoor.state === 'included' : ctx.glassDoorIncluded,
    notes: ctx.notes,
    templateKey: 'bathroom',
  });

  const effectiveExisting = ctx.hasSitePhotos
    ? resolveEffectiveExistingWetArea({
        measurements: ctx.measurements,
        notes: ctx.notes,
        hasSitePhotos: true,
        tubDemoIncluded: tubDemo?.state === 'included',
        showerFloorDemoIncluded: showerFloorDemo?.state === 'included',
        floorDemoIncluded: floorDemo?.state === 'included',
        glassDoorIncluded: glassDoor?.state === 'included',
      })
    : (() => {
        const saved = readWetAreaExistingCounts(ctx.measurements);
        const hasUserSaved = Object.values(saved).some((v) => v != null);
        if (hasUserSaved) return reconcileExistingWetAreaCounts(saved);
        return reconcileExistingWetAreaCounts(inferExistingWetAreaFromNotes(ctx.notes));
      })();

  const savedDemo = readWetAreaDemoCounts(ctx.measurements);
  const autoDemo = resolveDemoWetAreaFromIntent({
    notes: ctx.notes,
    existing: effectiveExisting,
    install: steppers,
    keepingExisting: wet?.choiceId === 'staying',
    reuseExistingShowerDoor: Boolean(ctx.measurements.reuseExistingShowerDoor),
    tubDemoIncluded: tubDemo?.state === 'included',
    showerFloorDemoIncluded: showerFloorDemo?.state === 'included',
    floorDemoIncluded: floorDemo?.state === 'included',
    floorTileIncluded: floorTile?.state === 'included',
    bathroomFloorSqft: ctx.measurements.bathroomFloorSqft,
  });
  // Re-infer each open so wet-area-only notes clear false-positive bath floor demo.
  // Manual stepper edits are preserved via demoWetAreaManualOverrides.
  const demoOverrides = (ctx.measurements.demoWetAreaManualOverrides || {}) as Partial<
    Record<WetAreaDemoOverrideKey, boolean>
  >;
  const demo = mergeDemoCountsWithOverrides({
    auto: autoDemo,
    stored: savedDemo,
    overrides: demoOverrides,
  });

  return {
    ...ctx.measurements,
    ...steppers,
    ...effectiveExisting,
    ...demo,
  };
}

function syncBathroom(items: ScopeChecklistItem[], m: Record<string, unknown>): ScopeChecklistItem[] {
  let next = syncWetAreaScopeFromSteppers(items, {
    counts: {
      bathCount: m.bathCount as number | null,
      tilePanBathCount: m.tilePanBathCount as number | null,
      prefabBathCount: m.prefabBathCount as number | null,
      prefabEnclosureBathCount: m.prefabEnclosureBathCount as number | null,
      tubBathCount: m.tubBathCount as number | null,
      bathFloorTileCount: m.bathFloorTileCount as number | null,
      showerDoorCount: m.showerDoorCount as number | null,
    },
    keepingExisting: false,
    showerWallTileSqft: m.showerWallTileSqft,
    showerFloorTileSqft: m.showerFloorTileSqft,
  });
  next = syncWetAreaTileScopeItems(next, {
    bathCount: m.bathCount as number | null,
    tilePanBathCount: m.tilePanBathCount as number | null,
    showerWallTileSqft: m.showerWallTileSqft,
    showerFloorTileSqft: m.showerFloorTileSqft,
  });
  next = syncBathroomFloorTileScopeItems(next, {
    bathroomFloorSqft: m.bathroomFloorSqft as string | number | null | undefined,
    bathFloorTileCount: m.bathFloorTileCount as number | null | undefined,
  });
  next = syncWetAreaDemoScopeItems(next, {
    demo: readWetAreaDemoCounts(m),
    reuseExistingShowerDoor: Boolean(m.reuseExistingShowerDoor),
    installShowerDoorCount: m.showerDoorCount as number | null,
  });
  return syncWaterproofingFromTileScopeItems(next);
}

export const bathroomWetAreaQmPanel: QmPanelDefinition = {
  id: 'bathroom_wet_area',
  templateKeys: ['bathroom'],
  embeddedScopeItemIds: [...BATHROOM_WET_AREA_EMBEDDED_IDS],
  isActive: (ctx) =>
    isSplitTileWetAreaCounts({ templateKey: ctx.templateKey, wholeHomeLayout: ctx.wholeHomeLayout }),
  hydrateMeasurements: hydrateBathroom,
  syncScopeItems: syncBathroom,
};
