// @flow
import * as plugins from '../../plugins/index';

import timestampExtension from './timestamp-extension';
import uuidExtension from './uuid-extension';
import NowExtension from './now-extension';
import responseExtension from './response-extension';
import base64Extension from './base-64-extension';
import requestExtension from './request-extension';
import type {NunjucksParsedTagArg} from '../utils';
import type {Request} from '../../models/request';
import type {Response} from '../../models/response';

export type PluginArgumentValue = string | number | boolean;
type DisplayName = string | (args: Array<NunjucksParsedTagArg>) => string;

type PluginArgumentBase = {
  displayName: DisplayName,
  description?: string,
  help?: string,
  hide?: (args: Array<NunjucksParsedTagArg>) => boolean,
};

export type PluginArgumentEnumOption = {
  displayName: DisplayName,
  description: string,
  value: PluginArgumentValue,
  placeholder?: string
}

export type PluginArgumentEnum = PluginArgumentBase & {
  type: 'enum';
  options: Array<PluginArgumentEnumOption>,
  defaultValue?: PluginArgumentValue
};

export type PluginArgumentModel = PluginArgumentBase & {
  type: 'model';
  model: string,
  defaultValue?: string
};

export type PluginArgumentString = PluginArgumentBase & {
  type: 'string';
  placeholder?: string,
  defaultValue?: string
};

export type PluginArgumentNumber = PluginArgumentBase & {
  type: 'number';
  placeholder?: string,
  defaultValue?: number
};

export type PluginArgument =
  PluginArgumentEnum
  | PluginArgumentModel
  | PluginArgumentString
  | PluginArgumentNumber;

export type PluginTemplateTagContext = {
  util: {
    models: {
      request: {
        getById: (id: string) => Promise<Request | null>
      },
      response: {
        getLatestForRequestId: (id: string) => Promise<Response | null>,
        getBodyBuffer: (response: Response, fallback?: any) => Promise<Buffer | null>,
      }
    }
  }
};

export type PluginTemplateTag = {
  args: Array<PluginArgument>,
  name: string,
  displayName: DisplayName,
  description: string,
  run: (context: PluginTemplateTagContext, ...arg: Array<any>) => Promise<any> | any,
  deprecated?: boolean,
  priority?: number
};

const DEFAULT_EXTENSIONS: Array<PluginTemplateTag> = [
  timestampExtension,
  NowExtension,
  uuidExtension,
  base64Extension,
  requestExtension,
  responseExtension
];

export async function all (): Promise<Array<PluginTemplateTag>> {
  const templateTags = await plugins.getTemplateTags();
  return [
    ...DEFAULT_EXTENSIONS,
    ...templateTags.map(p => p.templateTag)
  ];
}
