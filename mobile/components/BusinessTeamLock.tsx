import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BRAND_FRAME_GRADIENT_COLORS } from '@/constants/brandFrameGradient';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';

type Props = {
  loading?: boolean;
  currentPlanId?: string | null;
  onUpgrade: () => void;
  onRefresh?: () => void;
};

const BUSINESS_FEATURES = [
  'Invite PMs, foremen, and field crews with their own profiles',
  'Keep projects, notes, calendar events, daily logs, and expenses connected',
  'Prepare role-based access for Owner, Manager, Foreman, and Field users',
];

export default function BusinessTeamLock({
  loading = false,
  currentPlanId,
  onUpgrade,
  onRefresh,
}: Props) {
  const { theme } = useTheme();
  const Colors = getColors(theme);
  const darkMode = Colors.bg === '#000000';
  const currentPlanLabel =
    currentPlanId === 'business'
      ? 'Business'
      : currentPlanId === 'premium'
        ? 'Professional'
        : currentPlanId === 'basic'
          ? 'Basic'
          : 'No active plan';

  return (
    <View style={[styles.root, { backgroundColor: Colors.bg }]}>
      <LinearGradient
        colors={BRAND_FRAME_GRADIENT_COLORS}
        start={{ x: 0.05, y: 0.15 }}
        end={{ x: 0.95, y: 0.85 }}
        style={styles.border}
      >
        <View
          style={[
            styles.card,
            {
              backgroundColor: darkMode ? '#000000' : Colors.bg,
            },
          ]}
        >
          <View style={[styles.iconWrap, { backgroundColor: Colors.surface2 }]}>
            <MaterialIcons name="groups" size={30} color="#22c55e" />
          </View>

          <Text style={[styles.eyebrow, { color: '#22c55e' }]}>
            Business Plan · $199/mo
          </Text>
          <Text style={[styles.title, { color: Colors.text }]}>
            Unlock Team Workspace
          </Text>
          <Text style={[styles.body, { color: Colors.sub }]}>
            Give each team member their own login while keeping projects, updates,
            expenses, and job costs connected to one company workspace.
          </Text>

          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <Text style={[styles.previewTitle, { color: Colors.text }]}>
                Business workspace includes
              </Text>
              <View style={styles.planPill}>
                <Text style={styles.planPillText}>Up to 5 team seats</Text>
              </View>
            </View>
            {BUSINESS_FEATURES.map((feature) => (
              <View key={feature} style={styles.featureRow}>
                <MaterialIcons name="check-circle" size={18} color="#22c55e" />
                <Text style={[styles.featureText, { color: Colors.sub }]}>
                  {feature}
                </Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            activeOpacity={0.88}
            disabled={loading && !currentPlanId}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onUpgrade();
            }}
            style={styles.ctaWrap}
          >
            <LinearGradient
              colors={['#22c55e', '#22d3ee']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cta}
            >
              {loading && !currentPlanId ? (
                <ActivityIndicator color="#00130b" />
              ) : (
                <Text style={styles.ctaText}>Upgrade to Business</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.footerRow}>
            <Text style={[styles.currentPlanText, { color: Colors.sub }]}>
              Current plan: {currentPlanLabel}
            </Text>
            {!!onRefresh && (
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onRefresh();
                }}
                activeOpacity={0.75}
                disabled={loading}
              >
                <Text style={styles.refreshText}>
                  {loading ? 'Checking…' : 'Refresh'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingTop: 0,
  },
  border: {
    borderRadius: 24,
    padding: 1,
  },
  card: {
    borderRadius: 23,
    padding: 20,
  },
  iconWrap: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.24)',
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    lineHeight: 31,
    fontWeight: '900',
    marginBottom: 10,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 18,
  },
  previewCard: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.58)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.16)',
    marginBottom: 18,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
  },
  planPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(34, 197, 94, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.32)',
  },
  planPillText: {
    color: '#22c55e',
    fontSize: 12,
    fontWeight: '800',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 10,
  },
  featureText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  ctaWrap: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  cta: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  ctaText: {
    color: '#00130b',
    fontSize: 16,
    fontWeight: '900',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    gap: 12,
  },
  currentPlanText: {
    fontSize: 13,
    fontWeight: '600',
  },
  refreshText: {
    color: '#22d3ee',
    fontSize: 13,
    fontWeight: '800',
  },
});
