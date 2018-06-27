// @flow
import type { NunjucksParsedTagArg } from '../utils';
import type { Request } from '../../models/request';
import type { Response } from '../../models/response';

export type PluginArgumentValue = string | number | boolean;
type DisplayName = string | ((args: Array<NunjucksParsedTagArg>) => string);

type PluginArgumentBase = {
  displayName: DisplayName,
  description?: string,
  help?: string,
  hide?: (args: Array<NunjucksParsedTagArg>) => boolean
};

export type PluginArgumentEnumOption = {
  displayName: DisplayName,
  value: PluginArgumentValue,
  description?: string,
  placeholder?: string
};

export type PluginArgumentEnum = PluginArgumentBase & {
  type: 'enum',
  options: Array<PluginArgumentEnumOption>,
  defaultValue?: PluginArgumentValue
};

export type PluginArgumentModel = PluginArgumentBase & {
  type: 'model',
  model: string,
  defaultValue?: string
};

export type PluginArgumentString = PluginArgumentBase & {
  type: 'string',
  placeholder?: string,
  defaultValue?: string
};

export type PluginArgumentBoolean = PluginArgumentBase & {
  type: 'boolean',
  defaultValue?: boolean
};

export type PluginArgumentFile = PluginArgumentBase & {
  type: 'file'
};

export type PluginArgumentNumber = PluginArgumentBase & {
  type: 'number',
  placeholder?: string,
  defaultValue?: number
};

export type PluginArgument =
  | PluginArgumentEnum
  | PluginArgumentModel
  | PluginArgumentString
  | PluginArgumentBoolean
  | PluginArgumentFile
  | PluginArgumentNumber;

export type PluginTemplateTagContext = {
  util: {
    models: {
      request: {
        getById: (id: string) => Promise<Request | null>
      },
      response: {
        getLatestForRequestId: (id: string) => Promise<Response | null>,
        getBodyBuffer: (
          response: Response,
          fallback?: any
        ) => Promise<Buffer | null>
      }
    }
  }
};

export type PluginTemplateTag = {
  args: Array<PluginArgument>,
  name: string,
  displayName: DisplayName,
  description: string,
  run: (
    context: PluginTemplateTagContext,
    ...arg: Array<any>
  ) => Promise<any> | any,
  deprecated?: boolean,
  validate?: (value: any) => ?string,
  priority?: number
};
