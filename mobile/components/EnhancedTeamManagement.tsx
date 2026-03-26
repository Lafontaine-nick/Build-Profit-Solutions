import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  FlatList,
  Image,
} from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role:
    | 'project-manager'
    | 'foreman'
    | 'contractor'
    | 'subcontractor'
    | 'inspector';
  avatar?: string;
  phone?: string;
  skills: string[];
  availability: 'available' | 'busy' | 'offline';
  currentTasks: number;
  maxTasks: number;
}

interface EnhancedTeamManagementProps {
  projectId: string;
  projectName: string;
  onTeamUpdate?: (team: TeamMember[]) => void;
}

export default function EnhancedTeamManagement({
  projectId,
  projectName,
  onTeamUpdate,
}: EnhancedTeamManagementProps) {
  const { darkMode } = useTheme();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  const theme = darkMode
    ? {
        background: '#1a1a1a',
        card: '#2d2d2d',
        text: '#fff',
        subtext: '#f3f4f6',
        accent: '#43cea2',
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
        accent: '#43cea2',
        border: '#e0e0e0',
        success: '#4CAF50',
        warning: '#FF9800',
        error: '#F44336',
      };

  useEffect(() => {
    loadTeamMembers();
  }, [projectId]);

  const loadTeamMembers = async () => {
    try {
      setLoading(true);
      // Mock team data for demo
      const team = mockTeamMembers;
      setTeamMembers(team);
      onTeamUpdate?.(team);
    } catch (error) {
      console.error('Error loading team members:', error);
      // Use mock data for demo
      setTeamMembers(mockTeamMembers);
    } finally {
      setLoading(false);
    }
  };

  const getRoleColor = (role: TeamMember['role']) => {
    const colors = {
      'project-manager': '#2196F3',
      foreman: '#FF9800',
      contractor: '#4CAF50',
      subcontractor: '#9C27B0',
      inspector: '#F44336',
    };
    return colors[role] || '#666';
  };

  const getAvailabilityColor = (availability: TeamMember['availability']) => {
    const colors = {
      available: '#4CAF50',
      busy: '#FF9800',
      offline: '#666',
    };
    return colors[availability] || '#666';
  };

  const renderTeamMember = ({ item }: { item: TeamMember }) => (
    <TouchableOpacity
      style={[
        styles.memberCard,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
      onPress={() => setSelectedMember(item)}
    >
      <View style={styles.memberHeader}>
        <View style={styles.memberInfo}>
          <View
            style={[
              styles.avatar,
              { backgroundColor: getRoleColor(item.role) },
            ]}
          >
            <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
          </View>
          <View style={styles.memberDetails}>
            <Text style={[styles.memberName, { color: theme.text }]}>
              {item.name}
            </Text>
            <Text style={[styles.memberRole, { color: theme.subtext }]}>
              {item.role.replace('-', ' ').toUpperCase()}
            </Text>
          </View>
        </View>
        <View style={styles.memberStatus}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: getAvailabilityColor(item.availability) },
            ]}
          />
          <Text style={[styles.statusText, { color: theme.subtext }]}>
            {item.availability}
          </Text>
        </View>
      </View>

      <View style={styles.memberStats}>
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: theme.subtext }]}>
            Tasks
          </Text>
          <Text style={[styles.statValue, { color: theme.text }]}>
            {item.currentTasks}/{item.maxTasks}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: theme.subtext }]}>
            Skills
          </Text>
          <Text style={[styles.statValue, { color: theme.text }]}>
            {item.skills.length}
          </Text>
        </View>
      </View>

      <View style={styles.skillsContainer}>
        {item.skills.slice(0, 3).map((skill, index) => (
          <View
            key={index}
            style={[styles.skillTag, { backgroundColor: theme.accent + '20' }]}
          >
            <Text style={[styles.skillText, { color: theme.accent }]}>
              {skill}
            </Text>
          </View>
        ))}
        {item.skills.length > 3 && (
          <Text style={[styles.moreSkills, { color: theme.subtext }]}>
            +{item.skills.length - 3} more
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderTeamStats = () => {
    const totalMembers = teamMembers.length;
    const availableMembers = teamMembers.filter(
      m => m.availability === 'available'
    ).length;
    const totalTasks = teamMembers.reduce((sum, m) => sum + m.currentTasks, 0);
    const maxTasks = teamMembers.reduce((sum, m) => sum + m.maxTasks, 0);

    return (
      <View
        style={[
          styles.statsContainer,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.statsTitle, { color: theme.text }]}>
          Team Overview
        </Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: theme.accent }]}>
              {totalMembers}
            </Text>
            <Text style={[styles.statLabel, { color: theme.subtext }]}>
              Total Members
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: theme.success }]}>
              {availableMembers}
            </Text>
            <Text style={[styles.statLabel, { color: theme.subtext }]}>
              Available
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: theme.warning }]}>
              {totalTasks}
            </Text>
            <Text style={[styles.statLabel, { color: theme.subtext }]}>
              Active Tasks
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: theme.text }]}>
              {Math.round((totalTasks / maxTasks) * 100)}%
            </Text>
            <Text style={[styles.statLabel, { color: theme.subtext }]}>
              Capacity
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.loadingText, { color: theme.text }]}>
          Loading team...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {renderTeamStats()}

        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>
            Team Members
          </Text>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: theme.accent }]}
            onPress={() => setShowAddMember(true)}
          >
            ➕<Text style={styles.addButtonText}>Add Member</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={teamMembers}
          renderItem={renderTeamMember}
          keyExtractor={item => item.id}
          scrollEnabled={false}
          contentContainerStyle={styles.membersList}
        />
      </ScrollView>

      {/* Add Member Modal */}
      <Modal
        visible={showAddMember}
        animationType='slide'
        presentationStyle='pageSheet'
      >
        <View
          style={[styles.modalContainer, { backgroundColor: theme.background }]}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Add Team Member
            </Text>
            <TouchableOpacity onPress={() => setShowAddMember(false)}>
              ✕
            </TouchableOpacity>
          </View>
          <Text style={[styles.modalSubtitle, { color: theme.subtext }]}>
            Add a new team member to {projectName}
          </Text>
          {/* Add member form would go here */}
        </View>
      </Modal>
    </View>
  );
}

// Mock data for demo
const mockTeamMembers: TeamMember[] = [
  {
    id: '1',
    name: 'John Smith',
    email: 'john@example.com',
    role: 'project-manager',
    phone: '+1 (555) 123-4567',
    skills: ['Project Management', 'Budget Planning', 'Team Leadership'],
    availability: 'available',
    currentTasks: 3,
    maxTasks: 5,
  },
  {
    id: '2',
    name: 'Mike Johnson',
    email: 'mike@example.com',
    role: 'foreman',
    phone: '+1 (555) 234-5678',
    skills: ['Construction', 'Safety Management', 'Equipment Operation'],
    availability: 'busy',
    currentTasks: 4,
    maxTasks: 6,
  },
  {
    id: '3',
    name: 'Sarah Chen',
    email: 'sarah@example.com',
    role: 'contractor',
    phone: '+1 (555) 345-6789',
    skills: ['Electrical Work', 'Code Compliance', 'Quality Control'],
    availability: 'available',
    currentTasks: 2,
    maxTasks: 4,
  },
  {
    id: '4',
    name: 'David Rodriguez',
    email: 'david@example.com',
    role: 'subcontractor',
    phone: '+1 (555) 456-7890',
    skills: ['Plumbing', 'HVAC', 'Maintenance'],
    availability: 'offline',
    currentTasks: 1,
    maxTasks: 3,
  },
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
  },
  statsContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(67, 206, 162, 0.1)',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  membersList: {
    gap: 12,
  },
  memberCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  memberHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  memberRole: {
    fontSize: 12,
    fontWeight: '500',
  },
  memberStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  memberStats: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  skillTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  skillText: {
    fontSize: 12,
    fontWeight: '500',
  },
  moreSkills: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  modalContainer: {
    flex: 1,
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 24,
  },
});
