/**
 * Planning quantities for remodel scope packages when notes lack sqft/LF/each counts.
 * Enables saved $/sqft templates and national averages to produce rough pricing.
 */

const { parseSquareFeetFromText } = require('../estimateDraftFromNotes');

const FIXTURE_PLANNING_RATES = {
  toilet: {
    material: 425,
    labor: 475,
    materialLabel: 'Toilet & rough-in materials',
    laborLabel: 'Toilet install labor',
  },
  vanity: {
    material: 950,
    labor: 650,
    materialLabel: 'Vanity & top materials',
    laborLabel: 'Vanity install labor',
  },
  shower_door: {
    material: 650,
    labor: 450,
    materialLabel: 'Shower door / enclosure materials',
    laborLabel: 'Shower door install labor',
  },
  tub: {
    material: 1200,
    labor: 850,
    materialLabel: 'Tub / surround materials',
    laborLabel: 'Tub install labor',
  },
  prefab_shower_pan: {
    material: 850,
    labor: 650,
    materialLabel: 'Prefab shower pan / base materials',
    laborLabel: 'Prefab shower pan install labor',
  },
  tile_shower_pan: {
    material: 450,
    labor: 1200,
    materialLabel: 'Tile shower pan materials (liner, drain, mud)',
    laborLabel: 'Tile shower pan / mud pan build labor',
  },
  shower_niche: {
    material: 200,
    labor: 400,
    materialLabel: 'Niche kit / backer / tile materials',
    laborLabel: 'Niche frame, waterproof & tile labor',
  },
  shower_bench: {
    material: 300,
    labor: 450,
    materialLabel: 'Bench / curb materials & tile',
    laborLabel: 'Bench / curb build & tile labor',
  },
  exhaust_fan: {
    material: 150,
    labor: 275,
    materialLabel: 'Exhaust fan & vent materials',
    laborLabel: 'Exhaust fan install labor',
  },
  mirror_accessories: {
    material: 125,
    labor: 175,
    materialLabel: 'Mirror & accessory materials',
    laborLabel: 'Mirror / accessory install labor',
  },
  lighting_fixture: {
    material: 200,
    labor: 275,
    materialLabel: 'Light fixture materials',
    laborLabel: 'Light fixture install labor',
  },
};

function isPlanningContext(draft) {
  const tier = String(draft?.estimateTier || '').toLowerCase();
  if (['room_remodel', 'addition', 'ground_up', 'adu', 'new_build', 'service_call', 'repair'].includes(tier)) {
    return true;
  }
  const pt = String(draft?.projectType || '').toLowerCase();
  if (
    [
      'bathroom',
      'bath',
      'kitchen',
      'flooring',
      'floor',
      'painting',
      'paint',
      'roofing',
      'roof',
      'plumbing',
      'electrical',
      'hvac',
      'landscaping',
      'concrete',
      'framing',
      'drywall',
      'addition',
      'adu',
      'handyman',
    ].includes(pt)
  ) {
    return true;
  }
  const notes = String(draft?.originalNotes || '');
  return /\b(remodel|renovation|install|repair|replace|demo|build|addition|adu)\b/i.test(notes);
}

/** @deprecated */
function isRemodelContext(draft) {
  return isPlanningContext(draft);
}

function resolveFixtureKind(scopeName) {
  const n = String(scopeName || '').toLowerCase();
  if (/shower\s+niche|\bniche\b/.test(n) && !/kitchen|counter/.test(n)) return 'shower_niche';
  if (/shower\s+bench|\bcurb\b/.test(n) && !/demolition|demo|removal/.test(n)) return 'shower_bench';
  if (/exhaust\s+fan|\bventilation\b/.test(n)) return 'exhaust_fan';
  if (/mirror|\bbath\s+accessories/.test(n)) return 'mirror_accessories';
  if (/\blighting|\blight\s+fixture/.test(n) && /\binstall/.test(n)) return 'lighting_fixture';
  if (/toilet/.test(n)) return 'toilet';
  if (/vanity/.test(n)) return 'vanity';
  if (/shower\s+door|glass\s+door|enclosure/.test(n)) return 'shower_door';
  if (/prefab\s+shower\s+pan|prefab\s+pan/.test(n)) return 'prefab_shower_pan';
  if (/tile\s+shower\s+pan|mud\s+pan/.test(n)) return 'tile_shower_pan';
  if (/\btub\b|bathtub/.test(n)) return 'tub';
  return null;
}

/**
 * @returns {{ quantity: number, unit: string, label: string, isPlanningDefault?: boolean } | null}
 */
function inferPlanningQuantity(packageName, scopeText, draft) {
  if (!isPlanningContext(draft)) return null;

  const name = String(packageName || '').toLowerCase();
  const scope = String(scopeText || '').toLowerCase();
  const blob = `${name} ${scope}`;
  const notes = String(draft?.originalNotes || '');

  const fromNotesScoped = parseSquareFeetFromText(scopeText, packageName);
  if (fromNotesScoped && fromNotesScoped > 0 && scopeText.trim().length > 20) {
    return { quantity: fromNotesScoped, unit: 'sqft', label: 'Parsed from notes' };
  }

  if (/shower/.test(blob) && /tile/.test(blob)) {
    return {
      quantity: 90,
      unit: 'sqft',
      label: 'Planning default (typical shower tile area)',
      isPlanningDefault: true,
    };
  }

  if (/floor/.test(blob) && /tile/.test(blob)) {
    return {
      quantity: 45,
      unit: 'sqft',
      label: 'Planning default (typical bath floor tile)',
      isPlanningDefault: true,
    };
  }

  if (/tile/.test(blob) && /\binstall/.test(blob) && !/\b(demo|removal)\b/.test(blob)) {
    if (/shower|wall/.test(blob) || /\bshower\b/.test(notes.toLowerCase())) {
      return {
        quantity: 90,
        unit: 'sqft',
        label: 'Planning default (shower tile)',
        isPlanningDefault: true,
      };
    }
    return {
      quantity: 45,
      unit: 'sqft',
      label: 'Planning default (floor tile)',
      isPlanningDefault: true,
    };
  }

  if (/paint/.test(blob)) {
    return {
      quantity: 175,
      unit: 'sqft',
      label: 'Planning default (typical bath paint area)',
      isPlanningDefault: true,
    };
  }

  const fixture = resolveFixtureKind(packageName);
  if (fixture && /\binstall/.test(blob)) {
    return {
      quantity: 1,
      unit: 'each',
      label: 'Planning default (1 fixture)',
      isPlanningDefault: true,
    };
  }

  if (fixture) {
    return {
      quantity: 1,
      unit: 'each',
      label: 'Planning default (1 fixture)',
      isPlanningDefault: true,
    };
  }

  return null;
}

function lookupFixturePlanningRates(scopeItem) {
  const fixture = resolveFixtureKind(scopeItem.scopeName);
  const band = fixture ? FIXTURE_PLANNING_RATES[fixture] : null;
  if (!band) return { available: false, rates: [], fixture: null };

  const quantity =
    scopeItem.quantity != null && Number(scopeItem.quantity) > 0 ? Number(scopeItem.quantity) : 1;

  const assumptions = [
    'National planning allowance per fixture (not live pricing)',
    'Verify fixture grade, rough-in changes, and local labor rates',
    'Your saved bids override these when template lines match',
  ];

  const rates = [];
  if (band.material > 0) {
    rates.push({
      pricingType: 'material',
      label: band.materialLabel,
      rate: band.material,
      unit: 'each',
      quantity,
      confidence: 'low',
      assumptions,
    });
  }
  if (band.labor > 0) {
    rates.push({
      pricingType: 'labor',
      label: band.laborLabel,
      rate: band.labor,
      unit: 'each',
      quantity,
      confidence: 'medium',
      assumptions,
    });
  }

  return { available: rates.length > 0, rates, fixture, trade: 'bathroom_fixture' };
}

module.exports = {
  FIXTURE_PLANNING_RATES,
  inferPlanningQuantity,
  lookupFixturePlanningRates,
  resolveFixtureKind,
  isRemodelContext,
  isPlanningContext,
};
