import SwaggerParser from '@apidevtools/swagger-parser';
import { camelCase } from 'change-case';
import crypto from 'crypto';
import { OpenAPIV2, OpenAPIV3 } from 'openapi-types';
import { parse as urlParse } from 'url';
import YAML from 'yaml';

import { Authentication, Converter, ImportRequest } from '../entities';
import { unthrowableParseJson } from '../utils';

export const id = 'openapi3';
export const name = 'OpenAPI 3.0';
export const description = 'Importer for OpenAPI 3.0 specification (json/yaml)';

/* eslint-disable camelcase -- some camecase is required by the parsing of the spec itself */

const SUPPORTED_OPENAPI_VERSION = /^3\.\d+\.\d+$/;

// 3.x.x
const MIMETYPE_JSON = 'application/json';
const MIMETYPE_LITERALLY_ANYTHING = '*/*';
const SUPPORTED_MIME_TYPES = [MIMETYPE_JSON, MIMETYPE_LITERALLY_ANYTHING];
const WORKSPACE_ID = '__WORKSPACE_ID__';
const SECURITY_TYPE = {
  HTTP: 'http',
  API_KEY: 'apiKey',
  OAUTH: 'oauth2',
  OPEN_ID: 'openIdConnect',
};
const HTTP_AUTH_SCHEME = {
  BASIC: 'basic',
  BEARER: 'bearer',
};
const OAUTH_FLOWS = {
  AUTHORIZATION_CODE: 'authorizationCode',
  CLIENT_CREDENTIALS: 'clientCredentials',
  IMPLICIT: 'implicit',
  PASSWORD: 'password',
} as const;
const SUPPORTED_SECURITY_TYPES = [
  SECURITY_TYPE.HTTP,
  SECURITY_TYPE.API_KEY,
  SECURITY_TYPE.OAUTH,
];
const SUPPORTED_HTTP_AUTH_SCHEMES = [
  HTTP_AUTH_SCHEME.BASIC,
  HTTP_AUTH_SCHEME.BEARER,
];
const VARIABLE_SEARCH_VALUE = /{([^}]+)}/g;
let requestCounts: Record<string, number> = {};

/**
 * Gets a server to use as the default
 * Either the first server defined in the specification, or an example if none are specified
 *
 * @returns the resolved server URL
 */
const getDefaultServerUrl = (api: OpenAPIV3.Document) => {
  const exampleServer = 'http://example.com/';
  const servers = api.servers || [];
  const firstServer = servers[0];
  const foundServer = firstServer && firstServer.url;

  if (!foundServer) {
    return urlParse(exampleServer);
  }

  const url = resolveVariables(firstServer);
  return urlParse(url);
};

/**
 * Resolve default variables for a server url
 *
 * @returns the resolved url
 */
const resolveVariables = (server: OpenAPIV3.ServerObject) => {
  let resolvedUrl = server.url;
  const variables = server.variables || {};
  let shouldContinue = true;

  do {
    // Regexp contain the global flag (g), meaning we must execute our regex on the original string.
    // https://stackoverflow.com/a/27753327
    const [replace, name] = VARIABLE_SEARCH_VALUE.exec(server.url) || [];
    const variable = variables && variables[name];
    const value = variable && variable.default;

    if (name && !value) {
      // We found a variable in the url (name) but we have no default to replace it with (value)
      throw new Error(`Server variable "${name}" missing default value`);
    }

    shouldContinue = !!name;
    resolvedUrl = replace ? resolvedUrl.replace(replace, value) : resolvedUrl;
  } while (shouldContinue);

  return resolvedUrl;
};

/**
 * Parse string data into openapi 3 object (https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.0.md#oasObject)
 */
const parseDocument = (rawData: string): OpenAPIV3.Document | null => {
  try {
    return (unthrowableParseJson(rawData) ||
      YAML.parse(rawData)) as OpenAPIV3.Document;
  } catch (err) {
    return null;
  }
};

/**
 * Create request definitions based on openapi document.
 */
const parseEndpoints = (document?: OpenAPIV3.Document | null) => {
  if (!document) {
    return [];
  }

  const rootSecurity = document.security;
  const securitySchemes = document.components?.securitySchemes as OpenAPIV3.SecuritySchemeObject | undefined;
  const defaultParent = WORKSPACE_ID;

  const endpointsSchemas: ({
    path: string;
    method: string;
    tags?: string[];
  } & OpenAPIV3.SchemaObject)[] = Object.keys(document.paths)
    .map(path => {
      const schemasPerMethod = document.paths[path];

      if (!schemasPerMethod) {
        return [];
      }

      return Object.keys(schemasPerMethod)
        .filter(method => method !== 'parameters' && method.indexOf('x-') !== 0)
        .map(method => ({
          ...((schemasPerMethod as Record<string, OpenAPIV3.SchemaObject>)[method]),
          path,
          method,
        }));
    })
    .flat();

  const folders = document.tags?.map(importFolderItem(defaultParent)) || [];
  const folderLookup = folders.reduce((accumulator, folder) => ({
    ...accumulator,
    ...(folder.name ? { [folder.name]: folder._id } : {}),
  }), {} as Record<OpenAPIV3.TagObject['name'], string | undefined>);

  const requests: ImportRequest[] = [];
  endpointsSchemas.forEach(endpointSchema => {
    let { tags } = endpointSchema;

    if (!tags || tags.length === 0) {
      tags = [''];
    }

    tags.forEach(tag => {
      const parentId = folderLookup[tag] || defaultParent;
      const resolvedSecurity = (endpointSchema as unknown as OpenAPIV3.Document).security || rootSecurity;
      requests.push(
        importRequest(
          endpointSchema,
          parentId,
          resolvedSecurity,
          securitySchemes,
        ),
      );
    });
  });

  return [
    ...folders,
    ...requests,
  ];
};

/**
 * Return Insomnia folder / request group
 */
const importFolderItem = (parentId: string) => (
  item: OpenAPIV3.SchemaObject,
): ImportRequest => {
  const hash = crypto
    .createHash('sha1')
    // @ts-expect-error -- this is not present on the official types, yet was here in the source code
    .update(item.name)
    .digest('hex')
    .slice(0, 8);
  return {
    parentId,
    _id: `fld___WORKSPACE_ID__${hash}`,
    _type: 'request_group',
    // @ts-expect-error -- this is not present on the official types, yet was here in the source code
    name: item.name || 'Folder {requestGroupCount}',
    description: item.description || '',
  };
};

/**
 * Return path with parameters replaced by insomnia variables
 *
 * I.e. "/foo/:bar" => "/foo/{{ bar }}"
 */
const pathWithParamsAsVariables = (path?: string) =>
  path?.replace(VARIABLE_SEARCH_VALUE, '{{ $1 }}') ?? '';

/**
 * Return Insomnia request
 */
const importRequest = (
  endpointSchema: OpenAPIV3.SchemaObject & { summary?: string; path?: string; method?: string },
  parentId: string,
  security?: OpenAPIV3.SecurityRequirementObject[],
  securitySchemes?: OpenAPIV3.SecuritySchemeObject,
): ImportRequest => {
  const name = endpointSchema.summary || endpointSchema.path;
  const id = generateUniqueRequestId(endpointSchema as OpenAPIV3.OperationObject);
  const paramHeaders = prepareHeaders(endpointSchema);
  const {
    authentication,
    headers: securityHeaders,
    parameters: securityParams,
  } = parseSecurity(security, securitySchemes);
  return {
    _type: 'request',
    _id: id,
    parentId: parentId,
    name,
    method: endpointSchema.method?.toUpperCase(),
    url: `{{ base_url }}${pathWithParamsAsVariables(endpointSchema.path)}`,
    body: prepareBody(endpointSchema),
    headers: [...paramHeaders, ...securityHeaders],
    authentication: authentication as Authentication,
    parameters: [...prepareQueryParams(endpointSchema), ...securityParams],
  };
};

/**
 * Imports insomnia definitions of query parameters.
 */
const prepareQueryParams = (endpointSchema: OpenAPIV3.PathItemObject) => {
  return convertParameters(
    endpointSchema.parameters?.filter(parameter => (
      (parameter as OpenAPIV3.ParameterObject).in === 'query'
    )) as OpenAPIV3.ParameterObject[]);
};

/**
 * Imports insomnia definitions of header parameters.
 */
const prepareHeaders = (endpointSchema: OpenAPIV3.PathItemObject) => {
  return convertParameters(
    endpointSchema.parameters?.filter(parameter => (
      (parameter as OpenAPIV3.ParameterObject).in === 'header'
    )) as OpenAPIV3.ParameterObject[]);
};

/**
 * Parse OpenAPI 3 securitySchemes into insomnia definitions of authentication, headers and parameters
 * @returns headers or basic|bearer http authentication details
 */
const parseSecurity = (
  security?: OpenAPIV3.SecurityRequirementObject[],
  securitySchemes?: OpenAPIV3.SecuritySchemeObject,
) => {
  if (!security || !securitySchemes) {
    return {
      authentication: {},
      headers: [],
      parameters: [],
    };
  }

  const supportedSchemes = security
    .map(securityPolicy => {
      const securityName = Object.keys(securityPolicy)[0];
      // @ts-expect-error the base types do not include an index but from what I can tell, they should
      return securitySchemes[securityName];
    })
    .filter(schemeDetails => (
      schemeDetails && SUPPORTED_SECURITY_TYPES.includes(schemeDetails.type)
    ));
  const apiKeySchemes = supportedSchemes.filter(scheme => (
    scheme.type === SECURITY_TYPE.API_KEY
  ));
  const apiKeyHeaders = apiKeySchemes
    .filter(scheme => scheme.in === 'header')
    .map(scheme => {
      const variableName = camelCase(scheme.name);
      return {
        name: scheme.name,
        disabled: false,
        value: `{{ ${variableName} }}`,
      };
    });
  const apiKeyCookies = apiKeySchemes
    .filter(scheme => scheme.in === 'cookie')
    .map(scheme => {
      const variableName = camelCase(scheme.name);
      return `${scheme.name}={{ ${variableName} }}`;
    });
  const apiKeyCookieHeader = {
    name: 'Cookie',
    disabled: false,
    value: apiKeyCookies.join('; '),
  };
  const apiKeyParams = apiKeySchemes
    .filter(scheme => scheme.in === 'query')
    .map(scheme => {
      const variableName = camelCase(scheme.name);
      return {
        name: scheme.name,
        disabled: false,
        value: `{{ ${variableName} }}`,
      };
    });

  if (apiKeyCookies.length > 0) {
    apiKeyHeaders.push(apiKeyCookieHeader);
  }

  const authentication = (() => {
    const authScheme = supportedSchemes.find(
      scheme =>
        [SECURITY_TYPE.HTTP, SECURITY_TYPE.OAUTH].includes(scheme.type) &&
        SUPPORTED_HTTP_AUTH_SCHEMES.includes(scheme.scheme),
    );

    if (!authScheme) {
      return {};
    }

    switch (authScheme.type) {
      case SECURITY_TYPE.HTTP:
        return parseHttpAuth(
          (authScheme as OpenAPIV3.HttpSecurityScheme).scheme,
        );

      case SECURITY_TYPE.OAUTH:
        return parseOAuth2(authScheme as OpenAPIV3.OAuth2SecurityScheme);

      default:
        return {};
    }
  })();

  return {
    authentication,
    headers: apiKeyHeaders,
    parameters: apiKeyParams,
  };
};

/**
 * Get Insomnia environment variables for OpenAPI securitySchemes
 *
 * @returns Insomnia environment variables containing security information
 */
const getSecurityEnvVariables = (securitySchemeObject?: OpenAPIV3.SecuritySchemeObject) => {
  if (!securitySchemeObject) {
    return {};
  }

  const securitySchemes = Object.values(securitySchemeObject);

  const apiKeyVariableNames = securitySchemes
    .filter(scheme => scheme.type === SECURITY_TYPE.API_KEY)
    .map(scheme => camelCase(scheme.name));
  const variables: Record<string, string> = {};
  Array.from(new Set(apiKeyVariableNames)).forEach(name => {
    variables[name] = name;
  });

  const hasHttpBasicScheme = securitySchemes.some(scheme => (
    scheme.type === SECURITY_TYPE.HTTP && scheme.scheme === 'basic'
  ));
  if (hasHttpBasicScheme) {
    variables.httpUsername = 'username';
    variables.httpPassword = 'password';
  }
  const hasHttpBearerScheme = securitySchemes.some(scheme => (
    scheme.type === SECURITY_TYPE.HTTP && scheme.scheme === 'bearer'
  ));
  if (hasHttpBearerScheme) {
    variables.bearerToken = 'bearerToken';
  }

  const oauth2Variables = securitySchemes.reduce((accumulator, scheme) => {
    if (scheme.type === SECURITY_TYPE.OAUTH && scheme.scheme === 'bearer') {
      accumulator.oauth2ClientId = 'clientId';
      const flows = scheme.flows || {};

      if (
        flows.authorizationCode ||
        flows.clientCredentials ||
        flows.password
      ) {
        accumulator.oauth2ClientSecret = 'clientSecret';
      }

      if (flows.password) {
        accumulator.oauth2Username = 'username';
        accumulator.oauth2Password = 'password';
      }
    }

    return accumulator;
  }, {});

  return {
    ...variables,
    ...oauth2Variables,
  };
};

/**
 * Imports insomnia request body definitions, including data mock (if available)
 *
 * If multiple types are available, the one for which an example can be generated will be selected first (i.e. application/json)
 */
const prepareBody = (endpointSchema: OpenAPIV3.OperationObject): ImportRequest['body'] => {
  const { content } = (endpointSchema.requestBody || { content: {} }) as OpenAPIV3.RequestBodyObject;

  const mimeTypes = Object.keys(content);
  const supportedMimeType = SUPPORTED_MIME_TYPES.find(mimeType =>
    mimeTypes.includes(mimeType),
  );

  if (supportedMimeType === MIMETYPE_JSON) {
    const bodyParameter = content[supportedMimeType];

    if (bodyParameter == null) {
      return {
        mimeType: MIMETYPE_JSON,
      };
    }

    const example = generateParameterExample(bodyParameter.schema as OpenAPIV3.SchemaObject);
    const text = JSON.stringify(example, null, 2);
    return {
      mimeType: MIMETYPE_JSON,
      text,
    };
  }

  if (
    mimeTypes &&
    mimeTypes.length &&
    mimeTypes[0] !== MIMETYPE_LITERALLY_ANYTHING
  ) {
    return {
      mimeType: mimeTypes[0] || undefined,
    };
  } else {
    return {};
  }
};

/**
 * Converts openapi schema of parameters into insomnia one.
 */
const convertParameters = (parameters: OpenAPIV3.ParameterObject[] = []) => {
  return parameters.map(parameter => {
    const { required, name, schema } = parameter;
    return {
      name,
      disabled: required !== true,
      value: `${generateParameterExample(schema as OpenAPIV3.SchemaObject)}`,
    };
  });
};

/**
 * Generate example value of parameter based on it's schema.
 * Returns example / default value of the parameter, if any of those are defined. If not, returns value based on parameter type.
 */
// @ts-expect-error -- ran out of time during TypeScript conversion to handle this particular recursion
const generateParameterExample = (schema: OpenAPIV3.SchemaObject | string) => {
  const typeExamples = {
    string: () => 'string',
    string_email: () => 'user@example.com',
    'string_date-time': () => new Date().toISOString(),
    string_byte: () => 'ZXhhbXBsZQ==',
    number: () => 0,
    number_float: () => 0.0,
    number_double: () => 0.0,
    integer: () => 0,
    boolean: () => true,
    object: (schema: OpenAPIV3.SchemaObject) => {
      const example: OpenAPIV3.SchemaObject['properties'] = {};
      const { properties } = schema;

      if (properties) {
        for (const propertyName of Object.keys(properties)) {
          example[propertyName] = generateParameterExample(
            properties[propertyName] as OpenAPIV3.SchemaObject,
          );
        }
      }

      return example;
    },
    // @ts-expect-error -- ran out of time during TypeScript conversion to handle this particular recursion
    array: (schema: OpenAPIV2.ItemsObject) => {
      // @ts-expect-error -- ran out of time during TypeScript conversion to handle this particular recursion
      const value = generateParameterExample(schema.items);

      if (schema.collectionFormat === 'csv') {
        return value;
      } else {
        return [value];
      }
    },
  };

  if (typeof schema === 'string') {
    // @ts-expect-error -- ran out of time during TypeScript conversion to handle this particular recursion
    return typeExamples[schema];
  }

  if (schema instanceof Object) {
    const { type, format, example, readOnly, default: defaultValue } = schema;

    if (readOnly) {
      return undefined;
    }

    if (example) {
      return example;
    }

    if (defaultValue) {
      return defaultValue;
    }

    // @ts-expect-error -- ran out of time during TypeScript conversion to handle this particular recursion
    const factory = typeExamples[`${type}_${format}`] || typeExamples[type];

    if (!factory) {
      return null;
    }

    return factory(schema);
  }
};

/**
 * Generates a unique and deterministic request ID based on the endpoint schema
 */
const generateUniqueRequestId = (
  endpointSchema: OpenAPIV3.OperationObject<{ method?: string; path?: string }>,
) => {
  // `operationId` is already unique to the workspace, so we can just use that, combined with the workspace id to get something globally unique
  const uniqueKey = endpointSchema.operationId || `[${endpointSchema.method}]${endpointSchema.path}`;

  const hash = crypto
    .createHash('sha1')
    .update(uniqueKey)
    .digest('hex')
    .slice(0, 8);

  // Suffix the ID with a counter in case we try creating two with the same hash
  if (requestCounts.hasOwnProperty(hash)) {
    requestCounts[hash] += 1;
  } else {
    requestCounts[hash] = 0;
  }

  return `req_${WORKSPACE_ID}${hash}${requestCounts[hash] || ''}`;
};

const parseHttpAuth = (scheme: string) => {
  switch (scheme) {
    case HTTP_AUTH_SCHEME.BASIC:
      return {
        type: 'basic',
        username: '{{ httpUsername }}',
        password: '{{ httpPassword }}',
      };

    case HTTP_AUTH_SCHEME.BEARER:
      return {
        type: 'bearer',
        token: '{{bearerToken}}',
        prefix: '',
      };

    default:
      return {};
  }
};

const parseOAuth2Scopes = (
  flow: OpenAPIV3.OAuth2SecurityScheme['flows'][keyof OpenAPIV3.OAuth2SecurityScheme['flows']],
) => {
  if (!flow?.scopes) {
    return '';
  }

  const scopes = Object.keys(flow.scopes || {});
  return scopes.join(' ');
};

const mapOAuth2GrantType = (
  grantType: keyof OpenAPIV3.OAuth2SecurityScheme['flows'],
) => {
  const types = {
    [OAUTH_FLOWS.AUTHORIZATION_CODE]: 'authorization_code',
    [OAUTH_FLOWS.CLIENT_CREDENTIALS]: 'client_credentials',
    [OAUTH_FLOWS.IMPLICIT]: 'implicit',
    [OAUTH_FLOWS.PASSWORD]: 'password',
  };
  return types[grantType];
};

const parseOAuth2 = (scheme: OpenAPIV3.OAuth2SecurityScheme) => {
  const flows = Object.keys(
    scheme.flows,
  ) as (keyof OpenAPIV3.OAuth2SecurityScheme['flows'])[];

  if (!flows.length) {
    return {};
  }

  const grantType = flows[0];
  const flow = scheme.flows[grantType];

  if (!flow) {
    return {};
  }

  const base = {
    clientId: '{{ oauth2ClientId }}',
    grantType: mapOAuth2GrantType(grantType),
    scope: parseOAuth2Scopes(flow),
    type: 'oauth2',
  };

  switch (grantType) {
    case OAUTH_FLOWS.AUTHORIZATION_CODE:
      return {
        ...base,
        clientSecret: '{{ oauth2ClientSecret }}',
        accessTokenUrl: (flow as OpenAPIV3.OAuth2SecurityScheme['flows'][typeof OAUTH_FLOWS.AUTHORIZATION_CODE])?.tokenUrl,
        authorizationUrl: (flow as OpenAPIV3.OAuth2SecurityScheme['flows'][typeof OAUTH_FLOWS.AUTHORIZATION_CODE])?.authorizationUrl,
      };

    case OAUTH_FLOWS.CLIENT_CREDENTIALS:
      return {
        ...base,
        clientSecret: '{{ oauth2ClientSecret }}',
        accessTokenUrl: (flow as OpenAPIV3.OAuth2SecurityScheme['flows'][typeof OAUTH_FLOWS.CLIENT_CREDENTIALS])?.tokenUrl,
      };

    case OAUTH_FLOWS.IMPLICIT:
      return {
        ...base,
        authorizationUrl: (flow as OpenAPIV3.OAuth2SecurityScheme['flows'][typeof OAUTH_FLOWS.IMPLICIT])?.authorizationUrl,
      };

    case OAUTH_FLOWS.PASSWORD:
      return {
        ...base,
        clientSecret: '{{ oauth2ClientSecret }}',
        username: '{{ oauth2Username }}',
        password: '{{ oauth2Password }}',
        accessTokenUrl: (flow as OpenAPIV3.OAuth2SecurityScheme['flows'][typeof OAUTH_FLOWS.PASSWORD])?.tokenUrl,
      };

    default:
      return {};
  }
};

export const convert: Converter = async rawData => {
  // Reset
  requestCounts = {};

  // Validate
  let apiDocument = parseDocument(rawData);

  if (!apiDocument || !SUPPORTED_OPENAPI_VERSION.test(apiDocument.openapi)) {
    return null;
  }

  try {
    apiDocument = await SwaggerParser.validate(apiDocument) as OpenAPIV3.Document;
  } catch (err) {
    console.log('[openapi-3] Import file validation failed', err);
  }

  // Import
  const workspace: ImportRequest = {
    _type: 'workspace',
    _id: WORKSPACE_ID,
    parentId: null,
    name: `${apiDocument.info.title} ${apiDocument.info.version}`,
    description: apiDocument.info.description || '', // scope is not set because it could be imported for design OR to generate requests
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
  const defaultServerUrl = getDefaultServerUrl(apiDocument);
  const securityVariables = getSecurityEnvVariables(
    apiDocument.components?.securitySchemes as unknown as OpenAPIV3.SecuritySchemeObject,
  );
  const protocol = defaultServerUrl.protocol || '';

  // Base path is pulled out of the URL, and the trailing slash is removed
  const basePath = (defaultServerUrl.pathname || '').replace(/\/$/, '');

  const openapiEnv: ImportRequest = {
    _type: 'environment',
    _id: 'env___BASE_ENVIRONMENT_ID___sub',
    parentId: baseEnv._id,
    name: 'OpenAPI env',
    data: {
      // note: `URL.protocol` returns with trailing `:` (i.e. "https:")
      scheme: protocol.replace(/:$/, '') || ['http'],
      base_path: basePath,
      host: defaultServerUrl.host || '',
      ...securityVariables,
    },
  };

  const endpoints = parseEndpoints(apiDocument);

  return [
    workspace,
    baseEnv,
    openapiEnv,
    ...endpoints,
  ];
};
