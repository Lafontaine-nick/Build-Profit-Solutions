const { isUnitBasedLineItem, rateFromUnitBasedLine } = require('../unitBased');
const { scoreScopeToLine, getScopeWorkIntent } = require('../scopeIntentMatching');
const { confirmRateWithMemory } = require('../confirmWithMemory');

function isMaterialLine(line, source) {
  if (source === 'material') return true;
  return /material/i.test(`${line.section || ''} ${line.category || ''}`);
}

function lookupSavedTemplate(scopeItem, savedTemplates, context = {}) {
  const templates = (savedTemplates || []).filter((t) => t && (t.payload || t.name));
  const draft = context.draft || {};
  const userId = context.userId;

  if (!templates.length) {
    return { available: false, rates: [], message: 'No saved bid templates on file' };
  }

  const scopeIntent = getScopeWorkIntent(scopeItem, draft);
  const candidates = [];

  for (const tpl of templates) {
    const payload = tpl.payload || tpl;
    const materialLines = (payload.materialLineItems || []).map((l) => ({
      line: l,
      source: 'material',
      templateName: tpl.name || 'Saved bid',
    }));
    const laborLines = (payload.laborLineItems || []).map((l) => ({
      line: l,
      source: 'labor',
      templateName: tpl.name || 'Saved bid',
    }));

    for (const { line, source, templateName } of [...materialLines, ...laborLines]) {
      const matchScore = scoreScopeToLine(scopeItem, line, source, draft);
      if (matchScore <= 0) continue;
      if (!isUnitBasedLineItem(line, scopeItem.unit)) continue;

      const scaled = rateFromUnitBasedLine(line, scopeItem);
      if (!scaled) continue;

      candidates.push({
        matchScore,
        line,
        source,
        templateName,
        scaled,
      });
    }
  }

  if (!candidates.length) {
    const hint =
      scopeIntent.workType === 'demo'
        ? 'Add a demo/removal line (e.g. "Tile demo labor") with $/sqft in your template.'
        : scopeIntent.workType === 'install'
          ? 'Add install lines (e.g. "Tile install labor", "Laminate material") with $/sqft or $/LF.'
          : 'Add unit-based ($/sqft, $/LF) lines that match this scope intent.';
    return {
      available: false,
      rates: [],
      message: `No template lines matched this scope (${scopeIntent.workType}). ${hint}`,
    };
  }

  candidates.sort((a, b) => b.matchScore - a.matchScore);

  const picked = [];
  const wantMaterial = scopeIntent.pricingRoles.includes('material');
  const wantLabor = scopeIntent.pricingRoles.includes('labor');

  if (wantMaterial) {
    const mat = candidates.find((c) => isMaterialLine(c.line, c.source));
    if (mat) picked.push(mat);
  }
  if (wantLabor) {
    const lab = candidates.find(
      (c) => !isMaterialLine(c.line, c.source) && (!picked.length || c !== picked[0])
    );
    if (lab) picked.push(lab);
  }
  if (!picked.length) picked.push(candidates[0]);

  const rates = picked.map(({ line, source, templateName, scaled, matchScore }) => {
    const confirmation = userId
      ? confirmRateWithMemory(scopeItem, scaled.rate, scaled.unit, userId)
      : { confirmed: false, confidence: 'medium', note: null };

    const roleLabel = isMaterialLine(line, source) ? 'material' : 'labor';
    return {
      pricingType: roleLabel,
      label: `${line.name || scopeItem.scopeName} (${roleLabel})`,
      rate: scaled.rate,
      unit: scaled.unit,
      quantity: scaled.quantity,
      lumpTotal: null,
      templateName,
      confidence: confirmation.confirmed ? confirmation.confidence : 'medium',
      assumptions: [
        `From saved bid template: ${templateName}`,
        `Matched as ${scopeIntent.workType} ${roleLabel} (not a different trade like demo vs install)`,
        `Unit rate $${scaled.rate}/${scaled.unit} × ${scaled.quantity.toLocaleString()} ${scaled.unit}`,
        confirmation.note,
      ].filter(Boolean),
      matchScore,
      memoryConfirmed: confirmation.confirmed,
      memoryRate: confirmation.memoryRate ?? null,
    };
  });

  return {
    available: rates.length > 0,
    rates,
    templateName: picked[0].templateName,
    scopeIntent: scopeIntent.workType,
  };
}

module.exports = { lookupSavedTemplate };
