import type { CookieJar } from '../models/cookie-jar';
import type { Environment, UserUploadEnvironment } from '../models/environment';
import type { GrpcRequest } from '../models/grpc-request';
import type { OAuth2Token } from '../models/o-auth-2-token';
import type { Project } from '../models/project';
import type { Request } from '../models/request';
import type { RequestGroup } from '../models/request-group';
import type { Response } from '../models/response';
import type { getBodyBuffer, getLatestForRequest } from '../models/response';
import type { SocketIORequest } from '../models/socket-io-request';
import type { WebSocketRequest } from '../models/websocket-request';
import type { Workspace } from '../models/workspace';
import type { PluginStore } from '../plugins/context';
import type { PromptModalOptions } from '../ui/components/modals/prompt-modal';
import type { extractNunjucksTagFromCoords } from './utils';

export type RenderPurpose = 'send' | 'general' | 'preview' | 'script' | 'no-render';

export type RenderedRequest = Request & {
  cookies: {
    name: string;
    value: string;
    disabled?: boolean;
  }[];
  cookieJar: CookieJar;
  suppressUserAgent: boolean;
};

export interface RenderContextAndKeys {
  context: BaseRenderContext;
  keys: {
    name: string;
    value: any;
  }[];
}

export type HandleRender = <T>(whatever: T, contextCacheKey?: string | null) => Promise<T>;

export interface BaseRenderContextOptions {
  environment?: string | Environment;
  baseEnvironment?: Environment;
  rootGlobalEnvironment?: Environment;
  subGlobalEnvironment?: Environment;
  userUploadEnvironment?: UserUploadEnvironment;
  transientVariables?: Environment;
  purpose?: RenderPurpose;
  extraInfo?: { requestChain: string[] };
  ignoreUndefinedEnvVariable?: boolean;
}
export type RenderContextAncestor =
  | Request
  | GrpcRequest
  | WebSocketRequest
  | SocketIORequest
  | RequestGroup
  | Workspace
  | Project;

export type RenderContextOptions = BaseRenderContextOptions &
  Partial<BaseRenderContextOptions & { request: Request | GrpcRequest | WebSocketRequest | SocketIORequest }> & {
    ancestors?: RenderContextAncestor[];
  };

export type NunjucksTagContextMenuAction = 'edit' | 'delete';

export interface nunjucksTagContextMenuOptions extends Exclude<ReturnType<typeof extractNunjucksTagFromCoords>, void> {
  type: NunjucksTagContextMenuAction;
}

export interface NunjucksParsedTagArg {
  type: 'string' | 'number' | 'boolean' | 'variable' | 'expression' | 'enum' | 'file' | 'model';
  encoding?: 'base64';
  value?: string | number | boolean;
  defaultValue?: string | number | boolean;
  forceVariable?: boolean;
  placeholder?: string;
  help?: string;
  displayName?: DisplayName;
  quotedBy?: '"' | "'";
  validate?: (value: string) => string;
  hide?: (arg0: NunjucksParsedTagArg[]) => boolean;
  model?: string;
  options?: PluginArgumentEnumOption[];
  itemTypes?: ('file' | 'directory')[];
  extensions?: string[];
  description?: string;
  requireSubForm?: boolean;
}

export interface NunjucksActionTag {
  name: string;
  icon?: string;
  run: (context: PluginTemplateTagActionContext) => Promise<void>;
}

export interface NunjucksParsedTag {
  name: string;
  args: NunjucksParsedTagArg[];
  actions?: NunjucksActionTag[];
  rawValue?: string;
  displayName?: string;
  description?: string;
  disablePreview?: (arg0: NunjucksParsedTagArg[]) => boolean;
}
export type PluginArgumentValue = string | number | boolean;

export type DisplayName = string | ((args: NunjucksParsedTagArg[]) => string);

interface PluginArgumentBase {
  displayName: DisplayName;
  description?: string;
  help?: string;
  hide?: (args: NunjucksParsedTagArg[]) => boolean;
}

export interface PluginArgumentEnumOption {
  displayName: DisplayName;
  value: PluginArgumentValue;
  description?: string;
  placeholder?: string;
}

export type PluginArgumentEnum = PluginArgumentBase & {
  type: 'enum';
  options: PluginArgumentEnumOption[];
  defaultValue?: PluginArgumentValue;
};

export type PluginArgumentModel = PluginArgumentBase & {
  type: 'model';
  model: string;
  defaultValue?: string;
};

export type PluginArgumentString = PluginArgumentBase & {
  type: 'string';
  placeholder?: string;
  defaultValue?: string;
};

export type PluginArgumentBoolean = PluginArgumentBase & {
  type: 'boolean';
  defaultValue?: boolean;
};

export type PluginArgumentFile = PluginArgumentBase & {
  type: 'file';
};

export type PluginArgumentNumber = PluginArgumentBase & {
  type: 'number';
  placeholder?: string;
  defaultValue?: number;
};

export type PluginArgument =
  | PluginArgumentEnum
  | PluginArgumentModel
  | PluginArgumentString
  | PluginArgumentBoolean
  | PluginArgumentFile
  | PluginArgumentNumber;

export interface BaseRenderContext {
  getMeta: () => { requestId?: string; workspaceId?: string };
  getKeysContext: () => { keyContext: Record<string, string> }; // { keyContext: { 'env var name': 'Base Env' } };
  getPurpose: () => RenderPurpose | undefined;
  getExtraInfo: () => { requestChain: string[] } | undefined;
  getEnvironmentId: () => string | undefined;
  getGlobalEnvironmentId: () => string | undefined;
  getProjectId: () => string | undefined;
  [key: string]: any;
}
export interface AppContext {
  alert: (title: string, message?: string) => void;
  dialog: (
    title: string,
    body: HTMLElement,
    options?: { onHide?: () => void; tall?: boolean; skinny?: boolean; wide?: boolean },
  ) => void;
  prompt: (
    title: string,
    options?: Pick<PromptModalOptions, 'label' | 'defaultValue' | 'submitName' | 'inputType'>,
  ) => Promise<string>;
  getPath: (name: string) => string;
  getInfo: () => { version: string; platform: NodeJS.Platform };
  showSaveDialog: (options?: { defaultPath?: string }) => Promise<string | null>;
  clipboard: { readText(): string; writeText(text: string): void; clear(): void };
}
export interface PluginTemplateTagContext {
  app: AppContext;
  store: PluginStore;
  network: {
    sendRequest(
      request: Request,
      extraInfo?: {
        requestChain: string[];
        environmentId?: string;
      },
    ): Promise<Response>;
  };
  context: BaseRenderContext & {
    value: string | number;
  };
  meta: { requestId?: string; workspaceId?: string };
  renderPurpose?: RenderPurpose;
  util: {
    nodeOS: () => Promise<{
      arch: string;
      platform: NodeJS.Platform;
      release: string;
    }>;
    readFile: (path: string, encoding?: string) => Promise<string | Buffer>;
    decode: (buffer: Buffer, encoding?: string) => Promise<string>;
    render: (str: string) => string | Promise<string | null>;
    models: {
      request: {
        getById: (id: string) => Promise<Request | null>;
        getAncestors: (request: Request) => Promise<(Request | RequestGroup | Workspace)[]>;
      };
      workspace: { getById: (id: string) => Promise<Workspace | null> };
      oAuth2Token: { getByRequestId: (id: string) => Promise<OAuth2Token | null> };
      cookieJar: { getOrCreateForParentId: (parentId: string) => Promise<CookieJar> };
      response: {
        getLatestForRequestId: typeof getLatestForRequest;
        getBodyBuffer: typeof getBodyBuffer;
      };
    };
  };
}

export interface PluginTemplateTagActionContext {
  store: PluginStore;
}

export interface PluginTemplateTagAction {
  name: string;
  icon?: string;
  run: (context: PluginTemplateTagActionContext) => Promise<void>;
}

export interface PluginTemplateTag {
  args: NunjucksParsedTagArg[];
  name: string;
  liveDisplayName?: (args: any[]) => string;
  displayName: DisplayName;
  needsEnterprisePlan?: boolean;
  disablePreview?: (args: any[]) => boolean;
  description: string;
  actions?: NunjucksActionTag[];
  run: (context: PluginTemplateTagContext, ...arg: any[]) => Promise<any> | any;
  deprecated?: boolean;
  validate?: (value: any) => string | null;
  priority?: number;
}
