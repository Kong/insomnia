// eslint-disable-next-line @typescript-eslint/no-explicit-any -- this is a temporary hold-me-over while we get the types into better condition
export type UNKNOWN = any;

export type UNKNOWN_OBJ = {
  [key: string]: UNKNOWN;
};

export interface Comment {
  comment?: UNKNOWN;
}

export type Variable = `{{ ${string} }}`;

export interface Authentication extends Comment {
  authorizationUrl?: string;
  accessTokenUrl?: string;
  clientId?: string;
  clientSecret?: Variable;
  scope?: string;
  type?: 'basic' | 'oauth2';
  grantType?: 'authorization_code' | 'password' | 'client_credentials';
  disabled?: boolean;
  username?: string;
  password?: string;
}

export interface Parameter extends Comment {
  name: string;
  value?: string;
  filename?: string;
  fileName?: string;
  disabled?: boolean;
  type?: 'file' | string;
}

export type Body =
  | string
  | {
      mimeType?: string;
      text?: string;
      params?: Parameter[];
    };

export interface Cookie {
  name: string;
  value: string;
}

export interface Header extends Comment {
  name: 'Cookie' | 'Content-Type' | string;
  disabled?: boolean;
  value: UNKNOWN;
}

export interface PostData {
  params?: Parameter[];
  mimeType?: string;
  text?: string;
}

export interface QueryString extends Comment {
  name: string;
}

export type ImportRequestType =
  | 'environment'
  | 'request'
  | 'request_group'
  | 'workspace';

export interface ImportRequest<T extends {} = {}> extends Comment {
  _id?: string;
  _type?: ImportRequestType;
  authentication?: Authentication;
  body?: Body;
  cookies?: Cookie[];
  environment?: UNKNOWN_OBJ;
  headers?: Header[];
  httpVersion?: string;
  method?: string;
  name?: string;
  data?: T;
  description?: string;
  parameters?: Parameter[];
  parentId?: string | null;
  postData?: PostData;
  variable?: UNKNOWN;
  queryString?: QueryString[];
  url?: string;
}

export type Converter<T extends {} = {}> = (
  rawData: string
) => ImportRequest<T>[] | Promise<ImportRequest<T>[] | null> | null;

export interface Importer {
  id: string;
  name: string;
  description: string;
  convert: Converter;
}
