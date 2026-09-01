type MaterialLike = {
  quantity?: number | string;
  qty?: number | string;
  unit?: string;
  mode?: string;
  unitPrice?: number;
  cost?: number;
  total?: number;
};

type LaborLike = {
  hours?: number | string;
  quantity?: number | string;
  qty?: number | string;
  unit?: string;
  mode?: string;
  rate?: number;
  unitPrice?: number;
  cost?: number;
  total?: number;
  totalCost?: number;
  name?: string;
  description?: string;
  laborType?: string;
  trade?: string;
};

export function resolveMaterialCartUnitPrice(item: MaterialLike): number {
  const qty = Number(item?.quantity || item?.qty || 0);
  const total = Number(item?.total || 0);
  const storedUnitPrice = Number(item?.unitPrice || 0);
  const fallbackCost = Number(item?.cost || 0);
  const unit = String(item?.unit || '').trim().toLowerCase();
  const isSqft = item?.mode === 'sqft' || unit === 'sq ft' || unit === 'sqft';

  if (isSqft && qty > 0 && total > 0) {
    const storedLooksAccurate =
      storedUnitPrice > 0 && Math.abs(storedUnitPrice * qty - total) < 0.01;
    if (storedLooksAccurate) return storedUnitPrice;
    return total / qty;
  }

  if (qty > 1 && total > 0) {
    const storedLooksAccurate =
      storedUnitPrice > 0 && Math.abs(storedUnitPrice * qty - total) < 0.01;
    if (storedLooksAccurate) return storedUnitPrice;
    if (storedUnitPrice > 0 && storedUnitPrice * qty > total * 4) {
      return total / qty;
    }
  }

  if (storedUnitPrice > 0) return storedUnitPrice;
  if (fallbackCost > 0) return fallbackCost;
  return 0;
}

export function materialUsesDimensionalPricing(item: MaterialLike): boolean {
  const qty = Number(item?.quantity || item?.qty || 0);
  const unit = String(item?.unit || 'lot').trim().toLowerCase();
  if (item?.mode === 'sqft' || unit === 'sq ft' || unit === 'sqft') return true;
  const dimensionalUnits = new Set([
    'lf',
    'linear ft',
    'linear feet',
    'ln ft',
    'ea',
    'each',
    'cy',
  ]);
  return qty > 1 && dimensionalUnits.has(unit);
}

export function hydrateMaterialForEdit<T extends MaterialLike>(item: T): T & {
  quantity: number;
  unitPrice: number;
  mode: 'sqft' | 'flat';
} {
  const qty = Number(item.quantity || item.qty || 1);
  const total = Number(item.total || 0);
  const dimensional = materialUsesDimensionalPricing(item);
  const unitRate = resolveMaterialCartUnitPrice(item);

  return {
    ...item,
    quantity: qty,
    unitPrice: dimensional ? unitRate : total > 0 ? total : unitRate,
    mode: dimensional ? 'sqft' : 'flat',
  };
}

export function resolveMaterialLineUnitForSave(
  mode: string,
  editingItem?: MaterialLike | null,
  formUnit?: string
): string {
  if (mode !== 'sqft') return 'lot';
  const raw = String(editingItem?.unit || formUnit || 'sq ft').trim();
  const lower = raw.toLowerCase();
  if (lower && lower !== 'lot') return raw;
  return 'sq ft';
}

export function resolveLaborContractLineItem(item: LaborLike, projectSqft = 0) {
  const rawUnit = String(item?.unit || '').trim().toLowerCase();
  const isSqft =
    item?.mode === 'sqft' ||
    rawUnit === 'sqft' ||
    rawUnit === 'sf' ||
    rawUnit === 'sq ft';
  const preservedUnit =
    rawUnit === 'lf' || rawUnit === 'each' || rawUnit === 'ea' || rawUnit === 'cy'
      ? rawUnit === 'ea'
        ? 'each'
        : rawUnit
      : null;
  const rate = Number(item?.rate || item?.unitPrice || item?.cost || 0) || 0;
  const hoursOrSqft = Number(item?.hours ?? item?.quantity ?? item?.qty ?? 0) || 0;
  const total = Number(item?.total || item?.totalCost || 0) || 0;
  const bidSqft = Number(projectSqft || 0) || 0;

  const resolveQtyAndUnitPrice = (qty: number) => {
    let resolvedQty = qty > 0 ? qty : 0;
    if (!resolvedQty && total > 0 && rate > 0) {
      resolvedQty = total / rate;
    }
    const storedLooksAccurate =
      resolvedQty > 0 && rate > 0 && Math.abs(rate * resolvedQty - total) < 0.01;
    const unitPrice = storedLooksAccurate
      ? rate
      : resolvedQty > 0 && total > 0
        ? total / resolvedQty
        : rate;
    return { quantity: resolvedQty, unitPrice: Number(unitPrice) || 0 };
  };

  if (isSqft) {
    let qty = hoursOrSqft > 0 ? hoursOrSqft : 0;
    if (!qty && total > 0 && rate > 0) {
      qty = total / rate;
    }
    if (!qty && total > 0 && bidSqft > 0) {
      const impliedRate = total / bidSqft;
      if (rate > 0 && Math.abs(impliedRate - rate) < 0.05) {
        qty = bidSqft;
      }
    }
    const { quantity, unitPrice } = resolveQtyAndUnitPrice(qty);
    return {
      unit: 'sq ft',
      quantity,
      unitPrice,
      labor: total,
      mode: 'sqft' as const,
      hours: quantity,
      rate: unitPrice,
    };
  }

  if (preservedUnit) {
    const { quantity, unitPrice } = resolveQtyAndUnitPrice(hoursOrSqft);
    return {
      unit: preservedUnit === 'lf' ? 'LF' : preservedUnit,
      quantity,
      unitPrice,
      labor: total,
      mode: preservedUnit,
      hours: quantity,
      rate: unitPrice,
    };
  }

  const { quantity, unitPrice } = resolveQtyAndUnitPrice(hoursOrSqft);
  return {
    unit: 'hr',
    quantity,
    unitPrice,
    labor: total,
    mode: 'hourly' as const,
    hours: quantity,
    rate: unitPrice,
  };
}

export function hydrateLaborForEdit<T extends LaborLike>(
  item: T,
  projectSqft = 0
): T & {
  mode: 'sqft' | 'hourly';
  hours: number | string;
  rate: number;
} {
  const resolved = resolveLaborContractLineItem(item, projectSqft);
  return {
    ...item,
    mode: resolved.mode === 'sqft' ? 'sqft' : 'hourly',
    hours: resolved.hours || resolved.quantity || '',
    rate: resolved.unitPrice,
  };
}
