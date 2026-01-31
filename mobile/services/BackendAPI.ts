import AsyncStorage from '@react-native-async-storage/async-storage';

// API Configuration
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || 'http://192.168.1.115:3001/api';
const API_TIMEOUT = 10000; // 10 seconds

// Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface Project {
  id: string;
  title: string;
  status: 'Won' | 'Active' | 'On Hold' | 'Completed';
  progressPct: number;
  currency: string;
  budgeted: number;
  spent: number;
  committedPOs?: number;
  changeOrders?: { approvedAmount: number; approvedCount: number };
  startDate?: string;
  endDate?: string;
  daysLeft?: number;
  nextMilestone?: { title: string; date?: string };
  aheadBehindLabel?: string;
  costEfficiencyStatus: 'Good' | 'At Risk' | 'Critical';
  scheduleEfficiencyStatus: 'Good' | 'At Risk' | 'Critical';
  overallStatus: 'On Track' | 'At Risk' | 'Critical';
  team: { pm?: string; activeSubs?: number; crewCount?: number };
  lastUpdatedISO?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetLine {
  id: string;
  projectId: string;
  category: string;
  description: string;
  qty: number;
  unit?: string;
  unitCost: number;
  markupPct?: number;
  spent?: number;
  aiSuggested?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Expense {
  id: string;
  projectId: string;
  date: string;
  vendor: string;
  amount: number;
  taxAmount?: number;
  description?: string;
  costCode?: string;
  linkedLineId?: string;
  aiConfidence?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChangeOrder {
  id: string;
  projectId: string;
  title: string;
  amount: number;
  status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected';
  date?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  projectId: string;
  name: string;
  email: string;
  role:
    | 'project-manager'
    | 'supervisor'
    | 'foreman'
    | 'craftsman'
    | 'laborer'
    | 'subcontractor';
  status: 'active' | 'inactive' | 'on-leave';
  phone?: string;
  skills: string[];
  hourlyRate?: number;
  assignedTasks: string[];
  joinDate: string;
  avatar?: string;
  certifications?: string[];
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Milestone {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  status: 'not-started' | 'in-progress' | 'completed' | 'delayed';
  progress: number;
  dependencies?: string[];
  assignee?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedHours?: number;
  actualHours?: number;
  cost?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  projectId: string;
  channelId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  timestamp: string;
  type: 'text' | 'image' | 'file' | 'system';
  attachments?: {
    id: string;
    name: string;
    type: string;
    size: number;
    url?: string;
  }[];
  reactions?: {
    emoji: string;
    users: string[];
  }[];
  isRead: boolean;
  replyTo?: string;
  edited?: boolean;
  createdAt: string;
  updatedAt: string;
}

// API Client Class
class BackendAPI {
  private baseURL: string;
  private timeout: number;

  constructor(baseURL: string = API_BASE_URL, timeout: number = API_TIMEOUT) {
    this.baseURL = baseURL;
    this.timeout = timeout;
  }

  // Generic HTTP request method
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    // Create AbortController for timeout (compatible with React Native)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const token = await this.getAuthToken();

      const config: RequestInit = {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
          ...options.headers,
        },
        signal: controller.signal,
      };

      const response = await fetch(`${this.baseURL}${endpoint}`, config);
      
      // Clear timeout if request completes successfully
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      // Clear timeout on error
      clearTimeout(timeoutId);
      
      console.error('API Request Error:', error);
      
      // Check if error is due to timeout/abort
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          error: `Request timeout after ${this.timeout}ms`,
        };
      }
      
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  // Authentication
  private async getAuthToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem('auth_token');
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }

  private async setAuthToken(token: string): Promise<void> {
    try {
      await AsyncStorage.setItem('auth_token', token);
    } catch (error) {
      console.error('Error setting auth token:', error);
    }
  }

  // Projects API
  async getProjects(): Promise<ApiResponse<Project[]>> {
    return this.request<Project[]>('/projects');
  }

  async getProject(id: string): Promise<ApiResponse<Project>> {
    return this.request<Project>(`/projects/${id}`);
  }

  async createProject(
    project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ApiResponse<Project>> {
    return this.request<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify(project),
    });
  }

  async updateProject(
    id: string,
    updates: Partial<Project>
  ): Promise<ApiResponse<Project>> {
    return this.request<Project>(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async addExpense(
    projectId: string,
    expense: {
      amount: number;
      category?: string;
      vendor?: string;
      notes?: string;
      date?: string;
    }
  ): Promise<ApiResponse<any>> {
    return this.request<any>(`/projects/${projectId}/expenses`, {
      method: 'POST',
      body: JSON.stringify(expense),
    });
  }

  async deleteProject(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/projects/${id}`, {
      method: 'DELETE',
    });
  }

  // Budget API
  async getBudgetLines(projectId: string): Promise<ApiResponse<BudgetLine[]>> {
    return this.request<BudgetLine[]>(`/projects/${projectId}/budget/lines`);
  }

  async createBudgetLine(
    projectId: string,
    line: Omit<BudgetLine, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>
  ): Promise<ApiResponse<BudgetLine>> {
    return this.request<BudgetLine>(`/projects/${projectId}/budget/lines`, {
      method: 'POST',
      body: JSON.stringify(line),
    });
  }

  async updateBudgetLine(
    projectId: string,
    lineId: string,
    updates: Partial<BudgetLine>
  ): Promise<ApiResponse<BudgetLine>> {
    return this.request<BudgetLine>(
      `/projects/${projectId}/budget/lines/${lineId}`,
      {
        method: 'PUT',
        body: JSON.stringify(updates),
      }
    );
  }

  async deleteBudgetLine(
    projectId: string,
    lineId: string
  ): Promise<ApiResponse<void>> {
    return this.request<void>(`/projects/${projectId}/budget/lines/${lineId}`, {
      method: 'DELETE',
    });
  }

  async getExpenses(projectId: string): Promise<ApiResponse<Expense[]>> {
    return this.request<Expense[]>(`/projects/${projectId}/budget/expenses`);
  }

  async createExpense(
    projectId: string,
    expense: Omit<Expense, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>
  ): Promise<ApiResponse<Expense>> {
    return this.request<Expense>(`/projects/${projectId}/budget/expenses`, {
      method: 'POST',
      body: JSON.stringify(expense),
    });
  }

  async getChangeOrders(
    projectId: string
  ): Promise<ApiResponse<ChangeOrder[]>> {
    return this.request<ChangeOrder[]>(
      `/projects/${projectId}/budget/change-orders`
    );
  }

  async createChangeOrder(
    projectId: string,
    changeOrder: Omit<
      ChangeOrder,
      'id' | 'projectId' | 'createdAt' | 'updatedAt'
    >
  ): Promise<ApiResponse<ChangeOrder>> {
    return this.request<ChangeOrder>(
      `/projects/${projectId}/budget/change-orders`,
      {
        method: 'POST',
        body: JSON.stringify(changeOrder),
      }
    );
  }

  // Team API
  async getTeamMembers(projectId: string): Promise<ApiResponse<TeamMember[]>> {
    return this.request<TeamMember[]>(`/projects/${projectId}/team`);
  }

  async createTeamMember(
    projectId: string,
    member: Omit<TeamMember, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>
  ): Promise<ApiResponse<TeamMember>> {
    return this.request<TeamMember>(`/projects/${projectId}/team`, {
      method: 'POST',
      body: JSON.stringify(member),
    });
  }

  async updateTeamMember(
    projectId: string,
    memberId: string,
    updates: Partial<TeamMember>
  ): Promise<ApiResponse<TeamMember>> {
    return this.request<TeamMember>(`/projects/${projectId}/team/${memberId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteTeamMember(
    projectId: string,
    memberId: string
  ): Promise<ApiResponse<void>> {
    return this.request<void>(`/projects/${projectId}/team/${memberId}`, {
      method: 'DELETE',
    });
  }

  // Timeline API
  async getMilestones(projectId: string): Promise<ApiResponse<Milestone[]>> {
    return this.request<Milestone[]>(
      `/projects/${projectId}/timeline/milestones`
    );
  }

  async createMilestone(
    projectId: string,
    milestone: Omit<Milestone, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>
  ): Promise<ApiResponse<Milestone>> {
    return this.request<Milestone>(
      `/projects/${projectId}/timeline/milestones`,
      {
        method: 'POST',
        body: JSON.stringify(milestone),
      }
    );
  }

  async updateMilestone(
    projectId: string,
    milestoneId: string,
    updates: Partial<Milestone>
  ): Promise<ApiResponse<Milestone>> {
    return this.request<Milestone>(
      `/projects/${projectId}/timeline/milestones/${milestoneId}`,
      {
        method: 'PUT',
        body: JSON.stringify(updates),
      }
    );
  }

  async deleteMilestone(
    projectId: string,
    milestoneId: string
  ): Promise<ApiResponse<void>> {
    return this.request<void>(
      `/projects/${projectId}/timeline/milestones/${milestoneId}`,
      {
        method: 'DELETE',
      }
    );
  }

  // Messages API
  async getMessages(
    projectId: string,
    channelId: string
  ): Promise<ApiResponse<Message[]>> {
    return this.request<Message[]>(
      `/projects/${projectId}/messages/${channelId}`
    );
  }

  async sendMessage(
    projectId: string,
    channelId: string,
    message: Omit<
      Message,
      'id' | 'projectId' | 'channelId' | 'createdAt' | 'updatedAt'
    >
  ): Promise<ApiResponse<Message>> {
    return this.request<Message>(
      `/projects/${projectId}/messages/${channelId}`,
      {
        method: 'POST',
        body: JSON.stringify(message),
      }
    );
  }

  async updateMessage(
    projectId: string,
    channelId: string,
    messageId: string,
    updates: Partial<Message>
  ): Promise<ApiResponse<Message>> {
    return this.request<Message>(
      `/projects/${projectId}/messages/${channelId}/${messageId}`,
      {
        method: 'PUT',
        body: JSON.stringify(updates),
      }
    );
  }

  // AI Services
  async generateDraftBudget(
    projectId: string,
    projectType: string
  ): Promise<ApiResponse<BudgetLine[]>> {
    return this.request<BudgetLine[]>(`/ai/generate-budget`, {
      method: 'POST',
      body: JSON.stringify({ projectId, projectType }),
    });
  }

  async categorizeExpense(expenseData: {
    description: string;
    amount: number;
    vendor: string;
  }): Promise<ApiResponse<{ category: string; confidence: number }>> {
    return this.request<{ category: string; confidence: number }>(
      '/ai/categorize-expense',
      {
        method: 'POST',
        body: JSON.stringify(expenseData),
      }
    );
  }

  async processReceipt(imageData: string): Promise<
    ApiResponse<{
      vendor: string;
      amount: number;
      date: string;
      items: string[];
    }>
  > {
    return this.request<{
      vendor: string;
      amount: number;
      date: string;
      items: string[];
    }>('/ai/process-receipt', {
      method: 'POST',
      body: JSON.stringify({ imageData }),
    });
  }

  // File Upload
  async uploadFile(file: {
    uri: string;
    type: string;
    name: string;
  }): Promise<ApiResponse<{ url: string; id: string }>> {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      type: file.type,
      name: file.name,
    } as any);

    try {
      const token = await this.getAuthToken();

      const response = await fetch(`${this.baseURL}/upload`, {
        method: 'POST',
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error('File Upload Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  // Authentication
  async login(
    email: string,
    password: string
  ): Promise<ApiResponse<{ token: string; user: any }>> {
    const response = await this.request<{ token: string; user: any }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }
    );

    if (response.success && response.data?.token) {
      await this.setAuthToken(response.data.token);
    }

    return response;
  }

  async logout(): Promise<void> {
    await AsyncStorage.removeItem('auth_token');
  }

  async register(userData: {
    email: string;
    password: string;
    name: string;
  }): Promise<ApiResponse<{ token: string; user: any }>> {
    const response = await this.request<{ token: string; user: any }>(
      '/auth/register',
      {
        method: 'POST',
        body: JSON.stringify(userData),
      }
    );

    if (response.success && response.data?.token) {
      await this.setAuthToken(response.data.token);
    }

    return response;
  }

  // Health Check
  async healthCheck(): Promise<
    ApiResponse<{ status: string; timestamp: string }>
  > {
    return this.request<{ status: string; timestamp: string }>('/health');
  }
}

// Create and export API instance
export const api = new BackendAPI();
export default api;
