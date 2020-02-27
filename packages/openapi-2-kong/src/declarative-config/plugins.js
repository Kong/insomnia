// @flow

export function isPluginKey(key: String): Boolean {
  return key.indexOf('x-kong-plugin-') === 0;
}

export function isRequestValidatorPluginKey(key: String): Boolean {
  return key.match(/-request-validator$/) != null;
}

export function getPluginNameFromKey(key: String): String {
  return key.replace(/^x-kong-plugin-/, '');
}

type GeneratorFn = (key: string, value: Object, iterable: Object | Array) => DCPlugin;

export function generatePlugins(iterable: Array, generator: GeneratorFn): Array<DCPlugin> {
  const plugins: Array<DCPlugin> = [];
  for (const key of Object.keys(iterable)) {
    if (!isPluginKey(key)) {
      continue;
    }

    plugins.push(generator(key, iterable[key], iterable));
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
  return generatePlugins(server, generateServerPlugin);
}

export function generateServerPlugin(key: string, value: Object, server: OA3Server): DCPlugin {
  return generatePlugin(key, value);
}

export function generateOperationPlugins(operation: OA3Operation): Array<DCPlugin> {
  return generatePlugins(operation, generateOperationPlugin);
}

export function generateOperationPlugin(
  key: string,
  value: Object,
  operation: OA3Operation,
): DCPlugin {
  if (isRequestValidatorPluginKey(key)) {
    return generateRequestValidatorPlugin(value, operation);
  }

  return generatePlugin(key, value);
}
