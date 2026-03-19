# Green Card Implementation Summary

**Date:** March 19, 2025  
**Status:** Implemented — ready for testing

---

## 1. Files Changed

### New Files
- `mobile/lib/ai/SelectionCards.tsx` — Reusable green-card component

### Modified Files
- `backend/src/routes/aiAssistant.js` — Expense, PO, and scenario guards; payload wiring
- `mobile/components/AIAssistantModal.tsx` — State, handlers, SelectionCards rendering, context injection

---

## 2. SelectionCards Foundation

**Added:** `mobile/lib/ai/SelectionCards.tsx`

- Shared component with option shape: `{ id, title, subtitle?, metadata?, type? }`
- Props: `options`, `onSelect(id, option)`, `label?`, `darkMode?`, `compact?`, `maxOptions?`
- Same visual style as existing chips (LinearGradient, teal border, haptics)

**Existing components:** ProjectSelectionChips, PaymentSelectionChips, AnalysisTypeChips are unchanged and still used as before.

---

## 3. Existing Card Components

**Left untouched.** No migration or refactor of:
- `ProjectSelectionChips`
- `PaymentSelectionChips`
- `AnalysisTypeChips`

They continue to work as before. SelectionCards is used only for the three new flows.

---

## 4. New Flows Implemented

### A) Expense Type Selection

**Trigger:** User says "Log an expense", "Add an expense", "Record a purchase" without specifying type.

**Cards:** Materials, Labor, Equipment, Permit, Other

**Flow:**
1. Backend returns `expenseTypeSelectionOptions` (PRE-ROUTER or expense guard).
2. Frontend shows SelectionCards with those options.
3. User taps a card → frontend sends the selected id (e.g. "materials", "labor") with `expenseTypeSelectionResume: true`, `selectedExpenseType`.
4. Backend treats as `hasExpenseType = true` and continues expense flow.

**Example prompts:** "Log an expense", "Add an expense", "Record a purchase"

---

### B) Purchase Order Selection

**Trigger:** User says "Mark PO as received", "Which PO did I receive?" when there are 2+ pending POs.

**Cards:** One card per pending PO (title = PO number, subtitle = amount · vendor).

**Flow:**
1. Backend PO guard detects mark-received intent and 2+ pending POs.
2. Returns `poSelectionOptions`, `poSelectionProjectId`, `poSelectionProjectName`.
3. Frontend shows SelectionCards.
4. User taps a PO → frontend sends PO number with `poSelectionResume: true`, `selectedPONumber`.
5. Backend executes `mark_purchase_order_received` with that PO.

**Example prompts:** "Mark PO as received", "Which PO did I receive?", "Show pending POs"

---

### C) Scenario Analysis

**Trigger:** User says "Run a scenario", "Worst case scenario", "Stress test this job" without choosing a preset.

**Cards:** Typical Friction, Bad Remodel, Smooth Job, Job Runs Long (2 weeks), Job Runs Long (4 weeks)

**Flow:**
1. Backend scenario guard detects scenario intent and no preset chosen.
2. Returns `scenarioSelectionOptions`.
3. Frontend shows SelectionCards.
4. User taps a scenario → frontend sends scenario id (e.g. "typical_friction") with `scenarioSelectionResume: true`, `selectedScenario`.
5. Backend runs `run_scenario_analysis` with that preset.

**Example prompts:** "Run a scenario", "Worst case scenario", "Stress test this job", "What if this project goes bad?"

---

## 5. Example Trigger Prompts

| Flow | Example Prompts |
|------|-----------------|
| Expense type | "Log an expense", "Add an expense", "Record a purchase" |
| PO selection | "Mark PO as received", "Which PO did I receive?" |
| Scenario | "Run a scenario", "Worst case scenario", "Stress test this job" |

---

## 6. Example Final UI Behavior

### Expense Type
1. User: "Log an expense"
2. AI: "What type of expense are you logging?" + 5 green cards (Materials, Labor, Equipment, Permit, Other)
3. User taps "Materials"
4. AI continues with materials expense flow (amount, category, vendor)

### PO Selection
1. User: "Mark PO as received" (with 2+ pending POs)
2. AI: "Which purchase order should I mark as received for [Project]?" + green cards (PO-123 · $1,200 · ABC Supply, etc.)
3. User taps a PO
4. AI: "I've marked purchase order PO-123 as received..."

### Scenario Analysis
1. User: "Run a scenario"
2. AI: "Which scenario would you like to run?" + 5 green cards (Typical Friction, Bad Remodel, Smooth Job, Job Runs Long 2w, Job Runs Long 4w)
3. User taps "Typical Friction"
4. AI returns scenario analysis with margin/profit impact

---

## 7. Success Criteria

- [x] Project selection cards still work
- [x] Payment selection cards still work
- [x] Analysis type cards still work
- [x] Expense type uses green cards
- [x] PO selection uses green cards
- [x] Scenario analysis uses green cards
- [x] No broad refactor of existing flows
- [x] SelectionCards added as shared base for new flows

---

## 8. Testing Checklist

1. **Expense type:** "Log an expense" → see 5 cards → tap Materials → flow continues
2. **PO selection:** Create 2+ POs, say "Mark PO as received" → see PO cards → tap one → marked received
3. **Scenario:** "Run a scenario" (in project context) → see 5 scenario cards → tap Typical Friction → scenario analysis returned
4. **Regression:** Project selection, payment selection, analysis type flows still work
