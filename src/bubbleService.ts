import { AxiosInstance } from 'axios';
import apiClient from './apiClient.js';
import { BubbleSchema } from './types.js';

export class BubbleService {
  private client: AxiosInstance;
  private schema: BubbleSchema | null = null;

  constructor(client: AxiosInstance = apiClient) {
    this.client = client;
  }

  // Modify getSchema to use the root API path
  async getSchema(): Promise<BubbleSchema> {
    if (!this.schema) {
      try {
        // Using /api/1.1/meta directly instead of just /meta
        const response = await this.client.get('/api/1.1/meta');
        this.schema = response.data;
      } catch (error: any) {
        console.error('Schema fetch error:', error.response?.data || error.message);
        throw error;
      }
    }
    return this.schema!;
  }

  // Modify list method to use the correct API version path
  async list(dataType: string, params?: { limit?: number; cursor?: number }) {
    try {
      const queryParams = new URLSearchParams();
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.cursor) queryParams.append('cursor', params.cursor.toString());
      
      // Using /api/1.1/obj/ path
      const response = await this.client.get(`/api/1.1/obj/${dataType}?${queryParams}`);
      return response.data;
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message;
      console.error(`Error listing ${dataType}:`, errorMsg);
      throw new Error(`Failed to list ${dataType}: ${errorMsg}`);
    }
  }

  async get(dataType: string, id: string) {
    try {
      const response = await this.client.get(`/obj/${dataType}/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error getting ${dataType} ${id}:`, error);
      throw error;
    }
  }

  async create(dataType: string, data: Record<string, any>) {
    try {
      const response = await this.client.post(`/obj/${dataType}`, data);
      return response.data;
    } catch (error) {
      console.error(`Error creating ${dataType}:`, error);
      throw error;
    }
  }

  async update(dataType: string, id: string, data: Record<string, any>) {
    try {
      const response = await this.client.patch(`/obj/${dataType}/${id}`, data);
      return response.data;
    } catch (error) {
      console.error(`Error updating ${dataType} ${id}:`, error);
      throw error;
    }
  }

  async delete(dataType: string, id: string) {
    try {
      const response = await this.client.delete(`/obj/${dataType}/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error deleting ${dataType} ${id}:`, error);
      throw error;
    }
  }

  // Workflow execution
  async executeWorkflow(workflowName: string, data: Record<string, any>) {
    try {
      const response = await this.client.post(`/wf/${workflowName}`, data);
      return response.data;
    } catch (error) {
      console.error(`Error executing workflow ${workflowName}:`, error);
      throw error;
    }
  }
}
