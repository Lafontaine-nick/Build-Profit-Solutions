# AI Assistant Audit Report

**Date:** March 19, 2026  
**Scope:** Backend AI logic (promptSystem.js, aiAssistant.js), frontend context (AIAssistantModal, projectContextResolver)  
**Standard:** AI should sound like a business-minded estimator / profit-focused PM, not a motivational speaker or generic chatbot.

---

## Architecture Summary

| Component | Location | Purpose |
|-----------|----------|---------|
| System prompt | `promptSystem.js` → `buildSystemPrompt()` | 3 layers: Base, Domain Injection, Persona Overlay |
| Router | `promptSystem.js` → `buildRouterPrompt()` | Intent → domain, action, proposed_tool, required_fields_missing |
| Run-first blocks | `aiAssistant.js` | Bypass router for "making enough", scenario "Yes" |
| Tool executors | `aiAssistant.js` | compare_projects, get_project_health, run_scenario_analysis, create_change_order, add_* |
| Validation | `aiAssistant.js` → `validateAction()` | Pre-execution checks (project, amount, vendor, etc.) |
| Proactive intelligence | `aiAssistant.js` → `runProactiveIntelligence()` | PM mode alerts (budget burn, margin erosion, etc.) |
| Project context | `projectContextResolver.ts` | "Which project?" clarification, chip options |
| Context assembly | `AIAssistantModal.tsx` → `enhancedContext` | allProjects, resolvedProjectId, budget/expense data |

---

## A) Profitability and Financial Intelligence

### Current Implementation

| Prompt | Where It Lives | Current Behavior | Quality |
|--------|----------------|------------------|---------|
| Am I making enough money on this job? | RUN-FIRST block (aiAssistant.js ~3202), formatMarginReply | Deterministic: uses spend-to-date/projected margin, compares to 15–25%, returns structured reply | **Good** |
| Is 18% margin healthy? | profitabilityBlock (promptSystem.js ~401), deterministic block (aiAssistant.js ~3708) | Compares stated % to project margin and typical ranges (15–25%) | **Good** |
| What's the biggest threat to profit? | profitabilityBlock, get_project_health risks | Uses project risk data (over_budget, margin_erosion, etc.) | **Good** |
| Which cost category matters most if prices go up? | profitabilityBlock, deterministic (aiAssistant.js ~3732) | Uses estimate line items, computes exposure and 10% impact | **Good** |
| If drywall labor increases 12%, how much margin do I lose? | run_scenario_analysis (custom), profitabilityBlock | Custom scenario with laborPctChange; tool does the math | **Okay** |
| What price to protect 22% margin? | profitabilityBlock, deterministic (aiAssistant.js ~3757) | Price = cost / (1 - X/100); exact formula | **Good** |
| Overhead increases 12% → 15%? | profitabilityBlock | Instructs AI to compute; no dedicated run-first | **Okay** |
| Worst-case scenario | profitabilityBlock, run_scenario_analysis (bad_remodel) | bad_remodel preset; "materials +10%, labor +10%, overhead +3%" in prompt | **Good** |
| Conservative vs aggressive bid | — | Not explicitly in prompts | **Weak** |
| Which project would be most likely to lose money? | compare_projects (sortBy), portfolio prompts | Can infer from margin/overBudget; not explicit | **Okay** |

**Files:** `promptSystem.js` (profitabilityBlock), `aiAssistant.js` (RUN-FIRST, buildMarginAnswerHint, lines 3657–3763, runScenarioAllPresetsInline, run_scenario_analysis executor)

**What should stay untouched:** RUN-FIRST "making enough", formatMarginReply, buildMarginAnswerHint, scenario math, deterministic profitability blocks.

**What should maybe improve later:** Add "conservative vs aggressive bid" to profitabilityBlock; ensure "which project most likely to lose money" routes to compare_projects with sortBy=margin.

**Minimum-risk recommendation:** Leave as-is. Test "conservative vs aggressive bid" manually; if weak, add one prompt line.

---

## B) Project Manager Mode

### Current Implementation

| Prompt | Where It Lives | Current Behavior | Quality |
|--------|----------------|------------------|---------|
| Check project health | get_project_health | Returns risks, financials, budget breakdown, recommendations | **Good** |
| What risks do you see? | get_project_health.risks, runProactiveIntelligence | Budget burn, margin erosion, overruns, overdue payments | **Good** |
| What should I do next? | get_project_health recommendations | Structured next steps from health check | **Good** |
| What information is missing? | runProactiveIntelligence (missing receipts, etc.) | Surfaces missing receipts, underbilled risk | **Okay** |
| What would you flag before I send this estimate? | — | Not explicit in prompts | **Weak** |
| 3 mistakes contractors commonly make at this stage | — | Not in prompts | **Weak** |
| What would make this bid stronger? | — | Not explicit | **Weak** |
| What should I verify before the job starts? | — | Not explicit | **Weak** |
| Do you see anything unusual? | runProactiveIntelligence, get_project_health | Alerts on burn, overruns, duplicates | **Okay** |
| If you were my PM, what would you do next? | get_project_health | Returns recommendations; phrasing may vary | **Okay** |

**Files:** `aiAssistant.js` (runProactiveIntelligence, executeGetProjectHealth), `promptSystem.js` (personaOn, intelligenceBlock)

**What should stay untouched:** runProactiveIntelligence, get_project_health executor, PM persona.

**What should maybe improve later:** Add 2–3 prompt lines for "flag before sending estimate", "common mistakes at this stage", "what would make bid stronger" — as guidance, not new tools.

**Minimum-risk recommendation:** Leave as-is. PM mode is strong. Add prompt lines only if manual testing shows gaps.

---

## C) Clarifying-Question Behavior

### Current Implementation

| Prompt | Where It Lives | Current Behavior | Quality |
|--------|----------------|------------------|---------|
| Update the labor cost | Router, expense rules | Would need amount + category; "which labor category" not explicit | **Okay** |
| Add permits | add_estimate_line_item, add_material_expense | Amount required; "permit amount if unknown" not explicit | **Okay** |
| Make the margin better | — | No explicit "ask target margin" | **Weak** |
| Fix this estimate | — | Vague; no structured clarification | **Weak** |
| What should I charge? | profitabilityBlock (price for X% margin) | Needs target margin; prompt says use cost/(1-X/100) | **Okay** |
| Find me a sub | — | No sub-finder tool; would need "which trade" | **Weak** |

**Files:** `promptSystem.js` (SAFETY RULES, CLARIFICATION FLOW, expense/PO rules), `aiAssistant.js` (validateAction, PRE-VALIDATION blocks)

**Current strengths:**
- SAFETY RULES: "NEVER guess amounts, vendors, or project names — ask ONE clarifying question"
- "NEVER call a function with missing required fields — ask first"
- CLARIFICATION FLOW: "Ask for only ONE missing item at a time"
- Expense logging: explicit "What type? Materials or labor?" when ambiguous
- PO: "What is the expected delivery or received date?" when missing
- PRE-VALIDATION blocks prevent tool calls with missing amount/category/vendor

**What should stay untouched:** SAFETY RULES, CLARIFICATION FLOW, PRE-VALIDATION, expense-type clarification.

**What should maybe improve later:** Add explicit lines: "Make the margin better" → ask target margin; "Fix this estimate" → ask what specifically to fix; "Find me a sub" → ask which trade.

**Minimum-risk recommendation:** Add 2–3 lines to CLARIFICATION FLOW or a "VAGUE ACTION" block: when user says "fix", "make better", "find sub" without specifics, ask one clarifying question.

---

## D) Real Contractor-Style Prompts

### Current Implementation

| Prompt | Where It Lives | Current Behavior | Quality |
|--------|----------------|------------------|---------|
| Am I too low on this? | Margin/profit mapping | Maps to margin question; profitabilityBlock | **Okay** |
| Does this bid look skinny? | — | "Skinny" not in natural language examples | **Weak** |
| How much room do I got? | — | Not explicit | **Weak** |
| What am I missing here? | get_project_health, runProactiveIntelligence | Missing receipts, risks | **Okay** |
| Bump labor a little and tell me what that does | run_scenario_analysis (labor_up_10 or custom) | "A little" vague; custom scenario could work | **Okay** |
| Can I still hit 20% on this? | Margin logic | Could compute; not explicit | **Okay** |
| This feels light — check it | get_project_health | "Feels light" not explicit | **Weak** |
| I think I forgot something. What usually gets missed? | — | Not explicit | **Weak** |
| How bad does it hurt me if material jumps 10%? | materials_up_10 scenario, profitabilityBlock | Scenario exists; "how bad does it hurt" is casual phrasing | **Okay** |
| What should I watch out for before I send this? | get_project_health risks | Risks surface; "before I send" not explicit | **Okay** |

**Files:** `promptSystem.js` (NATURAL LANGUAGE EXAMPLES ~338), portfolio mode

**Current strengths:** "How are things looking?", "What should I worry about?", "Am I making money?", "What's slipping?" — all mapped. Contractor phrasing partially covered.

**What should stay untouched:** Existing natural language examples.

**What should maybe improve later:** Add to NATURAL LANGUAGE EXAMPLES: "too low", "skinny", "room do I got", "feels light", "forgot something", "what usually gets missed".

**Minimum-risk recommendation:** Add 5–6 contractor phrases to NATURAL LANGUAGE EXAMPLES. Low risk; additive only.

---

## E) Action + Explanation Behavior

### Current Implementation

| Prompt | Where It Lives | Current Behavior | Quality |
|--------|----------------|------------------|---------|
| Add a $500 contingency | add_estimate_line_item | Executes; response format has ✅ → 📊 → ➡️ | **Good** |
| Why did the total change? | — | LLM explains; no structured before/after | **Okay** |
| Break down exactly what you updated | — | Not explicit | **Weak** |
| Show me before and after | — | Not explicit | **Weak** |
| Explain this like I'm sending it to a client | — | Not explicit | **Weak** |
| Summarize the changes in one sentence | — | Not explicit | **Okay** |
| Create a note for why this estimate changed | add_daily_log | Could use add_daily_log; not explicit | **Okay** |

**Files:** `promptSystem.js` (RESPONSE FORMAT, base), `aiAssistant.js` (tool executors)

**Current strengths:** RESPONSE FORMAT "✅ [What was done] → 📊 [Updated numbers] → ➡️ [Next step]". Change order block: "Budget updated: $X → $Y".

**What should stay untouched:** RESPONSE FORMAT, change order flow.

**What should maybe improve later:** Add one line: "When user asks 'what changed' or 'before and after', summarize: before values, after values, and why."

**Minimum-risk recommendation:** Leave as-is. Format is good. "Before/after" can be added later if testing shows need.

---

## F) Voice-Input / Messy Natural Language

### Current Implementation

| Prompt | Where It Lives | Current Behavior | Quality |
|--------|----------------|------------------|---------|
| Hey can you check if I'm still good on profit if labor runs a little high | run_scenario_analysis, margin logic | "A little high" → labor_up_10 or custom | **Okay** |
| I need this bid to be around fifteen percent margin what should the price be | profitabilityBlock (price for X% margin) | "Around fifteen" — number extraction; 15% in formula | **Okay** |
| add like 2 grand for concrete and see what happens | add_estimate_line_item, extraction | "Like 2 grand" — 2000 extracted; "see what happens" = show impact | **Okay** |
| what am I forgetting before I send this estimate out | get_project_health, risks | Maps to risks/missing info | **Okay** |
| if subs come in higher than expected how bad is this gonna hurt me | Scenario (labor_up_10), profitabilityBlock | Subs = labor; scenario exists | **Okay** |

**Files:** Router (intent inference), extraction rules (any number in message = amount), `promptSystem.js` (EXTRACTION RULES)

**Current strengths:** Extraction: "any number in the message IS the amount". Router infers intent. No strict keyword matching.

**What should stay untouched:** Extraction rules, router.

**What should maybe improve later:** If "around fifteen percent" or "like 2 grand" fail, add normalization examples. Currently likely fine.

**Minimum-risk recommendation:** Leave as-is. Test voice-style prompts manually first.

---

## G) Error Handling / Anti-Hallucination

### Current Implementation

| Question | Where It Lives | Current Behavior | Quality |
|----------|----------------|------------------|---------|
| What's the exact square footage? | — | No explicit "I don't have that"; LLM may infer from estimate | **Okay** |
| Which supplier gave me the cheapest framing? | — | No supplier comparison tool | **Weak** |
| What permit amount did the city quote me? | — | No permit data model | **Weak** |
| What did my customer say about the timeline? | — | No customer notes | **Weak** |
| When is inspection scheduled? | Calendar, get_timeline_items | Could be in timeline/calendar | **Okay** |
| Who is my drywall sub on this job? | — | No sub tracking | **Weak** |

**Files:** `promptSystem.js` (SAFETY RULES), `aiAssistant.js` (PRE-VALIDATION, fallbacks)

**Current strengths:**
- SAFETY RULES: "NEVER mention dollar amounts unless the user provided them or they come from project data"
- "NEVER guess amounts, vendors, or project names"
- PRE-VALIDATION: blocks PO with hallucinated dates (inferExpectedDeliveryFromUserMessages)
- Blocks "Unknown Vendor" for material expenses
- Fallbacks: "I don't have contract or cost numbers for [project] in this view"
- get_project_by_name: "Could not find project"
- Intelligence block: "Every number you cite must come from this list — never invent figures"

**What should stay untouched:** SAFETY RULES, PRE-VALIDATION, fallbacks.

**What should maybe improve later:** Add one rule: "When the user asks for data you don't have (square footage, supplier, permit, customer notes, sub name), say clearly: 'I don't have that in your project data. You can add it in [suggested place].' Do not invent values."

**Minimum-risk recommendation:** Add one "UNKNOWN DATA" rule to base prompt. High value, low risk.

---

## H) Multi-Step Intelligence

### Current Implementation

| Prompt | Where It Lives | Current Behavior | Quality |
|--------|----------------|------------------|---------|
| Raise labor by 10%, then tell me the new price I need to keep 18% margin | run_scenario_analysis + formula | Two steps: scenario then price = cost/(1-0.18) | **Okay** |
| Add $750 permit, $1,200 contingency, summarize impact | add_estimate_line_item x2 | Could chain; not explicit | **Okay** |
| 3 biggest risk areas and what to do about each | get_project_health | Returns risks; "what to do" in recommendations | **Good** |
| Review this estimate like a senior estimator | — | No explicit prompt | **Weak** |
| If I want to stay competitive but protect profit, what would you recommend? | — | No explicit | **Weak** |
| Give me a safer version and explain why | — | No explicit | **Weak** |
| Pretend material pricing is volatile. How should I structure this bid? | run_scenario_analysis (materials_up_10), custom | Scenario exists; "structure" advice not explicit | **Okay** |
| If this was your own company, would you send this estimate as-is? | — | No explicit | **Weak** |

**Files:** Router, tool chaining, LLM reasoning

**Current strengths:** get_project_health returns risks + recommendations. Scenario tool does math. LLM can chain steps if instructed.

**What should stay untouched:** Tool executors, scenario math.

**What should maybe improve later:** Add 1–2 lines: "When user asks for a 'review like a senior estimator' or 'would you send this as-is', use get_project_health risks and give direct, practical advice. Do not be generic."

**Minimum-risk recommendation:** Leave as-is. Multi-step relies on LLM; add prompt lines only if testing shows generic answers.

---

## I) Cross-Feature Actions

### Current Implementation

| Action | Where It Lives | Current Behavior | Quality |
|--------|----------------|------------------|---------|
| Log an expense | add_material_expense, add_labor_expense | Robust; clarification for materials vs labor | **Good** |
| Create a change order | create_change_order | Robust; required_fields_missing flow | **Good** |
| Set a payment schedule | add_timeline_payment | Exists | **Good** |
| Find a subcontractor for drywall | — | No tool | **Weak** |
| Create a project note about margin risk | add_daily_log | Exists | **Good** |
| Flag this project as high risk | — | No tool; get_project_health has riskLevel | **Okay** |
| Draft a follow-up message to the client | — | No tool | **Weak** |
| Add a reminder to verify permits | — | No tool | **Weak** |
| Show me missing cost items | get_project_health, compare_projects | Risks, overruns | **Okay** |
| Prepare this project for review | — | Vague; no explicit flow | **Weak** |

**Files:** Tool definitions in `aiAssistant.js`, router

**What should stay untouched:** Log expense, change order, payment schedule, daily log.

**What should maybe improve later:** "Find a sub" → ask which trade, then say "I don't have a sub finder; you can add subs in the Team or Contacts." "Draft follow-up" / "Add reminder" → acknowledge and suggest manual steps. No new tools unless product scope expands.

**Minimum-risk recommendation:** Add prompt line: "When user asks to 'find a sub' or 'find subcontractor', ask which trade, then explain you don't have a sub database but they can add team members or use their contacts."

---

## J) "Feels Smart" Prompts

### Current Implementation

| Prompt | Where It Lives | Current Behavior | Quality |
|--------|----------------|------------------|---------|
| What's the biggest mistake in this estimate? | — | No explicit; LLM may infer from risks | **Okay** |
| What would an experienced contractor question here? | — | No explicit | **Weak** |
| What part of this job is most likely to go over budget? | get_project_health risks | Material/labor overruns in risks | **Good** |
| Where should I be more conservative? | — | No explicit | **Weak** |
| Where can I afford to be more aggressive? | — | No explicit | **Weak** |
| If this job goes wrong, what will probably be the reason? | get_project_health risks | Risks indicate causes | **Good** |
| What would you check before I sign this contract? | — | No explicit | **Weak** |
| What hidden costs should I account for? | — | No explicit | **Weak** |
| What would make this estimate look more professional? | — | No explicit | **Weak** |

**Files:** get_project_health (risks), promptSystem (persona)

**Current strengths:** get_project_health returns concrete risks. Persona says "Be a PM who saves the contractor money."

**What should stay untouched:** get_project_health, persona.

**What should maybe improve later:** Add block: "When user asks for judgment (biggest mistake, what would experienced contractor question, where to be conservative/aggressive, what to check before signing, hidden costs, professional estimate), use get_project_health risks and estimate data. Give specific, practical advice. Avoid generic motivational language."

**Minimum-risk recommendation:** Add one "JUDGMENT PROMPTS" block. Medium value; ensures estimator/PM tone.

---

## Global AI Qualities

| Quality | Current State | Notes |
|---------|---------------|-------|
| Uses current project context automatically | **Good** | resolvedProjectId, parsedContext, allProjects |
| Asks follow-up when needed | **Good** | SAFETY RULES, CLARIFICATION FLOW, PRE-VALIDATION |
| Shows calculations clearly | **Good** | formatMarginReply, formatScenarioPresetLine, scenario tool output |
| Explains reasoning in contractor language | **Okay** | "Plain language", "contractor-friendly"; could be stronger |
| Never invents missing data | **Good** | SAFETY RULES, PRE-VALIDATION; add UNKNOWN DATA rule for edge cases |

---

## Top 10 Prompts to Manually Test First

1. **Am I making enough money on this job?** (from project detail) — RUN-FIRST
2. **What's the biggest threat to profit on this job?** — Deterministic profitability
3. **Run a scenario analysis** → **Yes** — RUN-FIRST scenario "Yes"
4. **What price should I charge to protect a 22% margin?** — Deterministic
5. **Check project health** / **What should I do next?** — get_project_health
6. **Log an expense** (without saying materials or labor) — Clarification
7. **Add permits** (no amount) — Clarification
8. **Am I too low on this?** / **Does this bid look skinny?** — Contractor phrasing
9. **What's the exact square footage of this project?** (when not in data) — Anti-hallucination
10. **Which project would be most likely to lose money?** — compare_projects

---

## 5 Highest-Risk Weak Spots

1. **Unknown-data questions (G)** — No explicit rule to say "I don't have that" for square footage, supplier, permit, customer notes, sub. Risk: hallucination.
2. **Vague actions (C)** — "Fix this estimate", "Make the margin better", "Find me a sub" without clarification flow. Risk: wrong assumptions or no action.
3. **Judgment prompts (J)** — "Biggest mistake", "what would experienced contractor question", "where to be conservative" — no explicit guidance. Risk: generic or motivational tone.
4. **Sub finder / draft message / reminder (I)** — No tools. Risk: AI may promise capabilities it doesn't have.
5. **Multi-step chaining (H)** — "Raise labor 10%, then price for 18% margin" — not explicitly chained. Risk: incomplete answer.

---

## Safest Next Improvements (No Breaking Changes)

1. **Add UNKNOWN DATA rule** — One line in base: when user asks for data not in context, say "I don't have that in your project data" and suggest where to add it.
2. **Add contractor phrases to NATURAL LANGUAGE EXAMPLES** — "too low", "skinny", "room do I got", "feels light", "forgot something".
3. **Add VAGUE ACTION clarification** — When user says "fix", "make better", "find sub" without specifics, ask one clarifying question.
4. **Add "Find a sub" response** — Ask which trade, then explain no sub database; suggest Team/Contacts.
5. **Add JUDGMENT PROMPTS block** — When user asks for estimator/PM judgment, use get_project_health and give specific advice; avoid generic tone.

---

## What to Leave Completely Untouched

- RUN-FIRST blocks (making enough, scenario Yes)
- formatMarginReply, formatScenarioPresetLine, runScenarioAllPresetsInline
- buildMarginAnswerHint
- runProactiveIntelligence
- get_project_health executor
- validateAction, PRE-VALIDATION blocks
- SAFETY RULES, CLARIFICATION FLOW
- Scenario math (scenarioMap, presets)
- create_change_order flow
- Expense/PO clarification logic
- Project context resolver ("which project?" chips)
- compare_projects, pre-router overrides (losing money, completed projects, over budget)

---

*End of audit. No code changes were made. All recommendations are for future consideration after manual testing.*
