import React, { useState, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, SafeAreaView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Modal } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import AIAssistantModal from './AIAssistantModal';
import * as Haptics from 'expo-haptics';

interface ProjectPMModalProps {
  visible: boolean;
  onClose: () => void;
  project: any; // Project data
  activeTab?: 'Overview' | 'Budget' | 'Timeline' | 'Team';
}

const ProjectPMModal: React.FC<ProjectPMModalProps> = ({
  visible,
  onClose,
  project,
  activeTab = 'Overview',
}) => {
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const darkMode = theme.bg === '#000000';
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);

  // Build project context for AI
  const projectContext = useMemo(() => {
    if (!project) return '';
    
    const context = {
      screen: 'Project Detail',
      projectName: project.title || project.name || 'Current Project',
      projectId: project.id,
      status: project.status,
      bidPrice: project.bidPrice || project.budgeted || 0,
      estimatedCost: project.estimatedCost || 0,
      actualCost: project.actualCost || project.spent || 0,
      margin: project.margin || 0,
      location: project.location || '',
      projectType: project.projectType || '',
      progress: project.overallProgressPct || project.progress || 0,
      activeTab: activeTab,
      buckets: project.buckets || [],
      milestones: project.milestones || [],
      expenses: project.expenses || [],
      changeOrders: project.changeOrders || [],
    };
    
    return JSON.stringify(context);
  }, [project, activeTab]);

  // Contextual quick questions based on active tab
  const quickQuestions = useMemo(() => {
    const baseQuestions = [
      {
        icon: 'analytics-outline' as const,
        question: 'Give me a project health check',
        category: 'general',
      },
      {
        icon: 'trending-up-outline' as const,
        question: 'What are the biggest risks?',
        category: 'general',
      },
      {
        icon: 'checkmark-circle-outline' as const,
        question: 'What should I focus on next?',
        category: 'general',
      },
    ];

    const tabSpecificQuestions: Record<string, Array<{ icon: keyof typeof Ionicons.glyphMap; question: string; category: string }>> = {
      Overview: [
        {
          icon: 'cash-outline',
          question: 'How is the budget performing?',
          category: 'budget',
        },
        {
          icon: 'calendar-outline',
          question: 'Is the timeline on track?',
          category: 'timeline',
        },
        {
          icon: 'people-outline',
          question: 'How is the team performing?',
          category: 'team',
        },
      ],
      Budget: [
        {
          icon: 'alert-circle-outline',
          question: 'Am I over budget anywhere?',
          category: 'budget',
        },
        {
          icon: 'trending-down-outline',
          question: 'Where can I save money?',
          category: 'budget',
        },
        {
          icon: 'receipt-outline',
          question: 'Review my expenses',
          category: 'budget',
        },
      ],
      Timeline: [
        {
          icon: 'time-outline',
          question: 'What milestones are at risk?',
          category: 'timeline',
        },
        {
          icon: 'calendar-outline',
          question: 'Is the project on schedule?',
          category: 'timeline',
        },
        {
          icon: 'flag-outline',
          question: 'What should I prioritize?',
          category: 'timeline',
        },
      ],
      Team: [
        {
          icon: 'people-outline',
          question: 'How is team productivity?',
          category: 'team',
        },
        {
          icon: 'chatbubbles-outline',
          question: 'Any communication issues?',
          category: 'team',
        },
      ],
    };

    return [...baseQuestions, ...(tabSpecificQuestions[activeTab] || [])];
  }, [activeTab]);

  const handleQuestionPress = (question: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedQuestion(question);
    setShowAIAssistant(true);
  };

  const handleCloseAIAssistant = () => {
    setShowAIAssistant(false);
    setSelectedQuestion(null);
  };

  const styles = useMemo(() => getStyles(Colors, darkMode), [Colors, darkMode]);

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        transparent={true}
        onRequestClose={onClose}
        statusBarTranslucent={true}
      >
        <View style={styles.overlay}>
          <Pressable 
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            activeOpacity={1}
          />
          <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <LinearGradient
                  colors={['#22c55e', '#22d3ee']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.iconContainer}
                >
                  <Ionicons name="sparkles" size={24} color="#020617" />
                </LinearGradient>
                <View style={styles.headerText}>
                  <Text style={styles.title}>Ask Your PM</Text>
                  <Text style={styles.subtitle}>
                    {project?.title || project?.name || 'This Project'}
                  </Text>
                </View>
              </View>
              <Pressable onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </Pressable>
            </View>

            {/* Quick Questions */}
            <ScrollView 
              style={styles.content} 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              <Text style={styles.sectionTitle}>Quick Questions</Text>
              <View style={styles.questionsGrid}>
                {quickQuestions.map((item, index) => (
                  <Pressable
                    key={index}
                    onPress={() => handleQuestionPress(item.question)}
                    style={styles.questionCard}
                  >
                    <LinearGradient
                      colors={darkMode 
                        ? ['rgba(34, 197, 94, 0.15)', 'rgba(34, 211, 238, 0.15)']
                        : ['rgba(34, 197, 94, 0.08)', 'rgba(34, 211, 238, 0.08)']
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.questionGradient}
                    >
                      <Ionicons 
                        name={item.icon} 
                        size={20} 
                        color={darkMode ? '#6ee7b7' : '#16a34a'} 
                        style={styles.questionIcon}
                      />
                      <Text style={styles.questionText}>{item.question}</Text>
                    </LinearGradient>
                  </Pressable>
                ))}
              </View>

              {/* Info Text */}
              <View style={styles.infoBox}>
                <Ionicons name="information-circle-outline" size={16} color={Colors.sub} />
                <Text style={styles.infoText}>
                  Your PM analyzes this project's data to give you contextual insights and recommendations.
                </Text>
              </View>
            </ScrollView>

            {/* Open Full Chat Button */}
            <View style={styles.footer}>
              <Pressable
                onPress={() => {
                  setShowAIAssistant(true);
                  setSelectedQuestion(null);
                }}
                style={styles.chatButton}
              >
                <LinearGradient
                  colors={['#22c55e', '#22d3ee']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.chatButtonGradient}
                >
                  <Ionicons name="chatbubbles" size={20} color="#020617" />
                  <Text style={styles.chatButtonText}>Open Full Chat</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* AI Assistant Modal with project context */}
      <AIAssistantModal
        visible={showAIAssistant}
        onClose={handleCloseAIAssistant}
        context={projectContext}
        initialQuestion={selectedQuestion || undefined}
        onAction={async (action) => {
          // Handle AI actions if needed
          console.log('AI Action:', action);
        }}
      />
    </>
  );
};

const getStyles = (Colors: any, darkMode: boolean) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: Colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingTop: 32,
    borderBottomWidth: 1,
    borderBottomColor: Colors.line,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.sub,
  },
  closeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 24,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 16,
  },
  questionsGrid: {
    gap: 12,
    marginBottom: 24,
  },
  questionCard: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  questionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.15)',
  },
  questionIcon: {
    marginRight: 12,
  },
  questionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: darkMode ? Colors.surface2 : 'rgba(0, 0, 0, 0.03)',
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: Colors.sub,
    marginLeft: 8,
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: Colors.line,
    backgroundColor: Colors.bg,
  },
  chatButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  chatButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  chatButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#020617',
    marginLeft: 8,
  },
});

export default ProjectPMModal;
