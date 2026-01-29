import React from "react";
import { View, Text, StyleSheet, Image } from "@react-pdf/renderer";

type ContractHeaderProps = {
  companyName: string;
  logoUrl?: string;
  contractId: string;
  dateStr: string;
};

export const ContractHeader: React.FC<ContractHeaderProps> = ({
  companyName,
  logoUrl,
  contractId,
  dateStr,
}) => (
  <View style={styles.header}>
    <View style={styles.leftSide}>
      {logoUrl && <Image src={logoUrl} style={styles.logo} />}
      <View>
        <Text style={styles.companyName}>{companyName}</Text>
        <Text style={styles.contractId}>Contract ID: {contractId}</Text>
      </View>
    </View>
    <View style={styles.rightSide}>
      <Text style={styles.date}>{dateStr}</Text>
      <Text style={styles.poweredBy}>Powered by Build Profit Solutions</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 10,
    borderBottom: "3px solid #0F766E",
  },
  leftSide: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logo: {
    width: 34,
    height: 34,
  },
  companyName: {
    fontSize: 18,
    fontWeight: 700,
    color: "#111827",
  },
  contractId: {
    fontSize: 11,
    color: "#6B7280",
  },
  rightSide: {
    textAlign: "right",
  },
  date: {
    fontSize: 11,
    color: "#111827",
    marginBottom: 2,
  },
  poweredBy: {
    fontSize: 9,
    color: "#9CA3AF",
  },
});



