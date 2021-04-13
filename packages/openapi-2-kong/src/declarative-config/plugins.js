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

export function generateParameterSchema(operation: OA3Operation): Array<Object> {
  const parameterSchema = [];

  if (operation.parameters) {
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

function generateBodySchema(operation: OA3Operation): string | typeof undefined {
  let bodySchema;

  if (operation.requestBody) {
    const content = (operation.requestBody: Object).content;
    if (!content) {
      throw new Error('content property is missing for request-validator!');
    }

    // TODO: This should probably just filter for the supported media types instead of
    //  throwing an error on the first non-JSON one. The loop is redundant...
    for (const mediatype of Object.keys(content)) {
      if (mediatype !== 'application/json') {
        throw new Error(`Body validation supports only 'application/json', not ${mediatype}`);
      }
      const item = content[mediatype];
      bodySchema = JSON.stringify(item.schema);
      break;
    }
  }

  return bodySchema;
}

export function generateRequestValidatorPlugin(plugin: Object, operation: OA3Operation): DCPlugin {
  const config: { [string]: Object } = {
    version: 'draft4', // Fixed version
  };

  const pluginConfig = plugin.config ?? {};

  config.parameter_schema = pluginConfig.parameter_schema ?? generateParameterSchema(operation);
  const bodySchema = pluginConfig.body_schema ?? generateBodySchema(operation);

  if (bodySchema) {
    config.body_schema = bodySchema;
  }

  if (pluginConfig.verbose_response !== undefined) {
    config.verbose_response = Boolean(pluginConfig.verbose_response);
  }

  if (pluginConfig.allowed_content_types !== undefined) {
    config.allowed_content_types = pluginConfig.allowed_content_types;
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
