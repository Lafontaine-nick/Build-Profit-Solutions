jest.mock('@/utils/resolveAiBackendUrl', () => ({
  resolveAiBaseUrl: () => 'http://localhost:3001',
}));

import {
  GARAGE_DOOR_TYPE_RATES,
  inferDefaultGarageDoorCounts,
  resolveGarageDoorSuggestedPricing,
} from '@/utils/exteriorOpeningsPricing';
import {
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
  type ScopeMeasurementsInputExtended,
} from '@/utils/scopeItemQuantities';
import { emptyQuickMeasurementInput } from '@/utils/scopeQuickMeasurements';
import { normalizeScopeChecklistItems } from '@/utils/estimateScopeChecklistUi';

function inputWith(overrides: Partial<ScopeMeasurementsInputExtended>): ScopeMeasurementsInputExtended {
  return {
    ...emptyQuickMeasurementInput(),
    floorAreaSqft: '1879',
    garageSqft: '994',
    itemQuantities: {},
    ...overrides,
  } as ScopeMeasurementsInputExtended;
}

describe('exterior openings split + garage door types', () => {
  it('ensures garage_doors card exists even when checklist never had openings', () => {
    const items = normalizeScopeChecklistItems(
      [
        { id: 'foundation', label: 'Foundation', inputType: 'yes_no', state: 'included' },
        { id: 'plumbing_rough', label: 'Plumbing rough-in', inputType: 'yes_no', state: 'included' },
      ] as any,
      'ground_up'
    );
    const ids = items.map((i) => i.id);
    expect(ids).toContain('garage_doors');
    expect(ids).toContain('windows');
    expect(ids).toContain('exterior_doors');
    expect(ids).toContain('sliding_doors');
    expect(items.find((i) => i.id === 'garage_doors')?.label).toBe('Garage doors');
  });

  it('migrates legacy windows_doors into four opening trades', () => {
    const items = normalizeScopeChecklistItems(
      [
        { id: 'windows_doors', label: 'Windows & doors', inputType: 'yes_no', state: 'included' },
        { id: 'exterior', label: 'Exterior Envelope', inputType: 'yes_no', state: 'included' },
      ] as any,
      'ground_up'
    );
    const ids = items.map((i) => i.id);
    expect(ids).toContain('windows');
    expect(ids).toContain('exterior_doors');
    expect(ids).toContain('sliding_doors');
    expect(ids).toContain('garage_doors');
    expect(ids).not.toContain('windows_doors');
    expect(items.find((i) => i.id === 'exterior')?.state).toBe('excluded');
    expect(items.find((i) => i.id === 'windows')?.state).toBe('included');
    expect(items.find((i) => i.id === 'garage_doors')?.state).toBe('included');
  });

  it('prices Silver Leaf-style double garage door at $2,400', () => {
    expect(GARAGE_DOOR_TYPE_RATES.double.total).toBe(2400);
    const pkg = resolveGarageDoorSuggestedPricing({ single: 0, double: 1, rv: 0 });
    expect(pkg).toMatchObject({ material: 1700, labor: 700, total: 2400, quantity: 1 });
  });

  it('prices SHV-style double + RV near $10,700', () => {
    const pkg = resolveGarageDoorSuggestedPricing({ single: 0, double: 1, rv: 1 });
    expect(pkg?.total).toBe(2400 + 8300);
    expect(pkg?.total).toBe(10700);
  });

  it('infers one double when garage SF is present and types are unset', () => {
    expect(inferDefaultGarageDoorCounts(994)).toEqual({ single: 0, double: 1, rv: 0 });
    const input = inputWith({});
    const resolved = resolveChecklistItemQuantity('garage_doors', input, { templateKey: 'ground_up' });
    expect(resolved).toMatchObject({ quantity: 1, unit: 'each' });
    const { fill } = resolveScopeItemSuggestedPricing('garage_doors', input, 'ground_up', resolved);
    expect(fill?.total).toBe(2400);
  });

  it('prices explicit double + RV from type counts', () => {
    const input = inputWith({
      garageDoorDoubleCount: 1,
      garageDoorRvCount: 1,
    } as any);
    const resolved = resolveChecklistItemQuantity('garage_doors', input, { templateKey: 'ground_up' });
    expect(resolved.quantity).toBe(2);
    const { fill } = resolveScopeItemSuggestedPricing('garage_doors', input, 'ground_up', resolved);
    expect(fill?.total).toBe(10700);
    expect(fill?.helper).toMatch(/Double/i);
    expect(fill?.helper).toMatch(/RV/i);
  });

  it('prices windows from opening count and exterior/sliding from each rates', () => {
    const windowsInput = inputWith({
      itemQuantities: {
        windows: { quantity: 16, unit: 'each', quantitySource: 'user_entered' },
      },
    });
    const windowsResolved = resolveChecklistItemQuantity('windows', windowsInput, {
      templateKey: 'ground_up',
    });
    const windowsPriced = resolveScopeItemSuggestedPricing(
      'windows',
      windowsInput,
      'ground_up',
      windowsResolved
    );
    expect(windowsPriced.fill?.basis).toEqual({ quantity: 16, unit: 'each' });
    expect(windowsPriced.fill!.total).toBeGreaterThan(10000);
    expect(windowsPriced.fill!.total).toBeLessThan(14000);

    const doorInput = inputWith({
      itemQuantities: {
        exterior_doors: { quantity: 2, unit: 'each', quantitySource: 'user_entered' },
      },
    });
    const doorResolved = resolveChecklistItemQuantity('exterior_doors', doorInput, {
      templateKey: 'ground_up',
    });
    const doorPriced = resolveScopeItemSuggestedPricing(
      'exterior_doors',
      doorInput,
      'ground_up',
      doorResolved
    );
    // National $1,800 × 2, barometer may nudge toward ~$2,000/ea
    expect(doorPriced.fill!.total).toBeGreaterThan(3000);
    expect(doorPriced.fill!.total).toBeLessThan(5000);

    const slidingInput = inputWith({
      itemQuantities: {
        sliding_doors: { quantity: 2, unit: 'each', quantitySource: 'user_entered' },
      },
    });
    const slidingResolved = resolveChecklistItemQuantity('sliding_doors', slidingInput, {
      templateKey: 'ground_up',
    });
    const slidingPriced = resolveScopeItemSuggestedPricing(
      'sliding_doors',
      slidingInput,
      'ground_up',
      slidingResolved
    );
    // National $2,800 × 2 blended with local ~$4,900/ea
    expect(slidingPriced.fill!.total).toBeGreaterThan(5000);
    expect(slidingPriced.fill!.total).toBeLessThan(12000);
  });
});
