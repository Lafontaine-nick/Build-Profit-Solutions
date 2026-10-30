#!/usr/bin/env node

/**
 * Run the first local-only estimate interpretation pilot.
 *
 * This script makes external model calls only when explicitly invoked:
 *   node scripts/run-estimate-shadow-pilot.js
 *
 * It never writes estimates or persists contractor notes.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const {
  createOpenAiClient,
  getAiModels,
} = require('../src/config/aiConfig');
const {
  extractScopeFactsFromNotes,
  resolveScopeFactsToCatalog,
} = require('../src/services/scopeFactExtractor');
const {
  evaluateScopeExtractionConfidence,
} = require('../src/services/scopeExtractionConfidence');
const { parseScopeMeasurementsFromNotes } = require('../src/services/scopeMeasurementParser');
const { requestOpenAiShadowProposal } = require('../src/services/estimateShadowOpenAi');
const { evaluateShadowCandidates } = require('../src/services/estimateShadowEvaluator');

const CATALOG = [
  { id: 'flooring_lvp', label: 'LVP', units: ['sqft'] },
  { id: 'flooring_carpet', label: 'Carpet', units: ['sqft'] },
  { id: 'flooring', label: 'Generic flooring scope (material or quantity not yet specified)', units: ['sqft'] },
  { id: 'floor_demo', label: 'Flooring demolition', units: ['sqft'] },
  { id: 'shower_pan', label: 'Shower pan', units: ['sqft'] },
  { id: 'tile_flooring', label: 'Tile flooring', units: ['sqft'] },
  { id: 'interior_paint', label: 'Interior/wall paint (only when the surface or interior area is explicit)', units: ['sqft'] },
  { id: 'tile', label: 'Tile', units: ['sqft'] },
  { id: 'paint', label: 'Generic painting (when the note only says paint)', units: ['sqft'] },
  { id: 'trim_paint', label: 'Trim painting', units: ['lf'] },
  { id: 'roofing', label: 'Roofing installation', units: ['squares'] },
  { id: 'shingles_roofing', label: 'Shingles / roofing installation', units: ['squares'] },
  { id: 'tear_off', label: 'Roof tear-off', units: ['squares'] },
  { id: 'hvac', label: 'HVAC service', units: ['each'] },
  { id: 'service_call', label: 'Service call / diagnosis', units: ['each'] },
  { id: 'drywall', label: 'Drywall', units: ['sqft'] },
  { id: 'patch_repair', label: 'Drywall patch repair', units: ['sqft'] },
  { id: 'hang', label: 'Hang drywall', units: ['sqft'] },
  { id: 'shower_tile', label: 'Shower wall tile', units: ['sqft'] },
  { id: 'stucco', label: 'Stucco replacement', units: ['sqft'] },
  { id: 'kitchen_remodel', label: 'Kitchen remodel', units: ['each'] },
  { id: 'bathroom_remodel', label: 'Bathroom remodel', units: ['each'] },
  { id: 'interior_door_install', label: 'Interior door installation', units: ['each'] },
  { id: 'baseboard_install', label: 'Baseboard installation', units: ['lf'] },
];

const CASES = [
  {
    id: 'replacement_owner_demo',
    notes: 'Replace carpet with 900 sqft LVP. Owner removes carpet.',
    context: { templateKey: 'flooring' },
    expected: {
      scopeItems: [{ id: 'flooring_lvp', quantity: 900, unit: 'sqft' }],
      exclusions: ['floor_demo'],
      clarifications: [],
    },
  },
  {
    id: 'flooring_demo_ambiguity',
    notes: 'Install 1,100 sqft LVP throughout downstairs.',
    context: { templateKey: 'flooring' },
    expected: {
      scopeItems: [{ id: 'flooring_lvp', quantity: 1100, unit: 'sqft' }],
      clarifications: [{ id: 'floor_demo' }],
    },
  },
  {
    id: 'shower_pan_demo_ambiguity',
    notes: 'New prefab shower pan. Tile shower walls, 90 sqft.',
    context: { templateKey: 'bathroom' },
    expected: {
      scopeItems: [
        { id: 'shower_pan', quantity: null, unit: null },
        { id: 'shower_tile', quantity: 90, unit: 'sqft' },
      ],
      clarifications: [{ id: 'shower_demo' }],
    },
  },
  {
    id: 'roofing_replacement',
    notes: 'Reroof 26 squares of architectural shingles. Tear off existing roof.',
    context: { templateKey: 'roofing' },
    expected: {
      scopeItems: [
        { id: 'shingles_roofing', quantity: 26, unit: 'squares' },
        { id: 'tear_off', quantity: 26, unit: 'squares' },
      ],
      clarifications: [],
    },
  },
  {
    id: 'paint_and_stucco',
    notes: 'Paint walls, 2,000 sqft. Replace the stucco, 1,800 sqft.',
    context: { templateKey: 'room_remodel' },
    expected: {
      scopeItems: [
        { id: 'interior_paint', quantity: 2000, unit: 'sqft' },
        { id: 'stucco', quantity: 1800, unit: 'sqft' },
      ],
      clarifications: [],
    },
  },
  {
    id: 'hvac_diagnosis',
    notes: 'HVAC service call to diagnose the furnace.',
    context: { templateKey: 'hvac' },
    expected: {
      scopeItems: [{ id: 'service_call', quantity: 1, unit: 'each' }],
      clarifications: [],
    },
  },
  {
    id: 'drywall_patch_exclusion',
    notes: 'Patch and texture 300 sqft of drywall. No new hang.',
    context: { templateKey: 'drywall' },
    expected: {
      scopeItems: [{ id: 'patch_repair', quantity: 300, unit: 'sqft' }],
      exclusions: ['hang'],
      clarifications: [],
    },
  },
  {
    id: 'whole_house_mixed_scope',
    notes: 'Whole house remodel. Kitchen, two bathrooms, flooring, paint, doors, and baseboard.',
    context: { templateKey: 'room_remodel' },
    expected: {
      scopeItems: [
        { id: 'kitchen_remodel', quantity: 1, unit: 'each' },
        { id: 'bathroom_remodel', quantity: 2, unit: 'each' },
        { id: 'flooring', quantity: null, unit: null },
        { id: 'paint', quantity: null, unit: null },
        { id: 'interior_door_install', quantity: null, unit: null },
        { id: 'baseboard_install', quantity: null, unit: null },
      ],
      clarifications: [],
    },
  },
  {
    id: 'explicit_flooring_demo',
    notes: 'Install 1,000 sqft LVP. Include removal of existing carpet.',
    context: { templateKey: 'flooring' },
    expected: {
      scopeItems: [
        { id: 'flooring_lvp', quantity: 1000, unit: 'sqft' },
        { id: 'floor_demo', quantity: 1000, unit: 'sqft' },
      ],
      clarifications: [],
    },
  },
  {
    id: 'cross_trade_remodel',
    notes: 'Replace carpet with 900 sqft LVP, reroof 26 squares of architectural shingles, paint walls 2,000 sqft, replace stucco 1,800 sqft, HVAC service call, and patch 300 sqft drywall. No new hang.',
    context: { templateKey: 'room_remodel' },
    expected: {
      scopeItems: [
        { id: 'flooring_lvp', quantity: 900, unit: 'sqft' },
        { id: 'shingles_roofing', quantity: 26, unit: 'squares' },
        { id: 'interior_paint', quantity: 2000, unit: 'sqft' },
        { id: 'stucco', quantity: 1800, unit: 'sqft' },
        { id: 'service_call', quantity: 1, unit: 'each' },
        { id: 'patch_repair', quantity: 300, unit: 'sqft' },
      ],
      exclusions: ['hang'],
      clarifications: [{ id: 'floor_demo' }],
    },
  },
];

const VARIANT_CASES = [
  ['replacement_owner_demo_01', 'replacement_owner_demo', 'Install 900 square feet of LVP; the owner will remove the existing carpet.'],
  ['replacement_owner_demo_02', 'replacement_owner_demo', 'Owner demo of carpet, then install 900 sqft LVP flooring.'],
  ['replacement_owner_demo_03', 'replacement_owner_demo', '900 SF LVP replacement. Existing carpet removal is by owner.'],
  ['replacement_owner_demo_04', 'replacement_owner_demo', 'Replace the carpet with 900 sq ft LVP; customer handles carpet removal.'],
  ['flooring_demo_ambiguity_01', 'flooring_demo_ambiguity', 'Downstairs gets 1,100 SF LVP. Existing floor removal is not specified.'],
  ['flooring_demo_ambiguity_02', 'flooring_demo_ambiguity', 'Install LVP throughout the lower level, about 1,100 square feet.'],
  ['flooring_demo_ambiguity_03', 'flooring_demo_ambiguity', 'New 1,100 sqft LVP downstairs; confirm whether the old flooring is removed.'],
  ['flooring_demo_ambiguity_04', 'flooring_demo_ambiguity', 'LVP installation downstairs, 1,100 sf. Existing flooring condition unknown.'],
  ['shower_pan_demo_ambiguity_01', 'shower_pan_demo_ambiguity', 'Install a prefab shower pan and tile the shower walls, 90 sqft. Existing shower removal is not stated.'],
  ['shower_pan_demo_ambiguity_02', 'shower_pan_demo_ambiguity', 'New prefabricated shower pan; 90 SF shower wall tile. Clarify existing demo.'],
  ['shower_pan_demo_ambiguity_03', 'shower_pan_demo_ambiguity', 'Prefab pan installation with 90 square feet of shower wall tile.'],
  ['shower_pan_demo_ambiguity_04', 'shower_pan_demo_ambiguity', 'Replace the shower pan with a prefab pan and tile 90 sqft of walls; existing conditions unknown.'],
  ['roofing_replacement_01', 'roofing_replacement', 'Remove the existing roof and install 26 squares of architectural shingles.'],
  ['roofing_replacement_02', 'roofing_replacement', 'Architectural shingle reroof, 26 squares, including tear-off.'],
  ['roofing_replacement_03', 'roofing_replacement', 'Tear off existing shingles and reroof 26 squares with architectural shingles.'],
  ['roofing_replacement_04', 'roofing_replacement', '26 squares architectural shingle reroof; existing roof is to be torn off.'],
  ['paint_and_stucco_01', 'paint_and_stucco', 'Paint 2,000 sqft of interior walls and replace 1,800 sqft of stucco.'],
  ['paint_and_stucco_02', 'paint_and_stucco', 'Interior wall paint: 2,000 SF. Stucco replacement: 1,800 SF.'],
  ['paint_and_stucco_03', 'paint_and_stucco', 'Paint walls (2,000 square feet) and install new stucco over 1,800 square feet.'],
  ['paint_and_stucco_04', 'paint_and_stucco', '2,000 sqft wall painting plus 1,800 sqft stucco replacement.'],
  ['hvac_diagnosis_01', 'hvac_diagnosis', 'Furnace diagnostic service call only.'],
  ['hvac_diagnosis_02', 'hvac_diagnosis', 'Send HVAC technician for a service call to diagnose the furnace.'],
  ['hvac_diagnosis_03', 'hvac_diagnosis', 'HVAC troubleshooting visit for the furnace; no equipment replacement.'],
  ['hvac_diagnosis_04', 'hvac_diagnosis', 'Service call to find the furnace problem.'],
  ['drywall_patch_exclusion_01', 'drywall_patch_exclusion', 'Patch and texture 300 square feet of drywall. Do not hang new board.'],
  ['drywall_patch_exclusion_02', 'drywall_patch_exclusion', 'Repair 300 SF of existing drywall and texture it; no new drywall hang.'],
  ['drywall_patch_exclusion_03', 'drywall_patch_exclusion', '300 sqft drywall patch/texture only. Exclude new drywall hanging.'],
  ['drywall_patch_exclusion_04', 'drywall_patch_exclusion', 'Patch existing drywall, 300 sq ft, with texture. No hang.'],
  ['whole_house_mixed_scope_01', 'whole_house_mixed_scope', 'Remodel the whole house: kitchen, two bathrooms, flooring, paint, doors, and baseboards.'],
  ['whole_house_mixed_scope_02', 'whole_house_mixed_scope', 'Kitchen and two bath remodel, plus flooring, painting, interior doors, and baseboard.'],
  ['whole_house_mixed_scope_03', 'whole_house_mixed_scope', 'Whole-home update with one kitchen, two baths, new flooring, paint, doors, and baseboard.'],
  ['whole_house_mixed_scope_04', 'whole_house_mixed_scope', 'Scope includes kitchen work, 2 bathrooms, flooring, house painting, door installation, and baseboard.'],
  ['explicit_flooring_demo_01', 'explicit_flooring_demo', 'Install 1,000 SF LVP and remove the existing carpet first.'],
  ['explicit_flooring_demo_02', 'explicit_flooring_demo', '1,000 square feet of LVP with existing carpet removal included.'],
  ['explicit_flooring_demo_03', 'explicit_flooring_demo', 'Install 1,000 sqft LVP; include demo and disposal of the old carpet.'],
  ['explicit_flooring_demo_04', 'explicit_flooring_demo', 'LVP replacement, 1,000 SF, with contractor removal of existing carpet.'],
  ['cross_trade_remodel_01', 'cross_trade_remodel', '900 sqft LVP replacing carpet; reroof 26 squares architectural shingles; paint 2,000 sqft walls; replace 1,800 sqft stucco; furnace diagnostic service call; patch 300 sqft drywall, no new hang.'],
  ['cross_trade_remodel_02', 'cross_trade_remodel', 'Mixed remodel: 900 SF carpet-to-LVP, 26-square architectural reroof, 2,000 SF wall paint, 1,800 SF stucco replacement, HVAC diagnosis, and 300 SF drywall patch. Exclude drywall hanging.'],
  ['cross_trade_remodel_03', 'cross_trade_remodel', 'Replace carpet with 900 square feet LVP. Reroof 26 squares with architectural shingles. Paint 2,000 square feet of walls. Replace 1,800 square feet stucco. Furnace service call. Patch and texture 300 square feet drywall; no new board.'],
  ['cross_trade_remodel_04', 'cross_trade_remodel', 'LVP for 900 sqft over carpet, architectural shingles for 26 squares, 2,000 sqft wall painting, 1,800 sqft stucco, furnace diagnostic, and 300 sqft drywall patch only.'],
].map(([id, baseId, notes]) => {
  const base = CASES.find((testCase) => testCase.id === baseId);
  return { ...base, id, notes };
});

const PILOT_CASES = [...CASES, ...VARIANT_CASES];

function currentBpsFromProductionParser(testCase) {
  const parsedMeasurements = parseScopeMeasurementsFromNotes(
    testCase.notes,
    testCase.context
  );
  const extracted = extractScopeFactsFromNotes(testCase.notes, {
    ...testCase.context,
    parsedMeasurements,
  });
  const resolved = resolveScopeFactsToCatalog(extracted.facts, testCase.context);
  const confidence = evaluateScopeExtractionConfidence(
    testCase.notes,
    parsedMeasurements,
    testCase.context
  );
  return {
    scopeItems: resolved
      .filter((fact) => fact.scopeId && !fact.excluded)
      .map((fact) => ({
        id: fact.scopeId,
        quantity: fact.quantity,
        unit: fact.unit,
      })),
    exclusions: resolved
      .filter((fact) => fact.scopeId && fact.excluded)
      .map((fact) => fact.scopeId),
    clarifications: (confidence.clarificationQuestions || []).map((question) => ({
      id: question.id,
      question: question.question,
    })),
  };
}

async function main() {
  const openai = createOpenAiClient();
  if (!openai) {
    throw new Error('OPENAI_API_KEY is not configured in backend/.env');
  }
  if (process.env.AI_ESTIMATE_SHADOW_ENABLED !== 'true') {
    throw new Error('Set AI_ESTIMATE_SHADOW_ENABLED=true for the local pilot only');
  }

  const model = getAiModels().assistant.estimate;
  const selectedCases = process.env.SHADOW_PILOT_CASE
    ? PILOT_CASES.filter((testCase) => testCase.id === process.env.SHADOW_PILOT_CASE)
    : PILOT_CASES;
  if (selectedCases.length === 0) {
    throw new Error(`Unknown SHADOW_PILOT_CASE: ${process.env.SHADOW_PILOT_CASE}`);
  }
  const results = [];
  for (const testCase of selectedCases) {
    try {
      const response = await requestOpenAiShadowProposal({
        openai,
        model,
        runtime: { maxTokens: 1400, temperature: 0 },
        notes: testCase.notes,
        context: testCase.context,
        catalog: CATALOG,
      });
      const currentBps = currentBpsFromProductionParser(testCase);
      const comparison = evaluateShadowCandidates({
        expected: testCase.expected,
        currentBps,
        external: response.proposal,
      });
      results.push({ id: testCase.id, ...comparison });
      console.log(
        JSON.stringify({
          id: testCase.id,
          current: comparison.current.weightedScore,
          external: comparison.external?.weightedScore ?? null,
          delta: comparison.scoreDelta,
          invented: comparison.external?.inventedScopeCount ?? null,
          inventedIds: comparison.external?.details?.inventedScope ?? [],
          externalScope: response.proposal.scopeItems,
          externalExclusions: response.proposal.exclusions,
          externalClarifications: response.proposal.clarifications,
          safeImprovement: comparison.materiallyBetter,
        })
      );
    } catch (error) {
      results.push({ id: testCase.id, error: error.message });
      console.error(JSON.stringify({ id: testCase.id, error: error.message }));
    }
  }

  const successful = results.filter((result) => result.external);
  const safeImprovements = successful.filter((result) => result.materiallyBetter).length;
  const inventedScopeCases = successful.filter(
    (result) => result.external.inventedScopeCount > 0
  ).length;
  const averageDelta = successful.length
    ? Math.round(
        (successful.reduce((sum, result) => sum + result.scoreDelta, 0) /
          successful.length) *
          10
      ) / 10
    : null;

  console.log(
    JSON.stringify({
      summary: {
        model,
        cases: selectedCases.length,
        successful: successful.length,
        failed: selectedCases.length - successful.length,
        safeImprovements,
        inventedScopeCases,
        averageScoreDelta: averageDelta,
      },
    })
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
