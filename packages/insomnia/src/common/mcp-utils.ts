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
  PromptSchema,
  ReadResourceRequestSchema,
  ReadResourceResultSchema,
  type Resource,
  ResourceListChangedNotificationSchema,
  ResourceSchema,
  type ResourceTemplate,
  ResourceTemplateSchema,
  ResourceUpdatedNotificationSchema,
  type ServerCapabilities,
  ServerNotificationSchema,
  ServerRequestSchema,
  SubscribeRequestSchema,
  TaskStatusNotificationSchema,
  type Tool,
  ToolListChangedNotificationSchema,
  ToolSchema,
  UnsubscribeRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { RJSFSchema } from '@rjsf/utils';

import type { McpEvent, McpMessageEvent } from '~/main/mcp/types';

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

// One dropped entry from a partially-invalid list, e.g. a single malformed tool.
export interface McpListEntryError {
  label: string;
  reason: string;
}

// Structured description of why a list request failed or came back partially invalid, meant to be
// rendered directly (a one-line summary plus an optional per-entry breakdown) rather than a single
// flattened string.
export interface McpListValidationError {
  title: string;
  entries?: McpListEntryError[];
}

export interface McpListResult {
  data?: any;
  error?: McpListValidationError;
}

// Merges the (at most a couple) independent list errors for a primitive type - e.g. resources and
// resourceTemplates are two separate requests but share one root item - into a single error so the
// root item only ever carries one.
export const combineListErrors = (
  ...errors: (McpListValidationError | undefined)[]
): McpListValidationError | undefined => {
  const present = errors.filter((error): error is McpListValidationError => error !== undefined);
  if (present.length === 0) {
    return undefined;
  }
  if (present.length === 1) {
    return present[0];
  }
  return {
    title: present.map(error => error.title).join(' / '),
    entries: present.flatMap(error => error.entries || []),
  };
};

interface ZodLikeSchema {
  safeParse: (value: unknown) => {
    success: boolean;
    data?: unknown;
    error?: { issues: { path: PropertyKey[]; message: string }[] };
  };
}

const PRIMITIVE_LIST_CONFIG: Record<
  string,
  { itemsKey: string; resultSchema: ZodLikeSchema; itemSchema: ZodLikeSchema }
> = {
  [METHOD_LIST_TOOLS]: { itemsKey: 'tools', resultSchema: ListToolsResultSchema, itemSchema: ToolSchema },
  [METHOD_LIST_RESOURCES]: {
    itemsKey: 'resources',
    resultSchema: ListResourcesResultSchema,
    itemSchema: ResourceSchema,
  },
  [METHOD_LIST_RESOURCE_TEMPLATES]: {
    itemsKey: 'resourceTemplates',
    resultSchema: ListResourceTemplatesResultSchema,
    itemSchema: ResourceTemplateSchema,
  },
  [METHOD_LIST_PROMPTS]: { itemsKey: 'prompts', resultSchema: ListPromptsResultSchema, itemSchema: PromptSchema },
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const labelForListItem = (item: unknown): string | undefined => {
  if (!isRecord(item)) {
    return undefined;
  }
  for (const key of ['name', 'uriTemplate', 'uri', 'title']) {
    const candidate = item[key];
    if (typeof candidate === 'string' && candidate.length > 0) {
      return candidate;
    }
  }
  return undefined;
};

// Validates a list result against its schema.
// If the whole envelope is invalid (e.g. the items are not even an array), the entire list fails to render.
// If only some entries are malformed, the valid entries are still returned and the malformed ones are summarized as an error.
const validateListResult = (method: string, result: unknown): McpListResult => {
  const config = PRIMITIVE_LIST_CONFIG[method];
  if (!config) {
    return { data: result };
  }
  if (config.resultSchema.safeParse(result).success) {
    return { data: result };
  }
  const items = isRecord(result) ? result[config.itemsKey] : undefined;
  if (!Array.isArray(items)) {
    // Cannot even identify the list of entries in the response - the whole response is invalid
    return { error: { title: `Server returns ${method} response that does not meet MCP schema` } };
  }
  const validItems: unknown[] = [];
  const entries: McpListEntryError[] = [];
  items.forEach((item, index) => {
    const parsed = config.itemSchema.safeParse(item);
    if (parsed.success) {
      validItems.push(parsed.data);
      return;
    }
    const [issue] = parsed.error?.issues || [];
    const reason = issue
      ? `${issue.path.length > 0 ? `${issue.path.join('.')}: ` : ''}${issue.message}`
      : 'did not match the expected shape';
    entries.push({ label: labelForListItem(item) || `index ${index}`, reason });
  });
  if (entries.length === 0) {
    return { data: { ...(isRecord(result) ? result : {}), [config.itemsKey]: validItems } };
  }
  return {
    data: { ...(isRecord(result) ? result : {}), [config.itemsKey]: validItems },
    error: {
      title: `Drop ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} that ${
        entries.length === 1 ? 'fails' : 'fail'
      } the MCP schema.`,
      entries,
    },
  };
};

// Finds the result data of the latest incoming event for a method
export const findFirstMatchEventData = (mcpEvents: McpEvent[], method: string) => {
  const firstMatchEvent = mcpEvents.find(
    event => 'method' in event && event.method === method && event.direction === 'INCOMING',
  ) as McpMessageEvent;
  if (firstMatchEvent) {
    return 'result' in firstMatchEvent.data ? firstMatchEvent.data.result : undefined;
  }
  return;
};

// Correlates the outgoing list request  with its matching incoming response by request id, then validates the response
export const findLatestListResult = (mcpEvents: McpEvent[], method: string): McpListResult | undefined => {
  const outgoingEvent = mcpEvents.find(
    event => 'method' in event && event.method === method && event.direction === 'OUTGOING',
  ) as McpMessageEvent | undefined;
  const outgoingRequestId = outgoingEvent && 'id' in outgoingEvent.data ? outgoingEvent.data.id : undefined;
  if (outgoingRequestId === undefined) {
    return undefined;
  }
  const incomingEvent = mcpEvents.find(event => {
    if (event.type === 'message' && event.direction === 'INCOMING') {
      return 'id' in event.data && event.data.id === outgoingRequestId;
    }
    if (event.type === 'error') {
      return event.error?.requestId === outgoingRequestId;
    }
    return false;
  });
  if (!incomingEvent) {
    // Response has not been received yet
    return undefined;
  }
  if (incomingEvent.type === 'error') {
    return { error: { title: incomingEvent.message || `MCP server returned an error for ${method}` } };
  }
  if (incomingEvent.type !== 'message') {
    return undefined;
  }
  const result = 'result' in incomingEvent.data ? incomingEvent.data.result : undefined;
  return validateListResult(method, result);
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
