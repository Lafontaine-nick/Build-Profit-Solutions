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
  ContractBuildOptions,
  getStateLegalSummary,
  resolveExecutiveSummaryText,
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

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingHorizontal: 28,
    paddingBottom: 42,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1F2937",
    lineHeight: 1.35,
  },
  footer: {
    position: "absolute",
    left: 28,
    right: 28,
    bottom: 18,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  footerLeft: {
    flex: 1,
    fontSize: 7.5,
    color: "#64748B",
  },
  footerRight: {
    fontSize: 7.5,
    color: "#10243B",
    fontWeight: 700,
    textAlign: "right",
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
    fontSize: 24,
    fontWeight: 700,
    color: "#10243B",
    lineHeight: 1.02,
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
    fontSize: 22,
    fontWeight: 700,
    lineHeight: 1.02,
    color: "#10243B",
    textTransform: "uppercase",
    marginBottom: 10,
  },
  coverDeck: {
    fontSize: 11.2,
    lineHeight: 1.38,
    color: "#1F2937",
    marginBottom: 18,
  },
  storyGrid: {
    flexDirection: "row",
    marginBottom: 16,
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
    marginBottom: 6,
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
    paddingTop: 12,
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
  trustLine: {
    marginTop: 14,
    fontSize: 8.8,
    color: "#64748B",
    fontWeight: 600,
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
    backgroundColor: "#F8FAFC",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  tableHeaderCell: {
    fontSize: 7.3,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: "#64748B",
    fontWeight: 700,
    paddingVertical: 7,
    paddingHorizontal: 6,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
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
    backgroundColor: "#FBFCFE",
  },
  totalText: {
    fontWeight: 700,
    color: "#10243B",
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
    lineHeight: 1.42,
    marginBottom: 16,
  },
  signatureRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  signatureBox: {
    width: "48%",
    borderWidth: 1,
    borderColor: "#CFD8E3",
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 210,
  },
  signatureHeading: {
    fontSize: 10,
    fontWeight: 700,
    color: "#10243B",
    marginBottom: 10,
  },
  signatureLineBlock: {
    marginTop: 22,
  },
  signatureLine: {
    borderBottomWidth: 1.5,
    borderBottomColor: "#334155",
    height: 28,
  },
  signatureCaption: {
    marginTop: 5,
    fontSize: 8,
    color: "#64748B",
  },
  signatureMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  signatureMeta: {
    width: "47%",
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
});

const Footer = ({ text }: { text: string }) => (
  <View style={styles.footer} fixed>
    <Text style={styles.footerLeft}>{text}</Text>
    <Text
      style={styles.footerRight}
      render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
    />
  </View>
);

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
          <View key={row.label} style={styles.tableRow}>
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
      <Text style={[styles.tableHeaderCell, { width: "22%" }]}>Due date / condition</Text>
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
        return (
          <View key={milestone.id || String(index)} style={styles.tableRow}>
            <Text style={[styles.tableCell, { width: "19%" }]}>
              {milestone.name || "Scheduled payment"}
            </Text>
            <Text style={[styles.tableCell, { width: "9%", textAlign: "center" }]}>
              {pct ? `${pct.toFixed(1)}%` : "—"}
            </Text>
            <Text style={[styles.tableCell, styles.tableCellNum, { width: "15%" }]}>
              {money(amount)}
            </Text>
            <Text style={[styles.tableCell, { width: "22%" }]}>
              {formatDate(milestone.scheduledDate) || "TBD"}
            </Text>
            <Text style={[styles.tableCell, { width: "35%" }]}>
              {milestone.description || milestone.status || "—"}
            </Text>
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
  const sanitizedDoc = sanitizeContractDoc(doc, options);
  const sections = buildContractSections(sanitizedDoc, options);

  const today = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const company =
    options.branding.companyName || sanitizedDoc.contractor.legalName || "Build Profit Solutions";
  const contractorName =
    options.branding.contractorName || sanitizedDoc.contractor.contactName || company;
  const contractorTitle = options.branding.contractorTitle || "Contractor";
  const logo = options.branding.logoUrl || sanitizedDoc.contractor.logoUrl;
  const projectAddress = sanitizedDoc.owner.address || sanitizedDoc.summary.siteAddress;
  const startDate = formatDate(sanitizedDoc.summary.startDate);
  const endDate = formatDate(sanitizedDoc.summary.endDate);
  const validThrough = formatDate(sanitizedDoc.summary.expiresDate);
  const totalBid = Number(sanitizedDoc.summary.totalBid || 0);
  const summaryItems = [
    { label: "Contract price", value: money(totalBid) },
    { label: "Start date", value: startDate },
    {
      label: "Estimated duration",
      value:
        startDate !== "TBD" && endDate !== "TBD"
          ? `${startDate} – ${endDate}`
          : `${sanitizedDoc.summary.durationDays || 30} day${
              sanitizedDoc.summary.durationDays === 1 ? "" : "s"
            }`,
    },
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
  const projectSummary =
    resolveExecutiveSummaryText(sanitizedDoc, options) ||
    `${sanitizedDoc.summary.projectName} proposal with scope, pricing, and schedule prepared for client review.`;
  const trustItems = [
    options.branding.licenseNumber ? "Licensed" : "",
    options.branding.insuranceStatus ? "Insured" : "",
    options.branding.verifiedContractor ? "Verified contractor" : "",
  ].filter(Boolean);
  const materialsSubtotal = Number(sanitizedDoc.materials || 0);
  const laborSubtotal = Number(sanitizedDoc.labor || 0);
  const directCostsSubtotal = Number(sanitizedDoc.permitCosts || 0);
  const overheadSubtotal = Number(sanitizedDoc.overhead || 0);
  const markupAmount =
    materialsSubtotal + laborSubtotal + directCostsSubtotal > 0
      ? totalBid - (materialsSubtotal + laborSubtotal + directCostsSubtotal)
      : 0;
  const pricingRows = [
    { label: "Materials", value: materialsSubtotal },
    { label: "Labor", value: laborSubtotal },
    { label: "Direct Costs", value: directCostsSubtotal },
    { label: "Overhead", value: overheadSubtotal },
    { label: "Markup", value: markupAmount },
    { label: "Contract total", value: totalBid },
  ].filter((row, index) => index === 5 || row.value > 0 || options.pdfMode === "detailed");
  const notes = [
    "Selections, finishes, and owner-furnished items must be approved before ordering.",
    "Lead times begin after approvals, deposit receipt, and material release.",
    "Reasonable site protection, cleanup, and debris handling are included unless otherwise noted.",
    "Access to the work area, parking, and utilities must remain available during active work hours.",
  ];
  const footerBits = [
    options.branding.companyPhone,
    options.branding.companyEmail,
    options.branding.licenseNumber,
  ].filter(Boolean);
  const footerText = footerBits.length ? `${company} · ${footerBits.join(" · ")}` : company;
  const groupedMaterials = groupBy(
    sanitizedDoc.scope.materialLineItems || [],
    (item) => item.section || item.category || "Materials",
  );
  const groupedLabor = groupBy(
    sanitizedDoc.scope.laborLineItems || [],
    (item) => item.category || "Labor",
  );
  const reviewNotice =
    options.state === "other"
      ? "Generic draft: review with local counsel before client use."
      : `Contract language is aligned to the selected jurisdiction (${sections.statePack.heading}). Review before sending.`;
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
            <Text style={styles.coverDeck}>
              Prepared for {sanitizedDoc.owner.legalName || "Client"} for{" "}
              {sanitizedDoc.summary.projectName}.
            </Text>

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

            {trustItems.length ? (
              <Text style={styles.trustLine}>{trustItems.join(" · ")}</Text>
            ) : null}
          </View>

          <View style={styles.coverRail}>
            <View style={styles.railPanel} wrap={false}>
              <Text style={styles.railTitle}>At a glance</Text>
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
              {sections.warnings.some((warning) => warning.level === "warning")
                ? "Review recommended"
                : "Ready to send"}
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

        <Footer text={footerText} />
      </Page>

      <Page size="LETTER" style={styles.page}>
        <Text style={styles.sectionTitle}>Scope & pricing summary</Text>
        {sanitizedDoc.scope.bullets?.length ? (
          <View style={styles.sectionBlock}>
            <Text style={styles.blockTitle}>Included work</Text>
            <BulletList items={sanitizedDoc.scope.bullets} />
          </View>
        ) : null}

        <View style={styles.splitRow}>
          <View style={styles.splitColWide}>
            <Text style={styles.blockTitle}>Pricing summary</Text>
            <PricingTable rows={pricingRows} />
            {options.pdfMode === "client" &&
            ((sanitizedDoc.scope.materialLineItems?.length || 0) > 0 ||
              (sanitizedDoc.scope.laborLineItems?.length || 0) > 0) ? (
              <Text style={styles.subtle}>
                Detailed line items can be provided as an appendix on request.
              </Text>
            ) : null}
          </View>
          <View style={styles.splitColNarrow}>
            <Text style={styles.blockTitle}>Exclusions & assumptions</Text>
            <BulletList items={notes} />
          </View>
        </View>
        <Footer text={footerText} />
      </Page>

      <Page size="LETTER" style={styles.page}>
        <Text style={styles.sectionTitle}>Payment schedule</Text>
        <PaymentTable milestones={sanitizedDoc.milestones} totalBid={totalBid} />
        <Footer text={footerText} />
      </Page>

      <Page size="LETTER" style={styles.page}>
        <Text style={styles.sectionTitle}>Terms & notices</Text>

        <View style={styles.noticeStrip} wrap={false}>
          <Text style={styles.noticeText}>
            <Text style={{ fontWeight: 700 }}>Review notice. </Text>
            {reviewNotice}
          </Text>
        </View>

        {sections.warnings.length ? (
          <View style={[styles.noticeStrip, styles.noticeStripWarn]} wrap={false}>
            <Text style={styles.noticeText}>
              <Text style={{ fontWeight: 700 }}>Before sending.</Text>
            </Text>
            <View style={{ marginTop: 6 }}>
              {sections.warnings.map((warning) => (
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
          <Text style={styles.subtle}>
            Generated from user-provided inputs and template clauses. Not legal advice. Review
            before sending; state-specific counsel may be required.
          </Text>
        </View>
        <Footer text={footerText} />
      </Page>

      <Page size="LETTER" style={styles.page}>
        <Text style={styles.sectionTitle}>Agreement & signatures</Text>
        <Text style={styles.signatureLead}>
          By signing, the parties acknowledge they have reviewed the proposal, pricing, payment
          schedule, and terms above.
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
        <Footer text={footerText} />
      </Page>

      {options.pdfMode === "detailed" ? (
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.sectionTitle}>Detailed appendix</Text>

          {Object.entries(groupedMaterials).map(([group, items]) => {
            const subtotal = items.reduce((sum, item) => sum + Number(item.materials || 0), 0);
            return (
              <View key={group} style={styles.appendixGroup}>
                <Text style={styles.appendixHeading}>{group}</Text>
                <View style={styles.table}>
                  <View style={styles.tableHeaderRow}>
                    <Text style={[styles.tableHeaderCell, { width: "49%" }]}>Description</Text>
                    <Text style={[styles.tableHeaderCell, { width: "12%", textAlign: "center" }]}>
                      Qty
                    </Text>
                    <Text style={[styles.tableHeaderCell, { width: "14%", textAlign: "center" }]}>
                      Unit
                    </Text>
                    <Text style={[styles.tableHeaderCell, { width: "25%", textAlign: "right" }]}>
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

          {Object.entries(groupedLabor).map(([group, items]) => {
            const subtotal = items.reduce((sum, item) => sum + Number(item.labor || 0), 0);
            return (
              <View key={`labor-${group}`} style={styles.appendixGroup}>
                <Text style={styles.appendixHeading}>{group}</Text>
                <View style={styles.table}>
                  <View style={styles.tableHeaderRow}>
                    <Text style={[styles.tableHeaderCell, { width: "75%" }]}>Description</Text>
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

          <Footer text={footerText} />
        </Page>
      ) : null}
    </Document>
  );
};

export default ContractPdfDocument;
