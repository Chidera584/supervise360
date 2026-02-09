import type { LoginRequest, RegisterRequest, AuthResponse, ApiResponse } from '../types/database';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

console.log('API Base URL:', API_BASE_URL); // Debug log

class ApiClient {
  private baseURL: string;
  private token: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.token = localStorage.getItem('supervise360_token');
  }

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { Authorization: `Bearer ${this.token}` }),
        ...options.headers,
      },
      ...options,
    };

    try {
      console.log('Making API request to:', url);
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }
        return {
          success: false,
          message: errorData.message || `HTTP error! status: ${response.status}`,
          error: errorData.message || `HTTP error! status: ${response.status}`
        };
      }

      const data = await response.json();
      console.log('API Response:', data);
      return data;
    } catch (error) {
      console.error('API request failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Network error',
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('supervise360_token', token);
    } else {
      localStorage.removeItem('supervise360_token');
    }
  }

  // Auth endpoints
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    console.log('Attempting login with:', credentials.email);
    const response = await this.request<AuthResponse['data']>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    console.log('Login response received:', response);

    if (response.success && response.data?.token) {
      this.setToken(response.data.token);
      console.log('Token set successfully');
    }

    return response as AuthResponse;
  }

  async register(userData: RegisterRequest): Promise<AuthResponse> {
    const response = await this.request<AuthResponse['data']>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });

    if (response.success && response.data?.token) {
      this.setToken(response.data.token);
    }

    return response as AuthResponse;
  }

  async getCurrentUser(): Promise<AuthResponse> {
    return this.request<AuthResponse['data']>('/auth/me');
  }

  async logout(): Promise<ApiResponse> {
    const response = await this.request('/auth/logout', {
      method: 'POST',
    });
    
    this.setToken(null);
    return response;
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<ApiResponse> {
    return this.request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  // User endpoints
  async getUsers(): Promise<ApiResponse> {
    return this.request('/users');
  }

  async getStudents(): Promise<ApiResponse> {
    return this.request('/users/students');
  }

  async getSupervisors(): Promise<ApiResponse> {
    return this.request('/users/supervisors');
  }

  async getUser(id: number): Promise<ApiResponse> {
    return this.request(`/users/${id}`);
  }

  async updateUser(id: number, data: any): Promise<ApiResponse> {
    return this.request(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async updateUserStatus(id: number, isActive: boolean): Promise<ApiResponse> {
    return this.request(`/users/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ is_active: isActive }),
    });
  }

  // Health check
  async healthCheck(): Promise<ApiResponse> {
    return fetch(`${this.baseURL.replace('/api', '')}/health`)
      .then(res => res.json())
      .catch(error => ({
        success: false,
        message: 'Failed to connect to server',
        error: error.message
      }));
  }

  // Groups endpoints
  async getGroups(): Promise<ApiResponse> {
    return this.request('/groups');
  }

  // Get current student's group (by matric number) - real-time from database
  async getMyGroup(): Promise<ApiResponse> {
    return this.request('/groups/my-group');
  }

  async formGroups(students: any[], department?: string): Promise<ApiResponse> {
    return this.request('/groups/form', {
      method: 'POST',
      body: JSON.stringify({ students, department }),
    });
  }

  async assignSupervisor(groupId: number, supervisorName: string): Promise<ApiResponse> {
    return this.request(`/groups/${groupId}/supervisor`, {
      method: 'PUT',
      body: JSON.stringify({ supervisorName }),
    });
  }

  async clearGroups(): Promise<ApiResponse> {
    return this.request('/groups/clear', {
      method: 'DELETE',
    });
  }

  // Supervisors endpoints
  async getSupervisorWorkload(): Promise<ApiResponse> {
    return this.request('/supervisors/workload');
  }

  async uploadSupervisors(supervisors: any[]): Promise<ApiResponse> {
    return this.request('/supervisors/upload', {
      method: 'POST',
      body: JSON.stringify({ supervisors }),
    });
  }

  async autoAssignSupervisors(): Promise<ApiResponse> {
    return this.request('/supervisors/auto-assign', {
      method: 'POST',
    });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
export default apiClient;