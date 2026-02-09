import { apiClient } from './api';

export async function testDatabaseConnection(): Promise<{ success: boolean; message: string }> {
  try {
    const response = await apiClient.healthCheck();
    
    if (response.success) {
      return {
        success: true,
        message: 'Backend server and database connection successful!'
      };
    } else {
      return {
        success: false,
        message: response.message || 'Backend server connection failed'
      };
    }
  } catch (error) {
    console.error('Backend connection test error:', error);
    return {
      success: false,
      message: `Backend connection error: ${error instanceof Error ? error.message : 'Server not responding'}`
    };
  }
}