const {
  loadSeedDataset,
  getDetachedProjects,
  getTwinHomeProjects,
} = require('./loadDataset');
const { blendRates, round, median, calculatePlanningBaseline } = require('./blend');
const { rankComparableProjects } = require('./similarity');
const {
  measurementSemanticsV1Enabled,
  missingStatusForScope,
} = require('../measurementSemantics');

/** Exact scope-line names that reconstruct published stage medians (verified). */
const STAGE_SCOPE_NAMES = Object.freeze({
  framing: ['Framing lumber material', 'Floor & roof trusses', 'Framing labor', 'Firewall / specialty framing'],
  'major-systems-rough-ins': ['Plumbing rough & labor', 'HVAC', 'Electrical rough & labor'],
});

const CHECKLIST_STAGE_MAP = Object.freeze({
  sitework: 'site-preconstruction',
  plans_engineering: 'site-preconstruction',
  foundation: 'foundations',
  framing: 'framing',
  roofing: 'exterior-finishes',
  exterior: 'exterior-finishes',
  mep_rough: 'major-systems-rough-ins',
  insulation: 'interior-finishes',
  drywall: 'interior-finishes',
  cabinets_counters: 'interior-finishes',
  tile_flooring: 'interior-finishes',
  paint_trim: 'interior-finishes',
  interior_finishes: 'interior-finishes',
  cleanup: 'final-steps',
  appliances: 'final-steps',
});

const SCOPE_KEYWORDS = Object.freeze({
  sitework: ['site', 'excavat', 'survey', 'grading'],
  plans_engineering: ['plans', 'engineering', 'architect'],
  foundation: ['foundation', 'footing', 'slab', 'concrete stairs'],
  framing: ['framing'],
  roofing: ['roof', 'shingle'],
  exterior: ['exterior', 'siding', 'stucco', 'masonry', 'windows', 'doors'],
  mep_rough: ['plumbing', 'electrical', 'hvac', 'mechanical'],
  insulation: ['insulation'],
  drywall: ['drywall'],
  cabinets_counters: ['cabinet', 'countertop'],
  tile_flooring: ['floor', 'tile', 'carpet'],
  paint_trim: ['paint', 'trim', 'finish carpentry'],
  appliances: ['appliance'],
  cleanup: ['cleanup', 'cleaning', 'dumpster', 'disposal'],
});

function benchmarkEngineEnabled() {
  return String(process.env.BUILD_AI_BENCHMARK_ENGINE_V1 || '').toLowerCase() === 'true';
}

function sourceProjectKey(projectId) {
  return String(projectId || '').replace(/-([a-z0-9])/g, (_, char) => char.toUpperCase());
}

function getScopeRecords(itemId, dataset = loadSeedDataset()) {
  const keywords = SCOPE_KEYWORDS[itemId] || [];
  if (!keywords.length) return [];
  return dataset.scopeBenchmarks.filter((scope) => {
    const haystack = `${scope.scopeName} ${scope.recommendedPricingBasis}`.toLowerCase();
    return keywords.some((keyword) => haystack.includes(keyword));
  });
}

function comparableScopeCost(project, scopeRecords) {
  const key = sourceProjectKey(project.projectId);
  let cost = 0;
  let found = false;
  for (const record of scopeRecords) {
    const value = record.projects?.[key]?.costPerHome;
    if (Number.isFinite(Number(value))) {
      cost += Number(value);
      found = true;
    }
  }
  return found ? round(cost) : null;
}

function primaryScopeName(scopeRecords) {
  if (!scopeRecords?.length) return null;
  return scopeRecords[0].scopeName || null;
}

function isExactSourceMatch(currentLivingSf, project) {
  const living = Number(currentLivingSf);
  const projectLiving = Number(project.livingSfPerHome);
  if (!(living > 0) || !(projectLiving > 0)) return false;
  return Math.abs(projectLiving - living) / living < 0.005;
}

function stageRatesByDetachedProject(stageId, dataset = loadSeedDataset()) {
  const names = STAGE_SCOPE_NAMES[stageId];
  if (!names?.length) return null;
  const scopes = names
    .map((name) => dataset.scopeBenchmarks.find((row) => row.scopeName === name))
    .filter(Boolean);
  if (!scopes.length) return null;
  return getDetachedProjects(dataset)
    .map((project) => {
      const key = sourceProjectKey(project.projectId);
      let rate = 0;
      let found = false;
      for (const scope of scopes) {
        const value = scope.projects?.[key]?.costPerLivingSf;
        if (Number.isFinite(Number(value))) {
          rate += Number(value);
          found = true;
        }
      }
      return found
        ? {
            projectId: project.projectId,
            name: project.name,
            rate,
          }
        : null;
    })
    .filter(Boolean);
}

function buildLeaveOneOutMedian({
  stageId,
  livingSf,
  nationalRate,
  dataset,
  exactSource,
}) {
  if (!exactSource) return null;
  const rates = stageRatesByDetachedProject(stageId, dataset);
  if (!rates?.length) {
    return {
      excludedProjectId: exactSource.projectId,
      excludedProjectName: exactSource.name,
      available: false,
      note: 'Exact source match detected. Leave-one-out median not mapped for this stage yet. Primary rates unchanged.',
    };
  }
  const remaining = rates.filter((row) => row.projectId !== exactSource.projectId);
  const leaveMedian = median(remaining.map((row) => row.rate));
  if (leaveMedian == null) {
    return {
      excludedProjectId: exactSource.projectId,
      excludedProjectName: exactSource.name,
      available: false,
      note: 'Exact source match detected. Not enough remaining projects for leave-one-out. Primary rates unchanged.',
    };
  }
  const blend = blendRates({
    localMedian: leaveMedian,
    nationalRate,
    sampleCount: remaining.length,
    dataset,
  });
  const quantity = Number(livingSf);
  return {
    excludedProjectId: exactSource.projectId,
    excludedProjectName: exactSource.name,
    available: true,
    localMedianRate: blend.localMedianRate,
    blendedRate: blend.blendedRate,
    total: Number.isFinite(quantity) && quantity > 0 ? round(quantity * blend.blendedRate) : null,
    sampleCount: remaining.length,
    note: `Leave-one-out validation excludes ${exactSource.name}. Primary published rates are unchanged.`,
  };
}

function buildComparableEvidence({ currentProject, itemId, dataset }) {
  const scopeRecords = getScopeRecords(itemId, dataset);
  const scopeName = primaryScopeName(scopeRecords);
  const ranked = rankComparableProjects(currentProject, dataset.projects, {
    market: dataset.geography.market,
    sourceYear: dataset.nationalBenchmark.sourceYear,
  });
  return ranked.map((entry) => {
    const scopeCost = comparableScopeCost(entry.project, scopeRecords);
    const exactSourceMatch = isExactSourceMatch(currentProject.livingSf, entry.project);
    return {
      projectId: entry.project.projectId,
      name: entry.project.name,
      buildingType: entry.project.buildingType,
      comparableClass: entry.project.comparableClass,
      livingSf: entry.project.livingSfPerHome,
      fullBuildingLivingSf: entry.project.livingSfFullBuilding ?? null,
      homesInSource: entry.project.homesInSource,
      preliminaryBuildCostPerHome: entry.project.preliminaryBuildCostPerHome,
      stories: entry.project.stories ?? null,
      garageSf: entry.project.garageSf ?? null,
      patioPorchSf: entry.project.patioPorchSf ?? null,
      scopeName,
      scopeCost,
      scopeCostPerLivingSf:
        scopeCost != null ? round(scopeCost / entry.project.livingSfPerHome, 4) : null,
      similarityScore: entry.similarityScore,
      similarityConfidence: entry.similarityConfidence,
      similarityReasons: entry.reasons,
      sourceStatus: dataset.dataStatus,
      includeInDetachedMedian: entry.project.includeInDetachedMedian,
      notes: entry.project.notes || [],
      exactSourceMatch,
    };
  });
}

function confidenceFor({
  sampleCount,
  selectedReason,
  unitMismatch,
  hasLivingSf,
  hasPrimaryTakeoff,
}) {
  const sourceConfidence =
    selectedReason === 'saved_contractor_price'
      ? 'high'
      : sampleCount >= 4
        ? 'medium'
        : sampleCount >= 2
          ? 'medium'
          : 'low';
  // Accurate living-SF extraction alone cannot create High price confidence.
  // Missing primary takeoff reduces quantity confidence.
  let quantityConfidence = 'medium';
  if (!hasLivingSf || unitMismatch || !hasPrimaryTakeoff) quantityConfidence = 'low';
  let priceConfidence =
    selectedReason === 'saved_contractor_price'
      ? 'high'
      : sampleCount >= 4 && !unitMismatch
        ? 'medium'
        : sampleCount >= 3 && !unitMismatch
          ? 'medium'
          : 'low';
  if (selectedReason === 'national_fallback') priceConfidence = 'low';
  if (selectedReason !== 'saved_contractor_price' && priceConfidence === 'high') {
    priceConfidence = 'medium';
  }
  return { sourceConfidence, quantityConfidence, priceConfidence };
}

function buildStageSuggestion({
  itemId,
  livingSf,
  buildingType = 'detached',
  currentProject = {},
  existingSource = null,
  primaryTakeoff = null,
  dataset = loadSeedDataset(),
}) {
  const stageId = CHECKLIST_STAGE_MAP[itemId];
  if (!stageId) return null;
  const stage = dataset.stageBenchmarks.find((entry) => entry.stageId === stageId);
  if (!stage) return null;

  const localMedian = stage.localDetachedMedianPerLivingSf;
  const blend = blendRates({
    localMedian,
    nationalRate: stage.nationalPerLivingSf,
    sampleCount: stage.localSampleCount,
    dataset,
  });
  const quantity = Number(livingSf);
  const hasLivingSf = Number.isFinite(quantity) && quantity > 0;
  const blendedTotal = hasLivingSf ? round(quantity * blend.blendedRate) : null;
  const localTotal =
    hasLivingSf && blend.localMedianRate != null
      ? round(quantity * blend.localMedianRate)
      : null;
  const nationalTotal = hasLivingSf ? round(quantity * blend.adjustedNationalRate) : null;
  const hasHigherPriority = Boolean(existingSource?.total && Number(existingSource.total) > 0);
  const selectedReason = hasHigherPriority
    ? existingSource.reason || 'saved_contractor_price'
    : blend.localMedianRate != null
      ? 'blended_local_national'
      : 'national_fallback';
  const hasPrimaryTakeoff = Boolean(
    primaryTakeoff?.quantity &&
      Number(primaryTakeoff.quantity) > 0 &&
      primaryTakeoff?.unit &&
      !['living_sqft'].includes(String(primaryTakeoff.unit))
  );
  const unitMismatch = Boolean(
    hasPrimaryTakeoff &&
      primaryTakeoff?.unit &&
      !['living_sqft', 'sqft'].includes(primaryTakeoff.unit)
  );
  const warnings = ['Benchmark pricing only — detailed takeoff still required.'];
  if (unitMismatch) {
    warnings.push(
      `Primary takeoff is ${primaryTakeoff.quantity} ${primaryTakeoff.unit}; benchmark pricing uses living SF.`
    );
  }
  if (itemId === 'roofing') {
    warnings.push('Use roof squares as the primary pricing quantity when available.');
  }
  if (['foundation', 'framing', 'insulation', 'drywall'].includes(itemId)) {
    warnings.push('Living SF is a planning denominator, not the physical trade takeoff.');
  }

  const confidence = confidenceFor({
    sampleCount: stage.localSampleCount,
    selectedReason,
    unitMismatch,
    hasLivingSf,
    hasPrimaryTakeoff: measurementSemanticsV1Enabled() ? hasPrimaryTakeoff : true,
  });
  const measurementStatus = measurementSemanticsV1Enabled()
    ? hasPrimaryTakeoff
      ? 'partially_measured'
      : missingStatusForScope(itemId)
    : null;
  const quantityRoles = measurementSemanticsV1Enabled()
    ? {
        primaryTakeoff: hasPrimaryTakeoff
          ? {
              quantity: Number(primaryTakeoff.quantity),
              unit: primaryTakeoff.unit,
            }
          : null,
        pricing: hasLivingSf
          ? { quantity, unit: 'living_sqft', rate: blend.blendedRate }
          : null,
        benchmark: hasLivingSf ? { quantity, unit: 'living_sqft' } : null,
      }
    : null;
  const projectInput = {
    buildingType,
    livingSf: quantity,
    garageSf: currentProject.garageSf,
    patioPorchSf: currentProject.patioPorchSf,
    stories: currentProject.stories,
    finishLevel: currentProject.finishLevel,
    market: currentProject.market || dataset.geography.market,
  };
  const comparables = buildComparableEvidence({
    currentProject: projectInput,
    itemId,
    dataset,
  });
  const exactSource =
    getDetachedProjects(dataset).find((project) => isExactSourceMatch(quantity, project)) || null;
  const leaveOneOut = buildLeaveOneOutMedian({
    stageId,
    livingSf: quantity,
    nationalRate: stage.nationalPerLivingSf,
    dataset,
    exactSource,
  });

  return {
    scopeId: itemId,
    stageId,
    label: stage.stageName,
    datasetId: dataset.datasetId,
    datasetVersion: dataset.schemaVersion,
    sourceKind: 'local_preliminary_budget',
    geography: dataset.geography.market,
    dataStatus: dataset.dataStatus,
    selectedReason,
    selectedSuggestion: hasHigherPriority
      ? {
          total: round(existingSource.total),
          rate: existingSource.rate ?? null,
          unit: existingSource.unit || 'unknown',
          source: existingSource.source || 'Saved contractor pricing',
        }
      : blendedTotal != null
        ? {
            total: blendedTotal,
            rate: blend.blendedRate,
            unit: 'living_sqft',
            source: dataset.datasetName,
          }
        : null,
    benchmarkIsComparisonOnly: hasHigherPriority,
    localMedian: {
      rate: blend.localMedianRate,
      unit: 'living_sqft',
      total: localTotal,
      sampleCount: stage.localSampleCount,
      buildingType: 'detached',
      sourceStatus: dataset.dataStatus,
    },
    nationalBenchmark: {
      rate: blend.nationalRate,
      adjustedRate: blend.adjustedNationalRate,
      unit: 'living_sqft',
      total: nationalTotal,
      sourceName: dataset.nationalBenchmark.sourceName,
      sourceUrl: dataset.nationalBenchmark.sourceUrl,
      sourceYear: dataset.nationalBenchmark.sourceYear,
      sampleCount: dataset.nationalBenchmark.responseCount,
      limitations: dataset.nationalBenchmark.limitations,
    },
    blendedBenchmark: {
      rate: blend.blendedRate,
      unit: 'living_sqft',
      total: blendedTotal,
      appliedQuantity: hasLivingSf ? quantity : null,
      localWeight: blend.localWeight,
      nationalWeight: blend.nationalWeight,
    },
    primaryTakeoff: primaryTakeoff || null,
    benchmarkBasis: {
      quantity: hasLivingSf ? quantity : null,
      unit: 'living_sqft',
      costPerUnit: blend.blendedRate,
    },
    localSampleCount: stage.localSampleCount,
    ...confidence,
    measurementStatus,
    quantityRoles,
    warnings,
    comparables,
    twinHomeReferences: comparables.filter((entry) => entry.buildingType === 'twin_home'),
    detachedComparables: comparables.filter(
      (entry) => entry.buildingType === 'detached' && entry.includeInDetachedMedian
    ),
    exactSourceMatch: Boolean(exactSource),
    exactSourceProjectId: exactSource?.projectId || null,
    leaveOneOut,
  };
}

function buildReasonablenessCheck({
  estimateTotal,
  livingSf,
  dataset = loadSeedDataset(),
}) {
  const total = Number(estimateTotal);
  const sqft = Number(livingSf);
  if (!Number.isFinite(total) || total < 0 || !Number.isFinite(sqft) || sqft <= 0) return null;
  const baseline = calculatePlanningBaseline(dataset);
  const currentPerLivingSf = round(total / sqft);
  const blended = baseline.planningBuildBaselinePerLivingSf;
  const baselineTotal = round(blended * sqft);
  const varianceAmount = round(total - baselineTotal);
  return {
    datasetId: dataset.datasetId,
    datasetVersion: dataset.schemaVersion,
    currentEstimate: total,
    livingSf: sqft,
    currentPerLivingSf,
    localDetachedMedianPerLivingSf:
      dataset.summaryBaselines.localDetachedMedianBuildCostPerLivingSf,
    nationalPerLivingSf: dataset.summaryBaselines.nationalConstructionCostPerLivingSf,
    blendedPlanningPerLivingSf: blended,
    baselineTotal,
    varianceAmount,
    variancePercent: baselineTotal ? round((varianceAmount / baselineTotal) * 100, 1) : null,
    disclaimer: 'Reasonableness comparison only — no estimate values were changed.',
  };
}

function buildBenchmarkProvenance(suggestion) {
  const selected = suggestion?.selectedSuggestion;
  if (!selected || suggestion.benchmarkIsComparisonOnly) return null;
  return {
    datasetId: suggestion.datasetId,
    datasetVersion: suggestion.datasetVersion,
    benchmarkKey: suggestion.stageId,
    selectedReason: suggestion.selectedReason,
    localRate: suggestion.localMedian?.rate ?? null,
    nationalRate: suggestion.nationalBenchmark?.rate ?? null,
    blendedRate: suggestion.blendedBenchmark?.rate ?? null,
    appliedQuantity: suggestion.blendedBenchmark?.appliedQuantity ?? 0,
    appliedUnit: suggestion.blendedBenchmark?.unit || 'living_sqft',
    calculatedTotal: selected.total,
    sourceSampleCount: suggestion.localSampleCount,
    similarityProjectIds: (suggestion.detachedComparables || [])
      .slice(0, 4)
      .map((entry) => entry.projectId),
    appliedAt: new Date().toISOString(),
    overriddenByUser: false,
  };
}

module.exports = {
  CHECKLIST_STAGE_MAP,
  SCOPE_KEYWORDS,
  STAGE_SCOPE_NAMES,
  benchmarkEngineEnabled,
  getScopeRecords,
  buildComparableEvidence,
  buildLeaveOneOutMedian,
  stageRatesByDetachedProject,
  buildStageSuggestion,
  buildReasonablenessCheck,
  buildBenchmarkProvenance,
};
