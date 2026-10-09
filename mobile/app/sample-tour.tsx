import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import BackButton from '@/components/ui/BackButton';
import { SegmentNavBar, type SegmentNavItem } from '@/components/navigation/SegmentNavBar';
import BudgetProfitMixCard from '@/components/BudgetProfitMixCard';
import TaxSummaryCard from '@/src/components/tax/TaxSummaryCard';
import type { ProfitForecastOutput } from '@/src/lib/profitForecast';

const BG = '#000000';
const CARD = '#202022';
const CARD_BORDER = 'rgba(148, 163, 184, 0.12)';
const MINT = '#2dcc9a';
const TEXT = '#F5F7FA';
const SLATE = '#d7e1f0';
const MUTED = 'rgba(255, 255, 255, 0.62)';
const AMBER = '#FBBF24';
const GUTTER = 16;

const noop = () => {};

const DASHBOARD_TABS: SegmentNavItem[] = [
  { key: 'overview', label: 'Overview', icon: 'grid-outline' },
  { key: 'analytics', label: 'Analytics', icon: 'bar-chart-outline' },
  { key: 'calendar', label: 'Calendar', icon: 'calendar' },
  { key: 'insights', label: 'Insights', icon: 'bulb', badgeCount: 1 },
];

const PROJECT_TABS: SegmentNavItem[] = [
  { key: 'overview', label: 'Overview', icon: 'grid-outline' },
  { key: 'budget', label: 'Budget', icon: 'wallet-outline' },
  { key: 'timeline', label: 'Timeline', icon: 'calendar-outline' },
  { key: 'calendar', label: 'Calendar', icon: 'calendar' },
];

const SAMPLE_FORECAST = {
  contractValue: 27460,
  adjustedBudget: 23550,
  actualExpenses: 0,
  committedPOs: 0,
  forecastFinalCost: 23550,
  projectedProfit: 3910,
  currentProjectedProfit: 3910,
  spendToDateMarginPct: 100,
  projectedMarginPct: 14.24,
  allocatedCompanyOverhead: 0,
  originalEstimateProfit: 3910,
  originalEstimateMarginPct: 14.24,
  remainingCostBudget: 23550,
  estimatedProfit: 3910,
  profitVarianceVsEstimate: 0,
  scheduleProgressPct: 0,
  costBudgetUsedPct: 0,
  blendedProgressPct: 0,
} as unknown as ProfitForecastOutput;

function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function Avatar({ initials, size }: { initials: string; size: number }) {
  return (
    <View style={[styles.avatarRing, { width: size, height: size, borderRadius: size / 2 }]}>
      <View style={[styles.avatarInner, { borderRadius: size / 2 }]}>
        <Text style={[styles.avatarText, { fontSize: size > 50 ? 16 : 15 }]}>{initials}</Text>
      </View>
    </View>
  );
}

function StackRow({ label, caption, value, profit }: {
  label: string;
  caption?: string;
  value: string;
  profit?: boolean;
}) {
  return (
    <View style={[styles.stackRow, profit && { paddingVertical: 14 }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.stackLabel, profit && { fontWeight: '700' }]}>{label}</Text>
        {caption ? (
          <Text style={[styles.stackCaption, profit && { color: MINT, fontWeight: '600', marginTop: 3 }]}>
            {caption}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.stackValue, profit && styles.stackValueProfit]}>{value}</Text>
    </View>
  );
}

function Metric({ label, value, trend, context, valueColor = TEXT, first }: {
  label: string;
  value: string;
  trend?: string;
  context: string;
  valueColor?: string;
  first?: boolean;
}) {
  return (
    <View style={[styles.metric, first && styles.metricFirst]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={styles.metricAmountRow}>
        <Text style={[styles.metricValue, { color: valueColor }]}>{value}</Text>
        {trend ? <Text style={styles.metricTrend}>{trend}</Text> : null}
      </View>
      <Text style={styles.metricContext}>{context}</Text>
    </View>
  );
}

function ScopeRow({ name, amount }: { name: string; amount: string }) {
  return (
    <View style={styles.scopeRow}>
      <Text style={styles.scopeName}>{name}</Text>
      <Text style={styles.scopeAmount}>{amount}</Text>
    </View>
  );
}

function GridStat({ label, value, mint }: { label: string; value: string; mint?: boolean }) {
  return (
    <View style={styles.gridCell}>
      <Text style={styles.gridLabel}>{label}</Text>
      <Text style={[styles.gridValue, mint && { color: MINT }]}>{value}</Text>
    </View>
  );
}

function CheckRow({ label, tone }: { label: string; tone: 'done' | 'attention' | 'pending' }) {
  const icon = tone === 'done' ? 'check-circle' : tone === 'attention' ? 'warning-amber' : 'radio-button-unchecked';
  const color = tone === 'done' ? MINT : tone === 'attention' ? AMBER : 'rgba(148, 163, 184, 0.65)';
  return (
    <View style={styles.checklistRow}>
      <MaterialIcons name={icon} size={20} color={color} />
      <Text
        style={[
          styles.checklistLabel,
          tone === 'attention' && { color: 'rgba(253, 224, 71, 0.92)' },
          tone === 'pending' && { color: 'rgba(148, 163, 184, 0.82)' },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function MissingRow({ label, count }: { label: string; count?: number }) {
  return (
    <View style={styles.missingRow}>
      <Text style={styles.missingLabel}>{label}</Text>
      {count ? (
        <Text style={styles.missingCount}>{count}</Text>
      ) : (
        <MaterialIcons name="check-circle" size={20} color={MINT} />
      )}
    </View>
  );
}

function DashboardSample() {
  return (
    <>
      <View style={styles.dashHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.dashTitle}>Dashboard</Text>
          <Text style={styles.dashWelcome}>Welcome, Alex Morgan</Text>
          <View style={styles.syncRow}>
            <View style={styles.syncDot} />
            <Text style={styles.syncText}>Synced 3:27 PM</Text>
          </View>
        </View>
        <Avatar initials="AM" size={54} />
      </View>
      <SegmentNavBar items={DASHBOARD_TABS} activeKey="overview" onPress={noop} />
      <Card>
        <Text style={styles.cardTitle}>Key metrics</Text>
        <Text style={styles.cardSubtitle}>Your pipeline at a glance</Text>
        <View style={{ marginTop: 18 }}>
          <Metric first label="Total bids" value="$130,791.50" trend="4 jobs" context="Submitted, active, and completed jobs" />
          <Metric label="Active project value" value="$58,371.50" trend="On track" context="In progress" />
          <Metric
            label="Avg net profit"
            value="46.2%"
            valueColor={MINT}
            context="Completed jobs · Net profit as a share of the contract"
          />
        </View>
      </Card>
    </>
  );
}

function BuildWithAiSample() {
  return (
    <>
      <View style={styles.flowHeader}>
        <BackButton darkMode onPress={noop} />
        <View style={styles.flowHeaderCopy}>
          <Text style={styles.flowHeaderTitle}>Initial estimate</Text>
          <Text style={styles.flowHeaderSub}>Quick summary before detailed review</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>
      <View style={styles.heroShell}>
        <LinearGradient
          colors={['rgba(45,204,154,0.22)', 'rgba(45,204,154,0.08)']}
          start={{ x: 0.05, y: 0.15 }}
          end={{ x: 0.95, y: 0.85 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.heroTopRow}>
          <Text style={styles.heroBadge}>Mostly ready</Text>
          <Text style={styles.heroMeta}>5 scope items</Text>
        </View>
        <Text style={styles.heroTitle}>Electrical Estimate Draft</Text>
        <Text style={styles.heroTagline}>Detected electrical job.</Text>
        <Text style={styles.heroAmount}>$27,612</Text>
        <Text style={styles.heroHint}>Initial estimate (incl. markup)</Text>
        <Text style={styles.heroMarkup}>15% markup</Text>
        <View style={styles.chipRow}>
          <View style={styles.chip}>
            <Text style={styles.chipLabel}>MATERIALS</Text>
            <Text style={styles.chipValue}>$5,645</Text>
          </View>
          <View style={styles.chip}>
            <Text style={styles.chipLabel}>LABOR</Text>
            <Text style={styles.chipValue}>$18,365</Text>
          </View>
        </View>
      </View>
      <View style={styles.detailsLink}>
        <Text style={styles.detailsLinkText}>View estimate details</Text>
        <Ionicons name="arrow-forward" size={16} color={MINT} />
      </View>
      <Card style={{ padding: 0 }}>
        <View style={styles.scopeBlock}>
          <View style={styles.scopeTitleRow}>
            <Text style={styles.scopeTitle}>Scope · 5 items</Text>
            <Ionicons name="chevron-up" size={18} color="#FFFFFF" />
          </View>
          <ScopeRow name="Service / panels · 1 each" amount="$2,050" />
          <ScopeRow name="Receptacles · 101 each" amount="$11,955" />
          <ScopeRow name="Switches / controls · 39 each" amount="$3,705" />
          <ScopeRow name="Lighting · 31 each" amount="$4,650" />
          <ScopeRow name="Fans · 6 each" amount="$1,650" />
        </View>
      </Card>
    </>
  );
}

function EstimatesSample() {
  return (
    <Card style={{ padding: 18 }}>
      <Text style={styles.summaryTitle}>Electrical Estimate Draft</Text>
      <Text style={styles.summaryAmount}>$27,611.50</Text>
      <Text style={styles.summaryLine}>Estimated bid (incl. markup) · 15% markup</Text>
      <Text style={styles.summaryLine}>Needs review — 4 items to check · 12 items</Text>
      <Text style={styles.summaryReview}>Review items</Text>
      <View style={{ marginTop: 22 }}>
        <StackRow label="Hard costs" value="$24,010.00" />
        <StackRow label="Builder margin (15%)" value="$3,601.50" />
        <StackRow label="Projected net profit" caption="13.0% projected net margin" value="$3,601.50" profit />
      </View>
      <View style={styles.continueBlock}>
        <Text style={styles.continueTitle}>Continue the bid</Text>
        <Text style={styles.continueBody}>
          Add these if you want them. Send to Projects shows after you come back to Summary.
        </Text>
        <View style={styles.continueList}>
          <View style={styles.continueRow}>
            <MaterialIcons name="radio-button-unchecked" size={16} color="#8eecc9" />
            <Text style={styles.continueRowText}>Customer information</Text>
          </View>
          <View style={styles.continueRow}>
            <MaterialIcons name="radio-button-unchecked" size={16} color="#8eecc9" />
            <Text style={styles.continueRowText}>Payment schedule</Text>
          </View>
        </View>
        <View style={styles.continueButton}>
          <Text style={styles.continueButtonText}>Continue · Customer information</Text>
        </View>
      </View>
    </Card>
  );
}

function ProjectsSample() {
  return (
    <>
      <View style={styles.flowHeader}>
        <BackButton darkMode onPress={noop} />
        <Text style={styles.projectTitle} numberOfLines={1}>Electrical Estimate Draft</Text>
        <Avatar initials="AM" size={44} />
      </View>
      <SegmentNavBar items={PROJECT_TABS} activeKey="overview" onPress={noop} />
      <Card style={styles.overviewCard}>
        <Text style={styles.overviewTitle}>Project overview</Text>
        <BudgetProfitMixCard
          adjustedContractValue={27460}
          spentToDate={0}
          committedPOsTotal={0}
          adjustedCostBudget={23550}
          profitForecast={SAMPLE_FORECAST}
          marginTop={0}
        />
      </Card>
      <Card>
        <Text style={styles.budgetTitle}>Contract & cost</Text>
        <Text style={styles.budgetAmount}>$27,460.00</Text>
        <Text style={styles.budgetCaption}>Contract (incl. markup) · 20% markup</Text>
        <View style={{ marginTop: 14 }}>
          <StackRow label="Hard costs + equipment" caption="Materials, labor, and equipment" value="$21,750.00" />
          <StackRow label="Soft costs" value="$300.00" />
          <StackRow label="Contingency" value="$1,000.00" />
          <StackRow label="Builder margin (20%)" value="$4,410.00" />
          <StackRow label="Project overhead" value="-$500.00" />
          <StackRow label="Projected profit" caption="14.2% projected net margin" value="$3,910.00" profit />
        </View>
      </Card>
    </>
  );
}

function AssistantSample() {
  return (
    <>
      <View style={styles.userBubble}>
        <Text style={styles.userBubbleText}>What is my current markup on this job</Text>
      </View>
      <Text style={styles.bubbleTime}>Just now</Text>
      <View style={styles.assistantCard}>
        <Text style={styles.assistantEyebrow}>CENTRAL COMMAND</Text>
        <Text style={styles.assistantHeading}>Price guidance for Electrical Estimate Draft</Text>
        <Text style={styles.assistantBody}>
          <Text style={styles.assistantBold}>Verdict: </Text>
          Maybe - the price is close, but missing-cost risk still makes it feel thin.
        </Text>
        <View style={styles.grid}>
          <GridStat label="Estimated cost" value="$23,050" />
          <GridStat label="Current bid" value="$27,460" />
          <GridStat label="Current markup" value="20%" mint />
          <GridStat label="Current margin" value="16.1%" mint />
        </View>
        <Text style={[styles.assistantBody, { marginTop: 12 }]}>
          Your current price is workable, but not especially protected.
        </Text>
        <Text style={[styles.assistantBody, { marginTop: 12 }]}>
          <Text style={styles.assistantBold}>Markup recommendation: </Text>
          about <Text style={styles.assistantBold}>20% markup</Text> is a reasonable target for this general
          residential project.
        </Text>
      </View>
    </>
  );
}

function TaxCenterSample() {
  return (
    <>
      <View style={styles.taxHeader}>
        <Text style={styles.taxKicker}>FOR YOUR CPA</Text>
        <Text style={styles.taxTitle}>Tax Center</Text>
        <Text style={styles.taxSubtitle}>
          Summaries, receipt backup, and vendor review from your project data. Not a tax filing.
        </Text>
      </View>
      <Card>
        <Text style={styles.readinessTitle}>Tax Center Readiness</Text>
        <Text style={styles.readinessSub}>
          Review missing items before sending reports to your CPA or entering totals into tax software.
        </Text>
        <View style={styles.readinessStatusRow}>
          <MaterialIcons name="warning-amber" size={28} color={AMBER} />
          <View style={{ flex: 1 }}>
            <Text style={styles.readinessHeadline}>Needs review</Text>
            <Text style={styles.readinessBlurb}>{'17 expenses missing receipts\n2 contractors missing a W-9'}</Text>
          </View>
        </View>
        <View style={styles.checklistBox}>
          <CheckRow label="Revenue reviewed" tone="done" />
          <CheckRow label="Payment & expense dates reviewed" tone="done" />
          <CheckRow label="Expenses categorized" tone="done" />
          <CheckRow label="Receipts attached" tone="attention" />
          <CheckRow label="W-9s from 1099 contractors" tone="attention" />
          <CheckRow label="Accountant export ready" tone="pending" />
        </View>
      </Card>
      <Card>
        <Text style={styles.beforeExportTitle}>Before You Export</Text>
        <MissingRow label="Missing receipts" count={17} />
        <MissingRow label="Contractors missing W-9" count={2} />
        <MissingRow label="Potential 1099 review" />
      </Card>
      <Card>
        <View style={styles.summaryGrid}>
          <TaxSummaryCard label="Revenue Collected" value="$37,550.00" icon="payments" helper="Payments received this year." onPress={noop} />
          <TaxSummaryCard label="Outstanding Receivables" value="$27,460.00" icon="account-balance-wallet" helper="Still owed. Not income until received." onPress={noop} />
          <TaxSummaryCard label="Expenses Paid" value="$20,200.00" icon="receipt-long" helper="Bills paid this year." onPress={noop} />
          <TaxSummaryCard label="Committed Costs" value="$0.00" icon="inventory" helper="Unpaid purchase orders. Not an expense yet." onPress={noop} />
          <TaxSummaryCard label="Net Income" value="$17,350.00" icon="trending-up" helper="Received minus paid." onPress={noop} />
          <TaxSummaryCard label="Net Margin" value="46.2%" icon="percent" helper="Net income ÷ revenue received." onPress={noop} />
          <TaxSummaryCard
            label="1099 & W-2"
            value="$3,500.00"
            lines={[
              { label: '1099', value: '$1,500.00' },
              { label: 'W-2', value: '$2,000.00' },
            ]}
            icon="groups"
            helper="2 W-9s needed"
            helperTone="warn"
            onPress={noop}
          />
          <TaxSummaryCard label="Receipt Count" value="0" icon="fact-check" helper="Receipts attached this year." onPress={noop} />
        </View>
      </Card>
    </>
  );
}

const PAGES: { key: string; caption: string; render: () => React.ReactNode }[] = [
  { key: 'dashboard', caption: 'Your bids, active jobs, and profit in one place.', render: () => <DashboardSample /> },
  { key: 'build', caption: 'Describe the job. AI drafts the scope and the price.', render: () => <BuildWithAiSample /> },
  { key: 'estimates', caption: 'Review the bid, then send it to the customer.', render: () => <EstimatesSample /> },
  { key: 'projects', caption: 'Track spending and profit on every job.', render: () => <ProjectsSample /> },
  { key: 'assistant', caption: 'Ask about a bid, a cost, or a schedule.', render: () => <AssistantSample /> },
  { key: 'tax', caption: 'Year-end numbers ready for your CPA.', render: () => <TaxCenterSample /> },
];

export default function SampleTourScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const page = PAGES[index];
  const isLast = index === PAGES.length - 1;

  const goToPlans = () => {
    router.replace('/payment/plans?required=1');
  };

  const handleNext = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isLast) {
      goToPlans();
      return;
    }
    setIndex(index + 1);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 6 }]}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />

      <View style={styles.tourTopRow}>
        <View style={styles.tourTopSide}>
          {index > 0 ? (
            <TouchableOpacity onPress={() => setIndex(index - 1)} hitSlop={10}>
              <Text style={styles.tourLink}>Back</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={styles.dots}>
          {PAGES.map((p, i) => (
            <View key={p.key} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        <View style={[styles.tourTopSide, { alignItems: 'flex-end' }]}>
          {isLast ? null : (
            <TouchableOpacity onPress={goToPlans} hitSlop={10}>
              <Text style={styles.tourLink}>Skip</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      <View style={styles.captionBlock}>
        <Text style={styles.example}>EXAMPLE · {index + 1} OF {PAGES.length}</Text>
        <Text style={styles.caption}>{page.caption}</Text>
      </View>

      <ScrollView
        key={page.key}
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View pointerEvents="none">{page.render()}</View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity style={styles.primary} onPress={handleNext} activeOpacity={0.88}>
          <Text style={styles.primaryText}>{isLast ? 'Choose your plan' : 'Next'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  tourTopRow: { flexDirection: 'row', alignItems: 'center', minHeight: 32, marginHorizontal: GUTTER },
  tourTopSide: { width: 64 },
  tourLink: { color: SLATE, fontSize: 15, fontWeight: '600' },
  dots: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#3A3A3C' },
  dotActive: { width: 20, backgroundColor: MINT },
  captionBlock: {
    marginHorizontal: GUTTER,
    marginTop: 8,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.10)',
  },
  example: { color: MINT, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  caption: { color: SLATE, fontSize: 14, lineHeight: 19, marginTop: 3 },
  content: { paddingHorizontal: GUTTER, paddingTop: 14, paddingBottom: 24 },
  footer: {
    paddingHorizontal: GUTTER,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.10)',
  },
  primary: { backgroundColor: MINT, borderRadius: 999, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#050B13', fontSize: 17, fontWeight: '700' },

  card: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: 14,
    marginBottom: 12,
  },
  cardTitle: { color: TEXT, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  cardSubtitle: { color: SLATE, fontSize: 15, fontWeight: '500', lineHeight: 21, marginTop: 6 },

  avatarRing: { padding: 2, borderWidth: 1.5, borderColor: MINT },
  avatarInner: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontWeight: '700' },

  dashHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 18 },
  dashTitle: { color: '#FFFFFF', fontSize: 30, fontWeight: '700', letterSpacing: -0.4 },
  dashWelcome: { color: SLATE, fontSize: 13, lineHeight: 18, fontWeight: '500' },
  syncRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  syncDot: { width: 7, height: 7, borderRadius: 999, backgroundColor: MINT, marginRight: 6 },
  syncText: { color: SLATE, fontSize: 12 },
  metric: {
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148,163,184,0.22)',
  },
  metricFirst: { borderTopWidth: 0, paddingTop: 2 },
  metricLabel: { color: SLATE, fontSize: 13, fontWeight: '600', lineHeight: 18, marginBottom: 6 },
  metricAmountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 2 },
  metricValue: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  metricTrend: { color: MINT, fontSize: 15, fontWeight: '700' },
  metricContext: { color: SLATE, fontSize: 11, lineHeight: 15, marginTop: 6 },

  flowHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 8 },
  flowHeaderCopy: { flex: 1, alignItems: 'center' },
  flowHeaderTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  flowHeaderSub: { color: '#FFFFFF', fontSize: 12, marginTop: 2 },
  heroShell: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    overflow: 'hidden',
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  heroBadge: {
    color: MINT,
    backgroundColor: 'rgba(45,204,154,0.14)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: 'hidden',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  heroMeta: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  heroTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', letterSpacing: -0.3, lineHeight: 28 },
  heroTagline: { color: '#FFFFFF', fontSize: 14, fontWeight: '500', lineHeight: 20, marginTop: 4 },
  heroAmount: { color: MINT, fontSize: 44, fontWeight: '900', letterSpacing: -1, marginTop: 14 },
  heroHint: { color: '#FFFFFF', fontSize: 13, fontWeight: '600', marginTop: 4 },
  heroMarkup: { color: '#FFFFFF', fontSize: 12, fontWeight: '600', marginTop: 2, opacity: 0.85 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  chip: { backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, minWidth: 96 },
  chipLabel: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', letterSpacing: 0.4, marginBottom: 2 },
  chipValue: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  detailsLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 14, paddingVertical: 4 },
  detailsLinkText: { color: MINT, fontSize: 14, fontWeight: '700' },
  scopeBlock: { paddingHorizontal: 16, paddingVertical: 14 },
  scopeTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scopeTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  scopeRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 10 },
  scopeName: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', flex: 1 },
  scopeAmount: { color: MINT, fontSize: 14, fontWeight: '800' },

  summaryTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  summaryAmount: { color: MINT, fontSize: 36, fontWeight: '900', letterSpacing: -0.8, marginTop: 10 },
  summaryLine: { color: SLATE, fontSize: 13, fontWeight: '500', lineHeight: 18, marginTop: 8 },
  summaryReview: { color: SLATE, fontSize: 13, fontWeight: '600', marginTop: 10 },
  stackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: CARD_BORDER,
    gap: 12,
  },
  stackLabel: { color: TEXT, fontSize: 15, fontWeight: '600' },
  stackCaption: { color: SLATE, fontSize: 12, lineHeight: 16, marginTop: 2 },
  stackValue: { color: TEXT, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  stackValueProfit: { color: MINT, fontSize: 18, fontWeight: '800' },
  continueBlock: { marginTop: 16 },
  continueTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  continueBody: { color: SLATE, fontSize: 13, lineHeight: 18, marginTop: 4 },
  continueList: { marginTop: 12, gap: 8 },
  continueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  continueRowText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  continueButton: {
    marginTop: 14,
    backgroundColor: MINT,
    borderRadius: 14,
    minHeight: 50,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonText: { color: '#050B13', fontSize: 16, fontWeight: '800' },

  projectTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 23,
    letterSpacing: -0.25,
    fontWeight: '700',
  },
  overviewCard: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 18 },
  overviewTitle: { color: TEXT, fontSize: 28, fontWeight: '800', letterSpacing: -0.4, marginBottom: 16 },
  budgetTitle: { color: TEXT, fontSize: 22, fontWeight: '800', letterSpacing: -0.4, marginBottom: 8 },
  budgetAmount: { color: MINT, fontSize: 36, fontWeight: '900', letterSpacing: -0.8, marginTop: 10 },
  budgetCaption: { color: MUTED, fontSize: 13, fontWeight: '500', lineHeight: 18, marginTop: 8 },

  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '82%',
    backgroundColor: '#3A3A3C',
    borderRadius: 20,
    borderBottomRightRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  userBubbleText: { color: '#F9FAFB', fontSize: 15, lineHeight: 23, letterSpacing: 0.1 },
  bubbleTime: { alignSelf: 'flex-end', color: SLATE, fontSize: 12, marginTop: 6, marginBottom: 14 },
  assistantCard: {
    width: '92%',
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 20,
    borderBottomLeftRadius: 6,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  assistantEyebrow: { color: MINT, fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 10 },
  assistantHeading: { color: '#F8FAFC', fontSize: 18, fontWeight: '800', letterSpacing: 0.12, marginBottom: 12 },
  assistantBody: { color: '#F8FAFC', fontSize: 15, lineHeight: 23 },
  assistantBold: { color: '#F8FAFC', fontWeight: '800' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: CARD_BORDER,
  },
  gridCell: { width: '50%', paddingTop: 10, paddingBottom: 6, paddingRight: 8 },
  gridLabel: { color: '#8DA0B8', fontSize: 12, fontWeight: '600', letterSpacing: 0.2, marginBottom: 3 },
  gridValue: { color: '#F8FAFC', fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },

  taxHeader: { alignItems: 'center', paddingHorizontal: 28, marginBottom: 18 },
  taxKicker: { color: '#8eecc9', fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  taxTitle: { color: '#FFFFFF', fontSize: 30, fontWeight: '900', marginTop: 2 },
  taxSubtitle: {
    color: 'rgba(203, 213, 225, 0.92)',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  readinessTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  readinessSub: { color: 'rgba(148, 163, 184, 0.95)', fontSize: 12, lineHeight: 18, marginTop: 6, marginBottom: 12 },
  readinessStatusRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  readinessHeadline: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  readinessBlurb: { color: 'rgba(203, 213, 225, 0.9)', fontSize: 12, lineHeight: 18, marginTop: 4 },
  checklistBox: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 10,
    gap: 8,
  },
  checklistRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checklistLabel: { color: 'rgba(203, 213, 225, 0.9)', fontSize: 13, fontWeight: '600' },
  beforeExportTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '900', marginBottom: 10 },
  missingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  missingLabel: { color: 'rgba(203, 213, 225, 0.92)', fontSize: 14, fontWeight: '600', flex: 1 },
  missingCount: { color: AMBER, fontSize: 14, fontWeight: '800' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});
