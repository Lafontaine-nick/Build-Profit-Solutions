#!/usr/bin/env node

const {
  loadSeedDataset,
  validateDataset,
  getDetachedProjects,
  getTwinHomeProjects,
} = require('../src/services/benchmarkEngine');

function main() {
  const dataset = loadSeedDataset();
  validateDataset(dataset);
  const detached = getDetachedProjects(dataset);
  const twinHomes = getTwinHomeProjects(dataset);
  const silverLeaf = twinHomes.find((project) => project.projectId === 'silver-leaf');

  if (!silverLeaf || silverLeaf.livingSfFullBuilding !== 4343 || silverLeaf.livingSfPerHome !== 2171.5) {
    throw new Error('Silver Leaf segmentation validation failed.');
  }
  if (detached.some((project) => project.projectId === 'silver-leaf')) {
    throw new Error('Silver Leaf must not be included in detached medians.');
  }

  console.log(
    JSON.stringify(
      {
        inserted: true,
        datasetId: dataset.datasetId,
        schemaVersion: dataset.schemaVersion,
        projects: dataset.projects.length,
        detachedComparableProjects: detached.length,
        twinHomeProjects: twinHomes.length,
        stageBenchmarks: dataset.stageBenchmarks.length,
        scopeBenchmarks: dataset.scopeBenchmarks.length,
      },
      null,
      2
    )
  );
}

main();
