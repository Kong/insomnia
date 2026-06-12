import type { GrpcRequest, Request, RequestGroup, SocketIORequest, WebSocketRequest, Workspace } from 'insomnia-data';

import type { PluginTheme } from '~/plugins/bridge-types';

import type { ParsedApiSpec } from '../common/api-specs';
import type { PluginTemplateTag } from '../templating/types';

// shared types for private plugins

export interface ModelConfig {
  // ModelBackendConfig
  model: string;
  backend: 'gguf' | 'claude' | 'openai' | 'gemini' | 'url';
  maxTokens?: number;

  apiKey?: string; // gemini, openai, claude

  // openai, url
  baseURL?: string;
  url?: string;
  organization?: string;

  // openai, gemini, url, gguf
  topP?: number;
  temperature?: number;
  sendTemperature?: boolean;
  sendTopP?: boolean;
  sendMaxTokens?: boolean;

  // gguf, gemini, url
  topK?: number;

  // gguf
  seed?: number;
  repeatPenalty?: number;
}

export interface MultiTurnMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface MockRouteData {
  path: string;
  method: string;
  statusCode: number;
  headers: { name: string; value: string }[];
  mimeType?: string;
  body?: string;
}

export type GenerateCommitsFromDiffFunction = (
  input: {
    diff: string;
    recent_commits: string;
  },
  modelConfig: ModelConfig,
) => Promise<
  {
    message: string;
    files: string[];
  }[]
>;

export type GenerateMcpSamplingResponseFunction = (parameters: {
  systemPrompt?: string;
  messages: MultiTurnMessage[];
  modelConfig: Pick<ModelConfig, 'maxTokens' | 'temperature'>;
}) => Promise<{ content: string; modelConfig: ModelConfig }>;

export interface Plugin {
  name: string;
  description: string;
  version: string;
  directory: string;
  config: { disabled: boolean };
  module: {
    templateTags?: PluginTemplateTag[];
    requestHooks?: ((requestContext: any) => void)[];
    responseHooks?: ((responseContext: any) => void)[];
    themes?: PluginTheme[];
    requestGroupActions?: OmitInternal<RequestGroupAction>[];
    requestActions?: OmitInternal<RequestAction>[];
    workspaceActions?: OmitInternal<WorkspaceAction>[];
    documentActions?: OmitInternal<DocumentAction>[];
    // Plugin actions which will be executed in main process(node integration) context. For internal use only, not for public plugins
    unsafePluginMainActions?: OmitInternal<PluginAction>[];
  };
}

type OmitInternal<T> = Omit<T, keyof { plugin: Plugin }>;
export type TemplateTag = { plugin: Plugin } & {
  templateTag: PluginTemplateTag;
};

export type RequestGroupAction = { plugin: Plugin } & {
  action: (
    context: Record<string, any>,
    models: {
      requestGroup: RequestGroup;
      requests: (Request | GrpcRequest | WebSocketRequest)[];
    },
  ) => void | Promise<void>;
  label: string;
  icon?: string;
};

export type RequestAction = { plugin: Plugin } & {
  action: (
    context: Record<string, any>,
    models: {
      requestGroup?: RequestGroup;
      request: Request | GrpcRequest | WebSocketRequest | SocketIORequest;
    },
  ) => void | Promise<void>;
  label: string;
  icon?: string;
};

export type WorkspaceAction = { plugin: Plugin } & {
  action: (
    context: Record<string, any>,
    models: {
      workspace: Workspace;
      requestGroups: RequestGroup[];
      requests: Request[];
    },
  ) => void | Promise<void>;
  label: string;
  icon?: string;
};

export type DocumentAction = { plugin: Plugin } & {
  action: (context: Record<string, any>, documents: ParsedApiSpec) => void | Promise<void>;
  label: string;
  hideAfterClick?: boolean;
};

export type PluginAction = { plugin: Plugin } & {
  name: string;
  description?: string;
  action: (context: Record<string, any>, params?: any) => Promise<any>;
};

type RequestHookCallback = (context: any) => void;

export type RequestHook = { plugin: Plugin } & {
  hook: RequestHookCallback;
};

type ResponseHookCallback = (context: any) => void;
export type ResponseHook = { plugin: Plugin } & {
  hook: ResponseHookCallback;
};

export type Theme = { plugin: Plugin } & {
  theme: PluginTheme;
};

export type ColorScheme = 'default' | 'light' | 'dark';
