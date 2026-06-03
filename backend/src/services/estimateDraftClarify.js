/**
 * Trade-aware clarification questions for estimate drafts.
 */

const { enrichDraft } = require('./estimateDraftEnrichment');
const { detectTrades } = require('./estimateDraftPartialPricing');

const TRADE_QUESTIONS = {
  general: [
    'Is this bid labor-only, materials-only, or labor and materials included?',
    'Are permits included or excluded?',
    'Is demo included in your scope?',
    'Is haul-off / disposal included?',
    'Are materials supplied by you or the customer?',
    'What payment schedule should this estimate use?',
    'What is the expected start date or timeline?',
    'Should AI suggest missing prices, or will you enter them manually?',
  ],
  kitchen: [
    'Are cabinets material-only or material + installation?',
    'Are countertops material-only or material + installation?',
    'Is backsplash included?',
    'Are appliances included or excluded?',
    'Are sink, faucet, and disposal included?',
    'Are plumbing and electrical reconnects included?',
    'Is demo / haul-off included?',
  ],
  bathroom: [
    'Is tile pricing material-only or allowance per sqft?',
    'What shower wall and floor square footage should we use?',
    'Is waterproofing / shower pan included?',
    'Is glass / shower door included?',
    'Are fixtures contractor-supplied or customer-supplied?',
    'Is plumbing relocation included?',
    'Are vanity, top, and faucet included?',
  ],
  flooring: [
    'What is the total square footage?',
    'What flooring product/type?',
    'Is demo / removal of existing floor included?',
    'Is floor prep / leveling included?',
    'Are transitions included?',
    'Are baseboards included or separate?',
    'Is furniture moving included?',
    'Is haul-off / disposal included?',
    'Are stairs included?',
    'Is moisture barrier included?',
    'Is material allowance separate from labor?',
  ],
  roofing: [
    'How many squares is the roof?',
    'Is tear-off included?',
    'Are underlayment, flashing, and drip edge included?',
    'Is disposal included?',
    'Are sheathing repairs included or excluded?',
  ],
  painting: [
    'Interior or exterior?',
    'Square footage or room count?',
    'Walls only or walls/ceilings/trim/doors?',
    'Is paint material included?',
    'Is primer included?',
    'Is patching included?',
    'How many paint colors?',
  ],
  plumbing: [
    'Diagnostic or install/repair scope?',
    'Are parts included?',
    'Is the fixture included?',
    'Is wall/floor access included?',
    'Is drywall repair excluded?',
    'Is a permit needed?',
  ],
  plumbing_service: [
    'Diagnostic visit or repair scope?',
    'Is this hourly or a fixed price?',
    'Are parts included?',
    'Is a return trip included?',
    'What system or fixture is included (water heater, drain, etc.)?',
    'Is access / repair to walls or floors included?',
  ],
  electrical: [
    'Are materials included?',
    'Is a permit needed?',
    'Is drywall repair excluded?',
    'Is utility coordination needed?',
    'What panel, circuit, or device count is included?',
  ],
  concrete: [
    'What square footage and slab thickness?',
    'Is demo / removal included?',
    'Is base prep included?',
    'Are rebar / wire mesh included?',
    'What finish type (broom, stamp, polish)?',
    'Is pumping included?',
  ],
  drywall: [
    'Square footage of walls/ceilings?',
    'Is patch/repair included?',
    'Texture level (smooth, orange peel, knockdown)?',
    'Is priming included?',
    'Are materials included?',
  ],
  framing: [
    'Linear feet or square footage of framing?',
    'Engineered lumber or dimensional?',
    'Are hangers, hardware, and sheathing included?',
    'Is demo of existing framing included?',
  ],
  hvac: [
    'Is equipment included?',
    'Is ductwork included?',
    'Is line set included?',
    'Is electrical included?',
    'Is permit included?',
    'Is startup/testing included?',
  ],
  landscaping: [
    'Front yard, back yard, or full property?',
    'Irrigation included or excluded?',
    'Hardscape (pavers, walls) included?',
    'Plant/material allowance separate from labor?',
  ],
  deck_patio: [
    'Square footage of deck/patio?',
    'Footings and permits included?',
    'Railing and stairs included?',
    'Material type (wood, composite, pavers)?',
  ],
  new_build: [
    'Total square footage?',
    'Are plans, engineering, and permits included?',
    'Is site work / utilities included?',
    'Which phases are in scope (foundation, framing, MEP, finishes)?',
  ],
  home_addition: [
    'Addition square footage?',
    'Are permits and engineering included?',
    'Foundation / framing / MEP / finish scope included?',
  ],
};

function buildClarifyQuestions(draft) {
  const enriched = enrichDraft(draft);
  const questions = [];
  const seen = new Set();

  const add = (q) => {
    const key = q.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      questions.push(q);
    }
  };

  const trades = enriched.detectedTrades?.length
    ? enriched.detectedTrades
    : detectTrades(
        enriched.projectType,
        (enriched.scopePackages || []).map((p) => p.scope).join(' ')
      );

  for (const q of TRADE_QUESTIONS.general) add(q);

  for (const trade of trades) {
    const list = TRADE_QUESTIONS[trade];
    if (list) for (const q of list) add(q);
  }

  for (const pkg of enriched.scopePackages || []) {
    if (pkg.status === 'partial_pricing') {
      add(
        `For ${pkg.name}, you have ${formatMoney(pkg.knownSubtotal)} priced so far — what is the target total or remaining budget?`
      );
      for (const item of pkg.pricingItems || []) {
        if (item.status === 'rough_price') {
          add(`Is "${item.name}" (${formatMoney(item.amount)}) material-only or does it include labor/install?`);
        }
      }
      for (const missing of (pkg.missingPriceItems || []).slice(0, 4)) {
        add(`What price or allowance should we use for: ${missing}?`);
      }
      add(`Do you want ${pkg.name} kept as one lump-sum package or broken into labor and materials?`);
    }
  }

  for (const allowance of enriched.allowances || []) {
    if (allowance.status === 'needs_review' && allowance.rate != null) {
      add(`What quantity (sqft, lf, hours, etc.) should we use for ${allowance.name || 'this allowance'}?`);
      if (allowance.kind !== 'labor') {
        add(
          `Is $${allowance.rate}${allowance.unit ? ` ${allowance.unit}` : ''} material-only or does it include labor?`
        );
      }
    }
  }

  if (!enriched.customerName) add('What is the customer name?');
  if (enriched.missingInfo?.some((m) => /phone/i.test(m))) add('What is the customer phone number?');
  if (enriched.missingInfo?.some((m) => /address/i.test(m))) add('What is the project address?');

  return {
    questions: questions.slice(0, 14),
    needsReviewCount: (enriched.needsReviewItems || []).length,
    missingInfoCount: (enriched.missingInfo || []).length,
    detectedTrades: trades,
  };
}

function formatMoney(amount) {
  return `$${Math.round(Number(amount) || 0).toLocaleString()}`;
}

async function clarifyEstimateDraft(draft) {
  if (!draft) throw new Error('Draft is required');
  return buildClarifyQuestions(draft);
}

module.exports = {
  clarifyEstimateDraft,
  buildClarifyQuestions,
  TRADE_QUESTIONS,
};
