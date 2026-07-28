import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  buildShowerRoughPricingDetails,
  type ShowerRoughPricingContext,
} from '@/utils/bathroomPlumbingRoughPricing';

export default function ShowerRoughPricingDetails({
  context,
  darkMode,
  captionColor,
  textColor,
}: {
  context: ShowerRoughPricingContext;
  darkMode: boolean;
  captionColor: string;
  textColor: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [fullScopeOpen, setFullScopeOpen] = useState(false);
  const details = buildShowerRoughPricingDetails(context);
  const borderColor = darkMode ? 'rgba(96,165,250,0.22)' : 'rgba(96,165,250,0.18)';
  const panelBg = darkMode ? 'rgba(15,23,42,0.58)' : 'rgba(248,250,252,0.92)';

  return (
    <View style={{ marginTop: 8 }}>
      <Text style={{ color: captionColor, fontSize: 12, fontWeight: '600', lineHeight: 16 }}>
        {details.includesScopeLine}
      </Text>
      <Text style={{ color: captionColor, fontSize: 12, fontWeight: '500', marginTop: 4, lineHeight: 16 }}>
        {details.planningRangeLabel}
      </Text>
      <Text style={{ color: captionColor, fontSize: 12, fontWeight: '500', marginTop: 6, lineHeight: 16 }}>
        {details.assumptionText}
      </Text>

      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => {
          setExpanded((open) => {
            if (open) setFullScopeOpen(false);
            return !open;
          });
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        style={[styles.toggleRow, { marginTop: 8 }]}
      >
        <Text style={styles.toggleText}>{expanded ? 'Hide details' : 'View details'}</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={15} color="#0f766e" />
      </TouchableOpacity>

      {expanded ? (
        <View style={[styles.panel, { borderColor, backgroundColor: panelBg }]}>
          <Text style={[styles.disclaimer, { color: captionColor }]}>{details.disclaimer}</Text>

          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => setFullScopeOpen((open) => !open)}
            accessibilityRole="button"
            accessibilityState={{ expanded: fullScopeOpen }}
            style={[styles.fullScopeToggle, { borderTopColor: borderColor }]}
          >
            <Text style={styles.fullScopeToggleText}>
              {fullScopeOpen ? 'Hide full scope list' : 'Full scope list'}
            </Text>
            <Ionicons
              name={fullScopeOpen ? 'chevron-up' : 'chevron-down'}
              size={14}
              color="#0f766e"
            />
          </TouchableOpacity>

          {fullScopeOpen ? (
            <View style={styles.fullScopeBody}>
              <Text style={[styles.sectionHeading, { color: textColor }]}>Includes</Text>
              {details.includes.map((line) => (
                <Text key={line} style={[styles.bullet, { color: captionColor }]}>
                  • {line}
                </Text>
              ))}

              <Text style={[styles.sectionHeading, { color: textColor, marginTop: 8 }]}>Excludes</Text>
              {details.excludes.map((line) => (
                <Text key={line} style={[styles.bullet, { color: captionColor }]}>
                  • {line}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  toggleText: {
    color: '#0f766e',
    fontSize: 13,
    fontWeight: '700',
  },
  panel: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  disclaimer: {
    fontSize: 11,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  fullScopeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  fullScopeToggleText: {
    color: '#0f766e',
    fontSize: 12,
    fontWeight: '700',
  },
  fullScopeBody: {
    marginTop: 4,
    gap: 2,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  bullet: {
    fontSize: 11,
    lineHeight: 16,
    paddingLeft: 2,
  },
});
