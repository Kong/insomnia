import * as models from '../models';
import type { DatabaseAdapter, MockRoute, MockServer, Workspace } from '@kong/insomnia-ai';

// Store instances in the main process
let mockServerManagerInstance: any = null;
let openAPIParserInstance: any = null;

class InsomniaAdapter implements DatabaseAdapter {
  workspace = {
    create: async (data: Partial<Workspace>): Promise<Workspace> => {
      return models.workspace.create(data);
    }
  };

  mockServer = {
    getOrCreateForParentId: async (parentId: string, data: Partial<MockServer>): Promise<MockServer> => {
      return models.mockServer.getOrCreateForParentId(parentId, data);
    }
  };

  mockRoute = {
    create: async (data: Partial<MockRoute>): Promise<MockRoute> => {
      return models.mockRoute.create(data);
    }
  };
}

export async function createMockServerManager() {
  try {
    const aiPackage = await import('@kong/insomnia-ai');
    const { MockServerManager } = aiPackage;
    
    const adapter = new InsomniaAdapter();
    mockServerManagerInstance = new MockServerManager(adapter);
    
    return { success: true, available: true };
  } catch (error) {
    console.warn('Mock server manager package not available:', error);
    return { success: false, available: false, error: error.message };
  }
}

export async function createOpenAPIParser() {
  try {
    const aiPackage = await import('@kong/insomnia-ai');
    const { OpenAPIParser } = aiPackage;
    
    openAPIParserInstance = new OpenAPIParser();
    
    return { success: true, available: true };
  } catch (error) {
    console.warn('OpenAPI parser not available:', error);
    return { success: false, available: false, error: error.message };
  }
}

export async function parseOpenAPISpec(spec: string) {
  try {
    if (!openAPIParserInstance) {
      throw new Error('OpenAPIParser not initialized. Call createOpenAPIParser first.');
    }
    const result = await openAPIParserInstance.parseFromString(spec);
    return { success: true, result };
  } catch (error) {
    console.error('Failed to parse OpenAPI spec:', error);
    return { success: false, error: error.message };
  }
}

export async function createServerWithEndpoints(workspaceId: string, mockServerPatch: any, endpoints: any[]) {
  try {
    if (!mockServerManagerInstance) {
      throw new Error('MockServerManager not initialized. Call createMockServerManager first.');
    }
    const result = await mockServerManagerInstance.createServerWithEndpoints(workspaceId, mockServerPatch, endpoints);
    return { success: true, result };
  } catch (error) {
    console.error('Failed to create server with endpoints:', error);
    return { success: false, error: error.message };
  }
}
