// @flow

export function generatePlugins(operation: OA3Operation): Array<DCPlugin> {
  const plugins: Array<DCPlugin> = [];
  for (const key of Object.keys(operation)) {
    if (key.indexOf('x-kong-plugin-') !== 0) {
      continue;
    }

    plugins.push(generatePlugin(key, operation[key], operation));
  }

  return plugins;
}

export function generatePlugin(key: string, obj: Object, operation: OA3Operation): DCPlugin {
  if (key.match(/-request-validator$/)) {
    return generateRequestValidatorPlugin(obj, operation);
  }

  const plugin: DCPlugin = {
    name: obj.name || key.replace(/^x-kong-plugin-/, ''),
  };

  if (obj.config) {
    plugin.config = obj.config;
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
    for (const item of content) {
      if (item.mediatype !== 'application/json') {
        throw new Error(`Body validation supports only 'application/json', not ${item.mediatype}`);
      }

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
