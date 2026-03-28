import { ContractDoc } from "../contracts/types";
import {
  buildContractSections,
  ContractBranding,
  ContractAudience,
  ContractBuildOptions,
  ContractPdfMode,
  ContractTemplateState,
  BUILDER_FEE_LABEL,
  computeClientPricingBreakdown,
  getScheduleSummaryForContract,
  getStateLegalSummary,
  normalizeContractPdfMode,
  normalizeContractAudience,
  normalizeProjectContractCopy,
  filterContractWarningsForAudience,
  sanitizeContractDoc,
} from "./contractTemplate";

const money = (n: number | undefined | null) =>
  (Math.round((n ?? 0) * 100) / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const esc = (s: string) =>
  (s || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" } as any)[c]);

const hasMeaningfulLicenseNumber = (value?: string) => {
  const normalized = String(value || "").trim();
  if (!normalized) return false;
  if (/^license$/i.test(normalized)) return false;
  if (/^general contractor license$/i.test(normalized)) return false;
  if (/^contractor license$/i.test(normalized)) return false;
  return true;
};

type ProposalInput = {
  notes?: string[];
  branding?: ContractBranding;
  pdfMode?: ContractPdfMode;
  state?: ContractTemplateState;
  projectType?: string;
  contractType?: "home-improvement" | "construction";
  /** Default `client` — omit internal draft / checklist copy on the terms page. */
  contractAudience?: ContractAudience;
};

const formatDate = (value?: string) => {
  if (!value || value === "TBD") return "TBD";
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const renderInfoRow = (label: string, value?: string) =>
  value
    ? `<div class="meta-row"><div class="meta-label">${esc(label)}</div><div class="meta-value">${esc(value)}</div></div>`
    : "";

/**
 * Preserve the original proposal width/side gutters in HTML.
 * Puppeteer only reserves the extra bottom area needed for the native PDF footer.
 */
const PAGE_MARGIN_CSS = "8mm 9mm 11mm";

const resolveProposalOptions = (input?: ProposalInput): ContractBuildOptions => ({
  pdfMode: input?.pdfMode ?? "detailed",
  state: input?.state || "other",
  projectType: input?.projectType,
  contractType: input?.contractType || "construction",
  branding: input?.branding || {},
  contractAudience: normalizeContractAudience(input?.contractAudience),
});

export function getContractPdfPrintFooterParts(
  doc: ContractDoc,
  input?: ProposalInput,
): { footerLeft: string; footerCenter: string } {
  const options = resolveProposalOptions(input);
  const sanitizedDoc = sanitizeContractDoc(doc, options);
  const company = options.branding.companyName || sanitizedDoc.contractor.legalName || "Build Profit Solutions";
  const docTitle =
    options.contractType === "home-improvement"
      ? "Home Improvement Agreement"
      : "Construction Services Agreement";
  const licenseNumber = hasMeaningfulLicenseNumber(options.branding.licenseNumber)
    ? options.branding.licenseNumber
    : undefined;
  const footerBits = [options.branding.companyPhone, options.branding.companyEmail, licenseNumber]
    .filter(Boolean)
    .map((value) => String(value));

  return {
    footerLeft: footerBits.length ? `${company} · ${footerBits.join(" · ")}` : company,
    footerCenter: docTitle,
  };
}

export function buildProposalHtml(doc: ContractDoc, input?: ProposalInput) {
  const options = resolveProposalOptions(input);
  const pdfMode = normalizeContractPdfMode(options.pdfMode);
  const sanitizedDoc = sanitizeContractDoc(doc, options);
  const sections = buildContractSections(sanitizedDoc, options);
  const brand = options.branding.accentColorHex || "#22c7a8";
  const brandDark = "#10243b";
  const muted = "#64748b";
  const bodyText = "#1f2937";
  const today = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const company = options.branding.companyName || sanitizedDoc.contractor.legalName || "Build Profit Solutions";
  const contractorName = options.branding.contractorName || sanitizedDoc.contractor.contactName || company;
  const contractorTitle = options.branding.contractorTitle || "Contractor";
  const logo = options.branding.logoUrl || sanitizedDoc.contractor.logoUrl;
  const startDate = formatDate(sanitizedDoc.summary.startDate);
  const validThrough = formatDate(sanitizedDoc.summary.expiresDate);
  const scheduleRail = getScheduleSummaryForContract(sanitizedDoc);
  const projectAddress = sanitizedDoc.owner.address || sanitizedDoc.summary.siteAddress;
  const contractCopy = normalizeProjectContractCopy(sanitizedDoc, options);
  const coverSummary = contractCopy.scopeSummary;
  const trustItems = [
    options.branding.licenseNumber ? "Licensed" : "",
    options.branding.insuranceStatus ? "Insured" : "",
    options.branding.verifiedContractor ? "Verified" : "",
  ].filter(Boolean);
  const pricingBreakdown = computeClientPricingBreakdown(sanitizedDoc);
  const materialsSubtotal = pricingBreakdown.materials;
  const laborSubtotal = pricingBreakdown.labor;
  const directCostsSubtotal = pricingBreakdown.directCosts;
  const builderFeeAmount = pricingBreakdown.builderFee;
  const totalBid = pricingBreakdown.contractTotal;
  const projectTypeDisplay = contractCopy.projectTypeLabel;
  const paymentStructureLabel =
    sanitizedDoc.milestones.length > 0
      ? `${sanitizedDoc.milestones.length} scheduled payment${sanitizedDoc.milestones.length === 1 ? "" : "s"}`
      : "No payment schedule";
  const pricingRows = [
    { label: "Materials", value: materialsSubtotal },
    { label: "Labor", value: laborSubtotal },
    { label: "Direct costs", value: directCostsSubtotal },
    { label: BUILDER_FEE_LABEL, value: builderFeeAmount },
  ];
  const hasLineItemAppendix =
    (sanitizedDoc.scope.materialLineItems?.length || 0) > 0 ||
    (sanitizedDoc.scope.laborLineItems?.length || 0) > 0;
  const groupedMaterials = (sanitizedDoc.scope.materialLineItems || []).reduce(
    (acc: Record<string, typeof sanitizedDoc.scope.materialLineItems>, item) => {
      const key = item.section || item.category || "Materials";
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    },
    {},
  );
  const groupedLabor = (sanitizedDoc.scope.laborLineItems || []).reduce(
    (acc: Record<string, typeof sanitizedDoc.scope.laborLineItems>, item) => {
      const key = item.category || "Labor";
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    },
    {},
  );
  const hasMaterialGroups = Object.keys(groupedMaterials).length > 0;
  const hasLaborGroups = Object.keys(groupedLabor).length > 0;

  const paymentTotalPct = sanitizedDoc.milestones.reduce((sum, milestone) => {
    const pct =
      typeof milestone.percentage === "number"
        ? milestone.percentage
        : typeof milestone.percent === "number"
          ? milestone.percent
          : totalBid > 0
            ? (Number(milestone.paymentAmount || milestone.amount || 0) / totalBid) * 100
            : 0;
    return sum + pct;
  }, 0);
  const displayPaymentPct = Math.abs(paymentTotalPct - 100) < 0.25 ? "100%" : `${paymentTotalPct.toFixed(1)}%`;

  /** Avoid repeating the “General materials” / “Labor” section title as a second table title. */
  const isRedundantMaterialGroupTitle = (g: string) => {
    const x = String(g || "")
      .trim()
      .toLowerCase();
    return x === "general materials" || x === "general material" || x === "materials" || x === "material";
  };
  const isRedundantLaborGroupTitle = (g: string) => {
    const x = String(g || "")
      .trim()
      .toLowerCase();
    return x === "labor";
  };

  const renderMaterialGroupsHtml = Object.entries(groupedMaterials)
    .map(([group, items]) => {
      const subtotal = items.reduce((sum, item) => sum + Number(item.materials || 0), 0);
      const groupHead =
        isRedundantMaterialGroupTitle(group) || !String(group).trim()
          ? ""
          : `<h3 class="appendix-head">${esc(group)}</h3>`;
      return `
          <div class="appendix-block">
            ${groupHead}
            <table class="appendix-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th class="center">Qty</th>
                  <th class="center">Unit</th>
                  <th class="num">Materials</th>
                </tr>
              </thead>
              <tbody>
                ${items
                  .map(
                    (item) => `
                    <tr>
                      <td>${esc(item.description || "Material")}</td>
                      <td class="center">${item.quantity || "—"}</td>
                      <td class="center">${esc(item.unit || "—")}</td>
                      <td class="num">${money(item.materials || 0)}</td>
                    </tr>`,
                  )
                  .join("")}
                <tr class="subtotal-row">
                  <td colspan="3">Material subtotal</td>
                  <td class="num">${money(subtotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>`;
    })
    .join("");

  const renderLaborGroupsHtml = Object.entries(groupedLabor)
    .map(([group, items]) => {
      const subtotal = items.reduce((sum, item) => sum + Number(item.labor || 0), 0);
      const groupHead =
        isRedundantLaborGroupTitle(group) || !String(group).trim()
          ? ""
          : `<h3 class="appendix-head">${esc(group)}</h3>`;
      return `
          <div class="appendix-block">
            ${groupHead}
            <table class="appendix-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th class="num">Labor</th>
                </tr>
              </thead>
              <tbody>
                ${items
                  .map(
                    (item) => `
                    <tr>
                      <td>${esc(item.description || "Labor")}</td>
                      <td class="num">${money(item.labor || 0)}</td>
                    </tr>`,
                  )
                  .join("")}
                <tr class="subtotal-row">
                  <td>Labor subtotal</td>
                  <td class="num">${money(subtotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>`;
    })
    .join("");

  const buildReconciliationHtml = () => `
      <table class="appendix-table appendix-table--recon">
        <thead>
          <tr>
            <th>Category</th>
            <th class="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Materials (contract summary)</td>
            <td class="num">${money(materialsSubtotal)}</td>
          </tr>
          <tr>
            <td>Labor (contract summary)</td>
            <td class="num">${money(laborSubtotal)}</td>
          </tr>
          <tr>
            <td>Direct costs (permits, plans, equipment, other direct)</td>
            <td class="num">${money(directCostsSubtotal)}</td>
          </tr>
          <tr>
            <td>${esc(BUILDER_FEE_LABEL)}</td>
            <td class="num">${money(builderFeeAmount)}</td>
          </tr>
          <tr class="subtotal-row">
            <td><strong>Contract total (reconciliation)</strong></td>
            <td class="num"><strong>${money(totalBid)}</strong></td>
          </tr>
        </tbody>
      </table>
      ${
        !pricingBreakdown.reconciles
          ? `<p class="subtle-p">Note: Roll-up rounding — verify materials, labor, direct costs, and contract total in the estimate match this agreement.</p>`
          : `<p class="subtle-p">The amounts above reconcile to the contract total shown on the pricing summary.</p>`
      }
    `;

  const notes =
    input?.notes ||
    [
      "Selections, finishes, and owner-furnished items must be approved before ordering.",
      "Lead times begin after approvals, deposit receipt, and material release.",
      "Reasonable site protection, cleanup, and debris handling are included unless otherwise noted.",
      "Access to the work area, parking, and utilities must remain available during active work hours.",
    ];

  const docTitle =
    options.contractType === "home-improvement"
      ? "Home Improvement Agreement"
      : "Construction Services Agreement";

  const stateLegalSummary = getStateLegalSummary(options.state);
  const projectAssumptionNote = sections.projectPack.disclaimer
    ? esc(sections.projectPack.disclaimer)
    : "";
  const licenseNumber = hasMeaningfulLicenseNumber(options.branding.licenseNumber)
    ? options.branding.licenseNumber
    : undefined;

  const coverPage = () => {
    return `
    <section class="page cover-page">
      <header class="cover-header">
        <div class="cover-header-brand">
          ${
            logo
              ? `<div class="brand-image"><img src="${esc(logo)}" alt="" /></div>`
              : `<div class="brand-image brand-image--empty"></div>`
          }
          <div class="cover-header-text">
            <div class="company-name">${esc(company)}</div>
            <div class="company-subtitle">${esc(contractorName)}${contractorTitle ? `<span class="title-sep"> · </span>${esc(contractorTitle)}` : ""}</div>
            <div class="contact-line">${[
              options.branding.companyPhone,
              options.branding.companyEmail,
              options.branding.companyWebsite,
            ]
              .filter(Boolean)
              .map((item) => esc(String(item)))
              .join(" · ")}</div>
          </div>
        </div>
        <div class="cover-header-meta">
          <div class="meta-line">Issued ${esc(today)}</div>
          <div class="meta-line">Proposal #${esc(String(sanitizedDoc.summary.contractId))}</div>
        </div>
      </header>

      <div class="cover-rule"></div>

      <div class="cover-layout">
        <div class="cover-main">
          <div class="cover-eyebrow">Client agreement</div>
          <div class="doc-type">${esc(docTitle)}</div>
          <div class="cover-deck">Prepared for ${esc(sanitizedDoc.owner.legalName || "Client")}</div>
          <div class="cover-project-line">${esc(sanitizedDoc.summary.projectName)}</div>

          <div class="cover-story-grid">
            <div class="cover-story-block">
              <div class="cover-kicker">Prepared for</div>
              <div class="cover-client-name">${esc(sanitizedDoc.owner.legalName || "Client")}</div>
              <div class="cover-project-name">${esc(sanitizedDoc.summary.projectName)}</div>
              ${projectAddress ? `<div class="cover-address">${esc(projectAddress)}</div>` : ""}
            </div>
            <div class="cover-story-block">
              <div class="cover-kicker">Prepared by</div>
              <div class="cover-detail-value">${esc(company)}</div>
              <div class="cover-detail-subvalue">${esc(contractorName)}${contractorTitle ? ` · ${esc(contractorTitle)}` : ""}</div>
              ${options.branding.businessAddress ? `<div class="cover-address cover-address--compact">${esc(options.branding.businessAddress)}</div>` : ""}
            </div>
          </div>

          <div class="cover-project-summary">
            <div class="cover-summary-label">Project summary</div>
            <p>${esc(coverSummary)}</p>
          </div>

          ${
            trustItems.length
              ? `<div class="trust-badges">${trustItems.map((t) => `<span class="trust-badge">${esc(t)}</span>`).join("")}</div>`
              : ""
          }
        </div>

        <aside class="cover-rail">
          <div class="boxed-summary">
            <div class="boxed-summary-title">Agreement summary</div>
            ${renderInfoRow("Contract price", money(totalBid))}
            ${renderInfoRow("Start date", startDate)}
            ${renderInfoRow(scheduleRail.label, scheduleRail.value)}
            ${renderInfoRow("Payment structure", paymentStructureLabel)}
            ${validThrough !== "TBD" ? renderInfoRow("Proposal expires", validThrough) : ""}
          </div>
          <div class="cover-rail-note">
            Final scope, schedule, and pricing are subject to written approval before work proceeds.
          </div>
        </aside>
      </div>
    </section>`;
  };

  const scopePricingDetailPage = () => {
    const lineItemDetailHtml =
      pdfMode === "detailed"
        ? hasLineItemAppendix
          ? `<div class="line-item-detail-block">
          <h3 class="appendix-section-title">Line-item detail</h3>
          ${
            hasMaterialGroups
              ? `<h4 class="line-item-subhead">General materials</h4>
          ${renderMaterialGroupsHtml}`
              : ""
          }
          ${
            hasLaborGroups
              ? `<h4 class="line-item-subhead">Labor</h4>
          ${renderLaborGroupsHtml}`
              : ""
          }
        </div>`
          : `<p class="subtle-p">No line-item breakdown was attached; reconciliation below follows the contract summary only.</p>`
        : "";

    const includedWorkHtml =
      contractCopy.includedWorkBullets?.length > 0
        ? `<ul class="bullet-list flush appendix-scope-bullets">${contractCopy.includedWorkBullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`
        : "";

    return `
    <section class="page page--scope-pricing-flow appendix-page">
      <div class="section-head">
        <h2 class="section-title">Scope &amp; pricing detail</h2>
      </div>
      <div class="appendix-context">
        <h3 class="appendix-context-title">Project context</h3>
        <div class="appendix-meta">
          <div class="appendix-meta-row"><span class="appendix-meta-label">Project</span><span class="appendix-meta-value">${esc(sanitizedDoc.summary.projectName)}</span></div>
          <div class="appendix-meta-row"><span class="appendix-meta-label">Client</span><span class="appendix-meta-value">${esc(sanitizedDoc.owner.legalName || "Client")}</span></div>
          <div class="appendix-meta-row"><span class="appendix-meta-label">Project type</span><span class="appendix-meta-value">${esc(projectTypeDisplay)}</span></div>
        </div>
        <h3 class="appendix-context-title">Scope &amp; included work</h3>
        <p class="appendix-scope-text">${esc(contractCopy.scopeSummary)}</p>
        ${includedWorkHtml}
      </div>

      <div class="section-block section-block--split">
        <div>
          <h3 class="block-title">Pricing summary</h3>
          <table class="simple-table">
            <tbody>
              ${pricingRows
                .map(
                  (row) => `
                  <tr>
                    <td>${esc(row.label)}</td>
                    <td class="num">${money(row.value)}</td>
                  </tr>`,
                )
                .join("")}
              <tr class="total-row">
                <td>Contract total</td>
                <td class="num">${money(totalBid)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div>
          <h3 class="block-title">Project assumptions</h3>
          <ul class="bullet-list flush">${notes.map((note) => `<li>${esc(note)}</li>`).join("")}</ul>
        </div>
      </div>

      ${lineItemDetailHtml}

      <div class="total-reconciliation-block" data-keep-together="reconciliation">
        <h3 class="appendix-section-title appendix-section-title--recon">Total reconciliation</h3>
        ${buildReconciliationHtml()}
      </div>
    </section>`;
  };

  const paymentPage = () => {
    return `
    <section class="page page--payment">
      <div class="section-head">
        <h2 class="section-title">Payment schedule</h2>
      </div>
      <table class="schedule-table schedule-table--wide">
        <thead>
          <tr>
            <th class="col-pay">Payment</th>
            <th class="center col-pct">Pct.</th>
            <th class="num col-amt">Amount</th>
            <th class="col-due">Due date / condition</th>
            <th class="col-note">Notes</th>
          </tr>
        </thead>
        <tbody>
          ${
            sanitizedDoc.milestones.length
              ? sanitizedDoc.milestones
                  .map((milestone) => {
                    const amount = Number(milestone.paymentAmount || milestone.amount || 0);
                    const pct =
                      typeof milestone.percentage === "number"
                        ? milestone.percentage
                        : typeof milestone.percent === "number"
                          ? milestone.percent
                          : totalBid > 0
                            ? (amount / totalBid) * 100
                            : 0;
                    return `
                      <tr>
                        <td>${esc(milestone.name || "Scheduled payment")}</td>
                        <td class="center">${pct ? `${pct.toFixed(1)}%` : "—"}</td>
                        <td class="num">${money(amount)}</td>
                        <td>${esc(formatDate(milestone.scheduledDate) || "TBD")}</td>
                        <td>${esc(milestone.description || milestone.status || "—")}</td>
                      </tr>`;
                  })
                  .join("")
              : `<tr><td colspan="5" class="empty-row">No payment schedule defined.</td></tr>`
          }
          <tr class="schedule-total-row">
            <td>Total contract</td>
            <td class="center schedule-total-pct">${displayPaymentPct}</td>
            <td class="num">${money(totalBid)}</td>
            <td colspan="2"></td>
          </tr>
        </tbody>
      </table>
    </section>`;
  };

  const legalTermsPage = () => {
    const dedupedWarnings = sections.warnings.filter(
      (w, i, arr) => arr.findIndex((x) => x.message === w.message) === i,
    );
    const audience = normalizeContractAudience(options.contractAudience);
    const visibleWarnings = filterContractWarningsForAudience(dedupedWarnings, audience);
    const termsLeadNoticeInternal =
      options.state === "other"
        ? "Not legal advice. This is a generic business draft—confirm jurisdiction-specific notices, licensing, cancellation rights, and dispute terms with counsel before the client signs."
        : `Not legal advice. Jurisdiction template (${sections.statePack.heading}): confirm required notices and disclosures before delivery.`;
    const termsLeadNoticeClient =
      options.state === "other"
        ? "Confirm any jurisdiction-specific notices, licensing, cancellation rights, and dispute terms that apply to this project."
        : `This section uses ${sections.statePack.heading} language. Confirm required notices and disclosures before execution.`;
    const termsLeadNotice = audience === "internal" ? termsLeadNoticeInternal : termsLeadNoticeClient;

    const termsTopStrip =
      audience === "internal"
        ? `<div class="notice-strip notice-strip--legal-top">
        <strong>Review before client delivery.</strong> ${esc(termsLeadNotice)}
      </div>`
        : `<div class="notice-strip notice-strip--legal-client">
        ${esc(termsLeadNotice)}
      </div>`;

    return `
    <section class="page">
      <div class="section-head">
        <h2 class="section-title">Contract terms</h2>
      </div>

      ${termsTopStrip}

      ${
        visibleWarnings.length
          ? `<div class="notice-strip notice-strip--warn">
              <ul class="compact-warn-list">
                ${visibleWarnings.map((w) => `<li>${esc(w.message)}</li>`).join("")}
              </ul>
            </div>`
          : ""
      }

      <div class="section-block">
        <h3 class="block-title">Business terms</h3>
        <ol class="legal-list">
          ${sections.baseTerms.map((term) => `<li>${esc(term)}</li>`).join("")}
        </ol>
      </div>

      <div class="section-block">
        <h3 class="block-title">Work-type assumptions</h3>
        <ul class="bullet-list flush">
          ${sections.projectPack.clauses.map((c) => `<li>${esc(c)}</li>`).join("")}
        </ul>
        ${projectAssumptionNote ? `<p class="subtle-p">${projectAssumptionNote}</p>` : ""}
      </div>

      <div class="section-block state-block">
        <h3 class="block-title">State &amp; jurisdiction</h3>
        <p class="state-paragraph">${esc(stateLegalSummary)}</p>
      </div>
    </section>`;
  };

  const signaturePage = () => {
    return `
    <section class="page signature-page">
      <div class="section-head">
        <h2 class="section-title">Acceptance &amp; signatures</h2>
      </div>
      <p class="signature-lead">This agreement becomes effective when signed by both parties. By signing below, the parties acknowledge they have reviewed the scope, pricing, payment schedule, and contract terms.</p>
      <div class="signature-grid">
        <div class="signature-box">
          <div class="signature-heading">Contractor / company</div>
          ${renderInfoRow("Company", company)}
          ${renderInfoRow("Contractor", contractorName)}
          ${renderInfoRow("License", licenseNumber)}
          <div class="signature-line-block">
            <div class="signature-line"></div>
            <div class="signature-caption">Authorized signature</div>
          </div>
          <div class="signature-meta-row">
            <div class="signature-meta">
              <div class="signature-line short"></div>
              <div class="signature-caption">Printed name</div>
            </div>
            <div class="signature-meta">
              <div class="signature-line short"></div>
              <div class="signature-caption">Date</div>
            </div>
          </div>
        </div>
        <div class="signature-box">
          <div class="signature-heading">Client / owner</div>
          ${renderInfoRow("Client", sanitizedDoc.owner.legalName)}
          ${renderInfoRow("Property", projectAddress)}
          <div class="signature-line-block">
            <div class="signature-line"></div>
            <div class="signature-caption">Client signature</div>
          </div>
          <div class="signature-meta-row">
            <div class="signature-meta">
              <div class="signature-line short"></div>
              <div class="signature-caption">Printed name</div>
            </div>
            <div class="signature-meta">
              <div class="signature-line short"></div>
              <div class="signature-caption">Date</div>
            </div>
          </div>
        </div>
      </div>
    </section>`;
  };

  const bodyHtml = `
  ${coverPage()}
  ${scopePricingDetailPage()}
  ${paymentPage()}
  ${legalTermsPage()}
  ${signaturePage()}
  `;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <!-- 612 CSS px ≈ 6.3" at 96px/in (WebKit), not full Letter width — leaves huge side gutters. Use 816 (8.5×96) or root width in pt/in. -->
  <meta name="viewport" content="width=816, initial-scale=1, maximum-scale=1, user-scalable=no">
  <title>${esc(sanitizedDoc.summary.projectName)} – ${esc(sections.draftLabel)}</title>
  <style>
    @page {
      size: letter;
      margin: ${PAGE_MARGIN_CSS};
    }
    * { box-sizing: border-box; }
    /* Viewport 816 ≈ 8.5in at 96px/in — fills Letter width. Do not fix body to 612px (that width is ~6.3" here). */
    html, body {
      width: 100%;
      max-width: none;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.42;
      color: ${bodyText};
      background: white;
    }
    section.page + section.page {
      page-break-before: always;
      break-before: page;
    }
    .page {
      position: relative;
      page-break-after: auto;
      padding: 0;
      width: 100%;
    }

    .cover-page {
      page-break-inside: avoid;
      break-inside: avoid;
    }

    /* —— Cover —— */
    .cover-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 10px;
      margin-bottom: 6px;
    }
    .cover-header-brand {
      display: flex;
      gap: 12px;
      align-items: center;
      flex: 1;
      min-width: 0;
    }
    .brand-image {
      width: 86px;
      height: 86px;
      border: 1px solid #dbe4ee;
      flex-shrink: 0;
      overflow: hidden;
      background: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .brand-image--empty { border-style: dashed; }
    .brand-image img { width: 100%; height: 100%; object-fit: cover; }
    .cover-header-text { min-width: 0; }
    .company-name {
      font-size: 27pt;
      font-weight: 700;
      color: ${brandDark};
      line-height: 1.02;
      letter-spacing: -0.02em;
    }
    .company-subtitle {
      margin-top: 3px;
      color: ${muted};
      font-size: 10.2pt;
    }
    .title-sep { font-weight: 400; }
    .contact-line {
      margin-top: 4px;
      color: ${muted};
      font-size: 8.6pt;
      line-height: 1.28;
    }
    .cover-header-meta {
      text-align: right;
      width: 25%;
      flex-shrink: 0;
      padding-top: 4px;
    }
    .meta-line {
      color: ${muted};
      font-size: 8.3pt;
      line-height: 1.32;
    }
    .cover-rule {
      height: 4px;
      background: ${brand};
      margin: 8px 0 12px;
      width: 100%;
    }
    .cover-layout {
      display: grid;
      grid-template-columns: minmax(0, 1.72fr) minmax(228px, 0.72fr);
      gap: 20px;
      align-items: start;
      width: 100%;
    }
    .cover-main {
      padding-right: 18px;
      border-right: 1px solid #e5e7eb;
    }
    .cover-rail {
      padding-left: 4px;
    }
    .cover-eyebrow {
      font-size: 7.8pt;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      color: ${brand};
      font-weight: 700;
      margin-bottom: 8px;
    }
    .doc-type {
      font-size: 20pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      line-height: 1.04;
      color: ${brandDark};
      margin-bottom: 10px;
      max-width: 90%;
    }
    .cover-deck {
      font-size: 10.2pt;
      line-height: 1.35;
      color: ${muted};
      margin-bottom: 4px;
      max-width: 92%;
    }
    .cover-project-line {
      font-size: 16pt;
      line-height: 1.2;
      color: ${bodyText};
      font-weight: 600;
      margin-bottom: 18px;
      max-width: 92%;
    }
    .cover-story-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
      gap: 24px;
      margin-bottom: 16px;
    }
    .cover-story-block {
      min-width: 0;
    }
    .cover-kicker {
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: ${muted};
      font-weight: 700;
      margin-bottom: 6px;
    }
    .cover-client-name {
      font-size: 16pt;
      font-weight: 700;
      color: ${brandDark};
    }
    .cover-project-name {
      margin-top: 3px;
      font-size: 15pt;
      font-weight: 600;
      color: ${bodyText};
    }
    .cover-address {
      margin-top: 5px;
      font-size: 10.2pt;
      color: ${bodyText};
    }
    .cover-address--compact {
      margin-top: 7px;
      font-size: 9.2pt;
      color: ${muted};
      line-height: 1.3;
    }
    .cover-detail-value {
      font-size: 11.2pt;
      font-weight: 600;
      color: ${brandDark};
      line-height: 1.25;
    }
    .cover-detail-subvalue {
      margin-top: 3px;
      font-size: 9.2pt;
      color: ${muted};
      line-height: 1.28;
    }
    .cover-project-summary {
      margin-top: 4px;
      padding-top: 12px;
      border-top: 1px solid #e5e7eb;
      max-width: 94%;
    }
    .cover-summary-label {
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: ${muted};
      font-weight: 700;
      margin-bottom: 6px;
    }
    .cover-project-summary p {
      margin: 0;
      font-size: 10.5pt;
      line-height: 1.46;
    }
    .trust-badges {
      margin-top: 16px;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .trust-badge {
      display: inline-block;
      font-size: 7.5pt;
      font-weight: 700;
      color: #475569;
      letter-spacing: 0.03em;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      padding: 5px 10px;
      border-radius: 3px;
    }

    .boxed-summary {
      border: 1px solid #cfd8e3;
      padding: 11px 12px;
      background: #fbfcfe;
      page-break-inside: avoid;
    }
    .boxed-summary-title {
      font-size: 7.8pt;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-weight: 700;
      color: ${brandDark};
      margin-bottom: 8px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e5e7eb;
    }
    .boxed-summary .meta-row {
      padding: 7px 0;
      border-bottom: 1px solid #eef2f7;
    }
    .boxed-summary .meta-row:last-child { border-bottom: none; }
    .cover-rail-note {
      margin-top: 12px;
      font-size: 8.6pt;
      line-height: 1.42;
      color: ${muted};
    }

    /* —— Inner sections —— */
    .section-head {
      margin-bottom: 10px;
      padding-top: 2px;
    }
    .section-title {
      font-size: 15pt;
      font-weight: 700;
      color: ${brandDark};
      margin: 0;
      padding-bottom: 8px;
      border-bottom: 2px solid ${brand};
    }
    .section-block {
      margin-bottom: 14px;
      width: 100%;
    }
    .section-block--split {
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
      gap: 18px;
    }
    .block-title {
      font-size: 9pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: ${brandDark};
      margin: 0 0 8px;
    }
    .bullet-list, .legal-list {
      margin: 0;
      padding-left: 18px;
    }
    .bullet-list.flush, .legal-list { padding-left: 20px; }
    .bullet-list li, .legal-list li { margin-bottom: 5px; }
    .notice-strip {
      padding: 8px 10px;
      margin-bottom: 12px;
      border-left: 3px solid ${brand};
      background: #f8fafc;
      font-size: 9.5pt;
      line-height: 1.4;
    }
    .notice-strip--warn {
      border-left-color: #d97706;
      background: #fffbeb;
    }
    .notice-strip--legal-top {
      margin-bottom: 14px;
      padding: 10px 12px;
    }
    .notice-strip--legal-client {
      margin-bottom: 14px;
      padding: 10px 12px;
      border-left-color: ${brand};
      background: #f8fafc;
      font-size: 9.5pt;
      line-height: 1.45;
    }
    .compact-warn-list {
      margin: 6px 0 0;
      padding-left: 18px;
    }
    .compact-warn-list li { margin-bottom: 3px; }
    .state-block .state-paragraph {
      margin: 0 0 10px;
      font-size: 9.5pt;
      line-height: 1.45;
    }
    .subtle-p {
      margin: 8px 0 0;
      font-size: 8.5pt;
      color: ${muted};
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }
    .simple-table td {
      padding: 7px 8px;
      border-bottom: 1px solid #e8ecf1;
    }
    .simple-table .total-row td {
      font-weight: 700;
      color: ${brandDark};
      border-bottom: none;
      border-top: 2px solid ${brandDark};
      padding-top: 10px;
    }
    .schedule-table {
      width: 100%;
      table-layout: fixed;
    }
    .schedule-table th,
    .schedule-table td {
      padding: 7px 6px;
      border-bottom: 1px solid #e5e7eb;
      vertical-align: top;
      font-size: 9pt;
    }
    .schedule-table th {
      text-align: left;
      font-size: 7.5pt;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: ${muted};
      background: #f1f5f9;
      font-weight: 700;
    }
    .col-pay { width: 19%; }
    .col-pct { width: 9%; }
    .col-amt { width: 15%; }
    .col-due { width: 22%; }
    .col-note { width: 35%; }
    .schedule-total-row td {
      font-weight: 700;
      font-size: 10pt;
      color: ${brandDark};
      border-bottom: none;
      border-top: 2px solid ${brandDark};
      padding-top: 10px;
      padding-bottom: 6px;
      background: #fafbfd;
    }
    .schedule-total-pct { font-variant-numeric: tabular-nums; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .center { text-align: center; }
    .empty-row {
      text-align: center;
      color: ${muted};
      padding: 14px;
    }
    .note-inline {
      margin-top: 8px;
      font-size: 8.5pt;
      color: ${muted};
    }

    .signature-page .section-head {
      margin-bottom: 14px;
    }
    .signature-lead {
      margin: 0 0 28px;
      max-width: 100%;
      font-size: 9.5pt;
      line-height: 1.48;
    }
    .signature-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 28px;
      align-items: stretch;
    }
    .signature-box {
      border: 1px solid #c9d4e0;
      border-radius: 4px;
      padding: 20px 18px 22px;
      min-height: 268px;
      background: #fcfdfe;
      display: flex;
      flex-direction: column;
    }
    .signature-heading {
      font-size: 10.5pt;
      font-weight: 700;
      color: ${brandDark};
      margin-bottom: 12px;
      padding-bottom: 10px;
      border-bottom: 1px solid #e2e8f0;
    }
    .meta-row {
      display: flex;
      gap: 10px;
      padding: 5px 0;
      border-bottom: 1px solid #eef2f7;
      font-size: 9.5pt;
    }
    .meta-row:last-of-type { border-bottom: none; }
    .meta-label {
      min-width: 88px;
      font-weight: 600;
      color: ${muted};
    }
    .meta-value { flex: 1; color: ${bodyText}; }
    .signature-line-block { margin-top: auto; padding-top: 18px; }
    .signature-line {
      border-bottom: 1.5px solid #334155;
      height: 36px;
      width: 100%;
    }
    .signature-line.short { height: 28px; }
    .signature-caption {
      margin-top: 5px;
      font-size: 8pt;
      color: ${muted};
    }
    .signature-meta-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18px;
      margin-top: 20px;
    }

    .appendix-page { padding-bottom: 12mm; }
    .appendix-context {
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      border-radius: 10px;
      padding: 12px 14px;
      margin-bottom: 18px;
      page-break-inside: auto;
    }
    .appendix-context-title {
      font-size: 8.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: ${brandDark};
      margin: 0 0 8px;
    }
    .appendix-context-title:not(:first-child) { margin-top: 14px; }
    .appendix-meta { margin-bottom: 4px; }
    .appendix-meta-row {
      display: flex;
      gap: 10px;
      font-size: 9.5pt;
      padding: 4px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .appendix-meta-row:last-child { border-bottom: none; }
    .appendix-meta-label { min-width: 100px; font-weight: 600; color: ${muted}; }
    .appendix-meta-value { flex: 1; color: ${bodyText}; }
    .appendix-scope-text { margin: 0 0 8px; font-size: 9.5pt; line-height: 1.45; color: ${bodyText}; }
    .appendix-scope-bullets { margin-top: 6px; }
    .appendix-section-title {
      font-size: 10.5pt;
      font-weight: 700;
      color: ${brandDark};
      margin: 18px 0 10px;
      padding-bottom: 6px;
      border-bottom: 2px solid ${brand};
    }
    .appendix-section-title--recon {
      margin-top: 0;
    }
    .appendix-table--recon { margin-top: 8px; }
    .appendix-table--recon .subtotal-row td {
      border-top: 2px solid ${brandDark};
      padding-top: 10px;
    }
    .total-reconciliation-block {
      margin-top: 18px;
      page-break-inside: avoid;
      break-inside: avoid;
      break-before: auto;
    }
    .total-reconciliation-block.force-page-break-before {
      page-break-before: always;
      break-before: page;
    }
    .total-reconciliation-block .appendix-table--recon,
    .total-reconciliation-block .subtle-p {
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .page--scope-pricing-flow {
      position: static;
      min-height: 0;
      page-break-inside: auto;
    }
    .page--scope-pricing-flow .appendix-block {
      page-break-inside: auto;
    }
    .line-item-detail-block {
      margin-top: 4px;
    }
    .line-item-subhead {
      font-size: 10pt;
      font-weight: 700;
      color: ${brandDark};
      margin: 14px 0 8px;
      padding-bottom: 4px;
      border-bottom: 1px solid #e2e8f0;
    }

    .appendix-block { margin-bottom: 18px; page-break-inside: avoid; }
    .appendix-head {
      font-size: 10pt;
      font-weight: 700;
      color: ${brandDark};
      margin: 0 0 6px;
    }
    .appendix-table th,
    .appendix-table td {
      padding: 6px 8px;
      border-bottom: 1px solid #e8ecf1;
      font-size: 9pt;
    }
    .appendix-table th {
      background: #f8fafc;
      font-size: 7.5pt;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: ${muted};
    }
    .subtotal-row td {
      font-weight: 700;
      background: #f8fafc;
    }
  </style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`;
}
