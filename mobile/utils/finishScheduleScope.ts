/**
 * Finish-schedule rows are named finishes from a printed sheet.
 * They select wet-area cards. They do not create wall or floor area.
 */

export type FinishScheduleRow = {
  room: string;
  floor?: string | null;
  wall?: string | null;
  base?: string | null;
  ceiling?: string | null;
  glassDoor?: boolean;
  sheet?: string | null;
  page?: number | null;
  sourceText?: string | null;
};

export type FinishScheduleCardId =
  | 'floor_tile'
  | 'shower_tile'
  | 'shower_floor_tile'
  | 'glass_door';

const FINISH_LABELS: Record<string, string> = {
  tile: 'Tile',
  lvp: 'LVP',
  vinyl: 'Vinyl',
  carpet: 'Carpet',
  hardwood: 'Hardwood',
  engineered_hardwood: 'Engineered hardwood',
  laminate: 'Laminate',
  quartz: 'Quartz',
  granite: 'Granite',
  paint: 'Paint',
};

type ChecklistItem = {
  id: string;
  state?: string | null;
  helperText?: string | null;
  noteBacked?: boolean;
};

function finishLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return FINISH_LABELS[value] || null;
}

function mentionsBath(room: string): boolean {
  return /\b(?:bath(?:room)?s?|powder)\b/i.test(room);
}

function mentionsShower(row: FinishScheduleRow): boolean {
  return /\bshower\b/i.test(`${row.room} ${row.sourceText || ''}`);
}

function joinRooms(rooms: string[]): string {
  return [...new Set(rooms.map(room => room.trim()).filter(Boolean))].join(', ');
}

export function finishScheduleCardUpdates(
  rows: FinishScheduleRow[] | null | undefined
): Array<{ itemId: FinishScheduleCardId; helperText: string }> {
  const floorRooms: string[] = [];
  const showerWallRooms: string[] = [];
  const showerFloorRooms: string[] = [];
  const glassRooms: string[] = [];

  for (const row of rows || []) {
    const room = String(row.room || '').trim();
    if (!room) continue;
    const shower = mentionsShower(row);
    const bath = mentionsBath(room);
    if (row.floor === 'tile' && (bath || shower)) {
      if (bath) floorRooms.push(room);
      if (shower) showerFloorRooms.push(room);
    }
    if (row.wall === 'tile' && shower) showerWallRooms.push(room);
    if (row.glassDoor && (bath || shower)) glassRooms.push(room);
  }

  const updates: Array<{ itemId: FinishScheduleCardId; helperText: string }> = [];
  if (floorRooms.length) {
    updates.push({
      itemId: 'floor_tile',
      helperText: `Tile · ${joinRooms(floorRooms)} · finish schedule. Floor area is not on the sheet.`,
    });
  }
  if (showerWallRooms.length) {
    updates.push({
      itemId: 'shower_tile',
      helperText: `Tile walls · ${joinRooms(showerWallRooms)} · finish schedule. Wall area is not measured from the drawing.`,
    });
  }
  if (showerFloorRooms.length) {
    updates.push({
      itemId: 'shower_floor_tile',
      helperText: `Tile · ${joinRooms(showerFloorRooms)} · finish schedule. Pan area is not on the sheet.`,
    });
  }
  if (glassRooms.length) {
    updates.push({
      itemId: 'glass_door',
      helperText: `Glass enclosure · ${joinRooms(glassRooms)} · finish schedule.`,
    });
  }
  return updates;
}

export function applyFinishScheduleToChecklistItems<T extends ChecklistItem>(
  items: T[],
  rows: FinishScheduleRow[] | null | undefined
): T[] {
  const updates = new Map(
    finishScheduleCardUpdates(rows).map(update => [update.itemId, update.helperText])
  );
  if (!updates.size) return items;
  return items.map(item => {
    const helperText = updates.get(item.id as FinishScheduleCardId);
    if (!helperText || item.state !== 'unsure') return item;
    return {
      ...item,
      state: 'included',
      helperText,
      noteBacked: true,
    };
  });
}

export function finishLabelForSchedule(value: string | null | undefined): string | null {
  return finishLabel(value);
}
