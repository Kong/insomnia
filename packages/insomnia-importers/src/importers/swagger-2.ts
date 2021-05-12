import crypto from 'crypto';
import { unthrowableParseJson } from '../utils';
import SwaggerParser from '@apidevtools/swagger-parser';
import { OpenAPIV2 } from 'openapi-types';
import YAML from 'yaml';
import { Converter, Header, ImportRequest } from '../entities';

const SUPPORTED_SWAGGER_VERSION = '2.0';
const MIMETYPE_JSON = 'application/json';
const MIMETYPE_URLENCODED = 'application/x-www-form-urlencoded';
const MIMETYPE_MULTIPART = 'multipart/form-data';
const SUPPORTED_MIME_TYPES = [
  MIMETYPE_JSON,
  MIMETYPE_URLENCODED,
  MIMETYPE_MULTIPART,
];
const WORKSPACE_ID = '__WORKSPACE_ID__';
let requestCount = 1;
export const id = 'swagger2';
export const name = 'Swagger 2.0';
export const description = 'Importer for Swagger 2.0 specification (json/yaml)';

/* eslint-disable camelcase -- this file uses camel case too often */

/**
 * Return Insomnia folder / request group
 */
const importFolderItem = (parentId: string) => (
  item: OpenAPIV2.TagObject,
): ImportRequest => {
  const hash = crypto
    .createHash('sha1')
    .update(item.name)
    .digest('hex')
    .slice(0, 8);
  return {
    parentId,
    _id: `fld___WORKSPACE_ID__${hash}`,
    _type: 'request_group',
    name: item.name || 'Folder {requestGroupCount}',
    description: item.description || '',
  };
};

/**
 * Parse string data into swagger 2.0 object (https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md#swagger-object)
 */
const parseDocument = (rawData: string) => {
  try {
    return unthrowableParseJson(rawData) || YAML.parse(rawData);
  } catch (err) {
    return null;
  }
};

/**
 * Create request definitions based on swagger document.
 */
const parseEndpoints = (document: OpenAPIV2.Document) => {
  const defaultParent = WORKSPACE_ID;
  const globalMimeTypes = document.consumes ?? [];
  const endpointsSchemas: OpenAPIV2.OperationObject[] = Object.keys(
    document.paths,
  )
    .map((path: keyof OpenAPIV2.PathsObject) => {
      const schemasPerMethod: OpenAPIV2.PathItemObject = document.paths[path];
      const methods = Object.keys(
        schemasPerMethod,
      ) as (keyof OpenAPIV2.PathItemObject)[];
      return methods
        .filter((method) => method !== 'parameters' && method !== '$ref')
        .map((method) => ({
          ...(schemasPerMethod[method] as OpenAPIV2.OperationObject),
          path,
          method,
        }));
    })
    .flat();

  const tags = document.tags || [];

  const implicitTags = endpointsSchemas
    .map((endpointSchema) => endpointSchema.tags)
    .flat()
    .reduce((distinct, value) => {
      // remove duplicates
      if (value !== undefined && !distinct.includes(value)) {
        distinct.push(value);
      }
      return distinct;
    }, [] as string[])
    .filter((tag) => !tags.map((tag) => tag.name).includes(tag))
    .map((name) => ({ name, desciption: '' }));

  const folders = [...tags, ...implicitTags].map(
    importFolderItem(defaultParent),
  );

  const folderLookup = folders.reduce(
    (accumulator, { _id, name }) => ({
      ...accumulator,
      ...(name === undefined ? {} : { [name]: _id }),
    }),
    {} as { [name: string]: string | undefined },
  );

  const requests: ImportRequest[] = [];
  endpointsSchemas.map((endpointSchema) => {
    let { tags } = endpointSchema;
    if (!tags || tags.length === 0) tags = [''];
    tags.forEach((tag, index) => {
      const requestId = endpointSchema.operationId
        ? `${endpointSchema.operationId}${index > 0 ? index : ''}`
        : `__REQUEST_${requestCount++}__`;

      const parentId = folderLookup[tag] || defaultParent;
      requests.push(
        importRequest(
          document,
          endpointSchema,
          globalMimeTypes,
          requestId,
          parentId,
        ),
      );
    });
  });

  return [...folders, ...requests];
};

const importRequest = (
  document: OpenAPIV2.Document,
  endpointSchema: OpenAPIV2.OperationObject<{ method?: string; path?: string }>,
  globalMimeTypes: OpenAPIV2.MimeTypes,
  requestId: string,
  parentId: string,
): ImportRequest => {
  const name =
    endpointSchema.summary || `${endpointSchema.method} ${endpointSchema.path}`;

  const body = prepareBody(document, endpointSchema, globalMimeTypes);

  let headers = prepareHeaders(endpointSchema);
  const noContentTypeHeader = !headers?.find(
    (header) => header.name === 'Content-Type',
  );

  if (body.mimeType && noContentTypeHeader) {
    headers = [
      {
        name: 'Content-Type',
        disabled: false,
        value: body.mimeType,
      },
      ...headers,
    ];
  }

  const request: ImportRequest = {
    _type: 'request',
    _id: requestId,
    parentId: parentId,
    name,
    method: endpointSchema.method?.toUpperCase(),
    url: `{{ base_url }}${pathWithParamsAsVariables(endpointSchema.path)}`,
    body,
    description: endpointSchema.description || '',
    headers,
    parameters: prepareQueryParams(endpointSchema),
  };

  return setupAuthentication(
    document.securityDefinitions,
    endpointSchema,
    request,
  );
};

/**
 * Populate Insomnia request with authentication
 */
const setupAuthentication = (
  securityDefinitions: OpenAPIV2.SecurityDefinitionsObject | undefined,
  endpointSchema: OpenAPIV2.OperationObject | undefined,
  request: ImportRequest,
) => {
  if (!securityDefinitions) {
    return request;
  }

  if (!endpointSchema?.security || endpointSchema.security.length === 0) {
    return request;
  }

  const usedDefinitions = endpointSchema.security.reduce(
    (collect, requirement) => [
      ...collect,
      ...(Object.keys(requirement) as string[]),
    ],
    [] as string[],
  );

  const scopes = endpointSchema.security.reduce((accumulator, security) => {
    for (const defname of Object.keys(security)) {
      if (security[defname].length === 0) {
        continue;
      }
      return accumulator.concat(security[defname]);
    }

    return accumulator;
  }, [] as string[]);

  for (const usedDefinition of usedDefinitions) {
    const securityScheme = securityDefinitions[usedDefinition];

    if (securityScheme.type === 'basic') {
      request.authentication = {
        type: 'basic',
        disabled: false,
        password: '{{ password }}',
        username: '{{ username }}',
      };
    }

    if (securityScheme.type === 'apiKey') {
      if (securityScheme.in === 'header') {
        request.headers?.push({
          name: securityScheme.name,
          disabled: false,
          value: '{{ api_key }}',
        });
      }

      if (securityScheme.in === 'query') {
        request.parameters?.push({
          name: securityScheme.name,
          disabled: false,
          value: '{{ api_key }}',
        });
      }
    }

    if (securityScheme.type === 'oauth2') {
      if (securityScheme.flow === 'implicit') {
        request.authentication = {
          type: 'oauth2',
          grantType: 'authorization_code',
          disabled: false,
          authorizationUrl: securityScheme.authorizationUrl,
          clientId: '{{ client_id }}',
          scope: scopes.join(' '),
        };
      }

      if (securityScheme.flow === 'password') {
        request.authentication = {
          type: 'oauth2',
          grantType: 'password',
          disabled: false,
          accessTokenUrl: securityScheme.tokenUrl,
          username: '{{ username }}',
          password: '{{ password }}',
          clientId: '{{ client_id }}',
          clientSecret: '{{ client_secret }}',
          scope: scopes.join(' '),
        };
      }

      if (securityScheme.flow === 'application') {
        request.authentication = {
          type: 'oauth2',
          grantType: 'client_credentials',
          disabled: false,
          accessTokenUrl: securityScheme.tokenUrl,
          clientId: '{{ client_id }}',
          clientSecret: '{{ client_secret }}',
          scope: scopes.join(' '),
        };
      }

      if (securityScheme.flow === 'accessCode') {
        request.authentication = {
          type: 'oauth2',
          grantType: 'authorization_code',
          disabled: false,
          accessTokenUrl: securityScheme.tokenUrl,
          authorizationUrl: securityScheme.authorizationUrl,
          clientId: '{{ client_id }}',
          clientSecret: '{{ client_secret }}',
          scope: scopes.join(' '),
        };
      }
    }
  }

  return request;
};

/**
 * Return path with parameters replaced by insomnia variables
 *
 * I.e. "/foo/:bar" => "/foo/{{ bar }}"
 */
const pathWithParamsAsVariables = (path?: string) => {
  return path?.replace(/{([^}]+)}/g, '{{ $1 }}');
};

/**
 * Imports insomnia definitions of query parameters.
 */
const prepareQueryParams = (endpointSchema: OpenAPIV2.OperationObject) => {
  return (
    convertParameters(
      ((endpointSchema.parameters as unknown) as OpenAPIV2.Parameter[])?.filter(
        (parameter) => parameter.in === 'query',
      ),
    ) || []
  );
};

/**
 * Imports insomnia definitions of header parameters.
 */
const prepareHeaders = (
  endpointSchema: OpenAPIV2.OperationObject,
): Header[] => {
  return (
    (convertParameters(
      ((endpointSchema.parameters as unknown) as OpenAPIV2.Parameter[])?.filter(
        (parameter) => parameter.in === 'header',
      ),
    ) as Header[]) || []
  );
};

const resolve$ref = (document: OpenAPIV2.Document, $ref: string) => {
  const [, ...parts] = $ref.split('/') as (keyof OpenAPIV2.Document)[];
  return parts.reduce(
    (accumulator, path) => accumulator[path] as OpenAPIV2.Document,
    document,
  );
};

/**
 * Imports insomnia request body definitions, including data mock (if available)
 *
 * If multiple types are available, the one for which an example can be generated will be selected first (i.e. application/json)
 */
const prepareBody = (
  document: OpenAPIV2.Document,
  endpointSchema: OpenAPIV2.OperationObject,
  globalMimeTypes: OpenAPIV2.MimeTypes,
) => {
  const mimeTypes = endpointSchema.consumes || globalMimeTypes || [];

  const supportedMimeType = SUPPORTED_MIME_TYPES.find((mimeType) =>
    mimeTypes.includes(mimeType),
  );

  if (supportedMimeType === MIMETYPE_JSON) {
    const parameters = endpointSchema.parameters || [];
    const bodyParameter = parameters.find(
      (parameter) => (parameter as OpenAPIV2.Parameter).in === 'body',
    );

    if (!bodyParameter) {
      return {};
    }

    const type = (bodyParameter as OpenAPIV2.ParameterObject).type || 'object';
    const example = generateParameterExample(type);
    let text;

    if (type === 'object') {
      const { schema } = bodyParameter as OpenAPIV2.ParameterObject;
      if (schema.$ref) {
        const definition = resolve$ref(document, schema.$ref);
        text = JSON.stringify(example(definition), null, 2);
      } else {
        text = JSON.stringify(example(schema), null, 2);
      }
    } else {
      text = JSON.stringify(example, null, 2);
    }

    return {
      mimeType: supportedMimeType,
      text,
    };
  }

  if (
    supportedMimeType === MIMETYPE_URLENCODED ||
    supportedMimeType === MIMETYPE_MULTIPART
  ) {
    const parameters = endpointSchema.parameters || [];
    const formDataParameters = ((parameters as unknown) as OpenAPIV2.Parameter[]).filter(
      (parameter) => parameter.in === 'formData',
    );

    if (formDataParameters.length === 0) {
      return {};
    }

    return {
      mimeType: supportedMimeType,
      params: convertParameters(formDataParameters),
    };
  }

  if (mimeTypes && mimeTypes.length) {
    return {
      mimeType: mimeTypes[0] || undefined,
    };
  } else {
    return {};
  }
};

type TypeExample =
  | 'string'
  | 'string_email'
  | 'string_date-time'
  | 'string_byte'
  | 'number'
  | 'number_float'
  | 'number_double'
  | 'integer'
  | 'boolean'
  | 'object'
  | 'array';

/**
 * Generate example value of parameter based on it's schema.
 * Returns example / default value of the parameter, if any of those are defined. If not, returns value based on parameter type.
 */
const generateParameterExample = (
  parameter: OpenAPIV2.Parameter | TypeExample,
  ancestors: OpenAPIV2.Parameter[] = [],
) => {
  const typeExamples: {
    [kind in TypeExample]: (
      parameter: OpenAPIV2.Parameter
    ) => null | string | boolean | number | Record<string, unknown>;
  } = {
    string: () => 'string',
    string_email: () => 'user@example.com',
    'string_date-time': () => new Date().toISOString(),
    string_byte: () => 'ZXhhbXBsZQ==',
    number: () => 0,
    number_float: () => 0.0,
    number_double: () => 0.0,
    integer: () => 0,
    boolean: () => true,
    object: (parameter: OpenAPIV2.Parameter) => {
      if (ancestors.indexOf(parameter) !== -1) {
        return {};
      }

      const example = {};

      const { properties } = parameter;
      if (properties) {
        ancestors.push(parameter);
        Object.keys(properties).forEach((propertyName) => {
          // @ts-expect-error there's no way, so far as I'm aware, for TypeScript to know what's actually going on here.
          example[propertyName] = generateParameterExample(
            properties[propertyName],
            ancestors,
          );
        });
        ancestors.pop();
      }

      return example;
    },
    array: ({ items, collectionFormat }: OpenAPIV2.Parameter) => {
      const value = generateParameterExample(items, ancestors);

      if (collectionFormat === 'csv') {
        return value;
      } else {
        return [value];
      }
    },
  };

  if (typeof parameter === 'string') {
    return typeExamples[parameter];
  }

  if (typeof parameter === 'object') {
    const { type, format, example, default: defaultValue } = parameter;

    if (example) {
      return example;
    }

    if (defaultValue) {
      return defaultValue;
    }

    const factory =
      typeExamples[`${type}_${format}` as TypeExample] ||
      typeExamples[type as TypeExample];

    if (!factory) {
      return null;
    }

    return factory(parameter);
  }
};

/**
 * Converts swagger schema of parametes into insomnia one.
 */
const convertParameters = (parameters?: OpenAPIV2.Parameter[]) => {
  return parameters?.map((parameter) => {
    const { required, name, type } = parameter;

    if (type === 'file') {
      return {
        name,
        disabled: required !== true,
        type: 'file',
      };
    }

    return {
      name,
      disabled: required !== true,
      value: `${generateParameterExample(parameter) as string}`,
    };
  });
};

export const convert: Converter = async (rawData) => {
  requestCount = 1; // Validate

  let api = await parseDocument(rawData);

  if (!api || api.swagger !== SUPPORTED_SWAGGER_VERSION) {
    return null;
  } // Await here so we catch any exceptions

  try {
    api = await SwaggerParser.validate(api);
  } catch (err) {
    // We already know it's a Swagger doc so we will try to import it anyway instead
    // of bailing out here.
    console.log('[swagger] Import file validation failed', err);
  } // Import

  const workspace: ImportRequest = {
    _type: 'workspace',
    _id: WORKSPACE_ID,
    parentId: null,
    name: `${api.info.title} ${api.info.version}`,
    description: api.info.description || '', // scope is not set because it could be imported for design OR to generate requests
  };

  const baseEnv: ImportRequest = {
    _type: 'environment',
    _id: '__BASE_ENVIRONMENT_ID__',
    parentId: WORKSPACE_ID,
    name: 'Base environment',
    data: {
      base_url: '{{ scheme }}://{{ host }}{{ base_path }}',
    },
  };

  const swaggerEnv: ImportRequest = {
    _type: 'environment',
    _id: 'env___BASE_ENVIRONMENT_ID___sub',
    parentId: baseEnv._id,
    name: 'Swagger env',
    data: {
      base_path: api.basePath || '',
      scheme: (api.schemes || ['http'])[0],
      host: api.host || '',
    },
  };
  const endpoints = parseEndpoints(api);

  return [workspace, baseEnv, swaggerEnv, ...endpoints];
};
