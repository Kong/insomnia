
import { ExtraRenderInfo } from '../../common/render';
import { BaseModel } from '../../models';
import { CookieJar } from '../../models/cookie-jar';
import { OAuth2Token } from '../../models/o-auth-2-token';
import type { Request } from '../../models/request';
import type { Response } from '../../models/response';
import { Workspace } from '../../models/workspace';
import {
  PluginStore,
} from '../../plugins/context';
import { AppContext } from '../../plugins/context/app';
import { HelperContext } from '../base-extension';
import type { NunjucksActionTag, NunjucksParsedTagArg } from '../utils';
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

export type PluginTemplateTagContext = HelperContext & {
  app: AppContext;
  store:  PluginStore;
  network: {
    sendRequest(request: Request, extraInfo?: ExtraRenderInfo): Promise<Response>;
  };
  util: {
    models: {
      request: {
        getById: (id: string) => Promise<Request | null>;
      };
      response: {
        getLatestForRequestId: (id: string) => Promise<Response | null>;
        getBodyBuffer: (response: Response, fallback?: any) => Promise<Buffer | null>;
      };
    };
  };
};

export interface PluginTemplateFilterContext {
  meta: {
    requestId: string;
    environmentId: string;
    workspaceId: string;
  };
  context: any;
  util: {
    render: (str: string, extContext: object) => string | Promise<string | null>;
    models: {
      request: {
        getById: (id: string) => Promise<Request | null>;
        getAncestors: (request: BaseModel) => Promise<BaseModel[]>;
      };
      workspace: {
        getById: (id?: string | undefined) => Promise<Workspace | null>;
      };
      oAuth2Token: { getByRequestId: (parentId: string) => Promise<OAuth2Token | null> };
      cookieJar: {
        getOrCreateForWorkspace: (workspace: Workspace) => Promise<CookieJar>;
      };
      response: {
        getLatestForRequestId: (requestId: string, environmentId: string | null) => Promise<Response | null>;
        getAvailablesRequestId: (requestId: string, top: number, environmentId: string | null) => Promise<Response[]>;
        getBodyBuffer: (response?: { bodyPath?: string; bodyCompression?: 'zip' | null }, readFailureValue?: string) => Buffer | string | null;
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
  displayName: DisplayName;
  disablePreview?: (args: any[]) => boolean;
  description: string;
  actions?: NunjucksActionTag[];
  run: (context: PluginTemplateTagContext, ...arg: any[]) => Promise<any> | any;
  deprecated?: boolean;
  validate?: (value: any) => string | null;
  priority?: number;
}

export interface PluginTemplateFilter {
  name: string;
  displayName: string;
  args: PluginArgument[];
  description: string;
  run: (context: PluginTemplateFilterContext, input: any, ...arg: any[]) => Promise<any> | any;
}
