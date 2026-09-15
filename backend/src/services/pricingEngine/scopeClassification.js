/**
 * Classify scope items before pricing — trade, scope type, unit, complexity, work boundaries.
 */

const { classifyTradeForPricing } = require('./tradeClassifier');
const { getPricingRange, normalizeUnit } = require('./pricingRangeCatalog');

function scopeBlob(scopeItem) {
  return `${scopeItem.scopeName || ''} ${scopeItem.scope || ''}`.toLowerCase();
}

function isCleanupScope(scopeItem) {
  return /\bcleanup|\bdisposal|\bhaul[\s-]?off|\bdumpster|\bjobsite\s+clean/.test(scopeBlob(scopeItem));
}

function isPermitsScope(scopeItem) {
  return /\bpermits?\b|\binspection\s+fees?/.test(scopeBlob(scopeItem));
}

function isPlumbingTrimScope(scopeItem) {
  return /\bplumb.*\btrim|\bplumbing\s+trim|\bfinal\s+plumb/.test(scopeBlob(scopeItem));
}

function isElectricalTrimScope(scopeItem) {
  return /\belectrical\s+trim|\bdevices.*\bplates/.test(scopeBlob(scopeItem));
}

const TRADE_TO_CATEGORY = {
  shower_waterproofing: 'shower_waterproofing',
  shower_tile: 'shower_tile',
  shower_full_package: 'shower_full_package',
  demo: 'demo',
  flooring: 'flooring',
  baseboard: 'baseboard',
  bathroom: 'bathroom',
  kitchen: 'kitchen',
  painting: 'painting',
  plumbing: 'plumbing',
  plumbing_service: 'plumbing_service',
  electrical: 'electrical',
  roofing: 'roofing',
  concrete: 'concrete',
  bathroom_fixture: 'bathroom_fixture',
  other: 'other',
};

function blob(scopeItem) {
  return scopeBlob(scopeItem);
}

function inferTradeCategory(scopeItem, draft = {}) {
  const trade =
    scopeItem.trade ||
    classifyTradeForPricing(
      scopeItem.scopeName,
      scopeItem.scope,
      draft.originalNotes,
      draft.projectType
    );
  const text = blob(scopeItem);
  if (isCleanupScope(scopeItem)) return 'cleanup';
  if (isPermitsScope(scopeItem)) return 'permits';
  if (/\bdrywall\b/.test(blob(scopeItem))) return 'drywall';
  if (/\b(fram(e|ing)|stud)\b/.test(blob(scopeItem))) return 'framing';
  if (/\bhvac\b|\bfurnace\b|\bac\s+unit\b|\bair\s+condition/.test(blob(scopeItem))) return 'hvac';
  if (/\b(?:landscape|path|outdoor)\s+lighting\b|\blandscape\s+lights?\b/.test(text)) {
    return 'landscape_lighting';
  }
  if (/\birrigat|\bsprinkler\s+system|\bdrip\s+system/.test(text)) {
    return 'landscape_irrigation';
  }
  if (/\b(?:artificial|synthetic)\s+(?:turf|grass)\b|\bartificial\s+turf\b/.test(text)) {
    return 'landscape_artificial_turf';
  }
  if (/\bsod\b|\bnatural\s+grass\b/.test(text)) return 'landscape_sod';
  if (/\bpavers?\b/.test(text)) return 'landscape_pavers';
  if (/\bmulch\b/.test(text)) return 'landscape_mulch';
  if (/\b(?:decorative\s+)?rock\b|\bgravel\b/.test(text)) return 'landscape_rock';
  if (/\b(?:landscape\s+)?boulders?\b/.test(text)) return 'landscape_boulders';
  if (/\b(?:plants?|shrubs?|planting|specimen)\b/.test(text)) {
    return /\btrees?\b/.test(text) ? 'landscape_trees' : 'landscape_plants';
  }
  if (/\b(?:concrete\s+)?edging\b/.test(text)) return 'landscape_edging';
  if (/\bretaining\s+walls?\b/.test(text)) return 'landscape_retaining_wall';
  if (/\b(?:landscape\s+)?drainage\b|\bfrench\s+drains?\b|\bdrain\s+tile\b/.test(text)) {
    return 'landscape_drainage';
  }
  if (/\bsoil\s+(?:prep|preparation|amendment)\b|\btopsoil\b/.test(text)) {
    return 'landscape_soil_prep';
  }
  if (
    /\b(?:landscap(?:e|ing)|lawn|vegetation|brush)\b/.test(text) &&
    /\b(?:demo|demolition|remove|removal|clear(?:ing)?|tear[\s-]?out)\b/.test(text)
  ) {
    return 'landscape_clearing';
  }
  if (
    /\b(?:landscap(?:e|ing)|lawn|yard|site)\b/.test(text) &&
    /\b(?:grading|regrade|grade)\b/.test(text)
  ) {
    return 'landscape_grading';
  }
  if (/\bexcavat|\bgrading\b|\bsite\s+work/.test(text)) return 'excavation';
  if (/\blandscap|\bsod\b|\birrigat/.test(text)) return 'landscaping';
  if (/\bgeneral\s+labor|\blabor\s+only|\bhelper\b/.test(blob(scopeItem))) return 'general_labor';
  if (/\btile\b/.test(blob(scopeItem)) && trade === 'flooring') return 'tile';
  return TRADE_TO_CATEGORY[trade] || trade || 'other';
}

function inferScopeType(scopeItem, pricingCategory, range) {
  const text = blob(scopeItem);
  if (isCleanupScope(scopeItem) || isPermitsScope(scopeItem)) return 'allowance';
  if (isPlumbingTrimScope(scopeItem) || isElectricalTrimScope(scopeItem)) return 'subScope';
  if (/\bfull\s+(bath|bathroom|kitchen)\s+remodel|\bcomplete\s+remodel|\bgut\s+renovation/.test(text)) {
    return 'project';
  }
  if (
    /\bfull\s+(wet|shower)|complete\s+shower|tile\s+shower\s+package|shower\s+system|wet\s+area\s+package/.test(
      text
    )
  ) {
    return 'assembly';
  }
  if (/\bmaterial\s+only\b|\bsupply\s+only\b|\bowner\s+supplied\b/.test(text)) return 'materialOnly';
  if (/\blabor\s+only\b|\binstall\s+only\b/.test(text)) return 'laborOnly';
  if (/\bservice\s+call|\btroubleshoot|\brepair\s+visit/.test(text)) return 'serviceCall';
  if (/\ballowance\b|\bcontingency\b/.test(text)) return 'allowance';
  return range?.defaultScopeType || 'subScope';
}

function inferComplexity(scopeItem, draft = {}) {
  const text = `${blob(scopeItem)} ${draft.originalNotes || ''}`.toLowerCase();
  if (/\b(custom|high[\s-]?end|luxury|complex|curb\s+less|steam|multiple\s+niches)/.test(text)) {
    return 'high';
  }
  if (/\b(simple|basic|standard|prefab|builder[\s-]?grade|stock)/.test(text)) return 'low';
  if (/\b(remodel|renovation|reconfigure|layout\s+change)/.test(text)) return 'high';
  return 'standard';
}

function inferIncludedWork(scopeItem, pricingCategory) {
  const text = blob(scopeItem);
  const included = [];
  if (pricingCategory === 'shower_waterproofing') {
    included.push('backer board', 'waterproof membrane', 'seam tape', 'screws');
  } else if (pricingCategory === 'shower_tile') {
    included.push('tile material allowance', 'thinset', 'grout', 'tile setting labor');
  } else if (pricingCategory === 'demo') {
    included.push('demolition', 'debris handling');
  } else if (pricingCategory === 'flooring' || pricingCategory === 'tile') {
    included.push('floor prep', 'material', 'install labor');
  } else if (/\binstall/.test(text)) {
    included.push('install labor');
  }
  if (/\bmaterial/.test(text)) included.push('materials');
  return [...new Set(included)];
}

function inferExcludedWork(scopeItem, pricingCategory, scopeType) {
  const excluded = [];
  if (pricingCategory === 'shower_waterproofing') {
    excluded.push('wall tile', 'shower pan', 'drain', 'fixtures', 'glass door');
  } else if (pricingCategory === 'shower_tile') {
    excluded.push('waterproofing/backer board', 'shower pan', 'plumbing rough');
  } else if (scopeType === 'subScope') {
    excluded.push('full room remodel', 'unrelated trades');
  }
  if (pricingCategory === 'bathroom' && scopeType === 'subScope') {
    excluded.push('full bathroom package pricing');
  }
  return excluded;
}

function suggestPricingUnit(scopeItem, range) {
  const unit = normalizeUnit(scopeItem.unit);
  if (unit && unit !== 'lump_sum') return unit;
  return normalizeUnit(range?.unit || 'lump_sum');
}

/**
 * @param {object} scopeItem
 * @param {object} [draft]
 */
function classifyScopeItem(scopeItem, draft = {}) {
  const tradeCategory = inferTradeCategory(scopeItem, draft);
  const range = getPricingRange(tradeCategory);
  const scopeType = inferScopeType(scopeItem, tradeCategory, range);
  const pricingUnit = suggestPricingUnit(scopeItem, range);
  const complexity = inferComplexity(scopeItem, draft);
  return {
    tradeCategory,
    pricingCategory: range.pricingCategory,
    scopeType,
    pricingUnit,
    complexity,
    includedWork: inferIncludedWork(scopeItem, tradeCategory),
    excludedWork: inferExcludedWork(scopeItem, tradeCategory, scopeType),
    parentAssemblyCategory: range.parentAssemblyCategory,
    allowedUnits: range.allowedUnits,
    rangeNotes: range.notes,
  };
}

module.exports = {
  classifyScopeItem,
  inferTradeCategory,
  inferScopeType,
  TRADE_TO_CATEGORY,
};
