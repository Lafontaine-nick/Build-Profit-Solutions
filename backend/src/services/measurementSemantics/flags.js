function measurementSemanticsV1Enabled() {
  return String(process.env.BUILD_AI_MEASUREMENT_SEMANTICS_V1 || '').toLowerCase() === 'true';
}

function benchmarkEngineV1Enabled() {
  return String(process.env.BUILD_AI_BENCHMARK_ENGINE_V1 || '').toLowerCase() === 'true';
}

function measurementValidationRequiredForBenchmark() {
  return measurementSemanticsV1Enabled() && benchmarkEngineV1Enabled();
}

module.exports = {
  measurementSemanticsV1Enabled,
  benchmarkEngineV1Enabled,
  measurementValidationRequiredForBenchmark,
};
