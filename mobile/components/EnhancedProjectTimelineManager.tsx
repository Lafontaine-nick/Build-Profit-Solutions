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
  Dimensions,
  FlatList,
  Image,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';

// Enhanced Services
import {
  teamCollaborationService,
  TeamMember,
  TaskNotification,
} from '../services/teamCollaboration';
import { photoManagementService, TaskPhoto } from '../services/photoManagement';
import {
  progressReportingService,
  ProgressReport,
} from '../services/progressReporting';
import { apiService } from '../services/api';

const { width } = Dimensions.get('window');

// Enhanced Interfaces
interface EnhancedProjectTask {
  id: string;
  name: string;
  description: string;
  assignedTeam: TeamMember[]; // 👥 Team assignments
  startDate: string;
  dueDate: string;
  status: 'pending' | 'in-progress' | 'completed' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedHours: number;
  actualHours: number;
  progress: number;
  photos: TaskPhoto[]; // 📸 Photo uploads
  comments: TaskComment[]; // 💬 Team collaboration
  notifications: TaskNotification[]; // 🔔 Push notifications
  lastUpdated: string;
  delays: TaskDelay[]; // ⚠️ Timeline delays
  dependencies: string[];
  subtasks: SubTask[];
}

interface TaskComment {
  id: string;
  text: string;
  author: TeamMember;
  timestamp: string;
  mentions: string[];
  attachments?: TaskPhoto[];
}

interface TaskDelay {
  id: string;
  reason: string;
  daysDelayed: number;
  reportedBy: string;
  timestamp: string;
  resolved: boolean;
}

interface SubTask {
  id: string;
  name: string;
  completed: boolean;
  assignedTo: string;
}

interface EnhancedProjectPhase {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  duration: number;
  progress: number;
  status: 'not-started' | 'in-progress' | 'completed' | 'delayed';
  dependencies: string[];
  budget: number;
  spent: number;
  tasks: EnhancedProjectTask[];
  milestones: ProjectMilestone[];
  teamMembers: TeamMember[];
}

interface ProjectMilestone {
  id: string;
  name: string;
  description: string;
  targetDate: string;
  status: 'pending' | 'completed' | 'overdue';
  importance: 'low' | 'medium' | 'high';
}

interface EnhancedProjectTimelineManagerProps {
  projectId: string;
  projectName: string;
  onTimelineUpdate?: (phases: EnhancedProjectPhase[]) => void;
}

export default function EnhancedProjectTimelineManager({
  projectId,
  projectName,
  onTimelineUpdate,
}: EnhancedProjectTimelineManagerProps) {
  const { darkMode } = useTheme();
  const [phases, setPhases] = useState<EnhancedProjectPhase[]>([]);
  const [selectedPhase, setSelectedPhase] =
    useState<EnhancedProjectPhase | null>(null);
  const [selectedTask, setSelectedTask] = useState<EnhancedProjectTask | null>(
    null
  );
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [progressReport, setProgressReport] = useState<ProgressReport | null>(
    null
  );

  // Modal states
  const [phaseModal, setPhaseModal] = useState(false);
  const [taskModal, setTaskModal] = useState(false);
  const [teamModal, setTeamModal] = useState(false);
  const [photoModal, setPhotoModal] = useState(false);
  const [reportModal, setReportModal] = useState(false);
  const [commentModal, setCommentModal] = useState(false);

  const theme = darkMode
    ? {
        background: '#0b1c38',
        card: '#1a2a4a',
        text: '#ffffff',
        textSecondary: '#b0c4de',
        border: '#2a3a5a',
        success: '#4caf50',
        warning: '#ff9800',
        error: '#f44336',
        primary: '#2196f3',
      }
    : {
        background: '#f8f9fa',
        card: '#ffffff',
        text: '#212529',
        textSecondary: '#6c757d',
        border: '#dee2e6',
        success: '#28a745',
        warning: '#ffc107',
        error: '#dc3545',
        primary: '#007bff',
      };

  useEffect(() => {
    loadProjectData();
    loadTeamMembers();
  }, [projectId]);

  const loadProjectData = async () => {
    try {
      // Load phases and tasks from API
      const response = await apiService.getProjectTimeline(projectId);
      setPhases(response.data || []);
    } catch (error) {
      console.error('Error loading project data:', error);
      // Load mock data for development
      loadMockData();
    }
  };

  const loadTeamMembers = async () => {
    try {
      const members = await teamCollaborationService.getProjectTeam(projectId);
      setTeamMembers(members);
    } catch (error) {
      console.error('Error loading team members:', error);
      // Load mock data
      const mockMembers =
        await teamCollaborationService.loadMockTeamData(projectId);
      setTeamMembers(mockMembers);
    }
  };

  const generateProgressReport = async () => {
    try {
      const report =
        await progressReportingService.generateDailyReport(projectId);
      setProgressReport(report);
      setReportModal(true);
    } catch (error) {
      console.error('Error generating progress report:', error);
      Alert.alert('Error', 'Failed to generate progress report');
    }
  };

  const assignTeamToTask = async (taskId: string, members: TeamMember[]) => {
    try {
      await teamCollaborationService.assignTeamToTask(taskId, members);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Team members assigned successfully');
      loadProjectData(); // Refresh data
    } catch (error) {
      console.error('Error assigning team to task:', error);
      Alert.alert('Error', 'Failed to assign team members');
    }
  };

  const captureTaskPhoto = async (taskId: string, type: TaskPhoto['type']) => {
    try {
      const photo = await photoManagementService.captureTaskPhoto(taskId, type);
      if (photo) {
        await photoManagementService.uploadTaskPhoto(taskId, photo);
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );
        Alert.alert('Success', 'Photo uploaded successfully');
        loadProjectData(); // Refresh data
      }
    } catch (error) {
      console.error('Error capturing task photo:', error);
      Alert.alert('Error', 'Failed to capture photo');
    }
  };

  const updateTaskProgress = async (taskId: string, progress: number) => {
    try {
      await teamCollaborationService.updateTaskProgress(
        taskId,
        progress,
        'current-user-id'
      );
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      loadProjectData(); // Refresh data
    } catch (error) {
      console.error('Error updating task progress:', error);
      Alert.alert('Error', 'Failed to update task progress');
    }
  };

  const loadMockData = () => {
    const mockPhases: EnhancedProjectPhase[] = [
      {
        id: '1',
        name: 'Foundation',
        description: 'Foundation and site preparation',
        startDate: '2024-01-01',
        endDate: '2024-01-15',
        duration: 14,
        progress: 100,
        status: 'completed',
        dependencies: [],
        budget: 50000,
        spent: 48000,
        teamMembers: [],
        tasks: [
          {
            id: '1',
            name: 'Excavation',
            description: 'Site excavation and preparation',
            assignedTeam: [],
            startDate: '2024-01-01',
            dueDate: '2024-01-05',
            status: 'completed',
            priority: 'high',
            estimatedHours: 40,
            actualHours: 38,
            progress: 100,
            photos: [],
            comments: [],
            notifications: [],
            lastUpdated: '2024-01-05T10:00:00Z',
            delays: [],
            dependencies: [],
            subtasks: [],
          },
        ],
        milestones: [],
      },
    ];
    setPhases(mockPhases);
  };

  const renderEnhancedTaskCard = (task: EnhancedProjectTask) => (
    <View
      key={task.id}
      style={[styles.taskCard, { backgroundColor: theme.card }]}
    >
      <View style={styles.taskHeader}>
        <Text style={[styles.taskName, { color: theme.text }]}>
          {task.name}
        </Text>
        <View style={styles.taskStatus}>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(task.status) },
            ]}
          >
            <Text style={styles.statusText}>{task.status}</Text>
          </View>
        </View>
      </View>

      <Text style={[styles.taskDescription, { color: theme.textSecondary }]}>
        {task.description}
      </Text>

      {/* Team Members */}
      <View style={styles.teamSection}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          👥 Team
        </Text>
        <View style={styles.teamAvatars}>
          {task.assignedTeam.map(member => (
            <View key={member.id} style={styles.avatar}>
              <Text style={styles.avatarText}>{member.name.charAt(0)}</Text>
            </View>
          ))}
          <TouchableOpacity
            style={[styles.addMemberButton, { backgroundColor: theme.primary }]}
            onPress={() => {
              setSelectedTask(task);
              setTeamModal(true);
            }}
          >
            <MaterialIcons name='add' size={16} color='#fff' />
          </TouchableOpacity>
        </View>
      </View>

      {/* Progress */}
      <View style={styles.progressSection}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          📊 Progress
        </Text>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${task.progress}%`, backgroundColor: theme.primary },
            ]}
          />
        </View>
        <Text style={[styles.progressText, { color: theme.textSecondary }]}>
          {task.progress}% Complete
        </Text>
      </View>

      {/* Photos */}
      <View style={styles.photosSection}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          📸 Photos ({task.photos.length})
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {task.photos.map(photo => (
            <TouchableOpacity key={photo.id} style={styles.photoThumbnail}>
              <Image source={{ uri: photo.url }} style={styles.photoImage} />
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.addPhotoButton, { backgroundColor: theme.primary }]}
            onPress={() => {
              setSelectedTask(task);
              setPhotoModal(true);
            }}
          >
            <MaterialIcons name='add-a-photo' size={20} color='#fff' />
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Actions */}
      <View style={styles.taskActions}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.success }]}
          onPress={() =>
            updateTaskProgress(task.id, Math.min(task.progress + 10, 100))
          }
        >
          <MaterialIcons name='trending-up' size={16} color='#fff' />
          <Text style={styles.actionText}>Update Progress</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.primary }]}
          onPress={() => {
            setSelectedTask(task);
            setCommentModal(true);
          }}
        >
          <MaterialIcons name='comment' size={16} color='#fff' />
          <Text style={styles.actionText}>Comment</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderTeamAssignmentModal = () => (
    <Modal visible={teamModal} animationType='slide' transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
          <Text style={[styles.modalTitle, { color: theme.text }]}>
            Assign Team Members
          </Text>

          <FlatList
            data={teamMembers}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.teamMemberItem,
                  { borderBottomColor: theme.border },
                ]}
                onPress={() => {
                  if (selectedTask) {
                    assignTeamToTask(selectedTask.id, [item]);
                    setTeamModal(false);
                  }
                }}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={[styles.memberName, { color: theme.text }]}>
                    {item.name}
                  </Text>
                  <Text
                    style={[styles.memberRole, { color: theme.textSecondary }]}
                  >
                    {item.role}
                  </Text>
                </View>
                <MaterialIcons name='add' size={24} color={theme.primary} />
              </TouchableOpacity>
            )}
          />

          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: theme.error }]}
            onPress={() => setTeamModal(false)}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const renderProgressReportModal = () => (
    <Modal visible={reportModal} animationType='slide' transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
          <Text style={[styles.modalTitle, { color: theme.text }]}>
            Daily Progress Report
          </Text>

          {progressReport && (
            <ScrollView>
              <View style={styles.reportSection}>
                <Text style={[styles.reportTitle, { color: theme.text }]}>
                  Summary
                </Text>
                <Text
                  style={[styles.reportText, { color: theme.textSecondary }]}
                >
                  Overall Progress: {progressReport.summary.overallProgress}%
                </Text>
                <Text
                  style={[styles.reportText, { color: theme.textSecondary }]}
                >
                  Completed Tasks: {progressReport.summary.completedTasks}/
                  {progressReport.summary.totalTasks}
                </Text>
                <Text
                  style={[styles.reportText, { color: theme.textSecondary }]}
                >
                  Delayed Tasks: {progressReport.summary.delayedTasks}
                </Text>
              </View>

              {progressReport.delays.length > 0 && (
                <View style={styles.reportSection}>
                  <Text style={[styles.reportTitle, { color: theme.error }]}>
                    ⚠️ Delays
                  </Text>
                  {progressReport.delays.map(delay => (
                    <Text
                      key={delay.id}
                      style={[
                        styles.reportText,
                        { color: theme.textSecondary },
                      ]}
                    >
                      {delay.taskName}: {delay.reason}
                    </Text>
                  ))}
                </View>
              )}

              <View style={styles.reportSection}>
                <Text style={[styles.reportTitle, { color: theme.text }]}>
                  Next Actions
                </Text>
                {progressReport.nextActions.map((action, index) => (
                  <Text
                    key={index}
                    style={[styles.reportText, { color: theme.textSecondary }]}
                  >
                    • {action}
                  </Text>
                ))}
              </View>
            </ScrollView>
          )}

          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: theme.primary }]}
            onPress={() => setReportModal(false)}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const getStatusColor = (status: string) => {
    const colors = {
      pending: '#757575',
      'in-progress': '#2196f3',
      completed: '#4caf50',
      blocked: '#f44336',
      delayed: '#ff9800',
    };
    return colors[status] || '#757575';
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={[theme.primary, theme.primary + '80']}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>{projectName} Timeline</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={generateProgressReport}
          >
            <MaterialIcons name='assessment' size={20} color='#fff' />
            <Text style={styles.headerButtonText}>Progress Report</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setPhaseModal(true)}
          >
            <MaterialIcons name='add' size={20} color='#fff' />
            <Text style={styles.headerButtonText}>Add Phase</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content}>
        {phases.map(phase => (
          <View
            key={phase.id}
            style={[styles.phaseCard, { backgroundColor: theme.card }]}
          >
            <View style={styles.phaseHeader}>
              <Text style={[styles.phaseName, { color: theme.text }]}>
                {phase.name}
              </Text>
              <View
                style={[
                  styles.phaseStatus,
                  { backgroundColor: getStatusColor(phase.status) },
                ]}
              >
                <Text style={styles.phaseStatusText}>{phase.status}</Text>
              </View>
            </View>

            <Text
              style={[styles.phaseDescription, { color: theme.textSecondary }]}
            >
              {phase.description}
            </Text>

            <View style={styles.phaseProgress}>
              <Text style={[styles.progressLabel, { color: theme.text }]}>
                Progress: {phase.progress}%
              </Text>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${phase.progress}%`,
                      backgroundColor: theme.primary,
                    },
                  ]}
                />
              </View>
            </View>

            <View style={styles.tasksContainer}>
              {phase.tasks.map(renderEnhancedTaskCard)}
            </View>
          </View>
        ))}
      </ScrollView>

      {renderTeamAssignmentModal()}
      {renderProgressReportModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 40,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  headerButtonText: {
    color: '#fff',
    marginLeft: 5,
    fontSize: 12,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  phaseCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  phaseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  phaseName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  phaseStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  phaseStatusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  phaseDescription: {
    fontSize: 14,
    marginBottom: 12,
  },
  phaseProgress: {
    marginBottom: 16,
  },
  progressLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  tasksContainer: {
    gap: 12,
  },
  taskCard: {
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  taskName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  taskStatus: {
    marginLeft: 8,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  taskDescription: {
    fontSize: 14,
    marginBottom: 12,
  },
  teamSection: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  teamAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2196f3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  avatarText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  addMemberButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressSection: {
    marginBottom: 12,
  },
  progressText: {
    fontSize: 12,
    marginTop: 4,
  },
  photosSection: {
    marginBottom: 12,
  },
  photoThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 8,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  addPhotoButton: {
    width: 60,
    height: 60,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  taskActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginHorizontal: 4,
  },
  actionText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: width * 0.9,
    maxHeight: '80%',
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  teamMemberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
  },
  memberRole: {
    fontSize: 14,
  },
  closeButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  reportSection: {
    marginBottom: 16,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  reportText: {
    fontSize: 14,
    marginBottom: 4,
  },
});
