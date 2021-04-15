// @flow

import { distinctByProperty, getPluginNameFromKey, isPluginKey } from '../common';

export function isRequestValidatorPluginKey(key: string): boolean {
  return key.match(/-request-validator$/) != null;
}

export function generatePlugins(item: Object): Array<DCPlugin> {
  // When generating plugins, ignore the request validator plugin
  // because it is handled at the operation level
  const pluginFilter = ([key, _]) => isPluginKey(key) && !isRequestValidatorPluginKey(key);

  // Server plugins should load from the api spec root and from the server
  return Object.entries(item)
    .filter(pluginFilter)
    .map(generatePlugin);
}

function generatePlugin([key, value]: [string, Object]): DCPlugin {
  const plugin: DCPlugin = {
    name: value.name || getPluginNameFromKey(key),
  };

  if (value.config) {
    plugin.config = value.config;
  }

  return plugin;
}

/*
  This is valid config to allow all content to pass
  See: https://github.com/Kong/kong-plugin-enterprise-request-validator/pull/34/files#diff-1a1d2d5ce801cc1cfb2aa91ae15686d81ef900af1dbef00f004677bc727bfd3cR284
 */
const ALLOW_ALL_SCHEMA = '{}';

function generateParameterSchema(operation: OA3Operation): Array<Object> | typeof undefined {
  let parameterSchema;

  if (operation.parameters?.length) {
    parameterSchema = [];
    for (const p of operation.parameters) {
      // The following is valid config to allow all content to pass, in the case where schema is not defined
      let schema;
      if ((p: Object).schema) {
        schema = JSON.stringify((p: Object).schema);
      } else if ((p: Object).content) {
        // only parameters defined with a schema (not content) are supported
        schema = ALLOW_ALL_SCHEMA;
      } else {
        // no schema or content property on a parameter is in violation with the OpenAPI spec
        schema = ALLOW_ALL_SCHEMA;
      }

      parameterSchema.push({
        in: (p: Object).in,
        explode: !!(p: Object).explode,
        required: !!(p: Object).required,
        name: (p: Object).name,
        schema,
        style: (p: Object).style ?? 'form',
      });
    }
  }

  return parameterSchema;
}

function generateBodyOptions(
  operation: OA3Operation,
): {
  bodySchema: string | typeof undefined,
  allowedContentTypes: Array<string> | typeof undefined,
} {
  let bodySchema;
  let allowedContentTypes;

  const bodyContent = (operation.requestBody: Object)?.content;
  if (bodyContent) {
    const jsonContentType = 'application/json';

    allowedContentTypes = Object.keys(bodyContent);
    if (allowedContentTypes.includes(jsonContentType)) {
      const item = bodyContent[jsonContentType];
      bodySchema = JSON.stringify(item.schema);
    }
  }

  return { bodySchema, allowedContentTypes };
}

export function generateRequestValidatorPlugin(plugin: Object, operation: OA3Operation): DCPlugin {
  const config: { [string]: Object } = {
    version: 'draft4', // Fixed version
  };

  const pluginConfig = plugin.config ?? {};

  // Use original or generated parameter_schema
  const parameterSchema = pluginConfig.parameter_schema ?? generateParameterSchema(operation);

  const generated = generateBodyOptions(operation);

  // Use original or generated body_schema
  let bodySchema = pluginConfig.body_schema ?? generated.bodySchema;

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
  const allowedContentTypes = pluginConfig.allowed_content_types ?? generated.allowedContentTypes;
  if (allowedContentTypes !== undefined) {
    config.allowed_content_types = allowedContentTypes;
  }

  // Use original verbose_response if defined
  if (pluginConfig.verbose_response !== undefined) {
    config.verbose_response = Boolean(pluginConfig.verbose_response);
  }

  return {
    config,
    enabled: Boolean(plugin.enabled ?? true),
    name: 'request-validator',
  };
}

export function generateServerPlugins(server: OA3Server, api: OpenApi3Spec): Array<DCPlugin> {
  const globalPlugins = generatePlugins(api);
  const serverPlugins = generatePlugins(server);

  // Server plugins take precedence over global plugins
  return distinctByProperty<DCPlugin>([...serverPlugins, ...globalPlugins], plugin => plugin.name);
}

export function generatePathPlugins(pathItem: OA3PathItem): Array<DCPlugin> {
  return generatePlugins(pathItem);
}

export function generateOperationPlugins(
  operation: OA3Operation,
  pathPlugins: Array<DCPlugin>,
  parentValidatorPlugin?: Object,
): Array<DCPlugin> {
  const operationPlugins: Array<DCPlugin> = generatePlugins(operation);

  // Check if validator plugin exists on the operation
  const operationValidatorPlugin = getRequestValidatorPluginDirective(operation);

  // Use the operation or parent validator plugin, or skip if neither exist
  const validatorPluginToUse = operationValidatorPlugin || parentValidatorPlugin;
  if (validatorPluginToUse) {
    operationPlugins.push(generateRequestValidatorPlugin(validatorPluginToUse, operation));
  }

  // Operation plugins take precedence over path plugins
  return distinctByProperty<DCPlugin>([...operationPlugins, ...pathPlugins], plugin => plugin.name);
}

export function getRequestValidatorPluginDirective(obj: Object): Object | null {
  const key = Object.keys(obj)
    .filter(isPluginKey)
    .find(isRequestValidatorPluginKey);

  return key ? obj[key] : null;
}
