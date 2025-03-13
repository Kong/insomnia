import type { CookieJar } from '../models/cookie-jar';
import type { Environment, UserUploadEnvironment } from '../models/environment';
import type { GrpcRequest, GrpcRequestBody } from '../models/grpc-request';
import type { Project } from '../models/project';
import type { Request } from '../models/request';
import type { RequestGroup } from '../models/request-group';
import type { getBodyBuffer, getLatestForRequest } from '../models/response';
import type { WebSocketRequest } from '../models/websocket-request';
import type { Workspace } from '../models/workspace';

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

export const KEEP_ON_ERROR = 'keep';
export const THROW_ON_ERROR = 'throw';
export type RenderPurpose = 'send' | 'general' | 'preview' | 'script' | 'no-render';

/** Key/value pairs to be provided to the render context */
export type ExtraRenderInfo = {
  name: string;
  value: any;
}[];

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
  extraInfo?: ExtraRenderInfo;
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
