import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import BackButton from '@/components/ui/BackButton';

export type HelpSupportSubpageWebHeaderProps = {
  title: string;
  /** Optional second title line (e.g. “Estimate” under “How to Create an”). */
  titleLine2?: string;
  darkMode: boolean;
  lightBg: string;
  webHelpHeaderMargins?: { marginLeft: number; marginRight: number };
};

/**
 * Web-only header matching Help & Support / Payment & Billing: gradient-ring back + left-aligned 32px title.
 * Returns `null` on native — screens should render their existing native header separately.
 */
export default function HelpSupportSubpageWebHeader({
  title,
  titleLine2,
  darkMode,
  webHelpHeaderMargins,
}: HelpSupportSubpageWebHeaderProps) {
  const router = useRouter();
  if (Platform.OS !== 'web') return null;

  const titleColor = darkMode ? '#f9fafb' : '#000000';

  return (
    <View style={[styles.headerRow, webHelpHeaderMargins, styles.headerRowWebPayment]}>
      <View style={[styles.backButtonWrapper, styles.backButtonWrapperWebPayment]}>
        <BackButton darkMode={darkMode} onPress={() => router.back()} />
      </View>
      <View style={styles.titleBlockWebPayment}>
        {titleLine2 ? (
          <>
            <Text style={[styles.screenTitleWebPayment, { color: titleColor }]}>{title}</Text>
            <Text
              style={[styles.screenTitleWebPayment, styles.screenTitleWebPaymentSecond, { color: titleColor }]}
            >
              {titleLine2}
            </Text>
          </>
        ) : (
          <Text
            numberOfLines={1}
            ellipsizeMode='tail'
            style={[styles.screenTitleWebPayment, { color: titleColor }]}
          >
            {title}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    alignSelf: 'stretch',
    width: '100%',
    marginTop: 40,
    marginBottom: 12,
    position: 'relative',
  },
  headerRowWebPayment: {
    marginTop: 60,
  },
  backButtonWrapper: {
    zIndex: 1,
  },
  backButtonWrapperWebPayment: {
    marginRight: 12,
  },
  backButtonBorder: {
    borderRadius: 20,
    padding: 1,
    overflow: 'hidden',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleBlockWebPayment: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  screenTitleWebPayment: {
    fontSize: 32,
    fontWeight: '800',
  },
  screenTitleWebPaymentSecond: {
    marginTop: 2,
  },
});
