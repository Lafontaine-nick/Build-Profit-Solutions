import { apiService } from './api';
import { pushNotificationService } from './pushNotificationService';

export interface TeamMember {
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

export interface TaskNotification {
  id: string;
  taskId: string;
  type: 'assignment' | 'update' | 'deadline' | 'delay' | 'completion';
  title: string;
  message: string;
  recipientId: string;
  timestamp: string;
  read: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export interface TaskComment {
  id: string;
  taskId: string;
  text: string;
  author: TeamMember;
  timestamp: string;
  mentions: string[];
  attachments?: string[];
}

export interface TaskAssignment {
  taskId: string;
  assignedTo: TeamMember[];
  assignedBy: string;
  assignedAt: string;
  notes?: string;
}

class TeamCollaborationService {
  private teamMembers: TeamMember[] = [];
  private notifications: TaskNotification[] = [];

  // Team Management
  async getProjectTeam(projectId: string): Promise<TeamMember[]> {
    try {
      const response = await apiService.get(`/projects/${projectId}/team`);
      this.teamMembers = response.data;
      return this.teamMembers;
    } catch (error) {
      console.error('Error fetching project team:', error);
      return this.teamMembers;
    }
  }

  async addTeamMember(
    projectId: string,
    member: Omit<TeamMember, 'id'>
  ): Promise<TeamMember> {
    try {
      const response = await apiService.post(
        `/projects/${projectId}/team`,
        member
      );
      const newMember = response.data;
      this.teamMembers.push(newMember);
      return newMember;
    } catch (error) {
      console.error('Error adding team member:', error);
      throw error;
    }
  }

  async updateTeamMember(
    memberId: string,
    updates: Partial<TeamMember>
  ): Promise<TeamMember> {
    try {
      const response = await apiService.put(`/team/${memberId}`, updates);
      const updatedMember = response.data;

      const index = this.teamMembers.findIndex(m => m.id === memberId);
      if (index !== -1) {
        this.teamMembers[index] = updatedMember;
      }

      return updatedMember;
    } catch (error) {
      console.error('Error updating team member:', error);
      throw error;
    }
  }

  // Task Assignment
  async assignTeamToTask(
    taskId: string,
    teamMembers: TeamMember[]
  ): Promise<TaskAssignment> {
    try {
      const assignment: TaskAssignment = {
        taskId,
        assignedTo: teamMembers,
        assignedBy: 'current-user-id', // TODO: Get from auth context
        assignedAt: new Date().toISOString(),
        notes: `Assigned to ${teamMembers.map(m => m.name).join(', ')}`,
      };

      await apiService.post(`/tasks/${taskId}/assign`, assignment);

      // Send notifications to assigned members
      for (const member of teamMembers) {
        await this.sendTaskNotification(taskId, {
          id: `notif-${Date.now()}-${member.id}`,
          taskId,
          type: 'assignment',
          title: 'New Task Assignment',
          message: `You have been assigned to a new task`,
          recipientId: member.id,
          timestamp: new Date().toISOString(),
          read: false,
          priority: 'medium',
        });
      }

      return assignment;
    } catch (error) {
      console.error('Error assigning team to task:', error);
      throw error;
    }
  }

  async unassignTeamFromTask(taskId: string, memberId: string): Promise<void> {
    try {
      await apiService.delete(`/tasks/${taskId}/assign/${memberId}`);

      // Send notification to unassigned member
      await this.sendTaskNotification(taskId, {
        id: `notif-${Date.now()}-${memberId}`,
        taskId,
        type: 'update',
        title: 'Task Assignment Removed',
        message: 'You have been unassigned from this task',
        recipientId: memberId,
        timestamp: new Date().toISOString(),
        read: false,
        priority: 'low',
      });
    } catch (error) {
      console.error('Error unassigning team from task:', error);
      throw error;
    }
  }

  // Task Progress Updates
  async updateTaskProgress(
    taskId: string,
    progress: number,
    updatedBy: string,
    notes?: string
  ): Promise<void> {
    try {
      await apiService.put(`/tasks/${taskId}/progress`, {
        progress,
        updatedBy,
        notes,
        timestamp: new Date().toISOString(),
      });

      // Get task details to notify team members
      const taskResponse = await apiService.get(`/tasks/${taskId}`);
      const task = taskResponse.data;

      // Send notifications to all assigned team members
      for (const member of task.assignedTo || []) {
        await this.sendTaskNotification(taskId, {
          id: `notif-${Date.now()}-${member.id}`,
          taskId,
          type: 'update',
          title: 'Task Progress Updated',
          message: `Task progress updated to ${progress}%`,
          recipientId: member.id,
          timestamp: new Date().toISOString(),
          read: false,
          priority: 'medium',
        });
      }
    } catch (error) {
      console.error('Error updating task progress:', error);
      throw error;
    }
  }

  // Comments and Communication
  async addTaskComment(
    taskId: string,
    comment: Omit<TaskComment, 'id' | 'timestamp'>
  ): Promise<TaskComment> {
    try {
      const newComment: TaskComment = {
        ...comment,
        id: `comment-${Date.now()}`,
        timestamp: new Date().toISOString(),
      };

      await apiService.post(`/tasks/${taskId}/comments`, newComment);

      // Notify mentioned users
      for (const mention of comment.mentions) {
        await this.sendTaskNotification(taskId, {
          id: `notif-${Date.now()}-${mention}`,
          taskId,
          type: 'update',
          title: 'You were mentioned in a comment',
          message: `@${comment.author.name} mentioned you in a task comment`,
          recipientId: mention,
          timestamp: new Date().toISOString(),
          read: false,
          priority: 'medium',
        });
      }

      return newComment;
    } catch (error) {
      console.error('Error adding task comment:', error);
      throw error;
    }
  }

  async getTaskComments(taskId: string): Promise<TaskComment[]> {
    try {
      const response = await apiService.get(`/tasks/${taskId}/comments`);
      return response.data;
    } catch (error) {
      console.error('Error fetching task comments:', error);
      return [];
    }
  }

  // Notifications
  async sendTaskNotification(
    taskId: string,
    notification: TaskNotification
  ): Promise<void> {
    try {
      // Store notification locally
      this.notifications.push(notification);

      // Send to backend
      await apiService.post(`/tasks/${taskId}/notifications`, notification);

      // Send push notification
      await pushNotificationService.sendLocalNotification({
        title: notification.title,
        body: notification.message,
        data: {
          taskId,
          notificationId: notification.id,
          type: notification.type,
        },
      });
    } catch (error) {
      console.error('Error sending task notification:', error);
    }
  }

  async getTaskNotifications(taskId: string): Promise<TaskNotification[]> {
    try {
      const response = await apiService.get(`/tasks/${taskId}/notifications`);
      return response.data;
    } catch (error) {
      console.error('Error fetching task notifications:', error);
      return this.notifications.filter(n => n.taskId === taskId);
    }
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    try {
      await apiService.put(`/notifications/${notificationId}/read`, {
        read: true,
      });

      const notification = this.notifications.find(
        n => n.id === notificationId
      );
      if (notification) {
        notification.read = true;
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  // Utility Methods
  getAvailableTeamMembers(): TeamMember[] {
    return this.teamMembers.filter(
      member =>
        member.availability === 'available' &&
        member.currentTasks < member.maxTasks
    );
  }

  getTeamMemberById(id: string): TeamMember | undefined {
    return this.teamMembers.find(member => member.id === id);
  }

  getTeamMembersByRole(role: TeamMember['role']): TeamMember[] {
    return this.teamMembers.filter(member => member.role === role);
  }

  // Mock data for development
  async loadMockTeamData(projectId: string): Promise<TeamMember[]> {
    const mockTeam: TeamMember[] = [
      {
        id: '1',
        name: 'John Smith',
        email: 'john@example.com',
        role: 'project-manager',
        phone: '+1-555-0123',
        skills: ['Project Management', 'Budget Planning', 'Team Leadership'],
        availability: 'available',
        currentTasks: 3,
        maxTasks: 10,
      },
      {
        id: '2',
        name: 'Mike Johnson',
        email: 'mike@example.com',
        role: 'foreman',
        phone: '+1-555-0124',
        skills: ['Construction', 'Safety Management', 'Equipment Operation'],
        availability: 'available',
        currentTasks: 5,
        maxTasks: 8,
      },
      {
        id: '3',
        name: 'Sarah Wilson',
        email: 'sarah@example.com',
        role: 'contractor',
        phone: '+1-555-0125',
        skills: ['Electrical Work', 'Code Compliance', 'Quality Control'],
        availability: 'busy',
        currentTasks: 7,
        maxTasks: 8,
      },
      {
        id: '4',
        name: 'David Brown',
        email: 'david@example.com',
        role: 'subcontractor',
        phone: '+1-555-0126',
        skills: ['Plumbing', 'HVAC', 'Maintenance'],
        availability: 'available',
        currentTasks: 2,
        maxTasks: 6,
      },
    ];

    this.teamMembers = mockTeam;
    return mockTeam;
  }
}

export const teamCollaborationService = new TeamCollaborationService();
