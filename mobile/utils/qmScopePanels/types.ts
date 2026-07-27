import type { ScopeChecklistItem } from '@/utils/estimateAiDraft';
import type { WetAreaStepperCounts } from '@/utils/planBathRooms';

/** Single-room photo/notes jobs — not whole-home plan import. */
export type QmPhotoNotesContext = {
  templateKey?: string | null;
  wholeHomeLayout?: boolean;
};

export type QmPanelHydrateContext = {
  templateKey?: string | null;
  wholeHomeLayout?: boolean;
  notes?: string | null;
  hasSitePhotos?: boolean;
  measurements: Record<string, unknown>;
  checklistItems: ScopeChecklistItem[];
  wetAreaInstallChoiceId?: string | null;
  showerTileIncluded?: boolean;
  showerFloorTileIncluded?: boolean;
  glassDoorIncluded?: boolean;
};

export type QmPanelDefinition = {
  id: string;
  templateKeys: string[];
  embeddedScopeItemIds: string[];
  isActive: (ctx: QmPhotoNotesContext) => boolean;
  hydrateMeasurements: (ctx: QmPanelHydrateContext) => Record<string, unknown>;
  syncScopeItems: (
    items: ScopeChecklistItem[],
    measurements: Record<string, unknown>
  ) => ScopeChecklistItem[];
};

/** Bathroom wet area uses legacy stepper shape — re-export for typing at call sites. */
export type { WetAreaStepperCounts };
