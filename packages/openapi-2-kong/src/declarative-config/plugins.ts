import { distinctByProperty, getPluginNameFromKey, isPluginKey } from '../common';
import { DCPlugin, DCPluginConfig } from '../types/declarative-config';
import { OA3Operation, OpenApi3Spec, OA3PathItem } from '../types/openapi3';

export function isRequestValidatorPluginKey(key: string): boolean {
  return key.match(/-request-validator$/) != null;
}

export function generatePlugins(item: Record<string, any>, tags: string[]): DCPlugin[] {
  // When generating plugins, ignore the request validator plugin because it is handled at the operation level
  const pluginFilter = ([key, _value]) => isPluginKey(key) && !isRequestValidatorPluginKey(key);

  // Server plugins should load from the api spec root and from the server
  return Object.entries(item)
    .filter(pluginFilter)
    .map(e => generatePlugin(e, tags));
}

function generatePlugin(
  [key, value]: [string, Record<string, any>],
  tags: string[],
): DCPlugin {
  const plugin: DCPlugin = {
    name: value.name || getPluginNameFromKey(key),
  };

  if (value.config) {
    plugin.config = value.config;
  }

  // Add tags to plugins while appending defaults tags
  plugin.tags = [...tags, ...(value.tags ?? [])];
  return plugin;
}

/**
  This is valid config to allow all content to pass
  See: https://github.com/Kong/kong-plugin-enterprise-request-validator/pull/34/files#diff-1a1d2d5ce801cc1cfb2aa91ae15686d81ef900af1dbef00f004677bc727bfd3cR284
 */
const ALLOW_ALL_SCHEMA = '{}';

const DEFAULT_PARAM_STYLE = {
  header: 'simple',
  cookie: 'form',
  query: 'form',
  path: 'simple',
};

function generateParameterSchema(
  operation?: OA3Operation,
): Record<string, any>[] | undefined {
  let parameterSchema;

  if (operation?.parameters?.length) {
    parameterSchema = [];

    for (const p of operation.parameters) {
      // The following is valid config to allow all content to pass, in the case where schema is not defined
      let schema;

      if ((p as Record<string, any>).schema) {
        schema = JSON.stringify((p as Record<string, any>).schema);
      } else if ((p as Record<string, any>).content) {
        // only parameters defined with a schema (not content) are supported
        schema = ALLOW_ALL_SCHEMA;
      } else {
        // no schema or content property on a parameter is in violation with the OpenAPI spec
        schema = ALLOW_ALL_SCHEMA;
      }

      const paramStyle =
        (p as Record<string, any>).style ?? DEFAULT_PARAM_STYLE[(p as Record<string, any>).in];

      if (typeof paramStyle === 'undefined') {
        const name = (p as Record<string, any>).name;
        throw new Error(`invalid 'in' property (parameter '${name}')`);
      }

      parameterSchema.push({
        in: (p as Record<string, any>).in,
        explode: !!(p as Record<string, any>).explode,
        required: !!(p as Record<string, any>).required,
        name: (p as Record<string, any>).name,
        schema,
        style: paramStyle,
      });
    }
  }

  return parameterSchema;
}

function generateBodyOptions(
  operation?: OA3Operation,
): {
  bodySchema: string | typeof undefined;
  allowedContentTypes: string[] | typeof undefined;
} {
  let bodySchema;
  let allowedContentTypes;
  const bodyContent = (operation?.requestBody as Record<string, any>)?.content;

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

export function generateRequestValidatorPlugin(
  plugin: Record<string, any>,
  operation: OA3Operation | typeof undefined,
  tags: string[],
): DCPlugin {
  const config: DCPluginConfig = {
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
    tags: [...tags, ...(plugin.tags ?? [])],
    enabled: Boolean(plugin.enabled ?? true),
    name: 'request-validator',
  };
}

export function generateGlobalPlugins(
  api: OpenApi3Spec,
  tags: string[],
): {
  plugins: DCPlugin[];
  requestValidatorPlugin?: Record<string, any>;
} {
  const globalPlugins = generatePlugins(api, tags);
  const requestValidatorPlugin = getRequestValidatorPluginDirective(api);

  if (requestValidatorPlugin) {
    globalPlugins.push(generateRequestValidatorPlugin(requestValidatorPlugin, undefined, tags));
  }

  return {
    // Server plugins take precedence over global plugins
    plugins: distinctByProperty<DCPlugin>(globalPlugins, plugin => plugin.name),
    requestValidatorPlugin,
  };
}

export function generatePathPlugins(pathItem: OA3PathItem, tags: string[]): DCPlugin[] {
  return generatePlugins(pathItem, tags);
}

export function generateOperationPlugins(
  operation: OA3Operation,
  pathPlugins: DCPlugin[],
  parentValidatorPlugin?: Record<string, any>,
  tags?: string[],
): DCPlugin[] {
  const operationPlugins: DCPlugin[] = generatePlugins(operation, tags);
  // Check if validator plugin exists on the operation
  const operationValidatorPlugin = getRequestValidatorPluginDirective(operation);
  // Use the operation or parent validator plugin, or skip if neither exist
  const validatorPluginToUse = operationValidatorPlugin || parentValidatorPlugin;

  if (validatorPluginToUse) {
    operationPlugins.push(generateRequestValidatorPlugin(validatorPluginToUse, operation, tags));
  }

  // Operation plugins take precedence over path plugins
  return distinctByProperty<DCPlugin>([...operationPlugins, ...pathPlugins], plugin => plugin.name);
}

export function getRequestValidatorPluginDirective(
  obj: Record<string, any>,
): Record<string, any> | null {
  const key = Object.keys(obj).filter(isPluginKey).find(isRequestValidatorPluginKey);
  // If the key is defined but is blank (therefore should be fully generated) then default to {}
  return key ? obj[key] || {} : null;
}
