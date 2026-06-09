/**
 * Estimate tier classification and scope-assumption checklists for complex jobs.
 * Simple unit bids (flooring, clear qty × rate) skip the checklist gate.
 */

const { SCOPE_TASKS, emptyScopeRoom } = require('./estimateDraftScopeSplit');
const {
  normalizeScopeMeasurements,
  resolveQuantityForChecklistItem,
  stampPackageWithCatalogRules,
} = require('./scopeItemQuantityCatalog');

const VALID_ESTIMATE_TIERS = new Set([
  'simple_unit',
  'room_remodel',
  'addition',
  'ground_up',
]);

const REMODEL_KEYWORDS_RE =
  /\b(remodel|renovation|gut\s*(?:out|job)?|full\s+(?:bath|kitchen|remodel)|demo\s+and\s+rebuild)\b/i;

const FIXTURE_CHOICE_OPTIONS = [
  { id: 'staying', label: 'Staying' },
  { id: 'replacing', label: 'Replacing' },
  { id: 'relocating', label: 'Relocating' },
  { id: 'not_in_scope', label: 'Not in this bid' },
  { id: 'unsure', label: 'Not sure yet' },
];

const FIXTURE_CHOICE_NO_RELOCATE = [
  { id: 'staying', label: 'Staying' },
  { id: 'replacing', label: 'Replacing' },
  { id: 'not_in_scope', label: 'Not in this bid' },
  { id: 'unsure', label: 'Not sure yet' },
];

const CHECKLIST_TEMPLATES = {
  bathroom: {
    title: 'Bathroom remodel — confirm project scope',
    intro:
      'Before pricing, confirm what work is part of this bid. Yes = in your scope. No = not part of this bid. Not sure = we will not auto-price it.',
    items: [
      {
        id: 'demo',
        inputType: 'yes_no',
        label: 'Demo / tear-out of existing bathroom',
        helperText: 'Remove and dispose of existing fixtures, tile, and finishes.',
        category: 'scope',
      },
      {
        id: 'tub_shower',
        inputType: 'choice',
        label: 'Tub or shower',
        helperText: 'What happens to the tub or shower area?',
        options: FIXTURE_CHOICE_OPTIONS,
        category: 'plumbing',
      },
      {
        id: 'toilet',
        inputType: 'choice',
        label: 'Toilet',
        helperText: 'Staying, replacing, or moving to a new location?',
        options: FIXTURE_CHOICE_OPTIONS,
        category: 'plumbing',
      },
      {
        id: 'vanity',
        inputType: 'choice',
        label: 'Vanity & countertop',
        helperText: 'Staying, or remove and install new?',
        options: FIXTURE_CHOICE_NO_RELOCATE,
        category: 'fixtures',
      },
      {
        id: 'shower_tile',
        inputType: 'yes_no',
        label: 'Shower wall tile installation',
        helperText: 'Tile labor and materials for shower walls — not just tile supply.',
        category: 'tile',
      },
      {
        id: 'waterproofing',
        inputType: 'yes_no',
        label: 'Shower waterproofing & backer board',
        helperText: 'Membrane, backer, and prep before tile.',
        category: 'tile',
      },
      {
        id: 'floor_tile',
        inputType: 'yes_no',
        label: 'Floor tile installation',
        helperText: 'Tile labor and materials for bathroom floor.',
        category: 'tile',
      },
      {
        id: 'plumbing_rough',
        inputType: 'yes_no',
        label: 'Plumbing rough-in (new lines / relocation)',
        helperText: 'In-wall plumbing changes — not final fixture hookup only.',
        category: 'plumbing',
      },
      {
        id: 'electrical_rough',
        inputType: 'yes_no',
        label: 'Electrical work (new circuits / boxes)',
        helperText: 'Wiring changes for lights, fans, or GFCI — not bulb swaps.',
        category: 'electrical',
      },
      {
        id: 'lighting',
        inputType: 'yes_no',
        label: 'New lighting fixtures & install',
        helperText: 'Supply and install light fixtures, not just the fixture cost alone.',
        category: 'electrical',
      },
      {
        id: 'drywall',
        inputType: 'yes_no',
        label: 'Drywall repair / patching',
        helperText: 'Patch or replace drywall after plumbing or layout changes.',
        category: 'finishes',
      },
      {
        id: 'paint',
        inputType: 'yes_no',
        label: 'Interior painting (prep + labor + paint)',
        helperText: 'Paint the bathroom walls/ceiling — not paint-only material.',
        category: 'finishes',
      },
      {
        id: 'trim',
        inputType: 'yes_no',
        label: 'Trim & baseboard install',
        helperText: 'Install trim/baseboard labor and materials.',
        category: 'finishes',
      },
      {
        id: 'glass_door',
        inputType: 'yes_no',
        label: 'Glass shower door install',
        helperText: 'Door unit plus install — not customer-supplied only.',
        category: 'fixtures',
      },
      {
        id: 'plumbing_trim',
        inputType: 'yes_no',
        label: 'Final plumbing trim (faucets, toilet set, hookups)',
        helperText: 'Set fixtures and finish connections after rough-in.',
        category: 'plumbing',
      },
      {
        id: 'electrical_trim',
        inputType: 'yes_no',
        label: 'Final electrical trim (devices, plates, bulbs)',
        helperText: 'Finish devices and trim after rough-in.',
        category: 'electrical',
      },
      {
        id: 'permits',
        inputType: 'yes_no',
        label: 'Permits & inspections (you pull / include in bid)',
        helperText: 'Permit fees and inspection coordination in your price.',
        category: 'soft_costs',
      },
      {
        id: 'cleanup',
        inputType: 'yes_no',
        label: 'Jobsite cleanup & disposal',
        helperText: 'Final clean and haul-off / dumpster.',
        category: 'scope',
      },
    ],
  },
  kitchen: {
    title: 'Kitchen remodel — confirm project scope',
    intro:
      'Before pricing, confirm what work is part of this bid. Yes = in your scope. No = not part of this bid. Not sure = we will not auto-price it.',
    items: [
      {
        id: 'demo',
        inputType: 'yes_no',
        label: 'Cabinet & appliance demo',
        helperText: 'Remove existing cabinets, counters, and appliances.',
        category: 'scope',
      },
      {
        id: 'cabinets',
        inputType: 'yes_no',
        label: 'New cabinet install',
        helperText: 'Cabinet supply and installation labor.',
        category: 'cabinets',
      },
      {
        id: 'countertops',
        inputType: 'yes_no',
        label: 'Countertop fabrication & install',
        helperText: 'Template, fabricate, and install counters.',
        category: 'countertops',
      },
      {
        id: 'backsplash',
        inputType: 'yes_no',
        label: 'Backsplash tile install',
        helperText: 'Tile labor and materials for backsplash.',
        category: 'tile',
      },
      {
        id: 'island',
        inputType: 'yes_no',
        label: 'Kitchen island (cabinet + counter)',
        helperText: 'New or expanded island build-out.',
        category: 'cabinets',
      },
      {
        id: 'appliances',
        inputType: 'yes_no',
        label: 'Appliances (supply & hookup)',
        helperText: 'Appliance cost and connection — mark No if customer supplies.',
        category: 'fixtures',
      },
      {
        id: 'flooring',
        inputType: 'yes_no',
        label: 'Kitchen flooring install',
        helperText: 'Floor material and install labor.',
        category: 'flooring',
      },
      {
        id: 'plumbing',
        inputType: 'yes_no',
        label: 'Plumbing changes (sink, dishwasher, gas line)',
        helperText: 'Rough or finish plumbing for kitchen layout.',
        category: 'plumbing',
      },
      {
        id: 'electrical',
        inputType: 'yes_no',
        label: 'Electrical & lighting changes',
        helperText: 'Circuits, outlets, and lighting for kitchen.',
        category: 'electrical',
      },
      {
        id: 'walls_moving',
        inputType: 'choice',
        label: 'Wall layout changes',
        helperText: 'Any walls removed or moved?',
        options: [
          { id: 'no_changes', label: 'No wall changes' },
          { id: 'remove', label: 'Removing wall(s)' },
          { id: 'add', label: 'Adding / moving wall(s)' },
          { id: 'not_in_scope', label: 'Not in this bid' },
          { id: 'unsure', label: 'Not sure yet' },
        ],
        category: 'structural',
      },
      {
        id: 'paint',
        inputType: 'yes_no',
        label: 'Interior painting (prep + labor + paint)',
        helperText: 'Paint kitchen walls/ceiling — not paint-only material.',
        category: 'finishes',
      },
      {
        id: 'permits',
        inputType: 'yes_no',
        label: 'Permits & inspections',
        helperText: 'Permit fees in your bid if you include them.',
        category: 'soft_costs',
      },
      {
        id: 'cleanup',
        inputType: 'yes_no',
        label: 'Jobsite cleanup & disposal',
        helperText: 'Final clean and haul-off.',
        category: 'scope',
      },
    ],
  },
  room_remodel: {
    title: 'Interior remodel — confirm project scope',
    intro:
      'This looks like a multi-trade remodel. Confirm what work is in the bid before we price anything.',
    items: [
      { id: 'demo', inputType: 'yes_no', label: 'Demo / selective tear-out', category: 'scope' },
      { id: 'framing', inputType: 'yes_no', label: 'Framing or layout changes', category: 'structural' },
      { id: 'plumbing', inputType: 'yes_no', label: 'Plumbing work', category: 'plumbing' },
      { id: 'electrical', inputType: 'yes_no', label: 'Electrical work', category: 'electrical' },
      { id: 'hvac', inputType: 'yes_no', label: 'HVAC work', category: 'hvac' },
      { id: 'drywall', inputType: 'yes_no', label: 'Drywall hang / finish', category: 'finishes' },
      { id: 'flooring', inputType: 'yes_no', label: 'Flooring install', category: 'flooring' },
      {
        id: 'paint',
        inputType: 'yes_no',
        label: 'Interior painting (prep + labor + paint)',
        category: 'finishes',
      },
      { id: 'trim', inputType: 'yes_no', label: 'Trim & doors', category: 'finishes' },
      { id: 'permits', inputType: 'yes_no', label: 'Permits & inspections', category: 'soft_costs' },
      { id: 'cleanup', inputType: 'yes_no', label: 'Jobsite cleanup & disposal', category: 'scope' },
    ],
  },
  addition: {
    title: 'Addition / conversion — confirm scope phases',
    intro:
      'Additions include shell, MEP, tie-ins, and permits. Mark each phase Yes if it is part of this bid.',
    items: [
      { id: 'sitework', inputType: 'yes_no', label: 'Sitework & grading', category: 'sitework' },
      { id: 'foundation', inputType: 'yes_no', label: 'Foundation / slab', category: 'structural' },
      { id: 'framing', inputType: 'yes_no', label: 'Framing / shell', category: 'structural' },
      { id: 'roof_tie_in', inputType: 'yes_no', label: 'Roof tie-in to existing', category: 'structural' },
      { id: 'windows_doors', inputType: 'yes_no', label: 'Windows & exterior doors', category: 'exterior' },
      { id: 'plumbing_rough', inputType: 'yes_no', label: 'Plumbing rough-in', category: 'plumbing' },
      { id: 'electrical_rough', inputType: 'yes_no', label: 'Electrical rough-in', category: 'electrical' },
      { id: 'hvac', inputType: 'yes_no', label: 'HVAC', category: 'hvac' },
      { id: 'insulation', inputType: 'yes_no', label: 'Insulation', category: 'envelope' },
      { id: 'drywall', inputType: 'yes_no', label: 'Drywall', category: 'finishes' },
      { id: 'finishes', inputType: 'yes_no', label: 'Interior finishes', category: 'finishes' },
      { id: 'permits', inputType: 'yes_no', label: 'Permits & inspections', category: 'soft_costs' },
      { id: 'engineering', inputType: 'yes_no', label: 'Engineering / drawings', category: 'soft_costs' },
      { id: 'utility_connections', inputType: 'yes_no', label: 'Utility connections', category: 'sitework' },
    ],
  },
  ground_up: {
    title: 'Ground-up build — confirm planning scope',
    intro:
      'New construction needs phase assumptions before a planning estimate. Mark Yes only for work in this bid.',
    items: [
      { id: 'sitework', inputType: 'yes_no', label: 'Sitework & excavation', category: 'sitework' },
      { id: 'foundation', inputType: 'yes_no', label: 'Foundation', category: 'structural' },
      { id: 'framing', inputType: 'yes_no', label: 'Framing', category: 'structural' },
      { id: 'roofing', inputType: 'yes_no', label: 'Roofing', category: 'exterior' },
      { id: 'exterior', inputType: 'yes_no', label: 'Exterior finishes', category: 'exterior' },
      { id: 'mep_rough', inputType: 'yes_no', label: 'MEP rough-in', category: 'mep' },
      { id: 'insulation', inputType: 'yes_no', label: 'Insulation', category: 'envelope' },
      { id: 'drywall', inputType: 'yes_no', label: 'Drywall', category: 'finishes' },
      { id: 'cabinets_counters', inputType: 'yes_no', label: 'Cabinets & countertops', category: 'finishes' },
      { id: 'tile_flooring', inputType: 'yes_no', label: 'Tile & flooring', category: 'finishes' },
      { id: 'paint_trim', inputType: 'yes_no', label: 'Paint & trim', category: 'finishes' },
      { id: 'appliances', inputType: 'yes_no', label: 'Appliances', category: 'fixtures' },
      { id: 'permits', inputType: 'yes_no', label: 'Permits', category: 'soft_costs' },
      { id: 'engineering', inputType: 'yes_no', label: 'Engineering', category: 'soft_costs' },
      { id: 'utility_taps', inputType: 'yes_no', label: 'Utility taps / connections', category: 'sitework' },
      { id: 'contingency', inputType: 'yes_no', label: 'Contingency allowance', category: 'soft_costs' },
      { id: 'overhead_profit', inputType: 'yes_no', label: 'Builder overhead & profit', category: 'soft_costs' },
    ],
  },
};

function notesText(draft, originalNotes) {
  return String(originalNotes || draft?.originalNotes || '').toLowerCase();
}

function hasClearUnitQuantities(draft, notes) {
  if (/\b\d{2,5}\s*(sqft|sq\s*ft|ft²|square\s+feet|lf|linear\s+feet|ln\s*ft)\b/i.test(notes)) {
    return true;
  }
  const pkgs = draft.scopePackages || draft.rooms || [];
  return pkgs.some((p) => {
    const qs = p.scopeQuantities || [];
    return qs.some((q) => q.quantity > 0);
  });
}

function isSimpleUnitBid(draft, originalNotes) {
  const notes = notesText(draft, originalNotes);
  const projectType = String(draft.projectType || 'other').toLowerCase();

  if (REMODEL_KEYWORDS_RE.test(notes)) return false;
  if (
    ['kitchen', 'bathroom', 'room_addition', 'home_addition', 'adu', 'garage_conversion', 'new_build'].includes(
      projectType
    )
  ) {
    return false;
  }

  if (projectType === 'flooring') return true;

  const simpleTypes = new Set(['flooring', 'painting', 'plumbing_service', 'landscaping', 'deck_patio']);
  const simpleNotes =
    /\b(tile demo|tile install|baseboard|laminate|lvp|carpet install|paint(?:ing)?|drywall patch|demo\s+\d+)\b/i.test(
      notes
    );

  if (simpleTypes.has(projectType) && hasClearUnitQuantities(draft, notes)) return true;
  if (simpleNotes && hasClearUnitQuantities(draft, notes) && !REMODEL_KEYWORDS_RE.test(notes)) {
    const roomCount = (draft.rooms || []).length;
    if (roomCount <= 4) return true;
  }

  if (projectType === 'roofing' && /\d+\s*(square|sqft|sq\s*ft)\b/i.test(notes)) return true;

  return false;
}

function classifyEstimateTier(draft, originalNotes) {
  const notes = notesText(draft, originalNotes);
  const projectType = String(draft.projectType || 'other').toLowerCase();

  if (
    projectType === 'new_build' ||
    /\b(new\s+home|custom\s+home|spec\s+home|duplex|ground\s*up|build\s+(?:a\s+)?\d{3,5}\s*sqft\s+(?:home|house))\b/i.test(
      notes
    )
  ) {
    return 'ground_up';
  }

  if (
    ['room_addition', 'home_addition', 'adu', 'garage_conversion'].includes(projectType) ||
    /\b(room\s+addition|home\s+addition|casita|\badu\b|garage\s+conversion|patio\s+enclosure)\b/i.test(notes)
  ) {
    return 'addition';
  }

  if (projectType === 'bathroom' || /\bbath(?:room)?\s+remodel\b/i.test(notes)) {
    return 'room_remodel';
  }

  if (projectType === 'kitchen' || /\bkitchen\s+remodel\b/i.test(notes)) {
    return 'room_remodel';
  }

  if (
    REMODEL_KEYWORDS_RE.test(notes) ||
    /\b(basement\s+finish|laundry\s+remodel|interior\s+renovation)\b/i.test(notes)
  ) {
    return 'room_remodel';
  }

  if (isSimpleUnitBid(draft, originalNotes)) {
    return 'simple_unit';
  }

  if (['other', 'roofing', 'concrete'].includes(projectType)) {
    return 'room_remodel';
  }

  return 'simple_unit';
}

function checklistTemplateKey(draft, estimateTier) {
  const projectType = String(draft.projectType || 'other').toLowerCase();
  const notes = notesText(draft, null);

  if (estimateTier === 'ground_up') return 'ground_up';
  if (estimateTier === 'addition') return 'addition';
  if (projectType === 'bathroom' || /\bbath(?:room)?\s+remodel\b/i.test(notes)) return 'bathroom';
  if (projectType === 'kitchen' || /\bkitchen\s+remodel\b/i.test(notes)) return 'kitchen';
  if (estimateTier === 'room_remodel') return 'room_remodel';
  return 'room_remodel';
}

function inferItemStateFromNotes(itemId, notes) {
  const n = String(notes || '').toLowerCase();
  const yesHints = {
    demo: /\b(demo|demolition|tear\s*out|gut|remove)\b/,
    shower_tile: /\b(shower\s+tile|tile\s+shower|new\s+shower\s+tile)\b/,
    floor_tile: /\b(floor\s+tile|tile\s+floor|new\s+floor\s+tile)\b/,
    cabinets: /\b(cabinet|new\s+cabinets)\b/,
    countertops: /\b(countertop|quartz|granite|install\s+new\s+countertops?)\b/,
    backsplash: /\b(backsplash)\b/,
    island: /\b(island)\b/,
    paint: /\b(paint(?:ing)?|bathroom\s+paint)\b/,
    lighting: /\b(new\s+lighting|lighting)\b/,
    glass_door: /\b(shower\s+door|glass\s+shower)\b/,
    vanity: /\b(vanity|countertops?\s+and\s+vanity)\b/,
    permits: /\b(permit)\b/,
    cleanup: /\b(cleanup|disposal|dumpster|haul\s*off)\b/,
  };
  const noHints = {
    appliances: /\b(no\s+appliances|appliances\s+not\s+included|owner\s+appliances)\b/,
    permits: /\b(no\s+permits|permits\s+not\s+included|owner\s+pulls?\s+permits)\b/,
  };

  if (noHints[itemId]?.test(n)) return 'excluded';
  if (yesHints[itemId]?.test(n)) return 'included';
  return 'unsure';
}

function inferChoiceFromNotes(itemId, notes) {
  const n = String(notes || '').toLowerCase();

  if (itemId === 'toilet') {
    if (/\b(move|relocate|relocating)\b.*\btoilet\b|\btoilet\b.*\b(move|relocate)\b/.test(n)) return 'relocating';
    if (/\b(replace|new|remove\s+and\s+replace)\b.*\btoilet\b|\btoilet\b.*\b(replace|new)\b/.test(n)) {
      return 'replacing';
    }
    if (/\btoilet\b.*\bstay|\bstay.*\btoilet\b/.test(n)) return 'staying';
  }

  if (itemId === 'tub_shower') {
    if (/\b(relocat|move)\b.*\b(shower|tub)\b|\b(shower|tub)\b.*\b(relocat|move)\b/.test(n)) return 'relocating';
    if (/\b(new\s+shower|replace|replacing)\b.*\b(shower|tub)\b|\b(shower|tub)\b.*\b(new|replace)\b/.test(n)) {
      return 'replacing';
    }
  }

  if (itemId === 'vanity') {
    if (/\b(remove\s+and\s+replace|replace|new)\b.*\bvanity\b|\bvanity\b.*\b(replace|new)\b/.test(n)) {
      return 'replacing';
    }
  }

  if (itemId === 'walls_moving') {
    if (/\b(no\s+wall|walls?\s+not\s+moving)\b/.test(n)) return 'no_changes';
    if (/\b(remove|removing)\b.*\bwall/.test(n)) return 'remove';
    if (/\b(add|adding|moving)\b.*\bwall/.test(n)) return 'add';
  }

  return null;
}

function choiceToState(choiceId) {
  if (!choiceId || choiceId === 'unsure') return 'unsure';
  if (choiceId === 'not_in_scope') return 'excluded';
  return 'included';
}

function formatAssumptionLine(item) {
  if (item.inputType === 'choice') {
    const opt = (item.options || []).find((o) => o.id === item.choiceId);
    if (opt && item.choiceId !== 'unsure') {
      return `${item.label}: ${opt.label}`;
    }
    return item.label;
  }
  return item.label;
}

function buildScopeChecklist(draft, estimateTier, originalNotes) {
  if (estimateTier === 'simple_unit') return null;

  const templateKey = checklistTemplateKey(draft, estimateTier);
  const template = CHECKLIST_TEMPLATES[templateKey] || CHECKLIST_TEMPLATES.room_remodel;
  const notes = originalNotes || draft.originalNotes || '';

  const items = template.items.map((item) => {
    const inputType = item.inputType || 'yes_no';
    if (inputType === 'choice') {
      const choiceId = inferChoiceFromNotes(item.id, notes);
      return {
        ...item,
        inputType,
        choiceId: choiceId || null,
        state: choiceToState(choiceId),
      };
    }
    return {
      ...item,
      inputType: 'yes_no',
      state: inferItemStateFromNotes(item.id, notes),
    };
  });

  const inScopeCount = items.filter((i) => i.state === 'included').length;
  const unsureCount = items.filter((i) => i.state === 'unsure').length;
  const outOfScopeCount = items.filter((i) => i.state === 'excluded').length;

  return {
    estimateTier,
    templateKey,
    title: template.title,
    intro: template.intro,
    legend:
      'Yes = this work is part of your bid scope. No = not part of this bid. Not sure = we will not auto-price it.',
    items,
    options: [
      { id: 'scope_only', label: 'Build scope only (no pricing yet)' },
      { id: 'rough_range', label: 'Create rough budget range' },
      { id: 'clarify', label: 'Ask me missing questions' },
      { id: 'standard_assumptions', label: 'Use standard mid-grade assumptions' },
    ],
    summary: `${inScopeCount} in scope · ${unsureCount} not sure · ${outOfScopeCount} out of scope`,
    requiresConfirmation: true,
  };
}

function parseScopeMeasurementNumber(value) {
  const n = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

function packageAcceptsSqftMeasurement(name, scope) {
  const blob = `${name} ${scope}`.toLowerCase();
  if (
    /\b(toilet|vanity|sink|tub|bathtub|shower\s+door|glass\s+door|faucet|fixture)\b/.test(blob) &&
    /\binstall/.test(blob)
  ) {
    return false;
  }
  if (/\b(baseboard|trim|crown|moulding|molding|casing)\b/.test(blob) && !/\btile\b/.test(blob)) {
    return false;
  }
  return (
    /\btile\b|\bpaint|\bconcrete\b|\bframing\b|\bdrywall\b|\bfloor|\bdemo\b|\bremoval\b|\bshower\b|\bwall\b|\broof\b|\bsiding\b|\binsulation\b|\bsheetrock\b/.test(
      blob
    ) ||
    /\binstall|\bflooring\b|\blvp\b|\blaminate\b|\bvinyl\b|\bcarpet\b/.test(blob)
  );
}

function packageAcceptsLfMeasurement(name, scope) {
  const blob = `${name} ${scope}`.toLowerCase();
  return /\b(baseboard|trim|crown|moulding|molding|casing)\b/.test(blob);
}

function packageHasUnitQuantity(pkg, unit) {
  return (pkg.scopeQuantities || []).some((q) => q.unit === unit && Number(q.quantity) > 0);
}

/** Map confirmed scope checklist answers to pricing scope packages. */
const CHECKLIST_ITEM_TO_TASK_ID = {
  demo: { bathroom: 'bath_demo', kitchen: 'kitchen_demo', default: 'bath_demo' },
  shower_tile: 'shower_tile',
  paint: 'interior_paint',
  trim: 'baseboard_install',
  cabinets: 'cabinet_install',
  countertop: 'countertop_install',
  backsplash: 'backsplash_install',
  plumbing_rough: 'bath_plumbing',
};

/** Checklist items without a SCOPE_TASKS row — created as named scope packages. */
const CHECKLIST_EXTRA_ROOMS = {
  waterproofing: {
    name: 'Shower Waterproofing & Backer Board',
    scope: 'Shower waterproofing membrane and backer board before tile',
    usesSqft: true,
  },
  electrical_rough: {
    name: 'Electrical Work (Bathroom)',
    scope: 'New circuits, boxes, and wiring for bathroom',
  },
  lighting: {
    name: 'Lighting Fixtures & Install',
    scope: 'Supply and install light fixtures',
  },
  drywall: {
    name: 'Drywall Repair / Patching',
    scope: 'Drywall patch or replace after plumbing or layout changes',
    usesSqft: true,
  },
  glass_door: {
    name: 'Glass Shower Door Install',
    scope: 'Shower door or enclosure supply and install',
    isFixture: true,
  },
  plumbing_trim: {
    name: 'Plumbing Trim (Bathroom)',
    scope: 'Set fixtures and finish plumbing connections',
  },
  electrical_trim: {
    name: 'Electrical Trim (Bathroom)',
    scope: 'Finish devices, plates, and bulbs',
  },
  permits: {
    name: 'Permits & Inspections',
    scope: 'Permit fees and inspection coordination',
  },
  cleanup: {
    name: 'Jobsite Cleanup & Disposal',
    scope: 'Final clean, haul-off, and disposal',
  },
  floor_tile: {
    name: 'Floor Tile Installation',
    scope: 'Bathroom floor tile labor and materials',
    usesSqft: true,
  },
};

const CHOICE_CHECKLIST_TO_TASK_ID = {
  toilet: 'toilet_install',
  vanity: 'vanity_install',
  tub_shower: 'shower_tile',
};

function checklistItemInBidScope(item) {
  if (item.inputType === 'choice') {
    return Boolean(item.choiceId && item.choiceId !== 'not_in_scope' && item.choiceId !== 'unsure');
  }
  return item.state === 'included';
}

function resolveTaskIdForChecklistItem(item, templateKey) {
  if (!checklistItemInBidScope(item)) return null;

  // floor_tile uses a dedicated package name (not generic Tile Installation)
  if (item.id === 'floor_tile') return null;

  const mapped = CHECKLIST_ITEM_TO_TASK_ID[item.id];
  if (typeof mapped === 'string') return mapped;
  if (mapped && typeof mapped === 'object') {
    return mapped[templateKey] || mapped.default || null;
  }

  if (CHOICE_CHECKLIST_TO_TASK_ID[item.id]) {
    if (item.id === 'tub_shower' && item.choiceId === 'staying') return null;
    return CHOICE_CHECKLIST_TO_TASK_ID[item.id];
  }

  return null;
}

function roomMatchesTask(rooms, task) {
  const taskName = String(task.name || '').toLowerCase();
  return (rooms || []).some((room) => {
    const name = String(room.name || '').toLowerCase();
    return name === taskName || task.roomMatch(name);
  });
}

function roomExistsByLabel(rooms, label) {
  const key = String(label || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  if (!key) return false;
  return (rooms || []).some((room) => {
    const name = String(room.name || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
    return name === key || name.includes(key.slice(0, 20)) || key.includes(name.slice(0, 20));
  });
}

function emptyRoomFromChecklistExtra(itemId, extra, notes, measurements) {
  const ctx = { measurements, notes, packageName: extra.name };
  const resolved = resolveQuantityForChecklistItem(itemId, ctx);
  const scopeQuantities = [];
  if (resolved.pricingReady && resolved.quantity != null) {
    scopeQuantities.push({
      label: extra.name,
      quantity: resolved.quantity,
      unit: resolved.unit,
      quantitySource: resolved.quantitySource,
    });
  }
  return {
    name: extra.name,
    scope: extra.scope,
    scopeQuantities: scopeQuantities.length ? scopeQuantities : undefined,
    price: null,
    laborPrice: null,
    materialPrice: null,
    priceIncludesLaborAndMaterials: false,
    priceProvidedByUser: false,
    pricingItems: [],
    missingPriceItems: [],
  };
}

function addScopePackagesFromConfirmedChecklist(draft, confirmedItems, scopeMeasurements) {
  if (!Array.isArray(confirmedItems) || !confirmedItems.length) return draft;

  const templateKey =
    draft.scopeChecklist?.templateKey ||
    checklistTemplateKey(draft, draft.estimateTier || classifyEstimateTier(draft, draft.originalNotes));

  const taskIds = new Set();
  const extraIds = [];
  const fallbackItems = [];

  for (const item of confirmedItems) {
    if (!checklistItemInBidScope(item)) continue;
    const taskId = resolveTaskIdForChecklistItem(item, templateKey);
    if (taskId) {
      taskIds.add(taskId);
      continue;
    }
    if (CHECKLIST_EXTRA_ROOMS[item.id]) {
      extraIds.push(item.id);
      continue;
    }
    fallbackItems.push(item);
  }

  const notes = String(draft.originalNotes || '').trim();
  const rooms = [...(draft.rooms || [])];

  for (const taskId of taskIds) {
    const task = SCOPE_TASKS.find((t) => t.id === taskId);
    if (!task || roomMatchesTask(rooms, task)) continue;
    rooms.push(emptyScopeRoom(task, notes));
  }

  for (const itemId of extraIds) {
    const extra = CHECKLIST_EXTRA_ROOMS[itemId];
    if (!extra || roomExistsByLabel(rooms, extra.name)) continue;
    rooms.push(emptyRoomFromChecklistExtra(itemId, extra, notes, scopeMeasurements));
  }

  for (const item of fallbackItems) {
    const name = String(item.label || 'Scope item')
      .replace(/\s*—.*$/, '')
      .trim();
    if (!name || roomExistsByLabel(rooms, name)) continue;
    rooms.push({
      name,
      scope: item.helperText || item.label || name,
      price: null,
      laborPrice: null,
      materialPrice: null,
      priceIncludesLaborAndMaterials: false,
      priceProvidedByUser: false,
      pricingItems: [],
      missingPriceItems: [],
    });
  }

  if (rooms.length === (draft.rooms || []).length) return draft;
  return { ...draft, rooms };
}

function applyScopeMeasurements(draft, measurements) {
  const norm = normalizeScopeMeasurements(measurements);
  const hasAny =
    norm.bathroomFloorSqft ||
    norm.baseboardLf ||
    norm.showerWallTileSqft ||
    norm.wallPaintSqft ||
    Object.keys(norm.itemQuantities || {}).length > 0;
  if (!hasAny) return draft;

  let originalNotes = String(draft.originalNotes || '').trim();
  const noteParts = [];
  if (
    norm.bathroomFloorSqft &&
    !/\d[\d,]*(?:\.\d+)?\s*(?:sq\.?\s*ft|sqft|\bsf\b|ft\.?\s*²)/i.test(originalNotes)
  ) {
    noteParts.push(`${norm.bathroomFloorSqft} sqft bathroom floor`);
  }
  if (
    norm.baseboardLf &&
    !/\d[\d,]*(?:\.\d+)?\s*(?:lf|linear\s*feet|linear\s*ft)/i.test(originalNotes)
  ) {
    noteParts.push(`${norm.baseboardLf} lf baseboard`);
  }
  if (noteParts.length) {
    originalNotes = originalNotes ? `${originalNotes}\n${noteParts.join(', ')}` : noteParts.join(', ');
  }

  const ctx = { measurements: norm, notes: originalNotes };

  return {
    ...draft,
    scopeMeasurements: {
      sqft: norm.bathroomFloorSqft,
      lf: norm.baseboardLf,
      bathroomFloorSqft: norm.bathroomFloorSqft,
      baseboardLf: norm.baseboardLf,
      showerWallTileSqft: norm.showerWallTileSqft,
      wallPaintSqft: norm.wallPaintSqft,
      itemQuantities: norm.itemQuantities,
    },
    originalNotes,
    scopePackages: (draft.scopePackages || []).map((pkg) => stampPackageWithCatalogRules(pkg, ctx)),
    rooms: (draft.rooms || []).map((pkg) => stampPackageWithCatalogRules(pkg, ctx)),
  };
}

function applyScopeAssumptions(draft, confirmedItems, scopeMeasurements) {
  if (!draft || !Array.isArray(confirmedItems)) return draft;

  const included = [];
  const excluded = [];
  const unsure = [];

  for (const item of confirmedItems) {
    const line = formatAssumptionLine(item);
    if (item.inputType === 'choice') {
      if (item.choiceId === 'not_in_scope') excluded.push(line);
      else if (item.choiceId && item.choiceId !== 'unsure') included.push(line);
      else unsure.push(line);
      continue;
    }
    if (item.state === 'included') included.push(line);
    else if (item.state === 'excluded') excluded.push(line);
    else unsure.push(line);
  }

  const newInclusions = [...new Set([...(draft.inclusions || []), ...included])];
  const newExclusions = [...new Set([...(draft.exclusions || []), ...excluded])];
  const assumptionNotes = [];
  if (unsure.length > 0) {
    assumptionNotes.push(`${unsure.length} scope item(s) still not confirmed — review before bidding`);
  }
  if (excluded.length > 0) {
    assumptionNotes.push(`${excluded.length} item(s) marked not in this bid`);
  }

  const missingInfo = [
    ...new Set([
      ...(draft.missingInfo || []),
      ...unsure.map((label) => `Confirm scope: ${label}`),
      ...assumptionNotes,
    ]),
  ].slice(0, 16);

  const withChecklistPackages = addScopePackagesFromConfirmedChecklist(
    draft,
    confirmedItems,
    scopeMeasurements
  );

  const merged = {
    ...withChecklistPackages,
    scopeAssumptionsConfirmed: true,
    confirmedAssumptions: confirmedItems,
    inclusions: newInclusions,
    exclusions: newExclusions,
    missingInfo,
    pricingWarnings: [
      ...(draft.pricingWarnings || []),
      ...(draft.estimateTier === 'ground_up'
        ? ['Ground-up planning estimate — verify phases, soft costs, and subs before bidding']
        : ['Complex job — pricing applies only to confirmed scope']),
    ].filter((w, i, arr) => arr.indexOf(w) === i),
  };

  return applyScopeMeasurements(merged, scopeMeasurements);
}

function enrichDraftComplexity(draft, originalNotes) {
  const estimateTier = classifyEstimateTier(draft, originalNotes);
  const scopeChecklist =
    estimateTier === 'simple_unit' ? null : buildScopeChecklist(draft, estimateTier, originalNotes);

  return {
    estimateTier,
    scopeChecklist,
    scopeAssumptionsConfirmed: Boolean(draft.scopeAssumptionsConfirmed),
    requiresScopeConfirmation: estimateTier !== 'simple_unit' && !draft.scopeAssumptionsConfirmed,
  };
}

function isComplexEstimateTier(estimateTier) {
  return Boolean(estimateTier && estimateTier !== 'simple_unit');
}

module.exports = {
  VALID_ESTIMATE_TIERS,
  classifyEstimateTier,
  buildScopeChecklist,
  applyScopeAssumptions,
  applyScopeMeasurements,
  addScopePackagesFromConfirmedChecklist,
  enrichDraftComplexity,
  isComplexEstimateTier,
  isSimpleUnitBid,
};
