import { McpUiToolMetaSchema, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps';

import { getReadyActiveMcpConnectionContext } from '~/main/mcp/common';
import type { McpAppResourceData } from '~/main/mcp/types';

export const getResourceData = async (options: {
  requestId: string;
  toolName: string;
}): Promise<McpAppResourceData | null> => {
  const { requestId, toolName } = options;
  const context = getReadyActiveMcpConnectionContext(requestId);
  if (context && context.client) {
    // find tool name from response
    // TODO this cache might not be needed since it is triggered from mcp-request-pane
    const toolDefinitions = context.toolDefinitions;
    const toolDef = toolDefinitions.find(t => t.name === toolName);
    const toolDefMeta = toolDef?._meta;
    if (toolDefMeta && 'ui' in toolDefMeta) {
      // Check if the tool has a UI component and visible to the client in tool definition meta
      const result = McpUiToolMetaSchema.safeParse(toolDefMeta.ui);
      if (result.success) {
        const visibility = result.data.visibility;
        const resourceUri = result.data.resourceUri;
        /**
         * - "model": Tool visible to and callable by the agent
         * - "app": Tool callable by the app from this server only
         */
        const shouldRenderMcpApp = !visibility || visibility.includes('model');
        if (shouldRenderMcpApp && resourceUri) {
          //get resource content from cache first
          //temp solution no cache for now
          let content;
          if (context.resourcesCache.has(resourceUri)) {
            content = context.resourcesCache.get(resourceUri)!;
          } else {
            const appUiResource = await context.client.readResource({
              uri: resourceUri,
            });
            if (!appUiResource) {
              throw new Error(`UI Resource not found tool: ${toolName} with URI: ${resourceUri}`);
            }
            content = appUiResource.contents[0];
          }
          const { mimeType } = content;
          if (mimeType !== RESOURCE_MIME_TYPE) {
            throw new Error(
              `Unsupported MIME type: ${content.mimeType} for tool: ${toolName} with URI: ${resourceUri}`,
            );
          }
          const html = 'blob' in content ? atob(content.blob) : content.text;
          // Extract CSP and permissions metadata from resource content._meta.ui (or content.meta for Python SDK)
          console.info('Resource content keys:', Object.keys(content));
          console.info('Resource content._meta:', content._meta);
          const contentMeta = content._meta || (content as any).meta;
          const csp = contentMeta?.ui?.csp;
          const permissions = contentMeta?.ui?.permissions;

          return { html, csp, permissions };
        }
      }
    }
  }
  return null;
};
