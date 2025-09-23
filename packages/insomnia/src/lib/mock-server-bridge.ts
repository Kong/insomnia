import * as models from '../models';
import type { DatabaseAdapter, MockRoute, MockServer, Workspace, ModelConfig } from '@kong/insomnia-ai';
import { createMockServerFromOpenAPISpec, createMockServerFromUrl, createMockServerFromText } from '@kong/insomnia-ai';

class InsomniaAdapter implements DatabaseAdapter {
  workspace = {
    create: async (data: Partial<Workspace>): Promise<Workspace> => {
      return models.workspace.create(data);
    },
  };

  mockServer = {
    getOrCreateForParentId: async (parentId: string, data: Partial<MockServer>): Promise<MockServer> => {
      return models.mockServer.getOrCreateForParentId(parentId, data);
    },
  };

  mockRoute = {
    create: async (data: Partial<MockRoute>): Promise<MockRoute> => {
      return models.mockRoute.create(data);
    },
  };
}

export async function createMockServerFromSpec(
  openApiSpec: string | undefined,
  specUrl: string | undefined,
  specText: string | undefined,
  workspaceId: string,
  mockServerData: Partial<MockServer>,
  modelConfig: ModelConfig,
  useDynamicMockResponses: boolean,
  additionalFiles: string[],
) {
  try {
    const databaseAdapter = new InsomniaAdapter();
    let result;

    if (openApiSpec) {
      result = await createMockServerFromOpenAPISpec(openApiSpec, workspaceId, mockServerData, modelConfig, {
        additionalFiles: additionalFiles,
        useDynamicMockResponses: useDynamicMockResponses,
        databaseAdapter: databaseAdapter,
      });
    } else if (specUrl) {
      result = await createMockServerFromUrl(specUrl!, workspaceId, mockServerData, modelConfig, {
        additionalFiles: additionalFiles,
        useDynamicMockResponses: useDynamicMockResponses,
        databaseAdapter: databaseAdapter,
      });
    } else if (specText) {
      result = await createMockServerFromText(specText!, workspaceId, mockServerData, modelConfig, {
        additionalFiles: additionalFiles,
        useDynamicMockResponses: useDynamicMockResponses,
        databaseAdapter: databaseAdapter,
      });
    } else {
      const errorMessage = 'Failed to create mock server, no spec source was provided';
      console.error(errorMessage);
      return { success: false, error: errorMessage };
    }
    return { success: true, result };
  } catch (error) {
    console.error('Failed to create mock server from OpenAPI spec:', error);
    return { success: false, error: error.message };
  }
}
