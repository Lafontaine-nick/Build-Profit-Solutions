const express = require('express');
const {
  loadSeedDataset,
  benchmarkEngineEnabled,
  buildStageSuggestion,
  buildReasonablenessCheck,
} = require('../services/benchmarkEngine');

const router = express.Router();

function requireBenchmarkFlag(req, res, next) {
  if (!benchmarkEngineEnabled()) {
    return res.status(404).json({
      error: 'benchmark_engine_disabled',
      message: 'Benchmark engine is not enabled.',
    });
  }
  return next();
}

router.use(requireBenchmarkFlag);

router.get('/active', (req, res) => {
  const dataset = loadSeedDataset();
  res.json({
    datasetId: dataset.datasetId,
    schemaVersion: dataset.schemaVersion,
    datasetName: dataset.datasetName,
    currency: dataset.currency,
    geography: dataset.geography,
    dataStatus: dataset.dataStatus,
    sourceQualityNote: dataset.sourceQualityNote,
    weightPolicy: dataset.weightPolicy,
    nationalBenchmark: dataset.nationalBenchmark,
    laborContext: dataset.laborContext,
    summaryBaselines: dataset.summaryBaselines,
    supplementalPlanningRates: dataset.supplementalPlanningRates,
  });
});

function suggestionsFromInput(input) {
  const itemIds = Array.isArray(input.itemIds)
    ? input.itemIds.map(String)
    : input.itemId
      ? [String(input.itemId)]
      : [];
  const primaryTakeoffs = input.primaryTakeoffs || {};
  const existingSources = input.existingSources || {};
  return itemIds
    .map((itemId) =>
      buildStageSuggestion({
        itemId,
        livingSf: input.livingSf,
        buildingType: input.buildingType || 'detached',
        currentProject: {
          livingSf: input.livingSf,
          garageSf: input.garageSf,
          patioPorchSf: input.patioPorchSf,
          stories: input.stories,
          finishLevel: input.finishLevel,
          market: input.market,
        },
        existingSource: existingSources[itemId] || null,
        primaryTakeoff: primaryTakeoffs[itemId] || null,
      })
    )
    .filter(Boolean);
}

router.get('/suggestions', (req, res) => {
  const suggestions = suggestionsFromInput({
    ...req.query,
    itemIds: String(req.query.itemIds || req.query.itemId || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  });
  res.json({ suggestions });
});

router.post('/suggestions', (req, res) => {
  const suggestions = suggestionsFromInput(req.body || {});
  const reasonableness = buildReasonablenessCheck({
    estimateTotal: req.body?.estimateTotal,
    livingSf: req.body?.livingSf,
  });
  res.json({ suggestions, reasonableness });
});

module.exports = router;
