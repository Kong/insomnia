import type { NunjucksParsedTagArg } from '../utils';
import type { Request } from '../../models/request';
import type { Response } from '../../models/response';
import type { PluginStore } from '../../plugins/context';

export type PluginArgumentValue = string | number | boolean;

type DisplayName = string | ((args: NunjucksParsedTagArg[]) => string);

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

export interface PluginTemplateTagContext {
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
  args: PluginArgument[];
  name: string;
  displayName: DisplayName;
  disablePreview: () => boolean;
  description: string;
  actions: PluginTemplateTagAction[];
  run: (context: PluginTemplateTagContext, ...arg: any[]) => Promise<any> | any;
  deprecated?: boolean;
  validate?: (value: any) => string | null;
  priority?: number;
}
