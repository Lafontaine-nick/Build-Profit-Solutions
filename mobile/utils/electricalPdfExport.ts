import {
  ELECTRICAL_CARD_GROUPS,
  ELECTRICAL_CARDS,
  type ElectricalCardDefinition,
} from '@/utils/subcontractorTrade/electricalPlanConvergence';

export type ElectricalPdfMeasurementLine = {
  label: string;
  quantity: string;
  sectionHeader?: boolean;
};

export type ElectricalPdfMeasurementCard = {
  title: string;
  lines: ElectricalPdfMeasurementLine[];
};

function positiveMeasurement(value: unknown): number | null {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function cardQuantity(
  card: ElectricalCardDefinition,
  measurements: Record<string, unknown>
): number | null {
  const scalar = positiveMeasurement(measurements[card.measurementKey]);
  if (scalar != null) return scalar;
  const quantities = measurements.itemQuantities;
  if (!quantities || typeof quantities !== 'object' || Array.isArray(quantities)) {
    return null;
  }
  const entry = (quantities as Record<string, { quantity?: unknown; unit?: unknown }>)[
    card.itemId
  ];
  const unit = String(entry?.unit || '').toLowerCase();
  if (unit === 'allowance' || unit === 'lump_sum') return null;
  return positiveMeasurement(entry?.quantity);
}

/** Short name used only when a group contains more than one scope card. */
const ELECTRICAL_QUANTITY_NAME: Record<string, string> = {
  electrical_main_panel: 'panel',
  electrical_subpanel: 'subpanel',
  electrical_panel_upgrade: 'upgrade',
  electrical_service_upgrade: 'service',
  electrical_standard_circuit: '15/20A',
  electrical_dedicated_20a: '20A',
  electrical_circuit_30a: '30A',
  electrical_circuit_40a: '40A',
  electrical_circuit_50a: '50A',
  electrical_circuit_60a_plus: '60A+',
  electrical_standard_receptacle: 'standard',
  electrical_gfci_receptacle: 'GFCI',
  electrical_afci_receptacle: 'AFCI',
  electrical_exterior_receptacle: 'exterior',
  electrical_floor_receptacle: 'floor',
  electrical_usb_receptacle: 'USB',
  electrical_240v_receptacle: '240V',
  electrical_single_pole_switch: 'single-pole',
  electrical_3way_switch: '3-way',
  electrical_4way_switch: '4-way',
  electrical_dimmer_switch: 'dimmer',
  electrical_occupancy_switch: 'occupancy',
  electrical_smart_switch: 'smart',
  electrical_standard_fixture: 'vanity',
  electrical_recessed_light: 'recessed',
  electrical_pendant_light: 'pendant',
  electrical_decorative_light: 'decorative',
  electrical_exterior_light: 'exterior',
  electrical_undercabinet_light: 'under-cabinet',
  electrical_ceiling_fan: 'ceiling',
  electrical_bath_exhaust_fan: 'exhaust',
};

function formatElectricalQuantity(
  value: number,
  unit: ElectricalCardDefinition['unit'] | 'amp'
): string {
  const formatted = value.toLocaleString('en-US', { maximumFractionDigits: 1 });
  if (unit === 'amp') return `${formatted.replace(/\.0$/, '')}A`;
  if (unit === 'lf') return `${formatted} LF`;
  const whole = Number.isInteger(value) ? value.toLocaleString('en-US') : formatted;
  return `${whole} EA`;
}

function formatCount(value: number): string {
  return Number.isInteger(value)
    ? value.toLocaleString('en-US')
    : value.toLocaleString('en-US', { maximumFractionDigits: 1 });
}

/**
 * Collapsed pricing-card subtitle.
 * One scope card keeps a plain count ("31 each").
 * Two stay named ("83 standard · 12 GFCI").
 * Three or more would not fit, so the row only says how many quantities
 * are inside ("5 quantities"). Counts are never added into one total.
 */
export function electricalPricingCardMeasurementNote(
  items: Array<{ id: string }>,
  measurements: Record<string, unknown> | null | undefined
): string | null {
  if (!measurements || !items.length) return null;
  const counted = items
    .map(item => ELECTRICAL_CARDS.find(card => card.itemId === item.id))
    .filter((card): card is ElectricalCardDefinition => Boolean(card))
    .map(card => ({ card, value: cardQuantity(card, measurements) }))
    .filter(
      (row): row is { card: ElectricalCardDefinition; value: number } =>
        row.value != null
    );
  if (!counted.length && !items.some(item => item.id.startsWith('electrical_'))) {
    return null;
  }
  const includeAmps = counted.some(row => row.card.groupId === 'service_panels');
  const amps = includeAmps
    ? positiveMeasurement(measurements.serviceAmperage)
    : null;
  if (!counted.length && amps == null) return null;
  if (counted.length >= 3) {
    return `${counted.length} quantities`;
  }
  if (counted.length === 1 && amps == null) {
    const row = counted[0];
    if (row.card.unit === 'lf') return `${formatCount(row.value)} LF`;
    if (row.card.unit === 'amp') return formatElectricalQuantity(row.value, 'amp');
    return `${formatCount(row.value)} each`;
  }
  const parts = counted.map(row => {
    if (row.card.unit === 'amp') return formatElectricalQuantity(row.value, 'amp');
    if (row.card.unit === 'lf') return `${formatCount(row.value)} LF`;
    const name = ELECTRICAL_QUANTITY_NAME[row.card.itemId] || row.card.label;
    return `${formatCount(row.value)} ${name}`;
  });
  if (amps != null) parts.push(formatElectricalQuantity(amps, 'amp'));
  if (parts.length > 2) return `${counted.length} quantities`;
  return parts.length ? parts.join(' · ') : null;
}

/** Confirmed electrical takeoff for the proposal PDF Measurements card. */
export function buildElectricalPdfMeasurementCard(
  measurements: Record<string, unknown> | null | undefined
): ElectricalPdfMeasurementCard | null {
  if (!measurements) return null;
  const lines: ElectricalPdfMeasurementLine[] = [];
  for (const group of ELECTRICAL_CARD_GROUPS) {
    const groupLines: ElectricalPdfMeasurementLine[] = [];
    for (const card of ELECTRICAL_CARDS) {
      if (card.groupId !== group.id) continue;
      const value = cardQuantity(card, measurements);
      if (value == null) continue;
      groupLines.push({
        label: card.label,
        quantity: formatElectricalQuantity(value, card.unit),
      });
    }
    if (group.id === 'service_panels') {
      const amps = positiveMeasurement(measurements.serviceAmperage);
      if (amps != null) {
        groupLines.push({
          label: 'Service amperage',
          quantity: formatElectricalQuantity(amps, 'amp'),
        });
      }
    }
    if (!groupLines.length) continue;
    lines.push({
      label: group.title.toUpperCase(),
      quantity: '',
      sectionHeader: true,
    });
    lines.push(...groupLines);
  }
  if (!lines.length) return null;
  return { title: 'Electrical', lines };
}
