import type { ScopeChecklistItem } from '@/utils/estimateAiDraft';
import { isSplitTileWetAreaCounts } from '@/utils/planBathRooms';

export type PdfMeasurementLine = {
  label: string;
  quantity: string;
  sectionHeader?: boolean;
  note?: boolean;
};

export type PdfMeasurementCard = {
  title: string;
  lines: PdfMeasurementLine[];
};

function positiveCount(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

function positiveSqft(value: unknown): number | null {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function formatQty(value: number, unit: string): string {
  const formatted = value.toLocaleString('en-US', { maximumFractionDigits: 1 });
  return `${formatted} ${unit}`;
}

function isKeepingExistingWetArea(
  checklistItems?: ScopeChecklistItem[] | null
): boolean {
  const row = checklistItems?.find((item) => item.id === 'wet_area_install');
  return row?.choiceId === 'staying';
}

function hasWetAreaInstallMeasurements(measurements: Record<string, unknown>): boolean {
  return (
    positiveCount(measurements.tilePanBathCount) != null ||
    positiveCount(measurements.prefabBathCount) != null ||
    positiveCount(measurements.prefabEnclosureBathCount) != null ||
    positiveCount(measurements.tubBathCount) != null ||
    positiveSqft(measurements.showerWallTileSqft) != null ||
    positiveSqft(measurements.bathroomFloorSqft) != null ||
    positiveCount(measurements.showerDoorCount) != null
  );
}

/** Wet area install Quick Measurements → contractor export PDF card. */
export function buildWetAreaInstallPdfMeasurementCard(params: {
  measurements?: Record<string, unknown> | null;
  checklistItems?: ScopeChecklistItem[] | null;
  templateKey?: string | null;
  wholeHomeLayout?: boolean;
}): PdfMeasurementCard | null {
  const measurements = params.measurements || {};
  const templateKey = String(params.templateKey || 'bathroom').toLowerCase();
  if (
    !isSplitTileWetAreaCounts({
      templateKey,
      wholeHomeLayout: params.wholeHomeLayout ?? false,
    })
  ) {
    return null;
  }
  if (!hasWetAreaInstallMeasurements(measurements)) {
    return null;
  }

  const lines: PdfMeasurementLine[] = [];
  const keepingExisting = isKeepingExistingWetArea(params.checklistItems);

  if (keepingExisting) {
    lines.push({
      label:
        'Keeping existing tub/shower — pan, tub & enclosure counts skipped.',
      quantity: '',
      note: true,
    });
  }

  const fixtureLines: PdfMeasurementLine[] = [];
  const addCount = (label: string, raw: unknown) => {
    const n = positiveCount(raw);
    if (n == null) return;
    fixtureLines.push({ label, quantity: formatQty(n, 'each') });
  };

  if (!keepingExisting) {
    addCount('Mud pan (tile shower)', measurements.tilePanBathCount);
    addCount('Prefab shower pan', measurements.prefabBathCount);
    addCount('Prefab shower enclosure', measurements.prefabEnclosureBathCount);
    addCount('Tub install', measurements.tubBathCount);
    if (fixtureLines.length) {
      lines.push({
        label: 'NEW PAN / TUB / ENCLOSURE',
        quantity: '',
        sectionHeader: true,
      });
      lines.push(...fixtureLines);
    }
  }

  const tileLines: PdfMeasurementLine[] = [];
  const sqft = positiveSqft(measurements.showerWallTileSqft);
  if (sqft != null) {
    tileLines.push({
      label: 'Shower wall tile',
      quantity: formatQty(sqft, 'sqft'),
    });
  }
  if (tileLines.length) {
    lines.push({ label: 'SHOWER WALL TILE', quantity: '', sectionHeader: true });
    lines.push(...tileLines);
  }

  const floorLines: PdfMeasurementLine[] = [];
  const floorSqft = positiveSqft(measurements.bathroomFloorSqft);
  if (floorSqft != null) {
    floorLines.push({
      label: 'Bath floor tile',
      quantity: formatQty(floorSqft, 'sqft'),
    });
  }
  const doors = positiveCount(measurements.showerDoorCount);
  if (doors != null) {
    floorLines.push({
      label: 'Shower doors',
      quantity: formatQty(doors, 'each'),
    });
  }
  if (floorLines.length) {
    lines.push({ label: 'BATH FLOOR & DOORS', quantity: '', sectionHeader: true });
    lines.push(...floorLines);
  }

  if (!lines.length) return null;

  return {
    title: 'Wet area install',
    lines,
  };
}
