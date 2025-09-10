import {
  CallToolRequestSchema,
  CallToolResultSchema,
  GetPromptRequestSchema,
  GetPromptResultSchema,
  InitializeRequestSchema,
  InitializeResultSchema,
  type JSONRPCMessage,
  ListPromptsRequestSchema,
  ListPromptsResultSchema,
  ListResourcesRequestSchema,
  ListResourcesResultSchema,
  ListResourceTemplatesRequestSchema,
  ListResourceTemplatesResultSchema,
  ListToolsRequestSchema,
  ListToolsResultSchema,
  type Prompt,
  ReadResourceRequestSchema,
  ReadResourceResultSchema,
  type Resource,
  type ResourceTemplate,
  type ServerCapabilities,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';

// method constants
export const METHOD_INITIALIZE = InitializeRequestSchema.shape.method.value;
export const METHOD_LIST_TOOLS = ListToolsRequestSchema.shape.method.value;
export const METHOD_LIST_RESOURCES = ListResourcesRequestSchema.shape.method.value;
export const METHOD_LIST_RESOURCE_TEMPLATES = ListResourceTemplatesRequestSchema.shape.method.value;
export const METHOD_LIST_PROMPTS = ListPromptsRequestSchema.shape.method.value;
export const METHOD_CALL_TOOL = CallToolRequestSchema.shape.method.value;
export const METHOD_READ_RESOURCE = ReadResourceRequestSchema.shape.method.value;
export const METHOD_GET_PROMPT = GetPromptRequestSchema.shape.method.value;
const METHOD_UNKNOWN = 'unknown';
export const MCP_JSONRPC_METHODS = [
  METHOD_INITIALIZE,
  METHOD_LIST_TOOLS,
  METHOD_LIST_RESOURCES,
  METHOD_LIST_RESOURCE_TEMPLATES,
  METHOD_LIST_PROMPTS,
  METHOD_CALL_TOOL,
  METHOD_READ_RESOURCE,
  METHOD_GET_PROMPT,
];

export type JSONRPCMessageMethods =
  | typeof METHOD_INITIALIZE
  | typeof METHOD_LIST_TOOLS
  | typeof METHOD_LIST_RESOURCES
  | typeof METHOD_LIST_RESOURCE_TEMPLATES
  | typeof METHOD_LIST_PROMPTS
  | typeof METHOD_CALL_TOOL
  | typeof METHOD_READ_RESOURCE
  | typeof METHOD_GET_PROMPT;

export interface McpServerData {
  serverCapabilities: ServerCapabilities;
  primitives: {
    tools: Tool[];
    resources: Resource[];
    resourceTemplates: ResourceTemplate[];
    prompts: Prompt[];
  };
}

export const getMcpMethodFromMessage = (message: JSONRPCMessage): JSONRPCMessageMethods | typeof METHOD_UNKNOWN => {
  let method: JSONRPCMessageMethods | typeof METHOD_UNKNOWN = METHOD_UNKNOWN;
  if ('result' in message) {
    const messageResult = message.result;
    if (InitializeResultSchema.safeParse(messageResult).success) {
      method = METHOD_INITIALIZE;
    } else if (ListToolsResultSchema.safeParse(messageResult).success) {
      method = METHOD_LIST_TOOLS;
    } else if (ListResourcesResultSchema.safeParse(messageResult).success) {
      method = METHOD_LIST_RESOURCES;
    } else if (ListResourceTemplatesResultSchema.safeParse(messageResult).success) {
      method = METHOD_LIST_RESOURCE_TEMPLATES;
    } else if (ListPromptsResultSchema.safeParse(messageResult).success) {
      method = METHOD_LIST_PROMPTS;
    } else if (CallToolResultSchema.safeParse(messageResult).success) {
      method = METHOD_CALL_TOOL;
    } else if (ReadResourceResultSchema.safeParse(messageResult).success) {
      method = METHOD_READ_RESOURCE;
    } else if (GetPromptResultSchema.safeParse(messageResult).success) {
      method = METHOD_GET_PROMPT;
    }
  }
  return method;
};
