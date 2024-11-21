import type { ExtraRenderInfo } from '../../common/render';
import type { Request } from '../../models/request';
import type { Response } from '../../models/response';
import type {
  PluginStore,
} from '../../plugins/context';
import type { AppContext } from '../../plugins/context/app';
import type { HelperContext } from '../base-extension';
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
  needsEnterprisePlan?: boolean;
  disablePreview?: (args: any[]) => boolean;
  description: string;
  actions?: NunjucksActionTag[];
  run: (context: PluginTemplateTagContext, ...arg: any[]) => Promise<any> | any;
  deprecated?: boolean;
  validate?: (value: any) => string | null;
  priority?: number;
}
