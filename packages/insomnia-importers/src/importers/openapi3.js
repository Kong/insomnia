'use strict';

const crypto = require('crypto');
const changeCase = require('change-case');

const SwaggerParser = require('swagger-parser');
const { parse: urlParse } = require('url');
const utils = require('../utils');

const SUPPORTED_OPENAPI_VERSION = /^3\.\d+\.\d+$/; // 3.x.x
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
};
const SUPPORTED_SECURITY_TYPES = [SECURITY_TYPE.HTTP, SECURITY_TYPE.API_KEY, SECURITY_TYPE.OAUTH];
const SUPPORTED_HTTP_AUTH_SCHEMES = [HTTP_AUTH_SCHEME.BASIC, HTTP_AUTH_SCHEME.BEARER];
const PROTOCOL_VARIABLE_SEARCH_VALUE = /{([^}]+)}(?=:\/\/)/g; // positive lookahead for ://
const PATH_VARIABLE_SEARCH_VALUE = /{([^}]+)}(?!:\/\/)/g; // negative lookahead for ://
let requestCounts = {};

module.exports.id = 'openapi3';
module.exports.name = 'OpenAPI 3.0';
module.exports.description = 'Importer for OpenAPI 3.0 specification (json/yaml)';

module.exports.convert = async function(rawData) {
  // Reset
  requestCounts = {};

  // Validate
  let api = await parseDocument(rawData);
  if (!api || !SUPPORTED_OPENAPI_VERSION.test(api.openapi)) {
    return null;
  }

  try {
    api = await SwaggerParser.validate(api);
  } catch (err) {
    console.log('[openapi3] Import file validation failed', err);
  }

  // Import
  const workspace = {
    _type: 'workspace',
    _id: WORKSPACE_ID,
    parentId: null,
    name: `${api.info.title} ${api.info.version}`,
    description: api.info.description || '',
  };

  const baseEnv = {
    _type: 'environment',
    _id: '__BASE_ENVIRONMENT_ID__',
    parentId: WORKSPACE_ID,
    name: 'Base environment',
    data: {
      base_url: '{{ scheme }}://{{ host }}{{ base_path }}',
    },
  };

  const defaultServerUrl = getDefaultServerUrl(api);
  const securityVariables = getSecurityEnvVariables(
    api.components && api.components.securitySchemes,
  );

  const protocol = defaultServerUrl.protocol || '';

  // Base path is pulled out of the URL, and the trailing slash is removed
  const basePath = (defaultServerUrl.pathname || '').replace(/\/$/, '');

  const openapiEnv = {
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

  const endpoints = parseEndpoints(api);

  return [workspace, baseEnv, openapiEnv, ...endpoints];
};

/**
 * Gets a server to use as the default
 * Either the first server defined in the specification, or an example if none are specified
 *
 * @param {Object} api - openapi3 object
 * @returns {UrlWithStringQuery} the resolved server URL
 */
function getDefaultServerUrl(api) {
  const exampleServer = 'http://example.com/';
  const servers = api.servers || [];
  const firstServer = servers[0];
  const foundServer = firstServer && firstServer.url;

  if (!foundServer) {
    return urlParse(exampleServer);
  }

  const url = firstServer.url;

  const protocolResolved = resolveVariables(
    url,
    PROTOCOL_VARIABLE_SEARCH_VALUE,
    firstServer.variables,
    'http',
  );
  const pathResolved = resolveVariables(
    protocolResolved,
    PATH_VARIABLE_SEARCH_VALUE,
    firstServer.variables,
  );

  return urlParse(pathResolved);
}

/**
 * Resolve default variables for a server url
 *
 * @param {string} str - the source url
 * @param {RegExp} regExp - the regexp to use to identify variables
 * @param {Object} variables - the variables object from $.servers.*.variables in an openapi3 object
 * @param {string} fallback - the default string to apply
 * @returns {string} - the resolved url
 */
function resolveVariables(str, regExp, variables, fallback) {
  let resolved = str;
  let shouldContinue = true;

  do {
    // Regexp contain the global flag (g), meaning we must execute our regex on the original string.
    // https://stackoverflow.com/a/27753327
    const [replace, name] = regExp.exec(str) || [];
    const variable = variables && variables[name];
    const value = (variable && variable.default) || fallback;

    shouldContinue = !!name;
    resolved = replace && value ? resolved.replace(replace, value) : resolved;
  } while (shouldContinue);

  return resolved;
}

/**
 * Parse string data into openapi 3 object (https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.0.md#oasObject)
 *
 * @param {string} rawData
 *
 * @returns {Promise<Object|null>} OpenAPI 3 object
 */
async function parseDocument(rawData) {
  try {
    return utils.unthrowableParseJson(rawData) || SwaggerParser.YAML.parse(rawData);
  } catch (err) {
    return null;
  }
}

/**
 * Create request definitions based on openapi document.
 *
 * @param {Object} document - OpenAPI 3 valid object (https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.0.md#oasObject)
 *
 * @returns {Object[]} array of insomnia endpoints definitions
 */
function parseEndpoints(document) {
  const rootSecurity = document.security;
  const securitySchemes = document.components ? document.components.securitySchemes : {};
  const defaultParent = WORKSPACE_ID;

  const paths = Object.keys(document.paths);
  const endpointsSchemas = paths
    .map(path => {
      const schemasPerMethod = document.paths[path];
      const methods = Object.keys(schemasPerMethod);

      return methods
        .filter(method => method !== 'parameters' && method.indexOf('x-') !== 0)
        .map(method => Object.assign({}, schemasPerMethod[method], { path, method }));
    })
    .reduce(
      // flat single array
      (flat, arr) => flat.concat(arr),
      [],
    );

  const tags = document.tags || [];
  const folders = tags.map(tag => {
    return importFolderItem(tag, defaultParent);
  });
  const folderLookup = {};

  for (const folder of folders) {
    folderLookup[folder.name] = folder._id;
  }

  const requests = [];
  endpointsSchemas.map(endpointSchema => {
    let { tags } = endpointSchema;

    if (!tags || tags.length === 0) {
      tags = [''];
    }

    for (const tag of tags) {
      const parentId = folderLookup[tag] || defaultParent;
      const resolvedSecurity = endpointSchema.security || rootSecurity;
      requests.push(importRequest(endpointSchema, parentId, resolvedSecurity, securitySchemes));
    }
  });

  return [...folders, ...requests];
}

/**
 * Return Insomnia folder / request group
 *
 *
 * @param {Object} item - OpenAPI 3 endpoint schema
 * @param {string} parentId - id of parent category
 * @returns {Object}
 */
function importFolderItem(item, parentId) {
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
}

/**
 * Return Insomnia request
 *
 *
 * @param {Object} endpointSchema - OpenAPI 3 endpoint schema
 * @param {string} parentId - id of parent category
 * @param {Object} security - OpenAPI 3 security rules
 * @param {Object} securitySchemes - OpenAPI 3 security schemes
 * @returns {Object}
 */
function importRequest(endpointSchema, parentId, security, securitySchemes) {
  const name = endpointSchema.summary || endpointSchema.path;
  const id = generateUniqueRequestId(endpointSchema);
  const paramHeaders = prepareHeaders(endpointSchema);
  const { authentication, headers: securityHeaders, parameters: securityParams } = parseSecurity(
    security,
    securitySchemes,
  );

  const request = {
    _type: 'request',
    _id: id,
    parentId: parentId,
    name,
    method: endpointSchema.method.toUpperCase(),
    url: '{{ base_url }}' + pathWithParamsAsVariables(endpointSchema.path),
    body: prepareBody(endpointSchema),
    headers: [...paramHeaders, ...securityHeaders],
    authentication,
    parameters: [...prepareQueryParams(endpointSchema), ...securityParams],
  };

  return request;
}

/**
 * Return path with parameters replaced by insomnia variables
 *
 * I.e. "/foo/:bar" => "/foo/{{ bar }}"
 *
 * @param {string} path
 * @returns {string}
 */
function pathWithParamsAsVariables(path) {
  return path.replace(PATH_VARIABLE_SEARCH_VALUE, '{{ $1 }}');
}

/**
 * Imports insomnia definitions of query parameters.
 *
 * @param {Object} endpointSchema - OpenAPI 3 endpoint schema
 * @returns {Object[]} array of parameters definitions
 */
function prepareQueryParams(endpointSchema) {
  const isSendInQuery = p => p.in === 'query';
  const parameters = endpointSchema.parameters || [];
  const queryParameters = parameters.filter(isSendInQuery);
  return convertParameters(queryParameters);
}

/**
 * Imports insomnia definitions of header parameters.
 *
 * @param {Object} endpointSchema - OpenAPI 3 endpoint schema
 * @returns {Object[]} array of parameters definitions
 */
function prepareHeaders(endpointSchema) {
  const isSendInHeader = p => p.in === 'header';
  const parameters = endpointSchema.parameters || [];
  const headerParameters = parameters.filter(isSendInHeader);
  return convertParameters(headerParameters);
}

/**
 * Parse OpenAPI 3 securitySchemes into insomnia definitions of authentication, headers and parameters
 *
 * @param {Object} security - OpenAPI 3 security rules
 * @param {Object} securitySchemes - OpenAPI 3 security schemes
 * @returns {Object} headers or basic|bearer http authentication details
 */
function parseSecurity(security, securitySchemes) {
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
      return securitySchemes[securityName];
    })
    .filter(
      schemeDetails => schemeDetails && SUPPORTED_SECURITY_TYPES.includes(schemeDetails.type),
    );

  const apiKeySchemes = supportedSchemes.filter(scheme => scheme.type === SECURITY_TYPE.API_KEY);
  const apiKeyHeaders = apiKeySchemes
    .filter(scheme => scheme.in === 'header')
    .map(scheme => {
      const variableName = changeCase.camelCase(scheme.name);
      return {
        name: scheme.name,
        disabled: false,
        value: `{{ ${variableName} }}`,
      };
    });
  const apiKeyCookies = apiKeySchemes
    .filter(scheme => scheme.in === 'cookie')
    .map(scheme => {
      const variableName = changeCase.camelCase(scheme.name);
      return `${scheme.name}={{ ${variableName} }}`;
    });
  const apiKeyCookieHeader = { name: 'Cookie', disabled: false, value: apiKeyCookies.join('; ') };
  const apiKeyParams = apiKeySchemes
    .filter(scheme => scheme.in === 'query')
    .map(scheme => {
      const variableName = changeCase.camelCase(scheme.name);
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
        return parseHttpAuth(authScheme.scheme);
      case SECURITY_TYPE.OAUTH:
        return parseOAuth2(authScheme);
      default:
        return {};
    }
  })();

  return {
    authentication,
    headers: apiKeyHeaders,
    parameters: apiKeyParams,
  };
}

/**
 * Get Insomnia environment variables for OpenAPI securitySchemes
 *
 * @param {Object} securitySchemes - Open API security schemes
 * @returns {Object} Insomnia environment variables containing security information
 */
function getSecurityEnvVariables(securitySchemes) {
  if (!securitySchemes) {
    return {};
  }

  const variables = {};
  const securitySchemesArray = Object.values(securitySchemes);
  const apiKeyVariableNames = securitySchemesArray
    .filter(scheme => scheme.type === SECURITY_TYPE.API_KEY)
    .map(scheme => changeCase.camelCase(scheme.name));
  const hasHttpBasicScheme = securitySchemesArray.some(
    scheme => scheme.type === SECURITY_TYPE.HTTP && scheme.scheme === 'basic',
  );
  const hasHttpBearerScheme = securitySchemesArray.some(
    scheme => scheme.type === SECURITY_TYPE.HTTP && scheme.scheme === 'bearer',
  );
  const oauth2Variables = securitySchemesArray.reduce((acc, scheme) => {
    if (scheme.type === SECURITY_TYPE.OAUTH && scheme.scheme === 'bearer') {
      acc.oauth2ClientId = 'clientId';
      const flows = scheme.flows || {};
      if (flows.authorizationCode || flows.clientCredentials || flows.password) {
        acc.oauth2ClientSecret = 'clientSecret';
      }
      if (flows.password) {
        acc.oauth2Username = 'username';
        acc.oauth2Password = 'password';
      }
    }
    return acc;
  }, {});

  Array.from(new Set(apiKeyVariableNames)).forEach(name => {
    variables[name] = name;
  });

  if (hasHttpBasicScheme) {
    variables.httpUsername = 'username';
    variables.httpPassword = 'password';
  }

  if (hasHttpBearerScheme) {
    variables.bearerToken = 'bearerToken';
  }

  return { ...variables, ...oauth2Variables };
}

/**
 * Imports insomnia request body definitions, including data mock (if available)
 *
 * If multiple types are available, the one for which an example can be generated will be selected first (i.e. application/json)
 *
 * @param {Object} endpointSchema - OpenAPI 3 endpoint schema
 *
 * @return {Object} insomnia request's body definition
 */
function prepareBody(endpointSchema) {
  // request
  const requestBody = endpointSchema.requestBody || {};
  const content = requestBody.content || {};
  const mimeTypes = Object.keys(content);

  const isAvailable = m => mimeTypes.includes(m);
  const supportedMimeType = SUPPORTED_MIME_TYPES.find(isAvailable);

  if (supportedMimeType === MIMETYPE_JSON) {
    const bodyParameter = content[supportedMimeType];

    if (bodyParameter == null) {
      return {
        mimeType: MIMETYPE_JSON,
      };
    }

    const example = generateParameterExample(bodyParameter.schema);
    const text = JSON.stringify(example, null, 2);
    return {
      mimeType: MIMETYPE_JSON,
      text,
    };
  }

  if (mimeTypes && mimeTypes.length && mimeTypes[0] !== MIMETYPE_LITERALLY_ANYTHING) {
    return {
      mimeType: mimeTypes[0] || undefined,
    };
  } else {
    return {};
  }
}

/**
 * Converts openapi schema of parametes into insomnia one.
 *
 * @param {Object[]} parameters - array of OpenAPI schemas of parameters
 * @returns {Object[]} array of insomnia parameters definitions
 */
function convertParameters(parameters) {
  return parameters.map(parameter => {
    const { required, name, schema } = parameter;
    return {
      name,
      disabled: required !== true,
      value: `${generateParameterExample(schema)}`,
    };
  });
}

/**
 * Generate example value of parameter based on it's schema.
 * Returns example / default value of the parameter, if any of those are defined. If not, returns value based on parameter type.
 *
 * @param {string|Object} schema - OpenAPI 3 parameter definition object
 * (https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.0.md#parameterObject) or string with valid parameter type
 *
 * @returns {*}
 */
function generateParameterExample(schema) {
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
    object: schema => {
      const example = {};
      const { properties } = schema;

      if (properties) {
        for (const propertyName of Object.keys(properties)) {
          example[propertyName] = generateParameterExample(properties[propertyName]);
        }
      }

      return example;
    },
    array: schema => {
      const value = generateParameterExample(schema.items);
      if (schema.collectionFormat === 'csv') {
        return value;
      } else {
        return [value];
      }
    },
  };

  if (typeof schema === 'string') {
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

    const factory = typeExamples[`${type}_${format}`] || typeExamples[type];

    if (!factory) {
      return null;
    }

    return factory(schema);
  }
}

/**
 * Generates a unique and deterministic request ID based on the endpoint schema
 *
 * @param endpointSchema
 */
function generateUniqueRequestId(endpointSchema) {
  // `operationId` is unique already, so we can just use that, combined with the ID
  // of the workspace to get something globally unique
  const uniqueKey = endpointSchema.operationId
    ? `${endpointSchema.operationId}`
    : `[${endpointSchema.method}]${endpointSchema.path}`;

  const hash = crypto
    .createHash('sha1')
    .update(uniqueKey)
    .digest('hex')
    .slice(0, 8);

  // Suffix the ID with a counter in case we try creating two with the same hash
  if (requestCounts.hasOwnProperty(hash)) {
    requestCounts[hash]++;
  } else {
    requestCounts[hash] = 0;
  }

  return `req_${WORKSPACE_ID}${hash}${requestCounts[hash] || ''}`;
}

function parseHttpAuth(scheme) {
  switch (scheme) {
    case HTTP_AUTH_SCHEME.BASIC:
      return importBasicAuthentication();
    case HTTP_AUTH_SCHEME.BEARER:
      return importBearerAuthentication();
    default:
      return {};
  }
}

function parseOAuth2Scopes(flow) {
  const scopes = Object.keys(flow.scopes || {});
  return scopes.join(' ');
}

function mapOAuth2GrantType(grantType) {
  const types = {
    [OAUTH_FLOWS.AUTHORIZATION_CODE]: 'authorization_code',
    [OAUTH_FLOWS.CLIENT_CREDENTIALS]: 'client_credentials',
    [OAUTH_FLOWS.IMPLICIT]: 'implicit',
    [OAUTH_FLOWS.PASSWORD]: 'password',
  };

  return types[grantType];
}

function parseOAuth2(scheme) {
  const flows = Object.keys(scheme.flows);

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
        accessTokenUrl: flow.tokenUrl,
        authorizationUrl: flow.authorizationUrl,
      };
    case OAUTH_FLOWS.CLIENT_CREDENTIALS:
      return {
        ...base,
        clientSecret: '{{ oauth2ClientSecret }}',
        accessTokenUrl: flow.tokenUrl,
      };
    case OAUTH_FLOWS.IMPLICIT:
      return {
        ...base,
        authorizationUrl: flow.authorizationUrl,
      };
    case OAUTH_FLOWS.PASSWORD:
      return {
        ...base,
        clientSecret: '{{ oauth2ClientSecret }}',
        username: '{{ oauth2Username }}',
        password: '{{ oauth2Password }}',
        accessTokenUrl: flow.tokenUrl,
      };
  }
}

function importBearerAuthentication() {
  return {
    type: 'bearer',
    token: '{{bearerToken}}',
    prefix: '',
  };
}

function importBasicAuthentication() {
  return {
    type: 'basic',
    username: '{{ httpUsername }}',
    password: '{{ httpPassword }}',
  };
}
