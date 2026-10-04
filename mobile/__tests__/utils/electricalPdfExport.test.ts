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
});
