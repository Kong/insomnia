import * as models from '../models';
import type { DatabaseAdapter, MockRoute, MockServer, Workspace, ModelConfig } from '@kong/insomnia-ai';
import { createMockServerFromOpenAPISpec } from '@kong/insomnia-ai';

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

export async function createMockServerFromSpec(
  openApiSpec: string,
  workspaceId: string,
  mockServerData: Partial<MockServer>,
  modelConfig: ModelConfig,
  useDynamicMockResponses: boolean
) {
  try {
    const databaseAdapter = new InsomniaAdapter();
    const result = await createMockServerFromOpenAPISpec(
      openApiSpec,
      workspaceId,
      mockServerData,
      modelConfig,
      { useDynamicMockResponses: useDynamicMockResponses, databaseAdapter: databaseAdapter }
    );
    return { success: true, result };
  } catch (error) {
    console.error('Failed to create mock server from OpenAPI spec:', error);
    return { success: false, error: error.message };
  }
}
