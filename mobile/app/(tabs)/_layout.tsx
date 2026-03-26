import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PillTabBarBackground from '@/components/ui/PillTabBarBackground';
import { HapticTab } from '@/components/HapticTab';
import { useAIManagerMode } from '@/state/useAIManagerMode';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';

export default function TabLayout() {
  const { enabled: aiManagerEnabled, hasAlerts } = useAIManagerMode();
  const { t } = useTranslation();
  const { darkMode } = useTheme();
  const tabInactiveColor = darkMode ? '#FFFFFF' : '#64748B';

  return (
      <Tabs
      initialRouteName="dashboard"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarButton: HapticTab,
        
        // Pill layout & positioning
        tabBarStyle: {
          position: 'absolute',
          bottom: 22,
          left: 20,
          right: 20,
          height: 64,
          paddingBottom: 6,
          paddingTop: 6,
          borderRadius: 28,
          backgroundColor: 'transparent', // BlurView handles bg
          borderTopWidth: 0,
          overflow: 'hidden',
          elevation: 0, // Android shadow handled in background component
        },

        // TRUE iOS BLUR BACKGROUND
        tabBarBackground: () => <PillTabBarBackground />,

        tabBarLabelStyle: {
          fontSize: 11.5,
          fontWeight: '600',
          marginTop: 2,
        },

        tabBarActiveTintColor: '#22C55E',
        tabBarInactiveTintColor: tabInactiveColor,

        tabBarIcon: ({ focused }) => {
          const color = focused ? '#22C55E' : tabInactiveColor;
          let iconName: keyof typeof Ionicons.glyphMap = 'home-outline';

          if (route.name === 'dashboard') iconName = 'speedometer-outline';
          if (route.name === 'projects') iconName = 'folder-open-outline';
          if (route.name === 'estimate-generator') iconName = 'calculator-outline';
          if (route.name === 'leads') iconName = 'people-outline';

          // SPECIAL: Assistant tab – center, sparkles icon, premium glow
          if (route.name === 'assistant') {
            const iconSize = focused ? 28 : 22;

            return (
              <View style={styles.iconWrapper}>
                <View
                  style={[
                    styles.assistantCircle,
                    focused && styles.assistantCircleFocused,
                    aiManagerEnabled && styles.assistantCircleAIEnabled,
                  ]}
                >
                  <Ionicons
                    name="sparkles-outline"
                    size={iconSize}
                    color={focused ? '#22C55E' : tabInactiveColor}
                  />

                  {/* Small "AI" badge when manager mode is enabled */}
                  {aiManagerEnabled && (
                    <View style={styles.aiBadge}>
                      <Text style={styles.aiBadgeText}>AI</Text>
                    </View>
                  )}
                </View>

                {/* Tiny bar dot for active state OR alert state */}
                {focused && <View style={styles.activeDot} />}
                {hasAlerts && !focused && <View style={styles.alertDot} />}
              </View>
            );
          }

          // Default tab icons
          return (
            <View style={styles.iconWrapper}>
              <Ionicons
                name={iconName}
                size={focused ? 24 : 21}
                color={color}
              />
              {focused && <View style={styles.activeDot} />}
            </View>
          );
        },
      })}
    >
      <Tabs.Screen
        name='dashboard'
        options={{
          title: t('tabs.dashboard'),
        }}
      />
      <Tabs.Screen
        name='projects'
        options={{
          title: t('tabs.projects'),
        }}
      />
      <Tabs.Screen
        name='assistant'
        options={{
          title: t('tabs.assistant'),
        }}
      />
      <Tabs.Screen
        name='estimate-generator'
        options={{
          title: t('tabs.estimate'),
        }}
      />
      <Tabs.Screen
        name='leads'
        options={{
          title: t('tabs.leads'),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -1,
  },
  assistantCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.12)', // slightly brighter
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#22C55E',
    shadowOpacity: 0.28,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 0 },
  },
  assistantCircleFocused: {
    backgroundColor: 'rgba(34,197,94,0.22)',
    shadowOpacity: 0.58,  // tuned
    shadowRadius: 12,      // tuned
    shadowOffset: { width: 0, height: 0 },
  },
  // Extra subtle highlight when AI PM mode is enabled
  assistantCircleAIEnabled: {
    borderWidth: 1,
    borderColor: 'rgba(190,242,100,0.8)', // soft lime border
  },
  aiBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#22C55E',
  },
  aiBadgeText: {
    color: '#021B3A',
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  activeDot: {
    width: 5,
    height: 3,
    borderRadius: 3,
    backgroundColor: '#22C55E',
    marginTop: 4,
  },
  alertDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F97316', // orange for "needs attention"
    marginTop: 4,
  },
});
