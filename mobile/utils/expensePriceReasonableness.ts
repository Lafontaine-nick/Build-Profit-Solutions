/**
 * Classify a single expense line vs total project budget.
 * Large jobs: $10k is not an "outlier" if the bid is $12M — we use share of budget.
 * When budget is unknown, keep legacy absolute bands so the UI still works.
 */
export function classifyExpensePriceReasonableness(
  amount: number,
  budgetTotalUsd: number
): "normal" | "high" | "outlier" {
  if (!Number.isFinite(amount) || amount <= 0) {
    return "normal";
  }

  const budget = Number(budgetTotalUsd);
  if (!Number.isFinite(budget) || budget <= 0) {
    if (amount > 10000) return "outlier";
    if (amount > 5000) return "high";
    return "normal";
  }

  const ratio = amount / budget;
  // Same expense can be "normal" on a $10M job but notable on a $200k job
  if (ratio > 0.05) return "outlier";
  if (ratio > 0.02) return "high";
  return "normal";
}
