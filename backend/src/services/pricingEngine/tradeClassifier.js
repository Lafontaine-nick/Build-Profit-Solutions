/**
 * Infer trade from scope package + notes (shared by pricing engine & suggest-missing).
 */

function classifyTradeForPricing(name, scope = '', notes = '', projectType = '') {
  const n = String(name || '').toLowerCase();
  const s = String(scope || '').toLowerCase();
  const blob = `${name} ${scope} ${notes} ${projectType}`.toLowerCase();

  // Package name/scope wins over other clauses in combined notes (e.g. tile demo + baseboard job).
  if (/baseboard|trim/.test(n) || /\b(baseboard|trim|crown|moulding|molding|casing)\b/.test(s)) {
    return 'baseboard';
  }
  if (/\btile\b/.test(n) && /\b(install|installation)\b/.test(n) && !/\b(demo|removal)\b/.test(n)) {
    return 'flooring';
  }
  if (/\b(demo|removal|demolition|haul)\b/.test(n) || /\b(demo|removal|demolition)\b/.test(s)) {
    return 'demo';
  }
  if (/laminate|flooring|lvp|vinyl|carpet/.test(n)) return 'flooring';
  if (/kitchen|cabinet|counter/.test(n)) return 'kitchen';
  if (/bath|shower|vanity/.test(n)) return 'bathroom';
  if (/plumb/.test(n)) return 'plumbing';
  if (/electric/.test(n)) return 'electrical';
  if (/roof/.test(n)) return 'roofing';
  if (/paint/.test(n)) return 'painting';
  if (/concrete|slab|deck|patio/.test(n)) return 'concrete';

  if (/\b(demo|demolition|removal|haul|tear[\s-]?out|rip[\s-]?out)\b/.test(`${n} ${s}`)) {
    return 'demo';
  }

  if (
    /\b(baseboard|baseboards|trim|crown|moulding|molding|casing)\b/.test(blob) &&
    !/\b(tile|laminate|lvp|vinyl)\s+install/i.test(blob)
  ) {
    return 'baseboard';
  }

  if (/\b(paint|painting|primer|repaint)\b/.test(blob) && !/\b(floor|tile|laminate)\b/.test(blob)) {
    return 'painting';
  }
  if (/\b(plumb|faucet|drain|valve|toilet|sink|pipe|water heater)\b/.test(blob)) {
    return /\b(service|repair|troubleshoot)\b/.test(blob) ? 'plumbing_service' : 'plumbing';
  }
  if (/\b(electric|wiring|outlet|panel|light|breaker)\b/.test(blob)) return 'electrical';
  if (/\b(concrete|slab|pour|patio|deck)\b/.test(blob)) return 'concrete';
  if (/\b(roof|shingle|flashing|gutter)\b/.test(blob)) return 'roofing';
  if (/\b(kitchen|cabinet|countertop|counter|backsplash)\b/.test(blob)) return 'kitchen';
  if (/\b(bath|bathroom|shower|vanity|tub)\b/.test(blob)) return 'bathroom';
  if (/laminate|flooring|lvp|vinyl|carpet|tile/.test(n) || /\b(floor|lvp|laminate|tile install)\b/.test(blob)) {
    return 'flooring';
  }

  if (projectType === 'flooring' || projectType === 'floor') return 'flooring';
  if (projectType === 'kitchen') return 'kitchen';
  if (projectType === 'bathroom' || projectType === 'bath') return 'bathroom';
  if (projectType === 'painting') return 'painting';
  if (projectType === 'roofing') return 'roofing';
  if (projectType === 'plumbing') return 'plumbing';
  if (projectType === 'electrical') return 'electrical';

  return 'other';
}

module.exports = { classifyTradeForPricing };
