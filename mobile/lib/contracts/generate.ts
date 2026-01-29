/**
 * ⚠️ DEPRECATED - OLD CONTRACT SYSTEM
 * 
 * This file is NO LONGER USED.
 * 
 * Use the NEW PROPOSAL SYSTEM instead:
 * - mobile/lib/proposals/buildProposalHtml.ts
 * - mobile/lib/proposals/exportPdf.ts
 * 
 * The new system has:
 * - Professional format matching your bid template
 * - Better styling with green summary bar
 * - Side-by-side layout for info boxes
 * - Clean tables with proper formatting
 * 
 * This old file is kept for reference only.
 */

import { ContractDoc } from './types';

/**
 * Builds a plain text version of the contract
 */
export function buildContractText(doc: ContractDoc): string {
  const {
    summary,
    contractor,
    owner,
    scope,
    allowances = [],
    milestones,
    terms,
    labor,
    materials,
    profitMarginPct,
  } = doc;

  let text = `═══════════════════════════════════════
   CONSTRUCTION CONTRACT
═══════════════════════════════════════

Contract ID: ${summary.contractId}
Version: ${summary.version || 'Final'}
Date: ${new Date().toLocaleDateString()}

═══════════════════════════════════════
   PROJECT SUMMARY
═══════════════════════════════════════

Project: ${summary.projectName}
Location: ${summary.siteAddress}
${summary.unitPrice ? `Unit Price: $${summary.unitPrice.toLocaleString()}/SF` : ''}
Total Contract Amount: $${summary.totalBid.toLocaleString()}
Duration: ${summary.durationDays} days
Start Date: ${summary.startDate}
${summary.expiresDate ? `Expires: ${summary.expiresDate}` : ''}
${summary.retainagePct ? `Retainage: ${summary.retainagePct}%` : ''}

═══════════════════════════════════════
   CONTRACTOR
═══════════════════════════════════════

${contractor.legalName || 'N/A'}
${contractor.licenseNo ? `License: ${contractor.licenseNo}` : ''}
${contractor.phone ? `Phone: ${contractor.phone}` : ''}
${contractor.email ? `Email: ${contractor.email}` : ''}

Insurance:
${contractor.insurer ? `- Insurer: ${contractor.insurer}` : ''}
${contractor.glLimit ? `- GL Limit: ${contractor.glLimit}` : ''}
${contractor.wcActive ? '- Workers\' Comp: Active' : ''}

═══════════════════════════════════════
   OWNER
═══════════════════════════════════════

${owner.legalName || 'N/A'}
${owner.address || ''}
${owner.phone ? `Phone: ${owner.phone}` : ''}
${owner.email ? `Email: ${owner.email}` : ''}

═══════════════════════════════════════
   SCOPE OF WORK
═══════════════════════════════════════

${scope.bullets.map((b, i) => `${i + 1}. ${b}`).join('\n')}

${scope.inclusions && scope.inclusions.length > 0 ? `
INCLUSIONS:
${scope.inclusions.map(i => `✓ ${i}`).join('\n')}
` : ''}

${scope.exclusions && scope.exclusions.length > 0 ? `
EXCLUSIONS:
${scope.exclusions.map(e => `✗ ${e}`).join('\n')}
` : ''}

${scope.ownerResponsibilities && scope.ownerResponsibilities.length > 0 ? `
OWNER RESPONSIBILITIES:
${scope.ownerResponsibilities.map(o => `• ${o}`).join('\n')}
` : ''}

${allowances.length > 0 ? `
═══════════════════════════════════════
   ALLOWANCES
═══════════════════════════════════════

${allowances.map(a => `${a.name}: $${a.amount.toLocaleString()}${a.description ? ` - ${a.description}` : ''}`).join('\n')}
` : ''}

═══════════════════════════════════════
   PAYMENT SCHEDULE
═══════════════════════════════════════

${milestones.map((m, i) => `
Milestone ${i + 1}: ${m.name}
Amount: $${m.paymentAmount.toLocaleString()} (${m.percentage}%)
${m.description ? `Description: ${m.description}` : ''}
${m.scheduledDate ? `Due: ${new Date(m.scheduledDate + 'T00:00:00').toLocaleDateString()}` : ''}
`).join('\n')}

${labor || materials || profitMarginPct ? `
═══════════════════════════════════════
   COST BREAKDOWN
═══════════════════════════════════════

${labor ? `Labor: $${labor.toLocaleString()}` : ''}
${materials ? `Materials: $${materials.toLocaleString()}` : ''}
${profitMarginPct ? `Profit Margin: ${profitMarginPct.toFixed(1)}%` : ''}
Total: $${summary.totalBid.toLocaleString()}
` : ''}

═══════════════════════════════════════
   TERMS & CONDITIONS
═══════════════════════════════════════

1. PAYMENT TERMS
   - Payments due per milestone schedule above
   ${terms.lateInterestPct ? `- Late payments subject to ${terms.lateInterestPct}% monthly interest` : ''}
   ${summary.retainagePct ? `- ${summary.retainagePct}% retainage held until final completion` : ''}

2. WORK SCHEDULE
   ${terms.workHours ? `- Hours: ${terms.workHours}` : ''}
   - Duration: ${summary.durationDays} days from start date

3. CHANGES & DISPUTES
   - All changes require written approval
   ${terms.escalationThresholdPct ? `- Material cost increases over ${terms.escalationThresholdPct}% may trigger price adjustment` : ''}
   ${terms.cureDays ? `- Disputes: ${terms.cureDays}-day cure period` : ''}

4. PERMITS & COMPLIANCE
   ${terms.permitsBy ? `- Permits obtained by: ${terms.permitsBy}` : ''}
   ${terms.permitFeesPaidBy ? `- Permit fees paid by: ${terms.permitFeesPaidBy}` : ''}
   - All work meets local building codes

5. WARRANTY
   ${terms.warrantyYears ? `- ${terms.warrantyYears}-year warranty on workmanship` : ''}
   - Materials covered by manufacturer warranties

6. GOVERNING LAW
   ${terms.stateLaw ? `- This contract governed by ${terms.stateLaw} law` : ''}

7. TERMINATION
   ${terms.suspendDays ? `- Work may be suspended after ${terms.suspendDays} days non-payment` : ''}
   ${terms.convDays && terms.convFeePct ? `- Either party may terminate with ${terms.convDays} days notice; ${terms.convFeePct}% convenience fee applies` : ''}

═══════════════════════════════════════
   SIGNATURES
═══════════════════════════════════════

CONTRACTOR: _______________________  DATE: _______

${contractor.legalName || ''}


OWNER: _______________________  DATE: _______

${owner.legalName || ''}

This contract is valid for 30 days from the date above.
All changes must be approved in writing.
`;

  return text;
}

/**
 * Builds an HTML version of the contract for PDF generation
 */
export function buildContractHtml(doc: ContractDoc, plainText: string): string {
  const {
    summary,
    contractor,
    owner,
    scope,
    allowances = [],
    milestones,
    terms,
    labor,
    materials,
    profitMarginPct,
  } = doc;
  
  console.log('🔍 HTML Generation - labor:', labor, 'materials:', materials);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Contract - ${summary.projectName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, sans-serif;
      font-size: 12pt;
      line-height: 1.4;
      color: #000;
      padding: 20px;
      background: white;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      border-bottom: 3px solid #2ee0b5;
      padding-bottom: 15px;
    }
    .header h1 {
      font-size: 24pt;
      font-weight: bold;
      color: #0d2745;
      margin-bottom: 10px;
    }
    .header .company {
      font-size: 16pt;
      font-weight: bold;
      color: #0d2745;
      margin-bottom: 8px;
    }
    .header .meta {
      font-size: 10pt;
      color: #666;
    }
    .customer-info {
      margin-bottom: 20px;
      border: 2px solid #000;
      padding: 10px;
    }
    .customer-info h3 {
      font-size: 14pt;
      font-weight: bold;
      margin-bottom: 8px;
      background-color: #e6f3ff;
      padding: 5px;
      border: 1px solid #000;
    }
    .customer-grid {
      display: grid;
      grid-template-columns: 120px 1fr;
      gap: 5px;
    }
    .customer-label {
      font-weight: bold;
    }
    .bid-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    .bid-table th {
      background-color: #cce6ff;
      border: 2px solid #000;
      padding: 8px;
      font-weight: bold;
      text-align: left;
    }
    .bid-table td {
      border: 1px solid #000;
      padding: 6px 8px;
    }
    .area-header {
      background-color: #e6f3ff;
      font-weight: bold;
      font-size: 13pt;
    }
    .description-col {
      width: 50%;
    }
    .cost-col {
      width: 15%;
      text-align: right;
    }
    .total-row {
      background-color: #d9ead3;
      font-weight: bold;
      border-top: 2px solid #000;
    }
    .grand-total {
      background-color: #d9ead3;
      font-weight: bold;
      font-size: 14pt;
      border: 3px solid #000;
    }
    .payment-schedule {
      margin-top: 30px;
      border: 2px solid #000;
      padding: 15px;
    }
    .payment-schedule h3 {
      font-size: 14pt;
      font-weight: bold;
      margin-bottom: 10px;
      background-color: #e6f3ff;
      padding: 5px;
      border: 1px solid #000;
    }
    .payment-table {
      width: 100%;
      border-collapse: collapse;
    }
    .payment-table th,
    .payment-table td {
      border: 1px solid #000;
      padding: 8px;
      text-align: center;
    }
    .payment-table th {
      background-color: #cce6ff;
      font-weight: bold;
    }
    .payment-total {
      background-color: #d9ead3;
      font-weight: bold;
      border: 2px solid #000;
    }
    .notes-section {
      margin-top: 20px;
      border: 2px solid #000;
      padding: 15px;
    }
    .notes-section h3 {
      font-size: 14pt;
      font-weight: bold;
      margin-bottom: 10px;
      background-color: #e6f3ff;
      padding: 5px;
      border: 1px solid #000;
    }
    .notes-list {
      margin-left: 20px;
    }
    .notes-list li {
      margin-bottom: 5px;
    }
    .terms-section {
      margin-top: 30px;
      border: 2px solid #000;
      padding: 15px;
    }
    .terms-section h3 {
      font-size: 14pt;
      font-weight: bold;
      margin-bottom: 10px;
      background-color: #e6f3ff;
      padding: 5px;
      border: 1px solid #000;
    }
    .terms-list {
      counter-reset: terms-counter;
    }
    .terms-list > li {
      counter-increment: terms-counter;
      margin-bottom: 8px;
    }
    .terms-list > li::marker {
      font-weight: bold;
    }
    .signature-section {
      margin-top: 30px;
      border: 2px solid #000;
      padding: 15px;
    }
    .signature-section h3 {
      font-size: 14pt;
      font-weight: bold;
      margin-bottom: 15px;
      background-color: #e6f3ff;
      padding: 5px;
      border: 1px solid #000;
    }
    .signature-line {
      margin: 20px 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .signature-box {
      border-bottom: 1px solid #000;
      width: 200px;
      height: 40px;
      margin-left: 20px;
    }
    .date-box {
      border-bottom: 1px solid #000;
      width: 100px;
      height: 40px;
      margin-left: 20px;
    }
    @media print {
      body { padding: 10px; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>PROPOSAL</h1>
    <div class="company">AMERICAN HOME RESTORATION</div>
    <div class="meta">
      Contract ID: ${summary.contractId} | Date: ${new Date().toLocaleDateString()}
    </div>
  </div>

  <div class="customer-info">
    <h3>CUSTOMER INFORMATION</h3>
    <div class="customer-grid">
      <div class="customer-label">Customer:</div>
      <div>${owner.legalName || 'N/A'}</div>
      <div class="customer-label">Address:</div>
      <div>${owner.address || summary.siteAddress || 'N/A'}</div>
      <div class="customer-label">Phone:</div>
      <div>${owner.phone || 'N/A'}</div>
      <div class="customer-label">Email:</div>
      <div>${owner.email || 'N/A'}</div>
    </div>
  </div>

  <table class="bid-table">
    <thead>
      <tr>
        <th class="description-col">WORK DESCRIPTION</th>
        <th class="cost-col">UNIT/ITEM</th>
        <th class="cost-col">MATERIAL</th>
        <th class="cost-col">LABOR</th>
        <th class="cost-col">TOTAL</th>
      </tr>
    </thead>
    <tbody>
      ${scope.materialLineItems && scope.materialLineItems.length > 0 ? `
      <tr class="area-header">
        <td colspan="5">MATERIALS & SUPPLIES</td>
      </tr>
      ${scope.materialLineItems.map(item => `
      <tr>
        <td>${item.description}</td>
        <td>${item.quantity} ${item.unit}</td>
        <td>$${item.unitCost.toFixed(2)}</td>
        <td>$0.00</td>
        <td>$${item.totalCost.toFixed(2)}</td>
      </tr>
      `).join('')}
      ` : ''}
      
      <tr class="area-header">
        <td colspan="5">LABOR & INSTALLATION</td>
      </tr>
      ${scope.bullets?.map((item, index) => `
      <tr>
        <td>${item}</td>
        <td></td>
        <td>$0.00</td>
        <td>$${((labor || 0) / (scope.bullets?.length || 1)).toFixed(2)}</td>
        <td>$${((labor || 0) / (scope.bullets?.length || 1)).toFixed(2)}</td>
      </tr>
      `).join('') || '<tr><td colspan="5">No scope items defined</td></tr>'}
      
      ${allowances && allowances.length > 0 ? `
      <tr class="area-header">
        <td colspan="5">ALLOWANCES</td>
      </tr>
      ${allowances.map(a => `
      <tr>
        <td>${a.name}${a.description ? ` - ${a.description}` : ''}</td>
        <td>1</td>
        <td>$${a.amount.toFixed(2)}</td>
        <td>$0.00</td>
        <td>$${a.amount.toFixed(2)}</td>
      </tr>
      `).join('')}
      ` : ''}
      
      <tr class="total-row">
        <td colspan="2">MATERIALS & LABOR SUBTOTAL</td>
        <td>$${(materials || 0).toFixed(2)} <!-- mat: ${materials} --></td>
        <td>$${(labor || 0).toFixed(2)} <!-- lab: ${labor} --></td>
        <td>$${((materials || 0) + (labor || 0)).toFixed(2)}</td>
      </tr>
      <tr class="grand-total">
        <td colspan="4">TOTAL JOB MATERIALS & LABOR</td>
        <td>$${summary.totalBid.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>

  <div class="payment-schedule">
    <h3>PAYMENT SCHEDULE</h3>
    <table class="payment-table">
      <thead>
        <tr>
          <th>MILESTONE</th>
          <th>TOTAL</th>
        </tr>
      </thead>
      <tbody>
        ${milestones?.map((m, i) => `
        <tr>
          <td>${m.name}</td>
          <td>$${m.paymentAmount.toFixed(2)}</td>
        </tr>
        `).join('') || '<tr><td colspan="2">No payment milestones defined</td></tr>'}
        <tr class="payment-total">
          <td>TOTAL</td>
          <td>$${(milestones?.reduce((sum, m) => sum + m.paymentAmount, 0) || 0).toFixed(2)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="notes-section">
    <h3>NOTES</h3>
    <ul class="notes-list">
      <li>CUSTOMER TO APPROVE ALL MATERIALS AND FINISHES</li>
      <li>CUSTOMER TO APPROVE ALL COLORS AND STYLES</li>
      <li>ALL WORK TO BE COMPLETED TO LOCAL BUILDING CODES</li>
      <li>WARRANTY: ${terms.warrantyYears || 1} YEAR ON WORKMANSHIP</li>
      ${terms.permitsBy ? `<li>PERMITS OBTAINED BY: ${terms.permitsBy}</li>` : ''}
      ${terms.permitFeesPaidBy ? `<li>PERMIT FEES PAID BY: ${terms.permitFeesPaidBy}</li>` : ''}
    </ul>
  </div>

  <div class="terms-section">
    <h3>TERMS & CONDITIONS</h3>
    <ol class="terms-list">
      <li><strong>PAYMENT TERMS:</strong> Payments due per milestone schedule above. ${terms.lateInterestPct ? `Late payments subject to ${terms.lateInterestPct}% monthly interest.` : ''}</li>
      <li><strong>WORK SCHEDULE:</strong> ${terms.workHours || 'Standard business hours'}. Duration: ${summary.durationDays} days from start date.</li>
      <li><strong>CHANGES:</strong> All changes require written approval. ${terms.escalationThresholdPct ? `Material cost increases over ${terms.escalationThresholdPct}% may trigger price adjustment.` : ''}</li>
      <li><strong>INSURANCE:</strong> ${contractor.insurer ? `Contractor carries ${contractor.insurer} insurance.` : 'Contractor maintains appropriate insurance coverage.'}</li>
      <li><strong>GOVERNING LAW:</strong> This contract governed by ${terms.stateLaw || 'local'} law.</li>
      <li><strong>TERMINATION:</strong> ${terms.convDays && terms.convFeePct ? `Either party may terminate with ${terms.convDays} days notice; ${terms.convFeePct}% convenience fee applies.` : 'Terms as agreed.'}</li>
    </ol>
  </div>

  <div class="signature-section">
    <h3>ACCEPTANCE</h3>
    <div class="signature-line">
      <strong>CONTRACTOR:</strong> ${contractor.legalName || 'AMERICAN HOME RESTORATION'}
      <div class="signature-box"></div>
      <strong>DATE:</strong>
      <div class="date-box"></div>
    </div>
    <div class="signature-line">
      <strong>OWNER:</strong> ${owner.legalName || ''}
      <div class="signature-box"></div>
      <strong>DATE:</strong>
      <div class="date-box"></div>
    </div>
    <div style="margin-top: 20px; font-size: 10pt; text-align: center;">
      This proposal is valid for 30 days from the date above. All changes must be approved in writing.
    </div>
  </div>
</body>
</html>
`;
}



