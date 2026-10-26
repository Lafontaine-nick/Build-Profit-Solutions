const MONEY_RE = /\$\s*\d[\d,]*(?:\.\d+)?|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s+dollars?\b/i;
const SQFT_RE = /\b\d[\d,]*(?:\.\d+)?\s*(?:sq\.?\s*ft|sqft|sf|square\s+(?:foot|feet)|ft\.?\s*(?:2|²|\?))/gi;
const LF_RE = /\b\d[\d,]*(?:\.\d+)?\s*(?:lf|linear\s+(?:foot|feet)|linear\s+ft|ln\s*ft)\b/gi;
const CY_RE = /\b\d[\d,]*(?:\.\d+)?\s*(?:cy|cubic\s+yards?)\b/gi;
const TON_RE = /\b\d[\d,]*(?:\.\d+)?\s*(?:tons?|ton)\b/gi;
const COUNT_RE = /\b\d[\d,]*(?:\.\d+)?\s*(?:each|ea|fixtures?|toilets?|sinks?|lights?|outlets?|circuits?|devices?|doors?|windows?|cans?|hours?|hrs?|hr)\b/gi;

function addUnique(list, value) {
  if (value && !list.includes(value)) list.push(value);
}

function levelFromScore(score) {
  if (score >= 80) return 'high';
  if (score >= 55) return 'medium';
  return 'low';
}

function parsedMeasurementCount(parsed) {
  return Object.keys(parsed || {}).filter((key) => key !== 'itemQuantities' && parsed[key] != null).length;
}

function parsedPricingCount(parsed) {
  return Object.keys(parsed?.itemQuantities || {}).length;
}

function collectNumberUnitValues(text) {
  const values = [];
  for (const [unit, re] of [
    ['sqft', SQFT_RE],
    ['lf', LF_RE],
    ['cy', CY_RE],
    ['ton', TON_RE],
    ['count', COUNT_RE],
  ]) {
    let match;
    const clone = new RegExp(re.source, re.flags);
    while ((match = clone.exec(text)) !== null) {
      values.push({ unit, raw: match[0] });
    }
  }
  return values;
}

function hasOnlyOneParsedSide(itemQuantities, itemId) {
  const hasMaterial = Boolean(itemQuantities?.[`${itemId}__material`]);
  const hasLabor = Boolean(itemQuantities?.[`${itemId}__labor`]);
  return (hasMaterial && !hasLabor) || (!hasMaterial && hasLabor);
}

function buildQuestion(id, text) {
  return { id, question: text };
}

const THIN_SCOPES = [
  ["Electrical", "Which electrical work is in this job?", /\b(?:electrical|wiring)\b/i, /\b(?:outlets?|receptacles?|switches?|lights?|recessed|panels?|circuits?|gfci|rewire|rewiring|dimmers?|fans?|smoke|service\s+calls?|chargers?|\d+\s*amps?)\b/i],
  ["Plumbing", "Which plumbing work is in this job?", /\bplumbing\b/i, /\b(?:toilets?|sinks?|faucets?|showers?|tubs?|bathtubs?|water\s+heaters?|drains?|pipes?|repiping|rough[\s-]?ins?|fixtures?|disposals?|sewer|water\s+lines?)\b/i],
  ["HVAC", "Which HVAC work is in this job?", /\bhvac\b/i, /\b(?:furnaces?|heat\s*pumps?|air\s*condition(?:er|ing)?|condensers?|air\s+handlers?|ducts?|ductwork|mini[\s-]?splits?|thermostats?|service\s+calls?|tons?|replace(?:ment)?|install)\b/i],
  ["Roofing", "Which parts of the roof are in this job? The roof area stays blank until measured.", /\broof(?:ing)?\b/i, /\b(?:replace(?:ment)?|shingles?|tear[\s-]?off|vents?|flashing|squares?|metal|repair|leak|underlayment|ridge|gutters?|install|new)\b/i],
  ["Flooring", "Which floors are being done, and which product? The area stays blank until measured.", /\bflooring\b/i, /\b(?:lvp|luxury\s+vinyl|vinyl|carpet|hardwood|laminate|tile|vct|main\s+level|upstairs|downstairs|bedrooms?|kitchen|bath|install|replace(?:ment)?|remove|removal|sqft|sq\.?\s*ft|\bsf\b)\b/i],
  ["Drywall", "Which drywall work is in this job? Wall and ceiling area stay blank until measured.", /\b(?:drywall|sheetrock|gypsum)\b/i, /\b(?:hang|finish|tape|mud|texture|patch|repair|ceilings?|walls?|addition|sqft|sq\.?\s*ft|\bsf\b)\b/i],
  ["Windows", "Which windows are in this job?", /\bwindows?\b/i, /\b(?:replace(?:ment)?|install|new|remove|removal|vinyl|double[\s-]?hung|picture|egress|casement|slider)\b|\b\d+\s+windows?\b/i],
  ["Doors", "Which doors are in this job?", /\bdoors?\b/i, /\b(?:replace(?:ment)?|install|new|interior|exterior|entry|sliding|patio|garage|hardware|paint[\s-]?grade|prehung|remove)\b|\b\d+\s+(?:interior\s+|exterior\s+)?doors?\b|\bpaint(?:ing)?\b[^.]{0,40}\bdoors?\b|\bdoors?\b[^.]{0,40}\bpaint/i],
  ["Insulation", "Where is the insulation going? The area stays blank until measured.", /\binsulat(?:e|ion|ed)\b/i, /\b(?:attic|walls?|ceilings?|crawl|floors?|basement|garage|batts?|blown|spray|R[-\s]?\d{2,3})\b/i],
  ["Concrete", "Which concrete work is in this job? The area stays blank until measured.", /\bconcrete\b/i, /\b(?:patio|driveway|sidewalk|slabs?|footings?|foundation|flatwork|pour|stamped|broom|pads?|sqft|sq\.?\s*ft|\bsf\b)\b/i],
  ["Framing", "Which framing is in this job? The area stays blank until measured.", /\bframing\b/i, /\b(?:walls?|roofs?|floors?|addition|headers?|beams?|studs?|trusses?|sqft|sq\.?\s*ft|\bsf\b)\b/i],
  ["Deck", "Which parts of the deck are in this job? The size stays blank until measured.", /\bdeck(?:ing)?\b/i, /\b(?:railings?|guardrails?|stairs?|steps?|footings?|composite|wood|posts?|demo|remove|replace(?:ment)?|rebuild|sqft|sq\.?\s*ft|\bsf\b)\b/i],
  ["Siding", "Which walls are getting siding? The wall area stays blank until measured.", /\bsiding\b/i, /\b(?:replace(?:ment)?|install|new|vinyl|fiber|cement|hardie|front|back|rear|sides?|repair|remove|sqft|sq\.?\s*ft|\bsf\b)\b/i],
  ["Landscaping", "Which landscaping work is in this job?", /\blandscap(?:e|ing)\b/i, /\b(?:sod|grass|pavers?|mulch|plants?|trees?|irrigation|sprinklers?|retaining|fenc(?:e|ing)|grading|rocks?|gravel)\b/i],
  ["Tile", "Which surfaces are being tiled?", /\b(?:tile|tiling)\b/i, /\b(?:showers?|floors?|backsplash|walls?|niches?|tubs?|bath(?:room)?s?|kitchens?|sqft|sq\.?\s*ft|\bsf\b)\b/i],
  ["Demolition", "What is being demolished?", /\b(?:demo|demolition)\b/i, /\b(?:studs?|cabinets?|counters?|countertops?|backsplash|floors?|tile|tubs?|walls?|kitchens?|bath(?:room)?s?|drywall|sheetrock)\b/i],
  ["Gutters", "Which gutters are in this job?", /\bgutters?\b/i, /\b(?:replace(?:ment)?|install|new|leaf|guards?|downspouts?|feet|lf|linear|repair|remove)\b/i],
  ["Fence", "Which fence work is in this job? The length stays blank until measured.", /\bfenc(?:e|ing)\b/i, /\b(?:cedar|wood|vinyl|chain[\s-]?link|picket|feet|lf|linear|gates?|heights?|replace(?:ment)?|install|new|remove)\b/i],
];

function affirmativeJobText(notes) {
  return String(notes || "")
    .split(/\n+|(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(
      (sentence) =>
        sentence &&
        !/^(?:no|not|without|do not|don't|dont|never|keep|leave)\b/i.test(sentence) &&
        !/\bowner[\s-]*supplied\b/i.test(sentence) &&
        !/\bseparate\s+bid\b/i.test(sentence)
    )
    .join(" ");
}

function thinJobQuestion(notes) {
  const raw = String(notes || "");
  if (
    /\b(?:plan imported|cover sheet|full\s+build|ground[\s-]?up|new\s+(?:build|construction|home)|custom\s+home|spec\s+home)\b/i.test(
      raw
    )
  ) {
    return null;
  }
  const work = affirmativeJobText(raw);
  if (!work) return null;
  const matched = THIN_SCOPES.filter((scope) => scope[2].test(work));
  if (!matched.length || matched.some((scope) => scope[3].test(work))) return null;
  if (matched.length === 1) return matched[0][1];
  const phrase = matched.map((scope) => scope[0].toLowerCase()).join(" and ");
  return matched.length > 2
    ? "Which work is in this job?"
    : `Which ${phrase} work is in this job?`;
}

function evaluateScopeExtractionConfidence(notes, parsed = {}, ctx = {}) {
  const raw = String(notes || '').trim();
  const text = raw.toLowerCase();
  const flags = [];
  const conflictingValues = [];
  const missingCriticalFields = [];
  const clarificationQuestions = [];
  const itemQuantities = parsed.itemQuantities || {};
  const measurementsCount = parsedMeasurementCount(parsed);
  const pricingCount = parsedPricingCount(parsed);
  const numberUnits = collectNumberUnitValues(raw);

  const scopeKeywords = [
    'bath', 'bathroom', 'remodel', 'floor', 'flooring', 'lvp', 'laminate', 'carpet', 'tile', 'baseboard', 'trim', 'cabinet', 'counter', 'backsplash',
    'paint', 'toilet', 'plumb', 'rough', 'electrical', 'outlet', 'light', 'concrete', 'excavat',
    'roof', 'drywall', 'sheetrock', 'hvac', 'duct', 'sod', 'paver', 'rock', 'mulch', 'vanity', 'service', 'handyman', 'stucco',
    'window', 'door', 'framing', 'insulation', 'deck', 'siding', 'gutter', 'fence', 'landscap', 'demo', 'wiring',
  ];
  const hasScope = scopeKeywords.some((kw) => text.includes(kw));
  const hasPricing = MONEY_RE.test(raw) || /\b(lump\s*sum|allowance|quote|sub(?:contractor)?|labor|material)\b/i.test(raw);

  let scopeScore = hasScope ? 85 : 35;
  let measurementScore = measurementsCount > 0 || numberUnits.length > 0 ? 80 : 40;
  let pricingScore = hasPricing ? (pricingCount > 0 ? 85 : 58) : 55;

  if (!hasScope) {
    addUnique(flags, 'scope_unclear');
    addUnique(missingCriticalFields, 'scope');
  }

  if (numberUnits.length && measurementsCount === 0 && numberUnits.some((entry) => entry.unit !== 'count')) {
    addUnique(flags, 'measurements_not_mapped');
    measurementScore -= 25;
  }

  if (!numberUnits.length && /install|replace|paint|demo|rough|wire|duct|drywall|concrete/.test(text)) {
    addUnique(flags, 'missing_quantity');
    addUnique(missingCriticalFields, 'quantity');
    measurementScore -= 20;
  }

  const paintSentenceHasLooseSqft = String(raw)
    .split(/[.\n;]+/)
    .some((sentence) => {
      if (!/\bpaint\b/i.test(sentence)) return false;
      const sqft = new RegExp(SQFT_RE.source, SQFT_RE.flags);
      if (!sqft.test(sentence)) return false;
      return !/\b(?:wall|walls|ceiling|ceilings|paintable|flooring|floors?|house|home)\b/i.test(
        sentence
      );
    });
  if (
    paintSentenceHasLooseSqft &&
    !/\b(drywall|patch|repair|texture)\b/.test(text)
  ) {
    addUnique(flags, 'ambiguous_sqft');
    addUnique(missingCriticalFields, 'paintable_area_basis');
    addUnique(
      clarificationQuestions,
      buildQuestion('paint_sqft_basis', 'Does the sqft refer to floor area or paintable wall and ceiling area?')
    );
    measurementScore -= 25;
  }
  SQFT_RE.lastIndex = 0;

  if (/\bbaseboards?|trim\b/.test(text) && MONEY_RE.test(raw) && !/\b(per|\/|each|lf|linear\s+(?:foot|feet))\b/.test(text)) {
    addUnique(flags, 'baseboard_price_unit_ambiguous');
    addUnique(
      clarificationQuestions,
      buildQuestion('baseboard_price_unit', 'Is the baseboard price per linear foot, and does it include both material and labor?')
    );
    pricingScore -= 20;
  }
  if (
    /\bbaseboards?|trim\b/.test(text) &&
    /\b(?:baseboards?|trim)\b[^.;\n]{0,80}\b\d[\d,]*(?:\.\d+)?\s*(?:sq\.?\s*ft|sqft|sf|square\s+(?:foot|feet)|ft\.?\s*(?:2|²|\?))|\b\d[\d,]*(?:\.\d+)?\s*(?:sq\.?\s*ft|sqft|sf|square\s+(?:foot|feet)|ft\.?\s*(?:2|²|\?))[^.;\n]{0,80}\b(?:baseboards?|trim)\b/i.test(raw) &&
    LF_RE.test(raw)
  ) {
    addUnique(flags, 'baseboard_unit_conflict');
    addUnique(
      clarificationQuestions,
      buildQuestion('baseboard_price_unit', 'Is the baseboard price per linear foot, and does it include both material and labor?')
    );
    measurementScore -= 20;
    pricingScore -= 10;
  }
  SQFT_RE.lastIndex = 0;
  LF_RE.lastIndex = 0;

  if (/\breplace\s+(?:the\s+)?toilet\b|\btoilet\s+replace/.test(text)) {
    addUnique(flags, 'plumbing_replacement_responsibility_unknown');
    addUnique(
      clarificationQuestions,
      buildQuestion('toilet_replacement_details', 'Is the toilet staying in the same location, and is the fixture contractor-supplied or customer-supplied?')
    );
    scopeScore -= 10;
    pricingScore -= 10;
  }

  if (/\bbath(?:room)?\s+remodel\b/.test(text) && /\$\s*\d[\d,]*(?:\.\d+)?/.test(raw) && !/\b(material|labor|sub|quote|allowance|total|selling|cost)\b/.test(text)) {
    addUnique(flags, 'lump_sum_meaning_unknown');
    addUnique(
      clarificationQuestions,
      buildQuestion('bath_lump_sum_meaning', 'Does the lump sum represent the total selling price, direct project cost, labor only, material only, or a subcontractor quote?')
    );
    pricingScore -= 25;
  }

  if (/\bcabinets?\b/.test(text) && /\b(countertops?|counters?|quartz|granite)\b/.test(text) && !/\d/.test(raw)) {
    addUnique(flags, 'missing_cabinet_counter_quantities');
    addUnique(missingCriticalFields, 'cabinet_lf');
    addUnique(missingCriticalFields, 'countertop_sqft');
    addUnique(
      clarificationQuestions,
      buildQuestion('cabinet_counter_quantities', 'What are the cabinet linear feet or cabinet count, and what is the countertop square footage?')
    );
    measurementScore -= 30;
  }

  if (/\bcustomer\s+(?:supplied|provides|providing)|owner\s+(?:supplied|provides|providing)|material\s+by\s+owner\b/.test(text)) {
    addUnique(flags, 'customer_supplied_material');
  }

  if (/\bcontractor\s+(?:supplied|provides|providing)\b/.test(text)) {
    addUnique(flags, 'contractor_supplied_material');
  }

  if (/\b(sub(?:contractor)?|sub)\s+(?:quote|bid)\b|\bquote\s+from\s+sub\b/.test(text)) {
    addUnique(flags, 'subcontractor_quote');
    if (!/\b(material|labor|total|allowance|scope)\b/.test(text)) {
      addUnique(
        clarificationQuestions,
        buildQuestion('sub_quote_scope', 'Does the subcontractor quote include material, labor, equipment, cleanup, and disposal?')
      );
      pricingScore -= 15;
    }
  }

  if (/\brelocat(?:e|ion)|move\s+(?:the\s+)?(?:toilet|sink|vanity|outlet|light|switch)\b/.test(text)) {
    addUnique(flags, 'replacement_vs_relocation_complexity');
  }

  if (/\bwire|wiring|circuit|panel|rough(?:-?in)?\b/.test(text) && /\belectrical|outlet|light|switch|fan\b/.test(text)) {
    addUnique(flags, 'electrical_new_wiring_or_circuits');
  }

  if (/\bcleanup|clean\s*up|haul|disposal|dump(?:ster)?|debris\b/.test(text) && !MONEY_RE.test(raw)) {
    addUnique(flags, 'cleanup_disposal_unclear');
    addUnique(
      clarificationQuestions,
      buildQuestion('cleanup_disposal_scope', 'Is cleanup, haul-off, and disposal included, and is it priced separately?')
    );
    pricingScore -= 10;
  }

  if (/\b(labor\s+only|labor-only)\b/.test(text)) {
    addUnique(flags, 'labor_only');
  }
  if (/\b(material\s+only|material-only)\b/.test(text)) {
    addUnique(flags, 'material_only');
  }

  const partialItemIds = ['flooring', 'backsplash', 'paint', 'sod_turf', 'pavers', 'concrete', 'drywall', 'trim'];
  for (const itemId of partialItemIds) {
    if (hasOnlyOneParsedSide(itemQuantities, itemId)) {
      addUnique(flags, 'partial_material_labor_pricing');
      pricingScore = Math.min(pricingScore, 70);
    }
  }

  const sqftValues = [...raw.matchAll(SQFT_RE)].map((m) => Number(String(m[0]).replace(/[^\d.]/g, '')));
  SQFT_RE.lastIndex = 0;
  const uniqueSqft = [...new Set(sqftValues.filter((n) => Number.isFinite(n) && n > 0))];
  if (uniqueSqft.length >= 2 && /\b(actually|maybe|or|about|roughly|approx|approximately|i think|probably)\b/.test(text)) {
    addUnique(flags, 'competing_sqft_values');
    conflictingValues.push({ field: 'sqft', values: uniqueSqft });
    measurementScore -= 20;
  }

  if (/\b(?:not sure|maybe|around|about|roughly|approx|approximately|i think|probably|guess)\b/.test(text)) {
    addUnique(flags, 'approximate_or_uncertain_language');
    scopeScore -= 5;
    measurementScore -= 10;
  }

  if (raw.length > 180 && !/[.;\n]/.test(raw)) {
    addUnique(flags, 'long_conversational_note');
    scopeScore -= 10;
  }

  if (
    !/[.;\n]/.test(raw) &&
    /\b(cabs?|tops?|splash|elec|plumb|reno|hook)\b/.test(text) &&
    (raw.match(/\b\d[\d,]*(?:\.\d+)?\s*(?:sf|lf|cans?)\b/gi) || []).length >= 3
  ) {
    addUnique(flags, 'shorthand_multi_trade_note');
    addUnique(flags, 'measurements_not_mapped');
    scopeScore -= 15;
    measurementScore -= 30;
  }

  const { notesDescribeMeasuredWholeHomeRemodel } = require("./scopeChecklistLibrary");
  const namesWholeHomeRemodel =
    /\bremodel/i.test(raw) &&
    /\b(?:whole|entire|full)[\s-]+(?:house|home)\b|\b(?:house|home)\s+remodel\b|\bremodel(?:ing)?\s+(?:the\s+)?(?:whole\s+|entire\s+)?(?:house|home)\b/i.test(
      raw
    );
  if (
    (notesDescribeMeasuredWholeHomeRemodel(raw) || namesWholeHomeRemodel) &&
    !/\b(?:flooring|lvp|luxury\s+vinyl|drywall|sheetrock|windows?|doors?|insulat|trim|baseboards?|plumbing|electrical|paint|cabinets?|countertops?|counters?|backsplash|vanity|shower|tile|framing)\b/i.test(raw)
  ) {
    addUnique(
      clarificationQuestions,
      buildQuestion(
        "whole_home_trades",
        "Which job scopes are being done? Add the measurements you already have, and what each scope still needs, so the bid can be structured."
      )
    );
  }

  if (
    /\b(?:update|remodel|renovation|reno)\b/i.test(raw) &&
    /\b(?:master\s+bath|bath(?:room)?s?)\b/i.test(raw) &&
    !/\b(?:whole|entire|full)\s+(?:house|home)\b|\bhouse\s+remodel\b/i.test(raw) &&
    !/\b(?:vanity|toilet|shower|tub|tile|floor(?:ing)?)\b/i.test(raw)
  ) {
    addUnique(
      clarificationQuestions,
      buildQuestion(
        "vague_bathroom",
        "Which parts of the bathroom are in this remodel?"
      )
    );
  }
  if (
    /\bkitchen\s+(?:remodel|renovation|reno|update)\b|\b(?:remodel|reno|update)\s+(?:the\s+)?kitchen\b/i.test(raw) &&
    !/\b(?:cabinets?|countertops?|counters?|backsplash|flooring|lvp|sink|dishwasher)\b/i.test(raw)
  ) {
    addUnique(
      clarificationQuestions,
      buildQuestion(
        "vague_kitchen",
        "Which parts of the kitchen are in this remodel?"
      )
    );
  }
  if (
    /\bpaint(?:ing)?\b/i.test(raw) &&
    !/\b(?:walls?|ceilings?|doors?|trim|baseboards?|cabinets?|siding|flooring|kitchen|bath|roof|windows?|electrical|plumbing|hvac|drywall)\b/i.test(raw)
  ) {
    addUnique(
      clarificationQuestions,
      buildQuestion("vague_paint", "Which surfaces are being painted?")
    );
  }
  if (
    /\bstucco\b/i.test(raw) &&
    !/\b(?:front|back|rear|side|walls?|sqft|sq\.?\s*ft|sf|windows?|doors?|paint|roof|flooring)\b/i.test(raw)
  ) {
    addUnique(
      clarificationQuestions,
      buildQuestion(
        "vague_stucco",
        "Which walls are getting stucco? The wall area stays blank until measured."
      )
    );
  }
  const thinJob = thinJobQuestion(raw);
  if (thinJob) {
    addUnique(clarificationQuestions, buildQuestion("vague_scope", thinJob));
  }

  if (!hasPricing && /\badd|run|install|replace|demo|paint|rough|wire|concrete|drywall|roof|hvac\b/.test(text)) {
    addUnique(flags, 'no_pricing_provided');
    pricingScore = Math.min(pricingScore, 55);
  }

  scopeScore = Math.max(0, Math.min(100, scopeScore));
  measurementScore = Math.max(0, Math.min(100, measurementScore));
  pricingScore = Math.max(0, Math.min(100, pricingScore));
  const overallScore = Math.round(scopeScore * 0.3 + measurementScore * 0.35 + pricingScore * 0.35);

  const scopeConfidence = levelFromScore(scopeScore);
  const measurementConfidence = levelFromScore(measurementScore);
  const pricingConfidence = levelFromScore(pricingScore);
  let overallConfidence = levelFromScore(overallScore);
  if (flags.includes('competing_sqft_values') || flags.includes('shorthand_multi_trade_note')) {
    overallConfidence = 'low';
  }
  const vagueJobQuestion = clarificationQuestions.some((question) =>
    [
      'whole_home_trades',
      'vague_bathroom',
      'vague_kitchen',
      'vague_paint',
      'vague_stucco',
      'vague_scope',
    ].includes(question.id)
  );
  if (
    vagueJobQuestion &&
    overallConfidence === 'low' &&
    !flags.includes('competing_sqft_values') &&
    !flags.includes('shorthand_multi_trade_note') &&
    !flags.includes('long_conversational_note') &&
    !flags.includes('measurements_not_mapped')
  ) {
    overallConfidence = 'medium';
  }
  const requiresClarification = clarificationQuestions.length > 0;
  const requiresAiFallback =
    overallConfidence === 'low' ||
    flags.includes('scope_unclear') ||
    flags.includes('measurements_not_mapped') ||
    flags.includes('competing_sqft_values') ||
    flags.includes('long_conversational_note');

  return {
    overallConfidence,
    scopeConfidence,
    measurementConfidence,
    pricingConfidence,
    ambiguityFlags: flags,
    conflictingValues,
    missingCriticalFields,
    requiresAiFallback,
    requiresClarification,
    clarificationQuestions,
  };
}

function attachScopeExtractionConfidence(draft) {
  const notes = String(draft?.originalNotes || "").trim();
  if (!notes || !draft || typeof draft !== "object") return draft;
  const { parseScopeMeasurementsFromNotes } = require("./scopeMeasurementParser");
  const templateKey = draft.scopeChecklist?.templateKey || draft.projectType || null;
  let parsed = {};
  try {
    parsed =
      parseScopeMeasurementsFromNotes(notes, {
        templateKey,
        projectType: draft.projectType,
      }) || {};
  } catch {
    parsed = {};
  }
  const extractionConfidence = evaluateScopeExtractionConfidence(notes, parsed, {
    templateKey,
    projectType: draft.projectType,
  });
  const missingInfo = [...(draft.missingInfo || [])];
  for (const question of extractionConfidence.clarificationQuestions || []) {
    const text = String(question?.question || "").trim();
    if (text && !missingInfo.includes(text)) missingInfo.push(text);
  }
  return {
    ...draft,
    extractionConfidence,
    missingInfo,
    classification: {
      ...(draft.classification || {}),
      confidence: extractionConfidence.overallConfidence,
    },
  };
}

module.exports = {
  evaluateScopeExtractionConfidence,
  attachScopeExtractionConfidence,
};
