/**
 * Estimate tier classification and scope-assumption checklists for complex jobs.
 * Simple unit bids (flooring, clear qty × rate) skip the checklist gate.
 */

const { SCOPE_TASKS, emptyScopeRoom } = require('./estimateDraftScopeSplit');
const {
  QUANTITY_SOURCES,
  normalizeScopeMeasurements,
  resolveQuantityForChecklistItem,
  getRuleForChecklistItem,
  stampPackageWithCatalogRules,
} = require('./scopeItemQuantityCatalog');
const { parseScopeMeasurementsFromNotes } = require('./scopeMeasurementParser');
const {
  CHECKLIST_TEMPLATES,
  CHECKLIST_LEGEND,
  checklistTemplateKey,
  inferItemStateFromNotes,
  inferChoiceFromNotes,
  inferChoicesFromNotes,
  choiceToState,
  choiceIdsToState,
} = require('./scopeChecklistLibrary');

const VALID_ESTIMATE_TIERS = new Set([
  'simple_unit',
  'room_remodel',
  'addition',
  'ground_up',
]);

const REMODEL_KEYWORDS_RE =
  /\b(remodel|renovation|gut\s*(?:out|job)?|full\s+(?:bath|kitchen|remodel)|demo\s+and\s+rebuild)\b/i;

const MULTI_TRADE_PROJECT_TYPES = new Set([
  'landscaping',
  'concrete',
  'excavation',
  'framing',
  'plumbing_service',
  'electrical',
  'hvac',
  'deck_patio',
  'roofing',
  'painting',
  'drywall',
  'room_addition',
  'home_addition',
  'adu',
  'garage_conversion',
  'new_build',
  'other',
]);

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

function hasMultipleFlooringScopeParts(draft, notes) {
  const parts = new Set();
  const chunks = [
    notes,
    ...((draft.rooms || []).map((room) => `${room.name || ''} ${room.scope || ''}`)),
    ...((draft.scopePackages || []).map((pkg) => `${pkg.name || ''} ${pkg.scope || ''}`)),
  ];

  for (const chunk of chunks) {
    const text = String(chunk || '').toLowerCase();
    if (!text) continue;
    if (/\b(demo|demolition|remove|removal|tear\s*out)\b.*\b(tile|floor|flooring|lvp|vinyl|laminate|carpet)\b|\b(tile|floor|flooring|lvp|vinyl|laminate|carpet)\b.*\b(demo|demolition|remove|removal|tear\s*out)\b/.test(text)) {
      parts.add('demo');
    }
    if (/\b(lvp|laminate|vinyl|carpet|flooring|floor\s+tile|tile\s+floor)\b.*\b(install|installation)\b|\b(install|installation)\b.*\b(lvp|laminate|vinyl|carpet|flooring|floor\s+tile|tile\s+floor)\b/.test(text)) {
      parts.add('install');
    }
    if (/\b(baseboard|trim|crown|moulding|molding|casing)\b/.test(text)) {
      parts.add('trim');
    }
    if (/\b(floor\s+prep|subfloor|level(?:ing)?|underlayment)\b/.test(text)) {
      parts.add('prep');
    }
  }

  return parts.size > 1;
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
  if (MULTI_TRADE_PROJECT_TYPES.has(projectType) && projectType !== 'flooring' && projectType !== 'painting') {
    return false;
  }

  if (projectType === 'flooring') {
    return hasClearUnitQuantities(draft, notes) && !hasMultipleFlooringScopeParts(draft, notes);
  }

  const simpleTypes = new Set(['painting', 'plumbing_service', 'landscaping', 'deck_patio']);
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
    /\b(new\s+home|custom\s+home|spec\s+home|duplex|ground\s*up|new\s+construction|new\s+build|build\s+(?:a\s+)?\d{3,5}\s*sqft\s+(?:home|house))\b/i.test(
      notes
    )
  ) {
    return 'ground_up';
  }

  // Step 1 plan-import handoff: whole-home architectural takeoff without remodel language.
  if (
    !REMODEL_KEYWORDS_RE.test(notes) &&
    /\b(plan\s+imported|imported\s+architectural\s+plans?|detected\s+spaces?|scope\s+items?)\b/i.test(notes) &&
    (/\b\d{1,3}(?:,\d{3})+\s*SF\b/i.test(notes) || /\b[1-9]\d{2,4}\s*SF\b/i.test(notes))
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
    /\b(basement\s+finish(?:ing)?|finished\s+basement|laundry\s+remodel|interior\s+renovation|insurance\s+(?:repair|restoration)|restoration|mixed\s+repair)\b/i.test(notes)
  ) {
    return 'room_remodel';
  }

  if (isSimpleUnitBid(draft, originalNotes)) {
    return 'simple_unit';
  }

  if (MULTI_TRADE_PROJECT_TYPES.has(projectType) || ['other', 'flooring', 'roofing', 'concrete'].includes(projectType)) {
    return 'room_remodel';
  }

  return 'simple_unit';
}

function formatAssumptionLine(item) {
  if (item.inputType === 'multi_choice') {
    const ids = Array.isArray(item.choiceIds) ? item.choiceIds : [];
    const labels = (item.options || [])
      .filter((o) => ids.includes(o.id) && o.id !== 'unsure')
      .map((o) => o.label);
    if (labels.length) return `${item.label}: ${labels.join(', ')}`;
    return item.label;
  }
  if (item.inputType === 'choice') {
    const opt = (item.options || []).find((o) => o.id === item.choiceId);
    if (opt && item.choiceId !== 'unsure') {
      return `${item.label}: ${opt.label}`;
    }
    return item.label;
  }
  return item.label;
}

const NOTE_BACKED_SCOPE_LABELS = {
  tear_off: ['Tear-off / removal', 'Remove existing roofing or shingles.'],
  shingles_roofing: ['Shingles / roofing install', 'Install new roofing material.'],
  concrete: ['Concrete work', 'Concrete labor and materials from notes.'],
  pour_flatwork: ['Concrete flatwork', 'Pour slab, patio, driveway, or sidewalk flatwork.'],
  concrete_patio: ['Concrete patio / flatwork', 'Concrete patio or flatwork from notes.'],
  excavation: ['Excavation / grading', 'Excavation, trenching, or grading from notes.'],
  decking: ['Decking / surface install', 'Deck surface labor and materials from notes.'],
  railing: ['Railing / guardrails', 'Railing labor and materials from notes.'],
  sod_turf: ['Sod / turf', 'Sod or turf labor and materials from notes.'],
  pavers: ['Pavers', 'Paver labor and materials from notes.'],
  rock_mulch: ['Rock / mulch', 'Rock, mulch, or gravel from notes.'],
  hang: ['Hang drywall', 'Drywall hang labor and materials from notes.'],
  finish_tape: ['Tape / mud / finish', 'Drywall finish from notes.'],
  patch_repair: ['Patch / repair', 'Drywall patch or repair from notes.'],
  interior_paint: ['Interior paint', 'Interior paint labor and materials from notes.'],
  exterior_paint: ['Exterior paint', 'Exterior paint labor and materials from notes.'],
  trim: ['Trim / baseboard', 'Trim or baseboard labor and materials from notes.'],
};

const NOTE_BACKED_TEMPLATE_ALIASES = {
  demo: ['floor_demo'],
  interior_paint: ['paint'],
};

function noteBackedChecklistItems(templateItems, parsedMeasurements) {
  const itemQuantities = parsedMeasurements?.itemQuantities || {};
  const templateIds = new Set(templateItems.map((item) => item.id));
  const added = new Set();
  const out = [];

  for (const key of Object.keys(itemQuantities)) {
    const itemId = key.replace(/__(?:material|labor|allowance)$/, '');
    if (!itemId || added.has(itemId) || templateIds.has(itemId)) continue;
    const aliases = NOTE_BACKED_TEMPLATE_ALIASES[itemId] || [];
    if (aliases.some((alias) => templateIds.has(alias))) continue;
    const rule = getRuleForChecklistItem(itemId);
    if (!rule) continue;
    const [label, helperText] = NOTE_BACKED_SCOPE_LABELS[itemId] || [
      itemId.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()),
      'Scope item found in notes.',
    ];
    added.add(itemId);
    out.push({
      id: itemId,
      inputType: 'yes_no',
      label,
      helperText,
      category: 'from_notes',
      state: 'included',
      noteBacked: true,
    });
  }

  return out;
}

function buildScopeChecklist(draft, estimateTier, originalNotes) {
  if (estimateTier === 'simple_unit') return null;

  const templateKey = checklistTemplateKey(draft, estimateTier);
  const template = CHECKLIST_TEMPLATES[templateKey] || CHECKLIST_TEMPLATES.room_remodel;
  const notes = originalNotes || draft.originalNotes || '';

  const parsedMeasurements = parseScopeMeasurementsFromNotes(notes, {
    templateKey,
    projectType: draft.projectType,
  });

  const items = template.items.map((item) => {
    const inputType = item.inputType || 'yes_no';
    if (inputType === 'multi_choice') {
      const choiceIds = inferChoicesFromNotes(item.id, notes);
      return {
        ...item,
        inputType,
        choiceIds,
        choiceId: choiceIds[0] || null,
        state: choiceIdsToState(choiceIds),
      };
    }
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

  // Ground-up soft costs are almost always in the bid. Notes often mention "plans"
  // but not "permits", which left permits stuck on Not sure with pricing hidden.
  if (templateKey === 'ground_up') {
    const softCostDefaults = new Set(['plans_engineering', 'permits']);
    for (let i = 0; i < items.length; i++) {
      const row = items[i];
      if (!softCostDefaults.has(row.id) || row.state !== 'unsure') continue;
      if (inferItemStateFromNotes(row.id, notes) === 'excluded') continue;
      items[i] = { ...row, state: 'included' };
    }
  }

  const panIdx = items.findIndex((i) => i.id === 'wet_area_install' || i.id === 'shower_pan');
  const showerFloorIdx = items.findIndex((i) => i.id === 'shower_floor_tile');
  const panChoice = panIdx >= 0 ? items[panIdx].choiceId : null;
  if (panIdx >= 0 && showerFloorIdx >= 0 && panChoice === 'tile_pan') {
    if (items[showerFloorIdx].state === 'unsure') {
      items[showerFloorIdx] = { ...items[showerFloorIdx], state: 'included' };
    }
  }

  if (templateKey === 'kitchen') {
    const removalIdx = items.findIndex((i) => i.id === 'appliance_removal');
    const reinstallIdx = items.findIndex((i) => i.id === 'appliances');
    const notesSayAlreadyRemoved = inferItemStateFromNotes('appliance_removal', notes) === 'excluded';
    if (
      removalIdx >= 0 &&
      reinstallIdx >= 0 &&
      items[reinstallIdx].state === 'included' &&
      items[removalIdx].state === 'unsure' &&
      !notesSayAlreadyRemoved
    ) {
      items[removalIdx] = { ...items[removalIdx], state: 'included' };
    }

    const cabinetsIdx = items.findIndex((i) => i.id === 'cabinets');
    const countertopsIdx = items.findIndex((i) => i.id === 'countertops');
    if (cabinetsIdx >= 0 && countertopsIdx >= 0) {
      const n = String(notes || '').toLowerCase();
      const combinedCabinetsCounters =
        /\b(cabinets?|cabinetry)\b/.test(n) && /\b(counters?|countertops?|quartz|granite)\b/.test(n);
      const cabinetEntry = (() => {
        try {
          const { parseScopeMeasurementsFromNotes } = require('./scopeMeasurementParser');
          return parseScopeMeasurementsFromNotes(notes, { templateKey: 'kitchen' }).itemQuantities?.cabinets;
        } catch {
          return null;
        }
      })();
      const combined =
        combinedCabinetsCounters || Boolean(cabinetEntry?.includesCountertops);
      if (items[cabinetsIdx].state === 'included' && combined) {
        const cabinetAmt = cabinetEntry?.quantity;
        items[cabinetsIdx] = {
          ...items[cabinetsIdx],
          helperText: 'Cabinet supply and installation — allowance includes countertops.',
        };
        if (items[countertopsIdx].state !== 'excluded') {
          items[countertopsIdx] = {
            ...items[countertopsIdx],
            state: 'included',
            helperText: cabinetAmt
              ? `Included in the $${Number(cabinetAmt).toLocaleString()} cabinet allowance — not priced separately.`
              : 'Included in cabinet allowance — confirm only if priced separately.',
          };
        }
      }
    }
  }

  items.push(...noteBackedChecklistItems(items, parsedMeasurements));

  if (templateKey === 'bathroom' && !items.some((i) => i.id === 'toilet')) {
    const templateToilet = template.items.find((i) => i.id === 'toilet');
    if (templateToilet) {
      const lightingIdx = items.findIndex((i) => i.id === 'lighting');
      const insertAt = lightingIdx >= 0 ? lightingIdx : items.length;
      items.splice(insertAt, 0, {
        ...templateToilet,
        inputType: 'choice',
        choiceId: null,
        state: 'unsure',
      });
    }
  }

  const inScopeCount = items.filter((i) => i.state === 'included').length;
  const unsureCount = items.filter((i) => i.state === 'unsure').length;
  const outOfScopeCount = items.filter((i) => i.state === 'excluded').length;

  return {
    estimateTier,
    templateKey,
    title: template.title,
    intro: template.intro,
    legend: CHECKLIST_LEGEND,
    items,
    suggestedMeasurements: (() => {
      return Object.keys(parsedMeasurements).length ? parsedMeasurements : undefined;
    })(),
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
    scope:
      'Shower wall backer board (Hardie, foam, or DensShield-class), RedGard-class liquid membrane, vapor barrier, seam tape, screws, and wall-cavity insulation before tile',
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
    name: 'Cleanup, Haul-off & Disposal',
    scope: 'Final clean, debris haul-off, dump fees',
  },
  floor_demo: {
    name: 'Flooring Demo / Removal',
    scope: 'Remove existing floor tile, LVP, vinyl, or flooring',
    usesSqft: true,
  },
  appliance_removal: {
    name: 'Appliance Removal',
    scope: 'Disconnect and remove existing kitchen appliances',
    isFixture: true,
  },
  tub_demo: {
    name: 'Tub Removal / Demo',
    scope: 'Remove and dispose of existing bathtub',
    isFixture: true,
  },
  shower_floor_demo: {
    name: 'Shower Pan / Floor Demo',
    scope: 'Remove existing shower pan, base, or shower floor tile',
    usesSqft: true,
  },
  tub_install: {
    name: 'Tub Installation',
    scope: 'Supply and install bathtub — labor and materials (alcove, drop-in, or freestanding)',
    isFixture: true,
  },
  shower_pan: {
    name: 'Tile Shower Pan (Mud Pan)',
    scope: 'Build tile shower pan — liner, concrete/mud, entry curb, drain, and pan labor',
    usesSqft: true,
  },
  prefab_shower_pan: {
    name: 'Prefab Shower Pan Install',
    scope: 'Supply and install prefab shower pan or acrylic base — labor and materials',
    isFixture: true,
  },
  shower_floor_tile: {
    name: 'Shower Floor Tile Installation',
    scope: 'Shower floor tile labor and materials',
    usesSqft: true,
  },
  shower_niche: {
    name: 'Shower Niche',
    scope: 'Frame, waterproof, and tile shower niche',
    isFixture: true,
  },
  shower_bench: {
    name: 'Shower Bench',
    scope: 'Build, waterproof, and tile a shower bench',
  },
  shower_bench_curb: {
    name: 'Shower Bench',
    scope: 'Build, waterproof, and tile a shower bench',
  },
  exhaust_fan: {
    name: 'Exhaust Fan / Ventilation',
    scope: 'Replace or install bath fan and ducting if needed',
    isFixture: true,
  },
  mirror_accessories: {
    name: 'Mirror & Bath Accessories',
    scope: 'Install mirror, towel bars, paper holder, hooks, or accessories',
  },
  floor_prep: {
    name: 'Subfloor / Floor Prep',
    scope: 'Leveling, patching, underlayment, or repair before flooring',
    usesSqft: true,
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
};

function checklistItemInBidScope(item) {
  if (item.inputType === 'multi_choice') {
    const ids = Array.isArray(item.choiceIds) ? item.choiceIds : [];
    if (!ids.length || ids.includes('not_in_scope') || ids.includes('unsure')) return false;
    if (ids.includes('no_changes') && !ids.some((id) => id === 'remove' || id === 'add')) return false;
    return ids.some((id) => id === 'remove' || id === 'add');
  }
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

function roomExistsByExactLabel(rooms, label) {
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
    return name === key;
  });
}

function roomHasConfirmedPricing(room) {
  const price = Number(room?.price || room?.knownSubtotal || room?.calculatedSubtotal || 0);
  const laborPrice = Number(room?.laborPrice || 0);
  const materialPrice = Number(room?.materialPrice || 0);
  return (
    price > 0 ||
    laborPrice > 0 ||
    materialPrice > 0 ||
    room?.priceProvidedByUser === true ||
    room?.status === 'user_provided' ||
    room?.packageStatus === 'user_provided' ||
    room?.priceSource === 'user_provided'
  );
}

function canonicalScopeKey(text) {
  const t = String(text || '').toLowerCase();
  if (/\b(shower\s+tile|shower\s+wall\s+tile|tile\s+shower)\b/.test(t)) return 'shower_tile';
  if (
    /\b(demo|demolition|remove|removal|tear[\s-]?out)\b/.test(t) &&
    /\b(tile|floor|flooring|lvp|vinyl|laminate|carpet)\b/.test(t)
  ) {
    return 'floor_demo';
  }
  if (
    /\b(install|installation)\b/.test(t) &&
    /\b(lvp|laminate|vinyl|carpet|flooring|floor)\b/.test(t) &&
    !/\b(demo|demolition|remove|removal|tear[\s-]?out)\b/.test(t)
  ) {
    return 'flooring';
  }
  if (/\b(rail(?:ing)?|guardrail|metal\s+railing)\b/.test(t)) return 'railing';
  if (/\b(rock|mulch|gravel)\b/.test(t)) return 'rock_mulch';
  if (/\b(deck(?:ing)?|composite\s+deck)\b/.test(t)) return 'decking';
  // Landscaping helpers say "Not driveway flatwork" — must not collapse into concrete.
  if (/\blandscap|\bsite\s+walls?\b|\bfences?\s*(?:&|and|\/)\s*gates?\b/.test(t)) return 'landscaping';
  if (/\bexterior\s+concrete\s+flatwork\b|\bpour_flatwork\b/.test(t)) return 'pour_flatwork';
  if (
    /\b(concrete|flatwork|slab|driveway|sidewalk)\b/.test(t) &&
    !/\bnot\b.{0,60}\b(driveway|flatwork)\b/.test(t)
  ) {
    return 'concrete';
  }
  if (/\bfinish\s+carpentry\b|\binterior\s+trim\b/.test(t)) return 'interior_trim';
  if (/\b(baseboard|trim|crown|moulding|molding|casing)\b/.test(t)) return 'trim';
  return null;
}

function roomExistsForChecklistItem(rooms, item) {
  const itemId = String(item?.id || '').trim();
  if (itemId) {
    const byId = (rooms || []).some(
      (room) =>
        String(room.checklistItemId || '').trim() === itemId ||
        String(room.costCode || '').trim() === itemId
    );
    if (byId) return true;
  }
  const itemKey = canonicalScopeKey(`${item.id} ${item.label || ''} ${item.helperText || ''}`);
  if (!itemKey) return false;
  return (rooms || []).some((room) => {
    const roomKey = canonicalScopeKey(`${room.name || ''} ${room.scope || ''}`);
    return roomKey === itemKey;
  });
}

function defaultMissingPriceItemsForExtra(itemId) {
  const map = {
    tub_install: ['Tub / surround materials', 'Tub install labor'],
    prefab_shower_pan: ['Prefab pan / base materials', 'Shower pan install labor'],
    shower_pan: ['Pan liner, drain & mud materials', 'Mud pan build & curb frame labor'],
  };
  return map[itemId] || ['Materials / supplies', 'Install labor'];
}

function customChecklistRoomFromMeasurements(item, measurements) {
  const norm = normalizeScopeMeasurements(measurements);
  const itemQuantities = norm.itemQuantities || {};
  const itemId = item.id;
  const base = itemQuantities[itemId];
  const allowance = itemQuantities[`${itemId}__allowance`];
  const material = itemQuantities[`${itemId}__material`];
  const labor = itemQuantities[`${itemId}__labor`];
  const materialPrice = parseScopeMeasurementNumber(material?.quantity);
  const laborPrice = parseScopeMeasurementNumber(labor?.quantity);
  const allowancePrice =
    parseScopeMeasurementNumber(allowance?.quantity) ||
    (base?.unit === 'allowance' ? parseScopeMeasurementNumber(base.quantity) : null);
  const splitTotal = (materialPrice || 0) + (laborPrice || 0);
  const total = allowancePrice || (splitTotal > 0 ? splitTotal : null);
  const basisQuantity =
    base?.unit && base.unit !== 'allowance' ? parseScopeMeasurementNumber(base.quantity) : null;
  const name = String(item.label || 'Custom scope item')
    .replace(/\s*—.*$/, '')
    .trim();
  const scopeQuantities = [];

  if (basisQuantity) {
    scopeQuantities.push({
      label: name,
      quantity: basisQuantity,
      unit: base.unit || 'unit',
      quantitySource: base.quantitySource || QUANTITY_SOURCES.user_entered,
    });
  } else if (allowancePrice) {
    scopeQuantities.push({
      label: `${name} — total`,
      quantity: allowancePrice,
      unit: 'allowance',
      quantitySource: allowance?.quantitySource || base?.quantitySource || QUANTITY_SOURCES.user_entered,
    });
  }

  return {
    name,
    category: 'custom',
    scope: item.helperText || item.label || name,
    scopeQuantities: scopeQuantities.length ? scopeQuantities : undefined,
    price: total,
    knownSubtotal: total,
    calculatedSubtotal: total,
    laborPrice: laborPrice || null,
    materialPrice: materialPrice || null,
    priceIncludesLaborAndMaterials: Boolean(total && !(materialPrice && laborPrice)),
    priceProvidedByUser: Boolean(total),
    pricingType: materialPrice || laborPrice ? 'split' : total ? 'lump_sum' : 'unknown',
    priceSource: total ? 'user_provided' : 'missing',
    status: total ? 'user_provided' : 'missing_price',
    pricingItems: [],
    missingPriceItems: total ? [] : ['Materials / supplies', 'Install labor'],
    budgetSplitBasis: basisQuantity ? { quantity: basisQuantity, unit: base.unit || 'unit' } : null,
    applyEligible: Boolean(total),
  };
}

function emptyRoomFromChecklistExtra(itemId, extra, notes, measurements, templateKey) {
  const ctx = { measurements, notes, packageName: extra.name, templateKey };
  const resolved = resolveQuantityForChecklistItem(itemId, ctx);
  const scopeQuantities = [];
  const norm = normalizeScopeMeasurements(measurements);
  const rule = getRuleForChecklistItem(itemId, templateKey);

  if (rule?.dualAllowanceField) {
    const count = norm.itemQuantities?.[itemId];
    const allowance = norm.itemQuantities?.[`${itemId}__allowance`];
    if (count?.quantity > 0) {
      scopeQuantities.push({
        label: `${extra.name} — rough-in count`,
        quantity: count.quantity,
        unit: count.unit || 'each',
        quantitySource: count.quantitySource || QUANTITY_SOURCES.user_entered,
      });
    }
    if (allowance?.quantity > 0) {
      scopeQuantities.push({
        label: `${extra.name} — allowance`,
        quantity: allowance.quantity,
        unit: allowance.unit || 'lump_sum',
        quantitySource: allowance.quantitySource || QUANTITY_SOURCES.user_entered,
      });
    }
  } else if (resolved.pricingReady && resolved.quantity != null) {
    scopeQuantities.push({
      label: extra.name,
      quantity: resolved.quantity,
      unit: resolved.unit,
      quantitySource: resolved.quantitySource,
    });
  }
  const missingPriceItems = extra.isFixture || ['tub_install', 'shower_pan'].includes(itemId)
    ? defaultMissingPriceItemsForExtra(itemId)
    : [];
  return {
    name: extra.name,
    scope: extra.scope,
    scopeQuantities: scopeQuantities.length ? scopeQuantities : undefined,
    price: null,
    laborPrice: null,
    materialPrice: null,
    priceIncludesLaborAndMaterials: false,
    priceProvidedByUser: false,
    status: 'missing_price',
    priceSource: 'missing',
    applyEligible: false,
    pricingItems: [],
    missingPriceItems,
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
  const phaseTemplate = templateKey === 'addition' || templateKey === 'ground_up' || templateKey === 'room_remodel';

  for (const item of confirmedItems) {
    if (!checklistItemInBidScope(item)) continue;

    if (item.id === 'wet_area_install' && item.inputType === 'choice') {
      if (item.choiceId === 'prefab') extraIds.push('prefab_shower_pan');
      else if (item.choiceId === 'tile_pan') extraIds.push('shower_pan');
      else if (item.choiceId === 'tub') extraIds.push('tub_install');
      continue;
    }

    if (item.id === 'shower_pan' && item.inputType === 'choice') {
      if (item.choiceId === 'prefab') extraIds.push('prefab_shower_pan');
      else if (item.choiceId === 'tile_pan') extraIds.push('shower_pan');
      continue;
    }

    if (!phaseTemplate) {
      const taskId = resolveTaskIdForChecklistItem(item, templateKey);
      if (taskId) {
        taskIds.add(taskId);
        continue;
      }
    }
    if (!phaseTemplate && CHECKLIST_EXTRA_ROOMS[item.id]) {
      extraIds.push(item.id);
      continue;
    }
    fallbackItems.push(item);
  }

  const notes = String(draft.originalNotes || '').trim();
  const rooms = phaseTemplate
    ? [...(draft.rooms || []).filter((room) => roomHasConfirmedPricing(room))]
    : [...(draft.rooms || [])];

  for (const taskId of taskIds) {
    const task = SCOPE_TASKS.find((t) => t.id === taskId);
    if (!task || roomMatchesTask(rooms, task)) continue;
    rooms.push(emptyScopeRoom(task, notes));
  }

  for (const itemId of extraIds) {
    const extra = CHECKLIST_EXTRA_ROOMS[itemId];
    if (!extra || roomExistsByLabel(rooms, extra.name)) continue;
    if (roomExistsForChecklistItem(rooms, { id: itemId, label: extra.name, helperText: extra.scope })) continue;
    rooms.push(emptyRoomFromChecklistExtra(itemId, extra, notes, scopeMeasurements, templateKey));
  }

  for (const item of fallbackItems) {
    if (String(item.id || '').startsWith('custom_')) {
      const customRoom = customChecklistRoomFromMeasurements(item, scopeMeasurements);
      if (!customRoom.name || roomExistsByExactLabel(rooms, customRoom.name)) continue;
      rooms.push(customRoom);
      continue;
    }
    const name = String(item.label || 'Scope item')
      .replace(/\s*—.*$/, '')
      .trim();
    if (roomExistsForChecklistItem(rooms, item)) continue;
    if (!name || roomExistsByLabel(rooms, name)) continue;
    rooms.push({
      name,
      scope: item.helperText || item.label || name,
      checklistItemId: item.id || null,
      costCode: item.id || null,
      price: null,
      laborPrice: null,
      materialPrice: null,
      priceIncludesLaborAndMaterials: false,
      priceProvidedByUser: false,
      status: 'missing_price',
      priceSource: 'missing',
      applyEligible: false,
      pricingItems: [],
      missingPriceItems: ['Materials / supplies', 'Install labor'],
    });
  }

  if (rooms.length === (draft.rooms || []).length) return draft;
  return { ...draft, rooms };
}

function applyScopeMeasurements(draft, measurements) {
  const norm = normalizeScopeMeasurements(measurements);
  const hasAny =
    norm.bathroomFloorSqft ||
    norm.kitchenFloorSqft ||
    norm.floorAreaSqft ||
    norm.backsplashSqft ||
    norm.countertopSqft ||
    norm.cabinetLf ||
    norm.landscapeSqft ||
    norm.sodSqft ||
    norm.paverSqft ||
    norm.rockMulchSqft ||
    norm.landscapeTons ||
    norm.roofSquares ||
    norm.drywallSqft ||
    norm.concreteSqft ||
    norm.concreteCy ||
    norm.excavationCy ||
    norm.deckSqft ||
    norm.garageSqft ||
    norm.exteriorPaintSqft ||
    norm.railingLf ||
    norm.baseboardLf ||
    norm.showerWallTileSqft ||
    norm.showerFloorTileSqft ||
    norm.wallPaintSqft ||
    Object.keys(norm.itemQuantities || {}).length > 0 ||
    Object.keys(measurements?.pricingAcceptance || draft.scopeMeasurements?.pricingAcceptance || {}).length > 0;
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

  const prevMeasurements = draft.scopeMeasurements || {};
  const pricingAcceptance =
    measurements?.pricingAcceptance ||
    norm.pricingAcceptance ||
    prevMeasurements.pricingAcceptance;
  const measurementsForStamp = {
    ...norm,
    pricingAcceptance,
  };
  const ctx = { measurements: measurementsForStamp, notes: originalNotes };

  return {
    ...draft,
    scopeMeasurements: {
      ...prevMeasurements,
      sqft: norm.bathroomFloorSqft,
      lf: norm.baseboardLf,
      bathroomFloorSqft: norm.bathroomFloorSqft,
      kitchenFloorSqft: norm.kitchenFloorSqft,
      floorAreaSqft: norm.floorAreaSqft,
      backsplashSqft: norm.backsplashSqft,
      countertopSqft: norm.countertopSqft,
      cabinetLf: norm.cabinetLf,
      landscapeSqft: norm.landscapeSqft,
      sodSqft: norm.sodSqft,
      paverSqft: norm.paverSqft,
      rockMulchSqft: norm.rockMulchSqft,
      landscapeTons: norm.landscapeTons,
      roofSquares: norm.roofSquares,
      drywallSqft: norm.drywallSqft,
      concreteSqft: norm.concreteSqft,
      concreteCy: norm.concreteCy,
      excavationCy: norm.excavationCy,
      deckSqft: norm.deckSqft,
      garageSqft: norm.garageSqft,
      exteriorPaintSqft: norm.exteriorPaintSqft,
      railingLf: norm.railingLf,
      baseboardLf: norm.baseboardLf,
      showerWallTileSqft: norm.showerWallTileSqft,
      showerFloorTileSqft: norm.showerFloorTileSqft,
      wallPaintSqft: norm.wallPaintSqft,
      itemQuantities: {
        ...(prevMeasurements.itemQuantities || {}),
        ...(norm.itemQuantities || {}),
      },
      pricingAcceptance,
      planRooms: measurements?.planRooms || prevMeasurements.planRooms,
      planFacts: measurements?.planFacts || prevMeasurements.planFacts,
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
    if (item.inputType === 'multi_choice') {
      const ids = Array.isArray(item.choiceIds) ? item.choiceIds : [];
      if (ids.includes('not_in_scope')) excluded.push(line);
      else if (!ids.length || (ids.length === 1 && ids.includes('unsure'))) unsure.push(line);
      else included.push(line);
      continue;
    }
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
    scopeChecklist: withChecklistPackages.scopeChecklist
      ? {
          ...withChecklistPackages.scopeChecklist,
          items: confirmedItems.map((item) => ({ ...item })),
        }
      : withChecklistPackages.scopeChecklist,
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

function mergeScopeMeasurementItemQuantities(existing = {}, parsed = {}) {
  const merged = {
    ...(existing || {}),
    ...(parsed || {}),
  };

  for (const [key, val] of Object.entries(existing || {})) {
    if (val?.quantitySource === 'user_entered') {
      merged[key] = val;
    }
  }

  return merged;
}

function enrichDraftComplexity(draft, originalNotes) {
  const estimateTier = classifyEstimateTier(draft, originalNotes);
  const scopeChecklist =
    estimateTier === 'simple_unit' ? null : buildScopeChecklist(draft, estimateTier, originalNotes);
  const parsedMeasurements = scopeChecklist?.suggestedMeasurements;

  return {
    estimateTier,
    scopeChecklist,
    ...(parsedMeasurements
      ? {
          scopeMeasurements: {
            ...(draft.scopeMeasurements || {}),
            ...parsedMeasurements,
            itemQuantities: mergeScopeMeasurementItemQuantities(
              draft.scopeMeasurements?.itemQuantities,
              parsedMeasurements.itemQuantities
            ),
          },
        }
      : {}),
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
