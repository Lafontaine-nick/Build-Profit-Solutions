import { buildWetAreaInstallPdfMeasurementCard } from '@/utils/wetAreaInstallPdfExport';
import { buildProposalHtml } from '@/lib/proposals/buildProposalHtml';
import type { ContractDoc } from '@/lib/contracts/types';

describe('wetAreaInstallPdfExport', () => {
  test('builds grouped wet area install card from steppers and sqft', () => {
    const card = buildWetAreaInstallPdfMeasurementCard({
      templateKey: 'bathroom',
      measurements: {
        tilePanBathCount: 1,
        showerWallTileSqft: '120',
        bathroomFloorSqft: '45',
        showerDoorCount: 1,
      },
    });
    expect(card?.title).toBe('Wet area install');
    expect(card?.lines.map((line) => line.label)).toEqual([
      'NEW PAN / TUB / ENCLOSURE',
      'Mud pan (tile shower)',
      'SHOWER WALL TILE',
      'Shower wall tile',
      'BATH FLOOR & DOORS',
      'Bath floor tile',
      'Shower doors',
    ]);
    expect(card?.lines.find((line) => line.label === 'Shower wall tile')?.quantity).toBe(
      '120 sqft'
    );
  });

  test('includes keeping-existing note and skips fixture rows', () => {
    const card = buildWetAreaInstallPdfMeasurementCard({
      templateKey: 'bathroom',
      checklistItems: [
        {
          id: 'wet_area_install',
          label: 'Wet area install',
          inputType: 'choice',
          choiceId: 'staying',
          state: 'included',
        },
      ],
      measurements: {
        tilePanBathCount: 1,
        showerWallTileSqft: '80',
      },
    });
    expect(card?.lines[0]).toMatchObject({ note: true });
    expect(card?.lines.some((line) => line.label === 'Mud pan (tile shower)')).toBe(false);
  });

  test('returns null when no wet area measurements are set', () => {
    expect(
      buildWetAreaInstallPdfMeasurementCard({
        templateKey: 'bathroom',
        measurements: {},
      })
    ).toBeNull();
  });

  test('renders wet area card in contractor export HTML', () => {
    const card = buildWetAreaInstallPdfMeasurementCard({
      templateKey: 'bathroom',
      measurements: {
        prefabBathCount: 1,
        showerWallTileSqft: '90',
        bathroomFloorSqft: '32',
      },
    });
    const html = buildProposalHtml(
      {
        summary: {
          contractId: 'B-1',
          projectName: 'Primary bath',
          siteAddress: '1 Main St',
          totalBid: 12000,
          durationDays: 14,
          startDate: '2026-09-01',
        },
        contractor: {},
        owner: { legalName: 'Client' },
        scope: {
          bullets: ['Bathroom remodel'],
          description: 'Bathroom remodel',
          measurementCards: card ? [card] : [],
        },
        milestones: [],
        terms: {},
      } as ContractDoc,
      { projectType: 'bathroom' }
    );
    expect(html).toMatch(/Measurements/);
    expect(html).toMatch(/WET AREA INSTALL/);
    expect(html).toMatch(/NEW PAN \/ TUB \/ ENCLOSURE/);
    expect(html).toMatch(/90 sqft/);
    expect(html).toMatch(/measurements-card/);
  });
});
