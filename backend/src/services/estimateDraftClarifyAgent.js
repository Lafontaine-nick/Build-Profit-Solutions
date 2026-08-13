/**
 * Agentic clarify loop for estimate drafts.
 *
 * A second LLM pass inspects the enriched draft (not the raw notes) and asks
 * a handful of job-specific questions. Contractor answers come back as free
 * text; another LLM pass converts them into a structured patch, and
 * deterministic code validates and applies that patch before re-enriching.
 *
 * The LLM only ever proposes. Deterministic code decides what is applied:
 * measurement keys are whitelisted, package names must match existing rooms,
 * and prices must be explicit positive numbers.
 *
 * Falls back to the static rule-based questions (estimateDraftClarify) when
 * no OpenAI client is available or the model call fails.
 */

const { enrichDraft } = require('./estimateDraftEnrichment');
const { applyScopeMeasurements } = require('./estimateDraftComplexity');
const { buildClarifyQuestions } = require('./estimateDraftClarify');
const { lookupRuleKeyForPackage } = require('./scopeItemQuantityCatalog');

/** Top-level measurement keys accepted from LLM patches (mirrors applyScopeMeasurements). */
const MEASUREMENT_KEY_WHITELIST = new Set([
  'bathroomFloorSqft',
  'kitchenFloorSqft',
  'floorAreaSqft',
  'backsplashSqft',
  'countertopSqft',
  'cabinetLf',
  'landscapeSqft',
  'sodSqft',
  'paverSqft',
  'rockMulchSqft',
  'landscapeTons',
  'roofSquares',
  'drywallSqft',
  'concreteSqft',
  'concreteCy',
  'excavationCy',
  'deckSqft',
  'garageSqft',
  'exteriorPaintSqft',
  'railingLf',
  'baseboardLf',
  'showerWallTileSqft',
  'showerFloorTileSqft',
  'wallPaintSqft',
  'ceilingPaintSqft',
  'paintAreaSqft',
  'combinedPaintableAreaSqft',
  'interiorDoorCount',
  'cabinetRunLf',
  'cabinetPaintSqft',
]);

const QUESTION_KINDS = new Set(['measurement', 'pricing', 'scope', 'project_info']);
const MAX_QUESTIONS = 5;

function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function findRoomForPackageName(draft, packageName) {
  const target = normalizeName(packageName);
  if (!target) return null;
  const rooms = draft.rooms || [];
  let match = rooms.find((r) => normalizeName(r.name) === target);
  if (match) return match;
  match = rooms.find((r) => {
    const name = normalizeName(r.name);
    return name.includes(target) || target.includes(name);
  });
  return match || null;
}

function formatMoney(amount) {
  return `$${Math.round(Number(amount) || 0).toLocaleString()}`;
}

function formatQuantityLabel(quantity, unit) {
  const q = Number(quantity);
  const formatted = Number.isFinite(q)
    ? q.toLocaleString(undefined, { maximumFractionDigits: 2 })
    : String(quantity);
  const u = String(unit || '').toLowerCase();
  if (u === 'lf') return `${formatted} LF`;
  if (u === 'cy') return `${formatted} CY`;
  if (u === 'sqft' || u === 'sf') return `${formatted} sqft`;
  if (u === 'squares' || u === 'square') return `${formatted} squares`;
  if (u === 'tons' || u === 'ton') return `${formatted} tons`;
  if (u === 'each') return `${formatted} each`;
  return unit ? `${formatted} ${unit}` : formatted;
}

function measurementKeyLabel(key) {
  const labels = {
    drywallSqft: 'Drywall',
    floorAreaSqft: 'Floor area',
    bathroomFloorSqft: 'Bathroom floor',
    kitchenFloorSqft: 'Kitchen floor',
    roofSquares: 'Roofing',
    cabinetLf: 'Cabinets',
    baseboardLf: 'Baseboard',
    concreteCy: 'Concrete',
    excavationCy: 'Excavation',
    wallPaintSqft: 'Paint',
    ceilingPaintSqft: 'Ceiling paint',
    combinedPaintableAreaSqft: 'Combined paintable area',
    paintAreaSqft: 'Paintable area',
    interiorDoorCount: 'Interior doors',
    cabinetRunLf: 'Cabinet run',
    cabinetPaintSqft: 'Cabinet paint',
    exteriorPaintSqft: 'Exterior paint',
    showerWallTileSqft: 'Shower wall tile',
  };
  return labels[key] || key;
}

function inferUnitFromQuestion(question, targetKey) {
  const text = String(question || '').toLowerCase();
  const key = String(targetKey || '').toLowerCase();
  if (/\blinear\s*(foot|feet|footage)\b|\blf\b/.test(text) || key.endsWith('lf')) return 'lf';
  if (/\bsquare\s*(foot|feet|footage)\b|\bsq\.?\s*ft\b|\bsqft\b/.test(text)) return 'sqft';
  if (/\broof(?:ing)?\s*squares?\b|\b\d+\s*squares?\b/.test(text) || key === 'roofsquares') return 'squares';
  if (/\bcubic\s*yards?\b|\bcy\b/.test(text) || key.includes('cy')) return 'cy';
  if (/\btons?\b/.test(text) || key.includes('ton')) return 'tons';
  if (/\bdoors?\b|\beach\b|\bcount\b/.test(text) || key.endsWith('count')) return 'each';
  if (key.includes('sqft') || key.endsWith('sqft')) return 'sqft';
  return 'sqft';
}

function parseQuantityFromAnswer(answer) {
  const raw = String(answer || '').trim();
  if (!raw) return null;
  // Ignore clear price-only answers for quantity extraction.
  if (/^\$/.test(raw) && !/\b(sqft|lf|cy|square)/i.test(raw)) return null;
  const match = raw.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const quantity = Number(match[1]);
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  return quantity;
}

/**
 * Deterministic Q&A → package quantities. Does not rely on the LLM for
 * "50" / "1100" style measurement answers tied to a targetPackage.
 */
function buildDeterministicQuantityPatchFromAnswers(answers) {
  const packageQuantities = [];
  const measurements = [];
  for (const a of answers || []) {
    const quantity = parseQuantityFromAnswer(a.answer);
    if (quantity == null) continue;
    const unit = inferUnitFromQuestion(a.question, a.targetKey);
    if (a.targetPackage) {
      packageQuantities.push({
        packageName: a.targetPackage,
        quantity,
        unit,
      });
    }
    if (a.targetKey && MEASUREMENT_KEY_WHITELIST.has(a.targetKey)) {
      let key = a.targetKey;
      let qty = quantity;
      // Question asked for sqft but key is roofSquares → convert (1 square = 100 sqft).
      if (key === 'roofSquares' && unit === 'sqft') {
        qty = Math.round((quantity / 100) * 100) / 100;
      }
      measurements.push({ key, quantity: qty, unit: key === 'roofSquares' ? 'squares' : unit });
    }
  }
  return { packageQuantities, measurements };
}

function mergePatchQuantities(basePatch, extra) {
  const patch = { ...(basePatch || {}) };
  const mergeArr = (key) => {
    const combined = [...(Array.isArray(patch[key]) ? patch[key] : []), ...(extra[key] || [])];
    // Prefer later entries for same package/key (deterministic overrides LLM).
    const seen = new Map();
    for (const item of combined) {
      const id =
        key === 'packageQuantities'
          ? normalizeName(item.packageName)
          : key === 'packagePrices'
            ? `${normalizeName(item.packageName)}::${item.kind || 'lump_sum'}`
          : key === 'addPackages'
            ? normalizeName(item.name)
            : String(item.key || '');
      if (!id) continue;
      seen.set(id, item);
    }
    patch[key] = [...seen.values()];
  };
  mergeArr('packageQuantities');
  mergeArr('measurements');
  mergeArr('packagePrices');
  if (extra.addPackages?.length) mergeArr('addPackages');
  if (extra.removePackages?.length) {
    patch.removePackages = [
      ...new Set([...(patch.removePackages || []), ...extra.removePackages]),
    ];
  }
  return patch;
}

function parseCommandMoney(raw) {
  if (raw == null) return null;
  const text = String(raw).trim().toLowerCase();
  if (!text) return null;
  const k = text.match(/^([\d,]+(?:\.\d+)?)\s*k$/i);
  if (k) return Number(String(k[1]).replace(/,/g, '')) * 1000;
  const n = Number(text.replace(/[$,\s]/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function cleanPackageNameFromCommand(raw) {
  return String(raw || '')
    .replace(
      /\b(can you|please|make|set|add|for|the|a|an|to|be|is|are|price|pricing|cost|total|amount|separate|split|budget|into)\b/gi,
      ' '
    )
    .replace(/^[\s\-–,.:'"]+|[\s\-–,.:'"]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 120);
}

function extractQuotedPackageName(text) {
  const m = String(text || '').match(/\b(?:for\s+)?['"]([^'"]+)['"]/i);
  return m ? m[1].trim() : null;
}

/** Pull scope name from quotes, parentheses, or leading "add X". */
function extractPackageNameHint(text) {
  const raw = String(text || '');
  const quoted = extractQuotedPackageName(raw);
  if (quoted) return quoted;
  const paren = raw.match(/\(\s*([^)]+)\s*\)/);
  if (paren?.[1]?.trim()) return paren[1].trim();
  const addHint = raw.match(
    /\b(?:add|include)\s+(?:scope\s+item\s+|a\s+|an\s+|the\s+)?['"(]*([a-zA-Z][\w\s/-]{0,80}?)(?:['")\s]|$|\s+to\b|\s+for\b|\s+and\b)/i
  );
  if (addHint?.[1]?.trim()) return addHint[1].trim();
  return null;
}

function titleCaseScopeName(name) {
  return String(name || '')
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function appendMaterialLaborSplitToPatch(patch, parsedSplit, draftInput) {
  patch.packagePrices.push(
    { packageName: parsedSplit.name, amount: parsedSplit.material, kind: 'material' },
    { packageName: parsedSplit.name, amount: parsedSplit.labor, kind: 'labor' }
  );
  const existing = draftInput ? findRoomForPackageName(draftInput, parsedSplit.name) : null;
  if (!existing) {
    const titled = titleCaseScopeName(parsedSplit.name);
    patch.addPackages.push({
      name: titled,
      scope: titled,
      quantity: null,
      unit: null,
      amount: parsedSplit.material + parsedSplit.labor,
    });
  }
}

/** Parse "separate pool into $5k material and $7k labor" and similar phrasing. */
function tryParseMaterialLaborSplit(text, draftInput) {
  const raw = String(text || '').trim();
  if (!commandRequestsMaterialLaborSplit(raw)) return null;

  const moneyLegs = raw.match(
    /\$?\s*([\d,]+(?:\.\d+)?\s*k?)\s*(?:for\s+)?materials?\s+(?:and\s+|&\s*)\$?\s*([\d,]+(?:\.\d+)?\s*k?)\s*(?:for\s+)?labou?r/i
  );
  if (!moneyLegs) return null;
  const material = parseCommandMoney(moneyLegs[1]);
  const labor = parseCommandMoney(moneyLegs[2]);
  if (material == null || labor == null) return null;

  let name = extractPackageNameHint(raw);
  if (!name) {
    const namedSplit = raw.match(
      /\b(?:separate|split)\s+(?:the\s+)?(?:['"]([^'"]+)['"]|(.+?))\s+(?:[\d,$\s]+?\s+)?(?:budget\s+)?into\s+\$?\s*[\d,]/i
    );
    if (namedSplit) {
      const candidate = (namedSplit[1] || namedSplit[2] || '').trim();
      if (candidate && !/^[\d,$.\s]+$/.test(candidate)) {
        name = candidate;
      }
    }
  }
  if (!name) {
    const forSplit = raw.match(
      /\b(?:for\s+)?(.+?)\s+(?:can you\s+)?(?:make|set|use|change|update|separate|split)\b/i
    );
    if (forSplit) name = forSplit[1].trim();
  }
  if (!name) {
    const leadingName = raw.match(/^(.+?)\s+\$?\s*[\d,]+(?:\.\d+)?\s*k?\s*(?:for\s+)?materials?\s+and/i);
    if (leadingName) name = leadingName[1].trim();
  }
  name = cleanPackageNameFromCommand(name);
  if (!name) name = extractPackageNameHint(raw);
  if (!name && draftInput) {
    for (const room of draftInput.rooms || []) {
      const rn = normalizeName(room.name);
      if (rn && normalizeName(raw).includes(rn)) {
        name = room.name;
        break;
      }
    }
  }
  if (!name) return null;
  return { name, material, labor };
}

function packagesShareTrade(nameA, nameB) {
  const a = normalizeName(nameA);
  const b = normalizeName(nameB);
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  const generic = new Set([
    'kitchen',
    'bathroom',
    'interior',
    'exterior',
    'general',
    'project',
    'site',
    'scope',
    'item',
    'work',
    'new',
    'build',
  ]);
  const stop = new Set([
    'installation',
    'install',
    'bid',
    'allowance',
    'labor',
    'material',
    'the',
    'and',
    'for',
    'to',
  ]);
  const tokens = (n) =>
    n
      .split(' ')
      .filter((t) => t.length >= 4 && !stop.has(t) && !generic.has(t));
  const ta = tokens(a);
  const tb = tokens(b);
  return ta.some((t) => tb.includes(t));
}

/** One scope row per trade — drop sibling install/bid rows and duplicate LLM adds. */
function consolidateAddPackages(draft, addEntries, priceUpdates) {
  const rooms = draft?.rooms || [];
  const out = [];
  for (const entry of addEntries || []) {
    const name = String(entry?.name || '').trim();
    if (!name) continue;
    if (findRoomForPackageName({ rooms }, name)) continue;
    if (rooms.some((r) => packagesShareTrade(r.name, name))) continue;

    const amount = Number(entry?.amount);
    const priceHitsExisting = (priceUpdates || []).some((u) => {
      const target = findRoomForPackageName({ rooms }, u?.packageName);
      if (!target) return false;
      const uAmount = Number(u?.amount);
      if (amount > 0 && uAmount > 0 && Math.abs(amount - uAmount) > 0.01) return false;
      return packagesShareTrade(name, target.name);
    });
    if (priceHitsExisting) continue;

    if (
      out.some((kept) => {
        const keptAmount = Number(kept.amount);
        const sameMoney =
          !(amount > 0) ||
          !(keptAmount > 0) ||
          Math.abs(amount - keptAmount) < 0.01;
        return sameMoney && packagesShareTrade(kept.name, name);
      })
    ) {
      continue;
    }
    out.push(entry);
  }
  return out;
}

function consolidateRefinePatch(draft, patch) {
  if (!patch) return patch;
  const next = { ...patch };
  next.addPackages = consolidateAddPackages(
    draft,
    next.addPackages || [],
    next.packagePrices || []
  );
  return next;
}

function commandRequestsMaterialLaborSplit(command) {
  return /\bmaterials?\b/i.test(String(command || '')) && /\blabou?r\b/i.test(String(command || ''));
}

/**
 * Lightweight deterministic parse for common add/remove/price commands so
 * "add X" and "$300 material / $900 labor" work even if the LLM omits fields
 * or invents fake sqft quantities from dollar amounts.
 */
function buildDeterministicRefinePatchFromCommand(command, draftInput) {
  const text = String(command || '').trim();
  const patch = { addPackages: [], removePackages: [], packagePrices: [] };
  if (!text) return patch;

  const removeMatch = text.match(
    /^(?:remove|delete|exclude)\s+(?:scope\s+item\s+|the\s+)?(.+?)(?:\s*,.*)?$/i
  );
  if (removeMatch) {
    const name = removeMatch[1].replace(/\b(please|from\s+bid|from\s+scope)\b/gi, '').trim();
    if (name && name.length <= 120) patch.removePackages.push(name);
    return patch;
  }

  const parsedSplit = tryParseMaterialLaborSplit(text, draftInput);
  if (parsedSplit) {
    appendMaterialLaborSplitToPatch(patch, parsedSplit, draftInput);
    return patch;
  }

  // "cabinet hardware $300 material and $900 labor" / "make hardware 300 for material and 900 for labor"
  const splitMatch = text.match(
    /(?:for\s+)?(.+?)\s+(?:can you\s+)?(?:make|set|use|change|update)?\s*\$?\s*([\d,]+(?:\.\d+)?\s*k?)\s*(?:for\s+)?materials?\s+(?:and\s+|&\s*)\$?\s*([\d,]+(?:\.\d+)?\s*k?)\s*(?:for\s+)?labou?r/i
  );
  if (splitMatch) {
    let name = cleanPackageNameFromCommand(splitMatch[1]);
    if (!name) name = extractPackageNameHint(text);
    const material = parseCommandMoney(splitMatch[2]);
    const labor = parseCommandMoney(splitMatch[3]);
    if (name && material != null && labor != null) {
      appendMaterialLaborSplitToPatch(
        patch,
        { name, material, labor },
        draftInput
      );
      return patch;
    }
  }

  // Reverse order: "$900 labor and $300 material for cabinet hardware"
  const splitMatchReverse = text.match(
    /\$?\s*([\d,]+(?:\.\d+)?\s*k?)\s*(?:for\s+)?labou?r\s+(?:and\s+|&\s*)\$?\s*([\d,]+(?:\.\d+)?\s*k?)\s*(?:for\s+)?materials?\s+(?:for\s+)?(.+)$/i
  );
  if (splitMatchReverse) {
    const labor = parseCommandMoney(splitMatchReverse[1]);
    const material = parseCommandMoney(splitMatchReverse[2]);
    let name = cleanPackageNameFromCommand(splitMatchReverse[3]);
    if (!name) name = extractPackageNameHint(text);
    if (name && material != null && labor != null) {
      appendMaterialLaborSplitToPatch(
        patch,
        { name, material, labor },
        draftInput
      );
      return patch;
    }
  }

  // "demo $500 labor" / "add for kitchen demo $500 labor" / "cabinet hardware $1200"
  // Never use single-leg priced parse when the command asks for both material AND labor.
  if (!commandRequestsMaterialLaborSplit(text)) {
  const pricedMatch = text.match(
    /(?:add\s+(?:for\s+)?|for\s+|set\s+|make\s+)?(.+?)\s+\$?\s*([\d,]+(?:\.\d+)?\s*k?)\s*(?:dollars?)?\s*(labou?r|materials?|lump(?:\s*sum)?|total|allowance)?\s*[.?!]*$/i
  );
  if (pricedMatch) {
    const name = cleanPackageNameFromCommand(pricedMatch[1]);
    const amount = parseCommandMoney(pricedMatch[2]);
    const kindRaw = String(pricedMatch[3] || '').toLowerCase();
    let kind = 'lump_sum';
    if (/labou?r/.test(kindRaw)) kind = 'labor';
    else if (/material/.test(kindRaw)) kind = 'material';
    if (name && amount != null && amount > 0 && !/\b(sqft|lf|cy|squares?)\b/i.test(pricedMatch[0])) {
      patch.packagePrices.push({ packageName: name, amount, kind });
      // "add X $N" — create a row only when no existing package already matches this trade.
      if (/^add\b/i.test(text)) {
        const existing = draftInput ? findRoomForPackageName(draftInput, name) : null;
        if (!existing) {
          const titled = name
            .split(/\s+/)
            .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
            .join(' ');
          patch.addPackages.push({
            name: titled,
            scope: titled,
            quantity: null,
            unit: null,
            amount,
          });
        }
      }
      return patch;
    }
  }
  }

  const addMatch = text.match(
    /^(?:add|include)\s+(?:scope\s+item\s+|a\s+|an\s+|the\s+)?(.+)$/i
  );
  if (addMatch) {
    let rest = addMatch[1].trim();
    let amount = null;
    const money = rest.match(
      /(?:\$\s*([\d,]+(?:\.\d+)?)|([\d,]+(?:\.\d+)?)\s*k\b)/i
    );
    if (money) {
      if (money[1]) amount = Number(String(money[1]).replace(/,/g, ''));
      else if (money[2]) amount = Number(String(money[2]).replace(/,/g, '')) * 1000;
      rest = rest.replace(money[0], '').replace(/\bat\b|\bfor\b|\ballowance\b/gi, '').trim();
    }
    let quantity = null;
    let unit = null;
    const qty = rest.match(/(\d[\d,]*(?:\.\d+)?)\s*(lf|sqft|sq\s*ft|cy|squares?|each)\b/i);
    if (qty) {
      quantity = Number(String(qty[1]).replace(/,/g, ''));
      unit = qty[2].toLowerCase().replace(/\s+/g, '');
      if (unit === 'sqft' || unit === 'sqft') unit = 'sqft';
      if (unit.startsWith('square')) unit = 'squares';
      rest = rest.replace(qty[0], '').trim();
    }
    const name = rest
      .replace(/^[\s\-–,]+|[\s\-–,]+$/g, '')
      .replace(/\s{2,}/g, ' ')
      .slice(0, 120);
    if (name) {
      const titled = name
        .split(/\s+/)
        .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
        .join(' ');
      patch.addPackages.push({
        name: titled,
        scope: titled,
        quantity,
        unit,
        amount: Number.isFinite(amount) && amount > 0 ? amount : null,
      });
      if (Number.isFinite(amount) && amount > 0) {
        patch.packagePrices.push({ packageName: titled, amount, kind: 'lump_sum' });
      }
    }
  }
  return patch;
}

/** Priced lump-sum "add X for $N" — rules are authoritative; LLM must not add sibling rows. */
function isDeterministicPricedAddCommand(command, patch) {
  if (commandRequestsMaterialLaborSplit(command)) return false;
  const text = String(command || '').trim();
  if (!/^add\b/i.test(text)) return false;
  if (!Array.isArray(patch?.packagePrices) || !patch.packagePrices.some((p) => Number(p.amount) > 0)) {
    return false;
  }
  // Split adds use material + labor legs only — never addPackages.
  const lumpLegs = patch.packagePrices.filter(
    (p) => p.kind !== 'material' && p.kind !== 'labor'
  );
  if (!lumpLegs.length) return false;
  return !Array.isArray(patch?.addPackages) || patch.addPackages.length <= 1;
}

/** Both material and labor legs parsed — rules are authoritative; skip LLM. */
function isDeterministicSplitCommand(command, patch) {
  if (!commandRequestsMaterialLaborSplit(command)) return false;
  const prices = Array.isArray(patch?.packagePrices) ? patch.packagePrices : [];
  const hasMat = prices.some((p) => p.kind === 'material' && Number(p.amount) > 0);
  const hasLab = prices.some((p) => p.kind === 'labor' && Number(p.amount) > 0);
  return hasMat && hasLab;
}

/**
 * Compact, deterministic text summary of the draft the LLM reviews.
 * Keeps token usage predictable regardless of draft size.
 */
function buildDraftStateSummary(draft) {
  const lines = [];
  lines.push(`Project type: ${draft.projectType || 'unknown'}`);
  if (draft.estimateTier) lines.push(`Complexity tier: ${draft.estimateTier}`);
  if (draft.projectAddress) lines.push(`Address: ${draft.projectAddress}`);
  lines.push(`Customer name: ${draft.customerName || 'MISSING'}`);

  const packages = draft.scopePackages || [];
  lines.push(`\nScope packages (${packages.length}):`);
  for (const pkg of packages.slice(0, 30)) {
    const qty = pkg.scopeQuantities?.[0];
    const qtyText = qty ? ` · ${qty.quantity} ${qty.unit}` : ' · NO MEASUREMENT';
    const amount = pkg.price ?? pkg.knownSubtotal ?? pkg.calculatedSubtotal;
    const priceText =
      amount != null && amount > 0 ? ` · ${formatMoney(amount)}` : ' · NO PRICE';
    lines.push(`- ${pkg.name} [${pkg.status || 'unknown'}]${qtyText}${priceText}`);
  }

  const m = draft.scopeMeasurements || {};
  const measurementEntries = Object.entries(m).filter(
    ([key, value]) =>
      MEASUREMENT_KEY_WHITELIST.has(key) && Number.isFinite(Number(value)) && Number(value) > 0
  );
  if (measurementEntries.length) {
    lines.push(`\nKnown measurements:`);
    for (const [key, value] of measurementEntries) lines.push(`- ${key}: ${value}`);
  }

  if (draft.allowances?.length) {
    lines.push(`\nAllowances:`);
    for (const a of draft.allowances.slice(0, 10)) {
      lines.push(
        `- ${a.name || a.description || 'allowance'}: ${a.amount != null ? formatMoney(a.amount) : 'no amount'}${a.unit ? ` ${a.unit}` : ''} [${a.status || ''}]`
      );
    }
  }

  if (draft.inclusions?.length) lines.push(`\nInclusions: ${draft.inclusions.slice(0, 10).join('; ')}`);
  if (draft.exclusions?.length) lines.push(`Exclusions: ${draft.exclusions.slice(0, 10).join('; ')}`);
  if (draft.missingInfo?.length) lines.push(`\nMissing info flags: ${draft.missingInfo.slice(0, 12).join('; ')}`);

  const notes = String(draft.originalNotes || '').trim();
  if (notes) {
    lines.push(`\nOriginal notes (excerpt):\n${notes.slice(0, 1200)}`);
  }
  return lines.join('\n');
}

const QUESTION_SYSTEM_PROMPT = `You are a senior construction estimator reviewing a draft estimate before it goes to a contractor for final review.

You will receive a structured summary of the draft: scope packages with their pricing/measurement status, known measurements, allowances, and the original job notes.

Ask ONLY the highest-impact clarifying questions — the ones whose answers would most improve this specific estimate. Prioritize in this order:
1. Missing measurements that unlock pricing (sqft, LF, CY, squares) for scopes marked NO MEASUREMENT — ask for the quantity, not the dollar price
2. Genuine scope ambiguity from the notes (e.g. "cabinets" — stock or custom? who supplies? is demo included?)
3. Soft-cost / allowance packages with NO PRICE (permits, cleanup, haul-off) — ask for a budget or allowance once
4. Missing project info (phone, address) only if nothing more important remains

Rules:
- Maximum ${MAX_QUESTIONS} questions. Prefer 2–3. Fewer is better if the draft is mostly complete.
- Do NOT ask "What is the price for X?" for every unpriced package. That is too generic.
- Prefer one measurement question that unlocks pricing over asking for a lump-sum price.
- If floor/building sqft is already in the notes, do not re-ask it — ask for the trade-specific quantity (e.g. drywall surface sqft, shower wall tile sqft).
- Every question must reference this specific job. Never ask generic checklist questions.
- Never ask about something already answered in the notes or summary.
- One fact per question. Answerable in a short phrase or number.
- For measurement questions, always set targetKey to the matching whitelisted key.

Return ONLY valid JSON:
{
  "questions": [
    {
      "id": "q1",
      "question": "string — the question to show the contractor",
      "why": "string — one short clause on why this matters for the estimate",
      "kind": "measurement" | "pricing" | "scope" | "project_info",
      "targetKey": "one of the measurement keys provided, or null",
      "targetPackage": "exact scope package name this concerns, or null"
    }
  ]
}`;

const ANSWER_SYSTEM_PROMPT = `You convert a contractor's answers to clarifying questions into a structured patch for a draft estimate. You never invent information — only extract what the contractor's answers state.

CRITICAL RULES (same as the estimate parser):
1. Numbers with sqft, sq ft, LF, linear feet, CY, squares are QUANTITIES, never dollar amounts.
2. Only report a price when the answer has a $ sign or clear price words (cost, price, allowance, budget, total).
3. Preserve stated numbers exactly. If an answer is vague ("not sure", "probably fine"), extract nothing from it.
4. packageName must be copied exactly from the question's targetPackage or the package named in the question.

Return ONLY valid JSON:
{
  "measurements": [{ "key": "whitelisted measurement key", "quantity": number, "unit": "sqft|lf|cy|squares|tons" }],
  "packageQuantities": [{ "packageName": "exact scope package name", "quantity": number, "unit": "sqft|lf|cy|squares|each|tons" }],
  "packagePrices": [{ "packageName": "string", "amount": number, "kind": "lump_sum" | "labor" | "material" }],
  "addPackages": [],
  "removePackages": [],
  "inclusions": ["short statements now confirmed included"],
  "exclusions": ["short statements now confirmed excluded"],
  "projectInfo": { "customerName": "string or null", "projectAddress": "string or null", "customerPhone": "string or null" },
  "notesAddendum": "one or two sentences capturing any remaining clarified facts, or null"
}
Use empty arrays / null when a section has nothing. Omit nothing that the answers clearly state.

PACKAGE QUANTITY RULES:
- Prefer packageQuantities when the answer is a measurement for a named scope package (trenching LF, roofing sqft, cabinet LF).
- If the question asks for square footage, unit MUST be "sqft" — never "squares".
- Roofing "squares" (1 square = 100 sqft) only when the question explicitly says squares, not square footage.
- Utility trenching / cabinets / baseboard → unit "lf".`;

const REFINE_SYSTEM_PROMPT = `You convert a contractor's free-form revision command into a structured patch for a draft estimate.

You will receive the current draft summary (with package names and prices) and one revision command like:
- "make the kitchen $2k cheaper"
- "remove demo, customer is doing it"
- "set drywall to 1800 sqft"
- "permits are $2500"
- "customer is Bob at 12 Main St"

CRITICAL RULES:
1. Never invent facts not stated or clearly implied by the command.
2. Numbers with sqft, LF, CY, squares are QUANTITIES, never dollar amounts. Do NOT put a dollar total into packageQuantities.
3. Dollar amounts ("$1200", "$300 material", "$900 labor", "500 labor") go ONLY in packagePrices with kind lump_sum|material|labor. Never invent a matching packageQuantities row like quantity=1200 unit=sqft.
4. For price changes ("$2k cheaper", "cut flooring by 500"), compute the NEW absolute amount from the current package price in the summary. Put that absolute amount in packagePrices — do not invent a package that isn't in the draft.
5. For "remove X" / "exclude X" / "customer doing X" / "delete X": add to removePackages (exact package name from the draft) AND exclusions.
6. For "add X for $N" / "add X $N": ONE scope row only. If a matching package already exists in the draft, use packagePrices on that name — do NOT add addPackages. Never create sibling rows (e.g. "Pool Installation" + "Pool Bid" + "Pool Allowance") unless the command explicitly names multiple items.
7. For material/labor splits ("$8k material $4k labor for cabinets"): put TWO entries in packagePrices on the SAME packageName (kind material + kind labor). Do NOT use addPackages for splits.
8. packageName / removePackages names must match draft package names exactly (or the closest clear match).
9. If the command is unclear or cannot change the draft, return empty arrays and notesAddendum explaining what you need.
10. Prefer packageQuantities for measurements tied to a named package. Square footage → unit "sqft", never "squares" unless the command says squares.

Return ONLY valid JSON:
{
  "measurements": [{ "key": "whitelisted measurement key", "quantity": number, "unit": "sqft|lf|cy|squares|tons" }],
  "packageQuantities": [{ "packageName": "exact scope package name", "quantity": number, "unit": "sqft|lf|cy|squares|each|tons" }],
  "packagePrices": [{ "packageName": "string", "amount": number, "kind": "lump_sum" | "labor" | "material" }],
  "addPackages": [{ "name": "new scope package name", "scope": "short description or null", "quantity": number | null, "unit": "sqft|lf|cy|each|lump_sum|null", "amount": number | null }],
  "removePackages": ["exact package name to remove from the bid"],
  "inclusions": ["short statements now confirmed included"],
  "exclusions": ["short statements now confirmed excluded"],
  "projectInfo": { "customerName": "string or null", "projectAddress": "string or null", "customerPhone": "string or null" },
  "notesAddendum": "one sentence capturing the revision, or null"
}`;

function sanitizeQuestionItems(rawItems, draft) {
  if (!Array.isArray(rawItems)) return [];
  const items = [];
  const seen = new Set();
  for (const raw of rawItems) {
    const question = String(raw?.question || '').trim();
    if (!question || question.length > 240) continue;
    const dedupeKey = question.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const kind = QUESTION_KINDS.has(raw?.kind) ? raw.kind : 'scope';
    const targetKey =
      typeof raw?.targetKey === 'string' && MEASUREMENT_KEY_WHITELIST.has(raw.targetKey)
        ? raw.targetKey
        : null;
    const targetPackage =
      typeof raw?.targetPackage === 'string' && findRoomForPackageName(draft, raw.targetPackage)
        ? raw.targetPackage
        : null;
    items.push({
      id: `clarify-${items.length + 1}`,
      question,
      why: typeof raw?.why === 'string' ? raw.why.trim().slice(0, 160) : null,
      kind,
      targetKey,
      targetPackage,
    });
    if (items.length >= MAX_QUESTIONS) break;
  }
  return items;
}

async function generateClarifyQuestions(draftInput, deps = {}) {
  const { openai, aiModels, aiRuntime } = deps;
  const enriched = enrichDraft(draftInput);

  const fallback = () => {
    const staticResult = buildClarifyQuestions(enriched);
    return {
      ...staticResult,
      questionItems: staticResult.questions.map((question, index) => ({
        id: `clarify-static-${index + 1}`,
        question,
        why: null,
        kind: 'scope',
        targetKey: null,
        targetPackage: null,
      })),
      source: 'rules',
    };
  };

  if (!openai || !aiModels?.assistant?.estimate) return fallback();

  try {
    const summary = buildDraftStateSummary(enriched);
    const completion = await openai.chat.completions.create({
      model: aiModels.assistant.estimate,
      response_format: aiRuntime?.assistant?.estimate?.responseFormat || { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 1200,
      messages: [
        { role: 'system', content: QUESTION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Measurement keys you may use for targetKey: ${[...MEASUREMENT_KEY_WHITELIST].join(', ')}\n\nDraft estimate summary:\n\n${summary}`,
        },
      ],
    });

    const content = completion.choices?.[0]?.message?.content;
    if (!content) return fallback();
    const parsed = JSON.parse(content);
    const questionItems = sanitizeQuestionItems(parsed?.questions, enriched);
    if (!questionItems.length) return fallback();

    return {
      questions: questionItems.map((item) => item.question),
      questionItems,
      needsReviewCount: (enriched.needsReviewItems || []).length,
      missingInfoCount: (enriched.missingInfo || []).length,
      detectedTrades: enriched.detectedTrades || [],
      source: 'ai',
    };
  } catch (err) {
    console.warn('generateClarifyQuestions LLM pass failed, using static questions:', err?.message);
    return fallback();
  }
}

/**
 * Deterministically apply a validated patch to the draft, then re-enrich.
 * Returns { draft, appliedSummary } — appliedSummary lists what changed so
 * the mobile UI can show "Applied: drywall 1,200 sqft, Permits $2,000".
 *
 * @param {object} draftInput
 * @param {object} patch
 * @param {{ overwriteProjectInfo?: boolean }} [options]
 */
function applyClarifyPatch(draftInput, patch, options = {}) {
  const draft = { ...(draftInput || {}) };
  const appliedSummary = [];
  const overwriteProjectInfo = Boolean(options.overwriteProjectInfo);

  // 0. Remove packages (refine: "remove demo").
  const removeNames = (Array.isArray(patch?.removePackages) ? patch.removePackages : [])
    .map((n) => String(n || '').trim())
    .filter(Boolean);
  if (removeNames.length) {
    const before = draft.rooms || [];
    const kept = [];
    for (const room of before) {
      const match = removeNames.some((name) => {
        const a = normalizeName(name);
        const b = normalizeName(room.name);
        return a && b && (a === b || a.includes(b) || b.includes(a));
      });
      if (match) {
        appliedSummary.push(`Removed: ${room.name}`);
      } else {
        kept.push(room);
      }
    }
    draft.rooms = kept;
    if (Array.isArray(draft.scopePackages)) {
      draft.scopePackages = draft.scopePackages.filter((pkg) =>
        kept.some((r) => normalizeName(r.name) === normalizeName(pkg.name))
      );
    }
  }

  // 0b. Add packages (refine: "add landscaping", "add scope item fencing").
  const addEntries = consolidateAddPackages(
    draft,
    Array.isArray(patch?.addPackages) ? patch.addPackages : [],
    Array.isArray(patch?.packagePrices) ? patch.packagePrices : []
  );
  if (addEntries.length) {
    let rooms = [...(draft.rooms || [])];
    for (const entry of addEntries) {
      const name = String(entry?.name || '').trim().slice(0, 120);
      if (!name) continue;
      if (findRoomForPackageName({ rooms }, name)) {
        // Already exists — skip create; later price/qty steps can still update it.
        continue;
      }
      const scope = String(entry?.scope || name).trim().slice(0, 300);
      const quantity = Number(entry?.quantity);
      const unit = String(entry?.unit || '').toLowerCase() || null;
      const amount = Number(entry?.amount);
      const hasQty = Number.isFinite(quantity) && quantity > 0 && unit;
      const hasAmount = Number.isFinite(amount) && amount > 0;

      const room = {
        name,
        scope,
        price: hasAmount ? amount : null,
        laborPrice: null,
        materialPrice: null,
        priceIncludesLaborAndMaterials: hasAmount,
        priceProvidedByUser: hasAmount,
        pricingItems: [],
        missingPriceItems: [],
        ...(hasQty
          ? {
              scopeQuantities: [
                {
                  label: name,
                  quantity,
                  unit: unit === 'square' ? 'squares' : unit,
                  quantitySource: 'user_entered',
                },
              ],
            }
          : {}),
      };
      rooms.push(room);
      appliedSummary.push(
        hasAmount
          ? `Added: ${name} (${formatMoney(amount)})`
          : hasQty
            ? `Added: ${name} (${formatQuantityLabel(quantity, unit)})`
            : `Added: ${name}`
      );
    }
    draft.rooms = rooms;
  }

  // 1. Package prices → rooms (enrichDraft rebuilds scopePackages from rooms).
  // Also stamp Confirm Scope itemQuantities as dollar allowances so Step 3 does
  // not invent fake sqft quantities (e.g. $1,200 → "1,200 sqft").
  const priceUpdates = Array.isArray(patch?.packagePrices) ? patch.packagePrices : [];
  const pricedPackageNames = new Set();
  const priceAmountsByPackage = new Map();
  let rooms = [...(draft.rooms || [])];
  const priceItemQuantities = {
    ...(draft.scopeMeasurements?.itemQuantities || {}),
  };
  for (const update of priceUpdates) {
    const amount = Number(update?.amount);
    if (!Number.isFinite(amount) || amount < 0) continue;
    const room = findRoomForPackageName({ rooms }, update?.packageName);
    if (!room) continue;
    const kind = update?.kind === 'labor' || update?.kind === 'material' ? update.kind : 'lump_sum';
    const pkgKey = normalizeName(room.name);
    pricedPackageNames.add(pkgKey);
    const prior = priceAmountsByPackage.get(pkgKey) || { material: 0, labor: 0, lump: 0 };
    if (kind === 'material') prior.material = amount;
    else if (kind === 'labor') prior.labor = amount;
    else prior.lump = amount;
    priceAmountsByPackage.set(pkgKey, prior);

    rooms = rooms.map((r) => {
      if (r !== room) return r;
      let next;
      if (kind === 'labor') {
        const material = Number(r.materialPrice) || 0;
        next = {
          ...r,
          laborPrice: amount,
          price: material > 0 ? Math.round((material + amount) * 100) / 100 : amount,
          priceIncludesLaborAndMaterials: false,
          priceProvidedByUser: true,
        };
      } else if (kind === 'material') {
        const labor = Number(r.laborPrice) || 0;
        next = {
          ...r,
          materialPrice: amount,
          price: labor > 0 ? Math.round((labor + amount) * 100) / 100 : amount,
          priceIncludesLaborAndMaterials: false,
          priceProvidedByUser: true,
        };
      } else {
        next = {
          ...r,
          price: amount,
          laborPrice: null,
          materialPrice: null,
          priceIncludesLaborAndMaterials: true,
          priceProvidedByUser: true,
        };
      }
      // Keep display as 1 lump sum — never turn the dollar total into sqft/LF qty.
      const total = Number(next.price) || amount;
      next.scopeQuantities = [
        {
          label: r.name,
          quantity: 1,
          unit: 'lump_sum',
          quantitySource: 'user_entered',
        },
      ];
      next.budgetSplitBasis = null;
      next.knownSubtotal = total;
      next.calculatedSubtotal = total;
      return next;
    });

    const ruleKey = lookupRuleKeyForPackage(room.name, room.scope || '');
    if (ruleKey) {
      if (kind === 'material') {
        priceItemQuantities[`${ruleKey}__material`] = {
          quantity: amount,
          unit: 'allowance',
          quantitySource: 'user_entered',
        };
      } else if (kind === 'labor') {
        priceItemQuantities[`${ruleKey}__labor`] = {
          quantity: amount,
          unit: 'allowance',
          quantitySource: 'user_entered',
        };
      }
      // Preserve the other leg from the room / prior stamps so a labor-only
      // update does not wipe an existing material amount (and vice versa).
      const mat =
        kind === 'material'
          ? amount
          : Number(
              priceItemQuantities[`${ruleKey}__material`]?.quantity ||
                room.materialPrice ||
                0
            );
      const lab =
        kind === 'labor'
          ? amount
          : Number(
              priceItemQuantities[`${ruleKey}__labor`]?.quantity || room.laborPrice || 0
            );
      if (mat > 0) {
        priceItemQuantities[`${ruleKey}__material`] = {
          quantity: mat,
          unit: 'allowance',
          quantitySource: 'user_entered',
        };
      }
      if (lab > 0) {
        priceItemQuantities[`${ruleKey}__labor`] = {
          quantity: lab,
          unit: 'allowance',
          quantitySource: 'user_entered',
        };
      }
      const total = mat + lab > 0 ? mat + lab : amount;
      priceItemQuantities[`${ruleKey}__allowance`] = {
        quantity: total,
        unit: 'allowance',
        quantitySource: 'user_entered',
      };
      priceItemQuantities[ruleKey] = {
        quantity: total,
        unit: 'allowance',
        quantitySource: 'user_entered',
      };
    }

    appliedSummary.push(`${room.name}: ${formatMoney(amount)}${kind === 'lump_sum' ? '' : ` ${kind}`}`);
  }
  draft.rooms = rooms;
  if (priceUpdates.length) {
    draft.scopeMeasurements = {
      ...(draft.scopeMeasurements || {}),
      itemQuantities: {
        ...(draft.scopeMeasurements?.itemQuantities || {}),
        ...priceItemQuantities,
      },
    };
  }

  // 2. Inclusions / exclusions.
  const addStrings = (existing, incoming, label) => {
    const clean = (Array.isArray(incoming) ? incoming : [])
      .map((s) => String(s || '').trim())
      .filter((s) => s && s.length <= 200);
    if (!clean.length) return existing || [];
    appliedSummary.push(`${clean.length} ${label} noted`);
    return [...new Set([...(existing || []), ...clean])];
  };
  draft.inclusions = addStrings(draft.inclusions, patch?.inclusions, 'inclusion(s)');
  draft.exclusions = addStrings(draft.exclusions, patch?.exclusions, 'exclusion(s)');

  // 3. Project info — clarify fills blanks; refine may overwrite.
  const info = patch?.projectInfo || {};
  if (typeof info.customerName === 'string' && info.customerName.trim()) {
    const next = info.customerName.trim().slice(0, 120);
    if (overwriteProjectInfo || !draft.customerName) {
      if (draft.customerName !== next) {
        draft.customerName = next;
        appliedSummary.push(`Customer: ${draft.customerName}`);
      }
    }
  }
  if (typeof info.projectAddress === 'string' && info.projectAddress.trim()) {
    const next = info.projectAddress.trim().slice(0, 200);
    if (overwriteProjectInfo || !draft.projectAddress) {
      if (draft.projectAddress !== next) {
        draft.projectAddress = next;
        appliedSummary.push('Project address updated');
      }
    }
  }
  if (typeof info.customerPhone === 'string' && info.customerPhone.trim()) {
    const next = info.customerPhone.trim().slice(0, 40);
    if (overwriteProjectInfo || !draft.customerPhone) {
      if (draft.customerPhone !== next) {
        draft.customerPhone = next;
        appliedSummary.push('Customer phone updated');
      }
    }
  }

  // 4. Notes addendum — traceability plus re-parse fodder for enrichment.
  const addendum = typeof patch?.notesAddendum === 'string' ? patch.notesAddendum.trim().slice(0, 600) : '';
  if (addendum) {
    const existingNotes = String(draft.originalNotes || '').trim();
    const prefix = overwriteProjectInfo ? 'Revised' : 'Clarified';
    draft.originalNotes = existingNotes ? `${existingNotes}\n${prefix}: ${addendum}` : `${prefix}: ${addendum}`;
  }

  // 5. Package quantities — stamp directly onto matching rooms so Step 3 scope
  // rows show "50 LF" / "1,100 sqft" even when there is no top-level measurement key.
  // Skip rows that are clearly dollar totals mistaken for measurements (Ask AI
  // "$1,200 for hardware" must not become "1,200 sqft").
  const measurementPatchFromPackages = {};
  const itemQuantities = {
    ...(draft.scopeMeasurements?.itemQuantities || {}),
  };
  let roomsForQty = [...(draft.rooms || [])];
  for (const entry of Array.isArray(patch?.packageQuantities) ? patch.packageQuantities : []) {
    let quantity = Number(entry?.quantity);
    let unit = String(entry?.unit || 'sqft').toLowerCase();
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    const room = findRoomForPackageName({ rooms: roomsForQty }, entry?.packageName);
    if (!room) continue;

    const pkgKey = normalizeName(room.name);
    const priced = priceAmountsByPackage.get(pkgKey);
    const pricedTotal =
      priced && (priced.material > 0 || priced.labor > 0)
        ? priced.material + priced.labor
        : priced?.lump || Number(room.price) || 0;
    const looksLikeDollarQty =
      pricedPackageNames.has(pkgKey) &&
      (Math.abs(quantity - pricedTotal) < 0.01 ||
        Math.abs(quantity - (priced?.material || 0)) < 0.01 ||
        Math.abs(quantity - (priced?.labor || 0)) < 0.01 ||
        Math.abs(quantity - (priced?.lump || 0)) < 0.01);
    const measurementUnit = ['sqft', 'sf', 'lf', 'cy', 'squares', 'square', 'tons', 'each'].includes(unit);
    if (looksLikeDollarQty && measurementUnit && unit !== 'each') {
      continue;
    }
    if (pricedPackageNames.has(pkgKey) && (unit === 'sqft' || unit === 'sf') && !entry?.unit) {
      // Defaulted unit with a priced package — treat as price, not area.
      continue;
    }

    // Guard: never treat roofing sqft as roofing "squares".
    if (unit === 'squares' && quantity >= 100 && /roof/i.test(room.name)) {
      unit = 'sqft';
    }
    if (unit === 'square') unit = 'squares';

    roomsForQty = roomsForQty.map((r) => {
      if (r !== room) return r;
      return {
        ...r,
        scopeQuantities: [
          {
            label: r.name,
            quantity,
            unit,
            quantitySource: 'user_entered',
          },
        ],
      };
    });

    const ruleKey = lookupRuleKeyForPackage(room.name, room.scope || '');
    if (ruleKey) {
      itemQuantities[ruleKey] = {
        quantity,
        unit,
        quantitySource: 'user_entered',
      };
    }

    // Also map common packages onto top-level measurement keys when possible.
    if (ruleKey === 'cabinets' && unit === 'lf') {
      measurementPatchFromPackages.cabinetLf = quantity;
    }
    if (ruleKey === 'roof_tie_in' && unit === 'sqft') {
      // Keep package as sqft; also store approximate squares for roofing engines.
      measurementPatchFromPackages.roofSquares = Math.round((quantity / 100) * 100) / 100;
    }
    if (ruleKey === 'roof_tie_in' && unit === 'squares') {
      measurementPatchFromPackages.roofSquares = quantity;
    }

    appliedSummary.push(`${room.name}: ${formatQuantityLabel(quantity, unit)}`);
  }
  draft.rooms = roomsForQty;

  // 6. Top-level measurements — whitelisted keys only.
  const measurementPatch = { ...measurementPatchFromPackages };
  for (const entry of Array.isArray(patch?.measurements) ? patch.measurements : []) {
    let key = String(entry?.key || '');
    let quantity = Number(entry?.quantity);
    let unit = String(entry?.unit || '').toLowerCase();
    if (!MEASUREMENT_KEY_WHITELIST.has(key)) continue;
    if (!Number.isFinite(quantity) || quantity <= 0) continue;

    // If LLM put sqft into roofSquares without converting, fix it.
    if (key === 'roofSquares' && (unit === 'sqft' || quantity >= 200)) {
      // Heuristic: values >= 200 are almost certainly sqft, not squares.
      if (unit === 'sqft' || quantity >= 200) {
        quantity = Math.round((quantity / 100) * 100) / 100;
        unit = 'squares';
      }
    }

    measurementPatch[key] = quantity;
    // Avoid duplicate summary lines when packageQuantities already covered this.
    const alreadyNoted = appliedSummary.some((s) =>
      key === 'roofSquares' ? /roof/i.test(s) : s.includes(measurementKeyLabel(key))
    );
    if (!alreadyNoted) {
      appliedSummary.push(
        `${measurementKeyLabel(key)}: ${formatQuantityLabel(quantity, unit || (key.endsWith('Lf') ? 'lf' : key.includes('Cy') ? 'cy' : key === 'roofSquares' ? 'squares' : 'sqft'))}`
      );
    }
  }

  const hasMeasurementUpdates =
    Object.keys(measurementPatch).length > 0 || Object.keys(itemQuantities).length > 0;

  const withMeasurements = hasMeasurementUpdates
    ? applyScopeMeasurements(draft, {
        ...(draft.scopeMeasurements || {}),
        ...measurementPatch,
        itemQuantities: {
          ...(draft.scopeMeasurements?.itemQuantities || {}),
          ...itemQuantities,
        },
      })
    : draft;

  // Re-stamp room scopeQuantities after applyScopeMeasurements (it may rebuild rooms).
  if (Array.isArray(patch?.packageQuantities) && patch.packageQuantities.length) {
    const stampedRooms = [...(withMeasurements.rooms || [])];
    for (const entry of patch.packageQuantities) {
      let quantity = Number(entry?.quantity);
      let unit = String(entry?.unit || 'sqft').toLowerCase();
      if (!Number.isFinite(quantity) || quantity <= 0) continue;
      if (unit === 'squares' && quantity >= 100) unit = 'sqft';
      const room = findRoomForPackageName({ rooms: stampedRooms }, entry?.packageName);
      if (!room) continue;
      const pkgKey = normalizeName(room.name);
      const priced = priceAmountsByPackage.get(pkgKey);
      const pricedTotal =
        priced && (priced.material > 0 || priced.labor > 0)
          ? priced.material + priced.labor
          : priced?.lump || 0;
      if (
        pricedPackageNames.has(pkgKey) &&
        (Math.abs(quantity - pricedTotal) < 0.01 ||
          Math.abs(quantity - (priced?.material || 0)) < 0.01 ||
          Math.abs(quantity - (priced?.labor || 0)) < 0.01 ||
          Math.abs(quantity - (priced?.lump || 0)) < 0.01) &&
        unit !== 'each' &&
        unit !== 'allowance' &&
        unit !== 'lump_sum'
      ) {
        continue;
      }
      const idx = stampedRooms.indexOf(room);
      if (idx < 0) continue;
      stampedRooms[idx] = {
        ...room,
        scopeQuantities: [
          {
            label: room.name,
            quantity,
            unit: unit === 'square' ? 'squares' : unit,
            quantitySource: 'user_entered',
          },
        ],
      };
    }
    return {
      draft: enrichDraft({ ...withMeasurements, rooms: stampedRooms }),
      appliedSummary,
    };
  }

  return { draft: enrichDraft(withMeasurements), appliedSummary };
}

function sanitizeAnswers(answers) {
  return (Array.isArray(answers) ? answers : [])
    .map((a) => ({
      question: String(a?.question || '').trim().slice(0, 300),
      answer: String(a?.answer || '').trim().slice(0, 500),
      targetKey:
        typeof a?.targetKey === 'string' && MEASUREMENT_KEY_WHITELIST.has(a.targetKey)
          ? a.targetKey
          : null,
      targetPackage: typeof a?.targetPackage === 'string' ? a.targetPackage.slice(0, 120) : null,
    }))
    .filter((a) => a.question && a.answer);
}

async function applyClarifyAnswers(draftInput, answersInput, deps = {}) {
  const { openai, aiModels, aiRuntime } = deps;
  const answers = sanitizeAnswers(answersInput);
  if (!answers.length) {
    throw new Error('At least one answered question is required');
  }
  const enriched = enrichDraft(draftInput);
  const deterministic = buildDeterministicQuantityPatchFromAnswers(answers);

  // No-LLM fallback: apply deterministic quantities, then append Q&A to notes.
  const fallback = () => {
    const qaLines = answers.map((a) => `Clarified — ${a.question}: ${a.answer}`).join('\n');
    const existingNotes = String(enriched.originalNotes || '').trim();
    const withNotes = {
      ...enriched,
      originalNotes: existingNotes ? `${existingNotes}\n${qaLines}` : qaLines,
    };
    const { draft, appliedSummary } = applyClarifyPatch(withNotes, deterministic);
    return {
      draft,
      appliedSummary: appliedSummary.length
        ? appliedSummary
        : [`${answers.length} answer(s) added to job notes`],
      source: 'rules',
    };
  };

  if (!openai || !aiModels?.assistant?.estimate) return fallback();

  try {
    const qaText = answers
      .map(
        (a, i) =>
          `Q${i + 1}${a.targetPackage ? ` (about "${a.targetPackage}")` : ''}${a.targetKey ? ` [targetKey: ${a.targetKey}]` : ''}: ${a.question}\nA${i + 1}: ${a.answer}`
      )
      .join('\n\n');
    const completion = await openai.chat.completions.create({
      model: aiModels.assistant.estimate,
      response_format: aiRuntime?.assistant?.estimate?.responseFormat || { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 1200,
      messages: [
        { role: 'system', content: ANSWER_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Measurement keys allowed: ${[...MEASUREMENT_KEY_WHITELIST].join(', ')}\n\nScope package names in this draft: ${(enriched.scopePackages || [])
            .map((p) => p.name)
            .join(' | ')}\n\nContractor's answers:\n\n${qaText}`,
        },
      ],
    });

    const content = completion.choices?.[0]?.message?.content;
    if (!content) return fallback();
    const llmPatch = JSON.parse(content);
    // Deterministic package quantities win over LLM (fixes trenching/roofing unit bugs).
    const patch = mergePatchQuantities(llmPatch, deterministic);
    const { draft, appliedSummary } = applyClarifyPatch(enriched, patch);
    if (!appliedSummary.length) return fallback();
    return { draft, appliedSummary, source: 'ai' };
  } catch (err) {
    console.warn('applyClarifyAnswers LLM pass failed, appending to notes instead:', err?.message);
    return fallback();
  }
}

/**
 * Free-form conversational refine: "make kitchen $2k cheaper", "remove demo".
 * Reuses the same validated patch path as clarify answers.
 */
async function refineEstimateDraft(draftInput, commandInput, deps = {}) {
  const { openai, aiModels, aiRuntime } = deps;
  const command = String(commandInput || '').trim().slice(0, 500);
  if (!command) throw new Error('A revision command is required');

  const enriched = enrichDraft(draftInput);
  const deterministic = buildDeterministicRefinePatchFromCommand(command, enriched);

  const fallback = () => {
    const { draft, appliedSummary } = applyClarifyPatch(
      enriched,
      consolidateRefinePatch(enriched, deterministic),
      {
        overwriteProjectInfo: true,
      }
    );
    if (appliedSummary.length) {
      return { draft, appliedSummary, source: 'rules', command };
    }
    const existingNotes = String(enriched.originalNotes || '').trim();
    const withNotes = enrichDraft({
      ...enriched,
      originalNotes: existingNotes ? `${existingNotes}\nRevised: ${command}` : `Revised: ${command}`,
    });
    return {
      draft: withNotes,
      appliedSummary: ['Revision noted in job notes'],
      source: 'rules',
      command,
    };
  };

  if (!openai || !aiModels?.assistant?.estimate) return fallback();

  // Priced "add X for $N" or mat/lab split — rules are authoritative; skip LLM duplicates.
  if (
    isDeterministicPricedAddCommand(command, deterministic) ||
    isDeterministicSplitCommand(command, deterministic)
  ) {
    return fallback();
  }

  try {
    const summary = buildDraftStateSummary(enriched);
    const completion = await openai.chat.completions.create({
      model: aiModels.assistant.estimate,
      response_format: aiRuntime?.assistant?.estimate?.responseFormat || { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 1200,
      messages: [
        { role: 'system', content: REFINE_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Measurement keys allowed: ${[...MEASUREMENT_KEY_WHITELIST].join(', ')}\n\nCurrent draft:\n\n${summary}\n\nRevision command:\n${command}`,
        },
      ],
    });

    const content = completion.choices?.[0]?.message?.content;
    if (!content) return fallback();
    const llmPatch = JSON.parse(content);
    const patch = consolidateRefinePatch(
      enriched,
      mergePatchQuantities(
        commandRequestsMaterialLaborSplit(command)
          ? { ...llmPatch, addPackages: [] }
          : llmPatch,
        deterministic
      )
    );
    const { draft, appliedSummary } = applyClarifyPatch(enriched, patch, {
      overwriteProjectInfo: true,
    });
    if (!appliedSummary.length) return fallback();
    return { draft, appliedSummary, source: 'ai', command };
  } catch (err) {
    console.warn('refineEstimateDraft LLM pass failed, appending to notes instead:', err?.message);
    return fallback();
  }
}

module.exports = {
  generateClarifyQuestions,
  applyClarifyAnswers,
  refineEstimateDraft,
  applyClarifyPatch,
  buildDraftStateSummary,
  buildDeterministicQuantityPatchFromAnswers,
  buildDeterministicRefinePatchFromCommand,
  mergePatchQuantities,
  isDeterministicPricedAddCommand,
  isDeterministicSplitCommand,
  tryParseMaterialLaborSplit,
  sanitizeQuestionItems,
  MEASUREMENT_KEY_WHITELIST,
};
