import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { useRouter } from 'expo-router';

interface Project {
  id: string;
  title: string;
  location: string;
  status: 'Draft' | 'Submitted' | 'Won' | 'Lost' | 'In Progress';
  progress: number;
  value: number;
  margin: number;
  lastUpdated: string;
  budgeted: number;
  spent: number;
  startDate?: string;
  endDate?: string;
  team: { pm?: string; activeSubs?: number; crewCount?: number };
}

export default function ProjectsList() {
  const { darkMode } = useTheme();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('Last Updated');

  const theme = darkMode
    ? {
        background: ['#0b1c38', '#1B365D', '#43cea2'],
        text: '#f1f5f9',
        subtext: '#cbd5e1',
        card: '#1B365D',
        border: 'rgba(255, 255, 255, 0.1)',
        accent: '#43cea2',
      }
    : {
        background: ['#f5f7fa', '#c3cfe2', '#fff'],
        text: '#1e293b',
        subtext: '#64748b',
        card: '#ffffff',
        border: 'rgba(0, 0, 0, 0.1)',
        accent: '#43cea2',
      };

  const mockProjects: Project[] = [
    {
      id: '1',
      title: 'Main St Remodel',
      location: 'San Diego, CA',
      status: 'Draft',
      progress: 65,
      value: 45000,
      margin: 12,
      lastUpdated: '2024-01-15',
      budgeted: 45000,
      spent: 29250,
      startDate: '2024-01-01',
      endDate: '2024-03-15',
      team: { pm: 'John Smith', activeSubs: 2, crewCount: 8 },
    },
    {
      id: '2',
      title: 'Elm Ave New Build',
      location: 'Austin, TX',
      status: 'Submitted',
      progress: 85,
      value: 125000,
      margin: 18,
      lastUpdated: '2024-01-14',
      budgeted: 125000,
      spent: 106250,
      startDate: '2023-11-01',
      endDate: '2024-02-28',
      team: { pm: 'Mike Johnson', activeSubs: 4, crewCount: 12 },
    },
    {
      id: '3',
      title: 'Dental Done',
      location: 'Phoenix, AZ',
      status: 'Won',
      progress: 100,
      value: 120000,
      margin: 22,
      lastUpdated: '2024-01-12',
      budgeted: 120000,
      spent: 93600,
      startDate: '2023-10-01',
      endDate: '2024-01-15',
      team: { pm: 'Sarah Chen', activeSubs: 3, crewCount: 10 },
    },
  ];

  const getStatusColor = (status: Project['status']) => {
    switch (status) {
      case 'Draft':
        return '#ef4444';
      case 'Submitted':
        return '#f59e0b';
      case 'Won':
        return '#10b981';
      case 'Lost':
        return '#6b7280';
      case 'In Progress':
        return '#3b82f6';
      default:
        return '#6b7280';
    }
  };

  const getStatusIcon = (status: Project['status']) => {
    switch (status) {
      case 'Draft':
        return '⚠️';
      case 'Submitted':
        return '📤';
      case 'Won':
        return '✅';
      case 'Lost':
        return '❌';
      case 'In Progress':
        return '⏳';
      default:
        return '📋';
    }
  };

  const handleProjectPress = (project: Project) => {
    // Navigate to project detail page with project data
    router.push(`/project-detail/${project.id}`);
  };

  const filteredProjects = mockProjects.filter(project => {
    const matchesSearch =
      project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter =
      filter === 'all' || project.status.toLowerCase() === filter.toLowerCase();
    return matchesSearch && matchesFilter;
  });

  const totalValue = mockProjects.reduce(
    (sum, project) => sum + project.value,
    0
  );
  const wonProjects = mockProjects.filter(p => p.status === 'Won').length;
  const inProgressProjects = mockProjects.filter(
    p => p.status === 'In Progress'
  ).length;

  return (
    <LinearGradient
      colors={theme.background as [string, string, string]}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>Projects</Text>
          <TouchableOpacity style={styles.settingsButton}>
            <Text style={styles.settingsIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View
          style={[
            styles.searchContainer,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder='Search projects...'
            placeholderTextColor={theme.subtext}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Filters */}
        <View style={styles.filtersContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersScroll}
          >
            {['all', 'Draft', 'Submitted', 'Won', 'Lost'].map(filterOption => (
              <TouchableOpacity
                key={filterOption}
                style={[
                  styles.filterButton,
                  {
                    backgroundColor:
                      filter === filterOption ? theme.accent : 'transparent',
                    borderColor: theme.border,
                  },
                ]}
                onPress={() => setFilter(filterOption)}
              >
                <Text
                  style={[
                    styles.filterText,
                    { color: filter === filterOption ? '#fff' : theme.subtext },
                  ]}
                >
                  {filterOption}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Sort */}
        <View style={styles.sortContainer}>
          <Text style={[styles.sortLabel, { color: theme.subtext }]}>
            Sort by:
          </Text>
          <TouchableOpacity
            style={[styles.sortButton, { backgroundColor: theme.accent }]}
          >
            <Text style={styles.sortButtonText}>{sortBy}</Text>
            <Text style={styles.sortArrow}>▼</Text>
          </TouchableOpacity>
        </View>

        {/* Project Overview */}
        <View
          style={[
            styles.overviewCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.overviewTitle, { color: theme.text }]}>
            Project Overview
          </Text>
          <View style={styles.overviewStats}>
            <View style={styles.statItem}>
              <Text style={styles.statIcon}>📁</Text>
              <Text style={[styles.statNumber, { color: theme.text }]}>
                {mockProjects.length}
              </Text>
              <Text style={[styles.statLabel, { color: theme.subtext }]}>
                Total
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statIcon}>✅</Text>
              <Text style={[styles.statNumber, { color: theme.text }]}>
                {wonProjects}
              </Text>
              <Text style={[styles.statLabel, { color: theme.subtext }]}>
                Won
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statIcon}>⏳</Text>
              <Text style={[styles.statNumber, { color: theme.text }]}>
                {inProgressProjects}
              </Text>
              <Text style={[styles.statLabel, { color: theme.subtext }]}>
                In Progress
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statIcon}>💰</Text>
              <Text style={[styles.statNumber, { color: theme.text }]}>
                ${(totalValue / 1000).toFixed(0)}K
              </Text>
              <Text style={[styles.statLabel, { color: theme.subtext }]}>
                Total Value
              </Text>
            </View>
          </View>
        </View>

        {/* Project Cards */}
        <View style={styles.projectsList}>
          {filteredProjects.map(project => (
            <TouchableOpacity
              key={project.id}
              style={[
                styles.projectCard,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
              onPress={() => handleProjectPress(project)}
            >
              <View style={styles.projectHeader}>
                <View style={styles.projectInfo}>
                  <Text style={[styles.projectTitle, { color: theme.text }]}>
                    {project.title}
                  </Text>
                  <View style={styles.locationContainer}>
                    <Text style={styles.locationIcon}>📍</Text>
                    <Text
                      style={[styles.locationText, { color: theme.subtext }]}
                    >
                      {project.location}
                    </Text>
                  </View>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(project.status) },
                  ]}
                >
                  <Text style={styles.statusIcon}>
                    {getStatusIcon(project.status)}
                  </Text>
                  <Text style={styles.statusText}>{project.status}</Text>
                </View>
              </View>

              <View style={styles.progressContainer}>
                <View
                  style={[
                    styles.progressBar,
                    { backgroundColor: theme.border },
                  ]}
                >
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${project.progress}%`,
                        backgroundColor: theme.accent,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.progressText, { color: theme.subtext }]}>
                  {project.progress}%
                </Text>
              </View>

              <View style={styles.projectDetails}>
                <View style={styles.detailItem}>
                  <Text style={[styles.detailValue, { color: theme.text }]}>
                    ${project.value.toLocaleString()}
                  </Text>
                  <Text style={[styles.detailLabel, { color: theme.subtext }]}>
                    Value
                  </Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={[styles.detailValue, { color: theme.text }]}>
                    {project.margin}%
                  </Text>
                  <Text style={[styles.detailLabel, { color: theme.subtext }]}>
                    Margin
                  </Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={[styles.detailValue, { color: theme.subtext }]}>
                    {project.lastUpdated}
                  </Text>
                  <Text style={[styles.detailLabel, { color: theme.subtext }]}>
                    Updated
                  </Text>
                </View>
              </View>

              <View style={styles.projectFooter}>
                <Text style={[styles.footerText, { color: theme.subtext }]}>
                  Tap to view details
                </Text>
                <Text style={styles.arrowIcon}>→</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
  },
  settingsButton: {
    padding: 8,
  },
  settingsIcon: {
    fontSize: 24,
  },
  searchContainer: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  searchInput: {
    padding: 16,
    fontSize: 16,
  },
  filtersContainer: {
    marginBottom: 16,
  },
  filtersScroll: {
    paddingRight: 16,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  sortLabel: {
    fontSize: 14,
    marginRight: 8,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  sortButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  sortArrow: {
    color: '#fff',
    fontSize: 12,
  },
  overviewCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
  },
  overviewTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  overviewStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  projectsList: {
    gap: 16,
  },
  projectCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
  },
  projectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  projectInfo: {
    flex: 1,
  },
  projectTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  locationText: {
    fontSize: 14,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusIcon: {
    fontSize: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  progressBar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
  },
  projectDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  detailItem: {
    alignItems: 'center',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  detailLabel: {
    fontSize: 12,
  },
  projectFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  arrowIcon: {
    fontSize: 18,
    fontWeight: '600',
  },
});
