import { HttpMethodType } from '../common';
import {
  XKongName,
  XKongPluginKeyAuth,
  XKongPluginRequestTermination,
  XKongPluginRequestValidator,
  XKongRouteDefaults,
  XKongServiceDefaults,
  XKongUpstreamDefaults,
} from './kong';
import { K8sIngressTLS } from './kubernetes-config';
import { Taggable } from './outputs';

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

/** see: https://swagger.io/specification/#request-body-object */
export interface OA3RequestBody {
  content?: Record<string, any>; // TODO
  description?: string;
  required?: boolean;
}

export type OA3SecurityRequirement = Record<string, any>;

/** see: https://swagger.io/specification/#reference-object */
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
  };
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

/** see: https://swagger.io/specification/#server-variable-object */
export interface OA3ServerVariable {
  default: string;
  enum?: string[];
  description?: string;
}

/** see: https://swagger.io/specification/#server-object */
export type OA3Server = {
  url: string;
  description?: string;
  variables?: Record<string, OA3ServerVariable>;
} & OA3ServerKubernetesTLS
  & OA3ServerKubernetesBackend
  & OA3ServerKubernetesService;

export interface OA3ResponsesObject {
  $ref?: string;
}

/** see: https://swagger.io/specification/#operation-object */
export type OA3Operation = {
  description?: string;
  summary?: string;
  externalDocs?: OA3ExternalDocs;
  responses?: OA3ResponsesObject;
  operationId?: string;
  parameters?: (OA3Parameter | OA3Reference)[];
  requestBody?: OA3RequestBody | OA3Reference;
  deprecated?: boolean;
  security?: OA3SecurityRequirement[];
  servers?: OA3Server[];
} & Taggable
  & XKongName
  & XKongRouteDefaults
  & XKongPluginKeyAuth
  & XKongPluginRequestValidator
  ;

type HTTPMethodPaths = Partial<Record<
  HttpMethodType | Lowercase<HttpMethodType>,
  OA3Operation
>>;

/** see: https://swagger.io/specification/#path-item-object */
export type OA3PathItem = {
  $ref?: string;
  summary?: string;
  description?: string;
  servers?: OA3Server[];
  parameters?: OA3Reference | OA3Parameter;
} & HTTPMethodPaths
  & XKongName
  & XKongRouteDefaults
  & XKongPluginRequestValidator
  & XKongPluginKeyAuth
  ;

/** see: https://swagger.io/specification/#paths-object */
export type OA3Paths = Record<string, OA3PathItem>
  & StripPath
  & XKongRouteDefaults
  ;

/** see: https://swagger.io/specification/#security-scheme-object */
export interface OA3SecuritySchemeApiKey {
  type: 'apiKey';
  name: string;
  in: 'query' | 'header' | 'cookie';
  description?: string;
}

/** see: https://swagger.io/specification/#security-scheme-object */
export interface OA3SecuritySchemeHttp {
  type: 'http';
  name: string;
  scheme: string;
  bearerFormat?: string;
  description?: string;
}

/** see: https://swagger.io/specification/#security-scheme-object */
export interface OA3SecuritySchemeOpenIdConnect {
  type: 'openIdConnect';
  name: string;
  openIdConnectUrl: string;
  description?: string;
}

/** see: https://swagger.io/specification/#security-scheme-object */
export interface OA3SecuritySchemeOAuth2Flow {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
}

/** see: https://swagger.io/specification/#security-scheme-object */
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

/** see: https://swagger.io/specification/#security-scheme-object */
export type OA3SecurityScheme =
  | OA3SecuritySchemeApiKey
  | OA3SecuritySchemeHttp
  | OA3SecuritySchemeOpenIdConnect
  | OA3SecuritySchemeOAuth2;

/** see: https://swagger.io/specification/#example-object */
export interface OA3Example {
  summary?: string;
  description?: string;
  value?: any;
  externalValue?: string;
}

/** see: https://swagger.io/specification/#schema-object */
export interface OA3Schema {}

/** see: https://swagger.io/specification/#header-object */
export interface OA3Header {
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  allowEmptyValue?: boolean;
}

/** see: https://swagger.io/specification/#components-object */
export interface OA3Components {
  schemas?: Record<string, OA3Schema | OA3Reference>;
  parameters?: Record<string, OA3Parameter | OA3Reference>;
  headers?: Record<string, OA3Header | OA3Reference>;
  requestBodies?: Record<string, OA3RequestBody | OA3Reference>;
  examples?: Record<string, OA3Example | OA3Reference>;
  securitySchemes?: Record<string, OA3SecurityScheme | OA3Reference>;
}

/** see: https://swagger.io/specification/#tag-object */
export interface TagObject {
  name: string;
  description?: string;
  externalDocs?: Record<string, any>;
}

/** see: https://swagger.io/specification/#openapi-object */
export type OpenApi3Spec = {
  openapi: string;
  info: OA3Info;
  paths: OA3Paths;
  servers?: OA3Server[];
  components?: OA3Components;
  security?: OA3SecurityRequirement[];
  externalDocs?: OA3ExternalDocs;
  tags?: TagObject[];
}
  & XKongName
  & XKongPluginKeyAuth
  & XKongPluginRequestTermination
  & XKongPluginRequestValidator
  & XKongRouteDefaults
  & XKongServiceDefaults
  & XKongUpstreamDefaults
  ;
