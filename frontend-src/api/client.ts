/**
 * API Client Module
 * Centralized API communication layer with type safety
 */

// API configuration
const API_BASE = import.meta.env.VITE_API_BASE || '/api';

// Type definitions for API responses
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface Manuscript {
  id: string;
  title: string;
  author: string;
  wordCount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export interface AnalysisReport {
  reportId: string;
  manuscriptId: string;
  type: 'developmental' | 'line' | 'copy';
  status: 'pending' | 'completed';
  createdAt: string;
  summary?: string;
}

// API Client class
export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl;
  }

  /**
   * Generic request method with error handling
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('API request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  /**
   * POST request
   */
  async post<T>(endpoint: string, body: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * PUT request
   */
  async put<T>(endpoint: string, body: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  // Manuscript API methods
  async getManuscripts(): Promise<ApiResponse<Manuscript[]>> {
    return this.get<Manuscript[]>('/manuscripts');
  }

  async getManuscript(id: string): Promise<ApiResponse<Manuscript>> {
    return this.get<Manuscript>(`/manuscripts/${id}`);
  }

  async uploadManuscript(file: File, title: string): Promise<ApiResponse<Manuscript>> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);

    try {
      const response = await fetch(`${this.baseUrl}/manuscripts/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      return await response.json();
    } catch (error) {
      console.error('Upload failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  // Analysis API methods
  async getAnalysisReports(manuscriptId: string): Promise<ApiResponse<AnalysisReport[]>> {
    return this.get<AnalysisReport[]>(`/manuscripts/${manuscriptId}/reports`);
  }

  async getReport(reportId: string): Promise<ApiResponse<any>> {
    return this.get(`/reports/${reportId}`);
  }

  // User API methods
  async getCurrentUser(): Promise<ApiResponse<any>> {
    return this.get('/user/me');
  }

  async logout(): Promise<ApiResponse<void>> {
    return this.post('/auth/logout', {});
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export default for convenience
export default apiClient;
