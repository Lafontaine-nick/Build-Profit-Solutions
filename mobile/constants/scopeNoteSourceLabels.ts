/** Card badge: scope item detected in pasted job notes (work mentioned, not necessarily priced). */
export const SCOPE_MENTIONED_IN_NOTES_LABEL = 'Mentioned in notes';

/** Card badge: scope item inferred from site photos on Step 1. */
export const SCOPE_DETECTED_FROM_PHOTOS_LABEL = 'Detected from photos';

/** Pill/label: a specific qty or $ value parsed from job notes. */
export const SCOPE_PARSED_FROM_NOTES_LABEL = 'Parsed from notes';

export const SCOPE_MATERIAL_PARSED_FROM_NOTES_LABEL = 'Material parsed from notes';
export const SCOPE_LABOR_PARSED_FROM_NOTES_LABEL = 'Labor parsed from notes';

/** Summary line when multiple scope cards tie back to job notes (mentions + parsed values). */
export function scopeLinkedToNotesSummary(count: number): string {
  return `${count} linked to job notes`;
}
