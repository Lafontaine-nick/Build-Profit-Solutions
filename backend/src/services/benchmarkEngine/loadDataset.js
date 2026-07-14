const path = require('path');
const {
  BENCHMARK_DATASET_ID,
  BENCHMARK_SCHEMA_VERSION,
  BUILDING_TYPES,
} = require('./types');

const SEED_PATH = path.join(
  __dirname,
  '..',
  '..',
  'data',
  'benchmarks',
  'southern_utah_residential_benchmark_v1.json'
);

const registry = new Map();

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function validateDataset(dataset) {
  const issues = [];
  if (!dataset || typeof dataset !== 'object') issues.push('Dataset must be an object.');
  if (dataset?.datasetId !== BENCHMARK_DATASET_ID) {
    issues.push(`Unexpected datasetId: ${String(dataset?.datasetId || 'missing')}.`);
  }
  if (dataset?.schemaVersion !== BENCHMARK_SCHEMA_VERSION) {
    issues.push(`Unsupported schemaVersion: ${String(dataset?.schemaVersion || 'missing')}.`);
  }
  if (!Array.isArray(dataset?.projects) || !dataset.projects.length) {
    issues.push('projects must be a non-empty array.');
  }
  if (!Array.isArray(dataset?.stageBenchmarks) || !dataset.stageBenchmarks.length) {
    issues.push('stageBenchmarks must be a non-empty array.');
  }
  if (!Array.isArray(dataset?.scopeBenchmarks)) issues.push('scopeBenchmarks must be an array.');
  for (const project of dataset?.projects || []) {
    if (!project.projectId) issues.push('Every project requires projectId.');
    if (!BUILDING_TYPES.has(project.buildingType)) {
      issues.push(`Unsupported buildingType for ${project.projectId}: ${project.buildingType}.`);
    }
  }
  const silverLeaf = (dataset?.projects || []).find((p) => p.projectId === 'silver-leaf');
  if (
    !silverLeaf ||
    silverLeaf.livingSfFullBuilding !== 4343 ||
    silverLeaf.livingSfPerHome !== 2171.5 ||
    silverLeaf.includeInDetachedMedian !== false
  ) {
    issues.push('Silver Leaf must retain full-building/per-home SF and detached exclusion.');
  }
  if (issues.length) {
    const error = new Error(`Invalid benchmark dataset: ${issues.join(' ')}`);
    error.code = 'INVALID_BENCHMARK_DATASET';
    error.issues = issues;
    throw error;
  }
  return true;
}

function loadSeedDataset() {
  if (registry.has(BENCHMARK_DATASET_ID)) return registry.get(BENCHMARK_DATASET_ID);
  // The versioned JSON is immutable source data bundled with the server.
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const raw = require(SEED_PATH);
  validateDataset(raw);
  const dataset = deepFreeze(raw);
  registry.set(dataset.datasetId, dataset);
  return dataset;
}

function importDataset(dataset) {
  validateDataset(dataset);
  const existing = registry.get(dataset.datasetId);
  if (existing) {
    if (existing.schemaVersion !== dataset.schemaVersion) {
      throw new Error(`Dataset ${dataset.datasetId} already loaded with another version.`);
    }
    return { dataset: existing, inserted: false };
  }
  const immutable = deepFreeze(dataset);
  registry.set(immutable.datasetId, immutable);
  return { dataset: immutable, inserted: true };
}

function getDetachedProjects(dataset = loadSeedDataset()) {
  return dataset.projects.filter(
    (project) =>
      project.buildingType === 'detached' && project.includeInDetachedMedian === true
  );
}

function getTwinHomeProjects(dataset = loadSeedDataset()) {
  return dataset.projects.filter((project) => project.buildingType === 'twin_home');
}

function getLocalNationalWeights(sampleCount, dataset = loadSeedDataset()) {
  const count = Math.max(0, Number(sampleCount) || 0);
  const policy = dataset.weightPolicy;
  const localWeight =
    count >= 4
      ? policy.fourOrMoreLocalSamples
      : count === 3
        ? policy.threeLocalSamples
        : count === 2
          ? policy.twoLocalSamples
          : count === 1
            ? policy.oneLocalSample
            : policy.zeroLocalSamples;
  return {
    localWeight,
    nationalWeight: Math.round((1 - localWeight) * 1e10) / 1e10,
  };
}

function clearRegistryForTests() {
  registry.clear();
}

module.exports = {
  SEED_PATH,
  validateDataset,
  loadSeedDataset,
  importDataset,
  getDetachedProjects,
  getTwinHomeProjects,
  getLocalNationalWeights,
  clearRegistryForTests,
};
