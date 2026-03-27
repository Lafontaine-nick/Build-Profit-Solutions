import { ContractDoc } from "../contracts/types";

export type ContractPdfMode = "client" | "detailed";
export type ContractTemplateState = "nevada" | "utah" | "other";
export type ContractType = "home-improvement" | "construction";

export type ContractWarning = {
  id: string;
  level: "info" | "warning";
  message: string;
};

export type ContractBranding = {
  companyName?: string;
  contractorName?: string;
  contractorTitle?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyWebsite?: string;
  licenseNumber?: string;
  insuranceStatus?: boolean;
  verifiedContractor?: boolean;
  businessAddress?: string;
  logoUrl?: string;
  accentColorHex?: string;
};

export type ContractBuildOptions = {
  pdfMode: ContractPdfMode;
  state: ContractTemplateState;
  projectType?: string;
  contractType: ContractType;
  branding: ContractBranding;
};

type ClausePack = {
  heading: string;
  clauses: string[];
  warnings: ContractWarning[];
  disclaimer: string;
};

const toTitleCase = (value?: string) =>
  String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const nonEmpty = (...values: Array<unknown>) =>
  values
    .map((value) => String(value ?? "").trim())
    .find(Boolean);

export const resolveBrandImageUrl = (profile: any): string | undefined =>
  nonEmpty(
    profile?.logoUrl,
    profile?.companyLogo,
    profile?.companyLogoUrl,
    profile?.profileImageUrl,
    profile?.profileImage,
    profile?.avatar,
  );

export const resolveContractBranding = (profile: any): ContractBranding => {
  const licenseValue = Array.isArray(profile?.licenses)
    ? profile.licenses.find((value: unknown) => String(value || "").trim())
    : profile?.licenseNumber || profile?.licenseNo;
  const insuranceStatus = Boolean(
    profile?.insuranceStatus ||
      profile?.insured ||
      (profile?.insurance &&
        Object.values(profile.insurance).some((value) => value === true)),
  );

  return {
    companyName: nonEmpty(profile?.companyName, profile?.company),
    contractorName: nonEmpty(profile?.contractorName, profile?.name),
    contractorTitle: nonEmpty(profile?.contractorTitle, profile?.role),
    companyPhone: nonEmpty(profile?.companyPhone, profile?.phone),
    companyEmail: nonEmpty(profile?.companyEmail, profile?.email),
    companyWebsite: nonEmpty(profile?.companyWebsite, profile?.website),
    licenseNumber: nonEmpty(licenseValue),
    insuranceStatus,
    verifiedContractor: Boolean(profile?.verifiedContractor || profile?.isVerified),
    businessAddress: nonEmpty(profile?.businessAddress, profile?.location),
    logoUrl: resolveBrandImageUrl(profile),
    accentColorHex: nonEmpty(profile?.brandColorHex, profile?.accentColorHex),
  };
};

export const sanitizeContractDoc = (
  doc: ContractDoc,
  options: ContractBuildOptions,
): ContractDoc => {
  const projectTypeLabel = toTitleCase(options.projectType) || "Project";
  const rawProjectName = String(doc.summary.projectName || "").trim();
  const rawClientName = String(doc.owner.legalName || "").trim();
  const normalizedProjectType = String(options.projectType || "").trim().toLowerCase();
  const cleanProjectName =
    !rawProjectName || rawProjectName.toLowerCase() === "untitled bid"
      ? `${projectTypeLabel} Proposal`
      : rawProjectName;
  const cleanClientName =
    !rawClientName || rawClientName.toLowerCase().includes("unknown")
      ? "Client"
      : rawClientName;
  const cleanAddress = String(doc.summary.siteAddress || "")
    .replace(/\s+,/g, ",")
    .replace(/\s{2,}/g, " ")
    .trim();
  const looksLikeNewBuild =
    normalizedProjectType.includes("new_build") ||
    normalizedProjectType.includes("new build") ||
    normalizedProjectType.includes("new-build");
  const looksLikeRemodel =
    !looksLikeNewBuild &&
    /\b(remodel|renovation|addition|kitchen|bathroom|repair|upgrade)\b/i.test(cleanProjectName);
  const cleanScopeBullets = (doc.scope.bullets || [])
    .map((bullet) => String(bullet || "").trim())
    .filter(Boolean)
    .filter((bullet) => !looksLikeRemodel || !newBuildScopePhrases.test(bullet));
  const rawScopeDescription = String(doc.scope.description || "").trim();
  const cleanScopeDescription =
    looksLikeRemodel && newBuildScopePhrases.test(rawScopeDescription) ? "" : rawScopeDescription;

  return {
    ...doc,
    summary: {
      ...doc.summary,
      projectName: cleanProjectName,
      siteAddress: cleanAddress,
    },
    owner: {
      ...doc.owner,
      legalName: cleanClientName,
      address: cleanAddress || doc.owner.address,
    },
    scope: {
      ...doc.scope,
      bullets: cleanScopeBullets,
      description: cleanScopeDescription,
    },
  };
};

export const validateContractPreflight = (
  doc: ContractDoc,
  options: ContractBuildOptions,
): ContractWarning[] => {
  const warnings: ContractWarning[] = [];
  const startDate = String(doc.summary.startDate || "").trim();
  const endDate = String(doc.summary.endDate || "").trim();
  const totalBid = Number(doc.summary.totalBid || 0);
  const paymentTotal = (doc.milestones || []).reduce(
    (sum, milestone) => sum + Number(milestone.paymentAmount || milestone.amount || 0),
    0,
  );
  const paymentPct = (doc.milestones || []).reduce(
    (sum, milestone) =>
      sum +
      Number(
        milestone.percentage ??
          milestone.percent ??
          (totalBid > 0
            ? ((Number(milestone.paymentAmount || milestone.amount || 0) / totalBid) * 100)
            : 0),
      ),
    0,
  );
  const firstPaymentPct =
    totalBid > 0
      ? ((doc.milestones?.[0]?.paymentAmount || doc.milestones?.[0]?.amount || 0) / totalBid) * 100
      : 0;

  if (!String(doc.owner.legalName || "").trim()) {
    warnings.push({
      id: "missing-client",
      level: "warning",
      message: "Client name is missing. The PDF will use a generic client label.",
    });
  }

  if (!String(doc.scope.description || "").trim() && !(doc.scope.bullets || []).length) {
    warnings.push({
      id: "missing-scope",
      level: "warning",
      message: "Scope summary is missing. Add a concise project description before sending.",
    });
  }

  if (!startDate || !endDate || startDate === "TBD" || endDate === "TBD") {
    warnings.push({
      id: "missing-dates",
      level: "warning",
      message: "Project dates are incomplete. Review the schedule before sharing the agreement.",
    });
  }

  if (totalBid > 0 && Math.abs(paymentTotal - totalBid) > 1) {
    warnings.push({
      id: "payment-total",
      level: "warning",
      message: "Payment amounts do not match the contract total. Review milestone math before sending.",
    });
  }

  if ((doc.milestones || []).length > 0 && Math.abs(paymentPct - 100) > 0.25) {
    warnings.push({
      id: "payment-percent",
      level: "warning",
      message: "Payment percentages do not total 100%. The schedule should be reviewed before client use.",
    });
  }

  if (options.state === "other") {
    warnings.push({
      id: "unsupported-state",
      level: "warning",
      message: "Generic draft only. Review with local counsel before client use.",
    });
  }

  if (options.state === "nevada" && firstPaymentPct > 10) {
    warnings.push({
      id: "nevada-deposit",
      level: "warning",
      message:
        "Nevada review recommended: upfront payment exceeds the draft template threshold. Confirm current residential deposit rules before sending.",
    });
  }

  if (options.state === "utah") {
    warnings.push({
      id: "utah-review",
      level: "info",
      message:
        "Utah template language is included, but the contractor should still review cancellation and notice requirements before use.",
    });
  }

  return warnings;
};

export const getBaseBusinessTerms = (
  doc: ContractDoc,
  options: ContractBuildOptions,
): string[] => {
  const permitHolder = options.state === "other" ? "Contractor" : "Contractor";
  const permitPayer = options.branding.insuranceStatus ? "Owner unless otherwise listed in the proposal" : "Owner";
  const warrantyYears = doc.terms.warrantyYears || 1;

  return [
    "Scope & Approvals: The attached proposal summary and scope pages describe the work included in this agreement. Any modifications must be approved in writing before work proceeds.",
    "Pricing & Changes: The contract total reflects the current scope, assumptions, and schedule. Added work, hidden conditions, substitutions, and owner-requested revisions are handled through written change orders.",
    "Payments: Payments are due according to the attached payment schedule. Delinquent balances may pause scheduling, procurement, or project progress until resolved.",
    `Permits & Inspections: ${permitHolder} is responsible for securing permits and coordinating inspections unless this proposal states otherwise. Permit fees are paid by ${permitPayer.toLowerCase()}.`,
    `Warranty: Workmanship is covered for ${warrantyYears} year${warrantyYears === 1 ? "" : "s"} from substantial completion unless a narrower written warranty applies. Manufacturer warranties remain with the product maker.`,
    "Access & Protection: Owner will provide reasonable access, utilities, and decision-making in time to keep work moving. Contractor will use standard dust protection and site safety practices appropriate for the job.",
  ];
};

export const getStateClausePack = (
  state: ContractTemplateState,
): ClausePack => {
  switch (state) {
    case "nevada":
      return {
        heading: "Nevada",
        clauses: [
          "Confirm licensing, deposit, and notice rules for Nevada residential work before client delivery.",
          "Deposits and progress payments should match the final scope and current Nevada residential requirements.",
        ],
        warnings: [],
        disclaimer: "",
      };
    case "utah":
      return {
        heading: "Utah",
        clauses: [
          "Confirm registration, cancellation, and consumer-notice requirements for Utah residential work before client delivery.",
          "Attach applicable Utah cancellation or consumer disclosures before signature when your sale type requires them.",
        ],
        warnings: [],
        disclaimer: "",
      };
    default:
      return {
        heading: "Generic Draft Language",
        clauses: [
          "Generic Draft Notice: This agreement is generated from a general business template and may not include all notices or clauses required in the project state.",
          "Local Review: The contractor should review payment, cancellation, licensing, and dispute provisions with local counsel before using this document with a client.",
        ],
        warnings: [
          {
            id: "generic-draft",
            level: "warning",
            message: "Generic draft only. Review with local counsel before client use.",
          },
        ],
        disclaimer:
          "This is a draft contract template and may not include all clauses required in your state.",
      };
  }
};

export const getProjectTypePack = (projectType?: string): ClausePack => {
  const normalized = String(projectType || "").trim().toLowerCase();

  if (normalized.includes("new build") || normalized.includes("new-build")) {
    return {
      heading: "New Build Clauses",
      clauses: [
        "Construction sequencing, inspections, and trade coordination are based on the approved plans and may adjust if engineering, permitting, or utility requirements change.",
        "Selections and owner-furnished items must be approved in time to avoid schedule impacts. Late selections may delay completion and require change-order pricing.",
      ],
      warnings: [],
      disclaimer:
        "Project-specific construction assumptions should be reviewed against the final plans and specifications.",
    };
  }

  if (normalized.includes("service")) {
    return {
      heading: "Service Work Clauses",
      clauses: [
        "Service work pricing is based on the observable condition of the work area at the time of estimate. Hidden conditions discovered after arrival or access may require revised pricing.",
        "Temporary repairs, diagnostics, and exploratory work are limited to the scope stated in this proposal unless expanded by written authorization.",
      ],
      warnings: [],
      disclaimer:
        "Service work templates should be reviewed to confirm the exact site condition and repair scope.",
    };
  }

  return {
    heading: "Remodel & Improvement Clauses",
    clauses: [
      "Remodel pricing assumes reasonable access to the existing work area and existing conditions that are materially consistent with the visible site at the time of estimate.",
      "Hidden damage, framing deficiencies, code corrections, and hazardous-material findings discovered after demolition are outside the base scope and require written change-order approval.",
    ],
    warnings: [],
    disclaimer:
      "Remodel scope assumptions should be reviewed against final selections and site conditions before signature.",
  };
};

const newBuildScopePhrases =
  /\b(new\s+house|full\s+house|ground\s*up|new\s+construction|whole\s+house\s+build|full\s+new\s+house)\b/i;
const remodelProjectPhrases =
  /\b(remodel|renovation|addition|kitchen|bathroom|tenant\s+improvement|upgrade|repair)\b/i;

const getFallbackExecutiveSummary = (projectType?: string): string => {
  const normalized = String(projectType || "")
    .trim()
    .toLowerCase();

  if (
    normalized.includes("new_build") ||
    normalized.includes("new build") ||
    normalized.includes("new-build")
  ) {
    return "Ground-up construction scope, commercial terms, and schedule prepared for client review.";
  }

  if (normalized.includes("service")) {
    return "Service scope, commercial terms, and schedule prepared for client review.";
  }

  return "Remodel scope, commercial terms, and schedule prepared for client review.";
};

/**
 * Prefer scope bullets; avoid showing a "new build" narrative when the estimate type is remodel/improvement.
 */
export const resolveExecutiveSummaryText = (
  doc: ContractDoc,
  options: ContractBuildOptions,
): string => {
  const pt = String(options.projectType || "")
    .trim()
    .toLowerCase();
  const projectName = String(doc.summary.projectName || "").trim().toLowerCase();
  const isNewBuildProject =
    pt.includes("new_build") || pt.includes("new build") || pt.includes("new-build");
  const looksLikeRemodelProject =
    !isNewBuildProject && remodelProjectPhrases.test(projectName);

  const bullets = (doc.scope.bullets || []).map((b) => String(b).trim()).filter(Boolean);
  const desc = String(doc.scope.description || "").trim();

  if (bullets.length) {
    const useBullets =
      isNewBuildProject || !looksLikeRemodelProject
        ? bullets
        : bullets.filter((b) => !newBuildScopePhrases.test(b));

    if (useBullets.length) {
      return useBullets.join(". ").trim().slice(0, 420);
    }
  }

  if (desc) {
    if ((looksLikeRemodelProject || !isNewBuildProject) && newBuildScopePhrases.test(desc)) {
      return getFallbackExecutiveSummary(options.projectType);
    }
    return desc.slice(0, 420);
  }

  return getFallbackExecutiveSummary(options.projectType);
};

/** Single paragraph for the legal page — avoids repeating headers + disclaimers + clause bullets. */
export const getStateLegalSummary = (state: ContractTemplateState): string => {
  switch (state) {
    case "nevada":
      return "Nevada residential work: confirm licensing, deposit limits, and notice rules against your final scope before client delivery. Disputes are typically reviewed under Nevada law in the county where the project is located unless otherwise agreed in writing.";
    case "utah":
      return "Utah residential work: confirm contractor registration, cancellation rights, and required consumer notices for your sale type; attach statutory disclosures before signature where applicable. Disputes are typically reviewed under Utah law in the county where the project is located unless otherwise agreed in writing.";
    default:
      return "This draft uses general business language only. It may omit notices or clauses required where the project is located—review payment, cancellation, licensing, and dispute terms with local counsel before client use.";
  }
};

export const buildContractSections = (
  doc: ContractDoc,
  options: ContractBuildOptions,
) => {
  const baseTerms = getBaseBusinessTerms(doc, options);
  const statePack = getStateClausePack(options.state);
  const projectPack = getProjectTypePack(options.projectType);
  const warnings = [
    ...validateContractPreflight(doc, options),
    ...statePack.warnings,
    ...projectPack.warnings,
  ];
  const draftLabel =
    options.state === "other" ? "Draft Agreement" : "Client Review Required";
  const disclaimer =
    options.state === "other"
      ? "This is a draft contract template and may not include all clauses required in your state."
      : "This document includes template language for the selected state and should be reviewed before use.";
  const readinessItems = [
    {
      label: "Pricing validated",
      value:
        Number(doc.summary.totalBid || 0) > 0 &&
        Math.abs(
          (doc.milestones || []).reduce(
            (sum, milestone) => sum + Number(milestone.paymentAmount || milestone.amount || 0),
            0,
          ) - Number(doc.summary.totalBid || 0),
        ) < 1,
    },
    {
      label: "Payment schedule balanced",
      value:
        Math.abs(
          (doc.milestones || []).reduce(
            (sum, milestone) =>
              sum +
              Number(
                milestone.percentage ??
                  milestone.percent ??
                  ((Number(milestone.paymentAmount || milestone.amount || 0) /
                    Math.max(Number(doc.summary.totalBid || 1), 1)) *
                    100),
              ),
            0,
          ) - 100,
        ) < 0.25,
    },
    {
      label: "Required fields completed",
      value: Boolean(doc.owner.legalName && doc.summary.projectName && doc.summary.siteAddress),
    },
  ];

  return {
    baseTerms,
    statePack,
    projectPack,
    warnings,
    readinessItems,
    draftLabel,
    disclaimer,
  };
};
