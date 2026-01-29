import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Linking,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/Colors';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

type TabType = 'terms' | 'privacy' | 'refund' | 'attrib';

/**
 * Legal Hub Screen
 * - Terms of Use with specific sections for Yelp, Home Depot, Lowes
 * - Privacy Policy placeholder
 * - Data Sources & Attributions
 * - Deep linkable sections for compliance
 */
export default function LegalHubScreen() {
  const { darkMode } = useTheme();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState<TabType>('terms');
  const [scrollToSection, setScrollToSection] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  // Check for tab parameter on mount and when params change
  useEffect(() => {
    if (params.tab) {
      const tabParam = params.tab.toLowerCase();
      if (['terms', 'privacy', 'refund', 'attrib'].includes(tabParam)) {
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

  const gradientColors: [string, string, string] = [
    '#0b1c38',
    '#1B365D',
    '#43cea2',
  ];

  return (
    <LinearGradient
      colors={gradientColors}
      style={styles.container}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
        >
          <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Legal & Disclosures</Text>
          <Text style={styles.headerSubtitle}>Terms, Privacy, Refunds & Data Sources</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'terms' && styles.tabActive]}
          onPress={() => handleTabChange('terms')}
        >
          <Text style={[styles.tabText, activeTab === 'terms' && styles.tabTextActive]}>
            Terms
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'privacy' && styles.tabActive]}
          onPress={() => handleTabChange('privacy')}
        >
          <Text style={[styles.tabText, activeTab === 'privacy' && styles.tabTextActive]}>
            Privacy
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'refund' && styles.tabActive]}
          onPress={() => handleTabChange('refund')}
        >
          <Text style={[styles.tabText, activeTab === 'refund' && styles.tabTextActive]}>
            Refund Policy
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'attrib' && styles.tabActive]}
          onPress={() => handleTabChange('attrib')}
        >
          <Text style={[styles.tabText, activeTab === 'attrib' && styles.tabTextActive]}>
            Attributions
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content Card */}
      <View style={styles.contentCard}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          showsVerticalScrollIndicator={true}
          contentContainerStyle={styles.scrollContent}
        >
          {activeTab === 'terms' && <TermsOfUseContent highlightSection={scrollToSection} />}
          {activeTab === 'privacy' && <PrivacyPolicyContent />}
          {activeTab === 'refund' && <RefundPolicyContent />}
          {activeTab === 'attrib' && (
            <AttributionsContent
              onNavigate={navigateToSection}
              onOpenLink={openExternalLink}
            />
          )}
        </ScrollView>
      </View>
    </LinearGradient>
  );
}

// ========== TERMS OF USE CONTENT ==========
function TermsOfUseContent({ highlightSection }: { highlightSection: string | null }) {
  return (
    <View>
      <SectionHeader title="Terms of Use" subtitle="Effective: November 2025" />

      <Section id="1" highlight={highlightSection === '1'}>
        <H2>1. Acceptance of Terms</H2>
        <P>
          By accessing or using Build Profit Solutions ("BPS", "the App", "we", "our"), you agree
          to be bound by these Terms of Use. If you do not agree, you must discontinue use
          immediately.
        </P>
        <P>
          These Terms apply to all users in the United States and internationally. Your
          relationship is solely with Build Profit Solutions, LLC, a Nevada company.
        </P>
      </Section>

      <Section id="2" highlight={highlightSection === '2'}>
        <H2>2. Eligibility</H2>
        <P>
          You represent that you are at least 18 years old and legally able to enter into binding
          agreements. If you use BPS on behalf of a business, you represent that you have authority
          to bind that business to these Terms.
        </P>
      </Section>

      <Section id="3" highlight={highlightSection === '3'}>
        <H2>3. License and Acceptable Use</H2>
        <P>
          We grant you a limited, non-exclusive, non-transferable license to use BPS for internal
          business purposes, including project estimation, bid generation, lead management, and
          construction workflows.
        </P>
        <P>You may not:</P>
        <BulletList
          items={[
            'Reverse engineer, scrape, or attempt to extract underlying source code',
            'Share your account or login outside your organization',
            'Use the App to build or train a competing service',
            'Resell, redistribute, or publicly publish any BPS data',
            'Automate high-volume requests or interfere with App performance',
            'Use BPS to collect data for competitor benchmarking or directory-building',
          ]}
        />
        <P>
          We reserve the right to suspend or terminate accounts engaged in misuse.
        </P>
      </Section>

      <Section id="4" highlight={highlightSection === '4'}>
        <H2>4. User Responsibilities</H2>
        <P>
          You are responsible for maintaining the confidentiality of your login credentials and for
          all activity under your account. You are also responsible for entering accurate job,
          cost, labor, or material information and for verifying any outputs before using them in bids
          or business decisions.
        </P>
        <P>BPS is not responsible for inaccurate data entered by users.</P>
      </Section>

      <Section id="5" highlight={highlightSection === '5'}>
        <H2>5. Payment, Free Trial, and Subscriptions</H2>
        <P>Certain features of BPS require a paid subscription.</P>
        <H3>5.1 Free Trial</H3>
        <P>
          New users may receive a 7-day free trial. No charges are applied until the trial ends.
          Your subscription will automatically renew unless cancelled before the trial expires.
        </P>
        <H3>5.2 Billing</H3>
        <P>
          Billing is automatic and recurring. Subscription payments become non-refundable once the
          trial period has ended, except where required by law. Partially used billing periods and
          renewal charges are not refundable.
        </P>
        <H3>5.3 App Store Purchases</H3>
        <P>
          If you subscribe through the Apple App Store or Google Play Store, billing and refund
          requests must be handled directly through Apple or Google according to their policies.
        </P>
        <H3>5.4 Payment Processing</H3>
        <P>
          Web subscriptions are processed securely through Stripe or another authorized payment
          processor.
        </P>
      </Section>

      <Section id="6" highlight={highlightSection === '6'}>
        <H2>6. Estimates, Calculations & Data Disclaimer</H2>
        <P>
          All estimates, calculations, material pricing, labor data, or outputs provided by BPS are
          informational only. Actual costs vary based on suppliers, regions, labor availability,
          market changes, and job conditions.
        </P>
        <P>
          You are solely responsible for verifying accuracy before submitting bids, proposals, or
          quotes. BPS does not guarantee cost accuracy, profitability, job outcomes, or project
          feasibility.
        </P>
      </Section>

      <Section id="7" highlight={highlightSection === '7'}>
        <H2>7. AI-Generated Content Disclaimer</H2>
        <P>
          If any App features generate AI-based recommendations, calculations, or summaries, outputs
          may be inaccurate or incomplete. AI results must be reviewed by a qualified professional,
          and BPS is not responsible for decisions made based on AI outputs. AI tools do not replace
          professional judgment.
        </P>
      </Section>

      <Section id="8" highlight={highlightSection === '8'}>
        <H2>8. Intellectual Property</H2>
        <P>
          All content, features, designs, workflows, databases, and functionality are owned by
          Build Profit Solutions, LLC and are protected by intellectual property laws. You may not
          copy, reproduce, modify, or create derivative works based on BPS.
        </P>
      </Section>

      <Section id="9" highlight={highlightSection === '9'}>
        <H2>9. Third-Party Data & API Sources</H2>
        <P>
          BPS may use APIs and data from external providers (including but not limited to Yelp,
          Home Depot, Lowe's, SerpAPI, WebScrapingAPI, and others). This data is provided "AS IS"
          and "AS AVAILABLE," is subject to provider terms, and may change without notice. BPS does
          not claim ownership over third-party data.
        </P>
        <P>
          Business names, reviews, and related information from Yelp are subject to Yelp's Terms of
          Service, and where required, "Powered by Yelp" attribution will be displayed. Pricing
          and product data from retailers such as Home Depot or Lowe's are for estimation only and
          must be verified directly with the retailer.
        </P>
      </Section>

      <Section id="10" highlight={highlightSection === '10'}>
        <H2>10. Data Accuracy Disclaimer</H2>
        <P>
          Third-party information, AI outputs, supplier prices, and material/labor data are provided
          "AS IS" and "AS AVAILABLE." BPS cannot guarantee accuracy, completeness, real-time
          updates, or pricing stability. You are solely responsible for verifying information
          before relying on it.
        </P>
      </Section>

      <Section id="11" highlight={highlightSection === '11'}>
        <H2>11. Subcontractor Marketplace Disclaimer</H2>
        <P>
          If BPS allows subcontractors to list prices, services, or profiles, BPS does not vet,
          endorse, or guarantee subcontractor quality. BPS is not a hiring party, broker, or agent
          and is not responsible for disputes between contractors and subcontractors. All
          subcontractor interactions are at your own risk.
        </P>
      </Section>

      <Section id="12" highlight={highlightSection === '12'}>
        <H2>12. No Professional Advice</H2>
        <P>
          BPS does not provide legal, financial, construction safety, engineering, or architectural
          advice. All information is informational only and not a substitute for professional
          services.
        </P>
      </Section>

      <Section id="13" highlight={highlightSection === '13'}>
        <H2>13. Limitation of Liability</H2>
        <P>
          To the maximum extent permitted by law, BPS and its owners, officers, managers, employees,
          and affiliates are not liable for any lost profits, cost overruns, business losses, data
          loss, project delays, incorrect estimates, or any indirect, incidental, special, or
          consequential damages arising from or related to your use of the App.
        </P>
        <P>
          In no event shall BPS's total liability exceed the greater of (a) the total amount paid
          by you in the twelve (12) months prior to the event giving rise to liability, or (b) one
          hundred dollars (US $100).
        </P>
      </Section>

      <Section id="14" highlight={highlightSection === '14'}>
        <H2>14. Indemnification</H2>
        <P>
          You agree to indemnify, defend, and hold harmless BPS, its owners, managers, employees,
          and affiliates from any claim, loss, liability, or damage arising from your use of the
          App, the data you enter, your reliance on estimates or information from BPS, your
          violation of these Terms, or your interactions with subcontractors.
        </P>
      </Section>

      <Section id="15" highlight={highlightSection === '15'}>
        <H2>15. Corporate Shield Protection</H2>
        <P>
          You agree that all claims shall be brought solely against Build Profit Solutions, LLC, and
          not against its individual owners, officers, or employees.
        </P>
      </Section>

      <Section id="16" highlight={highlightSection === '16'}>
        <H2>16. Termination</H2>
        <P>
          We may suspend or terminate your access to BPS at our discretion, including for misuse,
          violations of these Terms, fraudulent activity, or legal compliance requirements.
        </P>
      </Section>

      <Section id="17" highlight={highlightSection === '17'}>
        <H2>17. Arbitration Agreement</H2>
        <P>
          Any dispute arising from these Terms or your use of the App shall be resolved exclusively
          through binding arbitration in Clark County, Nevada, under the rules of the American
          Arbitration Association.
        </P>
        <P>
          <Text style={{ fontWeight: '700' }}>Class Action Waiver.</Text> You agree that you will
          not participate in a class action lawsuit or class-wide arbitration. All disputes must be
          brought on an individual basis.
        </P>
      </Section>

      <Section id="18" highlight={highlightSection === '18'}>
        <H2>18. Governing Law</H2>
        <P>
          These Terms are governed by the laws of the State of Nevada, without regard to conflict of
          law principles.
        </P>
      </Section>

      <Section id="19" highlight={highlightSection === '19'}>
        <H2>19. Changes to Terms</H2>
        <P>
          We may update these Terms from time to time. Continued use of BPS after changes become
          effective constitutes your acceptance of the updated Terms.
        </P>
      </Section>

      <Section id="20" highlight={highlightSection === '20'}>
        <H2>20. Entire Agreement</H2>
        <P>
          These Terms constitute the entire agreement between you and BPS and supersede any prior
          understandings or communications regarding your use of the App.
        </P>
      </Section>

      <Section id="21" highlight={highlightSection === '21'}>
        <H2>21. Severability</H2>
        <P>
          If any provision of these Terms is found to be invalid or unenforceable, the remaining
          provisions will remain in full force and effect.
        </P>
      </Section>

      <Section id="22" highlight={highlightSection === '22'}>
        <H2>22. Contact Information</H2>
        <P>For questions about these Terms:</P>
        <BulletList
          items={[
            'Email: legal@buildprofitsolutions.com',
            'Address: [Insert Your Nevada Business Address]',
          ]}
        />
      </Section>
    </View>
  );
}

// ========== PRIVACY POLICY CONTENT ==========
function PrivacyPolicyContent() {
  return (
    <View>
      <SectionHeader title="Privacy Policy" subtitle="Effective: November 2025" />

      <Section>
        <P>
          Your privacy matters to us. This Privacy Policy explains how Build Profit Solutions
          ("BPS", "we", "our", "the App") collects, uses, stores, and protects your information.
        </P>
      </Section>

      <Section>
        <H2>1. Information We Collect</H2>
        <P>We collect the following:</P>
        <BulletList
          items={[
            'Account Information: Name, email, phone number, business details',
            'Project Data: Estimates, bids, materials lists, project details',
            'Usage Data: Feature usage, interactions, crash logs',
            'Device Info: IP address, OS version, app version, region/ZIP',
            'Payment Info: Processed securely by Stripe (we do NOT store card numbers)',
            'We do NOT collect: Social Security numbers, government IDs, biometrics, bank account numbers',
          ]}
        />
      </Section>

      <Section>
        <H2>2. How We Use Your Information</H2>
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
        />
      </Section>

      <Section>
        <H2>3. Data Sharing & Disclosure</H2>
        <BulletList
          items={[
            'Service Providers: Hosting, payments, authentication',
            'Third-Party APIs: Yelp, Home Depot, Lowe\'s, AI providers',
            'Legal Compliance: When required by law',
          ]}
        />
        <P>We do not sell your personal information.</P>
      </Section>

      <Section>
        <H2>4. AI Data Use</H2>
        <P>
          AI features may analyze or process your inputs. Your data is not used to train external AI
          models. AI outputs may be inaccurate.
        </P>
      </Section>

      <Section>
        <H2>5. Cookies & Analytics</H2>
        <P>
          We use analytics tools to understand how the App is used. BPS does not respond to Do Not
          Track signals.
        </P>
      </Section>

      <Section>
        <H2>6. Data Retention</H2>
        <P>
          We retain your information while your account is active and as required for backups,
          audits, fraud prevention, or legal obligations.
        </P>
      </Section>

      <Section>
        <H2>7. Security</H2>
        <P>
          We use industry-standard measures including encryption and secure authentication. No
          system is completely secure.
        </P>
      </Section>

      <Section>
        <H2>8. Your Rights</H2>
        <BulletList
          items={[
            'Access your data',
            'Request corrections',
            'Request deletion',
            'Export your information',
            'Unsubscribe from marketing communications',
          ]}
        />
      </Section>

      <Section>
        <H2>9. Children's Privacy</H2>
        <P>
          BPS is not intended for users under 18. We do not knowingly collect children's
          information.
        </P>
      </Section>

      <Section>
        <H2>10. Changes to Privacy Policy</H2>
        <P>
          We may update this policy periodically and notify you of significant updates. Continued
          use means acceptance.
        </P>
      </Section>

      <Section>
        <H2>11. Contact Us</H2>
        <BulletList
          items={[
            'Email: privacy@buildprofitsolutions.com',
            'Address: [Your Nevada Business Address]',
          ]}
        />
      </Section>
    </View>
  );
}

// ========== REFUND POLICY CONTENT ==========
function RefundPolicyContent() {
  return (
    <View>
      <SectionHeader title="Refund Policy" subtitle="Effective: November 2025" />

      <Section>
        <P>
          Build Profit Solutions ("BPS", "we", "our") offers a 7-day free trial to all new
          subscribers. During the trial period, users receive full access to the platform with no
          charges applied until the trial ends.
        </P>
      </Section>

      <Section>
        <P>
          Because you are given the opportunity to fully evaluate the service before billing begins,
          all subscription payments are final and non-refundable once the trial period has ended,
          except where required by applicable law.
        </P>
      </Section>

      <Section>
        <H2>1. No Refunds After Trial Period</H2>
        <P>
          After the 7-day trial concludes and your first subscription payment is processed:
        </P>
        <BulletList
          items={[
            'Payments are non-refundable',
            'Partially used billing periods are not eligible for refunds',
            'Renewal charges are non-refundable',
          ]}
        />
        <P>This applies to both monthly and annual plans.</P>
      </Section>

      <Section>
        <H2>2. Subscriptions Purchased Through Apple or Google</H2>
        <P>
          If your subscription was initiated through the Apple App Store or Google Play Store, all
          refunds must be handled directly through Apple or Google, according to their policies. BPS
          is not able to issue refunds for App Store or Google Play transactions.
        </P>
      </Section>

      <Section>
        <H2>3. Cancellation Policy</H2>
        <P>
          You may cancel your subscription at any time in the Payment & Billing section of your
          account or through your app-store subscription settings. Cancellation stops future charges
          but does not generate a refund for any past payments. You will retain access to premium
          features until the end of the current billing cycle.
        </P>
      </Section>

      <Section>
        <H2>4. Chargebacks</H2>
        <P>
          Initiating a chargeback without first contacting BPS Support may result in temporary or
          permanent suspension of your account. We strongly recommend contacting us first to resolve
          any billing concerns.
        </P>
      </Section>

      <Section>
        <H2>5. Exceptions Required by Law</H2>
        <P>
          In situations where applicable consumer protection laws require a refund, BPS will comply
          and process the refund accordingly.
        </P>
      </Section>

      <Section>
        <H2>6. Contact Us</H2>
        <P>For billing questions or subscription support:</P>
        <BulletList
          items={[
            'Email: support@buildprofitsolutions.com',
            'Subject: Billing Support',
          ]}
        />
        <P>We respond to all inquiries within 2–3 business days.</P>
      </Section>
    </View>
  );
}

// ========== ATTRIBUTIONS CONTENT ==========
function AttributionsContent({
  onNavigate,
  onOpenLink,
}: {
  onNavigate: (section: string, tab: TabType) => void;
  onOpenLink: (url: string) => void;
}) {
  return (
    <View>
      <SectionHeader
        title="Data Sources & Attributions"
        subtitle="Learn about our data providers"
      />

      <Section>
        <P>
          Build Profit Solutions integrates data from trusted third-party sources to provide you
          with accurate material pricing, contractor information, and business insights. Below are
          links to detailed information about each data source.
        </P>
      </Section>

      {/* Quick Navigation Cards */}
      <TouchableOpacity
        style={styles.attrCard}
        onPress={() => onNavigate('8.1', 'terms')}
      >
        <View style={styles.attrCardContent}>
          <MaterialIcons name="business" size={24} color="#43cea2" />
          <View style={styles.attrCardText}>
            <Text style={styles.attrCardTitle}>Yelp Fusion API</Text>
            <Text style={styles.attrCardSubtitle}>Contractor & supplier information</Text>
          </View>
          <MaterialIcons name="arrow-forward" size={20} color="#9BB4D0" />
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.attrCard}
        onPress={() => onNavigate('8.2', 'terms')}
      >
        <View style={styles.attrCardContent}>
          <MaterialIcons name="shopping-cart" size={24} color="#43cea2" />
          <View style={styles.attrCardText}>
            <Text style={styles.attrCardTitle}>Home Depot & Lowe's</Text>
            <Text style={styles.attrCardSubtitle}>Material pricing & availability</Text>
          </View>
          <MaterialIcons name="arrow-forward" size={20} color="#9BB4D0" />
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.attrCard}
        onPress={() => onNavigate('8.3', 'terms')}
      >
        <View style={styles.attrCardContent}>
          <MaterialIcons name="cloud" size={24} color="#43cea2" />
          <View style={styles.attrCardText}>
            <Text style={styles.attrCardTitle}>Third-Party APIs</Text>
            <Text style={styles.attrCardSubtitle}>Data aggregation services</Text>
          </View>
          <MaterialIcons name="arrow-forward" size={20} color="#9BB4D0" />
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.attrCard}
        onPress={() => onNavigate('8.4', 'terms')}
      >
        <View style={styles.attrCardContent}>
          <MaterialIcons name="info" size={24} color="#43cea2" />
          <View style={styles.attrCardText}>
            <Text style={styles.attrCardTitle}>Disclaimer</Text>
            <Text style={styles.attrCardSubtitle}>Data accuracy information</Text>
          </View>
          <MaterialIcons name="arrow-forward" size={20} color="#9BB4D0" />
        </View>
      </TouchableOpacity>

      {/* Inline Attribution Examples */}
      <Section>
        <H2>How Attributions Appear in the App</H2>
        <P>
          When you use features that display third-party data, you'll see inline attributions like
          these:
        </P>
      </Section>

      <View style={styles.exampleCard}>
        <Text style={styles.exampleTitle}>Marketplace / Contractor Search</Text>
        <Text style={styles.exampleText}>
          Some ratings sourced via Yelp Fusion API.{' '}
          <Text
            style={styles.exampleLink}
            onPress={() => onNavigate('8.1', 'terms')}
          >
            Details
          </Text>
        </Text>
        <TouchableOpacity
          style={styles.poweredByBadge}
          onPress={() => onOpenLink('https://www.yelp.com')}
        >
          <Text style={styles.poweredByText}>Powered by Yelp</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.exampleCard}>
        <Text style={styles.exampleTitle}>Materials Lookup</Text>
        <Text style={styles.exampleText}>
          Prices are estimates and may change. Verify on retailer sites. Data via authorized
          third-party provider.{' '}
          <Text
            style={styles.exampleLink}
            onPress={() => onNavigate('8.2', 'terms')}
          >
            Learn more
          </Text>
        </Text>
      </View>

      {/* External Links */}
      <Section>
        <H2>Learn More</H2>
        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => onOpenLink('https://www.yelp.com/developers/api_terms')}
        >
          <MaterialIcons name="open-in-new" size={18} color="#43cea2" />
          <Text style={styles.linkButtonText}>Yelp API Terms of Service</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => onOpenLink('https://www.homedepot.com/c/Terms_of_Use')}
        >
          <MaterialIcons name="open-in-new" size={18} color="#43cea2" />
          <Text style={styles.linkButtonText}>Home Depot Terms of Use</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => onOpenLink('https://www.lowes.com/l/terms-of-use')}
        >
          <MaterialIcons name="open-in-new" size={18} color="#43cea2" />
          <Text style={styles.linkButtonText}>Lowe's Terms of Use</Text>
        </TouchableOpacity>
      </Section>
    </View>
  );
}

// ========== REUSABLE COMPONENTS ==========

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
    </View>
  );
}

function Section({
  id,
  highlight,
  children,
}: {
  id?: string;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.sectionCard, highlight && styles.sectionHighlight]}>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <Text style={styles.h2}>{children}</Text>;
}

function H3({ children }: { children: React.ReactNode }) {
  return <Text style={styles.h3}>{children}</Text>;
}

function P({ children }: { children: React.ReactNode }) {
  return <Text style={styles.p}>{children}</Text>;
}

function BulletList({ items }: { items: string[] }) {
  return (
    <View style={styles.bulletList}>
      {items.map((item, index) => (
        <View key={index} style={styles.bulletItem}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.noticeBox}>
      <Text style={styles.noticeText}>{children}</Text>
    </View>
  );
}

// ========== STYLES ==========

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(67, 206, 162, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(67, 206, 162, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(67, 206, 162, 0.8)',
    marginTop: 4,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(67, 206, 162, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(67, 206, 162, 0.2)',
    alignItems: 'center',
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
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  contentCard: {
    flex: 1,
    marginHorizontal: 4,
    marginBottom: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(20, 40, 80, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(67, 206, 162, 0.2)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
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
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  sectionCard: {
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 1,
    overflow: 'hidden',
    borderColor: 'rgba(67, 206, 162, 0.2)',
    backgroundColor: 'rgba(67, 206, 162, 0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
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
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    marginTop: 8,
  },
  h3: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
    marginTop: 12,
  },
  p: {
    fontSize: 14,
    lineHeight: 22,
    color: '#CFE6FF',
    marginBottom: 12,
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
    fontSize: 14,
    lineHeight: 22,
    color: '#CFE6FF',
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
    color: '#FFFFFF',
    marginBottom: 2,
  },
  attrCardSubtitle: {
    fontSize: 13,
    color: '#9BB4D0',
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
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  exampleText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#9BB4D0',
  },
  exampleLink: {
    color: '#43cea2',
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
    fontSize: 14,
    color: '#FFFFFF',
    marginLeft: 10,
  },
});

