#!/usr/bin/env node
/**
 * Smoke-test Phase 3 close-out calibration end-to-end (no server required).
 *
 * Simulates: budget lines + expenses → close-out → actualJobCost written →
 * rate suggestion → approve updates unit rate.
 *
 * Run: node scripts/smoke-closeout-calibration.js
 */

const path = require('path');

const {
  runCloseoutCalibration,
  approveCalibrationSuggestions,
} = require('../src/services/contractorPricingMemory/closeoutCalibration');
const {
  clearMemory,
  listEntries,
  upsertEntries,
} = require('../src/services/contractorPricingMemory/storage');

const userId = 'smoke-closeout-user';
const projectId = 'smoke-job-flooring-001';

function assert(cond, msg) {
  if (!cond) {
    console.error('❌ FAIL:', msg);
    process.exitCode = 1;
    throw new Error(msg);
  }
  console.log('✅', msg);
}

function main() {
  console.log('\n=== Close-out calibration smoke test ===\n');
  clearMemory(userId);

  // Seed a won-job rate in pricing memory (as if apply/won already captured it)
  upsertEntries(userId, [
    {
      scopeItemName: 'LVP install',
      trade: 'flooring',
      projectType: 'flooring',
      category: 'labor',
      unitType: 'sqft',
      unitRate: 5,
      quantity: 850,
      totalAmount: 4250,
      bidStatus: 'won',
      projectId,
      pricingSource: 'user_provided',
    },
  ]);
  assert(listEntries(userId).length === 1, 'Seeded 1 pricing-memory rate at $5/sqft');

  const closeout = runCloseoutCalibration(userId, {
    projectId,
    completionConfirmed: true,
    projectType: 'flooring',
    projectTitle: 'Smoke Flooring Job',
    finalCustomerPrice: 12000,
    lines: [
      {
        id: 'line-flooring',
        category: 'Flooring',
        description: 'LVP install',
        qty: 850,
        unit: 'sqft',
        unitCost: 5,
      },
    ],
    expenses: [
      {
        id: 'exp-1',
        category: 'Flooring',
        amount: 5100,
        linkedLineId: 'line-flooring',
        description: 'Install labor actual',
      },
    ],
    changeOrders: [],
    applyActualsToMemory: true,
    captureCompleted: true,
  });

  assert(closeout.status === 'ready_for_review', `status=ready_for_review (got ${closeout.status})`);
  assert(closeout.pendingSuggestionCount >= 1, `pending suggestions ≥ 1 (got ${closeout.pendingSuggestionCount})`);
  assert(closeout.memoryWrite.updated >= 1, `actualJobCost written (updated=${closeout.memoryWrite.updated})`);

  const afterClose = listEntries(userId).find((e) => e.projectId === projectId);
  assert(afterClose?.actualJobCost === 5100, `actualJobCost=5100 (got ${afterClose?.actualJobCost})`);
  assert(afterClose?.unitRate === 5, 'unitRate still $5 before approve (no auto-apply)');
  assert(afterClose?.bidStatus === 'completed', 'bidStatus=completed');

  const suggestion = closeout.rateSuggestions[0];
  assert(suggestion.suggestedRate === 6, `suggestedRate=$6/sqft (got ${suggestion.suggestedRate})`);

  const approved = approveCalibrationSuggestions(userId, {
    suggestions: closeout.rateSuggestions,
    role: 'manager',
  });
  assert(approved.approved >= 1, `approved ≥ 1 rate (got ${approved.approved})`);

  const afterApprove = listEntries(userId).find((e) => /lvp/i.test(e.scopeItemName));
  assert(afterApprove?.unitRate === 6, `unitRate updated to $6 after approve (got ${afterApprove?.unitRate})`);

  console.log('\n=== Smoke test passed ===\n');
  console.log(
    JSON.stringify(
      {
        status: closeout.status,
        variancePct: closeout.summary.overallVariancePct,
        suggestion: {
          from: suggestion.currentRate,
          to: suggestion.suggestedRate,
          unit: suggestion.unit,
        },
        message: closeout.message,
      },
      null,
      2
    )
  );
}

try {
  main();
} catch (err) {
  console.error('\nSmoke test failed:', err.message);
  console.error('(cwd)', process.cwd());
  console.error('(script)', path.relative(process.cwd(), __filename));
  process.exit(1);
}
