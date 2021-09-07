import { Entry } from 'type-fest';

import { distinctByProperty, getPluginNameFromKey, isPluginKey } from '../common';
import { DCPlugin } from '../types/declarative-config';
import { isBodySchema, isParameterSchema, ParameterSchema, RequestValidatorPlugin, XKongPluginRequestValidator, xKongPluginRequestValidator } from '../types/kong';
import { OA3Operation, OA3Parameter, OA3RequestBody, OpenApi3Spec } from '../types/openapi3';

export const isRequestValidatorPluginKey = (property: string): property is typeof xKongPluginRequestValidator => (
  property.match(/-request-validator$/) != null
);

type PluginItem = Record<string, any>;

export function generatePlugins(item: PluginItem, tags: string[]) {
  // When generating plugins, ignore the request validator plugin because it is handled at the operation level
  const pluginFilter = ([key]: Entry<PluginItem>) => isPluginKey(key) && !isRequestValidatorPluginKey(key);

  // Server plugins should load from the api spec root and from the server
  return Object.entries(item)
    .filter(pluginFilter)
    .map(generatePlugin(tags));
}

const generatePlugin = (tags: string[]) => ([key, value]: Entry<PluginItem>): DCPlugin => ({
  ...(value ?? {}),
  name: value.name || getPluginNameFromKey(key),
  tags: [
    // Add tags to plugins while appending defaults tags
    ...tags,
    ...(value.tags ?? []),
  ],
});

/**
 * This is valid config to allow all content to pass
 * See: https://github.com/Kong/kong-plugin-enterprise-request-validator/pull/34/files#diff-1a1d2d5ce801cc1cfb2aa91ae15686d81ef900af1dbef00f004677bc727bfd3cR284
 */
export const ALLOW_ALL_SCHEMA = '{}';

const DEFAULT_PARAM_STYLE = {
  header: 'simple',
  cookie: 'form',
  query: 'form',
  path: 'simple',
};

const generateParameterSchema = (operation?: OA3Operation) => {
  if (!operation?.parameters?.length) {
    return undefined;
  }

  const parameterSchemas: ParameterSchema[] = [];
  for (const parameter of operation.parameters as OA3Parameter[]) {
    // The following is valid config to allow all content to pass, in the case where schema is not defined
    let schema = '';

    if (parameter.schema) {
      schema = JSON.stringify(parameter.schema);
    } else if (parameter.content) {
      // only parameters defined with a schema (not content) are supported
      schema = ALLOW_ALL_SCHEMA;
    } else {
      // no schema or content property on a parameter is in violation with the OpenAPI spec
      schema = ALLOW_ALL_SCHEMA;
    }

    const paramStyle = parameter.style ?? DEFAULT_PARAM_STYLE[parameter.in];

    if (typeof paramStyle === 'undefined') {
      const name = parameter.name;
      throw new Error(`invalid 'in' property (parameter '${name}')`);
    }

    const parameterSchema: ParameterSchema = {
      in: parameter.in,
      explode: !!parameter.explode,
      required: !!parameter.required,
      name: parameter.name,
      schema,
      style: paramStyle,
    };
    parameterSchemas.push(parameterSchema);
  }

  return parameterSchemas;
};

function generateBodyOptions(operation?: OA3Operation) {
  let bodySchema;
  let allowedContentTypes;
  const bodyContent = (operation?.requestBody as OA3RequestBody)?.content;

  if (bodyContent) {
    const jsonContentType = 'application/json';
    allowedContentTypes = Object.keys(bodyContent);

    if (allowedContentTypes.includes(jsonContentType)) {
      const item = bodyContent[jsonContentType];
      bodySchema = JSON.stringify(item.schema);
    }
  }

  return {
    bodySchema,
    allowedContentTypes,
  };
}

export function generateRequestValidatorPlugin({
  plugin = { name: 'request-validator' },
  tags,
  operation,
}: {
  plugin?: Partial<RequestValidatorPlugin>;
  tags: string[];
  operation?: OA3Operation;
}) {
  const config: Partial<RequestValidatorPlugin['config']> = {
    version: 'draft4',
  };

  // // Use original or generated parameter_schema
  const parameterSchema = isParameterSchema(plugin.config) ? plugin.config.parameter_schema : generateParameterSchema(operation);

  const generated = generateBodyOptions(operation);

  // Use original or generated body_schema
  let bodySchema = isBodySchema(plugin.config) ? plugin.config.body_schema : generated.bodySchema;

  // If no parameter_schema or body_schema is defined or generated, allow all content to pass
  if (parameterSchema === undefined && bodySchema === undefined) {
    bodySchema = ALLOW_ALL_SCHEMA;
  }

  // Apply parameter_schema and body_schema to the config object
  if (parameterSchema !== undefined) {
    config.parameter_schema = parameterSchema;
  }
  if (bodySchema !== undefined) {
    config.body_schema = bodySchema;
  }

  // Use original or generated allowed_content_types
  const allowedContentTypes = plugin.config?.allowed_content_types ?? generated.allowedContentTypes;

  if (allowedContentTypes !== undefined) {
    config.allowed_content_types = allowedContentTypes;
  }

  // Use original verbose_response if defined
  if (plugin.config?.verbose_response !== undefined) {
    config.verbose_response = Boolean(plugin.config.verbose_response);
  }

  const isEnabledSpecified = Object.prototype.hasOwnProperty.call(plugin, 'enabled');
  const enabled = isEnabledSpecified ? { enabled: Boolean(plugin.enabled ?? true) } : {};

  const requestValidatorPlugin: RequestValidatorPlugin = {
    name: 'request-validator',
    config: config as RequestValidatorPlugin['config'],
    tags: [
      ...(tags ?? []),
      ...(plugin.tags ?? []),
    ],
    ...enabled,
  };
  return requestValidatorPlugin;
}

export function generateGlobalPlugins(api: OpenApi3Spec, tags: string[]) {
  const globalPlugins = generatePlugins(api, tags);
  const plugin = getRequestValidatorPluginDirective(api);

  if (plugin) {
    globalPlugins.push(generateRequestValidatorPlugin({ plugin, tags }));
  }

  return {
    // Server plugins take precedence over global plugins
    plugins: distinctByProperty<DCPlugin>(globalPlugins, plugin => plugin.name),
    requestValidatorPlugin: plugin,
  };
}

export const generateOperationPlugins = ({ operation, pathPlugins, parentValidatorPlugin, tags }: {
  operation: OA3Operation;
  pathPlugins: DCPlugin[];
  parentValidatorPlugin?: RequestValidatorPlugin | null;
  tags: string[];
}) => {
  const operationPlugins = generatePlugins(operation, tags);

  // Check if validator plugin exists on the operation, even if the value of the plugin is undefined
  const operationValidatorPlugin = getRequestValidatorPluginDirective(operation);

  // Use the operation or parent validator plugin, or skip if neither exist
  const plugin = operationValidatorPlugin || parentValidatorPlugin;

  if (plugin) {
    operationPlugins.push(generateRequestValidatorPlugin({ plugin, tags, operation }));
  }

  // Operation plugins take precedence over path plugins
  return distinctByProperty<DCPlugin>([...operationPlugins, ...pathPlugins], plugin => plugin.name);
};

/** This function accepts any OpenAPI3 document segment that can have the request validator plugin and returns it if found */
export const getRequestValidatorPluginDirective = (segment: XKongPluginRequestValidator) => {
  const key = Object.keys(segment).filter(isPluginKey).find(isRequestValidatorPluginKey);
  // If the key is defined but is blank (therefore should be fully generated) then default to {}, which is truthy.
  return key ? (segment[key] || {} as RequestValidatorPlugin) : undefined;
};
