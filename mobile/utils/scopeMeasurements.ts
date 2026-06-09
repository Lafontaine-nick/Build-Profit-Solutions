import type { EstimateAiDraft } from '@/utils/estimateAiDraft';

export type ScopeMeasurements = {
  sqft?: number | null;
  lf?: number | null;
};

export type ScopeMeasurementsInput = {
  sqft: string;
  lf: string;
};

export function parseScopeMeasurementInput(raw: string): number | null {
  const cleaned = String(raw || '').replace(/,/g, '').trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function scopeMeasurementsFromInput(input: ScopeMeasurementsInput): ScopeMeasurements {
  return {
    sqft: parseScopeMeasurementInput(input.sqft),
    lf: parseScopeMeasurementInput(input.lf),
  };
}

/** Restore measurements only if user already entered them (e.g. back from review). */
export function initialScopeMeasurementInput(draft: EstimateAiDraft | null): ScopeMeasurementsInput {
  const saved = draft?.scopeMeasurements;
  if (!saved?.sqft && !saved?.lf) {
    return { sqft: '', lf: '' };
  }
  return {
    sqft: saved.sqft ? String(saved.sqft) : '',
    lf: saved.lf ? String(saved.lf) : '',
  };
}
