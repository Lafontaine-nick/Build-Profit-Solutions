import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Animated,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { LineChart } from 'react-native-gifted-charts';
import WebPageShell from '@/components/layout/WebPageShell';

const { width, height } = Dimensions.get('window');

interface ChartData {
  id: string;
  title: string;
  value: string;
  change: number;
  data: Array<{ value: number; dataPointText?: string }>;
  color: string;
  icon: string;
}

interface AnalyticsMetric {
  id: string;
  title: string;
  value: string;
  subtitle: string;
  trend: 'up' | 'down' | 'stable';
  percentage: number;
  color: string;
}

export default function AnalyticsScreen() {
  const { darkMode } = useTheme();
  const [selectedPeriod, setSelectedPeriod] = useState<
    'week' | 'month' | 'quarter' | 'year'
  >('month');
  const [selectedChart, setSelectedChart] = useState<string | null>(null);
  const [fadeAnim] = useState(new Animated.Value(1));

  const theme = darkMode
    ? {
        background: ['#0b1c38', '#1B365D', '#2d5a3d', '#43cea2'] as [
          any,
          any,
          any,
          any,
        ],
        card: '#142850',
        text: '#fff',
        subtext: '#FFFFFF',
        accent: '#43cea2',
      }
    : {
        background: ['#f5f7fa', '#c3cfe2', '#e8f5e8', '#fff'] as [
          any,
          any,
          any,
          any,
        ],
        card: '#fff',
        text: '#222',
        subtext: '#555',
        accent: '#1976d2',
      };

  const chartData: ChartData[] = [
    {
      id: 'revenue',
      title: 'Revenue',
      value: '$1,250,000',
      change: 12.5,
      data: [
        { value: 100000, dataPointText: 'Jan' },
        { value: 120000, dataPointText: 'Feb' },
        { value: 110000, dataPointText: 'Mar' },
        { value: 140000, dataPointText: 'Apr' },
        { value: 130000, dataPointText: 'May' },
        { value: 160000, dataPointText: 'Jun' },
        { value: 150000, dataPointText: 'Jul' },
      ],
      color: '#43cea2',
      icon: 'trending-up',
    },
    {
      id: 'projects',
      title: 'Active Projects',
      value: '24',
      change: 8.3,
      data: [
        { value: 18, dataPointText: 'Jan' },
        { value: 20, dataPointText: 'Feb' },
        { value: 19, dataPointText: 'Mar' },
        { value: 22, dataPointText: 'Apr' },
        { value: 21, dataPointText: 'May' },
        { value: 25, dataPointText: 'Jun' },
        { value: 24, dataPointText: 'Jul' },
      ],
      color: '#2196F3',
      icon: 'assignment',
    },
    {
      id: 'leads',
      title: 'New Leads',
      value: '156',
      change: -2.1,
      data: [
        { value: 180, dataPointText: 'Jan' },
        { value: 175, dataPointText: 'Feb' },
        { value: 160, dataPointText: 'Mar' },
        { value: 170, dataPointText: 'Apr' },
        { value: 165, dataPointText: 'May' },
        { value: 150, dataPointText: 'Jun' },
        { value: 156, dataPointText: 'Jul' },
      ],
      color: '#FF9800',
      icon: 'people',
    },
    {
      id: 'profit',
      title: 'Profit Margin',
      value: '18.5%',
      change: 3.2,
      data: [
        { value: 15, dataPointText: 'Jan' },
        { value: 16, dataPointText: 'Feb' },
        { value: 15.5, dataPointText: 'Mar' },
        { value: 17, dataPointText: 'Apr' },
        { value: 16.8, dataPointText: 'May' },
        { value: 18, dataPointText: 'Jun' },
        { value: 18.5, dataPointText: 'Jul' },
      ],
      color: '#4CAF50',
      icon: 'account-balance',
    },
  ];

  const metrics: AnalyticsMetric[] = [
    {
      id: 'conversion',
      title: 'Lead Conversion',
      value: '23.4%',
      subtitle: 'Last 30 days',
      trend: 'up',
      percentage: 5.2,
      color: '#4CAF50',
    },
    {
      id: 'response',
      title: 'Avg Response Time',
      value: '2.3h',
      subtitle: 'Lead response',
      trend: 'down',
      percentage: 12.1,
      color: '#2196F3',
    },
    {
      id: 'satisfaction',
      title: 'Client Satisfaction',
      value: '4.8/5',
      subtitle: 'Average rating',
      trend: 'up',
      percentage: 2.3,
      color: '#FF9800',
    },
    {
      id: 'retention',
      title: 'Client Retention',
      value: '87%',
      subtitle: 'Repeat customers',
      trend: 'stable',
      percentage: 0.5,
      color: '#9C27B0',
    },
  ];

  const handlePeriodChange = (
    period: 'week' | 'month' | 'quarter' | 'year'
  ) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPeriod(period);
  };

  const handleChartPress = (chartId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedChart(selectedChart === chartId ? null : chartId);
  };

  const renderMetricCard = (metric: AnalyticsMetric) => (
    <View
      key={metric.id}
      style={[styles.metricCard, { backgroundColor: theme.card }]}
    >
      <View style={styles.metricHeader}>
        <Text style={[styles.metricTitle, { color: theme.text }]}>
          {metric.title}
        </Text>
        <View
          style={[
            styles.trendContainer,
            { backgroundColor: metric.color + '20' },
          ]}
        >
          <MaterialIcons
            name={
              metric.trend === 'up'
                ? 'trending-up'
                : metric.trend === 'down'
                  ? 'trending-down'
                  : 'trending-flat'
            }
            size={16}
            color={metric.color}
          />
          <Text style={[styles.trendText, { color: metric.color }]}>
            {metric.trend === 'up' ? '+' : metric.trend === 'down' ? '-' : ''}
            {metric.percentage}%
          </Text>
        </View>
      </View>

      <Text style={[styles.metricValue, { color: theme.text }]}>
        {metric.value}
      </Text>
      <Text style={[styles.metricSubtitle, { color: theme.subtext }]}>
        {metric.subtitle}
      </Text>
    </View>
  );

  const renderChartCard = (chart: ChartData) => (
    <TouchableOpacity
      key={chart.id}
      style={[styles.chartCard, { backgroundColor: theme.card }]}
      onPress={() => handleChartPress(chart.id)}
      activeOpacity={0.8}
    >
      <View style={styles.chartHeader}>
        <View style={styles.chartInfo}>
          <MaterialIcons
            name={chart.icon as any}
            size={24}
            color={chart.color}
          />
          <View style={styles.chartText}>
            <Text style={[styles.chartTitle, { color: theme.text }]}>
              {chart.title}
            </Text>
            <Text style={[styles.chartValue, { color: theme.text }]}>
              {chart.value}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.changeContainer,
            { backgroundColor: chart.change >= 0 ? '#4CAF50' : '#F44336' },
          ]}
        >
          <MaterialIcons
            name={chart.change >= 0 ? 'trending-up' : 'trending-down'}
            size={16}
            color='white'
          />
          <Text style={styles.changeText}>{Math.abs(chart.change)}%</Text>
        </View>
      </View>

      {selectedChart === chart.id && (
        <Animated.View style={[styles.chartContainer, { opacity: fadeAnim }]}>
          <LineChart
            data={chart.data}
            width={width - 80}
            height={150}
            isAnimated
            color={chart.color}
            thickness={3}
            hideDataPoints={false}
            hideRules
            xAxisColor='transparent'
            yAxisColor='transparent'
            noOfSections={3}
            areaChart
            startFillColor={`${chart.color}20`}
            endFillColor={`${chart.color}05`}
            startOpacity={0.5}
            endOpacity={0.01}
            yAxisTextStyle={{ color: theme.subtext }}
          />
        </Animated.View>
      )}
    </TouchableOpacity>
  );

  return (
    <LinearGradient colors={theme.background} style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={Platform.OS === 'web' ? { paddingHorizontal: 0 } : undefined}
        showsVerticalScrollIndicator={false}
      >
        <WebPageShell size="profile" scroll={false} contentStyle={{ paddingBottom: 0 }}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Analytics
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.subtext }]}>
            Track your business performance
          </Text>
        </View>

        <View style={styles.periodSelector}>
          {(['week', 'month', 'quarter', 'year'] as const).map(period => (
            <TouchableOpacity
              key={period}
              style={[
                styles.periodButton,
                {
                  backgroundColor:
                    selectedPeriod === period ? theme.accent : 'transparent',
                  borderColor:
                    selectedPeriod === period ? theme.accent : theme.subtext,
                },
              ]}
              onPress={() => handlePeriodChange(period)}
            >
              <Text
                style={[
                  styles.periodText,
                  {
                    color: selectedPeriod === period ? 'white' : theme.subtext,
                  },
                ]}
              >
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.metricsGrid}>{metrics.map(renderMetricCard)}</View>

        <View style={styles.chartsSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Performance Charts
          </Text>
          {chartData.map(renderChartCard)}
        </View>

        <View style={styles.insightsSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Key Insights
          </Text>

          <View style={[styles.insightCard, { backgroundColor: theme.card }]}>
            <MaterialIcons name='lightbulb' size={24} color='#FFD700' />
            <View style={styles.insightContent}>
              <Text style={[styles.insightTitle, { color: theme.text }]}>
                Revenue Growth Strong
              </Text>
              <Text style={[styles.insightText, { color: theme.subtext }]}>
                Your revenue has increased by 12.5% this month. Focus on
                high-value projects to maintain this momentum.
              </Text>
            </View>
          </View>

          <View style={[styles.insightCard, { backgroundColor: theme.card }]}>
            <MaterialIcons name='warning' size={24} color='#FF9800' />
            <View style={styles.insightContent}>
              <Text style={[styles.insightTitle, { color: theme.text }]}>
                Lead Response Time
              </Text>
              <Text style={[styles.insightText, { color: theme.subtext }]}>
                Consider improving response time to leads. Faster responses
                typically result in higher conversion rates.
              </Text>
            </View>
          </View>

          <View style={[styles.insightCard, { backgroundColor: theme.card }]}>
            <MaterialIcons name='star' size={24} color='#4CAF50' />
            <View style={styles.insightContent}>
              <Text style={[styles.insightTitle, { color: theme.text }]}>
                Excellent Client Satisfaction
              </Text>
              <Text style={[styles.insightText, { color: theme.subtext }]}>
                Your 4.8/5 rating shows strong client relationships. Keep up the
                great work!
              </Text>
            </View>
          </View>
        </View>
        </WebPageShell>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    lineHeight: 22,
  },
  periodSelector: {
    flexDirection: 'row',
    marginBottom: 20,
    borderRadius: 12,
    padding: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  periodText: {
    fontSize: 14,
    fontWeight: '600',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  metricCard: {
    width: (width - 60) / 2,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 2,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  metricSubtitle: {
    fontSize: 12,
  },
  chartsSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  chartCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  chartInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chartText: {
    marginLeft: 12,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  chartValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  changeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  chartContainer: {
    alignItems: 'center',
    paddingTop: 16,
  },
  insightsSection: {
    marginBottom: 30,
  },
  insightCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  insightContent: {
    flex: 1,
    marginLeft: 12,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  insightText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
