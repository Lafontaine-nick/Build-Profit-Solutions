import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Linking,
  Platform,
  SafeAreaView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

type TabType = 'terms' | 'privacy' | 'refund' | 'tax' | 'attrib';

/**
 * Legal Hub Screen
 * - Terms of Use with specific sections for Yelp, Home Depot, Lowes
 * - Privacy Policy placeholder
 * - Tax Center disclosure (exports, AI insight, CPA review)
 * - Data Sources & Attributions
 * - Deep linkable sections for compliance
 */
export default function LegalHubScreen() {
  const { darkMode, theme: themeContext } = useTheme();
  const Colors = useMemo(() => getColors(themeContext), [themeContext]);
  const params = useLocalSearchParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState<TabType>('terms');
  const [scrollToSection, setScrollToSection] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const theme = useMemo(() => ({
    background: Colors.bg,
    card: Colors.surface2,
    text: Colors.text,
    subtext: Colors.sub,
    accent: Colors.primary,
    border: Colors.line,
    iconBg: Colors.iconBg || 'rgba(67, 206, 162, 0.15)',
  }), [Colors]);

  // Check for tab parameter on mount and when params change
  useEffect(() => {
    if (params.tab) {
      const tabParam = params.tab.toLowerCase();
      if (['terms', 'privacy', 'refund', 'tax', 'attrib'].includes(tabParam)) {
        setActiveTab(tabParam as TabType);
      }
    }
  }, [params.tab]);

  const handleTabChange = (tab: TabType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
    setScrollToSection(null);
  };

  const navigateToSection = (section: string, tab: TabType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActiveTab(tab);
    setScrollToSection(section);
    // Scroll to top first, then let the content render
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    }, 50);
  };

  const openExternalLink = (url: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(url);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.backButtonWrapper}>
            <LinearGradient
              colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
              start={{ x: 0.05, y: 0.15 }}
              end={{ x: 0.95, y: 0.85 }}
              style={styles.backButtonBorder}
            >
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.back();
                }}
                style={[styles.backButton, { backgroundColor: darkMode ? "#000000" : Colors.bg }]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialIcons name="arrow-back" size={24} color={darkMode ? "#FFFFFF" : "#000000"} />
              </TouchableOpacity>
            </LinearGradient>
          </View>
          <View style={styles.titleContainer}>
            <Text style={[styles.screenTitle, { color: darkMode ? "#f9fafb" : "#000000" }]}>
              Legal & Disclosures
            </Text>
          </View>
          <View style={styles.backButtonWrapper} />
        </View>

        {/* Tabs: horizontal scroll so long labels stay on one line (no flex squeeze). */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsRow}
          contentContainerStyle={styles.tabsRowContent}
          bounces
        >
          <TouchableOpacity
            style={[
              styles.tab,
              { backgroundColor: activeTab === 'terms' ? theme.card : 'transparent', borderColor: theme.border }
            ]}
            onPress={() => handleTabChange('terms')}
          >
            <Text
              numberOfLines={1}
              style={[styles.tabText, { color: activeTab === 'terms' ? theme.text : theme.subtext }]}
            >
              Terms
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab,
              { backgroundColor: activeTab === 'privacy' ? theme.card : 'transparent', borderColor: theme.border }
            ]}
            onPress={() => handleTabChange('privacy')}
          >
            <Text
              numberOfLines={1}
              style={[styles.tabText, { color: activeTab === 'privacy' ? theme.text : theme.subtext }]}
            >
              Privacy
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab,
              { backgroundColor: activeTab === 'refund' ? theme.card : 'transparent', borderColor: theme.border }
            ]}
            onPress={() => handleTabChange('refund')}
          >
            <Text
              numberOfLines={1}
              style={[styles.tabText, { color: activeTab === 'refund' ? theme.text : theme.subtext }]}
            >
              Refund Policy
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab,
              { backgroundColor: activeTab === 'tax' ? theme.card : 'transparent', borderColor: theme.border }
            ]}
            onPress={() => handleTabChange('tax')}
          >
            <Text
              numberOfLines={1}
              style={[styles.tabText, { color: activeTab === 'tax' ? theme.text : theme.subtext }]}
            >
              Tax Disclosure
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab,
              { backgroundColor: activeTab === 'attrib' ? theme.card : 'transparent', borderColor: theme.border }
            ]}
            onPress={() => handleTabChange('attrib')}
          >
            <Text
              numberOfLines={1}
              style={[styles.tabText, { color: activeTab === 'attrib' ? theme.text : theme.subtext }]}
            >
              Attributions
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Content Card */}
        <LinearGradient
          colors={["#2DFFC4", "#00A6FF"]}
          start={{ x: 0.05, y: 0.15 }}
          end={{ x: 0.95, y: 0.85 }}
          style={{ borderRadius: 24, padding: 1, marginHorizontal: 8, flex: 1, marginBottom: 16 }}
        >
          <View style={[styles.contentCard, { backgroundColor: theme.background }]}>
            <ScrollView
              ref={scrollViewRef}
              style={styles.scrollView}
              showsVerticalScrollIndicator={true}
              contentContainerStyle={styles.scrollContent}
            >
              {activeTab === 'terms' && <TermsOfUseContent highlightSection={scrollToSection} theme={theme} />}
              {activeTab === 'privacy' && <PrivacyPolicyContent theme={theme} />}
              {activeTab === 'refund' && <RefundPolicyContent theme={theme} />}
              {activeTab === 'tax' && <TaxCenterDisclosureContent theme={theme} />}
              {activeTab === 'attrib' && (
                <AttributionsContent
                  onNavigate={navigateToSection}
                  onOpenLink={openExternalLink}
                  theme={theme}
                />
              )}
            </ScrollView>
          </View>
        </LinearGradient>
      </SafeAreaView>
    </View>
  );
}

// ========== TERMS OF USE CONTENT ==========
function TermsOfUseContent({ highlightSection, theme }: { highlightSection: string | null; theme: any }) {
  return (
    <View>
      <SectionHeader title="Terms of Use" subtitle="Effective: November 2025" theme={theme} />

      <Section id="1" highlight={highlightSection === '1'} theme={theme}>
        <H2 theme={theme}>1. Acceptance of Terms</H2>
        <P theme={theme}>
          By accessing or using Build Profit Solutions ("BPS", "the App", "we", "our"), you agree
          to be bound by these Terms of Use. If you do not agree, you must discontinue use
          immediately.
        </P>
        <P theme={theme}>
          These Terms apply to all users in the United States and internationally. Your
          relationship is solely with Build Profit Solutions, LLC, a Nevada company.
        </P>
      </Section>

      <Section id="2" highlight={highlightSection === '2'} theme={theme}>
        <H2 theme={theme}>2. Eligibility</H2>
        <P theme={theme}>
          You represent that you are at least 18 years old and legally able to enter into binding
          agreements. If you use BPS on behalf of a business, you represent that you have authority
          to bind that business to these Terms.
        </P>
      </Section>

      <Section id="3" highlight={highlightSection === '3'} theme={theme}>
        <H2 theme={theme}>3. License and Acceptable Use</H2>
        <P theme={theme}>
          We grant you a limited, non-exclusive, non-transferable license to use BPS for internal
          business purposes, including project estimation, bid generation, lead management, and
          construction workflows.
        </P>
        <P theme={theme}>You may not:</P>
        <BulletList
          items={[
            'Reverse engineer, scrape, or attempt to extract underlying source code',
            'Share your account or login outside your organization',
            'Use the App to build or train a competing service',
            'Resell, redistribute, or publicly publish any BPS data',
            'Automate high-volume requests or interfere with App performance',
            'Use BPS to collect data for competitor benchmarking or directory-building',
          ]}
          theme={theme}
        />
        <P theme={theme}>
          We reserve the right to suspend or terminate accounts engaged in misuse.
        </P>
      </Section>

      <Section id="4" highlight={highlightSection === '4'} theme={theme}>
        <H2 theme={theme}>4. User Responsibilities</H2>
        <P theme={theme}>
          You are responsible for maintaining the confidentiality of your login credentials and for
          all activity under your account. You are also responsible for entering accurate job,
          cost, labor, or material information and for verifying any outputs before using them in bids
          or business decisions.
        </P>
        <P theme={theme}>BPS is not responsible for inaccurate data entered by users.</P>
      </Section>

      <Section id="5" highlight={highlightSection === '5'} theme={theme}>
        <H2 theme={theme}>5. Payment, Free Trial, and Subscriptions</H2>
        <P theme={theme}>Certain features of BPS require a paid subscription.</P>
        <H3 theme={theme}>5.1 Free Trial</H3>
        <P theme={theme}>
          New users may receive a 7-day free trial. No charges are applied until the trial ends.
          Your subscription will automatically renew unless cancelled before the trial expires.
        </P>
        <H3 theme={theme}>5.2 Billing</H3>
        <P theme={theme}>
          Billing is automatic and recurring. Subscription payments become non-refundable once the
          trial period has ended, except where required by law. Partially used billing periods and
          renewal charges are not refundable.
        </P>
        <H3 theme={theme}>5.3 App Store Purchases</H3>
        <P theme={theme}>
          If you subscribe through the Apple App Store or Google Play Store, billing and refund
          requests must be handled directly through Apple or Google according to their policies.
        </P>
        <H3 theme={theme}>5.4 Payment Processing</H3>
        <P theme={theme}>
          Web subscriptions are processed securely through Stripe or another authorized payment
          processor.
        </P>
      </Section>

      <Section id="6" highlight={highlightSection === '6'} theme={theme}>
        <H2 theme={theme}>6. Estimates, Calculations & Data Disclaimer</H2>
        <P theme={theme}>
          All estimates, calculations, material pricing, labor data, or outputs provided by BPS are
          informational only. Actual costs vary based on suppliers, regions, labor availability,
          market changes, and job conditions.
        </P>
        <P theme={theme}>
          You are solely responsible for verifying accuracy before submitting bids, proposals, or
          quotes. BPS does not guarantee cost accuracy, profitability, job outcomes, or project
          feasibility.
        </P>
      </Section>

      <Section id="7" highlight={highlightSection === '7'} theme={theme}>
        <H2 theme={theme}>7. AI-Generated Content Disclaimer</H2>
        <P theme={theme}>
          If any App features generate AI-based recommendations, calculations, or summaries, outputs
          may be inaccurate or incomplete. AI results must be reviewed by a qualified professional,
          and BPS is not responsible for decisions made based on AI outputs. AI tools do not replace
          professional judgment.
        </P>
      </Section>

      <Section id="8" highlight={highlightSection === '8'} theme={theme}>
        <H2 theme={theme}>8. Intellectual Property</H2>
        <P theme={theme}>
          All content, features, designs, workflows, databases, and functionality are owned by
          Build Profit Solutions, LLC and are protected by intellectual property laws. You may not
          copy, reproduce, modify, or create derivative works based on BPS.
        </P>
      </Section>

      <Section id="9" highlight={highlightSection === '9'} theme={theme}>
        <H2 theme={theme}>9. Third-Party Data & API Sources</H2>
        <P theme={theme}>
          BPS may use APIs and data from external providers (including but not limited to Yelp,
          Home Depot, Lowe's, SerpAPI, WebScrapingAPI, and others). This data is provided "AS IS"
          and "AS AVAILABLE," is subject to provider terms, and may change without notice. BPS does
          not claim ownership over third-party data.
        </P>
        <P theme={theme}>
          Business names, reviews, and related information from Yelp are subject to Yelp's Terms of
          Service, and where required, "Powered by Yelp" attribution will be displayed. Pricing
          and product data from retailers such as Home Depot or Lowe's are for estimation only and
          must be verified directly with the retailer.
        </P>
      </Section>

      <Section id="10" highlight={highlightSection === '10'} theme={theme}>
        <H2 theme={theme}>10. Data Accuracy Disclaimer</H2>
        <P theme={theme}>
          Third-party information, AI outputs, supplier prices, and material/labor data are provided
          "AS IS" and "AS AVAILABLE." BPS cannot guarantee accuracy, completeness, real-time
          updates, or pricing stability. You are solely responsible for verifying information
          before relying on it.
        </P>
      </Section>

      <Section id="11" highlight={highlightSection === '11'} theme={theme}>
        <H2 theme={theme}>11. Subcontractor Marketplace Disclaimer</H2>
        <P theme={theme}>
          If BPS allows subcontractors to list prices, services, or profiles, BPS does not vet,
          endorse, or guarantee subcontractor quality. BPS is not a hiring party, broker, or agent
          and is not responsible for disputes between contractors and subcontractors. All
          subcontractor interactions are at your own risk.
        </P>
      </Section>

      <Section id="12" highlight={highlightSection === '12'} theme={theme}>
        <H2 theme={theme}>12. No Professional Advice</H2>
        <P theme={theme}>
          BPS does not provide legal, financial, construction safety, engineering, or architectural
          advice. All information is informational only and not a substitute for professional
          services.
        </P>
      </Section>

      <Section id="13" highlight={highlightSection === '13'} theme={theme}>
        <H2 theme={theme}>13. Limitation of Liability</H2>
        <P theme={theme}>
          To the maximum extent permitted by law, BPS and its owners, officers, managers, employees,
          and affiliates are not liable for any lost profits, cost overruns, business losses, data
          loss, project delays, incorrect estimates, or any indirect, incidental, special, or
          consequential damages arising from or related to your use of the App.
        </P>
        <P theme={theme}>
          In no event shall BPS's total liability exceed the greater of (a) the total amount paid
          by you in the twelve (12) months prior to the event giving rise to liability, or (b) one
          hundred dollars (US $100).
        </P>
      </Section>

      <Section id="14" highlight={highlightSection === '14'} theme={theme}>
        <H2 theme={theme}>14. Indemnification</H2>
        <P theme={theme}>
          You agree to indemnify, defend, and hold harmless BPS, its owners, managers, employees,
          and affiliates from any claim, loss, liability, or damage arising from your use of the
          App, the data you enter, your reliance on estimates or information from BPS, your
          violation of these Terms, or your interactions with subcontractors.
        </P>
      </Section>

      <Section id="15" highlight={highlightSection === '15'} theme={theme}>
        <H2 theme={theme}>15. Corporate Shield Protection</H2>
        <P theme={theme}>
          You agree that all claims shall be brought solely against Build Profit Solutions, LLC, and
          not against its individual owners, officers, or employees.
        </P>
      </Section>

      <Section id="16" highlight={highlightSection === '16'} theme={theme}>
        <H2 theme={theme}>16. Termination</H2>
        <P theme={theme}>
          We may suspend or terminate your access to BPS at our discretion, including for misuse,
          violations of these Terms, fraudulent activity, or legal compliance requirements.
        </P>
      </Section>

      <Section id="17" highlight={highlightSection === '17'} theme={theme}>
        <H2 theme={theme}>17. Arbitration Agreement</H2>
        <P theme={theme}>
          Any dispute arising from these Terms or your use of the App shall be resolved exclusively
          through binding arbitration in Clark County, Nevada, under the rules of the American
          Arbitration Association.
        </P>
        <P theme={theme}>
          <Text style={{ fontWeight: '700', color: theme.text }}>Class Action Waiver.</Text> You agree that you will
          not participate in a class action lawsuit or class-wide arbitration. All disputes must be
          brought on an individual basis.
        </P>
      </Section>

      <Section id="18" highlight={highlightSection === '18'} theme={theme}>
        <H2 theme={theme}>18. Governing Law</H2>
        <P theme={theme}>
          These Terms are governed by the laws of the State of Nevada, without regard to conflict of
          law principles.
        </P>
      </Section>

      <Section id="19" highlight={highlightSection === '19'} theme={theme}>
        <H2 theme={theme}>19. Changes to Terms</H2>
        <P theme={theme}>
          We may update these Terms from time to time. Continued use of BPS after changes become
          effective constitutes your acceptance of the updated Terms.
        </P>
      </Section>

      <Section id="20" highlight={highlightSection === '20'} theme={theme}>
        <H2 theme={theme}>20. Entire Agreement</H2>
        <P theme={theme}>
          These Terms constitute the entire agreement between you and BPS and supersede any prior
          understandings or communications regarding your use of the App.
        </P>
      </Section>

      <Section id="21" highlight={highlightSection === '21'} theme={theme}>
        <H2 theme={theme}>21. Severability</H2>
        <P theme={theme}>
          If any provision of these Terms is found to be invalid or unenforceable, the remaining
          provisions will remain in full force and effect.
        </P>
      </Section>

      <Section id="22" highlight={highlightSection === '22'} theme={theme}>
        <H2 theme={theme}>22. Contact Information</H2>
        <P theme={theme}>For questions about these Terms:</P>
        <BulletList
          items={[
            'Email: legal@buildprofitsolutions.com',
            'Address: [Insert Your Nevada Business Address]',
          ]}
          theme={theme}
        />
      </Section>
    </View>
  );
}

// ========== PRIVACY POLICY CONTENT ==========
function PrivacyPolicyContent({ theme }: { theme: any }) {
  return (
    <View>
      <SectionHeader title="Privacy Policy" subtitle="Effective: November 2025" theme={theme} />

      <Section theme={theme}>
        <P theme={theme}>
          Your privacy matters to us. This Privacy Policy explains how Build Profit Solutions
          ("BPS", "we", "our", "the App") collects, uses, stores, and protects your information.
        </P>
      </Section>

      <Section theme={theme}>
        <H2 theme={theme}>1. Information We Collect</H2>
        <P theme={theme}>We collect the following:</P>
        <BulletList
          items={[
            'Account Information: Name, email, phone number, business details',
            'Project Data: Estimates, bids, materials lists, project details',
            'Usage Data: Feature usage, interactions, crash logs',
            'Device Info: IP address, OS version, app version, region/ZIP',
            'Payment Info: Processed securely by Stripe (we do NOT store card numbers)',
            'We do NOT collect: Social Security numbers, government IDs, biometrics, bank account numbers',
          ]}
          theme={theme}
        />
      </Section>

      <Section theme={theme}>
        <H2 theme={theme}>2. How We Use Your Information</H2>
        <BulletList
          items={[
            'Improve app functionality',
            'Generate estimates and bid calculations',
            'Suggest contractors and suppliers',
            'Provide notifications and updates',
            'Provide customer support',
            'Use anonymized analytics to improve features',
            'Prevent fraud and meet legal obligations',
          ]}
          theme={theme}
        />
      </Section>

      <Section theme={theme}>
        <H2 theme={theme}>3. Data Sharing & Disclosure</H2>
        <BulletList
          items={[
            'Service Providers: Hosting, payments, authentication',
            'Third-Party APIs: Yelp, Home Depot, Lowe\'s, AI providers',
            'Legal Compliance: When required by law',
          ]}
          theme={theme}
        />
        <P theme={theme}>We do not sell your personal information.</P>
      </Section>

      <Section theme={theme}>
        <H2 theme={theme}>4. AI Data Use</H2>
        <P theme={theme}>
          AI features may analyze or process your inputs. Your data is not used to train external AI
          models. AI outputs may be inaccurate.
        </P>
      </Section>

      <Section theme={theme}>
        <H2 theme={theme}>5. Cookies & Analytics</H2>
        <P theme={theme}>
          We use analytics tools to understand how the App is used. BPS does not respond to Do Not
          Track signals.
        </P>
      </Section>

      <Section theme={theme}>
        <H2 theme={theme}>6. Data Retention</H2>
        <P theme={theme}>
          We retain your information while your account is active and as required for backups,
          audits, fraud prevention, or legal obligations.
        </P>
      </Section>

      <Section theme={theme}>
        <H2 theme={theme}>7. Security</H2>
        <P theme={theme}>
          We use industry-standard measures including encryption and secure authentication. No
          system is completely secure.
        </P>
      </Section>

      <Section theme={theme}>
        <H2 theme={theme}>8. Your Rights</H2>
        <BulletList
          items={[
            'Access your data',
            'Request corrections',
            'Request deletion',
            'Export your information',
            'Unsubscribe from marketing communications',
          ]}
          theme={theme}
        />
      </Section>

      <Section theme={theme}>
        <H2 theme={theme}>9. Children's Privacy</H2>
        <P theme={theme}>
          BPS is not intended for users under 18. We do not knowingly collect children's
          information.
        </P>
      </Section>

      <Section theme={theme}>
        <H2 theme={theme}>10. Changes to Privacy Policy</H2>
        <P theme={theme}>
          We may update this policy periodically and notify you of significant updates. Continued
          use means acceptance.
        </P>
      </Section>

      <Section theme={theme}>
        <H2 theme={theme}>11. Contact Us</H2>
        <BulletList
          items={[
            'Email: privacy@buildprofitsolutions.com',
            'Address: [Your Nevada Business Address]',
          ]}
          theme={theme}
        />
      </Section>
    </View>
  );
}

// ========== REFUND POLICY CONTENT ==========
function RefundPolicyContent({ theme }: { theme: any }) {
  return (
    <View>
      <SectionHeader title="Refund Policy" subtitle="Effective: November 2025" theme={theme} />

      <Section theme={theme}>
        <P theme={theme}>
          Build Profit Solutions ("BPS", "we", "our") offers a 7-day free trial to all new
          subscribers. During the trial period, users receive full access to the platform with no
          charges applied until the trial ends.
        </P>
      </Section>

      <Section theme={theme}>
        <P theme={theme}>
          Because you are given the opportunity to fully evaluate the service before billing begins,
          all subscription payments are final and non-refundable once the trial period has ended,
          except where required by applicable law.
        </P>
      </Section>

      <Section theme={theme}>
        <H2 theme={theme}>1. No Refunds After Trial Period</H2>
        <P theme={theme}>
          After the 7-day trial concludes and your first subscription payment is processed:
        </P>
        <BulletList
          items={[
            'Payments are non-refundable',
            'Partially used billing periods are not eligible for refunds',
            'Renewal charges are non-refundable',
          ]}
          theme={theme}
        />
        <P theme={theme}>This applies to both monthly and annual plans.</P>
      </Section>

      <Section theme={theme}>
        <H2 theme={theme}>2. Subscriptions Purchased Through Apple or Google</H2>
        <P theme={theme}>
          If your subscription was initiated through the Apple App Store or Google Play Store, all
          refunds must be handled directly through Apple or Google, according to their policies. BPS
          is not able to issue refunds for App Store or Google Play transactions.
        </P>
      </Section>

      <Section theme={theme}>
        <H2 theme={theme}>3. Cancellation Policy</H2>
        <P theme={theme}>
          You may cancel your subscription at any time in the Payment & Billing section of your
          account or through your app-store subscription settings. Cancellation stops future charges
          but does not generate a refund for any past payments. You will retain access to premium
          features until the end of the current billing cycle.
        </P>
      </Section>

      <Section theme={theme}>
        <H2 theme={theme}>4. Chargebacks</H2>
        <P theme={theme}>
          Initiating a chargeback without first contacting BPS Support may result in temporary or
          permanent suspension of your account. We strongly recommend contacting us first to resolve
          any billing concerns.
        </P>
      </Section>

      <Section theme={theme}>
        <H2 theme={theme}>5. Exceptions Required by Law</H2>
        <P theme={theme}>
          In situations where applicable consumer protection laws require a refund, BPS will comply
          and process the refund accordingly.
        </P>
      </Section>

      <Section theme={theme}>
        <H2 theme={theme}>6. Contact Us</H2>
        <P theme={theme}>For billing questions or subscription support:</P>
        <BulletList
          items={[
            'Email: support@buildprofitsolutions.com',
            'Subject: Billing Support',
          ]}
          theme={theme}
        />
        <P theme={theme}>We respond to all inquiries within 2–3 business days.</P>
      </Section>
    </View>
  );
}

// ========== TAX CENTER DISCLOSURE ==========
function TaxCenterDisclosureContent({ theme }: { theme: any }) {
  return (
    <View>
      <SectionHeader title="Tax Center Disclosure" subtitle="Effective: November 2025" theme={theme} />

      <Section theme={theme}>
        <H2 theme={theme}>1. Bookkeeping and Tax-Preparation Support Only</H2>
        <P theme={theme}>
          The Tax Center, Year-End Tax Summary, Receipt Backup Manifest, subcontractor payment
          summaries, AI Tax Insight, and related exports provided by Build Profit Solutions are
          intended for bookkeeping, internal business review, and tax-preparation support only.
        </P>
        <P theme={theme}>
          Build Profit Solutions does not provide tax, legal, accounting, payroll, or financial
          advice. The Tax Center does not replace a certified public accountant, tax preparer,
          attorney, bookkeeper, payroll provider, or other licensed professional.
        </P>
      </Section>

      <Section theme={theme}>
        <H2 theme={theme}>2. Not an Official Tax Filing or 1099 Service</H2>
        <P theme={theme}>
          The Tax Center does not file tax returns, prepare official tax forms, submit documents to
          the IRS or state tax authorities, or issue official Forms 1099.
        </P>
        <P theme={theme}>
          {
            'Any labels such as "tax-ready," "CPA-ready," "Potential 1099 Review," or similar wording are informational only and do not mean that a tax document is complete, accurate, legally sufficient, IRS-approved, or ready to file without professional review.'
          }
        </P>
      </Section>

      <Section theme={theme}>
        <H2 theme={theme}>3. User Responsibility for Accuracy</H2>
        <P theme={theme}>
          All Tax Center reports are generated from user-entered or user-connected data, including
          project information, payments, expenses, purchase orders, subcontractor/vendor records,
          receipts, and related financial entries.
        </P>
        <P theme={theme}>
          Users are solely responsible for reviewing, verifying, correcting, and maintaining all
          amounts, categories, dates, receipts, vendor information, W-9 information, payment
          status, and tax treatment before using any report for bookkeeping, accounting, tax
          preparation, or filing purposes.
        </P>
        <P theme={theme}>
          Missing, incomplete, duplicated, incorrectly categorized, or incorrectly dated entries may
          affect the accuracy of Tax Center summaries and exports.
        </P>
      </Section>

      <Section theme={theme}>
        <H2 theme={theme}>4. Supporting Records and Source Documents</H2>
        <P theme={theme}>
          Tax Center reports are summaries and do not replace original records or supporting
          documentation.
        </P>
        <P theme={theme}>
          Users are responsible for retaining receipts, invoices, bank records, payment
          confirmations, contracts, purchase orders, W-9s, 1099s, mileage logs, payroll records, and
          any other documents required by their CPA, tax professional, business, lender, or taxing
          authority.
        </P>
        <P theme={theme}>
          Receipt Backup Manifest exports may list receipt records entered in Build Profit
          Solutions, but they do not by themselves guarantee that the original receipt image, PDF,
          or source document is complete, accurate, accessible, or sufficient for tax filing.
        </P>
      </Section>

      <Section theme={theme}>
        <H2 theme={theme}>5. Expense Categories and Deductibility</H2>
        <P theme={theme}>
          Expense categories shown in the Tax Center are for organization and bookkeeping support
          only. Build Profit Solutions does not determine whether an expense is deductible, ordinary,
          necessary, capitalized, depreciable, reimbursable, taxable, or otherwise reportable.
        </P>
        <P theme={theme}>
          Users must confirm deductibility, classification, capitalization, depreciation, sales tax
          treatment, payroll treatment, subcontractor treatment, and all other tax matters with
          their CPA or tax professional.
        </P>
      </Section>

      <Section theme={theme}>
        <H2 theme={theme}>6. Subcontractor Payments and Potential 1099 Review</H2>
        <P theme={theme}>
          {
            'The Tax Center may identify vendors or subcontractors for "Potential 1099 Review" based on available payment data. This is only an informational flag.'
          }
        </P>
        <P theme={theme}>
          Build Profit Solutions does not determine whether a vendor legally requires a Form 1099,
          whether a payment is reportable, whether a payment method is excluded, whether a W-9 is
          valid, or whether a filing threshold has been met.
        </P>
        <P theme={theme}>
          Users are responsible for confirming vendor eligibility, payment method, W-9 status, filing
          requirements, deadlines, and all federal, state, and local reporting obligations with their
          CPA or tax professional.
        </P>
      </Section>

      <Section theme={theme}>
        <H2 theme={theme}>7. AI Tax Insight</H2>
        <P theme={theme}>
          AI Tax Insight and rules-based tax-related prompts are informational only and are not tax
          advice. AI Tax Insight may identify patterns in recorded data, such as large expense
          categories, missing records, or items for review.
        </P>
        <P theme={theme}>
          Users should not rely on AI Tax Insight to make tax filing decisions, claim deductions,
          classify expenses, determine 1099 obligations, or calculate tax liability without review by
          a qualified tax professional.
        </P>
      </Section>

      <Section theme={theme}>
        <H2 theme={theme}>8. No Guarantee</H2>
        <P theme={theme}>
          Build Profit Solutions does not guarantee that Tax Center reports, summaries, exports,
          categories, AI insights, calculations, or receipt manifests are complete, accurate,
          current, compliant, or suitable for any specific tax, accounting, legal, lending, audit, or
          regulatory purpose.
        </P>
        <P theme={theme}>
          {"Use of the Tax Center is at the user's own discretion and risk."}
        </P>
        <P theme={theme}>
          Accountant workbook (XLSX) exports, W-9 tracking, QuickBooks mapping prep, and vendor directory
          features are for bookkeeping and internal review only. They are not official tax filings, are not
          IRS-approved, and do not replace your CPA, enrolled agent, bookkeeper, or payroll provider.
        </P>
      </Section>

      <Section theme={theme}>
        <H2 theme={theme}>9. Professional Review Required</H2>
        <P theme={theme}>
          Before using any Tax Center report or export for tax preparation, bookkeeping, financial
          reporting, loan applications, audits, investor reporting, or official filings, users should
          review the information with a CPA, tax professional, attorney, or qualified advisor.
        </P>
      </Section>
    </View>
  );
}

// ========== ATTRIBUTIONS CONTENT ==========
function AttributionsContent({
  onNavigate,
  onOpenLink,
  theme,
}: {
  onNavigate: (section: string, tab: TabType) => void;
  onOpenLink: (url: string) => void;
  theme: any;
}) {
  return (
    <View>
      <SectionHeader
        title="Data Sources & Attributions"
        subtitle="Learn about our data providers"
        theme={theme}
      />

      <Section theme={theme}>
        <P theme={theme}>
          Build Profit Solutions integrates data from trusted third-party sources to provide you
          with accurate material pricing, contractor information, and business insights. Below are
          links to detailed information about each data source.
        </P>
      </Section>

      {/* Quick Navigation Cards */}
      <TouchableOpacity
        style={[styles.attrCard, { backgroundColor: theme.card, borderColor: theme.border }]}
        onPress={() => onNavigate('8.1', 'terms')}
      >
        <View style={styles.attrCardContent}>
          <MaterialIcons name="business" size={24} color={theme.accent} />
          <View style={styles.attrCardText}>
            <Text style={[styles.attrCardTitle, { color: theme.text }]}>Yelp Fusion API</Text>
            <Text style={[styles.attrCardSubtitle, { color: theme.subtext }]}>Contractor & supplier information</Text>
          </View>
          <MaterialIcons name="arrow-forward" size={20} color={theme.subtext} />
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.attrCard, { backgroundColor: theme.card, borderColor: theme.border }]}
        onPress={() => onNavigate('8.2', 'terms')}
      >
        <View style={styles.attrCardContent}>
          <MaterialIcons name="shopping-cart" size={24} color={theme.accent} />
          <View style={styles.attrCardText}>
            <Text style={[styles.attrCardTitle, { color: theme.text }]}>Home Depot & Lowe's</Text>
            <Text style={[styles.attrCardSubtitle, { color: theme.subtext }]}>Material pricing & availability</Text>
          </View>
          <MaterialIcons name="arrow-forward" size={20} color={theme.subtext} />
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.attrCard, { backgroundColor: theme.card, borderColor: theme.border }]}
        onPress={() => onNavigate('8.3', 'terms')}
      >
        <View style={styles.attrCardContent}>
          <MaterialIcons name="cloud" size={24} color={theme.accent} />
          <View style={styles.attrCardText}>
            <Text style={[styles.attrCardTitle, { color: theme.text }]}>Third-Party APIs</Text>
            <Text style={[styles.attrCardSubtitle, { color: theme.subtext }]}>Data aggregation services</Text>
          </View>
          <MaterialIcons name="arrow-forward" size={20} color={theme.subtext} />
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.attrCard, { backgroundColor: theme.card, borderColor: theme.border }]}
        onPress={() => onNavigate('8.4', 'terms')}
      >
        <View style={styles.attrCardContent}>
          <MaterialIcons name="info" size={24} color={theme.accent} />
          <View style={styles.attrCardText}>
            <Text style={[styles.attrCardTitle, { color: theme.text }]}>Disclaimer</Text>
            <Text style={[styles.attrCardSubtitle, { color: theme.subtext }]}>Data accuracy information</Text>
          </View>
          <MaterialIcons name="arrow-forward" size={20} color={theme.subtext} />
        </View>
      </TouchableOpacity>

      {/* Inline Attribution Examples */}
      <Section theme={theme}>
        <H2 theme={theme}>How Attributions Appear in the App</H2>
        <P theme={theme}>
          When you use features that display third-party data, you'll see inline attributions like
          these:
        </P>
      </Section>

      <View style={[styles.exampleCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.exampleTitle, { color: theme.text }]}>Marketplace / Contractor Search</Text>
        <Text style={[styles.exampleText, { color: theme.subtext }]}>
          Some ratings sourced via Yelp Fusion API.{' '}
          <Text
            style={[styles.exampleLink, { color: theme.accent }]}
            onPress={() => onNavigate('8.1', 'terms')}
          >
            Details
          </Text>
        </Text>
        <TouchableOpacity
          style={[styles.poweredByBadge, { backgroundColor: theme.iconBg }]}
          onPress={() => onOpenLink('https://www.yelp.com')}
        >
          <Text style={[styles.poweredByText, { color: theme.accent }]}>Powered by Yelp</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.exampleCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.exampleTitle, { color: theme.text }]}>Materials Lookup</Text>
        <Text style={[styles.exampleText, { color: theme.subtext }]}>
          Prices are estimates and may change. Verify on retailer sites. Data via authorized
          third-party provider.{' '}
          <Text
            style={[styles.exampleLink, { color: theme.accent }]}
            onPress={() => onNavigate('8.2', 'terms')}
          >
            Learn more
          </Text>
        </Text>
      </View>

      {/* External Links */}
      <Section theme={theme}>
        <H2 theme={theme}>Learn More</H2>
        <TouchableOpacity
          style={[styles.linkButton, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={() => onOpenLink('https://www.yelp.com/developers/api_terms')}
        >
          <MaterialIcons name="open-in-new" size={18} color={theme.accent} />
          <Text style={[styles.linkButtonText, { color: theme.text }]}>Yelp API Terms of Service</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.linkButton, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={() => onOpenLink('https://www.homedepot.com/c/Terms_of_Use')}
        >
          <MaterialIcons name="open-in-new" size={18} color={theme.accent} />
          <Text style={[styles.linkButtonText, { color: theme.text }]}>Home Depot Terms of Use</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.linkButton, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={() => onOpenLink('https://www.lowes.com/l/terms-of-use')}
        >
          <MaterialIcons name="open-in-new" size={18} color={theme.accent} />
          <Text style={[styles.linkButtonText, { color: theme.text }]}>Lowe's Terms of Use</Text>
        </TouchableOpacity>
      </Section>
    </View>
  );
}

// ========== REUSABLE COMPONENTS ==========

function SectionHeader({ title, subtitle, theme }: { title: string; subtitle?: string; theme: any }) {
  return (
    <View style={[styles.sectionHeader, { borderBottomColor: theme.border }]}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      {subtitle && <Text style={[styles.sectionSubtitle, { color: theme.subtext }]}>{subtitle}</Text>}
    </View>
  );
}

function Section({
  id,
  highlight,
  children,
  theme,
}: {
  id?: string;
  highlight?: boolean;
  children: React.ReactNode;
  theme: any;
}) {
  return (
    <View style={[
      styles.sectionCard,
      { backgroundColor: theme.card, borderColor: highlight ? theme.accent : theme.border },
      highlight && { borderWidth: 2 }
    ]}>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

function H2({ children, theme }: { children: React.ReactNode; theme: any }) {
  return <Text style={[styles.h2, { color: theme.text }]}>{children}</Text>;
}

function H3({ children, theme }: { children: React.ReactNode; theme: any }) {
  return <Text style={[styles.h3, { color: theme.text }]}>{children}</Text>;
}

function P({ children, theme }: { children: React.ReactNode; theme: any }) {
  return <Text style={[styles.p, { color: theme.subtext }]}>{children}</Text>;
}

function BulletList({ items, theme }: { items: string[]; theme: any }) {
  return (
    <View style={styles.bulletList}>
      {items.map((item, index) => (
        <View key={index} style={styles.bulletItem}>
          <Text style={[styles.bullet, { color: theme.accent }]}>•</Text>
          <Text style={[styles.bulletText, { color: theme.subtext }]}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function Notice({ children, theme }: { children: React.ReactNode; theme: any }) {
  return (
    <View style={[styles.noticeBox, { borderLeftColor: theme.accent }]}>
      <Text style={[styles.noticeText, { color: theme.subtext }]}>{children}</Text>
    </View>
  );
}

// ========== STYLES ==========

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 12,
    marginHorizontal: 20,
    position: 'relative',
  },
  backButtonWrapper: {
    width: 42,
    zIndex: 1,
    alignItems: 'center',
  },
  backButtonBorder: {
    width: 42,
    height: 42,
    borderRadius: 20,
    padding: 1,
    overflow: "hidden",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 6,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 0.15,
    textAlign: 'center',
  },
  tabsRow: {
    marginBottom: 16,
    flexGrow: 0,
  },
  tabsRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingRight: 20,
  },
  tab: {
    flexShrink: 0,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(67, 206, 162, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(67, 206, 162, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: 'rgba(67, 206, 162, 0.25)',
    borderColor: '#43cea2',
    shadowColor: '#43cea2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  contentCard: {
    borderRadius: 23,
    overflow: 'visible',
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  sectionHeader: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    opacity: 0.85,
    lineHeight: 20,
  },
  sectionCard: {
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sectionContent: {
    padding: 20,
  },
  sectionHighlight: {
    borderColor: '#43cea2',
    borderWidth: 2,
    backgroundColor: 'rgba(67, 206, 162, 0.15)',
  },
  h2: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 8,
  },
  h3: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
  },
  p: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 12,
    opacity: 0.85,
  },
  bulletList: {
    marginVertical: 8,
  },
  bulletItem: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingLeft: 8,
  },
  bullet: {
    fontSize: 14,
    color: '#43cea2',
    marginRight: 12,
    marginTop: 2,
  },
  bulletText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    opacity: 0.85,
  },
  noticeBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
    padding: 12,
    borderRadius: 8,
    marginVertical: 12,
  },
  noticeText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#FCD34D',
  },
  attrCard: {
    backgroundColor: 'rgba(67, 206, 162, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(67, 206, 162, 0.25)',
    marginBottom: 12,
    overflow: 'hidden',
  },
  attrCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  attrCardText: {
    flex: 1,
    marginLeft: 12,
  },
  attrCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  attrCardSubtitle: {
    fontSize: 13,
    opacity: 0.85,
  },
  exampleCard: {
    backgroundColor: 'rgba(27, 54, 93, 0.6)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(67, 206, 162, 0.2)',
    padding: 16,
    marginBottom: 12,
  },
  exampleTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  exampleText: {
    fontSize: 13,
    lineHeight: 20,
    opacity: 0.85,
  },
  exampleLink: {
    textDecorationLine: 'underline',
  },
  poweredByBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 12,
  },
  poweredByText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#43cea2',
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(67, 206, 162, 0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(67, 206, 162, 0.25)',
    marginBottom: 10,
  },
  linkButtonText: {
    fontSize: 16,
    marginLeft: 10,
  },
});

