import { apiService } from '../../services/api';

// Mock fetch globally
global.fetch = jest.fn();

describe('API Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear AsyncStorage before each test
    const AsyncStorage =
      require('@react-native-async-storage/async-storage').default;
    if (AsyncStorage && AsyncStorage.clear) {
      AsyncStorage.clear();
    }
  });

  describe('Authentication', () => {
    it('should login successfully', async () => {
      const mockResponse = {
        token: 'test-token',
        user: {
          id: '1',
          name: 'Test User',
          email: 'test@example.com',
        },
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await apiService.login({
        email: 'test@example.com',
        password: 'password',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/auth/login',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'password',
          }),
        })
      );
    });

    it('should handle login failure', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      const result = await apiService.login({
        email: 'test@example.com',
        password: 'wrong-password',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('HTTP 401: Unauthorized');
    });

    it('should register successfully', async () => {
      const mockResponse = {
        token: 'test-token',
        user: {
          id: '1',
          name: 'New User',
          email: 'new@example.com',
        },
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await apiService.register({
        name: 'New User',
        email: 'new@example.com',
        password: 'password',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse);
    });

    it('should logout successfully', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Logged out successfully' }),
      });

      await apiService.logout();

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/auth/logout',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  describe('Projects', () => {
    it('should fetch projects successfully', async () => {
      const mockProjects = [
        {
          id: '1',
          name: 'Test Project',
          status: 'Draft',
        },
      ];

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockProjects,
      });

      const result = await apiService.getProjects();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockProjects);
    });

    it('should create project successfully', async () => {
      const mockProject = {
        id: '1',
        name: 'New Project',
        status: 'Draft',
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockProject,
      });

      const result = await apiService.createProject({
        name: 'New Project',
        location: 'Test Location',
        projectType: 'Residential',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockProject);
    });
  });

  describe('Subcontractors', () => {
    it('should fetch subcontractors with filters', async () => {
      const mockSubcontractors = [
        {
          id: '1',
          name: 'Test Subcontractor',
          specialty: 'Electrical',
          rating: 4.5,
        },
      ];

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSubcontractors,
      });

      const result = await apiService.getSubcontractors({
        specialty: 'Electrical',
        location: 'San Diego',
        rating: 4.0,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockSubcontractors);
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/subcontractors?specialty=Electrical&location=San%20Diego&rating=4',
        expect.any(Object)
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await apiService.getProjects();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should handle timeout errors', async () => {
      (fetch as jest.Mock).mockImplementationOnce(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout')), 100);
        });
      });

      const result = await apiService.getProjects();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Timeout');
    });

    it('should handle unauthorized errors', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      const result = await apiService.getProjects();

      expect(result.success).toBe(false);
      expect(result.error).toBe('HTTP 401: Unauthorized');
    });
  });

  describe('Token Management', () => {
    it('should include authorization header when token exists', async () => {
      // Set token
      await apiService.saveToken('test-token');

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await apiService.getProjects();

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/projects',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });

    it('should not include authorization header when no token', async () => {
      // Clear token
      await apiService.clearToken();

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await apiService.getProjects();

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/projects',
        expect.objectContaining({
          headers: expect.not.objectContaining({
            Authorization: expect.any(String),
          }),
        })
      );
    });
  });
});
