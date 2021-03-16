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

export function generateRequestValidatorPlugin(obj: Object, operation: OA3Operation): DCPlugin {
  const config: { [string]: Object } = {
    version: 'draft4', // Fixed version
  };

  config.parameter_schema = [];

  if (operation.parameters) {
    for (const p of operation.parameters) {
      if (!(p: Object).schema) {
        throw new Error("Parameter using 'content' type validation is not supported");
      }
      config.parameter_schema.push({
        in: (p: Object).in,
        explode: !!(p: Object).explode,
        required: !!(p: Object).required,
        name: (p: Object).name,
        schema: JSON.stringify((p: Object).schema),
        style: 'simple',
      });
    }
  }

  if (operation.requestBody) {
    const content = (operation.requestBody: Object).content;
    if (!content) {
      throw new Error('content property is missing for request-validator!');
    }

    let bodySchema;
    for (const mediatype of Object.keys(content)) {
      if (mediatype !== 'application/json') {
        throw new Error(`Body validation supports only 'application/json', not ${mediatype}`);
      }
      const item = content[mediatype];
      bodySchema = JSON.stringify(item.schema);
    }

    if (bodySchema) {
      config.body_schema = bodySchema;
    }
  }

  return {
    config,
    enabled: true,
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
