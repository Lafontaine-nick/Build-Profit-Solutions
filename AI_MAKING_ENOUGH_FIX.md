# "Am I making enough money on this job?" — Fix Reference

**Do not remove or bypass this flow.** The question must return a **deterministic margin answer** (current/projected % + 15–25% benchmark), not "Do you want a quick health check or full breakdown?"

---

## How it works (two parts)

### 1. Frontend: don’t intercept — send to backend

**File:** `mobile/components/AIAssistantModal.tsx`

The modal must **not** show the analysis-type clarification for "making enough" or margin questions. It must send the message to the backend instead.

- **Detection:** `isMakingEnoughOrMargin` / `isMakingEnoughOrMarginQuery` — phrases like:
  - "making enough" + ("money" | "job" | "project" | "am i making enough")
  - "what is my margin" / "what's my profit margin"
- **Where:**  
  - In the main send flow (~line 2215): if `isMakingEnoughOrMargin` is true, **do not** set `pendingAnalysisType` or show "Do you want a quick health check or full breakdown?" — continue and send to API.  
  - In the chip/project-selection flow (~line 1583): if `isMakingEnoughOrMarginQuery` is true, **do not** show the analysis-type message — send the query to the backend.

If you add new flows that could show "quick health check or full breakdown?", add the same exclusion for "making enough" / margin so those questions always go to the backend.

### 2. Backend: RUN-FIRST block — answer from context only

**File:** `backend/src/routes/aiAssistant.js`

A **run-first** block runs **right after** parsing `context` (before projectId resolution, router, or LLM). It uses **only** `parsedContext` so it works when the app sends project-detail context without `allProjects`.

- **Trigger:** Message matches "making enough" (with job/project/money) **and** we have project context (`projectId` or `currentProject` or `projectName` or `screen === 'Project Detail'`).
- **Margin source (in order):**  
  `parsedContext.spendToDateMarginPct` → `parsedContext.projectedMarginPct` → computed from `(contractValue - actualCost) / contractValue`.
- **Response:**  
  "Your current margin on **{name}** is **X%** (projected at completion). Many contractors target 15–25%; you're **above/at/below** that. [Optional: Consider tightening costs if below.]"
- **Same logic** exists in the **stream** handler (`POST /stream`) so both endpoints behave the same.

Do not remove or reorder this block; do not require `allProjects` for this answer when `parsedContext` has `projectId` / `screen: 'Project Detail'` and financial fields.

---

## Quick checklist (if it breaks again)

1. **Frontend**  
   - Search for "Do you want a quick health check or full breakdown?" and "analysis type" / `pendingAnalysisType`.  
   - Any path that can show that message for a single-project question must **exclude** "making enough" and margin questions (same regex as `isMakingEnoughOrMargin` / `isMakingEnoughOrMarginQuery`) so the request is sent to the backend.

2. **Backend**  
   - Search for "RUN-FIRST" and "making enough" in `aiAssistant.js`.  
   - The run-first block must run **immediately after** parsing context (no dependency on `allProjects` or router).  
   - Both `POST /` and `POST /stream` must have equivalent "making enough" handling.

3. **Project-detail context**  
   - When opening the assistant from a project (e.g. Jerry), the app must send at least: `projectId`, `screen: 'Project Detail'`, and one of `currentProject` / `projectName`, plus financial fields (`contractValue`, `actualCost` or `totalSpent`, and ideally `spendToDateMarginPct` or `projectedMarginPct`). The RUN-FIRST block uses these to compute the margin if needed.

---

## Related

- **Intent / resolver:** `mobile/lib/ai/projectContextResolver.ts` — "making enough" can be classified as project_analysis/project_health; the **modal** is responsible for skipping the analysis-type step for these questions (see Frontend above).  
- **Prompt:** `backend/src/routes/promptSystem.js` — profitability block describes how to answer these questions; the RUN-FIRST block ensures the answer is deterministic and never replaced by a generic health-check prompt.
