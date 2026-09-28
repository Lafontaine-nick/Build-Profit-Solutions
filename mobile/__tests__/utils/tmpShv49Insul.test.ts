import {
  insulationEnvelopeInputsFromPlanFacts,
  resolveInsulationEnvelopePlanningQuantity,
} from '../../utils/insulationEnvelopeQuantity';
import { mergeInsulationPlanFactsFromTakeoff } from '../../utils/subcontractorTrade/insulationPlanConvergence';

const buildingAreas = { totalLivingSqft: 2571, garageSqft: 1427, coveredPatioSqft: 322 };
const planFacts = { buildingAreas, plateHeightFt: 9.1, coveredPatioRoofed: true };

it('full inputs + which attic the envelope uses', () => {
  const merged = mergeInsulationPlanFactsFromTakeoff(
    planFacts as never, buildingAreas as never, {} as never
  );
  const inputs = insulationEnvelopeInputsFromPlanFacts(merged as never);
  // eslint-disable-next-line no-console
  console.log('>>> FULL INPUTS ' + JSON.stringify(inputs));
  const env = resolveInsulationEnvelopePlanningQuantity(inputs as never) as {
    components: { key: string; quantity: number; formula?: string; source: string }[];
    totalInsulationEnvelopeSqft: number;
  };
  for (const c of env.components) {
    // eslint-disable-next-line no-console
    console.log(`>>> ${c.key} = ${c.quantity} (${c.source}) ${c.formula || ''}`);
  }
  // eslint-disable-next-line no-console
  console.log('>>> TOTAL = ' + env.totalInsulationEnvelopeSqft);
  expect(true).toBe(true);
});
