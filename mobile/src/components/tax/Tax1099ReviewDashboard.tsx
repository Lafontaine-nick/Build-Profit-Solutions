import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { Tax1099ReviewSummary, Tax1099ReviewVendorRow } from '@/src/lib/tax1099Review';
import { format1099ReviewMoney } from '@/src/lib/tax1099Review';

type Props = {
  review: Tax1099ReviewSummary;
  onPressVendor?: (row: Tax1099ReviewVendorRow) => void;
  onSaveVendor?: (row: Tax1099ReviewVendorRow) => void;
  onEditVendorProfile?: (row: Tax1099ReviewVendorRow) => void;
  /** When true, hide the main "Vendor & 1099 Review" heading (e.g. parent card already shows it). */
  omitSectionTitle?: boolean;
};

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon: keyof typeof MaterialIcons.glyphMap;
}) {
  return (
    <View style={styles.card}>
      <MaterialIcons name={icon} size={20} color="#2DFFC4" style={styles.cardIcon} />
      <Text style={styles.cardValue}>{value}</Text>
      <Text style={styles.cardLabel}>{label}</Text>
    </View>
  );
}

export default function Tax1099ReviewDashboard({
  review,
  onPressVendor,
  onSaveVendor,
  onEditVendorProfile,
  omitSectionTitle = false,
}: Props) {
  return (
    <View style={styles.root}>
      {omitSectionTitle ? null : <Text style={styles.sectionTitle}>Vendor & 1099 Review</Text>}
      <Text style={styles.sectionSub}>
        Review vendors detected from expenses. Suppliers usually do not need W-9 tracking, while subcontractors and
        consultants may need year-end review with your CPA.
      </Text>

      <View style={styles.grid}>
        <SummaryCard
          label="Potential 1099 vendors"
          value={review.potential1099VendorCount}
          icon="groups"
        />
        <SummaryCard label="Missing W-9s" value={review.missingW9Count} icon="description" />
        <SummaryCard
          label="Payments missing method"
          value={review.paymentsMissingMethodCount}
          icon="payment"
        />
        <SummaryCard label="Missing vendor info" value={review.missingVendorInfoCount} icon="person-search" />
      </View>

      {review.rows.length === 0 ? (
        <Text style={styles.empty}>No vendor payments in this tax year.</Text>
      ) : (
        review.rows.slice(0, 40).map((row) => (
          <View
            key={`${row.vendorId || 'n'}:${row.displayName}`}
            style={styles.vendorCard}
          >
            <Pressable
              onPress={() => {
                if (row.hasSavedVendor && row.vendorId) onPressVendor?.(row);
              }}
              disabled={!row.hasSavedVendor || !row.vendorId || !onPressVendor}
            >
              <View style={styles.vendorTop}>
                <View style={styles.nameBlock}>
                  <Text style={styles.vendorName} numberOfLines={2}>
                    {row.displayName}
                  </Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{row.vendorTypeBadge}</Text>
                  </View>
                </View>
                <Text style={styles.vendorPaid}>{format1099ReviewMoney(row.totalPaid)}</Text>
              </View>
              <Text style={styles.metaLine}>
                <Text style={styles.metaKey}>Payment method: </Text>
                {row.paymentMethodDisplay}
              </Text>
              {row.w9UiRelevant ? (
                <Text style={styles.metaLine}>
                  <Text style={styles.metaKey}>W-9 status: </Text>
                  {row.w9StatusDisplay}
                </Text>
              ) : row.vendorType === 'supplier' ? (
                <Text style={styles.metaLine}>
                  <Text style={styles.metaKey}>Tracking: </Text>
                  Tracked for expense categorization
                </Text>
              ) : (
                <Text style={styles.metaLine}>
                  <Text style={styles.metaKey}>W-9 tracking: </Text>
                  Not applicable for this vendor type (informational)
                </Text>
              )}
              <Text style={styles.metaLine} numberOfLines={2}>
                <Text style={styles.metaKey}>Projects: </Text>
                {row.projects.length ? row.projects.join(', ') : '—'}
              </Text>
              <View style={styles.chipRow}>
                {row.actionNeeded.length === 0 ? (
                  <Text style={styles.actionNone}>No flags</Text>
                ) : (
                  row.actionNeeded.map((a) => (
                    <View key={a} style={styles.chip}>
                      <Text style={styles.chipText}>{a}</Text>
                    </View>
                  ))
                )}
              </View>
            </Pressable>

            {row.hasSavedVendor && row.vendorId && onEditVendorProfile ? (
              <Pressable
                style={styles.saveVendorBtn}
                onPress={() => onEditVendorProfile(row)}
              >
                <MaterialIcons name="edit" size={18} color="#0f172a" />
                <Text style={styles.saveVendorText}>Edit Vendor Profile</Text>
              </Pressable>
            ) : null}
            {!row.hasSavedVendor && row.saveDraft && onSaveVendor ? (
              <Pressable
                style={styles.saveVendorBtn}
                onPress={() => onSaveVendor(row)}
              >
                <MaterialIcons name="person-add-alt-1" size={18} color="#0f172a" />
                <Text style={styles.saveVendorText}>Save Vendor</Text>
              </Pressable>
            ) : null}
          </View>
        ))
      )}
      {review.rows.length > 40 ? (
        <Text style={styles.moreNote}>Showing first 40 vendors. Export the Accountant Workbook for the full list.</Text>
      ) : null}

      <Text style={styles.disclaimer}>{review.disclaimer}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingBottom: 8,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 6,
  },
  sectionSub: {
    color: 'rgba(148, 163, 184, 0.95)',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 14,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  card: {
    width: '47%',
    minWidth: 140,
    flexGrow: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 12,
  },
  cardIcon: { marginBottom: 6 },
  cardValue: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  cardLabel: { color: 'rgba(148, 163, 184, 0.95)', fontSize: 11, marginTop: 4, lineHeight: 15 },
  vendorCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 12,
    marginBottom: 10,
  },
  vendorTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 6 },
  nameBlock: { flex: 1, gap: 6 },
  vendorName: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(45, 255, 196, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(45, 255, 196, 0.28)',
  },
  badgeText: { color: '#7FDAC5', fontSize: 11, fontWeight: '800' },
  vendorPaid: { color: '#2DFFC4', fontSize: 14, fontWeight: '900' },
  metaLine: { color: 'rgba(203, 213, 225, 0.9)', fontSize: 12, marginTop: 4 },
  metaKey: { color: 'rgba(148, 163, 184, 0.95)', fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  chip: {
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.25)',
  },
  chipText: { color: '#FDE68A', fontSize: 10, fontWeight: '700' },
  actionNone: { color: 'rgba(148, 163, 184, 0.7)', fontSize: 11 },
  empty: { color: 'rgba(148, 163, 184, 0.9)', fontSize: 13, paddingVertical: 12 },
  moreNote: { color: 'rgba(148, 163, 184, 0.85)', fontSize: 11, marginTop: 8 },
  disclaimer: {
    color: 'rgba(148, 163, 184, 0.9)',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 14,
    fontStyle: 'italic',
  },
  saveVendorBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2DFFC4',
    borderRadius: 12,
    paddingVertical: 12,
  },
  saveVendorText: { color: '#0f172a', fontSize: 14, fontWeight: '900' },
});
