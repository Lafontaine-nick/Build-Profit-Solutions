import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

type AttributionType = 'yelp' | 'home-depot' | 'lowes' | 'general';

interface AttributionBadgeProps {
  type: AttributionType;
  compact?: boolean;
  showLearnMore?: boolean;
  style?: any;
}

/**
 * Attribution Badge Component
 * 
 * Displays attribution badges for third-party data sources (Yelp, Home Depot, Lowes)
 * Required for compliance with API terms of service
 * 
 * Usage:
 * <AttributionBadge type="yelp" />
 * <AttributionBadge type="home-depot" compact />
 * <AttributionBadge type="lowes" showLearnMore />
 */
export function AttributionBadge({
  type,
  compact = false,
  showLearnMore = false,
  style,
}: AttributionBadgeProps) {
  const config = getAttributionConfig(type);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(config.url);
  };

  const handleLearnMore = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/legal-hub');
  };

  if (compact) {
    return (
      <TouchableOpacity
        style={[styles.compactBadge, style]}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <Text style={styles.compactText}>{config.compactText}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        style={styles.badge}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <MaterialIcons name={config.icon} size={16} color={config.color} />
        <Text style={styles.badgeText}>{config.text}</Text>
      </TouchableOpacity>
      {showLearnMore && (
        <TouchableOpacity onPress={handleLearnMore} style={styles.learnMore}>
          <Text style={styles.learnMoreText}>Learn more</Text>
          <MaterialIcons name="arrow-forward" size={12} color="#43cea2" />
        </TouchableOpacity>
      )}
    </View>
  );
}

/**
 * Inline Attribution Text Component
 * 
 * For use in footers or as disclaimers below content
 * 
 * Usage:
 * <InlineAttribution type="yelp" />
 */
interface InlineAttributionProps {
  type: AttributionType;
  style?: any;
}

export function InlineAttribution({ type, style }: InlineAttributionProps) {
  const config = getAttributionConfig(type);

  const handleDetailsPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/legal-hub');
  };

  return (
    <View style={[styles.inlineContainer, style]}>
      <MaterialIcons name="info-outline" size={14} color="#9BB4D0" />
      <Text style={styles.inlineText}>
        {config.inlineText}{' '}
        <Text style={styles.inlineLink} onPress={handleDetailsPress}>
          Details
        </Text>
      </Text>
    </View>
  );
}

/**
 * Material Pricing Disclaimer Component
 * 
 * Shows disclaimer for Home Depot/Lowes pricing with verification prompt
 * 
 * Usage:
 * <MaterialPricingDisclaimer store="home-depot" />
 */
interface MaterialPricingDisclaimerProps {
  store: 'home-depot' | 'lowes' | 'general';
  style?: any;
}

export function MaterialPricingDisclaimer({
  store,
  style,
}: MaterialPricingDisclaimerProps) {
  const storeName = store === 'home-depot' ? 'Home Depot' : store === 'lowes' ? 'Lowe\'s' : 'retailer';

  const handleLearnMore = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/legal-hub');
  };

  return (
    <View style={[styles.disclaimerContainer, style]}>
      <View style={styles.disclaimerHeader}>
        <MaterialIcons name="warning" size={18} color="#f59e0b" />
        <Text style={styles.disclaimerTitle}>Price Estimates</Text>
      </View>
      <Text style={styles.disclaimerText}>
        Prices are estimates and may change. Always verify current pricing and availability on the{' '}
        {storeName} website before purchasing.{' '}
        <Text style={styles.disclaimerLink} onPress={handleLearnMore}>
          Learn more
        </Text>
      </Text>
    </View>
  );
}

/**
 * Yelp Results Footer Component
 * 
 * Shows "Powered by Yelp" footer with attribution
 * Place at the bottom of contractor/supplier search results
 * 
 * Usage:
 * <YelpResultsFooter />
 */
export function YelpResultsFooter({ style }: { style?: any }) {
  const handleYelpPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL('https://www.yelp.com');
  };

  const handleLearnMore = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/legal-hub');
  };

  return (
    <View style={[styles.yelpFooter, style]}>
      <View style={styles.yelpRow}>
        <TouchableOpacity
          style={styles.poweredByYelp}
          onPress={handleYelpPress}
          activeOpacity={0.7}
        >
          <MaterialIcons name="star" size={18} color="#ff1a1a" />
          <Text style={styles.poweredByText}>Powered by Yelp</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleLearnMore} style={styles.footerLink}>
          <Text style={styles.footerLinkText}>Attribution</Text>
          <MaterialIcons name="arrow-forward" size={12} color="#43cea2" />
        </TouchableOpacity>
      </View>
      <Text style={styles.yelpFooterText}>
        Business information, ratings, and reviews provided by Yelp. BPS is not affiliated with Yelp.
      </Text>
    </View>
  );
}

// Helper function to get configuration for each attribution type
function getAttributionConfig(type: AttributionType) {
  const configs = {
    yelp: {
      icon: 'star' as any,
      color: '#ff1a1a',
      text: 'Powered by Yelp',
      compactText: 'Yelp',
      inlineText: 'Some ratings sourced via Yelp Fusion API.',
      url: 'https://www.yelp.com',
    },
    'home-depot': {
      icon: 'store' as any,
      color: '#f96302',
      text: 'Home Depot®',
      compactText: 'HD',
      inlineText: 'Pricing via Home Depot affiliate program.',
      url: 'https://www.homedepot.com',
    },
    lowes: {
      icon: 'store' as any,
      color: '#004990',
      text: 'Lowe\'s®',
      compactText: 'Lowe\'s',
      inlineText: 'Pricing via Lowe\'s affiliate program.',
      url: 'https://www.lowes.com',
    },
    general: {
      icon: 'info' as any,
      color: '#43cea2',
      text: 'Third-party data',
      compactText: 'Info',
      inlineText: 'Data provided by authorized third-party sources.',
      url: '#',
    },
  };

  return configs[type] || configs.general;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 6,
  },
  compactBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  compactText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  learnMore: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  learnMoreText: {
    fontSize: 12,
    color: '#43cea2',
    marginRight: 4,
  },
  inlineContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(155, 180, 208, 0.1)',
    borderRadius: 8,
    marginVertical: 8,
  },
  inlineText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: '#9BB4D0',
    marginLeft: 8,
  },
  inlineLink: {
    color: '#43cea2',
    textDecorationLine: 'underline',
  },
  disclaimerContainer: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
    padding: 12,
    borderRadius: 8,
    marginVertical: 12,
  },
  disclaimerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  disclaimerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FCD34D',
    marginLeft: 8,
  },
  disclaimerText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#FCD34D',
  },
  disclaimerLink: {
    color: '#43cea2',
    textDecorationLine: 'underline',
  },
  yelpFooter: {
    backgroundColor: 'rgba(255, 26, 26, 0.1)',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 26, 26, 0.2)',
    marginVertical: 12,
  },
  yelpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  poweredByYelp: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  poweredByText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ff1a1a',
    marginLeft: 6,
  },
  footerLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerLinkText: {
    fontSize: 12,
    color: '#43cea2',
    marginRight: 4,
  },
  yelpFooterText: {
    fontSize: 11,
    lineHeight: 16,
    color: '#CFE6FF',
  },
});

