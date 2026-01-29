import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

/**
 * Build Profit Solutions — Tasks & Daily Logs Module
 * Enhanced with AI integrations for intelligent project management
 */

// ---------- Types ----------
export type TaskStatus =
  | 'Not Started'
  | 'In Progress'
  | 'Completed'
  | 'On Hold';
export type TaskPriority = 'High' | 'Medium' | 'Low';
export type WeatherCondition =
  | 'Sunny'
  | 'Cloudy'
  | 'Rainy'
  | 'Stormy'
  | 'Snowy';

export type Task = {
  id: string;
  title: string;
  description: string;
  assignedTo: string;
  dueDate: string;
  status: TaskStatus;
  priority: TaskPriority;
  checklist: ChecklistItem[];
  photos: string[];
  createdAt: string;
  updatedAt: string;
};

export type ChecklistItem = {
  id: string;
  text: string;
  completed: boolean;
};

export type DailyLog = {
  id: string;
  date: string;
  weather: WeatherCondition;
  temperature: number;
  crewCount: number;
  notes: string;
  tasksCompleted: string[];
  issues: string[];
  photos: string[];
  aiSummary?: string;
  createdAt: string;
};

export type AIInsight = {
  type: 'budget' | 'schedule' | 'risk' | 'efficiency';
  message: string;
  severity: 'info' | 'warning' | 'critical';
  action?: string;
};

// ---------- Theme ----------
const palette = {
  dark: {
    bg: 'transparent',
    card: '#1B365D',
    text: '#FFFFFF',
    sub: 'rgba(255,255,255,0.8)',
    divider: 'rgba(255,255,255,0.2)',
    primary: '#22C55E',
    warning: '#FACC15',
    danger: '#EF4444',
    accent: '#22C55E',
  },
  light: {
    bg: '#F6F8FB',
    card: '#FFFFFF',
    text: '#0A1A2B',
    sub: '#5A6B7C',
    divider: 'rgba(0,0,0,0.06)',
    primary: '#16A34A',
    warning: '#B45309',
    danger: '#DC2626',
    accent: '#16A34A',
  },
};

export type ThemeName = keyof typeof palette;

// ---------- AI Service Mock (Replace with real AI integration) ----------
const AIService = {
  generateTaskInsights: async (tasks: Task[]): Promise<AIInsight[]> => {
    // Mock AI analysis
    const overdueTasks = tasks.filter(
      t => new Date(t.dueDate) < new Date() && t.status !== 'Completed'
    );

    const insights: AIInsight[] = [];

    if (overdueTasks.length > 0) {
      insights.push({
        type: 'schedule',
        message: `${overdueTasks.length} tasks are overdue. This may impact project timeline.`,
        severity: 'warning',
        action: 'Review and reschedule overdue tasks',
      });
    }

    const highPriorityInProgress = tasks.filter(
      t => t.priority === 'High' && t.status === 'In Progress'
    );

    if (highPriorityInProgress.length > 3) {
      insights.push({
        type: 'efficiency',
        message:
          'Multiple high-priority tasks in progress. Consider adding crew members.',
        severity: 'info',
        action: 'Assess crew allocation',
      });
    }

    return insights;
  },

  generateDailyLogSummary: async (log: DailyLog): Promise<string> => {
    // Mock AI summary generation
    const weatherImpact =
      log.weather === 'Rainy' || log.weather === 'Stormy'
        ? 'Weather conditions may have impacted productivity.'
        : 'Good weather conditions supported work progress.';

    const efficiency =
      log.crewCount > 0
        ? `Crew of ${log.crewCount} worked on ${log.tasksCompleted.length} tasks.`
        : 'No crew on site today.';

    return `${weatherImpact} ${efficiency} ${log.notes ? `Key notes: ${log.notes}` : ''}`;
  },

  predictScheduleImpact: async (
    tasks: Task[],
    logs: DailyLog[]
  ): Promise<AIInsight[]> => {
    // Mock predictive analysis
    const insights: AIInsight[] = [];

    const recentLogs = logs.slice(-7); // Last 7 days
    const avgCrewCount =
      recentLogs.reduce((sum, log) => sum + log.crewCount, 0) /
      recentLogs.length;

    if (avgCrewCount < 3) {
      insights.push({
        type: 'schedule',
        message:
          'Low crew count detected. Project may be 5-8 days behind schedule.',
        severity: 'warning',
        action: 'Consider increasing crew size or extending timeline',
      });
    }

    return insights;
  },
};

// ---------- Components ----------
const TaskCard: React.FC<{
  task: Task;
  theme: ThemeName;
  onUpdateStatus: (taskId: string, status: TaskStatus) => void;
  onAddPhoto: (taskId: string) => void;
}> = ({ task, theme, onUpdateStatus, onAddPhoto }) => {
  const c = palette[theme];

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'Completed':
        return c.primary;
      case 'In Progress':
        return c.warning;
      case 'On Hold':
        return c.danger;
      default:
        return c.sub;
    }
  };

  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case 'High':
        return c.danger;
      case 'Medium':
        return c.warning;
      default:
        return c.primary;
    }
  };

  const isOverdue =
    new Date(task.dueDate) < new Date() && task.status !== 'Completed';

  return (
    <View style={[styles.taskCard, { backgroundColor: c.card }]}>
      <View style={styles.taskHeader}>
        <View style={styles.taskTitleRow}>
          <Text style={[styles.taskTitle, { color: c.text }]}>
            {task.title}
          </Text>
          <View
            style={[
              styles.priorityBadge,
              { backgroundColor: getPriorityColor(task.priority) + '33' },
            ]}
          >
            <Text
              style={[
                styles.priorityText,
                { color: getPriorityColor(task.priority) },
              ]}
            >
              {task.priority}
            </Text>
          </View>
        </View>
        <Text style={[styles.taskDescription, { color: c.sub }]}>
          {task.description}
        </Text>
      </View>

      <View style={styles.taskDetails}>
        <View style={styles.taskDetailRow}>
          <Ionicons name='person' size={16} color={c.sub} />
          <Text style={[styles.taskDetailText, { color: c.sub }]}>
            {task.assignedTo}
          </Text>
        </View>
        <View style={styles.taskDetailRow}>
          <Ionicons name='calendar' size={16} color={c.sub} />
          <Text
            style={[
              styles.taskDetailText,
              { color: isOverdue ? c.danger : c.sub },
            ]}
          >
            Due: {new Date(task.dueDate).toLocaleDateString()}
          </Text>
        </View>
        <View style={styles.taskDetailRow}>
          <Ionicons name='checkmark-circle' size={16} color={c.sub} />
          <Text style={[styles.taskDetailText, { color: c.sub }]}>
            {task.checklist.filter(item => item.completed).length}/
            {task.checklist.length} completed
          </Text>
        </View>
      </View>

      <View style={styles.taskActions}>
        <TouchableOpacity
          style={[
            styles.statusButton,
            { backgroundColor: getStatusColor(task.status) + '33' },
          ]}
          onPress={() => {
            const statuses: TaskStatus[] = [
              'Not Started',
              'In Progress',
              'Completed',
              'On Hold',
            ];
            const currentIndex = statuses.indexOf(task.status);
            const nextStatus = statuses[(currentIndex + 1) % statuses.length];
            onUpdateStatus(task.id, nextStatus);
          }}
        >
          <Text
            style={[
              styles.statusButtonText,
              { color: getStatusColor(task.status) },
            ]}
          >
            {task.status}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.photoButton, { backgroundColor: c.primary + '33' }]}
          onPress={() => onAddPhoto(task.id)}
        >
          <Ionicons name='camera' size={16} color={c.primary} />
          <Text style={[styles.photoButtonText, { color: c.primary }]}>
            {task.photos.length} photos
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const DailyLogCard: React.FC<{
  log: DailyLog;
  theme: ThemeName;
  onEdit: (logId: string) => void;
}> = ({ log, theme, onEdit }) => {
  const c = palette[theme];

  const getWeatherIcon = (weather: WeatherCondition) => {
    switch (weather) {
      case 'Sunny':
        return 'sunny';
      case 'Cloudy':
        return 'cloudy';
      case 'Rainy':
        return 'rainy';
      case 'Stormy':
        return 'thunderstorm';
      case 'Snowy':
        return 'snow';
      default:
        return 'partly-sunny';
    }
  };

  return (
    <View style={[styles.logCard, { backgroundColor: c.card }]}>
      <View style={styles.logHeader}>
        <Text style={[styles.logDate, { color: c.text }]}>
          {new Date(log.date).toLocaleDateString()}
        </Text>
        <TouchableOpacity onPress={() => onEdit(log.id)}>
          <Ionicons name='create' size={20} color={c.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.logDetails}>
        <View style={styles.logDetailRow}>
          <Ionicons
            name={getWeatherIcon(log.weather)}
            size={16}
            color={c.sub}
          />
          <Text style={[styles.logDetailText, { color: c.sub }]}>
            {log.weather}, {log.temperature}°F
          </Text>
        </View>
        <View style={styles.logDetailRow}>
          <Ionicons name='people' size={16} color={c.sub} />
          <Text style={[styles.logDetailText, { color: c.sub }]}>
            {log.crewCount} crew members
          </Text>
        </View>
        <View style={styles.logDetailRow}>
          <Ionicons name='checkmark-circle' size={16} color={c.sub} />
          <Text style={[styles.logDetailText, { color: c.sub }]}>
            {log.tasksCompleted.length} tasks completed
          </Text>
        </View>
      </View>

      {log.notes && (
        <Text style={[styles.logNotes, { color: c.text }]}>{log.notes}</Text>
      )}

      {log.aiSummary && (
        <View style={[styles.aiSummary, { backgroundColor: c.primary + '20' }]}>
          <Ionicons name='bulb' size={16} color={c.primary} />
          <Text style={[styles.aiSummaryText, { color: c.primary }]}>
            {log.aiSummary}
          </Text>
        </View>
      )}
    </View>
  );
};

const AIInsightCard: React.FC<{
  insight: AIInsight;
  theme: ThemeName;
}> = ({ insight, theme }) => {
  const c = palette[theme];

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return c.danger;
      case 'warning':
        return c.warning;
      default:
        return c.primary;
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'warning';
      case 'warning':
        return 'alert-circle';
      default:
        return 'information-circle';
    }
  };

  return (
    <View style={[styles.insightCard, { backgroundColor: c.card }]}>
      <View style={styles.insightHeader}>
        <Ionicons
          name={getSeverityIcon(insight.severity)}
          size={20}
          color={getSeverityColor(insight.severity)}
        />
        <Text
          style={[
            styles.insightType,
            { color: getSeverityColor(insight.severity) },
          ]}
        >
          {insight.type.toUpperCase()}
        </Text>
      </View>
      <Text style={[styles.insightMessage, { color: c.text }]}>
        {insight.message}
      </Text>
      {insight.action && (
        <Text style={[styles.insightAction, { color: c.primary }]}>
          {insight.action}
        </Text>
      )}
    </View>
  );
};

// ---------- Main Component ----------
export const TasksAndLogsModule: React.FC<{
  projectId: string;
  theme?: ThemeName;
  onAddTask?: () => void;
  onAddLog?: () => void;
}> = ({ projectId, theme = 'dark', onAddTask, onAddLog }) => {
  const c = palette[theme];
  const [activeTab, setActiveTab] = useState<'tasks' | 'logs' | 'insights'>(
    'tasks'
  );
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(false);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Mock data - replace with real API calls
      const mockTasks: Task[] = [
        {
          id: '1',
          title: 'Foundation Pour',
          description: 'Pour concrete foundation for main structure',
          assignedTo: 'Concrete Crew',
          dueDate: '2025-01-20',
          status: 'In Progress',
          priority: 'High',
          checklist: [
            { id: '1', text: 'Prepare forms', completed: true },
            { id: '2', text: 'Install rebar', completed: true },
            { id: '3', text: 'Pour concrete', completed: false },
            { id: '4', text: 'Finish surface', completed: false },
          ],
          photos: [],
          createdAt: '2025-01-15',
          updatedAt: '2025-01-15',
        },
        {
          id: '2',
          title: 'Framing - First Floor',
          description: 'Frame first floor walls and install windows',
          assignedTo: 'Framing Crew',
          dueDate: '2025-01-25',
          status: 'Not Started',
          priority: 'High',
          checklist: [
            { id: '1', text: 'Layout walls', completed: false },
            { id: '2', text: 'Cut lumber', completed: false },
            { id: '3', text: 'Assemble walls', completed: false },
            { id: '4', text: 'Install windows', completed: false },
          ],
          photos: [],
          createdAt: '2025-01-15',
          updatedAt: '2025-01-15',
        },
      ];

      const mockLogs: DailyLog[] = [
        {
          id: '1',
          date: '2025-01-15',
          weather: 'Sunny',
          temperature: 72,
          crewCount: 4,
          notes:
            'Good progress on foundation prep. Weather was perfect for concrete work.',
          tasksCompleted: ['1'],
          issues: [],
          photos: [],
          aiSummary:
            'Good weather conditions supported work progress. Crew of 4 worked on 1 tasks. Key notes: Good progress on foundation prep. Weather was perfect for concrete work.',
          createdAt: '2025-01-15',
        },
      ];

      setTasks(mockTasks);
      setLogs(mockLogs);

      // Generate AI insights
      const taskInsights = await AIService.generateTaskInsights(mockTasks);
      const scheduleInsights = await AIService.predictScheduleImpact(
        mockTasks,
        mockLogs
      );
      setInsights([...taskInsights, ...scheduleInsights]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTaskStatus = (taskId: string, status: TaskStatus) => {
    setTasks(prev =>
      prev.map(task =>
        task.id === taskId
          ? { ...task, status, updatedAt: new Date().toISOString() }
          : task
      )
    );
  };

  const handleAddPhoto = (taskId: string) => {
    Alert.alert('Add Photo', 'Photo functionality would be implemented here');
  };

  const handleEditLog = (logId: string) => {
    Alert.alert(
      'Edit Log',
      'Log editing functionality would be implemented here'
    );
  };

  const renderTasks = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.tabHeader}>
        <Text style={[styles.tabTitle, { color: c.text }]}>Project Tasks</Text>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: c.primary }]}
          onPress={onAddTask}
        >
          <Ionicons name='add' size={20} color='#FFFFFF' />
          <Text style={styles.addButtonText}>Add Task</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={tasks}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TaskCard
            task={item}
            theme={theme}
            onUpdateStatus={handleUpdateTaskStatus}
            onAddPhoto={handleAddPhoto}
          />
        )}
        scrollEnabled={false}
      />
    </ScrollView>
  );

  const renderLogs = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.tabHeader}>
        <Text style={[styles.tabTitle, { color: c.text }]}>Daily Logs</Text>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: c.primary }]}
          onPress={onAddLog}
        >
          <Ionicons name='add' size={20} color='#FFFFFF' />
          <Text style={styles.addButtonText}>Add Log</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={logs}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <DailyLogCard log={item} theme={theme} onEdit={handleEditLog} />
        )}
        scrollEnabled={false}
      />
    </ScrollView>
  );

  const renderInsights = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.tabHeader}>
        <Text style={[styles.tabTitle, { color: c.text }]}>AI Insights</Text>
        <TouchableOpacity
          style={[styles.refreshButton, { backgroundColor: c.primary }]}
          onPress={loadData}
        >
          <Ionicons name='refresh' size={20} color='#FFFFFF' />
        </TouchableOpacity>
      </View>

      <FlatList
        data={insights}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item }) => (
          <AIInsightCard insight={item} theme={theme} />
        )}
        scrollEnabled={false}
      />
    </ScrollView>
  );

  return (
    <LinearGradient
      colors={['#0b1c38', '#1B365D', '#43cea2']}
      style={styles.container}
    >
      <View style={[styles.screen, { backgroundColor: c.bg }]}>
        {/* Tab Navigation */}
        <View style={[styles.tabNavigation, { backgroundColor: c.card }]}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'tasks' && { backgroundColor: c.primary },
            ]}
            onPress={() => setActiveTab('tasks')}
          >
            <Ionicons
              name='list'
              size={20}
              color={activeTab === 'tasks' ? '#FFFFFF' : c.sub}
            />
            <Text
              style={[
                styles.tabText,
                { color: activeTab === 'tasks' ? '#FFFFFF' : c.sub },
              ]}
            >
              Tasks
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'logs' && { backgroundColor: c.primary },
            ]}
            onPress={() => setActiveTab('logs')}
          >
            <Ionicons
              name='document-text'
              size={20}
              color={activeTab === 'logs' ? '#FFFFFF' : c.sub}
            />
            <Text
              style={[
                styles.tabText,
                { color: activeTab === 'logs' ? '#FFFFFF' : c.sub },
              ]}
            >
              Logs
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'insights' && { backgroundColor: c.primary },
            ]}
            onPress={() => setActiveTab('insights')}
          >
            <Ionicons
              name='bulb'
              size={20}
              color={activeTab === 'insights' ? '#FFFFFF' : c.sub}
            />
            <Text
              style={[
                styles.tabText,
                { color: activeTab === 'insights' ? '#FFFFFF' : c.sub },
              ]}
            >
              AI Insights
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {activeTab === 'tasks' && renderTasks()}
        {activeTab === 'logs' && renderLogs()}
        {activeTab === 'insights' && renderInsights()}
      </View>
    </LinearGradient>
  );
};

// ---------- Styles ----------
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screen: {
    flex: 1,
    padding: 16,
    gap: 16,
  },
  tabNavigation: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 4,
    marginBottom: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 6,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
  },
  tabHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  tabTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  refreshButton: {
    padding: 8,
    borderRadius: 12,
  },
  taskCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  taskHeader: {
    marginBottom: 12,
  },
  taskTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '600',
  },
  taskDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  taskDetails: {
    marginBottom: 12,
  },
  taskDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  taskDetailText: {
    fontSize: 14,
  },
  taskActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  photoButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  logCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  logDate: {
    fontSize: 16,
    fontWeight: '700',
  },
  logDetails: {
    marginBottom: 12,
  },
  logDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  logDetailText: {
    fontSize: 14,
  },
  logNotes: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  aiSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  aiSummaryText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  insightCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  insightType: {
    fontSize: 12,
    fontWeight: '700',
  },
  insightMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  insightAction: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default TasksAndLogsModule;
