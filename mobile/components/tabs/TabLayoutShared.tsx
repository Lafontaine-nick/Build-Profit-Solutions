import { Tabs } from 'expo-router';
import React, { useMemo, type ComponentType } from 'react';
import { View, StyleSheet, Text, useWindowDimensions, Platform, type TextStyle, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { HapticTab } from '@/components/HapticTab';
import { useAIManagerMode } from '@/state/useAIManagerMode';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import {
  TabBarAssistantStar,
  TabBarDashboardIcon,
  TabBarEstimateIcon,
  TabBarLeadsIcon,
  TabBarProjectsIcon,
  TabIconSlot,
  TAB_NAV_ACTIVE,
} from '@/components/ui/TabBarPillIcons';
import { isDesktopWebLayoutWidth } from '@/constants/ScreenLayout';
import ProfileCompletionReminder from '@/components/ProfileCompletionReminder';
import { useWorkspaceProjectPermissions } from '@/hooks/useWorkspaceProjectPermissions';

const ASSISTANT_LABEL_COLOR = '#5eead4';

export type TabLayoutSharedProps = {
  PillTabBarBackground: ComponentType;
};

export default function TabLayoutShared({ PillTabBarBackground }: TabLayoutSharedProps) {
  const { width } = useWindowDimensions();
  const desktopWebSidebar = isDesktopWebLayoutWidth(width);
  const { enabled: aiManagerEnabled, hasAlerts } = useAIManagerMode();
  const { t } = useTranslation();
  const { darkMode, theme } = useTheme();
  const tabInactiveColor = darkMode ? '#757575' : '#64748B';
  const sidebarBorder = darkMode ? 'rgba(148, 163, 184, 0.22)' : 'rgba(15, 23, 42, 0.12)';
  const sidebarBg = darkMode ? theme.bg : '#f8fafc';
  const { canAccessEstimateAndLeads } = useWorkspaceProjectPermissions();

  const screenOptions = useMemo(
    () =>
      ({ route }: { route: { name: string } }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        ...(desktopWebSidebar
          ? {
              tabBarPosition: 'left' as const,
              tabBarVariant: 'material' as const,
              tabBarLabelPosition: 'below-icon' as const,
              tabBarButton: HapticTab,
              ...(Platform.OS === 'web'
                ? {
                    /** Scene content uses negative horizontal margins; without this, RN-web can leave the scene “above” the bar and steal all sidebar taps. */
                    sceneContainerStyle: {
                      flex: 1,
                      overflow: 'hidden' as const,
                    },
                  }
                : {}),
              tabBarStyle: {
                paddingTop: Platform.OS === 'web' ? 20 : 8,
                paddingBottom: Platform.OS === 'web' ? 16 : 0,
                paddingHorizontal: Platform.OS === 'web' ? 8 : 0,
                width: Platform.OS === 'web' ? 112 : undefined,
                backgroundColor: sidebarBg,
                borderRightWidth: StyleSheet.hairlineWidth,
                borderRightColor: sidebarBorder,
                ...(Platform.OS === 'web'
                  ? {
                      zIndex: 100,
                      elevation: 100,
                    }
                  : {}),
              },
            }
          : {
              tabBarPosition: 'bottom' as const,
              tabBarButton: HapticTab,
              tabBarStyle: {
                position: 'absolute' as const,
                bottom: 22,
                left: 20,
                right: 20,
                height: 64,
                paddingBottom: 7,
                paddingTop: 7,
                borderRadius: 28,
                backgroundColor: 'transparent',
                borderTopWidth: 0,
                overflow: 'hidden' as const,
                elevation: 0,
              },
              tabBarBackground: () => <PillTabBarBackground />,
            }),

        tabBarLabelStyle: desktopWebSidebar
          ? {
              fontSize: 12,
              fontWeight: '600' as TextStyle['fontWeight'],
              marginTop: 4,
              letterSpacing: 0.15,
              maxWidth: 92,
            }
          : {
              fontSize: 10,
              fontWeight: '500' as TextStyle['fontWeight'],
              marginTop: 1,
              letterSpacing: -0.15,
            },

        tabBarItemStyle: desktopWebSidebar
          ? {
              paddingVertical: 6,
              paddingHorizontal: 4,
            }
          : {
              minWidth: 56,
              justifyContent: 'center' as ViewStyle['justifyContent'],
              paddingTop: 0,
              paddingBottom: 0,
            },

        tabBarActiveTintColor: TAB_NAV_ACTIVE,
        tabBarInactiveTintColor: tabInactiveColor,

        tabBarIcon: ({ focused }: { focused: boolean }) => {
          if (route.name === 'assistant') {
            return (
              <View style={styles.iconWrapper}>
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.09)', 'rgba(74, 222, 128, 0.11)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[
                    styles.assistantCircle,
                    aiManagerEnabled && styles.assistantCircleAIEnabled,
                  ]}
                >
                  <TabBarAssistantStar size={desktopWebSidebar ? 22 : 20} />
                  {aiManagerEnabled && (
                    <View style={styles.aiBadge}>
                      <Text style={styles.aiBadgeText}>AI</Text>
                    </View>
                  )}
                </LinearGradient>
                {hasAlerts && !focused && <View style={styles.alertDot} />}
              </View>
            );
          }

          const iconProps = { focused, darkMode, size: desktopWebSidebar ? 24 : 26 };
          let node: React.ReactNode = <TabBarDashboardIcon {...iconProps} />;
          if (route.name === 'projects') node = <TabBarProjectsIcon {...iconProps} />;
          if (route.name === 'estimate-generator') node = <TabBarEstimateIcon {...iconProps} />;
          if (route.name === 'leads') node = <TabBarLeadsIcon {...iconProps} />;

          return (
            <View style={styles.iconWrapper}>
              <TabIconSlot>{node}</TabIconSlot>
            </View>
          );
        },
      }),
    [PillTabBarBackground, aiManagerEnabled, darkMode, desktopWebSidebar, hasAlerts, sidebarBg, sidebarBorder, tabInactiveColor]
  );

  return (
    <>
      <ProfileCompletionReminder />
      <Tabs initialRouteName="dashboard" screenOptions={screenOptions}>
      <Tabs.Screen
        name="dashboard"
        options={{
          title: t('tabs.dashboard'),
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          title: t('tabs.projects'),
        }}
      />
      <Tabs.Screen
        name="assistant"
        options={{
          title: t('tabs.assistant'),
          tabBarActiveTintColor: ASSISTANT_LABEL_COLOR,
          tabBarInactiveTintColor: ASSISTANT_LABEL_COLOR,
        }}
      />
      <Tabs.Screen
        name="estimate-generator"
        options={{
          title: t('tabs.estimate'),
          href: canAccessEstimateAndLeads ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="leads"
        options={{
          title: t('tabs.leads'),
          href: canAccessEstimateAndLeads ? undefined : null,
        }}
      />
    </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  assistantCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 3,
    overflow: 'visible',
  },
  assistantCircleAIEnabled: {
    borderColor: 'rgba(74, 222, 128, 0.22)',
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
  alertDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F97316',
    marginTop: 4,
  },
});
