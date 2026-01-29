import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import AIAssistantModal from '@/components/AIAssistantModal';
import { useProjectList } from '@/contexts/ProjectListContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import { useMemo } from 'react';

const getStyles = (Colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.bg,
  },
});

export default function AssistantScreen() {
  useRequireAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const { activeProjects, estimates } = useProjectList();
  const [showAIAssistant, setShowAIAssistant] = useState(false); // Start false to prevent flash
  const [isReady, setIsReady] = useState(false);

  // Auto-open modal when this tab is focused
  useFocusEffect(
    React.useCallback(() => {
      // Small delay to ensure smooth transition
      setIsReady(true);
      setTimeout(() => {
        setShowAIAssistant(true);
      }, 50);
    }, [])
  );

  // Build context for AI Assistant
  const context = React.useMemo(() => JSON.stringify({
    screen: "AI Assistant Tab",
    allProjects: [...activeProjects, ...estimates].map(p => ({
      id: p.id,
      title: p.title,
      customerName: (p as any).client || p.title,
      status: p.status,
      bidPrice: p.bidPrice || 0,
      estimatedCost: p.estimatedCost || 0,
      totalBudget: p.estimatedCost || p.bidPrice || 0,
    })),
  }), [activeProjects, estimates]);

  const handleClose = () => {
    // Close the modal first, then navigate to dashboard
    console.log('✅ Back button pressed in Assistant tab, navigating to dashboard');
    setShowAIAssistant(false);
    // Use replace to avoid going back to this tab when back is pressed
    setTimeout(() => {
      router.replace('/(tabs)/dashboard');
    }, 150);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: Colors.bg }]}>
      {!isReady && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#22c55e" />
        </View>
      )}
      <AIAssistantModal
        visible={showAIAssistant}
        onClose={handleClose}
        context={context}
      />
    </View>
  );
}
