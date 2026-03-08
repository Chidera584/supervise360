import type { LoginRequest, RegisterRequest, AuthResponse, ApiResponse } from '../types/database';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '') || 'http://localhost:5000';

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
    
    const isFormData = options.body instanceof FormData;
    const config: RequestInit = {
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
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

  async forgotPassword(email: string): Promise<ApiResponse> {
    return this.request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<ApiResponse> {
    return this.request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
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
    return fetch(`${API_ORIGIN}/health`)
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
  async getSupervisorMyGroups(): Promise<ApiResponse> {
    return this.request('/supervisors/my-groups');
  }

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

  async syncSupervisorWorkload(): Promise<ApiResponse> {
    return this.request('/supervisors/sync-workload', {
      method: 'POST',
    });
  }

  async clearAllSupervisors(): Promise<ApiResponse> {
    return this.request('/supervisors/clear-all', {
      method: 'POST',
    });
  }

  // Admin endpoints
  async getAdminDashboard(): Promise<ApiResponse> {
    return this.request('/admin/dashboard');
  }

  async getDepartments(): Promise<ApiResponse> {
    return this.request('/admin/departments');
  }

  async createDepartment(name: string, code?: string): Promise<ApiResponse> {
    return this.request('/admin/departments', {
      method: 'POST',
      body: JSON.stringify({ name, code }),
    });
  }

  async deleteDepartment(id: number): Promise<ApiResponse> {
    return this.request(`/admin/departments/${id}`, { method: 'DELETE' });
  }

  async getDepartmentStats(): Promise<ApiResponse> {
    return this.request('/admin/departments/stats');
  }

  async getAdminDepartments(): Promise<ApiResponse> {
    return this.request('/admin/departments/me');
  }

  async setAdminDepartments(departmentIds: number[]): Promise<ApiResponse> {
    return this.request('/admin/departments/me', {
      method: 'PUT',
      body: JSON.stringify({ departmentIds }),
    });
  }

  async getAdminStats(): Promise<ApiResponse> {
    return this.request('/admin/stats');
  }

  async sendUnassignedStudentsAlert(): Promise<ApiResponse> {
    return this.request('/admin/send-unassigned-alert', { method: 'POST' });
  }

  async sendTestEmail(email?: string): Promise<ApiResponse> {
    return this.request('/admin/test-email', {
      method: 'POST',
      body: JSON.stringify(email ? { email } : {}),
    });
  }

  async approveProject(projectId: number): Promise<ApiResponse> {
    return this.request(`/admin/projects/${projectId}/approve`, {
      method: 'PUT',
    });
  }

  async swapGroupMembers(member1: { groupId: number; memberId: number }, member2: { groupId: number; memberId: number }): Promise<ApiResponse> {
    return this.request('/admin/groups/swap-members', {
      method: 'POST',
      body: JSON.stringify({ member1, member2 }),
    });
  }

  async rejectProject(projectId: number, reason: string): Promise<ApiResponse> {
    return this.request(`/admin/projects/${projectId}/reject`, {
      method: 'PUT',
      body: JSON.stringify({ reason }),
    });
  }

  async getAdminDefensePanels(): Promise<ApiResponse> {
    return this.request('/admin/defense-panels');
  }

  async scheduleDefensePanels(payload: any): Promise<ApiResponse> {
    return this.request('/admin/defense-panels/schedule-bulk', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateDefensePanel(panelId: number, payload: any): Promise<ApiResponse> {
    return this.request(`/admin/defense-panels/${panelId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async allocateDefenseScheduling(payload: { staff: any[]; venues: any[]; groupRanges: any[] }): Promise<ApiResponse> {
    return this.request('/allocate-defense', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Student: get defense schedule (venue + assessors) from allocation
  async getMyDefenseSchedule(): Promise<ApiResponse> {
    return this.request('/defense-panels/my-defense-schedule');
  }

  // Student: get defense schedule by group ID (use after getMyGroup)
  async getDefenseScheduleForGroup(groupId: number): Promise<ApiResponse> {
    return this.request(`/defense-panels/schedule-for-group/${groupId}`);
  }

  // Supervisor: get defense schedules for all assigned groups
  async getMyGroupsDefenseSchedules(): Promise<ApiResponse> {
    return this.request('/defense-panels/my-groups-defense-schedules');
  }

  // Admin: persist allocation to DB so students/supervisors can see it
  async publishDefenseAllocations(payload: { allocations: { venue: string; assessors: string[] }[]; groupRanges: { venue_index: number; department: string; start: number; end: number }[] }): Promise<ApiResponse> {
    return this.request('/defense-panels/publish-allocations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Admin: get and clear persisted defense allocations
  async getDefenseAllocations(): Promise<ApiResponse> {
    return this.request('/defense-panels/allocations');
  }

  async clearDefenseAllocations(): Promise<ApiResponse> {
    return this.request('/defense-panels/allocations', { method: 'DELETE' });
  }

  // Projects endpoints
  async getMyProject(): Promise<ApiResponse> {
    return this.request('/projects/my-project');
  }

  async submitProject(payload: any): Promise<ApiResponse> {
    return this.request('/projects/submit', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateProject(projectId: number, payload: any): Promise<ApiResponse> {
    return this.request(`/projects/${projectId}/update`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async clearProject(): Promise<ApiResponse> {
    return this.request('/projects/clear', {
      method: 'DELETE',
    });
  }

  // Supervisor: get pending project proposals for their groups
  async getPendingProjectProposals(): Promise<ApiResponse> {
    return this.request('/projects/pending-for-supervisor');
  }

  async getAllProjectProposals(): Promise<ApiResponse> {
    return this.request('/projects/all-for-supervisor');
  }

  async approveProjectProposal(projectId: number): Promise<ApiResponse> {
    return this.request(`/projects/${projectId}/supervisor-approve`, {
      method: 'PUT',
    });
  }

  async rejectProjectProposal(projectId: number, reason: string): Promise<ApiResponse> {
    return this.request(`/projects/${projectId}/supervisor-reject`, {
      method: 'PUT',
      body: JSON.stringify({ reason }),
    });
  }

  // Reports endpoints
  async uploadReport(formData: FormData): Promise<ApiResponse> {
    return this.request('/reports/upload', {
      method: 'POST',
      body: formData,
    });
  }

  async getMyReports(): Promise<ApiResponse> {
    return this.request('/reports/my-reports');
  }

  async getPendingReportReviews(): Promise<ApiResponse> {
    return this.request('/reports/pending-review');
  }

  async reviewReport(reportId: number, payload: any): Promise<ApiResponse> {
    return this.request(`/reports/${reportId}/review`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async downloadReport(reportId: number): Promise<ApiResponse> {
    return this.request(`/reports/${reportId}/download`);
  }

  /** Fetch report file as blob for viewing/downloading (for supervisors) */
  async fetchReportFile(reportId: number): Promise<Blob> {
    const url = `${this.baseURL}/reports/${reportId}/download`;
    const res = await fetch(url, {
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
    });
    if (!res.ok) throw new Error('Failed to fetch report document');
    return res.blob();
  }

  async deleteReport(reportId: number): Promise<ApiResponse> {
    return this.request(`/reports/${reportId}`, {
      method: 'DELETE',
    });
  }

  // Evaluations endpoints
  async getGroupsWithProjects(): Promise<ApiResponse> {
    return this.request('/evaluations/groups-with-projects');
  }

  async getEvaluationStudents(): Promise<ApiResponse> {
    return this.request('/evaluations/students');
  }

  async getPendingEvaluations(): Promise<ApiResponse> {
    return this.request('/evaluations/pending');
  }

  async getCompletedEvaluations(): Promise<ApiResponse> {
    return this.request('/evaluations/completed');
  }

  async submitEvaluation(payload: any): Promise<ApiResponse> {
    return this.request('/evaluations/submit', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getMyEvaluation(): Promise<ApiResponse> {
    return this.request('/evaluations/my-evaluation');
  }

  async submitStudentEvaluation(payload: any): Promise<ApiResponse> {
    return this.request('/evaluations/student-submit', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Messages endpoints
  async getMessageContacts(groupId?: number, debug?: boolean): Promise<ApiResponse> {
    const params = new URLSearchParams();
    if (groupId) params.set('group_id', String(groupId));
    if (debug) params.set('debug', '1');
    const q = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/messages/contacts${q}`);
  }

  async getInbox(): Promise<ApiResponse> {
    return this.request('/messages/inbox');
  }

  async getSent(): Promise<ApiResponse> {
    return this.request('/messages/sent');
  }

  async sendMessage(payload: {
    recipient_id?: number;
    recipient_ids?: number[];
    group_id?: number;
    broadcast?: boolean;
    parent_id?: number;
    subject: string;
    content: string;
  }): Promise<ApiResponse> {
    return this.request('/messages/send', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async markMessageRead(messageId: number): Promise<ApiResponse> {
    return this.request(`/messages/${messageId}/read`, { method: 'PUT' });
  }

  async clearInbox(): Promise<ApiResponse> {
    return this.request('/messages/inbox', { method: 'DELETE' });
  }

  async clearSent(): Promise<ApiResponse> {
    return this.request('/messages/sent', { method: 'DELETE' });
  }

  // Notifications endpoints
  async getNotificationUnreadCount(): Promise<ApiResponse> {
    return this.request('/notifications/unread-count');
  }

  async getRecentNotifications(limit: number = 5): Promise<ApiResponse> {
    return this.request(`/notifications/recent?limit=${limit}`);
  }

  async getNotifications(): Promise<ApiResponse> {
    return this.request('/notifications');
  }

  async markNotificationRead(notificationId: number): Promise<ApiResponse> {
    return this.request(`/notifications/${notificationId}/read`, {
      method: 'PUT',
    });
  }

  async markAllNotificationsRead(): Promise<ApiResponse> {
    return this.request('/notifications/read-all', {
      method: 'PUT',
    });
  }

  async clearNotification(notificationId: number): Promise<ApiResponse> {
    return this.request(`/notifications/${notificationId}`, {
      method: 'DELETE',
    });
  }

  async clearAllNotifications(): Promise<ApiResponse> {
    return this.request('/notifications', {
      method: 'DELETE',
    });
  }

  // Defense panels endpoints
  async getMyDefense(): Promise<ApiResponse> {
    return this.request('/defense-panels/my-defense');
  }

  async getMyDefensePanels(): Promise<ApiResponse> {
    return this.request('/defense-panels/my-panels');
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
export default apiClient;