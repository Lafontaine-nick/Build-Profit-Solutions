# Professional Proposal System

## ✅ ACTIVE SYSTEM

This is the **ONLY** proposal/contract generation system used in the app.

## Files

- **`buildProposalHtml.ts`** - Generates the professional HTML proposal
- **`exportPdf.ts`** - Exports the HTML as a PDF and shares it

## Format Features

✅ Left-aligned company name header with right-aligned meta info  
✅ Green summary bar with Total, Duration, Warranty, Retainage  
✅ Side-by-side Customer Information and Project Details boxes  
✅ Clean DESCRIPTION / COST table (Category, Description, Materials, Labor, Total)  
✅ PAYMENT SCHEDULE with all columns (Milestone, %, Amount, Due Date, Status)  
✅ Side-by-side NOTES and TERMS & CONDITIONS sections  

## Usage

```typescript
import { buildProposalHtml } from './lib/proposals/buildProposalHtml';
import { exportProposalPdf } from './lib/proposals/exportPdf';

// Generate HTML for preview
const html = buildProposalHtml(contractDoc);

// Export as PDF and share
await exportProposalPdf(html);
```

## Used By

- `estimate-generator.jsx` - `generateContract()` and `shareContract()` functions
- `PreviewContractModal.tsx` - In-app WebView preview
- All contract/proposal generation throughout the app

## Old System (Deprecated)

The old contract system in `/lib/contracts/` is **NO LONGER USED**:
- ❌ `lib/contracts/generate.ts` (deprecated)
- ❌ `lib/contracts/pdf.ts` (deprecated)

These files are kept for reference only.




