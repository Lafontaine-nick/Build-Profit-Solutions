import { buildProposalHtml } from '@/lib/proposals/buildProposalHtml';
import type { ContractDoc } from '@/lib/contracts/types';
import {
  buildElectricalPdfMeasurementCard,
  electricalPricingCardMeasurementNote,
} from '@/utils/electricalPdfExport';

describe('electricalPdfExport', () => {
  const measurements = {
    mainPanelCount: 1,
    serviceAmperage: 200,
    recessedLightCount: 31,
    ceilingFanCount: 6,
    bathExhaustFanCount: 0,
    itemQuantities: {},
  };

  test('names each scope card when a group has more than one', () => {
    expect(
      electricalPricingCardMeasurementNote(
        [{ id: 'electrical_main_panel' }],
        measurements
      )
    ).toBe('1 panel · 200A');
    expect(
      electricalPricingCardMeasurementNote(
        [{ id: 'electrical_recessed_light' }],
        {
          ...measurements,
          itemQuantities: {
            electrical_recessed_light: { quantity: 1, unit: 'each' },
          },
        }
      )
    ).toBe('31 each');
    expect(
      electricalPricingCardMeasurementNote(
        [
          { id: 'electrical_standard_receptacle' },
          { id: 'electrical_gfci_receptacle' },
        ],
        {
          standardReceptacleCount: 83,
          gfciReceptacleCount: 12,
        }
      )
    ).toBe('83 standard · 12 GFCI');
    expect(
      electricalPricingCardMeasurementNote(
        [
          { id: 'electrical_standard_receptacle' },
          { id: 'electrical_gfci_receptacle' },
          { id: 'electrical_exterior_receptacle' },
          { id: 'electrical_floor_receptacle' },
          { id: 'electrical_usb_receptacle' },
        ],
        {
          standardReceptacleCount: 83,
          gfciReceptacleCount: 12,
          exteriorReceptacleCount: 6,
          floorReceptacleCount: 2,
          usbReceptacleCount: 4,
        }
      )
    ).toBe('5 quantities');
    expect(
      electricalPricingCardMeasurementNote(
        [{ id: 'electrical_ceiling_fan' }, { id: 'electrical_bath_exhaust_fan' }],
        measurements
      )
    ).toBe('6 each');
  });

  test('proposal measurements card lists the confirmed electrical takeoff', () => {
    const card = buildElectricalPdfMeasurementCard(measurements);
    expect(card?.title).toBe('Electrical');
    expect(card?.lines).toEqual([
      { label: 'SERVICE / PANELS', quantity: '', sectionHeader: true },
      { label: 'Main panel', quantity: '1 EA' },
      { label: 'Service amperage', quantity: '200A' },
      { label: 'LIGHTING', quantity: '', sectionHeader: true },
      { label: 'Recessed / canless / wafer light', quantity: '31 EA' },
      { label: 'FANS', quantity: '', sectionHeader: true },
      { label: 'Ceiling fan', quantity: '6 EA' },
    ]);

    const html = buildProposalHtml(
      {
        summary: {
          contractId: 'E-1',
          projectName: 'Electrical',
          siteAddress: '1 Main St',
          totalBid: 8350,
          durationDays: 10,
          startDate: '2026-10-02',
        },
        contractor: {},
        owner: { legalName: 'Client' },
        scope: {
          bullets: ['Electrical'],
          description: 'Electrical',
          measurementCards: card ? [card] : [],
        },
        milestones: [],
        terms: {},
      } as ContractDoc,
      { projectType: 'electrical' }
    );
    expect(html).toMatch(/ELECTRICAL/);
    expect(html).toMatch(/31 EA/);
    expect(html).toMatch(/200A/);
    expect(html).not.toMatch(/Exhaust fan/);
  });

  test('keeps estimating notes out of the scope summary and gives each device its own row', () => {
    const html = buildProposalHtml(
      {
        summary: {
          contractId: 'E-2',
          projectName: 'Electrical Estimate Draft',
          siteAddress: 'Red drive, Las vegas, NV 452180',
          totalBid: 34870,
          durationDays: 30,
          startDate: '2026-09-01',
        },
        contractor: {},
        owner: { legalName: 'Nick Lafontaine' },
        scope: {
          bullets: [
            'Electrical estimate draft generated from imported plan takeoff quantities.',
            'Provide electrical work in accordance with the imported electrical plan takeoff. Scope includes 4 ceiling fan locations.',
            'Main panel',
            'New main-panel install only. Service upgrades own included panel/meter work. Amperage is a separate attribute.',
            'GFCI receptacles',
            'Single-pole switch',
            'Ceiling fan fixtures, with or without a light kit. Fixture + hang only — not a new fan-rated box, homerun, or bath exhaust fan.',
            'Fan + electrical connection only. Does not include ducting, roof/wall venting, or HVAC work. Distinct from ceiling fans. Homerun is a circuit card.',
          ],
          description:
            'Electrical estimate draft generated from imported plan takeoff quantities.',
        },
        milestones: [{ id: '1', name: 'Deposit', percentage: 100, paymentAmount: 34870 }],
        terms: {},
      } as ContractDoc,
      { projectType: 'electrical' }
    );
    expect(html).not.toMatch(/homerun/i);
    expect(html).not.toMatch(/separate attribute/i);
    expect(html).toMatch(/scope-item-title">Ceiling fan/);
    expect(html).toMatch(/scope-item-title">Exhaust fan/);
    expect(html).toMatch(/scope-item-title">GFCI receptacles/);
    expect(html).toMatch(/>1 payment</);
  });

  test('merges matching material and labor lines into one line-item table', () => {
    const html = buildProposalHtml(
      {
        summary: {
          contractId: 'E-3',
          projectName: 'Electrical',
          siteAddress: '1 Main St',
          totalBid: 2050,
          durationDays: 10,
          startDate: '2026-09-01',
        },
        contractor: {},
        owner: { legalName: 'Client' },
        scope: {
          bullets: ['Electrical'],
          description: 'Electrical',
          materialLineItems: [
            { description: 'Main panel — materials', quantity: 1, unit: 'each', materials: 850, section: 'Main panel' },
          ],
          laborLineItems: [
            { description: 'Main panel', quantity: 1, unit: 'each', labor: 1200, category: 'Main panel' },
          ],
        },
        milestones: [],
        terms: {},
      } as ContractDoc,
      { projectType: 'electrical' }
    );
    expect(html).toMatch(/appendix-table--combined/);
    expect(html).toMatch(/item-name">Main panel</);
    expect(html).toMatch(/\$2,050\.00/);
    expect(html).not.toMatch(/Material subtotal/);
    expect(html).not.toMatch(/Labor subtotal/);
  });
});
