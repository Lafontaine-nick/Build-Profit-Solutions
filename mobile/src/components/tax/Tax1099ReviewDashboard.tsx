import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { Tax1099ReviewSummary, Tax1099ReviewVendorRow } from '@/src/lib/tax1099Review';
import { format1099ReviewMoney } from '@/src/lib/tax1099Review';

function paidColor(amount: number): string {
  if (!Number.isFinite(amount) || amount === 0) return '#94a3b8';
  if (amount < 0) return '#f87171';
  return '#2dcc9a';
}

function formatChipLabel(action: string): string {
  if (action === 'Confirm Payment Method') return 'Missing payment method';
  if (action === 'Potential 1099 Review') return 'Potential 1099 review';
  if (action === 'Missing W-9') return 'Missing W-9';
  return action;
}

type Props = {
  review: Tax1099ReviewSummary;
  onPressVendor?: (row: Tax1099ReviewVendorRow) => void;
  onSaveVendor?: (row: Tax1099ReviewVendorRow) => void;
  onEditVendorProfile?: (row: Tax1099ReviewVendorRow) => void;
  /** When true, hide the main "Vendor & 1099 Review" heading (e.g. parent card already shows it). */
  omitSectionTitle?: boolean;
};

export default function Tax1099ReviewDashboard({
  review,
  onPressVendor,
  onSaveVendor,
  onEditVendorProfile,
  omitSectionTitle = false,
}: Props) {
  return (
    <View style={styles.root}>
      {omitSectionTitle ? null : (
        <>
          <Text style={styles.sectionTitle}>Vendor & 1099 Review</Text>
          <Text style={styles.sectionSub}>
            Review vendors detected from expenses. Confirm Potential 1099 review flags and W-9 tracking with your CPA —
            not tax advice.
          </Text>
        </>
      )}

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
                <Text style={[styles.vendorPaid, { color: paidColor(row.totalPaid) }]}>
                  {format1099ReviewMoney(row.totalPaid)}
                </Text>
              </View>
              {row.paymentMethodDisplay !== '—' ? (
                <Text style={styles.metaLine}>
                  <Text style={styles.metaKey}>Payment method: </Text>
                  {row.paymentMethodDisplay}
                </Text>
              ) : null}
              {row.w9UiRelevant ? (
                <Text style={styles.metaLine}>
                  <Text style={styles.metaKey}>W-9 status: </Text>
                  <Text style={row.actionNeeded.includes('Missing W-9') ? styles.metaWarn : undefined}>
                    {row.w9StatusDisplay}
                  </Text>
                </Text>
              ) : null}
              <Text style={styles.metaLine} numberOfLines={2}>
                <Text style={styles.metaKey}>Projects: </Text>
                {row.projects.length ? row.projects.join(', ') : '—'}
              </Text>
              {row.actionNeeded.length > 0 ? (
                <View style={styles.chipRow}>
                  {row.actionNeeded.map((a) => (
                    <View key={a} style={styles.chip}>
                      <Text style={styles.chipText}>{formatChipLabel(a)}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </Pressable>

            {row.hasSavedVendor && row.vendorId && onEditVendorProfile ? (
              <Pressable
                style={styles.vendorSecondaryBtn}
                onPress={() => onEditVendorProfile(row)}
              >
                <MaterialIcons name="edit" size={17} color="#2dcc9a" />
                <Text style={styles.vendorSecondaryBtnText}>Edit Vendor Profile</Text>
              </Pressable>
            ) : null}
            {!row.hasSavedVendor && row.saveDraft && onSaveVendor ? (
              <Pressable
                style={styles.vendorSecondaryBtn}
                onPress={() => onSaveVendor(row)}
              >
                <MaterialIcons name="person-add-alt-1" size={17} color="#2dcc9a" />
                <Text style={styles.vendorSecondaryBtnText}>Save Vendor</Text>
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
    marginTop: 14,
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
  vendorCard: {
    backgroundColor: 'transparent',
    paddingTop: 4,
    paddingBottom: 2,
    marginBottom: 4,
  },
  vendorTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 6 },
  nameBlock: { flex: 1, gap: 6 },
  vendorName: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(45, 204, 154, 0.16)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(45, 204, 154, 0.55)',
  },
  badgeText: { color: '#8eecc9', fontSize: 11, fontWeight: '800' },
  vendorPaid: { fontSize: 18, fontWeight: '800', letterSpacing: -0.25 },
  metaLine: { color: 'rgba(203, 213, 225, 0.9)', fontSize: 12, marginTop: 4 },
  metaKey: { color: 'rgba(148, 163, 184, 0.95)', fontWeight: '700' },
  metaWarn: { color: '#FBBF24', fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  chip: {
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.25)',
  },
  chipText: { color: '#FBBF24', fontSize: 12, fontWeight: '700' },
  empty: { color: 'rgba(148, 163, 184, 0.9)', fontSize: 13, paddingVertical: 12 },
  moreNote: { color: 'rgba(148, 163, 184, 0.85)', fontSize: 11, marginTop: 8 },
  disclaimer: {
    color: 'rgba(148, 163, 184, 0.9)',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 14,
    fontStyle: 'italic',
  },
  vendorSecondaryBtn: {
    marginTop: 12,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 18,
    paddingVertical: 11,
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: '#3A3A3C',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
  },
  vendorSecondaryBtnText: {
    color: '#2dcc9a',
    fontSize: 15,
    fontWeight: '600',
  },
});
