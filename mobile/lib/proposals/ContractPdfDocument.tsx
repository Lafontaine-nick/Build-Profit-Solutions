import "./reactPdfBufferPolyfill";
import React from "react";
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { ContractDoc } from "../contracts/types";
import {
  buildContractSections,
  BUILDER_FEE_LABEL,
  computeClientPricingBreakdown,
  ContractBuildOptions,
  getScheduleSummaryForContract,
  getStateLegalSummary,
  normalizeContractAudience,
  normalizeContractPdfMode,
  filterContractWarningsForAudience,
  normalizeProjectContractCopy,
  resolvePdfHeaderCompany,
  sanitizeContractDoc,
} from "./contractTemplate";

type ContractPdfDocumentProps = {
  doc: ContractDoc;
  options: ContractBuildOptions;
};

const money = (n: number | undefined | null) =>
  (Math.round((n ?? 0) * 100) / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatDate = (value?: string) => {
  if (!value || value === "TBD") return "TBD";
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

const groupBy = <T,>(items: T[], getKey: (item: T) => string) =>
  items.reduce<Record<string, T[]>>((acc, item) => {
    const key = getKey(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

/** Matches buildProposalHtml — don’t repeat section title as group title under “General materials” / “Labor”. */
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

const styles = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingHorizontal: 28,
    paddingBottom: 56,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1F2937",
    lineHeight: 1.35,
  },
  footerFixed: {
    position: "absolute",
    left: 28,
    right: 28,
    bottom: 10,
  },
  footerDivider: {
    borderTopWidth: 0.5,
    borderTopColor: "#CBD5E1",
    width: "100%",
    marginBottom: 5,
  },
  footerInner: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  footerColLeft: {
    width: "30%",
    fontSize: 6.5,
    color: "#94A3B8",
    lineHeight: 1.25,
  },
  footerColCenter: {
    width: "40%",
    fontSize: 6.5,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 1.25,
  },
  footerColRight: {
    width: "30%",
    fontSize: 6.5,
    color: "#94A3B8",
    textAlign: "right",
    lineHeight: 1.25,
  },
  coverHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  brandRow: {
    flexDirection: "row",
    flex: 1,
    alignItems: "center",
  },
  brandAccent: {
    height: 3,
    width: 52,
    borderRadius: 1,
    marginBottom: 10,
  },
  brandImage: {
    width: 62,
    height: 62,
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#DBE4EE",
  },
  brandMeta: {
    flex: 1,
  },
  companyName: {
    fontSize: 27,
    fontWeight: 700,
    color: "#0F172A",
    lineHeight: 1.05,
    letterSpacing: 0.2,
  },
  companySubtitle: {
    marginTop: 3,
    fontSize: 10,
    color: "#64748B",
  },
  contactLine: {
    marginTop: 4,
    fontSize: 8.5,
    color: "#64748B",
  },
  headerMeta: {
    width: "26%",
    textAlign: "right",
    paddingTop: 4,
  },
  headerMetaLine: {
    fontSize: 8.2,
    color: "#64748B",
    marginBottom: 2,
  },
  accentRule: {
    height: 4,
    backgroundColor: "#22C7A8",
    marginBottom: 12,
  },
  coverLayout: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  coverMain: {
    width: "67%",
    paddingRight: 18,
    borderRightWidth: 1,
    borderRightColor: "#E5E7EB",
  },
  coverRail: {
    width: "33%",
    paddingLeft: 16,
  },
  eyebrow: {
    fontSize: 7.8,
    textTransform: "uppercase",
    letterSpacing: 1.6,
    color: "#22C7A8",
    fontWeight: 700,
    marginBottom: 8,
  },
  docTitle: {
    fontSize: 19,
    fontWeight: 700,
    lineHeight: 1.08,
    color: "#10243B",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 22,
  },
  storyGrid: {
    flexDirection: "row",
    marginBottom: 22,
  },
  storyColLeft: {
    width: "48%",
    paddingRight: 12,
  },
  storyColRight: {
    width: "52%",
    paddingLeft: 12,
  },
  kicker: {
    fontSize: 7.8,
    textTransform: "uppercase",
    letterSpacing: 1.3,
    color: "#64748B",
    fontWeight: 700,
    marginBottom: 8,
  },
  clientName: {
    fontSize: 16,
    fontWeight: 700,
    color: "#10243B",
    marginBottom: 4,
  },
  projectName: {
    fontSize: 14,
    fontWeight: 600,
    color: "#1F2937",
    marginBottom: 4,
  },
  address: {
    fontSize: 10,
    color: "#1F2937",
    lineHeight: 1.35,
  },
  compactAddress: {
    marginTop: 6,
    fontSize: 9.1,
    color: "#64748B",
    lineHeight: 1.35,
  },
  preparedByName: {
    fontSize: 11.2,
    fontWeight: 600,
    color: "#10243B",
    lineHeight: 1.25,
  },
  preparedBySub: {
    marginTop: 3,
    fontSize: 9.2,
    color: "#64748B",
    lineHeight: 1.3,
  },
  summaryBlock: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 16,
    marginTop: 4,
  },
  summaryLabel: {
    fontSize: 7.8,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: "#64748B",
    fontWeight: 700,
    marginBottom: 6,
  },
  summaryText: {
    fontSize: 10.4,
    color: "#1F2937",
    lineHeight: 1.48,
  },
  trustRow: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  trustBadge: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 3,
    marginRight: 8,
    marginBottom: 6,
  },
  trustBadgeText: {
    fontSize: 7.5,
    color: "#475569",
    fontWeight: 700,
    letterSpacing: 0.3,
  },
  railPanel: {
    borderWidth: 1,
    borderColor: "#CFD8E3",
    backgroundColor: "#FBFCFE",
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  railTitle: {
    fontSize: 7.8,
    textTransform: "uppercase",
    letterSpacing: 1.4,
    color: "#10243B",
    fontWeight: 700,
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  railRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
  },
  railRowLast: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 7,
    borderBottomWidth: 0,
  },
  railLabel: {
    width: "47%",
    fontSize: 9.2,
    color: "#475569",
    fontWeight: 600,
    lineHeight: 1.3,
  },
  railValue: {
    width: "53%",
    fontSize: 9.2,
    color: "#10243B",
    textAlign: "right",
    lineHeight: 1.3,
  },
  railNote: {
    marginTop: 12,
    fontSize: 8.6,
    color: "#64748B",
    lineHeight: 1.4,
  },
  readinessPanel: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#DBE4EE",
    backgroundColor: "#FCFDFF",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  readinessLeft: {
    width: "52%",
  },
  readinessRight: {
    width: "42%",
  },
  readinessTitle: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: 700,
    color: "#10243B",
  },
  readinessItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  readinessDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
  },
  readinessText: {
    fontSize: 9.4,
    color: "#1F2937",
  },
  disclaimer: {
    marginTop: 8,
    fontSize: 8,
    color: "#64748B",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: "#10243B",
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: "#22C7A8",
  },
  sectionBlock: {
    marginBottom: 14,
  },
  splitRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  splitColWide: {
    width: "54%",
    paddingRight: 10,
  },
  splitColNarrow: {
    width: "44%",
    paddingLeft: 10,
  },
  blockTitle: {
    fontSize: 8.8,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    color: "#10243B",
    fontWeight: 700,
    marginBottom: 8,
  },
  bullet: {
    fontSize: 10,
    color: "#1F2937",
    marginBottom: 6,
    lineHeight: 1.4,
  },
  bulletSymbol: {
    fontWeight: 700,
  },
  subtle: {
    fontSize: 8.5,
    color: "#64748B",
    lineHeight: 1.4,
    marginTop: 8,
  },
  table: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderBottomWidth: 0,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#EEF2F7",
    borderBottomWidth: 1,
    borderBottomColor: "#CBD5E1",
  },
  tableHeaderCell: {
    fontSize: 7.1,
    textTransform: "uppercase",
    letterSpacing: 0.85,
    color: "#475569",
    fontWeight: 700,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  tableRowAlt: {
    backgroundColor: "#FAFBFC",
  },
  tableRowDeposit: {
    backgroundColor: "#F0FDFA",
  },
  tableRowDepositText: {
    fontWeight: 700,
    color: "#0F766E",
  },
  tableCell: {
    fontSize: 9.1,
    color: "#1F2937",
    paddingVertical: 7,
    paddingHorizontal: 6,
    lineHeight: 1.35,
  },
  tableCellNum: {
    textAlign: "right",
  },
  totalRow: {
    backgroundColor: "#E8F4FC",
    borderTopWidth: 1,
    borderTopColor: "#BFDBFE",
  },
  totalText: {
    fontWeight: 700,
    color: "#0C4A6E",
    fontSize: 9.4,
  },
  noticeStrip: {
    borderLeftWidth: 3,
    borderLeftColor: "#22C7A8",
    backgroundColor: "#F8FAFC",
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  noticeStripWarn: {
    borderLeftColor: "#D97706",
    backgroundColor: "#FFFBEB",
  },
  noticeStripLegalTop: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  noticeStripLegalClient: {
    borderLeftWidth: 3,
    borderLeftColor: "#22C7A8",
    backgroundColor: "#F8FAFC",
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  noticeText: {
    fontSize: 9.2,
    color: "#1F2937",
    lineHeight: 1.42,
  },
  legalItem: {
    fontSize: 9.5,
    color: "#1F2937",
    lineHeight: 1.42,
    marginBottom: 8,
  },
  legalItemNum: {
    fontWeight: 700,
    color: "#10243B",
  },
  signatureLead: {
    fontSize: 9.5,
    color: "#1F2937",
    lineHeight: 1.48,
    marginBottom: 28,
  },
  signatureRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "stretch",
  },
  signatureBox: {
    width: "49%",
    borderWidth: 1,
    borderColor: "#C9D4E0",
    backgroundColor: "#FCFDFE",
    paddingVertical: 20,
    paddingHorizontal: 18,
    minHeight: 268,
    borderRadius: 3,
  },
  signatureHeading: {
    fontSize: 10.5,
    fontWeight: 700,
    color: "#0F172A",
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  signatureLineBlock: {
    marginTop: 22,
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: "#475569",
    height: 34,
  },
  signatureCaption: {
    marginTop: 5,
    fontSize: 8,
    color: "#64748B",
  },
  signatureMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 22,
  },
  signatureMeta: {
    width: "48%",
  },
  appendixGroup: {
    marginBottom: 18,
  },
  appendixHeading: {
    fontSize: 10,
    fontWeight: 700,
    color: "#10243B",
    marginBottom: 6,
  },
  lineItemSubhead: {
    fontSize: 10,
    fontWeight: 700,
    color: "#10243B",
    marginTop: 12,
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  appendixSectionTitle: {
    fontSize: 10.5,
    fontWeight: 700,
    color: "#10243B",
    marginTop: 10,
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: "#22C7A8",
  },
  appendixContextBox: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FAFBFC",
    padding: 12,
    marginBottom: 14,
  },
  appendixContextTitle: {
    fontSize: 9.5,
    fontWeight: 700,
    color: "#0F172A",
    marginBottom: 6,
    marginTop: 4,
  },
  appendixMetaLine: {
    fontSize: 9.5,
    marginBottom: 4,
    color: "#334155",
  },
  appendixScopeText: {
    fontSize: 9.5,
    color: "#475569",
    lineHeight: 1.4,
    marginBottom: 4,
  },
});

const Footer = ({
  companyName,
  documentTitle,
}: {
  companyName: string;
  documentTitle: string;
}) => (
  <View style={styles.footerFixed} fixed>
    <View style={styles.footerDivider} />
    <View style={styles.footerInner}>
      <Text style={styles.footerColLeft}>{companyName}</Text>
      <Text style={styles.footerColCenter}>{documentTitle}</Text>
      <Text
        style={styles.footerColRight}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
      />
    </View>
  </View>
);

const TrustBadgeRow = ({ items }: { items: string[] }) =>
  items.length ? (
    <View style={styles.trustRow}>
      {items.map((label) => (
        <View key={label} style={styles.trustBadge} wrap={false}>
          <Text style={styles.trustBadgeText}>{label}</Text>
        </View>
      ))}
    </View>
  ) : null;

const shortenPaymentNote = (milestone: ContractDoc["milestones"][0]) => {
  const d = String(milestone.description || "").trim();
  const s = String(milestone.status || "").trim();
  if (d && s && d === s) {
    return d.length > 72 ? `${d.slice(0, 69)}…` : d;
  }
  const combined = [d, s].filter(Boolean).join(" · ");
  if (!combined) return "—";
  return combined.length > 85 ? `${combined.slice(0, 82)}…` : combined;
};

const isDepositMilestone = (name: string) =>
  /deposit|down\s*payment|down payment|initial|retainer|mobilization/i.test(String(name || ""));

const RailRow = ({
  label,
  value,
  isLast,
}: {
  label: string;
  value: string;
  isLast?: boolean;
}) => {
  if (isLast) {
    return (
      <View style={styles.railRowLast}>
        <Text style={styles.railLabel}>{label}</Text>
        <Text style={styles.railValue}>{value}</Text>
      </View>
    );
  }

  return (
    <View style={styles.railRow}>
      <Text style={styles.railLabel}>{label}</Text>
      <Text style={styles.railValue}>{value}</Text>
    </View>
  );
};

const BulletList = ({ items }: { items: string[] }) => (
  <View>
    {items.map((item, index) => (
      <Text key={`${item}-${index}`} style={styles.bullet}>
        <Text style={styles.bulletSymbol}>• </Text>
        {item}
      </Text>
    ))}
  </View>
);

const PricingTable = ({
  rows,
}: {
  rows: Array<{ label: string; value: number }>;
}) => {
  const lastIndex = rows.length - 1;

  return (
    <View style={styles.table}>
      <View style={styles.tableHeaderRow}>
        <Text style={[styles.tableHeaderCell, { width: "62%" }]}>Line item</Text>
        <Text style={[styles.tableHeaderCell, { width: "38%", textAlign: "right" }]}>Amount</Text>
      </View>
      {rows.map((row, index) => {
        const isTotal = index === lastIndex;

        if (isTotal) {
          return (
            <View key={row.label} style={[styles.tableRow, styles.totalRow]}>
              <Text style={[styles.tableCell, { width: "62%" }, styles.totalText]}>{row.label}</Text>
              <Text
                style={[
                  styles.tableCell,
                  styles.tableCellNum,
                  { width: "38%" },
                  styles.totalText,
                ]}
              >
                {money(row.value)}
              </Text>
            </View>
          );
        }

        return (
          <View
            key={row.label}
            style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : null]}
          >
            <Text style={[styles.tableCell, { width: "62%" }]}>{row.label}</Text>
            <Text style={[styles.tableCell, styles.tableCellNum, { width: "38%" }]}>
              {money(row.value)}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

const PaymentTable = ({
  milestones,
  totalBid,
}: {
  milestones: ContractDoc["milestones"];
  totalBid: number;
}) => (
  <View style={styles.table}>
    <View style={styles.tableHeaderRow}>
      <Text style={[styles.tableHeaderCell, { width: "19%" }]}>Payment</Text>
      <Text style={[styles.tableHeaderCell, { width: "9%", textAlign: "center" }]}>Pct.</Text>
      <Text style={[styles.tableHeaderCell, { width: "15%", textAlign: "right" }]}>Amount</Text>
      <Text style={[styles.tableHeaderCell, { width: "22%" }]}>Due</Text>
      <Text style={[styles.tableHeaderCell, { width: "35%" }]}>Notes</Text>
    </View>
    {milestones.length ? (
      milestones.map((milestone, index) => {
        const amount = Number(milestone.paymentAmount || milestone.amount || 0);
        const pct =
          typeof milestone.percentage === "number"
            ? milestone.percentage
            : typeof milestone.percent === "number"
              ? milestone.percent
              : totalBid > 0
                ? (amount / totalBid) * 100
                : 0;
        const deposit = isDepositMilestone(milestone.name || "");
        const zebra = index % 2 === 1;
        const rowStyle = [
          styles.tableRow,
          zebra ? styles.tableRowAlt : null,
          deposit ? styles.tableRowDeposit : null,
        ];
        const cellDeposit = deposit ? styles.tableRowDepositText : null;
        return (
          <View key={milestone.id || String(index)} style={rowStyle}>
            <Text style={[styles.tableCell, { width: "19%" }, cellDeposit]}>
              {milestone.name || "Scheduled payment"}
            </Text>
            <Text style={[styles.tableCell, { width: "9%", textAlign: "center" }, cellDeposit]}>
              {pct ? `${pct.toFixed(1)}%` : "—"}
            </Text>
            <Text
              style={[styles.tableCell, styles.tableCellNum, { width: "15%" }, cellDeposit]}
            >
              {money(amount)}
            </Text>
            <Text style={[styles.tableCell, { width: "22%" }]}>
              {formatDate(milestone.scheduledDate) || "TBD"}
            </Text>
            <Text style={[styles.tableCell, { width: "35%" }]}>{shortenPaymentNote(milestone)}</Text>
          </View>
        );
      })
    ) : (
      <View style={styles.tableRow}>
        <Text style={[styles.tableCell, { width: "100%", textAlign: "center", color: "#64748B" }]}>
          No payment schedule defined.
        </Text>
      </View>
    )}
    <View style={[styles.tableRow, styles.totalRow]}>
      <Text style={[styles.tableCell, { width: "19%" }, styles.totalText]}>Total contract</Text>
      <Text style={[styles.tableCell, { width: "9%", textAlign: "center" }, styles.totalText]}>
        {milestones.length
          ? `${milestones
              .reduce((sum, milestone) => {
                const amount = Number(milestone.paymentAmount || milestone.amount || 0);
                const pct =
                  typeof milestone.percentage === "number"
                    ? milestone.percentage
                    : typeof milestone.percent === "number"
                      ? milestone.percent
                      : totalBid > 0
                        ? (amount / totalBid) * 100
                        : 0;
                return sum + pct;
              }, 0)
              .toFixed(1)
              .replace(".0", "")}%`
          : "—"}
      </Text>
      <Text style={[styles.tableCell, styles.tableCellNum, { width: "15%" }, styles.totalText]}>
        {money(totalBid)}
      </Text>
      <Text style={[styles.tableCell, { width: "22%" }]} />
      <Text style={[styles.tableCell, { width: "35%" }]} />
    </View>
  </View>
);

export const ContractPdfDocument: React.FC<ContractPdfDocumentProps> = ({
  doc,
  options,
}) => {
  const pdfMode = normalizeContractPdfMode(options.pdfMode);
  const sanitizedDoc = sanitizeContractDoc(doc, options);
  const contractCopy = normalizeProjectContractCopy(sanitizedDoc, options);
  const sections = buildContractSections(sanitizedDoc, options);

  const today = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const company = resolvePdfHeaderCompany(options.branding, sanitizedDoc.contractor);
  const accentColor = options.branding.accentColorHex || "#22C7A8";
  const contractorName =
    options.branding.contractorName || sanitizedDoc.contractor.contactName || company;
  const contractorTitle = options.branding.contractorTitle || "Contractor";
  const logo = options.branding.logoUrl || sanitizedDoc.contractor.logoUrl;
  const projectAddress = sanitizedDoc.owner.address || sanitizedDoc.summary.siteAddress;
  const startDate = formatDate(sanitizedDoc.summary.startDate);
  const validThrough = formatDate(sanitizedDoc.summary.expiresDate);
  const scheduleRail = getScheduleSummaryForContract(sanitizedDoc);
  const pricingBreakdown = computeClientPricingBreakdown(sanitizedDoc);
  const materialsSubtotal = pricingBreakdown.materials;
  const laborSubtotal = pricingBreakdown.labor;
  const directCostsSubtotal = pricingBreakdown.directCosts;
  const builderFeeAmount = pricingBreakdown.builderFee;
  const contractTotalPricing = pricingBreakdown.contractTotal;
  const totalBid = contractTotalPricing;
  const projectTypeDisplay = contractCopy.projectTypeLabel;
  const hasLineItemAppendix =
    (sanitizedDoc.scope.materialLineItems?.length || 0) > 0 ||
    (sanitizedDoc.scope.laborLineItems?.length || 0) > 0;

  const summaryItems = [
    { label: "Contract price", value: money(totalBid) },
    { label: "Start date", value: startDate },
    { label: scheduleRail.label, value: scheduleRail.value },
    {
      label: "Payment structure",
      value: sanitizedDoc.milestones.length
        ? `${sanitizedDoc.milestones.length} scheduled payment${
            sanitizedDoc.milestones.length === 1 ? "" : "s"
          }`
        : "No payment schedule",
    },
    ...(validThrough !== "TBD" ? [{ label: "Proposal expires", value: validThrough }] : []),
  ];
  const projectSummary = contractCopy.scopeSummary;
  const trustBadges = [
    options.branding.licenseNumber ? "Licensed" : "",
    options.branding.insuranceStatus ? "Insured" : "",
    options.branding.verifiedContractor ? "Verified" : "",
  ].filter(Boolean);

  const pricingRows = [
    { label: "Materials", value: materialsSubtotal },
    { label: "Labor", value: laborSubtotal },
    { label: "Direct costs", value: directCostsSubtotal },
    { label: BUILDER_FEE_LABEL, value: builderFeeAmount },
    { label: "Contract total", value: contractTotalPricing },
  ];
  const notes = [
    "Selections, finishes, and owner-furnished items must be approved before ordering.",
    "Lead times begin after approvals, deposit receipt, and material release.",
    "Reasonable site protection, cleanup, and debris handling are included unless otherwise noted.",
    "Access to the work area, parking, and utilities must remain available during active work hours.",
  ];
  const dedupedWarnings = sections.warnings.filter(
    (w, i, arr) => arr.findIndex((x) => x.message === w.message) === i,
  );
  const audience = normalizeContractAudience(options.contractAudience);
  const visibleWarnings = filterContractWarningsForAudience(dedupedWarnings, audience);
  const readinessNeedsAttention = sections.readinessItems.some((item) => !item.value);
  const coverReviewRecommended =
    audience === "internal"
      ? dedupedWarnings.some((warning) => warning.level === "warning") || readinessNeedsAttention
      : readinessNeedsAttention;
  const groupedMaterials = groupBy(
    sanitizedDoc.scope.materialLineItems || [],
    (item) => item.section || item.category || "Materials",
  );
  const groupedLabor = groupBy(
    sanitizedDoc.scope.laborLineItems || [],
    (item) => item.category || "Labor",
  );
  const hasMaterialGroups = Object.keys(groupedMaterials).length > 0;
  const hasLaborGroups = Object.keys(groupedLabor).length > 0;
  const termsLeadNoticeInternal =
    options.state === "other"
      ? "Not legal advice. This is a generic business draft—confirm jurisdiction-specific notices, licensing, cancellation rights, and dispute terms with counsel before the client signs."
      : `Not legal advice. Jurisdiction template (${sections.statePack.heading}): confirm required notices and disclosures before delivery.`;
  const termsLeadNoticeClient =
    options.state === "other"
      ? "Confirm any jurisdiction-specific notices, licensing, cancellation rights, and dispute terms that apply to this project."
      : `This section uses ${sections.statePack.heading} language. Confirm required notices and disclosures before execution.`;
  const title =
    options.contractType === "home-improvement"
      ? "Proposal & Home Improvement Agreement"
      : "Proposal & Construction Agreement";

  return (
    <Document title={`${sanitizedDoc.summary.projectName} - ${sections.draftLabel}`}>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.coverHeader}>
          <View style={styles.brandRow}>
            {logo ? <Image src={logo} style={styles.brandImage} /> : null}
            <View style={styles.brandMeta}>
              <View style={[styles.brandAccent, { backgroundColor: accentColor }]} />
              <Text style={styles.companyName}>{company}</Text>
              <Text style={styles.companySubtitle}>
                {contractorName}
                {contractorTitle ? ` · ${contractorTitle}` : ""}
              </Text>
              <Text style={styles.contactLine}>
                {[
                  options.branding.companyPhone,
                  options.branding.companyEmail,
                  options.branding.companyWebsite,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </View>
          </View>
          <View style={styles.headerMeta}>
            <Text style={styles.headerMetaLine}>Issued {today}</Text>
            <Text style={styles.headerMetaLine}>
              Proposal #{String(sanitizedDoc.summary.contractId)}
            </Text>
          </View>
        </View>

        <View style={styles.accentRule} />

        <View style={styles.coverLayout}>
          <View style={styles.coverMain}>
            <Text style={styles.eyebrow}>Client proposal packet</Text>
            <Text style={styles.docTitle}>{title}</Text>
            {/* Name + project: only in story grid below (was duplicated in coverDeck) */}

            <View style={styles.storyGrid}>
              <View style={styles.storyColLeft}>
                <Text style={styles.kicker}>Prepared for</Text>
                <Text style={styles.clientName}>{sanitizedDoc.owner.legalName || "Client"}</Text>
                <Text style={styles.projectName}>{sanitizedDoc.summary.projectName}</Text>
                {projectAddress ? <Text style={styles.address}>{projectAddress}</Text> : null}
              </View>
              <View style={styles.storyColRight}>
                <Text style={styles.kicker}>Prepared by</Text>
                <Text style={styles.preparedByName}>{company}</Text>
                <Text style={styles.preparedBySub}>
                  {contractorName}
                  {contractorTitle ? ` · ${contractorTitle}` : ""}
                </Text>
                {options.branding.businessAddress ? (
                  <Text style={styles.compactAddress}>{options.branding.businessAddress}</Text>
                ) : null}
              </View>
            </View>

            <View style={styles.summaryBlock}>
              <Text style={styles.summaryLabel}>Project summary</Text>
              <Text style={styles.summaryText}>{projectSummary}</Text>
            </View>

            <TrustBadgeRow items={trustBadges} />
          </View>

          <View style={styles.coverRail}>
            <View style={styles.railPanel} wrap={false}>
              <Text style={styles.railTitle}>Agreement summary</Text>
              {summaryItems.map((item, index) => (
                <RailRow
                  key={item.label}
                  label={item.label}
                  value={item.value}
                  isLast={index === summaryItems.length - 1}
                />
              ))}
            </View>
            <Text style={styles.railNote}>
              Final scope, schedule, and pricing are subject to written approval before work
              proceeds.
            </Text>
          </View>
        </View>

        <View style={styles.readinessPanel} wrap={false}>
          <View style={styles.readinessLeft}>
            <Text style={styles.kicker}>Proposal readiness review</Text>
            <Text style={styles.readinessTitle}>
              {coverReviewRecommended ? "Review recommended" : "Ready to send"}
            </Text>
          </View>
          <View style={styles.readinessRight}>
            {sections.readinessItems.map((item) => (
              <View key={item.label} style={styles.readinessItem}>
                <View
                  style={[
                    styles.readinessDot,
                    { backgroundColor: item.value ? "#22C7A8" : "#D97706" },
                  ]}
                />
                <Text style={styles.readinessText}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>
        <Text style={styles.disclaimer}>
          This readiness review is based on information entered into the estimate and is not legal
          advice.
        </Text>

        <Footer companyName={company} documentTitle={title} />
      </Page>

      <Page size="LETTER" style={styles.page} wrap>
        <Text style={styles.sectionTitle}>Scope & pricing detail</Text>

        <View style={styles.appendixContextBox}>
          <Text style={styles.appendixContextTitle}>Project context</Text>
          <Text style={styles.appendixMetaLine}>
            <Text style={{ fontWeight: 700 }}>Project: </Text>
            {sanitizedDoc.summary.projectName}
          </Text>
          <Text style={styles.appendixMetaLine}>
            <Text style={{ fontWeight: 700 }}>Client: </Text>
            {sanitizedDoc.owner.legalName || "Client"}
          </Text>
          <Text style={styles.appendixMetaLine}>
            <Text style={{ fontWeight: 700 }}>Project type: </Text>
            {projectTypeDisplay}
          </Text>
          <Text style={styles.appendixContextTitle}>Scope & included work</Text>
          <Text style={styles.appendixScopeText}>{contractCopy.scopeSummary}</Text>
          {contractCopy.includedWorkBullets?.length ? (
            <View style={{ marginTop: 8 }}>
              <BulletList items={contractCopy.includedWorkBullets} />
            </View>
          ) : null}
        </View>

        <View style={styles.splitRow}>
          <View style={styles.splitColWide}>
            <Text style={styles.blockTitle}>Pricing summary</Text>
            <PricingTable rows={pricingRows} />
          </View>
          <View style={styles.splitColNarrow}>
            <Text style={styles.blockTitle}>Project assumptions</Text>
            <BulletList items={notes} />
          </View>
        </View>

        {pdfMode === "detailed" ? (
          hasLineItemAppendix ? (
            <View style={{ marginTop: 8 }}>
              <Text style={styles.appendixSectionTitle}>Line-item detail</Text>
              {hasMaterialGroups ? (
                <>
                  <Text style={styles.lineItemSubhead}>General materials</Text>
                  {Object.entries(groupedMaterials).map(([group, items]) => {
                    const subtotal = items.reduce(
                      (sum, item) => sum + Number(item.materials || 0),
                      0,
                    );
                    return (
                      <View key={group} style={styles.appendixGroup}>
                        {!isRedundantMaterialGroupTitle(group) ? (
                          <Text style={styles.appendixHeading}>{group}</Text>
                        ) : null}
                        <View style={styles.table}>
                          <View style={styles.tableHeaderRow}>
                            <Text style={[styles.tableHeaderCell, { width: "49%" }]}>
                              Description
                            </Text>
                            <Text
                              style={[styles.tableHeaderCell, { width: "12%", textAlign: "center" }]}
                            >
                              Qty
                            </Text>
                            <Text
                              style={[styles.tableHeaderCell, { width: "14%", textAlign: "center" }]}
                            >
                              Unit
                            </Text>
                            <Text
                              style={[styles.tableHeaderCell, { width: "25%", textAlign: "right" }]}
                            >
                              Materials
                            </Text>
                          </View>
                          {items.map((item, index) => (
                            <View key={`${group}-${index}`} style={styles.tableRow}>
                              <Text style={[styles.tableCell, { width: "49%" }]}>
                                {item.description || "Material"}
                              </Text>
                              <Text style={[styles.tableCell, { width: "12%", textAlign: "center" }]}>
                                {item.quantity || "—"}
                              </Text>
                              <Text style={[styles.tableCell, { width: "14%", textAlign: "center" }]}>
                                {item.unit || "—"}
                              </Text>
                              <Text style={[styles.tableCell, styles.tableCellNum, { width: "25%" }]}>
                                {money(item.materials || 0)}
                              </Text>
                            </View>
                          ))}
                          <View style={[styles.tableRow, styles.totalRow]}>
                            <Text style={[styles.tableCell, { width: "75%" }, styles.totalText]}>
                              Material subtotal
                            </Text>
                            <Text
                              style={[
                                styles.tableCell,
                                styles.tableCellNum,
                                { width: "25%" },
                                styles.totalText,
                              ]}
                            >
                              {money(subtotal)}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </>
              ) : null}
              {hasLaborGroups ? (
                <>
                  <Text style={styles.lineItemSubhead}>Labor</Text>
                  {Object.entries(groupedLabor).map(([group, items]) => {
                    const subtotal = items.reduce((sum, item) => sum + Number(item.labor || 0), 0);
                    return (
                      <View key={`labor-${group}`} style={styles.appendixGroup}>
                        {!isRedundantLaborGroupTitle(group) ? (
                          <Text style={styles.appendixHeading}>{group}</Text>
                        ) : null}
                        <View style={styles.table}>
                          <View style={styles.tableHeaderRow}>
                            <Text style={[styles.tableHeaderCell, { width: "75%" }]}>
                              Description
                            </Text>
                            <Text style={[styles.tableHeaderCell, { width: "25%", textAlign: "right" }]}>
                              Labor
                            </Text>
                          </View>
                          {items.map((item, index) => (
                            <View key={`${group}-${index}`} style={styles.tableRow}>
                              <Text style={[styles.tableCell, { width: "75%" }]}>
                                {item.description || "Labor"}
                              </Text>
                              <Text style={[styles.tableCell, styles.tableCellNum, { width: "25%" }]}>
                                {money(item.labor || 0)}
                              </Text>
                            </View>
                          ))}
                          <View style={[styles.tableRow, styles.totalRow]}>
                            <Text style={[styles.tableCell, { width: "75%" }, styles.totalText]}>
                              Labor subtotal
                            </Text>
                            <Text
                              style={[
                                styles.tableCell,
                                styles.tableCellNum,
                                { width: "25%" },
                                styles.totalText,
                              ]}
                            >
                              {money(subtotal)}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </>
              ) : null}
            </View>
          ) : (
            <Text style={styles.subtle}>
              No line-item breakdown was attached; reconciliation below follows the contract summary
              only.
            </Text>
          )
        ) : null}

        <View style={styles.sectionBlock} wrap={false}>
          <Text style={styles.blockTitle}>Total reconciliation</Text>
          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableHeaderCell, { width: "62%" }]}>Category</Text>
              <Text style={[styles.tableHeaderCell, { width: "38%", textAlign: "right" }]}>
                Amount
              </Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, { width: "62%" }]}>Materials (contract summary)</Text>
              <Text style={[styles.tableCell, styles.tableCellNum, { width: "38%" }]}>
                {money(materialsSubtotal)}
              </Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, { width: "62%" }]}>Labor (contract summary)</Text>
              <Text style={[styles.tableCell, styles.tableCellNum, { width: "38%" }]}>
                {money(laborSubtotal)}
              </Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, { width: "62%" }]}>
                Direct costs (permits, plans, equipment, other direct)
              </Text>
              <Text style={[styles.tableCell, styles.tableCellNum, { width: "38%" }]}>
                {money(directCostsSubtotal)}
              </Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, { width: "62%" }]}>{BUILDER_FEE_LABEL}</Text>
              <Text style={[styles.tableCell, styles.tableCellNum, { width: "38%" }]}>
                {money(builderFeeAmount)}
              </Text>
            </View>
            <View style={[styles.tableRow, styles.totalRow]}>
              <Text style={[styles.tableCell, { width: "62%" }, styles.totalText]}>
                Contract total (reconciliation)
              </Text>
              <Text style={[styles.tableCell, styles.tableCellNum, { width: "38%" }, styles.totalText]}>
                {money(totalBid)}
              </Text>
            </View>
          </View>
          <Text style={styles.subtle}>
            {!pricingBreakdown.reconciles
              ? "Note: Roll-up rounding — verify materials, labor, direct costs, and contract total in the estimate match this agreement."
              : "The amounts above reconcile to the contract total shown on the pricing summary."}
          </Text>
        </View>
      </Page>

      <Page size="LETTER" style={styles.page}>
        <Text style={styles.sectionTitle}>Payment schedule</Text>
        <PaymentTable milestones={sanitizedDoc.milestones} totalBid={totalBid} />
      </Page>

      <Page size="LETTER" style={styles.page}>
        <Text style={styles.sectionTitle}>Contract terms</Text>

        {audience === "internal" ? (
          <View style={[styles.noticeStrip, styles.noticeStripLegalTop]} wrap={false}>
            <Text style={styles.noticeText}>
              <Text style={{ fontWeight: 700 }}>Review before client delivery. </Text>
              {termsLeadNoticeInternal}
            </Text>
          </View>
        ) : (
          <View style={[styles.noticeStrip, styles.noticeStripLegalClient]} wrap={false}>
            <Text style={styles.noticeText}>{termsLeadNoticeClient}</Text>
          </View>
        )}

        {visibleWarnings.length ? (
          <View style={[styles.noticeStrip, styles.noticeStripWarn]} wrap={false}>
            <View style={{ marginTop: 2 }}>
              {visibleWarnings.map((warning) => (
                <Text key={warning.id} style={styles.noticeText}>
                  • {warning.message}
                </Text>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.sectionBlock}>
          <Text style={styles.blockTitle}>Business terms</Text>
          {sections.baseTerms.map((term, index) => (
            <Text key={`${term}-${index}`} style={styles.legalItem}>
              <Text style={styles.legalItemNum}>{index + 1}. </Text>
              {term}
            </Text>
          ))}
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.blockTitle}>Work-type assumptions</Text>
          <BulletList items={sections.projectPack.clauses} />
          {sections.projectPack.disclaimer ? (
            <Text style={styles.subtle}>{sections.projectPack.disclaimer}</Text>
          ) : null}
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.blockTitle}>State & jurisdiction</Text>
          <Text style={styles.legalItem}>{getStateLegalSummary(options.state)}</Text>
        </View>
      </Page>

      <Page size="LETTER" style={styles.page}>
        <Text style={styles.sectionTitle}>Acceptance & signatures</Text>
        <Text style={styles.signatureLead}>
          This agreement becomes effective when signed by both parties. By signing below, the parties
          acknowledge they have reviewed the scope, pricing, payment schedule, and contract terms.
        </Text>

        <View style={styles.signatureRow}>
          <View style={styles.signatureBox} wrap={false}>
            <Text style={styles.signatureHeading}>Contractor / company</Text>
            <Text style={styles.bullet}>Company: {company}</Text>
            <Text style={styles.bullet}>Contractor: {contractorName}</Text>
            {options.branding.licenseNumber ? (
              <Text style={styles.bullet}>License: {options.branding.licenseNumber}</Text>
            ) : null}

            <View style={styles.signatureLineBlock}>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureCaption}>Authorized signature</Text>
            </View>
            <View style={styles.signatureMetaRow}>
              <View style={styles.signatureMeta}>
                <View style={styles.signatureLine} />
                <Text style={styles.signatureCaption}>Printed name</Text>
              </View>
              <View style={styles.signatureMeta}>
                <View style={styles.signatureLine} />
                <Text style={styles.signatureCaption}>Date</Text>
              </View>
            </View>
          </View>

          <View style={styles.signatureBox} wrap={false}>
            <Text style={styles.signatureHeading}>Client / owner</Text>
            <Text style={styles.bullet}>Client: {sanitizedDoc.owner.legalName || "Client"}</Text>
            {projectAddress ? <Text style={styles.bullet}>Property: {projectAddress}</Text> : null}

            <View style={styles.signatureLineBlock}>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureCaption}>Client signature</Text>
            </View>
            <View style={styles.signatureMetaRow}>
              <View style={styles.signatureMeta}>
                <View style={styles.signatureLine} />
                <Text style={styles.signatureCaption}>Printed name</Text>
              </View>
              <View style={styles.signatureMeta}>
                <View style={styles.signatureLine} />
                <Text style={styles.signatureCaption}>Date</Text>
              </View>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
};

export default ContractPdfDocument;
