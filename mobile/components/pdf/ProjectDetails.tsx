import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";

type ProjectDetailsProps = {
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
};

export const ProjectDetails: React.FC<ProjectDetailsProps> = ({
  customer,
  project,
}) => (
  <View style={styles.container}>
    <View style={styles.box}>
      <Text style={styles.heading}>CUSTOMER INFORMATION</Text>
      <DetailRow label="Name" value={customer.name} />
      {customer.email && <DetailRow label="Email" value={customer.email} muted />}
      {customer.phone && <DetailRow label="Phone" value={customer.phone} muted />}
    </View>

    <View style={styles.box}>
      <Text style={styles.heading}>PROJECT DETAILS</Text>
      <DetailRow label="Project" value={project.name} />
      {project.address && <DetailRow label="Address" value={project.address} muted />}
      {project.duration && <DetailRow label="Duration" value={project.duration} muted />}
      {project.warranty && <DetailRow label="Warranty" value={project.warranty} muted />}
    </View>
  </View>
);

const DetailRow = ({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) => (
  <View style={styles.row}>
    <Text style={[styles.label, muted && styles.muted]}>
      {muted ? label : <Text style={styles.bold}>{label}:</Text>} {value}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 12,
    marginTop: 14,
    marginBottom: 12,
  },
  box: {
    flex: 1,
    border: "1px solid #E6E8EA",
    borderRadius: 8,
    padding: 10,
  },
  heading: {
    fontSize: 13,
    fontWeight: 700,
    color: "#0F766E",
    marginBottom: 8,
  },
  row: {
    marginVertical: 3,
  },
  label: {
    fontSize: 12,
    lineHeight: 1.55,
  },
  bold: {
    fontWeight: 700,
  },
  muted: {
    color: "#6B7280",
  },
});



