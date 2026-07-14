const { getLocalNationalWeights, loadSeedDataset } = require('./loadDataset');

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function median(values) {
  const sorted = (values || [])
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function mean(values) {
  const clean = (values || []).map(Number).filter(Number.isFinite);
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : null;
}

function range(values) {
  const clean = (values || []).map(Number).filter(Number.isFinite);
  return clean.length ? { min: Math.min(...clean), max: Math.max(...clean) } : null;
}

function blendRates({
  localRates = [],
  localMedian = null,
  nationalRate,
  sampleCount,
  nationalEscalation = null,
  dataset = loadSeedDataset(),
}) {
  const local = localMedian != null && Number.isFinite(Number(localMedian))
    ? Number(localMedian)
    : median(localRates);
  const national = Number(nationalRate);
  if (!Number.isFinite(national) || national < 0) {
    throw new Error('A valid nationalRate is required.');
  }
  const count = Number.isFinite(Number(sampleCount))
    ? Math.max(0, Number(sampleCount))
    : localRates.length;
  const weights = getLocalNationalWeights(count, dataset);
  const escalationPercent = Number(nationalEscalation?.percent || 0);
  const adjustedNationalRate = national * (1 + escalationPercent / 100);

  const effectiveLocalWeight = local == null ? 0 : weights.localWeight;
  const effectiveNationalWeight = local == null ? 1 : weights.nationalWeight;
  const blendedRate =
    (local || 0) * effectiveLocalWeight + adjustedNationalRate * effectiveNationalWeight;

  return {
    localMedianRate: local == null ? null : round(local, 6),
    localMeanRate: localRates.length ? round(mean(localRates), 6) : null,
    localRange: range(localRates),
    nationalRate: round(national, 6),
    adjustedNationalRate: round(adjustedNationalRate, 6),
    nationalEscalation:
      escalationPercent === 0
        ? null
        : {
            percent: escalationPercent,
            source: nationalEscalation?.source || 'Manual configuration',
          },
    localWeight: effectiveLocalWeight,
    nationalWeight: effectiveNationalWeight,
    blendedRate: round(blendedRate, 6),
    sampleCount: count,
  };
}

function calculatePlanningBaseline(dataset = loadSeedDataset()) {
  const summary = dataset.summaryBaselines;
  const supplemental = dataset.supplementalPlanningRates;
  return {
    coreConstructionPerLivingSf: summary.coreBlendedConstructionPerLivingSf,
    generalConditionsPerLivingSf: supplemental.generalConditionsPerLivingSf,
    contingencyPerLivingSf: supplemental.contingencyAndReservesPerLivingSf,
    projectInsurancePerLivingSf: supplemental.projectInsurancePerLivingSfDefault,
    builderFeeAndOverheadPerLivingSf:
      supplemental.builderFeeAndOverheadPerLivingSfDefault,
    planningBuildBaselinePerLivingSf: summary.planningBuildBaselinePerLivingSf,
  };
}

module.exports = {
  round,
  median,
  mean,
  range,
  blendRates,
  calculatePlanningBaseline,
};
