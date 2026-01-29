import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";

export const Footer = () => (
  <View style={styles.footer}>
    <Text style={styles.line}>American Building • License #XXXXXXX</Text>
    <Text style={styles.line}>(702) XXX-XXXX • info@americanbuilding.com</Text>
  </View>
);

const styles = StyleSheet.create({
  footer: {
    marginTop: 18,
    paddingTop: 10,
    borderTop: "1px solid #E5E7EB",
    textAlign: "center",
  },
  line: { fontSize: 9, color: "#6B7280" },
});



