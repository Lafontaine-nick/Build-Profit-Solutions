/**
 * Client mirror of backend scopePricingMatrix.js (selection + manual/approval flags).
 */

export type MatrixItem = {
  scopeName: string;
  scope?: string;
  unit: string;
  autoSelectEligible?: boolean;
  classification?: { tradeCategory?: string };
};

function scopeBlob(item: MatrixItem) {
  return `${item.scopeName || ''} ${item.scope || ''}`.toLowerCase();
}

export function isManualPricingScope(item: MatrixItem): boolean {
  const b = scopeBlob(item);
  if (/\bplumb.*\btrim|\bplumbing\s+trim|\belectrical\s+trim|\bpermits?\b|\bcleanup|\bdisposal|\bhaul/.test(b)) return true;
  if (/\bmirror|\bbath\s+accessories/.test(b)) return true;
  if (/\bfloor\s+prep|\bsubfloor/.test(b) && !/\b(minor|patch|self[\s-]?level|cement\s+board|repair)\b/.test(b)) return true;
  if (/\bdrywall\b.*\b(repair|patch)/.test(b)) return true;
  if (/\bexcavat|\btrench/.test(b) && !/\b(lf|sqft|cy|cubic)\b/.test(b)) return true;
  if (/\b(load[\s-]?bearing|structural|panel\s+upgrade)\b/.test(b)) return true;
  return false;
}

export function isNeedsApprovalScope(item: MatrixItem): boolean {
  const b = scopeBlob(item);
  if (isManualPricingScope(item)) return false;
  if (/\bvanity\b|\btoilet\b|\bshower\s+door|\bglass\s+shower/.test(b)) return true;
  if (/\bmud\s+pan|\bshower\s+pan|\bniche|\bbench|\bcurb/.test(b)) return true;
  if (/\blighting|\blight\s+fixture|\bexhaust\s+fan/.test(b)) return true;
  if (/\bcabinet.*\binstall|\bcountertop|\bgranite|\bquartz/.test(b)) return true;
  if (/\bhvac|\bfurnace|\bheat\s+pump|\bmini[\s-]?split/.test(b)) return true;
  if (/\b(concrete|roof|shingle).*\b(rebar|pump|tear[\s-]?off|decking|flashing)/.test(b)) return true;
  if (/\b(faucet|sink|water\s+heater|outlet|switch|fixture)\b/.test(b) && /\binstall|\breplac/.test(b)) return true;
  if (/\bplant|\btree|\bshrub/.test(b)) return true;
  return false;
}

export function isAutoSelectEligibleScope(item: MatrixItem): boolean {
  if (item.autoSelectEligible === true) return true;
  if (item.autoSelectEligible === false) return false;
  if (isManualPricingScope(item) || isNeedsApprovalScope(item)) return false;
  const b = scopeBlob(item);
  const trade = String(item.classification?.tradeCategory || '').toLowerCase();
  if (/\bbaseboard|\bcrown|\btrim\s+install/.test(b) && item.unit === 'lf') return true;
  if (/\bwaterproof|\bbacker/.test(b) && item.unit === 'sqft') return true;
  if (/\bshower\b.*\btile/.test(b) && item.unit === 'sqft') return true;
  if (/\b(demo|removal|tear[\s-]?out)/.test(b)) return true;
  if (/\bflooring|\blvp|\blaminate|\bcarpet/.test(b) && /\binstall/.test(b) && item.unit === 'sqft') return true;
  if (/\bpaint|\bpainting/.test(b) && item.unit === 'sqft') return true;
  if (/\bdrywall|\bsheetrock/.test(b) && item.unit === 'sqft' && !/\b(repair|patch)/.test(b)) return true;
  if (trade === 'demo' || trade === 'flooring' || trade === 'baseboard' || trade === 'painting') return true;
  return false;
}
