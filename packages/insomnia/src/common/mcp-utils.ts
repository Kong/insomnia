import { UriTemplate } from '@modelcontextprotocol/sdk/shared/uriTemplate.js';
import {
  CallToolRequestSchema,
  CallToolResultSchema,
  CancelledNotificationSchema,
  CreateMessageRequestSchema,
  ElicitationCompleteNotificationSchema,
  ElicitRequestSchema,
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
  ListRootsRequestSchema,
  ListToolsRequestSchema,
  ListToolsResultSchema,
  LoggingMessageNotificationSchema,
  ProgressNotificationSchema,
  type Prompt,
  PromptListChangedNotificationSchema,
  ReadResourceRequestSchema,
  ReadResourceResultSchema,
  type Resource,
  ResourceListChangedNotificationSchema,
  type ResourceTemplate,
  ResourceUpdatedNotificationSchema,
  type ServerCapabilities,
  ServerNotificationSchema,
  ServerRequestSchema,
  SubscribeRequestSchema,
  TaskStatusNotificationSchema,
  type Tool,
  ToolListChangedNotificationSchema,
  UnsubscribeRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { RJSFSchema } from '@rjsf/utils';

// methods for server features
export const METHOD_INITIALIZE = InitializeRequestSchema.shape.method.value;
export const METHOD_LIST_TOOLS = ListToolsRequestSchema.shape.method.value;
export const METHOD_LIST_RESOURCES = ListResourcesRequestSchema.shape.method.value;
export const METHOD_LIST_RESOURCE_TEMPLATES = ListResourceTemplatesRequestSchema.shape.method.value;
export const METHOD_LIST_PROMPTS = ListPromptsRequestSchema.shape.method.value;
export const METHOD_CALL_TOOL = CallToolRequestSchema.shape.method.value;
export const METHOD_READ_RESOURCE = ReadResourceRequestSchema.shape.method.value;
export const METHOD_GET_PROMPT = GetPromptRequestSchema.shape.method.value;
export const METHOD_SUBSCRIBE_RESOURCE = SubscribeRequestSchema.shape.method.value;
export const METHOD_UNSUBSCRIBE_RESOURCE = UnsubscribeRequestSchema.shape.method.value;
// methods for client features
export const METHOD_SAMPLING_CREATE_MESSAGE = CreateMessageRequestSchema.shape.method.value;
export const METHOD_LIST_ROOTS = ListRootsRequestSchema.shape.method.value;
export const METHOD_ELICITATION_CREATE_MESSAGE = ElicitRequestSchema.shape.method.value;
// methods for notifications
export const METHOD_NOTIFICATION_CANCELLED = CancelledNotificationSchema.shape.method.value;
export const METHOD_NOTIFICATION_PROGRESS = ProgressNotificationSchema.shape.method.value;
export const METHOD_NOTIFICATION_LOGGING_MESSAGE = LoggingMessageNotificationSchema.shape.method.value;
export const METHOD_NOTIFICATION_RESOURCE_UPDATED = ResourceUpdatedNotificationSchema.shape.method.value;
export const METHOD_NOTIFICATION_RESOURCE_LIST_CHANGED = ResourceListChangedNotificationSchema.shape.method.value;
export const METHOD_NOTIFICATION_TOOL_LIST_CHANGED = ToolListChangedNotificationSchema.shape.method.value;
export const METHOD_NOTIFICATION_PROMPT_LIST_CHANGED = PromptListChangedNotificationSchema.shape.method.value;
export const METHOD_NOTIFICATION_ELICITATION_COMPLETE = ElicitationCompleteNotificationSchema.shape.method.value;
export const METHOD_NOTIFICATION_TASK_STATUS = TaskStatusNotificationSchema.shape.method.value;
// method for json-rpc error
export const METHOD_JSONRPC_ERROR = 'JSON-RPC Error';

export const unsupportedMethodPrefix = 'Unsupported/';
export const METHOD_UNKNOWN = 'Unknown Method';
export const NOTIFICATION_METHODS = [
  METHOD_NOTIFICATION_CANCELLED,
  METHOD_NOTIFICATION_PROGRESS,
  METHOD_NOTIFICATION_LOGGING_MESSAGE,
  METHOD_NOTIFICATION_RESOURCE_UPDATED,
  METHOD_NOTIFICATION_RESOURCE_LIST_CHANGED,
  METHOD_NOTIFICATION_TOOL_LIST_CHANGED,
  METHOD_NOTIFICATION_PROMPT_LIST_CHANGED,
  METHOD_NOTIFICATION_ELICITATION_COMPLETE,
  METHOD_NOTIFICATION_TASK_STATUS,
] as const;
export const CLIENT_METHODS = [
  METHOD_SAMPLING_CREATE_MESSAGE,
  METHOD_LIST_ROOTS,
  METHOD_ELICITATION_CREATE_MESSAGE,
] as const;
export const SERVER_METHODS = [
  METHOD_INITIALIZE,
  METHOD_LIST_TOOLS,
  METHOD_LIST_RESOURCES,
  METHOD_LIST_RESOURCE_TEMPLATES,
  METHOD_LIST_PROMPTS,
  METHOD_CALL_TOOL,
  METHOD_READ_RESOURCE,
  METHOD_GET_PROMPT,
];
export const NOTIFICATIONS_LIST_CHANGED: string[] = [
  METHOD_NOTIFICATION_RESOURCE_LIST_CHANGED,
  METHOD_NOTIFICATION_TOOL_LIST_CHANGED,
  METHOD_NOTIFICATION_PROMPT_LIST_CHANGED,
];
export const MCP_SERVER_REQUEST_METHODS: string[] = [
  METHOD_SAMPLING_CREATE_MESSAGE,
  METHOD_ELICITATION_CREATE_MESSAGE,
  METHOD_LIST_ROOTS,
];

export type McpServerMethods = (typeof SERVER_METHODS)[number];
export type NotificationMethods = (typeof NOTIFICATION_METHODS)[number];
export type McpClientMethods = (typeof CLIENT_METHODS)[number];
export type UnsupportedMcpClientMethods = `${typeof unsupportedMethodPrefix}${string}`;

export type JSONRPCMessageMethods = McpServerMethods | McpClientMethods | NotificationMethods;
export interface McpServerData {
  serverCapabilities: ServerCapabilities;
  primitives: {
    tools: Tool[];
    resources: Resource[];
    resourceTemplates: ResourceTemplate[];
    prompts: Prompt[];
  };
}

type McpMessageEventMethods = JSONRPCMessageMethods | typeof METHOD_UNKNOWN | UnsupportedMcpClientMethods;
export const getMcpMethodFromMessage = (message: JSONRPCMessage): McpMessageEventMethods => {
  let method: McpMessageEventMethods = 'Unknown Method';
  if (ServerNotificationSchema.safeParse(message).success) {
    // for server notification messages
    method = ServerNotificationSchema.parse(message).method;
  } else if ('result' in message) {
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
    } else if (GetPromptResultSchema.safeParse(messageResult).success) {
      method = METHOD_GET_PROMPT;
    } else if (ReadResourceResultSchema.safeParse(messageResult).success) {
      method = METHOD_READ_RESOURCE;
    } else if (CallToolResultSchema.safeParse(messageResult).success) {
      method = METHOD_CALL_TOOL;
    }
  } else if (ServerRequestSchema.safeParse(message).success) {
    const requestMethod = ServerRequestSchema.parse(message).method;
    // Support elicitation, sampling and listing roots requests from server
    method =
      requestMethod === METHOD_ELICITATION_CREATE_MESSAGE ||
      requestMethod === METHOD_SAMPLING_CREATE_MESSAGE ||
      requestMethod === METHOD_LIST_ROOTS
        ? requestMethod
        : `${unsupportedMethodPrefix}${requestMethod}`;
  }
  return method;
};

export const getDefaultServerCapabilities = () => {
  return {
    tools: {
      enabled: false,
      listChanged: false,
    },
    resources: {
      enabled: false,
      listChanged: false,
      subscribe: true,
    },
    prompts: {
      enabled: false,
      listChanged: false,
    },
  };
};

export const isResourceTemplate = (resource: Resource | ResourceTemplate): resource is ResourceTemplate => {
  return 'uriTemplate' in resource && resource.uriTemplate !== undefined;
};

export const buildResourceJsonSchema = (resource: Resource | ResourceTemplate): RJSFSchema => {
  if (isResourceTemplate(resource)) {
    const uriTemplate = new UriTemplate(resource.uriTemplate);
    const properties: Record<string, any> = {};
    const required: string[] = [];
    uriTemplate.variableNames.forEach(name => {
      properties[name] = {
        type: 'string',
      };
      required.push(name);
    });
    return {
      type: 'object',
      properties,
      required,
    };
  }
  return {
    type: 'object',
    properties: {
      uri: {
        type: 'string',
        default: resource.uri,
      },
    },
    required: ['uri'],
    readOnly: true,
  };
};

export const fillUriTemplate = (template: string, values: Record<string, string>): string => {
  return new UriTemplate(template).expand(values);
};
