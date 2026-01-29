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
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

interface ProjectPhase {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  duration: number; // in days
  progress: number; // 0-100
  status: 'not-started' | 'in-progress' | 'completed' | 'delayed';
  dependencies: string[]; // phase IDs that must complete first
  budget: number;
  spent: number;
  tasks: ProjectTask[];
  milestones: ProjectMilestone[];
}

interface ProjectTask {
  id: string;
  name: string;
  description: string;
  assignedTo: string;
  startDate: string;
  dueDate: string;
  status: 'pending' | 'in-progress' | 'completed' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedHours: number;
  actualHours: number;
  progress: number;
}

interface ProjectMilestone {
  id: string;
  name: string;
  description: string;
  targetDate: string;
  status: 'pending' | 'completed' | 'overdue';
  importance: 'low' | 'medium' | 'high';
}

interface ProjectTimelineManagerProps {
  projectId: string;
  projectName: string;
  onTimelineUpdate?: (phases: ProjectPhase[]) => void;
}

const STATUS_COLORS = {
  'not-started': '#9E9E9E',
  'in-progress': '#2196F3',
  completed: '#4CAF50',
  delayed: '#F44336',
  pending: '#FF9800',
  blocked: '#F44336',
};

const PRIORITY_COLORS = {
  low: '#4CAF50',
  medium: '#FF9800',
  high: '#F44336',
  critical: '#9C27B0',
};

export default function ProjectTimelineManager({
  projectId,
  projectName,
  onTimelineUpdate,
}: ProjectTimelineManagerProps) {
  const { darkMode } = useTheme();
  const [phases, setPhases] = useState<ProjectPhase[]>([]);
  const [selectedPhase, setSelectedPhase] = useState<ProjectPhase | null>(null);
  const [phaseModal, setPhaseModal] = useState(false);
  const [taskModal, setTaskModal] = useState(false);
  const [milestoneModal, setMilestoneModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [newPhase, setNewPhase] = useState<Partial<ProjectPhase>>({
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    duration: 0,
    progress: 0,
    status: 'not-started',
    dependencies: [],
    budget: 0,
    spent: 0,
    tasks: [],
    milestones: [],
  });
  const [newTask, setNewTask] = useState<Partial<ProjectTask>>({
    name: '',
    description: '',
    assignedTo: '',
    startDate: '',
    dueDate: '',
    status: 'pending',
    priority: 'medium',
    estimatedHours: 0,
    actualHours: 0,
    progress: 0,
  });
  const [newMilestone, setNewMilestone] = useState<Partial<ProjectMilestone>>({
    name: '',
    description: '',
    targetDate: '',
    status: 'pending',
    importance: 'medium',
  });

  const theme = darkMode
    ? {
        background: '#0b1c38',
        card: '#1B365D',
        text: '#fff',
        subtext: '#aaa',
        accent: '#43cea2',
        border: '#2a4a7a',
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

  // Mock data - replace with API calls
  useEffect(() => {
    const mockPhases: ProjectPhase[] = [
      {
        id: '1',
        name: 'Planning & Design',
        description: 'Initial planning, permits, and design work',
        startDate: '2024-01-01',
        endDate: '2024-01-15',
        duration: 15,
        progress: 100,
        status: 'completed',
        dependencies: [],
        budget: 10000,
        spent: 9500,
        tasks: [
          {
            id: '1-1',
            name: 'Obtain Building Permits',
            description: 'Submit and obtain all necessary permits',
            assignedTo: 'Project Manager',
            startDate: '2024-01-01',
            dueDate: '2024-01-05',
            status: 'completed',
            priority: 'high',
            estimatedHours: 16,
            actualHours: 18,
            progress: 100,
          },
          {
            id: '1-2',
            name: 'Finalize Design Plans',
            description: 'Complete architectural and engineering plans',
            assignedTo: 'Architect',
            startDate: '2024-01-06',
            dueDate: '2024-01-15',
            status: 'completed',
            priority: 'high',
            estimatedHours: 40,
            actualHours: 42,
            progress: 100,
          },
        ],
        milestones: [
          {
            id: '1-1',
            name: 'Permits Approved',
            description: 'All building permits obtained',
            targetDate: '2024-01-05',
            status: 'completed',
            importance: 'high',
          },
        ],
      },
      {
        id: '2',
        name: 'Foundation & Site Prep',
        description: 'Site preparation and foundation work',
        startDate: '2024-01-16',
        endDate: '2024-02-15',
        duration: 30,
        progress: 85,
        status: 'in-progress',
        dependencies: ['1'],
        budget: 25000,
        spent: 21000,
        tasks: [
          {
            id: '2-1',
            name: 'Excavation',
            description: 'Excavate foundation area',
            assignedTo: 'Excavation Crew',
            startDate: '2024-01-16',
            dueDate: '2024-01-25',
            status: 'completed',
            priority: 'high',
            estimatedHours: 40,
            actualHours: 38,
            progress: 100,
          },
          {
            id: '2-2',
            name: 'Foundation Pour',
            description: 'Pour concrete foundation',
            assignedTo: 'Concrete Crew',
            startDate: '2024-01-26',
            dueDate: '2024-02-05',
            status: 'in-progress',
            priority: 'critical',
            estimatedHours: 32,
            actualHours: 20,
            progress: 65,
          },
        ],
        milestones: [
          {
            id: '2-1',
            name: 'Foundation Complete',
            description: 'Foundation poured and cured',
            targetDate: '2024-02-05',
            status: 'pending',
            importance: 'high',
          },
        ],
      },
      {
        id: '3',
        name: 'Framing & Structure',
        description: 'Structural framing and roofing',
        startDate: '2024-02-16',
        endDate: '2024-03-31',
        duration: 44,
        progress: 0,
        status: 'not-started',
        dependencies: ['2'],
        budget: 50000,
        spent: 0,
        tasks: [],
        milestones: [
          {
            id: '3-1',
            name: 'Framing Complete',
            description: 'All structural framing finished',
            targetDate: '2024-03-15',
            status: 'pending',
            importance: 'high',
          },
          {
            id: '3-2',
            name: 'Roofing Complete',
            description: 'Roofing and weatherproofing finished',
            targetDate: '2024-03-31',
            status: 'pending',
            importance: 'high',
          },
        ],
      },
      {
        id: '4',
        name: 'Interior & Finishing',
        description: 'Interior work, electrical, plumbing, and finishing',
        startDate: '2024-04-01',
        endDate: '2024-05-31',
        duration: 61,
        progress: 0,
        status: 'not-started',
        dependencies: ['3'],
        budget: 40000,
        spent: 0,
        tasks: [],
        milestones: [
          {
            id: '4-1',
            name: 'Rough-in Complete',
            description: 'Electrical and plumbing rough-in finished',
            targetDate: '2024-04-30',
            status: 'pending',
            importance: 'medium',
          },
          {
            id: '4-2',
            name: 'Final Inspection',
            description: 'Final building inspection passed',
            targetDate: '2024-05-31',
            status: 'pending',
            importance: 'high',
          },
        ],
      },
    ];
    setPhases(mockPhases);
  }, [projectId]);

  const addPhase = () => {
    if (!newPhase.name || !newPhase.startDate || !newPhase.endDate) {
      Alert.alert('Error', 'Please fill in required fields');
      return;
    }

    const phase: ProjectPhase = {
      id: Date.now().toString(),
      name: newPhase.name!,
      description: newPhase.description || '',
      startDate: newPhase.startDate!,
      endDate: newPhase.endDate!,
      duration: newPhase.duration || 0,
      progress: newPhase.progress || 0,
      status: newPhase.status || 'not-started',
      dependencies: newPhase.dependencies || [],
      budget: newPhase.budget || 0,
      spent: newPhase.spent || 0,
      tasks: newPhase.tasks || [],
      milestones: newPhase.milestones || [],
    };

    setPhases([...phases, phase]);
    onTimelineUpdate?.([...phases, phase]);
    setPhaseModal(false);
    setNewPhase({
      name: '',
      description: '',
      startDate: '',
      endDate: '',
      duration: 0,
      progress: 0,
      status: 'not-started',
      dependencies: [],
      budget: 0,
      spent: 0,
      tasks: [],
      milestones: [],
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const addTask = () => {
    if (!newTask.name || !selectedPhase) {
      Alert.alert('Error', 'Please fill in required fields');
      return;
    }

    const task: ProjectTask = {
      id: Date.now().toString(),
      name: newTask.name!,
      description: newTask.description || '',
      assignedTo: newTask.assignedTo || '',
      startDate: newTask.startDate || '',
      dueDate: newTask.dueDate || '',
      status: newTask.status || 'pending',
      priority: newTask.priority || 'medium',
      estimatedHours: newTask.estimatedHours || 0,
      actualHours: newTask.actualHours || 0,
      progress: newTask.progress || 0,
    };

    const updatedPhases = phases.map(phase => {
      if (phase.id === selectedPhase.id) {
        return {
          ...phase,
          tasks: [...phase.tasks, task],
        };
      }
      return phase;
    });

    setPhases(updatedPhases);
    onTimelineUpdate?.(updatedPhases);
    setTaskModal(false);
    setNewTask({
      name: '',
      description: '',
      assignedTo: '',
      startDate: '',
      dueDate: '',
      status: 'pending',
      priority: 'medium',
      estimatedHours: 0,
      actualHours: 0,
      progress: 0,
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const addMilestone = () => {
    if (!newMilestone.name || !selectedPhase) {
      Alert.alert('Error', 'Please fill in required fields');
      return;
    }

    const milestone: ProjectMilestone = {
      id: Date.now().toString(),
      name: newMilestone.name!,
      description: newMilestone.description || '',
      targetDate: newMilestone.targetDate || '',
      status: newMilestone.status || 'pending',
      importance: newMilestone.importance || 'medium',
    };

    const updatedPhases = phases.map(phase => {
      if (phase.id === selectedPhase.id) {
        return {
          ...phase,
          milestones: [...phase.milestones, milestone],
        };
      }
      return phase;
    });

    setPhases(updatedPhases);
    onTimelineUpdate?.(updatedPhases);
    setMilestoneModal(false);
    setNewMilestone({
      name: '',
      description: '',
      targetDate: '',
      status: 'pending',
      importance: 'medium',
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const updatePhaseProgress = (phaseId: string, progress: number) => {
    const updatedPhases = phases.map(phase => {
      if (phase.id === phaseId) {
        const newStatus =
          progress === 100
            ? 'completed'
            : progress > 0
              ? 'in-progress'
              : 'not-started';
        return {
          ...phase,
          progress,
          status: newStatus as "not-started" | "in-progress" | "completed" | "delayed",
        };
      }
      return phase;
    });

    setPhases(updatedPhases);
    onTimelineUpdate?.(updatedPhases);
  };

  const renderPhaseCard = (phase: ProjectPhase) => {
    const isOverdue =
      new Date(phase.endDate) < new Date() && phase.status !== 'completed';
    const statusColor = isOverdue
      ? STATUS_COLORS.delayed
      : STATUS_COLORS[phase.status];

    return (
      <TouchableOpacity
        key={phase.id}
        style={[
          styles.phaseCard,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
        onPress={() => {
          setSelectedPhase(phase);
          setEditMode(true);
        }}
      >
        <View style={styles.phaseHeader}>
          <View style={styles.phaseInfo}>
            <View
              style={[styles.statusIndicator, { backgroundColor: statusColor }]}
            />
            <Text style={[styles.phaseName, { color: theme.text }]}>
              {phase.name}
            </Text>
          </View>
          <Text style={[styles.phaseProgress, { color: theme.text }]}>
            {phase.progress}%
          </Text>
        </View>

        <Text style={[styles.phaseDescription, { color: theme.subtext }]}>
          {phase.description}
        </Text>

        <View style={styles.phaseStats}>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: theme.subtext }]}>
              Duration
            </Text>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {phase.duration} days
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: theme.subtext }]}>
              Budget
            </Text>
            <Text style={[styles.statValue, { color: theme.text }]}>
              ${phase.budget.toLocaleString()}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: theme.subtext }]}>
              Tasks
            </Text>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {phase.tasks.length}
            </Text>
          </View>
        </View>

        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${phase.progress}%`,
                backgroundColor: statusColor,
              },
            ]}
          />
        </View>

        <View style={styles.phaseActions}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.accent }]}
            onPress={() => {
              setSelectedPhase(phase);
              setTaskModal(true);
            }}
          >
            <MaterialIcons name='add-task' size={16} color='#fff' />
            <Text style={styles.actionButtonText}>Add Task</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.warning }]}
            onPress={() => {
              setSelectedPhase(phase);
              setMilestoneModal(true);
            }}
          >
            <MaterialIcons name='flag' size={16} color='#fff' />
            <Text style={styles.actionButtonText}>Add Milestone</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderTaskItem = (task: ProjectTask) => (
    <View
      key={task.id}
      style={[
        styles.taskItem,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <View style={styles.taskHeader}>
        <View style={styles.taskInfo}>
          <View
            style={[
              styles.priorityIndicator,
              { backgroundColor: PRIORITY_COLORS[task.priority] },
            ]}
          />
          <Text style={[styles.taskName, { color: theme.text }]}>
            {task.name}
          </Text>
        </View>
        <Text
          style={[styles.taskStatus, { color: STATUS_COLORS[task.status] }]}
        >
          {task.status.replace('-', ' ').toUpperCase()}
        </Text>
      </View>
      <Text style={[styles.taskDescription, { color: theme.subtext }]}>
        {task.description}
      </Text>
      <View style={styles.taskStats}>
        <Text style={[styles.taskStat, { color: theme.subtext }]}>
          Assigned: {task.assignedTo}
        </Text>
        <Text style={[styles.taskStat, { color: theme.subtext }]}>
          Hours: {task.actualHours}/{task.estimatedHours}
        </Text>
        <Text style={[styles.taskStat, { color: theme.subtext }]}>
          Progress: {task.progress}%
        </Text>
      </View>
    </View>
  );

  const renderMilestoneItem = (milestone: ProjectMilestone) => (
    <View
      key={milestone.id}
      style={[
        styles.milestoneItem,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <View style={styles.milestoneHeader}>
        <MaterialIcons
          name={
            milestone.status === 'completed'
              ? 'check-circle'
              : 'radio-button-unchecked'
          }
          size={20}
          color={
            milestone.status === 'completed' ? theme.success : theme.subtext
          }
        />
        <Text style={[styles.milestoneName, { color: theme.text }]}>
          {milestone.name}
        </Text>
        <Text style={[styles.milestoneDate, { color: theme.subtext }]}>
          {milestone.targetDate}
        </Text>
      </View>
      <Text style={[styles.milestoneDescription, { color: theme.subtext }]}>
        {milestone.description}
      </Text>
    </View>
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      {/* Header */}
      <LinearGradient
        colors={[theme.card, theme.background]}
        style={styles.header}
      >
        <Text style={[styles.projectName, { color: theme.text }]}>
          {projectName}
        </Text>
        <Text style={[styles.projectSubtitle, { color: theme.subtext }]}>
          Project Timeline & Task Management
        </Text>
        <TouchableOpacity
          style={[styles.addPhaseButton, { backgroundColor: theme.accent }]}
          onPress={() => setPhaseModal(true)}
        >
          <MaterialIcons name='add' size={20} color='#fff' />
          <Text style={styles.addPhaseButtonText}>Add Phase</Text>
        </TouchableOpacity>
      </LinearGradient>

      {/* Phases */}
      <View style={styles.phasesContainer}>{phases.map(renderPhaseCard)}</View>

      {/* Phase Details Modal */}
      {selectedPhase && (
        <Modal
          visible={editMode}
          animationType='slide'
          presentationStyle='pageSheet'
        >
          <View
            style={[
              styles.modalContainer,
              { backgroundColor: theme.background },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                {selectedPhase.name}
              </Text>
              <TouchableOpacity onPress={() => setEditMode(false)}>
                <MaterialIcons name='close' size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {/* Tasks Section */}
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  Tasks
                </Text>
                {selectedPhase.tasks.map(renderTaskItem)}
              </View>

              {/* Milestones Section */}
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  Milestones
                </Text>
                {selectedPhase.milestones.map(renderMilestoneItem)}
              </View>
            </ScrollView>
          </View>
        </Modal>
      )}

      {/* Add Phase Modal */}
      <Modal
        visible={phaseModal}
        animationType='slide'
        presentationStyle='pageSheet'
      >
        <View
          style={[styles.modalContainer, { backgroundColor: theme.background }]}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Add New Phase
            </Text>
            <TouchableOpacity onPress={() => setPhaseModal(false)}>
              <MaterialIcons name='close' size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>
                Phase Name *
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.card,
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                value={newPhase.name}
                onChangeText={text => setNewPhase({ ...newPhase, name: text })}
                placeholder='Enter phase name'
                placeholderTextColor={theme.subtext}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>
                Description
              </Text>
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  {
                    backgroundColor: theme.card,
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                value={newPhase.description}
                onChangeText={text =>
                  setNewPhase({ ...newPhase, description: text })
                }
                placeholder='Enter phase description'
                placeholderTextColor={theme.subtext}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>
                  Start Date *
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.card,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  value={newPhase.startDate}
                  onChangeText={text =>
                    setNewPhase({ ...newPhase, startDate: text })
                  }
                  placeholder='YYYY-MM-DD'
                  placeholderTextColor={theme.subtext}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>
                  End Date *
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.card,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  value={newPhase.endDate}
                  onChangeText={text =>
                    setNewPhase({ ...newPhase, endDate: text })
                  }
                  placeholder='YYYY-MM-DD'
                  placeholderTextColor={theme.subtext}
                />
              </View>
            </View>

            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>
                  Budget
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.card,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  value={newPhase.budget?.toString() || ''}
                  onChangeText={text =>
                    setNewPhase({ ...newPhase, budget: parseFloat(text) || 0 })
                  }
                  placeholder='0'
                  placeholderTextColor={theme.subtext}
                  keyboardType='numeric'
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>
                  Duration (days)
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.card,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  value={newPhase.duration?.toString() || ''}
                  onChangeText={text =>
                    setNewPhase({ ...newPhase, duration: parseInt(text) || 0 })
                  }
                  placeholder='0'
                  placeholderTextColor={theme.subtext}
                  keyboardType='numeric'
                />
              </View>
            </View>
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: theme.border }]}
              onPress={() => setPhaseModal(false)}
            >
              <Text style={[styles.cancelButtonText, { color: theme.text }]}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: theme.accent }]}
              onPress={addPhase}
            >
              <Text style={styles.addButtonText}>Add Phase</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Task Modal */}
      <Modal
        visible={taskModal}
        animationType='slide'
        presentationStyle='pageSheet'
      >
        <View
          style={[styles.modalContainer, { backgroundColor: theme.background }]}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Add Task to {selectedPhase?.name}
            </Text>
            <TouchableOpacity onPress={() => setTaskModal(false)}>
              <MaterialIcons name='close' size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>
                Task Name *
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.card,
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                value={newTask.name}
                onChangeText={text => setNewTask({ ...newTask, name: text })}
                placeholder='Enter task name'
                placeholderTextColor={theme.subtext}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>
                Description
              </Text>
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  {
                    backgroundColor: theme.card,
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                value={newTask.description}
                onChangeText={text =>
                  setNewTask({ ...newTask, description: text })
                }
                placeholder='Enter task description'
                placeholderTextColor={theme.subtext}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>
                  Assigned To
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.card,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  value={newTask.assignedTo}
                  onChangeText={text =>
                    setNewTask({ ...newTask, assignedTo: text })
                  }
                  placeholder='Person or team'
                  placeholderTextColor={theme.subtext}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>
                  Priority
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.card,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  value={newTask.priority}
                  onChangeText={text =>
                    setNewTask({ ...newTask, priority: text as any })
                  }
                  placeholder='low, medium, high, critical'
                  placeholderTextColor={theme.subtext}
                />
              </View>
            </View>

            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>
                  Start Date
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.card,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  value={newTask.startDate}
                  onChangeText={text =>
                    setNewTask({ ...newTask, startDate: text })
                  }
                  placeholder='YYYY-MM-DD'
                  placeholderTextColor={theme.subtext}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>
                  Due Date
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.card,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  value={newTask.dueDate}
                  onChangeText={text =>
                    setNewTask({ ...newTask, dueDate: text })
                  }
                  placeholder='YYYY-MM-DD'
                  placeholderTextColor={theme.subtext}
                />
              </View>
            </View>

            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>
                  Estimated Hours
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.card,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  value={newTask.estimatedHours?.toString() || ''}
                  onChangeText={text =>
                    setNewTask({
                      ...newTask,
                      estimatedHours: parseFloat(text) || 0,
                    })
                  }
                  placeholder='0'
                  placeholderTextColor={theme.subtext}
                  keyboardType='numeric'
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>
                  Actual Hours
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.card,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  value={newTask.actualHours?.toString() || ''}
                  onChangeText={text =>
                    setNewTask({
                      ...newTask,
                      actualHours: parseFloat(text) || 0,
                    })
                  }
                  placeholder='0'
                  placeholderTextColor={theme.subtext}
                  keyboardType='numeric'
                />
              </View>
            </View>
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: theme.border }]}
              onPress={() => setTaskModal(false)}
            >
              <Text style={[styles.cancelButtonText, { color: theme.text }]}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: theme.accent }]}
              onPress={addTask}
            >
              <Text style={styles.addButtonText}>Add Task</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Milestone Modal */}
      <Modal
        visible={milestoneModal}
        animationType='slide'
        presentationStyle='pageSheet'
      >
        <View
          style={[styles.modalContainer, { backgroundColor: theme.background }]}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Add Milestone to {selectedPhase?.name}
            </Text>
            <TouchableOpacity onPress={() => setMilestoneModal(false)}>
              <MaterialIcons name='close' size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>
                Milestone Name *
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.card,
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                value={newMilestone.name}
                onChangeText={text =>
                  setNewMilestone({ ...newMilestone, name: text })
                }
                placeholder='Enter milestone name'
                placeholderTextColor={theme.subtext}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>
                Description
              </Text>
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  {
                    backgroundColor: theme.card,
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                value={newMilestone.description}
                onChangeText={text =>
                  setNewMilestone({ ...newMilestone, description: text })
                }
                placeholder='Enter milestone description'
                placeholderTextColor={theme.subtext}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>
                  Target Date *
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.card,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  value={newMilestone.targetDate}
                  onChangeText={text =>
                    setNewMilestone({ ...newMilestone, targetDate: text })
                  }
                  placeholder='YYYY-MM-DD'
                  placeholderTextColor={theme.subtext}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>
                  Importance
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.card,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  value={newMilestone.importance}
                  onChangeText={text =>
                    setNewMilestone({
                      ...newMilestone,
                      importance: text as any,
                    })
                  }
                  placeholder='low, medium, high'
                  placeholderTextColor={theme.subtext}
                />
              </View>
            </View>
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: theme.border }]}
              onPress={() => setMilestoneModal(false)}
            >
              <Text style={[styles.cancelButtonText, { color: theme.text }]}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: theme.accent }]}
              onPress={addMilestone}
            >
              <Text style={styles.addButtonText}>Add Milestone</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    margin: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  projectName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  projectSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  addPhaseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
  },
  addPhaseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  phasesContainer: {
    padding: 16,
  },
  phaseCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  phaseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  phaseInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  phaseName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  phaseProgress: {
    fontSize: 16,
    fontWeight: '600',
  },
  phaseDescription: {
    fontSize: 14,
    marginBottom: 12,
  },
  phaseStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  phaseActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: 6,
    marginHorizontal: 4,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  taskItem: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  taskInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priorityIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  taskName: {
    fontSize: 16,
    fontWeight: '600',
  },
  taskStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  taskDescription: {
    fontSize: 14,
    marginBottom: 8,
  },
  taskStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  taskStat: {
    fontSize: 12,
  },
  milestoneItem: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  milestoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  milestoneName: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  milestoneDate: {
    fontSize: 12,
  },
  milestoneDescription: {
    fontSize: 14,
    marginLeft: 28,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  cancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  addButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    marginLeft: 8,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
