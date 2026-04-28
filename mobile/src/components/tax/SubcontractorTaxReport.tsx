import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { SubcontractorPaymentSummary } from '@/src/lib/taxCenter';

type Props = {
  vendors: SubcontractorPaymentSummary[];
  formatMoney: (value: number) => string;
};

export default function SubcontractorTaxReport({ vendors, formatMoney }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Subcontractor payment summary</Text>
      <Text style={styles.subtitle}>
        Review vendors and subcontractors before year-end reporting. Confirm vendor eligibility, payment method, W-9
        status, and filing requirements with your CPA or tax professional when Potential 1099 review applies.
      </Text>

      {vendors.length === 0 ? (
        <Text style={styles.empty}>No subcontractor payments found for this tax year.</Text>
      ) : (
        vendors.map((vendor) => (
          <View key={vendor.name} style={styles.vendorCard}>
            <View style={styles.vendorHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.vendorName}>{vendor.name}</Text>
                <Text style={styles.projects} numberOfLines={2}>
                  {vendor.projects.length ? vendor.projects.join(', ') : 'No project linked'}
                </Text>
                <Text style={styles.metaLine}>EIN: {vendor.einPlaceholder}</Text>
                <Text style={styles.metaLine}>Address: {vendor.addressPlaceholder}</Text>
                <Text style={styles.metaLine}>W-9 uploaded: {vendor.w9Uploaded ? 'Yes' : 'No'}</Text>
              </View>
              <Text style={styles.amount}>{formatMoney(vendor.totalPaid)}</Text>
            </View>

            <View style={styles.flags}>
              <View style={styles.flag}>
                <MaterialIcons name="assignment-late" size={14} color="#FBBF24" />
                <Text style={styles.flagText}>Missing W-9 placeholder</Text>
              </View>
              {vendor.potential1099Review ? (
                <View style={[styles.flag, styles.reviewFlag]}>
                  <MaterialIcons name="fact-check" size={14} color="#2DFFC4" />
                  <Text style={[styles.flagText, styles.reviewText]}>Potential 1099 review</Text>
                </View>
              ) : null}
            </View>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 0,
    padding: 18,
    paddingBottom: 4,
    backgroundColor: 'transparent',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    color: 'rgba(203, 213, 225, 0.82)',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
    marginBottom: 14,
  },
  vendorCard: {
    borderRadius: 16,
    padding: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 12,
  },
  vendorHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  vendorName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  projects: {
    color: 'rgba(203, 213, 225, 0.8)',
    fontSize: 12,
    marginTop: 4,
  },
  metaLine: {
    color: 'rgba(148, 163, 184, 0.85)',
    fontSize: 11,
    marginTop: 3,
  },
  amount: {
    color: '#2DFFC4',
    fontSize: 15,
    fontWeight: '900',
  },
  flags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  flag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
  },
  reviewFlag: {
    backgroundColor: 'rgba(45, 255, 196, 0.12)',
  },
  flagText: {
    color: '#FDE68A',
    fontSize: 11,
    fontWeight: '700',
  },
  reviewText: {
    color: '#9AFBE2',
  },
  empty: {
    color: 'rgba(203, 213, 225, 0.75)',
    fontSize: 13,
    lineHeight: 18,
  },
});
