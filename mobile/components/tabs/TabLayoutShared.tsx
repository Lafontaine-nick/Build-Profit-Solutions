import { Tabs, usePathname, useRouter, type Href } from 'expo-router';
import React, { useMemo, useEffect, useRef, useSyncExternalStore, type ComponentType } from 'react';
import { View, StyleSheet, useWindowDimensions, Platform, type TextStyle, type ViewStyle } from 'react-native';
import { HapticTab, PillHapticTab } from '@/components/HapticTab';
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
import { isDesktopWebLayoutWidth, PHONE_CARD_GUTTER } from '@/constants/ScreenLayout';
import { useWorkspaceProjectPermissions } from '@/hooks/useWorkspaceProjectPermissions';
import { warmEstimateStoragePreload } from '@/utils/estimateSessionHydration';
import { isLeadsNetworkingReleased } from '@/constants/releaseFlags';
import { useBusinessEntitlement } from '@/hooks/useBusinessEntitlement';
import {
  isIosPaywallDevBypass,
  subscribeIosPaywallDevBypass,
} from '@/lib/iosSubscriptionGate';
import { useUser } from '@clerk/clerk-react';
import {
  addAppleCustomerInfoListener,
  configureAppleBilling,
  getAppleCustomerInfo,
  isAppleBillingAvailable,
} from '@/services/appleBillingService';
import { syncTrialReminder } from '@/services/trialReminder';

export type TabLayoutSharedProps = {
  PillTabBarBackground: ComponentType;
};

export default function TabLayoutShared({ PillTabBarBackground }: TabLayoutSharedProps) {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const desktopWebSidebar = isDesktopWebLayoutWidth(width);
  const { hasAlerts } = useAIManagerMode();
  const { t } = useTranslation();
  const { darkMode, theme } = useTheme();
  const tabInactiveColor = darkMode ? '#636366' : '#64748B';
  const sidebarBorder = darkMode ? 'rgba(148, 163, 184, 0.22)' : 'rgba(15, 23, 42, 0.12)';
  const sidebarBg = darkMode ? theme.bg : '#f8fafc';
  const { canAccessEstimateAndLeads } = useWorkspaceProjectPermissions();
  const showLeadsTab = canAccessEstimateAndLeads && isLeadsNetworkingReleased();
  const { hasFoundingFull, canUseBusinessWorkspace, initialized, loading } = useBusinessEntitlement();
  const devPaywallBypass = useSyncExternalStore(
    subscribeIosPaywallDevBypass,
    isIosPaywallDevBypass,
    () => false
  );
  const pathname = usePathname();
  const subscriptionRequired =
    Platform.OS === 'ios' &&
    initialized &&
    !loading &&
    !devPaywallBypass &&
    !hasFoundingFull &&
    !canUseBusinessWorkspace;

  useEffect(() => {
    if (!subscriptionRequired) return;
    if (pathname?.includes('/payment/plans') || pathname?.includes('/sample-tour')) return;
    router.replace('/payment/plans?required=1');
  }, [pathname, router, subscriptionRequired]);

  const { user: clerkUser } = useUser();
  const clerkUserId = clerkUser?.id ?? null;
  useEffect(() => {
    if (Platform.OS !== 'ios' || !clerkUserId || !isAppleBillingAvailable()) return;
    let listener: { remove: () => void } | null = null;
    let cancelled = false;
    void configureAppleBilling(clerkUserId)
      .then(() => getAppleCustomerInfo())
      .then((info) => {
        if (cancelled) return;
        void syncTrialReminder(info).catch(() => {});
        listener = addAppleCustomerInfoListener((next) => {
          void syncTrialReminder(next).catch(() => {});
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      listener?.remove();
    };
  }, [clerkUserId]);

  // Tabs are lazy, and iOS detaches the hidden one: the first visit builds the page on tap (a blank-frame shutter).
  // Mount each heavy tab once the Dashboard is idle. Retries cover a navigator that isn't ready yet.
  const prefetchedTabsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const prefetch = (href: Href, attempt = 0) => {
      if (cancelled) return;
      const key = String(href);
      if (prefetchedTabsRef.current.has(key)) return;
      try {
        router.prefetch(href);
        prefetchedTabsRef.current.add(key);
      } catch {
        if (attempt < 6) timers.push(setTimeout(() => prefetch(href, attempt + 1), 500));
      }
    };
    timers.push(setTimeout(() => prefetch('/(tabs)/projects'), 600));
    timers.push(setTimeout(() => prefetch('/(tabs)/assistant'), 4200));
    if (canAccessEstimateAndLeads) {
      timers.push(
        setTimeout(() => {
          void import('@/app/(tabs)/estimate-generator')
            .catch(() => undefined)
            .then(() => prefetch('/(tabs)/estimate-generator'));
        }, 1600)
      );
    }
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [canAccessEstimateAndLeads, router]);

  // Warm estimate AsyncStorage cache as soon as tabs mount so the preloaded screen hydrates before the first tap.
  useEffect(() => {
    void warmEstimateStoragePreload();
  }, []);

  const screenOptions = useMemo(
    () =>
      ({ route }: { route: { name: string } }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        sceneStyle: { backgroundColor: sidebarBg },
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
              tabBarButton: PillHapticTab,
              tabBarStyle: {
                position: 'absolute' as const,
                bottom: 22,
                left: 20,
                right: 20,
                /** BottomTabBar's base style sets start/end: 0, which win over left/right. */
                ...(Platform.OS !== 'web' ? { start: PHONE_CARD_GUTTER, end: PHONE_CARD_GUTTER } : {}),
                height: 64,
                paddingBottom: 7,
                paddingTop: 7,
                borderRadius: 28,
                backgroundColor: 'transparent',
                borderTopWidth: 0,
                overflow: 'hidden' as const,
                elevation: 40,
                zIndex: 50,
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
            const starSize = desktopWebSidebar ? 22 : 22;
            return (
              <View style={styles.iconWrapper}>
                <TabIconSlot>
                  <TabBarAssistantStar
                    size={starSize}
                    color={focused ? TAB_NAV_ACTIVE : tabInactiveColor}
                  />
                </TabIconSlot>
                {hasAlerts && !focused ? (
                  <View style={styles.assistantAlertDot} />
                ) : null}
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
    [PillTabBarBackground, darkMode, desktopWebSidebar, hasAlerts, sidebarBg, sidebarBorder, tabInactiveColor]
  );

  if (Platform.OS === 'ios' && (!initialized || loading || subscriptionRequired)) {
    return <View style={{ flex: 1, backgroundColor: theme.bg }} />;
  }

  return (
    <>
      <Tabs
        initialRouteName="dashboard"
        // iOS/Android detach a hidden tab, so the first visit flashes a blank frame while it reattaches.
        detachInactiveScreens={Platform.OS === 'web'}
        screenOptions={screenOptions}
      >
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
        name="estimate-generator"
        options={{
          title: t('tabs.estimate'),
          href: canAccessEstimateAndLeads ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="assistant"
        options={{
          title: t('tabs.assistant'),
        }}
      />
      <Tabs.Screen
        name="leads"
        options={{
          title: t('tabs.leads'),
          href: showLeadsTab ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="project-detail"
        options={{
          href: null,
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
  assistantAlertDot: {
    position: 'absolute',
    top: 0,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fbbf24',
    borderWidth: 1.5,
    borderColor: 'rgba(12, 12, 14, 0.9)',
  },
});
