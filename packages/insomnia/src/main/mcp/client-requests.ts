import {
  type CallToolRequest,
  CompatibilityCallToolResultSchema,
  type GetPromptRequest,
  type ListPromptsRequest,
  type ListResourcesRequest,
  type ReadResourceRequest,
  type SubscribeRequest,
  type UnsubscribeRequest,
} from '@modelcontextprotocol/sdk/types.js';

import { METHOD_SUBSCRIBE_RESOURCE, METHOD_UNSUBSCRIBE_RESOURCE } from '~/common/mcp-utils';
import { SegmentEvent, trackSegmentEvent } from '~/main/analytics';
import { getActiveMcpClient, getReadyActiveMcpConnectionContext, writeEventLogAndNotify } from '~/main/mcp/common';
import type { CommonMcpOptions, McpMessageEventWithoutBase } from '~/main/mcp/types';

export const listTools = async (options: CommonMcpOptions) => {
  const mcpClient = getActiveMcpClient(options.requestId);
  if (mcpClient) {
    const tools = await mcpClient.listTools();
    return tools;
  }
  return null;
};

export const callTool = async (options: CommonMcpOptions & CallToolRequest['params']) => {
  const { requestId, ...params } = options;
  const mcpClient = getActiveMcpClient(requestId);
  if (mcpClient) {
    const response = await mcpClient.callTool(params, CompatibilityCallToolResultSchema);
    trackSegmentEvent(SegmentEvent.mcpToolCalled);
    return response.content;
  }
  return null;
};

export const listPrompts = async (options: CommonMcpOptions & ListPromptsRequest['params']) => {
  const mcpClient = getActiveMcpClient(options.requestId);
  if (mcpClient) {
    const prompts = await mcpClient.listPrompts();
    return prompts;
  }
  return null;
};

export const getPrompt = async (options: CommonMcpOptions & GetPromptRequest['params']) => {
  const { requestId, ...params } = options;
  const mcpClient = getActiveMcpClient(options.requestId);
  if (mcpClient) {
    const prompt = await mcpClient.getPrompt(params);
    trackSegmentEvent(SegmentEvent.mcpPromptCalled);
    return prompt;
  }
  return null;
};

export const listResources = async (options: CommonMcpOptions & ListResourcesRequest['params']) => {
  const { requestId, ...params } = options;
  const mcpClient = getActiveMcpClient(options.requestId);
  if (mcpClient) {
    const resources = await mcpClient.listResources(params);
    return resources;
  }
  return null;
};

export const listResourceTemplates = async (options: CommonMcpOptions & ListResourcesRequest['params']) => {
  const { requestId, ...params } = options;
  const mcpClient = getActiveMcpClient(requestId);
  if (mcpClient) {
    const resourceTemplates = await mcpClient.listResourceTemplates(params);
    return resourceTemplates;
  }
  return null;
};

export const readResource = async (options: CommonMcpOptions & ReadResourceRequest['params']) => {
  const { requestId, ...params } = options;
  const mcpClient = getActiveMcpClient(requestId);
  if (mcpClient) {
    const resource = await mcpClient.readResource(params);
    trackSegmentEvent(SegmentEvent.mcpResourceRead);
    return resource;
  }
  return null;
};

export const subscribeResource = async (options: CommonMcpOptions & SubscribeRequest['params']) => {
  const { requestId, ...params } = options;
  const context = getReadyActiveMcpConnectionContext(requestId);
  const mcpClient = context?.client;
  if (!context || !mcpClient) {
    return null;
  }

  const result = await mcpClient.subscribeResource(params);
  // Subscribe resource do not have a formal response schema, so we log it manually
  const messageEvent: Omit<McpMessageEventWithoutBase, 'data'> & { data: {} } = {
    type: 'message',
    method: METHOD_SUBSCRIBE_RESOURCE,
    data: {
      ...result,
      // @ts-expect-error - workaround to add the json rpc request id to the logged data
      id: mcpClient._requestMessageId - 1,
    },
    direction: 'INCOMING',
  };
  writeEventLogAndNotify(context, messageEvent);
  return result;
};

export const unsubscribeResource = async (options: CommonMcpOptions & UnsubscribeRequest['params']) => {
  const { requestId, ...params } = options;
  const context = getReadyActiveMcpConnectionContext(requestId);
  const mcpClient = context?.client;
  if (!context || !mcpClient) {
    return null;
  }

  const result = await mcpClient.unsubscribeResource(params);
  // Unsubscribe resource do not have a formal response schema, so we log it manually
  const messageEvent: Omit<McpMessageEventWithoutBase, 'data'> & { data: {} } = {
    type: 'message',
    method: METHOD_UNSUBSCRIBE_RESOURCE,
    data: {
      ...result,
      // @ts-expect-error - workaround to add the json rpc request id to the logged data
      id: mcpClient._requestMessageId - 1,
    },
    direction: 'INCOMING',
  };
  writeEventLogAndNotify(context, messageEvent);
  return result;
};

export const sendRootListChangeNotification = async (options: CommonMcpOptions) => {
  const mcpClient = getActiveMcpClient(options.requestId);
  if (mcpClient) {
    const result = await mcpClient.sendRootsListChanged();
    return result;
  }
  return null;
};

export const responseElicitationRequest = (
  options: CommonMcpOptions & {
    serverRequestId: string;
    type: 'submit' | 'decline' | 'cancel';
    content?: Record<string, any>;
  },
) => {
  const { requestId, serverRequestId, type, content } = options;
  const context = getReadyActiveMcpConnectionContext(requestId);
  if (!context) {
    return;
  }

  const { mcpServerElicitationRequests } = context;
  if (mcpServerElicitationRequests) {
    const serverRequestResolver = mcpServerElicitationRequests.get(serverRequestId);
    switch (type) {
      case 'decline': {
        serverRequestResolver?.resolve({ action: 'decline' });
        break;
      }
      case 'cancel': {
        serverRequestResolver?.resolve({ action: 'cancel' });
        break;
      }
      case 'submit': {
        serverRequestResolver?.resolve({ action: 'accept', content: content });
        break;
      }
      default: {
        throw new Error(`Unknown server request response type: ${type}`);
      }
    }
    mcpServerElicitationRequests.delete(serverRequestId);
  }
};
