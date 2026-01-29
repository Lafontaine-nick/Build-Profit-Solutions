import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  PanGestureHandler,
  Animated,
  Dimensions,
  StyleSheet,
  Pressable,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { MaterialIcons } from '@expo/vector-icons';

const { width: screenWidth } = Dimensions.get('window');

// Types
export type Milestone = {
  id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  status: 'not-started' | 'in-progress' | 'completed' | 'delayed';
  progress: number; // 0-100
  dependencies?: string[]; // IDs of milestones this depends on
  assignee?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedHours?: number;
  actualHours?: number;
  cost?: number;
};

export type TimelineData = {
  projectId: string;
  milestones: Milestone[];
  startDate: string;
  endDate: string;
  currentDate: string;
};

// Mock data
const mockTimelineData: TimelineData = {
  projectId: 'proj_demo',
  startDate: '2025-01-15',
  endDate: '2025-06-15',
  currentDate: '2025-02-10',
  milestones: [
    {
      id: 'm1',
      title: 'Site Preparation',
      description: 'Clear site, set up temporary facilities',
      startDate: '2025-01-15',
      endDate: '2025-01-25',
      status: 'completed',
      progress: 100,
      priority: 'high',
      estimatedHours: 80,
      actualHours: 85,
      cost: 12000,
    },
    {
      id: 'm2',
      title: 'Foundation Work',
      description: 'Excavation, concrete pouring, curing',
      startDate: '2025-01-20',
      endDate: '2025-02-10',
      status: 'in-progress',
      progress: 75,
      priority: 'critical',
      estimatedHours: 120,
      actualHours: 90,
      cost: 25000,
      dependencies: ['m1'],
    },
    {
      id: 'm3',
      title: 'Framing',
      description: 'Structural framing and roof installation',
      startDate: '2025-02-05',
      endDate: '2025-03-15',
      status: 'not-started',
      progress: 0,
      priority: 'high',
      estimatedHours: 200,
      cost: 35000,
      dependencies: ['m2'],
    },
    {
      id: 'm4',
      title: 'Electrical & Plumbing',
      description: 'Rough-in electrical and plumbing systems',
      startDate: '2025-03-10',
      endDate: '2025-04-05',
      status: 'not-started',
      progress: 0,
      priority: 'medium',
      estimatedHours: 150,
      cost: 28000,
      dependencies: ['m3'],
    },
    {
      id: 'm5',
      title: 'Interior Finishing',
      description: 'Drywall, flooring, fixtures, paint',
      startDate: '2025-04-01',
      endDate: '2025-05-15',
      status: 'not-started',
      progress: 0,
      priority: 'medium',
      estimatedHours: 180,
      cost: 45000,
      dependencies: ['m4'],
    },
    {
      id: 'm6',
      title: 'Final Inspection',
      description: 'Code compliance and final walkthrough',
      startDate: '2025-05-20',
      endDate: '2025-06-05',
      status: 'not-started',
      progress: 0,
      priority: 'high',
      estimatedHours: 20,
      cost: 5000,
      dependencies: ['m5'],
    },
  ],
};

export default function InteractiveTimeline({
  data = mockTimelineData,
  onUpdate,
}: {
  data?: TimelineData;
  onUpdate?: (data: TimelineData) => void;
}) {
  const { darkMode } = useTheme();
  const [milestones, setMilestones] = useState<Milestone[]>(data.milestones);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(
    null
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [draggedMilestone, setDraggedMilestone] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'timeline' | 'list' | 'kanban'>(
    'timeline'
  );

  const theme = darkMode
    ? {
        background: '#0b1c38',
        card: '#1B365D',
        text: '#f1f5f9',
        subtext: '#cbd5e1',
        border: 'rgba(255, 255, 255, 0.1)',
        accent: '#43cea2',
        success: '#22c55e',
        warning: '#f59e0b',
        error: '#ef4444',
      }
    : {
        background: '#f5f7fa',
        card: '#ffffff',
        text: '#1e293b',
        subtext: '#64748b',
        border: 'rgba(0, 0, 0, 0.1)',
        accent: '#1976d2',
        success: '#22c55e',
        warning: '#f59e0b',
        error: '#ef4444',
      };

  const getStatusColor = (status: Milestone['status']) => {
    switch (status) {
      case 'completed':
        return theme.success;
      case 'in-progress':
        return theme.accent;
      case 'delayed':
        return theme.error;
      case 'not-started':
        return theme.subtext;
      default:
        return theme.subtext;
    }
  };

  const getPriorityColor = (priority: Milestone['priority']) => {
    switch (priority) {
      case 'critical':
        return theme.error;
      case 'high':
        return theme.warning;
      case 'medium':
        return theme.accent;
      case 'low':
        return theme.success;
      default:
        return theme.subtext;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const calculateDaysBetween = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
  };

  const updateMilestone = (updatedMilestone: Milestone) => {
    const newMilestones = milestones.map(m =>
      m.id === updatedMilestone.id ? updatedMilestone : m
    );
    setMilestones(newMilestones);
    onUpdate?.({ ...data, milestones: newMilestones });
  };

  const addMilestone = (newMilestone: Omit<Milestone, 'id'>) => {
    const milestone: Milestone = {
      ...newMilestone,
      id: `m${Date.now()}`,
    };
    const newMilestones = [...milestones, milestone];
    setMilestones(newMilestones);
    onUpdate?.({ ...data, milestones: newMilestones });
  };

  const deleteMilestone = (id: string) => {
    Alert.alert(
      'Delete Milestone',
      'Are you sure you want to delete this milestone?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const newMilestones = milestones.filter(m => m.id !== id);
            setMilestones(newMilestones);
            onUpdate?.({ ...data, milestones: newMilestones });
          },
        },
      ]
    );
  };

  const renderTimelineView = () => {
    const sortedMilestones = [...milestones].sort(
      (a, b) =>
        new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.timelineScroll}
      >
        <View style={styles.timelineContainer}>
          {sortedMilestones.map((milestone, index) => (
            <View key={milestone.id} style={styles.timelineItem}>
              <View style={styles.timelineConnector}>
                {index < sortedMilestones.length - 1 && (
                  <View
                    style={[
                      styles.connectorLine,
                      { backgroundColor: theme.border },
                    ]}
                  />
                )}
              </View>

              <Pressable
                style={[
                  styles.milestoneCard,
                  {
                    backgroundColor: theme.card,
                    borderColor: getStatusColor(milestone.status),
                    borderWidth: 2,
                  },
                ]}
                onPress={() => setEditingMilestone(milestone)}
              >
                <View style={styles.milestoneHeader}>
                  <Text
                    style={[styles.milestoneTitle, { color: theme.text }]}
                    numberOfLines={2}
                  >
                    {milestone.title}
                  </Text>
                  <View
                    style={[
                      styles.priorityDot,
                      { backgroundColor: getPriorityColor(milestone.priority) },
                    ]}
                  />
                </View>

                <Text style={[styles.milestoneDates, { color: theme.subtext }]}>
                  {formatDate(milestone.startDate)} -{' '}
                  {formatDate(milestone.endDate)}
                </Text>

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
                          width: `${milestone.progress}%`,
                          backgroundColor: getStatusColor(milestone.status),
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.progressText, { color: theme.text }]}>
                    {milestone.progress}%
                  </Text>
                </View>

                <View style={styles.milestoneFooter}>
                  <Text
                    style={[
                      styles.statusText,
                      { color: getStatusColor(milestone.status) },
                    ]}
                  >
                    {milestone.status.replace('-', ' ').toUpperCase()}
                  </Text>
                  {milestone.cost && (
                    <Text style={[styles.costText, { color: theme.subtext }]}>
                      ${milestone.cost.toLocaleString()}
                    </Text>
                  )}
                </View>
              </Pressable>
            </View>
          ))}
        </View>
      </ScrollView>
    );
  };

  const renderListView = () => (
    <View style={styles.listContainer}>
      {milestones.map(milestone => (
        <Pressable
          key={milestone.id}
          style={[
            styles.listItem,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
          onPress={() => setEditingMilestone(milestone)}
        >
          <View style={styles.listItemHeader}>
            <View style={styles.listItemTitle}>
              <Text style={[styles.listItemTitleText, { color: theme.text }]}>
                {milestone.title}
              </Text>
              <View
                style={[
                  styles.priorityIndicator,
                  { backgroundColor: getPriorityColor(milestone.priority) },
                ]}
              />
            </View>
            <Pressable
              onPress={() => deleteMilestone(milestone.id)}
              style={styles.deleteButton}
            >
              <MaterialIcons name='delete' size={20} color={theme.error} />
            </Pressable>
          </View>

          <Text style={[styles.listItemDescription, { color: theme.subtext }]}>
            {milestone.description}
          </Text>

          <View style={styles.listItemDetails}>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: theme.subtext }]}>
                Status:
              </Text>
              <Text
                style={[
                  styles.detailValue,
                  { color: getStatusColor(milestone.status) },
                ]}
              >
                {milestone.status.replace('-', ' ').toUpperCase()}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: theme.subtext }]}>
                Progress:
              </Text>
              <Text style={[styles.detailValue, { color: theme.text }]}>
                {milestone.progress}%
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: theme.subtext }]}>
                Duration:
              </Text>
              <Text style={[styles.detailValue, { color: theme.text }]}>
                {calculateDaysBetween(milestone.startDate, milestone.endDate)}{' '}
                days
              </Text>
            </View>
          </View>
        </Pressable>
      ))}
    </View>
  );

  const renderKanbanView = () => {
    const statusColumns = [
      {
        key: 'not-started',
        title: 'Not Started',
        milestones: milestones.filter(m => m.status === 'not-started'),
      },
      {
        key: 'in-progress',
        title: 'In Progress',
        milestones: milestones.filter(m => m.status === 'in-progress'),
      },
      {
        key: 'completed',
        title: 'Completed',
        milestones: milestones.filter(m => m.status === 'completed'),
      },
      {
        key: 'delayed',
        title: 'Delayed',
        milestones: milestones.filter(m => m.status === 'delayed'),
      },
    ];

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.kanbanScroll}
      >
        <View style={styles.kanbanContainer}>
          {statusColumns.map(column => (
            <View
              key={column.key}
              style={[
                styles.kanbanColumn,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <View style={styles.kanbanHeader}>
                <Text style={[styles.kanbanTitle, { color: theme.text }]}>
                  {column.title}
                </Text>
                <Text style={[styles.kanbanCount, { color: theme.subtext }]}>
                  {column.milestones.length}
                </Text>
              </View>

              <ScrollView
                style={styles.kanbanContent}
                showsVerticalScrollIndicator={false}
              >
                {column.milestones.map(milestone => (
                  <Pressable
                    key={milestone.id}
                    style={[
                      styles.kanbanCard,
                      {
                        backgroundColor: theme.background,
                        borderColor: theme.border,
                      },
                    ]}
                    onPress={() => setEditingMilestone(milestone)}
                  >
                    <Text
                      style={[styles.kanbanCardTitle, { color: theme.text }]}
                      numberOfLines={2}
                    >
                      {milestone.title}
                    </Text>
                    <View style={styles.kanbanCardFooter}>
                      <View
                        style={[
                          styles.priorityDot,
                          {
                            backgroundColor: getPriorityColor(
                              milestone.priority
                            ),
                          },
                        ]}
                      />
                      <Text
                        style={[
                          styles.kanbanCardProgress,
                          { color: theme.subtext },
                        ]}
                      >
                        {milestone.progress}%
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ))}
        </View>
      </ScrollView>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header with View Toggle */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Project Timeline
        </Text>
        <View style={styles.viewToggle}>
          {[
            { key: 'timeline', icon: 'timeline', label: 'Timeline' },
            { key: 'list', icon: 'list', label: 'List' },
            { key: 'kanban', icon: 'view-column', label: 'Kanban' },
          ].map(view => (
            <Pressable
              key={view.key}
              style={[
                styles.viewButton,
                {
                  backgroundColor:
                    viewMode === view.key ? theme.accent : 'transparent',
                  borderColor: theme.border,
                },
              ]}
              onPress={() => setViewMode(view.key as any)}
            >
              <MaterialIcons
                name={view.icon as any}
                size={20}
                color={viewMode === view.key ? '#fff' : theme.subtext}
              />
            </Pressable>
          ))}
        </View>
      </View>

      {/* Add Milestone Button */}
      <Pressable
        style={[styles.addButton, { backgroundColor: theme.accent }]}
        onPress={() => setShowAddModal(true)}
      >
        <MaterialIcons name='add' size={24} color='#fff' />
        <Text style={styles.addButtonText}>Add Milestone</Text>
      </Pressable>

      {/* Content based on view mode */}
      {viewMode === 'timeline' && renderTimelineView()}
      {viewMode === 'list' && renderListView()}
      {viewMode === 'kanban' && renderKanbanView()}

      {/* Milestone Editor Modal */}
      {editingMilestone && (
        <MilestoneEditor
          milestone={editingMilestone}
          onSave={updateMilestone}
          onClose={() => setEditingMilestone(null)}
          theme={theme}
        />
      )}

      {/* Add Milestone Modal */}
      {showAddModal && (
        <MilestoneEditor
          milestone={null}
          onSave={addMilestone}
          onClose={() => setShowAddModal(false)}
          theme={theme}
        />
      )}
    </View>
  );
}

// Milestone Editor Component
const MilestoneEditor: React.FC<{
  milestone: Milestone | null;
  onSave: (milestone: Milestone | Omit<Milestone, 'id'>) => void;
  onClose: () => void;
  theme: any;
}> = ({ milestone, onSave, onClose, theme }) => {
  const [formData, setFormData] = useState({
    title: milestone?.title || '',
    description: milestone?.description || '',
    startDate: milestone?.startDate || '',
    endDate: milestone?.endDate || '',
    status: milestone?.status || ('not-started' as Milestone['status']),
    progress: milestone?.progress || 0,
    priority: milestone?.priority || ('medium' as Milestone['priority']),
    estimatedHours: milestone?.estimatedHours || 0,
    actualHours: milestone?.actualHours || 0,
    cost: milestone?.cost || 0,
    assignee: milestone?.assignee || '',
  });

  const handleSave = () => {
    if (!formData.title || !formData.startDate || !formData.endDate) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    onSave(formData);
    onClose();
  };

  return (
    <Modal visible={true} animationType='slide' presentationStyle='pageSheet'>
      <View
        style={[styles.modalContainer, { backgroundColor: theme.background }]}
      >
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, { color: theme.text }]}>
            {milestone ? 'Edit Milestone' : 'Add Milestone'}
          </Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <MaterialIcons name='close' size={24} color={theme.text} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.modalContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formGroup}>
            <Text style={[styles.formLabel, { color: theme.text }]}>
              Title *
            </Text>
            <TextInput
              style={[
                styles.formInput,
                {
                  backgroundColor: theme.card,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
              value={formData.title}
              onChangeText={text => setFormData({ ...formData, title: text })}
              placeholder='Enter milestone title'
              placeholderTextColor={theme.subtext}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.formLabel, { color: theme.text }]}>
              Description
            </Text>
            <TextInput
              style={[
                styles.formInput,
                styles.textArea,
                {
                  backgroundColor: theme.card,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
              value={formData.description}
              onChangeText={text =>
                setFormData({ ...formData, description: text })
              }
              placeholder='Enter milestone description'
              placeholderTextColor={theme.subtext}
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.formRow}>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={[styles.formLabel, { color: theme.text }]}>
                Start Date *
              </Text>
              <TextInput
                style={[
                  styles.formInput,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                    color: theme.text,
                  },
                ]}
                value={formData.startDate}
                onChangeText={text =>
                  setFormData({ ...formData, startDate: text })
                }
                placeholder='YYYY-MM-DD'
                placeholderTextColor={theme.subtext}
              />
            </View>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={[styles.formLabel, { color: theme.text }]}>
                End Date *
              </Text>
              <TextInput
                style={[
                  styles.formInput,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                    color: theme.text,
                  },
                ]}
                value={formData.endDate}
                onChangeText={text =>
                  setFormData({ ...formData, endDate: text })
                }
                placeholder='YYYY-MM-DD'
                placeholderTextColor={theme.subtext}
              />
            </View>
          </View>

          <View style={styles.formRow}>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={[styles.formLabel, { color: theme.text }]}>
                Status
              </Text>
              <View style={styles.statusButtons}>
                {(
                  [
                    'not-started',
                    'in-progress',
                    'completed',
                    'delayed',
                  ] as const
                ).map(status => (
                  <Pressable
                    key={status}
                    style={[
                      styles.statusButton,
                      {
                        backgroundColor:
                          formData.status === status
                            ? theme.accent
                            : 'transparent',
                        borderColor: theme.border,
                      },
                    ]}
                    onPress={() => setFormData({ ...formData, status })}
                  >
                    <Text
                      style={[
                        styles.statusButtonText,
                        {
                          color:
                            formData.status === status ? '#fff' : theme.text,
                        },
                      ]}
                    >
                      {status.replace('-', ' ').toUpperCase()}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={[styles.formLabel, { color: theme.text }]}>
                Progress (%)
              </Text>
              <TextInput
                style={[
                  styles.formInput,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                    color: theme.text,
                  },
                ]}
                value={String(formData.progress)}
                onChangeText={text =>
                  setFormData({ ...formData, progress: parseInt(text) || 0 })
                }
                keyboardType='numeric'
                placeholder='0'
                placeholderTextColor={theme.subtext}
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.formLabel, { color: theme.text }]}>
              Priority
            </Text>
            <View style={styles.priorityButtons}>
              {(['low', 'medium', 'high', 'critical'] as const).map(
                priority => (
                  <Pressable
                    key={priority}
                    style={[
                      styles.priorityButton,
                      {
                        backgroundColor:
                          formData.priority === priority
                            ? theme.accent
                            : 'transparent',
                        borderColor: theme.border,
                      },
                    ]}
                    onPress={() => setFormData({ ...formData, priority })}
                  >
                    <Text
                      style={[
                        styles.priorityButtonText,
                        {
                          color:
                            formData.priority === priority
                              ? '#fff'
                              : theme.text,
                        },
                      ]}
                    >
                      {priority.toUpperCase()}
                    </Text>
                  </Pressable>
                )
              )}
            </View>
          </View>

          <View style={styles.formRow}>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={[styles.formLabel, { color: theme.text }]}>
                Estimated Hours
              </Text>
              <TextInput
                style={[
                  styles.formInput,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                    color: theme.text,
                  },
                ]}
                value={String(formData.estimatedHours)}
                onChangeText={text =>
                  setFormData({
                    ...formData,
                    estimatedHours: parseInt(text) || 0,
                  })
                }
                keyboardType='numeric'
                placeholder='0'
                placeholderTextColor={theme.subtext}
              />
            </View>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={[styles.formLabel, { color: theme.text }]}>
                Cost ($)
              </Text>
              <TextInput
                style={[
                  styles.formInput,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                    color: theme.text,
                  },
                ]}
                value={String(formData.cost)}
                onChangeText={text =>
                  setFormData({ ...formData, cost: parseInt(text) || 0 })
                }
                keyboardType='numeric'
                placeholder='0'
                placeholderTextColor={theme.subtext}
              />
            </View>
          </View>
        </ScrollView>

        <View style={styles.modalFooter}>
          <Pressable
            style={[
              styles.modalButton,
              styles.cancelButton,
              { borderColor: theme.border },
            ]}
            onPress={onClose}
          >
            <Text style={[styles.modalButtonText, { color: theme.text }]}>
              Cancel
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.modalButton,
              styles.saveButton,
              { backgroundColor: theme.accent },
            ]}
            onPress={handleSave}
          >
            <Text style={styles.saveButtonText}>Save</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: { fontSize: 24, fontWeight: '600' },
  viewToggle: { flexDirection: 'row', gap: 8 },
  viewButton: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 16,
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  // Timeline View
  timelineScroll: { flex: 1 },
  timelineContainer: {
    flexDirection: 'row',
    padding: 16,
    minWidth: screenWidth * 2,
  },
  timelineItem: {
    alignItems: 'center',
    marginRight: 20,
    width: 200,
  },
  timelineConnector: {
    position: 'relative',
    width: '100%',
    height: 20,
  },
  connectorLine: {
    position: 'absolute',
    top: 10,
    left: 100,
    right: -20,
    height: 2,
  },
  milestoneCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    width: '100%',
    minHeight: 200,
  },
  milestoneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  milestoneTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  priorityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  milestoneDates: {
    fontSize: 12,
    marginBottom: 12,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressBar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
  },
  milestoneFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  costText: {
    fontSize: 12,
    fontWeight: '500',
  },

  // List View
  listContainer: { padding: 16 },
  listItem: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  listItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  listItemTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  listItemTitleText: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  priorityIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  deleteButton: {
    padding: 4,
  },
  listItemDescription: {
    fontSize: 14,
    marginBottom: 12,
  },
  listItemDetails: {
    gap: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 12,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '500',
  },

  // Kanban View
  kanbanScroll: { flex: 1 },
  kanbanContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 16,
  },
  kanbanColumn: {
    width: 200,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  kanbanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  kanbanTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  kanbanCount: {
    fontSize: 12,
    backgroundColor: 'rgba(100, 116, 139, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  kanbanContent: {
    flex: 1,
  },
  kanbanCard: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  kanbanCardTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  kanbanCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kanbanCardProgress: {
    fontSize: 12,
  },

  // Modal
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statusButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  priorityButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  priorityButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  priorityButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  saveButton: {
    backgroundColor: '#43cea2',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
