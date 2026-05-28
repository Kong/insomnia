import type { BinaryToTextEncoding } from 'node:crypto';

import type { Cookie } from 'tough-cookie';

import type {
  CloudProviderCredential,
  CookieJar,
  Environment,
  GrpcRequest,
  McpRequest,
  OAuth2Token,
  Project,
  Request,
  RequestGroup,
  Response,
  Services,
  SocketIORequest,
  UserUploadEnvironment,
  WebSocketRequest,
  Workspace,
} from '~/insomnia-data';

import type { NodeCurlRequestOptions, NodeCurlResponseType } from '../plugins/context/network';
import type { PluginStore } from '../plugins/context/store';

export type RenderPurpose = 'send' | 'general' | 'preview' | 'script' | 'no-render';
export type PluginToMainAPIPaths =
  | 'readFile'
  | 'nodeOS'
  | 'decode'
  | 'encode'
  | 'request.getById'
  | 'request.getAncestors'
  | 'workspace.getById'
  | 'oAuth2Token.getByRequestId'
  | 'cookieJar.getOrCreateForParentId'
  | 'cookieJar.getCookiesForUrl'
  | 'response.getLatestForRequestId'
  | 'response.getBodyBuffer'
  | 'pluginData.hasItem'
  | 'pluginData.setItem'
  | 'pluginData.getItem'
  | 'pluginData.removeItem'
  | 'pluginData.clear'
  | 'pluginData.all'
  | 'cloudCredential.getById'
  | 'cloudCredential.update'
  | 'settings.get'
  | 'openInBrowser'
  | 'network.sendRequest'
  | 'network.sendRequestWithoutSideEffects'
  | 'plugin.getBundlePluginTemplateTags'
  | 'plugin.executeBundlePluginTag'
  | 'plugin.executeBundlePluginMainAction';

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
  | McpRequest
  | Project;

export type RenderContextOptions = BaseRenderContextOptions &
  Partial<
    BaseRenderContextOptions & { request: Request | GrpcRequest | WebSocketRequest | SocketIORequest | McpRequest }
  > & {
    ancestors?: RenderContextAncestor[];
  };

export type NunjucksTagContextMenuAction = 'edit' | 'delete';

export interface nunjucksTagContextMenuOptions {
  range: { from: { line: number; ch: number }; to: { line: number; ch: number } };
  template: string;
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

interface PromptModalOptions {
  title: string;
  defaultValue?: string;
  submitName?: string;
  selectText?: boolean;
  upperCase?: boolean;
  hint?: string;
  inputType?: string;
  placeholder?: string;
  validate?: (arg0: string) => string;
  label?: string;
  hints?: string[];
  onComplete?: (arg0: string) => Promise<void> | void;
  onHide?: () => void;
  onDeleteHint?: (arg0?: string) => void;
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
    sendRequestWithoutSideEffects(options: NodeCurlRequestOptions): Promise<NodeCurlResponseType>;
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
    readFile: (path: string) => Promise<string>;
    decode: (buffer: Buffer, encoding?: string) => Promise<string>;
    encode: (input: string, encoding: BinaryToTextEncoding) => Promise<string>;
    render: (str: string) => string | Promise<string | null>;
    openInBrowser?: (url: string) => void;
    models: {
      request: {
        getById: (id: string) => Promise<Request | undefined>;
        getAncestors: (request: Request) => Promise<(Request | RequestGroup | Workspace)[]>;
      };
      cloudCredential: {
        getById: (id: string) => Promise<CloudProviderCredential | undefined>;
        update: (
          originCredential: CloudProviderCredential,
          patch: Partial<CloudProviderCredential>,
        ) => Promise<CloudProviderCredential>;
      };
      workspace: { getById: (id: string) => Promise<Workspace | undefined> };
      oAuth2Token: { getByRequestId: (id: string) => Promise<OAuth2Token | undefined> };
      cookieJar: {
        getOrCreateForParentId: (parentId: string) => Promise<CookieJar>;
        getCookiesForUrl: (parentId: string, url: string) => Promise<Cookie[]>;
      };
      response: {
        getLatestForRequestId: Services['response']['getLatestForRequestId'];
        getBodyBuffer: Services['helpers']['getResponseBodyBuffer'];
      };
      settings: {
        get: Services['settings']['get'];
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
  validate?: (value: any) => string | null | boolean;
  priority?: number;
}
export interface RenderInputType {
  input: string;
  context: BaseRenderContext;
  path: string;
  ignoreUndefinedEnvVariable: boolean;
}
