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
 * Resolve a location to regional cost factors.
 * @param {string} [projectLocation] free-text location (city, state, address)
 * @param {string} [zipCode] 5-digit ZIP or ZIP3
 * @returns {{region:string,label:string,costIndex:number,laborFactor:number,materialFactor:number,source:string,isDefault:boolean}}
 */
function resolveRegionalCostFactor(projectLocation = '', zipCode = '') {
  const blob = ` ${String(projectLocation || '').toLowerCase()} `;

  const metro = matchMetro(blob, zipCode);
  if (metro) {
    return {
      region: metro.region,
      label: metro.label,
      ...factorsFromIndex(metro.costIndex),
      source: 'metro_override',
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
      isDefault: STATE_COST_INDEX[state] === 1.0,
    };
  }

  return { ...NATIONAL_FACTOR };
}

/** Percent delta string for assumptions, e.g. "+5%" / "-14%". */
function factorToPercentLabel(factor) {
  const pct = Math.round((factor - 1) * 100);
  return `${pct >= 0 ? '+' : ''}${pct}%`;
}

module.exports = {
  resolveRegionalCostFactor,
  factorToPercentLabel,
  factorsFromIndex,
  zip3ToState,
  stateFromText,
  STATE_COST_INDEX,
  NATIONAL_FACTOR,
};
