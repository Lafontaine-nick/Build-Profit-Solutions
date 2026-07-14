const { round } = require('./blend');

function ratio(value, livingSf) {
  const amount = Number(value);
  const living = Number(livingSf);
  return Number.isFinite(amount) && Number.isFinite(living) && living > 0 ? amount / living : null;
}

function closenessScore(current, comparable) {
  const a = Number(current);
  const b = Number(comparable);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return null;
  return Math.max(0, 1 - Math.abs(a - b) / Math.max(a, b));
}

function scoreProjectSimilarity(current, comparable, options = {}) {
  let score = 0;
  let knownWeight = 0;
  const reasons = [];
  const add = (weight, fraction, reason) => {
    if (fraction == null) return;
    knownWeight += weight;
    score += weight * Math.max(0, Math.min(1, fraction));
    // Only surface informative reasons — skip "unknown" noise.
    if (reason) reasons.push(reason);
  };

  const currentType = current.buildingType || 'unknown';
  const comparableType = comparable.buildingType || 'unknown';
  if (currentType !== 'unknown' && comparableType !== 'unknown') {
    const same = currentType === comparableType;
    add(
      35,
      same ? 1 : 0.2,
      same ? `Same ${currentType} building type` : `${currentType} vs ${comparableType} building type`
    );
  }

  const sfCloseness = closenessScore(current.livingSf, comparable.livingSfPerHome);
  if (sfCloseness != null) {
    const withinPct = Math.round((1 - sfCloseness) * 100);
    add(
      20,
      sfCloseness,
      withinPct === 0 ? 'Living area within 0% (exact size match)' : `Living area within ${withinPct}%`
    );
  }

  if (Number.isFinite(Number(current.stories)) && Number.isFinite(Number(comparable.stories))) {
    const same = Number(current.stories) === Number(comparable.stories);
    add(10, same ? 1 : 0.4, same ? `Same story count (${comparable.stories})` : `Different story count (${comparable.stories})`);
  }

  const currentGarageRatio = ratio(current.garageSf, current.livingSf);
  const comparableGarageRatio = ratio(comparable.garageSf, comparable.livingSfPerHome);
  const garageCloseness = closenessScore(currentGarageRatio, comparableGarageRatio);
  if (garageCloseness != null && Number.isFinite(Number(comparable.garageSf))) {
    add(
      10,
      garageCloseness,
      `Garage ${Number(comparable.garageSf).toLocaleString()} SF · ratio compared`
    );
  }

  const currentPatioRatio = ratio(current.patioPorchSf, current.livingSf);
  const comparablePatioRatio = ratio(comparable.patioPorchSf, comparable.livingSfPerHome);
  const patioCloseness = closenessScore(currentPatioRatio, comparablePatioRatio);
  if (patioCloseness != null && Number.isFinite(Number(comparable.patioPorchSf))) {
    const pct = Math.round((Number(comparable.patioPorchSf) / Number(comparable.livingSfPerHome)) * 100);
    add(5, patioCloseness, `Patio/porch ratio ~${pct}%`);
  }

  if (current.market && options.market) {
    const same = String(current.market).toLowerCase() === String(options.market).toLowerCase();
    add(10, same ? 1 : 0.4, same ? 'Same market' : 'Different market');
  }

  if (current.finishLevel && comparable.finishLevel) {
    const same =
      String(current.finishLevel).toLowerCase() ===
      String(comparable.finishLevel).toLowerCase();
    add(5, same ? 1 : 0.5, same ? 'Finish level matched' : 'Finish level differs');
  }

  const freshness = Number.isFinite(Number(options.sourceYear))
    ? Math.max(0.4, 1 - Math.max(0, new Date().getFullYear() - Number(options.sourceYear)) * 0.1)
    : 0.6;
  add(5, freshness, options.sourceYear ? `Source year ${options.sourceYear}` : null);

  // Unknowns reduce confidence: do not renormalize missing weight to 100.
  let finalScore = round(score, 0);
  if (currentType !== 'unknown' && comparableType !== 'unknown' && currentType !== comparableType) {
    finalScore = Math.min(finalScore, 79);
  }
  return {
    similarityScore: Math.max(0, Math.min(100, finalScore)),
    similarityConfidence: knownWeight >= 80 ? 'high' : knownWeight >= 55 ? 'medium' : 'low',
    knownWeight,
    reasons,
  };
}

function rankComparableProjects(current, projects, options = {}) {
  return (projects || [])
    .map((project) => ({
      project,
      ...scoreProjectSimilarity(current, project, options),
    }))
    .sort((a, b) => b.similarityScore - a.similarityScore);
}

module.exports = {
  scoreProjectSimilarity,
  rankComparableProjects,
};
