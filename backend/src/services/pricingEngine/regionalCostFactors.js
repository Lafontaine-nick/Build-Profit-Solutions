/**
 * Interim regional cost adjustment (Phase 2 — planning only).
 *
 * A multiplier layer OVER the national planning averages, applied until a
 * licensed county-level cost database (e.g. 1build) is wired into
 * `sources/costDatabase.js`. Resolves a project location (free text +/- ZIP)
 * to a construction cost index and splits it into separate labor/material
 * factors, since labor varies far more by region than commoditized materials.
 *
 * `costIndex` ~ RSMeans-style relative construction cost (national = 1.00).
 * These are coarse planning approximations, NOT live or county-precise data.
 */

const LABOR_WEIGHT = 1.15; // labor swings more than the headline index
const MATERIAL_WEIGHT = 0.5; // materials are more national/commoditized
const LABOR_CLAMP = [0.75, 1.5];
const MATERIAL_CLAMP = [0.85, 1.25];

const NATIONAL_FACTOR = Object.freeze({
  region: 'national',
  label: 'National average',
  costIndex: 1.0,
  laborFactor: 1.0,
  materialFactor: 1.0,
  source: 'national_baseline',
  isDefault: true,
});

/** Relative construction cost index by USPS state (national = 1.00). Planning only. */
const STATE_COST_INDEX = {
  AL: 0.86, AK: 1.25, AZ: 0.98, AR: 0.85, CA: 1.24, CO: 1.03, CT: 1.14, DE: 1.02,
  DC: 1.18, FL: 0.92, GA: 0.9, HI: 1.35, ID: 0.94, IL: 1.09, IN: 0.96, IA: 0.95,
  KS: 0.9, KY: 0.89, LA: 0.87, ME: 1.02, MD: 1.07, MA: 1.2, MI: 1.0, MN: 1.07,
  MS: 0.83, MO: 0.96, MT: 0.97, NE: 0.92, NV: 1.02, NH: 1.03, NJ: 1.15, NM: 0.9,
  NY: 1.28, NC: 0.87, ND: 0.95, OH: 0.97, OK: 0.86, OR: 1.08, PA: 1.02, RI: 1.1,
  SC: 0.87, SD: 0.92, TN: 0.87, TX: 0.9, UT: 0.96, VT: 1.02, VA: 0.99, WA: 1.12,
  WV: 0.91, WI: 1.02, WY: 0.96,
};

const FULL_STATE_NAMES = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS',
  kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD', massachusetts: 'MA',
  michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO', montana: 'MT',
  nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND',
  ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI',
  'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN', texas: 'TX',
  utah: 'UT', vermont: 'VT', virginia: 'VA', washington: 'WA', 'west virginia': 'WV',
  wisconsin: 'WI', wyoming: 'WY', 'district of columbia': 'DC',
};

/** Metro overrides (finer than state), consistent with regionalLabor.js metros. */
const METRO_OVERRIDES = [
  {
    region: 'las_vegas',
    label: 'Las Vegas, NV metro',
    re: /\b(las\s*vegas|henderson|paradise|spring\s*valley|north\s*las\s*vegas)\b/,
    zip3: ['889', '890', '891'],
    costIndex: 1.05,
  },
  {
    region: 'phoenix',
    label: 'Phoenix, AZ metro',
    re: /\b(phoenix|scottsdale|mesa|tempe|chandler|glendale|gilbert)\b/,
    zip3: ['850', '851', '852', '853'],
    costIndex: 1.0,
  },
  {
    region: 'denver',
    label: 'Denver, CO metro',
    re: /\b(denver|aurora|lakewood|boulder|arvada|centennial)\b/,
    zip3: ['800', '801', '802', '803'],
    costIndex: 1.07,
  },
];

/** ZIP3 numeric ranges → USPS state (standard SCF allocation, coarse). */
const ZIP3_STATE_RANGES = [
  [10, 27, 'MA'], [28, 29, 'RI'], [30, 38, 'NH'], [39, 49, 'ME'], [50, 59, 'VT'],
  [60, 69, 'CT'], [70, 89, 'NJ'], [100, 149, 'NY'], [150, 196, 'PA'], [197, 199, 'DE'],
  [200, 205, 'DC'], [206, 219, 'MD'], [220, 246, 'VA'], [247, 268, 'WV'],
  [270, 289, 'NC'], [290, 299, 'SC'], [300, 319, 'GA'], [320, 349, 'FL'],
  [350, 369, 'AL'], [370, 385, 'TN'], [386, 397, 'MS'], [398, 399, 'GA'],
  [400, 427, 'KY'], [430, 459, 'OH'], [460, 479, 'IN'], [480, 499, 'MI'],
  [500, 528, 'IA'], [530, 549, 'WI'], [550, 567, 'MN'], [570, 577, 'SD'],
  [580, 588, 'ND'], [590, 599, 'MT'], [600, 629, 'IL'], [630, 658, 'MO'],
  [660, 679, 'KS'], [680, 693, 'NE'], [700, 714, 'LA'], [716, 729, 'AR'],
  [730, 749, 'OK'], [750, 799, 'TX'], [800, 816, 'CO'], [820, 831, 'WY'],
  [832, 838, 'ID'], [840, 847, 'UT'], [850, 865, 'AZ'], [870, 884, 'NM'],
  [889, 898, 'NV'], [900, 961, 'CA'], [967, 968, 'HI'], [970, 979, 'OR'],
  [980, 994, 'WA'], [995, 999, 'AK'],
];

function clamp(n, [min, max]) {
  return Math.min(max, Math.max(min, n));
}

function round3(n) {
  return Math.round(n * 1000) / 1000;
}

function factorsFromIndex(costIndex) {
  return {
    costIndex: round3(costIndex),
    laborFactor: round3(clamp(1 + (costIndex - 1) * LABOR_WEIGHT, LABOR_CLAMP)),
    materialFactor: round3(clamp(1 + (costIndex - 1) * MATERIAL_WEIGHT, MATERIAL_CLAMP)),
  };
}

function zip3ToState(zipCode) {
  const m = String(zipCode || '').match(/\b(\d{5})\b/) || String(zipCode || '').match(/^(\d{3})/);
  if (!m) return null;
  const zip3 = Number(String(m[1]).slice(0, 3));
  if (!Number.isFinite(zip3)) return null;
  for (const [min, max, state] of ZIP3_STATE_RANGES) {
    if (zip3 >= min && zip3 <= max) return state;
  }
  return null;
}

function stateFromText(text) {
  const blob = ` ${String(text || '').toLowerCase()} `;
  for (const [name, abbr] of Object.entries(FULL_STATE_NAMES)) {
    if (blob.includes(` ${name} `) || blob.includes(`, ${name}`)) return abbr;
  }
  const abbrMatch = blob.match(/[\s,]([a-z]{2})[\s,.]/g);
  if (abbrMatch) {
    for (const raw of abbrMatch) {
      const abbr = raw.replace(/[\s,.]/g, '').toUpperCase();
      if (STATE_COST_INDEX[abbr] != null) return abbr;
    }
  }
  return null;
}

function matchMetro(blob, zipCode) {
  const zip3 = (String(zipCode || '').match(/\b(\d{5})\b/) || String(zipCode || '').match(/^(\d{3})/) || [])[1];
  const zip3str = zip3 ? String(zip3).slice(0, 3) : null;
  for (const metro of METRO_OVERRIDES) {
    if (metro.re.test(blob)) return metro;
    if (zip3str && metro.zip3.includes(zip3str)) return metro;
  }
  return null;
}

/**
 * Resolve a location to regional cost factors (state/metro).
 * Kept for nationalTradeAverage fallback and existing callers.
 */
function resolveRegionalCostFactor(projectLocation = '', zipCode = '') {
  const county = resolveCountyCostFactor(projectLocation, zipCode);
  return {
    region: county.region,
    label: county.label,
    costIndex: county.costIndex,
    laborFactor: county.laborFactor,
    materialFactor: county.materialFactor,
    source: county.source,
    isDefault: county.isDefault,
  };
}

/**
 * Resolve the best available location factor for the construction cost database.
 * Prefers metro/county precision over state; returns geographicPrecision for
 * recommend.js to prefer this source over plain national averages.
 */
function resolveCountyCostFactor(projectLocation = '', zipCode = '') {
  const blob = ` ${String(projectLocation || '').toLowerCase()} `;
  const metro = matchMetro(blob, zipCode);
  if (metro) {
    return {
      region: metro.region,
      label: metro.label,
      ...factorsFromIndex(metro.costIndex),
      source: 'metro_override',
      geographicPrecision: 'metro',
      isDefault: false,
    };
  }

  // County-name match in free text (common contractor address patterns)
  const COUNTY_NAME_INDEX = {
    'clark county': { region: 'clark_nv', label: 'Clark County, NV', costIndex: 1.05, state: 'NV' },
    'maricopa county': { region: 'maricopa_az', label: 'Maricopa County, AZ', costIndex: 1.0, state: 'AZ' },
    'denver county': { region: 'denver_co', label: 'Denver County, CO', costIndex: 1.07, state: 'CO' },
    'los angeles county': { region: 'la_ca', label: 'Los Angeles County, CA', costIndex: 1.22, state: 'CA' },
    'orange county': { region: 'orange_ca', label: 'Orange County, CA', costIndex: 1.2, state: 'CA' },
    'king county': { region: 'king_wa', label: 'King County, WA', costIndex: 1.18, state: 'WA' },
    'cook county': { region: 'cook_il', label: 'Cook County, IL', costIndex: 1.14, state: 'IL' },
    'harris county': { region: 'harris_tx', label: 'Harris County, TX', costIndex: 0.94, state: 'TX' },
    'miami-dade': { region: 'miami_dade_fl', label: 'Miami-Dade County, FL', costIndex: 0.98, state: 'FL' },
    'salt lake county': { region: 'salt_lake_ut', label: 'Salt Lake County, UT', costIndex: 0.98, state: 'UT' },
  };
  for (const [name, meta] of Object.entries(COUNTY_NAME_INDEX)) {
    if (blob.includes(name)) {
      return {
        region: meta.region,
        label: meta.label,
        ...factorsFromIndex(meta.costIndex),
        source: 'county_index',
        geographicPrecision: 'county',
        isDefault: false,
      };
    }
  }

  // ZIP3 → county-ish metro bands for common contractor markets
  const zip3 = (String(zipCode || '').match(/\b(\d{5})\b/) || String(zipCode || '').match(/^(\d{3})/) || [])[1];
  const zip3str = zip3 ? String(zip3).slice(0, 3) : null;
  const ZIP3_COUNTY = {
    '889': { region: 'clark_nv', label: 'Clark County, NV', costIndex: 1.05 },
    '890': { region: 'clark_nv', label: 'Clark County, NV', costIndex: 1.05 },
    '891': { region: 'clark_nv', label: 'Clark County, NV', costIndex: 1.05 },
    '850': { region: 'maricopa_az', label: 'Maricopa County, AZ', costIndex: 1.0 },
    '851': { region: 'maricopa_az', label: 'Maricopa County, AZ', costIndex: 1.0 },
    '852': { region: 'maricopa_az', label: 'Maricopa County, AZ', costIndex: 1.0 },
    '853': { region: 'maricopa_az', label: 'Maricopa County, AZ', costIndex: 1.0 },
    '800': { region: 'denver_co', label: 'Denver metro, CO', costIndex: 1.07 },
    '801': { region: 'denver_co', label: 'Denver metro, CO', costIndex: 1.07 },
    '802': { region: 'denver_co', label: 'Denver metro, CO', costIndex: 1.07 },
    '900': { region: 'la_ca', label: 'Los Angeles County, CA', costIndex: 1.22 },
    '901': { region: 'la_ca', label: 'Los Angeles County, CA', costIndex: 1.22 },
    '902': { region: 'la_ca', label: 'Los Angeles County, CA', costIndex: 1.22 },
    '903': { region: 'la_ca', label: 'Los Angeles County, CA', costIndex: 1.22 },
    '904': { region: 'la_ca', label: 'Los Angeles County, CA', costIndex: 1.22 },
    '905': { region: 'la_ca', label: 'Los Angeles County, CA', costIndex: 1.22 },
    '906': { region: 'la_ca', label: 'Los Angeles County, CA', costIndex: 1.22 },
    '907': { region: 'la_ca', label: 'Los Angeles County, CA', costIndex: 1.22 },
    '908': { region: 'la_ca', label: 'Los Angeles County, CA', costIndex: 1.22 },
    '910': { region: 'la_ca', label: 'Los Angeles County, CA', costIndex: 1.22 },
    '911': { region: 'la_ca', label: 'Los Angeles County, CA', costIndex: 1.22 },
    '912': { region: 'la_ca', label: 'Los Angeles County, CA', costIndex: 1.22 },
    '913': { region: 'la_ca', label: 'Los Angeles County, CA', costIndex: 1.22 },
    '914': { region: 'la_ca', label: 'Los Angeles County, CA', costIndex: 1.22 },
    '915': { region: 'la_ca', label: 'Los Angeles County, CA', costIndex: 1.22 },
    '916': { region: 'la_ca', label: 'Los Angeles County, CA', costIndex: 1.22 },
    '917': { region: 'la_ca', label: 'Los Angeles County, CA', costIndex: 1.22 },
    '918': { region: 'la_ca', label: 'Los Angeles County, CA', costIndex: 1.22 },
    '980': { region: 'king_wa', label: 'King County, WA', costIndex: 1.18 },
    '981': { region: 'king_wa', label: 'King County, WA', costIndex: 1.18 },
    '606': { region: 'cook_il', label: 'Cook County, IL', costIndex: 1.14 },
    '607': { region: 'cook_il', label: 'Cook County, IL', costIndex: 1.14 },
    '770': { region: 'harris_tx', label: 'Harris County, TX', costIndex: 0.94 },
    '771': { region: 'harris_tx', label: 'Harris County, TX', costIndex: 0.94 },
    '772': { region: 'harris_tx', label: 'Harris County, TX', costIndex: 0.94 },
    '330': { region: 'miami_dade_fl', label: 'Miami-Dade County, FL', costIndex: 0.98 },
    '331': { region: 'miami_dade_fl', label: 'Miami-Dade County, FL', costIndex: 0.98 },
    '332': { region: 'miami_dade_fl', label: 'Miami-Dade County, FL', costIndex: 0.98 },
    '840': { region: 'salt_lake_ut', label: 'Salt Lake County, UT', costIndex: 0.98 },
    '841': { region: 'salt_lake_ut', label: 'Salt Lake County, UT', costIndex: 0.98 },
  };
  if (zip3str && ZIP3_COUNTY[zip3str]) {
    const meta = ZIP3_COUNTY[zip3str];
    return {
      region: meta.region,
      label: meta.label,
      ...factorsFromIndex(meta.costIndex),
      source: 'county_zip3',
      geographicPrecision: 'county',
      isDefault: false,
    };
  }

  const state = stateFromText(projectLocation) || zip3ToState(zipCode);
  if (state && STATE_COST_INDEX[state] != null) {
    return {
      region: state,
      label: `${state} state average`,
      ...factorsFromIndex(STATE_COST_INDEX[state]),
      source: 'state_index',
      geographicPrecision: 'state',
      isDefault: STATE_COST_INDEX[state] === 1.0,
    };
  }

  return {
    ...NATIONAL_FACTOR,
    geographicPrecision: 'national',
  };
}

/** Percent delta string for assumptions, e.g. "+5%" / "-14%". */
function factorToPercentLabel(factor) {
  const pct = Math.round((factor - 1) * 100);
  return `${pct >= 0 ? '+' : ''}${pct}%`;
}

module.exports = {
  resolveRegionalCostFactor,
  resolveCountyCostFactor,
  factorToPercentLabel,
  factorsFromIndex,
  zip3ToState,
  stateFromText,
  STATE_COST_INDEX,
  NATIONAL_FACTOR,
};
