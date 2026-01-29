import React from "react";
import { Page, Document, View, Text, StyleSheet } from "@react-pdf/renderer";
import {
  ContractHeader,
  ProjectDetails,
  MaterialsSection,
  LaborSection,
  ContractTotals,
  GrandTotalWithTax,
  Footer,
  PoweredBy,
} from "../../components/pdf";

export type ContractData = {
  companyName: string;
  logoUrl?: string;
  contractId: string;
  dateStr: string;
  customer: {
    name: string;
    email?: string;
    phone?: string;
  };
  project: {
    name: string;
    address?: string;
    duration?: string;
    warranty?: string;
  };
  scopeSummary?: string;
  materials: Array<{
    description: string;
    quantity?: number;
    unit?: string;
    materials?: number;
    section?: string;
  }>;
  labor: Array<{
    task?: string;
    amount: number;
  }>;
  taxRate?: number;
  currency?: string;
  minVisibleMaterialAmount?: number;
};

export const CompleteContract: React.FC<{ data: ContractData }> = ({ data }) => {
  const materialsTotal = data.materials.reduce((sum, item) => sum + (item.materials ?? 0), 0);
  const laborTotal = data.labor.reduce((sum, item) => sum + (item.amount ?? 0), 0);
  const subtotal = materialsTotal + laborTotal;

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <ContractHeader
          companyName={data.companyName}
          logoUrl={data.logoUrl}
          contractId={data.contractId}
          dateStr={data.dateStr}
        />

        {/* Contract Total Badge */}
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            <Text style={styles.badgeBold}>Total (Contract): </Text>
            {new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: data.currency || "USD",
            }).format(subtotal)}
          </Text>
          {data.project.duration && (
            <Text style={styles.badgeText}> • Duration: {data.project.duration}</Text>
          )}
          {data.project.warranty && (
            <Text style={styles.badgeText}> • Warranty: {data.project.warranty}</Text>
          )}
        </View>

        {/* Customer & Project Details */}
        <ProjectDetails customer={data.customer} project={data.project} />

        {/* Scope Summary */}
        {data.scopeSummary && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>SCOPE SUMMARY</Text>
            <Text style={styles.scopeText}>{data.scopeSummary}</Text>
          </View>
        )}

        {/* Description / Cost Header */}
        <Text style={styles.sectionTitle}>DESCRIPTION / COST</Text>

        {/* Materials */}
        <MaterialsSection
          items={data.materials}
          currency={data.currency}
          minVisibleAmount={data.minVisibleMaterialAmount}
        />

        {/* Labor */}
        <LaborSection items={data.labor} currency={data.currency} />

        {/* Totals */}
        <ContractTotals
          materialsTotal={materialsTotal}
          laborTotal={laborTotal}
          currency={data.currency}
        />

        {/* Tax (if applicable) */}
        {data.taxRate && data.taxRate > 0 && (
          <GrandTotalWithTax
            subtotal={subtotal}
            taxRate={data.taxRate}
            currency={data.currency}
          />
        )}

        {/* Footer */}
        <Footer />
        <PoweredBy />
      </Page>
    </Document>
  );
};

const styles = StyleSheet.create({
  page: {
    padding: 28,
    fontFamily: "Helvetica",
    color: "#111827",
  },
  badge: {
    backgroundColor: "#EAF6F4",
    borderRadius: 8,
    padding: "10px 12px",
    marginVertical: 10,
  },
  badgeText: {
    fontSize: 12,
  },
  badgeBold: {
    fontWeight: 700,
  },
  section: {
    marginVertical: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: "#0F766E",
    marginTop: 18,
    marginBottom: 8,
  },
  scopeText: {
    fontSize: 12,
    lineHeight: 1.55,
    color: "#374151",
  },
});



