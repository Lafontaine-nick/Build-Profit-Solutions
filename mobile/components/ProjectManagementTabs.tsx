import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import ProjectBudgetTracker from './ProjectBudgetTracker';
import ProjectTimelineManager from './ProjectTimelineManager';
import { useProjectList } from '@/contexts/ProjectListContext';

interface Project {
  id: string;
  name: string;
  status: string;
  margin: number;
  location: string;
  missingLaborCost: boolean;
  progress?: number;
  lastUpdated?: string;
  priority?: 'low' | 'medium' | 'high';
  budget?: number;
  timeline?: {
    startDate: string;
    endDate: string;
    duration: number;
  };
}

interface ProjectManagementTabsProps {
  project: Project;
}

const ProjectManagementTabs: React.FC<ProjectManagementTabsProps> = ({
  project,
}) => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const { darkMode } = useTheme();
  const { updateProject } = useProjectList();

  const theme = darkMode
    ? {
        background: '#1a1a1a',
        card: '#2d2d2d',
        text: '#fff',
        subtext: '#ccc',
        accent: '#1976d2',
        border: '#404040',
        success: '#4CAF50',
        warning: '#FF9800',
        error: '#F44336',
      }
    : {
        background: '#f5f7fa',
        card: '#fff',
        text: '#222',
        subtext: '#555',
        accent: '#1976d2',
        border: '#e0e0e0',
        success: '#4CAF50',
        warning: '#FF9800',
        error: '#F44336',
      };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: 'dashboard' },
    { id: 'budget', label: 'Budget', icon: 'account-balance-wallet' },
    { id: 'timeline', label: 'Timeline', icon: 'schedule' },
    { id: 'tasks', label: 'Tasks', icon: 'assignment' },
    { id: 'files', label: 'Files', icon: 'folder' },
    { id: 'messages', label: 'Messages', icon: 'message' },
  ] as const;

  const renderTabContent = () => {
    switch (activeTab) {
      case 'budget':
        return (
          <ProjectBudgetTracker
            projectId={project.id}
            projectName={project.name}
            onBudgetUpdate={budget => {
              updateProject(project.id, {
                actualCost: budget.totalSpent,
              });
            }}
          />
        );
      case 'timeline':
        return (
          <ProjectTimelineManager
            projectId={project.id}
            projectName={project.name}
            onTimelineUpdate={phases => {
              console.log('Timeline updated:', phases);
            }}
          />
        );
      case 'tasks':
        return (
          <View
            style={[
              styles.overviewContainer,
              { backgroundColor: theme.background },
            ]}
          >
            <Text style={[styles.overviewTitle, { color: theme.text }]}>
              Tasks
            </Text>
            <Text style={[styles.overviewSubtitle, { color: theme.subtext }]}>
              Task management coming soon
            </Text>
          </View>
        );
      case 'files':
        return (
          <View
            style={[
              styles.overviewContainer,
              { backgroundColor: theme.background },
            ]}
          >
            <Text style={[styles.overviewTitle, { color: theme.text }]}>
              Files
            </Text>
            <Text style={[styles.overviewSubtitle, { color: theme.subtext }]}>
              File management coming soon
            </Text>
          </View>
        );
      case 'messages':
        return (
          <View
            style={[
              styles.overviewContainer,
              { backgroundColor: theme.background },
            ]}
          >
            <Text style={[styles.overviewTitle, { color: theme.text }]}>
              Messages
            </Text>
            <Text style={[styles.overviewSubtitle, { color: theme.subtext }]}>
              Messaging coming soon
            </Text>
          </View>
        );
      case 'overview':
      default:
        return (
          <View
            style={[
              styles.overviewContainer,
              { backgroundColor: theme.background },
            ]}
          >
            <View
              style={[styles.overviewCard, { backgroundColor: theme.card }]}
            >
              <Text style={[styles.overviewTitle, { color: theme.text }]}>
                Project Overview
              </Text>

              <View style={styles.overviewStats}>
                <View style={styles.statItem}>
                  <Text style={[styles.statLabel, { color: theme.subtext }]}>
                    Status
                  </Text>
                  <Text style={[styles.statValue, { color: theme.text }]}>
                    {project.status}
                  </Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statLabel, { color: theme.subtext }]}>
                    Progress
                  </Text>
                  <Text style={[styles.statValue, { color: theme.text }]}>
                    {project.progress || 0}%
                  </Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statLabel, { color: theme.subtext }]}>
                    Budget
                  </Text>
                  <Text style={[styles.statValue, { color: theme.text }]}>
                    $
                    {(project.budget
                      ? project.budget * 0.6
                      : 0
                    ).toLocaleString()}{' '}
                    / ${(project.budget || 0).toLocaleString()}
                  </Text>
                </View>
              </View>

              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${project.progress || 0}%`,
                      backgroundColor: theme.accent,
                    },
                  ]}
                />
              </View>
            </View>

            <View style={styles.quickActions}>
              <TouchableOpacity
                style={[
                  styles.quickActionButton,
                  { backgroundColor: theme.accent },
                ]}
                onPress={() => setActiveTab('budget')}
              >
                <MaterialIcons
                  name='account-balance-wallet'
                  size={24}
                  color='#fff'
                />
                <Text style={styles.quickActionText}>Track Budget</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.quickActionButton,
                  { backgroundColor: theme.accent },
                ]}
                onPress={() => setActiveTab('timeline')}
              >
                <MaterialIcons name='schedule' size={24} color='#fff' />
                <Text style={styles.quickActionText}>Manage Timeline</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabContainer}
      >
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.tab,
              activeTab === tab.id && { backgroundColor: theme.accent },
            ]}
            onPress={() => setActiveTab(tab.id)}
          >
            <MaterialIcons
              name={tab.icon as any}
              size={20}
              color={activeTab === tab.id ? '#fff' : theme.text}
            />
            <Text
              style={[
                styles.tabText,
                { color: activeTab === tab.id ? '#fff' : theme.text },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.content}>{renderTabContent()}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabContainer: {
    maxHeight: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 4,
    borderRadius: 8,
    minWidth: 100,
  },
  tabText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  overviewContainer: {
    flex: 1,
  },
  overviewCard: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  overviewTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  overviewSubtitle: {
    fontSize: 16,
    marginBottom: 8,
  },
  overviewStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 140,
    justifyContent: 'center',
  },
  quickActionText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
});

export default ProjectManagementTabs;
