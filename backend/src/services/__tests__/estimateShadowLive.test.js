jest.mock("../estimateShadowOpenAi", () => ({
  requestOpenAiShadowProposal: jest.fn(),
}));

const {
  buildShadowDrift,
  currentCandidateFromChecklist,
  liveShadowEnabled,
  runEstimateShadowLive,
} = require("../estimateShadowLive");
const { requestOpenAiShadowProposal } = require("../estimateShadowOpenAi");

describe("live estimate shadow observer", () => {
  beforeEach(() => {
    requestOpenAiShadowProposal.mockReset();
  });

  test("is disabled unless the separate live flag is enabled", async () => {
    expect(liveShadowEnabled({ AI_ESTIMATE_SHADOW_LIVE_ENABLED: "false" })).toBe(
      false,
    );
    await expect(
      runEstimateShadowLive({
        notes: "Install 900 sqft LVP.",
        env: { AI_ESTIMATE_SHADOW_LIVE_ENABLED: "false" },
      }),
    ).resolves.toEqual({
      enabled: false,
      reason: "live_shadow_disabled",
    });
    expect(requestOpenAiShadowProposal).not.toHaveBeenCalled();
  });

  test("compares a proposal without mutating the checklist", async () => {
    const checklist = {
      scopeFacts: [
        {
          scopeId: "flooring_lvp",
          quantity: 900,
          unit: "sqft",
          excluded: false,
        },
        {
          scopeId: "hang",
          quantity: null,
          unit: "sqft",
          excluded: true,
        },
      ],
    };
    const logger = { info: jest.fn(), warn: jest.fn() };
    requestOpenAiShadowProposal.mockResolvedValue({
      proposal: {
        scopeItems: [
          { id: "flooring_lvp", quantity: 900, unit: "sqft" },
          { id: "floor_demo", quantity: 900, unit: "sqft" },
        ],
        exclusions: [],
        clarifications: [{ id: "floor_demo", question: "Demo?" }],
        rejectedItems: [],
      },
      usage: { total_tokens: 12 },
    });

    const result = await runEstimateShadowLive({
      notes: "Install 900 sqft LVP.",
      context: { templateKey: "flooring" },
      checklist,
      env: { AI_ESTIMATE_SHADOW_LIVE_ENABLED: "true" },
      openai: {},
      model: "gpt-test",
      logger,
    });

    expect(result.enabled).toBe(true);
    expect(result.telemetry).toMatchObject({
      event: "estimate_shadow_live",
      model: "gpt-test",
      templateKey: "flooring",
      currentScopeCount: 1,
      proposalScopeCount: 2,
      proposalOnlyScopeIds: ["floor_demo"],
      currentOnlyScopeIds: [],
      proposalClarificationIds: ["floor_demo"],
      rejectedItemCount: 0,
    });
    expect(checklist.scopeFacts).toHaveLength(2);
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(requestOpenAiShadowProposal).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-test",
        notes: "Install 900 sqft LVP.",
        context: { templateKey: "flooring" },
      }),
    );
  });

  test("builds deterministic drift details", () => {
    expect(
      buildShadowDrift(
        currentCandidateFromChecklist({
          scopeFacts: [{ scopeId: "paint", excluded: false }],
        }),
        {
          scopeItems: [{ id: "flooring", quantity: null, unit: null }],
          exclusions: ["hang"],
          clarifications: [],
          rejectedItems: [{ id: "unknown" }],
        },
      ),
    ).toEqual({
      currentScopeCount: 1,
      proposalScopeCount: 1,
      proposalOnlyScopeIds: ["flooring"],
      currentOnlyScopeIds: ["paint"],
      proposalExclusionCount: 1,
      proposalClarificationIds: [],
      rejectedItemCount: 1,
    });
  });
});
