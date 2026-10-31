const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");

jest.mock("../../services/estimateShadowOpenAi", () => ({
  requestOpenAiShadowProposal: jest.fn(),
}));

const {
  requestOpenAiShadowProposal,
} = require("../../services/estimateShadowOpenAi");

describe("estimate checklist live shadow route contract", () => {
  const originalSecret = process.env.JWT_SECRET;
  const originalOpenAiKey = process.env.OPENAI_API_KEY;
  const originalLiveFlag = process.env.AI_ESTIMATE_SHADOW_LIVE_ENABLED;
  let router;

  beforeAll(() => {
    jest.useFakeTimers();
    process.env.JWT_SECRET = "estimate-shadow-route-test-secret";
    process.env.OPENAI_API_KEY = "test-openai-key";
    router = require("../aiAssistant");
  });

  afterEach(() => {
    requestOpenAiShadowProposal.mockReset();
    delete process.env.AI_ESTIMATE_SHADOW_LIVE_ENABLED;
  });

  afterAll(() => {
    jest.useRealTimers();
    if (originalSecret == null) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
    if (originalOpenAiKey == null) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalOpenAiKey;
    if (originalLiveFlag == null) delete process.env.AI_ESTIMATE_SHADOW_LIVE_ENABLED;
    else process.env.AI_ESTIMATE_SHADOW_LIVE_ENABLED = originalLiveFlag;
  });

  function createApp() {
    const app = express();
    app.use(express.json());
    app.use("/api/ai-assistant", router);
    return app;
  }

  function draft() {
    return {
      projectType: "other",
      estimateTier: "room_remodel",
      originalNotes: "Install 900 sqft LVP and paint the walls.",
      rooms: [],
    };
  }

  test("does not call OpenAI while the live flag is off", async () => {
    process.env.AI_ESTIMATE_SHADOW_LIVE_ENABLED = "false";
    const token = jwt.sign({ userId: "estimate-shadow-user" }, process.env.JWT_SECRET);

    const response = await request(createApp())
      .post("/api/ai-assistant/estimate-draft-scope-checklist")
      .set("Authorization", `Bearer ${token}`)
      .send({ draft: draft() });

    expect(response.status).toBe(200);
    expect(response.body.checklist).toBeTruthy();
    expect(requestOpenAiShadowProposal).not.toHaveBeenCalled();
  });

  test("keeps the route response unchanged when live shadow is on", async () => {
    process.env.AI_ESTIMATE_SHADOW_LIVE_ENABLED = "true";
    requestOpenAiShadowProposal.mockResolvedValue({
      proposal: {
        scopeItems: [{ id: "flooring_install", quantity: 900, unit: "sqft" }],
        exclusions: [],
        clarifications: [],
        rejectedItems: [],
      },
      usage: { total_tokens: 1 },
    });
    const token = jwt.sign({ userId: "estimate-shadow-user" }, process.env.JWT_SECRET);

    const response = await request(createApp())
      .post("/api/ai-assistant/estimate-draft-scope-checklist")
      .set("Authorization", `Bearer ${token}`)
      .send({ draft: draft() });

    expect(response.status).toBe(200);
    expect(requestOpenAiShadowProposal).toHaveBeenCalledTimes(1);
    expect(response.body.draft.scopeChecklist).toEqual(response.body.checklist);
    expect(response.body.checklist.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "flooring", state: "included" }),
      ]),
    );
  });
});
