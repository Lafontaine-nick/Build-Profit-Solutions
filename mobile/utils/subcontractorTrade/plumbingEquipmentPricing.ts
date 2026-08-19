import type { ScopeItemSuggestedPricing } from '@/utils/scopeItemQuantities';

type WaterHeaterDetail = {
  type?: string | null;
  fuel?: string | null;
};

export function isTanklessWaterHeater(
  detail?: WaterHeaterDetail | null
): boolean {
  return /tankless|on[\s-]?demand/i.test(String(detail?.type || ''));
}

export function resolvePlumbingWaterHeaterSuggestedPricing(params: {
  quantity: number | null | undefined;
  waterHeaterDetail?: WaterHeaterDetail | null;
}): ScopeItemSuggestedPricing {
  const quantity = Math.max(1, Number(params.quantity) || 1);
  const tankless = isTanklessWaterHeater(params.waterHeaterDetail);
  const unitMaterial = tankless ? 2200 : 1200;
  const unitLabor = tankless ? 1300 : 800;
  const material = Math.round(unitMaterial * quantity);
  const labor = Math.round(unitLabor * quantity);
  const total = material + labor;
  const typeLabel = tankless ? 'tankless' : 'tank';
  return {
    fill: {
      material,
      labor,
      total,
      helper: `Suggested budget split · National Average · ${typeLabel} water heater supply and set`,
      rateSourceLabel: 'National planning rate',
      storedTotalExact: total,
      costBuckets: [
        { key: 'material', label: 'Material', amount: material },
        { key: 'labor', label: 'Labor', amount: labor },
      ],
    },
    comparison: null,
  };
}
