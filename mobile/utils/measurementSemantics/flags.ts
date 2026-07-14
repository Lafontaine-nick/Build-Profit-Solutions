/**
 * Measurement-semantics foundation is opt-in and independent of the benchmark engine flag.
 * Default: disabled (current production behavior preserved).
 */
export function measurementSemanticsV1Enabled(): boolean {
  return String(process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 || '').toLowerCase() === 'true';
}

export function benchmarkEngineV1EnvEnabled(): boolean {
  return String(process.env.EXPO_PUBLIC_BUILD_AI_BENCHMARK_ENGINE_V1 || '').toLowerCase() === 'true';
}

/** When both layers are on, benchmark apply must pass measurement validation. */
export function measurementValidationRequiredForBenchmark(): boolean {
  return measurementSemanticsV1Enabled() && benchmarkEngineV1EnvEnabled();
}
