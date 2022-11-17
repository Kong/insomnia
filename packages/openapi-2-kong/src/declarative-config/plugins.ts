import SwaggerParser from '@apidevtools/swagger-parser';
import { OpenAPIV3 } from 'openapi-types';
import type { Entry } from 'type-fest';

import { distinctByProperty, getPluginNameFromKey, isPluginKey } from '../common';
import { DCPlugin } from '../types/declarative-config';
import { isBodySchema, isParameterSchema, ParameterSchema, RequestValidatorPlugin, XKongPluginRequestValidator, xKongPluginRequestValidator } from '../types/kong';
import type { OA3Operation, OpenApi3Spec } from '../types/openapi3';

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
const $schema = 'http://json-schema.org/schema#';
const DEFAULT_PARAM_STYLE = {
  header: 'simple',
  cookie: 'form',
  query: 'form',
  path: 'simple',
};

interface ResolvedParameter {
  resolvedParam: OpenAPIV3.ParameterObject;
  components: OpenAPIV3.ComponentsObject | undefined;
}
const resolveParameter = ($refs: SwaggerParser.$Refs, parameter: OpenAPIV3.ParameterObject | OpenAPIV3.ReferenceObject): ResolvedParameter => {
  if ('$ref' in parameter) {
    const dereferenced = getOperationRef<OpenAPIV3.ParameterObject>($refs, parameter.$ref);
    const { $ref, ...param } = parameter;

    let schema: OpenAPIV3.ParameterObject['schema'] = dereferenced?.schema;
    if (schema && '$ref' in schema) {
      schema = getOperationRef<OpenAPIV3.ParameterObject['schema']>($refs, schema.$ref);
    }

    const resolvedParam: OpenAPIV3.ParameterObject = {
      ...param,
      ...dereferenced,
      name: dereferenced?.name || '',
      in: dereferenced?.in || '',
      schema,
    };

    const components = resolveComponents($refs, resolvedParam);
    return {
      resolvedParam,
      components,
    };
  }

  if (parameter.schema && '$ref' in parameter.schema) {
    const schema = getOperationRef<OpenAPIV3.ReferenceObject>($refs, parameter.schema.$ref);
    const resolvedParam = { ...parameter, schema };
    const components = resolveComponents($refs, resolvedParam);
    return {
      resolvedParam,
      components,
    };
  }

  return { resolvedParam: parameter, components: undefined };
};

type KongSchema = (OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject) & {
  components?: OpenAPIV3.ComponentsObject;
  $schema?: string;
};

const generateParameterSchema = async (api: OpenApi3Spec, operation?: OA3Operation) => {
  if (!operation?.parameters?.length) {
    return;
  }

  const refs: SwaggerParser.$Refs = await SwaggerParser.resolve(api);
  const parameterSchemas: ParameterSchema[] = [];
  for (const parameter of operation.parameters) {
    // The following is valid config to allow all content to pass, in the case where schema is not defined
    let schema = '';

    const { resolvedParam, components } = resolveParameter(refs, parameter);

    if (resolvedParam.schema) {
      const kongSchema: KongSchema = { ...resolvedParam.schema };
      // The $schema property should only exist if components exist with a $ref path
      if (components) {
        kongSchema.components = components;
        kongSchema.$schema = $schema;
      }
      schema = JSON.stringify(kongSchema);
    } else if ('content' in parameter) {
      // only parameters defined with a schema (not content) are supported
      schema = ALLOW_ALL_SCHEMA;
    } else {
      // no schema or content property on a parameter is in violation with the OpenAPI spec
      schema = ALLOW_ALL_SCHEMA;
    }

    // @ts-expect-error fix this
    const paramStyle = (parameter as OpenAPIV3.ParameterObject).style ?? DEFAULT_PARAM_STYLE[resolvedParam.in];

    if (typeof paramStyle === 'undefined') {
      const name = resolvedParam.name;
      throw new Error(`invalid 'in' property (parameter '${name}')`);
    }

    const parameterSchema: ParameterSchema = {
      in: resolvedParam.in,
      explode: !!resolvedParam.explode,
      required: !!resolvedParam.required,
      name: resolvedParam.name,
      schema,
      style: paramStyle,
    };
    parameterSchemas.push(parameterSchema);
  }

  return parameterSchemas;
};

function resolveRequestBodyContent($refs: SwaggerParser.$Refs, operation?: OA3Operation): OpenAPIV3.RequestBodyObject | undefined {
  if (!operation || !operation?.requestBody) {
    return;
  }

  if ('$ref' in operation.requestBody) {
    return getOperationRef($refs, operation.requestBody.$ref);
  }

  return operation.requestBody;
}

function getOperationRef<RefType = OpenAPIV3.RequestBodyObject>($refs: SwaggerParser.$Refs, refPath: OpenAPIV3.ReferenceObject['$ref']): RefType | undefined {
  if ($refs.exists(refPath)) {
    return $refs.get(refPath);
  }

  return;
}

/**
 * Resolves a ref for the given schema recursively with unknown types.
 * @param $refs SwaggerParser.$Ref object to get free methods
 * @param source the source object to be parsed by resolving all the references
 * @param components Map object to map each component path key and value recursively
 * @returns a New Map object that capture all resolved refs of path keys and values upto the Nth iteration.
 */
function resolveRefSchemaRecursively(
  $refs: SwaggerParser.$Refs,
  source: OpenAPIV3.SchemaObject | OpenAPIV3.ParameterObject | OpenAPIV3.ReferenceObject | OpenAPIV3.RequestBodyObject,
  components = new Map(),
): Map<string, unknown> {
  const componentsRefMap = new Map([...components]);
  if (typeof source !== 'object' || source === null) {
    // if the source is any non-object literal (string, boolean, number, undefined) we want to bail because you cannot iterate these values. (Since `typeof null` equals `'object'` in JavaScript, we also want to catch null)
    return componentsRefMap;
  }

  if (Array.isArray(source)) {
    // if the source is an array literal, we want to just return it literally (i.e. skip) because all we're looking for is the `$ref` value (which is always an object in the OpenAPI spec). For the purposes of this function, we don't care about arrays because it means the value isn't relevant to what this function tries to do (which is, resolving `$ref`s).
    return componentsRefMap;
  }

  return Object.entries(source)
    .reduce<Map<string, unknown>>((acc, [key, value]: Entry<Map<string, unknown>>) => {
      if (typeof value === 'string') {
        // the responsiblity of this function is only really concerning `$ref`s, so if the end value is not a `$ref` we can skip it
        if (key !== '$ref') {
          return acc;
        }

        // the accumulator alreadly having this `$ref` value indicates that we have already visited this ref, and as such we should exit early to prevent an infinite loop since circular `$ref`s are valid in OpenAPI.
        if (acc.has(value)) {
          return acc;
        }

        const pathResolved = getOperationRef($refs, value);
        if (pathResolved) {
          acc.set(value, pathResolved);
          const resolved = resolveRefSchemaRecursively($refs, pathResolved, acc);
          return new Map([...acc, ...resolved]);
        }

        return acc;
      }

      // if the value is not iterable (i.e. array or object) we want to bail
      if (typeof value !== 'object') {
        return acc;
      }

      // since `typeof null` equals `object` in JavaScript, we catch this case separately
      if (value === null) {
        return acc;
      }

      if (Array.isArray(value)) {
        // if the array is empty, we're done
        if (value.length === 0) {
          return acc;
        }

        // resolve the refs (recursively) looking for `$ref`s
        return value.reduce((newAcc, item) => (
          resolveRefSchemaRecursively($refs, item, newAcc)
        ), new Map([...acc]));
      }

      // iterate into the next level in the recursion with `value` as the source (value is now narrowed to an Object)
      return new Map([...acc, ...resolveRefSchemaRecursively($refs, value, acc)]);
    }, componentsRefMap);
}

/**
 * Build components reference object with nested paths
 * @param mapObject Map object that keeps all the ref keys and valuese to be transformed into the final object product with nested paths
 * @returns final object product with nested paths
 */
function buildComponentsObjectFromMap(mapObject: Map<string, unknown>): Record<string, unknown> {
  return Array
    .from(mapObject.entries())
    .reduce((acc: Record<string, unknown>, [pathKey, pathValue]: [string, unknown]) => {
      const paths = pathKey.replace('#/components/', '').split('/');
      const lastPath = paths.pop();
      if (lastPath) {
        paths.reduce<Record<string, unknown>>((r: Record<string, any>, a: string) => r[a] = r[a] || {}, acc)[lastPath] = pathValue;
      }
      return acc;
    }, {});
}

/**
 * Resolves a set of components used in the given schema recursively
 * @param $refs SwaggerParser.$Ref object to get free methods
 * @param schema schema object to be recursively resolved
 * @returns OpenAPIV3 component objects completely dereferenced for all paths mentioned in the given schema
 */
function resolveComponents(
  $refs: SwaggerParser.$Refs,
  schema: OpenAPIV3.SchemaObject | OpenAPIV3.ParameterObject | OpenAPIV3.ReferenceObject,
): OpenAPIV3.ComponentsObject | undefined {
  const componentsMap = resolveRefSchemaRecursively($refs, schema);
  if (!componentsMap.size) {
    return;
  }

  const components = buildComponentsObjectFromMap(componentsMap);
  return components;
}

/**
 * Serializes schema used in the Kong configuration parameter schema or body schema with optional JSON properties for reference resolving.
 * @param schema parsed Object to be passed to the Kong configuration either in parameter schema or body schema
 * @param components component Object to be referred during Kong configuration parsing (outside of Insomnia/Inso context)
 * @returns Object with the schema and JSON schema properties
 */
function serializeSchemaForKong(
  schema: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject,
  components: OpenAPIV3.ComponentsObject | undefined,
): string {
  const kongSchema: KongSchema = { ...schema };

  // we probably want to include 'components' and '$schema' only if 'components' exists
  if (components) {
    kongSchema.components = components;
    kongSchema.$schema = $schema;
  }
  return JSON.stringify(kongSchema);
}

interface ResolvedItemSchema {
  schema: OpenAPIV3.SchemaObject;
  components: OpenAPIV3.ComponentsObject | undefined;
}
function resolveItemSchema($refs: SwaggerParser.$Refs, item: OpenAPIV3.MediaTypeObject): ResolvedItemSchema {
  if (item.schema && '$ref' in item.schema) {
    const schema = getOperationRef<OpenAPIV3.SchemaObject>($refs, item.schema.$ref);
    if (schema) {
      const components = resolveComponents($refs, schema);
      return { schema, components };
    }
  }

  const hasNoRef = { schema: item.schema as OpenAPIV3.SchemaObject ?? {}, components: undefined };
  return hasNoRef;
}

export async function generateBodyOptions(api: OpenApi3Spec, operation?: OA3Operation) {
  const $refs: SwaggerParser.$Refs = await SwaggerParser.resolve(api);
  let bodySchema;
  let allowedContentTypes;

  const requestBody = resolveRequestBodyContent($refs, operation);
  const bodyContent = requestBody?.content;

  if (bodyContent) {
    const jsonContentType = 'application/json';
    allowedContentTypes = Object.keys(bodyContent);

    if (allowedContentTypes.includes(jsonContentType)) {
      const item: OpenAPIV3.MediaTypeObject = bodyContent[jsonContentType];
      const { schema, components } = resolveItemSchema($refs, item);

      for (const key in schema.properties) {
        // Append 'null' to property type if nullable true, seeccccc
        if ((schema.properties[key] as OpenAPIV3.SchemaObject).nullable === true) {
          // @ts-expect-error this needs some further investigation. 'type' is merely an string literal union, not an array (i.e. tuple) according to the OpenAPI 3 typings for `SchemaObject.type`.
          schema.properties[key].type = [schema.properties[key].type, 'null'];
        }
      }

      bodySchema = serializeSchemaForKong(schema, components);
    }
  }

  return {
    bodySchema,
    allowedContentTypes,
  };
}

export async function generateRequestValidatorPlugin({
  tags,
  api,
  plugin = { name: 'request-validator' },
  operation,
}: {
  tags: string[];
  api: OpenApi3Spec;
  plugin?: Partial<RequestValidatorPlugin>;
  operation?: OA3Operation;
}) {
  const config: Partial<RequestValidatorPlugin['config']> = {
    version: 'draft4',
  };

  // // Use original or generated parameter_schema
  const parameterSchema = isParameterSchema(plugin.config) ? plugin.config.parameter_schema : await generateParameterSchema(api, operation);

  const generated = await generateBodyOptions(api, operation);

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

export async function generateGlobalPlugins(api: OpenApi3Spec, tags: string[]) {
  const globalPlugins = generatePlugins(api, tags);
  const plugin = getRequestValidatorPluginDirective(api);

  if (plugin) {
    globalPlugins.push(await generateRequestValidatorPlugin({ plugin, tags, api }));
  }

  return {
    // Server plugins take precedence over global plugins
    plugins: distinctByProperty<DCPlugin>(globalPlugins, plugin => plugin.name),
    requestValidatorPlugin: plugin,
  };
}

export const generateOperationPlugins = async ({ operation, pathPlugins, parentValidatorPlugin, tags, api }: {
  operation: OA3Operation;
  pathPlugins: DCPlugin[];
  parentValidatorPlugin?: RequestValidatorPlugin | null;
  tags: string[];
  api: OpenApi3Spec;
}) => {
  const operationPlugins = generatePlugins(operation, tags);
  // Check if validator plugin exists on the operation, even if the value of the plugin is undefined
  const operationValidatorPlugin = getRequestValidatorPluginDirective(operation);

  // Use the operation or parent validator plugin, or skip if neither exist
  const plugin = operationValidatorPlugin || parentValidatorPlugin;

  if (plugin) {
    operationPlugins.push(await generateRequestValidatorPlugin({ plugin, tags, operation, api }));
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
