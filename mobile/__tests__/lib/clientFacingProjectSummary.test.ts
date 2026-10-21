import {
  clientFacingProjectSummary,
  normalizeProjectContractCopy,
} from '@/lib/proposals/contractTemplate';
import type { ContractDoc } from '@/lib/contracts/types';

const savedScope = [
  'Frame 400 sqft of walls and install 180 sqft of LVP flooring. Provide labor and materials as specified to frame approximately 400 square feet of walls and install approximately 180 square feet of luxury vinyl plank flooring. Final scope, materials, wall layout, substrate preparation, pricing, and schedule are subject to confirmation.',
  'Wall framing',
  'Frame the walls identified in the job notes.',
  'LVP flooring',
  'Install the flooring identified in the job notes.',
  'Inclusions',
  '• LVP flooring',
  '• LVP',
  '• Walls',
].join('\n\n');

describe('clientFacingProjectSummary', () => {
  it('keeps the note and names each trade once', () => {
    expect(clientFacingProjectSummary(savedScope)).toBe(
      'Frame 400 sqft of walls and install 180 sqft of LVP flooring. Included: Wall framing and LVP flooring.'
    );
  });

  it('cleans the same paragraph when line breaks were already flattened', () => {
    const flat =
      'Frame 400 sqft of walls and install 180 sqft of LVP flooring. Provide labor and materials as specified to frame approximately 400 square feet of walls and install approximately 180 square feet of luxury vinyl plank flooring. Final scope, materials, wall layout, substrate preparation, pricing, and schedule are subject to confirmation. Wall framing Frame the walls identified in the job notes. LVP flooring Install the flooring identified in the job notes. Inclusions • LVP flooring • LVP • Walls';
    expect(clientFacingProjectSummary(flat)).toBe(
      'Frame 400 sqft of walls and install 180 sqft of LVP flooring. Included: Wall framing and LVP flooring.'
    );
  });

  it('leaves a scope paragraph that is already client copy', () => {
    const note =
      'Pour a 400 sqft concrete patio and install 600 sqft of sod.';
    expect(clientFacingProjectSummary(note)).toBe(note);
  });

  it('uses that summary on the agreement cover', () => {
    const doc = {
      summary: {
        contractId: '16',
        projectName: 'Wall framing and LVP',
        siteAddress: 'N/A',
        totalBid: 2139,
        durationDays: 28,
        startDate: 'TBD',
      },
      contractor: {},
      owner: { legalName: 'Client' },
      scope: {
        bullets: savedScope.split('\n').filter((line) => line.trim()),
        description: savedScope,
      },
      milestones: [],
      terms: {} as ContractDoc['terms'],
    } as ContractDoc;
    const copy = normalizeProjectContractCopy(doc, {
      pdfMode: 'detailed',
      state: 'other',
      contractType: 'home-improvement',
      projectType: 'other',
      branding: {},
    });
    expect(copy.scopeSummary).toBe(
      'Frame 400 sqft of walls and install 180 sqft of LVP flooring. Included: Wall framing and LVP flooring.'
    );
    expect(copy.includedWorkBullets.join(' ')).not.toMatch(/identified in the job notes|Inclusions|Walls/i);
  });
});
