/**
 * Map scope items to supplier search queries and target pricing units.
 *
 * highVarianceMaterial: many HD SKUs at different tiers — show live price in comparison
 * but recommend national average (or saved) for the bid unless user has a template.
 */

function scopeToSkuQuery(scopeItem) {
  const name = String(scopeItem.scopeName || '').toLowerCase();
  const trade = scopeItem.trade || '';
  const scope = String(scopeItem.scope || '').toLowerCase();
  const blob = `${name} ${scope}`;

  const {
    isPlumbingTrimScope,
    isElectricalTrimScope,
    isPermitsScope,
    isCleanupScope,
    isDrywallRepairScope,
    isBaseboardTrimScope,
  } = require('../sourceValidation');

  if (isPlumbingTrimScope(scopeItem) || isElectricalTrimScope(scopeItem)) return null;
  if (isPermitsScope(scopeItem) || isCleanupScope(scopeItem)) return null;
  if (isDrywallRepairScope(scopeItem) && scopeItem.unit !== 'sqft') return null;

  if (isBaseboardTrimScope(scopeItem)) {
    return {
      query: 'baseboard trim mdf primed',
      pricingUnit: 'lf',
      materialLabel: `${scopeItem.scopeName} material`,
      highVarianceMaterial: false,
    };
  }

  if (/demo|demolition|remove|removal/.test(blob)) {
    return null;
  }

  if (trade === 'flooring' || /laminate|lvp|vinyl plank|vinyl flooring/.test(blob)) {
    if (/tile/.test(blob)) {
      return {
        query: 'floor tile porcelain',
        pricingUnit: 'sqft',
        materialLabel: `${scopeItem.scopeName} material`,
        highVarianceMaterial: true,
      };
    }
    return {
      query: 'laminate flooring',
      pricingUnit: 'sqft',
      materialLabel: `${scopeItem.scopeName} material`,
      highVarianceMaterial: false,
    };
  }

  if (/tile/.test(blob) && !/demo|removal|remove/.test(blob)) {
    return {
      query: 'floor tile porcelain',
      pricingUnit: 'sqft',
      materialLabel: `${scopeItem.scopeName} material`,
      highVarianceMaterial: true,
    };
  }

  if (/carpet/.test(blob)) {
    return {
      query: 'carpet roll',
      pricingUnit: 'sqft',
      materialLabel: `${scopeItem.scopeName} material`,
      highVarianceMaterial: true,
    };
  }

  if (/drywall|sheetrock|gypsum/.test(blob)) {
    return {
      query: 'drywall sheet 4x8',
      pricingUnit: 'sqft',
      materialLabel: `${scopeItem.scopeName} material`,
      highVarianceMaterial: true,
    };
  }

  if (/paint|primer/.test(blob) && !/baseboard|trim/.test(blob)) {
    return {
      query: 'interior paint gallon',
      pricingUnit: 'sqft',
      materialLabel: `${scopeItem.scopeName} material`,
      highVarianceMaterial: true,
    };
  }

  if (/countertop|granite|quartz/.test(blob)) {
    return {
      query: 'countertop laminate',
      pricingUnit: 'sqft',
      materialLabel: `${scopeItem.scopeName} material`,
      highVarianceMaterial: true,
    };
  }

  return null;
}

function isHighVarianceMaterialQuery(querySpec) {
  return Boolean(querySpec?.highVarianceMaterial);
}

/**
 * Convert pack/box price to per-unit rate ($/LF or $/sqft).
 */
function packPriceToUnitRate(price, title, catalogUnit, targetUnit) {
  const n = Number(price);
  if (!Number.isFinite(n) || n <= 0) return null;

  const titleLower = String(title || '').toLowerCase();
  const unit = String(catalogUnit || '').toLowerCase();

  if (targetUnit === 'lf') {
    if (unit === 'sqft' || unit === 'each') {
      const ftMatch =
        titleLower.match(/\((\d+(?:\.\d+)?)\s*(?:ft|'|foot|feet|linear\s*ft)\)/i) ||
        titleLower.match(/(\d+(?:\.\d+)?)\s*(?:ft|'|linear\s*ft|lf)\b/i);
      if (ftMatch) {
        const feet = parseFloat(ftMatch[1]);
        if (feet > 0) return n / feet;
      }
    }
    if (unit === 'linearft' || unit === 'length') {
      const ftMatch = titleLower.match(/(\d+(?:\.\d+)?)\s*(?:ft|'|foot)/i);
      const feet = ftMatch ? parseFloat(ftMatch[1]) : 16;
      if (feet > 0) return n / feet;
    }
    return null;
  }

  if (targetUnit === 'sqft') {
    if (unit === 'sqft') return n;
    const sqMatch =
      titleLower.match(/(\d+(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|\bsf\b)/i) ||
      titleLower.match(/covers?\s*(\d+(?:\.\d+)?)\s*(?:sq|sf)/i);
    if (sqMatch) {
      const sqft = parseFloat(sqMatch[1]);
      if (sqft > 0) return n / sqft;
    }
    if (/box|case|carton|bundle/.test(titleLower)) {
      return n / 20;
    }
    return null;
  }

  return null;
}

function pickBestSkuResult(results, querySpec) {
  if (!results?.length || !querySpec) return null;

  for (const item of results) {
    if (!item.price || item.price <= 0) continue;
    const unitRate = packPriceToUnitRate(item.price, item.title, item.unit, querySpec.pricingUnit);
    if (unitRate != null && unitRate > 0) {
      return { item, unitRate };
    }
  }

  const first = results.find((r) => r.price > 0);
  if (!first) return null;

  const fallbackRate = packPriceToUnitRate(first.price, first.title, first.unit, querySpec.pricingUnit);
  if (fallbackRate == null || fallbackRate <= 0) return null;
  return { item: first, unitRate: fallbackRate };
}

module.exports = { scopeToSkuQuery, packPriceToUnitRate, pickBestSkuResult, isHighVarianceMaterialQuery };
