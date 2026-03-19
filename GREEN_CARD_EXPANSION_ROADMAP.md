# Green Card Expansion Roadmap — Build Profit Solutions AI

**Date:** March 16, 2025  
**Status:** Analysis complete — no code changes until approved

---

## 1. Current Green-Card Usage

### Summary

Three flows use the green selection-card pattern today. All share the same visual design: LinearGradient chips with teal/cyan border, title + optional subtitle, haptic feedback on tap.

| Flow | Component | Trigger | Backend Structured Options? | Data Source |
|------|-----------|---------|----------------------------|-------------|
| **Project selection** | `ProjectSelectionChips` | Frontend `projectContextResolver` when `needsClarification && clarificationType === 'project_selection'` | No — frontend builds options from `allProjects` / `activeProjects` | `parsedContext.allProjects`, `activeProjects`, `estimates` |
| **Payment selection** | `PaymentSelectionChips` | Backend returns `paymentSelectionOptions` in response | Yes — backend sends `{ id, title, status, amount?, dueDate? }[]` | Payment guard in `aiAssistant.js` (~line 7535) |
| **Analysis type** | `AnalysisTypeChips` | Frontend after project selection when `analysisType === 'unspecified'` | No — hardcoded `quick` / `full` | N/A — static options |

### Where They Render

- **AIAssistantModal.tsx** (lines 3341–3368): Chips render below assistant messages when:
  - `showProjectChips`: `item.id.includes('clarification')` && `!item.id.includes('payment')` && `pendingProjectSelection`
  - `showAnalysisChips`: `item.id.includes('analysis-type')` && `pendingAnalysisType`
  - `showPaymentChips`: `item.id.includes('payment-clarification')` && `pendingPaymentSelection`

- **Projects screen**: `ProjectSelectionChips` (compact) in input bar for project targeting — always visible when `isProjectsScreenContext`.

### Backend Integration

- **Project selection**: Frontend-only. Backend never sends `projectSelectionOptions`; resolver runs client-side before send.
- **Payment selection**: Backend sends `paymentSelectionOptions`, `paymentSelectionProjectId`, `paymentSelectionProjectName` in JSON response. Frontend sets `pendingPaymentSelection` and renders `PaymentSelectionChips`.
- **Analysis type**: Frontend-only. Query is modified (e.g. `"… (quick health check)"`) before send.

---

## 2. Best Next Green-Card Opportunities — AI Command Center / All Projects

### A1. Scenario Analysis

**Why it fits green cards:** User intent is known (run scenario); choices are finite and structured; tapping is faster than typing preset names.

**Example prompts:**
- "Run a scenario"
- "Worst case scenario"
- "What if this project goes bad?"
- "Stress test this job"

**Candidate cards:**

| Card Title | Subtitle | Backend ID |
|------------|----------|------------|
| Typical Friction | Labor +8%, materials +5%, overhead +3% | `typical_friction` |
| Bad Remodel | Labor +20%, materials +15%, overhead +10% | `bad_remodel` |
| Smooth Job | Labor -5%, materials -3% | `smooth_job` |
| Job Runs Long (2 weeks) | 2 extra weeks of burn | `job_runs_long` |
| Job Runs Long (4 weeks) | 4 extra weeks of burn | `job_runs_long_4` |

**Backend structured options:** Yes. `scenarioMap` already exists (lines 362–368). Add `scenarioSelectionOptions` to response when scenario intent detected but no preset chosen.

**Reuse existing component:** Yes — `SelectionCards` with `{ id, title, subtitle }` (same shape as payment cards).

**Implementation difficulty:** Medium — need to detect scenario intent, return options when asking "which scenario?", and handle tap as `scenarioSelectionResume` in next request.

**UX impact:** High — scenario names are non-obvious; cards make selection fast and clear.

---

### A2. Compare / Portfolio View Choices

**Why it fits green cards:** User wants "compare" or "what needs attention" — intent is known; sort/focus options are finite.

**Example prompts:**
- "Compare projects"
- "What needs attention?"
- "Show me what matters most"
- "Which project is most at risk?"

**Candidate cards:**

| Card Title | Subtitle | Backend param |
|------------|----------|---------------|
| Most Profitable | Sort by margin (default) | `sortBy: 'margin'` |
| Most At Risk | Sort by risk flags | `sortBy: 'risk'` |
| Needs Attention | Missing receipts, over budget | `sortBy: 'overBudget'` or custom |
| Margin Ranking | By projected margin | `sortBy: 'margin'` |

**Backend structured options:** Yes. `compare_projects` already supports `sortBy: margin | overBudget | progress | risk`. Add `compareViewOptions` when user says "compare" or "what needs attention" without specifying view.

**Reuse existing component:** Yes — generic `SelectionCards`.

**Implementation difficulty:** Medium — router/guard must detect compare intent and return options before calling `compare_projects`.

**UX impact:** Medium — power users may type; cards help casual users choose a view quickly.

---

### A3. Analysis Depth / Analysis Focus

**Why it fits green cards:** Already implemented as `AnalysisTypeChips`. Could be extended with more options.

**Current cards:** Quick Health Check, Full Breakdown.

**Extended candidate cards (optional):**

| Card Title | Subtitle | Value |
|------------|----------|-------|
| Quick Health Check | Status, budget, progress | `quick` |
| Full Breakdown | Detailed analysis & insights | `full` |
| Profit Risks Only | Focus on margin threats | `risks` |
| Next Actions Only | What to do next | `actions` |

**Backend structured options:** Could add `analysisFocusOptions` for extended modes. Current flow is frontend-only.

**Reuse existing component:** Yes — `AnalysisTypeChips` could accept `options` prop for extensibility.

**Implementation difficulty:** Low (extend existing) — add options to `AnalysisTypeChips` and wire new types in `projectContextResolver` / backend.

**UX impact:** Medium — current 2-option flow works; extra options add flexibility for power users.

---

## 3. Best Next Green-Card Opportunities — AI Inside a Project

### B4. Expense Type Selection

**Why it fits green cards:** User says "log an expense" — intent known; type is a finite set; typing "materials" vs tapping is slower.

**Example prompts:**
- "Log an expense"
- "Add an expense"
- "Record a purchase"

**Candidate cards:**

| Card Title | Subtitle | Backend routing |
|------------|----------|-----------------|
| Materials | Category, vendor, amount | `add_material_expense` |
| Labor | Trade, description, amount | `add_labor_expense` |
| Equipment | Rental, purchase | `add_material_expense` (category) |
| Permit | Permit fees | `add_material_expense` (category) |
| Other | Custom category | `add_material_expense` |

**Backend structured options:** Yes. Expense guard already forces `required_fields_missing: ['expense_type']` and asks "Is it for materials or labor?" (lines 6765, 7263, 7609). Replace text question with `expenseTypeSelectionOptions`.

**Reuse existing component:** Yes — `SelectionCards` with `{ id, title, subtitle? }`.

**Implementation difficulty:** Medium — backend returns `expenseTypeSelectionOptions`; frontend adds `pendingExpenseTypeSelection` and `ExpenseTypeChips` (or generic component).

**UX impact:** High — very common flow; cards reduce friction significantly.

---

### B5. Change Order Type

**Why it fits green cards:** User says "create a change order" — intent known; CO type can guide follow-up questions.

**Example prompts:**
- "Create a change order"
- "Add a change order"

**Candidate cards:**

| Card Title | Subtitle | Notes |
|------------|----------|-------|
| Labor | Additional labor cost | |
| Materials | Additional materials | |
| Scope Increase | Client-requested scope | |
| Schedule Delay | Delay-related costs | |

**Backend structured options:** Optional. Current CO flow asks for description, amount, vendor — no type. Adding type could improve routing but is not strictly required.

**Reuse existing component:** Yes.

**Implementation difficulty:** Medium — CO flow is complex; type would inform clarification questions.

**UX impact:** Medium — CO creation is less frequent than expense logging.

---

### B6. Estimate Review Mode

**Why it fits green cards:** User says "review this estimate" — intent known; review focus is finite.

**Example prompts:**
- "Review this estimate"
- "Check this bid"
- "What am I missing?"

**Candidate cards:**

| Card Title | Subtitle | Focus |
|------------|----------|-------|
| Margin Check | Bid vs cost, markup | |
| Missing Scope Check | Gaps in line items | |
| Labor Review | Labor hours, rates | |
| Material Review | Material quantities, pricing | |
| Bid Strength Review | Competitiveness | |

**Backend structured options:** Yes — would need new `estimateReviewFocusOptions` or similar.

**Reuse existing component:** Yes.

**Implementation difficulty:** High — estimate context and tools differ from project context; new routing logic.

**UX impact:** Medium — valuable for Estimate Generator screen; lower frequency than expenses.

---

### B7. Risk Focus

**Why it fits green cards:** User says "show me the risks" — intent known; risk categories are finite.

**Example prompts:**
- "Show me the risks"
- "What should I worry about?"
- "What needs attention on this project?"

**Candidate cards:**

| Card Title | Subtitle | Focus |
|------------|----------|-------|
| Budget Risk | Over budget, cost creep | |
| Schedule Risk | Delays, timeline | |
| Missing Receipts | Unreceipted expenses | |
| Payment Delays | Overdue payments | |
| Scope Gaps | Missing scope items | |

**Backend structured options:** Yes — `riskFocusOptions` when risk intent detected.

**Reuse existing component:** Yes.

**Implementation difficulty:** Medium — risk data exists in context; need to structure options and route.

**UX impact:** High — common question; cards make it easy to drill into specific risk areas.

---

### B8. Purchase Order Selection

**Why it fits green cards:** User says "mark PO as received" — intent known; pending POs are a known list.

**Example prompts:**
- "Mark PO as received"
- "Which PO did I receive?"
- "Show pending POs"

**Candidate cards:** Dynamic — one card per pending PO.

| Card Title | Subtitle | Example |
|------------|----------|---------|
| PO-123456 | $1,200 · ABC Supply | |
| PO-789012 | $450 · Home Depot | |

**Backend structured options:** Yes. Backend has `mark_purchase_order_received` and finds POs from `purchaseOrders`. Add `poSelectionOptions` when multiple pending POs and user didn't specify which.

**Reuse existing component:** Yes — same pattern as payment selection (dynamic list from backend).

**Implementation difficulty:** Medium — similar to payment selection; add `poSelectionOptions` to response when ambiguous.

**UX impact:** High — mirrors payment flow; very natural fit.

---

### B9. Team Member Selection

**Why it fits green cards:** User says "assign PM" or "message [name]" — intent known; team members are a known list.

**Example prompts:**
- "Assign PM"
- "Who is the project manager?"
- "Add team member" (different flow — needs name input)
- "Message John"

**Candidate cards:** Dynamic — one card per team member.

| Card Title | Subtitle | Example |
|------------|----------|---------|
| Nicholas | PM · Active | |
| Jerry | Crew · Active | |

**Backend structured options:** Yes. `assign_pm` and `message_team_member` need `teamMemberName`. When user says "assign PM" without name, backend can return `teamMemberSelectionOptions` from `parsedContext.teamMembers`.

**Current behavior:** Backend asks "Which team member do you want to appoint as project manager?" and lists names in text (line 6852). Replace with structured options.

**Reuse existing component:** Yes — same as project selection (dynamic list).

**Implementation difficulty:** Low — backend already has team list; add `teamMemberSelectionOptions` and selection type (assign_pm vs message).

**UX impact:** High — assign PM is a common action; cards are faster than typing names.

---

### B10. Timeline Milestone Selection

**Why it fits green cards:** User says "mark milestone complete" — intent known; milestones are a known list.

**Example prompts:**
- "Mark milestone complete"
- "Update timeline"
- "Mark framing complete"

**Candidate cards:** Dynamic — one card per incomplete milestone.

| Card Title | Subtitle | Example |
|------------|----------|---------|
| Framing | Due Mar 20 · In progress | |
| Rough-in | Due Mar 27 · Pending | |

**Backend structured options:** Yes. `mark_timeline_item_complete` needs `itemName`. When user says "mark complete" without specifying item, return `milestoneSelectionOptions` from timeline.

**Reuse existing component:** Yes — same as payment/PO selection.

**Implementation difficulty:** Medium — timeline structure varies; need to extract incomplete items and format for cards.

**UX impact:** Medium — less frequent than payments; still improves UX when many milestones.

---

### B11. Project-Name Disambiguation

**Why it fits green cards:** When project match is ambiguous or low-confidence, show cards instead of asking user to type.

**Example prompts:**
- Ambiguous: "Review Chris" when multiple projects have "Chris" in name
- Low confidence: "Check the kitchen job" with several kitchen projects

**Candidate cards:** Dynamic — one card per candidate project.

| Card Title | Subtitle | Example |
|------------|----------|---------|
| Chris Kitchen Remodel | Active · 45% | |
| Chris Bathroom | Completed | |

**Backend structured options:** Yes — when router has low-confidence match, return `projectDisambiguationOptions` instead of asking in prose.

**Reuse existing component:** Yes — same as project selection.

**Implementation difficulty:** High — requires confidence scoring and disambiguation logic in router.

**UX impact:** Medium — edge case; when it happens, cards help.

---

## 4. Highest-ROI Items to Build Next

| Rank | Flow | Location | Difficulty | UX Impact | Rationale |
|------|------|----------|------------|-----------|------------|
| 1 | **Expense type selection** | Inside project | Medium | High | Very high frequency; current text question is clunky |
| 2 | **Team member selection** | Inside project | Low | High | Assign PM is common; backend already has logic |
| 3 | **PO selection** | Inside project | Medium | High | Mirrors payment flow; natural fit |
| 4 | **Scenario analysis** | Command Center | Medium | High | Scenario names are non-obvious; cards clarify |
| 5 | **Risk focus** | Inside project | Medium | High | Common "what should I worry about?" question |
| 6 | **Compare/portfolio view** | Command Center | Medium | Medium | Helps casual users choose view |
| 7 | **Timeline milestone selection** | Inside project | Medium | Medium | Useful when many milestones |
| 8 | **Change order type** | Inside project | Medium | Medium | Less frequent; nice to have |
| 9 | **Estimate review mode** | Estimate Generator | High | Medium | Different context; more complex |
| 10 | **Project disambiguation** | Both | High | Medium | Edge case; lower priority |

---

## 5. Shared Reusable Component Recommendation

### Can Existing Components Be Generalized?

**Yes.** All three current components share:
- Same visual style (LinearGradient, border, padding)
- Same interaction (TouchableOpacity, haptics)
- Same layout (label + chips in a row/wrap)
- Slightly different option shapes and `onSelect` signatures

### Recommended: `SelectionCards` Component

Create a single reusable component that accepts a generic option shape and renders the green-card UI.

**Suggested option shape:**

```ts
type SelectionOption = {
  id: string;
  title: string;
  subtitle?: string;
  metadata?: Record<string, unknown>;  // optional, for extensibility
  type?: string;                      // optional, e.g. 'project' | 'payment' | 'scenario'
};
```

**Props:**

```ts
type SelectionCardsProps = {
  options: SelectionOption[];
  onSelect: (id: string, option: SelectionOption) => void;
  label?: string;           // "Which payment should I mark as completed?"
  darkMode?: boolean;
  compact?: boolean;        // horizontal scroll, smaller chips
  maxOptions?: number;      // cap for long lists
};
```

**Migration path:**
1. Create `SelectionCards` with the above API.
2. Refactor `ProjectSelectionChips`, `PaymentSelectionChips`, `AnalysisTypeChips` to use `SelectionCards` internally (or replace with thin wrappers).
3. New flows (expense type, PO, team member, etc.) use `SelectionCards` directly.

**Benefits:**
- Single place to update styling
- Consistent behavior (haptics, accessibility)
- Easier to add new flows
- Option shape supports all current and proposed use cases

---

## 6. Suggested Implementation Order

### Phase 1: Foundation (Do First)
1. **Create `SelectionCards`** — generic component with `SelectionOption` shape.
2. **Refactor existing chips** — migrate Project, Payment, Analysis to use `SelectionCards` (no behavior change).

### Phase 2: High-ROI Inside-Project Flows
3. **Expense type selection** — backend `expenseTypeSelectionOptions`, frontend `pendingExpenseTypeSelection`, wire to expense guard.
4. **Team member selection** — backend `teamMemberSelectionOptions` for assign PM / message flows.
5. **PO selection** — backend `poSelectionOptions` when multiple pending POs; mirror payment flow.

### Phase 3: Command Center
6. **Scenario analysis** — backend `scenarioSelectionOptions` when scenario intent detected; handle `scenarioSelectionResume`.
7. **Compare/portfolio view** — optional `compareViewOptions` when compare intent without explicit view.

### Phase 4: Additional Inside-Project
8. **Risk focus** — `riskFocusOptions` when risk intent detected.
9. **Timeline milestone selection** — `milestoneSelectionOptions` when "mark complete" without item.

### Phase 5: Lower Priority
10. **Change order type** — optional type selection before CO details.
11. **Estimate review mode** — for Estimate Generator screen.
12. **Project disambiguation** — when router has low-confidence match.

---

## Constraints Reminder

- **Do not break** existing project-selection, payment-selection, or analysis-type card flows.
- **Do not broadly rewrite** working AI routing; add new option payloads and guards alongside existing logic.
- **Prefer reusable components** — `SelectionCards` over one-off implementations.
- **Analysis first** — this document is the plan; code changes only after explicit approval.

---

## File Reference

| File | Role |
|------|------|
| `mobile/lib/ai/projectSelectionChips.tsx` | Project selection cards |
| `mobile/lib/ai/paymentSelectionChips.tsx` | Payment selection cards |
| `mobile/lib/ai/analysisTypeChips.tsx` | Analysis type cards |
| `mobile/components/AIAssistantModal.tsx` | Renders chips, manages `pending*` state |
| `mobile/lib/ai/projectContextResolver.ts` | Project + analysis-type clarification |
| `backend/src/routes/aiAssistant.js` | Payment guard, scenario map, expense guard, etc. |
