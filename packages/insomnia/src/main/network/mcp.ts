import fs from 'node:fs';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type {
  ClientRequest,
  Prompt,
  Resource,
  ResourceTemplate,
  ServerCapabilities,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import electron, { BrowserWindow } from 'electron';
import type { z } from 'zod';

import { getAppVersion, getProductName } from '~/common/constants';
import type { TransportType } from '~/models/mcp-request';
import type { RequestAuthentication, RequestHeader } from '~/models/request';
import { getBasicAuthHeader } from '~/network/basic-auth/get-header';
import { getBearerAuthHeader } from '~/network/bearer-auth/get-header';

import { ipcMainHandle, ipcMainOn } from '../ipc/electron';

interface CommonMcpOptions {
  requestId: string;
}
export interface OpenMcpClientConnectionOptions extends CommonMcpOptions {
  url: string;
  requestId: string;
  transportType: TransportType;
  headers: RequestHeader[];
  authentication: RequestAuthentication;
}
export interface McpRequestOptions {
  requestId: string;
  request: ClientRequest;
  schema: z.ZodType;
  signal?: AbortSignal;
}
interface CallToolOptions extends CommonMcpOptions {
  name: string;
  parameters: Record<string, any>;
}
export interface McpServerData {
  serverCapabilities: ServerCapabilities;
  primitives: {
    tools: Tool[];
    resources: Resource[];
    resourceTemplates: ResourceTemplate[];
    prompts: Prompt[];
  };
}

const mcpConnections = new Map<string, Client>();
// In-memory store of mcp server capabilities, tools/resources/resource templates/prompts list data for each mcp request
const mcpServerDataStore = new Map<string, McpServerData>();

const mcpStateChannelBuilder = (requestId: string) => `mcp.${requestId}.readyState`;
const _getMcpClient = (id: string) => {
  const mcpClient = mcpConnections.get(id);
  if (!mcpClient) {
    console.log(`No existing MCP client connection found for requestId: ${id}. It might have been disconnected.`);
  }
  return mcpClient;
};

const _notifyMcpClientStateChange = (channel: string, isConnected: boolean) => {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(channel, isConnected);
  }
};

const _clearMcpMaps = (requestId: string) => {
  mcpConnections.delete(requestId);
  mcpServerDataStore.delete(requestId);
};

const openMcpClientConnection = async (options: OpenMcpClientConnectionOptions) => {
  const { transportType, url, requestId } = options;
  if (!url) {
    throw new Error('MCP server url is required');
  }

  if (!options.authentication.disabled) {
    if (options.authentication.type === 'basic') {
      const { username, password, useISO88591 } = options.authentication;
      const encoding = useISO88591 ? 'latin1' : 'utf8';
      options.headers.push(getBasicAuthHeader(username, password, encoding));
    }
    if (options.authentication.type === 'apikey') {
      const { key = '', value = '' } = options.authentication;
      options.headers.push({ name: key, value: value });
    }
    if (options.authentication.type === 'bearer' && options.authentication.token) {
      const { token, prefix } = options.authentication;
      options.headers.push(getBearerAuthHeader(token, prefix));
    }
  }

  const reduceArrayToLowerCaseKeyedDictionary = (acc: Record<string, string>, { name, value }: RequestHeader) => ({
    ...acc,
    [name.toLowerCase() || '']: value || '',
  });
  const lowerCasedEnabledHeaders = options.headers
    .filter(({ name, disabled }) => Boolean(name) && !disabled)
    .reduce(reduceArrayToLowerCaseKeyedDictionary, {});

  const mcpClient = new Client({
    name: getProductName(),
    version: getAppVersion(),
  });
  const mcpStateChannel = mcpStateChannelBuilder(requestId);

  switch (transportType) {
    case 'streamable-http': {
      try {
        const mcpServerUrl = new URL(url);
        const transport = new StreamableHTTPClientTransport(mcpServerUrl, {
          requestInit: {
            headers: lowerCasedEnabledHeaders,
          },
          reconnectionOptions: {
            maxReconnectionDelay: 30000,
            initialReconnectionDelay: 1000,
            reconnectionDelayGrowFactor: 1.5,
            maxRetries: 2,
          },
        });
        await mcpClient.connect(transport);
        mcpClient.onclose = () => {
          // terminate the session when client is closed
          transport.terminateSession();
          // clear in-memory store
          _clearMcpMaps(requestId);
          // notify renderer process about state change
          _notifyMcpClientStateChange(mcpStateChannel, false);
        };
        mcpClient.onerror = error => {
          // TODO support error
        };
        break;
      } catch (error) {
        throw new Error(`Failed to create Streamable HTTP transport: ${error}`);
      }
    }

    default: {
      throw new Error(`Unsupported transport type: ${transportType}`);
    }
  }

  mcpConnections.set(requestId, mcpClient);
  const serverCapabilities = mcpClient.getServerCapabilities();
  let tools: Tool[] = [];
  let resources: Resource[] = [];
  let resourceTemplates: ResourceTemplate[] = [];
  let prompts: Prompt[] = [];
  const primitivePromises: Promise<any>[] = [];
  // get server primitives if supported
  if (serverCapabilities?.tools) {
    primitivePromises.push(mcpClient.listTools().then(response => (tools = response.tools)));
  }
  if (serverCapabilities?.resources) {
    primitivePromises.push(mcpClient.listResources().then(response => (resources = response.resources)));
    primitivePromises.push(
      mcpClient.listResourceTemplates().then(response => (resourceTemplates = response.resourceTemplates)),
    );
  }
  if (serverCapabilities?.prompts) {
    primitivePromises.push(mcpClient.listPrompts().then(response => (prompts = response.prompts)));
  }
  try {
    await Promise.all(primitivePromises);
  } catch (error) {
    console.warn('Failed to fetch one or more primitive types from MCP server', error);
  }
  const serverData = {
    serverCapabilities: serverCapabilities,
    primitives: {
      tools,
      resources,
      resourceTemplates,
      prompts,
    },
  };
  mcpServerDataStore.set(requestId, serverData as McpServerData);
  // notify connection ready after capabilities and primitives are fetched
  _notifyMcpClientStateChange(mcpStateChannel, true);
  return serverData;
};

const closeMcpConnection = (options: CommonMcpOptions) => {
  const { requestId } = options;
  const mcpClient = _getMcpClient(requestId);
  if (mcpClient) {
    mcpClient.close();
  }
};

const closeAllMcpConnections = () => {
  for (const [requestId] of mcpConnections) {
    closeMcpConnection({ requestId });
  }
};

const getServerData = async (options: CommonMcpOptions) => mcpServerDataStore.get(options.requestId);

const findMany = async (options: { responseId: string }): Promise<any> => {
  return [];
};

const listTools = async (options: CommonMcpOptions) => {
  const mcpClient = _getMcpClient(options.requestId);
  if (!mcpClient) {
    return [];
  }
  const tools = await mcpClient.listTools();
  return tools;
};

const callTool = async (options: CallToolOptions) => {
  const { requestId, name, parameters } = options;
  const mcpClient = _getMcpClient(requestId);
  if (mcpClient) {
    const response = await mcpClient.callTool({ name, arguments: parameters });
  }
};

const listPrompts = async (options: CommonMcpOptions) => {
  const mcpClient = _getMcpClient(options.requestId);
  if (!mcpClient) {
    return [];
  }
  const prompts = await mcpClient.listPrompts();
  return prompts;
};

const getPrompt = async (options: CommonMcpOptions) => {};

const listResources = async (options: CommonMcpOptions) => {
  const mcpClient = _getMcpClient(options.requestId);
  if (!mcpClient) {
    return [];
  }
  const resources = await mcpClient.listResources();
  return resources;
};

const listResourceTemplates = async (options: CommonMcpOptions) => {
  const mcpClient = _getMcpClient(options.requestId);
  if (!mcpClient) {
    return [];
  }
  const resourceTemplates = await mcpClient.listResourceTemplates();
  return resourceTemplates;
};

const getMcpReadyState = async (options: CommonMcpOptions) => {
  const mcpClient = _getMcpClient(options.requestId);
  // if no mcp client, it means it's disconnected
  return !!mcpClient;
};

const readResource = async (options: CommonMcpOptions) => {};

const subscribeResource = async (options: CommonMcpOptions) => {};

export interface McpBridgeAPI {
  connect: typeof openMcpClientConnection;
  close: typeof closeMcpConnection;
  closeAll: typeof closeAllMcpConnections;
  getServerData: typeof getServerData;
  primitive: {
    listTools: typeof listTools;
    callTool: typeof callTool;
    listPrompts: typeof listPrompts;
    getPrompt: typeof getPrompt;
    listResources: typeof listResources;
    listResourceTemplates: typeof listResourceTemplates;
    readResource: typeof readResource;
    subscribeResource: typeof subscribeResource;
  };
  readyState: {
    getCurrent: typeof getMcpReadyState;
  };
  // event: {
  //   findMany: typeof findMany;
  // };
}

export const registerMcpHandlers = () => {
  ipcMainHandle('mcp.connect', (_, options: Parameters<typeof openMcpClientConnection>[0]) =>
    openMcpClientConnection(options),
  );
  ipcMainHandle('mcp.primitive.listTools', (_, options: Parameters<typeof listTools>[0]) => listTools(options));
  ipcMainHandle('mcp.primitive.callTool', (_, options: Parameters<typeof callTool>[0]) => callTool(options));
  ipcMainHandle('mcp.primitive.listPrompts', (_, options: Parameters<typeof listPrompts>[0]) => listPrompts(options));
  ipcMainHandle('mcp.primitive.getPrompt', (_, options: Parameters<typeof getPrompt>[0]) => getPrompt(options));
  ipcMainHandle('mcp.primitive.listResources', (_, options: Parameters<typeof listResources>[0]) =>
    listResources(options),
  );
  ipcMainHandle('mcp.primitive.listResourceTemplates', (_, options: Parameters<typeof listResourceTemplates>[0]) =>
    listResourceTemplates(options),
  );
  ipcMainHandle('mcp.primitive.readResource', (_, options: Parameters<typeof readResource>[0]) =>
    readResource(options),
  );
  ipcMainHandle('mcp.primitive.subscribeResource', (_, options: Parameters<typeof subscribeResource>[0]) =>
    subscribeResource(options),
  );
  ipcMainOn('mcp.close', (_, options: Parameters<typeof closeMcpConnection>[0]) => closeMcpConnection(options));
  ipcMainOn('mcp.closeAll', closeAllMcpConnections);
  ipcMainHandle('mcp.readyState', (_, options: Parameters<typeof getMcpReadyState>[0]) => getMcpReadyState(options));
  ipcMainHandle('mcp.getServerData', (_, options: Parameters<typeof getMcpReadyState>[0]) => getServerData(options));
};

electron.app.on('window-all-closed', closeAllMcpConnections);
