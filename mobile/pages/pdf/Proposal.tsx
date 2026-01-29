import React from "react";
import { Page, Document, View } from "@react-pdf/renderer";
import { ContractTotals } from "../../components/pdf/ContractTotals";
import { LaborSection } from "../../components/pdf/LaborSection";
import { GrandTotalWithTax } from "../../components/pdf/GrandTotalWithTax";
import { Footer } from "../../components/pdf/Footer";
import { PoweredBy } from "../../components/pdf/PoweredBy";

export const ProposalPDF = () => {
  const materials = 2623.06;
  const labor = 5500;
  const subtotal = materials + labor;

  return (
    <Document>
      <Page size="LETTER" style={{ padding: 28 }}>
        {/* ...Customer + Project Details + Materials tables... */}

        <LaborSection
          items={[
            { task: "Demolition", amount: 500 },
            { task: "Tile Installation", amount: 5000 },
            { task: "", amount: 0 },
          ]}
        />

        <ContractTotals materialsTotal={materials} laborTotal={labor} />

        {/* Optional tax & grand total */}
        <GrandTotalWithTax subtotal={subtotal} taxRate={0.0838} />

        <Footer />
        <PoweredBy />
      </Page>
    </Document>
  );
};



