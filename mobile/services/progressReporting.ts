import { apiService } from './api';
import { teamCollaborationService } from './teamCollaboration';
import { pushNotificationService } from './pushNotificationService';

export interface ProgressReport {
  id: string;
  projectId: string;
  type: 'daily' | 'weekly' | 'milestone' | 'delay';
  period: {
    start: string;
    end: string;
  };
  generatedAt: string;
  generatedBy: string;
  summary: {
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    delayedTasks: number;
    blockedTasks: number;
    overallProgress: number;
    budgetUsed: number;
    budgetRemaining: number;
    timelineStatus: 'on-track' | 'at-risk' | 'delayed';
  };
  taskUpdates: TaskUpdate[];
  delays: TaskDelay[];
  milestones: MilestoneUpdate[];
  teamPerformance: TeamPerformance[];
  recommendations: string[];
  nextActions: string[];
}

export interface TaskUpdate {
  taskId: string;
  taskName: string;
  status: 'completed' | 'in-progress' | 'delayed' | 'blocked';
  progress: number;
  assignedTo: string[];
  updatedBy: string;
  updatedAt: string;
  notes?: string;
  photos?: number;
  comments?: number;
}

export interface TaskDelay {
  taskId: string;
  taskName: string;
  originalDueDate: string;
  newDueDate: string;
  daysDelayed: number;
  reason: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
  reportedBy: string;
  reportedAt: string;
  mitigation?: string;
}

export interface MilestoneUpdate {
  milestoneId: string;
  milestoneName: string;
  targetDate: string;
  status: 'completed' | 'on-track' | 'at-risk' | 'delayed';
  completionDate?: string;
  daysAheadOrBehind?: number;
  notes?: string;
}

export interface TeamPerformance {
  memberId: string;
  memberName: string;
  role: string;
  tasksCompleted: number;
  tasksInProgress: number;
  tasksDelayed: number;
  averageCompletionTime: number;
  qualityScore: number;
  availability: number;
}

class ProgressReportingService {
  private reports: ProgressReport[] = [];

  // Generate Daily Report
  async generateDailyReport(projectId: string): Promise<ProgressReport> {
    try {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const report: ProgressReport = {
        id: `daily-${projectId}-${today.toISOString().split('T')[0]}`,
        projectId,
        type: 'daily',
        period: {
          start: yesterday.toISOString(),
          end: today.toISOString(),
        },
        generatedAt: today.toISOString(),
        generatedBy: 'current-user-id', // TODO: Get from auth context
        summary: await this.calculateProjectSummary(projectId),
        taskUpdates: await this.getTaskUpdates(projectId, yesterday, today),
        delays: await this.getTaskDelays(projectId, yesterday, today),
        milestones: await this.getMilestoneUpdates(projectId),
        teamPerformance: await this.getTeamPerformance(projectId),
        recommendations: await this.generateRecommendations(projectId),
        nextActions: await this.generateNextActions(projectId),
      };

      // Store report
      this.reports.push(report);

      // Send to backend
      await apiService.post(`/projects/${projectId}/reports/daily`, report);

      // Send delay notifications if any
      if (report.delays.length > 0) {
        await this.sendDelayNotification(projectId, report);
      }

      return report;
    } catch (error) {
      console.error('Error generating daily report:', error);
      throw error;
    }
  }

  // Generate Weekly Report
  async generateWeeklyReport(projectId: string): Promise<ProgressReport> {
    try {
      const today = new Date();
      const weekStart = this.getWeekStart(today);
      const weekEnd = this.getWeekEnd(today);

      const report: ProgressReport = {
        id: `weekly-${projectId}-${weekStart.toISOString().split('T')[0]}`,
        projectId,
        type: 'weekly',
        period: {
          start: weekStart.toISOString(),
          end: weekEnd.toISOString(),
        },
        generatedAt: today.toISOString(),
        generatedBy: 'current-user-id', // TODO: Get from auth context
        summary: await this.calculateProjectSummary(projectId),
        taskUpdates: await this.getTaskUpdates(projectId, weekStart, weekEnd),
        delays: await this.getTaskDelays(projectId, weekStart, weekEnd),
        milestones: await this.getMilestoneUpdates(projectId),
        teamPerformance: await this.getTeamPerformance(projectId),
        recommendations: await this.generateRecommendations(projectId),
        nextActions: await this.generateNextActions(projectId),
      };

      // Store report
      this.reports.push(report);

      // Send to backend
      await apiService.post(`/projects/${projectId}/reports/weekly`, report);

      // Send delay notifications if any
      if (report.delays.length > 0) {
        await this.sendDelayNotification(projectId, report);
      }

      return report;
    } catch (error) {
      console.error('Error generating weekly report:', error);
      throw error;
    }
  }

  // Send Delay Notifications
  async sendDelayNotification(
    projectId: string,
    report: ProgressReport
  ): Promise<void> {
    try {
      const criticalDelays = report.delays.filter(
        delay => delay.impact === 'critical' || delay.impact === 'high'
      );

      if (criticalDelays.length > 0) {
        await pushNotificationService.sendLocalNotification({
          title: '⚠️ Project Delays Detected',
          body: `${criticalDelays.length} critical/high impact delays found in ${report.type} report`,
          data: {
            projectId,
            reportId: report.id,
            delayCount: criticalDelays.length,
            type: 'delay-alert',
          },
        });

        // Notify project manager
        await teamCollaborationService.sendTaskNotification('', {
          id: `delay-notif-${Date.now()}`,
          taskId: '',
          type: 'delay',
          title: 'Project Delay Alert',
          message: `${criticalDelays.length} critical delays require immediate attention`,
          recipientId: 'project-manager-id', // TODO: Get actual project manager ID
          timestamp: new Date().toISOString(),
          read: false,
          priority: 'urgent',
        });
      }
    } catch (error) {
      console.error('Error sending delay notification:', error);
    }
  }

  // Get Reports
  async getProjectReports(
    projectId: string,
    type?: ProgressReport['type']
  ): Promise<ProgressReport[]> {
    try {
      const response = await apiService.get(`/projects/${projectId}/reports`, {
        params: type ? { type } : {},
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching project reports:', error);
      return this.reports.filter(
        report =>
          report.projectId === projectId && (!type || report.type === type)
      );
    }
  }

  // Private helper methods
  private async calculateProjectSummary(
    projectId: string
  ): Promise<ProgressReport['summary']> {
    try {
      const response = await apiService.get(`/projects/${projectId}/summary`);
      return response.data;
    } catch (error) {
      // Return mock data for development
      return {
        totalTasks: 25,
        completedTasks: 18,
        inProgressTasks: 5,
        delayedTasks: 2,
        blockedTasks: 0,
        overallProgress: 72,
        budgetUsed: 125000,
        budgetRemaining: 75000,
        timelineStatus: 'on-track',
      };
    }
  }

  private async getTaskUpdates(
    projectId: string,
    startDate: Date,
    endDate: Date
  ): Promise<TaskUpdate[]> {
    try {
      const response = await apiService.get(
        `/projects/${projectId}/tasks/updates`,
        {
          params: {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
          },
        }
      );
      return response.data;
    } catch (error) {
      // Return mock data for development
      return [
        {
          taskId: '1',
          taskName: 'Foundation Work',
          status: 'completed',
          progress: 100,
          assignedTo: ['2', '3'],
          updatedBy: '2',
          updatedAt: new Date().toISOString(),
          notes: 'Foundation completed ahead of schedule',
          photos: 3,
          comments: 2,
        },
        {
          taskId: '2',
          taskName: 'Framing',
          status: 'in-progress',
          progress: 65,
          assignedTo: ['1', '4'],
          updatedBy: '1',
          updatedAt: new Date().toISOString(),
          notes: 'Making good progress on framing',
          photos: 1,
          comments: 0,
        },
      ];
    }
  }

  private async getTaskDelays(
    projectId: string,
    startDate: Date,
    endDate: Date
  ): Promise<TaskDelay[]> {
    try {
      const response = await apiService.get(
        `/projects/${projectId}/tasks/delays`,
        {
          params: {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
          },
        }
      );
      return response.data;
    } catch (error) {
      // Return mock data for development
      return [
        {
          taskId: '3',
          taskName: 'Electrical Installation',
          originalDueDate: new Date(Date.now() - 86400000).toISOString(),
          newDueDate: new Date(Date.now() + 172800000).toISOString(),
          daysDelayed: 3,
          reason: 'Material delivery delayed due to weather',
          impact: 'medium',
          reportedBy: '3',
          reportedAt: new Date().toISOString(),
          mitigation: 'Ordered backup materials from alternative supplier',
        },
      ];
    }
  }

  private async getMilestoneUpdates(
    projectId: string
  ): Promise<MilestoneUpdate[]> {
    try {
      const response = await apiService.get(
        `/projects/${projectId}/milestones`
      );
      return response.data;
    } catch (error) {
      // Return mock data for development
      return [
        {
          milestoneId: '1',
          milestoneName: 'Foundation Complete',
          targetDate: new Date(Date.now() - 86400000).toISOString(),
          status: 'completed',
          completionDate: new Date(Date.now() - 172800000).toISOString(),
          daysAheadOrBehind: 1,
          notes: 'Completed ahead of schedule',
        },
        {
          milestoneId: '2',
          milestoneName: 'Framing Complete',
          targetDate: new Date(Date.now() + 604800000).toISOString(),
          status: 'on-track',
          notes: 'Progress is on schedule',
        },
      ];
    }
  }

  private async getTeamPerformance(
    projectId: string
  ): Promise<TeamPerformance[]> {
    try {
      const team = await teamCollaborationService.getProjectTeam(projectId);
      return team.map(member => ({
        memberId: member.id,
        memberName: member.name,
        role: member.role,
        tasksCompleted: Math.floor(Math.random() * 10),
        tasksInProgress: member.currentTasks,
        tasksDelayed: Math.floor(Math.random() * 3),
        averageCompletionTime: Math.floor(Math.random() * 5) + 1,
        qualityScore: Math.floor(Math.random() * 20) + 80,
        availability:
          member.availability === 'available'
            ? 100
            : member.availability === 'busy'
              ? 50
              : 0,
      }));
    } catch (error) {
      console.error('Error getting team performance:', error);
      return [];
    }
  }

  private async generateRecommendations(projectId: string): Promise<string[]> {
    // Mock recommendations based on project data
    return [
      'Consider adding additional resources to electrical installation task',
      'Schedule regular check-ins with subcontractors to prevent delays',
      'Review material delivery schedules to avoid future delays',
      'Implement daily standup meetings for better communication',
    ];
  }

  private async generateNextActions(projectId: string): Promise<string[]> {
    // Mock next actions based on project data
    return [
      'Follow up with electrical contractor on material delivery',
      'Schedule inspection for completed foundation work',
      'Review and approve framing plans for next phase',
      'Update project timeline based on current progress',
    ];
  }

  private getWeekStart(date: Date): Date {
    const start = new Date(date);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    start.setDate(diff);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  private getWeekEnd(date: Date): Date {
    const end = new Date(date);
    const day = end.getDay();
    const diff = end.getDate() - day + (day === 0 ? 0 : 7); // Adjust when day is Sunday
    end.setDate(diff);
    end.setHours(23, 59, 59, 999);
    return end;
  }

  // Utility methods
  formatReportPeriod(report: ProgressReport): string {
    const start = new Date(report.period.start);
    const end = new Date(report.period.end);

    if (report.type === 'daily') {
      return start.toLocaleDateString();
    } else if (report.type === 'weekly') {
      return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
    }

    return `${start.toLocaleDateString()} to ${end.toLocaleDateString()}`;
  }

  getTimelineStatusColor(
    status: ProgressReport['summary']['timelineStatus']
  ): string {
    const colors = {
      'on-track': '#4CAF50',
      'at-risk': '#FF9800',
      delayed: '#F44336',
    };
    return colors[status] || '#757575';
  }

  getImpactColor(impact: TaskDelay['impact']): string {
    const colors = {
      low: '#4CAF50',
      medium: '#FF9800',
      high: '#F44336',
      critical: '#9C27B0',
    };
    return colors[impact] || '#757575';
  }
}

export const progressReportingService = new ProgressReportingService();
