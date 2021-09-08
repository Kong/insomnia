import { RequireAtLeastOne } from 'type-fest';

import { DCRoute, DCService, DCUpstream } from './declarative-config';
import { Taggable } from './outputs';

export type XKongProperty<Property extends string = string> = `x-kong-${Property}`;

export const xKongName: XKongProperty<'name'> = 'x-kong-name';
export interface XKongName {
  [xKongName]?: string;
}

export const xKongRouteDefaults: XKongProperty<'route-defaults'> = 'x-kong-route-defaults';
export interface XKongRouteDefaults {
  [xKongRouteDefaults]?: Partial<DCRoute>;
}

export const xKongUpstreamDefaults: XKongProperty<'upstream-defaults'> = 'x-kong-upstream-defaults';
export interface XKongUpstreamDefaults {
  [xKongUpstreamDefaults]?: Partial<DCUpstream>;
}

export const xKongServiceDefaults: XKongProperty<'service-defaults'> = 'x-kong-service-defaults';
export interface XKongServiceDefaults {
  [xKongServiceDefaults]?: Partial<DCService>;
}

export type XKongPluginProperty<Name extends string = string> = XKongProperty<`plugin-${Name}`>;

// Note: it's important that `Name` doesn't have a default argument.  We want to force the consumer of this type to specify the name as specifically as possible because this value is instrumental to how the plugins are used and discriminated.
export interface PluginBase<Name extends string> extends Taggable {
  /**
   * Whether this plugin will be applied.
   *
   * @defaultValue true
   */
  enabled?: boolean;
  /** The name of the plugin to use. */
  name: Name;
  config?: Record<string, any>;
  service?: {
    /** The ID of the Service the plugin targets. */
    id: string;
  };
  route?: {
    /** The ID of the Route the plugin targets. */
    id: string;
  };
  consumer?: {
    /** The ID of the Consumer the plugin targets. */
    id: string;
  };
}

/**
 * A plugin which is not associated to any service, route, or consumer is considered global, and will be run on every request.
 *
 * see: https://docs.konghq.com/hub/kong-inc/openid-connect/#enabling-the-plugin-globally
 */
export type GlobalPluginBase<Name extends string> = Omit<PluginBase<Name>, 'service' | 'route' | 'consumer'>;

/** used for user-defined or yet-untyped plugins */
export type XKongPlugin<Plugin extends PluginBase<string>> = Partial<
  Record<
    XKongPluginProperty<Plugin['name']>,
    Plugin
  >
>;

export interface BodySchema {
  /** The request body schema specification */
  body_schema: string;
}

export interface ParameterSchemaRequired {
  /**
   * The name of the parameter. Parameter names are case sensitive, and corresponds to the parameter name used by the in property.
   *
   * If in is "path", the name field MUST correspond to the named capture group from the configured route.
  */
  name: string;
  /**
   * The location of the parameter. Possible values are query, header, or path.
   */
  in: string;
  /**
   * Determines whether this parameter is mandatory.
   */
  required: boolean;
}

// These properties are optional but if any one of them is set, the others must also be set.
export interface ParameterSchemaOptional {
  /**
   * Describes how the parameter value will be serialized depending on the type of the parameter value
  */
  style: string;
  /**
   * The schema defining the type used for the parameter.
   *
   * It is validated using draft4 for JSONschema draft 4 compliant validator.
   */
  schema: string;
  /**
   * When this is true, parameter values of type array or object generate separate parameters for each value of the array or key-value pair of the map.
   *
   * For other types of parameters this property has no effect.
Permalink
   */
  explode: boolean;
}

/** see: https://docs.konghq.com/hub/kong-inc/request-validator/#parameter-schema-definition */
export type ParameterSchema = ParameterSchemaRequired | (ParameterSchemaRequired & ParameterSchemaOptional);

export interface ParameterSchemas {
  /**
   * Array of parameter validator specifications. For details and examples, see Parameter Schema Definition https://docs.konghq.com/hub/kong-inc/request-validator/#parameter-schema-definition.
   */
  parameter_schema: ParameterSchema[];
}

export const isBodySchema = (value: Partial<BodySchema | ParameterSchemas> = {}): value is BodySchema => (
  Object.prototype.hasOwnProperty.call(value, 'body_schema') && (value as BodySchema).body_schema !== undefined
);

export const isParameterSchema = (value: Partial<BodySchema | ParameterSchemas> = {}): value is ParameterSchemas => (
  Object.prototype.hasOwnProperty.call(value, 'parameter_schema') && (value as ParameterSchemas).parameter_schema !== undefined
);

/** see: https://docs.konghq.com/hub/kong-inc/request-validator/#parameters */
export type RequestValidator = 'request-validator';
export interface RequestValidatorPlugin extends PluginBase<RequestValidator> {
  config: {
    /**
     * List of allowed content types.
     *
     * Note: Body validation is only done for application/json and skipped for any other allowed content types.
     *
     * @defaultValue application/json
     */
    allowed_content_types?: string[];
    /**
     * Which validator to use.
     *
     * Supported values are kong (default) for using Kong’s own schema validator, or draft4 for using a JSON Schema Draft 4-compliant validator.
     *
     * @defaultValue kong
     */
    version?: 'draft4' | 'kong';
    /**
     * If enabled, the plugin returns more verbose and detailed validation errors (for example, the name of the required field that is missing).
     *
     * @defaultValue false
     */
    verbose_response?: boolean;
  } & RequireAtLeastOne<BodySchema & ParameterSchemas>;
}
export const xKongPluginRequestValidator: XKongPluginProperty<RequestValidator> = 'x-kong-plugin-request-validator';
export type XKongPluginRequestValidator = XKongPlugin<RequestValidatorPlugin>;

/** see: https://docs.konghq.com/hub/kong-inc/key-auth/#parameters */
export type KeyAuth = 'key-auth';
export interface KeyAuthPlugin extends PluginBase<KeyAuth> {
  config: {
    /**
     * Describes an array of parameter names where the plugin will look for a key.
     *
     * The client must send the authentication key in one of those key names, and the plugin will try to read the credential from a header, request body, or query string parameter with the same name.
     *
     * Note: The key names may only contain [a-z], [A-Z], [0-9], [_] underscore, and [-] hyphen.
     *
     * @defaultValue apikey
     */
    key_names: string[];
    /**
     * If enabled, the plugin reads the request body (if said request has one and its MIME type is supported) and tries to find the key in it.
     *
     * Supported MIME types: application/www-form-urlencoded, application/json, and multipart/form-data.
     *
     * @defaultValue false
     */
    key_in_body?: boolean;
    /**
     * If enabled (default), the plugin reads the request header and tries to find the key in it.
     *
     * @defaultValue true
     */
    key_in_header?: boolean;
    /**
     * If enabled (default), the plugin reads the query parameter in the request and tries to find the key in it.
     *
     * @defaultValue true
     */
    key_in_query?: boolean;
    /**
     * An optional boolean value telling the plugin to show or hide the credential from the upstream service.
     *
     * If true, the plugin strips the credential from the request (i.e., the header, query string, or request body containing the key) before proxying it.
     *
     * @defaultValue false
     */
    hide_credentials?: boolean;
    /**
     * An optional string (Consumer UUID) value to use as an anonymous Consumer if authentication fails.
     *
     * If empty (default), the request will fail with an authentication failure 4xx.
     *
     * Note that this value must refer to the Consumer id attribute that is internal to Kong, and not its custom_id.
     */
    anonymous?: string;
    /**
     * A boolean value that indicates whether the plugin should run (and try to authenticate) on OPTIONS preflight requests.
     *
     * If set to false, then OPTIONS requests are always allowed.
     *
     * @defaultValue true
     */
    run_on_preflight?: boolean;
  };
}
export const xKongPluginKeyAuth: XKongPluginProperty<KeyAuth> = 'x-kong-plugin-key-auth';
export type XKongPluginKeyAuth = XKongPlugin<KeyAuthPlugin>;

/** see: https://docs.konghq.com/hub/kong-inc/request-termination/#parameters */
export type RequestTermination = 'request-termination';
export interface RequestTerminationPlugin extends PluginBase<RequestTermination> {
  config?: {
    /**
     * the response code to send
     *
     * must be an integer between 100 and 599 */
    status_code?: number;
    /** the message to send, if using the default response generator */
    message?: string;
    /**
     * the raw response body to send
     *
     * this is mutually exclusive with the config.message field */
    body?: string;
    /**
     * content type of the raw response configured with `config.body`
     *
     * @defaultValue application/json; charset=utf-8
     */
    content_type?: string;
  };
}
export const xKongPluginRequestTermination: XKongPluginProperty<RequestTermination> = 'x-kong-plugin-request-termination';
export type XKongPluginRequestTermination = XKongPlugin<RequestTerminationPlugin>;

/** see: https://docs.konghq.com/hub/kong-inc/basic-auth/#parameters */
export type BasicAuth = 'basic-auth';
export interface BasicAuthPlugin extends Omit<PluginBase<BasicAuth>, 'consumer'> {
  config?: {
    /**
     * An optional boolean value telling the plugin to show or hide the credential from the upstream service.
     *
     * If true, the plugin will strip the credential from the request (i.e. the Authorization header) before proxying it.
     *
     * @defaultValue false
     */
    hide_credentials?: boolean;
    /**
     * An optional string (consumer uuid) value to use as an “anonymous” consumer if authentication fails.
     *
     * If empty (default), the request will fail with an authentication failure 4xx.
     *
     * Please note that this value must refer to the Consumer id attribute which is internal to Kong, and not its custom_id.
     */
    anonymous?: string;
  };
}
export const xKongBasicAuth: XKongPluginProperty<BasicAuth> = 'x-kong-plugin-basic-auth';
export type XKongBasicAuthPlugin = XKongPlugin<BasicAuthPlugin>;

export type AuthMethod =
  | 'password'
  | 'client_credentials'
  | 'authorization_code'
  | 'bearer'
  | 'introspection'
  | 'kong_oauth2'
  | 'refresh_token'
  | 'session';

export type OpenIDConnect = 'openid-connect';

/**
 * Note: These types are incomplete, as there are dozens of parameters for the config.
 *
 * Note: This is a global plugin, not associated to any service, route, or consumer.
 *
 * see: https://docs.konghq.com/hub/kong-inc/openid-connect/#parameter-descriptions
 */
export interface OpenIDConnectPlugin extends GlobalPluginBase<OpenIDConnect> {
  enabled?: boolean;
  config?: {
    issuer?: string;
    scopes_required?: string[];
    auth_methods?: AuthMethod[];
  };
}
export const xKongOpenIDConnect: XKongPluginProperty<OpenIDConnect> = 'x-kong-plugin-openid-connect';
export type XOpenIDConnectPlugin = XKongPlugin<OpenIDConnectPlugin>;

export type Plugin =
  | RequestValidatorPlugin
  | KeyAuthPlugin
  | RequestTerminationPlugin
  | BasicAuthPlugin
  | OpenIDConnectPlugin;
