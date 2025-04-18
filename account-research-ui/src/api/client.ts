import axios from 'axios';
import { FormValues } from '../contexts/WizardContext';

// Create axios instance with configuration
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL,
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
  }
});

// Types
export type GenerationPayload = {
  company_name: string;
  platform_company_name: string;
  language_key: string;
  sections: string[];
};

export interface Task {
  task_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  request?: {
    company_name: string;
    platform_company_name: string;
    language_key: string;
    sections: string[];
  };
  error?: string;
  result?: {
    token_stats?: any;
    base_dir?: string;
    pdf_path?: string;
  };
}

// API functions
export const api = {
  /**
   * Create a new research task
   */
  async createTask(payload: GenerationPayload): Promise<{ task_id: string }> {
    const response = await apiClient.post('/generate', payload);
    return response.data;
  },

  /**
   * Get the status of a task
   */
  async getTaskStatus(id: string): Promise<Task> {
    const response = await apiClient.get(`/status/${id}`);
    return response.data;
  },

  /**
   * Download the PDF result of a completed task
   */
  async downloadPdf(id: string): Promise<Blob> {
    const response = await apiClient.get(`/result/${id}/pdf`, {
      responseType: 'blob'
    });
    return response.data;
  },

  /**
   * List all tasks for the current user
   */
  async listTasks(): Promise<Task[]> {
    const response = await apiClient.get('/tasks');
    
    // The backend now returns an array of TaskStatus objects
    const tasks: Task[] = response.data;
    
    // Sort tasks by created_at in descending order (newest first)
    return tasks.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }
};

export default api; 