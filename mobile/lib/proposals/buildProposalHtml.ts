/**
 * PROFESSIONAL PROPOSAL SYSTEM - ACTIVE
 * 
 * This is the ONLY proposal/contract generation system used in the app.
 * 
 * Format Features:
 * - Left-aligned company name header with right-aligned meta info
 * - Green summary bar with Total, Duration, Warranty, Retainage
 * - Side-by-side Customer Information and Project Details boxes
 * - Clean DESCRIPTION / COST table (Category, Description, Materials, Labor, Total)
 * - PAYMENT SCHEDULE with all columns (Milestone, %, Amount, Due Date, Status)
 * - Side-by-side NOTES and TERMS & CONDITIONS sections
 * 
 * Used by:
 * - estimate-generator.jsx (generateContract and shareContract functions)
 * - PreviewContractModal.tsx (for in-app preview)
 * - exportProposalPdf (for PDF sharing)
 */

import { ContractDoc } from "../contracts/types";

const money = (n: number | undefined | null) =>
  (Math.round((n ?? 0) * 100) / 100).toLocaleString(undefined, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

const esc = (s: string) =>
  (s || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" } as any)[c]);

type LineItem = {
  category: string;
  description: string;
  materials?: number;
  labor?: number;
};
type ProposalInput = {
  lineItems?: LineItem[];
  notes?: string[];
  terms?: string[];
};

export function buildProposalHtml(doc: ContractDoc, input?: ProposalInput) {
  console.log('🎨 NEW PROPOSAL FORMAT - Building professional bid document');
  const brand = doc.contractor.brandColorHex ?? "#22E0B9";
  const logo = doc.contractor.logoUrl;
  const company = doc.contractor.legalName ?? "AMERICAN HOME RESTORATION";
  const today = new Date().toLocaleDateString();

  // Build detailed line items from materials
  const allMaterialLineItems = doc.scope.materialLineItems || [];
  
  // Filter materials: hide small items (consumables, screws, etc.) from client PDF
  const visibilityThreshold = 75; // Hide materials under $75
  const visibleMaterialLineItems = allMaterialLineItems.filter(item => (item.materials || 0) >= visibilityThreshold);
  const hiddenMaterialLineItems = allMaterialLineItems.filter(item => (item.materials || 0) > 0 && (item.materials || 0) < visibilityThreshold);
  
  const hiddenItemsCount = hiddenMaterialLineItems.length;
  const hiddenItemsTotal = hiddenMaterialLineItems.reduce((sum, item) => sum + (item.materials || 0), 0);
  
  const materialsSubtotal = doc.materials || 0;
  const laborSubtotal = doc.labor || 0;
  const overheadTotal = doc.overhead || 0;
  const permitCostsTotal = doc.permitCosts || 0;
  const subtotalBeforeMarkup = materialsSubtotal + laborSubtotal + overheadTotal + permitCostsTotal;
  const markupAmount = subtotalBeforeMarkup * ((doc.profitMarginPct || 0) / 100);
  const grandTotal = doc.summary.totalBid || Math.round(subtotalBeforeMarkup + markupAmount);
  
  console.log('💰 Contract Totals:', {
    materials: materialsSubtotal,
    labor: laborSubtotal, 
    overhead: overheadTotal,
    permitCosts: permitCostsTotal,
    subtotalBeforeMarkup,
    markupPct: doc.profitMarginPct,
    markupAmount,
    'summary.totalBid': doc.summary.totalBid,
    grandTotal,
    visibleItems: visibleMaterialLineItems.length,
    hiddenItems: hiddenItemsCount,
    hiddenTotal: hiddenItemsTotal
  });

  // Milestones - Format for payment schedule table
  const milestoneRows = (doc.milestones ?? []).map((m, idx) => {
    const pct = m.percentage != null ? `${m.percentage}%` : "";
    const amount = m.paymentAmount ? money(m.paymentAmount) : "";
    const date = m.scheduledDate ? new Date(m.scheduledDate + 'T00:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : "";
    const isEven = idx % 2 === 0;
    return `
      <tr style="border-bottom: 1px solid #f0f0f0; background-color: ${isEven ? '#fafbfc' : 'white'};">
        <td style="padding: 10px 12px; font-size: 10pt; line-height: 1.5;">${esc(m.name)}</td>
        <td style="padding: 10px 12px; font-size: 10pt; line-height: 1.5; text-align: center;">${pct}</td>
        <td style="padding: 10px 12px; font-size: 10pt; line-height: 1.5; text-align: right; font-family: 'Courier New', monospace; font-weight: 600;">${amount}</td>
        <td style="padding: 10px 12px; font-size: 10pt; line-height: 1.5; text-align: center;">${date}</td>
        <td style="padding: 10px 12px; font-size: 10pt; line-height: 1.5; text-align: center;">
          <span style="padding: 4px 8px; border-radius: 4px; font-size: 9pt; font-weight: 600; background-color: #d1fae5; color: #43cea2;">Pending</span>
        </td>
      </tr>`;
  });

  const notes = input?.notes ?? [
    "Owner approves all selections (materials/finishes/colors) before ordering; lead times start after approval.",
    "Work area kept clean; debris removed daily. Reasonable dust control and floor/wall protection included.",
    "Contractor to have clear access to the work area and utilities (power/water/parking) during work hours.",
    "Standard hours Mon–Fri, 8:00a–5:00p unless otherwise agreed.",
    "Special-order or custom items are non-cancellable once ordered.",
    "Photos may be taken for documentation; marketing use only with Owner consent.",
    "Final walkthrough and punch list required before final payment. Items not on the punch list are considered complete.",
    "Sales/use tax on materials is handled by Contractor at purchase; labor is separately stated."
  ];

  const terms = input?.terms ?? [
    `Payment Terms: Payments are due per the milestone schedule. Late balances accrue 1.5% per month (18% APR). Accepted: check, ACH, or wire. Card payments, if allowed, may include a processing fee.`,
    `Schedule & Duration: Estimated duration begins after approvals/deposits. Schedule may adjust for inspections, availability, weather, or approved changes.`,
    `Unforeseen Conditions: Hidden damage, code deficiencies, hazardous materials, or conditions discoverable only after demolition are excluded from the base price and handled via change order.`,
    `Price Volatility: If material costs increase by more than 8% prior to purchase, Contractor may request a price adjustment or propose approved substitutions.`,
    `Permits & Inspections: Contractor will obtain required permits and schedule inspections unless otherwise noted. Permit fees are included/excluded (select one). Owner will sign any permit documents as needed.`,
    `Warranty: 1-year workmanship warranty on labor/installation from substantial completion. Materials carry manufacturer warranties. Warranty is void if work is altered by others or maintenance instructions are not followed.`,
    `Insurance: Contractor maintains general liability and workers' compensation as required by law. Proof available upon request.`,
    `Site Access, Safety & Utilities: Owner provides safe access, parking, and standard utilities. Contractor maintains a safe site and complies with applicable codes/OSHA.`,
    `Hazardous Materials: Testing/abatement of lead, asbestos, mold, or other hazardous substances is excluded unless specifically included; any required work will be handled via change order.`,
    `Allowances: Allowance items reconcile to actual cost at selection/purchase; overages are billed on the next milestone and underruns credited on final payment.`,
    `Retainage & Punch List: If retainage applies, it is released upon completion of the agreed punch list and final inspection/approval.`,
    `Lien Rights: Contractor retains mechanic's lien rights for unpaid balances. Upon final payment, Contractor will provide a lien release.`,
    `Termination: Either party may terminate with 7-day written notice. Owner shall pay for work performed, non-cancellable materials/special orders, and an administrative fee of 10% of the remaining contract balance.`,
    `Delays / Force Majeure: Neither party is liable for delays caused by events beyond reasonable control (acts of God, strikes, pandemics, supply disruptions). Schedule will be reasonably adjusted.`,
    `Taxes: Materials taxes are handled by Contractor at purchase; no separate sales-tax line applies to labor when separately stated for real-property improvements (toggle if your job is retail-only).`,
    `Dispute Resolution; Law: Governed by the laws of the project location. Disputes go to good-faith mediation; if unresolved within 30 days, to binding arbitration in the project's county.`
  ];

  const timestamp = Date.now();
  console.log(`🎨 Generating NEW PROPOSAL HTML with timestamp: ${timestamp}`);
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
  <meta http-equiv="Pragma" content="no-cache">
  <meta http-equiv="Expires" content="0">
  <meta name="generator" content="NEW_PROPOSAL_SYSTEM_v${timestamp}">
  <title>${esc(doc.summary.projectName)} – Proposal v${timestamp}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', 'Roboto', 'Helvetica Neue', Helvetica, Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #2c3e50;
      background: white;
      padding: 30px 50px;
      max-width: 8.5in;
      margin: 0 auto;
    }
    /* ULTRA-AGGRESSIVE page break controls for professional spacing */
    .page-break-before { page-break-before: always; }
    .page-break-after { page-break-after: always; }
    .page-break-avoid { page-break-inside: avoid !important; }
    .keep-together { page-break-inside: avoid !important; }
    .section-container { page-break-inside: avoid !important; margin-bottom: 25px; }
    .signature-section { page-break-inside: avoid !important; page-break-before: always !important; }
    .totals-section { page-break-inside: avoid !important; }
    .contract-metadata { page-break-inside: avoid !important; }
    
    /* Prevent ALL text elements from breaking awkwardly */
    h1, h2, h3, h4, h5, h6 { page-break-after: avoid !important; page-break-inside: avoid !important; }
    p { page-break-inside: avoid !important; orphans: 3; widows: 3; margin-bottom: 8px; }
    li { page-break-inside: avoid !important; }
    ul, ol { page-break-inside: avoid !important; }
    div { orphans: 3; widows: 3; }
    
    /* Keep ALL content blocks together */
    .info-boxes { page-break-inside: avoid !important; }
    .bid-table { page-break-inside: avoid !important; }
    .payment-table { page-break-inside: avoid !important; }
    .notes-terms-container { page-break-inside: avoid !important; }
    
    /* Consistent professional spacing for all sections */
    .section-title { margin-top: 25px; margin-bottom: 15px; }
    .section-spacing { margin-top: 25px; margin-bottom: 15px; }
    
    /* Keep table rows together - NO broken rows */
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid !important; page-break-after: avoid !important; }
    thead { display: table-header-group; page-break-after: avoid !important; }
    tbody { display: table-row-group; }
    
    /* Add buffer space around page breaks */
    @media print {
      body { padding: 30px 40px; }
      .page-break-avoid { margin-top: 15px; margin-bottom: 15px; }
      h2 { margin-top: 25px; margin-bottom: 15px; }
    }
    .header {
      background: white;
      color: #2c3e50;
      padding: 20px 50px;
      margin: 0;
      position: relative;
      z-index: 1;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      border-bottom: 1px solid #e0e0e0;
      page-break-inside: avoid !important;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 20px;
    }
    .header-center {
      flex: 1;
      text-align: center;
      margin: 0 20px;
      padding: 0 15px;
    }
    .logo-container {
      width: 75px;
      height: 75px;
      background: white;
      border-radius: 10px;
      padding: 10px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.15);
    }
    .logo-container img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .company-info {
      flex: 1;
    }
    .company-name {
      font-size: 18pt;
      font-weight: 600;
      color: #1B365D;
      margin-bottom: 4px;
      text-shadow: 0 1px 2px rgba(0,0,0,0.1);
      letter-spacing: -0.3px;
    }
    .proposal-title {
      font-size: 10pt;
      font-weight: 400;
      color: #43cea2;
      letter-spacing: 1.2px;
      text-transform: uppercase;
      margin: 0;
    }
    .header-right {
      text-align: right;
    }
    .header-meta {
      font-size: 9pt;
      color: #6b7280;
      margin-bottom: 4px;
      font-weight: 400;
      display: flex;
      align-items: center;
      gap: 6px;
      justify-content: flex-end;
    }
    .contract-id {
      background: #f3f4f6;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 9pt;
      font-weight: 500;
      margin-top: 6px;
      color: #1B365D;
      display: inline-block;
    }
    .info-boxes {
      display: flex;
      gap: 25px;
      margin: 30px 0 35px 0;
      padding: 12px 0;
    }
    .info-box {
      flex: 1;
      border: 2px solid #e0e0e0;
      padding: 22px 24px;
      background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    .info-box h3 {
      font-size: 12pt;
      font-weight: 700;
      margin-bottom: 16px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #1B365D;
      border-bottom: 2px solid #1B365D;
      padding-bottom: 10px;
    }
    .info-row {
      display: flex;
      margin-bottom: 12px;
      font-size: 10pt;
      padding: 6px 0;
      border-bottom: 1px solid #f0f0f0;
      line-height: 1.5;
    }
    .info-label {
      font-weight: 700;
      min-width: 90px;
      color: #555;
    }
    .info-value {
      color: #2c3e50;
      font-weight: 500;
    }
    .section-title {
      font-size: 12pt;
      font-weight: 700;
      margin: 32px 0 16px 0;
      text-transform: uppercase;
      color: #1B365D;
      border-bottom: 3px solid #1B365D;
      padding-bottom: 10px;
      letter-spacing: 1px;
    }
    .bid-table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0 25px 0;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      border-radius: 8px;
      overflow: hidden;
    }
    .bid-table th {
      background: linear-gradient(135deg, #1B365D 0%, #1B365D 100%);
      color: white;
      border: none;
      padding: 14px 12px;
      font-weight: 700;
      text-align: left;
      font-size: 10pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      line-height: 1.4;
    }
    .bid-table td {
      border: 1px solid #e8e8e8;
      padding: 10px 12px;
      font-size: 10pt;
      background: white;
      line-height: 1.5;
    }
    .bid-table tbody tr:hover {
      background-color: #f8f9fa;
    }
    .bid-table td.num {
      text-align: right;
      font-family: 'Courier New', monospace;
      font-weight: 600;
    }
    .subtotal-row {
      background: linear-gradient(135deg, #f5f7fa 0%, #e8eaf6 100%) !important;
      font-weight: 700;
    }
    .total-row {
      background: linear-gradient(135deg, #43cea2 0%, #43cea2 100%) !important;
      font-weight: 700;
      border-top: 3px solid #43cea2;
    }
    .total-row td {
      font-size: 12pt;
      color: #43cea2;
    }
    .payment-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
      margin-bottom: 25px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      border-radius: 8px;
      overflow: hidden;
    }
    .payment-table th {
      background: linear-gradient(135deg, #1B365D 0%, #1B365D 100%);
      color: white;
      border: none;
      padding: 14px 12px;
      font-weight: 700;
      font-size: 10pt;
      text-align: left;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      line-height: 1.4;
    }
    .payment-table td {
      border: 1px solid #e8e8e8;
      padding: 12px;
      font-size: 10pt;
      background: white;
      line-height: 1.5;
    }
    .payment-table tbody tr:hover {
      background-color: #f8f9fa;
    }
    .payment-table td.num {
      text-align: right;
      font-family: 'Courier New', monospace;
      font-weight: 600;
    }
    .payment-total-row {
      background: linear-gradient(135deg, #43cea2 0%, #43cea2 100%) !important;
      font-weight: 700;
    }
    .notes-terms-container {
      display: flex;
      gap: 25px;
      margin-top: 35px;
    }
    .notes-section {
      flex: 1;
    }
    .notes-section h3 {
      font-size: 12pt;
      font-weight: 700;
      margin-bottom: 14px;
      text-transform: uppercase;
      color: #1B365D;
      border-bottom: 2px solid #1B365D;
      padding-bottom: 8px;
    }
    .notes-list {
      margin-left: 20px;
      font-size: 9pt;
      line-height: 1.7;
    }
    .notes-list li {
      margin-bottom: 10px;
      padding-left: 6px;
    }
    .terms-section {
      flex: 1;
    }
    .terms-section h3 {
      font-size: 12pt;
      font-weight: 700;
      margin-bottom: 14px;
      text-transform: uppercase;
      color: #1B365D;
      border-bottom: 2px solid #1B365D;
      padding-bottom: 8px;
    }
    .terms-list {
      counter-reset: terms-counter;
      font-size: 9pt;
      line-height: 1.7;
    }
    .terms-list > li {
      counter-increment: terms-counter;
      margin-bottom: 10px;
      padding-left: 6px;
    }
    .terms-list > li::marker {
      font-weight: bold;
    }
    .signature-section {
      margin-top: 40px;
      border: 2px solid #e0e0e0;
      padding: 20px 25px;
      border-radius: 8px;
      background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
      page-break-inside: avoid;
    }
    .signature-section h3 {
      font-size: 13pt;
      font-weight: 700;
      margin-bottom: 18px;
      color: #1B365D;
      border-bottom: 2px solid #1B365D;
      padding-bottom: 10px;
      background: transparent;
      border-left: none;
      border-right: none;
      border-top: none;
    }
    .signature-line {
      margin: 25px 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 30px;
    }
    .signature-box {
      border-bottom: 2px solid #2c3e50;
      width: 220px;
      height: 50px;
      margin-left: 20px;
    }
    .date-box {
      border-bottom: 2px solid #2c3e50;
      width: 120px;
      height: 50px;
      margin-left: 20px;
    }
    .num { text-align: right; }
    @media print {
      body { padding: 10px; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      ${logo ? `<div class="logo-container"><img src="${esc(logo)}" alt="Company Logo" /></div>` : ''}
    </div>
    <div class="header-center">
      <div class="company-name">${esc(company)}</div>
      <div class="proposal-title">CONSTRUCTION PROPOSAL</div>
    </div>
    <div class="header-right">
      <div class="header-meta">📅 Date: ${today}</div>
      <div class="header-meta">📄 Project: ${esc(doc.summary.projectName)}</div>
      <div class="contract-id">ID: ${esc(doc.summary.contractId)}</div>
    </div>
  </div>

  <div class="info-boxes">
    <div class="info-box">
      <h3>Customer Information</h3>
      <div class="info-row">
        <div class="info-label">Name:</div>
        <div class="info-value">${esc(doc.owner.legalName || 'N/A')}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Phone:</div>
        <div class="info-value">${esc(doc.owner.phone || 'N/A')}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Email:</div>
        <div class="info-value">${esc(doc.owner.email || 'N/A')}</div>
      </div>
    </div>
    
    <div class="info-box">
      <h3>Project Details</h3>
      <div class="info-row">
        <div class="info-label">Project:</div>
        <div class="info-value">${esc(doc.summary.projectName)}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Address:</div>
        <div class="info-value">${esc(doc.summary.siteAddress || 'N/A')}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Start Date:</div>
        <div class="info-value">${doc.summary.estimatedStartDate ? new Date(doc.summary.estimatedStartDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : 'TBD'}</div>
      </div>
      <div class="info-row">
        <div class="info-label">End Date:</div>
        <div class="info-value">${doc.summary.estimatedEndDate ? new Date(doc.summary.estimatedEndDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : 'TBD'}</div>
      </div>
    </div>
  </div>

  <h2 style="font-size: 12pt; font-weight: 700; margin: 25px 0 15px 0; text-transform: uppercase; color: #1B365D; border-bottom: 3px solid #1B365D; padding-bottom: 10px; letter-spacing: 1px;">DESCRIPTION / COST</h2>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
    <thead>
      <tr style="background-color: #f7f9fa;">
        <th style="padding: 8px; text-align: left; font-weight: 700; font-size: 10pt; border-bottom: 2px solid #1B365D; width: 35%;">Description</th>
        <th style="padding: 8px; text-align: center; font-weight: 700; font-size: 10pt; border-bottom: 2px solid #1B365D; width: 8%;">Qty</th>
        <th style="padding: 8px; text-align: center; font-weight: 700; font-size: 10pt; border-bottom: 2px solid #1B365D; width: 8%;">Unit</th>
        <th style="padding: 8px; text-align: right; font-weight: 700; font-size: 10pt; border-bottom: 2px solid #1B365D; width: 14%;">Unit Price</th>
        <th style="padding: 8px; text-align: right; font-weight: 700; font-size: 10pt; border-bottom: 2px solid #1B365D; width: 14%;">Materials</th>
        <th style="padding: 8px; text-align: right; font-weight: 700; font-size: 10pt; border-bottom: 2px solid #1B365D; width: 14%;">Labor</th>
        <th style="padding: 8px; text-align: right; font-weight: 700; font-size: 10pt; border-bottom: 2px solid #1B365D; width: 14%;">Ext. Price</th>
      </tr>
    </thead>
    <tbody>
      ${visibleMaterialLineItems.length > 0 ? (() => {
        // Group VISIBLE materials by scope/section (hidden items excluded from display)
        const grouped: Record<string, typeof visibleMaterialLineItems> = {};
        visibleMaterialLineItems.forEach(item => {
          const section = item.section || 'General Materials';
          if (!grouped[section]) grouped[section] = [];
          grouped[section].push(item);
        });
        
        return Object.keys(grouped).sort().map(section => {
          const items = grouped[section];
          // Include BOTH visible and hidden items in section total
          const allItemsInSection = allMaterialLineItems.filter(item => (item.section || 'General Materials') === section);
          const sectionTotal = allItemsInSection.reduce((sum, it) => sum + (it.materials || 0), 0);
          
          return `
            <tr style="background-color: #f0f4f8; border-top: 2px solid #1B365D;">
              <td colspan="7" style="padding: 10px 8px; font-weight: 700; color: #1B365D; font-size: 10pt; text-transform: uppercase; letter-spacing: 0.5px;">MATERIALS — ${esc(section)}</td>
            </tr>
       ${items.map((item, idx) => {
         const qty = item.quantity || 1;
         const unit = item.unit || 'ea';
         const materialsCost = item.materials || 0;
         const unitPrice = qty > 0 ? materialsCost / qty : materialsCost;
         const isEven = idx % 2 === 0;
         
         return `
       <tr style="border-bottom: 1px solid #f0f0f0; background-color: ${isEven ? '#fafbfc' : 'white'};">
         <td style="padding: 8px; font-size: 9pt;">${esc(item.description || 'Material')}</td>
         <td style="padding: 8px; text-align: center; font-size: 9pt; color: #666;">${qty}</td>
         <td style="padding: 8px; text-align: center; font-size: 9pt; color: #666;">${esc(unit)}</td>
         <td style="padding: 8px; text-align: right; font-size: 9pt; font-family: 'Courier New', monospace; color: #666;">${money(unitPrice)}</td>
         <td style="padding: 8px; text-align: right; font-size: 9pt; font-family: 'Courier New', monospace; font-weight: 600;">${money(materialsCost)}</td>
         <td style="padding: 8px; text-align: right; font-size: 9pt; font-family: 'Courier New', monospace;">—</td>
         <td style="padding: 8px; text-align: right; font-size: 9pt; font-family: 'Courier New', monospace; font-weight: 600;">${money(materialsCost)}</td>
       </tr>
         `;
       }).join('')}
            <tr style="background-color: #fafbff; border-top: 1px solid #e0e0e0;">
              <td colspan="6" style="padding: 8px; text-align: right; font-weight: 700; font-size: 9pt; color: #1B365D;">Section Subtotal</td>
              <td style="padding: 8px; text-align: right; font-weight: 700; font-size: 9pt; font-family: 'Courier New', monospace; color: #1B365D;">${money(sectionTotal)}</td>
            </tr>
            <tr style="height: 8px; background-color: transparent;"><td colspan="7" style="padding: 0; border: none;"></td></tr>
          `;
        }).join('');
      })() : `
      <tr style="background-color: #f0f4f8; border-top: 2px solid #1B365D;">
        <td colspan="7" style="padding: 10px 8px; font-weight: 700; color: #1B365D; font-size: 10pt;">MATERIALS</td>
      </tr>
      <tr>
        <td style="padding: 8px; font-size: 9pt;">Project materials per scope</td>
        <td style="padding: 8px; text-align: center; font-size: 9pt;">—</td>
        <td style="padding: 8px; text-align: center; font-size: 9pt;">—</td>
        <td style="padding: 8px; text-align: right; font-size: 9pt;">—</td>
        <td style="padding: 8px; text-align: right; font-size: 9pt; font-family: 'Courier New', monospace; font-weight: 600;">${money(materialsSubtotal)}</td>
        <td style="padding: 8px; text-align: right; font-size: 9pt;">—</td>
        <td style="padding: 8px; text-align: right; font-size: 9pt; font-family: 'Courier New', monospace; font-weight: 600;">${money(materialsSubtotal)}</td>
      </tr>
      <tr style="height: 8px; background-color: transparent;"><td colspan="7" style="padding: 0; border: none;"></td></tr>
      `}
      
      ${doc.scope.laborLineItems && doc.scope.laborLineItems.length > 0 ? (() => {
        // Group labor by trade/category if available
        const laborGrouped: Record<string, typeof doc.scope.laborLineItems> = {};
        doc.scope.laborLineItems.forEach(item => {
          const trade = item.category || 'General Labor';
          if (!laborGrouped[trade]) laborGrouped[trade] = [];
          laborGrouped[trade].push(item);
        });
        
        return Object.keys(laborGrouped).sort().map(trade => {
          const items = laborGrouped[trade];
          const tradeTotal = items.reduce((sum, it) => sum + (it.labor || 0), 0);
          
          return `
      <tr style="background-color: #d1fae5; border-top: 2px solid #43cea2;">
        <td colspan="7" style="padding: 10px 8px; font-weight: 700; color: #1B365D; font-size: 10pt; text-transform: uppercase; letter-spacing: 0.5px;">LABOR — ${esc(trade)}</td>
      </tr>
       ${items.map((item, idx) => {
         const taskName = item.description || 'Labor & Installation';
         const laborCost = item.labor || 0;
         const isEven = idx % 2 === 0;
         
         return `
       <tr style="border-bottom: 1px solid #f0f0f0; background-color: ${isEven ? '#fafbfc' : 'white'};">
         <td style="padding: 8px; font-size: 9pt;">${esc(taskName)}</td>
         <td style="padding: 8px; text-align: center; font-size: 9pt; color: #666;">—</td>
         <td style="padding: 8px; text-align: center; font-size: 9pt; color: #666;">—</td>
         <td style="padding: 8px; text-align: right; font-size: 9pt;">—</td>
         <td style="padding: 8px; text-align: right; font-size: 9pt;">—</td>
         <td style="padding: 8px; text-align: right; font-size: 9pt; font-family: 'Courier New', monospace; font-weight: 600;">${money(laborCost)}</td>
         <td style="padding: 8px; text-align: right; font-size: 9pt; font-family: 'Courier New', monospace; font-weight: 600;">${money(laborCost)}</td>
       </tr>
         `;
       }).join('')}
      ${trade !== 'General Labor' ? `
      <tr style="background-color: #fafafa;">
        <td colspan="7" style="padding: 6px 8px; font-size: 8pt; color: #666; font-style: italic; border-top: 1px solid #f0f0f0;">
          Assumptions: Standard crew size, excludes permits/inspections unless stated. Site access and utilities provided by owner.
        </td>
      </tr>
      ` : ''}
      <tr style="background-color: #fff8e1; border-top: 1px solid #e0e0e0;">
        <td colspan="6" style="padding: 8px; text-align: right; font-weight: 700; font-size: 9pt; color: #1B365D;">Trade Subtotal</td>
        <td style="padding: 8px; text-align: right; font-weight: 700; font-size: 9pt; font-family: 'Courier New', monospace; color: #1B365D;">${money(tradeTotal)}</td>
      </tr>
      <tr style="height: 8px; background-color: transparent;"><td colspan="7" style="padding: 0; border: none;"></td></tr>
          `;
        }).join('');
      })() : `
      <tr style="background-color: #d1fae5; border-top: 2px solid #43cea2;">
        <td colspan="7" style="padding: 10px 8px; font-weight: 700; color: #1B365D; font-size: 10pt;">LABOR</td>
      </tr>
      <tr>
        <td style="padding: 8px; font-size: 9pt;">Labor per scope</td>
        <td style="padding: 8px; text-align: center; font-size: 9pt;">—</td>
        <td style="padding: 8px; text-align: center; font-size: 9pt;">—</td>
        <td style="padding: 8px; text-align: right; font-size: 9pt;">—</td>
        <td style="padding: 8px; text-align: right; font-size: 9pt;">—</td>
        <td style="padding: 8px; text-align: right; font-size: 9pt; font-family: 'Courier New', monospace; font-weight: 600;">${money(laborSubtotal)}</td>
        <td style="padding: 8px; text-align: right; font-size: 9pt; font-family: 'Courier New', monospace; font-weight: 600;">${money(laborSubtotal)}</td>
      </tr>
      <tr style="height: 8px; background-color: transparent;"><td colspan="7" style="padding: 0; border: none;"></td></tr>
      `}
    </tbody>
  </table>

  <!-- Cost Summary with Enhanced Presentation -->
  <div class="totals-section page-break-avoid" style="max-width: 350px; margin: 10px 0 8px auto; border: 1px solid #e0e0e0; border-radius: 4px; padding: 12px; background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%); box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
    
    <!-- Materials -->
    <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #e8e8e8;">
      <div style="font-size: 8pt; font-weight: 700; color: #1B365D;">Materials</div>
      <div style="font-size: 8pt; font-weight: 700; font-family: 'Courier New', monospace; color: #1B365D;">${money(materialsSubtotal)}</div>
    </div>
    
    <!-- Labor -->
    <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #e8e8e8;">
      <div style="font-size: 8pt; font-weight: 700; color: #1B365D;">Labor</div>
      <div style="font-size: 8pt; font-weight: 700; font-family: 'Courier New', monospace; color: #1B365D;">${money(laborSubtotal)}</div>
    </div>
    
    <!-- Subtotal -->
    <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 2px solid #1B365D; margin-bottom: 4px;">
      <div style="font-size: 8pt; font-weight: 700; color: #43cea2;">Subtotal</div>
      <div style="font-size: 8pt; font-weight: 700; font-family: 'Courier New', monospace; color: #43cea2;">${money(materialsSubtotal + laborSubtotal)}</div>
    </div>
    
    <!-- Included Items (Info Only) -->
    <div style="padding: 3px 0; border-bottom: 1px solid #f0f0f0;">
      <div style="font-size: 7pt; font-weight: 600; color: #6b7280;">
        Project Management & General Conditions: <span style="font-weight: 700; color: #43cea2;">Included</span>
        <span style="font-size: 5pt; color: #888; font-style: italic;"> (internally allocated)</span>
      </div>
    </div>
    
    ${hiddenItemsCount > 0 ? `
    <div style="padding: 3px 0; border-bottom: 1px solid #f0f0f0;">
      <div style="font-size: 7pt; font-weight: 600; color: #6b7280;">
        Consumables & Incidentals: <span style="font-weight: 700; color: #43cea2;">Included</span>
        <span style="font-size: 5pt; color: #888; font-style: italic;"> (internally allocated)</span>
      </div>
      <div style="font-size: 5pt; color: #6b7280; margin-top: 2px; line-height: 1.1; padding-left: 4px;">
        ${hiddenItemsCount} minor item${hiddenItemsCount > 1 ? 's' : ''} (fasteners, adhesives, caulk, tape, etc.) totaling ${money(hiddenItemsTotal)} included in Materials total.
      </div>
    </div>
    ` : ''}
    
    
    <!-- Thick Divider Before Total -->
    <div style="height: 2px; background: #43cea2; margin: 3px 0;"></div>
    
    <!-- TOTAL in Shaded Box -->
    <div style="background: linear-gradient(135deg, #43cea2 0%, #43cea2 100%); border-left: 3px solid #43cea2; padding: 6px 8px; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.12);">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div style="font-size: 10pt; font-weight: 700; color: #43cea2; letter-spacing: 0.3px;">CONTRACT TOTAL</div>
        <div style="font-size: 12pt; font-weight: 700; font-family: 'Courier New', monospace; color: #43cea2;">${money(grandTotal)}</div>
      </div>
    </div>
    
    <!-- Contract Metadata Footer -->
    <div class="contract-metadata" style="margin-top: 4px; padding-top: 3px; border-top: 1px solid #e8e8e8; text-align: center;">
      <div style="font-size: 5pt; color: #6b7280; line-height: 1.2;">
        Contract ID: <span style="font-weight: 600; color: #1B365D;">${esc(doc.summary.contractId)}</span> • 
        Version: <span style="font-weight: 600;">1.0</span> • 
        Generated: <span style="font-weight: 600;">${today}</span>
      </div>
      <div style="font-size: 4pt; color: #9ca3af; margin-top: 1px;">
        Valid for 30 days from generation date
      </div>
    </div>
    
  </div>

  <div class="section-container page-break-avoid section-spacing">
    <h2 style="font-size: 12pt; font-weight: 700; margin: 25px 0 15px 0; text-transform: uppercase; color: #1B365D; border-bottom: 3px solid #1B365D; padding-bottom: 10px; letter-spacing: 1px;">PAYMENT SCHEDULE</h2>

  <table class="bid-table" style="width: 100%; border-collapse: collapse; margin-bottom: 25px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-radius: 8px; overflow: hidden;">
    <thead>
      <tr style="background: linear-gradient(135deg, #1B365D 0%, #43cea2 100%); color: white; border: none;">
        <th style="padding: 14px 12px; font-weight: 700; text-align: left; font-size: 10pt; text-transform: uppercase; letter-spacing: 0.5px; line-height: 1.4;">Milestone</th>
        <th style="padding: 14px 12px; font-weight: 700; text-align: center; font-size: 10pt; text-transform: uppercase; letter-spacing: 0.5px; line-height: 1.4;">Percentage</th>
        <th style="padding: 14px 12px; font-weight: 700; text-align: right; font-size: 10pt; text-transform: uppercase; letter-spacing: 0.5px; line-height: 1.4;">Amount</th>
        <th style="padding: 14px 12px; font-weight: 700; text-align: center; font-size: 10pt; text-transform: uppercase; letter-spacing: 0.5px; line-height: 1.4;">Due Date</th>
        <th style="padding: 14px 12px; font-weight: 700; text-align: center; font-size: 10pt; text-transform: uppercase; letter-spacing: 0.5px; line-height: 1.4;">Status</th>
      </tr>
    </thead>
    <tbody>
      ${milestoneRows.join('') || '<tr><td colspan="5" style="padding: 10px 12px; font-size: 10pt; background: white; line-height: 1.5; text-align: center; color: #666;">No payment milestones defined</td></tr>'}
      <tr style="background: #ffffff; border-top: 2px solid #43cea2;">
        <td style="padding: 12px; font-size: 11pt; font-weight: 700; color: #43cea2; border: none;">TOTAL CONTRACT</td>
        <td style="padding: 12px; font-size: 11pt; font-weight: 700; color: #43cea2; text-align: center; border: none;">100%</td>
        <td style="padding: 12px; font-size: 12pt; font-weight: 700; color: #43cea2; text-align: right; font-family: 'Courier New', monospace; border: none;">${money(grandTotal)}</td>
        <td style="padding: 12px; border: none;"></td>
        <td style="padding: 12px; border: none;"></td>
      </tr>
    </tbody>
  </table>
  </div>

  ${doc.scope?.description ? `
  <div class="section-container section-spacing" style="margin-top: 25px;">
    <h2 style="font-size: 12pt; font-weight: 700; margin: 25px 0 15px 0; text-transform: uppercase; color: #1B365D; border-bottom: 3px solid #1B365D; padding-bottom: 10px; letter-spacing: 1px;">SCOPE OF WORK</h2>
    <div style="background-color: #fafafa; border: 1px solid #ddd; padding: 15px; font-size: 10pt; line-height: 1.6;">
      ${esc(doc.scope.description).split('\n').map(para => `<p style="margin-bottom: 10px;">${para}</p>`).join('')}
    </div>
  </div>
  ` : ''}

  <div class="section-container page-break-avoid section-spacing" style="display: flex; gap: 30px; margin-top: 25px; padding: 15px 0;">
    <div style="flex: 1; page-break-inside: avoid;">
      <h2 style="font-size: 12pt; font-weight: bold; margin: 25px 0 15px 0; border-bottom: 2px solid #43cea2; padding-bottom: 8px; page-break-after: avoid;">NOTES</h2>
      <ul style="margin-left: 20px; font-size: 10pt; line-height: 1.8; page-break-inside: avoid;">
        ${notes.map(n => `<li style="margin-bottom: 6px; page-break-inside: avoid;">${esc(n)}</li>`).join('')}
      </ul>
    </div>

    <div style="flex: 1; page-break-inside: avoid;">
      <h2 style="font-size: 12pt; font-weight: bold; margin: 25px 0 15px 0; border-bottom: 2px solid #43cea2; padding-bottom: 8px; page-break-after: avoid;">TERMS & CONDITIONS</h2>
      <ol style="margin-left: 20px; font-size: 9pt; line-height: 1.7; page-break-inside: avoid;">
        ${terms.map(t => `<li style="margin-bottom: 8px; page-break-inside: avoid;">${esc(t)}</li>`).join('')}
      </ol>
    </div>
  </div>



  <!-- Signature Section -->
  <div class="signature-section page-break-before page-break-avoid section-spacing" style="margin-top: 25px;">
    <h2 style="font-size: 16pt; font-weight: bold; margin: 25px 0 15px 0; text-align: center; background-color: #43cea2; color: white; padding: 10px;">AGREEMENT & SIGNATURES</h2>
    
    <div class="keep-together" style="background-color: #f0f9ff; border: 2px solid #2196F3; padding: 15px; margin-bottom: 20px;">
      <p style="font-size: 10pt; line-height: 1.6; margin-bottom: 10px;">
        <strong>ACCEPTANCE:</strong> By signing below, both parties agree to the terms, conditions, scope of work, and payment schedule outlined in this proposal. 
        This proposal becomes a binding contract upon acceptance by both parties.
      </p>
      <p style="font-size: 10pt; line-height: 1.6; margin-bottom: 10px;">
        <strong>VALIDITY:</strong> This proposal is valid for 30 days from the date above. Prices subject to change after expiration.
      </p>
      <p style="font-size: 10pt; line-height: 1.6;">
        <strong>CHANGE ORDERS:</strong> Any modifications to scope, materials, or specifications will be documented as change orders. 
        Change orders are billed 100% at approval or added to the next milestone payment, whichever comes first.
      </p>
    </div>

    <div class="keep-together" style="display: flex; gap: 30px; margin-top: 30px;">
      <div style="flex: 1; border: 2px solid #000; padding: 20px; background-color: #fafafa;">
        <h3 style="font-size: 12pt; font-weight: bold; margin-bottom: 15px; border-bottom: 1px solid #000; padding-bottom: 5px;">CONTRACTOR</h3>
        ${doc.contractor.contactName ? `
        <div style="margin-bottom: 10px;">
          <strong style="font-size: 10pt;">Name:</strong> 
          <span style="font-size: 10pt;">${esc(doc.contractor.contactName)}</span>
        </div>
        ` : ''}
        <div style="margin-bottom: 10px;">
          <strong style="font-size: 10pt;">Company:</strong> 
          <span style="font-size: 10pt;">${esc(company)}</span>
        </div>
        ${doc.contractor.licenseNumber ? `
        <div style="margin-bottom: 10px;">
          <strong style="font-size: 10pt;">License #:</strong> 
          <span style="font-size: 10pt;">${esc(doc.contractor.licenseNumber)}</span>
        </div>
        ` : ''}
        <div style="margin-top: 25px;">
          <div style="border-bottom: 2px solid #000; width: 100%; height: 50px; margin-bottom: 5px;"></div>
          <div style="font-size: 9pt; color: #666;">Authorized Signature</div>
        </div>
        <div style="margin-top: 20px;">
          <div style="border-bottom: 1px solid #000; width: 200px; height: 30px; margin-bottom: 5px;"></div>
          <div style="font-size: 9pt; color: #666;">Print Name</div>
        </div>
        <div style="margin-top: 20px;">
          <div style="border-bottom: 1px solid #000; width: 150px; height: 30px; margin-bottom: 5px;"></div>
          <div style="font-size: 9pt; color: #666;">Date</div>
        </div>
      </div>

      <div style="flex: 1; border: 2px solid #000; padding: 20px; background-color: #fafafa;">
        <h3 style="font-size: 12pt; font-weight: bold; margin-bottom: 15px; border-bottom: 1px solid #000; padding-bottom: 5px;">PROPERTY OWNER</h3>
        <div style="margin-bottom: 10px;">
          <strong style="font-size: 10pt;">Name:</strong> 
          <span style="font-size: 10pt;">${esc(doc.owner.legalName || 'N/A')}</span>
        </div>
        <div style="margin-bottom: 10px;">
          <strong style="font-size: 10pt;">Property:</strong> 
          <span style="font-size: 10pt;">${esc(doc.summary.siteAddress || 'N/A')}</span>
        </div>
        <div style="margin-top: 25px;">
          <div style="border-bottom: 2px solid #000; width: 100%; height: 50px; margin-bottom: 5px;"></div>
          <div style="font-size: 9pt; color: #666;">Property Owner Signature</div>
        </div>
        <div style="margin-top: 20px;">
          <div style="border-bottom: 1px solid #000; width: 200px; height: 30px; margin-bottom: 5px;"></div>
          <div style="font-size: 9pt; color: #666;">Print Name</div>
        </div>
        <div style="margin-top: 20px;">
          <div style="border-bottom: 1px solid #000; width: 150px; height: 30px; margin-bottom: 5px;"></div>
          <div style="font-size: 9pt; color: #666;">Date</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Professional Footer -->
  <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #e0e0e0; text-align: center; background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%); border-radius: 8px; padding: 20px;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
      <div style="text-align: left;">
        <div style="font-size: 10pt; font-weight: 700; color: #2c3e50; margin-bottom: 4px;">
          ${esc(doc.contractor.companyName || doc.contractor.contactName || 'Contractor')}
        </div>
        <div style="font-size: 9pt; color: #666;">
          License #: ${doc.contractor.licenseNumber || 'XXXXXXX'} • Insured & Bonded
        </div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 9pt; color: #666; margin-bottom: 2px;">
          ${doc.contractor.phone || '(XXX) XXX-XXXX'}
        </div>
        <div style="font-size: 9pt; color: #666;">
          ${doc.contractor.email || 'info@contractor.com'}
        </div>
      </div>
    </div>
    <div style="border-top: 1px solid #e0e0e0; padding-top: 12px; margin-top: 12px;">
      <div style="font-size: 8pt; color: #888; line-height: 1.4;">
        Generated by Build Profit Solutions on ${today} • Contract ID: ${esc(doc.summary.contractId)} • Version: ${timestamp}
      </div>
    </div>
  </div>
</body>
</html>
`;
}
 