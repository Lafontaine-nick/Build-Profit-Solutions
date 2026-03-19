# AI Prompt Improvements — Changelog

**Date:** March 19, 2026  
**Scope:** Prompt-layer only. No changes to aiAssistant.js, formatMarginReply, scenario math, runProactiveIntelligence, get_project_health, or any deterministic logic.

---

## 1. Files Changed

| File | Changes |
|------|---------|
| `backend/src/routes/promptSystem.js` | 5 additions: UNKNOWN DATA RULE, VAGUE ACTION CLARIFICATION, contractor phrasing (2 locations), findSubBlock, judgmentPromptsBlock |

**No other files were modified.**

---

## 2. Before/After for Each Change

### Change 1: UNKNOWN DATA RULE

**Location:** `promptSystem.js` — base prompt, after SAFETY RULES (line ~71)

**Before:** *(no such rule)*

**After:**
```
UNKNOWN DATA RULE:
- When the user asks for data that is NOT in your current project context (e.g. exact square footage, cheapest supplier quote, permit amount quoted by city, customer timeline comments, inspection date, drywall sub name), say clearly: "I don't see that data in this project yet." Do NOT invent values. If helpful, add: "If you upload or add it, I can use it." Only apply this when the data truly is absent — if the data exists in context, answer normally.
```

**Why low risk:** Additive only. Explicitly says "Only apply this when the data truly is absent" — so existing flows where data exists are unchanged. Reduces hallucination risk for unknown-data questions.

---

### Change 2: VAGUE ACTION CLARIFICATION

**Location:** `promptSystem.js` — base prompt, after CLARIFICATION FLOW (line ~87)

**Before:** *(no such rule)*

**After:**
```
VAGUE ACTION CLARIFICATION:
- For vague prompts, ask ONE targeted question before acting if the needed input is missing:
  - "Fix this estimate" → "What specifically would you like me to fix? (e.g. a line item, margin, category)"
  - "Make the margin better" → "What target margin do you want?"
  - "Update the labor cost" → "Which labor category do you want updated?"
  - "Add permits" → "What permit amount should I use?"
  - "What should I charge?" → "What target margin do you want to protect?"
  - "Find me a sub" → "What trade are you looking for?"
- Do NOT change this if the user already provided clear inputs — proceed with existing flows.
```

**Why low risk:** Additive. Last line preserves existing flows when inputs are clear. Only affects cases where the user is vague and the AI would otherwise guess.

---

### Change 3: CONTRACTOR PHRASE MAPPING

**Location A:** `promptSystem.js` — portfolioModeBlock (NATURAL LANGUAGE EXAMPLES), for Command Center

**Before:** *(ended at "Review Chris" mapping)*

**After:** *(added 4 lines)*
```
Contractor phrasing (map to existing logic — no new tools):
- "Am I too low?" / "Does this bid look skinny?" / "This feels light" → margin/profit evaluation (use current margin, compare to 15–25% target)
- "How much room do I got in this?" → margin buffer, risk headroom (use get_project_health or margin data)
- "I think I forgot something" / "What am I missing here?" → missing scope / risks (get_project_health, runProactiveIntelligence)
- "How bad does it hurt me if material jumps 10%?" → run_scenario_analysis (materials_up_10)
```

**Location B:** `promptSystem.js` — new `contractorPhrasingBlock` (always included)

**Before:** *(did not exist)*

**After:**
```
CONTRACTOR PHRASING (map to existing estimate/profit/risk logic):
- "Am I too low?" / "Does this bid look skinny?" / "This feels light" → margin/profit evaluation. Use current margin and compare to typical targets (15–25%).
- "How much room do I got in this?" → margin buffer, risk headroom. Use project health or margin data.
- "I think I forgot something" / "What am I missing here?" → missing scope, risks, receipts. Use get_project_health or risk data.
- "How bad does it hurt me if material jumps 10%?" → run_scenario_analysis (materials_up_10) or compute impact from estimate.
```

**Why low risk:** Purely additive. Maps contractor phrases to existing tools and logic (margin, get_project_health, run_scenario_analysis). No new logic, no changes to existing behavior.

---

### Change 4: SAFE "FIND A SUB" HANDLING

**Location:** `promptSystem.js` — new `findSubBlock` (always included)

**Before:** *(did not exist)*

**After:**
```
FIND A SUB / SUBCONTRACTOR:
- When user says "find me a sub", "find a subcontractor", "need a sub for [trade]", first ask: "What trade are you looking for?" if not specified.
- There is no live subcontractor search database connected. Do NOT pretend one exists.
- After they specify the trade, say you can help narrow the scope (what to include in the bid, what info to gather from subs) or that no live sub database is connected yet. Offer to add a line item for that trade to the estimate, or suggest they add team members / contacts manually.
```

**Why low risk:** Additive. Prevents the AI from implying a sub search tool exists. Only affects "find a sub" prompts; no impact on other flows.

---

### Change 5: JUDGMENT PROMPT GUIDANCE

**Location:** `promptSystem.js` — new `judgmentPromptsBlock` (always included)

**Before:** *(did not exist)*

**After:**
```
JUDGMENT PROMPTS (use existing get_project_health, risk data, estimate data):
- "What's the biggest mistake in this estimate?" / "What would an experienced contractor question here?" / "Where should I be more conservative?" / "Where can I afford to be more aggressive?" / "If this job goes wrong, what will probably be the reason?" / "What would make this estimate look more professional?"
- Answer style: direct conclusion first → main reason → risk or impact → practical recommendation.
- Use get_project_health risks, project risks, budget overruns, margin erosion. Avoid motivational or generic tone. Be specific and actionable.
```

**Why low risk:** Additive. Directs the AI to use existing get_project_health and risk data. No new tools or logic. Only affects tone and structure for judgment-style prompts.

---

## 3. Section Assembly Order

New blocks were inserted into the `sections` array as follows:

```javascript
const sections = [
  base,                    // includes UNKNOWN DATA, VAGUE ACTION
  contractorPhrasingBlock, // NEW
  findSubBlock,            // NEW
  judgmentPromptsBlock,    // NEW
  budgetBlock,
  expenseBlock,
  // ... rest unchanged
];
```

---

## 4. What Was NOT Changed

- `aiAssistant.js` — no edits
- `formatMarginReply`, `formatScenarioPresetLine`, `runScenarioAllPresetsInline`
- `buildMarginAnswerHint`
- `runProactiveIntelligence`, `get_project_health` executor
- `validateAction`, PRE-VALIDATION blocks
- Scenario math, scenarioMap, presets
- RUN-FIRST blocks (making enough, scenario Yes)
- `create_change_order` flow
- Router prompt (`buildRouterPrompt`)
- Project context resolver, AIAssistantModal

---

*End of changelog.*
