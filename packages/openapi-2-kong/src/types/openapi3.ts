import type { OpenAPIV3 } from 'openapi-types';

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

export interface StripPath {
    // eslint-disable-next-line camelcase -- this is defined by a spec that is out of our control
    strip_path?: boolean;
  }

export interface OA3InfoObjectKubernetesIngressMetadata {
    'x-kubernetes-ingress-metadata'?: {
      name?: string;
      annotations?: Record<string, any>;
    };
  }

export type OA3Info = OpenAPIV3.InfoObject & OA3InfoObjectKubernetesIngressMetadata;

export type OA3ExternalDocs = OpenAPIV3.ExternalDocumentationObject;

export type OA3Parameter = OpenAPIV3.ParameterObject;
/** see: https://swagger.io/specification/#request-body-object */
export type OA3RequestBody = OpenAPIV3.RequestBodyObject | OpenAPIV3.ReferenceObject;

export type OA3SecurityRequirement = OpenAPIV3.SecurityRequirementObject;
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
export type OA3ServerVariable = OpenAPIV3.ServerVariableObject;

/** see: https://swagger.io/specification/#server-object */
export type OA3Server = OpenAPIV3.ServerObject
  & OA3ServerKubernetesTLS
  & OA3ServerKubernetesBackend
  & OA3ServerKubernetesService;

export type OA3ResponsesObject = OpenAPIV3.ResponsesObject;

/** see: https://swagger.io/specification/#operation-object */
export type OA3Operation = OpenAPIV3.OperationObject<XKongName & XKongRouteDefaults & XKongPluginKeyAuth & XKongPluginRequestValidator>;

export type HttpMethods = OpenAPIV3.HttpMethods | Lowercase<OpenAPIV3.HttpMethods>;

/** see: https://swagger.io/specification/#path-item-object */
export type OA3PathItem = OpenAPIV3.PathItemObject
  & {
    [method in HttpMethods]?: OA3Operation;
  }
  & XKongName
  & XKongRouteDefaults
  & XKongPluginRequestValidator
  & XKongPluginKeyAuth
  ;

/** see: https://swagger.io/specification/#paths-object */
export type OA3Paths = {
    [pattern: string]: OA3PathItem;
  }
  & StripPath
  & XKongRouteDefaults
  ;

/** see: https://swagger.io/specification/#security-scheme-object */
export type OA3SecurityScheme = OpenAPIV3.SecuritySchemeObject;

/** see: https://swagger.io/specification/#example-object */
export type OA3Example = OpenAPIV3.ExampleObject;

/** see: https://swagger.io/specification/#schema-object */
export type OA3Schema = OpenAPIV3.SchemaObject;

/** see: https://swagger.io/specification/#header-object */
export type OA3Header = OpenAPIV3.HeaderObject;

/** see: https://swagger.io/specification/#components-object */
export type OA3Components = OpenAPIV3.ComponentsObject;

/** see: https://swagger.io/specification/#tag-object */
export type TagObject = OpenAPIV3.TagObject;

export type OpenApi3Spec =
  {
    openapi: string;
    info: OA3Info;
    servers?: OA3Server[];
    paths: OA3Paths;
    components?: OA3Components;
    security?: OA3SecurityRequirement[];
    tags?: TagObject[];
    externalDocs?: OA3ExternalDocs;
    'x-express-openapi-additional-middleware'?: (((request: any, response: any, next: any) => Promise<void>) | ((request: any, response: any, next: any) => void))[];
    'x-express-openapi-validation-strict'?: boolean;
  }
  & XKongName
  & XKongPluginKeyAuth
  & XKongPluginRequestTermination
  & XKongPluginRequestValidator
  & XKongRouteDefaults
  & XKongServiceDefaults
  & XKongUpstreamDefaults
  ;
