/**
 * Runtime constants and JSDoc typedefs for the additive benchmark engine.
 * Historical estimates do not depend on these fields; all provenance is optional.
 */

const BENCHMARK_DATASET_ID = 'southern-utah-residential-benchmark-v1';
const BENCHMARK_SCHEMA_VERSION = '1.0.0';

const BUILDING_TYPES = new Set([
  'detached',
  'twin_home',
  'townhome',
  'multifamily',
  'unknown',
]);

const RATE_UNITS = new Set([
  'living_sqft',
  'surface_sqft',
  'floor_sqft',
  'roof_sqft',
  'roof_square',
  'lf',
  'cy',
  'ea',
  'fixture',
  'ton',
  'package',
  'ls',
  'percent',
  'unknown',
]);

/**
 * @typedef {'detached'|'twin_home'|'townhome'|'multifamily'|'unknown'} BenchmarkBuildingType
 * @typedef {'high'|'medium'|'low'} BenchmarkConfidence
 * @typedef {'living_sqft'|'surface_sqft'|'floor_sqft'|'roof_sqft'|'roof_square'|'lf'|'cy'|'ea'|'fixture'|'ton'|'package'|'ls'|'percent'|'unknown'} BenchmarkRateUnit
 */

module.exports = {
  BENCHMARK_DATASET_ID,
  BENCHMARK_SCHEMA_VERSION,
  BUILDING_TYPES,
  RATE_UNITS,
};
