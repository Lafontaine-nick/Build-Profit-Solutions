/**
 * Infer trade from scope package + notes (shared by pricing engine & suggest-missing).
 */

const WATERPROOF_BACKER_RE =
  /\b(waterproof|backer\s+board|hardie|hardiebacker|cement\s+board|redgard|red\s+gard|hydro\s*ban|kerdi|membrane|goboard|wedi|densshield)\b/i;
const FULL_SHOWER_PACKAGE_RE =
  /\b(full\s+wet\s+area|complete\s+shower|tile\s+shower\s+package|shower\s+system|wet\s+area\s+package|full\s+shower\s+package)\b/i;
const SHOWER_TILE_INSTALL_RE =
  /\b(shower\s+(wall|floor)\s+tile|shower\s+tile\s+(install|installation)|tile\s+shower\s+(install|installation))\b/i;

function isShowerWaterproofingScope(name, scope = '') {
  const ns = `${name} ${scope}`.toLowerCase();
  if (FULL_SHOWER_PACKAGE_RE.test(ns)) return false;
  if (/\bwaterproofing\s*&\s*backer/i.test(ns)) return true;
  if (WATERPROOF_BACKER_RE.test(ns)) {
    if (
      /\b(shower\s+wall\s+tile|shower\s+floor\s+tile)\b/.test(ns) &&
      !/\b(waterproof|backer|membrane|redgard)\b/i.test(name)
    ) {
      return false;
    }
    if (/\b(niche|bench|curb)\b/.test(ns) && /\btile\b/.test(ns) && !/\bwaterproofing\b/.test(name)) {
      return false;
    }
    return true;
  }
  return false;
}

function isShowerFloorTileInstallScope(name, scope = '') {
  const ns = `${name} ${scope}`.toLowerCase();
  if (isShowerWaterproofingScope(name, scope)) return false;
  if (FULL_SHOWER_PACKAGE_RE.test(ns)) return false;
  return /\bshower\s+floor\s+tile\b|\btile\s+shower\s+floor\b/.test(ns);
}

function isShowerTileInstallScope(name, scope = '') {
  const ns = `${name} ${scope}`.toLowerCase();
  if (isShowerWaterproofingScope(name, scope)) return false;
  if (FULL_SHOWER_PACKAGE_RE.test(ns)) return false;
  if (isShowerFloorTileInstallScope(name, scope)) return false;
  if (SHOWER_TILE_INSTALL_RE.test(ns)) return true;
  if (/\bshower\b/.test(ns) && /\btile\b/.test(ns) && /\b(install|installation|setting|grout)\b/.test(ns)) {
    if (/\b(demo|removal|waterproof|backer|membrane|redgard)\b/.test(ns)) return false;
    return true;
  }
  return false;
}

function isShowerFullPackageScope(name, scope = '') {
  return FULL_SHOWER_PACKAGE_RE.test(`${name} ${scope}`.toLowerCase());
}

function classifyTradeForPricing(name, scope = '', notes = '', projectType = '') {
  const n = String(name || '').toLowerCase();
  const s = String(scope || '').toLowerCase();
  const blob = `${name} ${scope} ${notes} ${projectType}`.toLowerCase();

  if (isShowerFullPackageScope(name, scope)) {
    return 'shower_full_package';
  }
  if (isShowerWaterproofingScope(name, scope)) {
    return 'shower_waterproofing';
  }
  if (isShowerFloorTileInstallScope(name, scope)) {
    return 'shower_floor_tile';
  }
  if (isShowerTileInstallScope(name, scope)) {
    return 'shower_tile';
  }

  if (/\bshower\s+niche|\bniche\b/.test(n) && !/kitchen|counter/.test(n)) return 'bathroom_fixture';
  if (/\bshower\s+bench|\bcurb\b/.test(n) && !/demo|removal/.test(n)) return 'bathroom_fixture';
  if (/\bexhaust\s+fan|\bventilation\b/.test(n)) return 'bathroom_fixture';
  if (/\bmirror|\bbath\s+accessories/.test(n)) return 'bathroom_fixture';
  if (/\blighting|\blight\s+fixture/.test(n) && /\binstall/.test(n)) return 'bathroom_fixture';

  // Package name/scope wins over other clauses in combined notes (e.g. tile demo + baseboard job).
  if (/baseboard|trim/.test(n) || /\b(baseboard|trim|crown|moulding|molding|casing)\b/.test(s)) {
    return 'baseboard';
  }
  if (
    /\b(toilet|vanity|shower\s+door|glass\s+door|tub|bathtub|prefab\s+shower\s+pan|shower\s+pan|sink)\b/.test(
      n
    ) &&
    /\binstall/.test(n)
  ) {
    return 'bathroom_fixture';
  }
  if (/\btile\b/.test(n) && /\b(install|installation)\b/.test(n) && !/\b(demo|removal)\b/.test(n)) {
    return 'flooring';
  }
  if (/\b(demo|removal|demolition|haul)\b/.test(n) || /\b(demo|removal|demolition)\b/.test(s)) {
    return 'demo';
  }
  if (/laminate|flooring|lvp|vinyl|carpet/.test(n)) return 'flooring';
  if (/kitchen|cabinet|counter/.test(n)) return 'kitchen';
  if (/\btile\s+shower\s+pan|\bmud\s+pan\b/.test(n)) return 'bathroom_fixture';
  if (/bath|shower|vanity/.test(n)) {
    if (isShowerWaterproofingScope(n, s)) return 'shower_waterproofing';
    if (isShowerTileInstallScope(n, s)) return 'shower_tile';
    return 'bathroom';
  }
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
  if (/\b(bath|bathroom|shower|vanity|tub)\b/.test(blob)) {
    if (isShowerWaterproofingScope(name, `${scope} ${notes}`)) return 'shower_waterproofing';
    if (isShowerTileInstallScope(name, `${scope} ${notes}`)) return 'shower_tile';
    return 'bathroom';
  }
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

module.exports = {
  classifyTradeForPricing,
  isShowerWaterproofingScope,
  isShowerTileInstallScope,
  isShowerFloorTileInstallScope,
  isShowerFullPackageScope,
  WATERPROOF_BACKER_RE,
};
