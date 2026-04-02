import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import {
  apiService,
  User,
  Project,
  Subcontractor,
  Client,
  Analytics,
} from '../services/api';

// API Context State
interface ApiContextState {
  // Authentication
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Data
  projects: Project[];
  subcontractors: Subcontractor[];
  clients: Client[];
  analytics: Analytics | null;

  // Loading states
  isProjectsLoading: boolean;
  isSubcontractorsLoading: boolean;
  isClientsLoading: boolean;
  isAnalyticsLoading: boolean;

  // Actions
  login: (email: string, password: string) => Promise<boolean>;
  register: (
    userData: Partial<User> & { password: string }
  ) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;

  // Project actions (optional override: use when calling right after setIsAuthenticated — state is still stale)
  loadProjects: (authenticatedOverride?: boolean) => Promise<void>;
  createProject: (project: Partial<Project>) => Promise<Project | null>;
  updateProject: (
    id: string,
    project: Partial<Project>
  ) => Promise<Project | null>;
  deleteProject: (id: string) => Promise<boolean>;

  // Subcontractor actions
  loadSubcontractors: (filters?: any) => Promise<void>;
  bookSubcontractor: (id: string, bookingData: any) => Promise<boolean>;

  // Client actions
  loadClients: () => Promise<void>;
  createClient: (client: Partial<Client>) => Promise<Client | null>;
  updateClient: (id: string, client: Partial<Client>) => Promise<Client | null>;
  deleteClient: (id: string) => Promise<boolean>;

  // Analytics actions
  loadAnalytics: (authenticatedOverride?: boolean) => Promise<void>;

  // Profile actions
  updateProfile: (profile: Partial<User>) => Promise<boolean>;
  updatePreferences: (
    preferences: Partial<User['preferences']>
  ) => Promise<boolean>;

  // Utility
  clearError: () => void;
}

// Create context
const ApiContext = createContext<ApiContextState | undefined>(undefined);

// Provider component
interface ApiProviderProps {
  children: ReactNode;
}

export const ApiProvider: React.FC<ApiProviderProps> = ({ children }) => {
  // State
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data state
  const [projects, setProjects] = useState<Project[]>([]);
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);

  // Loading states
  const [isProjectsLoading, setIsProjectsLoading] = useState(false);
  const [isSubcontractorsLoading, setIsSubcontractorsLoading] = useState(false);
  const [isClientsLoading, setIsClientsLoading] = useState(false);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false);

  // Initialize app
  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // First test connectivity (with timeout to avoid hanging)
      const isConnected = await Promise.race([
        apiService.testConnection(),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 3000))
      ]);
      if (!isConnected) {
        // Backend not reachable - this is OK, app can work offline
        if (__DEV__) {
          console.log('ℹ️  Backend not reachable, app will work in offline mode');
        }
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      // Check if user is authenticated
      try {
        const authResponse = await apiService.checkAuthStatus();
        if (authResponse.isAuthenticated && authResponse.user) {
          // User is authenticated, set user data
          setUser(authResponse.user);
          setIsAuthenticated(true);

          // Load initial data (don't await - let them load in background)
          Promise.all([
            loadProjects(true),
            loadClients(),
            loadAnalytics(true),
          ]).catch((err) => {
            if (__DEV__) {
              console.warn('⚠️  Some initial data failed to load:', err);
            }
          });
        } else {
          // User is not authenticated, which is normal for new users
          setIsAuthenticated(false);
        }
      } catch (authErr: any) {
        // Auth check failed - don't block app initialization
        if (__DEV__) {
          console.warn('⚠️  Auth check failed, continuing without auth:', authErr?.message || authErr);
        }
        setIsAuthenticated(false);
      }
    } catch (err: any) {
      if (__DEV__) {
        console.warn('⚠️  App initialization had issues (non-critical):', err?.message || err);
      }
      // Don't set error for initialization failures - app can still work
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Authentication actions
  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await apiService.login({ email, password });
      if (response.user && response.token) {
        setUser(response.user);
        setIsAuthenticated(true);

        // Load initial data after login
        await Promise.all([
          loadProjects(true),
          loadClients(),
          loadAnalytics(true),
        ]);

        return true;
      } else {
        setError('Login failed');
        return false;
      }
    } catch (err) {
      setError('Login failed');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (
    userData: Partial<User> & { password: string }
  ): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await apiService.register(userData);
      if (response.user && response.token) {
        setUser(response.user);
        setIsAuthenticated(true);
        return true;
      } else {
        setError('Registration failed');
        return false;
      }
    } catch (err) {
      setError('Registration failed');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      // Sync any pending data to backend before logout
      // (Projects, clients, etc. are already saved to backend when created/updated)
      
      await apiService.logout();
    } catch (err) {
      if (__DEV__) {
        console.error('Logout error:', err);
      }
    } finally {
      // Only clear authentication state, not user data
      // User data (projects, clients, etc.) is stored in backend database
      // and will be loaded again when user signs back in
      setUser(null);
      setIsAuthenticated(false);
      
      // Clear local cache, but data remains in backend
      setProjects([]);
      setSubcontractors([]);
      setClients([]);
      setAnalytics(null);
    }
  };

  const refreshUser = async (): Promise<void> => {
    try {
      const userData = await apiService.getCurrentUser();
      if (userData) {
        setUser(userData);
      }
    } catch (err) {
      if (__DEV__) {
        console.error('Failed to refresh user:', err);
      }
    }
  };

  // Project actions
  const loadProjects = async (
    authenticatedOverride?: boolean
  ): Promise<void> => {
    try {
      setIsProjectsLoading(true);
      setError(null);
      const authed =
        authenticatedOverride !== undefined
          ? authenticatedOverride
          : isAuthenticated;
      const projectsData = authed
        ? await apiService.getProjects()
        : await apiService.getPublicProjects();
      if (projectsData) {
        setProjects(Array.isArray(projectsData) ? projectsData : []);
      }
    } catch (err: any) {
      // Only set error for non-network errors to avoid spamming
      if (!err?.isNetworkError && !err?.isTimeout) {
        setError('Failed to load projects');
      }
      if (__DEV__) {
        console.warn('⚠️  Failed to load projects:', err?.message || err);
      }
      // Set empty array on error to prevent UI crashes
      setProjects([]);
    } finally {
      setIsProjectsLoading(false);
    }
  };

  const createProject = async (
    project: Partial<Project>
  ): Promise<Project | null> => {
    try {
      const newProject = await apiService.createProject(project);
      if (newProject) {
        setProjects(prev => [...prev, newProject]);
        return newProject;
      } else {
        setError('Failed to create project');
        return null;
      }
    } catch (err) {
      setError('Failed to create project');
      return null;
    }
  };

  const updateProject = async (
    id: string,
    project: Partial<Project>
  ): Promise<Project | null> => {
    try {
      const updatedProject = await apiService.updateProject(id, project);
      if (updatedProject) {
        setProjects(prev => prev.map(p => (p.id === id ? updatedProject : p)));
        return updatedProject;
      } else {
        setError('Failed to update project');
        return null;
      }
    } catch (err) {
      setError('Failed to update project');
      return null;
    }
  };

  const deleteProject = async (id: string): Promise<boolean> => {
    try {
      await apiService.deleteProject(id);
      setProjects(prev => prev.filter(p => p.id !== id));
      return true;
    } catch (err) {
      setError('Failed to delete project');
      return false;
    }
  };

  // Subcontractor actions
  const loadSubcontractors = async (filters?: any): Promise<void> => {
    try {
      setIsSubcontractorsLoading(true);
      const subcontractorsData = await apiService.getSubcontractors(filters);
      if (subcontractorsData) {
        setSubcontractors(subcontractorsData);
      }
    } catch (err) {
      setError('Failed to load subcontractors');
    } finally {
      setIsSubcontractorsLoading(false);
    }
  };

  const bookSubcontractor = async (
    id: string,
    bookingData: any
  ): Promise<boolean> => {
    try {
      const result = await apiService.bookSubcontractor(id, bookingData);
      if (result) {
        return true;
      } else {
        setError('Failed to book subcontractor');
        return false;
      }
    } catch (err) {
      setError('Failed to book subcontractor');
      return false;
    }
  };

  // Client actions
  const loadClients = async (): Promise<void> => {
    try {
      setIsClientsLoading(true);
      const clientsData = await apiService.getClients();
      if (clientsData) {
        setClients(clientsData);
      }
    } catch (err) {
      setError('Failed to load clients');
    } finally {
      setIsClientsLoading(false);
    }
  };

  const createClient = async (
    client: Partial<Client>
  ): Promise<Client | null> => {
    try {
      const newClient = await apiService.createClient(client);
      if (newClient) {
        setClients(prev => [...prev, newClient]);
        return newClient;
      } else {
        setError('Failed to create client');
        return null;
      }
    } catch (err) {
      setError('Failed to create client');
      return null;
    }
  };

  const updateClient = async (
    id: string,
    client: Partial<Client>
  ): Promise<Client | null> => {
    try {
      const updatedClient = await apiService.updateClient(id, client);
      if (updatedClient) {
        setClients(prev => prev.map(c => (c.id === id ? updatedClient : c)));
        return updatedClient;
      } else {
        setError('Failed to update client');
        return null;
      }
    } catch (err) {
      setError('Failed to update client');
      return null;
    }
  };

  const deleteClient = async (id: string): Promise<boolean> => {
    try {
      await apiService.deleteClient(id);
      setClients(prev => prev.filter(c => c.id !== id));
      return true;
    } catch (err) {
      setError('Failed to delete client');
      return false;
    }
  };

  // Analytics actions
  const loadAnalytics = async (
    authenticatedOverride?: boolean
  ): Promise<void> => {
    try {
      setIsAnalyticsLoading(true);
      setError(null);
      const authed =
        authenticatedOverride !== undefined
          ? authenticatedOverride
          : isAuthenticated;
      const analyticsData = authed
        ? await apiService.getAnalytics()
        : await apiService.getPublicAnalytics();
      if (analyticsData) {
        setAnalytics(analyticsData);
      } else {
        // Set default analytics if none returned
        setAnalytics({
          revenue: 0,
          projects: 0,
          leads: 0,
          conversionRate: 0,
        });
      }
    } catch (err: any) {
      // Don't set error for analytics failures - use defaults instead
      if (__DEV__) {
        console.warn('⚠️  Failed to load analytics, using defaults:', err?.message || err);
      }
      // Set default analytics on error
      setAnalytics({
        revenue: 0,
        projects: 0,
        leads: 0,
        conversionRate: 0,
      });
    } finally {
      setIsAnalyticsLoading(false);
    }
  };

  // Profile actions
  const updateProfile = async (profile: Partial<User>): Promise<boolean> => {
    try {
      const updatedUser = await apiService.updateProfile(profile);
      if (updatedUser) {
        setUser(updatedUser);
        return true;
      } else {
        setError('Failed to update profile');
        return false;
      }
    } catch (err) {
      setError('Failed to update profile');
      return false;
    }
  };

  const updatePreferences = async (
    preferences: Partial<User['preferences']>
  ): Promise<boolean> => {
    try {
      const updatedSettings = await apiService.updatePreferences(preferences);
      if (updatedSettings) {
        // Update user preferences in local state
        setUser(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            preferences: {
              ...prev.preferences,
              ...preferences,
            },
          };
        });
        return true;
      } else {
        setError('Failed to update preferences');
        return false;
      }
    } catch (err) {
      setError('Failed to update preferences');
      return false;
    }
  };

  // Utility
  const clearError = () => {
    setError(null);
  };

  // Context value
  const value: ApiContextState = {
    // State
    user,
    isAuthenticated,
    isLoading,
    error,

    // Data
    projects,
    subcontractors,
    clients,
    analytics,

    // Loading states
    isProjectsLoading,
    isSubcontractorsLoading,
    isClientsLoading,
    isAnalyticsLoading,

    // Actions
    login,
    register,
    logout,
    refreshUser,
    loadProjects,
    createProject,
    updateProject,
    deleteProject,
    loadSubcontractors,
    bookSubcontractor,
    loadClients,
    createClient,
    updateClient,
    deleteClient,
    loadAnalytics,
    updateProfile,
    updatePreferences,
    clearError,
  };

  return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>;
};

// Hook to use API context
export const useApi = (): ApiContextState => {
  const context = useContext(ApiContext);
  if (context === undefined) {
    throw new Error('useApi must be used within an ApiProvider');
  }
  return context;
};
