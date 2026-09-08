function isBathroomContext(ctx) {
  const templateKey = String(ctx.templateKey || '').toLowerCase();
  const projectType = String(ctx.projectType || '').toLowerCase();
  return templateKey === 'bathroom' || projectType === 'bathroom';
}

function notesImplyBathroomFullRoomPaint(notes) {
  const blob = String(notes || '').toLowerCase();
  if (!/\bpaint(?:ing)?\b/.test(blob)) return false;
  if (
    /\bpatch\b|\btouch[\s-]?up\b|\bspot\s+prime\b|\blocalized\b|\bdrywall\s+repair\b/.test(
      blob
    )
  ) {
    return false;
  }
  return true;
}

function parseVanityCabinetLfFromNotes(notes) {
  const text = String(notes || '');
  const match =
    text.match(
      /\b(\d{2,3})\s*(?:"|''|inch(?:es)?|in\.?)\s*(?:(?:wide|double|single)\s+)?vanity\b/i
    ) ||
    text.match(/\b(\d{2,3})\s*(?:"|''|inch(?:es)?|in\.?)\s+\w+\s+vanity\b/i) ||
    text.match(/\bvanity\s*(\d{2,3})\s*(?:"|''|inch(?:es)?|in\.?)\b/i) ||
    text.match(/\b(\d{2,3})\s*[-\s]?inch\s+(?:double|single\s+)?vanity\b/i);
  if (!match) return null;
  const inches = Number(match[1]);
  if (!(inches >= 24 && inches <= 96)) return null;
  return Math.round((inches / 12) * 10) / 10;
}

function notesCustomerSuppliesBathroomFixtures(notes) {
  const text = String(notes || '').toLowerCase();
  return (
    /\b(?:customer|homeowner|owner|client)\s+supply(?:ing|s)?\b[^.;]{0,100}\b(?:vanity|toilet|fixtures?)\b/.test(
      text
    ) ||
    /\b(?:vanity|toilet)\s+fixtures?\b[^.;]{0,60}\b(?:customer|homeowner|owner|client)\s+supply/.test(
      text
    ) ||
    /\bfixtures?\s+(?:are\s+)?(?:customer|owner|homeowner)[\s-]supplied\b/.test(
      text
    ) ||
    (/\bwe\s+install\s+only\b/.test(text) &&
      /\b(?:customer|homeowner|owner|client)\s+supply/.test(text))
  );
}

function livingAreaLanguageInNotes(notes) {
  return /\bliving\s+area\b|\btotal\s+living\b|\bwhole[\s-]?(?:house|home)\b|\b\d[\d,]*\s*(?:sq\.?\s*ft|sqft).{0,40}\b(?:house|home)\b/i.test(
    notes
  );
}

function defaultRoomPaintSqft(parsed) {
  const floor = Number(String(parsed.bathroomFloorSqft ?? '').replace(/,/g, ''));
  if (Number.isFinite(floor) && floor > 0) return Math.round(floor * 3.2);
  const fromWall = Number(String(parsed.wallPaintSqft ?? '').replace(/,/g, ''));
  if (Number.isFinite(fromWall) && fromWall > 0) return Math.round(fromWall);
  return null;
}

function clearBathroomPaintMeasurementBleed(out, notes) {
  if (!notesImplyBathroomFullRoomPaint(notes)) return;
  const bathFloor = out.bathroomFloorSqft ?? null;
  const roomSqft = defaultRoomPaintSqft({ bathroomFloorSqft: bathFloor });

  if (bathFloor != null && out.ceilingPaintSqft === bathFloor) {
    delete out.ceilingPaintSqft;
  }
  if (
    bathFloor != null &&
    (out.combinedPaintableAreaSqft === bathFloor || out.paintAreaSqft === bathFloor)
  ) {
    delete out.combinedPaintableAreaSqft;
    delete out.paintAreaSqft;
    delete out.originalPaintAreaReferenceSqft;
    out.paintAreaNeedsConfirmation = false;
  }

  if (roomSqft == null || !(roomSqft > 0)) return;

  const wallPaint = out.wallPaintSqft ?? null;
  if (
    wallPaint == null ||
    wallPaint === bathFloor ||
    wallPaint === out.showerWallTileSqft ||
    (wallPaint < roomSqft * 0.9 && bathFloor != null)
  ) {
    out.wallPaintSqft = roomSqft;
  }
}

function applyBathroomPlanningMeasurements(parsed, notes, ctx = {}) {
  if (!isBathroomContext(ctx)) return parsed;
  const out = { ...parsed };
  const noteText = String(notes || '');

  if (out.floorAreaSqft != null && !livingAreaLanguageInNotes(noteText)) {
    if (
      (out.bathroomFloorSqft != null && out.floorAreaSqft === out.bathroomFloorSqft) ||
      out.floorAreaSqft <= 200
    ) {
      delete out.floorAreaSqft;
    }
  }

  if (
    out.wallPaintSqft != null &&
    out.showerWallTileSqft != null &&
    out.wallPaintSqft === out.showerWallTileSqft
  ) {
    delete out.wallPaintSqft;
  }

  if (notesImplyBathroomFullRoomPaint(noteText)) {
    if (
      out.wallPaintSqft != null &&
      out.bathroomFloorSqft != null &&
      out.wallPaintSqft === out.bathroomFloorSqft
    ) {
      delete out.wallPaintSqft;
    }
    clearBathroomPaintMeasurementBleed(out, noteText);
  }

  const vanityLf = parseVanityCabinetLfFromNotes(noteText);
  if (vanityLf != null && !(Number(out.cabinetLf) > 0)) {
    out.cabinetLf = vanityLf;
  }

  return out;
}

module.exports = {
  notesImplyBathroomFullRoomPaint,
  parseVanityCabinetLfFromNotes,
  notesCustomerSuppliesBathroomFixtures,
  applyBathroomPlanningMeasurements,
};
