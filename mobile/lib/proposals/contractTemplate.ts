import { ContractDoc } from "../contracts/types";
import { sanitizeStoredProfileAvatar } from "../profileAvatar";
import { DEFAULT_PROFILE_AVATAR_DATA_URL } from "./defaultProfileAvatarDataUrl";

/**
 * - `client` — summarized Scope & pricing (no line-item tables).
 * - `detailed` — full line-item detail + pricing summary + reconciliation (default for contract export).
 * - `full` — treated like `detailed` so “generate PDF” always includes the full breakdown.
 */
export type ContractPdfMode = "client" | "detailed" | "full";

export const normalizeContractPdfMode = (mode?: ContractPdfMode): "client" | "detailed" => {
  if (mode === "client") return "client";
  return "detailed";
};
export type ContractTemplateState = "nevada" | "utah" | "other";
export type ContractType = "home-improvement" | "construction";

/** `client` — PDF copy for homeowner delivery. `internal` — draft checklist + legal warnings on the packet. */
export type ContractAudience = "client" | "internal";

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

export type PaymentScheduleVariant = "weekly_progress" | "milestone_based" | "custom";

export type ContractBuildOptions = {
  pdfMode: ContractPdfMode;
  state: ContractTemplateState;
  projectType?: string;
  contractType: ContractType;
  branding: ContractBranding;
  /** From estimate Step 7 — used for custom-schedule export warnings. */
  paymentScheduleVariant?: PaymentScheduleVariant | string;
  /** Defaults to `client` when omitted (estimate export). */
  contractAudience?: ContractAudience;
  /**
   * When set, replaces default “Project assumptions” bullets on the Scope & pricing PDF page.
   * Omit or leave undefined to use template defaults.
   */
  customProjectAssumptions?: string[];
  /** When set, replaces numbered “Business terms” on the contract terms page. */
  customBusinessTerms?: string[];
  /** When set, replaces “Job-specific assumptions” bullets on the contract terms page. */
  customWorkTypeAssumptions?: string[];
};

/** Strips a leading editor marker (-, •, etc.) before PDF/HTML list rendering so bullets are not duplicated. */
export const stripEditorListPrefix = (value: string): string =>
  String(value ?? "")
    .trim()
    .replace(/^\s*[-–—•*]\s*/, "");

/** Default proposal price-lock window when the bid has no explicit validity field (matches other in-app copy). */
export const DEFAULT_PROPOSAL_VALIDITY_DAYS = 30;

/** Default right-column bullets on the Scope & pricing page (same as legacy `buildProposalHtml` list). */
export const DEFAULT_PROJECT_ASSUMPTION_BULLETS: string[] = [
  "- Pricing is all-inclusive for the scope described. Nothing is hidden unless specifically excluded in the proposal.",
  "- This proposal is based on the visible site conditions and information available at the time of estimate.",
  "- Permits, plans, engineering, utility fees, inspections, and other project-related fees are billed at actual cost unless specifically included in the proposal.",
  "- Change orders are priced and approved in writing before additional work continues.",
  "- Reasonable site protection, cleanup, and debris handling are included unless otherwise noted.",
  `- Pricing is valid for ${DEFAULT_PROPOSAL_VALIDITY_DAYS} days from the proposal date due to labor, material, and supplier price changes.`,
];

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

export const resolveBrandImageUrl = (profile: any): string | undefined => {
  const userAvatar = sanitizeStoredProfileAvatar(profile?.avatar);
  const userLogo = sanitizeStoredProfileAvatar(profile?.logoUrl);
  return nonEmpty(
    userLogo,
    userAvatar,
    sanitizeStoredProfileAvatar(profile?.companyLogo),
    sanitizeStoredProfileAvatar(profile?.companyLogoUrl),
    sanitizeStoredProfileAvatar(profile?.profileImageUrl),
    sanitizeStoredProfileAvatar(profile?.profileImage),
  );
};

/** Uploaded logo/avatar, or the same default image shown on the Profile screen. */
export const resolveContractCoverImageUrl = (profile: any): string => {
  const uploaded = resolveBrandImageUrl(profile);
  return uploaded || DEFAULT_PROFILE_AVATAR_DATA_URL;
};

/** Cover header “company” line: prefer saved company, then doc legal name, then person name before app default. */
export const resolvePdfHeaderCompany = (
  branding: ContractBranding,
  contractor: { legalName?: string; contactName?: string },
): string =>
  nonEmpty(
    branding.companyName,
    contractor?.legalName,
    branding.contractorName,
    contractor?.contactName,
  ) || "Build Profit Solutions";

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

const newBuildScopePhrases =
  /\b(new\s+house|full\s+house|ground\s*up|new\s+construction|whole\s+house\s+build|full\s+new\s+house|full\s+new\s+house\s+build)\b/i;
const remodelProjectPhrases =
  /\b(remodel|renovation|addition|kitchen|bathroom|tenant\s+improvement|upgrade|repair)\b/i;

/** Primary signal is estimate `projectType`; project title can disambiguate obvious mismatches. */
export type EstimateProjectKind = "new_build" | "service" | "remodel_or_other";

export const classifyEstimateProjectKind = (options: ContractBuildOptions): EstimateProjectKind => {
  const pt = String(options.projectType || "")
    .trim()
    .toLowerCase();
  if (
    pt.includes("new_build") ||
    pt.includes("new build") ||
    pt.includes("new-build") ||
    pt.includes("newbuild")
  ) {
    return "new_build";
  }
  if (pt.includes("service")) {
    return "service";
  }
  return "remodel_or_other";
};

/**
 * When the estimate type and project title obviously disagree (e.g. “Justin remodel” vs new-build
 * type), prefer a coherent kind for PDF scope, clauses, and labels.
 */
export const getEffectiveEstimateKind = (
  options: ContractBuildOptions,
  doc: ContractDoc,
): EstimateProjectKind => {
  const base = classifyEstimateProjectKind(options);
  const pn = String(doc.summary?.projectName || "").trim();
  if (!pn) return base;

  const nameSuggestsRemodel =
    /\b(remodel|renovation|addition|kitchen|bathroom|basement|bath)\b/i.test(pn);
  const nameSuggestsNewBuild =
    /\b(new\s+house|ground\s*up|new\s+construction|whole\s+house)\b/i.test(pn);

  if (base === "new_build" && nameSuggestsRemodel && !nameSuggestsNewBuild) {
    return "remodel_or_other";
  }
  if (base === "remodel_or_other" && nameSuggestsNewBuild && !nameSuggestsRemodel) {
    return "new_build";
  }
  return base;
};

export const defaultScopeBulletForKind = (
  kind: EstimateProjectKind,
  projectTypeLabel: string,
): string => {
  if (kind === "new_build") {
    return `New construction work for this project (${projectTypeLabel}).`;
  }
  if (kind === "service") {
    return `Service work for this project (${projectTypeLabel}).`;
  }
  return `Residential remodel work for this project (${projectTypeLabel}).`;
};

/** Tighten typography before punctuation (e.g. "project ." → "project.") */
export const fixSpacingBeforePunctuation = (text: string): string =>
  String(text || "")
    .replace(/\s+([.,;:!?])/g, "$1")
    .replace(/\s+([)\]}»"'”])/g, "$1")
    .trim();

export const sanitizeContractDoc = (
  doc: ContractDoc,
  options: ContractBuildOptions,
): ContractDoc => {
  const projectTypeLabel = toTitleCase(options.projectType) || "Project";
  const rawProjectName = String(doc.summary.projectName || "").trim();
  const rawClientName = String(doc.owner.legalName || "").trim();
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
  const kind = getEffectiveEstimateKind(options, doc);
  const rawBullets = (doc.scope.bullets || [])
    .map((bullet) => stripEditorListPrefix(String(bullet || "")))
    .filter(Boolean);
  let cleanScopeBullets =
    kind === "new_build"
      ? rawBullets.filter((b) => !remodelProjectPhrases.test(b))
      : rawBullets.filter((b) => !newBuildScopePhrases.test(b));
  const rawScopeDescription = String(doc.scope.description || "").trim();
  let cleanScopeDescription = rawScopeDescription;
  if (kind === "new_build" && remodelProjectPhrases.test(rawScopeDescription)) {
    cleanScopeDescription = "";
  }
  if (kind !== "new_build" && newBuildScopePhrases.test(rawScopeDescription)) {
    cleanScopeDescription = "";
  }

  if (cleanScopeBullets.length === 0) {
    cleanScopeBullets = [defaultScopeBulletForKind(kind, projectTypeLabel)];
  }

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

  if (totalBid > 0 && !computeClientPricingBreakdown(doc).reconciles) {
    warnings.push({
      id: "pricing-reconcile",
      level: "warning",
      message:
        "Pricing roll-up may not match the contract total. Review materials, labor, direct costs, and total in the estimate before sending.",
    });
  }

  if (!startDate || !endDate || startDate === "TBD" || endDate === "TBD") {
    warnings.push({
      id: "missing-dates",
      level: "warning",
      message: "Project dates are incomplete. Review the schedule before sharing the agreement.",
    });
  }

  const paymentRows = doc.milestones || [];
  const isCustomSchedule = options.paymentScheduleVariant === "custom";

  if (totalBid > 0 && paymentRows.length > 0) {
    if (isCustomSchedule) {
      if (paymentPct < 99.75) {
        warnings.push({
          id: "custom-schedule-under",
          level: "warning",
          message: `Custom payment schedule totals ${paymentPct.toFixed(1)}% of the contract ($${paymentTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} of $${totalBid.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}). Add or adjust payments so the schedule reaches 100% before sending.`,
        });
      } else if (paymentPct > 100.25) {
        warnings.push({
          id: "custom-schedule-over",
          level: "warning",
          message: `Custom payment schedule totals ${paymentPct.toFixed(1)}% of the contract ($${paymentTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}), which exceeds the contract total. Reduce payment amounts before sending.`,
        });
      } else if (Math.abs(paymentTotal - totalBid) > 1) {
        warnings.push({
          id: "custom-schedule-amount",
          level: "warning",
          message:
            "Custom payment dollar amounts do not match the contract total after rounding. Review each payment row before sending.",
        });
      }
    } else {
      if (Math.abs(paymentTotal - totalBid) > 1) {
        warnings.push({
          id: "payment-total",
          level: "warning",
          message: "Payment amounts do not match the contract total. Review milestone math before sending.",
        });
      }

      if (Math.abs(paymentPct - 100) > 0.25) {
        warnings.push({
          id: "payment-percent",
          level: "warning",
          message:
            "Payment percentages do not total 100%. The schedule should be reviewed before client use.",
        });
      }
    }
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

export const normalizeContractAudience = (audience?: ContractAudience): ContractAudience =>
  audience === "internal" ? "internal" : "client";

/**
 * Client-facing PDFs omit preflight / “generic draft” bullets — the contractor already sees those in the pre-export alert.
 * Internal preview keeps the full warning list on the terms page.
 */
export const filterContractWarningsForAudience = (
  warnings: ContractWarning[],
  audience: ContractAudience,
): ContractWarning[] => {
  if (audience === "internal") return warnings;
  return [];
};

export const getBaseBusinessTerms = (
  doc: ContractDoc,
  _options: ContractBuildOptions,
): string[] => {
  const warrantyYears = doc.terms.warrantyYears || 1;

  return [
    "- Scope & Approvals: The attached proposal summary, pricing pages, drawings, selections, and scope notes describe the work included in this agreement. Any work not specifically listed is excluded unless approved in a written change order.",
    "- Pricing & Changes: The contract total reflects the current scope, assumptions, schedule, and available information at the time of proposal. Added work, hidden conditions, substitutions, owner-requested revisions, and code-required changes are handled through written change orders.",
    "- Deposit & Start of Work: Work will not be scheduled, ordered, or started until the required deposit, signed agreement, and required selections or approvals are received.",
    "- Payments: Payments are due according to the attached payment schedule. Delinquent balances may pause scheduling, procurement, inspections, and project progress until resolved.",
    "- Permits & Inspections: Contractor is responsible for coordinating permits and inspections only when included in the proposal. Permit fees, plan fees, engineering, utility fees, and inspection-related charges are paid by owner unless otherwise listed.",
    "- Concealed Conditions: Hidden damage, framing deficiencies, rot, mold, asbestos, hazardous materials, utility conflicts, code corrections, and other concealed conditions are outside the base scope and require written change-order approval.",
    "- Owner Selections & Materials: Owner selections, finishes, fixtures, appliances, and owner-furnished materials must be approved before ordering or installation. Delays or changes in selections may affect price, schedule, and warranty coverage.",
    "- Access & Protection: Owner will provide reasonable access, parking, utilities, and decision-making in time to keep work moving. Contractor will use reasonable dust protection, cleanup, and site safety practices appropriate for the job.",
    `- Warranty: Workmanship is covered for ${warrantyYears} year${warrantyYears === 1 ? "" : "s"} from substantial completion unless a different written warranty applies. Manufacturer warranties remain with the product maker. Warranty does not cover owner-furnished materials, misuse, normal wear, lack of maintenance, or work performed by others.`,
    "- Schedule & Delays: Project timelines are estimates and may be affected by weather, inspections, permitting, material availability, change orders, owner decisions, hidden conditions, or circumstances outside contractor control.",
    "- Legal & Jurisdiction Notices: Required licensing, lien, cancellation, dispute-resolution, insurance, and consumer-protection notices must be confirmed for the project location before client use.",
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
        heading: "General terms",
        clauses: [
          "This template may omit state-specific notices. Have local counsel review payment, cancellation, licensing, and dispute terms before client delivery.",
        ],
        warnings: [],
        disclaimer: "Draft only—confirm required clauses for the project jurisdiction.",
      };
  }
};

/** Client-safe label for the remainder after M/L/direct job costs (covers PM, coordination, company overhead, and contractor margin). */
export const BUILDER_FEE_LABEL =
  "Project management & coordination (scheduling, supervision, documentation)";

export const formatProjectTypeLabel = (projectType?: string): string =>
  toTitleCase(projectType) || "Project";

/** Client-facing label aligned to effective estimate kind (not the raw type string). */
export const formatProjectKindDisplayLabel = (kind: EstimateProjectKind): string => {
  switch (kind) {
    case "new_build":
      return "New build";
    case "service":
      return "Service";
    default:
      return "Residential remodel";
  }
};

export type ClientPricingBreakdown = {
  materials: number;
  labor: number;
  directCosts: number;
  builderFee: number;
  contractTotal: number;
  subtotalDirectCosts: number;
  reconciles: boolean;
};

/** Aligns contract total with M + L + direct + builder fee (no markup % shown to client). */
export const computeClientPricingBreakdown = (doc: ContractDoc): ClientPricingBreakdown => {
  const materials = Math.round(Number(doc.materials || 0) * 100) / 100;
  const labor = Math.round(Number(doc.labor || 0) * 100) / 100;
  const directCosts = Math.round(Number(doc.permitCosts || 0) * 100) / 100;
  const contractTotal = Math.round(Number(doc.summary.totalBid || 0) * 100) / 100;
  const subtotalDirectCosts = Math.round((materials + labor + directCosts) * 100) / 100;
  const builderFee = Math.round((contractTotal - subtotalDirectCosts) * 100) / 100;
  const builderFeeSafe = Math.max(0, builderFee);
  const sum = Math.round((subtotalDirectCosts + builderFeeSafe) * 100) / 100;
  const reconciles = Math.abs(sum - contractTotal) < 0.02;
  return {
    materials,
    labor,
    directCosts,
    builderFee: builderFeeSafe,
    contractTotal,
    subtotalDirectCosts,
    reconciles,
  };
};

/** Optional job-specific bullets on the contract terms page — empty by default; contractor adds as needed. */
export const DEFAULT_JOB_SPECIFIC_ASSUMPTION_CLAUSES: string[] = [];

export const getProjectTypePackForKind = (_kind: EstimateProjectKind): ClausePack => ({
  heading: "Job-specific assumptions",
  clauses: [...DEFAULT_JOB_SPECIFIC_ASSUMPTION_CLAUSES],
  warnings: [],
  disclaimer: "",
});

/** @deprecated Prefer getProjectTypePackForKind(getEffectiveEstimateKind(...)) for PDFs */
export const getProjectTypePack = (projectType?: string): ClausePack =>
  getProjectTypePackForKind(
    classifyEstimateProjectKind({
      pdfMode: "client",
      state: "other",
      contractType: "construction",
      branding: {},
      projectType,
    }),
  );

const formatScheduleDate = (value: string) => {
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
};

/** Label + value for “At a glance” / HTML rail — never mislabel a date range as “estimated duration”. */
export const getScheduleSummaryForContract = (
  doc: ContractDoc,
): { label: string; value: string } => {
  const start = String(doc.summary.startDate || "").trim();
  const end = String(doc.summary.endDate || "").trim();
  const startOk = start && start !== "TBD";
  const endOk = end && end !== "TBD";
  const days = Math.max(0, Number(doc.summary.durationDays || 0));

  if (startOk && endOk) {
    return {
      label: "Schedule",
      value: `${formatScheduleDate(start)} – ${formatScheduleDate(end)}`,
    };
  }
  if (days > 0) {
    const weeks = Math.max(1, Math.round(days / 7));
    return {
      label: "Project duration",
      value: `${weeks} week${weeks === 1 ? "" : "s"}`,
    };
  }
  return { label: "Schedule", value: "TBD" };
};

const getFallbackExecutiveSummaryForKind = (kind: EstimateProjectKind): string => {
  switch (kind) {
    case "new_build":
      return "Ground-up construction scope, commercial terms, and schedule prepared for client review.";
    case "service":
      return "Service scope, commercial terms, and schedule prepared for client review.";
    default:
      return "Remodel scope, commercial terms, and schedule prepared for client review.";
  }
};

/**
 * Prefer scope bullets; avoid showing a "new build" narrative when the estimate type is remodel/improvement.
 */
export const resolveExecutiveSummaryText = (
  doc: ContractDoc,
  options: ContractBuildOptions,
): string => {
  const kind = getEffectiveEstimateKind(options, doc);

  const bullets = (doc.scope.bullets || []).map((b) => String(b).trim()).filter(Boolean);
  const desc = String(doc.scope.description || "").trim();

  if (bullets.length) {
    const useBullets =
      kind === "new_build"
        ? bullets.filter((b) => !remodelProjectPhrases.test(b))
        : bullets.filter((b) => !newBuildScopePhrases.test(b));

    if (useBullets.length) {
      return useBullets.join(". ").trim().slice(0, 420);
    }
  }

  if (desc) {
    if (kind !== "new_build" && newBuildScopePhrases.test(desc)) {
      return getFallbackExecutiveSummaryForKind(kind);
    }
    if (kind === "new_build" && remodelProjectPhrases.test(desc)) {
      return getFallbackExecutiveSummaryForKind(kind);
    }
    return desc.slice(0, 420);
  }

  return getFallbackExecutiveSummaryForKind(kind);
};

/**
 * Single narrative paragraph for scope pages — does not repeat “Included work” bullets listed below.
 */
export const resolveScopeNarrativeParagraph = (
  doc: ContractDoc,
  options: ContractBuildOptions,
): string => {
  return normalizeProjectContractCopy(doc, options).scopeSummary;
};

/** Canonical PDF copy: one project type, one scope story, aligned included-work lines (no mixed remodel/new-build). */
export type ProjectContractCopy = {
  projectTypeLabel: string;
  /** Cover summary + page 2 scope paragraph */
  scopeSummary: string;
  /** Included work bullets, contradiction-filtered */
  includedWorkBullets: string[];
  /** Single-line synopsis for rails / footers when needed */
  includedWorkLine: string;
};

const PAREN_NEW_BUILD = /\(\s*new\s*build\s*\)|\(\s*ground[\s-]*up\s*\)|\(\s*new\s*construction\s*\)/gi;
const PAREN_REMODEL = /\(\s*remodel\s*\)|\(\s*renovation\s*\)/gi;

/** Strip parenthetical tags that contradict the resolved project kind. */
export const normalizeIncludedWorkText = (text: string, kind: EstimateProjectKind): string => {
  let t = String(text || "").trim();
  if (!t) return "";
  if (kind === "new_build" || kind === "service") {
    t = t.replace(PAREN_REMODEL, "").trim();
  }
  if (kind !== "new_build") {
    t = t.replace(PAREN_NEW_BUILD, "").trim();
  }
  t = t.replace(/\s{2,}/g, " ");
  if (kind === "remodel_or_other") {
    if (
      /\bnew\s+build\b/i.test(t) &&
      !newBuildScopePhrases.test(t) &&
      !/\b(remodel|renovation|addition|kitchen|bathroom)\b/i.test(t)
    ) {
      t = t.replace(/\bnew\s+build\b/gi, "this project");
    }
  }
  return t.replace(/\s{2,}/g, " ").trim();
};

const normalizeCopyForComparison = (text: string): string =>
  fixSpacingBeforePunctuation(String(text || ""))
    .trim()
    .replace(/[.!?]+$/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();

/**
 * Derives canonical labels and scope copy from estimate type, description, bullets, and project name.
 * Call after `sanitizeContractDoc` so bullets are already partially cleaned.
 */
export const normalizeProjectContractCopy = (
  doc: ContractDoc,
  options: ContractBuildOptions,
): ProjectContractCopy => {
  const kind = getEffectiveEstimateKind(options, doc);
  const projectTypeLabel = formatProjectKindDisplayLabel(kind);

  const rawBullets = (doc.scope.bullets || [])
    .map((b) => stripEditorListPrefix(String(b)))
    .filter(Boolean);
  /** Same contradiction filter as `sanitizeContractDoc` so included work never mixes remodel vs new-build. */
  const filteredBullets =
    kind === "new_build"
      ? rawBullets.filter((b) => !remodelProjectPhrases.test(b))
      : rawBullets.filter((b) => !newBuildScopePhrases.test(b));
  let includedWorkBullets = filteredBullets
    .map((b) => fixSpacingBeforePunctuation(normalizeIncludedWorkText(b, kind)))
    .filter(Boolean);
  if (includedWorkBullets.length === 0) {
    includedWorkBullets = [
      fixSpacingBeforePunctuation(
        defaultScopeBulletForKind(kind, toTitleCase(options.projectType) || projectTypeLabel),
      ),
    ];
  }

  const desc = String(doc.scope.description || "").trim();
  let scopeSummary: string;

  if (desc) {
    let d = desc;
    if (kind !== "new_build" && newBuildScopePhrases.test(d)) {
      scopeSummary = getFallbackExecutiveSummaryForKind(kind);
    } else if (kind === "new_build" && remodelProjectPhrases.test(d) && !newBuildScopePhrases.test(d)) {
      scopeSummary = getFallbackExecutiveSummaryForKind(kind);
    } else {
      d = normalizeIncludedWorkText(d, kind);
      scopeSummary = fixSpacingBeforePunctuation(d.slice(0, 600));
    }
  } else if (includedWorkBullets.length) {
    scopeSummary = fixSpacingBeforePunctuation(includedWorkBullets.join(". ").trim().slice(0, 420));
  } else {
    scopeSummary = fixSpacingBeforePunctuation(
      getFallbackExecutiveSummaryForKind(kind) ||
        `${doc.summary.projectName} — scope per this estimate.`,
    );
  }

  const includedWorkLine = fixSpacingBeforePunctuation(
    includedWorkBullets[0] ||
      `Included work follows the ${projectTypeLabel.toLowerCase()} scope in this agreement.`,
  );

  const normalizedScopeSummary = normalizeCopyForComparison(scopeSummary);
  includedWorkBullets = includedWorkBullets.filter(
    (bullet) => normalizeCopyForComparison(bullet) !== normalizedScopeSummary,
  );

  return {
    projectTypeLabel,
    scopeSummary,
    includedWorkBullets,
    includedWorkLine,
  };
};

export const buildContractSections = (
  doc: ContractDoc,
  options: ContractBuildOptions,
) => {
  const baseTerms = getBaseBusinessTerms(doc, options);
  const statePack = getStateClausePack(options.state);
  const projectPack = getProjectTypePackForKind(getEffectiveEstimateKind(options, doc));
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

const splitDraftLines = (text: string) =>
  String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

/** Empty / whitespace-only draft is treated as “use template default” (avoids blank PDF before drafts hydrate). */
const parseDraftLinesOrDefault = (text: string, fallback: string[]) => {
  if (!String(text || "").trim()) return [...fallback];
  return splitDraftLines(text);
};

/** Defaults that will appear on the contract PDF unless the user overrides them in the estimate UI. */
export const getContractLanguageDefaults = (
  doc: ContractDoc,
  options: ContractBuildOptions,
): {
  projectAssumptions: string[];
  businessTerms: string[];
  workTypeAssumptions: string[];
} => {
  const sanitized = sanitizeContractDoc(doc, options);
  const sections = buildContractSections(sanitized, options);
  return {
    projectAssumptions: [...DEFAULT_PROJECT_ASSUMPTION_BULLETS],
    businessTerms: [...sections.baseTerms],
    workTypeAssumptions: [...sections.projectPack.clauses],
  };
};

/**
 * Applies multiline draft text from the estimate “contract wording” editor.
 * Only sets `custom*` fields when content differs from template defaults (keeps PDF options clean).
 */
export const mergeContractLanguageDraftsIntoOptions = (
  doc: ContractDoc,
  base: ContractBuildOptions,
  drafts: {
    projectAssumptionsText: string;
    businessTermsText: string;
    workTypeAssumptionsText: string;
  },
): ContractBuildOptions => {
  const defaults = getContractLanguageDefaults(doc, base);
  const pa = parseDraftLinesOrDefault(drafts.projectAssumptionsText, defaults.projectAssumptions);
  const bt = parseDraftLinesOrDefault(drafts.businessTermsText, defaults.businessTerms);
  const wta = parseDraftLinesOrDefault(drafts.workTypeAssumptionsText, defaults.workTypeAssumptions);
  const next: ContractBuildOptions = { ...base };
  if (JSON.stringify(pa) !== JSON.stringify(defaults.projectAssumptions)) {
    next.customProjectAssumptions = pa;
  } else {
    delete next.customProjectAssumptions;
  }
  if (JSON.stringify(bt) !== JSON.stringify(defaults.businessTerms)) {
    next.customBusinessTerms = bt;
  } else {
    delete next.customBusinessTerms;
  }
  if (JSON.stringify(wta) !== JSON.stringify(defaults.workTypeAssumptions)) {
    next.customWorkTypeAssumptions = wta;
  } else {
    delete next.customWorkTypeAssumptions;
  }
  return next;
};
