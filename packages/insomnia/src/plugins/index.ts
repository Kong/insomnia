import type { ParsedApiSpec } from '../common/api-specs';
import type { GrpcRequest } from '../models/grpc-request';
import type { Request } from '../models/request';
import type { RequestGroup } from '../models/request-group';
import type { WebSocketRequest } from '../models/websocket-request';
import type { Workspace } from '../models/workspace';
import type { PluginTemplateTag } from '../templating/types';
import type { PluginTheme } from './misc';
import themes from './themes';

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
      request: Request | GrpcRequest | WebSocketRequest;
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

export async function init() {
  await reloadPlugins();
}

export async function reloadPlugins() {
  await window.main.getPlugins(true);
}

async function getActivePlugins(): Promise<Plugin[]> {
  return (await window.main.getPlugins()).filter(p => !p.config.disabled);
}

export async function getRequestGroupActions(): Promise<RequestGroupAction[]> {
  let extensions: RequestGroupAction[] = [];

  for (const plugin of await getActivePlugins()) {
    const actions = plugin.module.requestGroupActions || [];
    extensions = [
      ...extensions,
      ...actions.map(p => ({
        plugin,
        ...p,
      })),
    ];
  }

  return extensions;
}

export async function getRequestActions(): Promise<RequestAction[]> {
  let extensions: RequestAction[] = [];

  for (const plugin of await getActivePlugins()) {
    const actions = plugin.module.requestActions || [];
    extensions = [
      ...extensions,
      ...actions.map(p => ({
        plugin,
        ...p,
      })),
    ];
  }

  return extensions;
}

export async function getWorkspaceActions(): Promise<WorkspaceAction[]> {
  let extensions: WorkspaceAction[] = [];

  for (const plugin of await getActivePlugins()) {
    const actions = plugin.module.workspaceActions || [];
    extensions = [
      ...extensions,
      ...actions.map(p => ({
        plugin,
        ...p,
      })),
    ];
  }

  return extensions;
}

export async function getDocumentActions(): Promise<DocumentAction[]> {
  let extensions: DocumentAction[] = [];

  for (const plugin of await getActivePlugins()) {
    const actions = plugin.module.documentActions || [];
    extensions = [
      ...extensions,
      ...actions.map(p => ({
        plugin,
        ...p,
      })),
    ];
  }

  return extensions;
}

export async function getTemplateTags(): Promise<TemplateTag[]> {
  let extensions: TemplateTag[] = [];

  for (const plugin of await getActivePlugins()) {
    const templateTags = plugin.module.templateTags || [];
    extensions = [
      ...extensions,
      ...templateTags.map(tt => ({
        plugin,
        templateTag: tt,
      })),
    ];
  }

  return extensions;
}

export async function getRequestHooks(): Promise<RequestHook[]> {
  let functions: RequestHook[] = [
    {
      plugin: {
        name: 'default-headers',
        description: 'Set default headers for all requests',
        version: '0.0.0',
        directory: '',
        config: {
          disabled: false,
        },
        module: {},
      },
      hook: context => {
        const headers = context.request.getEnvironmentVariable('DEFAULT_HEADERS');
        if (!headers) {
          return;
        }
        for (const name of Object.keys(headers)) {
          const value = headers[name];
          if (context.request.hasHeader(name)) {
            console.log(`[header] Skip setting default header ${name}. Already set to ${value}`);
            continue;
          }
          if (value === 'null') {
            context.request.removeHeader(name);
            console.log(`[header] Remove default header ${name}`);
          } else {
            context.request.setHeader(name, value);
            console.log(`[header] Set default header ${name}: ${value}`);
          }
        }
      },
    },
  ];

  for (const plugin of await getActivePlugins()) {
    const moreFunctions = plugin.module.requestHooks || [];
    functions = [
      ...functions,
      ...moreFunctions.map(hook => ({
        plugin,
        hook,
      })),
    ];
  }

  return functions;
}

export async function getResponseHooks(): Promise<ResponseHook[]> {
  let functions: ResponseHook[] = [];

  for (const plugin of await getActivePlugins()) {
    const moreFunctions = plugin.module.responseHooks || [];
    functions = [
      ...functions,
      ...moreFunctions.map(hook => ({
        plugin,
        hook,
      })),
    ];
  }

  return functions;
}

export async function getThemes(): Promise<Theme[]> {
  let extensions = themes.map(theme => ({
    plugin: {
      name: theme.name,
      description: 'Built-in themes',
      version: '0.0.0',
      directory: '',
      config: {
        disabled: false,
      },
      module: {},
    },
    theme,
  })) as Theme[];
  for (const plugin of await getActivePlugins()) {
    const themes = plugin.module.themes || [];
    extensions = [
      ...extensions,
      ...themes.map(theme => ({
        plugin,
        theme,
      })),
    ];
  }

  return extensions;
}
