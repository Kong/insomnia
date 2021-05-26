import { DCRoute, DCUpstream } from './declarative-config';
import { K8sIngressTLS } from './kubernetes-config';

export const xKongName = 'x-kong-name';
export interface XKongName {
  [xKongName]?: string;
}

export const xKongRouteDefaults = 'x-kong-route-defaults';
export interface XKongRouteDefaults {
  [xKongRouteDefaults]?: Partial<DCRoute>;
}

export const xKongUpstreamDefaults = 'x-kong-upstream-defaults';
export interface XKongUpstreamDefaults {
  [xKongUpstreamDefaults]?: Partial<DCUpstream>;
}

export const xKongServiceDefaults = 'x-kong-service-defaults';
export interface XKongServiceDefaults {
  [xKongServiceDefaults]?: Record<string, any>;
}

export const xKongPluginRequestValidator = 'x-kong-plugin-request-validator';
export interface XKongPluginRequestValidator {
  [xKongPluginRequestValidator]?: {
    enabled?: boolean;
    config: {
      verbose_response?: boolean;
      parameter_schema?: 'global' | 'path' | 'operation';
    };
  };
}

export const xKongPluginKeyAuth = 'x-kong-plugin-key-auth';
export interface XKongPluginKeyAuth {
  [xKongPluginKeyAuth]?: {
    name: 'key-auth';
    config: {
      key_names: string[];
      key_in_body?: boolean;
      hide_credentials?: boolean;
    };
  };
}

export const xKongPluginRequestTermination = 'x-kong-plugin-request-termination';
export interface XKongPluginRequestTermination {
  [xKongPluginRequestTermination]?: {
    name: 'request-termination';
    config: {
      status_code: number;
      message: string;
      [key: string]: string | number;
    }
    [key: string]: string | number | Record<string, string | number>;
  }
}

export type XKongPluginUnknown<Config = any> = Record<`x-kong-plugin-${string}`, {
  enabled?: boolean;
  name?: string;
  config: Record<string, Config>;
}>

export interface StripPath {
  // eslint-disable-next-line camelcase -- this is defined by a spec that is out of our control
  strip_path?: boolean;
}

export interface OA3Info {
  title?: string;
  version?: string;
  description?: string;
  termsOfService?: string;
  contact?: {
    name?: string;
    url?: string;
    email?: string;
  };
  license?: {
    name: string;
    url?: string;
  };
  'x-kubernetes-ingress-metadata'?: {
    name?: string;
    annotations?: Record<string, any>;
  };
}

export interface OA3ExternalDocs {
  url: string;
  description?: string;
}

export interface OA3Parameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  allowEmptyValue?: boolean;
  style?: 'form' | 'spaceDelimited' | 'pipeDelimited' | 'deepObject' | string;
  schema?: Record<string, any> | string;
  content?: Record<string, any>;
  explode?: boolean;
}

export interface OA3RequestBody {
  content?: Record<string, any>; // TODO
}

export type OA3SecurityRequirement = Record<string, any>;

export interface OA3Reference {
  $ref: string;
}

export interface OA3ServerKubernetesTLS {
  'x-kubernetes-tls'?: K8sIngressTLS[];
}

export interface OA3ServerKubernetesBackend {
  'x-kubernetes-backend'?: {
    serviceName: string;
    servicePort: number;
  }
}

export interface OA3ServerKubernetesService {
  'x-kubernetes-service'?: {
    spec?: {
      ports?: {
        port: number;
      }[];
    };
    metadata?: {
      name: string;
   };
  };
}

export type OA3Variables = Record<string, {
  default: string;
  enum?: string[];
  description?: string;
}>;

export type OA3Server = {
  url: string;
  description?: string;
  variables?: OA3Variables;
} & OA3ServerKubernetesTLS
  & OA3ServerKubernetesBackend
  & OA3ServerKubernetesService;

export interface OA3ResponsesObject {
  $ref?: string;
}

export type OA3Operation = {
  description?: string;
  summary?: string;
  tags?: string[];
  externalDocs?: OA3ExternalDocs;
  responses?: OA3ResponsesObject;
  operationId?: string;
  parameters?: (OA3Parameter | OA3Reference)[];
  requestBody?: OA3RequestBody | OA3Reference;
  deprecated?: boolean;
  security?: OA3SecurityRequirement[];
  servers?: OA3Server[];
} & XKongName
  & XKongRouteDefaults
  & XKongPluginKeyAuth
  & XKongPluginRequestValidator
  ;

export type OA3PathItem = {
  $ref?: string;
  summary?: string;
  description?: string;
  servers?: OA3Server[];
  parameters?: OA3Reference | OA3Parameter;
  get?: OA3Operation;
  put?: OA3Operation;
  post?: OA3Operation;
  delete?: OA3Operation;
  options?: OA3Operation;
  head?: OA3Operation;
  patch?: OA3Operation;
  trace?: OA3Operation;
} & XKongName
  & XKongRouteDefaults
  & XKongPluginRequestValidator
  & XKongPluginKeyAuth
  ;

export type OA3Paths = Record<string, OA3PathItem>
  & StripPath
  & XKongRouteDefaults
  ;

export interface OA3SecuritySchemeApiKey {
  type: 'apiKey';
  name: string;
  in: 'query' | 'header' | 'cookie';
  description?: string;
}

export interface OA3SecuritySchemeHttp {
  type: 'http';
  name: string;
  scheme: string;
  bearerFormat?: string;
  description?: string;
}

export interface OA3SecuritySchemeOpenIdConnect {
  type: 'openIdConnect';
  name: string;
  openIdConnectUrl: string;
  description?: string;
}

export interface OA3SecuritySchemeOAuth2Flow {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
}

export interface OA3SecuritySchemeOAuth2 {
  type: 'oauth2';
  name: string;
  flows: {
    implicit: OA3SecuritySchemeOAuth2Flow;
    password: OA3SecuritySchemeOAuth2Flow;
    clientCredentials: OA3SecuritySchemeOAuth2Flow;
    authorizationCode: OA3SecuritySchemeOAuth2Flow;
  };
  description?: string;
}

export type OA3SecurityScheme =
  | OA3SecuritySchemeApiKey
  | OA3SecuritySchemeHttp
  | OA3SecuritySchemeOpenIdConnect
  | OA3SecuritySchemeOAuth2;

export interface OA3Example {}

export interface OA3Schema {}

export interface OA3Header {
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  allowEmptyValue?: boolean;
}

export interface OA3Components {
  schemas?: Record<string, OA3Schema | OA3Reference>;
  parameters?: Record<string, OA3Parameter | OA3Reference>;
  headers?: Record<string, OA3Header | OA3Reference>;
  requestBodies?: Record<string, OA3RequestBody | OA3Reference>;
  examples?: Record<string, OA3Example | OA3Reference>;
  securitySchemes?: Record<string, OA3SecurityScheme | OA3Reference>;
}

export type OpenApi3Spec = {
  openapi: string;
  info: OA3Info;
  paths: OA3Paths;
  servers?: OA3Server[];
  components?: OA3Components;
  security?: OA3SecurityRequirement[];
  tags?: string[];
  externalDocs?: OA3ExternalDocs;
}
  & XKongPluginKeyAuth
  & XKongPluginRequestTermination
  & XKongPluginRequestValidator
  & XKongPluginUnknown
  & XKongRouteDefaults
  & XKongServiceDefaults
  & XKongUpstreamDefaults
  & XKongName
  ;
