import type { CookieJar } from '../models/cookie-jar';
import type { Environment, UserUploadEnvironment } from '../models/environment';
import type { GrpcRequest, GrpcRequestBody } from '../models/grpc-request';
import type { Project } from '../models/project';
import type { Request } from '../models/request';
import type { RequestGroup } from '../models/request-group';
import type { Response } from '../models/response';
import type { getBodyBuffer, getLatestForRequest } from '../models/response';
import type { WebSocketRequest } from '../models/websocket-request';
import type { Workspace } from '../models/workspace';
import type { PluginStore } from '../plugins/context';
import type { AppContext } from '../plugins/context/app';
import type { extractNunjucksTagFromCoords } from './utils';

export const KEEP_ON_ERROR = 'keep';
export const THROW_ON_ERROR = 'throw';
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

export type RenderedGrpcRequest = GrpcRequest;

export type RenderedGrpcRequestBody = GrpcRequestBody;

export interface RenderContextAndKeys {
  context: Record<string, any>;
  keys: {
    name: string;
    value: any;
  }[];
}

export type HandleGetRenderContext = (contextCacheKey?: string) => Promise<RenderContextAndKeys>;

export type HandleRender = <T>(object: T, contextCacheKey?: string | null) => Promise<T>;

export interface RenderRequest<T extends Request | GrpcRequest | WebSocketRequest> {
  request: T;
}

export interface BaseRenderContextOptions {
  environment?: string | Environment;
  baseEnvironment?: Environment;
  rootGlobalEnvironment?: Environment;
  subGlobalEnvironment?: Environment;
  userUploadEnvironment?: UserUploadEnvironment;
  transientVariables?: Environment;
  purpose?: RenderPurpose;
  extraInfo?: { name: string; value: any }[];
  ignoreUndefinedEnvVariable?: boolean;
}
export type RenderContextAncestor = Request | GrpcRequest | WebSocketRequest | RequestGroup | Workspace | Project;

export interface RenderContextOptions extends BaseRenderContextOptions, Partial<RenderRequest<Request | GrpcRequest | WebSocketRequest>> {
  ancestors?: RenderContextAncestor[];
}
export type RenderRequestOptions = BaseRenderContextOptions & RenderRequest<Request>;
export interface RequestAndContext {
  request: RenderedRequest;
  context: Record<string, any>;
}

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
  validate?: (value: any) => string;
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
  getMeta: () => {};
  getKeysContext: () => {};
  getPurpose: () => RenderPurpose | undefined;
  getExtraInfo: (key: string) => string[] | null;
  getEnvironmentId: () => string | undefined;
  getGlobalEnvironmentId: () => string | undefined;
  getProjectId: () => string | undefined;
}
export interface HelperContext {
  context: BaseRenderContext & {
    value: string | number;
  };
  meta: { requestId?: string; workspaceId?: string };
  renderPurpose?: RenderPurpose;
  util: {
    render: (str: string) => string | Promise<string | null>;
    models: {
      request: {
        getById: (id: string) => Promise<Request | null>;
        getAncestors: (request: Request) => Promise<(Request | RequestGroup | Workspace)[]>;
      };
      workspace: { getById: (id: string) => Promise<Workspace | null> };
      oAuth2Token: { getByRequestId: (id: string) => Promise<any> };
      cookieJar: { getOrCreateForWorkspace: (workspace: Workspace) => Promise<any> };
      response: {
        getLatestForRequestId: typeof getLatestForRequest;
        getBodyBuffer: typeof getBodyBuffer;
      };
    };
  };
}

export type PluginTemplateTagContext = HelperContext & {
  app: AppContext;
  store: PluginStore;
  network: {
    sendRequest(request: Request, extraInfo?: { name: string; value: any }[]): Promise<Response>;
  };
};

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
