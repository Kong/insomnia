// @flow

import { getPluginNameFromKey, isPluginKey } from '../common';

export function isRequestValidatorPluginKey(key: string): boolean {
  return key.match(/-request-validator$/) != null;
}

type GeneratorFn = (key: string, value: Object, iterable: Object | Array<Object>) => DCPlugin;

export function generatePlugins(item: Object, generator: GeneratorFn): Array<DCPlugin> {
  const plugins: Array<DCPlugin> = [];

  for (const key of Object.keys(item)) {
    if (!isPluginKey(key)) {
      continue;
    }

    plugins.push(generator(key, item[key], item));
  }

  return plugins;
}

export function generatePlugin(key: string, value: Object): DCPlugin {
  const plugin: DCPlugin = {
    name: value.name || getPluginNameFromKey(key),
  };

  if (value.config) {
    plugin.config = value.config;
  }

  return plugin;
}

function generateParameterSchema(operation: OA3Operation): Array<Object> | typeof undefined {
  let parameterSchema;

  if (operation.parameters?.length) {
    parameterSchema = [];
    for (const p of operation.parameters) {
      if (!(p: Object).schema) {
        throw new Error("Parameter using 'content' type validation is not supported");
      }
      parameterSchema.push({
        in: (p: Object).in,
        explode: !!(p: Object).explode,
        required: !!(p: Object).required,
        name: (p: Object).name,
        schema: JSON.stringify((p: Object).schema),
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

  if (operation.requestBody) {
    const content = (operation.requestBody: Object).content;
    if (!content) {
      throw new Error('content property is missing for request-validator!');
    }

    const jsonContentType = 'application/json';

    allowedContentTypes = Object.keys(content);
    if (allowedContentTypes.includes(jsonContentType)) {
      const item = content[jsonContentType];
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
  if (parameterSchema !== undefined) {
    config.parameter_schema = parameterSchema;
  }

  const generated = generateBodyOptions(operation);

  // Use original or generated body_schema
  const bodySchema = pluginConfig.body_schema ?? generated.bodySchema;
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

export function generateServerPlugins(server: OA3Server): Array<DCPlugin> {
  const plugins: Array<DCPlugin> = [];

  for (const key of Object.keys(server)) {
    if (!isPluginKey(key)) {
      continue;
    }

    plugins.push(generatePlugin(key, server[key]));
  }

  return plugins;
}

export function generateOperationPlugins(operation: OA3Operation): Array<DCPlugin> {
  const plugins: Array<DCPlugin> = [];

  for (const key of Object.keys(operation)) {
    if (!isPluginKey(key)) {
      continue;
    }

    if (isRequestValidatorPluginKey(key)) {
      plugins.push(generateRequestValidatorPlugin(operation[key], operation));
    } else {
      plugins.push(generatePlugin(key, operation[key]));
    }
  }

  return plugins;
}
